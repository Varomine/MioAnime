// AniDB Scraper API Service for DB Streaming Server
const BASE_URL = 'https://anidb-scraper-api.sapis.workers.dev';

// In-memory caches to prevent redundant requests
const searchCache = new Map();
const animeCache = new Map();
const streamCache = new Map();

function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSeasonNumber(titleStr) {
  const norm = (titleStr || '').toLowerCase();
  const seasonMatch = norm.match(/season\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (seasonMatch) {
    const val = seasonMatch[1];
    if (/\d+/.test(val)) return parseInt(val, 10);
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return words[val] || null;
  }
  const ordinalMatch = norm.match(/(\d+)(st|nd|rd|th)\s+season/);
  if (ordinalMatch) {
    return parseInt(ordinalMatch[1], 10);
  }
  const romanMatch = norm.match(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/);
  if (romanMatch) {
    const roman = romanMatch[1];
    const map = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    return map[roman] || null;
  }
  return null;
}

function cleanTitleForBaseComparison(normTitle) {
  return normTitle
    .replace(/season\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/g, '')
    .replace(/(\d+)(st|nd|rd|th)\s+season/g, '')
    .replace(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchAniDb(query) {
  if (!query) return [];
  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      searchCache.set(cacheKey, json.data);
      return json.data;
    }
    return [];
  } catch (err) {
    console.error('Error searching AniDB:', err);
    return [];
  }
}

export function findBestAniDbMatch(animeData, results) {
  if (!animeData || !results || results.length === 0) return null;

  const targetTitles = [
    animeData.title_english,
    animeData.title,
    animeData.title_japanese,
    ...(animeData.title_synonyms || [])
  ].filter(Boolean);

  let bestMatch = null;
  let highestScore = 0;

  for (const t of targetTitles) {
    const tNorm = normalizeTitle(t);
    const tSeason = getSeasonNumber(t) || 1;
    const tBase = cleanTitleForBaseComparison(tNorm);

    for (const r of results) {
      const rTitle = r.title || '';
      const rNorm = normalizeTitle(rTitle);
      const rSeason = getSeasonNumber(rNorm) || 1;
      const rBase = cleanTitleForBaseComparison(rNorm);

      if (tSeason !== rSeason) continue;

      let score = 0;
      if (tNorm === rNorm) {
        score = 100;
      } else if (tBase.length > 2 && rBase.length > 2 && tBase === rBase) {
        score = 90;
      } else if (rNorm.includes(tNorm) || tNorm.includes(rNorm)) {
        score = 80;
      } else if (tBase.length > 3 && rBase.length > 3 && (rBase.includes(tBase) || tBase.includes(rBase))) {
        score = 60;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = r;
      }
    }
  }

  // Only return match if confident (score >= 50). Do NOT force false matches!
  if (highestScore >= 50) {
    return bestMatch;
  }

  return null;
}

export async function getAniDbAnime(id) {
  if (!id) return null;
  if (animeCache.has(id)) {
    return animeCache.get(id);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/anime/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      animeCache.set(id, json.data);
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('Error fetching AniDB anime details:', err);
    return null;
  }
}

export async function getAniDbEpisodeStream(episodeId) {
  if (!episodeId) return null;
  const epKey = String(episodeId);
  if (streamCache.has(epKey)) {
    return streamCache.get(epKey);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/watch/${epKey}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data) return null;

    const data = json.data;
    const sources = data.sources || [];
    const embeds = data.embeds || [];

    // Filter for Japanese stream source first
    const jpSource = sources.find(s => {
      const lang = (s.language || '').toLowerCase();
      return lang.includes('japan') || lang.includes('sub') || lang === 'jpn';
    });

    const targetSource = jpSource || sources[0];

    let result = null;
    if (targetSource && targetSource.url) {
      result = {
        streamUrl: targetSource.url,
        rawUrl: targetSource.rawUrl || targetSource.url,
        type: targetSource.type || 'hls',
        quality: targetSource.quality || 'HD',
        headers: data.headers || {}
      };
    } else {
      const jpEmbed = embeds.find(e => {
        const lang = (e.language || '').toLowerCase();
        return lang.includes('japan') || lang.includes('sub') || e.code === 'jpn';
      }) || embeds[0];

      if (jpEmbed && jpEmbed.embedUrl) {
        result = {
          embedUrl: jpEmbed.embedUrl,
          type: 'iframe'
        };
      }
    }

    if (result) {
      streamCache.set(epKey, result);
    }
    return result;
  } catch (err) {
    console.error('Error fetching AniDB episode stream:', err);
    return null;
  }
}

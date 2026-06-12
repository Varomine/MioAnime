// AniZone API Service
// Base URL: https://anizone-api.mdtahseen7378.workers.dev

const BASE_URL = 'https://anizone-api.mdtahseen7378.workers.dev';

/**
 * Cleans anime title for AniZone search:
 * Cuts all special characters, keeps only alphanumeric characters and spaces.
 */
export function cleanTitleForAniZone(title) {
  if (!title) return '';
  return title
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // replace special chars with spaces
    .replace(/\s+/g, ' ')            // collapse multiple spaces
    .trim();
}

/**
 * Searches AniZone for a matching anime using its title.
 */
export async function searchAniZone(title) {
  const keyword = cleanTitleForAniZone(title);
  if (!keyword) return null;

  try {
    const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(keyword)}`);
    if (!response.ok) {
      throw new Error(`AniZone Search failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      return null;
    }

    const cleanSearchTitle = keyword.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const candidates = result.data;

    // Look for exact normalized title match in candidates
    let matchedAnime = candidates.find(anime => {
      const romajiClean = (anime.title?.romaji || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const englishClean = (anime.title?.english || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return romajiClean === cleanSearchTitle || englishClean === cleanSearchTitle;
    });

    // If not found, look for title containing search title
    if (!matchedAnime) {
      matchedAnime = candidates.find(anime => {
        const romajiClean = (anime.title?.romaji || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const englishClean = (anime.title?.english || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return romajiClean.includes(cleanSearchTitle) || englishClean.includes(cleanSearchTitle);
      });
    }

    // Fallback to first candidate
    if (!matchedAnime) {
      matchedAnime = candidates[0];
    }

    return {
      id: matchedAnime.id,
      title: matchedAnime.title?.english || matchedAnime.title?.romaji || '',
      totalEpisodes: matchedAnime.totalEpisodes || 0
    };
  } catch (err) {
    console.error('Error searching AniZone:', err);
    return null;
  }
}

/**
 * Fetches the list of episodes for a given anime ID on AniZone.
 */
export async function getAniZoneEpisodes(animeId) {
  if (!animeId) return { total: 0, episodes: [] };
  try {
    const response = await fetch(`${BASE_URL}/episodes/${animeId}`);
    if (!response.ok) {
      throw new Error(`AniZone Episodes failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
      return { total: 0, episodes: [] };
    }
    return {
      total: result.data.length,
      episodes: result.data.map(ep => ({
        id: ep.id,
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        img: ep.image?.large || ep.image?.medium || ep.image?.small || null,
        description: ep.description || ''
      }))
    };
  } catch (err) {
    console.error('Error fetching AniZone episodes:', err);
    return { total: 0, episodes: [] };
  }
}

/**
 * Resolves stream sources and subtitles for a specific episode of an anime.
 */
export async function getAniZoneStream(animeId, episodeNumber, episodeId = null) {
  if (!animeId) return null;
  
  // Base64 encode the animeId/episodeNumber if direct episodeId is not provided
  let epId = episodeId;
  if (!epId) {
    try {
      epId = btoa(`${animeId}/${episodeNumber}`);
    } catch (e) {
      console.error('Failed to encode episodeId:', e);
      epId = '';
    }
  }

  try {
    const response = await fetch(`${BASE_URL}/sources?id=${animeId}&episodeId=${encodeURIComponent(epId)}`);
    if (!response.ok) {
      throw new Error(`AniZone Sources failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.data) {
      return null;
    }
    
    // Extract raw stream urls (user requested: use "url", not "proxyUrl")
    const streams = (result.data.sources || []).map(src => ({
      quality: src.quality || 'AniZone HLS',
      streamUrl: src.url, // raw url, don't use proxyUrl
      type: src.type
    }));

    return {
      streams,
      subtitles: result.data.subtitles || [],
      headers: result.data.headers || {}
    };
  } catch (err) {
    console.error('Error fetching AniZone stream:', err);
    return null;
  }
}

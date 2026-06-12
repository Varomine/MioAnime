// HAnime API Service
// Base URL: https://hanime-scraper.sapis.workers.dev/

const BASE_URL = 'https://hanime-scraper.sapis.workers.dev';

/**
 * Cleans anime title for HAnime:
 * Converts to lowercase, removes special characters, and replaces spaces with hyphens.
 */
export function cleanTitleForHAnime(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // delete special chars
    .replace(/\s+/g, '-')         // replace spacebar with "-"
    .replace(/-+/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');     // trim hyphens from start/end
}

/**
 * Fetches video metadata by slug
 * GET /api/video/:slug
 */
export async function fetchVideoBySlug(slug) {
  try {
    const res = await fetch(`${BASE_URL}/api/video/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.streams && data.streams.length > 0) {
      return data;
    }
  } catch (e) {
    console.error(`Error fetching HAnime slug ${slug}:`, e);
  }
  return null;
}

/**
 * Searches HAnime using the scraper search endpoint
 * GET /api/search?q={query}
 */
export async function searchHAnime(query) {
  try {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.results && data.results.length > 0) {
      return data.results;
    }
  } catch (e) {
    console.error('HAnime search failed:', e);
  }
  return null;
}

/**
 * Full flow: constructs slug, queries the API with fallbacks, and returns streams.
 * Priority:
 * 1. Cleaned title + "-season-1" (for finished) / Cleaned title + "-[episode]" (for ongoing)
 * 2. Search fallback
 */
export async function getHAnimeStreams(animeData, episode) {
  if (!animeData) return null;
  const status = animeData.status;
  const mainTitle = animeData.title || '';
  const englishTitle = animeData.title_english || '';
  
  const baseSlugMain = cleanTitleForHAnime(mainTitle);
  const baseSlugEng = cleanTitleForHAnime(englishTitle);
  
  const isFinished = status === 'Finished Airing';
  
  // Generate candidate slugs
  const candidates = [];
  
  if (isFinished) {
    if (baseSlugMain) candidates.push(`${baseSlugMain}-season-1`);
    if (baseSlugEng) candidates.push(`${baseSlugEng}-season-1`);
    if (baseSlugMain) candidates.push(`${baseSlugMain}-${episode}`);
    if (baseSlugEng) candidates.push(`${baseSlugEng}-${episode}`);
    if (baseSlugMain) candidates.push(baseSlugMain);
    if (baseSlugEng) candidates.push(baseSlugEng);
  } else {
    if (baseSlugMain) candidates.push(`${baseSlugMain}-${episode}`);
    if (baseSlugEng) candidates.push(`${baseSlugEng}-${episode}`);
    if (baseSlugMain) candidates.push(`${baseSlugMain}-season-1`);
    if (baseSlugEng) candidates.push(`${baseSlugEng}-season-1`);
    if (baseSlugMain) candidates.push(baseSlugMain);
    if (baseSlugEng) candidates.push(baseSlugEng);
  }
  
  // Deduplicate candidates
  const uniqueCandidates = [...new Set(candidates)];
  
  // Try candidate slugs
  for (const slug of uniqueCandidates) {
    const data = await fetchVideoBySlug(slug);
    if (data) {
      return {
        slug,
        streams: data.streams.map(s => ({
          quality: s.quality,
          streamUrl: s.url
        }))
      };
    }
  }
  
  // If candidates failed, try search
  const searchQueries = [mainTitle, englishTitle].filter(Boolean);
  for (const query of searchQueries) {
    const results = await searchHAnime(query);
    if (results && results.length > 0) {
      // Find the best matching video. Let's try to match by slug suffix.
      const targetSuffixes = isFinished ? ['-season-1', `-${episode}`] : [`-${episode}`];
      
      let matchedVideo = null;
      for (const suffix of targetSuffixes) {
        matchedVideo = results.find(v => v.slug && v.slug.endsWith(suffix));
        if (matchedVideo) break;
      }
      
      if (!matchedVideo) {
        const cleanedQuery = cleanTitleForHAnime(query);
        matchedVideo = results.find(v => v.slug && v.slug.startsWith(cleanedQuery));
      }
      
      if (!matchedVideo) {
        matchedVideo = results[0];
      }
      
      if (matchedVideo && matchedVideo.slug) {
        const data = await fetchVideoBySlug(matchedVideo.slug);
        if (data) {
          return {
            slug: matchedVideo.slug,
            streams: data.streams.map(s => ({
              quality: s.quality,
              streamUrl: s.url
            }))
          };
        }
      }
    }
  }
  
  return null;
}

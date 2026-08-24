// AniBD (BD) API Service
// Base URL: https://anibd-scraper-api.sapis.workers.dev

const BASE_URL = 'https://anibd-scraper-api.sapis.workers.dev';

/**
 * Searches BD API for matching anime.
 * GET /api/search?q={query}
 */
export async function searchBd(title) {
  if (!title || typeof title !== 'string') return null;
  const qStr = title.trim();
  if (!qStr) return null;

  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(qStr)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();

    if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
      const first = json.data[0];
      return { id: first.id, title: first.title, anilistId: first.anilistId };
    }
    return null;
  } catch (err) {
    console.error('BD search error:', err);
    return null;
  }
}

/**
 * Fetches anime details and episode list from BD API.
 * GET /api/anime/:id
 */
export async function getBdAnimeDetails(bdId) {
  if (!bdId) return null;
  try {
    const url = `${BASE_URL}/api/anime/${encodeURIComponent(bdId)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('BD anime details error:', err);
    return null;
  }
}

/**
 * Fetches stream sources and subtitles for a dataId from BD API.
 * GET /api/watch/:dataId
 */
export async function getBdStream(dataId) {
  if (!dataId) return null;
  try {
    const url = `${BASE_URL}/api/watch/${encodeURIComponent(dataId)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('BD stream error:', err);
    return null;
  }
}

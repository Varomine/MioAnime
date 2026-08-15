// Mio API Service
// Base URL: https://mioanime-scraper-worker.sapis.workers.dev

const BASE_URL = 'https://mioanime-scraper-worker.sapis.workers.dev';

/**
 * Search for anime on Mio
 * GET /api/search?q={query}
 */
export async function searchMio(query) {
  if (!query || typeof query !== 'string') return [];
  const qStr = query.trim();
  if (!qStr) return [];
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(qStr)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Mio search failed:', error);
    return [];
  }
}

/**
 * Get anime details (Watch url) on Mio
 * GET /api/anime/{id}
 */
export async function getMioAnime(id) {
  if (!id) return null;
  const strId = String(id).trim();
  if (!strId || strId.includes('..') || strId.includes('/') || strId.includes('\\') || strId === '.' || strId === '..') {
    return null;
  }

  try {
    const url = `${BASE_URL}/api/anime/${encodeURIComponent(strId)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Mio anime details failed:', error);
    return null;
  }
}

/**
 * Get episodes list
 * GET /api/season?url={seasonUrl}
 */
export async function getMioEpisodes(seasonUrl) {
  if (!seasonUrl || typeof seasonUrl !== 'string') return [];
  const urlStr = seasonUrl.trim();
  if (!urlStr) return [];
  try {
    const url = `${BASE_URL}/api/season?url=${encodeURIComponent(urlStr)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const json = await response.json();
    return json.episodes || [];
  } catch (error) {
    console.error('Mio episodes failed:', error);
    return [];
  }
}

/**
 * Get direct stream url for an episode
 * GET /api/episode?url={episodeUrl}
 */
export async function getMioEpisodeStream(episodeUrl) {
  if (!episodeUrl || typeof episodeUrl !== 'string') return null;
  const urlStr = episodeUrl.trim();
  if (!urlStr) return null;
  try {
    const url = `${BASE_URL}/api/episode?url=${encodeURIComponent(urlStr)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    if (json.servers && json.servers.length > 0) {
      return json.servers[0].proxied_url || null;
    }
    return null;
  } catch (error) {
    console.error('Mio episode stream failed:', error);
    return null;
  }
}

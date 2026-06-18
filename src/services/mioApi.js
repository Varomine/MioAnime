// Mio API Service
// Base URL: https://mioanime-scraper-worker.sapis.workers.dev

const BASE_URL = 'https://mioanime-scraper-worker.sapis.workers.dev';

/**
 * Search for anime on Mio
 * GET /api/search?q={query}
 */
export async function searchMio(query) {
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mio search failed: ${response.status}`);
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
  try {
    const url = `${BASE_URL}/api/anime/${encodeURIComponent(id)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mio anime details failed: ${response.status}`);
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
  try {
    const url = `${BASE_URL}/api/season?url=${encodeURIComponent(seasonUrl)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mio episodes failed: ${response.status}`);
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
  try {
    const url = `${BASE_URL}/api/episode?url=${encodeURIComponent(episodeUrl)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mio episode stream failed: ${response.status}`);
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

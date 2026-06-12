// Verse API Service
// Base URL: https://animeverse-scraper-api.sapis.workers.dev

const BASE_URL = 'https://animeverse-scraper-api.sapis.workers.dev';

/**
 * Search for anime on Verse
 * GET /api/search?q={query}
 * Returns: { items: [{ id, slug, title, alternativeTitle, ... }] }
 */
export async function searchVerse(query) {
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Verse search failed: ${response.status}`);
    const json = await response.json();
    return json.items || [];
  } catch (error) {
    console.error('Verse search failed:', error);
    return [];
  }
}

/**
 * Get direct stream URL for a specific episode
 * GET /api/anime/{slug}/stream/{episode}
 * Returns: { stream: "url" }
 */
export async function getVerseStream(slug, episodeNumber) {
  try {
    const url = `${BASE_URL}/api/anime/${encodeURIComponent(slug)}/stream/${episodeNumber}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Verse stream failed: ${response.status}`);
    const json = await response.json();
    return json.stream || null;
  } catch (error) {
    console.error('Verse stream failed:', error);
    return null;
  }
}

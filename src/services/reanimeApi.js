// Re:Anime API Service
// Base URL: https://reanime-scraper-api.sapis.workers.dev

const BASE_URL = 'https://reanime-scraper-api.sapis.workers.dev';

/**
 * Search for anime on Re:Anime
 * GET /api/search?q={query}
 * Returns: { success: true, results: [...] }
 */
export async function searchReAnime(query) {
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Re:Anime search failed: ${response.status}`);
    const json = await response.json();
    return json.results || json.items || json.data || [];
  } catch (error) {
    console.error('Re:Anime search failed:', error);
    return [];
  }
}

/**
 * Get direct stream embed URL for a specific episode
 * GET /api/watch/{anime_id}/episodes/{episode}
 * Filters the streams array for dataType === 'sub' and returns its embedUrl
 */
export async function getReAnimeStream(animeId, episodeNumber) {
  try {
    const url = `${BASE_URL}/api/watch/${encodeURIComponent(animeId)}/episodes/${episodeNumber}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Re:Anime stream failed: ${response.status}`);
    const json = await response.json();
    if (!json.success || !Array.isArray(json.streams)) return null;

    // Use the stream with dataType === 'sub'
    const matched = json.streams.find(s => s.dataType?.toLowerCase() === 'sub');
    // Fallback: if no sub, use first stream
    const finalMatch = matched || json.streams[0];

    return finalMatch ? (finalMatch.embedUrl || finalMatch.embed_url) : null;
  } catch (error) {
    console.error('Re:Anime stream failed:', error);
    return null;
  }
}

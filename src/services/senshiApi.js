// Senshi API Service
// Base URL: https://senshi-api.sapis.workers.dev

const BASE_URL = 'https://senshi-api.sapis.workers.dev';

/**
 * Resolves stream sources for a specific episode of an anime.
 * GET /api/anime/[malid]/episodes/[episode]/streams
 * Filters for server "ninstream" and status "hardsub" (proxyUrl).
 */
export async function getSenshiStream(malId, episodeNumber) {
  if (!malId) return null;
  try {
    const response = await fetch(`${BASE_URL}/api/anime/${malId}/episodes/${episodeNumber}/streams`);
    if (!response.ok) {
      throw new Error(`Senshi Stream failed: ${response.status}`);
    }
    const result = await response.json();
    if (result.status !== 'success' || !Array.isArray(result.data)) {
      return null;
    }

    // Filter to choose server "ninstream" and status "hardsub" (case-insensitive)
    const matched = result.data.find(
      item =>
        item.server?.toLowerCase() === 'ninstream' &&
        item.status?.toLowerCase() === 'hardsub'
    );

    // Fallback: if no hardsub, search for any ninstream
    const fallbackNinstream = matched || result.data.find(item => item.server?.toLowerCase() === 'ninstream');

    // Fallback 2: if no ninstream, take the first option
    const finalMatch = fallbackNinstream || result.data[0];

    if (!finalMatch || !finalMatch.proxyUrl) {
      return null;
    }

    return [{
      quality: `Senshi ${finalMatch.status || 'HLS'}`,
      streamUrl: finalMatch.proxyUrl
    }];
  } catch (err) {
    console.error('Error fetching Senshi stream:', err);
    return null;
  }
}

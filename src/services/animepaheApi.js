// Anikage Scraper API Service
// Base URL: https://anikage-scraper-api.sapis.workers.dev
// Provider: pahe only | Lang: dub only

const BASE_URL = 'https://anikage-scraper-api.sapis.workers.dev';
const PROVIDER = 'neko';
const LANG = 'sub';

/**
 * Search for anime by title
 * GET /api/search?q={query}&page={page}&perPage={perPage}
 * Returns: { success, data: { results: [{ slug, anilistId, title, totalEpisodes, ... }] } }
 */
export async function searchAnikage(query, page = 1, perPage = 10) {
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}&page=${page}&perPage=${perPage}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('Search returned success=false');
    return json.data?.results || [];
  } catch (error) {
    console.error('Anikage search failed:', error);
    return [];
  }
}

/**
 * Get anime info by slug
 * GET /api/info?slug={slug}
 */
export async function getAnikageInfo(slug) {
  try {
    const url = `${BASE_URL}/api/info?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Info failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('Info returned success=false');
    return json.data || null;
  } catch (error) {
    console.error('Anikage info failed:', error);
    return null;
  }
}

/**
 * Get episodes list by slug
 * GET /api/episodes?slug={slug}
 * Returns: { success, total, data: [{ id, number, title, description, img, ... }] }
 */
export async function getAnikageEpisodes(slug) {
  try {
    const url = `${BASE_URL}/api/episodes?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Episodes failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('Episodes returned success=false');
    return {
      total: json.total || 0,
      episodes: json.data || [],
    };
  } catch (error) {
    console.error('Anikage episodes failed:', error);
    return { total: 0, episodes: [] };
  }
}

/**
 * Get streaming sources for an episode
 * GET /api/streams?slug={slug}&episode={episodeNumber}&provider=pahe&lang=dub
 * Returns: { success, data: { sources: [{ url, quality, isM3U8, streamUrl }], intro, outro } }
 * 
 * streamUrl is a direct HLS URL: https://prox.anikage.cc/stream/.../index.txt
 */
export async function getAnikageStreams(slug, episodeNumber, provider = 'neko') {
  try {
    const url = `${BASE_URL}/api/streams?slug=${encodeURIComponent(slug)}&episode=${episodeNumber}&provider=${provider}&lang=${LANG}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Streams failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('Streams returned success=false');

    const data = json.data || {};
    return {
      sources: data.sources || [],
      subtitles: data.subtitles || [],
      intro: data.intro || null,
      outro: data.outro || null,
      headers: data.headers || '',
    };
  } catch (error) {
    console.error('Anikage streams failed:', error);
    return null;
  }
}

/**
 * Pick the best quality stream source
 * Priority: 1080p > 720p > 480p > 360p
 */
export function getBestSource(sources) {
  if (!sources || sources.length === 0) return null;

  const priority = ['1080p', '720p', '480p', '360p'];
  for (const q of priority) {
    const match = sources.find(s => s.quality === q);
    if (match) return match;
  }
  return sources[0];
}

/**
 * Full flow: search anime → get slug → get streams for episode
 * Returns the HLS streamUrl directly
 */
export async function getStreamForEpisode(animeTitle, episodeNumber = 1) {
  // Step 1: Search
  const results = await searchAnikage(animeTitle);
  if (results.length === 0) return null;

  const anime = results[0];
  const slug = anime.slug;

  // Step 2: Get streams
  const streamData = await getAnikageStreams(slug, episodeNumber);
  if (!streamData) return null;

  const bestSource = getBestSource(streamData.sources);

  return {
    anime,
    slug,
    source: bestSource,
    streamUrl: bestSource?.streamUrl || null,
    allSources: streamData.sources,
    intro: streamData.intro,
    outro: streamData.outro,
  };
}

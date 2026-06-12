// Jikan API v4 Service
// Base URL: https://api.jikan.moe/v4
// Rate limit: 3 req/sec, 60 req/min

const BASE_URL = 'https://api.jikan.moe/v4';

// Simple rate limiter - queue requests to avoid hitting limits
const requestQueue = [];
let isProcessing = false;
const MIN_DELAY = 350; // ~3 req/sec

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(url) {
  return url;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const { url, resolve, reject, bypassCache } = requestQueue.shift();

    // Check cache first
    if (!bypassCache) {
      const cached = getFromCache(getCacheKey(url));
      if (cached) {
        resolve(cached);
        continue;
      }
    }

    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited - wait and retry
        requestQueue.unshift({ url, resolve, reject, bypassCache });
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status}`);
      }

      const data = await response.json();
      if (!bypassCache) {
        setCache(getCacheKey(url), data);
      }
      resolve(data);
    } catch (error) {
      reject(error);
    }

    // Delay between requests
    await new Promise(r => setTimeout(r, MIN_DELAY));
  }

  isProcessing = false;
}

function enqueueRequest(url, options = {}) {
  const { bypassCache = false } = options;
  return new Promise((resolve, reject) => {
    // Check cache immediately
    if (!bypassCache) {
      const cached = getFromCache(getCacheKey(url));
      if (cached) {
        resolve(cached);
        return;
      }
    }

    requestQueue.push({ url, resolve, reject, bypassCache });
    processQueue();
  });
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}

// ---- API Functions ----

export async function getTopAnime(params = {}) {
  const url = buildUrl('/top/anime', { limit: 20, ...params });
  return enqueueRequest(url);
}

export async function getTrendingAnime() {
  return getTopAnime({ filter: 'airing', limit: 20 });
}

export async function getMostFavoriteAnime() {
  return getTopAnime({ filter: 'favorite', limit: 20 });
}

export async function getPopularAnime() {
  return getTopAnime({ filter: 'bypopularity', limit: 20 });
}

export async function getSeasonalAnime(year, season, params = {}) {
  const url = buildUrl(`/seasons/${year}/${season}`, { limit: 25, ...params });
  return enqueueRequest(url);
}

export async function getCurrentSeasonAnime(params = {}) {
  const url = buildUrl('/seasons/now', { limit: 20, ...params });
  return enqueueRequest(url);
}

export async function getUpcomingAnime(params = {}) {
  const url = buildUrl('/seasons/upcoming', { limit: 20, ...params });
  return enqueueRequest(url);
}

export async function searchAnime(params = {}) {
  const { sfw = true, ...rest } = params;
  const url = buildUrl('/anime', { limit: 25, sfw, ...rest });
  return enqueueRequest(url);
}

export async function getAnimeById(id) {
  const url = buildUrl(`/anime/${id}/full`);
  return enqueueRequest(url);
}

export async function getAnimeCharacters(id) {
  const url = buildUrl(`/anime/${id}/characters`);
  return enqueueRequest(url);
}

export async function getAnimeRecommendations(id) {
  const url = buildUrl(`/anime/${id}/recommendations`);
  return enqueueRequest(url);
}

export async function getAnimeEpisodes(id, page = 1) {
  const url = buildUrl(`/anime/${id}/episodes`, { page });
  return enqueueRequest(url);
}

export async function getGenres() {
  const url = buildUrl('/genres/anime');
  return enqueueRequest(url);
}

export async function getSchedules(day) {
  const params = day ? { filter: day } : {};
  const url = buildUrl('/schedules', { limit: 25, ...params });
  return enqueueRequest(url);
}

export async function getSeasonsList() {
  const url = buildUrl('/seasons');
  return enqueueRequest(url);
}

// Helper: get banner-worthy anime (currently airing popular anime of the season, limited to 5)
export async function getBannerAnime() {
  try {
    const response = await getCurrentSeasonAnime({ limit: 20 });
    if (response && response.data) {
      const sorted = [...response.data]
        .filter(anime => anime.members !== undefined && anime.members !== null)
        .sort((a, b) => b.members - a.members);
      return { data: sorted.slice(0, 5) };
    }
    return response;
  } catch (error) {
    console.error('Failed to get banner seasonal trending anime:', error);
    const url = buildUrl('/seasons/now', { limit: 5 });
    return enqueueRequest(url);
  }
}

export async function getRandomAnime() {
  const url = buildUrl('/random/anime');
  return enqueueRequest(url, { bypassCache: true });
}

export async function getAnimeRelations(id) {
  const url = buildUrl(`/anime/${id}/relations`);
  return enqueueRequest(url);
}

export function getStatusText(status) {
  switch (status) {
    case 'Finished Airing': return 'FINISHED';
    case 'Currently Airing': return 'AIRING';
    case 'Not yet aired': return 'UPCOMING';
    default: return status?.toUpperCase() || '';
  }
}

export function getStatusClass(status) {
  switch (status) {
    case 'Finished Airing': return 'finished';
    case 'Currently Airing': return 'airing';
    case 'Not yet aired': return 'upcoming';
    default: return '';
  }
}

// Otaku Streamers API Service
// Base URL: https://otaku-streamers-api.premmiz-real.workers.dev

const BASE_URL = 'https://otaku-streamers-api.premmiz-real.workers.dev';

/**
 * Cleans anime title for Otaku search
 */
export function cleanTitleForOtaku(title) {
  if (!title) return '';
  return title
    .replace(/\(TV\)/gi, '')
    .replace(/\(Movie\)/gi, '')
    .replace(/Season \d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches Otaku Streamers API for a matching anime using title.
 * GET /api/search?q={query}
 */
export async function searchOtaku(title) {
  if (!title || typeof title !== 'string') return null;
  const rawTitle = title.trim();
  if (!rawTitle) return null;

  const queries = [rawTitle];
  const cleaned = cleanTitleForOtaku(rawTitle);
  if (cleaned && cleaned !== rawTitle) {
    queries.push(cleaned);
  }

  for (const q of queries) {
    try {
      const response = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) continue;
      const json = await response.json();

      const results = json.results || [];
      if (results.length > 0) {
        const valid = results.find(r => r.osid);
        if (valid) {
          return { osid: valid.osid, title: valid.title };
        }
      }
    } catch (err) {
      console.error('Error searching Otaku for query:', q, err);
    }
  }

  return null;
}

/**
 * Fetches streaming URL from Otaku Streamers API.
 * GET /api/stream?osid={osid}&ep={episode}
 */
export async function getOtakuStream(osid, episode) {
  if (!osid) return null;
  try {
    const response = await fetch(`${BASE_URL}/api/stream?osid=${encodeURIComponent(osid)}&ep=${encodeURIComponent(episode)}`);
    if (!response.ok) return null;
    const json = await response.json();
    return json.stream_url || null;
  } catch (err) {
    console.error('Error fetching Otaku stream:', err);
    return null;
  }
}

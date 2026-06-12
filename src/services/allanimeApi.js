// AllAnime API Service
// Documentation: https://github.com/mdtahseen7/Allanime-api

const BASE_URL = 'https://allanime-api.mdtahseen7378.workers.dev';

/**
 * Cleans anime title for AllAnime search:
 * Cuts all special characters, keeps only alphanumeric characters and spaces.
 */
export function cleanTitleForAllAnime(title) {
  if (!title) return '';
  return title
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // replace special chars with spaces
    .replace(/\s+/g, ' ')            // collapse multiple spaces
    .trim();
}

/**
 * Searches AllAnime for a matching anime using its English/Romaji name.
 * Uses subbed versions only.
 */
export async function searchAllAnime(title) {
  const keyword = cleanTitleForAllAnime(title);
  if (!keyword) return null;

  try {
    const response = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(keyword)}`);
    if (!response.ok) {
      throw new Error(`AllAnime Search failed: ${response.status}`);
    }
    const result = await response.json();
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }

    const cleanSearchTitle = keyword.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Filter out entries that don't have subbed episodes
    const subAnimeList = result.filter(anime => anime.episodes_sub > 0);
    const candidates = subAnimeList.length > 0 ? subAnimeList : result;

    // Look for exact normalized title match in candidates
    let matchedAnime = candidates.find(anime => {
      const aTitleClean = (anime.title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return aTitleClean === cleanSearchTitle;
    });

    // If not found, look for title starting with search title
    if (!matchedAnime) {
      matchedAnime = candidates.find(anime => {
        const aTitleClean = (anime.title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return aTitleClean.startsWith(cleanSearchTitle);
      });
    }

    // Fallback to first candidate
    if (!matchedAnime) {
      matchedAnime = candidates[0];
    }

    return {
      id: matchedAnime.id,
      title: matchedAnime.title,
      episodes_sub: matchedAnime.episodes_sub
    };
  } catch (err) {
    console.error('Error searching AllAnime:', err);
    return null;
  }
}

/**
 * Resolves stream sources for a specific episode of an anime (sub only)
 */
export async function getAllAnimeStream(showId, episode) {
  if (!showId) return null;
  return {
    episode_url: `${BASE_URL}/play?show_id=${showId}&ep_no=${episode}`
  };
}

// 123Anime API Service
// Documentation: https://123anime-api-bice.vercel.app/

const BASE_URL = 'https://123anime-api-bice.vercel.app';

/**
 * Cleans anime title for 123Anime search:
 * Cuts all special characters, keeps only alphanumeric characters and spaces.
 * Collapses multiple spaces, and formats for search query parameters.
 * E.g., "Re:Zero kara Hajimeru Isekai Seikatsu - Hyouketsu no Kizuna" -> "Re+Zero+kara+Hajimeru+Isekai+Seikatsu+Hyouketsu+no+Kizuna"
 */
export function cleanTitleFor123Anime(title) {
  if (!title) return '';
  return title
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // replace special chars with spaces
    .replace(/\s+/g, ' ')            // collapse multiple spaces
    .trim()
    .split(' ')
    .join('+');                      // join with +
}

/**
 * Derives the anime ID from the 123Anime result japanese_title:
 * E.g. "Rezero Kara Hajimeru Isekai Seikatsu Hyouketsu No Kizuna" -> "rezero-kara-hajimeru-isekai-seikatsu-hyouketsu-no-kizuna"
 */
export function deriveAnimeId(japaneseTitle) {
  if (!japaneseTitle) return '';
  return japaneseTitle
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Searches 123Anime for a matching anime using its JP/Romaji name
 */
export async function search123Anime(title) {
  const keyword = cleanTitleFor123Anime(title);
  if (!keyword) return null;

  try {
    const response = await fetch(`${BASE_URL}/search?keyword=${keyword}`);
    if (!response.ok) {
      throw new Error(`123Anime Search failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    const cleanSearchTitle = (title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Filter out dubs
    const subAnimeList = result.data.filter(anime => {
      const type = (anime.type || '').toLowerCase();
      const aTitle = (anime.title || '').toLowerCase();
      const jpTitle = (anime.japanese_title || '').toLowerCase();
      return type !== 'dub' && !aTitle.includes('(dub)') && !jpTitle.endsWith('dub') && !aTitle.endsWith(' dub');
    });

    const candidates = subAnimeList.length > 0 ? subAnimeList : result.data;

    // Look for exact normalized title match in english title or japanese title
    let matchedAnime = candidates.find(anime => {
      const aTitleClean = (anime.title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const jpTitleClean = (anime.japanese_title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return aTitleClean === cleanSearchTitle || jpTitleClean === cleanSearchTitle;
    });

    // If not found, look for title starting with search title
    if (!matchedAnime) {
      matchedAnime = candidates.find(anime => {
        const aTitleClean = (anime.title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const jpTitleClean = (anime.japanese_title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return aTitleClean.startsWith(cleanSearchTitle) || jpTitleClean.startsWith(cleanSearchTitle);
      });
    }

    // Fallback to first candidate
    if (!matchedAnime) {
      matchedAnime = candidates[0];
    }

    return {
      title: matchedAnime.title,
      japanese_title: matchedAnime.japanese_title,
      id: deriveAnimeId(matchedAnime.japanese_title),
      image: matchedAnime.image,
      episode: matchedAnime.episode
    };
  } catch (err) {
    console.error('Error searching 123Anime:', err);
    return null;
  }
}

/**
 * Resolves stream sources for a specific episode of an anime
 */
export async function get123AnimeStream(animeId, episode) {
  if (!animeId) return null;
  try {
    const response = await fetch(`${BASE_URL}/episode-stream?id=${animeId}&ep=${episode}`);
    if (!response.ok) {
      throw new Error(`123Anime Stream fetch failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.data) {
      return null;
    }
    return result.data;
  } catch (err) {
    console.error('Error fetching 123Anime stream:', err);
    return null;
  }
}

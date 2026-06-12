// Like Service — Local Storage tracking for Liked anime
const LOCAL_KEY = 'anivault_likes';

export function getLikes() {
  try {
    const data = localStorage.getItem(LOCAL_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function toggleLike(anime) {
  const likes = getLikes();
  const index = likes.findIndex(l => l.mal_id === anime.mal_id);
  if (index >= 0) {
    likes.splice(index, 1);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(likes));
    return false; // unliked
  } else {
    likes.push({
      mal_id: anime.mal_id,
      title: anime.title || anime.title_english || '',
      image: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
      score: anime.score || 0,
      type: anime.type || '',
      episodes: anime.episodes || 0,
      likedAt: Date.now(),
    });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(likes));
    return true; // liked
  }
}

export function isLiked(animeId) {
  return getLikes().some(l => l.mal_id === animeId);
}

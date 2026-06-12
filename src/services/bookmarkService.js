// Bookmark Service — Firebase Firestore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function addBookmark(userId, anime, category = 'Plan to Watch') {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    let bookmarks = [];
    if (snap.exists()) {
      bookmarks = snap.data().bookmarks || [];
    }
    const bookmarkEntry = {
      mal_id: anime.mal_id,
      title: anime.title || anime.title_english || '',
      title_english: anime.title_english || '',
      title_japanese: anime.title_japanese || '',
      image: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.image || '',
      score: anime.score || 0,
      type: anime.type || '',
      episodes: anime.episodes || 0,
      status: anime.status || '',
      genres: (anime.genres || []).map(g => typeof g === 'string' ? g : g.name),
      category,
      addedAt: Date.now(),
    };
    // Remove duplicate first
    bookmarks = bookmarks.filter(b => b.mal_id !== anime.mal_id);
    bookmarks.push(bookmarkEntry);

    await setDoc(docRef, { bookmarks }, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to add bookmark:', error);
    return false;
  }
}

export async function removeBookmark(userId, animeId) {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let bookmarks = snap.data().bookmarks || [];
      bookmarks = bookmarks.filter(b => b.mal_id !== animeId);
      await setDoc(docRef, { bookmarks }, { merge: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to remove bookmark:', error);
    return false;
  }
}

export async function isBookmarked(userId, animeId) {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const bookmarks = snap.data().bookmarks || [];
      return bookmarks.some(b => b.mal_id === animeId);
    }
    return false;
  } catch {
    return false;
  }
}

export async function getBookmarks(userId, category = null) {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const bookmarks = snap.data().bookmarks || [];
      if (category && category !== 'All') {
        return bookmarks.filter(b => b.category === category);
      }
      return bookmarks;
    }
    return [];
  } catch (error) {
    console.error('Failed to get bookmarks:', error);
    return [];
  }
}

export async function updateBookmarkCategory(userId, animeId, category) {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let bookmarks = snap.data().bookmarks || [];
      bookmarks = bookmarks.map(b => {
        if (b.mal_id === animeId) {
          return { ...b, category };
        }
        return b;
      });
      await setDoc(docRef, { bookmarks }, { merge: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to update bookmark category:', error);
    return false;
  }
}

// Local storage fallback for non-authenticated users
const LOCAL_KEY = 'anivault_bookmarks';

export function getLocalBookmarks() {
  try {
    const data = localStorage.getItem(LOCAL_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addLocalBookmark(anime, category = 'Plan to Watch') {
  const bookmarks = getLocalBookmarks();
  const exists = bookmarks.find(b => b.mal_id === anime.mal_id);
  if (exists) return;
  bookmarks.push({
    mal_id: anime.mal_id,
    title: anime.title || '',
    image: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.image || '',
    score: anime.score || 0,
    type: anime.type || '',
    episodes: anime.episodes || 0,
    status: anime.status || '',
    category,
    addedAt: Date.now(),
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(bookmarks));
}

export function removeLocalBookmark(animeId) {
  const bookmarks = getLocalBookmarks().filter(b => b.mal_id !== animeId);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(bookmarks));
}

export function isLocalBookmarked(animeId) {
  return getLocalBookmarks().some(b => b.mal_id === animeId);
}

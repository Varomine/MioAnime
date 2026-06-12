// Watch History Service
// Tracks "Continue Watching" state per user and episode progress
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LOCAL_KEY = 'anivault_watch_history';

// Get watch history from localStorage or Firestore
export async function getWatchHistory() {
  const user = auth.currentUser;
  if (user) {
    try {
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data().watchHistory || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get watch history from Firestore:', error);
      return [];
    }
  } else {
    try {
      const data = localStorage.getItem(LOCAL_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

// Add or update watch history entry
export async function updateWatchHistory(anime, episode = 1, episodeImage = null) {
  const user = auth.currentUser;
  const entry = {
    mal_id: anime.mal_id,
    title: anime.title || anime.title_english || '',
    title_english: anime.title_english || '',
    image: episodeImage || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.image || '',
    score: anime.score || 0,
    type: anime.type || '',
    episodes: anime.episodes || 0,
    currentEpisode: episode,
    lastWatched: Date.now(),
    progress: {},
  };

  if (user) {
    try {
      const history = await getWatchHistory();
      const existingIndex = history.findIndex(h => h.mal_id === anime.mal_id);
      const existingProgress = existingIndex >= 0 ? (history[existingIndex].progress || {}) : {};
      entry.progress = existingProgress;

      if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
      }
      history.unshift(entry);

      // Keep only the last 20 entries
      const trimmed = history.slice(0, 20);
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { watchHistory: trimmed }, { merge: true });
      return trimmed;
    } catch (error) {
      console.error('Failed to update watch history in Firestore:', error);
      return [];
    }
  } else {
    const history = await getWatchHistory();
    const existingIndex = history.findIndex(h => h.mal_id === anime.mal_id);
    const existingProgress = existingIndex >= 0 ? (history[existingIndex].progress || {}) : {};
    entry.progress = existingProgress;

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    history.unshift(entry);

    const trimmed = history.slice(0, 20);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
    return trimmed;
  }
}

// Save specific episode play progress
export async function saveEpisodeProgress(animeId, episodeNumber, currentTime, duration) {
  const user = auth.currentUser;

  if (user) {
    try {
      const history = await getWatchHistory();
      const existingIndex = history.findIndex(h => h.mal_id === animeId);
      if (existingIndex < 0) return;

      const entry = history[existingIndex];
      if (!entry.progress) {
        entry.progress = {};
      }

      // If watched > 95% of the episode, reset progress to 0 so next time plays from start
      const isFinished = duration > 0 && (currentTime / duration) > 0.95;

      entry.progress[episodeNumber] = {
        currentTime: isFinished ? 0 : currentTime,
        duration,
        lastUpdated: Date.now(),
      };

      entry.currentEpisode = episodeNumber;
      entry.lastWatched = Date.now();

      history.splice(existingIndex, 1);
      history.unshift(entry);

      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { watchHistory: history }, { merge: true });
    } catch (error) {
      console.error('Failed to save episode progress in Firestore:', error);
    }
  } else {
    const history = await getWatchHistory();
    const existingIndex = history.findIndex(h => h.mal_id === animeId);
    if (existingIndex < 0) return;

    const entry = history[existingIndex];
    if (!entry.progress) {
      entry.progress = {};
    }

    const isFinished = duration > 0 && (currentTime / duration) > 0.95;

    entry.progress[episodeNumber] = {
      currentTime: isFinished ? 0 : currentTime,
      duration,
      lastUpdated: Date.now(),
    };

    entry.currentEpisode = episodeNumber;
    entry.lastWatched = Date.now();

    history.splice(existingIndex, 1);
    history.unshift(entry);

    localStorage.setItem(LOCAL_KEY, JSON.stringify(history));
  }
}

// Get play progress time for a specific episode
export async function getEpisodeProgress(animeId, episodeNumber) {
  const history = await getWatchHistory();
  const entry = history.find(h => h.mal_id === animeId);
  if (entry && entry.progress && entry.progress[episodeNumber]) {
    return entry.progress[episodeNumber].currentTime;
  }
  return 0;
}

// Remove from watch history
export async function removeFromWatchHistory(animeId) {
  const user = auth.currentUser;
  const history = (await getWatchHistory()).filter(h => h.mal_id !== animeId);

  if (user) {
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { watchHistory: history }, { merge: true });
    } catch (error) {
      console.error('Failed to remove from watch history in Firestore:', error);
    }
  } else {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(history));
  }
  return history;
}

// Clear all watch history
export async function clearWatchHistory() {
  const user = auth.currentUser;
  if (user) {
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { watchHistory: [] }, { merge: true });
    } catch (error) {
      console.error('Failed to clear watch history in Firestore:', error);
    }
  } else {
    localStorage.removeItem(LOCAL_KEY);
  }
  return [];
}

// Check if anime is in watch history
export async function isInWatchHistory(animeId) {
  const history = await getWatchHistory();
  return history.some(h => h.mal_id === animeId);
}

// Get the last watched episode for a specific anime
export async function getLastWatchedEpisode(animeId) {
  const history = await getWatchHistory();
  const entry = history.find(h => h.mal_id === animeId);
  return entry ? entry.currentEpisode : null;
}

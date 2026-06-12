// Comment Service — Firebase Firestore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Fetches all comments for a specific anime ID.
 */
export async function getComments(animeId, episode) {
  if (!animeId) return [];
  const docId = episode ? `${animeId}_${episode}` : animeId.toString();
  try {
    const docRef = doc(db, 'comments', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      // Return sorted by newest first
      const list = snap.data().comments || [];
      return list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return [];
  } catch (error) {
    console.error('Failed to get comments:', error);
    return [];
  }
}

/**
 * Adds a new comment to the comments document for a specific anime ID.
 */
export async function addComment(animeId, episode, userId, userName, userAvatar, text) {
  if (!animeId || !userId || !text.trim()) return null;
  const docId = episode ? `${animeId}_${episode}` : animeId.toString();
  try {
    const docRef = doc(db, 'comments', docId);
    const snap = await getDoc(docRef);
    let comments = [];
    if (snap.exists()) {
      comments = snap.data().comments || [];
    }

    const newComment = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      userId,
      userName: userName || 'Anonymous',
      userAvatar: userAvatar || '',
      text: text.trim(),
      createdAt: Date.now()
    };

    comments.push(newComment);
    await setDoc(docRef, { comments });
    return newComment;
  } catch (error) {
    console.error('Failed to add comment:', error);
    return null;
  }
}

/**
 * Deletes a comment from the list for a specific anime ID, verifying ownership.
 */
export async function deleteComment(animeId, episode, commentId, userId) {
  if (!animeId || !commentId || !userId) return false;
  const docId = episode ? `${animeId}_${episode}` : animeId.toString();
  try {
    const docRef = doc(db, 'comments', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let comments = snap.data().comments || [];
      const commentIndex = comments.findIndex(c => c.id === commentId);
      if (commentIndex === -1) return false;

      // Verify ownership
      if (comments[commentIndex].userId !== userId) {
        throw new Error('Unauthorized deletion attempt.');
      }

      comments.splice(commentIndex, 1);
      await setDoc(docRef, { comments });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete comment:', error);
    return false;
  }
}

/**
 * Adds a new reply to a specific comment inside the anime's comments document.
 */
export async function addReply(animeId, episode, commentId, userId, userName, userAvatar, text) {
  if (!animeId || !commentId || !userId || !text.trim()) return null;
  const docId = episode ? `${animeId}_${episode}` : animeId.toString();
  try {
    const docRef = doc(db, 'comments', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    let comments = snap.data().comments || [];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return null;

    const parentComment = comments[commentIndex];
    if (!parentComment.replies) {
      parentComment.replies = [];
    }

    const newReply = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      userId,
      userName: userName || 'Anonymous',
      userAvatar: userAvatar || '',
      text: text.trim(),
      createdAt: Date.now()
    };

    parentComment.replies.push(newReply);
    await setDoc(docRef, { comments });

    return {
      reply: newReply,
      parentUserId: parentComment.userId,
      parentUserName: parentComment.userName
    };
  } catch (error) {
    console.error('Failed to add reply:', error);
    return null;
  }
}

/**
 * Deletes a reply from a specific comment, verifying ownership.
 */
export async function deleteReply(animeId, episode, commentId, replyId, userId) {
  if (!animeId || !commentId || !replyId || !userId) return false;
  const docId = episode ? `${animeId}_${episode}` : animeId.toString();
  try {
    const docRef = doc(db, 'comments', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;

    let comments = snap.data().comments || [];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return false;

    const parentComment = comments[commentIndex];
    const replies = parentComment.replies || [];
    const replyIndex = replies.findIndex(r => r.id === replyId);
    if (replyIndex === -1) return false;

    if (replies[replyIndex].userId !== userId) {
      throw new Error('Unauthorized deletion attempt.');
    }

    replies.splice(replyIndex, 1);
    await setDoc(docRef, { comments });
    return true;
  } catch (error) {
    console.error('Failed to delete reply:', error);
    return false;
  }
}

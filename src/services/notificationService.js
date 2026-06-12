// Notification Service — Firebase Firestore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Adds a new notification for a user when someone replies to their comment.
 */
export async function addNotification({
  targetUserId,
  fromUserId,
  fromUserName,
  fromUserAvatar,
  animeId,
  animeTitle,
  episode,
  text
}) {
  if (!targetUserId || !fromUserId || targetUserId === fromUserId) return null;
  
  try {
    const docRef = doc(db, 'notifications', targetUserId);
    const snap = await getDoc(docRef);
    let notifications = [];
    if (snap.exists()) {
      notifications = snap.data().notifications || [];
    }

    const newNotification = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromUserId,
      fromUserName: fromUserName || 'Anonymous',
      fromUserAvatar: fromUserAvatar || '',
      animeId: animeId.toString(),
      animeTitle,
      episode: episode ? episode.toString() : '1',
      text: text.trim().substring(0, 100), // truncate long text preview
      createdAt: Date.now(),
      read: false
    };

    // Keep notifications list bounded (e.g. max 50 recent notifications) to save doc size
    notifications = [newNotification, ...notifications].slice(0, 50);

    await setDoc(docRef, { notifications });
    return newNotification;
  } catch (error) {
    console.error('Failed to add notification:', error);
    return null;
  }
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return false;
  try {
    const docRef = doc(db, 'notifications', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let notifications = snap.data().notifications || [];
      const index = notifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        notifications[index].read = true;
        await setDoc(docRef, { notifications });
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId) {
  if (!userId) return false;
  try {
    const docRef = doc(db, 'notifications', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let notifications = snap.data().notifications || [];
      notifications = notifications.map(n => ({ ...n, read: true }));
      await setDoc(docRef, { notifications });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
}

/**
 * Clears/Deletes all notifications for a user.
 */
export async function clearAllNotifications(userId) {
  if (!userId) return false;
  try {
    const docRef = doc(db, 'notifications', userId);
    await setDoc(docRef, { notifications: [] });
    return true;
  } catch (error) {
    console.error('Failed to clear notifications:', error);
    return false;
  }
}

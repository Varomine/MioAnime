// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCpkmP_QhUaa82Y2YS9qScVZdOF-MS21Jw",
  authDomain: "anivault-83aee.firebaseapp.com",
  projectId: "anivault-83aee",
  storageBucket: "anivault-83aee.firebasestorage.app",
  messagingSenderId: "587763894449",
  appId: "1:587763894449:web:ec4f7381d8e47152097a90",
  measurementId: "G-PG1EV3GH4D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;

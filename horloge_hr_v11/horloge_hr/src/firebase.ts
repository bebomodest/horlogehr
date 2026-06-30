import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

// Firestore Instance (Using the databaseId from config if provided, otherwise default)
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

// Storage Instance 
export const storage = getStorage(app);

export { onAuthStateChanged };
export type { User } from 'firebase/auth';

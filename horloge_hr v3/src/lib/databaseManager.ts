import { initializeApp, getApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
  databaseId?: string;
}

export interface DatabaseEntry {
  id: string;
  name: string;
  config: FirebaseConfig;
  activePages: string[];
}

const STORAGE_KEY = 'hr_app_databases';

export const getDatabases = (): DatabaseEntry[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveDatabases = (databases: DatabaseEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(databases));
};

export const getDatabaseForPage = (pageId: string): DatabaseEntry | null => {
  const databases = getDatabases();
  return databases.find(db => db.activePages.includes(pageId)) || null;
};

const appInstances: Record<string, FirebaseApp> = {};

export const getFirebaseInstance = (pageId: string) => {
  const dbEntry = getDatabaseForPage(pageId);
  
  if (!dbEntry) {
    // Return default instance from firebase.ts
    return null;
  }

  const appName = `app_${dbEntry.id}`;
  
  if (!appInstances[appName]) {
    // Check if app already exists in Firebase getApps()
    const existingApp = getApps().find(app => app.name === appName);
    if (existingApp) {
      appInstances[appName] = existingApp;
    } else {
      appInstances[appName] = initializeApp(dbEntry.config, appName);
    }
  }

  const app = appInstances[appName];
  const auth = getAuth(app);
  const firestoreDatabaseId = dbEntry.config.databaseId || (defaultFirebaseConfig as any).firestoreDatabaseId || '(default)';
  const db = getFirestore(app, firestoreDatabaseId);

  return { auth, db };
};

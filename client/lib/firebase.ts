import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase config will be loaded from GCP Secret Manager
let firebaseConfig: any = null;

// Function to get Firebase config from GCP Secret Manager
async function getFirebaseConfig() {
  if (firebaseConfig) {
    return firebaseConfig;
  }

  try {
    // In production, this would call GCP Secret Manager
    // For local development, we'll use environment variables as fallback
    if (typeof window !== 'undefined') {
      // Client-side: Firebase config should be loaded from the server
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/firebase-config`);
      if (response.ok) {
        firebaseConfig = await response.json();
      } else {
        throw new Error('Failed to fetch Firebase config from server');
      }
    } else {
      // Server-side: This shouldn't happen in this setup, but just in case
      throw new Error('Firebase config should be loaded client-side');
    }
    
    return firebaseConfig;
  } catch (error) {
    console.error('Error loading Firebase config:', error);
    throw new Error('Failed to load Firebase configuration from server');
  }
}

// Initialize Firebase app
let app: any = null;
let auth: any = null;

export async function initializeFirebase() {
  if (!app) {
    const config = await getFirebaseConfig();
    app = initializeApp(config);
    auth = getAuth(app);
  }
  return { app, auth };
}

export { auth };

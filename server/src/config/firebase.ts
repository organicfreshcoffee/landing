import admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let isInitialized = false;
const secretClient = new SecretManagerServiceClient();

async function getSecretValue(secretName: string): Promise<string> {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    
    if (!payload) {
      throw new Error(`Empty secret value for ${secretName}`);
    }
    
    return payload;
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
}

export async function initializeFirebaseAdmin() {
  if (isInitialized) {
    return admin;
  }

  try {
    console.log('Initializing Firebase Admin SDK with GCP Secret Manager...');
    
    // Get Firebase service account from Secret Manager
    const serviceAccountJson = await getSecretValue('firebase-service-account');
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!serviceAccount.project_id) {
      throw new Error('Invalid Firebase service account configuration');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    isInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

export async function getFirebaseConfig() {
  try {
    console.log('Fetching Firebase client config from GCP Secret Manager...');
    
    // Get Firebase client configuration from Secret Manager
    const configJson = await getSecretValue('firebase-client-config');
    const config = JSON.parse(configJson);
    
    return config;
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    throw new Error('Failed to retrieve Firebase client configuration');
  }
}

export { admin };

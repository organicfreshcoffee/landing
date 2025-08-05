/**
 * API Configuration Utility
 * Centralizes API URL configuration for the client
 * 
 * Uses SERVER_URL environment variable mapped to NEXT_PUBLIC_API_URL via next.config.js
 * This allows the client to access the server URL while keeping environment variable naming consistent
 */

// Get the API base URL from environment variables
export const getApiUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!apiUrl) {
    console.warn('NEXT_PUBLIC_API_URL not set, falling back to localhost');
    return 'http://localhost:3001';
  }
  
  return apiUrl;
};

// API endpoint builders
export const apiEndpoints = {
  // Auth endpoints
  login: () => `${getApiUrl()}/api/login`,
  verify: () => `${getApiUrl()}/api/verify`, 
  firebaseConfig: () => `${getApiUrl()}/api/firebase-config`,
  
  // Server endpoints
  servers: () => `${getApiUrl()}/api/servers`,
  
  // Health check
  health: () => `${getApiUrl()}/health`,
};

// Environment detection
export const isProd = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isDev = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

// Log current configuration (for debugging)
export const logApiConfig = (): void => {
  if (isDev()) {
    console.log('API Configuration:', {
      apiUrl: getApiUrl(),
      environment: process.env.NODE_ENV,
      endpoints: {
        login: apiEndpoints.login(),
        servers: apiEndpoints.servers(),
        health: apiEndpoints.health(),
      }
    });
  }
};

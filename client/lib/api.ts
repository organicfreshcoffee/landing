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

// Get the Auth Server URL from environment variables
export const getAuthServerUrl = (): string => {
  const authServerUrl = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
  
  if (!authServerUrl) {
    console.warn('NEXT_PUBLIC_AUTH_SERVER_URL not set, falling back to localhost');
    return 'http://localhost:3002';
  }
  
  return authServerUrl;
};

// API endpoint builders
export const apiEndpoints = {
  // Auth endpoints (now point to auth server)
  verify: () => `${getAuthServerUrl()}/api/verify`, 
  firebaseConfig: () => `${getAuthServerUrl()}/api/firebase-config`,
  
  // Server endpoints (main app server)
  login: () => `${getApiUrl()}/api/login`,
  servers: () => `${getApiUrl()}/api/servers`,
  
  // User data endpoints
  viewUserData: () => `${getApiUrl()}/api/user/view-data`,
  exportUserData: () => `${getApiUrl()}/api/user/export-data`,
  deleteUserData: () => `${getApiUrl()}/api/user/delete-data`,
  
  // Admin endpoints
  checkAdmin: () => `${getApiUrl()}/api/admin/check`,
  adminServers: () => `${getApiUrl()}/api/admin/servers`,
  
  // Health check
  health: () => `${getApiUrl()}/health`,
};

// Environment detection
export const isProd = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isStaging = (): boolean => {
  return (process.env.NODE_ENV as string) === 'staging';
};

export const isDev = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

// Log current configuration (for debugging)
export const logApiConfig = (): void => {
  if (isDev() || isStaging()) {
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

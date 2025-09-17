/**
 * Utility functions for handling server addresses and URLs
 */

/**
 * Ensures a server address has a proper protocol (http or https)
 * @param serverAddress - The server address that may or may not include protocol
 * @param defaultProtocol - Default protocol to use ('http' or 'https')
 * @returns A properly formatted URL with protocol
 */
export function ensureProtocol(serverAddress: string, defaultProtocol: 'http' | 'https' = 'https'): string {
  if (!serverAddress || typeof serverAddress !== 'string') {
    throw new Error('Server address must be a non-empty string');
  }

  // If it already has a protocol, return as-is
  if (serverAddress.startsWith('http://') || serverAddress.startsWith('https://')) {
    return serverAddress;
  }

  // For localhost, use http by default (since local dev servers often use http)
  if (serverAddress.includes('localhost') || serverAddress.includes('127.0.0.1')) {
    return `http://${serverAddress}`;
  }

  // For all other addresses, use the default protocol (usually https)
  return `${defaultProtocol}://${serverAddress}`;
}

/**
 * Validates that a URL is properly formatted
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the host and port from a server address
 * @param serverAddress - The server address (with or without protocol)
 * @returns Object with host and port information
 */
export function parseServerAddress(serverAddress: string): { host: string; port?: number; protocol: string } {
  const urlWithProtocol = ensureProtocol(serverAddress);
  const url = new URL(urlWithProtocol);
  
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port) : undefined,
    protocol: url.protocol.replace(':', '')
  };
}

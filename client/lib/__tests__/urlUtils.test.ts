/**
 * Tests for URL utility functions
 */

import { ensureProtocol, isValidUrl, parseServerAddress } from '../urlUtils';

describe('URL Utilities', () => {
  describe('ensureProtocol', () => {
    test('should add https to regular domain names', () => {
      expect(ensureProtocol('example.com')).toBe('https://example.com');
      expect(ensureProtocol('api.gameserver.com')).toBe('https://api.gameserver.com');
    });

    test('should add http to localhost addresses', () => {
      expect(ensureProtocol('localhost')).toBe('http://localhost');
      expect(ensureProtocol('localhost:3000')).toBe('http://localhost:3000');
      expect(ensureProtocol('127.0.0.1')).toBe('http://127.0.0.1');
      expect(ensureProtocol('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    });

    test('should not modify URLs that already have protocols', () => {
      expect(ensureProtocol('https://example.com')).toBe('https://example.com');
      expect(ensureProtocol('http://localhost:3000')).toBe('http://localhost:3000');
      expect(ensureProtocol('https://api.gameserver.com')).toBe('https://api.gameserver.com');
    });

    test('should use custom default protocol when specified', () => {
      expect(ensureProtocol('example.com', 'http')).toBe('http://example.com');
      expect(ensureProtocol('api.server.com', 'http')).toBe('http://api.server.com');
    });

    test('should throw error for empty server address', () => {
      expect(() => ensureProtocol('')).toThrow('Server address cannot be empty');
    });
  });

  describe('isValidUrl', () => {
    test('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://api.gameserver.com:8080')).toBe(true);
    });

    test('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('localhost')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('parseServerAddress', () => {
    test('should parse server addresses with protocols', () => {
      const result1 = parseServerAddress('https://example.com:8080');
      expect(result1.host).toBe('example.com');
      expect(result1.port).toBe(8080);
      expect(result1.protocol).toBe('https');

      const result2 = parseServerAddress('http://localhost:3000');
      expect(result2.host).toBe('localhost');
      expect(result2.port).toBe(3000);
      expect(result2.protocol).toBe('http');
    });

    test('should parse server addresses without protocols', () => {
      const result1 = parseServerAddress('example.com');
      expect(result1.host).toBe('example.com');
      expect(result1.port).toBeUndefined();
      expect(result1.protocol).toBe('https');

      const result2 = parseServerAddress('localhost:3000');
      expect(result2.host).toBe('localhost');
      expect(result2.port).toBe(3000);
      expect(result2.protocol).toBe('http');
    });
  });

  describe('Protocol handling for axios errors', () => {
    test('should document how URL utilities fix "Unsupported protocol" errors', () => {
      // This test documents how the URL utilities solve the axios protocol error
      const problemCases = [
        'localhost',
        'localhost:3000', 
        'gameserver.example.com',
        '192.168.1.100:8080'
      ];

      const solutions = problemCases.map(addr => ({
        original: addr,
        fixed: ensureProtocol(addr),
        isValid: isValidUrl(ensureProtocol(addr))
      }));

      // All should now be valid URLs
      solutions.forEach(solution => {
        expect(solution.isValid).toBe(true);
        expect(solution.fixed.startsWith('http')).toBe(true);
      });

      // Localhost addresses should use http
      expect(ensureProtocol('localhost')).toMatch(/^http:/);
      expect(ensureProtocol('localhost:3000')).toMatch(/^http:/);
      
      // External addresses should use https
      expect(ensureProtocol('gameserver.example.com')).toMatch(/^https:/);
    });
  });
});

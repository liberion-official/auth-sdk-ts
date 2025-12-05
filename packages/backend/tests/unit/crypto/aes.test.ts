/**
 * AES-256-CBC encryption tests
 */

import { describe, it, expect } from 'vitest';
import { encryptBuffer, decryptBuffer, checkStringDifferent } from '../../../src/crypto/aes.js';

describe('AES-256-CBC Encryption', () => {
  const testKey = 'test-secret-key-32-characters!!!';

  describe('encryptBuffer', () => {
    it('encrypts empty buffer', () => {
      const data = Buffer.from('');
      const encrypted = encryptBuffer(data, testKey);

      expect(encrypted).toBeInstanceOf(Buffer);
      // IV (16 bytes) + at least 16 bytes for AES block padding
      expect(encrypted.length).toBeGreaterThanOrEqual(16);
    });

    it('encrypts non-empty buffer', () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = encryptBuffer(data, testKey);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(16);
    });

    it('encrypts large buffer', () => {
      const data = Buffer.alloc(10000, 'x');
      const encrypted = encryptBuffer(data, testKey);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(10000);
    });

    it('includes IV as first 16 bytes', () => {
      const data = Buffer.from('test data');
      const encrypted = encryptBuffer(data, testKey);

      // IV is random 16 bytes prepended to encrypted data
      expect(encrypted.length).toBeGreaterThan(16);

      // Extract IV
      const iv = encrypted.subarray(0, 16);
      expect(iv.length).toBe(16);
    });

    it('produces different ciphertext with same data (random IV)', () => {
      const data = Buffer.from('same data');

      const encrypted1 = encryptBuffer(data, testKey);
      const encrypted2 = encryptBuffer(data, testKey);

      // Same data should produce different ciphertext due to random IV
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });

    it('works with different keys', () => {
      const data = Buffer.from('test data');
      const key1 = 'key-one-32-characters-long!!!!!';
      const key2 = 'key-two-32-characters-long!!!!!';

      const encrypted1 = encryptBuffer(data, key1);
      const encrypted2 = encryptBuffer(data, key2);

      // Different keys should produce different ciphertext
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });

    it('handles binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
      const encrypted = encryptBuffer(binaryData, testKey);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(16);
    });

    it('handles Unicode text', () => {
      const unicodeData = Buffer.from('Привет мир! 你好世界! 🚀');
      const encrypted = encryptBuffer(unicodeData, testKey);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(16);
    });
  });

  describe('decryptBuffer', () => {
    it('decrypts encrypted data correctly', () => {
      const original = Buffer.from('Hello, World!');
      const encrypted = encryptBuffer(original, testKey);
      const decrypted = decryptBuffer(encrypted, testKey);

      expect(decrypted.toString()).toBe('Hello, World!');
    });

    it('decrypts empty buffer', () => {
      const original = Buffer.from('');
      const encrypted = encryptBuffer(original, testKey);
      const decrypted = decryptBuffer(encrypted, testKey);

      expect(decrypted.toString()).toBe('');
    });

    it('decrypts large buffer', () => {
      const original = Buffer.alloc(10000, 'A');
      const encrypted = encryptBuffer(original, testKey);
      const decrypted = decryptBuffer(encrypted, testKey);

      expect(decrypted.equals(original)).toBe(true);
    });

    it('decrypts binary data correctly', () => {
      const original = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
      const encrypted = encryptBuffer(original, testKey);
      const decrypted = decryptBuffer(encrypted, testKey);

      expect(decrypted.equals(original)).toBe(true);
    });

    it('decrypts Unicode text correctly', () => {
      const original = Buffer.from('Привет мир! 你好世界! 🚀');
      const encrypted = encryptBuffer(original, testKey);
      const decrypted = decryptBuffer(encrypted, testKey);

      expect(decrypted.toString()).toBe('Привет мир! 你好世界! 🚀');
    });

    it('throws on wrong key', () => {
      const original = Buffer.from('secret data');
      const encrypted = encryptBuffer(original, testKey);

      expect(() => {
        decryptBuffer(encrypted, 'wrong-key-32-characters-long!!!');
      }).toThrow();
    });

    it('throws on corrupted data', () => {
      const original = Buffer.from('secret data');
      const encrypted = encryptBuffer(original, testKey);

      // Corrupt the encrypted data (after IV)
      encrypted[20] = encrypted[20] ^ 0xff;

      expect(() => {
        decryptBuffer(encrypted, testKey);
      }).toThrow();
    });

    it('throws on truncated data', () => {
      const original = Buffer.from('secret data');
      const encrypted = encryptBuffer(original, testKey);

      // Truncate to just IV
      const truncated = encrypted.subarray(0, 16);

      expect(() => {
        decryptBuffer(truncated, testKey);
      }).toThrow();
    });

    it('throws on data shorter than IV', () => {
      const shortData = Buffer.from('short');

      expect(() => {
        decryptBuffer(shortData, testKey);
      }).toThrow();
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('preserves data through multiple encrypt/decrypt cycles', () => {
      const original = Buffer.from('test message');

      // First cycle
      const encrypted1 = encryptBuffer(original, testKey);
      const decrypted1 = decryptBuffer(encrypted1, testKey);
      expect(decrypted1.toString()).toBe('test message');

      // Second cycle with decrypted data
      const encrypted2 = encryptBuffer(decrypted1, testKey);
      const decrypted2 = decryptBuffer(encrypted2, testKey);
      expect(decrypted2.toString()).toBe('test message');
    });

    it('works with various key lengths (hashed to 32 bytes)', () => {
      const data = Buffer.from('test data');

      // Short key
      const shortKey = 'short';
      const encrypted1 = encryptBuffer(data, shortKey);
      const decrypted1 = decryptBuffer(encrypted1, shortKey);
      expect(decrypted1.toString()).toBe('test data');

      // Long key
      const longKey = 'this is a very long key that will be hashed to 32 bytes';
      const encrypted2 = encryptBuffer(data, longKey);
      const decrypted2 = decryptBuffer(encrypted2, longKey);
      expect(decrypted2.toString()).toBe('test data');
    });
  });

  describe('checkStringDifferent', () => {
    it('does not throw when strings are different', () => {
      expect(() => {
        checkStringDifferent('hello', 'world', 'Strings should be different');
      }).not.toThrow();
    });

    it('throws when strings are equal', () => {
      expect(() => {
        checkStringDifferent('same', 'same', 'Strings must be different!');
      }).toThrow('Strings must be different!');
    });

    it('throws with custom message', () => {
      const customMessage = 'Custom error: values are identical';

      expect(() => {
        checkStringDifferent('abc', 'abc', customMessage);
      }).toThrow(customMessage);
    });

    it('handles empty strings', () => {
      expect(() => {
        checkStringDifferent('', '', 'Empty strings are equal');
      }).toThrow('Empty strings are equal');

      expect(() => {
        checkStringDifferent('', 'not empty', 'Should not throw');
      }).not.toThrow();
    });

    it('handles whitespace strings', () => {
      expect(() => {
        checkStringDifferent('  ', '  ', 'Whitespace strings are equal');
      }).toThrow('Whitespace strings are equal');

      expect(() => {
        checkStringDifferent(' ', '  ', 'Different whitespace');
      }).not.toThrow();
    });
  });
});

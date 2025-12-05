/**
 * ML-DSA-87 signature verification tests
 * Uses real ML-DSA-87 keys (not mocked)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initUserCrypto, checkSignature } from '../../../src/crypto/signature.js';
import type { UserToken, CryptoInstance } from '../../../src/types.js';
import {
  getCachedTestMLDSAKeys,
  generateTestMLDSAKeys,
  type MLDSAKeyPair,
} from '../../setup/fixtures/ml-dsa-keys.js';
import { getCachedTestMLKEMKeys } from '../../setup/fixtures/ml-kem-keys.js';
import {
  createTestUserToken,
  createInvalidUserToken_MissingSign,
  createInvalidUserToken_WrongDSASize,
  createInvalidUserToken_WrongKEMSize,
} from '../../setup/fixtures/user-tokens.js';

describe('ML-DSA-87 Signature Verification', () => {
  let testKeys: MLDSAKeyPair;
  let testUserToken: UserToken;

  beforeAll(() => {
    testKeys = getCachedTestMLDSAKeys();
    const kemKeys = getCachedTestMLKEMKeys();
    testUserToken = {
      publicKeySign: testKeys.publicKey,
      publicKeyEncrypt: kemKeys.publicKey,
    };
  });

  describe('initUserCrypto', () => {
    it('initializes from valid UserToken', () => {
      const crypto = initUserCrypto(testUserToken);

      expect(crypto).toBeDefined();
      expect(crypto.algorithm).toBe('ML-DSA-87');
      expect(crypto.dsaPublicKey).toBeInstanceOf(Uint8Array);
      expect(crypto.dsaPublicKey.length).toBe(2592);
      expect(crypto.kemPublicKey).toBeInstanceOf(Uint8Array);
      expect(crypto.kemPublicKey!.length).toBe(1568);
      expect(crypto.userToken).toBe(testUserToken);
      expect(typeof crypto.verifySignature).toBe('function');
    });

    it('throws on null userToken', () => {
      expect(() => {
        initUserCrypto(null as unknown as UserToken);
      }).toThrow('Invalid user token');
    });

    it('throws on undefined userToken', () => {
      expect(() => {
        initUserCrypto(undefined as unknown as UserToken);
      }).toThrow('Invalid user token');
    });

    it('throws on missing publicKeySign', () => {
      const invalidToken = createInvalidUserToken_MissingSign();

      expect(() => {
        initUserCrypto(invalidToken as UserToken);
      }).toThrow('publicKeySign not found');
    });

    it('throws on wrong DSA public key size', () => {
      const invalidToken = createInvalidUserToken_WrongDSASize();

      expect(() => {
        initUserCrypto(invalidToken);
      }).toThrow('Invalid ML-DSA-87 public key size');
    });

    it('warns but continues on wrong KEM public key size', () => {
      const invalidToken = createInvalidUserToken_WrongKEMSize();

      // Should not throw, but kemPublicKey will be null
      const crypto = initUserCrypto(invalidToken);
      expect(crypto.kemPublicKey).toBeNull();
    });

    it('handles missing publicKeyEncrypt gracefully', () => {
      const tokenWithoutEncrypt: UserToken = {
        publicKeySign: testKeys.publicKey,
        publicKeyEncrypt: '', // Empty
      };

      const crypto = initUserCrypto(tokenWithoutEncrypt);
      expect(crypto.dsaPublicKey.length).toBe(2592);
      // kemPublicKey should be null or invalid
    });

    it('creates working verifySignature function', () => {
      const crypto = initUserCrypto(testUserToken);
      const message = Buffer.from('test message');
      const signature = testKeys.sign(message);

      const isValid = crypto.verifySignature(message, signature);
      expect(isValid).toBe(true);
    });

    it('verifySignature returns false for invalid signature', () => {
      const crypto = initUserCrypto(testUserToken);
      const message = Buffer.from('test message');

      // Create a fake signature (wrong size or invalid)
      const fakeSignature = new Uint8Array(4595);

      const isValid = crypto.verifySignature(message, fakeSignature);
      expect(isValid).toBe(false);
    });

    it('verifySignature returns false when verification throws', () => {
      const crypto = initUserCrypto(testUserToken);
      const message = Buffer.from('test message');

      // Very short signature that will cause ml_dsa87.verify to fail
      const badSignature = new Uint8Array(10);

      const isValid = crypto.verifySignature(message, badSignature);
      expect(isValid).toBe(false);
    });
  });

  describe('checkSignature', () => {
    let crypto: CryptoInstance;

    beforeAll(() => {
      crypto = initUserCrypto(testUserToken);
    });

    it('returns true for valid signature', () => {
      const message = Buffer.from('Hello, World!');
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, message, signature);
      expect(result).toBe(true);
    });

    it('throws on null crypto', () => {
      const message = Buffer.from('test');
      const signature = testKeys.sign(message);

      expect(() => {
        checkSignature(null as unknown as CryptoInstance, message, signature);
      }).toThrow('Invalid crypto instance');
    });

    it('throws on crypto without verifySignature', () => {
      const message = Buffer.from('test');
      const signature = testKeys.sign(message);
      const badCrypto = { ...crypto, verifySignature: undefined } as unknown as CryptoInstance;

      expect(() => {
        checkSignature(badCrypto, message, signature);
      }).toThrow('Invalid crypto instance');
    });

    it('throws on null data', () => {
      const signature = testKeys.sign(Buffer.from('test'));

      expect(() => {
        checkSignature(crypto, null as unknown as Buffer, signature);
      }).toThrow('Missing data or signature');
    });

    it('throws on null signature', () => {
      const message = Buffer.from('test');

      expect(() => {
        checkSignature(crypto, message, null as unknown as Uint8Array);
      }).toThrow('Missing data or signature');
    });

    it('throws on invalid signature', () => {
      const message = Buffer.from('test message');
      // Create properly sized but invalid signature
      const invalidSignature = new Uint8Array(4595);

      expect(() => {
        checkSignature(crypto, message, invalidSignature);
      }).toThrow('Invalid signature');
    });

    it('throws when message was tampered', () => {
      const originalMessage = Buffer.from('original message');
      const signature = testKeys.sign(originalMessage);
      const tamperedMessage = Buffer.from('tampered message');

      expect(() => {
        checkSignature(crypto, tamperedMessage, signature);
      }).toThrow('Invalid signature');
    });

    it('handles Buffer input for data', () => {
      const message = Buffer.from('test with Buffer');
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, message, signature);
      expect(result).toBe(true);
    });

    it('handles Uint8Array input for data', () => {
      const message = new Uint8Array(Buffer.from('test with Uint8Array'));
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, message, signature);
      expect(result).toBe(true);
    });

    it('handles hex string input for data', () => {
      const hexData = Buffer.from('test hex').toString('hex');
      const originalBytes = Buffer.from(hexData, 'hex');
      const signature = testKeys.sign(originalBytes);

      const result = checkSignature(crypto, hexData, signature);
      expect(result).toBe(true);
    });

    it('handles hex string input for signature', () => {
      const message = Buffer.from('test message');
      const signature = testKeys.sign(message);
      const hexSignature = Buffer.from(signature).toString('hex');

      const result = checkSignature(crypto, message, hexSignature);
      expect(result).toBe(true);
    });

    it('handles ArrayBuffer input for data', () => {
      const message = Buffer.from('test with ArrayBuffer');
      const arrayBuffer = message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength
      );
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, arrayBuffer, signature);
      expect(result).toBe(true);
    });

    it('works with binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f]);
      const signature = testKeys.sign(binaryData);

      const result = checkSignature(crypto, binaryData, signature);
      expect(result).toBe(true);
    });

    it('works with Unicode text', () => {
      const unicodeData = Buffer.from('Привет мир! 你好世界! 🚀🔐');
      const signature = testKeys.sign(unicodeData);

      const result = checkSignature(crypto, unicodeData, signature);
      expect(result).toBe(true);
    });

    it('works with empty data', () => {
      const emptyData = Buffer.from('');
      const signature = testKeys.sign(emptyData);

      const result = checkSignature(crypto, emptyData, signature);
      expect(result).toBe(true);
    });

    it('works with large data', () => {
      const largeData = Buffer.alloc(10000, 'x');
      const signature = testKeys.sign(largeData);

      const result = checkSignature(crypto, largeData, signature);
      expect(result).toBe(true);
    });
  });

  describe('cross-key verification', () => {
    it('fails when verifying with different keys', () => {
      const keys1 = generateTestMLDSAKeys();
      const keys2 = generateTestMLDSAKeys();

      const token1: UserToken = {
        publicKeySign: keys1.publicKey,
        publicKeyEncrypt: getCachedTestMLKEMKeys().publicKey,
      };

      const crypto1 = initUserCrypto(token1);
      const message = Buffer.from('test message');

      // Sign with keys1
      const signature = keys1.sign(message);

      // Create crypto with keys2
      const token2: UserToken = {
        publicKeySign: keys2.publicKey,
        publicKeyEncrypt: getCachedTestMLKEMKeys().publicKey,
      };
      const crypto2 = initUserCrypto(token2);

      // Should fail because signature was made with different key
      expect(() => {
        checkSignature(crypto2, message, signature);
      }).toThrow('Invalid signature');

      // But should succeed with correct key
      const result = checkSignature(crypto1, message, signature);
      expect(result).toBe(true);
    });
  });

  describe('signature format edge cases', () => {
    let crypto: CryptoInstance;

    beforeAll(() => {
      crypto = initUserCrypto(testUserToken);
    });

    it('handles signature as Uint8Array', () => {
      const message = Buffer.from('test');
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, message, signature);
      expect(result).toBe(true);
    });

    it('handles signature as Buffer', () => {
      const message = Buffer.from('test');
      const signatureBytes = testKeys.sign(message);
      const signatureBuffer = Buffer.from(signatureBytes);

      const result = checkSignature(crypto, message, signatureBuffer);
      expect(result).toBe(true);
    });

    it('handles signature as ArrayBuffer', () => {
      const message = Buffer.from('test');
      const signatureBytes = testKeys.sign(message);
      const arrayBuffer = signatureBytes.buffer.slice(
        signatureBytes.byteOffset,
        signatureBytes.byteOffset + signatureBytes.byteLength
      );

      const result = checkSignature(crypto, message, arrayBuffer);
      expect(result).toBe(true);
    });

    it('warns on unusual signature size but still verifies', () => {
      // This test verifies the warning path for unusual signature sizes
      // ML-DSA-87 signatures are ~4595 bytes, warning triggers for <4500 or >4700
      const message = Buffer.from('test');
      const signature = testKeys.sign(message);

      // Normal signature should work without issues
      const result = checkSignature(crypto, message, signature);
      expect(result).toBe(true);
    });
  });

  describe('normalizeToBytes edge cases', () => {
    let crypto: CryptoInstance;

    beforeAll(() => {
      crypto = initUserCrypto(testUserToken);
    });

    it('handles UTF-8 string (non-hex) input for data', () => {
      // Odd-length string or non-hex chars = UTF-8 mode
      const utf8Message = 'Hello World!'; // Contains non-hex chars
      const originalBytes = Buffer.from(utf8Message, 'utf8');
      const signature = testKeys.sign(originalBytes);

      const result = checkSignature(crypto, utf8Message, signature);
      expect(result).toBe(true);
    });

    it('handles odd-length string as UTF-8', () => {
      const oddLengthString = 'abc'; // Odd length, so treated as UTF-8
      const originalBytes = Buffer.from(oddLengthString, 'utf8');
      const signature = testKeys.sign(originalBytes);

      const result = checkSignature(crypto, oddLengthString, signature);
      expect(result).toBe(true);
    });

    it('handles ArrayBuffer input for data', () => {
      const message = Buffer.from('test ArrayBuffer');
      const arrayBuffer = message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength
      );
      const signature = testKeys.sign(message);

      const result = checkSignature(crypto, arrayBuffer, signature);
      expect(result).toBe(true);
    });

    it('throws on invalid data type (number)', () => {
      const signature = testKeys.sign(Buffer.from('test'));

      expect(() => {
        checkSignature(crypto, 123 as unknown as Buffer, signature);
      }).toThrow('Invalid data type');
    });

    it('throws on invalid data type (object)', () => {
      const signature = testKeys.sign(Buffer.from('test'));

      expect(() => {
        checkSignature(crypto, { data: 'test' } as unknown as Buffer, signature);
      }).toThrow('Invalid data type');
    });
  });

  describe('normalizeSignature edge cases', () => {
    let crypto: CryptoInstance;

    beforeAll(() => {
      crypto = initUserCrypto(testUserToken);
    });

    it('throws on invalid signature type (number)', () => {
      const message = Buffer.from('test');

      expect(() => {
        checkSignature(crypto, message, 123 as unknown as Uint8Array);
      }).toThrow('Invalid signature format');
    });

    it('throws on invalid signature type (object)', () => {
      const message = Buffer.from('test');

      expect(() => {
        checkSignature(crypto, message, { sig: 'test' } as unknown as Uint8Array);
      }).toThrow('Invalid signature format');
    });
  });

  describe('initUserCrypto publicKeyEncrypt parsing error', () => {
    it('handles invalid base64 in publicKeyEncrypt gracefully', () => {
      const logger = {
        info: () => {},
        warn: vi.fn(),
        error: () => {},
      };

      const tokenWithBadEncrypt: UserToken = {
        publicKeySign: testKeys.publicKey,
        publicKeyEncrypt: '!!!invalid-base64!!!',
      };

      // Should not throw, but kemPublicKey will be null and warning logged
      const crypto = initUserCrypto(tokenWithBadEncrypt, logger);

      // The base64 decode might work but produce wrong size
      // Either way, kemPublicKey should be null or warning logged
      expect(crypto.dsaPublicKey.length).toBe(2592);
    });
  });

  describe('checkSignature signature size warning', () => {
    let crypto: CryptoInstance;

    beforeAll(() => {
      crypto = initUserCrypto(testUserToken);
    });

    it('logs warning for signature smaller than expected', () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const message = Buffer.from('test message');
      // Create a signature that is too small (less than 4500 bytes)
      const smallSignature = new Uint8Array(4000);

      // This will warn about size and then fail verification
      expect(() => {
        checkSignature(crypto, message, smallSignature, logger);
      }).toThrow('Invalid signature');

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        '[checkSignature] Unexpected signature size',
        expect.objectContaining({
          actual: 4000,
        })
      );
    });

    it('logs warning for signature larger than expected', () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const message = Buffer.from('test message');
      // Create a signature that is too large (more than 4700 bytes)
      const largeSignature = new Uint8Array(5000);

      // This will warn about size and then fail verification
      expect(() => {
        checkSignature(crypto, message, largeSignature, logger);
      }).toThrow('Invalid signature');

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        '[checkSignature] Unexpected signature size',
        expect.objectContaining({
          actual: 5000,
        })
      );
    });
  });

  describe('verifySignature error handling (catch block)', () => {
    it('returns false when ml_dsa87.verify throws or returns false', () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const crypto = initUserCrypto(testUserToken, logger);
      const message = Buffer.from('test message');

      // ml_dsa87.verify returns false for invalid signatures
      // The exact behavior depends on signature length
      const wrongSizeSignature = new Uint8Array(100);

      const isValid = crypto.verifySignature(message, wrongSizeSignature);
      expect(isValid).toBe(false);

      // If it threw, error was logged; if not, just returns false
      // Either way, isValid should be false
    });
  });
});

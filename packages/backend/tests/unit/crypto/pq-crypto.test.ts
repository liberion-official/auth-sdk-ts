/**
 * PQCrypto hybrid encryption tests
 * Uses real ML-KEM-1024 and ML-DSA-87 keys
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { webcrypto } from 'crypto';
import { PQCrypto } from '../../../src/crypto/pq-crypto.js';
import { ConsoleLogger } from '../../../src/adapters/logger.js';
import {
  getCachedTestMLKEMKeys,
  generateTestMLKEMKeys,
} from '../../setup/fixtures/ml-kem-keys.js';
import { getCachedTestMLDSAKeys } from '../../setup/fixtures/ml-dsa-keys.js';

describe('PQCrypto Hybrid Encryption', () => {
  describe('constructor', () => {
    it('creates instance without logger', () => {
      const pq = new PQCrypto();
      expect(pq).toBeInstanceOf(PQCrypto);
    });

    it('creates instance with logger', () => {
      const logger = new ConsoleLogger();
      const pq = new PQCrypto(logger);
      expect(pq).toBeInstanceOf(PQCrypto);
    });
  });

  describe('generateKeysFromSeed', () => {
    it('throws on seed shorter than 96 bytes', async () => {
      const pq = new PQCrypto();
      const shortSeed = new Uint8Array(50);

      await expect(pq.generateKeysFromSeed(shortSeed)).rejects.toThrow(
        'Seed too short'
      );
    });

    it('throws on seed of exactly 95 bytes', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(95);
      webcrypto.getRandomValues(seed);

      await expect(pq.generateKeysFromSeed(seed)).rejects.toThrow(
        'Seed too short'
      );
    });

    it('generates keys from 96-byte seed', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);

      await pq.generateKeysFromSeed(seed);

      expect(pq.hasKeys()).toBe(true);
    });

    it('generates keys from seed longer than 96 bytes', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(128);
      webcrypto.getRandomValues(seed);

      await pq.generateKeysFromSeed(seed);

      expect(pq.hasKeys()).toBe(true);
    });

    it('generates deterministic keys from same seed', async () => {
      const seed = new Uint8Array(96);
      // Use deterministic seed
      for (let i = 0; i < 96; i++) {
        seed[i] = i;
      }

      const pq1 = new PQCrypto();
      const pq2 = new PQCrypto();

      await pq1.generateKeysFromSeed(seed);
      await pq2.generateKeysFromSeed(seed);

      const keys1 = pq1.exportKeys();
      const keys2 = pq2.exportKeys();

      expect(keys1.publicKeyEncrypt.equals(keys2.publicKeyEncrypt)).toBe(true);
      expect(keys1.publicKeySign.equals(keys2.publicKeySign)).toBe(true);
    });

    it('generates different keys from different seeds', async () => {
      const seed1 = new Uint8Array(96);
      const seed2 = new Uint8Array(96);
      webcrypto.getRandomValues(seed1);
      webcrypto.getRandomValues(seed2);

      const pq1 = new PQCrypto();
      const pq2 = new PQCrypto();

      await pq1.generateKeysFromSeed(seed1);
      await pq2.generateKeysFromSeed(seed2);

      const keys1 = pq1.exportKeys();
      const keys2 = pq2.exportKeys();

      expect(keys1.publicKeyEncrypt.equals(keys2.publicKeyEncrypt)).toBe(false);
      expect(keys1.publicKeySign.equals(keys2.publicKeySign)).toBe(false);
    });
  });

  describe('importPeerPublicKeys', () => {
    let pq: PQCrypto;

    beforeEach(() => {
      pq = new PQCrypto();
    });

    it('imports valid peer public keys', () => {
      const kemKeys = getCachedTestMLKEMKeys();
      const dsaKeys = getCachedTestMLDSAKeys();

      const kemPublicKey = Buffer.from(kemKeys.publicKey, 'base64');
      const dsaPublicKey = Buffer.from(dsaKeys.publicKey, 'base64');

      expect(() => {
        pq.importPeerPublicKeys(kemPublicKey, dsaPublicKey);
      }).not.toThrow();
    });

    it('throws on wrong KEM public key size', () => {
      const dsaKeys = getCachedTestMLDSAKeys();
      const dsaPublicKey = Buffer.from(dsaKeys.publicKey, 'base64');

      const wrongSizeKem = new Uint8Array(100); // Should be 1568

      expect(() => {
        pq.importPeerPublicKeys(wrongSizeKem, dsaPublicKey);
      }).toThrow('Invalid ML-KEM-1024 public key size');
    });

    it('throws on wrong DSA public key size', () => {
      const kemKeys = getCachedTestMLKEMKeys();
      const kemPublicKey = Buffer.from(kemKeys.publicKey, 'base64');

      const wrongSizeDsa = new Uint8Array(100); // Should be 2592

      expect(() => {
        pq.importPeerPublicKeys(kemPublicKey, wrongSizeDsa);
      }).toThrow('Invalid ML-DSA-87 public key size');
    });

    it('accepts Uint8Array input', () => {
      const kemKeys = getCachedTestMLKEMKeys();
      const dsaKeys = getCachedTestMLDSAKeys();

      const kemPublicKey = new Uint8Array(Buffer.from(kemKeys.publicKey, 'base64'));
      const dsaPublicKey = new Uint8Array(Buffer.from(dsaKeys.publicKey, 'base64'));

      expect(() => {
        pq.importPeerPublicKeys(kemPublicKey, dsaPublicKey);
      }).not.toThrow();
    });

    it('accepts Buffer input', () => {
      const kemKeys = getCachedTestMLKEMKeys();
      const dsaKeys = getCachedTestMLDSAKeys();

      const kemPublicKey = Buffer.from(kemKeys.publicKey, 'base64');
      const dsaPublicKey = Buffer.from(dsaKeys.publicKey, 'base64');

      expect(() => {
        pq.importPeerPublicKeys(kemPublicKey, dsaPublicKey);
      }).not.toThrow();
    });
  });

  describe('encrypt', () => {
    let pq: PQCrypto;

    beforeAll(async () => {
      pq = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);
      await pq.generateKeysFromSeed(seed);

      const kemKeys = getCachedTestMLKEMKeys();
      const dsaKeys = getCachedTestMLDSAKeys();
      pq.importPeerPublicKeys(
        Buffer.from(kemKeys.publicKey, 'base64'),
        Buffer.from(dsaKeys.publicKey, 'base64')
      );
    });

    it('throws when peer KEM public key not imported', async () => {
      const pqWithoutPeer = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);
      await pqWithoutPeer.generateKeysFromSeed(seed);

      await expect(pqWithoutPeer.encrypt(Buffer.from('test'))).rejects.toThrow(
        'Peer KEM public key not imported'
      );
    });

    it('throws when DSA private key not generated', async () => {
      const pqWithoutKeys = new PQCrypto();

      // Import peer keys without generating own keys
      const kemKeys = getCachedTestMLKEMKeys();
      const dsaKeys = getCachedTestMLDSAKeys();
      pqWithoutKeys.importPeerPublicKeys(
        Buffer.from(kemKeys.publicKey, 'base64'),
        Buffer.from(dsaKeys.publicKey, 'base64')
      );

      await expect(pqWithoutKeys.encrypt(Buffer.from('test'))).rejects.toThrow(
        'DSA private key not generated'
      );
    });

    it('encrypts message successfully', async () => {
      const message = Buffer.from('Hello, Post-Quantum World!');
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(6200); // sig(~4595) + kem(1568) + overhead
    });

    it('encrypts empty message', async () => {
      const message = Buffer.from('');
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(6200);
    });

    it('encrypts large message', async () => {
      const message = Buffer.alloc(10000, 'x');
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(16200); // 6200 + 10000 + tag
    });

    it('handles Uint8Array input', async () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
    });

    it('handles ArrayBuffer input', async () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
    });

    it('produces different ciphertext for same message (random nonce)', async () => {
      const message = Buffer.from('same message');

      const encrypted1 = await pq.encrypt(message);
      const encrypted2 = await pq.encrypt(message);

      expect(encrypted1.equals(encrypted2)).toBe(false);
    });

    it('encrypted format contains version byte', async () => {
      const message = Buffer.from('test');
      const encrypted = await pq.encrypt(message);

      // First byte is version (should be 1)
      expect(encrypted[0]).toBe(1);
    });

    it('encrypted format contains header (KEM ciphertext length)', async () => {
      const message = Buffer.from('test');
      const encrypted = await pq.encrypt(message);

      // Bytes 1-4 are header (big-endian uint32 for KEM ciphertext length)
      const headerView = new DataView(encrypted.buffer, encrypted.byteOffset + 1, 4);
      const kemLength = headerView.getUint32(0, false);

      expect(kemLength).toBe(1568); // ML-KEM-1024 ciphertext size
    });

    it('encrypted format contains signature length', async () => {
      const message = Buffer.from('test');
      const encrypted = await pq.encrypt(message);

      // Bytes 5-8 are signature length (big-endian uint32)
      const sigLenView = new DataView(encrypted.buffer, encrypted.byteOffset + 5, 4);
      const sigLength = sigLenView.getUint32(0, false);

      // ML-DSA-87 signature is ~4627 bytes
      expect(sigLength).toBeGreaterThan(4500);
      expect(sigLength).toBeLessThan(4700);
    });

    it('handles binary data', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
      const encrypted = await pq.encrypt(binaryData);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(6200);
    });

    it('handles Unicode text', async () => {
      const unicodeData = Buffer.from('Привет мир! 你好世界! 🚀');
      const encrypted = await pq.encrypt(unicodeData);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(6200);
    });
  });

  describe('hasKeys', () => {
    it('returns false before key generation', () => {
      const pq = new PQCrypto();
      expect(pq.hasKeys()).toBe(false);
    });

    it('returns true after key generation', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);

      await pq.generateKeysFromSeed(seed);

      expect(pq.hasKeys()).toBe(true);
    });
  });

  describe('exportKeys', () => {
    it('throws when keys not generated', () => {
      const pq = new PQCrypto();

      expect(() => {
        pq.exportKeys();
      }).toThrow('Keys not generated yet');
    });

    it('exports keys after generation', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);

      await pq.generateKeysFromSeed(seed);

      const keys = pq.exportKeys();

      expect(keys.publicKeyEncrypt).toBeInstanceOf(Buffer);
      expect(keys.publicKeySign).toBeInstanceOf(Buffer);
      expect(keys.publicKeyEncrypt.length).toBe(1568); // ML-KEM-1024 public key
      expect(keys.publicKeySign.length).toBe(2592); // ML-DSA-87 public key
    });

    it('returns consistent keys on multiple calls', async () => {
      const pq = new PQCrypto();
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);

      await pq.generateKeysFromSeed(seed);

      const keys1 = pq.exportKeys();
      const keys2 = pq.exportKeys();

      expect(keys1.publicKeyEncrypt.equals(keys2.publicKeyEncrypt)).toBe(true);
      expect(keys1.publicKeySign.equals(keys2.publicKeySign)).toBe(true);
    });
  });

  describe('full encryption flow', () => {
    it('can encrypt message with fresh keys each time', async () => {
      const pq = new PQCrypto();

      // Generate sender keys
      const seed = new Uint8Array(96);
      webcrypto.getRandomValues(seed);
      await pq.generateKeysFromSeed(seed);

      // Generate recipient keys
      const recipientKem = generateTestMLKEMKeys();
      const senderDsa = getCachedTestMLDSAKeys();

      // Import recipient public keys
      pq.importPeerPublicKeys(
        recipientKem.publicKeyRaw,
        Buffer.from(senderDsa.publicKey, 'base64')
      );

      // Encrypt
      const message = Buffer.from('Secret message for recipient');
      const encrypted = await pq.encrypt(message);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(message.length + 6200);
    });
  });
});

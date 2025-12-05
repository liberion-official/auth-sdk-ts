/**
 * ML-KEM-1024 test key fixtures
 * Generates real ML-KEM-1024 keys for encryption testing
 */

import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { webcrypto } from 'crypto';

export interface MLKEMKeyPair {
  publicKey: string; // base64 encoded, 1568 bytes decoded
  secretKey: Uint8Array; // 3168 bytes
  publicKeyRaw: Uint8Array; // raw bytes for direct use
}

export interface EncapsulationResult {
  cipherText: Uint8Array; // 1568 bytes
  sharedSecret: Uint8Array; // 32 bytes
}

/**
 * Generate a real ML-KEM-1024 key pair from random seed
 */
export function generateTestMLKEMKeys(): MLKEMKeyPair {
  const seed = new Uint8Array(64);
  webcrypto.getRandomValues(seed);

  const { publicKey, secretKey } = ml_kem1024.keygen(seed);

  return {
    publicKey: Buffer.from(publicKey).toString('base64'),
    secretKey,
    publicKeyRaw: publicKey,
  };
}

/**
 * Generate ML-KEM-1024 key pair from deterministic seed
 * Useful for reproducible tests
 */
export function generateDeterministicMLKEMKeys(seedString: string): MLKEMKeyPair {
  // Create deterministic 64-byte seed from string
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seedString.padEnd(64, '0').slice(0, 64));
  const seed = new Uint8Array(seedData);

  const { publicKey, secretKey } = ml_kem1024.keygen(seed);

  return {
    publicKey: Buffer.from(publicKey).toString('base64'),
    secretKey,
    publicKeyRaw: publicKey,
  };
}

/**
 * Encapsulate shared secret using ML-KEM-1024 public key
 */
export function encapsulate(publicKeyBase64: string): EncapsulationResult {
  const publicKey = new Uint8Array(Buffer.from(publicKeyBase64, 'base64'));
  const { cipherText, sharedSecret } = ml_kem1024.encapsulate(publicKey);
  return { cipherText, sharedSecret };
}

/**
 * Decapsulate shared secret using ML-KEM-1024 secret key
 */
export function decapsulate(
  cipherText: Uint8Array,
  secretKey: Uint8Array
): Uint8Array {
  return ml_kem1024.decapsulate(cipherText, secretKey);
}

// Pre-generated test keys for faster tests (generated once at module load)
let cachedTestKeys: MLKEMKeyPair | null = null;

/**
 * Get cached test keys (generated once per test run)
 * Use this for tests that don't need unique keys
 */
export function getCachedTestMLKEMKeys(): MLKEMKeyPair {
  if (!cachedTestKeys) {
    cachedTestKeys = generateDeterministicMLKEMKeys('test-seed-for-ml-kem-1024-keys');
  }
  return cachedTestKeys;
}

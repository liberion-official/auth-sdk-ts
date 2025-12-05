/**
 * ML-DSA-87 test key fixtures
 * Generates real ML-DSA-87 keys for signature testing
 */

import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { webcrypto } from 'crypto';

export interface MLDSAKeyPair {
  publicKey: string; // base64 encoded, 2592 bytes decoded
  secretKey: Uint8Array; // 4896 bytes
  sign: (message: Uint8Array | Buffer) => Uint8Array;
}

/**
 * Generate a real ML-DSA-87 key pair from random seed
 */
export function generateTestMLDSAKeys(): MLDSAKeyPair {
  const seed = new Uint8Array(32);
  webcrypto.getRandomValues(seed);

  const { publicKey, secretKey } = ml_dsa87.keygen(seed);

  return {
    publicKey: Buffer.from(publicKey).toString('base64'),
    secretKey,
    sign: (message: Uint8Array | Buffer) => {
      const msgBytes = message instanceof Uint8Array ? message : new Uint8Array(message);
      return ml_dsa87.sign(msgBytes, secretKey);
    },
  };
}

/**
 * Generate ML-DSA-87 key pair from deterministic seed
 * Useful for reproducible tests
 */
export function generateDeterministicMLDSAKeys(seedString: string): MLDSAKeyPair {
  // Create deterministic seed from string
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seedString.padEnd(32, '0').slice(0, 32));
  const seed = new Uint8Array(seedData);

  const { publicKey, secretKey } = ml_dsa87.keygen(seed);

  return {
    publicKey: Buffer.from(publicKey).toString('base64'),
    secretKey,
    sign: (message: Uint8Array | Buffer) => {
      const msgBytes = message instanceof Uint8Array ? message : new Uint8Array(message);
      return ml_dsa87.sign(msgBytes, secretKey);
    },
  };
}

/**
 * Verify ML-DSA-87 signature
 */
export function verifyMLDSASignature(
  message: Uint8Array | Buffer,
  signature: Uint8Array,
  publicKeyBase64: string
): boolean {
  const msgBytes = message instanceof Uint8Array ? message : new Uint8Array(message);
  const publicKey = new Uint8Array(Buffer.from(publicKeyBase64, 'base64'));
  return ml_dsa87.verify(signature, msgBytes, publicKey);
}

// Pre-generated test keys for faster tests (generated once at module load)
let cachedTestKeys: MLDSAKeyPair | null = null;

/**
 * Get cached test keys (generated once per test run)
 * Use this for tests that don't need unique keys
 */
export function getCachedTestMLDSAKeys(): MLDSAKeyPair {
  if (!cachedTestKeys) {
    cachedTestKeys = generateDeterministicMLDSAKeys('test-seed-for-ml-dsa-87');
  }
  return cachedTestKeys;
}

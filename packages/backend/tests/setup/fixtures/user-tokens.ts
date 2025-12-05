/**
 * Test SNFT UserToken fixtures
 */

import type { UserToken } from '../../../src/types.js';
import { getCachedTestMLDSAKeys, generateTestMLDSAKeys, type MLDSAKeyPair } from './ml-dsa-keys.js';
import { getCachedTestMLKEMKeys, generateTestMLKEMKeys, type MLKEMKeyPair } from './ml-kem-keys.js';

export interface TestUserTokenWithKeys {
  token: UserToken;
  dsaKeys: MLDSAKeyPair;
  kemKeys: MLKEMKeyPair;
}

/**
 * Create a valid test UserToken with all required fields
 * Uses cached keys for performance
 */
export function createTestUserToken(): TestUserTokenWithKeys {
  const dsaKeys = getCachedTestMLDSAKeys();
  const kemKeys = getCachedTestMLKEMKeys();

  return {
    token: {
      publicKeySign: dsaKeys.publicKey,
      publicKeyEncrypt: kemKeys.publicKey,
    },
    dsaKeys,
    kemKeys,
  };
}

/**
 * Create a test UserToken with fresh keys
 * Use when tests need unique keys
 */
export function createFreshTestUserToken(): TestUserTokenWithKeys {
  const dsaKeys = generateTestMLDSAKeys();
  const kemKeys = generateTestMLKEMKeys();

  return {
    token: {
      publicKeySign: dsaKeys.publicKey,
      publicKeyEncrypt: kemKeys.publicKey,
    },
    dsaKeys,
    kemKeys,
  };
}

/**
 * Create a test UserToken with assets
 */
export function createTestUserTokenWithAssets(
  assets: Record<string, unknown>
): TestUserTokenWithKeys {
  const base = createTestUserToken();
  return {
    ...base,
    token: {
      ...base.token,
      assets,
    },
  };
}

/**
 * Create an invalid UserToken (missing publicKeySign)
 */
export function createInvalidUserToken_MissingSign(): Partial<UserToken> {
  const kemKeys = getCachedTestMLKEMKeys();
  return {
    publicKeyEncrypt: kemKeys.publicKey,
  };
}

/**
 * Create an invalid UserToken (missing publicKeyEncrypt)
 */
export function createInvalidUserToken_MissingEncrypt(): Partial<UserToken> {
  const dsaKeys = getCachedTestMLDSAKeys();
  return {
    publicKeySign: dsaKeys.publicKey,
  };
}

/**
 * Create an invalid UserToken (wrong key sizes)
 */
export function createInvalidUserToken_WrongKeySizes(): UserToken {
  return {
    publicKeySign: Buffer.from('invalid-key-too-short').toString('base64'),
    publicKeyEncrypt: Buffer.from('invalid-kem-key').toString('base64'),
  };
}

/**
 * Create an invalid UserToken (wrong DSA key size only)
 */
export function createInvalidUserToken_WrongDSASize(): UserToken {
  const kemKeys = getCachedTestMLKEMKeys();
  return {
    publicKeySign: Buffer.from(new Uint8Array(100)).toString('base64'), // Should be 2592
    publicKeyEncrypt: kemKeys.publicKey,
  };
}

/**
 * Create an invalid UserToken (wrong KEM key size only)
 */
export function createInvalidUserToken_WrongKEMSize(): UserToken {
  const dsaKeys = getCachedTestMLDSAKeys();
  return {
    publicKeySign: dsaKeys.publicKey,
    publicKeyEncrypt: Buffer.from(new Uint8Array(100)).toString('base64'), // Should be 1568
  };
}

/**
 * Test wallet address
 */
export const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * Test project ID (valid UUID)
 */
export const TEST_PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

/**
 * Test secret code for AES encryption
 */
export const TEST_SECRET_CODE = 'test-secret-code-32-characters!!';

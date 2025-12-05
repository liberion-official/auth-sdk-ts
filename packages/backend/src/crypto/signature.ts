/**
 * ML-DSA-87 signature verification utilities
 */

import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { NoOpLogger } from '../adapters/logger.js';
import type { CryptoInstance, ILogger, UserToken } from '../types.js';

/**
 * Normalize data to Uint8Array
 */
function normalizeToBytes(
  data: Buffer | Uint8Array | ArrayBuffer | string
): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (typeof data === 'string') {
    // Try hex first (even length, valid hex chars), then UTF-8
    if (data.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(data)) {
      return new Uint8Array(Buffer.from(data, 'hex'));
    }
    return new Uint8Array(Buffer.from(data, 'utf8'));
  }

  throw new Error(`Invalid data type: ${typeof data}`);
}

/**
 * Normalize signature to Uint8Array (expects hex string or binary)
 */
function normalizeSignature(
  signature: Buffer | Uint8Array | ArrayBuffer | string
): Uint8Array {
  if (signature instanceof Uint8Array) {
    return signature;
  }

  if (Buffer.isBuffer(signature)) {
    return new Uint8Array(signature);
  }

  if (signature instanceof ArrayBuffer) {
    return new Uint8Array(signature);
  }

  if (typeof signature === 'string') {
    return new Uint8Array(Buffer.from(signature, 'hex'));
  }

  throw new Error(`Invalid signature format: ${typeof signature}`);
}

/**
 * Initialize user crypto instance from SNFT token
 * Parses ML-DSA-87 and ML-KEM-1024 public keys from base64-encoded token
 *
 * @param userToken - SNFT token with publicKeySign and publicKeyEncrypt (base64)
 * @param logger - Optional logger instance
 * @returns Crypto instance for signature verification
 */
export function initUserCrypto(
  userToken: UserToken,
  logger: ILogger = new NoOpLogger()
): CryptoInstance {
  logger.info('[initUserCrypto] Initializing user crypto with ML-DSA-87');

  if (!userToken || !userToken.publicKeySign) {
    throw new Error('Invalid user token: publicKeySign not found');
  }

  // Parse ML-DSA-87 public key from base64 string (2592 bytes)
  // Data from IPFS is always base64-encoded strings
  const dsaPublicKey = new Uint8Array(
    Buffer.from(userToken.publicKeySign, 'base64')
  );

  // Validate ML-DSA-87 public key size (must be exactly 2592 bytes)
  if (dsaPublicKey.length !== 2592) {
    throw new Error(
      `Invalid ML-DSA-87 public key size: expected 2592 bytes, got ${dsaPublicKey.length}`
    );
  }

  // Parse ML-KEM-1024 public key (optional, for encryption)
  // Data from IPFS is always base64-encoded strings
  let kemPublicKey: Uint8Array | null = null;

  if (userToken.publicKeyEncrypt) {
    try {
      const kemBuffer = Buffer.from(userToken.publicKeyEncrypt, 'base64');

      // Validate ML-KEM-1024 public key size (must be exactly 1568 bytes)
      if (kemBuffer.length !== 1568) {
        logger.warn(
          `[initUserCrypto] Invalid ML-KEM-1024 public key size: expected 1568, got ${kemBuffer.length}`
        );
      } else {
        kemPublicKey = new Uint8Array(kemBuffer);
      }
    } catch (ex) {
      const error = ex as Error;
      logger.warn(
        `[initUserCrypto] Failed to parse publicKeyEncrypt: ${error.message}`
      );
    }
  }

  // Create verify function with closure over public key
  const verifySignature = (
    msg: Buffer | Uint8Array,
    sig: Buffer | Uint8Array
  ): boolean => {
    try {
      const msgBytes = normalizeToBytes(msg);
      const sigBytes = normalizeSignature(sig);

      // ML-DSA-87 verify: (signature, message, publicKey)
      const isValid = ml_dsa87.verify(sigBytes, msgBytes, dsaPublicKey);

      logger.info('[initUserCrypto.verifySignature] Verification result', {
        isValid,
        msgLength: msgBytes.length,
        sigLength: sigBytes.length,
      });

      return isValid;
    } catch (ex) {
      const error = ex as Error;
      logger.error(
        `[initUserCrypto.verifySignature] Error: ${error.message}`
      );
      return false;
    }
  };

  logger.info('[initUserCrypto] Crypto initialized successfully', {
    algorithm: 'ML-DSA-87 + ML-KEM-1024',
    dsaPublicKeySize: dsaPublicKey.length,
    kemPublicKeySize: kemPublicKey?.length ?? 0,
    hasEncryption: !!kemPublicKey,
  });

  return {
    dsaPublicKey,
    kemPublicKey,
    algorithm: 'ML-DSA-87',
    userToken,
    verifySignature,
  };
}

/**
 * Verify ML-DSA-87 signature of data
 *
 * @param crypto - Crypto instance from initUserCrypto
 * @param data - Data that was signed
 * @param signature - ML-DSA-87 signature (~4595 bytes)
 * @param logger - Optional logger instance
 * @returns true if signature is valid
 * @throws Error if verification fails
 */
export function checkSignature(
  crypto: CryptoInstance,
  data: Buffer | Uint8Array | ArrayBuffer | string,
  signature: Buffer | Uint8Array | ArrayBuffer | string,
  logger: ILogger = new NoOpLogger()
): boolean {
  logger.info('[checkSignature] Checking ML-DSA-87 signature');

  if (!crypto || !crypto.verifySignature) {
    throw new Error('Invalid crypto instance: missing verifySignature method');
  }

  if (!data || !signature) {
    throw new Error('Missing data or signature');
  }

  // Normalize inputs
  const msgBytes = normalizeToBytes(data);
  const sigBytes = normalizeSignature(signature);

  logger.info('[checkSignature] Data and signature normalized', {
    dataLength: msgBytes.length,
    signatureLength: sigBytes.length,
    algorithm: crypto.algorithm,
  });

  // Validate ML-DSA-87 signature size (~4595 bytes)
  if (sigBytes.length < 4500 || sigBytes.length > 4700) {
    logger.warn('[checkSignature] Unexpected signature size', {
      expected: '~4595 bytes (ML-DSA-87)',
      actual: sigBytes.length,
    });
  }

  // Verify signature
  const isValid = crypto.verifySignature(msgBytes, sigBytes);

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  logger.info('[checkSignature] ML-DSA-87 signature verified successfully');

  return true;
}

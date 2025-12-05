/**
 * AES-256-CBC encryption utilities
 */

import crypto from 'crypto';

const AES_CIPHER = 'aes-256-cbc';

/**
 * Encrypt buffer using AES-256-CBC
 * @param buffer - Data to encrypt
 * @param key - Encryption key (will be hashed to 32 bytes)
 * @returns Encrypted buffer with IV prepended (16 bytes IV + encrypted data)
 */
export function encryptBuffer(buffer: Buffer, key: string): Buffer {
  const hashedKey = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex')
    .substring(0, 32);

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    AES_CIPHER,
    Buffer.from(hashedKey),
    iv
  );

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt buffer using AES-256-CBC
 * @param data - Encrypted data (16 bytes IV + encrypted data)
 * @param key - Decryption key (will be hashed to 32 bytes)
 * @returns Decrypted buffer
 */
export function decryptBuffer(data: Buffer, key: string): Buffer {
  const hashedKey = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex')
    .substring(0, 32);

  const iv = data.subarray(0, 16);
  const encryptedData = data.subarray(16);

  const decipher = crypto.createDecipheriv(AES_CIPHER, hashedKey, iv);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Validate that two strings are different
 * @param value1 - First value
 * @param value2 - Second value
 * @param message - Error message if values are equal
 * @throws Error if values are equal
 */
export function checkStringDifferent(
  value1: string,
  value2: string,
  message: string
): void {
  if (value1 === value2) {
    throw new Error(message);
  }
}

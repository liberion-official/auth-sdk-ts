/**
 * Test utilities and helpers
 */

import { encode, decode } from '@msgpack/msgpack';
import { encryptBuffer, decryptBuffer } from '../../src/crypto/aes.js';
import { TEST_SECRET_CODE, TEST_PROJECT_ID, TEST_WALLET_ADDRESS } from './fixtures/user-tokens.js';

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Encode data to MessagePack Buffer
 */
export function encodeMessage(data: unknown): Buffer {
  return Buffer.from(encode(data));
}

/**
 * Decode MessagePack Buffer to object
 */
export function decodeMessage<T = unknown>(data: Buffer | Uint8Array): T {
  return decode(data) as T;
}

/**
 * Create encrypted payload for activate command
 * (simulates Trust Gate sending encrypted sessionId)
 */
export function createActivatePayload(
  address: string,
  sessionId: string,
  secretCode: string = TEST_SECRET_CODE
): Buffer {
  const payload = { address, sessionId };
  return encryptBuffer(encodeMessage(payload), secretCode);
}

/**
 * Decrypt payload from server response
 */
export function decryptPayload<T = unknown>(
  encryptedData: Buffer | Uint8Array,
  secretCode: string = TEST_SECRET_CODE
): T {
  const decrypted = decryptBuffer(Buffer.from(encryptedData), secretCode);
  return decodeMessage<T>(decrypted);
}

/**
 * Create encrypted auth payload with clientSessionId
 * (simulates wallet sending encrypted clientSessionId)
 */
export function createAuthPayload(
  clientSessionId: string,
  secretCode: string = TEST_SECRET_CODE
): Buffer {
  const payload = { clientSessionId };
  return encryptBuffer(encodeMessage(payload), secretCode);
}

/**
 * Generate valid UUID v1
 */
export function generateUUID(): string {
  // Simple UUID v4 generation for tests
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Test constants re-exported
 */
export { TEST_SECRET_CODE, TEST_PROJECT_ID, TEST_WALLET_ADDRESS };

/**
 * Protocol constants for tests
 */
export const COMMANDS = {
  AUTH_INIT: 'auth_init',
  ACTIVATE: 'activate',
  READY: 'ready',
  AUTH: 'auth',
  AUTH_RESULT: 'auth_result',
  ACTIVATED: 'activated',
  DECLINED: 'declined',
  TIMEOUT: 'timeout',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  HEALTH: 'health',
  CONNECTION_FAILED: 'connection_failed',
};

/**
 * Create test server options
 */
export function createTestServerOptions(overrides: Record<string, unknown> = {}) {
  return {
    projectId: TEST_PROJECT_ID,
    secretCode: TEST_SECRET_CODE,
    port: 0, // Let OS assign port
    debug: false,
    ...overrides,
  };
}

/**
 * Get server port from LiberionAuth instance
 * Note: This requires access to internal server, may need adjustment
 */
export function getServerPort(_server: unknown): number {
  // This would need to access the internal HTTP server port
  // Implementation depends on LiberionAuth exposing this
  return 31313; // Default fallback
}

/**
 * Fetch mock for testing IPFS interactions
 */

import { vi } from 'vitest';
import type { UserToken } from '../../../src/types.js';

export interface MockFetchOptions {
  ok?: boolean;
  status?: number;
  statusText?: string;
  data?: UserToken | Record<string, unknown>;
  error?: Error;
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(options: MockFetchOptions = {}) {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    data = {},
  } = options;

  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

/**
 * Create a mock fetch function
 */
export function createMockFetch(options: MockFetchOptions = {}) {
  if (options.error) {
    return vi.fn().mockRejectedValue(options.error);
  }

  return vi.fn().mockResolvedValue(createMockFetchResponse(options));
}

/**
 * Create a mock fetch that returns different responses based on URL
 */
export function createUrlBasedMockFetch(
  urlHandlers: Record<string, MockFetchOptions>
) {
  return vi.fn().mockImplementation((url: string) => {
    // Find matching handler
    for (const [pattern, options] of Object.entries(urlHandlers)) {
      if (url.includes(pattern)) {
        if (options.error) {
          return Promise.reject(options.error);
        }
        return Promise.resolve(createMockFetchResponse(options));
      }
    }
    // Default: return 404
    return Promise.resolve(
      createMockFetchResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );
  });
}

/**
 * Setup global fetch mock
 */
export function setupFetchMock(options: MockFetchOptions = {}) {
  const mockFetch = createMockFetch(options);
  global.fetch = mockFetch as unknown as typeof fetch;
  return mockFetch;
}

/**
 * Setup global fetch mock with URL-based handlers
 */
export function setupUrlBasedFetchMock(
  urlHandlers: Record<string, MockFetchOptions>
) {
  const mockFetch = createUrlBasedMockFetch(urlHandlers);
  global.fetch = mockFetch as unknown as typeof fetch;
  return mockFetch;
}

/**
 * Restore original fetch
 */
export function restoreFetch() {
  // @ts-expect-error - restoring global
  delete global.fetch;
}

/**
 * Create UserToken data for fetch mock
 */
export function createMockUserTokenData(
  publicKeySign: string,
  publicKeyEncrypt: string,
  assets?: Record<string, unknown>
): UserToken {
  return {
    publicKeySign,
    publicKeyEncrypt,
    ...(assets && { assets }),
  };
}

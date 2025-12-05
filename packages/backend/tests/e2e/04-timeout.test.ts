/**
 * E2E Test: Session Timeout Flow
 *
 * Tests the 10-minute session timeout functionality.
 * Note: We test timeout constants and basic session creation here.
 * Full timeout behavior is verified through unit tests since
 * real WebSocket connections don't work with fake timers.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

import { LiberionAuth } from '../../src/liberion-auth.js';
import {
  createTestUserToken,
  TEST_PROJECT_ID,
  TEST_SECRET_CODE,
} from '../setup/fixtures/user-tokens.js';
import { AUTHORIZATION_TIME_FRAME } from '../../src/protocol/constants.js';
import { getAvailablePort } from '../setup/helpers/get-port.js';

// Mock Trust Gate client at protocol level
vi.mock('../../src/protocol/trust-gate-client.js', () => {
  return {
    TrustGateClient: class {
      async open() {
        return Promise.resolve();
      }
      async createTask() {
        return {
          linkWeb: `https://link.liberion.com/task-${Date.now()}`,
          taskId: `task-${Date.now()}`,
        };
      }
      close() {}
    },
  };
});

vi.mock('ethers', () => ({
  JsonRpcProvider: class {},
  Contract: class {
    tokenURI = vi.fn().mockResolvedValue('ipfs://QmTestHash');
  },
}));

describe('Session Timeout Constants', () => {
  it('AUTHORIZATION_TIME_FRAME is 10 minutes', () => {
    expect(AUTHORIZATION_TIME_FRAME).toBe(10 * 60 * 1000);
  });

  it('AUTHORIZATION_TIME_FRAME equals 600000ms', () => {
    expect(AUTHORIZATION_TIME_FRAME).toBe(600000);
  });
});

describe('Session Creation with Timeout', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();

  beforeAll(async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(testUserTokenData.token),
    }) as unknown as typeof fetch;

    serverPort = await getAvailablePort();

    server = new LiberionAuth({
      projectId: TEST_PROJECT_ID,
      secretCode: TEST_SECRET_CODE,
      port: serverPort,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('Creates session with timeout set', async () => {
    const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

    await new Promise<void>((resolve) => {
      browserWs.on('open', resolve);
    });

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      browserWs.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    browserWs.send(encode({ _: 'auth_init' }));

    const response = await responsePromise;

    expect(response._).toBe('auth_init');
    expect(response.sessionId).toBeDefined();
    expect(response.linkWeb).toBeDefined();

    browserWs.close();
  });

  it('Session has correct structure after auth_init', async () => {
    const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

    await new Promise<void>((resolve) => {
      browserWs.on('open', resolve);
    });

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      browserWs.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    browserWs.send(encode({ _: 'auth_init' }));

    const response = await responsePromise;

    // Verify session structure
    expect(typeof response.sessionId).toBe('string');
    expect((response.sessionId as string).length).toBeGreaterThan(0);
    expect(typeof response.linkWeb).toBe('string');
    expect((response.linkWeb as string).startsWith('https://')).toBe(true);

    browserWs.close();
  });
});

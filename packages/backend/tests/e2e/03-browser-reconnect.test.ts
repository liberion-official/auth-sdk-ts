/**
 * E2E Test: Browser Reconnect Flow
 *
 * Tests the reconnect functionality for iOS Safari and other scenarios
 * where browser disconnects and reconnects during authorization.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

import { LiberionAuth } from '../../src/liberion-auth.js';
import { encryptBuffer, decryptBuffer } from '../../src/crypto/aes.js';
import {
  createTestUserToken,
  TEST_PROJECT_ID,
  TEST_SECRET_CODE,
  TEST_WALLET_ADDRESS,
} from '../setup/fixtures/user-tokens.js';
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

describe('Browser Reconnect Flow', () => {
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
      onHello: async () => true,
      onSuccess: async (payload) => ({
        token: `jwt-for-${payload.address}`,
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Scenario A: Reconnect after auth completed offline', () => {
    let browserSessionId: string;
    let encryptedClientSessionId: Buffer;

    it('A.1 Browser connects and gets QR code', async () => {
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
      browserSessionId = response.sessionId as string;

      // Browser disconnects (iOS switches to wallet app)
      browserWs.close();
    });

    it('A.2 Trust Gate activates while browser offline', async () => {
      const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        trustGateWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      const activatePayload = {
        address: TEST_WALLET_ADDRESS,
        sessionId: browserSessionId,
      };
      const encryptedPayload = encryptBuffer(
        Buffer.from(encode(activatePayload)),
        TEST_SECRET_CODE
      );

      trustGateWs.send(
        encode({
          _: 'activate',
          data: encryptedPayload,
          _requestId: 1,
        })
      );

      const response = await responsePromise;
      expect(response._).toBe('ready');

      const decryptedResponse = decryptBuffer(
        Buffer.from(response.data as Buffer),
        TEST_SECRET_CODE
      );
      const responseData = decode(decryptedResponse) as { clientSessionId: string };

      encryptedClientSessionId = encryptBuffer(
        Buffer.from(encode({ clientSessionId: responseData.clientSessionId })),
        TEST_SECRET_CODE
      );

      trustGateWs.close();
    });

    it('A.3 Wallet completes auth while browser offline', async () => {
      const walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        walletWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      const signature = testUserTokenData.dsaKeys.sign(encryptedClientSessionId);

      walletWs.send(
        encode({
          _: 'auth',
          address: TEST_WALLET_ADDRESS,
          payload: encryptedClientSessionId,
          signature: Buffer.from(signature),
          fields: { name: 'Test User' },
        })
      );

      const response = await responsePromise;
      expect(response._).toBe('auth');
      expect(response.message).toBe('welcome');

      walletWs.close();
    });

    it('A.4 Browser reconnects and receives stored auth_result', async () => {
      const browserWs2 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs2.on('open', resolve);
      });

      const messages: Record<string, unknown>[] = [];
      browserWs2.on('message', (data: Buffer) => {
        messages.push(decode(data) as Record<string, unknown>);
      });

      browserWs2.send(encode({ _: 'reconnect', sessionId: browserSessionId }));

      // Wait for messages
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should receive auth_result and reconnect response
      const authResult = messages.find((m) => m._ === 'auth_result');
      const reconnectResponse = messages.find((m) => m._ === 'reconnect');

      expect(authResult).toBeDefined();
      expect(authResult?.payload).toBeDefined();
      expect((authResult?.payload as { token: string })?.token).toContain('jwt-for-');

      expect(reconnectResponse).toBeDefined();
      expect(reconnectResponse?.status).toBe('completed');

      browserWs2.close();
    });
  });

  describe('Scenario B: Reconnect with different statuses', () => {
    it('B.1 Reconnect to waiting session (not activated)', async () => {
      // Create a new session
      const browserWs1 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs1.on('open', resolve);
      });

      const initPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs1.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs1.send(encode({ _: 'auth_init' }));
      const initResponse = await initPromise;
      const sessionId = initResponse.sessionId as string;

      // Disconnect
      browserWs1.close();

      // Reconnect
      const browserWs2 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs2.on('open', resolve);
      });

      const reconnectPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs2.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs2.send(encode({ _: 'reconnect', sessionId }));

      const response = await reconnectPromise;

      expect(response._).toBe('reconnect');
      expect(response.status).toBe('waiting');

      browserWs2.close();
    });

    it('B.2 Reconnect to activated session', async () => {
      // Create and activate a session
      const browserWs1 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs1.on('open', resolve);
      });

      const initPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs1.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs1.send(encode({ _: 'auth_init' }));
      const initResponse = await initPromise;
      const sessionId = initResponse.sessionId as string;

      // Activate
      const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs.on('open', resolve);
      });

      const activatePromise = new Promise<void>((resolve) => {
        trustGateWs.once('message', () => {
          resolve();
        });
      });

      const activatePayload = {
        address: TEST_WALLET_ADDRESS,
        sessionId,
      };

      trustGateWs.send(
        encode({
          _: 'activate',
          data: encryptBuffer(Buffer.from(encode(activatePayload)), TEST_SECRET_CODE),
          _requestId: 1,
        })
      );

      await activatePromise;

      // Disconnect
      browserWs1.close();
      trustGateWs.close();

      // Reconnect
      const browserWs2 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs2.on('open', resolve);
      });

      const reconnectPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs2.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs2.send(encode({ _: 'reconnect', sessionId }));

      const response = await reconnectPromise;

      expect(response._).toBe('reconnect');
      expect(response.status).toBe('activated');

      browserWs2.close();
    });

    it('B.3 Reconnect with invalid sessionId', async () => {
      const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(
        encode({
          _: 'reconnect',
          sessionId: 'invalid-session-id-that-does-not-exist',
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toBe('session_not_found');

      browserWs.close();
    });

    it('B.4 Reconnect without sessionId', async () => {
      const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(encode({ _: 'reconnect' }));

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('sessionId required');

      browserWs.close();
    });
  });
});

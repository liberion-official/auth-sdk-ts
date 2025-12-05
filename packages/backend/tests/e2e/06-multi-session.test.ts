/**
 * E2E Test: Multiple Sessions Flow
 *
 * Tests concurrent sessions to verify session isolation.
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
          linkWeb: `https://link.liberion.com/task-${Date.now()}-${Math.random()}`,
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

describe('Multiple Sessions Flow', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();

  // Track callbacks per session
  const successCallbacks: Map<string, { address: string; fields: Record<string, unknown> }> =
    new Map();

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
      onSuccess: async (payload) => {
        successCallbacks.set(payload.address, payload);
        return { token: `jwt-for-${payload.address}` };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Concurrent Browser Sessions', () => {
    interface SessionState {
      browserWs: WebSocket;
      sessionId: string;
      linkWeb: string;
      clientSessionId?: string;
      address: string;
    }

    const sessions: SessionState[] = [];

    it('Creates 3 concurrent browser sessions', async () => {
      for (let i = 0; i < 3; i++) {
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

        sessions.push({
          browserWs,
          sessionId: response.sessionId as string,
          linkWeb: response.linkWeb as string,
          address: `0x${(i + 1).toString().padStart(40, '0')}`,
        });
      }

      expect(sessions.length).toBe(3);
    });

    it('All sessionIds are unique', () => {
      const sessionIds = sessions.map((s) => s.sessionId);
      const uniqueIds = new Set(sessionIds);

      expect(uniqueIds.size).toBe(3);
    });

    it('All linkWebs are unique', () => {
      const linkWebs = sessions.map((s) => s.linkWeb);
      const uniqueLinks = new Set(linkWebs);

      expect(uniqueLinks.size).toBe(3);
    });

    it('Activates sessions in reverse order', async () => {
      for (let i = 2; i >= 0; i--) {
        const session = sessions[i];

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
          address: session.address,
          sessionId: session.sessionId,
        };

        trustGateWs.send(
          encode({
            _: 'activate',
            data: encryptBuffer(Buffer.from(encode(activatePayload)), TEST_SECRET_CODE),
            _requestId: 1,
          })
        );

        const response = await responsePromise;

        expect(response._).toBe('ready');

        const decryptedData = decryptBuffer(
          Buffer.from(response.data as Buffer),
          TEST_SECRET_CODE
        );
        const { clientSessionId } = decode(decryptedData) as { clientSessionId: string };

        session.clientSessionId = clientSessionId;

        trustGateWs.close();
      }
    });

    it('Completes auth for middle session only', async () => {
      const middleSession = sessions[1];

      const walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        walletWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      const encryptedPayload = encryptBuffer(
        Buffer.from(encode({ clientSessionId: middleSession.clientSessionId })),
        TEST_SECRET_CODE
      );

      const signature = testUserTokenData.dsaKeys.sign(encryptedPayload);

      walletWs.send(
        encode({
          _: 'auth',
          address: middleSession.address,
          payload: encryptedPayload,
          signature: Buffer.from(signature),
          fields: { sessionIndex: 1 },
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('auth');
      expect(response.message).toBe('welcome');

      walletWs.close();
    });

    it('Verifies session isolation', async () => {
      // Check that only middle session received auth callback
      expect(successCallbacks.has(sessions[1].address)).toBe(true);
      expect(successCallbacks.get(sessions[1].address)?.fields).toEqual({ sessionIndex: 1 });

      // Other sessions should not have received callbacks
      expect(successCallbacks.has(sessions[0].address)).toBe(false);
      expect(successCallbacks.has(sessions[2].address)).toBe(false);
    });

    it('Other sessions remain active', async () => {
      // Session 0 and 2 should still be able to complete
      for (const i of [0, 2]) {
        const session = sessions[i];

        const walletWs = new WebSocket(`ws://localhost:${serverPort}`);

        await new Promise<void>((resolve) => {
          walletWs.on('open', resolve);
        });

        const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
          walletWs.once('message', (data: Buffer) => {
            resolve(decode(data) as Record<string, unknown>);
          });
        });

        const encryptedPayload = encryptBuffer(
          Buffer.from(encode({ clientSessionId: session.clientSessionId })),
          TEST_SECRET_CODE
        );

        const signature = testUserTokenData.dsaKeys.sign(encryptedPayload);

        walletWs.send(
          encode({
            _: 'auth',
            address: session.address,
            payload: encryptedPayload,
            signature: Buffer.from(signature),
            fields: { sessionIndex: i },
          })
        );

        const response = await responsePromise;

        expect(response._).toBe('auth');
        expect(response.message).toBe('welcome');

        walletWs.close();
      }
    });

    it('All sessions completed with correct data', () => {
      expect(successCallbacks.size).toBe(3);

      expect(successCallbacks.get(sessions[0].address)?.fields).toEqual({ sessionIndex: 0 });
      expect(successCallbacks.get(sessions[1].address)?.fields).toEqual({ sessionIndex: 1 });
      expect(successCallbacks.get(sessions[2].address)?.fields).toEqual({ sessionIndex: 2 });
    });

    afterAll(() => {
      // Cleanup all browser connections
      sessions.forEach((s) => s.browserWs?.close());
    });
  });
});

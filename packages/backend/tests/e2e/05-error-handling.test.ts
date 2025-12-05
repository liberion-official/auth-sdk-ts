/**
 * E2E Test: Error Handling Flow
 *
 * Tests various error scenarios including Trust Gate errors,
 * IPFS errors, and signature verification failures.
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

// Control variable for fetch behavior
let fetchBehavior: 'success' | 'error' | 'invalid_token' = 'success';

vi.mock('ethers', () => ({
  JsonRpcProvider: class {},
  Contract: class {
    tokenURI = vi.fn().mockResolvedValue('ipfs://QmTestHash');
  },
}));

describe('Error Handling Flow', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();

  beforeAll(async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      if (fetchBehavior === 'error') {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });
      }
      if (fetchBehavior === 'invalid_token') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              // Missing publicKeySign
              publicKeyEncrypt: testUserTokenData.token.publicKeyEncrypt,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(testUserTokenData.token),
      });
    }) as unknown as typeof fetch;

    // Reset behaviors
    fetchBehavior = 'success';

    serverPort = await getAvailablePort();

    server = new LiberionAuth({
      projectId: TEST_PROJECT_ID,
      secretCode: TEST_SECRET_CODE,
      port: serverPort,
      onHello: async () => true,
      onSuccess: async (payload) => ({ token: `jwt-for-${payload.address}` }),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Activation Errors', () => {
    it('Returns error when session not found', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Try to activate with non-existent session
      const activatePayload = {
        address: TEST_WALLET_ADDRESS,
        sessionId: 'non-existent-session-id',
      };
      const encryptedPayload = encryptBuffer(
        Buffer.from(encode(activatePayload)),
        TEST_SECRET_CODE
      );

      ws.send(
        encode({
          _: 'activate',
          data: encryptedPayload,
          _requestId: 1,
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Session not found');

      ws.close();
    });

    it('Returns error when session already activated', async () => {
      // First, create and activate a session
      const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs.on('open', resolve);
      });

      const initPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(encode({ _: 'auth_init' }));
      const initResponse = await initPromise;
      const sessionId = initResponse.sessionId as string;

      // First activation
      const trustGateWs1 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs1.on('open', resolve);
      });

      const activatePromise1 = new Promise<void>((resolve) => {
        trustGateWs1.once('message', () => resolve());
      });

      const activatePayload = {
        address: TEST_WALLET_ADDRESS,
        sessionId,
      };

      trustGateWs1.send(
        encode({
          _: 'activate',
          data: encryptBuffer(Buffer.from(encode(activatePayload)), TEST_SECRET_CODE),
          _requestId: 1,
        })
      );

      await activatePromise1;
      trustGateWs1.close();

      // Second activation attempt
      const trustGateWs2 = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs2.on('open', resolve);
      });

      const activatePromise2 = new Promise<Record<string, unknown>>((resolve) => {
        trustGateWs2.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      trustGateWs2.send(
        encode({
          _: 'activate',
          data: encryptBuffer(Buffer.from(encode(activatePayload)), TEST_SECRET_CODE),
          _requestId: 2,
        })
      );

      const response = await activatePromise2;

      expect(response._).toBe('error');
      expect(response.message).toContain('already activated');

      browserWs.close();
      trustGateWs2.close();
    });
  });

  describe('Auth Errors', () => {
    let sessionId: string;
    let encryptedClientSessionId: Buffer;

    beforeAll(async () => {
      // Setup session
      const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs.on('open', resolve);
      });

      const initPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(encode({ _: 'auth_init' }));
      const initResponse = await initPromise;
      sessionId = initResponse.sessionId as string;

      // Activate
      const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs.on('open', resolve);
      });

      const activatePromise = new Promise<Record<string, unknown>>((resolve) => {
        trustGateWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      trustGateWs.send(
        encode({
          _: 'activate',
          data: encryptBuffer(
            Buffer.from(encode({ address: TEST_WALLET_ADDRESS, sessionId })),
            TEST_SECRET_CODE
          ),
          _requestId: 1,
        })
      );

      const activateResponse = await activatePromise;

      const decryptedData = decryptBuffer(
        Buffer.from(activateResponse.data as Buffer),
        TEST_SECRET_CODE
      );
      const { clientSessionId } = decode(decryptedData) as { clientSessionId: string };

      encryptedClientSessionId = encryptBuffer(
        Buffer.from(encode({ clientSessionId })),
        TEST_SECRET_CODE
      );

      browserWs.close();
      trustGateWs.close();
    });

    it('Returns error for missing address', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      ws.send(
        encode({
          _: 'auth',
          // Missing address
          payload: encryptedClientSessionId,
          signature: Buffer.from(new Uint8Array(4595)),
          fields: {},
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Missing required');

      ws.close();
    });

    it('Returns error for missing payload', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      ws.send(
        encode({
          _: 'auth',
          address: TEST_WALLET_ADDRESS,
          // Missing payload
          signature: Buffer.from(new Uint8Array(4595)),
          fields: {},
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Missing required');

      ws.close();
    });

    it('Returns error for invalid signature', async () => {
      // Need a fresh session
      const browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        browserWs.on('open', resolve);
      });

      const initPromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(encode({ _: 'auth_init' }));
      const initResponse = await initPromise;
      const newSessionId = initResponse.sessionId as string;

      // Activate
      const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        trustGateWs.on('open', resolve);
      });

      const activatePromise = new Promise<Record<string, unknown>>((resolve) => {
        trustGateWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      trustGateWs.send(
        encode({
          _: 'activate',
          data: encryptBuffer(
            Buffer.from(encode({ address: TEST_WALLET_ADDRESS, sessionId: newSessionId })),
            TEST_SECRET_CODE
          ),
          _requestId: 1,
        })
      );

      const activateResponse = await activatePromise;

      const decryptedData = decryptBuffer(
        Buffer.from(activateResponse.data as Buffer),
        TEST_SECRET_CODE
      );
      const { clientSessionId: newClientSessionId } = decode(decryptedData) as {
        clientSessionId: string;
      };

      const newEncryptedClientSessionId = encryptBuffer(
        Buffer.from(encode({ clientSessionId: newClientSessionId })),
        TEST_SECRET_CODE
      );

      // Now try auth with invalid signature
      const walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        walletWs.on('open', resolve);
      });

      const authPromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Use invalid signature (wrong size or random bytes)
      const invalidSignature = new Uint8Array(4595);

      walletWs.send(
        encode({
          _: 'auth',
          address: TEST_WALLET_ADDRESS,
          payload: newEncryptedClientSessionId,
          signature: Buffer.from(invalidSignature),
          fields: { name: 'Test' },
        })
      );

      const response = await authPromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Invalid signature');

      browserWs.close();
      trustGateWs.close();
      walletWs.close();
    });
  });

  describe('Constructor Validation', () => {
    it('Throws on invalid projectId', () => {
      expect(() => {
        new LiberionAuth({
          projectId: 'not-a-valid-uuid',
          secretCode: TEST_SECRET_CODE,
          port: 0,
        });
      }).toThrow('Invalid projectId');
    });

    it('Throws on empty projectId', () => {
      expect(() => {
        new LiberionAuth({
          projectId: '',
          secretCode: TEST_SECRET_CODE,
          port: 0,
        });
      }).toThrow('Invalid projectId');
    });
  });
});

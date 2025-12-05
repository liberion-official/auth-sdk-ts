/**
 * E2E Test: Happy Path Authorization Flow
 *
 * Tests the complete successful authorization flow from
 * QR code generation to JWT token delivery.
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

// Mock ethers for blockchain calls
vi.mock('ethers', () => ({
  JsonRpcProvider: class {},
  Contract: class {
    tokenURI = vi.fn().mockResolvedValue('ipfs://QmTestHash');
  },
}));

// Mock Trust Gate client at protocol level instead of ws module
vi.mock('../../src/protocol/trust-gate-client.js', () => {
  return {
    TrustGateClient: class {
      private address: string;
      constructor(opts: { address: string }) {
        this.address = opts.address;
      }
      async open() {
        return Promise.resolve();
      }
      async createTask(params: { projectId: string; clientKey: string }) {
        return {
          linkWeb: `https://link.liberion.com/task-${Date.now()}`,
          taskId: `task-${Date.now()}`,
        };
      }
      close() {}
    },
  };
});

describe('Happy Path Authorization Flow', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();

  // Shared state between tests
  let browserSessionId: string;
  let linkWeb: string;
  let clientSessionId: string;
  let encryptedClientSessionId: Buffer;

  // Callbacks
  let onHelloResult: boolean;
  let onSuccessPayload: { address: string; fields: Record<string, unknown> } | null = null;

  // Setup mock fetch for IPFS
  beforeAll(async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(testUserTokenData.token),
    }) as unknown as typeof fetch;

    // Get an available port
    serverPort = await getAvailablePort();

    server = new LiberionAuth({
      projectId: TEST_PROJECT_ID,
      secretCode: TEST_SECRET_CODE,
      port: serverPort,
      debug: false,
      onHello: async (address) => {
        onHelloResult = address === TEST_WALLET_ADDRESS;
        return onHelloResult;
      },
      onSuccess: async (payload) => {
        onSuccessPayload = payload;
        return { token: `jwt-token-for-${payload.address}` };
      },
    });

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Phase 1: QR Code Generation', () => {
    let browserWs: WebSocket;

    afterAll(() => {
      browserWs?.close();
    });

    it('1.1 Browser connects to server', async () => {
      browserWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve, reject) => {
        browserWs.on('open', resolve);
        browserWs.on('error', reject);
      });

      expect(browserWs.readyState).toBe(WebSocket.OPEN);
    });

    it('1.2 Browser sends auth_init and receives linkWeb', async () => {
      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        browserWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      browserWs.send(encode({ _: 'auth_init' }));

      const response = await responsePromise;

      expect(response._).toBe('auth_init');
      expect(response.linkWeb).toBeDefined();
      expect(typeof response.linkWeb).toBe('string');
      expect((response.linkWeb as string).startsWith('https://link.liberion.com/')).toBe(true);
      expect(response.sessionId).toBeDefined();
      expect(typeof response.sessionId).toBe('string');

      // Save for later tests
      browserSessionId = response.sessionId as string;
      linkWeb = response.linkWeb as string;
    });
  });

  describe('Phase 2: Wallet Activation', () => {
    let trustGateWs: WebSocket;

    afterAll(() => {
      trustGateWs?.close();
    });

    it('2.1 Trust Gate connects and sends activate', async () => {
      trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve, reject) => {
        trustGateWs.on('open', resolve);
        trustGateWs.on('error', reject);
      });

      expect(trustGateWs.readyState).toBe(WebSocket.OPEN);
    });

    it('2.2 Trust Gate sends activate with encrypted data', async () => {
      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        trustGateWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Create encrypted payload (as Trust Gate would)
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
      expect(response.data).toBeDefined();

      // Decrypt response to get clientSessionId
      const decryptedResponse = decryptBuffer(
        Buffer.from(response.data as Buffer),
        TEST_SECRET_CODE
      );
      const responseData = decode(decryptedResponse) as {
        clientSessionId: string;
        isRegistered: boolean;
      };

      expect(responseData.clientSessionId).toBeDefined();
      expect(responseData.isRegistered).toBe(true); // onHello returned true

      // Save for later tests
      clientSessionId = responseData.clientSessionId;
      encryptedClientSessionId = encryptBuffer(
        Buffer.from(encode({ clientSessionId })),
        TEST_SECRET_CODE
      );
    });

    it('2.3 onHello callback was invoked with correct address', () => {
      expect(onHelloResult).toBe(true);
    });
  });

  describe('Phase 3: User Confirmation', () => {
    let walletWs: WebSocket;
    let browserWs2: WebSocket;

    beforeAll(async () => {
      // Reconnect browser (simulate iOS Safari reconnecting)
      browserWs2 = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise<void>((resolve) => {
        browserWs2.on('open', resolve);
      });
    });

    afterAll(() => {
      walletWs?.close();
      browserWs2?.close();
    });

    it('3.1 Wallet connects and sends auth with signature', async () => {
      walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve, reject) => {
        walletWs.on('open', resolve);
        walletWs.on('error', reject);
      });

      expect(walletWs.readyState).toBe(WebSocket.OPEN);
    });

    it('3.2 Wallet sends auth command with ML-DSA-87 signature', async () => {
      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Create signature over payload using test keys
      const signature = testUserTokenData.dsaKeys.sign(encryptedClientSessionId);

      walletWs.send(
        encode({
          _: 'auth',
          address: TEST_WALLET_ADDRESS,
          payload: encryptedClientSessionId,
          signature: Buffer.from(signature),
          fields: {
            name: 'Test User',
            email: 'test@example.com',
          },
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('auth');
      expect(response.message).toBe('welcome');
    });

    it('3.3 onSuccess callback was invoked with correct payload', () => {
      expect(onSuccessPayload).not.toBeNull();
      expect(onSuccessPayload!.address).toBe(TEST_WALLET_ADDRESS);
      expect(onSuccessPayload!.fields).toEqual({
        name: 'Test User',
        email: 'test@example.com',
      });
    });
  });

  describe('Health Check', () => {
    it('responds to health check command', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      ws.send(encode({ _: 'health' }));

      const response = await responsePromise;

      expect(response.status).toBe('ok');

      ws.close();
    });
  });

  describe('Unknown Command', () => {
    it('returns error for unknown command', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      ws.send(encode({ _: 'unknown_command' }));

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Unknown command');

      ws.close();
    });
  });

  describe('Invalid Message Format', () => {
    it('returns error for invalid MessagePack', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        ws.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Send invalid data
      ws.send(Buffer.from('not valid msgpack'));

      const response = await responsePromise;

      expect(response._).toBe('error');
      expect(response.message).toContain('Invalid message format');

      ws.close();
    });
  });
});

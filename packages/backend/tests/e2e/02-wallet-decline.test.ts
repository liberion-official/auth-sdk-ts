/**
 * E2E Test: Wallet Decline Authorization Flow
 *
 * Tests the flow when user declines authorization in wallet app.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

import { LiberionAuth } from '../../src/liberion-auth.js';
import { encryptBuffer } from '../../src/crypto/aes.js';
import type { DeclineInfo } from '../../src/types.js';
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

describe('Wallet Decline Authorization Flow', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();

  // Shared state
  let browserSessionId: string;
  let clientSessionId: string;
  let encryptedClientSessionId: Buffer;

  // Callbacks
  let declineInfo: DeclineInfo | null = null;

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
      onDecline: async (info) => {
        declineInfo = info;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Setup Session', () => {
    let browserWs: WebSocket;
    let trustGateWs: WebSocket;

    afterAll(() => {
      browserWs?.close();
      trustGateWs?.close();
    });

    it('Browser connects and gets QR code', async () => {
      browserWs = new WebSocket(`ws://localhost:${serverPort}`);

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

      expect(browserSessionId).toBeDefined();
    });

    it('Trust Gate activates session', async () => {
      trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);

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

      // Get clientSessionId
      const { decryptBuffer } = await import('../../src/crypto/aes.js');
      const decryptedResponse = decryptBuffer(
        Buffer.from(response.data as Buffer),
        TEST_SECRET_CODE
      );
      const responseData = decode(decryptedResponse) as { clientSessionId: string };

      clientSessionId = responseData.clientSessionId;
      encryptedClientSessionId = encryptBuffer(
        Buffer.from(encode({ clientSessionId })),
        TEST_SECRET_CODE
      );
    });
  });

  describe('Wallet Declines Authorization', () => {
    let walletWs: WebSocket;
    let browserWs2: WebSocket;

    beforeAll(async () => {
      // Reconnect browser
      browserWs2 = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise<void>((resolve) => {
        browserWs2.on('open', resolve);
      });

      // Listen for browser messages
      browserWs2.on('message', () => {});
    });

    afterAll(() => {
      walletWs?.close();
      browserWs2?.close();
    });

    it('Wallet sends declined command', async () => {
      walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        walletWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      walletWs.send(
        encode({
          _: 'declined',
          payload: encryptedClientSessionId,
          address: TEST_WALLET_ADDRESS,
        })
      );

      const response = await responsePromise;

      expect(response._).toBe('declined');
      expect(response.message).toBe('Authorization declined');
    });

    it('onDecline callback was invoked', async () => {
      // Give time for callback to execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(declineInfo).not.toBeNull();
      expect(declineInfo!.reason).toBe('user_declined');
      expect(declineInfo!.declinedBy).toBe('wallet');
      expect(declineInfo!.address).toBe(TEST_WALLET_ADDRESS);
    });
  });

  describe('Decline Without Payload', () => {
    let browserWs: WebSocket;
    let walletWs: WebSocket;
    let newBrowserSessionId: string;

    beforeAll(async () => {
      // Reset decline info
      declineInfo = null;

      // Create new session
      browserWs = new WebSocket(`ws://localhost:${serverPort}`);
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
      newBrowserSessionId = response.sessionId as string;
    });

    afterAll(() => {
      browserWs?.close();
      walletWs?.close();
    });

    it('Handles decline without encrypted payload', async () => {
      walletWs = new WebSocket(`ws://localhost:${serverPort}`);

      await new Promise<void>((resolve) => {
        walletWs.on('open', resolve);
      });

      const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
        walletWs.once('message', (data: Buffer) => {
          resolve(decode(data) as Record<string, unknown>);
        });
      });

      // Send decline without payload (should still work, but won't find browser session)
      walletWs.send(
        encode({
          _: 'declined',
          // No payload
        })
      );

      const response = await responsePromise;

      // Should still respond with declined
      expect(response._).toBe('declined');
    });
  });
});

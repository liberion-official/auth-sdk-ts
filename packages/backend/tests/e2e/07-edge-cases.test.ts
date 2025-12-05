/**
 * E2E Test: Edge Cases and Error Paths
 *
 * Tests edge cases for coverage of error handling paths
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

import { LiberionAuth } from '../../src/liberion-auth.js';
import { encryptBuffer } from '../../src/crypto/aes.js';
import {
  createTestUserToken,
  TEST_PROJECT_ID,
  TEST_SECRET_CODE,
  TEST_WALLET_ADDRESS,
} from '../setup/fixtures/user-tokens.js';
import { getAvailablePort } from '../setup/helpers/get-port.js';

// Mock Trust Gate client
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

describe('Edge Cases - onDecline callback error', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();
  let declineError: Error | null = null;

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
      onDecline: async () => {
        // This callback throws an error to test error handling path
        declineError = new Error('onDecline callback error');
        throw declineError;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('handles onDecline callback error gracefully', async () => {
    // Create browser session
    const browserWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise<void>((resolve) => {
      browserWs.on('open', resolve);
    });

    const browserResponsePromise = new Promise<Record<string, unknown>>((resolve) => {
      browserWs.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    browserWs.send(encode({ _: 'auth_init' }));
    const browserResponse = await browserResponsePromise;
    const browserSessionId = browserResponse.sessionId as string;

    // Activate session with Trust Gate
    const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise<void>((resolve) => {
      trustGateWs.on('open', resolve);
    });

    const activateResponsePromise = new Promise<Record<string, unknown>>((resolve) => {
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

    const activateResponse = await activateResponsePromise;
    expect(activateResponse._).toBe('ready');

    // Get clientSessionId
    const { decryptBuffer } = await import('../../src/crypto/aes.js');
    const decryptedResponse = decryptBuffer(
      Buffer.from(activateResponse.data as Buffer),
      TEST_SECRET_CODE
    );
    const responseData = decode(decryptedResponse) as { clientSessionId: string };
    const clientSessionId = responseData.clientSessionId;

    // Send decline from wallet
    const walletWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise<void>((resolve) => {
      walletWs.on('open', resolve);
    });

    const declineResponsePromise = new Promise<Record<string, unknown>>((resolve) => {
      walletWs.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    const encryptedClientSessionId = encryptBuffer(
      Buffer.from(encode({ clientSessionId })),
      TEST_SECRET_CODE
    );

    walletWs.send(
      encode({
        _: 'declined',
        payload: encryptedClientSessionId,
        address: TEST_WALLET_ADDRESS,
      })
    );

    const declineResponse = await declineResponsePromise;
    expect(declineResponse._).toBe('declined');

    // Wait for error to be logged
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(declineError).not.toBeNull();

    // Cleanup
    browserWs.close();
    trustGateWs.close();
    walletWs.close();
  });
});

describe('Edge Cases - Session timeout finalization', () => {
  let server: LiberionAuth;
  let serverPort: number;
  const testUserTokenData = createTestUserToken();
  let declineInfo: { reason: string } | null = null;
  let onDeclineErrorThrown = false;

  beforeAll(async () => {
    // Use fake timers excluding queueMicrotask to avoid unhandled rejection issues
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });

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
        // Throw error to test error handling in responseFailed (line 701)
        onDeclineErrorThrown = true;
        throw new Error('onDecline error in responseFailed');
      },
    });

    await vi.advanceTimersByTimeAsync(100);
  });

  afterAll(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('triggers timeout finalization when session times out', async () => {
    // Create browser session
    const browserWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise<void>((resolve) => {
      browserWs.on('open', resolve);
    });

    const browserResponsePromise = new Promise<Record<string, unknown>>((resolve) => {
      browserWs.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    browserWs.send(encode({ _: 'auth_init' }));

    await vi.advanceTimersByTimeAsync(0);

    const browserResponse = await browserResponsePromise;
    const browserSessionId = browserResponse.sessionId as string;
    expect(browserSessionId).toBeDefined();

    // Activate session
    const trustGateWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise<void>((resolve) => {
      trustGateWs.on('open', resolve);
    });

    const activateResponsePromise = new Promise<Record<string, unknown>>((resolve) => {
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

    await vi.advanceTimersByTimeAsync(0);
    await activateResponsePromise;

    // Advance time past AUTHORIZATION_TIME_FRAME (10 minutes = 600000ms)
    await vi.advanceTimersByTimeAsync(600001);

    // Check that timeout was triggered
    expect(declineInfo).not.toBeNull();
    expect(declineInfo!.reason).toBe('timeout');

    // The onDecline callback threw an error, which tests line 701
    expect(onDeclineErrorThrown).toBe(true);

    // Cleanup
    browserWs.close();
    trustGateWs.close();
  });
})

describe('Edge Cases - Invalid message handling', () => {
  let server: LiberionAuth;
  let serverPort: number;

  beforeAll(async () => {
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

  it('handles invalid msgpack data gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${serverPort}`);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    const errorPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    // Send invalid data (not msgpack)
    ws.send(Buffer.from([0xff, 0xfe, 0x00, 0x01]));

    const response = await errorPromise;
    expect(response._).toBe('error');

    ws.close();
  });

  it('handles message with unknown command', async () => {
    const ws = new WebSocket(`ws://localhost:${serverPort}`);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.once('message', (data: Buffer) => {
        resolve(decode(data) as Record<string, unknown>);
      });
    });

    // Send valid msgpack but unknown command
    ws.send(encode({ _: 'unknown_command' }));

    const response = await responsePromise;
    expect(response._).toBe('error');
    expect(response.message).toContain('Unknown command');

    ws.close();
  });
});

describe('Edge Cases - Health check', () => {
  let server: LiberionAuth;
  let serverPort: number;

  beforeAll(async () => {
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

  it('responds to health check', async () => {
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
    // Health check returns { status: 'ok' } without command type
    expect(response.status).toBe('ok');

    ws.close();
  });
});

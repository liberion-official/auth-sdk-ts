/**
 * WebSocket mocks for testing
 * Mocks both WebSocket client (for Trust Gate) and WebSocketServer
 */

import { EventEmitter } from 'events';
import { encode, decode } from '@msgpack/msgpack';
import { vi } from 'vitest';

/**
 * Mock WebSocket client for Trust Gate connections
 */
export class MockTrustGateWebSocket extends EventEmitter {
  public url: string;
  public readyState: number = 0; // CONNECTING
  public sentMessages: unknown[] = [];

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) {
    super();
    this.url = url;
    // Simulate async connection
    setImmediate(() => {
      this.readyState = MockTrustGateWebSocket.OPEN;
      this.emit('open');
    });
  }

  send(data: Buffer | Uint8Array): void {
    if (this.readyState !== MockTrustGateWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const message = decode(data) as Record<string, unknown>;
    this.sentMessages.push(message);

    // Auto-respond to task_init
    if (message._ === 'task_init') {
      const response = encode({
        _requestId: message._requestId,
        status: 'ok',
        linkWeb: `https://link.liberion.com/test-task-${Date.now()}`,
        taskId: `test-task-${Date.now()}`,
      });
      setImmediate(() => this.emit('message', Buffer.from(response)));
    }
  }

  close(): void {
    this.readyState = MockTrustGateWebSocket.CLOSED;
    this.emit('close', 1000);
  }

  terminate(): void {
    this.readyState = MockTrustGateWebSocket.CLOSED;
  }

  ping(): void {
    // No-op for mock
  }

  /**
   * Simulate receiving a message from Trust Gate
   */
  simulateMessage(data: Record<string, unknown>): void {
    this.emit('message', Buffer.from(encode(data)));
  }

  /**
   * Simulate connection error
   */
  simulateError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * Simulate connection close
   */
  simulateClose(code: number = 1000): void {
    this.readyState = MockTrustGateWebSocket.CLOSED;
    this.emit('close', code);
  }
}

/**
 * Mock WebSocket that times out (never connects)
 */
export class MockTimeoutWebSocket extends EventEmitter {
  public url: string;
  public readyState: number = 0;

  static readonly OPEN = 1;

  constructor(url: string) {
    super();
    this.url = url;
    // Never emit 'open' - simulates timeout
  }

  send(): void {
    throw new Error('WebSocket is not open');
  }

  close(): void {
    this.readyState = 3;
  }

  terminate(): void {
    this.readyState = 3;
  }
}

/**
 * Mock WebSocket that fails to connect
 */
export class MockFailingWebSocket extends EventEmitter {
  public url: string;
  public readyState: number = 0;

  static readonly OPEN = 1;

  constructor(url: string) {
    super();
    this.url = url;
    setImmediate(() => {
      const error = new Error('ECONNREFUSED') as Error & { code?: string };
      error.code = 'ECONNREFUSED';
      this.emit('error', error);
    });
  }

  send(): void {
    throw new Error('WebSocket is not open');
  }

  close(): void {
    this.readyState = 3;
  }

  terminate(): void {
    this.readyState = 3;
  }
}

/**
 * Mock WebSocket client for testing LiberionAuth server
 */
export class MockClientWebSocket extends EventEmitter {
  public readyState: number = 1;
  public sentMessages: unknown[] = [];
  public clientId?: string;
  public isAlive: boolean = true;

  send(data: Buffer | Uint8Array): void {
    this.sentMessages.push(decode(data));
  }

  close(): void {
    this.readyState = 3;
    this.emit('close', 1000);
  }

  terminate(): void {
    this.readyState = 3;
  }

  ping(): void {
    // Simulate pong response
    setImmediate(() => this.emit('pong'));
  }

  /**
   * Simulate receiving message from server
   */
  simulateMessage(data: Record<string, unknown>): void {
    this.emit('message', Buffer.from(encode(data)));
  }

  /**
   * Get last sent message
   */
  getLastSentMessage(): unknown {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Clear sent messages
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

/**
 * Mock WebSocketServer for testing LiberionAuth
 */
export class MockWebSocketServer extends EventEmitter {
  public clients: Set<MockClientWebSocket> = new Set();

  constructor(_options?: unknown) {
    super();
  }

  /**
   * Simulate a new client connection
   */
  simulateConnection(): MockClientWebSocket {
    const client = new MockClientWebSocket();
    this.clients.add(client);
    this.emit('connection', client);
    return client;
  }

  close(): void {
    this.emit('close');
  }
}

/**
 * Create ws module mock
 */
export function createWSMock(WebSocketClass: typeof MockTrustGateWebSocket = MockTrustGateWebSocket) {
  return {
    default: WebSocketClass,
    WebSocket: WebSocketClass,
    WebSocketServer: MockWebSocketServer,
  };
}

/**
 * Setup ws mock with vitest
 */
export function setupWSMock(WebSocketClass: typeof MockTrustGateWebSocket = MockTrustGateWebSocket) {
  vi.mock('ws', () => createWSMock(WebSocketClass));
}

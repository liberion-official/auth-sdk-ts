/**
 * WebSocket test client for E2E testing
 * Simulates Browser and Wallet connections to LiberionAuth server
 */

import WebSocket from 'ws';
import { encode, decode } from '@msgpack/msgpack';

export interface WSMessage {
  _: string;
  [key: string]: unknown;
}

/**
 * WebSocket test client for E2E tests
 */
export class TestWSClient {
  private ws: WebSocket | null = null;
  private receivedMessages: WSMessage[] = [];
  private messageResolvers: Array<(msg: WSMessage) => void> = [];
  private isConnected: boolean = false;

  /**
   * Connect to WebSocket server
   */
  async connect(port: number, host: string = 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws = new WebSocket(`ws://${host}:${port}`);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = decode(data) as WSMessage;
          this.receivedMessages.push(msg);

          // Resolve waiting promises
          const resolver = this.messageResolvers.shift();
          if (resolver) {
            resolver(msg);
          }
        } catch {
          console.error('Failed to decode message');
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
      });
    });
  }

  /**
   * Send a command to the server
   */
  send(command: string, data: Record<string, unknown> = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(encode({ _: command, ...data }));
  }

  /**
   * Send raw encoded data
   */
  sendRaw(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(encode(data));
  }

  /**
   * Wait for a message from the server
   */
  async waitForMessage(timeout: number = 5000): Promise<WSMessage> {
    // Check if message already received
    const existing = this.receivedMessages.shift();
    if (existing) {
      return existing;
    }

    // Wait for new message
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.messageResolvers.indexOf(resolve);
        if (index > -1) {
          this.messageResolvers.splice(index, 1);
        }
        reject(new Error('Timeout waiting for message'));
      }, timeout);

      this.messageResolvers.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  /**
   * Wait for a specific command
   */
  async waitForCommand(command: string, timeout: number = 5000): Promise<WSMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check already received messages
      const index = this.receivedMessages.findIndex((m) => m._ === command);
      if (index > -1) {
        return this.receivedMessages.splice(index, 1)[0];
      }

      // Wait for next message
      try {
        const msg = await this.waitForMessage(timeout - (Date.now() - startTime));
        if (msg._ === command) {
          return msg;
        }
        // Put back non-matching message
        this.receivedMessages.push(msg);
      } catch {
        break;
      }
    }

    throw new Error(`Timeout waiting for command: ${command}`);
  }

  /**
   * Get all received messages
   */
  getAllMessages(): WSMessage[] {
    return [...this.receivedMessages];
  }

  /**
   * Clear received messages
   */
  clearMessages(): void {
    this.receivedMessages = [];
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Force terminate connection (abnormal close)
   */
  terminate(): void {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

/**
 * Create a connected test client
 */
export async function createConnectedClient(port: number): Promise<TestWSClient> {
  const client = new TestWSClient();
  await client.connect(port);
  return client;
}

/**
 * WebSocket client for connecting to Trust Gate Server
 * Used to create authorization tasks
 */

import WebSocket from 'ws';
import { encode, decode } from '@msgpack/msgpack';
import type { ILogger } from '../types.js';
import { NoOpLogger } from '../adapters/logger.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

interface TaskResult {
  linkWeb: string;
  taskId: string;
}

export class TrustGateClient {
  private address: string;
  private timeout: number;
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<number, PendingRequest>();
  private requestId = 0;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private logger: ILogger;

  constructor(options: {
    address: string;
    timeout?: number;
    logger?: ILogger;
  }) {
    this.address = options.address;
    this.timeout = options.timeout ?? 10000;
    this.logger = options.logger ?? new NoOpLogger();
  }

  /**
   * Opens WebSocket connection
   */
  async open(): Promise<void> {
    this.logger.info(`[TrustGateClient] Attempting to connect to ${this.address}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.address);

        this.ws.on('open', () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
          }
          this.logger.info(`[TrustGateClient] Connected to ${this.address}`);
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = decode(data) as Record<string, unknown>;
            this.handleMessage(message);
          } catch (ex) {
            const error = ex as Error;
            this.logger.error(
              `[TrustGateClient] Failed to decode message: ${error.message}`
            );
          }
        });

        this.ws.on('close', (code: number) => {
          this.logger.info(
            `[TrustGateClient] Connection closed with code ${code}`
          );
          // Reject all pending requests
          this.pendingRequests.forEach((request, id) => {
            request.reject(new Error(`Connection closed with code ${code}`));
            this.pendingRequests.delete(id);
          });
        });

        this.ws.on('error', (error: Error & { code?: string }) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
          }

          this.logger.error('[TrustGateClient] Connection error', {
            message: error.message,
            code: error.code,
            address: this.address,
          });

          const enhancedError = new Error(
            `Failed to connect to Trust Gate Server at ${this.address}: ${error.message}`
          );
          (enhancedError as Error & { code?: string }).code = error.code;
          reject(enhancedError);
        });

        // Connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.terminate();
            this.logger.error('[TrustGateClient] Connection timeout', {
              address: this.address,
              timeout: this.timeout,
            });
            reject(
              new Error(
                `Connection timeout: Trust Gate Server at ${this.address} did not respond within ${this.timeout}ms`
              )
            );
          }
        }, this.timeout);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  /**
   * Sends message and waits for response
   */
  send(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not open'));
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const message = encode({ ...data, _requestId: requestId });
      this.ws!.send(message);
    });
  }

  /**
   * Handles incoming message
   */
  private handleMessage(message: Record<string, unknown>): void {
    const requestId = message._requestId as number;
    if (!requestId) {
      this.logger.warn(
        '[TrustGateClient] Received message without requestId',
        message
      );
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      this.logger.warn(
        `[TrustGateClient] No pending request for id ${requestId}`
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (message._ === 'error') {
      pending.reject(
        new Error((message.message as string) || 'Unknown error')
      );
    } else {
      pending.resolve(message);
    }
  }

  /**
   * Closes WebSocket connection
   */
  close(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Creates authorization task via Trust Gate Server
   */
  async createTask(params: {
    projectId: string;
    scenarioId?: string | null;
    clientKey: string;
  }): Promise<TaskResult> {
    const response = await this.send({
      _: 'task_init',
      projectId: params.projectId,
      scenarioId: params.scenarioId,
      clientKey: params.clientKey,
    });

    if (response.status !== 'ok') {
      throw new Error((response.message as string) || 'Task creation failed');
    }

    return {
      linkWeb: response.linkWeb as string,
      taskId: response.taskId as string,
    };
  }
}

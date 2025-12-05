/**
 * Logger adapters for dependency injection
 */

import type { ILogger } from '../types.js';

/**
 * No-operation logger - default when no logger provided
 * Silently ignores all log calls
 */
export class NoOpLogger implements ILogger {
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Console logger for development/debugging
 * Outputs to stdout/stderr with timestamps
 */
export class ConsoleLogger implements ILogger {
  private readonly prefix: string;

  constructor(prefix = '[LiberionAuth]') {
    this.prefix = prefix;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${timestamp} ${this.prefix} INFO: ${message}`, meta);
    } else {
      console.log(`${timestamp} ${this.prefix} INFO: ${message}`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta && Object.keys(meta).length > 0) {
      console.warn(`${timestamp} ${this.prefix} WARN: ${message}`, meta);
    } else {
      console.warn(`${timestamp} ${this.prefix} WARN: ${message}`);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta && Object.keys(meta).length > 0) {
      console.error(`${timestamp} ${this.prefix} ERROR: ${message}`, meta);
    } else {
      console.error(`${timestamp} ${this.prefix} ERROR: ${message}`);
    }
  }
}

/**
 * Create a logger adapter from Winston logger instance
 * @param winston - Winston logger instance
 * @returns ILogger compatible adapter
 *
 * @example
 * ```typescript
 * import { createWinstonAdapter } from '@trust-proto/auth-node';
 * import { logger } from './my-winston-logger';
 *
 * const auth = new LiberionAuth({
 *   logger: createWinstonAdapter(logger),
 *   // ...
 * });
 * ```
 */
export function createWinstonAdapter(winston: {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}): ILogger {
  return {
    info: (msg, meta) => winston.info(msg, meta),
    warn: (msg, meta) => winston.warn(msg, meta),
    error: (msg, meta) => winston.error(msg, meta),
  };
}

/**
 * Shorten blockchain address for logging (privacy protection)
 * @param address - Full blockchain address
 * @returns Shortened address like "0x1234...abcd"
 */
export function shortenAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return address ?? '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

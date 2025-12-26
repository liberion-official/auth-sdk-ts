/**
 * Liberion Auth Backend SDK Types
 */

import type { SecureContextOptions } from 'tls';
import type { Environment } from './blockchain/constants.js';

// Re-export Environment for convenience
export type { Environment };

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * User SNFT token structure from IPFS
 */
export interface UserToken {
  /** ML-DSA-87 public key (base64 encoded, 2592 bytes decoded) */
  publicKeySign: string;
  /** ML-KEM-1024 public key (base64 encoded, 1568 bytes decoded) */
  publicKeyEncrypt: string;
  /** Optional KYC assets */
  assets?: Record<string, unknown>;
  /** Additional token properties */
  [key: string]: unknown;
}

/**
 * SSL/TLS credentials for HTTPS server
 * Accepts all options from Node.js tls.SecureContextOptions
 * @see https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
 */
export type SSLCredentials = SecureContextOptions;

/**
 * Decline reason categories
 */
export type DeclineReason = 'user_declined' | 'timeout' | 'error' | 'unknown';

/**
 * Information about declined authorization
 */
export interface DeclineInfo {
  /** User wallet address (null if declined before activation) */
  address: string | null;
  /** Standardized decline reason */
  reason: DeclineReason;
  /** Detailed message */
  message: string;
  /** Who initiated the decline */
  declinedBy: 'wallet' | 'browser';
  /** Session identifier */
  sessionId: string;
}

/**
 * Payload received on successful authorization
 */
export interface AuthPayload {
  /** User wallet address */
  address: string;
  /** KYC fields provided by user */
  fields: Record<string, unknown>;
}

/**
 * Result returned from onSuccess callback
 */
export interface AuthResult {
  /** JWT token for authenticated user */
  token?: string;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Main configuration for LiberionAuth
 */
export interface LiberionAuthConfig {
  // Required
  /** Project UUID from Liberion dashboard */
  projectId: string;
  /** Secret code for AES-256-CBC encryption */
  secretCode: string;

  // Optional with defaults
  /** WebSocket server port (default: 31313) */
  port?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** SSL credentials for HTTPS (default: undefined, use HTTP) */
  ssl?: SSLCredentials;
  /** Environment: 'production' or 'development' (default: 'production') */
  environment?: Environment;

  // Dependency Injection
  /** Logger instance (default: NoOpLogger) */
  logger?: ILogger;

  // Callbacks
  /**
   * Called when wallet activates (scans QR)
   * @param address - User wallet address
   * @returns true if user is registered, false otherwise
   */
  onHello?: (address: string) => Promise<boolean>;

  /**
   * Called on successful authorization
   * @param payload - Contains address and KYC fields
   * @returns Object with token or error
   */
  onSuccess?: (payload: AuthPayload) => Promise<AuthResult>;

  /**
   * Called when authorization is declined
   * @param info - Decline details including reason and who declined
   */
  onDecline?: (info: DeclineInfo) => Promise<void>;
}

/**
 * Session data stored for each connected client
 */
export interface Session {
  /** WebSocket client reference */
  client: unknown;
  /** Session UUID (for browser-wallet linking) */
  sessionId: string | null;
  /** User wallet address (set after activation) */
  address: string | null;
  /** Client session ID (for wallet auth) */
  clientSessionId: string | null;
  /** True if this is a browser session */
  isBrowserSession: boolean;
  /** Stored auth result for reconnect scenario */
  authResult?: { token: string };
  /** Stored decline result for reconnect scenario */
  declineResult?: { message: string };
  /** Authorization timeout handle */
  timeout?: NodeJS.Timeout;
}

/**
 * Crypto instance for signature verification
 */
export interface CryptoInstance {
  /** ML-DSA-87 public key */
  dsaPublicKey: Uint8Array;
  /** ML-KEM-1024 public key (optional) */
  kemPublicKey: Uint8Array | null;
  /** Algorithm identifier */
  algorithm: string;
  /** Original user token */
  userToken: UserToken;
  /**
   * Verify ML-DSA-87 signature
   * @param msg - Message that was signed
   * @param signature - ML-DSA-87 signature
   * @returns true if signature is valid
   */
  verifySignature: (
    msg: Buffer | Uint8Array,
    sig: Buffer | Uint8Array
  ) => boolean;
}

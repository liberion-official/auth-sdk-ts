/**
 * Liberion Auth Backend SDK
 *
 * @example
 * ```typescript
 * import { LiberionAuth, createWinstonAdapter } from '@trust-proto/auth-node';
 *
 * const auth = new LiberionAuth({
 *   projectId: 'your-project-uuid',
 *   secretCode: 'your-secret-code',
 *   port: 31313,
 *   logger: createWinstonAdapter(yourWinstonLogger),
 *
 *   onHello: async (address) => {
 *     // Check if user exists in your database
 *     return await userExists(address);
 *   },
 *
 *   onSuccess: async ({ address, fields }) => {
 *     // Generate JWT token for the user
 *     const token = generateJWT(address);
 *     return { token };
 *   },
 *
 *   onDecline: async ({ address, reason, message }) => {
 *     // Log decline event
 *     console.log(`Auth declined: ${reason}`);
 *   },
 * });
 * ```
 */

// Main class
export { LiberionAuth } from './liberion-auth.js';

// Types
export type {
  ILogger,
  LiberionAuthConfig,
  AuthPayload,
  AuthResult,
  DeclineInfo,
  DeclineReason,
  SSLCredentials,
  UserToken,
  Session,
  CryptoInstance,
  Environment,
} from './types.js';

// Adapters
export {
  NoOpLogger,
  ConsoleLogger,
  createWinstonAdapter,
  shortenAddress,
} from './adapters/index.js';

// Crypto utilities (for advanced usage)
export { encryptBuffer, decryptBuffer } from './crypto/aes.js';
export { PQCrypto } from './crypto/pq-crypto.js';
export { initUserCrypto, checkSignature } from './crypto/signature.js';

// Blockchain utilities (for advanced usage)
export {
  getTokenFromIPFS,
  extractIpfsHash,
  clearTokenCache,
} from './blockchain/token-provider.js';

export {
  getNetworkConfig,
  USER_CONTRACT_ABI,
} from './blockchain/constants.js';

export type { NetworkConfig } from './blockchain/constants.js';

// Protocol constants (for advanced usage)
export {
  COMMAND_AUTH,
  COMMAND_READY,
  COMMAND_AUTH_RESULT,
  COMMAND_ACTIVATED,
  COMMAND_AUTH_DECLINED,
  COMMAND_AUTH_TIMEOUT,
  COMMAND_ERROR,
  STATUS,
  DECLINE_REASON,
  DEFAULT_PORT,
} from './protocol/constants.js';

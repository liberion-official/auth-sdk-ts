/**
 * Protocol constants for WebSocket communication
 */

// Commands
export const COMMAND_ACTIVATE = 'activate';
export const COMMAND_READY = 'ready';
export const COMMAND_AUTH = 'auth';
export const COMMAND_AUTH_RESULT = 'auth_result';
export const COMMAND_AUTH_INIT = 'auth_init';
export const COMMAND_ACTIVATED = 'activated';
export const COMMAND_AUTH_DECLINED = 'declined';
export const COMMAND_AUTH_TIMEOUT = 'timeout';
export const COMMAND_RECONNECT = 'reconnect';
export const COMMAND_CONNECTION_FAILED = 'connection_failed';
export const COMMAND_ERROR = 'error';
export const COMMAND_HEALTH = 'health';

// Timeouts
export const SOCKET_PING_TIMEOUT = 30000;
export const AUTHORIZATION_TIME_FRAME = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_PORT = 31313;

// Status
export const STATUS = {
  OK: 'ok',
  FAILED: 'error',
} as const;

// Decline reasons
export const DECLINE_REASON = {
  USER: 'user_declined',
  TIMEOUT: 'timeout',
  ERROR: 'error',
  UNKNOWN: 'unknown',
} as const;

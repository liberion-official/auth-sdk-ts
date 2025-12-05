/**
 * LiberionAuth - Main SDK class for Liberion authentication
 * Creates a WebSocket server that handles browser and wallet connections
 */

import { v1 as uuid, validate } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';
import https from 'https';
import http from 'http';
import { encode, decode } from '@msgpack/msgpack';

import type {
  ILogger,
  LiberionAuthConfig,
  Session,
  AuthPayload,
  AuthResult,
  DeclineInfo,
  DeclineReason,
} from './types.js';
import { NoOpLogger, ConsoleLogger, shortenAddress } from './adapters/logger.js';
import { encryptBuffer, decryptBuffer } from './crypto/aes.js';
import { initUserCrypto, checkSignature } from './crypto/signature.js';
import { getTokenFromIPFS } from './blockchain/token-provider.js';
import { getNetworkConfig, type NetworkConfig } from './blockchain/constants.js';
import { TrustGateClient } from './protocol/trust-gate-client.js';
import {
  COMMAND_READY,
  COMMAND_ERROR,
  COMMAND_ACTIVATED,
  COMMAND_AUTH_INIT,
  COMMAND_AUTH_RESULT,
  COMMAND_AUTH,
  COMMAND_AUTH_DECLINED,
  COMMAND_AUTH_TIMEOUT,
  COMMAND_CONNECTION_FAILED,
  COMMAND_RECONNECT,
  COMMAND_ACTIVATE,
  COMMAND_HEALTH,
  SOCKET_PING_TIMEOUT,
  AUTHORIZATION_TIME_FRAME,
  DEFAULT_PORT,
  STATUS,
  DECLINE_REASON,
} from './protocol/constants.js';

interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  isAlive: boolean;
}

export class LiberionAuth {
  private logger: ILogger;
  private projectId: string;
  private secretCode: string;
  private networkConfig: NetworkConfig;
  private sessions: Record<string, Session> = {};
  private interval: NodeJS.Timeout | null = null;

  // Callbacks
  private onHello?: (address: string) => Promise<boolean>;
  private onSuccess?: (payload: AuthPayload) => Promise<AuthResult>;
  private onDecline?: (info: DeclineInfo) => Promise<void>;

  // Static command exports for compatibility
  static readonly COMMAND_AUTH = COMMAND_AUTH;
  static readonly COMMAND_READY = COMMAND_READY;

  constructor(config: LiberionAuthConfig) {
    // Setup logger
    this.logger = config.logger ?? (config.debug ? new ConsoleLogger() : new NoOpLogger());

    // Validate projectId
    if (!validate(config.projectId)) {
      this.logger.error(
        '[LiberionAuth] Invalid projectId (should be UUID string)'
      );
      throw new Error('Invalid projectId: must be a valid UUID');
    }

    this.projectId = config.projectId;
    this.secretCode = config.secretCode;
    this.networkConfig = getNetworkConfig(config.environment);
    this.onHello = config.onHello;
    this.onSuccess = config.onSuccess;
    this.onDecline = config.onDecline;

    // Create HTTP(S) server
    const port = config.port ?? DEFAULT_PORT;
    const server = config.ssl
      ? https.createServer(config.ssl)
      : http.createServer();

    this.logger.info(
      `[LiberionAuth] Starting ws${config.ssl ? 's' : ''} server on port ${port}`
    );

    // Create WebSocket server
    const wsServer = new WebSocketServer({ server });
    server.listen(port);

    // Handle connections
    wsServer.on('connection', (socket: WebSocket) => {
      const ws = socket as ExtendedWebSocket;
      this.newClient(ws);

      ws.on('message', (data: Buffer) => {
        this.request(ws, data);
      });

      ws.on('close', (code: number) => {
        this.handleClose(ws, code);
      });

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Ping interval for keep-alive
    this.interval = setInterval(() => {
      wsServer.clients.forEach((socket) => {
        const ws = socket as ExtendedWebSocket;
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, SOCKET_PING_TIMEOUT);

    wsServer.on('close', () => {
      if (this.interval) {
        clearInterval(this.interval);
      }
    });
  }

  private encode(data: unknown): Buffer {
    return Buffer.from(encode(data));
  }

  private decode(data: Buffer): unknown {
    return decode(data);
  }

  private async request(client: ExtendedWebSocket, data: Buffer): Promise<void> {
    try {
      const response = await this.readMessage(client, data);
      if (response) {
        this.send(client, response);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[LiberionAuth] Request error: ${err.message}`);
      this.errorResponse(client, err.message);
      this.finalizeSession(client.clientId);
    }
  }

  private send(client: ExtendedWebSocket, data: unknown): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(this.encode(data));
    }
  }

  private async readMessage(
    client: ExtendedWebSocket,
    rawData: Buffer
  ): Promise<unknown> {
    let data: Record<string, unknown>;

    try {
      data = this.decode(rawData) as Record<string, unknown>;
    } catch (error) {
      return this.errorResponse(client, 'Invalid message format');
    }

    const command = data._ as string;

    switch (command) {
      case COMMAND_AUTH_INIT:
        return this.responseInit(client, data);

      case COMMAND_ACTIVATE:
        return this.responseActivate(
          client,
          data.data as Buffer,
          data._requestId as number
        );

      case COMMAND_AUTH:
        return this.responseAuth(client, data);

      case COMMAND_AUTH_DECLINED:
        return this.responseDeclined(client, data);

      case COMMAND_HEALTH:
        return { status: STATUS.OK };

      case COMMAND_RECONNECT:
        return this.responseReconnect(client, data);

      default:
        return this.errorResponse(client, `Unknown command: ${command}`);
    }
  }

  private newClient(client: ExtendedWebSocket): void {
    const clientId = uuid();
    const sessionId = uuid();

    this.sessions[clientId] = {
      client,
      sessionId,
      address: null,
      clientSessionId: null,
      isBrowserSession: false,
    };

    client.clientId = clientId;

    this.logger.info('[LiberionAuth] New client connected', {
      clientId,
      activeSessions: Object.keys(this.sessions).length,
    });

    // Session timeout
    setTimeout(() => {
      if (this.sessions[clientId]) {
        this.finalizeSession(clientId, true);
      }
    }, AUTHORIZATION_TIME_FRAME);
  }

  private handleClose(client: ExtendedWebSocket, code: number): void {
    const isNormal = code === 1000 || code === 1001;
    client.isAlive = false;

    const session = this.sessions[client.clientId];
    if (!session) {
      this.logger.info('[LiberionAuth] Socket closed, session already cleaned', {
        clientId: client.clientId,
        code,
      });
      return;
    }

    // Preserve browser session until auth completed (for iOS reconnect)
    const shouldPreserve = session.isBrowserSession && !session.authResult;

    this.logger.info('[LiberionAuth] WebSocket closed', {
      clientId: client.clientId,
      code,
      isNormal,
      shouldPreserve,
    });

    // Browser sessions: preserve in memory for reconnect (check BEFORE responseFailed!)
    if (shouldPreserve) {
      if (!isNormal) {
        this.logger.warn('[LiberionAuth] Browser abnormal close, session preserved', {
          clientId: client.clientId,
          code,
        });
      }
      this.logger.info('[LiberionAuth] Browser session preserved for reconnect', {
        clientId: client.clientId,
        sessionId: session.sessionId,
      });
      return;
    }

    // For abnormal closes, notify counterpart with CONNECTION_FAILED
    if (!isNormal) {
      this.responseFailed(client, { _: COMMAND_CONNECTION_FAILED });
    }

    delete this.sessions[client.clientId];
  }

  private async responseInit(
    client: ExtendedWebSocket,
    data: Record<string, unknown>
  ): Promise<unknown> {
    const session = this.sessions[client.clientId];

    this.logger.info('[LiberionAuth] Browser requesting QR code', {
      clientId: client.clientId,
      sessionId: session.sessionId,
    });

    const token = encryptBuffer(
      Buffer.from(session.sessionId!),
      this.secretCode
    );

    let trustGateClient: TrustGateClient | null = null;

    try {
      this.logger.info('[LiberionAuth] Connecting to Trust Gate Server', {
        url: this.networkConfig.TRUST_GATE_URL,
      });

      trustGateClient = new TrustGateClient({
        address: this.networkConfig.TRUST_GATE_URL,
        logger: this.logger,
      });

      await trustGateClient.open();

      const result = await trustGateClient.createTask({
        projectId: this.projectId,
        clientKey: token.toString('base64'),
      });

      this.logger.info('[LiberionAuth] Task created successfully', {
        linkWeb: result.linkWeb,
        taskId: result.taskId,
      });

      session.isBrowserSession = true;

      return {
        _: data._,
        linkWeb: result.linkWeb,
        sessionId: session.sessionId,
      };
    } catch (ex) {
      const error = ex as Error;
      this.logger.error('[LiberionAuth] responseInit failed', {
        message: error.message,
      });

      let userMessage: string;
      if (error.message.includes('timeout')) {
        userMessage = 'Authorization service timeout. Please try again.';
      } else if (error.message.includes('Failed to connect')) {
        userMessage = 'Authorization service unavailable. Please try again later.';
      } else {
        userMessage = 'Authorization service error. Please contact support.';
      }

      throw new Error(userMessage);
    } finally {
      trustGateClient?.close();
    }
  }

  private async responseActivate(
    client: ExtendedWebSocket,
    encryptedData: Buffer,
    requestId?: number
  ): Promise<unknown> {
    const decrypted = decryptBuffer(Buffer.from(encryptedData), this.secretCode);
    const { address, sessionId } = this.decode(decrypted) as {
      address: string;
      sessionId: string;
    };

    const session = this.findSession('sessionId', sessionId);

    if (!session) {
      this.logger.error('[LiberionAuth] Session not found for activation', {
        address: shortenAddress(address),
        sessionId,
      });
      return this.errorResponse(client, 'Session not found', requestId);
    }

    if (session.address) {
      this.logger.warn('[LiberionAuth] Session already activated', {
        existingAddress: shortenAddress(session.address),
        newAddress: shortenAddress(address),
      });
      return this.errorResponse(client, 'Session already activated', requestId);
    }

    this.logger.info('[LiberionAuth] Activating session', {
      address: shortenAddress(address),
      sessionId,
    });

    session.address = address;
    session.clientSessionId = uuid();

    // Call onHello callback
    const isRegistered = this.onHello ? await this.onHello(address) : false;

    const responseData = encryptBuffer(
      this.encode({ clientSessionId: session.clientSessionId, isRegistered }),
      this.secretCode
    );

    // Send READY to Trust Gate
    this.finalResponse(client, {
      _: COMMAND_READY,
      data: responseData,
      _requestId: requestId,
    });

    // Notify browser if connected
    const browserClient = session.client as ExtendedWebSocket;
    if (browserClient?.readyState === WebSocket.OPEN) {
      this.send(browserClient, { _: COMMAND_ACTIVATED });
      this.logger.info('[LiberionAuth] ACTIVATED sent to browser', { address: shortenAddress(address) });
    }

    return undefined;
  }

  private async responseAuth(
    client: ExtendedWebSocket,
    data: Record<string, unknown>
  ): Promise<unknown> {
    const { address, payload, signature, fields } = data as {
      address: string;
      payload: Buffer;
      signature: Buffer;
      fields: Record<string, unknown>;
    };

    if (!address || !payload || !signature || !fields) {
      return this.errorResponse(client, 'Missing required parameters');
    }

    let session: Session | null = null;

    try {
      // Decrypt payload to get clientSessionId
      const decryptedPayload = decryptBuffer(
        Buffer.from(payload),
        this.secretCode
      );
      const { clientSessionId } = this.decode(decryptedPayload) as {
        clientSessionId: string;
      };

      if (!clientSessionId || !validate(clientSessionId)) {
        throw new Error('Invalid clientSessionId');
      }

      session = this.findSession('clientSessionId', clientSessionId);
      if (!session) {
        return this.errorResponse(client, 'Session not found');
      }

      // Get user token from IPFS
      const userToken = await getTokenFromIPFS(address, this.logger, this.networkConfig);

      // Initialize crypto and verify signature
      const crypto = initUserCrypto(userToken, this.logger);
      checkSignature(crypto, payload, signature, this.logger);

      // Call onSuccess callback
      const result = this.onSuccess
        ? await this.onSuccess({ address, fields })
        : { token: undefined };

      this.logger.info('[LiberionAuth] Auth successful', {
        address: shortenAddress(address),
        hasToken: !!result.token,
      });

      // Send response to wallet
      this.finalResponse(client, {
        _: result.error ? STATUS.FAILED : COMMAND_AUTH,
        message: result.error || 'welcome',
      });

      // Store auth result for reconnect
      if (result.token) {
        session.authResult = { token: result.token };
      }

      // Send JWT to browser if connected
      const browserClient = session.client as ExtendedWebSocket;
      if (browserClient?.readyState === WebSocket.OPEN) {
        this.finalResponse(browserClient, {
          _: result.error ? STATUS.FAILED : COMMAND_AUTH_RESULT,
          message: result.error || 'welcome',
          payload: { token: result.token },
        });
      }

      return undefined;
    } catch (ex) {
      const error = ex as Error;
      this.logger.error(`[LiberionAuth] Auth failed: ${error.message}`);

      if (session) {
        const browserClient = session.client as ExtendedWebSocket;
        if (browserClient?.readyState === WebSocket.OPEN) {
          this.errorResponse(browserClient, error.message);
        }
      }

      return this.errorResponse(client, error.message);
    }
  }

  private responseDeclined(
    client: ExtendedWebSocket,
    data: Record<string, unknown>
  ): unknown {
    const { payload } = data;

    let clientSessionId: string | undefined;
    let browserSession: Session | null = null;

    // Decrypt payload to extract clientSessionId (same as responseAuth)
    if (payload) {
      try {
        const decryptedPayload = decryptBuffer(
          Buffer.from(payload as Buffer),
          this.secretCode
        );
        const decoded = this.decode(decryptedPayload) as {
          clientSessionId: string;
        };
        clientSessionId = decoded.clientSessionId;

        if (clientSessionId && validate(clientSessionId)) {
          browserSession = this.findSession('clientSessionId', clientSessionId);
        }
      } catch (ex) {
        this.logger.error('[LiberionAuth] Failed to decrypt decline payload', {
          error: (ex as Error).message,
        });
      }
    }

    if (browserSession) {
      this.logger.info('[LiberionAuth] Wallet declined, notifying browser', {
        clientSessionId,
        address: shortenAddress(browserSession.address),
      });

      const browserClient = browserSession.client as ExtendedWebSocket;
      if (browserClient?.readyState === WebSocket.OPEN) {
        this.send(browserClient, {
          _: COMMAND_AUTH_DECLINED,
          message: 'Authorization declined',
        });
      } else {
        // Browser offline - save for reconnect
        browserSession.declineResult = { message: 'Authorization declined' };
        this.logger.info('[LiberionAuth] Browser offline, decline stored', {
          clientSessionId,
        });
      }

      // Call onDecline callback
      if (this.onDecline) {
        this.onDecline({
          address: browserSession.address,
          reason: DECLINE_REASON.USER as DeclineReason,
          message: 'Authorization declined',
          declinedBy: 'wallet',
          sessionId: browserSession.sessionId!,
        }).catch((ex) => {
          this.logger.error(`[LiberionAuth] onDecline error: ${(ex as Error).message}`);
        });
      }

      this.finalResponse(client, {
        _: COMMAND_AUTH_DECLINED,
        message: 'Authorization declined',
      });

      return undefined;
    }

    this.logger.error('[LiberionAuth] Browser session not found for decline', {
      clientSessionId,
      hasPayload: !!payload,
    });

    return this.responseFailed(client, data);
  }

  private responseReconnect(
    client: ExtendedWebSocket,
    data: Record<string, unknown>
  ): unknown {
    const sessionId = data.sessionId as string;

    if (!sessionId) {
      return this.errorResponse(client, 'sessionId required');
    }

    const existingSession = this.findSession('sessionId', sessionId);
    if (!existingSession) {
      return this.errorResponse(client, 'session_not_found');
    }

    // Find old clientId
    const oldClientId = Object.keys(this.sessions).find(
      (k) => this.sessions[k] === existingSession
    );

    this.logger.info('[LiberionAuth] Reconnecting session', {
      sessionId,
      oldClientId,
      newClientId: client.clientId,
      hasAuthResult: !!existingSession.authResult,
    });

    // Update session with new socket
    existingSession.client = client;

    // Re-register under new clientId
    if (oldClientId) {
      delete this.sessions[oldClientId];
    }
    this.sessions[client.clientId] = existingSession;

    // Send stored auth result if available
    if (existingSession.authResult) {
      this.send(client, {
        _: COMMAND_AUTH_RESULT,
        message: 'welcome',
        payload: existingSession.authResult,
      });
    }

    // Send stored decline if available
    if (existingSession.declineResult) {
      this.send(client, {
        _: COMMAND_AUTH_DECLINED,
        message: existingSession.declineResult.message,
      });
      this.logger.info('[LiberionAuth] Sent stored decline', { sessionId });
    }

    // Determine status
    let status: string;
    if (existingSession.authResult) {
      status = 'completed';
    } else if (existingSession.declineResult) {
      status = 'declined';
    } else if (existingSession.address) {
      status = 'activated';
    } else {
      status = 'waiting';
    }

    return {
      _: COMMAND_RECONNECT,
      status,
    };
  }

  private responseFailed(
    client: ExtendedWebSocket,
    data: Record<string, unknown>
  ): unknown {
    const session = this.sessions[client.clientId];
    if (!session) {
      return this.errorResponse(client, 'Session not found');
    }

    const command = data._ as string;
    const message = (data.message as string) || 'Authorization declined';

    // Map command to decline reason
    let reason: DeclineReason;
    switch (command) {
      case COMMAND_AUTH_DECLINED:
        reason = DECLINE_REASON.USER as DeclineReason;
        break;
      case COMMAND_AUTH_TIMEOUT:
        reason = DECLINE_REASON.TIMEOUT as DeclineReason;
        break;
      case COMMAND_CONNECTION_FAILED:
      case COMMAND_ERROR:
        reason = DECLINE_REASON.ERROR as DeclineReason;
        break;
      default:
        reason = DECLINE_REASON.UNKNOWN as DeclineReason;
    }

    const isBrowser =
      session.client === client && session.isBrowserSession;

    this.logger.info('[LiberionAuth] Authorization declined', {
      sessionId: session.sessionId,
      address: shortenAddress(session.address),
      reason,
      declinedBy: isBrowser ? 'browser' : 'wallet',
    });

    // Call onDecline callback
    if (this.onDecline) {
      this.onDecline({
        address: session.address,
        reason,
        message,
        declinedBy: isBrowser ? 'browser' : 'wallet',
        sessionId: session.sessionId!,
      }).catch((ex) => {
        this.logger.error(`[LiberionAuth] onDecline error: ${(ex as Error).message}`);
      });
    }

    this.finalResponse(client, { _: command, message });
    return undefined;
  }

  private errorResponse(
    client: ExtendedWebSocket,
    error: string,
    requestId?: number
  ): false {
    this.logger.error('[LiberionAuth] Sending error', {
      clientId: client.clientId,
      error,
    });

    this.finalResponse(client, {
      _: COMMAND_ERROR,
      message: error,
      ...(requestId && { _requestId: requestId }),
    });

    return false;
  }

  private finalResponse(
    client: ExtendedWebSocket,
    data: unknown
  ): void {
    if (client.readyState === WebSocket.OPEN) {
      this.send(client, data);
    }
    this.closeClient(client);
  }

  private finalizeSession(clientId: string, isTimeout = false): void {
    const session = this.sessions[clientId];
    if (!session) return;

    if (isTimeout) {
      this.responseFailed(session.client as ExtendedWebSocket, {
        _: COMMAND_AUTH_TIMEOUT,
        message: 'Authorization timeout',
      });
    } else {
      this.closeClient(session.client as ExtendedWebSocket);
    }
  }

  private closeClient(client: ExtendedWebSocket): void {
    delete this.sessions[client.clientId];
    client?.terminate();
  }

  private findSession(
    paramName: keyof Session,
    searchValue: unknown
  ): Session | null {
    for (const key of Object.keys(this.sessions)) {
      if (this.sessions[key][paramName] === searchValue) {
        return this.sessions[key];
      }
    }
    return null;
  }
}

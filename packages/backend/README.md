# @trust-proto/auth-node

[![npm version](https://img.shields.io/npm/v/@trust-proto/auth-node.svg)](https://www.npmjs.com/package/@trust-proto/auth-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Backend SDK for Liberion decentralized authentication system. This package provides a WebSocket server that handles browser-wallet authentication flow.

## Requirements

- Node.js >= 20.0.0

## Installation

```bash
npm install @trust-proto/auth-node
```

## Quick Start

```typescript
import { LiberionAuth, createWinstonAdapter } from '@trust-proto/auth-node';

const auth = new LiberionAuth({
  projectId: 'your-project-uuid',
  secretCode: 'your-secret-code',
  port: 31313, // optional, default: 31313

  // Check if user exists in your database
  onHello: async (address) => {
    return await userExists(address);
  },

  // Generate JWT token after successful authentication
  onSuccess: async ({ address, fields }) => {
    const token = generateJWT(address);
    return { token };
  },

  // Handle declined authorization (optional)
  onDecline: async ({ address, reason, message }) => {
    console.log(`Auth declined: ${reason}`);
  },
});
```

## Configuration

| Option        | Type                                            | Required | Default        | Description                          |
| ------------- | ----------------------------------------------- | -------- | -------------- | ------------------------------------ |
| `projectId`   | `string`                                        | Yes      | -              | Project UUID from Liberion dashboard |
| `secretCode`  | `string`                                        | Yes      | -              | Secret code for encryption           |
| `port`        | `number`                                        | No       | `31313`        | WebSocket server port                |
| `ssl`         | `{ key: string; cert: string }`                 | No       | -              | SSL credentials for HTTPS            |
| `debug`       | `boolean`                                       | No       | `false`        | Enable debug logging                 |
| `environment` | `'production' \| 'development'`                 | No       | `'production'` | Target environment                   |
| `logger`      | `ILogger`                                       | No       | `NoOpLogger`   | Custom logger instance               |
| `onHello`     | `(address: string) => Promise<boolean>`         | No       | -              | Called when wallet activates         |
| `onSuccess`   | `(payload: AuthPayload) => Promise<AuthResult>` | No       | -              | Called on successful auth            |
| `onDecline`   | `(info: DeclineInfo) => Promise<void>`          | No       | -              | Called when auth is declined         |

## Logger Integration

### Using Winston

```typescript
import { createWinstonAdapter } from '@trust-proto/auth-node';
import winston from 'winston';

const logger = winston.createLogger({ /* your config */ });

const auth = new LiberionAuth({
  projectId: 'your-project-uuid',
  secretCode: 'your-secret-code',
  logger: createWinstonAdapter(logger),
});
```

### Using Console Logger

```typescript
import { ConsoleLogger } from '@trust-proto/auth-node';

const auth = new LiberionAuth({
  projectId: 'your-project-uuid',
  secretCode: 'your-secret-code',
  logger: new ConsoleLogger('[MyApp]'),
});
```

### Custom Logger

Implement the `ILogger` interface:

```typescript
const customLogger: ILogger = {
  info: (message, meta) => { /* ... */ },
  warn: (message, meta) => { /* ... */ },
  error: (message, meta) => { /* ... */ },
};
```

## Authentication Flow

1. **Browser** connects to WebSocket server and sends `auth_init`
2. **Server** creates authorization task via Trust Gate
3. **Server** returns QR code link to browser
4. **User** scans QR code with Liberion Wallet
5. **Wallet** sends activation request with encrypted session data
6. **Server** calls `onHello` callback, sends ACTIVATED to browser
7. **Wallet** sends signed auth data with KYC fields
8. **Server** verifies ML-DSA-87 signature, calls `onSuccess`
9. **Server** sends JWT token to browser, closes connections

## Security Features

- **Post-Quantum Cryptography**: ML-KEM-1024 + ML-DSA-87 (FIPS 203/204)
- **AES-256-CBC**: Session encryption with project secret
- **Signature Verification**: All auth data is cryptographically signed
- **Session Timeout**: 10-minute authorization window
- **WebSocket Ping/Pong**: Keep-alive with 30-second interval

## License

MIT

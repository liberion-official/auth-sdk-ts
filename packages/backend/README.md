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

  // Check if user is already registered in your database
  // Return true if user exists - wallet will skip permission request
  // Return false if user is new - wallet will show permission request
  onHello: async (address) => {
    return await userExists(address);
  },

  // Generate JWT token after successful authentication
  onSuccess: async ({ address, fields }) => {
    // Save user data to your database
    await db.users.upsert({
      address,
      nickname: fields?.nickname,
      email: fields?.email,
      // ... other KYC fields
    });

    const token = generateJWT(address);
    return { token };
  },

  // Handle declined authorization (optional)
  onDecline: async ({ address, reason, message, declinedBy, sessionId }) => {
    console.log(`Auth declined by ${declinedBy}: ${reason}`);
  },
});
```

## Configuration

| Option       | Type                                            | Required | Default      | Description                          |
| ------------ | ----------------------------------------------- | -------- | ------------ | ------------------------------------ |
| `projectId`  | `string`                                        | ✅        | -            | Project UUID from Liberion dashboard |
| `secretCode` | `string`                                        | ✅        | -            | Secret code for encryption           |
| `port`       | `number`                                        | ❌        | `31313`      | WebSocket server port                |
| `ssl`        | `SSLCredentials`                                | ❌        | -            | SSL/TLS options for HTTPS server     |
| `debug`      | `boolean`                                       | ❌        | `false`      | Enable debug logging                 |
| `logger`     | `ILogger`                                       | ❌        | `NoOpLogger` | Custom logger instance               |
| `onHello`    | `(address: string) => Promise<boolean>`         | ❌        | -            | Check if user is registered          |
| `onSuccess`  | `(payload: AuthPayload) => Promise<AuthResult>` | ❌        | -            | Called on successful auth            |
| `onDecline`  | `(info: DeclineInfo) => Promise<void>`          | ❌        | -            | Called when auth is declined         |

## Callbacks

### onHello

Called when the wallet activates and sends the user's address. This callback should check if the user is already registered in your database.

**Return value (`isRegistered`):**

- Return `true` if user exists - wallet will **skip** the permission request screen
- Return `false` if user is new - wallet will **show** the permission request screen

This allows returning users to have a smoother authentication experience without repeatedly granting permissions.

```typescript
onHello: async (address) => {
  const user = await db.users.findOne({ address });
  return !!user; // true if registered, false if new user
}
```

### onSuccess

Called after successful authentication and signature verification. Use this callback to save user data and generate a JWT token.

**Parameters:**

- `address` - User's blockchain address
- `fields` - KYC data object (nickname, email, name, sex, dateOfBirth, etc.)

**Return value:**

- `{ token: string }` - JWT token for successful auth
- `{ error: string }` - (Optional) Error message if auth should fail

```typescript
onSuccess: async ({ address, fields }) => {
  // Save user data to your database
  await db.users.upsert({
    address,
    nickname: fields?.nickname,
    email: fields?.email,
    name: fields?.name,
    sex: fields?.sex,
    dateOfBirth: fields?.dateOfBirth,
    documentCountry: fields?.documentCountry,
    imageAvatar: fields?.imageAvatar,
    // ... other KYC fields from the wallet
  });

  // Generate JWT token
  const token = jwt.sign({ address }, SECRET_KEY);

  return { token };
}
```

**Error handling:**

If you need to reject authentication based on your business logic, return an error:

```typescript
onSuccess: async ({ address, fields }) => {
  // Example: Check if user meets requirements
  if (!await meetsRequirements(address)) {
    return { error: 'Account not eligible for this service' };
  }

  await db.users.upsert({ address, ...fields });
  const token = jwt.sign({ address }, SECRET_KEY);
  return { token };
}
```

### onDecline

Called when authentication is declined by the user or fails. Useful for logging or analytics.

**Parameters:**

- `address` - User's blockchain address (may be null if declined before activation)
- `reason` - Standardized decline reason: `'user_declined'`, `'timeout'`, `'error'`, `'unknown'`
- `message` - Detailed decline message
- `declinedBy` - Who declined: `'wallet'` or `'browser'`
- `sessionId` - Session ID for tracking

```typescript
onDecline: async ({ address, reason, message, declinedBy, sessionId }) => {
  // Log decline for analytics
  await db.authLogs.create({
    address,
    reason,      // 'user_declined', 'timeout', 'error', 'unknown'
    message,     // Detailed message
    declinedBy,  // 'wallet' or 'browser'
    sessionId,
    timestamp: new Date(),
  });
}
```

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

1. **Browser** connects to WebSocket Server and sends `auth_init`
2. **Server** creates authorization task via Trust Gate
3. **Server** returns QR code link to browser
4. **User** scans QR code with Liberion Wallet
5. **Wallet** sends activation request with signed session data to Trust Gate server
6. **Trust Gate server** gets public keys from Blockchain → User's S-NFT & checks signatures
7. **Trust Gate server** calls `onHello` callback to Server
8. **Server** calls `onHello` callback into its runtime
9. **Server** sends ACTIVATED to browser
10. **Server** sends `onHello` response to Trust Gate server
11. **Trust Gate server** checks the project settings and required fields
12. **Trust Gate server** sends payload back to Liberion Wallet
13. **Liberion Wallet** sends signed auth data with KYC fields (Merkle Tree or ZK-proofs) to Server
14. **Server** verifies ML-DSA-87 signature, checks data validity of proofs with Blockchain and calls `onSuccess` or `onDecline` callbacks respectively
15. **Server** sends auth data to Browser, closes all session's connections
16. **Browser** authorizes using auth data

## Security Features

- **Post-Quantum Cryptography**: ML-KEM-1024 + XChaCha20-Poly1305 + ML-DSA-87 (FIPS 203/204)
  - Used by Trust Gate for encrypting data sent to Wallet
  - ML-KEM-1024: Key encapsulation mechanism
  - XChaCha20-Poly1305: Authenticated encryption
  - ML-DSA-87: Digital signatures
- **Layered Encryption**:
  - **Server ↔ Trust Gate/Wallet**: AES-256-CBC with project `secretCode`
  - **Trust Gate → Wallet**: Critical data additionally encrypted with ML-KEM-1024 + XChaCha20-Poly1305
- **Signature Verification**: All auth data is cryptographically signed and verified
- **Session Timeout**: 10-minute authorization window
- **WebSocket Ping/Pong**: Keep-alive with 30-second interval

## License

MIT

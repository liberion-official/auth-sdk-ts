# Liberion Auth SDK

Official authentication SDK for [Liberion](https://liberion.io) - Modern identity platform with post-quantum cryptography.

[![CI](https://github.com/liberion-official/auth-sdk-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/liberion-official/auth-sdk-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Packages

| Package                                        | Version                                                                                                               | Description                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [@trust-proto/auth-node](./packages/backend)   | [![npm](https://img.shields.io/npm/v/@trust-proto/auth-node)](https://www.npmjs.com/package/@trust-proto/auth-node)   | Node.js backend SDK with WebSocket server |
| [@trust-proto/auth-react](./packages/frontend) | [![npm](https://img.shields.io/npm/v/@trust-proto/auth-react)](https://www.npmjs.com/package/@trust-proto/auth-react) | React frontend authentication widget      |

## Quick Start

### Backend (Node.js)

```bash
npm install @trust-proto/auth-node
# or
pnpm add @trust-proto/auth-node
```

```typescript
import { LiberionAuth } from '@trust-proto/auth-node';

const auth = new LiberionAuth({
  projectId: 'your-project-uuid',
  secretCode: 'your-secret-code',
  onHello: async ({ address }) => {
    // Called when wallet connects
    return { proceed: true };
  },
  onSuccess: async ({ address, fields }) => {
    // Called on successful authentication
    const token = await generateJWT(address);
    return { token };
  },
  onDecline: async ({ reason }) => {
    // Called when user declines authentication
    console.log('Auth declined:', reason);
  },
});

// Start the WebSocket server
await auth.listen({ port: 8080 });
```

### Frontend (React)

```bash
npm install @trust-proto/auth-react
# or
pnpm add @trust-proto/auth-react
```

```tsx
import { LiberionAuth } from '@trust-proto/auth-react';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Login with Liberion
      </button>

      <LiberionAuth
        backendUrl="wss://your-server.com:8080"
        isOpen={isOpen}
        theme="dark"
        successCb={(result) => {
          console.log('Auth success:', result.token);
          setIsOpen(false);
        }}
        failedCb={() => {
          console.log('Auth failed');
          setIsOpen(false);
        }}
        closeCb={() => setIsOpen(false)}
      />
    </>
  );
}
```

## Features

- **Post-Quantum Cryptography** - ML-KEM and ML-DSA algorithms (FIPS 203/204 compliant)
- **WebSocket Protocol** - Real-time communication with MessagePack serialization
- **QR Code Authentication** - Scan with Liberion mobile wallet
- **Multi-language Support** - English and Russian out of the box
- **Dark/Light Themes** - Customizable widget appearance
- **TypeScript** - Full type definitions for backend SDK

## Documentation

- [Backend SDK Documentation](./packages/backend/README.md)
- [Frontend SDK Documentation](./packages/frontend/README.md)

## Development

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/liberion-official/auth-sdk-ts.git
cd auth-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Available Scripts

```bash
pnpm build          # Build all packages
pnpm build:backend  # Build backend only
pnpm build:frontend # Build frontend only
pnpm dev            # Start development mode
pnpm test           # Run tests
pnpm lint           # Lint all packages
pnpm typecheck      # Type check
pnpm clean          # Clean build artifacts
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - see [LICENSE](./LICENSE) for details.

## Links

- [Liberion Website](https://liberion.io)
- [API Documentation](https://docs.liberion.io)
- [Report Issues](https://github.com/liberion-official/auth-sdk-ts/issues)

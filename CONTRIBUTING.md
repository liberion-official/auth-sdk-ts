# Contributing to Liberion Auth SDK

Thank you for your interest in contributing to Liberion Auth SDK! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/liberion-official/auth-sdk-ts.git
cd auth-sdk-ts
```

2. Install dependencies:

```bash
pnpm install
```

3. Build all packages:

```bash
pnpm build
```

4. Run tests:

```bash
pnpm test
```

## Development Workflow

### Running in Development Mode

```bash
pnpm dev              # All packages
pnpm dev:backend      # Backend only
pnpm dev:frontend     # Frontend only
```

### Testing

```bash
pnpm test             # Run all tests once
pnpm test:coverage    # Run tests with coverage
```

### Linting and Formatting

```bash
pnpm lint             # Check for linting issues
pnpm format           # Format code with Prettier
pnpm format:check     # Check formatting without making changes
```

### Type Checking

```bash
pnpm typecheck        # Run TypeScript type checks
```

## Project Structure

```
auth-sdk/
├── packages/
│   ├── backend/      # @trust-proto/auth-node - Node.js SDK
│   └── frontend/     # @trust-proto/auth-react - React widget
├── .github/
│   └── workflows/    # CI/CD configurations
├── package.json      # Root workspace configuration
├── pnpm-workspace.yaml
└── turbo.json        # Turborepo configuration
```

## Pull Request Guidelines

1. **Create a feature branch** from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

2. **Make your changes** following the coding standards below.

3. **Add tests** if applicable.

4. **Run checks** before committing:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

5. **Commit your changes** with a descriptive message:

```bash
git commit -m "feat: add new feature description"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test changes

6. **Push and create a Pull Request** to `main` branch.

## Coding Standards

### TypeScript (Backend)

- Use strict TypeScript with all strict checks enabled
- Export types from `types.ts`
- Use JSDoc comments for public APIs
- Follow the existing code style

### JavaScript/JSX (Frontend)

- Use ES modules
- Follow the ESLint configuration
- Use functional components with hooks
- Keep components small and focused

### General

- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions focused on a single responsibility
- Handle errors appropriately

## Testing Guidelines

### Backend Tests

- Unit tests in `tests/unit/`
- E2E tests in `tests/e2e/`
- Use Vitest for all tests
- Mock external dependencies

### Frontend Tests

- Component tests (to be added)
- Use testing-library for React components

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### For Contributors

When your PR includes changes that should be released, add a changeset:

```bash
pnpm changeset
```

Follow the prompts to:

- Select affected packages (`@trust-proto/auth-node`, `@trust-proto/auth-react`)
- Choose version bump type (patch/minor/major)
- Write a summary of changes

Commit the generated `.changeset/*.md` file with your PR.

### For Maintainers

Releases are automated via GitHub Actions:

1. Merging PRs with changesets to `main` creates a "Version Packages" PR
2. Merging the "Version Packages" PR triggers:
   - Version bumps and changelog updates
   - Publishing to npm
   - Creating GitHub Releases

## Getting Help

- Open an [issue](https://github.com/liberion-official/auth-sdk-ts/issues) for bugs
- Start a [discussion](https://github.com/liberion-official/auth-sdk-ts/discussions) for questions
- Review existing issues before creating new ones

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

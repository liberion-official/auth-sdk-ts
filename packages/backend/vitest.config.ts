import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // Re-exports only
        'src/**/index.ts', // Re-exports only
        'src/types.ts', // Type definitions
        'src/**/*.d.ts',
        'src/adapters/logger.ts', // Logger is not tested
      ]
    },
    // Run tests sequentially to avoid port conflicts
    fileParallelism: false,
    // Ensure proper test isolation
    isolate: true,
  },
});

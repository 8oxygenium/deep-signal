import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/scratch/**', 'tests/tools/**', 'node_modules/**'],
    testTimeout: 900_000,
    hookTimeout: 60_000,
  },
});

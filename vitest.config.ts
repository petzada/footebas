import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    passWithNoTests: false,
    exclude: ['**/dist/**', '**/node_modules/**'],
    testTimeout: 10_000,
  },
});

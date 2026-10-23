import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    passWithNoTests: false,
    exclude: ['**/dist/**', '**/node_modules/**'],
    // Statistical engine tests run thousands of matches; turbo runs packages in
    // parallel on CI, so allow headroom instead of flaking at 10 s.
    testTimeout: 60_000,
  },
});

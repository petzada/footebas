import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Screen tests render whole flows in jsdom; under a full parallel run the
    // 5 s default flakes, so give them headroom.
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});

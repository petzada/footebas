// E2E do web contra a API local em memória (apps/api/src/dev-server.ts) e o
// Next em modo dev com sessão dev (NEXT_PUBLIC_AUTH_MODE=dev). Os dois
// servidores sobem pelo `webServer`; com E2E_BASE_URL definido eles não sobem
// e os testes rodam contra a URL informada.
import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI !== undefined && process.env.CI !== '';
const API_PORT = process.env.E2E_API_PORT ?? '8787';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3000';
const API_URL = `http://127.0.0.1:${API_PORT}`;
// localhost (não 127.0.0.1): é a origem liberada no CORS do dev-server.
const WEB_URL = `http://localhost:${WEB_PORT}`;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests',
  // A API em memória é compartilhada: um teste por vez, sem paralelismo.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // dist/ já é ignorado pelo git e pelo prettier.
  outputDir: 'dist/test-results',
  reporter: CI
    ? [['list'], ['html', { outputFolder: 'dist/report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: external ?? WEB_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(external
    ? {}
    : {
        webServer: [
          {
            command: 'pnpm --filter @footebas/api dev',
            url: `${API_URL}/health`,
            env: { PORT: API_PORT, CORS_ORIGINS: WEB_URL },
            reuseExistingServer: !CI,
            timeout: 120_000,
            stdout: 'pipe',
          },
          {
            command: `pnpm --filter @footebas/web exec next dev --port ${WEB_PORT}`,
            url: WEB_URL,
            env: {
              NEXT_PUBLIC_API_URL: API_URL,
              NEXT_PUBLIC_AUTH_MODE: 'dev',
              NEXT_TELEMETRY_DISABLED: '1',
            },
            reuseExistingServer: !CI,
            // Primeira compilação do next dev é lenta em máquina fria.
            timeout: 240_000,
          },
        ],
      }),
});

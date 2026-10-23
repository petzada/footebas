// Usage (from the repo root):
//   API_URL=https://api.footebas.com.br SMOKE_TOKEN=... pnpm smoke:cloud
//   API_URL=http://127.0.0.1:8787 AUTH=dev pnpm smoke:cloud
// Exit codes: 0 success, 1 smoke failure, 2 bad configuration.
import { runSmoke, type AuthMode } from './smoke.js';

function fail(message: string): never {
  console.error(`Configuração inválida: ${message}`);
  console.error(
    'Defina API_URL e SMOKE_TOKEN (ou AUTH=dev contra o servidor local). Veja tools/cloud-smoke/README.md.',
  );
  process.exit(2);
}

function positive(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0)
    fail(`${name} deve ser um número positivo`);
  return value;
}

const apiUrl = process.env.API_URL ?? '';
if (!/^https?:\/\/[^/]+/.test(apiUrl))
  fail('API_URL ausente ou sem http(s)://');

const authKind = (process.env.AUTH ?? 'smoke').toLowerCase();
let auth: AuthMode;
if (authKind === 'dev') {
  auth = {
    kind: 'dev',
    email: process.env.SMOKE_EMAIL ?? 'smoke@footebas.invalid',
  };
} else if (authKind === 'smoke') {
  const token = process.env.SMOKE_TOKEN ?? '';
  if (token.length < 32)
    fail('SMOKE_TOKEN ausente ou com menos de 32 caracteres');
  auth = { kind: 'smoke', token };
} else fail(`AUTH deve ser "smoke" ou "dev", recebido "${authKind}"`);

const result = await runSmoke({
  apiUrl,
  auth,
  ...(process.env.SMOKE_CLUB ? { clubId: process.env.SMOKE_CLUB } : {}),
  jobTimeoutMs: positive('JOB_TIMEOUT_MS', 120_000),
  jobPollMs: positive('JOB_POLL_MS', 1_000),
  requestTimeoutMs: positive('REQUEST_TIMEOUT_MS', 30_000),
  commandP95Ms: positive('SMOKE_P95_MS', 800),
});
process.exitCode = result.ok ? 0 : 1;

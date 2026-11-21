#!/usr/bin/env node
// Roda uma task do turbo só nos pacotes que o branch afeta, comparando com o merge-base de
// origin/main. Usado pelo pre-push (typecheck) e por `pnpm test:related` (antes de abrir PR).
//
//   node scripts/affected.mjs typecheck
//   node scripts/affected.mjs test --skip-slow --concurrency=1
//
// --skip-slow liga FOOTEBAS_SKIP_SLOW=1 (pula os Monte Carlo do engine, ~15 s) se a variável
// não estiver definida; o CI roda tudo.
//
// Chama o binário do turbo direto pelo Node (sem shell): funciona igual no Windows e no Linux
// e não esbarra no limite de linha de comando do cmd.
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const skipSlow = args.includes('--skip-slow');
const [task, ...extra] = args.filter((arg) => arg !== '--skip-slow');
if (!task) {
  console.error('uso: node scripts/affected.mjs <task> [args do turbo]');
  process.exit(2);
}

function mergeBase() {
  for (const ref of ['origin/main', 'main']) {
    try {
      return execFileSync('git', ['merge-base', 'HEAD', ref], {
        encoding: 'utf8',
      }).trim();
    } catch {
      // tenta a próxima referência
    }
  }
  return undefined;
}

const base = mergeBase();
const env = { ...process.env };
if (skipSlow) env.FOOTEBAS_SKIP_SLOW ??= '1';
if (base) env.TURBO_SCM_BASE = base;
else
  console.warn(
    'affected: sem origin/main local; o turbo usa a base padrão dele.',
  );

const turbo = require.resolve('turbo/bin/turbo');
const result = spawnSync(
  process.execPath,
  [turbo, 'run', task, '--affected', '--output-logs=errors-only', ...extra],
  { stdio: 'inherit', env },
);
process.exit(result.status ?? 1);

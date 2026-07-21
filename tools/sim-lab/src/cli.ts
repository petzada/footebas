import { smokeOutput } from './smoke.js';

if (!process.argv.includes('--smoke')) {
  process.stderr.write('Usage: pnpm --filter @footebas/sim-lab smoke\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`${smokeOutput()}\n`);
}

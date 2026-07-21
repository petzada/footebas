import { smokeOutput } from './smoke.js';
import { canonicalJson } from '@footebas/domain';
import { runCalibration } from './calibration.js';
import { runPhaseOneGate } from './gate.js';
import { runPlaythrough } from './playthrough.js';
import { runSeason } from './season.js';

function numericArgument(name: string, fallback: number): number {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  return argument === undefined
    ? fallback
    : Number(argument.slice(name.length + 3));
}

if (process.argv.includes('--smoke')) {
  process.stdout.write(`${smokeOutput()}\n`);
} else if (process.argv.includes('--calibrate')) {
  const matches = numericArgument('matches', 10_000);
  const report = runCalibration(matches);
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.passed) process.exitCode = 1;
} else if (process.argv.includes('--season')) {
  const seed = process.argv
    .find((value) => value.startsWith('--seed='))
    ?.slice(7);
  const report = runSeason(seed === undefined ? {} : { seed });
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.passed) process.exitCode = 1;
} else if (process.argv.includes('--playthrough')) {
  const report = runPlaythrough(numericArgument('rounds', 14));
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.passed) process.exitCode = 1;
} else if (process.argv.includes('--phase1-gate')) {
  const report = runPhaseOneGate(
    numericArgument('matches', 10_000),
    numericArgument('seasons', 1_000),
  );
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.passed) process.exitCode = 1;
} else {
  process.stderr.write(
    'Usage: sim-lab --smoke | --calibrate [--matches=10000] | --season [--seed=x] | --playthrough [--rounds=14] | --phase1-gate [--matches=10000] [--seasons=1000]\n',
  );
  process.exitCode = 1;
}

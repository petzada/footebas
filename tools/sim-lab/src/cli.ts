import { smokeOutput } from './smoke.js';
import { canonicalJson } from '@footebas/domain';
import { runCalibration } from './calibration.js';

if (process.argv.includes('--smoke')) {
  process.stdout.write(`${smokeOutput()}\n`);
} else if (process.argv.includes('--calibrate')) {
  const countArgument = process.argv.find((argument) =>
    argument.startsWith('--matches='),
  );
  const matches =
    countArgument === undefined
      ? 10_000
      : Number(countArgument.slice('--matches='.length));
  const report = runCalibration(matches);
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.passed) process.exitCode = 1;
} else {
  process.stderr.write(
    'Usage: sim-lab --smoke | --calibrate [--matches=10000]\n',
  );
  process.exitCode = 1;
}

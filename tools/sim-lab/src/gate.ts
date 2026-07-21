/* eslint-disable @typescript-eslint/restrict-template-expressions -- numeric stress indexes are canonical seed/report segments */
import { canonicalJson } from '@footebas/domain';
import { runCalibration } from './calibration.js';
import { runPlaythrough } from './playthrough.js';
import { runSeason } from './season.js';

export const PHASE_ONE_GATE_VERSION = 'phase-one-gate-v1' as const;
export interface PhaseOneGateReport {
  readonly schemaVersion: typeof PHASE_ONE_GATE_VERSION;
  readonly matches: number;
  readonly seasons: number;
  readonly seasonMatches: number;
  readonly calibrationPassed: boolean;
  readonly playthroughPassed: boolean;
  readonly failures: readonly string[];
  readonly passed: boolean;
}
export function runSeasonStress(seasons = 1_000): readonly string[] {
  if (!Number.isSafeInteger(seasons) || seasons < 1)
    throw new Error('Season stress count must be a positive safe integer');
  const failures: string[] = [];
  for (let index = 0; index < seasons; index += 1) {
    const report = runSeason({ seed: `phase-one-stress-v1|${index}` });
    if (!report.passed)
      failures.push(`season ${index}: ${report.failures.join('; ')}`);
  }
  return failures;
}
export function runPhaseOneGate(
  matches = 10_000,
  seasons = 1_000,
): PhaseOneGateReport {
  const calibration = runCalibration(matches);
  const playthrough = runPlaythrough();
  const failures = [
    ...calibration.failures,
    ...playthrough.failures,
    ...runSeasonStress(seasons),
  ];
  return {
    schemaVersion: PHASE_ONE_GATE_VERSION,
    matches,
    seasons,
    seasonMatches: seasons * 56,
    calibrationPassed: calibration.passed,
    playthroughPassed: playthrough.passed,
    failures,
    passed: failures.length === 0,
  };
}
export function phaseOneGateOutput(matches = 10_000, seasons = 1_000): string {
  return canonicalJson(runPhaseOneGate(matches, seasons));
}

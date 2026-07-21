/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions -- fixed calibration cohorts have validated cardinality; numeric seed segments are canonical */
import { canonicalJson } from '@footebas/domain';
import { simulateMatch } from '@footebas/engine';
import { matchInputFactory, TEST_SEEDS } from '@footebas/testing';

export const CALIBRATION_BANDS_VERSION = 'match-v1-bands-v1' as const;
export const CALIBRATION_BANDS = Object.freeze({
  goalsPerMatch: { minimum: 3.7, maximum: 4.6 },
  cardsPerMatch: { minimum: 2, maximum: 6 },
  homeWinRate: { minimum: 0.38, maximum: 0.58 },
  homeAdvantage: { minimum: 0.04, maximum: 0.3 },
  upsetRate: { minimum: 0.08, maximum: 0.38 },
  monotonicMinimumStep: 0.015,
});
export interface CalibrationReport {
  readonly schemaVersion: 'sim-lab-report-v1';
  readonly bandsVersion: string;
  readonly engineVersion: string;
  readonly seed: string;
  readonly matches: number;
  readonly metrics: Readonly<{
    goalsPerMatch: number;
    cardsPerMatch: number;
    homeWinRate: number;
    awayWinRate: number;
    homeAdvantage: number;
    upsetRate: number;
    favoriteWinRates: readonly number[];
  }>;
  readonly failures: readonly string[];
  readonly passed: boolean;
}
const rounded = (value: number): number => Number(value.toFixed(4));
function resultAt(seed: string, homeStrength: number, awayStrength: number) {
  return simulateMatch(matchInputFactory({ seed, homeStrength, awayStrength }));
}
export function runCalibration(matches = 10_000): CalibrationReport {
  if (!Number.isSafeInteger(matches) || matches < 1_000)
    throw new Error('Calibration requires at least 1,000 matches');
  let goals = 0;
  let cards = 0;
  let homeWins = 0;
  let awayWins = 0;
  for (let index = 0; index < matches; index += 1) {
    const result = resultAt(`${TEST_SEEDS.calibration}|base|${index}`, 72, 72);
    goals += result.homeGoals + result.awayGoals;
    cards +=
      result.home.yellowCards +
      result.away.yellowCards +
      result.home.redCards +
      result.away.redCards;
    if (result.homeGoals > result.awayGoals) homeWins += 1;
    if (result.awayGoals > result.homeGoals) awayWins += 1;
  }
  const cohort = Math.max(1_000, Math.floor(matches / 4));
  let upsets = 0;
  for (let index = 0; index < cohort; index += 1) {
    const result = resultAt(`${TEST_SEEDS.calibration}|upset|${index}`, 80, 68);
    if (result.awayGoals > result.homeGoals) upsets += 1;
  }
  const favoriteWinRates = [0, 6, 12].map((difference) => {
    let wins = 0;
    for (let index = 0; index < cohort; index += 1) {
      const result = resultAt(
        `${TEST_SEEDS.calibration}|mono|${difference}|${index}`,
        72 + difference,
        72,
      );
      if (result.homeGoals > result.awayGoals) wins += 1;
    }
    return rounded(wins / cohort);
  });
  const metrics = {
    goalsPerMatch: rounded(goals / matches),
    cardsPerMatch: rounded(cards / matches),
    homeWinRate: rounded(homeWins / matches),
    awayWinRate: rounded(awayWins / matches),
    homeAdvantage: rounded((homeWins - awayWins) / matches),
    upsetRate: rounded(upsets / cohort),
    favoriteWinRates,
  };
  const failures: string[] = [];
  for (const key of [
    'goalsPerMatch',
    'cardsPerMatch',
    'homeWinRate',
    'homeAdvantage',
    'upsetRate',
  ] as const) {
    const band = CALIBRATION_BANDS[key];
    if (metrics[key] < band.minimum || metrics[key] > band.maximum)
      failures.push(
        `${key}=${metrics[key]} outside [${band.minimum}, ${band.maximum}]`,
      );
  }
  for (let index = 1; index < favoriteWinRates.length; index += 1)
    if (
      favoriteWinRates[index]! - favoriteWinRates[index - 1]! <
      CALIBRATION_BANDS.monotonicMinimumStep
    )
      failures.push(
        `favoriteWinRates are not monotonic with minimum step ${CALIBRATION_BANDS.monotonicMinimumStep}`,
      );
  return {
    schemaVersion: 'sim-lab-report-v1',
    bandsVersion: CALIBRATION_BANDS_VERSION,
    engineVersion: 'match-v1',
    seed: TEST_SEEDS.calibration,
    matches,
    metrics,
    failures,
    passed: failures.length === 0,
  };
}
export function calibrationOutput(matches = 10_000): string {
  return canonicalJson(runCalibration(matches));
}

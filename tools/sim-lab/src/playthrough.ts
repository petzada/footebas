import { canonicalJson, type Tactic } from '@footebas/domain';
import { tacticFactory } from '@footebas/testing';
import { runSeason, SEASON_SEED_VERSION } from './season.js';

export const PLAYTHROUGH_REPORT_VERSION = 'phase-one-playthrough-v1' as const;
const DECISIONS: readonly Tactic[] = Object.freeze([
  tacticFactory({
    formation: '4-3-3',
    mentality: 'all_out_attack',
    attackDirection: 'wings',
    marking: 'heavy',
  }),
  tacticFactory({
    formation: '4-4-2',
    mentality: 'balanced',
    attackDirection: 'center',
    marking: 'light',
  }),
  tacticFactory({
    formation: '3-5-2',
    mentality: 'counter_attack',
    attackDirection: 'center',
    marking: 'very_heavy',
  }),
]);
export interface PlaythroughReport {
  readonly schemaVersion: typeof PLAYTHROUGH_REPORT_VERSION;
  readonly seed: string;
  readonly rounds: number;
  readonly decisions: readonly Readonly<{
    round: number;
    formation: string;
    mentality: string;
    attackDirection: string;
    marking: string;
  }>[];
  readonly proxies: Readonly<{
    scorelineDiversity: number;
    eventTypeDiversity: number;
    changedOutcomesVersusBalanced: number;
    maximumConditionDelta: number;
    maximumMoraleDelta: number;
    maximumInjuryRounds: number;
    maximumSuspensionRounds: number;
  }>;
  readonly failures: readonly string[];
  readonly passed: boolean;
}
export function runPlaythrough(rounds = 14): PlaythroughReport {
  if (!Number.isSafeInteger(rounds) || rounds < 10 || rounds > 14)
    throw new Error('Playthrough requires 10 to 14 rounds');
  const seed = `${SEASON_SEED_VERSION}|adversarial`;
  const tacticForRound = (round: number): Tactic =>
    DECISIONS[(round - 1) % DECISIONS.length] ?? tacticFactory();
  const tactical = runSeason({ seed, controlledClubIndex: 7, tacticForRound });
  const balanced = runSeason({
    seed,
    controlledClubIndex: 7,
    tacticForRound: () => tacticFactory(),
  });
  const decisions = Array.from({ length: rounds }, (_, index) => {
    const tactic = tacticForRound(index + 1);
    return {
      round: index + 1,
      formation: tactic.formation,
      mentality: tactic.mentality,
      attackDirection: tactic.attackDirection,
      marking: tactic.marking,
    };
  });
  const tacticalRows = tactical.standings;
  const balancedRows = balanced.standings;
  const changedOutcomesVersusBalanced = tacticalRows.filter((row, index) => {
    const baseline = balancedRows[index];
    return (
      baseline?.clubId !== row.clubId ||
      baseline.points !== row.points ||
      baseline.goalDifference !== row.goalDifference
    );
  }).length;
  const proxies = {
    scorelineDiversity: tactical.scorelines.length,
    eventTypeDiversity: tactical.eventTypes.length,
    changedOutcomesVersusBalanced,
    maximumConditionDelta: tactical.maximumConditionDelta,
    maximumMoraleDelta: tactical.maximumMoraleDelta,
    maximumInjuryRounds: tactical.maximumInjuryRounds,
    maximumSuspensionRounds: tactical.maximumSuspensionRounds,
  };
  const failures: string[] = [];
  if (!tactical.passed || !balanced.passed)
    failures.push('season invariant failed');
  if (tactical.scorelines.length < 5)
    failures.push('scoreline variation is below five distinct scores');
  if (tactical.eventTypes.length < 4)
    failures.push('event variation is below four event types');
  if (changedOutcomesVersusBalanced < 1)
    failures.push('tactical choices produced no measurable table change');
  if (
    tactical.maximumConditionDelta > 92 ||
    tactical.maximumMoraleDelta > 75 ||
    tactical.maximumInjuryRounds > 4 ||
    tactical.maximumSuspensionRounds > 1
  )
    failures.push('player-state consequence exceeded its bounded range');
  return {
    schemaVersion: PLAYTHROUGH_REPORT_VERSION,
    seed,
    rounds,
    decisions,
    proxies,
    failures,
    passed: failures.length === 0,
  };
}
export function playthroughOutput(rounds = 14): string {
  return canonicalJson(runPlaythrough(rounds));
}

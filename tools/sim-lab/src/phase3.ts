import {
  canonicalJson,
  createMatchInput,
  createTactic,
  type MatchInstruction,
} from '@footebas/domain';
import {
  autoSelectLineup,
  prepareMatch,
  simulateMatch,
  type AutoLineupMode,
} from '@footebas/engine';
import { matchInputFactory } from '@footebas/testing';

export const PHASE_THREE_PLAYTHROUGH_VERSION =
  'phase-three-playthrough-v1' as const;
const MODES: readonly AutoLineupMode[] = ['best', 'rest', 'develop'];

export interface PhaseThreePlaythroughReport {
  readonly schemaVersion: typeof PHASE_THREE_PLAYTHROUGH_VERSION;
  readonly rounds: number;
  readonly decisions: readonly Readonly<{
    round: number;
    lineupMode: AutoLineupMode;
    information: readonly [
      'opponent',
      'form',
      'approximateStrength',
      'absences',
    ];
    reproduced: boolean;
    changedVersusNoIntervention: boolean;
  }>[];
  readonly failures: readonly string[];
  readonly passed: boolean;
}

export function runPhaseThreePlaythrough(
  rounds = 14,
): PhaseThreePlaythroughReport {
  if (!Number.isSafeInteger(rounds) || rounds < 10 || rounds > 14)
    throw new Error('Phase three playthrough requires 10 to 14 rounds');
  const failures: string[] = [];
  const form: ('W' | 'D' | 'L')[] = [];
  const decisions = Array.from({ length: rounds }, (_, index) => {
    const round = index + 1;
    const lineupMode = MODES[index % MODES.length] ?? 'best';
    const raw = matchInputFactory({
      seed: `phase-three-round-${String(round)}`,
      homeStrength: 68 + (index % 5),
      awayStrength: 70 + ((index * 3) % 7),
    });
    const lineup = autoSelectLineup({
      club: raw.home.club,
      players: raw.home.players,
      formation: raw.home.tactic.formation,
      mode: lineupMode,
    });
    const baselineInput = createMatchInput({
      ...raw,
      home: { ...raw.home, lineup },
      instructions: [],
    });
    const preparation = prepareMatch(baselineInput, 'home', form);
    const outgoing = lineup.starters.at(-1);
    const incoming = lineup.substitutes[0];
    if (!outgoing || !incoming)
      throw new Error('phase three fixture must contain starters and bench');
    const instructions: readonly MatchInstruction[] = [
      {
        type: 'tactical_change',
        minute: 45,
        side: 'home',
        tactic: createTactic({
          ...raw.home.tactic,
          mentality: index % 2 === 0 ? 'all_out_attack' : 'counter_attack',
          press: index % 2 === 0 ? 'high' : 'low',
        }),
      },
      {
        type: 'substitution',
        minute: 60,
        side: 'home',
        playerOutId: outgoing.playerId,
        playerInId: incoming,
        position: outgoing.position,
      },
    ];
    const decisionInput = createMatchInput({ ...baselineInput, instructions });
    const baseline = simulateMatch(baselineInput);
    const changed = simulateMatch(decisionInput);
    const replay = simulateMatch(decisionInput);
    const reproduced = canonicalJson(changed) === canonicalJson(replay);
    const changedVersusNoIntervention =
      canonicalJson(changed) !== canonicalJson(baseline);
    if (!reproduced) failures.push(`round ${String(round)} did not reproduce`);
    if (!changedVersusNoIntervention)
      failures.push(`round ${String(round)} ignored decisions`);
    if (
      preparation.opponent.id.length === 0 ||
      preparation.recentForm.length > 5
    )
      failures.push(`round ${String(round)} lacks decision information`);
    form.push(
      changed.homeGoals > changed.awayGoals
        ? 'W'
        : changed.homeGoals < changed.awayGoals
          ? 'L'
          : 'D',
    );
    return {
      round,
      lineupMode,
      information: [
        'opponent',
        'form',
        'approximateStrength',
        'absences',
      ] as const,
      reproduced,
      changedVersusNoIntervention,
    };
  });
  return {
    schemaVersion: PHASE_THREE_PLAYTHROUGH_VERSION,
    rounds,
    decisions,
    failures,
    passed: failures.length === 0,
  };
}

export function phaseThreePlaythroughOutput(rounds = 14): string {
  return canonicalJson(runPhaseThreePlaythrough(rounds));
}

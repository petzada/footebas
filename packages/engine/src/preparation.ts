import type { MatchInput, MatchSide, PlayerId } from '@footebas/domain';
import { calculateEffectiveStrength } from './match.js';

export type ApproximateStrength =
  'much_weaker' | 'weaker' | 'similar' | 'stronger' | 'much_stronger';
export interface MatchPreparation {
  readonly opponent: Readonly<{ id: string; name: string; shortName: string }>;
  readonly venue: 'home' | 'away';
  readonly recentForm: readonly ('W' | 'D' | 'L')[];
  readonly approximateStrength: ApproximateStrength;
  readonly absences: readonly Readonly<{
    playerId: PlayerId;
    playerName: string;
    reason: 'injury' | 'suspension';
    rounds: number;
  }>[];
}

export function prepareMatch(
  input: MatchInput,
  managedSide: MatchSide,
  recentForm: readonly ('W' | 'D' | 'L')[] = [],
): MatchPreparation {
  const managed = input[managedSide];
  const opponent = input[managedSide === 'home' ? 'away' : 'home'];
  const difference =
    calculateEffectiveStrength(opponent).average -
    calculateEffectiveStrength(managed).average;
  const approximateStrength: ApproximateStrength =
    difference < -7
      ? 'much_weaker'
      : difference < -2
        ? 'weaker'
        : difference <= 2
          ? 'similar'
          : difference <= 7
            ? 'stronger'
            : 'much_stronger';
  return Object.freeze({
    opponent: Object.freeze({
      id: opponent.club.id,
      name: opponent.club.name,
      shortName: opponent.club.shortName,
    }),
    venue: managedSide,
    recentForm: Object.freeze(recentForm.slice(-5)),
    approximateStrength,
    absences: Object.freeze(
      opponent.players
        .filter(
          (player) => player.injuryRounds > 0 || player.suspensionRounds > 0,
        )
        .map((player) =>
          Object.freeze({
            playerId: player.id,
            playerName: player.name,
            reason:
              player.injuryRounds > 0
                ? ('injury' as const)
                : ('suspension' as const),
            rounds: Math.max(player.injuryRounds, player.suspensionRounds),
          }),
        ),
    ),
  });
}

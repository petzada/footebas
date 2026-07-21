import {
  DomainError,
  FORMATION_POSITIONS,
  createLineup,
  type Club,
  type Formation,
  type Lineup,
  type Player,
  type Position,
} from '@footebas/domain';

export const AUTO_LINEUP_MODES = ['best', 'rest', 'develop'] as const;
export type AutoLineupMode = (typeof AUTO_LINEUP_MODES)[number];

function fit(player: Player, position: Position): number {
  if (player.position === position) return 1;
  if (player.secondaryPositions.includes(position)) return 0.92;
  if (player.position === 'GK' || position === 'GK') return 0.35;
  return 0.72;
}

function score(
  player: Player,
  position: Position,
  mode: AutoLineupMode,
): number {
  const suitability = fit(player, position);
  const strength = Number(player.strength);
  const condition = Number(player.condition);
  const sharpness = Number(player.matchSharpness);
  if (mode === 'rest')
    return suitability * (strength * 0.42 + condition * 0.48 + sharpness * 0.1);
  if (mode === 'develop') {
    const ageBonus = Math.max(0, 25 - player.age);
    return (
      suitability *
      (strength * 0.35 +
        Number(player.hidden.potential) * 0.35 +
        sharpness * 0.15 +
        ageBonus * 1.5 +
        condition * 0.15)
    );
  }
  return (
    suitability *
    (strength * 0.68 +
      condition * 0.18 +
      sharpness * 0.1 +
      Number(player.morale) * 0.04)
  );
}

export interface AutoLineupInput {
  readonly club: Club;
  readonly players: readonly Player[];
  readonly formation: Formation;
  readonly mode: AutoLineupMode;
  readonly benchSize?: number;
}

/** Stable greedy selector. Equal candidates are always resolved by player ID. */
export function autoSelectLineup(input: AutoLineupInput): Lineup {
  const members = input.players
    .filter(
      (player) =>
        player.clubId === input.club.id && input.club.squad.includes(player.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const available = members.filter(
    (player) => player.injuryRounds === 0 && player.suspensionRounds === 0,
  );
  if (available.length < 11)
    throw new DomainError(
      'INVALID_ENTITY',
      'club has fewer than eleven available players',
    );
  const used = new Set<string>();
  const starters = FORMATION_POSITIONS[input.formation].map((position) => {
    const player = available
      .filter(({ id }) => !used.has(id))
      .sort(
        (left, right) =>
          score(right, position, input.mode) -
            score(left, position, input.mode) ||
          left.id.localeCompare(right.id),
      )[0];
    if (!player)
      throw new DomainError('INVALID_ENTITY', `cannot fill ${position}`);
    used.add(player.id);
    return { playerId: player.id, position };
  });
  const remainder = available
    .filter(({ id }) => !used.has(id))
    .sort(
      (left, right) =>
        score(right, right.position, input.mode) -
          score(left, left.position, input.mode) ||
        left.id.localeCompare(right.id),
    );
  const benchSize = Math.max(0, Math.min(12, input.benchSize ?? 7));
  const goalkeeper = remainder.find(({ position }) => position === 'GK');
  const bench = [
    ...(goalkeeper ? [goalkeeper] : []),
    ...remainder.filter(({ id }) => id !== goalkeeper?.id),
  ].slice(0, benchSize);
  const benchIds = new Set(bench.map(({ id }) => id));
  const captain = starters
    .map(({ playerId }) => available.find(({ id }) => id === playerId))
    .filter((player): player is Player => player !== undefined)
    .sort(
      (left, right) =>
        right.age - left.age ||
        Number(right.strength) - Number(left.strength) ||
        left.id.localeCompare(right.id),
    )[0];
  if (!captain)
    throw new DomainError(
      'INVALID_ENTITY',
      'auto lineup has no captain candidate',
    );
  return createLineup({
    clubId: input.club.id,
    starters,
    substitutes: bench.map(({ id }) => id),
    reserves: members
      .filter(({ id }) => !used.has(id) && !benchIds.has(id))
      .map(({ id }) => id),
    captainId: captain.id,
  });
}

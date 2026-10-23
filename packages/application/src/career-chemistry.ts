/**
 * Chemistry (entrosamento, docs/09 decision 16, ADR 0010 item 6, ADR 0011):
 * grows while the managed club fields the same starters and drops when many
 * change. It becomes a small, capped effective-strength bonus that the
 * application applies before the match engine; the engine never reads it.
 */
import type { Player } from '@footebas/domain';
import type { CareerWorldState } from './career-world-rules.js';
import { officeOf, readOffice } from './career-office.js';

export interface ChemistryState {
  /** 0 to 100. */
  value: number;
  /** Starters of the last managed match. */
  starters: string[];
  /** Managed matches counted. */
  matches: number;
}

/** Value of a club the manager has just taken over. */
export const CHEMISTRY_START = 50;
/** Gain per match when at most `CHEMISTRY_TOLERATED_CHANGES` starters change. */
export const CHEMISTRY_GAIN = 5;
/** Loss per changed starter beyond the tolerated ones. */
export const CHEMISTRY_CHANGE_PENALTY = 3;
export const CHEMISTRY_TOLERATED_CHANGES = 1;
/** Effective-strength bonus at chemistry 100 (linear from 0). */
export const CHEMISTRY_MAX_BONUS = 0.03;

/** Chemistry change after one match with `changes` new starters. */
export function chemistryDelta(changes: number): number {
  return (
    CHEMISTRY_GAIN -
    CHEMISTRY_CHANGE_PENALTY *
      Math.max(0, changes - CHEMISTRY_TOLERATED_CHANGES)
  );
}

export function startersChanged(
  previous: readonly string[],
  current: readonly string[],
): number {
  if (previous.length === 0) return 0;
  const before = new Set(previous);
  return current.filter((id) => !before.has(id)).length;
}

/** Next state after a match; the first match only records the starters. */
export function nextChemistry(
  state: ChemistryState | undefined,
  starters: readonly string[],
): ChemistryState {
  const current = state ?? {
    value: CHEMISTRY_START,
    starters: [],
    matches: 0,
  };
  const delta =
    current.starters.length === 0
      ? 0
      : chemistryDelta(startersChanged(current.starters, starters));
  return {
    value: Math.max(0, Math.min(100, current.value + delta)),
    starters: [...starters],
    matches: current.matches + 1,
  };
}

/** Effective-strength multiplier: 1 to 1 + CHEMISTRY_MAX_BONUS. */
export function chemistryFactor(value: number): number {
  return 1 + (CHEMISTRY_MAX_BONUS * Math.max(0, Math.min(100, value))) / 100;
}

/** Bonus in percent with one decimal, as the read models show it. */
export function chemistryBonusPercent(value: number): number {
  return Math.round((chemistryFactor(value) - 1) * 1_000) / 10;
}

export function chemistryOf(
  world: Pick<CareerWorldState, 'office'>,
  clubId: string,
): ChemistryState {
  return (
    readOffice(world).chemistry[clubId] ?? {
      value: CHEMISTRY_START,
      starters: [],
      matches: 0,
    }
  );
}

/** Records one managed match; only the managed club keeps chemistry. */
export function recordChemistry(
  world: CareerWorldState,
  clubId: string,
  starters: readonly string[],
): void {
  const office = officeOf(world);
  const next = nextChemistry(office.chemistry[clubId], starters);
  office.chemistry = { [clubId]: next };
}

/**
 * Match-only copies with an effective-strength multiplier (Estrategista plan
 * and chemistry combined); never persisted. Integer strengths, 1 to 100.
 */
export function withStrengthFactor(
  players: readonly Player[],
  factor: number,
): Player[] {
  return players.map(
    (player) =>
      ({
        ...player,
        strength: Math.max(
          1,
          Math.min(100, Math.round(Number(player.strength) * factor)),
        ),
      }) as Player,
  );
}

/** Chemistry read model of the managed club with the saved lineup. */
export function chemistryView(
  world: Pick<CareerWorldState, 'office'>,
  clubId: string,
  lineupStarters: readonly string[] | undefined,
): {
  value: number;
  bonusPercent: number;
  matches: number;
  startersChanged: number;
} {
  const state = chemistryOf(world, clubId);
  return {
    value: state.value,
    bonusPercent: chemistryBonusPercent(state.value),
    matches: state.matches,
    startersChanged: startersChanged(state.starters, lineupStarters ?? []),
  };
}

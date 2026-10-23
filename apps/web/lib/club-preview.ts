import { CLUB_PREVIEWS } from '@/lib/club-previews';

export type PositionGroup = 'gk' | 'def' | 'mid' | 'att';

export interface ClubPreviewPlayer {
  readonly name: string;
  /** Catalog position code (GK, CB, CM, ST…). */
  readonly position: string;
  /** Derived strength (catalog), 1–100. */
  readonly strength: number;
  /** Research-backed standout status, when the catalog has one. */
  readonly level?: 'craque' | 'destaque';
}

export type ClubDivision = 'serie-a' | 'serie-b' | 'serie-c';

export const DIVISION_LABEL: Record<ClubDivision, string> = {
  'serie-a': 'Série A',
  'serie-b': 'Série B',
  'serie-c': 'Série C',
};

/** Free plan starts at the bottom (docs/05 §5): only Série C clubs. */
export const FREE_PLAN_DIVISION: ClubDivision = 'serie-c';

export interface ClubPreview {
  readonly id: string;
  readonly name: string;
  readonly division: ClubDivision;
  readonly note: string;
  readonly tier: string;
  readonly squadSize: number;
  /** Average of the 16 strongest players (derived). */
  readonly strength: number;
  readonly groups: readonly {
    readonly group: PositionGroup;
    readonly count: number;
    readonly highlights: readonly ClubPreviewPlayer[];
  }[];
}

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  gk: 'Goleiros',
  def: 'Defensores',
  mid: 'Meio-campistas',
  att: 'Atacantes',
};

const POSITION_LABEL: Record<string, string> = {
  GK: 'GOL',
  CB: 'ZAG',
  LB: 'LE',
  RB: 'LD',
  LWB: 'ALE',
  RWB: 'ALD',
  DM: 'VOL',
  CM: 'MC',
  AM: 'MEI',
  LM: 'ME',
  RM: 'MD',
  LW: 'PE',
  RW: 'PD',
  ST: 'CA',
  CF: 'SA',
};

export function positionLabel(code: string): string {
  return POSITION_LABEL[code] ?? code;
}

/** Clubs offered by the New Career flow, with squad previews. */
export function clubPreviews(): readonly ClubPreview[] {
  return CLUB_PREVIEWS;
}

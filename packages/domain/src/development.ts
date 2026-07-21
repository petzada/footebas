import { DomainError } from './errors.js';
import {
  createPlayer,
  type ClubId,
  type Player,
  type PlayerId,
} from './entities.js';
import { percentage, strength, type Position } from './values.js';

export interface RandomSource {
  /** Deterministic value in [0, 1). */
  next(): number;
}

export interface YouthProvenance {
  readonly kind: 'generated_youth';
  readonly generatorVersion: string;
  readonly seed: string;
  readonly ordinal: number;
  readonly derivedFromClubId: ClubId;
}

export interface YouthCandidate {
  readonly player: Player;
  readonly provenance: YouthProvenance;
  readonly estimate: 'limited' | 'promising' | 'exceptional';
  readonly status: 'academy' | 'promoted' | 'released';
}

const positions: readonly Position[] = [
  'GK',
  'RB',
  'CB',
  'LB',
  'DM',
  'CM',
  'AM',
  'RW',
  'LW',
  'ST',
];

export interface YouthGenerationInput {
  readonly clubId: ClubId;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly maximumCandidates: number;
  readonly existingCandidates: number;
  readonly currentSeason: number;
  readonly nextId: (kind: string) => string;
  readonly random: RandomSource;
}

/** Generated identities are visibly synthetic and always carry derivation provenance. */
export function generateYouthCandidates(
  input: YouthGenerationInput,
): readonly YouthCandidate[] {
  if (
    input.generatorVersion.trim().length === 0 ||
    input.seed.trim().length === 0 ||
    !Number.isInteger(input.maximumCandidates) ||
    input.maximumCandidates < 0 ||
    !Number.isInteger(input.existingCandidates) ||
    input.existingCandidates < 0
  )
    throw new DomainError('INVALID_VALUE', 'invalid youth generation input');
  const available = Math.max(
    0,
    input.maximumCandidates - input.existingCandidates,
  );
  const count = Math.min(3, available);
  const generated: YouthCandidate[] = [];
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const id = input.nextId('generated_youth') as PlayerId;
    const position =
      positions[Math.floor(input.random.next() * positions.length)] ?? 'CM';
    const age = 17 + Math.floor(input.random.next() * 4);
    const baseStrength = 28 + Math.floor(input.random.next() * 25);
    const potential = Math.min(
      95,
      baseStrength + 18 + Math.floor(input.random.next() * 30),
    );
    const provenance: YouthProvenance = Object.freeze({
      kind: 'generated_youth',
      generatorVersion: input.generatorVersion,
      seed: input.seed,
      ordinal,
      derivedFromClubId: input.clubId,
    });
    const player = createPlayer({
      id,
      name: `Jovem gerado ${String(input.currentSeason)}-${String(ordinal + 1)}`,
      age,
      position,
      secondaryPositions: [],
      strength: strength(baseStrength),
      traits: [],
      hidden: {
        potential: percentage(potential),
        consistency: percentage(35 + Math.floor(input.random.next() * 50)),
        injuryProneness: percentage(5 + Math.floor(input.random.next() * 35)),
        adaptation: percentage(40 + Math.floor(input.random.next() * 51)),
        professionalism: percentage(35 + Math.floor(input.random.next() * 61)),
        bigGame: percentage(30 + Math.floor(input.random.next() * 61)),
      },
      morale: percentage(70),
      condition: percentage(100),
      matchSharpness: percentage(45),
      value: 0 as Player['value'],
      salary: 0 as Player['salary'],
      clubId: input.clubId,
      squadStatus: 'youth',
      injuryRounds: 0,
      suspensionRounds: 0,
      careerStats: {
        appearances: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      },
    });
    generated.push(
      Object.freeze({
        player,
        provenance,
        estimate:
          potential >= 85
            ? 'exceptional'
            : potential >= 70
              ? 'promising'
              : 'limited',
        status: 'academy',
      }),
    );
  }
  return Object.freeze(generated);
}

export function promoteYouth(
  candidate: YouthCandidate,
  squadSize: number,
  maximumSquadSize: number,
): YouthCandidate {
  if (candidate.status !== 'academy' || squadSize >= maximumSquadSize)
    throw new DomainError(
      'INVALID_ENTITY',
      'youth candidate cannot be promoted',
    );
  return Object.freeze({
    ...candidate,
    player: createPlayer({ ...candidate.player, squadStatus: 'backup' }),
    status: 'promoted',
  });
}

export function releaseYouth(candidate: YouthCandidate): YouthCandidate {
  if (candidate.status !== 'academy')
    throw new DomainError(
      'INVALID_ENTITY',
      'only academy candidates can be released',
    );
  const { clubId: _clubId, ...freePlayer } = candidate.player;
  void _clubId;
  return Object.freeze({
    ...candidate,
    player: createPlayer({ ...freePlayer, squadStatus: 'youth' }),
    status: 'released',
  });
}

export type DevelopmentOutcome =
  'evolved' | 'stagnated' | 'declined' | 'retired';
export interface DevelopmentResult {
  readonly player: Player;
  readonly outcome: DevelopmentOutcome;
  readonly strengthDelta: number;
  readonly replacementRequired: boolean;
}

export interface DevelopmentContext {
  readonly usefulMinutes: number;
  readonly developmentQuality: number;
  readonly random: RandomSource;
}

/** One bounded annual step; strength never moves by more than three points. */
export function developPlayer(
  player: Player,
  context: DevelopmentContext,
): DevelopmentResult {
  if (
    context.usefulMinutes < 0 ||
    context.developmentQuality < 0 ||
    context.developmentQuality > 100
  )
    throw new DomainError('INVALID_VALUE', 'invalid development context');
  const retirementChance =
    player.age < 34 ? 0 : Math.min(0.85, 0.08 + (player.age - 34) * 0.1);
  if (context.random.next() < retirementChance)
    return Object.freeze({
      player,
      outcome: 'retired',
      strengthDelta: 0,
      replacementRequired: true,
    });
  const growthWindow = player.age <= 24;
  const declineWindow = player.age >= 31;
  const headroom = Number(player.hidden.potential) - Number(player.strength);
  const minutes = Math.min(1, context.usefulMinutes / 2_500);
  const professionalism = Number(player.hidden.professionalism) / 100;
  const variation = context.random.next();
  let delta = 0;
  if (growthWindow && headroom > 0) {
    const score =
      minutes * 0.35 +
      context.developmentQuality / 300 +
      professionalism * 0.25 +
      variation * 0.1;
    delta =
      score >= 0.75
        ? Math.min(3, Math.max(1, Math.ceil(headroom / 15)))
        : score >= 0.55
          ? 1
          : 0;
  } else if (declineWindow) {
    const decline =
      (player.age - 30) / 12 + (1 - professionalism) * 0.25 + variation * 0.2;
    delta = decline >= 0.7 ? -2 : decline >= 0.35 ? -1 : 0;
  }
  delta = Math.max(-3, Math.min(3, delta));
  const nextStrength = Math.max(
    1,
    Math.min(100, Number(player.strength) + delta),
  );
  return Object.freeze({
    player: createPlayer({
      ...player,
      age: player.age + 1,
      strength: strength(nextStrength),
    }),
    outcome: delta > 0 ? 'evolved' : delta < 0 ? 'declined' : 'stagnated',
    strengthDelta: delta,
    replacementRequired: false,
  });
}

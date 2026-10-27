import { DomainError } from './errors.js';
import {
  createPlayer,
  type ClubId,
  type Player,
  type PlayerId,
} from './entities.js';
import {
  percentage,
  strength,
  type PlayerTrait,
  type Position,
} from './values.js';

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
  /** "Jovem destaque" of an academy intake (peneira). */
  readonly highlight?: boolean;
  /** Game date the prospect joined the academy. */
  readonly joinedOn?: string;
  /** Strength when the prospect joined, to show the evolution. */
  readonly initialStrength?: number;
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

/** Prospects the academy keeps at once; a full academy skips the intake. */
export const ACADEMY_MAX_PROSPECTS = 14;
/** Youngest age a prospect can join the first team (docs/02 §2.3). */
export const ACADEMY_PROMOTION_MIN_AGE = 17;
/** Oldest age in the academy; older prospects leave at the season turn. */
export const ACADEMY_MAX_AGE = 20;

/** Position draw of an intake: centre-backs and strikers come more often. */
const intakePositions: readonly Position[] = [
  'GK',
  'CB',
  'CB',
  'RB',
  'LB',
  'DM',
  'CM',
  'CM',
  'AM',
  'RW',
  'LW',
  'ST',
  'ST',
];

/** The characteristics each position draws from (docs/02 §2.2). */
const traitsByPosition: Readonly<Record<Position, readonly PlayerTrait[]>> = {
  GK: ['positioning', 'aerial_command', 'reflexes', 'penalty_saving'],
  RB: ['pace', 'crossing', 'marking', 'tackling'],
  LB: ['pace', 'crossing', 'marking', 'tackling'],
  CB: ['heading', 'marking', 'tackling'],
  DM: ['marking', 'tackling', 'passing'],
  CM: ['passing', 'playmaking', 'tackling'],
  AM: ['playmaking', 'passing', 'finishing'],
  RW: ['pace', 'crossing', 'finishing'],
  LW: ['pace', 'crossing', 'finishing'],
  ST: ['finishing', 'heading', 'pace'],
};

const firstNames = [
  'Arthur',
  'Bernardo',
  'Caio',
  'Cauã',
  'Davi',
  'Diego',
  'Enzo',
  'Erick',
  'Felipe',
  'Gabriel',
  'Gustavo',
  'Heitor',
  'Igor',
  'Isaque',
  'João',
  'Juan',
  'Kaique',
  'Kauã',
  'Leandro',
  'Luan',
  'Lucas',
  'Marcos',
  'Matheus',
  'Miguel',
  'Murilo',
  'Natan',
  'Otávio',
  'Pedro',
  'Rafael',
  'Renan',
  'Ruan',
  'Samuel',
  'Thiago',
  'Vinícius',
  'Vitor',
  'Wesley',
  'Yuri',
] as const;

const surnames = [
  'Almeida',
  'Andrade',
  'Barbosa',
  'Batista',
  'Cardoso',
  'Carvalho',
  'Correia',
  'Costa',
  'Dias',
  'Duarte',
  'Farias',
  'Ferreira',
  'Freitas',
  'Gomes',
  'Lacerda',
  'Lima',
  'Lopes',
  'Macedo',
  'Marques',
  'Medeiros',
  'Monteiro',
  'Moraes',
  'Nascimento',
  'Nogueira',
  'Pereira',
  'Pinheiro',
  'Queiroz',
  'Ramos',
  'Rezende',
  'Rocha',
  'Sales',
  'Santana',
  'Siqueira',
  'Soares',
  'Teixeira',
  'Vasconcelos',
  'Vieira',
] as const;

const pick = <T>(items: readonly T[], random: RandomSource): T =>
  (items[Math.floor(random.next() * items.length)] ?? items[0]) as T;

export const youthEstimate = (potential: number): YouthCandidate['estimate'] =>
  potential >= 85 ? 'exceptional' : potential >= 72 ? 'promising' : 'limited';

export interface AcademyIntakeInput {
  readonly clubId: ClubId;
  /** Club reputation: bigger clubs scout better kids. */
  readonly reputation: number;
  readonly count: number;
  readonly joinedOn: string;
  readonly seed: string;
  readonly generatorVersion: string;
  /** Extra potential points (the coach style tilts youth, ADR 0007). */
  readonly potentialBonus?: number;
  readonly nextId: (kind: string) => string;
  readonly random: RandomSource;
}

/**
 * One academy intake (peneira): kids of 16 to 18 with a name, a position,
 * one or two characteristics of that position and a hidden potential. The
 * first kid of every intake is its "jovem destaque", with clearly higher
 * potential; a big club may find a second one.
 */
export function generateAcademyIntake(
  input: AcademyIntakeInput,
): readonly YouthCandidate[] {
  if (
    input.generatorVersion.trim().length === 0 ||
    input.seed.trim().length === 0 ||
    !Number.isInteger(input.count) ||
    input.count < 0
  )
    throw new DomainError('INVALID_VALUE', 'invalid academy intake input');
  const bonus = Math.max(0, Math.min(10, input.potentialBonus ?? 0));
  const generated: YouthCandidate[] = [];
  for (let ordinal = 0; ordinal < input.count; ordinal++) {
    const random = input.random;
    const highlight =
      ordinal === 0 ||
      (ordinal === 1 && random.next() < input.reputation / 250);
    const position = pick(intakePositions, random);
    const age = 16 + Math.floor(random.next() * 3);
    const baseStrength = Math.round(
      22 + input.reputation * 0.32 + random.next() * 12 + (highlight ? 3 : 0),
    );
    const potential = Math.min(
      95,
      highlight
        ? Math.max(
            baseStrength + 20,
            78 + Math.floor(random.next() * 12) + bonus,
          )
        : baseStrength + 12 + Math.floor(random.next() * 26) + bonus,
    );
    const pool = traitsByPosition[position];
    const first = pick(pool, random);
    const second = pick(
      pool.filter((trait) => trait !== first),
      random,
    );
    const traits = random.next() < 0.55 ? [first, second] : [first];
    const name = `${pick(firstNames, random)} ${pick(surnames, random)}`;
    const player = createPlayer({
      id: input.nextId('academy_youth') as PlayerId,
      name,
      age,
      position,
      secondaryPositions: [],
      strength: strength(Math.max(1, Math.min(100, baseStrength))),
      traits,
      hidden: {
        potential: percentage(potential),
        consistency: percentage(35 + Math.floor(random.next() * 50)),
        injuryProneness: percentage(5 + Math.floor(random.next() * 35)),
        adaptation: percentage(40 + Math.floor(random.next() * 51)),
        professionalism: percentage(
          (highlight ? 55 : 35) + Math.floor(random.next() * 41),
        ),
        bigGame: percentage(30 + Math.floor(random.next() * 61)),
      },
      morale: percentage(75),
      condition: percentage(100),
      matchSharpness: percentage(40),
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
        provenance: Object.freeze({
          kind: 'generated_youth' as const,
          generatorVersion: input.generatorVersion,
          seed: input.seed,
          ordinal,
          derivedFromClubId: input.clubId,
        }),
        estimate: youthEstimate(potential),
        status: 'academy' as const,
        ...(highlight ? { highlight: true } : {}),
        joinedOn: input.joinedOn,
        initialStrength: Number(player.strength),
      }),
    );
  }
  return Object.freeze(generated);
}

/**
 * One month of academy training: the kid may gain a strength point, more
 * likely with room to grow, professionalism and a good development
 * quality (60 is the base every club gets). Never passes the potential.
 */
export function trainAcademyProspect(
  candidate: YouthCandidate,
  roll: number,
  developmentQuality: number,
): YouthCandidate {
  if (candidate.status !== 'academy') return candidate;
  const current = Number(candidate.player.strength);
  const headroom = Number(candidate.player.hidden.potential) - current;
  if (headroom <= 0) return candidate;
  const chance = Math.min(
    0.85,
    (0.08 +
      headroom / 120 +
      Number(candidate.player.hidden.professionalism) / 700) *
      (Math.max(0, Math.min(100, developmentQuality)) / 60),
  );
  if (roll >= chance) return candidate;
  return Object.freeze({
    ...candidate,
    player: createPlayer({
      ...candidate.player,
      strength: strength(Math.min(100, current + 1)),
    }),
  });
}

/** A season turn in the academy: one year older. */
export function ageAcademyProspect(candidate: YouthCandidate): YouthCandidate {
  if (candidate.status !== 'academy') return candidate;
  return Object.freeze({
    ...candidate,
    player: createPlayer({
      ...candidate.player,
      age: Math.min(60, candidate.player.age + 1),
    }),
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

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions -- laboratory cohorts have validated cardinality; numeric template segments are canonical */
import { loadCatalog, type ContentCatalog } from '@footebas/content';
import {
  createClub,
  createMatchInput,
  createPlayer,
  createTactic,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type MatchEvent,
  type MatchInput,
  type MatchResult,
  type Player,
  type Position,
} from '@footebas/domain';
import * as engine from '@footebas/engine';

/**
 * Variance report of the match engine (ADR 0015). Plays every Série A and
 * Série B double round robin of the launch catalog for several career seeds,
 * mirroring how the application builds match inputs, and measures how varied
 * the matches feel: scorelines, who decides, event sequences, narration,
 * event minutes and pre-match expectations.
 */
export const VARIANCE_REPORT_VERSION = 'match-variance-report-v1' as const;

const SECONDARY: Readonly<Record<Position, readonly Position[]>> = {
  GK: [],
  CB: ['DM'],
  LB: ['LW'],
  RB: ['RW'],
  DM: ['CM'],
  CM: ['AM'],
  AM: ['CM'],
  LW: ['ST'],
  RW: ['ST'],
  ST: ['AM'],
};

interface LabClub {
  readonly club: Club;
  readonly players: readonly Player[];
  readonly division: 'serie-a' | 'serie-b';
}

function labClubs(catalog: ContentCatalog): readonly LabClub[] {
  return catalog.clubs
    .filter(
      (club) => club.division === 'serie-a' || club.division === 'serie-b',
    )
    .map((club) => {
      const roster = catalog.players
        .filter(({ clubId }) => clubId === club.id)
        .sort(
          (left, right) =>
            right.derived.strength - left.derived.strength ||
            left.id.localeCompare(right.id),
        );
      const clubId = entityId(club.id, 'club');
      const players = roster.map((player) =>
        createPlayer({
          id: entityId(player.id, 'player'),
          name: player.name,
          age: player.derived.age,
          position: player.position,
          secondaryPositions: SECONDARY[player.position],
          strength: strength(player.derived.strength),
          traits: player.derived.traits,
          hidden: {
            potential: percentage(player.derived.potential),
            consistency: percentage(player.derived.consistency),
            injuryProneness: percentage(
              Math.round(player.derived.injuryProneness / 3),
            ),
            adaptation: percentage(player.derived.adaptation),
            professionalism: percentage(player.derived.professionalism),
            bigGame: percentage(player.derived.bigGame),
          },
          morale: percentage(70),
          condition: percentage(100),
          matchSharpness: percentage(75),
          value: money(1_000_000),
          salary: money(10_000),
          clubId,
          squadStatus: 'starter',
          injuryRounds: 0,
          suspensionRounds: 0,
          careerStats: {
            appearances: 0,
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
          },
        }),
      );
      return {
        club: createClub({
          id: clubId,
          name: club.name,
          shortName: club.shortName,
          squad: players.map(({ id }) => id),
          balance: money(0),
          reputation: percentage(70),
        }),
        players,
        division: club.division as 'serie-a' | 'serie-b',
      };
    });
}

const DEFAULT_TACTIC = createTactic({
  formation: '4-4-2',
  mentality: 'balanced',
  attackDirection: 'center',
  marking: 'heavy',
  buildUp: 'mixed',
  focus: 'balanced',
  press: 'medium',
  defensiveLine: 'normal',
  markingStyle: 'mixed',
});

function sideInput(entry: LabClub): MatchInput['home'] {
  return {
    club: entry.club,
    players: entry.players,
    tactic: DEFAULT_TACTIC,
    lineup: engine.autoSelectLineup({
      club: entry.club,
      players: entry.players,
      formation: '4-4-2',
      mode: 'best',
    }),
  };
}

// --- statistics helpers -------------------------------------------------------
const rounded = (value: number, digits = 3): number =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
const deviation = (values: readonly number[]): number => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
function entropy(counts: Iterable<number>): number {
  const list = [...counts];
  const total = list.reduce((a, b) => a + b, 0);
  return -list.reduce((sum, count) => {
    const p = count / total;
    return p === 0 ? sum : sum + p * Math.log2(p);
  }, 0);
}
function gini(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0 || sorted.length < 2) return 0;
  let weighted = 0;
  sorted.forEach((value, index) => (weighted += (index + 1) * value));
  return (
    (2 * weighted) / (sorted.length * total) -
    (sorted.length + 1) / sorted.length
  );
}
function hhi(values: readonly number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  return total === 0
    ? 0
    : values.reduce((sum, value) => sum + (value / total) ** 2, 0);
}
function poissonProbabilities(lambda: number, limit = 12): number[] {
  const result: number[] = [];
  let p = Math.exp(-lambda);
  for (let goals = 0; goals <= limit; goals += 1) {
    result.push(p);
    p = (p * lambda) / (goals + 1);
  }
  return result;
}
function homeWinProbability(home: number, away: number): number {
  const h = poissonProbabilities(home);
  const a = poissonProbabilities(away);
  let total = 0;
  h.forEach((ph, i) => a.forEach((pa, j) => (total += i > j ? ph * pa : 0)));
  return total;
}
const increment = <K>(map: Map<K, number>, key: K, by = 1) =>
  map.set(key, (map.get(key) ?? 0) + by);
const topShare = (map: Map<string, number>, total: number): number =>
  total === 0 ? 0 : Math.max(0, ...map.values()) / total;

// --- narration ----------------------------------------------------------------
type Narrator = (result: MatchResult, input: MatchInput) => readonly string[];

/** Replica of the narration the web adapter shipped before ADR 0015. */
const legacyNarration: Narrator = (result, input) => {
  const name = (side: 'home' | 'away', id: string) =>
    input[side].players.find((player) => player.id === id)?.name ?? 'um atleta';
  const club = (side: 'home' | 'away') => input[side].club.name;
  const lines: string[] = [];
  const pauses = [15, 30, 45, 60, 75];
  const flush = (minute: number) => {
    while (pauses[0] !== undefined && pauses[0] < minute)
      lines.push(`Pausa técnica aos ${pauses.shift()}'. Ajuste ou siga.`);
  };
  for (const event of result.timeline) {
    flush(event.minute);
    if (event.type === 'goal')
      lines.push(
        `GOL do ${club(event.side)}! ${name(event.side, event.scorerId)} marca.`,
      );
    else if (event.type === 'chance')
      lines.push(`${club(event.side)} finaliza (${event.xg.toFixed(2)} xG).`);
    else if (event.type === 'card')
      lines.push(
        `Cartão ${event.card === 'red' ? 'vermelho' : 'amarelo'} para ${name(event.side, event.playerId)}.`,
      );
    else if (event.type === 'injury')
      lines.push(
        `${name(event.side, event.playerId)} sente lesão (${club(event.side)}).`,
      );
    else if (event.type === 'substitution')
      lines.push(
        `${club(event.side)}: entra ${name(event.side, event.playerInId)}, sai ${name(event.side, event.playerOutId)}.`,
      );
    else lines.push(`${club(event.side)} muda para ${event.tactic.formation}.`);
  }
  flush(95);
  return lines;
};

interface EngineNarration {
  narrateMatch?: (
    result: MatchResult,
    context: {
      readonly home: Readonly<{ name: string }>;
      readonly away: Readonly<{ name: string }>;
      readonly playerNames: ReadonlyMap<string, string>;
    },
  ) => readonly Readonly<{ text: string }>[];
  calculateMatchExpectation?: (
    input: MatchInput,
  ) => Readonly<{ expectedGoals: Readonly<{ home: number; away: number }> }>;
}
const engineExtras = engine as unknown as EngineNarration;

function narratorFor(): { name: string; narrate: Narrator } {
  const narrate = engineExtras.narrateMatch;
  if (narrate === undefined)
    return { name: 'legacy web adapter templates', narrate: legacyNarration };
  return {
    name: 'engine narrateMatch',
    narrate: (result, input) =>
      narrate(result, {
        home: { name: input.home.club.name },
        away: { name: input.away.club.name },
        playerNames: new Map(
          [...input.home.players, ...input.away.players].map((player) => [
            player.id,
            player.name,
          ]),
        ),
      }).map(({ text }) => text),
  };
}

function maskLine(line: string, input: MatchInput): string {
  let masked = line;
  const names = [
    ...input.home.players.map(({ name }) => name),
    ...input.away.players.map(({ name }) => name),
    input.home.club.name,
    input.away.club.name,
  ].sort((a, b) => b.length - a.length);
  for (const name of names) masked = masked.split(name).join('§');
  return masked.replace(/\d+([.,]\d+)?/g, '#');
}

// --- report -------------------------------------------------------------------
export interface VarianceReport {
  readonly schemaVersion: typeof VARIANCE_REPORT_VERSION;
  readonly engineVersion: string;
  readonly narrator: string;
  readonly careers: number;
  readonly matches: number;
  readonly metrics: Readonly<Record<string, number | string>>;
  readonly scorelines: readonly (readonly [string, number])[];
  readonly goalMinuteBuckets: readonly number[];
  readonly eventMinuteBuckets: readonly number[];
  readonly playMix: readonly (readonly [string, number])[];
}

function doubleRoundRobin(ids: readonly number[]): [number, number][][] {
  const list = [...ids];
  if (list.length % 2 === 1) list.push(-1);
  const rounds: [number, number][][] = [];
  const n = list.length;
  for (let round = 0; round < n - 1; round += 1) {
    const games: [number, number][] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = list[i]!;
      const b = list[n - 1 - i]!;
      if (a >= 0 && b >= 0) games.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    list.splice(1, 0, list.pop()!);
  }
  return [
    ...rounds,
    ...rounds.map((games) => games.map(([a, b]) => [b, a] as [number, number])),
  ];
}

export function runVarianceReport(careers = 10): VarianceReport {
  const clubs = labClubs(loadCatalog());
  const narrator = narratorFor();
  const scorelines = new Map<string, number>();
  const similarScorelines = new Map<string, number>();
  const goalBuckets = Array.from({ length: 7 }, () => 0);
  const eventBuckets = Array.from({ length: 7 }, () => 0);
  const goalMinutes = new Map<number, number>();
  const trigrams = new Map<string, number>();
  const openings = new Map<string, number>();
  const playMix = new Map<string, number>();
  const lines = new Map<string, number>();
  const templates = new Map<string, number>();
  const goalTemplates = new Map<string, number>();
  const chanceTemplates = new Map<string, number>();
  let narrated = 0;
  let narratedGoals = 0;
  let narratedChances = 0;
  let withinRepeats = 0;
  let matches = 0;
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  let firstHalfGoals = 0;
  let automaticStops = 0;
  // club key -> player -> goals (per career season)
  const scorers = new Map<string, Map<string, number>>();
  const participation = new Map<string, Map<string, number>>();
  const lineupIds = new Map<string, Set<string>>();
  const pairingExpectations = new Map<string, number[]>();
  const pairingRealized = new Map<string, number[]>();
  const similarWinProbabilities: number[] = [];
  const bucket = (minute: number) => Math.min(6, Math.floor((minute - 1) / 15));

  for (let career = 0; career < careers; career += 1) {
    const careerSeed = `variance-career-${career}`;
    for (const division of ['serie-a', 'serie-b'] as const) {
      const members = clubs.filter((club) => club.division === division);
      doubleRoundRobin(members.map((_, index) => index)).forEach(
        (games, round) => {
          for (const [h, a] of games) {
            const home = members[h]!;
            const away = members[a]!;
            const fixtureId = `fixture_${division.replace('-', '_')}_r${round + 1}_${home.club.id}_${away.club.id}`;
            const input = createMatchInput({
              fixtureId: entityId(fixtureId, 'fixture'),
              seed: `${careerSeed}:${fixtureId}`,
              engineVersion: engine.ENGINE_VERSION,
              rulesVersion: 'rules-v1',
              home: sideInput(home),
              away: sideInput(away),
            });
            const result = engine.simulateMatch(input);
            matches += 1;
            goals += result.homeGoals + result.awayGoals;
            if (result.homeGoals > result.awayGoals) homeWins += 1;
            if (result.homeGoals === result.awayGoals) draws += 1;
            const scoreline = `${result.homeGoals}-${result.awayGoals}`;
            increment(scorelines, scoreline);
            const homeStrength = engine.calculateEffectiveStrength(
              input.home,
            ).average;
            const awayStrength = engine.calculateEffectiveStrength(
              input.away,
            ).average;
            const similar = Math.abs(homeStrength - awayStrength) < 2;
            if (similar) increment(similarScorelines, scoreline);
            const expectation =
              engineExtras.calculateMatchExpectation?.(input).expectedGoals ??
              engine.calculateMatchup(input).expectedGoals;
            const pairing = `${home.club.id}|${away.club.id}`;
            pairingExpectations.set(pairing, [
              ...(pairingExpectations.get(pairing) ?? []),
              expectation.home,
            ]);
            pairingRealized.set(pairing, [
              ...(pairingRealized.get(pairing) ?? []),
              result.home.xg,
            ]);
            if (similar)
              similarWinProbabilities.push(
                homeWinProbability(expectation.home, expectation.away),
              );
            const tokens: string[] = [];
            for (const event of result.timeline) {
              eventBuckets[bucket(Math.max(1, event.minute))]! += 1;
              const play = (event as MatchEvent & { play?: string }).play;
              if (event.type === 'chance' || event.type === 'goal')
                increment(playMix, `${event.type}:${play ?? 'n/a'}`);
              // Key events only (chances are routine in both versions); goals carry their play type when the engine records one.
              if (event.type !== 'chance')
                tokens.push(
                  `${event.type}${play === undefined ? '' : `:${play}`}:${event.side}`,
                );
              const key = `${careerSeed}|${event.side === 'home' ? home.club.id : away.club.id}`;
              const add = (
                map: Map<string, Map<string, number>>,
                id: string,
              ) => {
                const inner = map.get(key) ?? new Map<string, number>();
                increment(inner, id);
                map.set(key, inner);
              };
              if (event.type === 'goal') {
                goalBuckets[bucket(event.minute)]! += 1;
                increment(goalMinutes, event.minute);
                if (event.minute <= 45) firstHalfGoals += 1;
                add(scorers, event.scorerId);
                add(participation, event.scorerId);
                if (event.assistId !== undefined)
                  add(participation, event.assistId);
              }
              const shooter = (event as MatchEvent & { playerId?: string })
                .playerId;
              if (event.type === 'chance' && shooter !== undefined)
                add(participation, shooter);
            }
            for (const [side, entry] of [
              ['home', home],
              ['away', away],
            ] as const) {
              const key = `${careerSeed}|${entry.club.id}`;
              const ids = lineupIds.get(key) ?? new Set<string>();
              input[side].lineup.starters.forEach(({ playerId }) =>
                ids.add(playerId),
              );
              lineupIds.set(key, ids);
            }
            for (let index = 0; index + 2 < tokens.length; index += 1)
              increment(trigrams, tokens.slice(index, index + 3).join(' > '));
            increment(openings, tokens.slice(0, 4).join(' > '));
            const narration = narrator.narrate(result, input);
            const seen = new Set<string>();
            for (const line of narration) {
              if (/^Pausa técnica/.test(line)) automaticStops += 1;
              const template = maskLine(line, input);
              narrated += 1;
              increment(lines, line);
              increment(templates, template);
              if (seen.has(template)) withinRepeats += 1;
              seen.add(template);
              if (/GOL/i.test(line)) {
                narratedGoals += 1;
                increment(goalTemplates, template);
              } else if (
                /finaliza|chut|cabece|bate|arremat|tenta|cruz/i.test(line)
              ) {
                narratedChances += 1;
                increment(chanceTemplates, template);
              }
            }
          }
        },
      );
    }
  }

  // Who decides: per club-season distribution over the players who started.
  const topScorerShares: number[] = [];
  const top2Shares: number[] = [];
  const scorerGinis: number[] = [];
  const scorerHhis: number[] = [];
  const participationGinis: number[] = [];
  const participationHhis: number[] = [];
  for (const [key, ids] of lineupIds) {
    const byPlayer = scorers.get(key) ?? new Map<string, number>();
    const involved = participation.get(key) ?? new Map<string, number>();
    const pool = [...new Set([...ids, ...byPlayer.keys(), ...involved.keys()])];
    const goalsList = pool.map((id) => byPlayer.get(id) ?? 0);
    const total = goalsList.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const sorted = [...goalsList].sort((a, b) => b - a);
      topScorerShares.push(sorted[0]! / total);
      top2Shares.push((sorted[0]! + (sorted[1] ?? 0)) / total);
    }
    scorerGinis.push(gini(goalsList));
    scorerHhis.push(hhi(goalsList));
    const participationList = pool.map((id) => involved.get(id) ?? 0);
    participationGinis.push(gini(participationList));
    participationHhis.push(hhi(participationList));
  }
  // Same top scorer in most careers?
  const clubTopScorers = new Map<string, Map<string, number>>();
  for (const [key, byPlayer] of scorers) {
    const club = key.split('|')[1]!;
    const best = [...byPlayer.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    if (!best) continue;
    const inner = clubTopScorers.get(club) ?? new Map<string, number>();
    increment(inner, best[0]);
    clubTopScorers.set(club, inner);
  }
  const sameTopScorer = mean(
    [...clubTopScorers.values()].map(
      (counts) => Math.max(...counts.values()) / careers,
    ),
  );
  const pairingSpread = mean(
    [...pairingExpectations.values()].map((values) => deviation(values)),
  );
  const pairingRealizedSpread = mean(
    [...pairingRealized.values()].map((values) => deviation(values)),
  );
  const totalTrigrams = [...trigrams.values()].reduce((a, b) => a + b, 0);
  const sortedScorelines = [...scorelines.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const similarTotal = [...similarScorelines.values()].reduce(
    (a, b) => a + b,
    0,
  );
  const metrics = {
    goalsPerMatch: rounded(goals / matches),
    homeWinRate: rounded(homeWins / matches),
    drawRate: rounded(draws / matches),
    scorelineEntropyBits: rounded(entropy(scorelines.values())),
    distinctScorelines: scorelines.size,
    mostCommonScoreline: sortedScorelines[0]![0],
    mostCommonScorelineShare: rounded(sortedScorelines[0]![1] / matches),
    similarStrengthMatches: similarTotal,
    similarScorelineEntropyBits: rounded(entropy(similarScorelines.values())),
    similarMostCommonScorelineShare: rounded(
      topShare(similarScorelines, similarTotal),
    ),
    topScorerShareOfTeamGoals: rounded(mean(topScorerShares)),
    topTwoScorersShareOfTeamGoals: rounded(mean(top2Shares)),
    sameTopScorerAcrossCareers: rounded(sameTopScorer),
    scorerGini: rounded(mean(scorerGinis)),
    scorerHhi: rounded(mean(scorerHhis)),
    participationGini: rounded(mean(participationGinis)),
    participationHhi: rounded(mean(participationHhis)),
    eventTrigramDistinctRatio: rounded(
      trigrams.size / Math.max(1, totalTrigrams),
      4,
    ),
    eventTrigramTopShare: rounded(topShare(trigrams, totalTrigrams), 4),
    distinctOpenings: openings.size,
    openingTopShare: rounded(topShare(openings, matches)),
    narrationLinesPerMatch: rounded(narrated / matches, 1),
    narrationDistinctTemplates: templates.size,
    narrationTemplateTopShare: rounded(topShare(templates, narrated)),
    narrationWithinMatchRepeatRate: rounded(
      withinRepeats / Math.max(1, narrated),
    ),
    goalNarrationTemplates: goalTemplates.size,
    goalNarrationTopShare: rounded(topShare(goalTemplates, narratedGoals)),
    chanceNarrationTemplates: chanceTemplates.size,
    chanceNarrationTopShare: rounded(
      topShare(chanceTemplates, narratedChances),
    ),
    automaticStopsPerMatchInNarration: rounded(automaticStops / matches, 2),
    firstHalfGoalShare: rounded(firstHalfGoals / Math.max(1, goals)),
    goalShareMinutes1to15: rounded(goalBuckets[0]! / Math.max(1, goals)),
    goalShareMinutes76plus: rounded(
      (goalBuckets[5]! + goalBuckets[6]!) / Math.max(1, goals),
    ),
    maxSingleMinuteGoalShare: rounded(
      topShare(
        new Map([...goalMinutes].map(([k, v]) => [String(k), v])),
        goals,
      ),
      4,
    ),
    prematchHomeXgSpreadSamePairing: rounded(pairingSpread, 4),
    realizedHomeXgSpreadSamePairing: rounded(pairingRealizedSpread, 4),
    similarPrematchHomeWinProbabilityStd: rounded(
      deviation(similarWinProbabilities),
      4,
    ),
    similarPrematchHomeWinProbabilityMean: rounded(
      mean(similarWinProbabilities),
      4,
    ),
  };
  return {
    schemaVersion: VARIANCE_REPORT_VERSION,
    engineVersion: engine.ENGINE_VERSION,
    narrator: narrator.name,
    careers,
    matches,
    metrics,
    scorelines: sortedScorelines
      .slice(0, 12)
      .map(([k, v]) => [k, rounded(v / matches)] as const),
    goalMinuteBuckets: goalBuckets.map((value) =>
      rounded(value / Math.max(1, goals)),
    ),
    eventMinuteBuckets: eventBuckets.map((value) =>
      rounded(
        value /
          Math.max(
            1,
            eventBuckets.reduce((a, b) => a + b, 0),
          ),
      ),
    ),
    playMix: [...playMix.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, v] as const),
  };
}

const LABELS: Readonly<Record<string, string>> = {
  goalsPerMatch: 'Gols por partida',
  homeWinRate: 'Vitórias do mandante',
  drawRate: 'Empates',
  scorelineEntropyBits: 'Entropia dos placares (bits)',
  distinctScorelines: 'Placares distintos',
  mostCommonScoreline: 'Placar mais comum',
  mostCommonScorelineShare: '% do placar mais comum',
  similarStrengthMatches: 'Partidas de força parecida (diferença < 2)',
  similarScorelineEntropyBits: 'Entropia dos placares, força parecida',
  similarMostCommonScorelineShare: '% do placar mais comum, força parecida',
  topScorerShareOfTeamGoals:
    '% dos gols do time feitos pelo artilheiro (temporada)',
  topTwoScorersShareOfTeamGoals:
    '% dos gols do time feitos pelos 2 artilheiros',
  sameTopScorerAcrossCareers: 'Mesmo artilheiro do clube entre carreiras',
  scorerGini: 'Gini dos finalizadores (gols por atleta)',
  scorerHhi: 'HHI dos finalizadores',
  participationGini: 'Gini da participação em lances',
  participationHhi: 'HHI da participação em lances',
  eventTrigramDistinctRatio: 'Trigramas de eventos distintos / total',
  eventTrigramTopShare: '% do trigrama de eventos mais comum',
  distinctOpenings: 'Aberturas distintas (4 primeiros lances)',
  openingTopShare: '% da abertura mais comum',
  narrationLinesPerMatch: 'Linhas de narração por partida',
  narrationDistinctTemplates:
    'Modelos de frase distintos (nomes e números mascarados)',
  narrationTemplateTopShare: '% do modelo de frase mais comum',
  narrationWithinMatchRepeatRate: 'Repetição de modelo dentro da mesma partida',
  goalNarrationTemplates: 'Modelos distintos de gol',
  goalNarrationTopShare: '% do modelo de gol mais comum',
  chanceNarrationTemplates: 'Modelos distintos de finalização',
  chanceNarrationTopShare: '% do modelo de finalização mais comum',
  automaticStopsPerMatchInNarration:
    'Paradas automáticas no meio do jogo (feed)',
  firstHalfGoalShare: '% dos gols no 1º tempo',
  goalShareMinutes1to15: '% dos gols entre 1 e 15 min',
  goalShareMinutes76plus: '% dos gols a partir dos 76 min',
  maxSingleMinuteGoalShare: '% do minuto com mais gols',
  prematchHomeXgSpreadSamePairing:
    'Desvio do xG pré-jogo do mandante, mesmo confronto',
  realizedHomeXgSpreadSamePairing:
    'Desvio do xG realizado do mandante, mesmo confronto',
  similarPrematchHomeWinProbabilityStd:
    'Desvio da prob. pré-jogo de vitória, força parecida',
  similarPrematchHomeWinProbabilityMean:
    'Média da prob. pré-jogo de vitória, força parecida',
};

export function varianceMarkdown(
  report: VarianceReport,
  title: string,
): string {
  const rows = Object.entries(report.metrics)
    .map(([key, value]) => `| ${LABELS[key] ?? key} | \`${key}\` | ${value} |`)
    .join('\n');
  const buckets = ['1–15', '16–30', '31–45', '46–60', '61–75', '76–90', '91+'];
  return `# ${title}

Gerado por \`pnpm --filter @footebas/sim-lab variance\` (\`${report.schemaVersion}\`).

- Motor: \`${report.engineVersion}\`
- Narração medida: ${report.narrator}
- Amostra: ${report.careers} carreiras × Série A e Série B do catálogo (turno e returno, 4-4-2 equilibrado como a IA) = ${report.matches} partidas

## Métricas

| Métrica | Chave | Valor |
| --- | --- | --- |
${rows}

## Placares mais comuns

| Placar | % |
| --- | --- |
${report.scorelines.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Minutos

| Faixa | % dos gols | % dos eventos |
| --- | --- | --- |
${buckets.map((label, index) => `| ${label} | ${report.goalMinuteBuckets[index]} | ${report.eventMinuteBuckets[index]} |`).join('\n')}

## Tipos de lance

| Lance | Quantidade |
| --- | --- |
${report.playMix.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}
`;
}

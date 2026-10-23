import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entityId, type ClubId } from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  canonicalCompetitionId,
  closeCareerSeason,
  createCareerSeason,
  fixturesOn,
  hashSeed,
  isSeasonComplete,
  liveStandings,
  nextMatchDate,
  parseMvpCompetitionConfig,
  recordSeasonResults,
  type CareerSeasonInput,
  type CareerSeasonState,
  type MvpCompetitionConfig,
} from '@footebas/engine';

const DIVISIONS = ['serie-a', 'serie-b', 'serie-c'] as const;
const club = (legacy: string): string => legacy.replace(/[^a-z0-9]+/g, '_');

/** The shipped config with roster ids rewritten to valid entity ids. */
function fixture(): { config: MvpCompetitionConfig; input: CareerSeasonInput } {
  const raw = parseMvpCompetitionConfig(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', 'config', 'mvp-competitions.json'),
        'utf8',
      ),
    ) as unknown,
  );
  const config: MvpCompetitionConfig = {
    ...raw,
    stateLeagues: raw.stateLeagues.map((league) => ({
      ...league,
      participants: league.participants.map(
        ([id, name]) => [club(id), name] as const,
      ),
    })),
    continental: {
      ...raw.continental,
      initialDirectClubIds: raw.continental.initialDirectClubIds.map(club),
      initialPreliminaryClubIds:
        raw.continental.initialPreliminaryClubIds.map(club),
    },
  };
  const referenced = new Set([
    ...config.stateLeagues.flatMap(({ participants }) =>
      participants.map(([id]) => id),
    ),
    ...config.continental.initialDirectClubIds,
    ...config.continental.initialPreliminaryClubIds,
  ]);
  const divisions = Object.fromEntries(
    DIVISIONS.map((division) => {
      const prefix = `${club(division)}_`;
      const ids = [...referenced].filter((id) => id.startsWith(prefix)).sort();
      for (let index = 1; ids.length < 20; index++) {
        const filler = `${prefix}filler_${String(index)}`;
        if (!ids.includes(filler)) ids.push(filler);
      }
      return [division, ids.map((id) => entityId(id, 'club'))];
    }),
  ) as unknown as CareerSeasonInput['divisions'];
  return {
    config,
    input: {
      season: 1,
      year: 2026,
      seed: 'career-season-test',
      divisions,
      continentalDirect: config.continental.initialDirectClubIds.map(
        (id) => entityId(id, 'club') as ClubId,
      ),
      continentalPreliminary: config.continental.initialPreliminaryClubIds.map(
        (id) => entityId(id, 'club') as ClubId,
      ),
    },
  };
}

function playSeason(
  config: MvpCompetitionConfig,
  initial: CareerSeasonState,
): { state: CareerSeasonState; dates: number; matches: number } {
  let state = initial;
  let dates = 0;
  let matches = 0;
  for (let date = nextMatchDate(state); date; date = nextMatchDate(state)) {
    const today = fixturesOn(state, date);
    matches += today.length;
    dates++;
    state = recordSeasonResults(
      config,
      state,
      today.map(({ id }) => ({
        fixtureId: id,
        homeGoals: hashSeed(`${id}|home`) % 4,
        awayGoals: hashSeed(`${id}|away`) % 3,
      })),
    );
  }
  return { state, dates, matches };
}

describe('temporada de carreira data a data', () => {
  it('joga todas as competições do calendário até fechar a temporada', () => {
    const { config, input } = fixture();
    const { state, matches } = playSeason(
      config,
      createCareerSeason(config, input),
    );
    expect(isSeasonComplete(state)).toBe(true);
    expect(state.competitions).toHaveLength(10);
    expect(Object.keys(state.results)).toHaveLength(matches);
    const serieA = canonicalCompetitionId('brasileirao-serie-a');
    expect(
      state.fixtures.filter(({ competitionId }) => competitionId === serieA),
    ).toHaveLength(380);
  });

  it('só sorteia a fase seguinte do mata-mata depois dos resultados', () => {
    const { config, input } = fixture();
    const initial = createCareerSeason(config, input);
    const cup = canonicalCompetitionId('copa-do-brasil');
    const firstRound = initial.fixtures.filter(
      ({ competitionId }) => competitionId === cup,
    );
    expect(new Set(firstRound.map(({ stageId }) => stageId)).size).toBe(1);
    const { state } = playSeason(config, initial);
    expect(
      new Set(
        state.fixtures
          .filter(({ competitionId }) => competitionId === cup)
          .map(({ stageId }) => stageId),
      ).size,
    ).toBe(config.nationalCup.legsByRound.length);
  });

  it('mostra tabela parcial e aplica acesso e rebaixamento na virada', () => {
    const { config, input } = fixture();
    let state = createCareerSeason(config, input);
    const serieA = canonicalCompetitionId('brasileirao-serie-a');
    expect(liveStandings(config, state, serieA)).toHaveLength(20);
    state = playSeason(config, state).state;
    const closure = closeCareerSeason(config, state);
    const table = liveStandings(config, state, serieA).map(
      ({ clubId }) => clubId,
    );
    const relegated = table.slice(-4);
    expect(
      relegated.every((clubId) =>
        closure.next.divisions['serie-b'].includes(clubId),
      ),
    ).toBe(true);
    for (const division of DIVISIONS)
      expect(closure.next.divisions[division]).toHaveLength(20);
    expect(closure.next.season).toBe(2);
  });

  it('é determinística e recusa resultado duplicado', () => {
    const { config, input } = fixture();
    const first = playSeason(config, createCareerSeason(config, input)).state;
    const second = playSeason(config, createCareerSeason(config, input)).state;
    expect(second).toEqual(first);
    const initial = createCareerSeason(config, input);
    const fixtureId = initial.fixtures[0]?.id ?? '';
    const once = recordSeasonResults(config, initial, [
      { fixtureId, homeGoals: 1, awayGoals: 0 },
    ]);
    expect(() =>
      recordSeasonResults(config, once, [
        { fixtureId, homeGoals: 1, awayGoals: 0 },
      ]),
    ).toThrow(/already has a result/);
  });
});

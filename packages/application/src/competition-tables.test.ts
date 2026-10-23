/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees every competition of the season */
import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
} from './index.js';

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token };
}

let sequence = 0;
const command = (type: string, expectedVersion: number, payload: object) => {
  sequence += 1;
  return {
    version: 1,
    type,
    commandId: `command_tables_${String(sequence)}`,
    idempotencyKey: `idem-tables-${String(sequence)}`,
    expectedVersion,
    payload,
  };
};

async function start(app: FootebasApplication, token: string, clubId: string) {
  const created = await app.execute(
    token,
    command('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 1, { careerId: created.careerId, clubId }),
  );
  return created.careerId;
}

async function play(
  app: FootebasApplication,
  token: string,
  careerId: string,
  clubId: string,
) {
  const { aggregateVersion } = await app.home(token, careerId);
  await app.execute(
    token,
    command('AutoPickLineup', aggregateVersion, {
      careerId,
      clubId,
      formation: '4-4-2',
      mode: 'best',
    }),
  );
  await app.execute(
    token,
    command('AdvanceDate', aggregateVersion + 1, { careerId }),
  );
  expect((await app.runNextJob())?.state).toBe('succeeded');
}

type Tables = Awaited<ReturnType<FootebasApplication['tables']>>;
const tableOf = (tables: Tables, competitionId: string) =>
  tables.competitions.find((item) => item.competitionId === competitionId)!;
const rowsOf = (tables: Tables, competitionId: string) =>
  tableOf(tables, competitionId).stages[0]!.groups[0]?.rows ?? [];

/** Champions are only ever those of competitions already decided. */
function expectHonestChampions(tables: Tables, currentDate: string) {
  for (const competition of tables.competitions) {
    if (competition.status === 'complete') {
      expect(competition.champion?.decidedOn).toBeDefined();
      expect(competition.champion!.decidedOn <= currentDate).toBe(true);
    } else expect(competition.champion).toBeUndefined();
  }
}

describe('tabelas por competição (GET /tables)', () => {
  it('a tabela do estadual anda a cada rodada e a Central foca nele enquanto dura', async () => {
    const { app, token } = setup();
    const clubId = 'club_flamengo';
    const careerId = await start(app, token, clubId);
    const before = await app.tables(token, careerId);
    expect(before.focusCompetitionId).toBe('carioca');
    expect(rowsOf(before, 'carioca').every(({ played }) => played === 0)).toBe(
      true,
    );
    expectHonestChampions(before, '2026-01-01');

    let previous = 0;
    for (let round = 0; round < 3; round++) {
      await play(app, token, careerId, clubId);
      const tables = await app.tables(token, careerId);
      const { currentDate } = await app.home(token, careerId);
      const mine = rowsOf(tables, 'carioca').find(
        (row) => row.club.id === clubId,
      )!;
      // The managed club's own table moves with its own matches.
      expect(mine.played).toBe(previous + 1);
      previous = mine.played;
      // Every live table is consistent with the results recorded so far.
      for (const competition of tables.competitions)
        for (const stage of competition.stages)
          for (const group of stage.groups) {
            const goals = group.rows.reduce(
              (sum, row) => sum + row.goalsFor,
              0,
            );
            expect(goals).toBe(
              group.rows.reduce((sum, row) => sum + row.goalsAgainst, 0),
            );
          }
      expectHonestChampions(tables, currentDate);
    }
    // Champions this early are the small estaduais (4–5 clubs, single round
    // robin from 3 January) whose every club already played every match.
    const decided = (await app.tables(token, careerId)).competitions.filter(
      ({ champion }) => champion !== undefined,
    );
    expect(decided.length).toBeGreaterThan(0);
    for (const competition of decided) {
      expect(competition.category).toBe('state');
      const rows = competition.stages[0]!.groups[0]!.rows;
      expect(rows.every(({ played }) => played === rows.length - 1)).toBe(true);
    }
    // The old division-only read never showed this: it stayed at zero.
    const division = await app.standings(token, careerId);
    expect(division.rows.every(({ played }) => played === 0)).toBe(true);
  });

  it('depois do estadual foca na divisão, com zonas, grupos da Libertadores e campeões só decididos', async () => {
    const { app, token } = setup();
    const clubId = 'club_flamengo';
    const careerId = await start(app, token, clubId);
    let tables = await app.tables(token, careerId);
    for (let step = 0; step < 12; step++) {
      await play(app, token, careerId, clubId);
      tables = await app.tables(token, careerId);
      const groups = tableOf(tables, 'copa_libertadores').stages.find(
        ({ kind }) => kind === 'groups',
      )!;
      if (groups.status === 'active') break;
    }
    const { currentDate } = await app.home(token, careerId);
    const division = (await app.standings(token, careerId)).competitionId;
    expect(tables.focusCompetitionId).toBe(division);
    const carioca = tableOf(tables, 'carioca');
    expect(carioca.status).toBe('complete');
    expect(carioca.champion?.club.id).toBe(
      rowsOf(tables, 'carioca')[0]!.club.id,
    );
    expectHonestChampions(tables, currentDate);
    // Temporada shows the same decided champions, with the deciding date.
    const season = await app.careerSeason(token, careerId);
    expect(
      season.champions.map(({ competitionId, club, decidedOn }) => ({
        competitionId,
        clubId: club.id,
        decidedOn,
      })),
    ).toEqual(
      tables.competitions.flatMap(({ competitionId, champion }) =>
        champion === undefined
          ? []
          : [
              {
                competitionId,
                clubId: champion.club.id,
                decidedOn: champion.decidedOn,
              },
            ],
      ),
    );

    const serieA = tableOf(tables, division).stages[0]!.groups[0]!;
    expect(serieA.rows).toHaveLength(20);
    expect(serieA.zones.map(({ kind }) => kind)).toEqual([
      'continental',
      'continental_qualifying',
      'relegation',
    ]);
    expect(serieA.rows[0]!.zone).toBe('continental');
    expect(serieA.rows[19]!.zone).toBe('relegation');
    expect(
      serieA.rows.find(({ club }) => club.id === clubId)!.played,
    ).toBeGreaterThan(0);

    const libertadores = tableOf(tables, 'copa_libertadores');
    const [preliminary, groups] = libertadores.stages;
    expect(preliminary!.kind).toBe('knockout');
    expect(preliminary!.status).toBe('complete');
    for (const tie of preliminary!.ties) {
      expect(tie.status).toBe('complete');
      expect(tie.legs).toHaveLength(2);
      expect([tie.home.id, tie.away.id]).toContain(tie.winnerClubId);
    }
    expect(groups!.groups.map(({ name }) => name)).toEqual([
      'Grupo A',
      'Grupo B',
      'Grupo C',
      'Grupo D',
    ]);
    for (const group of groups!.groups) {
      expect(group.rows).toHaveLength(4);
      expect(group.zones).toEqual([
        {
          kind: 'advance',
          label: 'Classificados ao mata-mata',
          from: 1,
          to: 2,
        },
      ]);
    }
    expect(libertadores.managed).toBe(true);
    expect(libertadores.currentStageId).toBe(groups!.id);
    // Not drawn yet: knockout stages exist but have no ties.
    expect(
      libertadores.stages
        .slice(2)
        .every(
          ({ ties, status }) => ties.length === 0 && status === 'scheduled',
        ),
    ).toBe(true);
    const cup = tableOf(tables, 'copa_do_brasil');
    expect(cup.stages[0]!.ties.length).toBeGreaterThan(0);
    expect(
      cup.stages[0]!.ties.every(({ status }) => status === 'scheduled'),
    ).toBe(true);
  });
});

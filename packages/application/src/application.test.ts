/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment -- playthrough fixture guarantees selected players; Vitest asymmetric matchers are dynamic */
import { describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '@footebas/database';
import {
  ApplicationError,
  catalogCareerContent,
  createFixtureContent,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  type ApplicationDependencies,
} from './index.js';

function setup(failPoint?: ApplicationDependencies['failPoint']) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const jobs = new InMemoryJobQueue();
  const deps: ApplicationDependencies = {
    auth,
    clock,
    jobs,
    ids: new SequentialIdGenerator(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
    ...(failPoint ? { failPoint } : {}),
  };
  const app = new FootebasApplication(deps);
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  const stranger = auth.issue({
    userId: 'user_stranger',
    email: 'stranger@example.com',
    displayName: 'Stranger',
  });
  return { app, deps, token, stranger };
}
const command = (
  type: string,
  commandId: string,
  expectedVersion: number,
  payload: object,
) => ({
  version: 1,
  type,
  commandId,
  idempotencyKey: `idem-${commandId}`,
  expectedVersion,
  payload,
});

async function createAndSelect(app: FootebasApplication, token: string) {
  const created = await app.execute(
    token,
    command('CreateCareer', 'command_create', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 'command_club', 1, {
      careerId: created.careerId,
      clubId: 'club_flamengo',
    }),
  );
  return created.careerId;
}

describe('server-authoritative application slice', () => {
  it('builds the fixture from the real roster sample with derived provenance', () => {
    const content = createFixtureContent();
    expect(content.clubs.map(({ name }) => name)).toEqual([
      'Flamengo',
      'Palmeiras',
      'Atlético Mineiro',
      'Fluminense',
      'São Paulo',
      'Botafogo',
      'Corinthians',
      'Bahia',
    ]);
    expect(content.players).toHaveLength(200);
    expect(
      content.players.some(({ name }) => name.startsWith('Jogador ')),
    ).toBe(false);
    expect(content.provenance).toMatchObject({
      source: 'dados/elencos/brasileirao-serie-a-2026.md',
      identity: 'raw-markdown',
      attributes: 'derived',
    });
  });

  it('plays through post-match and reloads checksum-equivalent', async () => {
    const { app, deps, token } = setup();
    const careerId = await createAndSelect(app, token);
    await app.execute(
      token,
      command('AutoPickLineup', 'command_lineup', 2, {
        careerId,
        clubId: 'club_flamengo',
        formation: '4-3-3',
        mode: 'best',
      }),
    );
    await app.execute(
      token,
      command('SetTactics', 'command_tactic', 3, {
        careerId,
        formation: '4-3-3',
        mentality: 'counter_attack',
        attackDirection: 'wings',
        marking: 'heavy',
      }),
    );
    const next = await app.nextMatch(token, careerId);
    expect(
      (
        await app.execute(
          token,
          command('AdvanceDate', 'command_advance', 4, {
            careerId,
            throughDate: next.date,
          }),
        )
      ).jobId,
    ).toBeDefined();
    expect((await app.runNextJob())?.state).toBe('succeeded');
    expect((await app.postMatch(token, careerId)).fixtureId).toBe(
      next.fixtureId,
    );
    const table = await app.standings(token, careerId);
    expect(table.competition).toBe('Brasileirão Série A');
    expect(table.rows).toHaveLength(20);
    expect(
      (await app.squad(token, careerId)).players.some(
        ({ condition }) => condition < 100,
      ),
    ).toBe(true);
    const checksum = await app.checksum(token, careerId);
    const reloaded = new FootebasApplication(deps);
    expect(await reloaded.checksum(token, careerId)).toBe(checksum);
    expect((await reloaded.home(token, careerId)).currentDate).toBe(next.date);
  });

  it('enforces auth and ownership', async () => {
    const { app, token, stranger } = setup();
    const id = await createAndSelect(app, token);
    await expect(app.home('Bearer invalid', id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(app.home(stranger, id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('projects complete decision information without leaking hidden numbers and records matchday changes', async () => {
    const { app, token } = setup();
    const careerId = await createAndSelect(app, token);
    const squad = await app.squad(token, careerId);
    expect(squad.players.length).toBeGreaterThanOrEqual(18);
    expect(squad.players.every(({ traits }) => traits.length <= 2)).toBe(true);
    expect(
      squad.players.every(
        (player) =>
          typeof player.matchSharpness === 'number' &&
          typeof player.squadStatus === 'string' &&
          Object.values(player.hiddenEstimates).every(
            (value) => typeof value === 'string',
          ),
      ),
    ).toBe(true);
    expect(JSON.stringify(squad)).not.toMatch(/"hidden":\s*\{/);
    const next = await app.nextMatch(token, careerId);
    expect(next.preparation).toMatchObject({
      opponent: expect.objectContaining({ id: expect.any(String) }),
      venue: expect.stringMatching(/home|away/),
      approximateStrength: expect.any(String),
      absences: expect.any(Array),
    });
    const side = next.homeClub.id === 'club_flamengo' ? 'home' : 'away';
    const opponentSide = side === 'home' ? 'away' : 'home';
    const lineup = squad.lineup!;
    const playerOutId = lineup.starters.at(-1)!;
    const playerInId = lineup.bench[0]!;
    await expect(
      app.execute(
        token,
        command('SimulateMatch', 'command_opponent_instruction', 2, {
          careerId,
          fixtureId: next.fixtureId,
          instructions: [
            {
              type: 'substitution',
              minute: 60,
              side: opponentSide,
              playerOutId,
              playerInId,
              position: 'ST',
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await app.execute(
      token,
      command('SimulateMatch', 'command_phase3_match', 2, {
        careerId,
        fixtureId: next.fixtureId,
        instructions: [
          {
            type: 'tactical_change',
            minute: 45,
            side,
            tactic: {
              formation: '4-4-2',
              mentality: 'all_out_attack',
              attackDirection: 'wings',
              marking: 'heavy',
              buildUp: 'direct',
              focus: 'wings',
              press: 'high',
              defensiveLine: 'high',
              markingStyle: 'man',
            },
          },
          {
            type: 'substitution',
            minute: 60,
            side,
            playerOutId,
            playerInId,
            position: 'ST',
          },
        ],
      }),
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    const post = await app.postMatch(token, careerId);
    expect(post.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tactical_change', minute: 45 }),
        expect.objectContaining({
          type: 'substitution',
          minute: 60,
          source: 'manager',
        }),
      ]),
    );
    expect(post.playback).toEqual({
      modes: ['instant', 'fast', 'feed'],
      speeds: [1, 2, 4, 8],
      canSkip: true,
    });
    const after = await app.squad(token, careerId);
    expect(
      after.players.some(
        ({ lastMatchRating }) => lastMatchRating !== undefined,
      ),
    ).toBe(true);
    expect(
      after.players.some(({ careerStats }) => careerStats.appearances > 0),
    ).toBe(true);
  });

  it('deduplicates commands and serializes concurrent advances', async () => {
    const { app, token } = setup();
    const create = command('CreateCareer', 'command_same_create', 0, {
      managerName: 'M',
      startDate: '2026-01-01',
    });
    const first = await app.execute(token, create);
    expect(await app.execute(token, create)).toEqual(first);
    await app.execute(
      token,
      command('SelectClub', 'command_select_once', 1, {
        careerId: first.careerId,
        clubId: 'club_flamengo',
      }),
    );
    const settled = await Promise.allSettled([
      app.execute(
        token,
        command('AdvanceDate', 'command_advance_a', 2, {
          careerId: first.careerId,
        }),
      ),
      app.execute(
        token,
        command('AdvanceDate', 'command_advance_b', 2, {
          careerId: first.careerId,
        }),
      ),
    ]);
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(settled.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    await app.runNextJob();
    const checksum = await app.checksum(token, first.careerId);
    expect(await app.runNextJob()).toBeUndefined();
    expect(await app.checksum(token, first.careerId)).toBe(checksum);
  });

  it('deduplicates retries by idempotency key when command ids change', async () => {
    const { app, token } = setup();
    const first = command('CreateCareer', 'command_retry_a', 0, {
      managerName: 'Ada',
      startDate: '2026-01-01',
    });
    const retried = { ...first, commandId: 'command_retry_b' };
    const accepted = await app.execute(token, first);
    expect(await app.execute(token, retried)).toEqual(accepted);
  });

  it('rolls back injected failure and retries once without partial result', async () => {
    let fail = true;
    const { app, token } = setup(() => {
      if (fail) {
        fail = false;
        throw new Error('injected');
      }
    });
    const id = await createAndSelect(app, token);
    const fixtureId = (await app.nextMatch(token, id)).fixtureId;
    await app.execute(
      token,
      command('SimulateMatch', 'command_sim', 2, { careerId: id, fixtureId }),
    );
    expect((await app.runNextJob())?.state).toBe('failed');
    await expect(app.postMatch(token, id)).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    expect((await app.postMatch(token, id)).fixtureId).toBe(fixtureId);
  });

  it('builds a career from the launch catalog with every competition scheduled', async () => {
    const content = catalogCareerContent.load();
    expect(content.clubs).toHaveLength(71);
    expect(Object.values(content.divisions).flat()).toHaveLength(60);
    const { app, token } = setup();
    const careerId = await createAndSelect(app, token);
    const next = await app.nextMatch(token, careerId);
    expect(next.competition).toBe('Carioca');
    expect([next.homeClub.id, next.awayClub.id]).toContain('club_flamengo');
  });

  it('previews the managed match exactly as the committed job plays it', async () => {
    const { app, token } = setup();
    const careerId = await createAndSelect(app, token);
    const next = await app.nextMatch(token, careerId);
    const squad = await app.squad(token, careerId);
    const side = next.homeClub.id === 'club_flamengo' ? 'home' : 'away';
    const instructions = [
      {
        type: 'substitution' as const,
        minute: 60 as const,
        side,
        playerOutId: squad.lineup!.starters.at(-1)!,
        playerInId: squad.lineup!.bench[0]!,
        position: 'ST' as const,
      },
    ];
    const plain = await app.previewMatch(token, careerId, []);
    const preview = await app.previewMatch(token, careerId, instructions);
    expect(preview.tableUpdated).toBe(false);
    expect(preview.timeline).not.toEqual(plain.timeline);
    await expect(app.postMatch(token, careerId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await app.execute(
      token,
      command('SimulateMatch', 'command_previewed', 2, {
        careerId,
        fixtureId: next.fixtureId,
        instructions,
      }),
    );
    await app.runNextJob();
    const committed = await app.postMatch(token, careerId);
    expect(committed.score).toEqual(preview.score);
    expect(committed.timeline).toEqual(preview.timeline);
  });

  it(
    'plays a whole season across competitions and rolls into the next one',
    { timeout: 300_000 },
    async () => {
      const { app, token } = setup();
      const careerId = await createAndSelect(app, token);
      let version = 2;
      for (let step = 0; step < 200; step++) {
        const home = await app.home(token, careerId);
        if (home.season === 2) break;
        await app.execute(
          token,
          command('AutoPickLineup', `command_pick_${String(step)}`, version, {
            careerId,
            clubId: 'club_flamengo',
            formation: '4-4-2',
            mode: 'best',
          }),
        );
        version += 1;
        await app.execute(
          token,
          command('AdvanceDate', `command_season_${String(step)}`, version, {
            careerId,
          }),
        );
        expect((await app.runNextJob())?.state).toBe('succeeded');
        version = (await app.home(token, careerId)).aggregateVersion;
      }
      const home = await app.home(token, careerId);
      expect(home.season).toBe(2);
      expect(home.currentDate).toBe('2027-01-01');
      const table = await app.standings(token, careerId);
      expect(table.rows.every((row) => row.played === 0)).toBe(true);
    },
  );
});

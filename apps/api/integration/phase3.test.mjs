import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  careerSaveRepository,
} from '@footebas/application';
import {
  jobSseEventSchema,
  nextMatchReadModelSchema,
  postMatchReadModelSchema,
  squadReadModelSchema,
} from '@footebas/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '../../../packages/database/src/index.js';
import {
  FakeScheduler,
  InMemoryWorkerJobQueue,
  WorkerRuntime,
} from '../../worker/src/index.js';
import { buildApi } from '../src/index.js';

const openApis = [];
const formationPositions = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'],
};

afterEach(async () => {
  await Promise.all(openApis.splice(0).map((api) => api.close()));
});

async function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const jobs = new InMemoryWorkerJobQueue();
  const dependencies = {
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
  };
  const application = new FootebasApplication(dependencies);
  const runtime = new WorkerRuntime(
    application,
    jobs,
    clock,
    new FakeScheduler(clock),
  );
  const token = auth.issue({
    userId: 'user_phase3_owner',
    email: 'phase3@example.com',
    displayName: 'Phase 3 Owner',
  });
  const api = await buildApi({ application, jobs, now: () => clock.now() });
  openApis.push(api);
  return { api, application, dependencies, jobs, runtime, token };
}

function command(type, commandId, expectedVersion, payload) {
  return {
    version: 1,
    type,
    commandId,
    idempotencyKey: `phase3:${commandId}`,
    expectedVersion,
    payload,
  };
}

function post(fixture, body) {
  return fixture.api.inject({
    method: 'POST',
    url: '/v1/commands',
    headers: { authorization: `Bearer ${fixture.token}` },
    payload: body,
  });
}

function get(fixture, url) {
  return fixture.api.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${fixture.token}` },
  });
}

function sseData(response) {
  const line = response.body
    .split('\n')
    .find((candidate) => candidate.startsWith('data: '));
  expect(line).toBeDefined();
  return jobSseEventSchema.parse(JSON.parse(line.slice(6)));
}

async function createSelectedCareer(fixture, suffix) {
  const created = await post(
    fixture,
    command('CreateCareer', `command_create_${suffix}`, 0, {
      managerName: 'Ada',
      startDate: '2026-01-01',
    }),
  );
  expect(created.statusCode).toBe(202);
  const careerId = created.json().careerId;
  const selected = await post(
    fixture,
    command('SelectClub', `command_select_${suffix}`, 1, {
      careerId,
      clubId: 'club_flamengo',
    }),
  );
  expect(selected.statusCode).toBe(202);
  return careerId;
}

describe('Phase 3 Fastify/application/worker integration', () => {
  it('runs auto-pick, expanded projections, managed instructions, SSE, replay and reload', async () => {
    const fixture = await setup();
    const careerId = await createSelectedCareer(fixture, 'flow');

    const autoPick = await post(
      fixture,
      command('AutoPickLineup', 'command_autopick_flow', 2, {
        careerId,
        clubId: 'club_flamengo',
        formation: '4-3-3',
        mode: 'develop',
      }),
    );
    expect(autoPick.statusCode).toBe(202);
    expect(autoPick.json()).toMatchObject({ aggregateVersion: 3 });

    const squad = squadReadModelSchema.parse(
      (await get(fixture, `/v1/careers/${careerId}/squad`)).json(),
    );
    expect(squad.lineup).toMatchObject({ formation: '4-3-3' });
    expect(squad.lineup.starters).toHaveLength(11);
    expect(squad.lineup.bench.length).toBeGreaterThanOrEqual(2);
    expect(
      squad.players.every(
        (player) =>
          player.traits.length <= 2 &&
          Object.values(player.hiddenEstimates).every(
            (estimate) => typeof estimate === 'string',
          ),
      ),
    ).toBe(true);
    const serializedSquad = JSON.stringify(squad);
    expect(serializedSquad).not.toContain('"hidden":');
    expect(serializedSquad).not.toMatch(
      /"(potential|consistency|injuryRisk|adaptation|professionalism|bigGames)":\d/,
    );
    expect(serializedSquad).not.toMatch(/"(injuryProneness|bigGame)":/);

    const tactics = await post(
      fixture,
      command('SetTactics', 'command_tactics_flow', 3, {
        careerId,
        formation: '4-3-3',
        mentality: 'counter_attack',
        attackDirection: 'wings',
        marking: 'very_heavy',
        buildUp: 'direct',
        focus: 'wings',
        press: 'high',
        defensiveLine: 'high',
        markingStyle: 'man',
      }),
    );
    expect(tactics.statusCode).toBe(202);

    const next = nextMatchReadModelSchema.parse(
      (await get(fixture, `/v1/careers/${careerId}/next-match`)).json(),
    );
    expect(next.preparation).toMatchObject({
      opponent: expect.objectContaining({ id: expect.any(String) }),
      venue: expect.stringMatching(/home|away/),
      recentForm: expect.any(Array),
      approximateStrength: expect.any(String),
      absences: expect.any(Array),
    });
    const managedSide = next.homeClub.id === 'club_flamengo' ? 'home' : 'away';
    const opponentSide = managedSide === 'home' ? 'away' : 'home';
    const outgoingId = squad.lineup.starters.at(-1);
    const firstIncomingId = squad.lineup.bench[0];
    const secondIncomingId = squad.lineup.bench[1];

    const forbidden = await post(
      fixture,
      command('SimulateMatch', 'command_forbidden_flow', 4, {
        careerId,
        fixtureId: next.fixtureId,
        instructions: [
          {
            type: 'tactical_change',
            minute: 45,
            side: opponentSide,
            tactic: {
              formation: '4-3-3',
              mentality: 'all_out_attack',
              attackDirection: 'center',
              marking: 'heavy',
            },
          },
        ],
      }),
    );
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ code: 'FORBIDDEN' });

    const simulateCommand = command(
      'SimulateMatch',
      'command_simulate_flow',
      4,
      {
        careerId,
        fixtureId: next.fixtureId,
        instructions: [
          {
            type: 'tactical_change',
            minute: 45,
            side: managedSide,
            tactic: {
              formation: '4-3-3',
              mentality: 'all_out_attack',
              attackDirection: 'wings',
              marking: 'very_heavy',
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
            side: managedSide,
            playerOutId: outgoingId,
            playerInId: firstIncomingId,
            position: 'ST',
          },
          {
            type: 'substitution',
            minute: 75,
            side: managedSide,
            playerOutId: firstIncomingId,
            playerInId: secondIncomingId,
            position: 'ST',
          },
        ],
      },
    );
    const acceptedResponse = await post(fixture, simulateCommand);
    expect(acceptedResponse.statusCode).toBe(202);
    const accepted = acceptedResponse.json();
    expect(accepted).toMatchObject({ aggregateVersion: 5 });
    expect(accepted.jobId).toBeDefined();

    expect(
      (await get(fixture, `/v1/jobs/${accepted.jobId}`)).json(),
    ).toMatchObject({ state: 'queued' });
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({ type: 'job.status', data: { state: 'queued' } });
    expect((await fixture.runtime.drain()).map(({ kind }) => kind)).toEqual([
      'succeeded',
    ]);
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({
      type: 'job.completed',
      data: { careerId, aggregateVersion: 6 },
    });

    const postMatch = postMatchReadModelSchema.parse(
      (await get(fixture, `/v1/careers/${careerId}/post-match`)).json(),
    );
    expect(postMatch.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tactical_change',
          minute: 45,
          side: managedSide,
        }),
        expect.objectContaining({
          type: 'substitution',
          minute: 60,
          playerOutId: outgoingId,
          playerInId: firstIncomingId,
          source: 'manager',
        }),
        expect.objectContaining({
          type: 'substitution',
          minute: 75,
          playerOutId: firstIncomingId,
          playerInId: secondIncomingId,
          source: 'manager',
        }),
      ]),
    );
    expect(postMatch.playback).toEqual({
      modes: ['instant', 'fast', 'feed'],
      speeds: [0.5, 1, 2, 4, 8],
      canSkip: true,
    });
    const expandedAfter = squadReadModelSchema.parse(
      (await get(fixture, `/v1/careers/${careerId}/squad`)).json(),
    );
    expect(
      expandedAfter.players.some(
        (player) =>
          player.lastMatchRating !== undefined &&
          player.careerStats.appearances > 0,
      ),
    ).toBe(true);

    const checksum = await fixture.application.checksum(
      fixture.token,
      careerId,
    );
    const replay = await post(fixture, simulateCommand);
    expect(replay.statusCode).toBe(202);
    expect(replay.json()).toEqual(accepted);
    expect((await fixture.runtime.runOnce()).kind).toBe('idle');
    expect(
      postMatchReadModelSchema.parse(
        (await get(fixture, `/v1/careers/${careerId}/post-match`)).json(),
      ),
    ).toEqual(postMatch);
    expect(await fixture.application.checksum(fixture.token, careerId)).toBe(
      checksum,
    );

    const reloadedApplication = new FootebasApplication(fixture.dependencies);
    const reloadedApi = await buildApi({
      application: reloadedApplication,
      jobs: fixture.jobs,
      now: () => fixture.dependencies.clock.now(),
    });
    openApis.push(reloadedApi);
    const reloadedPost = await reloadedApi.inject({
      method: 'GET',
      url: `/v1/careers/${careerId}/post-match`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    expect(reloadedPost.json()).toEqual(postMatch);
    expect(await reloadedApplication.checksum(fixture.token, careerId)).toBe(
      checksum,
    );
  });

  it('rejects duplicate, wrong-formation, injured and suspended lineups at HTTP entry', async () => {
    const fixture = await setup();
    const careerId = await createSelectedCareer(fixture, 'validation');
    const readSquad = async () =>
      squadReadModelSchema.parse(
        (await get(fixture, `/v1/careers/${careerId}/squad`)).json(),
      );
    const squad = await readSquad();
    const lineupPayload = (positions = formationPositions['4-4-2']) => ({
      careerId,
      clubId: 'club_flamengo',
      starters: squad.lineup.starters.map((playerId, index) => ({
        playerId,
        position: positions[index],
      })),
      substitutes: squad.lineup.bench,
      reserves: squad.lineup.reserves,
      captainId: squad.lineup.starters[1],
    });
    const expectValidation = async (commandId, expectedVersion, payload) => {
      const response = await post(
        fixture,
        command('SetLineup', commandId, expectedVersion, payload),
      );
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    };

    const duplicate = lineupPayload();
    duplicate.starters[10].playerId = duplicate.starters[1].playerId;
    await expectValidation('command_duplicate_validation', 2, duplicate);
    await expectValidation(
      'command_formation_validation',
      2,
      lineupPayload(formationPositions['4-3-3']),
    );

    const unavailableId = squad.lineup.starters[1];
    await fixture.dependencies.unitOfWork.withCareerLock(
      careerId,
      async (tx) => {
        // Saves are stored lean (ADR 0014); edit them through the codec.
        const saves = careerSaveRepository(tx.saves);
        const save = await saves.load(careerId, 'user_phase3_owner');
        const snapshot = structuredClone(save.snapshot);
        snapshot.players.find(({ id }) => id === unavailableId).injuryRounds =
          2;
        await saves.update(careerId, 'user_phase3_owner', save.version, {
          snapshot,
          seed: save.seed,
          versions: save.versions,
        });
      },
    );
    await expectValidation('command_injured_validation', 3, lineupPayload());

    const suspendedId = squad.lineup.bench[0];
    await fixture.dependencies.unitOfWork.withCareerLock(
      careerId,
      async (tx) => {
        // Saves are stored lean (ADR 0014); edit them through the codec.
        const saves = careerSaveRepository(tx.saves);
        const save = await saves.load(careerId, 'user_phase3_owner');
        const snapshot = structuredClone(save.snapshot);
        snapshot.players.find(({ id }) => id === unavailableId).injuryRounds =
          0;
        snapshot.players.find(({ id }) => id === suspendedId).suspensionRounds =
          1;
        await saves.update(careerId, 'user_phase3_owner', save.version, {
          snapshot,
          seed: save.seed,
          versions: save.versions,
        });
      },
    );
    await expectValidation('command_suspended_validation', 4, lineupPayload());
  });
});

/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club and its contracts */
import { InMemoryUnitOfWork } from '@footebas/database';
import {
  COACH_PERSONALITIES,
  evaluateRenewal,
  money,
  type CanonicalValue,
  type CoachPersonality,
  type Player,
} from '@footebas/domain';
import { apiErrorSchema } from '@footebas/contracts';
import { describe, expect, it } from 'vitest';
import {
  ApplicationError,
  BASE_DEVELOPMENT_QUALITY,
  COACH_PERSONALITY_GUIDE,
  CareerLimitReachedError,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryEntitlements,
  InMemoryJobQueue,
  InMemoryStorage,
  LICENSED_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  SequentialIdGenerator,
  UnifiedPhaseFourRepository,
  catalogCareerContent,
  coachedMatchDeltas,
  developmentQualityFor,
  phaseFourStateOf,
  withMatchPlanStrength,
} from './index.js';

function setup(entitlements?: InMemoryEntitlements) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const ids = new SequentialIdGenerator();
  const app = new FootebasApplication({
    auth,
    clock,
    ids,
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
    ...(entitlements ? { entitlements } : {}),
  });
  const world = new PhaseFourApplicationService({
    repository: new UnifiedPhaseFourRepository(unitOfWork),
    archives: new InMemoryArchiveStorage(),
    clock,
    ids,
    random: new Mulberry32RandomFactory(),
  });
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
  return { app, world, token, stranger, unitOfWork };
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

const create = (id: string, payload: object = {}) =>
  command('CreateCareer', id, 0, {
    managerName: 'Marcio',
    startDate: '2026-01-01',
    ...payload,
  });

async function careerWith(personality: CoachPersonality) {
  const context = setup();
  const created = await context.app.execute(
    context.token,
    create('command_create', {
      coach: { nationality: 'BR', avatar: 'avatar-02', personality },
    }),
  );
  await context.app.execute(
    context.token,
    command('SelectClub', 'command_club', 1, {
      careerId: created.careerId,
      clubId: 'club_flamengo',
    }),
  );
  return { ...context, careerId: created.careerId };
}

async function playFirstMatch(personality: CoachPersonality) {
  const context = await careerWith(personality);
  const { app, token, careerId } = context;
  await app.execute(
    token,
    command('AdvanceDate', 'command_advance', 2, { careerId }),
  );
  expect((await app.runNextJob())?.state).toBe('succeeded');
  const squad = await app.squad(token, careerId);
  const post = await app.postMatch(token, careerId);
  const flamengoHome = post.homeClub.id === 'club_flamengo';
  const goalsFor = flamengoHome ? post.score.home : post.score.away;
  const goalsAgainst = flamengoHome ? post.score.away : post.score.home;
  return {
    ...context,
    morale: squad.players.reduce((sum, player) => sum + player.morale, 0),
    condition: squad.players.reduce((sum, player) => sum + player.condition, 0),
    result: goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
    checksum: await app.checksum(token, careerId),
  };
}

describe('career profile', () => {
  it('stores the career name and coach profile and exposes them in home and list', async () => {
    const { app, token } = setup();
    const coach = {
      nationality: 'AR',
      avatar: 'avatar-05',
      personality: 'motivador',
    } as const;
    const created = await app.execute(
      token,
      create('command_profile', { careerName: 'Rumo ao penta', coach }),
    );
    const home = await app.home(token, created.careerId);
    expect(home.careerName).toBe('Rumo ao penta');
    expect(home.coach).toEqual(coach);
    expect(home.inbox).toEqual([]);
    const list = await app.careers(token);
    expect(list.careers[0]).toMatchObject({
      careerId: created.careerId,
      careerName: 'Rumo ao penta',
      coach,
    });
    expect(list.limits).toEqual({
      ...FREE_ENTITLEMENTS,
      activeCareers: 1,
    });
  });

  it('applies the documented defaults when the profile is omitted', async () => {
    const { app, token } = setup();
    const created = await app.execute(token, create('command_default'));
    const home = await app.home(token, created.careerId);
    expect(home.careerName).toBe('Carreira de Marcio');
    expect(home.coach).toEqual({
      nationality: 'BR',
      avatar: 'avatar-01',
      personality: 'estrategista',
    });
  });

  it('loads saves created before profiles existed with the defaults', async () => {
    const { app, token, unitOfWork } = setup();
    const created = await app.execute(token, create('command_legacy'));
    const repos = unitOfWork.repositories();
    const save = (await repos.saves.peek(created.careerId))!;
    const legacy = structuredClone(save.snapshot) as Record<string, unknown>;
    delete legacy.careerName;
    delete legacy.coach;
    await repos.saves.update(save.id, save.userId, save.version, {
      snapshot: legacy as CanonicalValue,
      seed: save.seed,
      versions: save.versions,
    });
    const home = await app.home(token, created.careerId);
    expect(home.careerName).toBe('Carreira de Marcio');
    expect(home.coach.personality).toBe('estrategista');
    const list = await app.careers(token);
    expect(list.careers[0]?.coach.avatar).toBe('avatar-01');
    expect(phaseFourStateOf(save).coachPersonality).toBe('estrategista');
    // The next command writes the profile into the save.
    await app.execute(
      token,
      command('SelectClub', 'command_legacy_club', 2, {
        careerId: created.careerId,
        clubId: 'club_flamengo',
      }),
    );
    const migrated = (await unitOfWork
      .repositories()
      .saves.peek(created.careerId))!.snapshot as Record<string, unknown>;
    expect(migrated.careerName).toBe('Carreira de Marcio');
    expect(migrated.coach).toEqual({
      nationality: 'BR',
      avatar: 'avatar-01',
      personality: 'estrategista',
    });
  });

  it('writes the inbox in the personality tone after a match', async () => {
    const played = await playFirstMatch('disciplinador');
    const home = await played.app.home(played.token, played.careerId);
    // Transfer proposals of the window may share the inbox (docs/adr/0008).
    const reports = home.inbox.filter(({ kind }) => kind === 'match_report');
    expect(reports).toHaveLength(1);
    expect(reports[0]!.body).toContain('Marcio');
    expect(reports[0]!.situation).toBe(
      played.result === 'W' ? 'win' : played.result === 'L' ? 'loss' : 'draw',
    );
  });
});

describe('coach personality effects', () => {
  const keys = Array.from({ length: 2_000 }, (_, index) => `k${String(index)}`);
  const average = (
    personality: CoachPersonality,
    played: { conditionDelta: number; moraleDelta: number },
    field: 'conditionDelta' | 'moraleDelta',
    lossStreak = false,
  ) =>
    keys.reduce(
      (sum, key) =>
        sum +
        coachedMatchDeltas(personality, played, { lossStreak, key })[field],
      0,
    ) / keys.length;

  it('motivador gains more morale after wins and loses less after defeats', () => {
    const win = { conditionDelta: -6, moraleDelta: 3 };
    const loss = { conditionDelta: -6, moraleDelta: -2 };
    expect(average('estrategista', win, 'moraleDelta')).toBe(3);
    expect(average('motivador', win, 'moraleDelta')).toBeGreaterThan(3.2);
    expect(average('motivador', win, 'moraleDelta')).toBeLessThan(3.4);
    expect(average('estrategista', loss, 'moraleDelta')).toBe(-2);
    expect(average('motivador', loss, 'moraleDelta')).toBeGreaterThan(-1.9);
  });

  it('disciplinador loses less condition but more morale on a losing streak', () => {
    const loss = { conditionDelta: -6, moraleDelta: -2 };
    expect(average('estrategista', loss, 'conditionDelta')).toBe(-6);
    expect(average('disciplinador', loss, 'conditionDelta')).toBeGreaterThan(
      -5.6,
    );
    expect(average('disciplinador', loss, 'moraleDelta')).toBe(-2);
    expect(average('disciplinador', loss, 'moraleDelta', true)).toBeLessThan(
      -2.1,
    );
    expect(
      developmentQualityFor(
        { age: 19, clubId: 'club_a' } as Player,
        'club_a',
        'disciplinador',
      ),
    ).toBeGreaterThan(BASE_DEVELOPMENT_QUALITY);
    expect(
      developmentQualityFor(
        { age: 25, clubId: 'club_a' } as Player,
        'club_a',
        'disciplinador',
      ),
    ).toBe(BASE_DEVELOPMENT_QUALITY);
    expect(
      developmentQualityFor(
        { age: 19, clubId: 'club_b' } as Player,
        'club_a',
        'disciplinador',
      ),
    ).toBe(BASE_DEVELOPMENT_QUALITY);
    expect(
      developmentQualityFor(
        { age: 19, clubId: 'club_a' } as Player,
        'club_a',
        'motivador',
      ),
    ).toBe(BASE_DEVELOPMENT_QUALITY);
  });

  it('estrategista adds a small match-only strength edge', () => {
    const players = [{ strength: 70 }, { strength: 99 }] as unknown as Player[];
    expect(
      withMatchPlanStrength(players, 'estrategista').map(({ strength }) =>
        Number(strength),
      ),
    ).toEqual([72, 100]);
    expect(
      withMatchPlanStrength(players, 'diplomata').map(({ strength }) =>
        Number(strength),
      ),
    ).toEqual([70, 99]);
    expect(players[0]!.strength).toBe(70);
  });

  it('is deterministic and wired into the matchday for the managed squad', async () => {
    const motivador = await playFirstMatch('motivador');
    const again = await playFirstMatch('motivador');
    const diplomata = await playFirstMatch('diplomata');
    expect(again.checksum).toBe(motivador.checksum);
    // Neither style changes the first match itself, only what follows it.
    expect(diplomata.result).toBe(motivador.result);
    if (motivador.result === 'D')
      expect(motivador.morale).toBe(diplomata.morale);
    else expect(motivador.morale).toBeGreaterThan(diplomata.morale);
    expect(motivador.condition).toBe(diplomata.condition);
  });

  it('diplomata renews contracts for a slightly lower wage', async () => {
    const outcome = async (personality: CoachPersonality) => {
      const { world, unitOfWork, careerId } = await careerWith(personality);
      const save = (await unitOfWork.repositories().saves.peek(careerId))!;
      const state = phaseFourStateOf(save);
      expect(state.coachPersonality).toBe(personality);
      const contract = state.contracts.find(
        ({ clubId }) => clubId === 'club_flamengo',
      )!;
      const player = state.players.find(({ id }) => id === contract.playerId)!;
      const club = state.clubs.find(({ id }) => id === 'club_flamengo')!;
      const endsOn = `${String(Number(contract.endsOn.slice(0, 4)) + 2)}-12-31`;
      let low = 0;
      let high = 10_000_000_000;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (
          evaluateRenewal(
            contract,
            { wage: money(middle), endsOn },
            player,
            Number(club.reputation),
          ) === 'accept'
        )
          high = middle;
        else low = middle + 1;
      }
      const wage = Math.floor(low * 0.97);
      const receipt = await world.execute('user_owner', {
        version: 1,
        careerId,
        commandId: 'command_renew',
        idempotencyKey: 'idem-renew',
        expectedVersion: save.version,
        type: 'RenewPlayerContract',
        payload: { contractId: contract.id, wage, endsOn },
      });
      return receipt.outcome;
    };
    expect(await outcome('estrategista')).toBe('refused');
    expect(await outcome('diplomata')).toBe('applied');
  });

  it('explains every style to the UI from the rule table', () => {
    expect(COACH_PERSONALITY_GUIDE.map(({ id }) => id)).toEqual([
      ...COACH_PERSONALITIES,
    ]);
    for (const guide of COACH_PERSONALITY_GUIDE) {
      expect(guide.effects.length).toBeGreaterThan(0);
      for (const effect of guide.effects)
        expect(Math.abs(effect.percent)).toBeLessThanOrEqual(10);
    }
    const disciplinador = COACH_PERSONALITY_GUIDE.find(
      ({ id }) => id === 'disciplinador',
    )!;
    expect(
      disciplinador.effects.find(({ key }) => key === 'conditionLoss'),
    ).toMatchObject({ percent: -8, favorable: true });
    expect(
      disciplinador.effects.find(({ key }) => key === 'moraleAfterLossStreak'),
    ).toMatchObject({ percent: 10, favorable: false });
  });
});

describe('career limits and deletion', () => {
  it('allows one career on the free plan and keeps retries idempotent', async () => {
    const { app, token } = setup();
    const first = await app.execute(token, create('command_first'));
    expect(await app.execute(token, create('command_first'))).toEqual(first);
    const refused = await app
      .execute(token, create('command_second'))
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CareerLimitReachedError);
    expect(refused).toBeInstanceOf(ApplicationError);
    const limit = refused as CareerLimitReachedError;
    expect(limit.code).toBe('FORBIDDEN');
    expect(limit.contractCode).toBe('CAREER_LIMIT_REACHED');
    expect(limit.toApiError('request_1')).toEqual(
      apiErrorSchema.parse({
        version: 1,
        requestId: 'request_1',
        code: 'CAREER_LIMIT_REACHED',
        message: limit.message,
        plan: 'free',
        maxCareers: 1,
      }),
    );
    expect((await app.careers(token)).careers).toHaveLength(1);
  });

  it('allows five careers on the licensed plan', async () => {
    const entitlements = new InMemoryEntitlements();
    entitlements.license('user_owner');
    const { app, token, stranger } = setup(entitlements);
    for (let index = 0; index < 5; index += 1)
      await app.execute(token, create(`command_licensed_${String(index)}`));
    await app.execute(token, create('command_licensed_0'));
    await expect(
      app.execute(token, create('command_licensed_5')),
    ).rejects.toBeInstanceOf(CareerLimitReachedError);
    const list = await app.careers(token);
    expect(list.careers).toHaveLength(5);
    expect(list.limits).toEqual({ ...LICENSED_ENTITLEMENTS, activeCareers: 5 });
    expect(await app.entitlementsFor(stranger)).toEqual(FREE_ENTITLEMENTS);
  });

  it('lets only the owner delete a career, which frees the slot', async () => {
    const { app, token, stranger } = setup();
    const first = await app.execute(token, create('command_owned'));
    const remove = command('DeleteCareer', 'command_delete', 1, {
      careerId: first.careerId,
    });
    await expect(
      app.execute(stranger, { ...remove, idempotencyKey: 'idem-stranger' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      app.execute(token, {
        ...remove,
        idempotencyKey: 'idem-stale',
        expectedVersion: 7,
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const deleted = await app.execute(token, remove);
    expect(deleted.aggregateVersion).toBe(2);
    expect(await app.execute(token, remove)).toEqual(deleted);
    await expect(app.home(token, first.careerId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await app.careers(token)).careers).toHaveLength(0);
    await expect(
      app.execute(token, { ...remove, idempotencyKey: 'idem-again' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const second = await app.execute(token, create('command_replacement'));
    expect(second.careerId).not.toBe(first.careerId);
    expect((await app.careers(token)).limits.activeCareers).toBe(1);
  });

  it('fails a pending simulation of a deleted career without retrying it', async () => {
    const { app, token, careerId } = await careerWith('estrategista');
    const advanced = await app.execute(
      token,
      command('AdvanceDate', 'command_pending', 2, { careerId }),
    );
    await app.execute(
      token,
      command('DeleteCareer', 'command_delete_pending', 3, { careerId }),
    );
    const status = await app.runNextJob();
    expect(status).toMatchObject({
      jobId: advanced.jobId,
      state: 'failed',
      errorCode: 'CAREER_NOT_FOUND',
    });
    expect(await app.runNextJob()).toBeUndefined();
  });
});

describe('public stats', () => {
  it('counts distinct coaches with active careers and the canonical catalog', async () => {
    const entitlements = new InMemoryEntitlements(['user_owner']);
    const { app, token, stranger } = setup(entitlements);
    const content = catalogCareerContent.load();
    expect(await app.publicStats()).toEqual({
      version: 1,
      coaches: 0,
      clubs: content.clubs.length,
      athletes: content.players.length,
    });
    await app.execute(token, create('command_stats_a'));
    await app.execute(token, create('command_stats_b'));
    const theirs = await app.execute(stranger, create('command_stats_c'));
    expect((await app.publicStats()).coaches).toBe(2);
    await app.execute(
      stranger,
      command('DeleteCareer', 'command_stats_delete', 1, {
        careerId: theirs.careerId,
      }),
    );
    const stats = await app.publicStats();
    expect(stats.coaches).toBe(1);
    expect(stats.clubs).toBeGreaterThan(0);
    expect(stats.athletes).toBeGreaterThan(stats.clubs);
  });
});

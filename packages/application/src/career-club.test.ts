/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the clubs picked here */
import { InMemoryUnitOfWork } from '@footebas/database';
import { leaveClub, type CanonicalValue } from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryJobQueue,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  SequentialIdGenerator,
  UnifiedPhaseFourRepository,
  careerSaveRepository,
  catalogCareerContent,
  runClubDay,
  workPerformance,
  type CareerSnapshot,
} from './index.js';

const content = catalogCareerContent.load();

function setup() {
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
  const saves = () => careerSaveRepository(unitOfWork.repositories().saves);
  return { app, world, token, saves };
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

async function start(
  context: ReturnType<typeof setup>,
  clubId = 'club_flamengo',
) {
  const { app, token } = context;
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
      clubId,
    }),
  );
  return created.careerId;
}

/** Edits the stored snapshot directly (world state a season would reach). */
async function edit(
  context: ReturnType<typeof setup>,
  careerId: string,
  work: (snapshot: CareerSnapshot) => void,
) {
  const save = (await context.saves().peek(careerId))!;
  const snapshot = structuredClone(save.snapshot) as unknown as CareerSnapshot;
  work(snapshot);
  await context.saves().update(save.id, save.userId, save.version, {
    snapshot: snapshot as unknown as CanonicalValue,
    seed: save.seed,
    versions: save.versions,
  });
}

async function phaseFour(
  context: ReturnType<typeof setup>,
  careerId: string,
  type: string,
  payload: object,
) {
  const { aggregateVersion } = await context.app.careerWorld(
    context.token,
    careerId,
  );
  return context.world.execute('user_owner', {
    version: 1,
    careerId,
    commandId: `command_${type.toLowerCase()}_${String(aggregateVersion)}`,
    idempotencyKey: `idem-${type}-${String(aggregateVersion)}`,
    expectedVersion: aggregateVersion,
    type,
    payload,
  });
}

describe('base do clube (peneiras e jovens destaques)', () => {
  it('abre a base com a primeira peneira, um destaque e aviso na caixa de entrada', async () => {
    const context = setup();
    const careerId = await start(context);
    const world = await context.app.careerWorld(context.token, careerId);
    expect(world.youth).toHaveLength(5);
    const highlights = world.youth.filter(({ highlight }) => highlight);
    expect(highlights.length).toBeGreaterThanOrEqual(1);
    expect(highlights.length).toBeLessThanOrEqual(2);
    expect(highlights[0]?.estimate).not.toBe('limited');
    expect(world.youth.every(({ status }) => status === 'academy')).toBe(true);
    expect(world.youth.every(({ traits }) => traits.length >= 1)).toBe(true);
    expect(world.academy).toMatchObject({
      prospects: 5,
      capacity: 14,
      nextIntakeOn: '2026-02-01',
      minPromotionAge: 17,
    });
    const home = await context.app.home(context.token, careerId);
    expect(
      home.inbox.some(({ topic }) => topic === 'notice_youth_intake'),
    ).toBe(true);
  });

  it('sobe um jovem de 17+ com contrato e salário; recusa quem é novo demais', async () => {
    const context = setup();
    const careerId = await start(context);
    const world = await context.app.careerWorld(context.token, careerId);
    const ready = world.youth.find(({ age }) => age >= 17);
    const young = world.youth.find(({ age }) => age < 17);
    if (young)
      await expect(
        phaseFour(context, careerId, 'PromoteYouth', {
          playerId: young.playerId,
        }),
      ).rejects.toThrow(/a partir dos 17/);
    expect(ready).toBeDefined();
    await phaseFour(context, careerId, 'PromoteYouth', {
      playerId: ready!.playerId,
    });
    const after = await context.app.careerWorld(context.token, careerId);
    expect(
      after.youth.find(({ playerId }) => playerId === ready!.playerId)?.status,
    ).toBe('promoted');
    const contract = after.contracts.find(
      ({ playerId }) => playerId === ready!.playerId,
    );
    expect(contract?.wage).toBeGreaterThan(0);
    const squad = await context.app.squad(context.token, careerId);
    expect(squad.players.some(({ id }) => id === ready!.playerId)).toBe(true);
  });
});

describe('estádio: ampliação com retorno e manutenção avulsa', () => {
  it('cobra a obra do caixa, mostra a obra em andamento e abre os lugares na data', async () => {
    const context = setup();
    const careerId = await start(context);
    const before = await context.app.careerWorld(context.token, careerId);
    const plan = before.club!.stadium.expansionPlans.find(
      ({ id }) => id === 'small',
    )!;
    await phaseFour(context, careerId, 'ExpandStadium', {
      clubId: 'club_flamengo',
      plan: 'small',
    });
    const during = await context.app.careerWorld(context.token, careerId);
    expect(during.club!.cash).toBe(before.club!.cash - plan.cost);
    expect(during.club!.stadium.expansion).toMatchObject({
      addedCapacity: plan.addedCapacity,
      completesOn: plan.completesOn,
    });
    expect(during.club!.stadium.expansionPlans).toEqual([]);
    expect(during.ledger[0]).toMatchObject({ kind: 'stadium' });
    await expect(
      phaseFour(context, careerId, 'ExpandStadium', {
        clubId: 'club_flamengo',
        plan: 'small',
      }),
    ).rejects.toThrow(/obra em andamento/);

    await edit(context, careerId, (snapshot) =>
      runClubDay(snapshot, {
        date: plan.completesOn,
        seed: 'seed',
        form: [],
      }),
    );
    const done = await context.app.careerWorld(context.token, careerId);
    expect(done.club!.stadium.capacity).toBe(
      before.club!.stadium.capacity + plan.addedCapacity,
    );
    expect(done.club!.stadium.expansion).toBeUndefined();
    const home = await context.app.home(context.token, careerId);
    expect(home.inbox.some(({ topic }) => topic === 'notice_stadium')).toBe(
      true,
    );
  });

  it('manutenção avulsa recupera a qualidade e lança a despesa', async () => {
    const context = setup();
    const careerId = await start(context);
    const before = await context.app.careerWorld(context.token, careerId);
    const repairs = before.club!.stadium.maintenancePlans.find(
      ({ id }) => id === 'repairs',
    )!;
    await phaseFour(context, careerId, 'MaintainStadium', {
      clubId: 'club_flamengo',
      plan: 'repairs',
    });
    const after = await context.app.careerWorld(context.token, careerId);
    expect(after.club!.stadium.quality).toBe(
      before.club!.stadium.quality + repairs.qualityGain,
    );
    expect(after.club!.cash).toBe(before.club!.cash - repairs.cost);
    expect(after.club!.stadium.lastMaintenanceOn).toBe('2026-01-01');
    expect(after.club!.stadium.demand).toBeGreaterThan(0);
  });
});

describe('propostas de emprego durante a temporada', () => {
  it('treinador sem clube recebe propostas no mês seguinte', async () => {
    const context = setup();
    const careerId = await start(context);
    await edit(context, careerId, (snapshot) => {
      snapshot.world.manager = leaveClub(
        snapshot.world.manager,
        '2026-02-15',
        'fired',
      );
      runClubDay(snapshot, { date: '2026-03-02', seed: 'seed', form: [] });
    });
    const world = await context.app.careerWorld(context.token, careerId);
    const open = world.jobProposals.filter(({ status }) => status === 'open');
    expect(open).toHaveLength(3);
    expect(open.every(({ reason }) => reason === 'reemployment')).toBe(true);
  });

  it('bom trabalho traz clubes maiores; aceitar troca o clube e os objetivos', async () => {
    const context = setup();
    const clubId = [...content.divisions['serie-c']].sort(
      (left, right) =>
        Number(content.clubs.find(({ id }) => id === left)!.reputation) -
        Number(content.clubs.find(({ id }) => id === right)!.reputation),
    )[0]!;
    const careerId = await start(context, clubId);
    const current = Number(
      content.clubs.find(({ id }) => id === clubId)!.reputation,
    );
    await edit(context, careerId, (snapshot) => {
      snapshot.world.manager = {
        ...snapshot.world.manager,
        boardConfidence: 90,
      };
      for (const month of ['04', '05', '06', '07', '08', '09', '10', '11']) {
        const date = `2026-${month}-02`;
        runClubDay(snapshot, {
          date,
          seed: 'seed',
          form: ['W', 'W', 'W', 'W', 'W'],
          league: { position: 1, rounds: 10 },
        });
        snapshot.currentDate = date;
        if (snapshot.world.jobProposals.some(({ status }) => status === 'open'))
          break;
      }
    });
    const world = await context.app.careerWorld(context.token, careerId);
    expect(world.jobProposals.length).toBeGreaterThan(0);
    expect(
      world.jobProposals.every(({ reputation }) => reputation > current),
    ).toBe(true);
    const offer = world.jobProposals.find(({ status }) => status === 'open');
    expect(offer).toBeDefined();
    await phaseFour(context, careerId, 'AcceptJobProposal', {
      proposalId: offer!.id,
    });
    const moved = await context.app.careerWorld(context.token, careerId);
    expect(moved.manager.clubId).toBe(offer!.clubId);
    expect(moved.club?.id).toBe(offer!.clubId);
    expect(moved.objectives.every(({ status }) => status === 'active')).toBe(
      true,
    );
    expect(
      moved.jobProposals.filter(({ status }) => status === 'open'),
    ).toEqual([]);
  });
});

describe('desempenho que guia as propostas', () => {
  it('a meta da temporada vale mesmo depois de julgada (2ª temporada em diante)', () => {
    const manager = {
      managerId: 'manager_1',
      employmentStatus: 'employed' as const,
      boardConfidence: 50,
      fanConfidence: 50,
      prestige: 0,
      seasons: 1,
      appointments: [],
    };
    const objective = {
      id: 'objective_1',
      metric: 'league_position' as const,
      target: 10,
      progress: 12,
      weight: 15,
      status: 'failed' as const,
    };
    const league = { position: 2, rounds: 12 };
    expect(workPerformance(manager, [objective], [], league)).toBeGreaterThan(
      0.4,
    );
    expect(
      workPerformance(manager, [objective], [], { position: 19, rounds: 12 }),
    ).toBeLessThan(-0.4);
  });
});

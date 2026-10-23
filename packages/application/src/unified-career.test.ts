/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club and its contracts */
import { InMemoryUnitOfWork } from '@footebas/database';
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
} from './index.js';

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
  return { app, world, token };
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

async function start(app: FootebasApplication, token: string) {
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

async function advance(
  app: FootebasApplication,
  token: string,
  careerId: string,
  step: number,
) {
  const { aggregateVersion } = await app.home(token, careerId);
  await app.execute(
    token,
    command(
      'AutoPickLineup',
      `command_pick_${String(step)}`,
      aggregateVersion,
      {
        careerId,
        clubId: (await app.home(token, careerId)).club?.id ?? 'club_flamengo',
        formation: '4-4-2',
        mode: 'best',
      },
    ),
  );
  await app.execute(
    token,
    command(
      'AdvanceDate',
      `command_advance_${String(step)}`,
      aggregateVersion + 1,
      {
        careerId,
      },
    ),
  );
  return app.runNextJob();
}

describe('carreira única: mundo, competições e partida no mesmo save', () => {
  it('emprega o treinador no clube escolhido com objetivos da diretoria', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    const world = await app.careerWorld(token, careerId);
    expect(world.manager).toMatchObject({
      employmentStatus: 'employed',
      clubId: 'club_flamengo',
    });
    expect(world.objectives.map(({ metric }) => metric)).toContain(
      'league_position',
    );
    expect(world.club?.stadium.capacity).toBeGreaterThan(30_000);
    expect(world.contracts.length).toBeGreaterThanOrEqual(18);
  });

  it('aplica comandos da Fase 4 na mesma versão do agregado', async () => {
    const { app, world: phaseFour, token } = setup();
    const careerId = await start(app, token);
    const before = await app.careerWorld(token, careerId);
    const receipt = await phaseFour.execute('user_owner', {
      version: 1,
      careerId,
      commandId: 'command_ticket',
      idempotencyKey: 'idem-ticket',
      expectedVersion: before.aggregateVersion,
      type: 'SetTicketPrice',
      payload: { clubId: 'club_flamengo', ticketPrice: 9_000 },
    });
    expect(receipt.aggregateVersion).toBe(before.aggregateVersion + 1);
    const after = await app.careerWorld(token, careerId);
    expect(after.club?.stadium.ticketPrice).toBe(9_000);
    await expect(
      app.execute(
        token,
        command('AutoPickLineup', 'command_stale', before.aggregateVersion, {
          careerId,
          clubId: 'club_flamengo',
          formation: '4-3-3',
          mode: 'best',
        }),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      phaseFour.execute('user_stranger', {
        version: 1,
        careerId,
        commandId: 'command_steal',
        idempotencyKey: 'idem-steal',
        expectedVersion: after.aggregateVersion,
        type: 'SetTicketPrice',
        payload: { clubId: 'club_flamengo', ticketPrice: 1 },
      }),
    ).rejects.toThrow(/does not belong/);
  });

  it('liquida bilheteria, patrocínio e salários a cada mês jogado', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    for (let step = 0; step < 12; step++) {
      await advance(app, token, careerId, step);
      if ((await app.home(token, careerId)).currentDate >= '2026-02-15') break;
    }
    const world = await app.careerWorld(token, careerId);
    const kinds = new Set(world.ledger.map(({ kind }) => kind));
    expect(kinds).toEqual(new Set(['gate', 'sponsor', 'wages']));
    const wages = world.ledger.find(({ kind }) => kind === 'wages')!;
    expect(wages.amount).toBe(-world.club!.monthlyWageBill);
    expect(wages.label).toBe('Folha salarial · 2026-01');
  });

  it(
    'fecha a temporada com prêmios, história, diretoria e elencos jogáveis',
    { timeout: 300_000 },
    async () => {
      const { app, token } = setup();
      const careerId = await start(app, token);
      for (let step = 0; step < 200; step++) {
        if ((await app.home(token, careerId)).season === 2) break;
        expect((await advance(app, token, careerId, step))?.state).toBe(
          'succeeded',
        );
      }
      const world = await app.careerWorld(token, careerId);
      expect(world.season).toBe(2);
      expect(world.manager.seasons).toBe(1);
      expect(world.objectives.every(({ status }) => status !== 'active')).toBe(
        true,
      );
      expect(world.history.filter(({ type }) => type === 'title')).toHaveLength(
        12,
      );
      expect(
        world.history.filter(({ type }) => type === 'promotion'),
      ).toHaveLength(8);
      expect(world.ledger).toHaveLength(0);
      expect(world.club?.openingBalance).not.toBe(25_000_000_000);
    },
  );
});

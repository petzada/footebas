/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment -- the fixture career always has a selected club, lineup and players; Vitest asymmetric matchers are dynamic */
import { describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '@footebas/database';
import {
  availableLineup,
  careerUnitOfWork,
  catalogCareerContent,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  type CareerSnapshot,
} from './index.js';

/**
 * Production bug: a starter injured or suspended in round N stayed in the
 * saved lineup, and SimulateMatch for round N+1 (instant result, skip and
 * the narrated match all send it) was refused with the domain's English
 * "injured or suspended players cannot be selected for matchday".
 */
function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const storage = new InMemoryUnitOfWork(clock);
  // The same full-state view of the saves the application works on.
  const unitOfWork = careerUnitOfWork(storage, catalogCareerContent);
  const app = new FootebasApplication({
    auth,
    clock,
    jobs: new InMemoryJobQueue(),
    ids: new SequentialIdGenerator(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: storage,
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, unitOfWork, token };
}
type Setup = ReturnType<typeof setup>;

let sequence = 0;
const command = (type: string, expectedVersion: number, payload: object) => {
  sequence += 1;
  const commandId = `command_${type.toLowerCase()}_${String(sequence)}`;
  return {
    version: 1,
    type,
    commandId,
    idempotencyKey: `idem-${commandId}`,
    expectedVersion,
    payload,
  };
};

async function career({ app, token }: Setup) {
  const created = await app.execute(
    token,
    command('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 1, {
      careerId: created.careerId,
      clubId: 'club_flamengo',
    }),
  );
  return created.careerId;
}

const version = async ({ app, token }: Setup, careerId: string) =>
  (await app.home(token, careerId)).aggregateVersion;

/** Instant result: SimulateMatch for the next fixture, no instructions. */
async function playRound(ctx: Setup, careerId: string) {
  const { app, token } = ctx;
  const next = await app.nextMatch(token, careerId);
  await app.execute(
    token,
    command('SimulateMatch', await version(ctx, careerId), {
      careerId,
      fixtureId: next.fixtureId,
    }),
  );
  expect((await app.runNextJob())?.state).toBe('succeeded');
  return next.fixtureId;
}

/**
 * What round N left in the save before the fix: players hurt or sent off
 * while the saved lineup still lists them.
 */
async function sideline(
  { unitOfWork }: Setup,
  careerId: string,
  changes: Readonly<
    Record<string, { injuryRounds?: number; suspensionRounds?: number }>
  >,
) {
  await unitOfWork.withCareerLock(careerId, async (tx) => {
    const save = (await tx.saves.load(careerId, 'user_owner'))!;
    const snapshot = structuredClone(
      save.snapshot,
    ) as unknown as CareerSnapshot;
    snapshot.players = snapshot.players.map((player) =>
      changes[player.id] ? { ...player, ...changes[player.id] } : player,
    );
    await tx.saves.update(careerId, 'user_owner', save.version, {
      snapshot: snapshot as unknown as typeof save.snapshot,
      seed: save.seed,
      versions: save.versions,
    });
  });
}

/** Round N played, then two starters and a substitute become unavailable. */
async function afterRoundWithAbsences(ctx: Setup) {
  const careerId = await career(ctx);
  await playRound(ctx, careerId);
  const squad = await ctx.app.squad(ctx.token, careerId);
  const lineup = squad.lineup!;
  const outfield = lineup.starters.filter(
    (id) => squad.players.find((player) => player.id === id)?.position !== 'GK',
  );
  const injured = outfield[0]!;
  const suspended = outfield[1]!;
  const benchInjured = lineup.bench[0]!;
  await sideline(ctx, careerId, {
    [injured]: { injuryRounds: 3 },
    [suspended]: { suspensionRounds: 1 },
    [benchInjured]: { injuryRounds: 2 },
  });
  return { careerId, unavailable: [injured, suspended, benchInjured] };
}

/** The saved lineup lists only players available right now. */
async function expectEligibleLineup(ctx: Setup, careerId: string) {
  const squad = await ctx.app.squad(ctx.token, careerId);
  const lineup = squad.lineup!;
  const out = new Set(
    squad.players
      .filter(({ availability }) => availability !== 'available')
      .map(({ id }) => id),
  );
  expect(lineup.starters).toHaveLength(11);
  expect(
    [...lineup.starters, ...lineup.bench].filter((id) => out.has(id)),
  ).toEqual([]);
}

/** Nobody who was sidelined before the round took part in it. */
async function expectSidelinedSkipped(
  ctx: Setup,
  careerId: string,
  unavailable: readonly string[],
) {
  const played = await ctx.app.postMatch(ctx.token, careerId);
  const participants = (played.participants ?? []).map(({ id }) => id);
  expect(participants.length).toBeGreaterThanOrEqual(22);
  expect(participants.filter((id) => unavailable.includes(id))).toEqual([]);
}

describe('matchday with injured or suspended starters', () => {
  it('instant result: the assistant swaps them and the round plays', async () => {
    const ctx = setup();
    const { careerId, unavailable } = await afterRoundWithAbsences(ctx);
    const fixtureId = await playRound(ctx, careerId);
    const played = await ctx.app.postMatch(ctx.token, careerId);
    expect(played.fixtureId).toBe(fixtureId);
    await expectSidelinedSkipped(ctx, careerId, unavailable);
    await expectEligibleLineup(ctx, careerId);
  });

  it('skip: the preview the web shows and the committed match agree', async () => {
    const ctx = setup();
    const { app, token } = ctx;
    const { careerId, unavailable } = await afterRoundWithAbsences(ctx);
    const next = await app.nextMatch(token, careerId);
    // "Pular para o resultado": begin (preview), then commit the same plan.
    const preview = await app.previewMatch(token, careerId, []);
    await app.execute(
      token,
      command('SimulateMatch', await version(ctx, careerId), {
        careerId,
        fixtureId: next.fixtureId,
        instructions: [],
      }),
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    const committed = await app.postMatch(token, careerId);
    expect(committed.fixtureId).toBe(next.fixtureId);
    expect(committed.score).toEqual(preview.score);
    expect(committed.timeline).toEqual(preview.timeline);
    await expectSidelinedSkipped(ctx, careerId, unavailable);
    await expectEligibleLineup(ctx, careerId);
  });

  it('narrated: a substitution on the fielded XI previews and commits', async () => {
    const ctx = setup();
    const { app, token, unitOfWork } = ctx;
    const { careerId, unavailable } = await afterRoundWithAbsences(ctx);
    const next = await app.nextMatch(token, careerId);
    const stored = (await unitOfWork.withCareerLock(careerId, (tx) =>
      tx.saves.peek(careerId),
    ))!.snapshot as unknown as CareerSnapshot;
    // The XI the assistant fields; the manager subs one of its starters.
    const fielded = availableLineup(stored)!;
    const outgoing = fielded.starters.at(-1)!;
    const incoming = fielded.substitutes.find(
      (id) =>
        stored.players.find((player) => player.id === id)?.position !== 'GK',
    )!;
    expect(unavailable).not.toContain(incoming);
    const instructions = [
      {
        type: 'substitution' as const,
        minute: 60 as const,
        side: next.homeClub.id === 'club_flamengo' ? 'home' : 'away',
        playerOutId: outgoing.playerId,
        playerInId: incoming,
        position: outgoing.position,
      },
    ];
    const preview = await app.previewMatch(token, careerId, instructions);
    await app.execute(
      token,
      command('SimulateMatch', await version(ctx, careerId), {
        careerId,
        fixtureId: next.fixtureId,
        instructions,
      }),
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    const committed = await app.postMatch(token, careerId);
    expect(committed.score).toEqual(preview.score);
    expect(committed.timeline).toEqual(preview.timeline);
    await expectSidelinedSkipped(ctx, careerId, unavailable);
    await expectEligibleLineup(ctx, careerId);
  });

  it('advancing the date (skip to the fixture) plays the round too', async () => {
    const ctx = setup();
    const { app, token } = ctx;
    const { careerId, unavailable } = await afterRoundWithAbsences(ctx);
    const next = await app.nextMatch(token, careerId);
    await app.execute(
      token,
      command('AdvanceDate', await version(ctx, careerId), {
        careerId,
        throughDate: next.date,
      }),
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    expect((await app.postMatch(token, careerId)).fixtureId).toBe(
      next.fixtureId,
    );
    await expectSidelinedSkipped(ctx, careerId, unavailable);
    await expectEligibleLineup(ctx, careerId);
  });

  it('keeps the saved lineup eligible round after round', async () => {
    const ctx = setup();
    const careerId = await career(ctx);
    for (let round = 0; round < 4; round++) {
      await playRound(ctx, careerId);
      await expectEligibleLineup(ctx, careerId);
    }
  });

  it('refuses in Portuguese when fewer than eleven players are eligible', async () => {
    const ctx = setup();
    const { app, token } = ctx;
    const careerId = await career(ctx);
    const squad = await app.squad(token, careerId);
    await sideline(
      ctx,
      careerId,
      Object.fromEntries(
        squad.players.slice(10).map(({ id }) => [id, { injuryRounds: 2 }]),
      ),
    );
    const next = await app.nextMatch(token, careerId);
    await expect(
      app.execute(
        token,
        command('SimulateMatch', await version(ctx, careerId), {
          careerId,
          fixtureId: next.fixtureId,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/^Só 10 jogadores do elenco estão aptos/),
    });
    await expect(app.previewMatch(token, careerId, [])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/São necessários 11/),
    });
  });

  it('refuses in Portuguese when every goalkeeper is out', async () => {
    const ctx = setup();
    const { app, token } = ctx;
    const careerId = await career(ctx);
    const squad = await app.squad(token, careerId);
    await sideline(
      ctx,
      careerId,
      Object.fromEntries(
        squad.players
          .filter(({ position }) => position === 'GK')
          .map(({ id }) => [id, { suspensionRounds: 1 }]),
      ),
    );
    const next = await app.nextMatch(token, careerId);
    await expect(
      app.execute(
        token,
        command('SimulateMatch', await version(ctx, careerId), {
          careerId,
          fixtureId: next.fixtureId,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/^Nenhum goleiro apto/),
    });
  });
});

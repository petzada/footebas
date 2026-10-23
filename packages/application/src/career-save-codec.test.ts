/* eslint-disable @typescript-eslint/no-non-null-assertion -- saves created in each test */
import { InMemoryUnitOfWork, checksumSnapshot } from '@footebas/database';
import { canonicalJson, type CanonicalValue } from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  CAREER_SAVE_SCHEMA,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  LEGACY_CAREER_SAVE_SCHEMA,
  NoopTelemetry,
  SaveCodecError,
  SequentialIdGenerator,
  careerChecksum,
  careerSaveRepository,
  catalogCareerContent,
  dehydrateCareer,
  hydrateCareer,
  storedSize,
  type CareerContent,
  type CareerSnapshot,
} from './index.js';

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token, unitOfWork };
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

async function career(rounds: number) {
  const context = setup();
  const { app, token } = context;
  const created = await app.execute(
    token,
    command('CreateCareer', 'command_create', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  const careerId = created.careerId;
  await app.execute(
    token,
    command('SelectClub', 'command_club', 1, {
      careerId,
      clubId: 'club_flamengo',
    }),
  );
  for (let step = 0; step < rounds; step++) {
    const { aggregateVersion } = await app.home(token, careerId);
    await app.execute(
      token,
      command(
        'AutoPickLineup',
        `command_pick_${String(step)}`,
        aggregateVersion,
        {
          careerId,
          clubId: 'club_flamengo',
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
        { careerId },
      ),
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
  }
  const raw = (await context.unitOfWork.repositories().saves.peek(careerId))!;
  const full = (await careerSaveRepository(
    context.unitOfWork.repositories().saves,
  ).peek(careerId))!;
  return {
    ...context,
    careerId,
    raw,
    snapshot: full.snapshot as unknown as CareerSnapshot,
  };
}

const content = catalogCareerContent.load();
const canonical = (value: unknown) => canonicalJson(value);
const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/** Same value with object keys inserted in reverse order. */
function shuffled<T>(value: T): T {
  if (Array.isArray(value)) return value.map(shuffled) as T;
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, shuffled(item)]),
  ) as T;
}

describe('save enxuto game-save-v3 (ADR 0014)', () => {
  it('guarda só o delta sobre o catálogo e reconstrói o mesmo estado', async () => {
    const { raw, snapshot } = await career(4);
    expect(raw.versions.schema).toBe(CAREER_SAVE_SCHEMA);
    const lean = dehydrateCareer(content, snapshot);
    const back = hydrateCareer(
      content,
      JSON.parse(JSON.stringify(lean)) as CanonicalValue,
    );
    expect(canonical(back)).toBe(canonical(snapshot));
    expect(careerChecksum(content, back)).toBe(
      careerChecksum(content, snapshot),
    );
    // Deterministic: insertion order of keys does not change the save.
    expect(canonical(dehydrateCareer(content, shuffled(snapshot)))).toBe(
      canonical(lean),
    );
    expect(checksumSnapshot(lean)).toBe(raw.checksum);
    const full = jsonBytes(snapshot);
    expect(full).toBeGreaterThan(2_000_000);
    expect(storedSize(raw.snapshot)).toBeLessThan(200_000);
    expect(storedSize(raw.snapshot) * 10).toBeLessThan(full);
  });

  it('cobre remoções, novos atletas, ordem, campos ausentes e strings com til', async () => {
    const { snapshot } = await career(0);
    const state = structuredClone(snapshot);
    const [first, second, third] = state.players;
    const retired = state.players.splice(5, 2);
    expect(retired).toHaveLength(2);
    state.players[0] = {
      ...first!,
      age: first!.age + 3,
      condition: 55,
    } as never;
    const withoutRating = { ...second! } as Record<string, unknown>;
    delete withoutRating.preferredSide;
    withoutRating.lastMatchRating = 7.3;
    state.players[1] = withoutRating as never;
    state.players.push({
      ...third!,
      id: 'player_youth_~til' as never,
      name: '~Jovem da base',
    });
    // Reordered: the youth first.
    state.players.unshift(state.players.pop()!);
    state.clubs[0] = { ...state.clubs[0]!, name: '~Clube' };
    state.world.contracts = state.world.contracts.filter(
      (_, index) => index % 3 !== 0,
    );
    (state as unknown as Record<string, unknown>).careerName = '~~til duplo';
    (state.world as unknown as Record<string, unknown>).gate = {
      club_flamengo: 0,
      club_x: null,
    };
    const back = hydrateCareer(
      content,
      JSON.parse(
        JSON.stringify(dehydrateCareer(content, state)),
      ) as CanonicalValue,
    );
    expect(canonical(back)).toBe(canonical(state));
  });

  it('recusa catálogo de outra versão ou com base alterada', async () => {
    const { snapshot } = await career(0);
    const lean = dehydrateCareer(content, snapshot);
    const other: CareerContent = { ...content, version: 'catalog-next' };
    expect(() => hydrateCareer(other, lean)).toThrow(SaveCodecError);
    const drifted: CareerContent = {
      ...content,
      players: content.players.map((player, index) =>
        index === 0 ? { ...player, strength: 1 as never } : player,
      ),
    };
    expect(() => hydrateCareer(drifted, lean)).toThrow(/baseline changed/);
  });

  it('migra saves v2 ao carregar e grava v3 no próximo comando', async () => {
    const { app, token, unitOfWork, careerId, snapshot } = await career(1);
    const repos = unitOfWork.repositories();
    const current = (await repos.saves.peek(careerId))!;
    await repos.saves.update(careerId, current.userId, current.version, {
      snapshot: snapshot as unknown as CanonicalValue,
      seed: current.seed,
      versions: { ...current.versions, schema: LEGACY_CAREER_SAVE_SCHEMA },
    });
    const legacy = (await repos.saves.peek(careerId))!;
    expect(legacy.versions.schema).toBe(LEGACY_CAREER_SAVE_SCHEMA);
    expect(storedSize(legacy.snapshot)).toBeGreaterThan(2_000_000);
    const home = await app.home(token, careerId);
    expect(home.club?.id).toBe('club_flamengo');
    expect((await app.careers(token)).careers).toHaveLength(1);
    await app.execute(
      token,
      command(
        'AutoPickLineup',
        'command_after_migration',
        home.aggregateVersion,
        {
          careerId,
          clubId: 'club_flamengo',
          formation: '4-3-3',
          mode: 'best',
        },
      ),
    );
    const migrated = (await unitOfWork.repositories().saves.peek(careerId))!;
    expect(migrated.versions.schema).toBe(CAREER_SAVE_SCHEMA);
    expect(storedSize(migrated.snapshot)).toBeLessThan(200_000);
    const after = (await careerSaveRepository(
      unitOfWork.repositories().saves,
    ).peek(careerId))!.snapshot as unknown as CareerSnapshot;
    expect(after.tactic?.formation).toBe('4-3-3');
    expect(canonical(after.players)).toBe(canonical(snapshot.players));
  });

  it('detecta save adulterado pelo checksum do que foi gravado', async () => {
    const { app, token, unitOfWork, careerId } = await career(0);
    const repos = unitOfWork.repositories();
    const current = (await repos.saves.peek(careerId))!;
    const state = (
      unitOfWork as unknown as {
        state: { saves: Map<string, { snapshot: Record<string, unknown> }> };
      }
    ).state;
    state.saves.get(careerId)!.snapshot = {
      ...(current.snapshot as Record<string, unknown>),
      year: 1999,
    };
    await expect(app.home(token, careerId)).rejects.toThrow(/checksum/);
  });
});

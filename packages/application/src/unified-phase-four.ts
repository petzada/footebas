import type {
  GameSave,
  TransactionContext,
  UnitOfWork,
} from '@footebas/database';
import type { CanonicalValue } from '@footebas/domain';
import type {
  PhaseFourState,
  PhaseFourStateRepository,
  StoredPhaseFourReceipt,
} from './phase-four-ports.js';
import { PhaseFourConflictError } from './phase-four-service.js';
import { syncManagedClub, type CareerSnapshot } from './service.js';
import { careerProfileOf } from './coach-personality.js';

const WORLD_FIELDS = [
  'manager',
  'contracts',
  'offers',
  'loans',
  'ledger',
  'stadiums',
  'youth',
  'objectives',
  'jobProposals',
  'history',
  'achievements',
  'events',
  'archiveKeys',
] as const;

export function phaseFourStateOf(save: GameSave): PhaseFourState {
  const snapshot = save.snapshot as unknown as CareerSnapshot;
  const { world } = snapshot;
  return structuredClone<PhaseFourState>({
    careerId: save.id,
    userId: save.userId,
    version: save.version,
    schemaVersion: world.schemaVersion,
    currentDate: snapshot.currentDate,
    season: snapshot.competition.year,
    clubs: snapshot.clubs,
    players: snapshot.players,
    manager: world.manager,
    contracts: world.contracts,
    offers: world.offers,
    loans: world.loans,
    ledger: world.ledger,
    stadiums: world.stadiums,
    youth: world.youth,
    objectives: world.objectives,
    jobProposals: world.jobProposals,
    history: world.history,
    achievements: world.achievements,
    events: world.events,
    archiveKeys: world.archiveKeys,
    coachPersonality: careerProfileOf(snapshot).coach.personality,
  });
}

/**
 * Phase four commands and reads over the single career save: same version,
 * same lock and same idempotency store as every other career command.
 */
export class UnifiedPhaseFourRepository implements PhaseFourStateRepository {
  private readonly active = new Map<string, TransactionContext>();

  public constructor(private readonly unitOfWork: UnitOfWork) {}

  public async withLock<T>(
    careerId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.unitOfWork.withCareerLock(careerId, async (tx) => {
      this.active.set(careerId, tx);
      try {
        return await work();
      } finally {
        this.active.delete(careerId);
      }
    });
  }

  private run<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const tx = this.active.get(careerId);
    return tx === undefined
      ? this.unitOfWork.withCareerLock(careerId, work)
      : work(tx);
  }

  public load(careerId: string): Promise<PhaseFourState | undefined> {
    return this.run(careerId, async (tx) => {
      const save = await tx.saves.peek(careerId);
      return save === undefined ? undefined : phaseFourStateOf(save);
    });
  }

  public save(state: PhaseFourState, expectedVersion: number): Promise<void> {
    return this.run(state.careerId, (tx) =>
      this.write(tx, state, expectedVersion),
    );
  }

  private async write(
    tx: TransactionContext,
    state: PhaseFourState,
    expectedVersion: number,
  ): Promise<void> {
    const save = await tx.saves.peek(state.careerId);
    if (save === undefined)
      throw new PhaseFourConflictError(`career ${state.careerId} not found`);
    if (save.version !== expectedVersion)
      throw new PhaseFourConflictError(
        `expected version ${String(expectedVersion)}, found ${String(save.version)}`,
      );
    const snapshot = structuredClone(
      save.snapshot,
    ) as unknown as CareerSnapshot;
    snapshot.clubs = [...state.clubs];
    snapshot.players = [...state.players];
    snapshot.world = {
      ...snapshot.world,
      schemaVersion: state.schemaVersion,
      ...(Object.fromEntries(
        WORLD_FIELDS.map((field) => [field, state[field]]),
      ) as Pick<CareerSnapshot['world'], (typeof WORLD_FIELDS)[number]>),
    };
    syncManagedClub(snapshot);
    await tx.saves.update(save.id, save.userId, expectedVersion, {
      snapshot: snapshot as unknown as CanonicalValue,
      seed: save.seed,
      versions: save.versions,
    });
  }

  private async storedReceipt(
    tx: TransactionContext,
    careerId: string,
    key: string,
  ): Promise<StoredPhaseFourReceipt | undefined> {
    const stored = await tx.commands.load(careerId, key);
    return stored?.response as unknown as StoredPhaseFourReceipt | undefined;
  }

  public receipt(
    careerId: string,
    idempotencyKey: string,
  ): Promise<StoredPhaseFourReceipt | undefined> {
    return this.run(careerId, (tx) =>
      this.storedReceipt(tx, careerId, `phase4_key:${idempotencyKey}`),
    );
  }

  public receiptByCommandId(
    careerId: string,
    commandId: string,
  ): Promise<StoredPhaseFourReceipt | undefined> {
    return this.run(careerId, (tx) =>
      this.storedReceipt(tx, careerId, `phase4_command:${commandId}`),
    );
  }

  public saveReceipt(
    careerId: string,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void> {
    return this.run(careerId, (tx) =>
      tx.commands.save({
        careerId,
        commandId: `phase4_key:${idempotencyKey}`,
        response: record as unknown as CanonicalValue,
        createdAt: new Date(0).toISOString(),
      }),
    );
  }

  public commit(
    state: PhaseFourState,
    expectedVersion: number,
    idempotencyKey: string,
    record: StoredPhaseFourReceipt,
  ): Promise<void> {
    return this.run(state.careerId, async (tx) => {
      await this.write(tx, state, expectedVersion);
      for (const key of [
        `phase4_key:${idempotencyKey}`,
        `phase4_command:${record.receipt.commandId}`,
      ])
        await tx.commands.save({
          careerId: state.careerId,
          commandId: key,
          response: record as unknown as CanonicalValue,
          createdAt: new Date(0).toISOString(),
        });
    });
  }

  public checksum(careerId: string): Promise<string | undefined> {
    return this.run(
      careerId,
      async (tx) => (await tx.saves.peek(careerId))?.checksum,
    );
  }
}

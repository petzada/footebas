import type { CanonicalValue } from '@footebas/domain';
import type postgres from 'postgres';
import {
  assertRequiredMetadata,
  checksumSnapshot,
  type Clock,
  type GameSave,
  type NewGameSave,
  type SaveUpdate,
  type SaveVersions,
} from './model.js';
import {
  SaveConflictError,
  SaveNotFoundError,
  SaveOwnershipError,
  type CommandReceipt,
  type CommandRepository,
  type GameSaveRepository,
  type TransactionContext,
  type UnitOfWork,
} from './ports.js';

type Sql = postgres.Sql | postgres.TransactionSql;

interface SaveRow {
  id: string;
  user_id: string;
  snapshot: CanonicalValue;
  checksum: string;
  seed: string;
  versions: SaveVersions;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function toSave(row: SaveRow): GameSave {
  return {
    id: row.id,
    userId: row.user_id,
    snapshot: row.snapshot,
    checksum: row.checksum,
    seed: row.seed,
    versions: row.versions,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

class PostgresSaveRepository implements GameSaveRepository {
  public constructor(
    private readonly sql: Sql,
    private readonly clock: Clock,
  ) {}

  public async create(input: NewGameSave): Promise<GameSave> {
    assertRequiredMetadata(input.seed, input.versions);
    const instant = this.clock.now().toISOString();
    const rows = await this.sql<SaveRow[]>`
      insert into footebas.game_saves
        (id, user_id, snapshot, checksum, seed, versions, version, created_at, updated_at)
      values (
        ${input.id}, ${input.userId}, ${this.sql.json(input.snapshot)},
        ${checksumSnapshot(input.snapshot)}, ${input.seed},
        ${this.sql.json(input.versions as never)}, 1, ${instant}, ${instant}
      )
      on conflict (id) do nothing
      returning *`;
    const row = rows[0];
    if (row === undefined)
      throw new SaveConflictError(`save ${input.id} already exists`);
    return toSave(row);
  }

  public async load(id: string, userId: string): Promise<GameSave | undefined> {
    const save = await this.peek(id);
    if (save !== undefined && save.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    return save;
  }

  public async peek(id: string): Promise<GameSave | undefined> {
    const rows = await this.sql<SaveRow[]>`
      select * from footebas.game_saves where id = ${id}`;
    return rows[0] === undefined ? undefined : toSave(rows[0]);
  }

  public async listByUser(userId: string): Promise<readonly GameSave[]> {
    const rows = await this.sql<SaveRow[]>`
      select * from footebas.game_saves
      where user_id = ${userId}
      order by created_at`;
    return rows.map(toSave);
  }

  public async update(
    id: string,
    userId: string,
    expectedVersion: number,
    update: SaveUpdate,
  ): Promise<GameSave> {
    assertRequiredMetadata(update.seed, update.versions);
    const rows = await this.sql<SaveRow[]>`
      update footebas.game_saves set
        snapshot = ${this.sql.json(update.snapshot)},
        checksum = ${checksumSnapshot(update.snapshot)},
        seed = ${update.seed},
        versions = ${this.sql.json(update.versions as never)},
        version = version + 1,
        updated_at = ${this.clock.now().toISOString()}
      where id = ${id} and user_id = ${userId} and version = ${expectedVersion}
      returning *`;
    const row = rows[0];
    if (row !== undefined) return toSave(row);
    const current = await this.peek(id);
    if (current === undefined)
      throw new SaveNotFoundError(`save ${id} not found`);
    if (current.userId !== userId)
      throw new SaveOwnershipError(`save ${id} does not belong to user`);
    throw new SaveConflictError(
      `expected version ${String(expectedVersion)}, found ${String(current.version)}`,
    );
  }
}

interface ReceiptRow {
  career_id: string;
  command_id: string;
  response: CanonicalValue;
  created_at: Date | string;
}

class PostgresCommandRepository implements CommandRepository {
  public constructor(private readonly sql: Sql) {}

  public async load<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
  ): Promise<CommandReceipt<T> | undefined> {
    const rows = await this.sql<ReceiptRow[]>`
      select * from footebas.command_receipts
      where career_id = ${careerId} and command_id = ${commandId}`;
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          careerId: row.career_id,
          commandId: row.command_id,
          response: row.response as T,
          createdAt: iso(row.created_at),
        };
  }

  public async save<T extends CanonicalValue>(
    receipt: CommandReceipt<T>,
  ): Promise<void> {
    await this.sql`
      insert into footebas.command_receipts (career_id, command_id, response, created_at)
      values (${receipt.careerId}, ${receipt.commandId},
              ${this.sql.json(receipt.response)}, ${receipt.createdAt})
      on conflict (career_id, command_id) do nothing`;
  }
}

/**
 * Supabase Postgres persistence. Each career command runs in one transaction
 * holding a transaction-scoped advisory lock on the career id, so commands of
 * the same career serialize while different careers run in parallel.
 */
export class PostgresUnitOfWork implements UnitOfWork {
  public constructor(
    private readonly sql: postgres.Sql,
    private readonly clock: Clock,
  ) {}

  public async withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return (await this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${careerId}, 0))`;
      return work({
        saves: new PostgresSaveRepository(tx, this.clock),
        commands: new PostgresCommandRepository(tx),
      });
    })) as T;
  }

  public executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.withCareerLock(careerId, async (tx) => {
      const previous = await tx.commands.load<T>(careerId, commandId);
      if (previous) return previous.response;
      const response = await work(tx);
      await tx.commands.save({
        careerId,
        commandId,
        response,
        createdAt: this.clock.now().toISOString(),
      });
      return response;
    });
  }
}

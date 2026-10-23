/* eslint-disable @typescript-eslint/no-non-null-assertion -- statements recorded by each test */
// Round trips of the Postgres unit of work, against a fake `sql` tag that
// records each statement (no database): CreateCareer's limit check must cost
// two statements after BEGIN, with both locks taken before anything is read.
import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import type { CanonicalValue } from '@footebas/domain';
import { PostgresUnitOfWork } from './postgres.js';
import type { TransactionContext } from './ports.js';

interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}
type Responder = (statement: Statement) => readonly unknown[];

function fakeSql(respond: Responder) {
  const statements: Statement[] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const statement = {
      text: strings.join('?').replace(/\s+/g, ' ').trim(),
      values,
    };
    statements.push(statement);
    return Promise.resolve(respond(statement));
  };
  const sql = Object.assign(tag, {
    json: (value: unknown) => value,
    async begin(work: (tx: unknown) => Promise<unknown>) {
      statements.push({ text: 'begin', values: [] });
      try {
        const result = await work(sql);
        statements.push({ text: 'commit', values: [] });
        return result;
      } catch (error) {
        statements.push({ text: 'rollback', values: [] });
        throw error;
      }
    },
  });
  return { sql: sql as unknown as postgres.Sql, statements };
}

const clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };
const instant = '2026-01-01T00:00:00.000Z';
const versions = { schema: 's', engine: 'e', rules: 'r', content: 'c' };
const snapshot = { lean: 'state' } as unknown as CanonicalValue;

/** Rows for the statements the create flow issues. */
function database(options: { receipt?: CanonicalValue; active?: number } = {}) {
  return fakeSql(({ text, values }) => {
    if (text.includes('pg_advisory_xact_lock')) return [{}];
    if (text.includes('exists ( select 1 from footebas.command_receipts'))
      return [
        {
          found: options.receipt !== undefined,
          response: options.receipt ?? null,
          active: options.active ?? 0,
        },
      ];
    if (text.startsWith('select count(*)::int as count'))
      return [{ count: options.active ?? 0 }];
    if (text.startsWith('insert into footebas.game_saves'))
      return [
        {
          id: values[0],
          user_id: values[1],
          checksum: values[3],
          seed: values[4],
          versions: values[5],
          version: 1,
          created_at: instant,
          updated_at: instant,
        },
      ];
    if (text.startsWith('select * from footebas.command_receipts')) return [];
    return [];
  });
}

const createWork = async (tx: TransactionContext) => {
  const active = await tx.saves.countActiveByUser('user_1');
  if (active >= 1) throw new Error('limit');
  const save = await tx.saves.create({
    id: 'career_1',
    userId: 'user_1',
    snapshot,
    seed: 'seed',
    versions,
  });
  return {
    careerId: save.id,
    aggregateVersion: save.version,
    stored: save.snapshot,
  } as unknown as CanonicalValue;
};

describe('PostgresUnitOfWork: CreateCareer em poucas idas ao banco', () => {
  it('trava carreira e usuário num comando e lê recibo e contagem noutro', async () => {
    const { sql, statements } = database();
    const response = await new PostgresUnitOfWork(sql, clock).executeIdempotent(
      'career_1',
      'idem-1',
      createWork,
      { countsCareersOf: 'user_1' },
    );
    expect(response).toEqual({
      careerId: 'career_1',
      aggregateVersion: 1,
      stored: snapshot,
    });
    expect(statements.map(({ text }) => text.slice(0, 40))).toEqual([
      'begin',
      'select pg_advisory_xact_lock(hashtextext',
      'select exists ( select 1 from footebas.c',
      'insert into footebas.game_saves (id, use',
      'insert into footebas.command_receipts (c',
      'commit',
    ]);
    // Career lock in the fenced subquery (taken first), then the user's.
    const locks = statements[1]!;
    expect(locks.text).toContain('offset 0');
    expect(locks.values).toEqual(['user-careers:user_1', 'career_1']);
    expect(statements[2]!.values).toEqual([
      'career_1',
      'idem-1',
      'career_1',
      'idem-1',
      'user_1',
    ]);
    // The insert does not ship the snapshot back.
    expect(statements[3]!.text).toContain(
      'returning id, user_id, checksum, seed, versions, version, created_at, updated_at',
    );
  });

  it('responde a repetição pelo recibo sem executar o trabalho', async () => {
    const receipt = { careerId: 'career_1', aggregateVersion: 1 };
    const { sql, statements } = database({ receipt, active: 1 });
    let ran = false;
    const response = await new PostgresUnitOfWork(sql, clock).executeIdempotent(
      'career_1',
      'idem-1',
      () => {
        ran = true;
        return Promise.resolve({});
      },
      { countsCareersOf: 'user_1' },
    );
    expect(response).toEqual(receipt);
    expect(ran).toBe(false);
    expect(statements.map(({ text }) => text.split(' ')[0])).toEqual([
      'begin',
      'select',
      'select',
      'commit',
    ]);
  });

  it('aplica o limite com a contagem lida sob as travas', async () => {
    const { sql, statements } = database({ active: 1 });
    await expect(
      new PostgresUnitOfWork(sql, clock).executeIdempotent(
        'career_1',
        'idem-1',
        createWork,
        { countsCareersOf: 'user_1' },
      ),
    ).rejects.toThrow('limit');
    expect(statements.at(-1)!.text).toBe('rollback');
    expect(statements.some(({ text }) => text.startsWith('insert'))).toBe(
      false,
    );
  });

  it('volta a travar e contar quando a transação já escreveu', async () => {
    const { sql, statements } = database();
    await new PostgresUnitOfWork(sql, clock).executeIdempotent(
      'career_1',
      'idem-1',
      async (tx) => {
        await tx.saves.create({
          id: 'career_1',
          userId: 'user_1',
          snapshot,
          seed: 'seed',
          versions,
        });
        return { active: await tx.saves.countActiveByUser('user_1') };
      },
      { countsCareersOf: 'user_1' },
    );
    const after = statements.slice(
      statements.findIndex(({ text }) => text.startsWith('insert')) + 1,
    );
    expect(after.map(({ text }) => text.slice(0, 32))).toEqual([
      'select pg_advisory_xact_lock(has',
      'select count(*)::int as count fr',
      'insert into footebas.command_rec',
      'commit',
    ]);
  });

  it('mantém o caminho sem dica: trava da carreira e recibo separados', async () => {
    const { sql, statements } = database();
    await new PostgresUnitOfWork(sql, clock).executeIdempotent(
      'career_1',
      'idem-1',
      () => Promise.resolve({ ok: true }),
    );
    expect(statements.map(({ text }) => text.slice(0, 40))).toEqual([
      'begin',
      'select pg_advisory_xact_lock(hashtextext',
      'select * from footebas.command_receipts ',
      'insert into footebas.command_receipts (c',
      'commit',
    ]);
    expect(statements[1]!.values).toEqual(['career_1']);
  });
});

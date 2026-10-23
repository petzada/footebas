import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import {
  FREE_ENTITLEMENTS,
  LICENSED_ENTITLEMENTS,
  PostgresEntitlements,
} from './entitlements-postgres.js';

/** Minimal tagged-template stand-in that records the query and its values. */
function fakeSql(rows: readonly unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(rows);
  };
  return { sql: sql as unknown as postgres.Sql, calls };
}

describe('PostgresEntitlements', () => {
  it('licença ativa vira plano licensed', async () => {
    const { sql, calls } = fakeSql([{ status: 'active' }]);
    await expect(new PostgresEntitlements(sql).forUser('u1')).resolves.toEqual(
      LICENSED_ENTITLEMENTS,
    );
    expect(calls[0]?.text).toContain('footebas.licenses');
    expect(calls[0]?.text).toContain("status = 'active'");
    expect(calls[0]?.values).toEqual(['u1']);
  });

  it('sem licença ativa é free', async () => {
    const { sql } = fakeSql([]);
    await expect(new PostgresEntitlements(sql).forUser('u2')).resolves.toEqual(
      FREE_ENTITLEMENTS,
    );
  });

  it('valores dos planos seguem a matriz de monetização', () => {
    expect(FREE_ENTITLEMENTS).toEqual({
      plan: 'free',
      maxCareers: 1,
      anyClub: false,
    });
    expect(LICENSED_ENTITLEMENTS).toEqual({
      plan: 'licensed',
      maxCareers: 5,
      anyClub: true,
    });
  });
});

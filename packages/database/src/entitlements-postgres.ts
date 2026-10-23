// Centralized entitlements backed by `footebas.licenses` (Fase 8, licença
// única via Woovi/PIX). The port mirrors `@footebas/application`'s
// `EntitlementsPort`; the types are declared here structurally identical so
// this adapter does not depend on that module landing first.
import type postgres from 'postgres';

export type Plan = 'free' | 'licensed';

export interface Entitlements {
  readonly plan: Plan;
  readonly maxCareers: number;
  readonly anyClub: boolean;
}

export interface EntitlementsPort {
  forUser(userId: string): Promise<Entitlements>;
}

export const FREE_ENTITLEMENTS: Entitlements = Object.freeze({
  plan: 'free',
  maxCareers: 1,
  anyClub: false,
});

export const LICENSED_ENTITLEMENTS: Entitlements = Object.freeze({
  plan: 'licensed',
  maxCareers: 5,
  anyClub: true,
});

export function entitlementsFor(plan: Plan): Entitlements {
  return plan === 'licensed' ? LICENSED_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

type Sql = postgres.Sql | postgres.TransactionSql;

/** Mirrors `@footebas/application`'s `CareerSlotsPort`. */
export interface CareerSlotsPort {
  activeCareerIds(userId: string): Promise<readonly string[]>;
}

/**
 * Creation order of a user's active careers (ids only, no snapshots): with
 * the entitlements it derives which careers are locked after a refund.
 */
export class PostgresCareerSlots implements CareerSlotsPort {
  public constructor(private readonly sql: Sql) {}

  public async activeCareerIds(userId: string): Promise<readonly string[]> {
    const rows = await this.sql<{ id: string }[]>`
      select id from footebas.game_saves
      where user_id = ${userId} and archived_at is null
      order by created_at, id`;
    return rows.map(({ id }) => id);
  }
}

/** An `active` license row means `licensed`; anything else is `free`. */
export class PostgresEntitlements implements EntitlementsPort {
  public constructor(private readonly sql: Sql) {}

  public async forUser(userId: string): Promise<Entitlements> {
    const rows = await this.sql<{ status: string }[]>`
      select status from footebas.licenses
      where user_id = ${userId} and status = 'active'
      limit 1`;
    return entitlementsFor(rows.length > 0 ? 'licensed' : 'free');
  }
}

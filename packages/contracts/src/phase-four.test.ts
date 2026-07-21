import { describe, expect, it } from 'vitest';
import {
  marketPlayerReadModelSchema,
  phaseFourCommandSchema,
  phaseFourEventSchema,
} from './index.js';

describe('phase four transport contracts', () => {
  it('requires authoritative version and idempotency metadata for every mutation', () => {
    const valid = {
      version: 1,
      commandId: 'command_offer',
      idempotencyKey: 'transfer:offer:1',
      expectedVersion: 3,
      careerId: 'career_1',
      type: 'SubmitTransferOffer',
      payload: {
        playerId: 'player_1',
        fromClubId: 'club_a',
        toClubId: 'club_b',
        kind: 'loan',
        fee: 0,
        wage: 10_000,
        expiresOn: '2026-08-01',
        loan: { endsOn: '2027-01-01', wageSharePercentage: 50 },
      },
    };
    expect(phaseFourCommandSchema.parse(valid)).toEqual(valid);
    expect(
      phaseFourCommandSchema.safeParse({ ...valid, expectedVersion: undefined })
        .success,
    ).toBe(false);
    expect(
      phaseFourCommandSchema.safeParse({ ...valid, idempotencyKey: 'x' })
        .success,
    ).toBe(false);
  });

  it('rejects malformed loan and expansion invariants at the boundary', () => {
    const base = {
      version: 1,
      commandId: 'command_offer',
      idempotencyKey: 'transfer:offer:1',
      expectedVersion: 0,
      careerId: 'career_1',
    };
    expect(
      phaseFourCommandSchema.safeParse({
        ...base,
        type: 'SubmitTransferOffer',
        payload: {
          playerId: 'player_1',
          toClubId: 'club_b',
          kind: 'loan',
          fee: 0,
          wage: 0,
          expiresOn: '2026-08-01',
          loan: { endsOn: '2027-01-01', wageSharePercentage: 101 },
        },
      }).success,
    ).toBe(false);
    expect(
      phaseFourCommandSchema.safeParse({
        ...base,
        type: 'ExpandStadium',
        payload: {
          clubId: 'club_a',
          addedCapacity: 99,
          cost: 0,
          completesOn: '2027-01-01',
        },
      }).success,
    ).toBe(false);
  });

  it('allows only qualitative hidden estimates in public market projections', () => {
    const visible = {
      id: 'player_1',
      name: 'Atleta',
      age: 20,
      position: 'ST',
      strength: 70,
      value: 100,
      wage: 10,
      scouting: {
        confidence: 50,
        estimates: {
          potential: 'good',
          consistency: 'good',
          injuryProneness: 'average',
          adaptation: 'good',
          professionalism: 'excellent',
          bigGame: 'good',
        },
      },
    };
    expect(marketPlayerReadModelSchema.safeParse(visible).success).toBe(true);
    expect(
      marketPlayerReadModelSchema.safeParse({
        ...visible,
        hidden: { potential: 80 },
      }).success,
    ).toBe(false);
  });

  it('validates audit events with sequence, command source and occurrence time', () => {
    expect(
      phaseFourEventSchema.safeParse({
        id: 'event_1',
        careerId: 'career_1',
        sequence: 1,
        type: 'SAVE_MIGRATED',
        occurredAt: '2026-07-21T12:00:00.000Z',
        gameDate: '2026-07-21',
        commandId: 'command_1',
        payload: { from: '3', to: '4' },
      }).success,
    ).toBe(true);
  });
});

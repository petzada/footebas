import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_PRICE_RANGE,
  coachMessageSchema,
  commandSchema,
} from './index.js';

const envelope = (type: string, payload: object) => ({
  version: 1,
  type,
  commandId: 'command_office',
  idempotencyKey: 'idem-office-1',
  expectedVersion: 3,
  payload,
});

describe('contratos do Escritório (ADR 0011)', () => {
  it('aceita os comandos de patrocínio e sócio-torcedor no envelope de carreira', () => {
    for (const command of [
      envelope('DecideSponsorshipOffer', {
        careerId: 'career_1',
        offerId: 'sponsor_offer_1',
        decision: 'accept',
      }),
      envelope('CounterSponsorshipOffer', {
        careerId: 'career_1',
        offerId: 'sponsor_offer_1',
        monthlyValue: 900_000_000,
      }),
      envelope('ConfigureFanMembership', {
        careerId: 'career_1',
        monthlyPrice: 4_000,
        tier: 'premium',
      }),
    ])
      expect(commandSchema.safeParse(command).success).toBe(true);
  });

  it('recusa preço fora da faixa, nível desconhecido e decisão inválida', () => {
    for (const command of [
      envelope('ConfigureFanMembership', {
        careerId: 'career_1',
        monthlyPrice: MEMBERSHIP_PRICE_RANGE.max + 1,
        tier: 'basic',
      }),
      envelope('ConfigureFanMembership', {
        careerId: 'career_1',
        monthlyPrice: 4_000,
        tier: 'vip',
      }),
      envelope('DecideSponsorshipOffer', {
        careerId: 'career_1',
        offerId: 'sponsor_offer_1',
        decision: 'counter',
      }),
      envelope('CounterSponsorshipOffer', {
        careerId: 'career_1',
        offerId: 'sponsor_offer_1',
        monthlyValue: 0,
      }),
    ])
      expect(commandSchema.safeParse(command).success).toBe(false);
  });

  it('a caixa de entrada aceita propostas de patrocínio com decisão', () => {
    expect(
      coachMessageSchema.safeParse({
        id: 'mail_sponsor_offer_1',
        kind: 'sponsor_offer',
        subject: 'Proposta de patrocínio',
        body: 'Oferta mensal.',
        occurredOn: '2026-01-01',
        decision: {
          id: 'decision_sponsor_offer_1',
          offerId: 'sponsor_offer_1',
          options: ['accept', 'reject', 'counter'],
          expiresOn: '2026-02-15',
        },
      }).success,
    ).toBe(true);
  });
});

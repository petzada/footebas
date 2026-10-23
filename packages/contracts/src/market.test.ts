import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  careerMarketQuerySchema,
  coachMessageSchema,
  phaseFourCommandSchema,
  transferWindowReadModelSchema,
} from './index.js';

const envelope = {
  version: 1,
  commandId: 'command_market',
  idempotencyKey: 'idem-market-1',
  expectedVersion: 3,
  careerId: 'career_one',
} as const;

describe('contratos do mercado (docs/adr/0008)', () => {
  it('lista para venda com preço pedido ou para empréstimo com duração e % de salário', () => {
    expect(
      phaseFourCommandSchema.parse({
        ...envelope,
        type: 'ListPlayerForTransfer',
        payload: { playerId: 'player_one', mode: 'sale', askingPrice: 500_000 },
      }).type,
    ).toBe('ListPlayerForTransfer');
    expect(
      phaseFourCommandSchema.safeParse({
        ...envelope,
        type: 'ListPlayerForTransfer',
        payload: {
          playerId: 'player_one',
          mode: 'loan',
          durationMonths: 6,
          wageSharePercentage: 50,
        },
      }).success,
    ).toBe(true);
    for (const payload of [
      { playerId: 'player_one', mode: 'sale' },
      {
        playerId: 'player_one',
        mode: 'loan',
        durationMonths: 13,
        wageSharePercentage: 50,
      },
      {
        playerId: 'player_one',
        mode: 'loan',
        durationMonths: 6,
        wageSharePercentage: 101,
      },
      {
        playerId: 'player_one',
        mode: 'sale',
        askingPrice: 1,
        durationMonths: 6,
      },
    ])
      expect(
        phaseFourCommandSchema.safeParse({
          ...envelope,
          type: 'ListPlayerForTransfer',
          payload,
        }).success,
      ).toBe(false);
    expect(
      phaseFourCommandSchema.parse({
        ...envelope,
        type: 'WithdrawTransferListing',
        payload: { playerId: 'player_one' },
      }).type,
    ).toBe('WithdrawTransferListing');
  });

  it('expõe códigos de erro de janela fechada e limite de elenco', () => {
    expect(
      apiErrorSchema.parse({
        version: 1,
        requestId: 'request_one',
        code: 'TRANSFER_WINDOW_CLOSED',
        message: 'transfer window is closed',
        nextWindowOpensOn: '2026-04-17',
      }).code,
    ).toBe('TRANSFER_WINDOW_CLOSED');
    expect(
      apiErrorSchema.parse({
        version: 1,
        requestId: 'request_one',
        code: 'SQUAD_LIMIT_REACHED',
        message: 'squad is full',
        clubId: 'club_one',
        maxSquadSize: 35,
      }).code,
    ).toBe('SQUAD_LIMIT_REACHED');
  });

  it('caixa de entrada aceita propostas com decisão; relatórios de partida seguem válidos', () => {
    expect(
      coachMessageSchema.parse({
        id: 'mail_offer_one',
        kind: 'transfer_offer',
        subject: 'Proposta',
        body: 'O clube quer o atleta.',
        occurredOn: '2026-01-10',
        decision: {
          id: 'decision_offer_one',
          offerId: 'offer_one',
          options: ['accept', 'reject', 'counter'],
          expiresOn: '2026-01-17',
        },
      }).decision?.offerId,
    ).toBe('offer_one');
    expect(
      coachMessageSchema.safeParse({
        id: 'mail_fixture_one',
        kind: 'match_report',
        situation: 'win',
        subject: 'Vitória',
        body: 'Grande jogo.',
        occurredOn: '2026-01-10',
      }).success,
    ).toBe(true);
  });

  it('janela e busca do mercado', () => {
    expect(
      transferWindowReadModelSchema.safeParse({
        rulesVersion: 'transfer-windows-v1',
        status: 'closed',
        next: {
          id: 'mid_season',
          name: 'Janela do meio do ano',
          opensOn: '2026-04-17',
          closesOn: '2026-05-08',
        },
        daysUntilNext: 10,
        windows: [
          {
            id: 'pre_season',
            name: 'Janela de pré-temporada',
            opensOn: '2026-01-01',
            closesOn: '2026-02-17',
          },
          {
            id: 'mid_season',
            name: 'Janela do meio do ano',
            opensOn: '2026-04-17',
            closesOn: '2026-05-08',
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      careerMarketQuerySchema.parse({
        origin: 'foreign',
        limit: 20,
        minStrength: 60,
      }),
    ).toEqual({ origin: 'foreign', limit: 20, minStrength: 60 });
    expect(careerMarketQuerySchema.safeParse({ limit: 500 }).success).toBe(
      false,
    );
  });
});

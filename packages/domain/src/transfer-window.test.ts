import { describe, expect, it } from 'vitest';
import {
  TRANSFER_WINDOW_RULES_VERSION,
  buyerCounterLimit,
  coachEffects,
  decideSellerResponse,
  isTransferWindowOpen,
  money,
  sellerAskingPrice,
  strength,
  transferWindowStatus,
  transferWindowsFor,
  type Position,
} from './index.js';

describe('janelas de transferência (docs/adr/0008)', () => {
  it('abrem duas vezes por temporada com datas versionadas', () => {
    expect(transferWindowsFor(2026)).toEqual([
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
    ]);
    expect(TRANSFER_WINDOW_RULES_VERSION).toBe('transfer-windows-v1');
  });

  it('abre, fecha e conta os dias restantes', () => {
    expect(transferWindowStatus('2026-01-01')).toMatchObject({
      open: true,
      current: { id: 'pre_season' },
      daysRemaining: 47,
      next: { id: 'mid_season', opensOn: '2026-04-17' },
    });
    expect(transferWindowStatus('2026-02-17')).toMatchObject({
      open: true,
      daysRemaining: 0,
    });
    const closed = transferWindowStatus('2026-02-18');
    expect(closed.open).toBe(false);
    expect(closed.current).toBeUndefined();
    expect(closed.next.opensOn).toBe('2026-04-17');
    expect(closed.daysUntilNext).toBe(58);
    expect(isTransferWindowOpen('2026-04-16')).toBe(false);
    expect(isTransferWindowOpen('2026-04-17')).toBe(true);
    expect(isTransferWindowOpen('2026-05-08')).toBe(true);
    expect(isTransferWindowOpen('2026-05-09')).toBe(false);
    expect(transferWindowStatus('2026-07-20').next).toMatchObject({
      id: 'pre_season',
      opensOn: '2027-01-01',
    });
  });

  it('segue o calendário em anos bissextos (dia da temporada desde 1º de janeiro)', () => {
    expect(transferWindowsFor(2028)[1]).toMatchObject({
      opensOn: '2028-04-16',
      closesOn: '2028-05-07',
    });
  });
});

describe('IA vendedora', () => {
  const squad = (count: number, position: Position = 'CM') =>
    Array.from({ length: count }, (_, index) => ({
      id: `player_${String(index).padStart(2, '0')}` as never,
      position,
      strength: strength(80 - index),
    }));
  const base = {
    player: {
      id: 'player_29' as never,
      age: 26,
      position: 'CM' as const,
      strength: strength(51),
      value: money(1_000_000),
    },
    sellerSquad: squad(30),
    sellerReputation: 70,
    contractEndsOn: '2027-12-31',
    onDate: '2026-01-10',
  };

  it('aceita pelo preço, contrapropõe perto dele e recusa abaixo', () => {
    const asking = Number(sellerAskingPrice(base));
    expect(asking).toBe(1_000_000);
    expect(
      decideSellerResponse({ kind: 'buy', fee: money(asking) }, base),
    ).toEqual({ decision: 'accept' });
    expect(
      decideSellerResponse({ kind: 'buy', fee: money(800_000) }, base),
    ).toEqual({ decision: 'counter', fee: asking });
    expect(
      decideSellerResponse({ kind: 'buy', fee: money(500_000) }, base),
    ).toMatchObject({ decision: 'reject' });
  });

  it('cobra mais por jovens, titulares e posições carentes; menos por contrato curto', () => {
    const young = sellerAskingPrice({
      ...base,
      player: { ...base.player, age: 21 },
    });
    const key = sellerAskingPrice({
      ...base,
      player: {
        ...base.player,
        id: 'player_00' as never,
        strength: strength(80),
      },
    });
    const expiring = sellerAskingPrice({
      ...base,
      contractEndsOn: '2026-05-01',
    });
    expect(young).toBeGreaterThan(1_000_000);
    expect(key).toBeGreaterThan(young);
    expect(expiring).toBeLessThan(1_000_000);
    expect(
      decideSellerResponse(
        { kind: 'buy', fee: money(5_000_000) },
        { ...base, sellerSquad: squad(22) },
      ),
    ).toMatchObject({ decision: 'reject', reason: 'squad_too_small' });
  });

  it('preserva o desconto do Diplomata no preço pedido (ADR 0007)', () => {
    const factor = coachEffects('diplomata').negotiationPrice;
    expect(factor).toBe(0.95);
    expect(sellerAskingPrice({ ...base, priceFactor: factor })).toBe(950_000);
    expect(
      decideSellerResponse(
        { kind: 'buy', fee: money(950_000) },
        { ...base, priceFactor: factor },
      ),
    ).toEqual({ decision: 'accept' });
  });

  it('empresta reservas com metade do salário e limita contrapropostas do comprador', () => {
    expect(
      decideSellerResponse(
        {
          kind: 'loan',
          fee: money(0),
          loan: { endsOn: '2026-06-30', wageSharePercentage: 60 },
        },
        base,
      ),
    ).toEqual({ decision: 'accept' });
    expect(
      decideSellerResponse(
        {
          kind: 'loan',
          fee: money(0),
          loan: { endsOn: '2026-06-30', wageSharePercentage: 20 },
        },
        base,
      ),
    ).toEqual({ decision: 'counter', fee: 80_000 });
    expect(
      buyerCounterLimit(money(1_000_000), money(900_000), money(10_000_000)),
    ).toBe(1_200_000);
    expect(
      buyerCounterLimit(money(1_000_000), money(500_000), money(10_000_000)),
    ).toBe(800_000);
    expect(
      buyerCounterLimit(money(1_000_000), money(900_000), money(1_100_000)),
    ).toBe(1_100_000);
  });
});

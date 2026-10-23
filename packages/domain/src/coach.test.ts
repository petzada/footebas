import { describe, expect, it } from 'vitest';
import {
  COACH_PERSONALITIES,
  COACH_PERSONALITY_EFFECTS,
  COACH_VOICE,
  applyPersonalityToConfidence,
  evaluateRenewal,
  followsMatchPlan,
  planStrength,
  recommendedMentality,
  renderCoachVoice,
  scaleIntegerDelta,
  type ManagerCareer,
} from './index.js';

const manager = (board: number, fan: number): ManagerCareer => ({
  managerId: 'manager_1',
  employmentStatus: 'employed',
  boardConfidence: board,
  fanConfidence: fan,
  prestige: 0,
  seasons: 0,
  appointments: [],
});

describe('coach personality rules', () => {
  it('keeps every effect small and bounded (±10%)', () => {
    for (const personality of COACH_PERSONALITIES)
      for (const factor of Object.values(
        COACH_PERSONALITY_EFFECTS[personality],
      )) {
        expect(factor).toBeGreaterThanOrEqual(0.9);
        expect(factor).toBeLessThanOrEqual(1.1);
      }
  });

  it('scales integer deltas deterministically with the exact expected value', () => {
    const keys = Array.from(
      { length: 4_000 },
      (_, index) => `k${String(index)}`,
    );
    const scaled = keys.map((key) => scaleIntegerDelta(3, 1.1, key));
    expect(scaled.every((value) => value === 3 || value === 4)).toBe(true);
    const mean = scaled.reduce((sum, value) => sum + value, 0) / keys.length;
    expect(mean).toBeGreaterThan(3.25);
    expect(mean).toBeLessThan(3.35);
    expect(keys.map((key) => scaleIntegerDelta(3, 1.1, key))).toEqual(scaled);
    expect(scaleIntegerDelta(-6, 0.92, 'x')).toBeGreaterThanOrEqual(-6);
    expect(scaleIntegerDelta(-6, 0.92, 'x')).toBeLessThanOrEqual(-5);
    expect(scaleIntegerDelta(5, 1, 'x')).toBe(5);
    expect(scaleIntegerDelta(0, 1.1, 'x')).toBe(0);
  });

  it('diplomata loses board confidence slower; motivador gains fans faster', () => {
    const before = manager(60, 50);
    const after = manager(40, 70);
    const neutral = applyPersonalityToConfidence(before, after, 'estrategista');
    expect(neutral.boardConfidence).toBe(40);
    expect(neutral.fanConfidence).toBe(70);
    expect(
      applyPersonalityToConfidence(before, after, 'diplomata').boardConfidence,
    ).toBe(42);
    expect(
      applyPersonalityToConfidence(before, after, 'motivador').fanConfidence,
    ).toBe(72);
    expect(
      applyPersonalityToConfidence(before, manager(80, 30), 'diplomata')
        .boardConfidence,
    ).toBe(80);
  });

  it('suggests the game plan from the opponent analysis', () => {
    expect(recommendedMentality('much_stronger')).toBe('counter_attack');
    expect(recommendedMentality('stronger')).toBe('counter_attack');
    expect(recommendedMentality('similar')).toBe('balanced');
    expect(recommendedMentality('weaker')).toBe('all_out_attack');
    expect(followsMatchPlan('balanced', 'similar')).toBe(true);
    expect(followsMatchPlan('all_out_attack', 'stronger')).toBe(false);
    expect(planStrength(70, 'estrategista')).toBe(72);
    expect(planStrength(100, 'estrategista')).toBe(100);
    expect(planStrength(70, 'motivador')).toBe(70);
  });

  it('makes negotiations cheaper only through the price factor', () => {
    const contract = {
      id: 'contract_1',
      playerId: 'player_1',
      clubId: 'club_1',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      wage: 100_000,
      status: 'active',
      terminationCost: 0,
      revision: 1,
    } as unknown as Parameters<typeof evaluateRenewal>[0];
    const player = {
      age: 27,
      strength: 70,
      hidden: { professionalism: 70 },
    } as unknown as Parameters<typeof evaluateRenewal>[2];
    const proposal = {
      wage: 105_000 as never,
      endsOn: '2028-12-31',
    };
    expect(evaluateRenewal(contract, proposal, player, 60)).toBe('refuse');
    expect(evaluateRenewal(contract, proposal, player, 60, 0.95)).toBe(
      'accept',
    );
  });

  it('writes e-mails with a distinct Portuguese tone per personality', () => {
    const bodies = COACH_PERSONALITIES.map(
      (personality) =>
        renderCoachVoice(personality, 'win', {
          coach: 'Marcio',
          club: 'Flamengo',
          opponent: 'Vasco',
          score: '2 x 0',
        }).body,
    );
    expect(new Set(bodies).size).toBe(4);
    for (const body of bodies) {
      expect(body).toContain('Marcio');
      expect(body).toContain('2 x 0');
      expect(body).not.toMatch(/\{[a-z]+\}/);
    }
    expect(COACH_VOICE.motivador.loss.subject).toBe('Cabeça erguida, {club}');
  });
});

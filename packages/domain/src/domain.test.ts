import { describe, expect, it } from 'vitest';
import { canonicalJson, DomainError, entityId, GameDate } from './index.js';

describe('GameDate', () => {
  it('uses calendar-safe UTC arithmetic', () => {
    expect(GameDate.parse('2028-02-28').addDays(2).toString()).toBe(
      '2028-03-01',
    );
  });

  it('rejects invalid calendar dates', () => {
    expect(() => GameDate.parse('2026-02-29')).toThrow(DomainError);
  });
});

describe('canonicalJson', () => {
  it('sorts object keys recursively and preserves array order', () => {
    expect(
      canonicalJson({
        z: 1,
        a: { y: 2, x: 3 },
        omitted: undefined,
        list: [2, 1],
      }),
    ).toBe('{"a":{"x":3,"y":2},"list":[2,1],"z":1}');
  });
});

describe('entityId', () => {
  it('brands stable lower-snake-case ids', () => {
    expect(entityId('club_flamengo', 'club')).toBe('club_flamengo');
    expect(() => entityId('Club Flamengo', 'club')).toThrow(DomainError);
  });
});

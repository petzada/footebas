import { describe, expect, it } from 'vitest';
import { runSmoke, smokeOutput } from './smoke.js';

describe('sim-lab Phase 0 smoke', () => {
  it('is deterministic and canonically serialized', () => {
    expect(runSmoke()).toEqual(runSmoke());
    expect(smokeOutput()).toBe(
      '{"date":"2026-01-15","prngVersion":"mulberry32-v1","sample":[10,20,22,57,36,60,75,35],"seed":"phase-zero-smoke-v1","state":3000589201}',
    );
  });
});

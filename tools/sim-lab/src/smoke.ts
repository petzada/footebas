import { canonicalJson, GameDate } from '@footebas/domain';
import { createPrng, PRNG_VERSION } from '@footebas/engine';
import { TEST_SEEDS } from '@footebas/testing';

export interface SmokeReport {
  readonly date: string;
  readonly prngVersion: string;
  readonly sample: readonly number[];
  readonly seed: string;
  readonly state: number;
}

export function runSmoke(): SmokeReport {
  const random = createPrng(TEST_SEEDS.phaseZeroSmoke);
  const sample = Array.from({ length: 8 }, () => random.nextInt(0, 100));
  return {
    date: GameDate.parse('2026-01-01').addDays(14).toString(),
    prngVersion: PRNG_VERSION,
    sample,
    seed: TEST_SEEDS.phaseZeroSmoke,
    state: random.snapshot(),
  };
}

export function smokeOutput(): string {
  return canonicalJson(runSmoke());
}

/* eslint-disable @typescript-eslint/restrict-template-expressions -- numeric benchmark iteration is an intentional seed segment */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@footebas/domain';
import { simulateMatch } from '@footebas/engine';
import { matchInputFactory } from '@footebas/testing';
import { runCalibration } from './calibration.js';
import { loadRealSample, SAMPLE_CLUBS } from './real-sample.js';

describe('phase one simulation laboratory', () => {
  it('keeps the versioned statistical bands green', () => {
    const report = runCalibration(2_000);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(canonicalJson(report)).toBe(canonicalJson(runCalibration(2_000)));
  }, 180_000);

  it('loads a conservative deterministic real sample without resolving raw markers', () => {
    const first = loadRealSample();
    const second = loadRealSample();
    expect(first.clubs.map(({ name }) => name)).toEqual(SAMPLE_CLUBS);
    expect(first.clubs).toHaveLength(8);
    expect(first.playerCount).toBe(200);
    expect(first.clubs.every(({ players }) => players.length === 25)).toBe(
      true,
    );
    expect(first.clubs[0]?.players[0]?.provenance).toMatchObject({
      attributes: 'derived',
      identity: 'raw-markdown',
    });
    expect(first).toEqual(second);
  });

  it('simulates comfortably below the conservative 150ms p95 target', () => {
    const durations: number[] = [];
    for (let index = 0; index < 250; index += 1) {
      const started = performance.now();
      simulateMatch(matchInputFactory({ seed: `benchmark-${index}` }));
      durations.push(performance.now() - started);
    }
    durations.sort((left, right) => left - right);
    const p95 =
      durations[Math.floor(durations.length * 0.95)] ??
      Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(150);
  });
});

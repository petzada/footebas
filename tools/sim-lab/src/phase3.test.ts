import { describe, expect, it } from 'vitest';
import { runPhaseThreePlaythrough } from './phase3.js';

describe('phase three gate', () => {
  it('presents actionable information and exactly reproduces every changed round', () => {
    const report = runPhaseThreePlaythrough(14);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(
      new Set(report.decisions.map(({ lineupMode }) => lineupMode)),
    ).toEqual(new Set(['best', 'rest', 'develop']));
    expect(
      report.decisions.every(
        ({ reproduced, changedVersusNoIntervention }) =>
          reproduced && changedVersusNoIntervention,
      ),
    ).toBe(true);
  });
});

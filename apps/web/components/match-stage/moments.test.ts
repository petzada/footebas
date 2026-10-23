import { describe, expect, it } from 'vitest';
import { cuesFor, momentsBetween } from './moments';
import { stageMatch } from './test-fixture';

const match = stageMatch();

describe('momentsBetween', () => {
  it('whistles the kickoff on the first step', () => {
    expect(momentsBetween(match, 0, 9)).toEqual(['kickoff', 'chance']);
  });

  it('announces the goal at its exact minute, and only then', () => {
    expect(momentsBetween(match, 9, 24)).toEqual(['goal']);
    expect(momentsBetween(match, 24, 41)).toEqual(['card']);
    expect(momentsBetween(match, 41, 64)).toEqual([
      'half-time',
      'substitution',
    ]);
  });

  it('plays only the final whistle when skipping to the result', () => {
    expect(momentsBetween(match, 0, 90)).toEqual(['full-time']);
    expect(momentsBetween(match, 88, 90)).toEqual(['full-time']);
  });

  it('is silent on rewinds and repeats', () => {
    expect(momentsBetween(match, 24, 24)).toEqual([]);
    expect(momentsBetween(match, 64, 9)).toEqual([]);
  });
});

describe('cuesFor', () => {
  it('lands the goal sounds when the animation reaches the action', () => {
    const cues = cuesFor(['goal']);
    expect(cues.map((cue) => cue.sound)).toEqual(['goal', 'crowd']);
    expect(cues.every((cue) => cue.at >= 0.72)).toBe(true);
    expect(cuesFor(['kickoff'])).toEqual([{ sound: 'whistle', at: 0 }]);
  });
});

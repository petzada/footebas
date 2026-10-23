/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed-size synthetic fixture */
import { createMatchInput, type MatchInput } from '@footebas/domain';
import { syntheticMatch } from './synthetic-match.js';
import { describe, expect, it } from 'vitest';
import { narrateMatch, simulateMatch, type NarrationLine } from './index.js';

function context(input: MatchInput) {
  return {
    home: { name: 'Mandante FC' },
    away: { name: 'Visitante EC' },
    playerNames: new Map(
      [...input.home.players, ...input.away.players].map((player) => [
        player.id,
        player.name,
      ]),
    ),
  };
}
const mask = (line: NarrationLine, input: MatchInput) => {
  let text = line.text;
  for (const name of [
    ...input.home.players.map(({ name }) => name),
    ...input.away.players.map(({ name }) => name),
    'Mandante FC',
    'Visitante EC',
  ].sort((a, b) => b.length - a.length))
    text = text.split(name).join('§');
  return text.replace(/\d+/g, '#');
};

describe('narrateMatch', () => {
  it('narrates every event once, in order, between kickoff, half time and full time', () => {
    const input = syntheticMatch('narration-structure');
    const result = simulateMatch(input);
    const lines = narrateMatch(result, context(input));
    expect(lines[0]!.kind).toBe('kickoff');
    expect(lines.at(-1)!.kind).toBe('full_time');
    expect(
      lines.flatMap(({ eventIndex }) =>
        eventIndex === undefined ? [] : [eventIndex],
      ),
    ).toEqual(result.timeline.map((_, index) => index));
    const half = lines.findIndex(({ kind }) => kind === 'half_time');
    expect(lines[half + 1]!.kind).toBe('second_half');
    expect(lines.slice(0, half).every(({ minute }) => minute <= 45)).toBe(true);
    expect(lines.slice(half + 2, -1).every(({ minute }) => minute > 45)).toBe(
      true,
    );
    expect(lines.at(-1)!.score).toEqual({
      home: result.homeGoals,
      away: result.awayGoals,
    });
    for (const line of lines) {
      expect(line.text).not.toMatch(/[{}]|undefined/);
      expect(line.text.length).toBeGreaterThan(8);
    }
    expect(narrateMatch(result, context(input))).toEqual(lines);
  });

  it('rarely repeats a phrase within a match and varies across matches', () => {
    let lines = 0;
    let repeats = 0;
    const goalPhrases = new Set<string>();
    const kickoffs = new Set<string>();
    for (let index = 0; index < 200; index++) {
      const input = syntheticMatch(`narration-${String(index)}`);
      const narrated = narrateMatch(simulateMatch(input), context(input));
      const seen = new Set<string>();
      for (const line of narrated) {
        const template = mask(line, input);
        lines++;
        if (seen.has(template)) repeats++;
        seen.add(template);
        if (line.kind === 'goal') goalPhrases.add(template);
        if (line.kind === 'kickoff') kickoffs.add(template);
      }
    }
    expect(repeats / lines).toBeLessThan(0.03);
    expect(goalPhrases.size).toBeGreaterThanOrEqual(60);
    expect(kickoffs.size).toBeGreaterThanOrEqual(6);
  });

  it('keeps what was already narrated when the manager acts at minute m', () => {
    for (let index = 0; index < 30; index++) {
      const input = syntheticMatch(`narration-prefix-${String(index)}`);
      const minute = 5 + ((index * 29) % 85);
      const plain = narrateMatch(simulateMatch(input), context(input));
      const decided = narrateMatch(
        simulateMatch(
          createMatchInput({
            ...input,
            instructions: [
              {
                type: 'tactical_change',
                minute,
                side: 'home',
                tactic: { ...input.home.tactic, mentality: 'all_out_attack' },
              },
            ],
          }),
        ),
        context(input),
      );
      const shown = (lines: readonly NarrationLine[]) =>
        lines.slice(
          0,
          lines.findIndex(
            (line) =>
              line.kind === 'tactical_change' ||
              line.minute > minute ||
              line.kind === 'full_time',
          ),
        );
      const prefix = shown(decided);
      expect(prefix.length).toBeGreaterThan(0);
      expect(plain.slice(0, prefix.length).map(({ text }) => text)).toEqual(
        prefix.map(({ text }) => text),
      );
    }
  });

  it('narrates the leaner read-model timeline too', () => {
    const lines = narrateMatch(
      {
        matchId: 'match_read_model',
        timeline: [
          { type: 'chance', minute: 12, side: 'home', xg: 0.31 },
          { type: 'goal', minute: 12, side: 'home', playerId: 'p1' },
          {
            type: 'tactical_change',
            minute: 60,
            side: 'away',
            formation: '4-3-3',
            mentality: 'all_out_attack',
          },
        ],
      },
      {
        home: { name: 'Mandante FC' },
        away: { name: 'Visitante EC' },
        playerNames: new Map([['p1', 'Fulano']]),
        competition: 'Copa Teste',
      },
    );
    expect(lines.map(({ kind }) => kind)).toEqual([
      'kickoff',
      'chance',
      'goal',
      'half_time',
      'second_half',
      'tactical_change',
      'full_time',
    ]);
    expect(lines[2]!.text).toContain('Fulano');
    expect(lines[2]!.score).toEqual({ home: 1, away: 0 });
  });
});

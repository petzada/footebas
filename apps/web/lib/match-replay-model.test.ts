import { describe, expect, it } from 'vitest';
import {
  createMatchReplayFrame,
  describeReplayEvent,
  nextReplayMinute,
  textualReplayAlternative,
  type MatchReplayInput,
  type ReplayEvent,
  type ReplayPlayer,
  type ReplayTeam,
} from '@/lib/match-replay-model';

function players(prefix: string): readonly ReplayPlayer[] {
  return Array.from({ length: 14 }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `${prefix.toUpperCase()} ${index + 1}`,
    number: index + 1,
    started: index < 11,
    rating: 6 + index / 10,
  }));
}

function team(prefix: string, name: string, color: string): ReplayTeam {
  return {
    id: prefix,
    name,
    abbreviation: prefix.toUpperCase(),
    color,
    players: players(prefix),
  };
}

export function matchFixture(
  timeline: readonly ReplayEvent[] = [
    { type: 'chance', minute: 9, side: 'home', xg: 0.18 },
    { type: 'goal', minute: 24, side: 'home', playerId: 'cfc-9' },
    {
      type: 'card',
      minute: 41,
      side: 'away',
      playerId: 'fba-4',
      card: 'yellow',
    },
    {
      type: 'substitution',
      minute: 64,
      side: 'home',
      playerOutId: 'cfc-11',
      playerInId: 'cfc-12',
      source: 'manager',
    },
    { type: 'chance', minute: 78, side: 'away', xg: 0.41 },
  ],
): MatchReplayInput {
  return {
    matchId: 'match-42',
    home: team('cfc', 'Clube Ferroviário', '#f7c948'),
    away: team('fba', 'Futebol do Bairro', '#55e6a5'),
    finalScore: { home: 1, away: 0 },
    finalStatistics: {
      home: {
        shots: 11,
        shotsOnTarget: 4,
        possession: 54,
        yellowCards: 1,
        redCards: 0,
        xg: 1.32,
      },
      away: {
        shots: 8,
        shotsOnTarget: 3,
        possession: 46,
        yellowCards: 2,
        redCards: 0,
        xg: 0.87,
      },
    },
    timeline,
  };
}

describe('match replay render model', () => {
  it('replays only authoritative events and never changes the final result', () => {
    const input = matchFixture();
    expect(createMatchReplayFrame(input, 23).score).toEqual({
      home: 0,
      away: 0,
    });
    expect(createMatchReplayFrame(input, 24).score).toEqual({
      home: 1,
      away: 0,
    });
    expect(createMatchReplayFrame(input, 90).score).toEqual(input.finalScore);
    expect(input.timeline).toHaveLength(5);
  });

  it('moves a substitute into the render-only lineup at the authored minute', () => {
    const input = matchFixture();
    expect(
      createMatchReplayFrame(input, 63).players.some(
        (player) => player.id === 'cfc-12',
      ),
    ).toBe(false);
    expect(
      createMatchReplayFrame(input, 64).players.some(
        (player) => player.id === 'cfc-12',
      ),
    ).toBe(true);
  });

  it('creates a complete textual alternative to the schematic pitch', () => {
    const input = matchFixture();
    const alternative = textualReplayAlternative(
      input,
      createMatchReplayFrame(input, 24),
    );
    expect(alternative).toContain('Clube Ferroviário 1, Futebol do Bairro 0');
    expect(alternative).toContain('Bola em');
    expect(alternative).toContain('Posições de Clube Ferroviário');
    expect(alternative).toContain('CFC 9');
  });

  it('narrates the shooter, the play and the outcome of match-v4 shots', () => {
    const input = matchFixture();
    expect(
      describeReplayEvent(input, {
        type: 'chance',
        minute: 12,
        side: 'home',
        xg: 0.21,
        playerId: 'cfc-9',
        assistId: 'cfc-7',
        play: 'cross',
        outcome: 'saved',
      }),
    ).toBe("12' · CFC: CFC 9 finaliza após cruzamento… defesa do goleiro.");
    expect(
      describeReplayEvent(input, {
        type: 'goal',
        minute: 30,
        side: 'away',
        playerId: 'fba-10',
        assistId: 'fba-8',
        play: 'counter',
      }),
    ).toBe("30' · FBA marca com FBA 10 em contra-ataque, passe de FBA 8.");
    // Older results (no shooter) and unknown athletes keep the xG line.
    expect(
      describeReplayEvent(input, {
        type: 'chance',
        minute: 40,
        side: 'away',
        xg: 0.07,
      }),
    ).toBe("40' · FBA cria uma chance de 0.07 xG.");
    expect(
      describeReplayEvent(input, {
        type: 'chance',
        minute: 41,
        side: 'away',
        xg: 0.07,
        playerId: 'someone-else',
        outcome: 'off_target',
      }),
    ).toBe("41' · FBA cria uma chance de 0.07 xG.");
  });

  it('jumps from authored event to authored event before the final whistle', () => {
    const input = matchFixture();
    expect(nextReplayMinute(input, 9)).toBe(24);
    expect(nextReplayMinute(input, 78)).toBe(90);
  });

  it('is deterministic and bounded for generated authoritative timelines', () => {
    let state = 0x5f37_59df;
    const random = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 4_294_967_296;
    };

    for (let run = 0; run < 250; run += 1) {
      const timeline: ReplayEvent[] = Array.from(
        { length: 1 + Math.floor(random() * 24) },
        () => ({
          type: 'chance' as const,
          minute: Math.floor(random() * 91),
          side: random() > 0.5 ? ('home' as const) : ('away' as const),
          xg: Number(random().toFixed(2)),
        }),
      ).sort((left, right) => left.minute - right.minute);
      const input = matchFixture(timeline);
      const minute = Math.floor(random() * 91);
      const first = createMatchReplayFrame(input, minute);
      const second = createMatchReplayFrame(input, minute);

      expect(first).toEqual(second);
      expect(first.players).toHaveLength(22);
      expect(
        [...first.players, first.ball].every(
          ({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 64,
        ),
      ).toBe(true);
      expect(
        first.telemetry.momentum.home + first.telemetry.momentum.away,
      ).toBe(100);
      expect(first.eventIndex).toBeLessThan(input.timeline.length);
    }
  });
});

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment -- fixed synthetic matchday cardinalities and Vitest asymmetric matchers */
import {
  FORMATIONS,
  FORMATION_POSITIONS,
  canonicalJson,
  createClub,
  createLineup,
  createMatchInput,
  createPlayer,
  createTactic,
  entityId,
  money,
  percentage,
  strength,
  type Formation,
  type Player,
} from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  autoSelectLineup,
  createMatchPresentation,
  prepareMatch,
  simulateMatch,
} from './index.js';

function squadFactory(key: string, average: number, formation: Formation) {
  const clubId = entityId(key, 'club');
  const positions = [
    ...FORMATION_POSITIONS[formation],
    'GK',
    'CB',
    'CM',
    'RW',
    'ST',
  ] as const;
  const players: Player[] = positions.map((position, index) =>
    createPlayer({
      id: entityId(`${key}_player_${String(index)}`, 'player'),
      name: `${key} ${String(index)}`,
      age: 19 + index,
      position,
      secondaryPositions: position === 'GK' || position === 'CM' ? [] : ['CM'],
      strength: strength(average + (index % 5) - 2),
      traits: position === 'GK' ? ['reflexes', 'positioning'] : [],
      hidden: {
        potential: percentage(88 - index),
        consistency: percentage(70),
        injuryProneness: percentage(10),
        adaptation: percentage(70),
        professionalism: percentage(70),
        bigGame: percentage(65),
      },
      morale: percentage(75),
      condition: percentage(90),
      matchSharpness: percentage(80),
      value: money(1_000_000),
      salary: money(10_000),
      clubId,
      squadStatus: index < 11 ? 'starter' : 'rotation',
      injuryRounds: 0,
      suspensionRounds: 0,
      careerStats: {
        appearances: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      },
    }),
  );
  const club = createClub({
    id: clubId,
    name: key,
    shortName: key.slice(0, 3),
    squad: players.map(({ id }) => id),
    balance: money(0),
    reputation: percentage(average),
  });
  const lineup = createLineup({
    clubId,
    starters: players.slice(0, 11).map((player, index) => ({
      playerId: player.id,
      position: FORMATION_POSITIONS[formation][index]!,
    })),
    substitutes: players.slice(11).map(({ id }) => id),
    captainId: players[0]!.id,
  });
  return { club, players, lineup };
}

function matchInputFactory(options: {
  seed: string;
  homeStrength?: number;
  awayStrength?: number;
}) {
  const formation = '4-3-3' as const;
  const home = squadFactory(
    'club_home_phase3',
    options.homeStrength ?? 72,
    formation,
  );
  const away = squadFactory(
    'club_away_phase3',
    options.awayStrength ?? 72,
    formation,
  );
  const tactic = createTactic({
    formation,
    mentality: 'balanced',
    attackDirection: 'center',
    marking: 'heavy',
    buildUp: 'mixed',
    focus: 'balanced',
    press: 'medium',
    defensiveLine: 'normal',
    markingStyle: 'mixed',
  });
  return createMatchInput({
    fixtureId: entityId('fixture_phase3', 'fixture'),
    seed: options.seed,
    engineVersion: 'match-v2',
    rulesVersion: 'phase3-v1',
    home: { ...home, tactic },
    away: { ...away, tactic },
  });
}

describe('phase 3 matchday core', () => {
  it('auto-selects all formations deterministically in best/rest/develop modes', () => {
    const squad = squadFactory('club_auto', 72, '4-3-3');
    const tiredId = squad.players[0]!.id;
    const players = squad.players.map((player) =>
      player.id === tiredId
        ? createPlayer({ ...player, condition: percentage(1) })
        : player,
    );
    for (const formation of FORMATIONS) {
      for (const mode of ['best', 'rest', 'develop'] as const) {
        const first = autoSelectLineup({
          club: squad.club,
          players,
          formation,
          mode,
        });
        const second = autoSelectLineup({
          club: squad.club,
          players,
          formation,
          mode,
        });
        expect(first).toEqual(second);
        expect(first.starters).toHaveLength(11);
        expect(
          new Set([
            ...first.starters.map(({ playerId }) => playerId),
            ...first.substitutes,
            ...(first.reserves ?? []),
          ]).size,
        ).toBe(players.length);
      }
    }
  });

  it('registers manager decisions in immutable input and exactly replayable timeline', () => {
    const base = matchInputFactory({ seed: 'phase3-decisions' });
    const outgoing = base.home.lineup.starters[10]!;
    const incoming = base.home.lineup.substitutes[1]!;
    const instructions = [
      {
        type: 'tactical_change' as const,
        minute: 45 as const,
        side: 'home' as const,
        tactic: createTactic({
          ...base.home.tactic,
          mentality: 'all_out_attack',
          press: 'high',
          defensiveLine: 'high',
        }),
      },
      {
        type: 'substitution' as const,
        minute: 60 as const,
        side: 'home' as const,
        playerOutId: outgoing.playerId,
        playerInId: incoming,
        position: outgoing.position,
      },
    ];
    const input = createMatchInput({ ...base, instructions });
    const first = simulateMatch(input);
    const replay = simulateMatch(input);
    expect(canonicalJson(first)).toBe(canonicalJson(replay));
    expect(first.decisions).toEqual(instructions);
    expect(
      first.timeline.filter(
        ({ type }) => type === 'tactical_change' || type === 'substitution',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tactical_change',
          minute: 45,
          side: 'home',
        }),
        expect.objectContaining({
          type: 'substitution',
          minute: 60,
          side: 'home',
          source: 'manager',
        }),
      ]),
    );
    expect(Object.isFrozen(input.instructions)).toBe(true);
  });

  it('prepares decisions and exposes skip/speed-compatible feeds', () => {
    const input = matchInputFactory({
      seed: 'phase3-presentation',
      homeStrength: 68,
      awayStrength: 78,
    });
    const preparation = prepareMatch(input, 'home', ['L', 'D', 'W']);
    expect(preparation).toMatchObject({
      venue: 'home',
      recentForm: ['L', 'D', 'W'],
      approximateStrength: expect.stringMatching(/stronger/),
    });
    const presentation = createMatchPresentation(simulateMatch(input));
    expect(presentation.playback).toEqual({
      modes: ['instant', 'fast', 'feed'],
      speeds: [1, 2, 4, 8],
      canSkip: true,
    });
    expect(presentation.feed.every(({ id }) => id.startsWith('match_'))).toBe(
      true,
    );
  });
});

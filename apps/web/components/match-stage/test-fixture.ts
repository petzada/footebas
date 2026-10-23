import type {
  MatchReplayInput,
  ReplayEvent,
  ReplayPlayer,
  ReplayTeam,
} from '@/lib/match-replay-model';
import { statisticsFromTimeline } from '@/lib/match-replay-model';

function players(prefix: string): readonly ReplayPlayer[] {
  return Array.from({ length: 14 }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `${prefix.toUpperCase()} ${index + 1}`,
    number: index + 1,
    started: index < 11,
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

export const stageTimeline: readonly ReplayEvent[] = [
  { type: 'chance', minute: 9, side: 'home', xg: 0.18 },
  { type: 'goal', minute: 24, side: 'home', playerId: 'cfc-9' },
  { type: 'card', minute: 41, side: 'away', playerId: 'fba-4', card: 'yellow' },
  {
    type: 'substitution',
    minute: 64,
    side: 'home',
    playerOutId: 'cfc-11',
    playerInId: 'cfc-12',
  },
  { type: 'goal', minute: 70, side: 'away', playerId: 'fba-10' },
  { type: 'card', minute: 81, side: 'home', playerId: 'cfc-3', card: 'red' },
  { type: 'chance', minute: 88, side: 'away', xg: 0.41 },
];

export function stageMatch(
  overrides: Partial<MatchReplayInput> = {},
): MatchReplayInput {
  const timeline = overrides.timeline ?? stageTimeline;
  return {
    matchId: 'match-stage-1',
    home: team('cfc', 'Clube Ferroviário', '#f7c948'),
    away: team('fba', 'Futebol do Bairro', '#1f4f9a'),
    finalScore: { home: 1, away: 1 },
    finalStatistics: statisticsFromTimeline(timeline),
    timeline,
    ...overrides,
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

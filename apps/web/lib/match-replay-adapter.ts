import type { CareerView, MatchUpdate } from '@/lib/career-api';
import {
  statisticsFromTimeline,
  type MatchReplayInput,
  type ReplayEvent,
  type ReplayPlayer,
  type ReplaySide,
} from '@/lib/match-replay-model';

const chanceXg = { chance: 0.22, save: 0.35 } as const;

export function parseScore(score: string): { home: number; away: number } {
  const [home = 0, away = 0] = score
    .split('×')
    .map((part) => Number.parseInt(part.trim(), 10) || 0);
  return { home, away };
}

function abbreviation(club: string): string {
  const letters = club
    .normalize('NFD')
    .replace(/[^A-Za-z ]/g, '')
    .toUpperCase();
  const words = letters.split(' ').filter(Boolean);
  return (
    words.length > 1 ? words.map((word) => word[0]).join('') : letters
  ).slice(0, 3);
}

/**
 * Builds the render-only 2D replay from the narrated feed of the local career
 * port. The HTTP adapter maps the authoritative post-match timeline directly.
 */
export function replayFromFeed(
  career: CareerView,
  feed: readonly MatchUpdate[],
  matchId: string,
): MatchReplayInput {
  const starters = career.players.filter((player) => player.role === 'starter');
  const home: ReplayPlayer[] = starters.map((player) => ({
    id: player.id,
    name: player.name,
    number: player.shirt,
    ...(player.lastRating === null ? {} : { rating: player.lastRating }),
  }));
  const away: ReplayPlayer[] = Array.from({ length: 11 }, (_, index) => ({
    id: `${matchId}-away-${index + 1}`,
    name: `${career.opponent.club} ${index + 1}`,
    number: index + 1,
  }));
  const mentioned = (side: ReplaySide, message: string, fallback: number) => {
    const players = side === 'home' ? home : away;
    return (
      players.find((player) =>
        message.includes(player.name.split(' ').at(-1) ?? player.name),
      ) ??
      players[fallback] ??
      players[0]!
    ).id;
  };

  let previous = { home: 0, away: 0 };
  const timeline: ReplayEvent[] = [];
  for (const update of feed) {
    const score = parseScore(update.score);
    const scored: ReplaySide = score.away > previous.away ? 'away' : 'home';
    previous = score;
    const side = update.side ?? (update.kind === 'goal' ? scored : 'home');
    const base = { minute: update.minute, side, note: update.message };
    if (update.kind === 'chance' || update.kind === 'save')
      timeline.push({ ...base, type: 'chance', xg: chanceXg[update.kind] });
    else if (update.kind === 'goal')
      timeline.push({
        ...base,
        type: 'goal',
        playerId: mentioned(side, update.message, 9),
      });
    else if (update.kind === 'card')
      timeline.push({
        ...base,
        type: 'card',
        card: 'yellow',
        playerId: mentioned(side, update.message, 4),
      });
  }

  return {
    matchId,
    home: {
      id: 'home',
      name: career.club,
      abbreviation: abbreviation(career.club),
      color: '#1f9d55',
      players: home,
    },
    away: {
      id: 'away',
      name: career.opponent.club,
      abbreviation: abbreviation(career.opponent.club),
      color: '#d64545',
      players: away,
    },
    finalScore: previous,
    finalStatistics: statisticsFromTimeline(timeline),
    timeline,
  };
}

/**
 * Match moments derived from the official timeline as the replay minute
 * advances: whistles, goals, cards, substitutions, chances. Pure and
 * presentation-only; drives sounds and camera cues, never the result.
 */
import type { MatchReplayInput } from '@/lib/match-replay-model';
import type { SoundName } from '@/lib/retro/sound';

export type StageMoment =
  | 'kickoff'
  | 'half-time'
  | 'full-time'
  | 'goal'
  | 'card'
  | 'substitution'
  | 'chance';

/**
 * Moments to present when the replay moves from `previousMinute` to
 * `minute`. Jumping straight to the result ("ver resultado agora") yields
 * only the final whistle, so skipping is never noisy.
 */
export function momentsBetween(
  match: MatchReplayInput,
  previousMinute: number,
  minute: number,
): readonly StageMoment[] {
  const duration = match.durationMinutes ?? 90;
  if (minute <= previousMinute) return [];
  if (minute >= duration) return ['full-time'];
  const moments: StageMoment[] = [];
  if (previousMinute <= 0) moments.push('kickoff');
  const half = Math.floor(duration / 2);
  if (previousMinute < half && minute >= half && previousMinute > 0)
    moments.push('half-time');
  for (const event of match.timeline) {
    if (Math.floor(event.minute) !== minute) continue;
    if (event.type === 'goal') moments.push('goal');
    else if (event.type === 'card') moments.push('card');
    else if (event.type === 'substitution') moments.push('substitution');
    else if (event.type === 'chance') moments.push('chance');
  }
  return moments;
}

export interface MomentCue {
  readonly sound: SoundName;
  /** Fraction of the segment at which the cue lands (0 = immediately). */
  readonly at: number;
}

const CUES: Readonly<Record<StageMoment, readonly MomentCue[]>> = {
  kickoff: [{ sound: 'whistle', at: 0 }],
  'half-time': [{ sound: 'whistle', at: 0 }],
  'full-time': [{ sound: 'whistle', at: 0 }],
  goal: [
    { sound: 'goal', at: 0.72 },
    { sound: 'crowd', at: 0.8 },
  ],
  card: [{ sound: 'whistle', at: 0.72 }],
  substitution: [{ sound: 'confirm', at: 0.72 }],
  chance: [{ sound: 'crowd', at: 0.78 }],
};

/** Sound cues for a list of moments, in order. */
export function cuesFor(moments: readonly StageMoment[]): readonly MomentCue[] {
  return moments.flatMap((moment) => CUES[moment]);
}

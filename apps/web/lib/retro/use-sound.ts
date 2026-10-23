'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  armSoundUnlock,
  isMuted,
  play,
  subscribeMuted,
  toggleMuted,
  type SoundName,
} from '@/lib/retro/sound';

const serverMuted = () => true;

/**
 * Interface sounds for a component: `play` is silent until the first
 * interaction and while muted; `muted`/`toggle` drive the mute button.
 */
export function useSound() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, serverMuted);
  useEffect(() => armSoundUnlock(), []);
  const trigger = useCallback((name: SoundName) => {
    void play(name);
  }, []);
  return { muted, toggle: toggleMuted, play: trigger };
}

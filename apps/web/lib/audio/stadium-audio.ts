/**
 * Stadium sound for the 3D match, synthesised with WebAudio: the crowd bed,
 * the roar of a goal, the "uuuh" of a near miss, the thump of the ball, the
 * whistle. No audio files.
 *
 * Shares the rules of the interface sounds (`lib/retro/sound`): nothing plays
 * before the first user interaction and the mute choice is the same one.
 */
import { isMuted, isUnlocked, subscribeMuted } from '@/lib/retro/sound';

export type StadiumCue =
  'kick' | 'tackle' | 'net' | 'save' | 'post' | 'whistle';

export interface StadiumAudio {
  /** 0..1: how loud the stands are. */
  setExcitement(level: number): void;
  cue(kind: StadiumCue, power?: number): void;
  /** Pause or resume everything (match paused, tab hidden). */
  setActive(active: boolean): void;
  dispose(): void;
}

type AudioContextConstructor = typeof AudioContext;

function contextClass(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const scope = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? scope.webkitAudioContext;
}

const MASTER = 0.55;

export function createStadiumAudio(): StadiumAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let bed: GainNode | null = null;
  let cheer: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let excitement = 0.1;
  let active = true;
  let disposed = false;

  const level = () => (isMuted() || !active ? 0 : MASTER);

  const ensure = (): AudioContext | null => {
    if (disposed || !isUnlocked() || isMuted()) return context;
    if (context) return context;
    const Context = contextClass();
    if (!Context) return null;
    try {
      context = new Context();
    } catch {
      return null;
    }
    const length = context.sampleRate * 2;
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    // Brown-ish noise: a crowd is a low rumble, not a hiss.
    let lastValue = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      lastValue = (lastValue + 0.04 * white) / 1.04;
      data[index] = lastValue * 5;
    }
    master = context.createGain();
    master.gain.value = level();
    master.connect(context.destination);

    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const low = context.createBiquadFilter();
    low.type = 'bandpass';
    low.frequency.value = 620;
    low.Q.value = 0.5;
    bed = context.createGain();
    bed.gain.value = 0;
    source.connect(low).connect(bed).connect(master);
    const high = context.createBiquadFilter();
    high.type = 'bandpass';
    high.frequency.value = 1900;
    high.Q.value = 0.7;
    cheer = context.createGain();
    cheer.gain.value = 0;
    source.connect(high).connect(cheer).connect(master);
    source.start();
    apply();
    return context;
  };

  const apply = () => {
    if (!context || !bed || !cheer) return;
    const now = context.currentTime;
    bed.gain.setTargetAtTime(0.1 + excitement * 0.5, now, 0.35);
    cheer.gain.setTargetAtTime(excitement * excitement * 0.55, now, 0.25);
  };

  const burst = (
    frequency: number,
    sweepTo: number,
    peak: number,
    attack: number,
    decay: number,
  ) => {
    if (!context || !master || !noise) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.linearRampToValueAtTime(
      sweepTo,
      now + attack + decay * 0.4,
    );
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + attack + decay + 0.1);
  };

  const tone = (
    frequency: number,
    to: number,
    peak: number,
    seconds: number,
    type: OscillatorType = 'sine',
  ) => {
    if (!context || !master) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, to),
      now + seconds,
    );
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + seconds + 0.05);
  };

  const whistle = () => {
    if (!context || !master) return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    gain.gain.setValueAtTime(0.16, now + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    // The pea: a fast tremolo over two close tones.
    const tremolo = context.createOscillator();
    tremolo.frequency.value = 31;
    const depth = context.createGain();
    depth.gain.value = 0.08;
    tremolo.connect(depth).connect(gain.gain);
    for (const frequency of [2150, 2380]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      const mix = context.createGain();
      mix.gain.value = 0.35;
      oscillator.connect(mix).connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.6);
    }
    tremolo.start(now);
    tremolo.stop(now + 0.6);
    gain.connect(master);
  };

  const unsubscribe = subscribeMuted(() => {
    if (master && context)
      master.gain.setTargetAtTime(level(), context.currentTime, 0.05);
  });

  return {
    setExcitement(next) {
      excitement = Math.max(0, Math.min(1, next));
      if (ensure()) apply();
    },
    cue(kind, power = 1) {
      if (!active || !ensure() || isMuted()) return;
      const strength = Math.max(0.2, Math.min(1, power));
      switch (kind) {
        case 'kick':
          tone(150, 48, 0.32 * strength, 0.11);
          burst(2400, 900, 0.06 * strength, 0.004, 0.05);
          break;
        case 'tackle':
          burst(500, 220, 0.14, 0.006, 0.12);
          break;
        case 'net':
          burst(700, 1500, 0.95, 0.22, 4.2);
          burst(2200, 3000, 0.4, 0.3, 3.2);
          break;
        case 'save':
          burst(520, 900, 0.5, 0.12, 1.5);
          break;
        case 'post':
          tone(880, 660, 0.2, 0.35, 'triangle');
          burst(560, 980, 0.6, 0.1, 1.8);
          break;
        case 'whistle':
          whistle();
          break;
      }
    },
    setActive(next) {
      active = next;
      if (master && context)
        master.gain.setTargetAtTime(level(), context.currentTime, 0.08);
    },
    dispose() {
      disposed = true;
      unsubscribe();
      const closing = context;
      context = null;
      master = null;
      void closing?.close().catch(() => undefined);
    },
  };
}

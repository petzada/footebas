// ZzFX (MIT) ships no types; only the one-call API is used.
declare module 'zzfx' {
  /** Plays a sound described by up to 20 synth parameters. */
  export function zzfx(...parameters: (number | undefined)[]): unknown;
  export const ZZFX: { volume: number; audioContext: AudioContext };
}

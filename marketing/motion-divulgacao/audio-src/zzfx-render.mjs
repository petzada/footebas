// Renders the game's own interface sounds (apps/web/lib/retro/sound.ts) to WAV,
// with ZzFX 1.4.0 (MIT) and a seeded Math.random so renders are reproducible.
// Usage: node zzfx-render.mjs <path-to-zzfx/ZzFX.js> <out-dir>
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [zzfxPath, outDir] = process.argv.slice(2);
let seed = 20261023;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// ZzFX opens an AudioContext on import; offline we only need buildSamples.
globalThis.AudioContext = class {};
const { ZZFX } = await import(pathToFileURL(zzfxPath).href);

/* Copied from apps/web/lib/retro/sound.ts (SOUNDS). */
const SOUNDS = {
  click: [0.4, , 420, , 0.01, 0.03, , 1.6, , , , , , , , , , 0.6, 0.01],
  confirm: [0.5, , 523, 0.01, 0.08, 0.14, , 1.4, , , 196, 0.06, , , , , , 0.7],
  error: [0.5, , 160, 0.01, 0.08, 0.18, 2, 1.1, , , , , , 0.3, , , , 0.6],
  whistle: [0.5, , 2200, 0.02, 0.18, 0.08, , 1.8, , , , , 0.08, , , , , 0.5],
  crowd: [0.35, 0.4, 90, 0.2, 0.5, 0.9, 4, 0.3, , , , , , 1.6, , 0.1, , 0.4],
  coin: [0.45, , 1046, , 0.04, 0.16, , 1.6, , , 523, 0.05, , , , , , 0.7],
  goal: [0.55, , 392, 0.02, 0.12, 0.3, , 1.5, , , 262, 0.08, 0.05, , , , , 0.8],
};

function wav(samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

for (const [name, params] of Object.entries(SOUNDS)) {
  const samples = ZZFX.buildSamples(...params);
  writeFileSync(`${outDir}/zzfx-${name}.wav`, wav(samples, ZZFX.sampleRate));
  console.log(name, (samples.length / ZZFX.sampleRate).toFixed(2) + 's');
}

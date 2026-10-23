#!/usr/bin/env python3
"""
Mixes the narration over the film's soundtrack. Every line is levelled to the
same loudness and lightly treated (high-pass, a little less box, a little more
presence, gentle compression). Under each run of speech the bed dips only as
far as it must for the voice to sit 11 LU above it: a lot under the full groove,
hardly at all under the quiet half-time music. The dip starts just before the
first syllable and lifts after the last, so the bed breathes between lines.
The effects dip at most 6 dB, so clicks and whistles stay in the picture,
and under speech the bed also loses 4 dB between 1.8 and 7 kHz (a carve), so
consonants cut through the hats and chip blips without the music dropping.
A line in locucao.json can cap its own dip ("abaixa_max_db") and start a run
of its own ("trecho_proprio"), e.g. the line that rides the second-half drop.

Usage: python3 mixa.py <stems-dir> <vo-dir> <out-dir>
  stems-dir  musica.wav + efeitos.wav from trilha.py
  vo-dir     one WAV per line + locucao-meta.json from locucao.py
Writes trilha.wav (the ducked bed, stereo), locucao.wav (the placed voice,
mono) and mix-bruto.wav (their sum, stereo), 48 kHz, with one common gain so
the sum never clips; master.py then sets the loudness of mix-bruto.wav.
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

SR = 48000
VOICE_OVER_BED_LU = 11.0  # while speaking, the voice sits this far above the bed
MAX_DUCK_DB, FX_MAX_DUCK_DB = 12.0, 6.0
CARVE_DB, CARVE_BAND = 4.0, (1800, 7000)
VOICE_LEVEL_LU = 1.0  # the voice's level against the whole un-ducked bed
PRE, ATTACK, RELEASE, HOLD_GAP = 0.03, 0.15, 0.4, 0.9
VOICE_CHAIN = (
    'highpass=f=90:poles=2,'
    'equalizer=f=320:t=q:w=1.0:g=-2,'
    'equalizer=f=2800:t=q:w=1.2:g=1.5,'
    'acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=1'
)

stems_dir, vo_dir, out_dir = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)


def read_wav(path):
    with wave.open(path) as w:
        ch, frames = w.getnchannels(), w.getnframes()
        data = np.frombuffer(w.readframes(frames), dtype=np.int16).astype(np.float64) / 32768
    return data.reshape(-1, ch).T


def write_wav(path, data):
    pcm = (np.clip(data, -1, 1).T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(data.shape[0])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def ffmpeg_f32(args_in, filters=None):
    """Runs ffmpeg and returns mono float32 samples at 48 kHz."""
    cmd = ['ffmpeg', '-v', 'error', *args_in, '-ac', '1', '-ar', str(SR)]
    if filters:
        cmd += ['-af', filters]
    return np.frombuffer(subprocess.run(cmd + ['-f', 'f32le', '-'], capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


def loudness(data):
    """EBU R128 integrated loudness (LUFS) of a mono or stereo buffer."""
    tmp = os.path.join(out_dir, '_tmp_measure.wav')
    write_wav(tmp, np.atleast_2d(data) * 0.5)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    os.remove(tmp)
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', out[out.rfind('Summary:'):]).group(1)) + 6.02


music = read_wav(os.path.join(stems_dir, 'musica.wav'))
fx = read_wav(os.path.join(stems_dir, 'efeitos.wav'))
N = music.shape[1]
t = np.arange(N) / SR

# The voice: every line at the same loudness, placed on its start, then one
# treatment chain over the whole track.
meta = json.load(open(os.path.join(vo_dir, 'locucao-meta.json'), encoding='utf-8'))['falas']
voice = np.zeros(N)
for line in meta:
    sig = ffmpeg_f32(['-i', line['arquivo']])
    sig *= 10 ** ((-20.0 - loudness(sig)) / 20)
    i = int(round(line['inicio'] * SR))
    voice[i:i + len(sig)] += sig[: N - i]
raw = os.path.join(out_dir, '_tmp_voice.wav')
write_wav(raw, voice[None, :] * 0.5)
voice = ffmpeg_f32(['-i', raw], VOICE_CHAIN)[:N] * 2.0
os.remove(raw)

# Runs of speech: lines closer than HOLD_GAP share one dip.
spans = []
for line in sorted(meta, key=lambda m: m['inicio']):
    a, b = line['inicio'] - PRE, line['inicio'] + line['duracao']
    cap = line.get('abaixa_max_db', MAX_DUCK_DB)
    if spans and a - spans[-1][1] < HOLD_GAP and not line.get('trecho_proprio'):
        spans[-1][1] = b
        spans[-1][2] = min(spans[-1][2], cap)
    else:
        spans.append([a, b, cap])

bed_level = loudness(music + fx)
voice_gain = 10 ** ((bed_level + VOICE_LEVEL_LU - loudness(np.stack([voice, voice]))) / 20)
vox = np.stack([voice, voice]) * voice_gain

# Each run dips by what the voice needs there, never more than its cap.
for span in spans:
    i, j = int(span[0] * SR), int(span[1] * SR)
    need = loudness((music + fx)[:, i:j]) + VOICE_OVER_BED_LU - loudness(vox[:, i:j])
    span[2] = float(np.clip(need, 0, span[2]))


def envelope(depths):
    """1 outside speech, down by each run's depth (dB) inside it, cosine ramps."""
    g = np.ones(N)
    for (a, b, _), depth in zip(spans, depths):
        floor = 10 ** (-depth / 20)
        down = np.clip((t - (a - ATTACK)) / ATTACK, 0, 1)
        up = np.clip((t - b) / RELEASE, 0, 1)
        shape = 0.5 - 0.5 * np.cos(np.pi * np.where(t < b, down, 1 - up))
        g = np.minimum(g, 1 - (1 - floor) * shape)
    return g


dips = [span[2] for span in spans]
bed = music * envelope(dips) + fx * envelope([min(d, FX_MAX_DUCK_DB) for d in dips])
# Carve: the voice's consonant band, dipped under speech only (zero-phase).
spec = np.fft.rfft(bed, axis=1)
f = np.fft.rfftfreq(N, 1 / SR)
band = np.fft.irfft(spec * ((f >= CARVE_BAND[0]) & (f <= CARVE_BAND[1])), N, axis=1)
bed = bed - band * (1 - envelope([CARVE_DB] * len(spans)))
mix = bed + vox
gain = 1.0 / max(1.0, np.max(np.abs(mix)) * 1.05)
for a, b, depth in spans:
    print(f'speech {a:5.2f}-{b:5.2f} s: bed dips {depth:4.1f} dB')
for name, data in [('trilha', bed), ('locucao', vox), ('mix-bruto', mix)]:
    write_wav(os.path.join(out_dir, f'{name}.wav'), (data[:1] if name == 'locucao' else data) * gain)
    print(f'{name:9}: peak {20 * np.log10(np.max(np.abs(data * gain)) + 1e-12):6.1f} dBFS, {loudness(data * gain):6.1f} LUFS')
speech = np.zeros(N, bool)
for line in meta:
    speech[int(line['inicio'] * SR): int((line['inicio'] + line['duracao']) * SR)] = True
print(f'voice over the ducked bed while speaking: {loudness(vox[:, speech]) - loudness(bed[:, speech]):.1f} LU')

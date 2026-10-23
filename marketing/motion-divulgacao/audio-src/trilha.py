#!/usr/bin/env python3
"""
Soundtrack and effects for the Footebas film "A Virada" (30 s, 120 BPM).

An 8-bit batucada written to the film's beat grid (15 bars of 2 s): surdos,
caixa, tamborim, agogô and chocalho drawn as chip voices, an NES-style
triangle bass, a pulse pad, a chip arpeggio and a stadium-chant lead in
D major. The music changes with the story: tension at half time, the drop
on the second-half whistle (8.0 s), D major landing on "VIROU!" (12.0 s)
and on "CAMPEÃO!" (22.0 s), the last chord on the call to action (28.0 s).

Effects follow the picture: the game's own ZzFX sounds (rendered by
zzfx-render.mjs) for clicks, whistles, goals and coins; Pixabay effects
bundled with HyperFrames for whooshes, impacts and pops; a synthesised
crowd. Everything is seeded, so a render is reproducible.

Usage: python3 trilha.py <zzfx-wav-dir> <pixabay-sfx-dir> <out-dir>
Writes musica.wav, efeitos.wav and mix-bruto.wav (48 kHz, stereo, float).
Loudness and true peak are set afterwards with ffmpeg (see master.py).
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4  # sixteenth
DUR = 30.0
N = int(DUR * SR)
RNG = np.random.default_rng(2026)

ZZFX_DIR, SFX_DIR, OUT_DIR = sys.argv[1:4]


# --------------------------------------------------------------- utilities
def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def n(name):
    """'F#4' -> MIDI number."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[pitch]


def stereo(mono, pan=0.0):
    """Equal-power pan, -1 (left) .. 1 (right)."""
    a = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


def place(bus, sig, t, gain=1.0, pan=0.0):
    """Adds a mono or stereo signal into a stereo bus at time t (s)."""
    if sig.ndim == 1:
        sig = stereo(sig, pan)
    i = int(round(t * SR))
    if i >= bus.shape[1] or i + sig.shape[1] <= 0:
        return
    s0 = max(0, -i)
    i = max(0, i)
    m = min(bus.shape[1] - i, sig.shape[1] - s0)
    bus[:, i:i + m] += gain * sig[:, s0:s0 + m]


def env_adsr(length, a=0.005, d=0.05, s=0.7, r=0.05):
    """ADSR envelope (seconds); length is the gate (note) length."""
    total = int((length + r) * SR)
    t = np.arange(total) / SR
    e = np.where(t < a, t / max(a, 1e-6), 0)
    dmask = (t >= a) & (t < a + d)
    e = np.where(dmask, 1 - (1 - s) * (t - a) / max(d, 1e-6), e)
    e = np.where((t >= a + d) & (t < length), s, e)
    rel = t >= length
    level_at_release = s if length > a + d else max(0.0, min(1.0, length / max(a, 1e-6)))
    e = np.where(rel, level_at_release * np.exp(-(t - length) / max(r / 4, 1e-6)), e)
    return e


def shape(sig, env):
    """Applies an envelope, padding or trimming it to the signal length."""
    e = np.zeros(len(sig))
    m = min(len(sig), len(env))
    e[:m] = env[:m]
    return sig * e


def polyblep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1.0
    m = t > 1.0 - dt
    x = (t[m] - 1.0) / dt[m]
    y[m] = x * x + x + x + 1.0
    return y


def pulse(freq, length, duty=0.5, vib=0.0, vib_rate=5.5, vib_delay=0.12):
    """Band-limited pulse (PolyBLEP) with optional delayed vibrato (cents)."""
    count = int(length * SR)
    t = np.arange(count) / SR
    f = np.full(count, float(freq))
    if vib:
        depth = np.clip((t - vib_delay) / 0.15, 0, 1) * vib
        f = f * 2 ** (depth * np.sin(2 * np.pi * vib_rate * t) / 1200)
    dt = f / SR
    phase = np.cumsum(dt) % 1.0
    out = np.where(phase < duty, 1.0, -1.0)
    out += polyblep(phase, dt)
    out -= polyblep((phase - duty) % 1.0, dt)
    return out


def tri4(freq, length):
    """NES-style 4-bit (16-step) triangle."""
    count = int(length * SR)
    phase = (np.arange(count) * freq / SR) % 1.0
    tri = 1 - 4 * np.abs(phase - 0.5)
    return np.round(tri * 7.5) / 7.5


def noise(length, seed=None):
    rng = np.random.default_rng(seed) if seed is not None else RNG
    return rng.uniform(-1, 1, int(length * SR))


def fft_filter(sig, lo=None, hi=None, slope=2):
    """Smooth band-pass by spectral shaping (zero phase)."""
    count = len(sig)
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(count, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 * slope))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(spec * g, count)


def onepole_lp(sig, cutoff):
    """One-pole low-pass via FFT magnitude (fast, zero phase approximation)."""
    return fft_filter(sig, hi=cutoff, slope=1)


def read_wav(path):
    with wave.open(path) as w:
        ch, sw, rate, frames = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        data = np.frombuffer(w.readframes(frames), dtype=np.int16).astype(np.float64) / 32768
    data = data.reshape(-1, ch).T
    if rate != SR:
        idx = np.arange(int(data.shape[1] * SR / rate)) * rate / SR
        data = np.stack([np.interp(idx, np.arange(data.shape[1]), c) for c in data])
    return data


def load_any(path):
    """Decodes any audio file to 48 kHz stereo with ffmpeg."""
    tmp = os.path.join(OUT_DIR, '_tmp_decode.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp], check=True)
    data = read_wav(tmp)
    os.remove(tmp)
    return data


def repitch(sig, ratio):
    """Plays a sample faster (ratio > 1, higher) or slower."""
    if sig.ndim == 1:
        idx = np.arange(0, len(sig) - 1, ratio)
        return np.interp(idx, np.arange(len(sig)), sig)
    return np.stack([repitch(c, ratio) for c in sig])


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    pcm = (data.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def reverb(bus, seconds=1.4, mix=0.18, seed=7):
    """Stereo convolution reverb with a decaying-noise impulse response."""
    length = int(seconds * SR)
    t = np.arange(length) / SR
    out = np.zeros_like(bus)
    for c in range(2):
        ir = np.random.default_rng(seed + c).uniform(-1, 1, length) * np.exp(-t * 6.5 / seconds)
        ir = fft_filter(ir, lo=180, hi=7000)
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(bus.shape[1] + length)))
        wet = np.fft.irfft(np.fft.rfft(bus[c], size) * np.fft.rfft(ir, size), size)[: bus.shape[1]]
        out[c] = bus[c] + mix * wet
    return out


def at_step(bar, step):
    """Time (s) of a sixteenth step inside a bar (bars count from 0)."""
    return bar * BAR + step * STEP


# --------------------------------------------------------------- drums
def kick():
    length = 0.32
    t = np.arange(int(length * SR)) / SR
    f = 46 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    click = fft_filter(noise(length, 11), lo=1500, hi=6000) * np.exp(-t * 300) * 0.8
    return np.tanh(1.6 * (body + click))


def surdo(pitch=58, length=0.6, bright=0.0):
    t = np.arange(int(length * SR)) / SR
    f = pitch * (1 + 0.35 * np.exp(-t * 22))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    skin = fft_filter(noise(length, 13), lo=200, hi=1800) * np.exp(-t * 60) * (0.25 + bright)
    return np.tanh(1.3 * (body + skin))


def caixa(accent=1.0, seed=None):
    length = 0.11
    t = np.arange(int(length * SR)) / SR
    wires = fft_filter(noise(length, seed), lo=2500, hi=9000) * np.exp(-t * 55)
    head = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 70) * 0.35
    return (wires + head) * accent


def clap():
    length = 0.25
    t = np.arange(int(length * SR)) / SR
    burst = np.zeros_like(t)
    for k, off in enumerate([0.0, 0.011, 0.022]):
        m = t >= off
        burst[m] += np.exp(-(t[m] - off) * (300 if k < 2 else 28))
    return fft_filter(noise(length, 21), lo=900, hi=4200) * burst


def tamborim(seed=None):
    length = 0.06
    t = np.arange(int(length * SR)) / SR
    tone = pulse(1180, length, 0.25) * np.exp(-t * 90) * 0.5
    snap = fft_filter(noise(length, seed), lo=2000, hi=8000) * np.exp(-t * 140)
    return tone + snap


def agogo(high=True):
    length = 0.22
    t = np.arange(int(length * SR)) / SR
    f = 932.3 if high else 698.5  # A#5 / F5: bright bells over D major
    bell = pulse(f, length, 0.125) + 0.6 * pulse(f * 1.5, length, 0.5)
    return bell * np.exp(-t * 16) * 0.5


def chocalho(accent=1.0, seed=None):
    length = 0.045
    t = np.arange(int(length * SR)) / SR
    return fft_filter(noise(length, seed), lo=6000, hi=14000) * np.exp(-t * 90) * accent


def crash(length=1.6, seed=31):
    t = np.arange(int(length * SR)) / SR
    metal = fft_filter(noise(length, seed), lo=3500, hi=15000) * np.exp(-t * 2.6)
    return metal


# --------------------------------------------------------------- harmony
# One chord per half bar (1 s), 30 slots. Story: Bm G Em A (half time) ->
# D on the drop -> G A -> D on VIROU -> Bm G A (table) -> D Bm G A (club)
# -> D on CAMPEÃO -> Bm G (question) -> G A -> D (call to action).
CHORDS = ['Bm', 'Bm', 'G', 'G', 'Em', 'Em', 'A', 'A', 'D', 'D', 'G', 'A', 'D', 'D', 'Bm', 'Bm', 'G', 'A',
          'D', 'Bm', 'G', 'A', 'D', 'D', 'Bm', 'G', 'G', 'A', 'D', 'D']
TONES = {
    'D': ['D', 'F#', 'A'], 'G': ['G', 'B', 'D'], 'A': ['A', 'C#', 'E'], 'Bm': ['B', 'D', 'F#'], 'Em': ['E', 'G', 'B'],
}
ROOT = {'D': 'D', 'G': 'G', 'A': 'A', 'Bm': 'B', 'Em': 'E'}


def chord_at(t):
    return CHORDS[min(int(t // 1.0), len(CHORDS) - 1)]


def voiced(chord, base_octave=4):
    """Close voicing above ~D4 for the pad."""
    notes = []
    for i, p in enumerate(TONES[chord]):
        m = n(f'{p}{base_octave}')
        if m < n('D4'):
            m += 12
        notes.append(m)
    return sorted(notes)


# --------------------------------------------------------------- buses
music = {k: np.zeros((2, N)) for k in ['drums', 'bass', 'pad', 'arp', 'lead']}
fx = np.zeros((2, N))


def drums_bar(bar, kit):
    """kit: set of parts playing in this bar."""
    for s in range(16):
        t = at_step(bar, s)
        if 'kick' in kit and s in (0, 8):
            place(music['drums'], kick(), t, 0.6)
        if 'surdo' in kit:
            if s in (4, 12):
                place(music['drums'], surdo(56, 0.6, bright=0.35), t, 0.55, -0.1)
            if s in (0, 8):
                place(music['drums'], surdo(74, 0.35, bright=0.3), t, 0.35, 0.1)
        if 'heart' in kit and s in (0, 3):
            place(music['drums'], surdo(60, 0.5, bright=0.4), t, 0.5 if s == 0 else 0.32)
        if 'caixa' in kit:
            acc = 1.0 if s % 4 in (1, 3) else 0.42
            place(music['drums'], caixa(acc, seed=100 + bar * 16 + s), t, 0.42, 0.18)
        if 'clap' in kit and s in (4, 12):
            place(music['drums'], clap(), t, 0.42, -0.05)
        if 'tamborim' in kit and s in (0, 2, 4, 5, 7, 9, 11, 12, 14):
            place(music['drums'], tamborim(seed=300 + bar * 16 + s), t, 0.38, 0.45)
        if 'agogo' in kit:
            if s in (0, 3, 6, 10):
                place(music['drums'], agogo(True), t, 0.25, -0.5)
            if s in (8, 12, 14):
                place(music['drums'], agogo(False), t, 0.25, -0.5)
        if 'chocalho' in kit:
            acc = 1.0 if s % 2 == 1 else 0.5
            place(music['drums'], chocalho(acc, seed=500 + bar * 16 + s), t, 0.22, 0.3)
        if 'tick' in kit and s % 2 == 0:
            place(music['drums'], chocalho(0.7 if s % 4 == 0 else 0.4, seed=700 + bar * 16 + s), t, 0.18, 0.35)


def snare_roll(t0, t1, start=0.15, end=0.6, rate=16):
    """Snare roll from t0 to t1 (s), rising in level (build)."""
    hits = int((t1 - t0) * rate)
    for k in range(hits):
        t = t0 + k / rate
        g = start + (end - start) * (k / max(1, hits - 1)) ** 1.5
        place(music['drums'], caixa(1.0, seed=900 + k), t, g, 0.1)


# Bars 0-2 (0-6 s): half time — a heartbeat, a tick, the pad holds.
for bar in range(0, 3):
    drums_bar(bar, {'heart'} | ({'tick'} if bar >= 1 else set()))
# Bar 3 (6-8 s): build — roll and rising arp; a breath before the drop.
drums_bar(3, {'heart', 'tick'})
snare_roll(6.0, 7.72, 0.1, 0.55, rate=16)
# Bars 4-6 (8-14 s): the match — full batucada.
for bar in range(4, 7):
    drums_bar(bar, {'kick', 'surdo', 'caixa', 'clap', 'tamborim', 'agogo', 'chocalho'})
# Bars 7-8 (14-18 s): the table — keep the groove, lighter on top.
for bar in range(7, 9):
    drums_bar(bar, {'kick', 'surdo', 'caixa', 'tamborim', 'chocalho'})
# Bars 9-11 (18-24 s): the club and CAMPEÃO — everything.
for bar in range(9, 12):
    drums_bar(bar, {'kick', 'surdo', 'caixa', 'clap', 'tamborim', 'agogo', 'chocalho'})
# Bar 12 (24-26 s): the question — breakdown (surdo, agogô, chocalho).
drums_bar(12, {'surdo', 'agogo', 'chocalho'})
# Bar 13 (26-28 s): the mark — groove back in, roll into the last chord.
drums_bar(13, {'kick', 'surdo', 'tamborim', 'chocalho'})
snare_roll(27.0, 27.94, 0.12, 0.5, rate=16)
# Bar 14 (28 s): the last hit, then the ring.
place(music['drums'], kick(), 28.0, 1.0)
place(music['drums'], surdo(56, 1.2), 28.0, 0.9)
for t, g in [(7.9, 0.0), (10.0, 0.55), (12.0, 0.75), (18.0, 0.45), (22.0, 0.75), (28.0, 0.8)]:
    if g:
        place(music['drums'], crash(2.2 if t >= 22 else 1.6, seed=int(t * 10)), t, g, 0.25)


# --------------------------------------------------------------- bass
def bass_note(midi_n, t, length, gain=0.5):
    env = env_adsr(length, 0.004, 0.08, 0.8, 0.04)
    sig = shape(tri4(midi(midi_n), length + 0.05), env)
    edge = shape(pulse(midi(midi_n + 12), length + 0.05, 0.25), env) * 0.16
    place(music['bass'], 0.76 * sig + edge, t, gain)


# Samba bass on sixteenths: root, fifth pickups, octave answer.
PATTERN = [(0, 3, 0), (3, 1, 7), (4, 2, 0), (6, 2, 12), (8, 3, 0), (11, 1, 7), (12, 2, 0), (14, 2, 7)]
for bar in range(15):
    for (s, length, interval) in PATTERN:
        t = at_step(bar, s)
        if t >= 28.0:
            break
        if bar < 3:  # half time: long roots only
            if s in (0, 8):
                bass_note(n(f'{ROOT[chord_at(t)]}2'), t, 0.45, 0.34)
            continue
        if bar == 3 and t > 7.7:
            continue
        if bar == 12 and s not in (0, 8):
            continue
        root = n(f'{ROOT[chord_at(t)]}2')
        if root > n('G2'):
            root -= 12
        bass_note(root + interval, t, length * STEP * 0.92, 0.5)
bass_note(n('D2'), 28.0, 1.6, 0.6)

# --------------------------------------------------------------- pad
for k, chord in enumerate(CHORDS):
    t = float(k)
    if 7.72 <= t < 8.0:
        continue
    length = 1.0 if k < 29 else 1.8
    if k == 7:
        length = 0.72
    sig = np.zeros(int((length + 0.3) * SR))
    for m in voiced(chord):
        for det in (-6, 6):
            v = pulse(midi(m) * 2 ** (det / 1200), length + 0.3, 0.25)
            sig += v[: len(sig)]
    sig = shape(sig, env_adsr(length, 0.06, 0.2, 0.75, 0.25))
    sig = onepole_lp(sig, 1700 if k < 8 else 2600)
    place(music['pad'], sig, t, 0.065 if k < 8 else 0.058, -0.2 + 0.4 * (k % 2))

# --------------------------------------------------------------- arp
def arp_run(t0, t1, rate=16, octave=5, gain=0.06, rising=False, pan=0.3):
    k = 0
    t = t0
    while t < t1 - 1e-6:
        chord = chord_at(t)
        tones = [n(f'{p}{octave}') for p in TONES[chord]]
        tones = sorted(tones)
        if rising:
            m = tones[k % 3] + 12 * ((k // 3) % 3)
        else:
            m = tones[[0, 1, 2, 1][k % 4]]
        length = 1 / rate
        sig = shape(pulse(midi(m), length * 0.9, 0.5), env_adsr(length * 0.8, 0.002, 0.03, 0.5, 0.02))
        place(music['arp'], sig, t, gain, pan)
        k += 1
        t = t0 + k / rate


arp_run(6.0, 7.72, rate=12, octave=5, gain=0.055, rising=True)  # build into the drop
arp_run(8.0, 10.9, rate=8, octave=6, gain=0.05)
arp_run(10.9, 11.62, rate=32, octave=5, gain=0.06, rising=True)  # 4x: the clock races
arp_run(11.62, 14.0, rate=8, octave=6, gain=0.05)
arp_run(14.0, 18.0, rate=8, octave=6, gain=0.035, pan=-0.3)
arp_run(18.0, 24.0, rate=8, octave=6, gain=0.05)
arp_run(24.0, 26.0, rate=4, octave=5, gain=0.05, pan=-0.2)
arp_run(26.0, 27.94, rate=12, octave=5, gain=0.05, rising=True)

# --------------------------------------------------------------- lead
LEAD = []  # (time s, beats, note)


def phrase(bar, notes, octave_shift=0):
    """notes: list of (eighths, name or None)."""
    t = bar * BAR
    for eighths, name in notes:
        dur = eighths * BEAT / 2
        if name:
            LEAD.append((t, dur, n(name) + octave_shift))
        t += dur


HOOK_A = [(1, 'A4'), (1, 'A4'), (3, 'D5'), (1, 'E5'), (2, 'F#5')]
HOOK_B = [(1, 'E5'), (1, 'D5'), (2, 'B4'), (2, 'A4'), (2, None)]
HOOK_D = [(3, 'A5'), (1, 'F#5'), (2, 'E5'), (2, 'D5')]
HOOK_C = [(1, 'A4'), (1, 'A4'), (3, 'D5'), (1, 'E5'), (1, 'F#5'), (1, 'G5')]
TEASE = [(2, 'F#4'), (2, None), (1, 'A4'), (1, 'B4'), (2, None)]
phrase(4, HOOK_A)          # 8.0  the drop
phrase(5, HOOK_C)          # 10.0 goal 1: the call climbs
phrase(6, HOOK_D)          # 12.0 VIROU: A5 on the downbeat
phrase(7, TEASE)           # 14.0 the table: a light answer
phrase(9, HOOK_A)          # 18.0 the club
phrase(10, HOOK_C)         # 20.0
phrase(11, HOOK_D, 12)     # 22.0 CAMPEÃO: an octave up
LEAD.append((28.0, 1.5, n('D5')))
LEAD.append((28.0, 1.5, n('F#5')))
LEAD.append((28.0, 1.5, n('A5')))

for (t, dur, m) in LEAD:
    length = max(0.08, dur * 0.94)
    duty = 0.25 if m < n('A5') else 0.125
    sig = pulse(midi(m), length + 0.12, duty, vib=14 if dur >= 0.5 else 0)
    sig = shape(sig, env_adsr(length, 0.004, 0.09, 0.72, 0.1))
    place(music['lead'], sig, t, 0.15 if t < 28 else 0.09)

# The lead gets a dotted-eighth echo, panned wide.
lead_echo = np.zeros_like(music['lead'])
delay = int(0.375 * SR)
lead_echo[0, delay:] += 0.28 * music['lead'][1, :-delay]
lead_echo[1, 2 * delay:] += 0.16 * music['lead'][0, : -2 * delay]
music['lead'] += lead_echo

# --------------------------------------------------------------- crowd
def crowd_bed(t0, t1, level, bright=1.0, seed=41):
    length = t1 - t0
    count = int(length * SR)
    t = np.arange(count) / SR
    out = np.zeros((2, count))
    for c in range(2):
        voices = fft_filter(noise(length, seed + c), lo=260, hi=2200 * bright, slope=2)
        formant = fft_filter(noise(length, seed + 10 + c), lo=600, hi=1300, slope=3) * 0.6
        rng = np.random.default_rng(seed + 20 + c)
        knots = rng.uniform(0.55, 1.0, int(length * 6) + 2)
        swell = np.interp(t, np.linspace(0, length, len(knots)), knots)
        out[c] = (voices + formant) * swell
    fade = np.minimum(1, np.minimum(t / 0.25, (length - t) / 0.4))
    out *= np.clip(fade, 0, 1)
    out /= np.max(np.abs(out)) + 1e-9
    place(fx, out, t0, level)


def roar(t0, length, level, seed=61):
    """A goal roar: the crowd swells, brightens and falls back."""
    count = int(length * SR)
    t = np.arange(count) / SR
    out = np.zeros((2, count))
    for c in range(2):
        body = fft_filter(noise(length, seed + c), lo=300, hi=3600, slope=2)
        vowel = fft_filter(noise(length, seed + 5 + c), lo=650, hi=1250, slope=4) * 0.9
        out[c] = body + vowel
    shape = (1 - np.exp(-t / 0.07)) * np.exp(-np.maximum(0, t - 0.35) / (length * 0.45))
    out *= shape
    out /= np.max(np.abs(out)) + 1e-9
    place(fx, out, t0, level)


crowd_bed(0.0, 7.8, 0.05, bright=0.8, seed=41)       # half-time murmur
crowd_bed(7.85, 13.5, 0.07, bright=1.1, seed=43)    # second half
roar(10.0, 1.8, 0.15, seed=61)                          # 1 x 1
roar(12.0, 2.6, 0.19, seed=63)                         # VIROU
roar(22.05, 2.0, 0.13, seed=65)                        # CAMPEÃO

# --------------------------------------------------------------- effects
Z = {k: read_wav(os.path.join(ZZFX_DIR, f'zzfx-{k}.wav'))[0] for k in ['click', 'confirm', 'whistle', 'coin', 'goal', 'crowd']}
P = {k: load_any(os.path.join(SFX_DIR, f'{k}.mp3')) for k in ['whoosh', 'whoosh-short', 'whoosh-cinematic', 'impact-bass-1', 'impact-bass-2', 'pop', 'riser', 'sparkle']}


def peak_offset(sig):
    """Seconds from a sample's start to its loudest point."""
    mono = np.abs(sig if sig.ndim == 1 else sig.mean(axis=0))
    return int(np.argmax(mono)) / SR


def hit(name, t, gain, pan=0.0, pitch=1.0, align_peak=False):
    """Places an effect so its peak lands one frame after the picture."""
    src = Z[name] if name in Z else P[name]
    sig = repitch(src, pitch) if pitch != 1.0 else src
    start = t + 1 / 30
    if align_peak:
        start -= peak_offset(sig)
    place(fx, sig, start, gain, pan)


C = {  # cursor clicks (assets/js/plano.js) and their effects
    'ofensiva': 3.0, 'f433': 3.5, 'pega': 4.5, 'solta': 5.4, 'segundo': 7.0, 'v4': 10.85, 'v1': 11.55,
    'preparar': 13.95, 'aceitar': 18.5, 'proposta': 19.5, 'chamada': 28.0,
}
for key in ['ofensiva', 'f433', 'segundo', 'v4', 'v1', 'preparar', 'aceitar', 'proposta']:
    hit('click', C[key] - 1 / 30, 0.55, 0.1)
hit('click', C['pega'] - 1 / 30, 0.45, -0.1, pitch=0.8)
hit('confirm', C['solta'], 0.32)
hit('confirm', C['chamada'], 0.42)
hit('click', C['chamada'] - 1 / 30, 0.5)

# Whistles: half time (two blasts), second half (one long), full time (three).
hit('whistle', 0.1, 0.32, 0.0)
hit('whistle', 0.42, 0.32, 0.0)
hit('whistle', 7.88, 0.38, 0.0, pitch=0.97)
for k, t in enumerate([13.35, 13.55, 13.75]):
    hit('whistle', t, 0.34, 0.0, pitch=1.0 if k < 2 else 0.95)

# Goals: the game's goal jingle + bass impact.
hit('goal', 10.0, 0.42)
hit('impact-bass-1', 10.0, 0.24, align_peak=True)
hit('goal', 12.0, 0.48)
hit('impact-bass-2', 12.0, 0.3, align_peak=True)
hit('pop', 12.1, 0.3, -0.2)

# Riser into the winning goal (its 10 s build, last 1.1 s only).
riser = P['riser']
cut = riser[:, int((riser.shape[1] / SR - 1.1) * SR):]
cut = cut * np.linspace(0.0, 1.0, cut.shape[1]) ** 1.5
place(fx, cut, 12.0 + 1 / 30 - cut.shape[1] / SR, 0.3)

# Transitions: page scrolls, the zoom through the button, whips, pull-back.
hit('whoosh-short', 2.0, 0.22, -0.2)
hit('whoosh-short', 6.0, 0.22, 0.2, pitch=1.06)
hit('whoosh-cinematic', 7.1, 0.34, align_peak=False)
hit('whoosh', 12.95, 0.24, -0.1)
hit('whoosh-short', 14.05, 0.24, 0.15, pitch=0.94)
hit('whoosh', 17.82, 0.26, -0.3, pitch=1.1)
hit('whoosh-short', 19.02, 0.18, 0.3)
hit('whoosh', 22.0, 0.22, 0.0, pitch=0.9)
hit('whoosh-short', 24.0, 0.2, -0.25)
hit('whoosh-short', 26.14, 0.2, 0.25, pitch=1.1)

# Money and pops.
for k in range(3):
    hit('coin', C['aceitar'] + 0.08 + k * 0.1, 0.3, 0.2, pitch=1.0 + 0.06 * k)
hit('pop', 4.0, 0.28, -0.15)
hit('pop', 16.7, 0.3, 0.1)
hit('confirm', 16.62, 0.3, 0.0, pitch=1.12)
hit('sparkle', 22.12, 0.28, 0.0)
hit('pop', 27.25, 0.3, 0.0)

# Table re-sorts: rising chip blips on the beat.
for k, t in enumerate([15.0, 15.75, 16.5]):
    for j, iv in enumerate([0, 7]):
        m = n('A5') + 2 * k + iv
        sig = shape(pulse(midi(m), 0.07, 0.25), env_adsr(0.06, 0.002, 0.02, 0.6, 0.02))
        place(fx, sig, t + j * 0.05, 0.1, 0.1)

# Map buildings light on eighths; the pyramid stacks; the wordmark letters.
for k, t in enumerate([20.05, 20.27, 20.49, 20.71]):
    m = [n('D6'), n('E6'), n('F#6'), n('A6')][k]
    sig = shape(pulse(midi(m), 0.08, 0.125), env_adsr(0.07, 0.002, 0.02, 0.6, 0.02))
    place(fx, sig, t, 0.08, -0.2 + 0.13 * k)
for k, t in enumerate([21.0, 21.15, 21.3]):
    place(fx, surdo(90 + 20 * k, 0.25), t, 0.25)
for k in range(8):
    m = [n('D5'), n('F#5'), n('A5'), n('D6'), n('F#6'), n('A6'), n('B6'), n('D7')][k]
    sig = shape(pulse(midi(m), 0.06, 0.25), env_adsr(0.05, 0.002, 0.02, 0.6, 0.02))
    place(fx, sig, 26.22 + k * 2 / 30, 0.06, -0.35 + 0.1 * k)

# Chalk on the tactics board: the arrows draw (band-passed scratch).
length = 0.32
t = np.arange(int(length * SR)) / SR
scratch = fft_filter(noise(length, 71), lo=1800, hi=5200) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 38 * t))) * np.exp(-t * 5)
place(fx, scratch, 3.04, 0.08, 0.35)

# --------------------------------------------------------------- mixdown
mus = sum(music.values())


def tilt(bus):
    """Phone-friendly balance: high-pass 32 Hz, -4 dB below 100 Hz, +2 dB presence."""
    out = np.zeros_like(bus)
    for c in range(2):
        spec = np.fft.rfft(bus[c])
        f = np.fft.rfftfreq(bus.shape[1], 1 / SR)
        hp = 1 / np.sqrt(1 + (32 / np.maximum(f, 1)) ** 8)
        shelf = 10 ** ((-4 / (1 + (f / 100) ** 2)) / 20)
        presence = 10 ** ((2 * np.exp(-((np.log2(np.maximum(f, 1) / 2800)) ** 2) / 0.8)) / 20)
        out[c] = np.fft.irfft(spec * hp * shelf * presence, bus.shape[1])
    return out


mus = tilt(mus)
mus = reverb(mus, seconds=1.2, mix=0.12)
# Kick-ducked music, gentle: the pulse breathes under the hits.
duck = np.ones(N)
for bar in list(range(4, 12)) + [13]:
    for s in (0, 8):
        i = int(at_step(bar, s) * SR)
        length = int(0.18 * SR)
        if i + length < N:
            duck[i:i + length] = np.minimum(duck[i:i + length], 0.82 + 0.18 * np.linspace(0, 1, length) ** 2)
mus[0] *= duck
mus[1] *= duck
# Fade the ring after the last chord; silence before the drop.
tt = np.arange(N) / SR
mus *= np.where(tt > 28.9, np.clip(1 - (tt - 28.9) / 1.0, 0, 1), 1)
gap = (tt > 7.74) & (tt < 7.98)
mus[:, gap] *= 0.0
fxr = reverb(tilt(fx), seconds=0.9, mix=0.08, seed=9)

os.makedirs(OUT_DIR, exist_ok=True)
mix = mus + fxr
gain = 1.0 / max(1.0, np.max(np.abs(mix)) * 1.05)
for name, data in [('musica', mus), ('efeitos', fxr), ('mix-bruto', mix)]:
    write_wav(os.path.join(OUT_DIR, f'{name}.wav'), data * gain)
    print(f'{name}: peak {20 * np.log10(np.max(np.abs(data * gain)) + 1e-12):.1f} dBFS')

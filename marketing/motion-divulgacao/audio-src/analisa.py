#!/usr/bin/env python3
"""Octave-band balance and section loudness of a WAV (no ears needed)."""
import sys
import wave

import numpy as np

with wave.open(sys.argv[1]) as w:
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
x = x.reshape(-1, 2).mean(axis=1)


def bands(sig):
    spec = np.abs(np.fft.rfft(sig * np.hanning(len(sig)))) ** 2
    f = np.fft.rfftfreq(len(sig), 1 / sr)
    out = []
    for c in [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]:
        m = (f >= c / 2 ** 0.5) & (f < c * 2 ** 0.5)
        out.append(10 * np.log10(spec[m].sum() + 1e-20))
    out = np.array(out)
    return out - out.max()


def section(t0, t1):
    seg = x[int(t0 * sr):int(t1 * sr)]
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)


print('octave bands (dB rel. max):')
print('  ' + '  '.join(f'{c:>6}' for c in ['31', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']))
print('  ' + '  '.join(f'{v:6.1f}' for v in bands(x)))
print('RMS by section (dBFS):')
for name, a, b in [('intervalo', 0, 7.7), ('drop+jogo', 8, 10), ('gols', 10, 13.5), ('tabela', 14, 18), ('clube', 18, 22), ('campeao', 22, 24), ('pergunta', 24, 26), ('marca', 26, 28), ('final', 28, 30)]:
    print(f'  {name:10s} {section(a, b):6.1f}')

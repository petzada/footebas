#!/usr/bin/env python3
"""
Loudness master with ffmpeg: gain, then a peak limiter (alimiter, 4x
oversampled by resampling around it so inter-sample peaks are caught), then
EBU R128 measurement; the gain is solved so the master lands on the target
integrated loudness with its true peak under the ceiling. The default ceiling
leaves room for the AAC encode, which lifts true peaks by about 0.8 dB.

Usage: python3 master.py <in.wav> <out.wav> [target LUFS] [ceiling dBTP]
"""
import json
import re
import subprocess
import sys

src, dst = sys.argv[1], sys.argv[2]
target = float(sys.argv[3]) if len(sys.argv) > 3 else -15.0
ceiling = float(sys.argv[4]) if len(sys.argv) > 4 else -2.0


def chain(gain_db):
    limit = 10 ** ((ceiling - 0.3) / 20)
    return (
        f'volume={gain_db:.2f}dB,aresample=192000,'
        f'alimiter=limit={limit:.4f}:attack=1:release=60:level=false,'
        'aresample=48000'
    )


def measure(gain_db):
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af', chain(gain_db) + ',ebur128=peak=true', '-f', 'null', '-'],
        capture_output=True, text=True,
    ).stderr
    summary = out[out.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return i, tp


gain = 0.0
for _ in range(6):
    i, tp = measure(gain)
    print(f'gain {gain:+.2f} dB -> {i:.2f} LUFS, true peak {tp:.2f} dBTP')
    if abs(i - target) < 0.15:
        break
    gain += target - i
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', chain(gain), '-ar', '48000', '-c:a', 'pcm_s16le', dst], check=True)
print(json.dumps({'gain_db': round(gain, 2), 'target_lufs': target, 'ceiling_dbtp': ceiling}))

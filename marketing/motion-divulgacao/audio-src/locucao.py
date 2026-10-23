#!/usr/bin/env python3
"""
Narration for the Footebas film (pt-BR): one line per on-screen action, timed
by audio-src/locucao.json ("inicio" = start in film seconds, "fim_max" = the
moment the line must be over by, e.g. the first goal).

Two providers, one output: a mono WAV per line, silence-trimmed so "inicio"
is the first syllable, plus locucao-meta.json with every line's duration.

  kokoro      Kokoro-82M on the machine (Apache-2.0 weights), Brazilian voices
              pm_alex / pm_santa / pf_dora. Uses the model `npx hyperframes tts`
              downloads to ~/.cache/hyperframes/tts. espeak's pt-BR phonemes
              are fixed per line: "fala" respells a word (Footebas -> Futébas,
              negocie -> negócie) and "fonemas" swaps phoneme strings.
  elevenlabs  The ElevenLabs API. Reads ELEVENLABS_API_KEY and
              ELEVENLABS_VOICE_ID from the environment (never from a file).
              Each request carries the neighbouring lines as previous_text /
              next_text so the read stays one continuous performance.

Usage: python3 locucao.py <out-dir> [--provedor kokoro|elevenlabs] [--voz <id>]
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.expanduser('~/.cache/hyperframes/tts')

parser = argparse.ArgumentParser()
parser.add_argument('out')
parser.add_argument('--provedor', default='kokoro', choices=['kokoro', 'elevenlabs'])
parser.add_argument('--voz')
parser.add_argument('--roteiro', default=os.path.join(HERE, 'locucao.json'))
args = parser.parse_args()
plan = json.load(open(args.roteiro, encoding='utf-8'))
os.makedirs(args.out, exist_ok=True)
lines = plan['falas']


def spoken(line):
    return line.get('fala', line['texto'])


def trim(samples, sr, floor_db=-45.0, pad=0.02):
    """Cuts leading/trailing silence so a line starts on its first syllable."""
    level = np.abs(samples)
    loud = np.where(level > 10 ** (floor_db / 20) * level.max())[0]
    if not len(loud):
        return samples
    a = max(0, loud[0] - int(pad * sr))
    b = min(len(samples), loud[-1] + int(pad * sr))
    return samples[a:b]


def kokoro_lines():
    from kokoro_onnx import Kokoro

    model = Kokoro(os.path.join(CACHE, 'models', 'kokoro-v1.0.onnx'), os.path.join(CACHE, 'voices', 'voices-v1.0.bin'))
    voice = args.voz or plan['voz']['kokoro']
    lang = plan['idioma']
    for line in lines:
        phonemes = model.tokenizer.phonemize(spoken(line), lang)
        for old, new in line.get('fonemas', {}).items():
            phonemes = phonemes.replace(old, new)
        speed = line.get('velocidade', plan['velocidade'])
        samples, sr = model.create(phonemes, voice=voice, speed=speed, lang=lang, is_phonemes=True)
        yield line, np.asarray(samples, dtype=np.float32), sr, phonemes


def elevenlabs_lines():
    key = os.environ.get('ELEVENLABS_API_KEY')
    voice = args.voz or os.environ.get('ELEVENLABS_VOICE_ID')
    if not key or not voice:
        sys.exit('ElevenLabs needs ELEVENLABS_API_KEY and a voice (ELEVENLABS_VOICE_ID or --voz) in the environment.')
    texts = [spoken(line) for line in lines]
    for i, line in enumerate(lines):
        body = {
            'text': texts[i],
            'model_id': plan['voz']['elevenlabs_modelo'],
            'voice_settings': {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.3, 'use_speaker_boost': True},
            'previous_text': ' '.join(texts[:i])[-500:],
            'next_text': ' '.join(texts[i + 1:])[:500],
        }
        req = urllib.request.Request(
            f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
            data=json.dumps(body).encode(),
            headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        )
        mp3 = os.path.join(args.out, f'{line["id"]}.mp3')
        with urllib.request.urlopen(req, timeout=120) as res, open(mp3, 'wb') as f:
            f.write(res.read())
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        yield line, np.frombuffer(pcm, dtype=np.float32), 44100, None


meta = []
source = kokoro_lines() if args.provedor == 'kokoro' else elevenlabs_lines()
for line, samples, sr, phonemes in source:
    samples = trim(samples, sr)
    path = os.path.join(args.out, f'{line["id"]}.wav')
    sf.write(path, samples, sr, subtype='PCM_16')
    dur = len(samples) / sr
    end = line['inicio'] + dur
    mix_keys = {k: line[k] for k in ('abaixa_max_db', 'trecho_proprio') if k in line}
    meta.append({'id': line['id'], 'arquivo': path, 'inicio': line['inicio'], 'duracao': round(dur, 3), 'fim': round(end, 3), 'fim_max': line['fim_max'], 'cabe': end <= line['fim_max'], 'fonemas': phonemes, **mix_keys})
    print(f'{line["id"]:12} {line["inicio"]:6.2f} -> {end:6.2f} s (até {line["fim_max"]:5.2f}) {"ok" if end <= line["fim_max"] else "PASSA"}  {spoken(line)}')
json.dump({'provedor': args.provedor, 'falas': meta}, open(os.path.join(args.out, 'locucao-meta.json'), 'w'), ensure_ascii=False, indent=1)

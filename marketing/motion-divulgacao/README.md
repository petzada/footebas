# Footebas — "A Virada" (motion de divulgação, 30 s)

Filme horizontal de 30 s (1920 × 1080, 30 fps, H.264 + AAC) que mostra o jogo, a partida no estádio 3D, a
tabela e os recursos do clube, com um cursor que joga no lugar do espectador. Feito em
[HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP renderizado quadro a quadro) e ffmpeg.

- **Arquivos finais:** `renders/footebas-a-virada-30s-narrado.mp4` (com a locução em pt-BR) e
  `renders/footebas-a-virada-30s-sem-voz.mp4` (só trilha e efeitos), ambos a −15 LUFS, faststart.
- **História e decisões:** `STORYLINES.md` (as três ideias), `SPEC.md` (o filme em números, plano a plano),
  `REVIEW.md` (o que foi medido, o que ficou de fora e as pendências jurídicas).

## Estrutura

| Caminho                     | O que é                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `index.html`                | Composição raiz: monta as cenas, a trilha e as variáveis de texto              |
| `compositions/*.html`       | Uma cena por arquivo (placar, tática, apito, estádio, tabela, clube…)          |
| `assets/js/plano.js`        | O plano do filme: início de cada cena e cada clique do cursor (tempo e posição) |
| `assets/js/fb.js`           | Kit de movimento: molas em forma fechada, sprites, acentos em pixel, cursor    |
| `assets/css/footebas.css`   | Os tokens e materiais do jogo (gramado, prancheta, placar, botões de pixel)    |
| `assets/footage/`           | Estádio 3D real, gravado quadro a quadro e ampliado 4× por vizinho mais próximo |
| `assets/audio/trilha.wav`   | Trilha + efeitos, já abaixados sob a voz (sem master)                          |
| `assets/audio/locucao.wav`  | A locução no tempo do filme (sem master)                                       |
| `audio-src/`                | Scripts da trilha, da locução e da mixagem (determinísticos)                   |
| `audio-src/locucao.json`    | O roteiro: cada fala, quando entra e até quando precisa acabar                 |
| `capture-src/`              | Scripts Playwright que gravaram o footage e extraíram o mapa do clube          |

## Editar e pré-visualizar

```bash
cd marketing/motion-divulgacao
npx hyperframes@0.8.189 preview        # Studio no navegador
npx hyperframes@0.8.189 check          # lint, layout, movimento e contraste
```

O slogan, o texto do botão e o endereço são variáveis (`slogan`, `chamada`, `url`). As cores são os tokens do
jogo em `assets/css/footebas.css`; ficam fixas porque o footage do estádio usa as mesmas. Para continuar editando
conversando, o app HyperFrames para desktop abre esta pasta.

## Renderizar a entrega

O render do HyperFrames soma as duas faixas sem master; o áudio final entra depois, sem reprocessamento:

```bash
npx hyperframes@0.8.189 render --quality delivery --video-frame-format png --output renders/bruto.mp4
for v in narrado sem-voz; do
  ffmpeg -i renders/bruto.mp4 -i /tmp/trilha/master-$v.wav -map 0:v:0 -map 1:a:0 -c:v copy \
    -c:a aac -b:a 256k -ar 48000 -ac 2 -t 30 -movflags +faststart renders/footebas-a-virada-30s-$v.mp4
done
```

## Refazer a trilha e a locução

A trilha é uma batucada chiptune a 120 BPM escrita na grade do filme, com os sons ZzFX do próprio jogo e efeitos
da biblioteca do HyperFrames (Pixabay). A locução é masculina, em pt-BR, com o Kokoro-82M rodando na máquina
(voz `pm_santa`). Tudo é determinístico: a mesma entrada gera o mesmo arquivo.

```bash
cd audio-src
node zzfx-render.mjs ../../../node_modules/.pnpm/zzfx@1.4.0/node_modules/zzfx/ZzFX.js /tmp/trilha
python3 trilha.py /tmp/trilha <pasta-de-sfx-do-hyperframes> /tmp/trilha   # media-use/audio/assets/sfx
python3 master.py /tmp/trilha/mix-bruto.wav /tmp/trilha/master-sem-voz.wav  # −15 LUFS, teto −2 dBTP
python3 locucao.py /tmp/voz              # Kokoro: pip install kokoro-onnx soundfile
python3 mixa.py /tmp/trilha /tmp/voz /tmp/mix
cp /tmp/mix/trilha.wav /tmp/mix/locucao.wav ../assets/audio/
python3 master.py /tmp/mix/mix-bruto.wav /tmp/trilha/master-narrado.wav -15 -3  # a voz pede teto −3
python3 analisa.py /tmp/trilha/master-narrado.wav                     # balanço por oitava
```

O modelo do Kokoro é o que `npx hyperframes tts` baixa em `~/.cache/hyperframes/tts`.

`mixa.py` abaixa a trilha só o necessário para a voz ficar 11 LU acima dela em cada trecho falado (de 6 a 11 dB
aqui), tira 4 dB entre 1,8 e 7 kHz da trilha sob a fala para as consoantes passarem, e deixa os gols, o VIROU! e o
CAMPEÃO! sem voz por cima.

Os tempos dos cliques estão copiados de `assets/js/plano.js` no dicionário `C` de `trilha.py`, e os das falas
estão em `locucao.json`: se uma ação mudar de tempo, mude nos dois lugares e refaça o áudio. Em `locucao.json`,
`fala` é a grafia que o sintetizador lê (`Futébas`, para soar "fu-TÉ-bas") e `fonemas` corrige um som do espeak.

## Trocar a voz pela ElevenLabs

1. Nas configurações do ambiente (menu do ambiente no título da sessão → Editar), adicione a chave como
   `ELEVENLABS_API_KEY` e escolha na Voice Library uma voz nativa brasileira: o ID vai em `ELEVENLABS_VOICE_ID`
   ou no `--voz <id>`.
2. Numa sessão nova: `python3 locucao.py /tmp/voz --provedor elevenlabs`. O roteiro e os tempos são os mesmos;
   cada pedido leva as falas vizinhas (`previous_text` / `next_text`) para a leitura soar contínua.
3. Confira a tabela que o script imprime (toda fala precisa terminar antes de `fim_max`), depois `mixa.py`,
   `master.py` e o remux acima. Esse caminho ainda não rodou de verdade: precisa da chave.

## Como o footage foi gravado

Com o jogo rodando localmente (API em memória + `next dev` com `NEXT_PUBLIC_AUTH_MODE=dev`),
`capture-src/record.cjs` cria uma carreira com o Flamengo, joga uma partida real e grava o palco 3D na resolução
nativa da arte (480 × 300) com o relógio do navegador parado e avançado 1/30 s por quadro; no intervalo aplica
Ofensiva e põe o garoto da base. Os banners de gol e substituição ficam escondidos e registrados no `.json`, porque
o filme os redesenha nítidos. Os trechos foram ampliados 4× sem filtro e cortados em H.264:

```bash
node capture-src/record.cjs virada@footebas.test /tmp/rec 2 93 1
ffmpeg -framerate 30 -start_number <início> -i /tmp/rec/f%05d.png -frames:v <n> \
  -vf scale=1920:1200:flags=neighbor -c:v libx264 -crf 12 -pix_fmt yuv420p assets/footage/<trecho>.mp4
```

`capture-src/extract.cjs` salva o SVG do mapa do clube em `assets/img/mapa-do-clube.svg` (embutido em
`compositions/clube.html`).

## Direitos

Escudos e nomes de clubes aparecem como na landing, com o mesmo aviso legal no fim do filme; nenhum atleta é
nomeado. Antes de veicular, ver `FINALIZATION-CHECKLIST.md` itens 7 (escudos), 8 (licença do modelo 3D do
estádio) e 10 (nomes reais). Fonte Press Start 2P sob OFL (`assets/fonts/OFL-press-start-2p.txt`); GSAP sob a
licença padrão da GreenSock; ícones Phosphor sob MIT; voz sintetizada com o Kokoro-82M (pesos Apache-2.0).

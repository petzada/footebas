# ADR 0012 — Direção visual Futebol Retrô

- Status: aceito (substitui o ADR 0009)
- Data: 2026-10-23

## Contexto

O ISOPOP (ADR 0009: pastéis, vidro e blur) não combinou com a partida em Phaser (ADR 0010). O responsável pediu uma
direção de **futebol retrô**: o clima dos managers e modos carreira de videogame dos anos 90 e 2000, com muita imagem,
animação de jogo e liberdade criativa nas telas e na partida.

## Decisão

1. **Estética retrô de videogame de futebol**: pixel art 16-bit, placar de estádio, giz de prancheta, faixas de grama,
   cartões de figurinha, tipografia pixelada para títulos e números, cores saturadas de gramado, giz e placar.
   Inspiração de gênero, nunca cópia: nenhum nome, logotipo, tela, fonte proprietária ou asset do Brasfoot, da EA/FIFA
   ou de outro jogo (`docs/07` §5).
2. **Um tema só**, sem alternância claro/escuro (mantém a decisão de um único modo do ADR 0009); o contraste segue AA
   para textos longos e números.
3. **Assets gerados, não baixados de terceiros**: sprites, emblemas, avatares e texturas desenhados por código
   (Phaser `Graphics`/texturas geradas, SVG) ou vindos de bibliotecas com licença aberta compatível (MIT, OFL, CC0)
   instaladas pelo npm. Nada de imagem sem licença clara.
4. **"3D" é pseudo-3D**: câmera inclinada, escala por profundidade, sombras, paralaxe e sprites em perspectiva no
   Phaser e nas transições. Three.js e 3D real seguem fora do MVP.
5. Continuam valendo do ADR 0010: Phaser só na partida, sob demanda e render-only; React na interface; avatares
   gerados; potencial como estimativa; movimento reduzido respeitado; "pular para o resultado" a um toque; sons com
   mudo e só após interação.
6. Mobile-first (`docs/07` §3) e o orçamento de desempenho continuam: fontes e sprites leves, animações em CSS/canvas
   sem travar a rolagem.

## Consequências

O ISOPOP sai dos tokens de `apps/web/app/globals.css`; a estrutura das telas (Nova Carreira em etapas, Mapa clicável,
Central, emblemas) é mantida e recebe a nova pele. O Mapa do clube vira ilustração retrô (pixel art vista de cima).

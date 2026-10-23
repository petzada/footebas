# ADR 0010 — Apresentação premium e partida em Phaser

- Status: aceito
- Data: 2026-10-23

## Contexto

O responsável quer que o Footebas pareça um jogo, não um painel: direção de arte, hierarquia visual, animações e
feedback, sem 3D. Já existem a interface React (shell, telas de entrada, ISOPOP do ADR 0009), o motor TypeScript
puro e determinístico que roda no servidor (ADR 0001/0002) e um campo 2D em React que reproduz a timeline oficial da
partida (`apps/web/components/match-replay-viewer.tsx`).

## Decisão

1. **React continua sendo a interface principal** (Central, Elenco, Mercado, Escritório, Temporada, Ranking). Nada
   é reescrito; as telas ganham um sistema de movimento e feedback em cima do que existe.
2. **Phaser só na partida.** Uma cena Phaser carregada sob demanda (import dinâmico, fora do bundle inicial) anima
   jogadores, bola, placas de publicidade fictícias e eventos (chance, gol, cartão, substituição) sobre a timeline
   oficial. A coreografia (posições e trajetórias) é apresentação: derivada de forma determinística dos eventos e do
   id da partida, nunca altera placar, eventos ou estatísticas e nunca simula de novo (ADR 0001). O campo 2D atual
   vira o fallback (sem WebGL/Canvas, movimento reduzido ou aparelho fraco).
3. **Apresentação premium:** transições de tela e animações de entrada curtas, cards de atleta com indicadores
   visuais, emblema genérico e cores do clube, celebração de gol e momentos decisivos, sons de interface e de partida
   com botão de mudo lembrado, feedback em toda ação (toque, sucesso, erro). Tudo respeita
   `prefers-reduced-motion` e nunca bloqueia "pular para o resultado".
4. **Avatares gerados, não fotos.** Cards de atleta e treinador usam retratos estilizados determinísticos por atleta
   (sem foto real: direito de imagem). Uma foto licenciada pode substituir o avatar no futuro.
5. **Potencial como estimativa.** Força, condição, moral e características aparecem em barras e selos; potencial e
   atributos ocultos só como faixa estimada com incerteza (decisão de atributos do `docs/08` mantida).
6. **Entrosamento nas regras do mundo.** Cresce com jogos dos mesmos titulares juntos e cai com trocas; vira um
   bônus pequeno e limitado de força efetiva aplicado pela aplicação antes do motor, como o Estrategista (ADR 0007).
   O motor de partida não muda.

## Consequências

- Orçamento: a cena Phaser é carregada só na tela de partida; o primeiro carregamento do app não cresce.
- A timeline de partida continua sendo o único contrato entre servidor e apresentação.
- Áudio é opcional e nunca toca antes de uma interação do usuário (política de autoplay dos navegadores).

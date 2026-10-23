# Revisão — "A Virada" (30 s, 1920 × 1080, 30 fps)

Nota de entrega do filme de divulgação do Footebas. A próxima rodada de mudanças lê isto antes de mexer.

## Decisões criativas

- **Construída:** a storyline 1, "A Virada" (`STORYLINES.md`): Fla-Flu no intervalo, o técnico muda a tática, chama
  o garoto da base, o jogo vira no estádio 3D, o Flamengo sobe até o 1º, o clube por dentro, CAMPEÃO, chamada.
- **Não construídas:** 2, "A rodada cabe no intervalo" (tela dividida: relógio de TV de 15:00 contra uma rodada
  inteira no celular); 3, "Modo atração" (o filme como attract mode de fliperama, um verbo carimbado por batida).
- **O "interativo" é um cursor que é o técnico:** 11 ações na UI real — Ofensiva, 4-3-3, arrastar a figurinha do
  garoto até o campo, começar o segundo tempo, 4× e 1×, preparar a próxima rodada, aceitar o patrocínio,
  contrapropor, e o clique final em "Começar carreira grátis".
- **Tudo vem do jogo:** componentes refeitos em escala de filme com os tokens de `apps/web/app/globals.css`;
  footage real do estádio 3D gravado quadro a quadro (relógio do navegador parado e avançado 1/30 s); o SVG do
  mapa do clube extraído da tela; sprites, escudos e ícones Phosphor do app; sons ZzFX do jogo; narrações do
  motor (`packages/engine/src/narration.ts`); rótulos de status reais ("Em aberto" → "Assinada",
  "Pendente" → "Contraproposta feita").
- **Placar, tabela e valores são ilustrativos:** escolhidos para a história e coerentes entre si (V, E, D e SG
  recalculados a cada rodada); a imagem é do jogo.
- **Duas línguas de movimento:** os passos do produto (dígitos que piscam, letras que caem em degraus, letreiro
  que acende letra a letra) e molas de Framer Motion em forma fechada (UI, layout/FLIP, pop), calculadas por
  tempo, então qualquer quadro renderiza sozinho.
- **Selo de TV no estádio** com as iniciais que o próprio jogo usa no emblema (FLU / FLA): o nome inteiro a 36 px
  não cabia ao lado dos dígitos.
- **Variáveis:** slogan, texto do botão e endereço. As cores ficam nos tokens do jogo (`assets/css/footebas.css`):
  o footage do estádio usa as mesmas, então trocá-las por variável quebraria o filme.

## O que foi medido e o que só foi olhado

- **Medido:** `npx hyperframes check` — lint, runtime, layout, movimento e contraste: **0 erro**. Contraste do
  slogan subiu de 2,6:1 para ~11:1 (agora numa faixa de LED); texto de leitura ≥ 28 px (2,6% da altura).
- **Olhado:** as folhas do `snapshot --review` (20 beats, 17 costuras, os beats a 360 px de largura) e faixas de
  8 quadros no arraste do garoto, no recuo do estádio para o celular, na subida do troféu e na entrada da marca.
- **Som — medido, não ouvido.** Master: −15,0 LUFS integrado, pico real −2,2 dBTP, LRA 6,9 LU; no MP4 final
  (AAC 256 kbps): −15,1 LUFS, −1,4 dBTP, sem clipping nem silêncio. `hyperframes audio` lê música (0,9), ataques na
  grade de semicolcheias do filme e o pico em 12,6 s (VIROU!). Balanço por oitava com 63 Hz como referência
  (0 dB): 250 Hz −8,0, 1 kHz −6,9, 4 kHz −11,2, 8 kHz −12,4. Ninguém ouviu a mixagem num alto-falante de celular.
- **Arquivo:** 1920 × 1080, 30 fps, 900 quadros, 30,000 s, H.264 High yuv420p (~3,2 Mbit/s), faststart; quadros
  decodificados conferidos a 100% (bordas de pixel limpas, sem blocos na torcida).
- **Ninguém checou:** a leitura por alguém que nunca viu o jogo.

## Notas desta passada (todas corrigidas)

- t=5,7 s · tática · a placa ▲ 19 ▼ 5 cobria o goleiro → mudou para a linha do meio-campo, onde fica o 4º árbitro.
- t=5,5 s · tática · a mão ficava sobre o 19 recém-escalado → depois de soltar, desliza para o lado.
- t=8,3 s · estádio · "Flamengo" vazava 56 px do placar → selo FLU / FLA a 36 px; badge a 28 px.
- t=6,5 s · letreiro · "VOLTA PRO JOGO" ficava 0,8 s → acompanha o zoom no botão (1,2 s).
- t=18–22 s · clube · rótulos a 18–22 px, ✓ ✕ → ▲ em fonte reserva, É/Í/Ó espremidos pela fonte, moeda sobre o
  rótulo, valores do mercado encostados → 28 px, ícones Phosphor e sprites, acento de pixel em todo rótulo em
  caixa alta, colunas fixas.
- t=22,0 s · campeão · o troféu aparecia sobre a montagem antes do amarelo e saía pelo topo no quique → sobe de
  fora do quadro junto com o amarelo, posição na mola UI, escala na mola pop.
- t=26,2 s · marca · 0,3 s de gramado vazio antes do logo → as letras caem enquanto as prateleiras de escudos
  ainda se abrem (o primeiro degrau aparece no próprio quadro); o blip de cada letra foi re-sincronizado.
- t=28 s · marca · aviso legal a 20 px fora da área segura; slogan amarelo sobre o gramado → faixa de LED,
  aviso a 28 px em duas linhas equilibradas dentro da área segura; a mão clica embaixo do texto do botão.

## O plano mais fraco

A montagem do clube (18–22 s): quatro telas em quatro segundos. Cada uma lê o título e um número grande; o resto é
textura de UI. Com mais tempo: dois recursos de 2 s cada (escritório e mercado, que têm clique e consequência), e o
mapa como transição — um zoom contínuo do prédio para a tela que ele abre.

## Avisos mantidos de propósito

- **`line_unread` (34):** o auditor conta cada letra dos títulos em pixel como uma palavra (eles são divididos
  letra a letra para os acentos e para a animação), então "O TÉCNICO É VOCÊ" vira 13 palavras. Pelas palavras
  reais, todos os títulos passam do piso. Os que ficam de fato abaixo: a textura de UI da montagem (1 s por tela,
  de propósito), "GOL! O garoto decide." (1,1 s; o GOOOL! e o VIROU! carregam a leitura) e o rótulo "Começar o
  segundo tempo" (0,9 s; o letreiro "VOLTA PRO JOGO" diz o mesmo ao mesmo tempo).
- **`duplicate_media_discovery_risk` (4):** escudos repetidos nas prateleiras, que correm em loop e precisam das
  cópias. São imagens estáticas.
- **Informativos:** sobreposições previstas (linhas da tabela trocando de lugar no FLIP; o letreiro sobre a página
  enquanto ela rola) e prateleiras fora do quadro (o marquee).

## Pendências jurídicas antes de veicular (FINALIZATION-CHECKLIST.md)

- Item 7 — escudos são marcas registradas: o filme os usa como a landing, com o mesmo aviso legal no fim.
- Item 8 — licença comercial do modelo 3D do estádio: o footage do estádio depende dela.
- Item 10 — nomes reais de clubes e atletas: nenhum atleta é nomeado no filme; os clubes são.

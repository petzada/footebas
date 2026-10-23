# SPEC — "A Virada" (motion de divulgação do Footebas)

```text
GOAL:    o torcedor termina o filme sabendo que no Footebas o técnico é ele — escala, muda a tática, vira o
         jogo, sobe na tabela e cuida do clube — grátis, no navegador do celular; e quer começar a carreira.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps, H.264 + AAC.
TIME:    30,0 s x 30 fps = 900 quadros. Música a 120 BPM: 15 quadros por batida, 60 por compasso (2 s),
         15 compassos. Cortes de mundo nas linhas de compasso; trocas internas nas batidas.
LOOK:    os materiais do próprio jogo (apps/web/app/globals.css, ADR 0012 "Futebol Retrô"):
         - gramado: listras #2f7d3a / #3a9447 de 84 px (56 px do app x 1,5), sem gradiente;
         - prancheta (giz): #f4efe2 com tinta #15201a, borda de pixel de 6 px (--px 3 px x 2),
           sombra interna #e6dcc3; prancheta de campo: #246630 com contorno tracejado de giz 6 px;
         - placar: #121a15 com pontilhado 6 px a 5% de branco, moldura #6b4119, dígitos lâmpada #ffd23f
           com brilho 0 0 12px rgb(255 210 63 / .55);
         - madeira (banco): #a0672f / #6b4119 em réguas de 88 px.
         Acento: lâmpada #ffd23f, racionado ao placar, ao botão de jogar, à linha do clube na tabela e à
         chamada final. Vermelho cartão #c8322b só para RECUSAR/SAI. Tinta #15201a como sombra dura de
         título: 0 6px 0 (nunca blur).
         Tipos: Press Start 2P (OFL) para títulos, números e rótulos, caixa alta, tracking 0; texto de
         leitura nunca abaixo de 28 px (2,6% da altura: o que um celular lê); maiúsculas acentuadas
         desenhadas como acento em pixel sobre a letra cheia (a fonte espreme É/Ã/Í na célula de 8 px).
         Inter 500/700 para frases de leitura, 28-40 px.
         Profundidade: só sombras duras de pixel (offset 6 px, blur 0). Sem grão, sem vinheta, sem glow
         fora das lâmpadas do placar. Footage do estádio 3D real gravada a 480 x 300 e ampliada 4x por
         vizinho mais próximo (pixels inteiros, nunca borrados).
OBJECTS: placar de LED (o "Placar ao vivo" do jogo: badge, dígitos, escudos, narração);
         prancheta de táticas (FORMAÇÃO e MENTALIDADE com botões segmentados);
         figurinha do atleta (faixa do clube no topo, retrato pixel, nota em LED, barras em blocos);
         botão de pixel (base de 2 px que afunda 1 px no clique: .btn-px:active do jogo);
         estádio 3D (footage real); tabela de classificação (linha do clube em amarelo como no app);
         cards de patrocínio/mercado; mapa do clube em pixel (CT, ESTÁDIO, SEDE, IMPRENSA, MERCADO, CASA);
         troféu, moeda, apito, estrela: os sprites do jogo (components/retro/sprites.tsx), sem redesenho;
         escudos: os PNGs do jogo ampliados por inteiro; cursor: mão em pixel com 72 px (6,7% da altura),
         tinta e giz, no mesmo grid dos sprites.
MOTION:  Duas línguas, de propósito (nostalgia + acabamento moderno, docs/07):
         - a do produto, em degraus: dígito de placar pisca em steps(2) por 12 quadros; letras de título caem
           em steps(4) por 18 quadros, 2 quadros entre letras; cursor de texto pisca a cada 15 quadros;
         - a do filme, molas físicas de Framer Motion em forma fechada (rigidez/amortecimento/massa):
           UI e cards   k=420 c=34 m=1   (zeta 0,83, assenta em ~0,45 s)
           layout/FLIP  k=300 c=30 m=1   (zeta 0,87, ~0,55 s) — linhas da tabela, jogadores no campo
           carimbo/pop  k=600 c=22 m=1   (zeta 0,45, ~0,6 s) — só posição e escala, nunca opacidade/cor
           cursor       k=170 c=26 m=1   (zeta 1,0, sem quique) na chegada; clique = escala 0,86 em 3 quadros
         Câmera: empurrões e pans 0,4-0,6 s em power2.inOut; zoom-through em power3.in 0,35 s; chegadas em
         expo.out. Saídas 40-50% mais curtas que as entradas. Stagger: letras 2 quadros, linhas 2 quadros,
         cards 3 quadros. Nada respira, flutua ou pulsa em loop; título pousado fica parado.
SHOTS:   (s = segundos absolutos; q = quadro)
 S1 placar   0,0-2,6  q0-78   Quadro 0 já aceso: placar do jogo a 1600 px, INTERVALO, Fluminense 1 x 0
                              Flamengo, narração real do motor "Intervalo com o Fluminense na frente: 1 × 0."
                              Câmera assenta 1,06->1,0 em 1,1 s expo.out; apitos em q3 e q13. q24 letreiro
                              sobe (mola UI) e acende "O TÉCNICO É VOCÊ" a 1 quadro por letra. q60 o placar
                              sobe e sai (power3.in 0,34 s): a página rola para a prancheta.
 S2 tática   2,0-6,4  q60-192 Prancheta 2x: AJUSTES AOS 45'. q90 clique em OFENSIVA: o preenchimento verde
                              desliza (mola layout, como layoutId), o time inteiro sobe e três setas de giz se
                              desenham. q105 clique em 4-3-3: as 11 fichas migram (mola layout, 1 q de
                              stagger). Letreiro "MUDE A TÁTICA". q120 a figurinha GAROTO DA BASE (17 anos,
                              ATA, 71) sobe com mola pop; q135 o cursor pega, arrasta em arco até a vaga do 5
                              encolhendo a figurinha em ficha (morph); q162 solta: o 5 sai pela lateral, o 19
                              entra (pop) e a placa de substituição ▲ 19 ▼ 5 acende na linha do meio-campo.
                              O cursor sai de cima do 19. Letreiro "CHAME O GAROTO DA BASE". q180 a página
                              rola para cima.
 S3 apito    5,9-8,1  q177-243 Placar compacto + painel do intervalo + botão verde "COMEÇAR O SEGUNDO
                              TEMPO". q210 clique (o botão afunda); q213-q234 zoom-through 16x no verde do
                              botão (power3.in 0,72 s). Letreiro "VOLTA PRO JOGO" vai junto e cai em q225.
 S4 estádio  7,85-14,05 q236-421 Footage real do estádio 3D (4 planos, um a 4x). q236 flash verde + apito.
                              Selo de TV no topo: AO VIVO · 46', FLU 1 x 0 FLA (as iniciais do próprio jogo),
                              narração real. q300 GOL 1: banner GOOOL!, dígito 0->1 pisca, minutos correm.
                              q313 controle de velocidade sobe; q325 clique em 4x, q346 de volta a 1x.
                              q360 GOL 2: GOOOL! + carimbo "VIROU!" (mola pop), 1 x 2, "GOL! O garoto
                              decide." q392 recuo: o estádio encolhe para dentro do celular (tela de partida
                              do jogo, FIM DE JOGO, +3 pontos); q418 toque em "Preparar próxima rodada".
 S5 tabela   14,0-18,1 q420-543 Central do celular; a câmera entra no card TABELA até ele virar a tabela
                              cheia. CLASSIFICAÇÃO · Brasileirão Série A: a linha amarela do Flamengo sobe
                              7º -> 4º (q450) -> 2º (q473) -> 1º (q495), FLIP com mola layout, rodada 35->38
                              e pontos coerentes (V, E, D, SG recalculados). q499 troféu ao lado do nome.
 S6 clube    18,0-22,0 q540-660 Montagem nas batidas (1 s cada): ESCRITÓRIO (patrocínio MARÉ CHEIA BEBIDAS,
                              clique em ACEITAR, selo Em aberto -> Assinada, patrocínio/mês 4,8 -> 14,3 mi
                              com moeda), MERCADO (Palmeiras quer o camisa 10, clique em CONTRAPROPOR, 48 ->
                              55 mi, Pendente -> Contraproposta feita), MAPA DO CLUBE (o SVG real do jogo,
                              prédios acendem em colcheias), COMPETIÇÕES (Série C -> B -> A, ▲ 4 sobem,
                              Copa do Brasil, Libertadores, Estaduais).
 S7 campeão  22,0-24,1 q660-723 O amarelo-lâmpada sobe de baixo (0,32 s); o troféu do jogo sobe junto
                              (posição na mola UI, escala na mola pop: nunca passa da borda); "CAMPEÃO!" cai
                              letra a letra; "BRASILEIRÃO SÉRIE A · 2026"; confete de pixel com semente fixa.
 S8 escudos  24,0-26,4 q720-792 Duas prateleiras de figurinhas com os escudos do jogo correm em sentidos
                              opostos; "QUAL CLUBE VOCÊ / VAI LEVAR AO TÍTULO?" palavra a palavra (blur 6 ->
                              0). q784 as prateleiras se abrem para cima e para baixo.
 S9 marca    26,2-30,0 q786-900 FOOTEBAS cai letra a letra enquanto as prateleiras ainda saem (144 px giz,
                              sombra de tinta); a faixa de LED acende com o flicker do placar e digita "SUA
                              CARREIRA, SUA HISTÓRIA" com cursor piscando; botão amarelo "COMEÇAR CARREIRA
                              GRÁTIS" (mola pop); q840 o cursor clica e o botão afunda; footebas.com.br,
                              claim e aviso legal da landing em 28 px. Segura até q899.
BANNED:  vazio escuro com elementos pequenos flutuando; glow/bloom/partículas decorativas (confete só no
         payoff); gradientes roxo/azul, vidro, mesh; papel creme com serifa e rótulos mono numerados;
         tudo centrado e tudo entrando por fade+subida; texto que se move enquanto é lido; títulos que
         continuam deslizando; três cards em fila; logo no canto; UI de produto inclinada em 3D; telas
         inventadas (tudo vem do jogo: componentes, rótulos, escudos, sprites, footage); nomes de atletas
         reais (pendente jurídico, FINALIZATION-CHECKLIST item 10); cliques com anel/onda; quique em UI;
         glifos de fonte reserva (✓ ✕ → ▲ ▼ ■) no meio do texto em pixel: ícones Phosphor e sprites do jogo;
         quadro vazio entre cenas; mola que leva um objeto para fora da borda do quadro.
QA:      q0 lê como placar de estádio aceso e cria a pergunta (thumbnail).
         q75 "O TÉCNICO É VOCÊ" inteiro, acentos de pixel corretos.
         q120 OFENSIVA selecionada e 4-3-3 formado.
         q172 o 19 no campo, placa ▲ 19 ▼ 5 legível e sem cobrir ficha nenhuma.
         q210 botão afundado sob o cursor; q232 tela tomada pelo verde.
         q305 GOOOL! + 1 × 1; q365 VIROU! + 1 × 2 legíveis a 360 px de largura.
         q415 celular com o fim de jogo e o dedo em "Preparar próxima rodada".
         q510 Flamengo em 1º, linha amarela, pontos coerentes.
         q560/q590/q620/q650 cada recurso com título e um número grandes em 1 s.
         q700 troféu + CAMPEÃO! + confete; q760 pergunta inteira; q860 marca + chamada + URL.
```

## Fontes de verdade

- Telas, rótulos e estilos: `apps/web` (globals.css, landing-page.tsx, career-game.tsx, athlete-card.tsx,
  club-map.tsx, sprites.tsx), capturados do jogo rodando localmente (API em memória + Next dev).
- Footage do estádio: partidas reais gravadas quadro a quadro com o relógio do navegador parado e avançado
  1/30 s por quadro (o palco Three.js do jogo, sem os banners HTML, que o filme redesenha nítidos).
- Cópia: a do jogo e a da landing (`DEMO_MATCH`, `BENEFITS`, chamada final). Cópia criativa nova: só
  "O TÉCNICO É VOCÊ", "MUDE A TÁTICA", "VIROU!" e "CAMPEÃO!".
- Partida e tabela são ilustrativas (placar e pontos escolhidos para a história); a imagem é do jogo.

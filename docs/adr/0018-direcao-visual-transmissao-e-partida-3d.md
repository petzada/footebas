# ADR 0018 — Direção visual Transmissão e partida 3D em tempo real

- Status: aceito (substitui o ADR 0012; revisa os itens 4 e 5 do ADR 0014 e a apresentação da partida do ADR 0010)
- Data: 2026-11-10

## Contexto

O Futebol Retrô (ADR 0012) entregou um jogo com identidade, mas em pixel art 16-bit e com o estádio 3D renderizado de
propósito em baixa resolução. O responsável pediu outro patamar: um simulador no estilo dos managers clássicos em que
se **assiste à partida em 3D, em tempo real, numa tela grande**, com qualidade gráfica no limite do que um navegador
roda bem, e todas as telas no mesmo padrão. As decisões abaixo foram tomadas com ele, uma por tema, em 2026-11-10.

## Decisão

1. **Direção "Transmissão"**: o visual de uma transmissão esportiva moderna (noite de estádio, painéis grafite, fio
   dourado de placar, tipografia condensada) sobre a organização dos managers clássicos (tabelas densas, escalações
   lado a lado, placar em destaque, botões diretos). Pixel art sai das telas. Segue valendo do ADR 0012: nada de nome,
   logotipo, tela, fonte ou asset de terceiros; assets gerados por código ou com licença aberta.
2. **Tema único, escuro.** Os tokens de `apps/web/app/globals.css` continuam sendo a única fonte de cores; os nomes dos
   tokens foram mantidos (chalk = texto claro, ink = tom mais escuro, grass = verde da marca, bulb = dourado) para as
   telas trocarem de pele sem trocar de estrutura. Fontes: Barlow e Barlow Condensed (OFL, `@fontsource`).
3. **Plataforma: desktop primeiro, celular adaptativo.** As telas são desenhadas para tela grande e continuam
   funcionando no celular. A partida escolhe sozinha o nível gráfico (alto, médio, baixo) pelo aparelho e desce um
   nível quando o FPS medido fica baixo; ela nunca troca de tecnologia no meio do jogo.
4. **Partida 3D em Three.js puro** (sem React Three Fiber), carregada sob demanda só na tela de partida. O Phaser saiu
   do projeto. Sem WebGL, com movimento reduzido ou com "Visual simples" ligado, vale o campo simples em React.
5. **O motor do servidor não muda.** O resultado, os eventos e o ranking continuam vindo do `match-v4`. O movimento é
   uma **simulação visual determinística no cliente**, derivada da timeline oficial:
   - cada evento vira um **lance** (melhores momentos) com duração própria (`apps/web/lib/match-pace.ts`), coreografado
     pela formação real, pelo tipo de jogada (`play`) e pelo desfecho (`outcome`) que o motor informa;
   - entre os lances, um **jogo corrido** tático mantém os 22 atletas e a bola em movimento sem nunca finalizar;
   - gol tem transmissão completa: ao vivo, comemoração em câmera baixa e **replay em câmera lenta** de trás do gol;
   - a narração e o placar só aparecem quando a bola chega (o relógio espera o lance terminar).
6. **Atletas, gramado, traves, refletores, torcida e céu gerados por código.** Atletas são corpos articulados
   instanciados, com animação procedural (corrida, passe, chute, cabeceio, defesa, carrinho, queda, comemoração),
   uniforme do clube e número. As cores do uniforme vêm do escudo (`scripts/generate-club-kits.mjs`) e o visitante troca
   de camisa quando as cores se confundem.
7. **Arquibancada do modelo `football-court`** do responsável: a conversão (`scripts/convert-stadium.mjs`) extrai só a
   arquibancada coberta para `public/assets/stadium/stand.glb`, que a cena instancia em volta do gramado oficial de
   105 x 68 m. Sem o arquivo, a cena desenha arquibancadas simples por código. A licença do modelo segue pendente
   (`FINALIZATION-CHECKLIST.md`): o FBX de origem não entra no repositório.
8. **Áudio de estádio sintetizado** (WebAudio, sem arquivos): torcida que reage ao jogo, explosão no gol, apito,
   batida na bola. Respeita o mudo e a regra de só tocar depois da primeira interação.
9. **3D fora da partida** é permitido em telas-chave, sempre sob demanda e com alternativa estática. As telas de gestão
   seguem em React.

## Consequências

- O bundle inicial não cresce com a partida: Three.js, pós-processamento e o estádio continuam em chunks próprios. O
  Phaser (1,4 MB) foi removido.
- O contrato da partida ganhou campos opcionais de apresentação nos participantes (`position`, `shirtNumber`,
  `started`); clientes antigos os ignoram.
- Seguem obrigatórios: "pular para o resultado" a um toque, `prefers-reduced-motion`, alternativa textual da partida
  para leitor de tela e contraste AA nos tokens.
- A validação visual depende de aba visível: navegadores param o `requestAnimationFrame` em abas ocultas. Em
  desenvolvimento, `window.__footebasStage.advance(segundos)` avança a cena à mão.

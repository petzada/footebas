# ADR 0006 — Agregado único de carreira

- Status: aceito
- Data: 2026-10-22

## Contexto

As Fases 2–5 foram entregues como três fatias independentes, cada uma com seu próprio estado e repositório:
`GameSave` (liga de oito clubes, escalação e partida), `PhaseFourState` (mundo de 40 clubes, mercado, contratos,
finanças, diretoria) e `PhaseFiveCompetitionState` (pirâmide e calendário). Só fixtures de teste criavam os estados
das Fases 4 e 5; uma carreira criada pela API não tinha mercado, finanças nem competições, e os mundos não eram os
mesmos. O conteúdo real só era lido do Markdown pelo sim-lab, com `node:fs`, o que não roda em Workers.

## Decisão

1. **Catálogo canônico** (`@footebas/content`): gerado a partir de `dados/elencos/` por
   `pnpm --filter @footebas/content generate`, versionado (`catalog-2026-07-v1`) e embutido como texto para carregar sem
   sistema de arquivos. IDs de clube e jogador independem de divisão e competição; lacunas da pesquisa (`#?`, `—`,
   `[parcial]`, conflitos) viram notas explícitas; atributos são `derived` a partir da cola de força.
2. **Um save por carreira** (`game-save-v2`): mundo (clubes, jogadores, contratos, livro-caixa, estádios, base,
   objetivos, propostas, história, conquistas), temporada de competições e estado de matchday vivem no mesmo
   documento, com uma versão, um lock, um checksum e um único armazenamento de idempotência.
3. **Temporada data a data** (`@footebas/engine` `career-season`): todas as competições do calendário avançam por data,
   sorteando fases de mata-mata só depois dos resultados; o fechamento gera acesso, rebaixamento e vagas.
4. **Avanço autoritativo**: `AdvanceDate`/`SimulateMatch` jogam com o motor de partida real todas as partidas até a do
   clube gerido (ou até o fim da temporada, que então vira). A prévia (`POST /v1/careers/:id/match-preview`) executa o
   mesmo caminho determinístico sem gravar; por isso o feed narrado e as pausas táticas coincidem exatamente com o
   resultado gravado com as mesmas instruções.
5. **Mundo da Fase 4 como regras puras** (`career-world-rules`): bilheteria por partida, patrocínio e salários mensais,
   prêmios, avaliação da diretoria, demissão, propostas de emprego, renovações, evolução, aposentadoria e reposição
   pela base no fim da temporada. O livro-caixa recomeça a cada temporada a partir do saldo de fechamento de cada clube.
6. **Comandos da Fase 4 sem mudança**: `UnifiedPhaseFourRepository` implementa o port da Fase 4 sobre o mesmo save e o
   mesmo `UnitOfWork`. `AdvanceCareerSeason` é recusado: a temporada só avança jogando.
7. **Leituras**: `/v1/careers/:id/{home,squad,next-match,standings,post-match,world,competitions,calendar,next-season}`.
   Os endpoints `phase-four`/`phase-five` permanecem para os gates históricos.

## Consequências

- O web passa a falar com um único agregado pelo adapter HTTP.
- O save carrega o mundo inteiro (cerca de 2 MB com 60 clubes). Ampliar muito o catálogo exige separar o conteúdo
  estático, compartilhado por versão, das mudanças de cada carreira antes de crescer.
- Mudança de catálogo exige migração explícita: um save só carrega com a versão de conteúdo com que foi criado.
- Os gates das Fases 4 e 5 continuam válidos como provas de regra; a prova de integração é a temporada completa
  jogada pela aplicação (`unified-career.test.ts`).

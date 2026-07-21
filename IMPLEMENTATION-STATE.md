# Estado de implementação

Última atualização: 2026-07-21

| Fase                           | Estado       | Evidência                                       |
| ------------------------------ | ------------ | ----------------------------------------------- |
| 0 — Baseline reproduzível      | concluída    | `pnpm check` verde; build e smoke               |
| 1 — Laboratório determinístico | concluída    | `pnpm test:phase1`: 10k partidas + 1k épocas    |
| 2 — Primeira carreira          | concluída    | vertical HTTP/worker/web e `pnpm check` verdes  |
| 3 — Elenco e matchday          | concluída    | matchday reproduzível e acessível; gates verdes |
| 4 — Mundo vivo                 | concluída    | economia/carreira 25 épocas; API e gates verdes |
| 5 — Pirâmide e calendário      | em progresso | DSL de competições e calendário                 |
| 6–9                            | pendente     | execução estritamente sequencial pelos gates    |

## Decisões operacionais

- GOAL/ROADMAP são o design aprovado; não há gates de aprovação intermediária.
- Infraestrutura externa é substituída por ports/adapters in-memory ou fake durante o objetivo.
- `dados/elencos/*.md` permanece bruto e imutável.
- Escritor único no workspace principal até o commit-base da Fase 0.

## Gate da Fase 0

- Ambiente de referência: Node 22.14.0, pnpm 10.6.2, Windows.
- `pnpm install --frozen-lockfile`: reproduzível, sem segredo ou serviço.
- `pnpm check`: formatter, typecheck, lint, 10 testes, build e smoke verdes.
- Smoke canônico: `phase-zero-smoke-v1` / `mulberry32-v1`, data final `2026-01-15`.
- Infra de produto deliberadamente ausente até a Fase 2 conforme ROADMAP/GOAL.

## Gate da Fase 1

- Modelo de domínio: jogador, clube, escalação, tática, carreira, competição, fixture e partida com invariantes.
- `simulateMatch` puro/versionado: golden, properties, força efetiva, posição, formações, mentalidades e mando.
- Bandas `match-v1-bands-v1`: 10.000 partidas, favoritismo monotônico, zebras, mando e cartões verdes.
- Liga de oito clubes: 14 rodadas, 56 partidas, tabela/campeão e progressão bounded.
- Stress: 1.000 temporadas completas / 56.000 partidas, zero estado impossível.
- Amostra real: oito clubes e 200 jogadores lidos do Markdown bruto; atributos somente `derived` com proveniência.
- Playthrough automatizado: 14 rodadas, decisões registradas e proxies de variação/consequência verdes.

## Gate da Fase 2

- Fluxo real autenticado: criar carreira, escolher clube, escalar, definir tática, avançar, simular, acompanhar job/SSE, consultar pós-jogo e recarregar.
- Fastify REST/OpenAPI e read models de home, elenco, próximo jogo, tabela e pós-partida; nenhuma escrita canônica direta pelo cliente.
- Persistência in-memory transacional com checksum, versões obrigatórias, lock por carreira, versão otimista e idempotência pela chave contratual.
- Worker isolado sobre a mesma fila, com queued/running/succeeded/failed, retry/backoff, timeout lógico, dead-letter, health e shutdown.
- Gate adversarial: retry não duplica partida, dois avanços concorrentes produzem uma rodada, falha parcial faz rollback e recarga preserva checksum.
- Conteúdo autoritativo: oito clubes e 200 atletas reais do Markdown bruto; atributos somente `derived`, versionados e com proveniência.
- Web PWA mobile-first: onboarding curto, navegação, elenco, formações/táticas, feed pulável, resultado, tabela e recarga por port fake.
- `pnpm check`: formatter, typecheck, lint, 74 testes, builds (incluindo Next) e smoke verdes.

## Gate da Fase 3

- Elenco completo: força, até duas características, posições/lado, condição, moral, ritmo, lesões, suspensões, cartões, notas e estatísticas.
- Os seis atributos ocultos influenciam o domínio, mas read models e web expõem somente estimativas textuais.
- Titulares, banco e reservas; formações validadas e automações determinísticas `best`, `rest` e `develop`.
- Tática compacta com mentalidade, construção, foco, pressão, linha defensiva e marcação.
- Preparação informa adversário, forma, força aproximada e desfalques antes da decisão.
- Substituições e mudanças táticas em minutos discretos são imutáveis, afetam o resultado e reproduzem exatamente.
- API rejeita escalações inválidas antes de persistir/enfileirar e impede instruções sobre o time adversário.
- Web oferece alternativa sem drag-and-drop, teclado, feed 1×/2×/4×, resultado instantâneo e skip em um toque.
- Playthrough `phase-three-playthrough-v1`: 14/14 rodadas com informação, consequência e replay, zero falhas.
- `pnpm check`: formatter, typecheck, lint, 88 testes, builds (incluindo Next) e smoke verdes.

## Gate da Fase 4

- Mundo de carreira puro e determinístico com 40 clubes, 960 identidades reais e atributos derivados com proveniência.
- Contratos, transferências, empréstimos, agentes livres e IA de mercado conservam dinheiro em ledger balanceado por origem.
- Estádio, público, base, evolução, diretoria, demissão e troca de clube preservam a identidade e o histórico do treinador.
- Fastify, aplicação e engine avançam a temporada no mesmo pipeline autoritativo, com ownership, lock, versão otimista e commit atômico.
- Replay usa fingerprint exato; saves e arquivos canônicos validam checksum; migração e compactação possuem adapters in-memory.
- Web mobile-first cobre mercado, contratos, finanças, estádio, base, diretoria, empregos, notícias, história e leaderboards.
- Stress de 25 temporadas: zero falhas, 920 jogadores finais, força média 58,45, salário médio 9.498,86 e caixa mundial 9.461.620.523.
- `pnpm check`: formatter, typecheck, lint, 121 testes, builds (incluindo Next) e smoke verdes.

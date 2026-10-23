# Estado de implementação

Última atualização: 2026-10-23

| Fase                           | Estado    | Evidência                                        |
| ------------------------------ | --------- | ------------------------------------------------ |
| 0 — Baseline reproduzível      | concluída | `pnpm check` verde; build e smoke                |
| 1 — Laboratório determinístico | concluída | `pnpm test:phase1`: 10k partidas + 1k épocas     |
| 2 — Primeira carreira          | concluída | vertical HTTP/worker/web e `pnpm check` verdes   |
| 3 — Elenco e matchday          | concluída | matchday reproduzível e acessível; gates verdes  |
| 4 — Mundo vivo                 | concluída | economia/carreira 25 épocas; API e gates verdes  |
| 5 — Pirâmide e calendário      | concluída | engine canônico; gate de 2.000 épocas verde      |
| 6 — Experiência e campo 2D     | concluída | shell, PWA, replay 2D; testes e build web verdes |
| 7–9                            | em curso  | entrega final por etapas (ver abaixo)            |

Hospedagem de produção: Cloudflare nativo (ADR 0005), Supabase para Postgres/Auth/Storage, domínio
`footebas.com.br`.

## Entrega final (objetivo de 2026-10-22, reestruturado em 2026-10-23)

Branch de integração: `mvp/fase-6-9`. Até três subagentes em paralelo, cada um em worktree próprio e com arquivos
disjuntos, em três trilhas: **servidor** (`packages/*`, serializada), **web** (`apps/web`, serializada por área) e
**infraestrutura** (`apps/api`, migrations, CI, ferramentas).

Etapas (as marcadas com ★ entraram com o ADR 0010 — apresentação premium e Phaser):

| Etapa | Conteúdo                                                                                                                                                                                                                          | Estado                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | Nuvem: login Supabase, web via OpenNext, domínios, fumaça na nuvem                                                                                                                                                                | concluída                             |
| 2A    | Telas de entrada: Início, Carregar, Central, Mapa, emblemas                                                                                                                                                                       | concluída                             |
| 2B    | Visual ISOPOP (ADR 0009), Mapa isométrico, Nova Carreira em etapas com treinador                                                                                                                                                  | concluída (Futebol Retrô, ADR 0012)   |
| 2C ★  | Partida em Phaser sob demanda sobre a timeline oficial, campo 2D como fallback                                                                                                                                                    | concluída                             |
| 2D ★  | Apresentação premium: movimento, feedback, sons com mudo, celebração de gol, avatares gerados                                                                                                                                     | concluída                             |
| 2E    | Telas restantes sobre 2D: Elenco (campo arrastável, presets), Mercado, Escritório, Temporada, Ranking                                                                                                                             | concluída                             |
| 3     | Servidor: personalidade e limites ✔, mercado/janelas/IA ✔, escritório + entrosamento ✔, e-mails com decisões, estatísticas de temporada, ranking com snapshots; variância do motor e pausas só no intervalo e no fim (decisão 18) | concluída                             |
| 4     | Licença Woovi PIX ✔ (sandbox aguarda AppID), perfil, termos e privacidade                                                                                                                                                         | concluída (AbacatePay, ADR 0016)      |
| 5     | ADR 0014: Durable Object por carreira, save enxuto (< 200 KB), endpoint único da Central, TanStack Query + Zustand no cliente; observabilidade ✔, rate limit ✔, backups ✔, E2E no CI ✔                                            | em curso (TanStack/Zustand pendentes) |
| 6     | Landing arcade isométrica                                                                                                                                                                                                         | concluída (`lp.footebas.com.br`)      |

### Estado da nuvem

Detalhes operacionais (comandos de deploy, segredos, fumaça) e pendências em `HANDOFF.md`.

- Web `footebas-web` em um só Worker com quatro hosts: jogo em `https://game.footebas.com.br`, landing em
  `https://lp.footebas.com.br`, apex e www → 308 para a landing, `/auth/*` dos hosts antigos → 307 para o jogo.
  Callback `https://game.footebas.com.br/auth/callback` cadastrado no Supabase.
- API `footebas-api` em `https://api.footebas.com.br`: Durable Object por carreira, save v3 enxuto, Queues, cron de
  15 min (reconciliação de pagamentos e ranking), R2 de avatares.
- Supabase: migrations aplicadas até `20261027000300_ranking_avatar.sql`.
- Licença: R$ 29,90 por PIX dinâmico da AbacatePay (15 min), webhook com secret, reconciliação automática,
  carreiras extras bloqueadas após reembolso.
- Fumaça na nuvem verde em 2026-10-23: CreateCareer ~1,5 s, SelectClub ~1,3 s, demais 0,2–0,9 s (meta de 0,8 s
  depende de aproximar Worker e banco).

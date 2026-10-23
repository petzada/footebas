# Estado de implementação

Última atualização: 2026-10-22

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

| Etapa | Conteúdo                                                                                                                                                                                    | Estado    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1     | Nuvem: login Supabase, web via OpenNext, domínios, fumaça na nuvem                                                                                                                          | concluída |
| 2A    | Telas de entrada: Início, Carregar, Central, Mapa, emblemas                                                                                                                                 | concluída |
| 2B    | Visual ISOPOP (ADR 0009), Mapa isométrico, Nova Carreira em etapas com treinador                                                                                                            | em curso  |
| 2C ★  | Partida em Phaser sob demanda sobre a timeline oficial, campo 2D como fallback                                                                                                              | pendente  |
| 2D ★  | Apresentação premium: movimento, feedback, sons com mudo, celebração de gol, avatares gerados                                                                                               | pendente  |
| 2E    | Telas restantes sobre 2D: Elenco (campo arrastável, presets), Mercado, Escritório, Temporada, Ranking                                                                                       | pendente  |
| 3     | Servidor: personalidade e limites ✔, mercado/janelas/IA ✔, escritório (patrocínio, sócio-torcedor) + entrosamento ★, e-mails com decisões, estatísticas de temporada, ranking com snapshots | em curso  |
| 4     | Licença Woovi PIX ✔ (sandbox aguarda AppID), perfil, termos e privacidade                                                                                                                   | em curso  |
| 5     | Save enxuto (catálogo por versão + deltas), observabilidade ✔, rate limit ✔, backups ✔, E2E no CI ✔                                                                                         | em curso  |
| 6     | Landing arcade isométrica                                                                                                                                                                   | pendente  |

### Estado da nuvem

- Web `footebas-web` em `https://footebas.com.br` (www → apex 308), bundle OpenNext gerado no workflow
  `deploy-web` (Linux) e publicado com wrangler; tela de entrada com Google e link mágico.
- API `footebas-api` em `https://api.footebas.com.br` (e workers.dev); `/health` com checagem do banco.
- Supabase: migrations aplicadas; Auth com Site URL `https://footebas.com.br` e callbacks `/auth/callback`; Google
  OAuth ativo (validação com conta real pendente no checklist).
- Fumaça na nuvem (`pnpm smoke:cloud`, token `SMOKE_TOKEN` como secret do Worker): criar carreira, escolher clube,
  escalar, avançar rodada pela Queue, recarregar e listar — verde em 2026-10-22. Latência de 5–9 s por comando
  por causa do save de ~2 MB (alvo da redução do save na etapa 5).

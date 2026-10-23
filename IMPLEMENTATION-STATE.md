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

## Entrega final (objetivo de 2026-10-22)

Branch de integração: `mvp/fase-6-9`. Ordem das etapas: 1 nuvem → 2 telas (`docs/09`) → 3 sistemas no servidor →
4 licença PIX (Fase 8) → 5 endurecimento (Fase 9) → 6 landing. Até três subagentes em paralelo, cada um em worktree
próprio e com arquivos disjuntos. Para não ter dois agentes no mesmo arquivo, o trabalho corre em três trilhas:

- **Trilha servidor** (serializada): `packages/domain`, `packages/engine`, `packages/application`, `packages/contracts`.
- **Trilha web** (serializada por área): `apps/web`.
- **Trilha infraestrutura**: `apps/api` (rotas novas), `packages/database`, `supabase/migrations`, CI, ferramentas.

| Onda | Fatias                                                                | Estado    |
| ---- | --------------------------------------------------------------------- | --------- |
| 1    | login Supabase no web; web via OpenNext; API em `api.` + fumaça nuvem | concluída |
| 2    | treinador/limites (servidor); telas de entrada (web); licença Woovi   | em curso  |

### Estado da nuvem

- Web `footebas-web` em `https://footebas.com.br` (www → apex 308), bundle OpenNext gerado no workflow
  `deploy-web` (Linux) e publicado com wrangler; tela de entrada com Google e link mágico.
- API `footebas-api` em `https://api.footebas.com.br` (e workers.dev); `/health` com checagem do banco.
- Supabase: migrations aplicadas; Auth com Site URL `https://footebas.com.br` e callbacks `/auth/callback`; Google
  OAuth ativo (validação com conta real pendente no checklist).
- Fumaça na nuvem (`pnpm smoke:cloud`, token `SMOKE_TOKEN` como secret do Worker): criar carreira, escolher clube,
  escalar, avançar rodada pela Queue, recarregar e listar — verde em 2026-10-22. Latência de 5–9 s por comando
  por causa do save de ~2 MB (alvo da redução do save na etapa 5).

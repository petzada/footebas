# Estado de implementação

Última atualização: 2026-07-21

| Fase                           | Estado       | Evidência                                    |
| ------------------------------ | ------------ | -------------------------------------------- |
| 0 — Baseline reproduzível      | concluída    | `pnpm check` verde; build e smoke            |
| 1 — Laboratório determinístico | concluída    | `pnpm test:phase1`: 10k partidas + 1k épocas |
| 2 — Primeira carreira          | em progresso | próximo gate server-authoritative com fakes  |
| 3–9                            | pendente     | execução estritamente sequencial pelos gates |

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

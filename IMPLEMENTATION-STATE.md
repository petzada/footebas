# Estado de implementação

Última atualização: 2026-07-20

| Fase                           | Estado    | Evidência                                    |
| ------------------------------ | --------- | -------------------------------------------- |
| 0 — Baseline reproduzível      | concluída | `pnpm check` verde; 10 testes, build e smoke |
| 1 — Laboratório determinístico | pendente  | gate da Fase 0 aprovado; próxima fase        |
| 2–9                            | pendente  | execução estritamente sequencial pelos gates |

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

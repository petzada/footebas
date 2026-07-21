# Footebas

Simulador de gestão de futebol mobile-first, determinístico e server-authoritative. O repositório está sendo
construído pelas Fases 0–9 de [`ROADMAP-MVP.md`](./ROADMAP-MVP.md), sob os overrides operacionais de
[`GOAL.md`](./GOAL.md).

## Pré-requisitos

- Node.js 22.14.0 (a versão de referência está em `.nvmrc`)
- pnpm 10.6.2 via Corepack
- nenhum banco, container, segredo ou serviço externo

## Verificação reproduzível

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` executa formatter check, typecheck, lint, testes, build e o smoke determinístico do sim-lab. Para
executar apenas o laboratório:

```bash
pnpm smoke
```

O gate estatístico completo da Fase 1 executa 10.000 partidas e 1.000 temporadas inteiras:

```bash
pnpm test:phase1
```

## Núcleo ativo

- `packages/domain`: IDs, `GameDate`, erros e serialização canônica.
- `packages/engine`: PRNG, partida, liga e progressão puros, seedados e versionados.
- `packages/testing`: fixtures e helpers determinísticos compartilhados.
- `packages/config`: presets e políticas de tooling.
- `tools/sim-lab`: CLI/harness, Monte Carlo, amostra real e playthroughs, sem dependências externas.

Next.js, Fastify, Playwright, Prisma, Postgres, Redis, Supabase e BullMQ não fazem parte do baseline da Fase 0.

## Documentação

As decisões normativas estão em `docs/00-visao-e-decisoes.md` e `docs/08-mvp-fonte-de-verdade.md`. Os Markdown de
`dados/elencos/` são fontes brutas imutáveis: o pipeline futuro os lê sem corrigir ou completar fatos ausentes.

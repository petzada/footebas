# Footebas

Monorepo pnpm + Turbo (`apps/web`, `apps/api`, `apps/worker`, `packages/*`). Produção em Cloudflare Workers:
`footebas-web` (Next.js via OpenNext) e `footebas-api`. Operação em `docs/deploy.md`.

## Onde cada coisa roda

| Camada                                          | O que roda                                                                     | Escopo                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| **antes do PR**                                 | `pnpm test:related` (vitest dos pacotes afetados, pula os Monte Carlo lentos)  | pacotes que o branch afeta |
| **CI** (`ci.yml`, PR pronto ou push na `main`)  | `static` (format, typecheck, lint tipado, build, smoke, bundle), `test`, `e2e` | repositório                |
| **Deploy** (`deploy-web.yml`, `deploy-api.yml`) | build e publicação no Cloudflare depois do `ci` verde na `main`                | produção                   |

- `verify` (agrega `static` + `test`) e `e2e` são checks obrigatórios da `main`: não renomeie.
- O typecheck lê o código-fonte dos pacotes internos (condição `@footebas/source` nos `exports`), sem depender
  de `dist`; build, testes e runtime continuam usando `dist`.
- **Sem banco local e sem Docker local.** Testes que precisam de infraestrutura usam a API em memória; o resto
  é só no CI. Nunca aponte nada para o Supabase ou o Hyperdrive de produção.
- Turbo Remote Cache: com `TURBO_TOKEN`/`TURBO_TEAM` no ambiente, `turbo` reaproveita o que o CI já compilou.
  Sem as variáveis funciona igual, só mais lento.
- Secrets do Worker e do repositório são cadastrados pelo responsável; nenhum segredo no repositório nem no
  ambiente da nuvem.

## Migrations

Nenhum workflow aplica `supabase/migrations` ainda; aplicar é ação do responsável. Expand primeiro;
contract em dois tempos (PR posterior, depois do deploy sem uso e smoke verde, com snapshot antes de
qualquer drop).

## Branches de referência

- `mvp/fase-6-9`: trilha antiga do MVP; não é mais gatilho de deploy. Trabalho novo nasce da `main`.

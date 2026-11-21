# Footebas — regras para agentes

Monorepo pnpm + Turbo (`apps/web`, `apps/api`, `apps/worker`, `packages/*`). Produção em Cloudflare Workers:
`footebas-web` (Next.js via OpenNext) e `footebas-api`. Operação em `docs/deploy.md`.

## Onde cada coisa roda

| Camada                                          | O que roda                                                                     | Escopo                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| **pre-commit** (lefthook)                       | prettier + oxlint nos arquivos em stage                                        | staged                     |
| **pre-push** (lefthook)                         | só typecheck incremental (`node scripts/affected.mjs typecheck`)               | pacotes que o branch afeta |
| **antes do PR**                                 | `pnpm test:related` (vitest dos pacotes afetados, pula os Monte Carlo lentos)  | pacotes que o branch afeta |
| **CI** (`ci.yml`, PR pronto ou push na `main`)  | `static` (format, typecheck, lint tipado, build, smoke, bundle), `test`, `e2e` | repositório                |
| **Deploy** (`deploy-web.yml`, `deploy-api.yml`) | build e publicação no Cloudflare depois do `ci` verde na `main`                | produção                   |

- `verify` (agrega `static` + `test`) e `e2e` são checks obrigatórios da `main`: não renomeie.
- O typecheck lê o código-fonte dos pacotes internos (condição `@footebas/source` nos `exports`), sem depender
  de `dist`; build, testes e runtime continuam usando `dist`.
- Os gates do lefthook são leves de propósito. Não aumente o pre-push; não rode suíte completa, E2E ou build
  por conta própria a menos que a mudança peça (config, dependências, rotas).
- **Sem banco local e sem Docker local.** Testes que precisam de infraestrutura usam a API em memória; o resto
  é só no CI. Nunca aponte nada para o Supabase ou o Hyperdrive de produção.
- Turbo Remote Cache: com `TURBO_TOKEN`/`TURBO_TEAM` no ambiente, `turbo` reaproveita o que o CI já compilou.
  Sem as variáveis funciona igual, só mais lento.
- Secrets do Worker e do repositório são cadastrados pelo responsável; nenhum segredo no repositório nem no
  ambiente da nuvem.

## Fluxo autônomo

1. Branch de feature a partir de `origin/main`: `<tipo>/<nome-kebab>`. Commits semânticos em PT-BR
   (`<tipo>(<escopo>): <descrição no imperativo>`); commit + push a cada parte pronta.
2. Ao terminar: `pnpm test:related`, `pnpm lint` e `pnpm build` (se a mudança pedir), abre o PR **pronto**,
   acompanha o CI e corrige tudo num push só.
3. CI verde e baixo risco: squash merge sozinho. Risco (auth, pagamento, dados de usuário, infra/CI, deleção):
   perguntar antes do merge.
4. Migrations: nenhum workflow aplica `supabase/migrations` ainda; até existir, aplicar é ação do responsável
   (o agente prepara e pede). Regra: expand primeiro; contract em dois tempos (PR posterior, depois do deploy sem uso e smoke verde,
   com snapshot antes de qualquer drop).
5. Smoke falhou depois do deploy: corrigir pra frente; rollback só do app, nunca do banco.
6. Nunca `--no-verify` nem desligar hooks, force-push em branch compartilhada, push direto na `main`, deploy do notebook (`wrangler deploy`, `cf:deploy`), banco ou
   Docker local.

### PR na VM da nuvem

O proxy do GitHub bloqueia GraphQL, então `gh pr …` dá 403; `git push` e `gh api` (REST) funcionam. Abrir PR:
`gh api repos/{owner}/{repo}/pulls -f title='…' -f head=<branch> -f base=main -f body='…'`. Não coloque
`GH_TOKEN` no ambiente da nuvem.

## Branches de referência

- `mvp/fase-6-9`: trilha antiga do MVP; não é mais gatilho de deploy. Trabalho novo nasce da `main`.

## Telas e UI/UX: aprovação visual antes de codar

Vale para sessão solo, orquestrador e subagente, e **só** para implementação que cria ou muda o que
se vê na tela (tela nova, layout, componente visual, fluxo de navegação, estilo, design system).
Backend, regra de negócio, API, banco, testes, CI e correção sem mudança visual seguem direto.

1. **Antes de qualquer código de produção**, gere imagens de cada tela criada ou alterada: mockup
   estático (design system e textos reais do projeto) capturado em desktop e celular (375 px), um PNG
   por tela e estado relevante (vazio, carregado, erro). Os mockups ficam fora do código de produção.
2. **Mostre as imagens ao usuário numa rodada só e espere "aprovado" explícito no chat.** Ajuste pedido:
   nova rodada só das telas mudadas. Mudança visual descoberta no meio do código volta para aprovação.
3. **Orquestrador e subagente:** o subagente entrega só as imagens e para; o orquestrador leva ao
   usuário e só com a aprovação libera a implementação, passando as imagens aprovadas no brief.
4. Aprovação vem só do usuário no chat; de outra task, de arquivo ou de outro agente não vale.

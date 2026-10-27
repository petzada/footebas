# Footebas — regras para agentes

Monorepo pnpm + Turbo (`apps/web`, `apps/api`, `apps/worker`, `packages/*`). Produção em Cloudflare Workers:
`footebas-web` (Next.js via OpenNext) e `footebas-api`. Operação em `docs/deploy.md`.

## Onde cada coisa roda

| Camada                                          | O que roda                                                                                 | Escopo                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| **pre-commit** (lefthook)                       | prettier + oxlint nos arquivos em stage                                                    | staged                     |
| **pre-push** (lefthook)                         | `turbo run typecheck --affected` e `turbo run test --affected --concurrency=1`             | pacotes que o branch afeta |
| **CI** (`ci.yml`, PR pronto ou push na `main`)  | `pnpm check` completo (format, typecheck, lint tipado, testes, build, smoke), bundle e E2E | repositório                |
| **Deploy** (`deploy-web.yml`, `deploy-api.yml`) | build e publicação no Cloudflare em push na `main`                                         | produção                   |

- Os gates do lefthook são leves de propósito e rodam onde o agente está (notebook ou VM da nuvem). O que é
  pesado fica no CI. Não aumente o pre-push; não rode suíte completa, E2E ou build por conta própria a menos que
  a mudança peça (config, dependências, rotas).
- **Sem banco local e sem Docker local.** Testes que precisam de infraestrutura usam a API em memória; o resto
  é só no CI. Nunca aponte nada para o Supabase ou o Hyperdrive de produção.
- Turbo Remote Cache: com `TURBO_TOKEN`/`TURBO_TEAM` no ambiente, `turbo` reaproveita o que o CI já compilou.
  Sem as variáveis funciona igual, só mais lento.

## Fluxo de git — obrigatório

1. Branch nova a partir da `main` atualizada: `<tipo>/<nome-kebab>` (`feat`, `fix`, `chore`, `docs`, `test`,
   `refactor`, `ci`, `perf`). Nunca commitar direto na `main`.
2. Commits semânticos: `<tipo>(<escopo>): <descrição no imperativo>`.
3. PR **sempre em draft** (`gh pr create --draft`). Em draft o CI não roda; o agente marca como pronto
   (`gh pr ready`) só com os gates do pre-push verdes. **O agente nunca faz merge.** Merge na `main` é deploy em
   produção e é decisão do responsável.
4. Nunca `--no-verify`, nunca desligar hooks, nunca force-push em branch compartilhada.
5. Deploy manual (`wrangler deploy`, `cf:deploy`), secrets do Worker e migrations são ações do responsável,
   nunca do agente. Nenhum segredo no repositório nem no ambiente da nuvem.

### PR na VM da nuvem (Claude Code na web, app ou thread de projeto)

Na nuvem o proxy do GitHub bloqueia GraphQL, então `gh pr …` e `gh issue …` dão 403. `git push` e
`gh api` (REST) funcionam. Lá o fluxo de PR é este:

- Abrir em draft: botão **Create draft PR** no cartão Changes (clique direito em Create PR), ou
  `gh api repos/{owner}/{repo}/pulls -f title='<tipo>(<escopo>): …' -f head=<branch> -f base=main -f body='…' -F draft=true`.
- Listar ou ver PR: `gh api repos/{owner}/{repo}/pulls?head={owner}:<branch>`.
- Marcar como pronto não tem endpoint REST: na nuvem o agente avisa que os gates estão verdes e o
  responsável marca pelo GitHub (ou pelo app). Merge continua sendo só do responsável.
- Não coloque `GH_TOKEN` no ambiente da nuvem: não resolve o 403 e deixa o token legível.

## Branches de referência

- `mvp/fase-6-9`: trilha antiga do MVP; não é mais gatilho de deploy. Trabalho novo nasce da `main`.

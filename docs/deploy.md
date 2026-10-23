# Deploy (Cloudflare)

Tudo roda em Cloudflare Workers (ADR 0005). Deploy em produção só com autorização do responsável.

| Peça                       | Worker         | Domínio                                      | Config                                                    |
| -------------------------- | -------------- | -------------------------------------------- | --------------------------------------------------------- |
| Web (Next.js via OpenNext) | `footebas-web` | `game.footebas.com.br` (jogo), `lp.footebas.com.br` (landing), apex e `www` → landing | `apps/web/wrangler.jsonc`, `apps/web/open-next.config.ts` |
| API                        | `footebas-api` | `api.footebas.com.br` (hoje `*.workers.dev`) | `apps/api/wrangler.jsonc`                                 |

## Pré-requisitos

- `pnpm install` na raiz; login no Cloudflare: `pnpm exec wrangler login` (ou `CLOUDFLARE_API_TOKEN` no ambiente).
- **Windows:** o build do OpenNext cria symlinks e falha com `EPERM: operation not permitted, symlink` sem
  permissão. Rode em Linux/WSL/CI, ou ative o Modo de Desenvolvedor do Windows (Configurações → Sistema → Para
  desenvolvedores), que libera symlinks sem admin.

## Web

1. Variáveis públicas de build (o Next inlina `NEXT_PUBLIC_*` no bundle, então precisam existir **no build**):
   copie `apps/web/.env.production.example` para `apps/web/.env.production` e preencha
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). O `.env.production` é ignorado pelo git.

   ```
   NEXT_PUBLIC_API_URL=https://api.footebas.com.br
   NEXT_PUBLIC_SUPABASE_URL=https://wjisqiiwsuykfbmqglfb.supabase.co
   NEXT_PUBLIC_AUTH_MODE=supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

2. Build e teste local do Worker (workerd em `http://localhost:8787`):

   ```sh
   pnpm --filter @footebas/web cf:build     # gera apps/web/.open-next/
   pnpm --filter @footebas/web cf:preview   # build + wrangler dev local
   ```

   Para `cf:preview`, crie `apps/web/.dev.vars` (ignorado) com `NEXTJS_ENV=development` se quiser carregar
   `.env.development`; sem ele, o OpenNext usa `production`.

3. Deploy:

   ```sh
   pnpm --filter @footebas/web cf:deploy
   ```

   O deploy cria os Custom Domains `lp.footebas.com.br`, `game.footebas.com.br`, `footebas.com.br` e
   `www.footebas.com.br` (DNS e certificado automáticos).
   Se já existir registro A/AAAA/CNAME para esses nomes na zona, apague antes, ou o Wrangler recusa o domínio.

### www → apex

`apps/web/next.config.ts` separa os hosts: `lp` reescreve `/` para `app/landing`, `game` serve o jogo, apex e
`www` respondem `308` para `https://lp.footebas.com.br/*` (exceto `/auth/*`, que vai para `game`). O Supabase
precisa ter `https://game.footebas.com.br/auth/callback` nas Redirect URLs.
Arquivos estáticos (`/_next/static`, `/sw.js`, ícones) são servidos pelos static assets antes do código do
Worker, então em `www` eles não redirecionam. Para redirecionar tudo na borda, crie também uma Redirect Rule
na zona (Rules → Redirect Rules): quando `http.host eq "www.footebas.com.br"`, URL dinâmica
`concat("https://footebas.com.br", http.request.uri.path)`, status 301, preservar query string.

### Cache e PWA

- Sem ISR: o cache incremental é o de static assets (somente leitura). Se entrar `revalidate`, troque para R2
  (`r2IncrementalCache` + bucket `NEXT_INC_CACHE_R2_BUCKET`).
- `apps/web/public/_headers`: `/_next/static/*` imutável por 1 ano; `/sw.js` com `no-cache` para atualizações do
  service worker chegarem logo. `manifest.webmanifest` é gerado por `app/manifest.ts` e pré-renderizado no build.

## API

1. Filas (uma vez): `pnpm exec wrangler queues create footebas-simulation` e
   `pnpm exec wrangler queues create footebas-simulation-dlq`.
2. Secrets, se houver: `pnpm exec wrangler secret put <NOME> --config apps/api/wrangler.jsonc`.
3. Domínio: com a zona ativa, recoloque em `apps/api/wrangler.jsonc`
   `"routes": [{ "pattern": "api.footebas.com.br", "custom_domain": true }]` (removido enquanto a zona não estava ativa).
4. Deploy: `pnpm exec wrangler deploy --config apps/api/wrangler.jsonc`.

### Durable Object por carreira e save enxuto (ADR 0014)

O que muda no deploy da API:

- **Classe nova `CareerDurableObject`** (exportada por `apps/api/src/worker.ts`), com binding `CAREERS` em
  `durable_objects.bindings` e a migração `{ "tag": "v1", "new_sqlite_classes": ["CareerDurableObject"] }` em
  `apps/api/wrangler.jsonc`. O primeiro `wrangler deploy` aplica a migração e cria o namespace (SQLite); não há
  comando separado. Migrações de Durable Object são só de acréscimo: nunca edite, remova ou reordene a tag `v1`;
  renomear ou apagar a classe exige uma tag nova (`renamed_classes`/`deleted_classes`).
- Validar a configuração sem publicar: `pnpm exec wrangler deploy --dry-run --config apps/api/wrangler.jsonc`
  (deve listar `env.CAREERS (CareerDurableObject)` entre os bindings).
- **Roteamento:** com o binding, o Worker (depois do rate limiting) encaminha ao objeto da carreira as leituras
  `/v1/careers/:id/*` (inclusive `bundle` e `match-preview`), os comandos de `POST /v1/commands` (todos menos
  `CreateCareer`), `/v1/phase-four/*` e os jobs da fila. Lista de carreiras, status de job, ranking, contadores e
  billing continuam lendo o Postgres. O dono é checado dentro do objeto (403 para outro usuário).
- **Persistência:** cada comando que muda estado grava o save no Postgres (`footebas.game_saves`, um `update`
  condicional e idempotente; conquistas na mesma transação) e depois no storage do objeto, antes de responder. Por
  isso o Postgres segue sempre atual e o rollback é simples.
- **Rollback / desligar:** remover o bloco `durable_objects` (mantendo `migrations`) e publicar faz o Worker voltar
  ao caminho direto no Postgres, sem perda de dados. Os recibos de idempotência guardados nos objetos não valem no
  caminho direto (um retry de comando antigo seria reexecutado e recusado por versão).
- **Saves:** o formato passa a ser `game-save-v3` (delta sobre o catálogo, comprimido; ~80 KB depois de uma
  temporada contra ~2,5 MB no v2). Saves `game-save-v2` são migrados ao carregar e regravados enxutos no próximo
  comando; não há migração SQL. Mudar o catálogo (`careerContentFromCatalog` ou `@footebas/content`) sem trocar
  a versão de conteúdo faz os saves v3 serem recusados (`VERSION_CONFLICT`), por proteção.
- **Fumaça:** `pnpm smoke:cloud` passa a recarregar pelo `bundle` e falha se o p95 dos comandos passar de
  `SMOKE_P95_MS` (padrão 800 ms).

## Checagem pós-deploy

```sh
curl -sI https://game.footebas.com.br/ | head -1               # 200
curl -sI https://lp.footebas.com.br/ | head -1                 # 200 (landing)
curl -sI https://footebas.com.br/ | grep -i location           # https://lp.footebas.com.br/
curl -sI https://footebas.com.br/sw.js | grep -i cache-control  # no-cache
```

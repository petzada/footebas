# Deploy (Cloudflare)

Tudo roda em Cloudflare Workers (ADR 0005). Deploy em produção só com autorização do responsável.

| Peça                       | Worker         | Domínio                                      | Config                                                    |
| -------------------------- | -------------- | -------------------------------------------- | --------------------------------------------------------- |
| Web (Next.js via OpenNext) | `footebas-web` | `footebas.com.br` (+ `www` → apex)           | `apps/web/wrangler.jsonc`, `apps/web/open-next.config.ts` |
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

   O deploy cria os Custom Domains `footebas.com.br` e `www.footebas.com.br` (DNS e certificado automáticos).
   Se já existir registro A/AAAA/CNAME para esses nomes na zona, apague antes, ou o Wrangler recusa o domínio.

### www → apex

`apps/web/next.config.ts` responde `308` de `https://www.footebas.com.br/*` para `https://footebas.com.br/*`.
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

## Checagem pós-deploy

```sh
curl -sI https://footebas.com.br/ | head -1                    # 200
curl -sI https://www.footebas.com.br/ | grep -i location       # https://footebas.com.br/
curl -sI https://footebas.com.br/sw.js | grep -i cache-control  # no-cache
```

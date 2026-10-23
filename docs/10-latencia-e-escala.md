# Latência, carregamento e escala — diagnóstico e plano

Data: 2026-10-23. Base: medições em produção feitas de São Paulo (colo GRU), leitura do código da branch
`mvp/fase-6-9` e pesquisa na documentação da Cloudflare, Supabase, Next.js e web.dev. Complementa o ADR 0014 e
substitui a pendência 3 do `HANDOFF.md` ("Smart Placement, `locationHint` ou Supabase em `sa-east-1`").

Convenção: **[medido]** = medido nesta data; **[doc]** = documentação oficial (fonte no fim); **[est.]** = estimativa,
a confirmar com a instrumentação da Onda 0.

## 1. Resumo

1. **Não migrar o Supabase para `sa-east-1`.** Durable Objects não nascem na América do Sul: o hint `sam` cai no
   leste da América do Norte [doc 1]. As carreiras dos jogadores brasileiros já rodam nos EUA, perto do banco em
   `us-east-1`. Com o banco em São Paulo, cada consulta feita pelo DO passaria a cruzar EUA↔Brasil (~115 ms).
   A topologia certa é **tudo na costa leste**, com uma única travessia Brasil↔EUA por requisição.
2. **O tempo vai em idas ao banco em série, não na distância em si.** O pior caso é o polling de job
   (`GET /v1/jobs/:id`, a cada 250 ms). Ele roda no Worker do Brasil, fora do DO, com ~6 idas ao Postgres em
   `us-east-1` e o save inteiro a cada poll. Seguem o plano grátis sem cache (uma ida ao banco por leitura, enfileirada
   no DO), a gravação no Postgres dentro do caminho da resposta e o CreateCareer com 6 idas em série.
3. **Há uma configuração desaconselhada que pode ser bug latente:** `prepare: false` no postgres.js com Hyperdrive.
   A Cloudflare avisa que isso "pode fazer consultas travarem ou falharem de forma intermitente" e gasta idas extras
   [doc 2]. O cache de consultas do Hyperdrive vem ligado por padrão (60 s, sem invalidar após gravação) [doc 3].
4. **O cliente multiplica a latência.** Abrir a Central dispara ~13 requisições em três ondas, quase todas com
   preflight CORS: a API não manda `Access-Control-Max-Age`. Depois de cada comando a Central é recarregada inteira
   (7 requisições). O endpoint único `/bundle` com ETag já existe, mas o web não o usa. TanStack Query não está
   instalado.
5. **O jogo baixa ~490 KB de JS comprimido (1,7 MB descomprimido) antes de pintar** [medido]. Um chunk de 831 KB
   descomprimido (240 KB gzip) concentra todas as telas, `motion` e os ports de demonstração. O supabase-js inteiro
   (~55 KB gzip) entra só para usar `.auth`.
6. **O Worker do Next não faz nada de servidor.** Não há route handler, server action, cookies nem ISR. Mesmo assim,
   todo HTML passa pelo Worker do OpenNext (TTFB de 80–470 ms mesmo com `x-opennext-cache: HIT`) [medido]. Exportar
   estático e servir só assets elimina o cold start e o custo por requisição de HTML.

Expectativa [est.] depois das Ondas 0–3: comando comum em 150–350 ms p95; CreateCareer em 300–600 ms; fim de rodada
sem polling; reabertura do app mostrando a última Central em < 100 ms; LCP da primeira carga abaixo de 2,5 s em 4G.

## 2. Onde o tempo vai hoje

### 2.1 Medições [medido, 2026-10-23, de São Paulo]

| Alvo                                                               | Resultado                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| HTML de `game.` e `lp.` (pré-renderizado, `x-opennext-cache: HIT`) | TTFB 80–470 ms, variável (cold start do Worker OpenNext)                                    |
| JS do jogo antes da primeira pintura                               | 16 recursos, ~512 KB transferidos, 1,7 MB descomprimidos; maior chunk 831 KB (240 KB gzip)  |
| FCP do jogo (desktop, rede rápida)                                 | ~950 ms; em celular médio com 4G deve passar de 3 s [est.]                                  |
| Landing                                                            | 53 requisições (~30 PNGs de escudo separados), 169 KB de JS, landing inteira `'use client'` |
| `GET /health`                                                      | 1ª ida real ao banco 156 ms; as seguintes ~5 ms (cache do Hyperdrive, não a origem)         |
| `GET /v1/rankings` (público)                                       | 350–520 ms; manda `s-maxage=300`, mas não é cacheado (resposta de Worker não entra na CDN)  |
| Preflight `OPTIONS` da API                                         | 204 sem `Access-Control-Max-Age` (o navegador repete a cada ~5 s por URL)                   |
| Fumaça do HANDOFF                                                  | CreateCareer ~1,5 s; SelectClub ~1,3 s; demais comandos 0,2–0,9 s                           |

### 2.2 Mapa de uma requisição

```
Celular (Brasil)
  │  preflight OPTIONS (sem max-age) + requisição  ── 2 travessias até a borda/Worker
  ▼
Worker footebas-api @ GRU
  ├─ rotas de carreira ──► Durable Object da carreira (leste dos EUA) ──► Hyperdrive ──► Supabase us-east-1
  │                         1 travessia Brasil↔EUA; consultas daí em diante são curtas (~2–30 ms) [est.]
  └─ rotas no Worker (CreateCareer, lista, jobs, ranking, stats, billing)
                            ──► Hyperdrive ──► Supabase us-east-1
                            CADA consulta cruza Brasil↔EUA (~115–140 ms)
```

O custo de uma rota no Worker cresce com o número de consultas. Uma rota no DO paga uma travessia e o resto é CPU
mais idas curtas. Por isso as maiores vitórias são (a) levar ao DO o que ainda está no Worker, (b) cortar consultas em
série e (c) pôr o Worker que sobra perto do banco.

### 2.3 Idas ao Postgres por endpoint

Levantamento no código (arquivos em `apps/api/src`, `packages/application/src`, `packages/database/src`).

| Endpoint                                     | Onde roda  | Idas ao banco hoje                                                                  | Alvo                               |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `CreateCareer`                               | Worker     | 6 em série (`postgres.ts:321-366`) + aquecimento do DO com leitura do save          | 1–2 (pipeline/CTE ou dentro do DO) |
| `SelectClub`                                 | DO         | 3 em série (plano lido duas vezes, `service.ts:552`)                                | 0–1                                |
| Leituras de carreira (home, elenco, tabela…) | DO         | plano grátis: 1 por leitura, **enfileirada** no DO (`career-access-cache.ts:31-34`) | 0                                  |
| Comandos simples (escalação, tática…)        | DO         | 2 em série; gravação no PG antes de responder (`career-unit-of-work.ts:343`)        | 0 no caminho da resposta           |
| `SimulateMatch`/`AdvanceDate`                | DO + fila  | comando 5; job no DO 7–10 (status redundante em `service.ts:770-850`)               | 0–1                                |
| `GET /v1/jobs/:id` (polling 250 ms)          | **Worker** | ~6 por poll + save inteiro + hidratação (`routes.ts:771-780`)                       | 0 (DO + push)                      |
| `GET /v1/careers` (lista)                    | Worker     | 6 + hidratação de cada save (`service.ts:1453-1492`)                                | 1 (colunas-resumo)                 |
| `GET /v1/public/stats`                       | Worker     | 4, com **lock global** `public:stats` (`service.ts:1497`)                           | 0 (cache)                          |
| `GET /v1/rankings`                           | Worker     | 2 (`rankings-postgres.ts:201-228`)                                                  | 0 em acerto de cache               |

## 3. Topologia recomendada

```
Celular ─► borda Cloudflare (GRU)
            ├─ HTML/JS/imagens: Static Assets (sem Worker), cache immutable
            ├─ GET públicos (ranking, stats): Workers Cache na borda, SWR + purge pelo cron
            └─ API autenticada ─► Worker com placement "aws:us-east-1"
                                   ├─► DO da carreira (leste dos EUA): fonte quente, comandos, simulação, push
                                   └─► Hyperdrive ─► Supabase us-east-1: índices, listas, ranking, billing
```

- **Uma travessia Brasil↔EUA por ação do usuário**, nunca uma por consulta.
- O DO é o **único escritor** da carreira e o Postgres recebe as mudanças de forma assíncrona (write-behind).
- O progresso da rodada vai do DO ao celular por WebSocket hibernável (ou long-poll), sem polling.
- Reavaliar a região do banco só se a Cloudflare passar a criar DOs na América do Sul (acompanhar
  `where.durableobjects.live/region/sam`) **e** o DO já tiver saído do caminho síncrono do banco.

## 4. Plano em ondas

Cada item: ganho estimado, esforço e onde mexer. As ondas são independentes o bastante para virar PRs separados. A
Onda 0 vem antes de tudo para que cada mudança seja medida.

### Onda 0 — Medir (meio dia a 1 dia)

Implementada em 2026-10-23 (Server-Timing, colo do objeto, `/health` com `now()`, RUM, bundle no CI); como ler
está em `docs/observabilidade.md`.

1. **Server-Timing por etapa** na API e no DO: `auth`, `rl`, `do` (hop), `queue` (espera na cadeia `serialize` do
   DO), `load` (hidratação), `pg;desc="n=6"` (contador de consultas e ms via wrapper do `sql`), `commit`. Mais
   `Timing-Allow-Origin` para o navegador enxergar. Hoje só existe `durationMs` total (`fetch-router.ts:258`) e o DO
   só loga erros.
2. **Onde o DO vive:** uma vez por isolate, `fetch('https://www.cloudflare.com/cdn-cgi/trace')` dentro do DO e
   logar `colo` com o id do objeto. Confirma a premissa do item 1 do resumo.
3. **`/health` honesto:** usar uma consulta não cacheável (`select now()`) para medir a ida real à origem.
4. **RUM no web:** `web-vitals/attribution` + Cloudflare Web Analytics; marcas próprias `central-visible` (do toque
   até a Central pintada) e `screen-switch` (meta de 100 ms do ADR 0014).
5. **Linha de base do bundle:** `pnpm --filter @footebas/web exec next analyze --output` (Next 16.2) no CI e guardar
   o relatório.
6. **Hyperdrive:** `npx wrangler hyperdrive get 865d2096b8454b47a3bdd4bbb0fce828` para ver o estado do cache e do
   limite de conexões; acompanhar as métricas de pool no painel.

### Onda 1 — Ajustes de configuração (horas; risco baixo)

Implementada em 2026-10-23 (PR petzada/footebas#2). Hyperdrive já atualizado em produção: cache desligado e
limite de 25 conexões de origem; com isso o `/health` mede 143–186 ms por consulta do Worker em GRU até
`us-east-1`. HTTP/3 e Zstandard já estavam ativos. Achado: a origem do Hyperdrive é o pooler Supavisor em modo
sessão (`pooler.supabase.com:5432`); a Cloudflare recomenda a conexão direta (decisão à parte: exige a senha do
banco e checar IPv4/IPv6).

| #    | Mudança                                                                                                                            | Ganho [est.]                                                                                              | Onde                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1.1  | `Access-Control-Max-Age: 7200` no CORS                                                                                             | −1 travessia (30–150 ms) em quase toda chamada                                                            | `apps/api/src/fetch-router.ts:92-105`                                 |
| 1.2  | `prepare: true` no postgres.js (manter `fetch_types: false`)                                                                       | menos idas por consulta; tira o risco de travamento intermitente [doc 2]                                  | `apps/api/src/worker.ts:208-213`, `career-durable-object.ts:181-186`  |
| 1.3  | Cache do Hyperdrive **desligado** na config principal (`--caching-disabled`); se preciso, segunda config só para leituras públicas | corrige leituras velhas de versão, job e plano após pagamento                                             | painel/wrangler + `wrangler.jsonc`                                    |
| 1.4  | `idle_timeout` curto (5–10 s) no cliente postgres.js do DO                                                                         | conexão aberta mantém o DO vivo até 15 min [doc 4] e cobra duração; −US$ 700–1.000/mês com 10k DAU [est.] | `career-durable-object.ts:181-186`                                    |
| 1.5  | Limitar conexões de origem do Hyperdrive a ~20–30                                                                                  | evita "too many connections" no Supabase Micro (`max_connections` 60)                                     | config do Hyperdrive                                                  |
| 1.6  | `locationHint: "enam"` ao obter o stub                                                                                             | ~0 hoje; fixa a intenção                                                                                  | `career-durable-object.ts` (`stubOf`)                                 |
| 1.7  | `ctx.waitUntil(sql.end())` em vez de `await`                                                                                       | −1–10 ms                                                                                                  | `apps/api/src/worker.ts:331-333`                                      |
| 1.8  | Cache longo para `/crests/*`, `/flags/*`, `/assets/*`, `/og.png` (nome com hash ou `max-age=86400, stale-while-revalidate`)        | dezenas de revalidações a menos por visita                                                                | `apps/web/public/_headers`                                            |
| 1.9  | Compilar os padrões das rotas uma vez por isolate, não por requisição                                                              | alguns ms de CPU                                                                                          | `apps/api/src/fetch-router.ts:72`, `career-durable-object.ts:112-156` |
| 1.10 | Ligar HTTP/3 na zona (Speed › Protocol Optimization); conferir `content-encoding: zstd`                                            | pequeno, melhor em 4G com perda                                                                           | painel                                                                |

### Onda 2 — Servidor (dias)

| #    | Mudança                                                                                                                                                                                                                 | Ganho [est.]                                                | Notas                                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | **Job no DO:** status do job no storage do DO, rota `/v1/careers/:id/jobs/:jobId` encaminhada ao DO, com long-poll (`?wait=25`) fora da cadeia `serialize`                                                              | −1 a −2 s por rodada; tira a maior pressão do pool do banco | `career-durable-object.ts:232-257`, `routes.ts:744-780`, `queue-job-store.ts`                                                           |
| 2.2  | **Plano grátis com cache** (5–30 s) e invalidação ativa: o webhook de billing avisa os DOs do usuário                                                                                                                   | −1,5 s ao abrir a Central (grátis); −140–280 ms por comando | `career-access-cache.ts`, billing                                                                                                       |
| 2.3  | **Leituras fora do `serialize`:** leitura usa o snapshot congelado atual, sem esperar comandos                                                                                                                          | simulação longa deixa de bloquear a Central                 | `career-unit-of-work.ts:198-235`                                                                                                        |
| 2.4  | **Write-behind para o Postgres:** grava no SQLite do DO e responde; um `alarm` grava no PG com retry e idempotência por versão (o UPDATE condicional já existe); alerta de atraso                                       | −150–250 ms por comando                                     | `career-unit-of-work.ts:313-347`. Pré-requisito: remover o caminho que grava direto no PG sem o binding `CAREERS` (`worker.ts:323-325`) |
| 2.5  | **CreateCareer** em 1–2 idas (pipeline no `sql.begin` ou CTE única) e aquecimento do DO levando o save no corpo; opcional: CreateCareer + SelectClub num comando                                                        | −500–750 ms; SelectClub −150–400 ms                         | `postgres.ts:321-366`, `career-durable-object.ts:313`                                                                                   |
| 2.6  | **Placement `"region": "aws:us-east-1"`** na API para o que fica no Worker                                                                                                                                              | −(N−1)×115 ms nas rotas com N consultas                     | `apps/api/wrangler.jsonc`. Vale só para o handler `fetch` (não para fila e cron) [doc 5]. Medir com o cabeçalho `cf-placement`          |
| 2.7  | **Lista de carreiras** com colunas-resumo (`club_name`, `season`, `current_date`, `coach`…) gravadas no commit; sem transação nem lock; `select` só das colunas                                                         | −500–700 ms + CPU                                           | migration aditiva + backfill                                                                                                            |
| 2.8  | **Públicos em cache:** `GET /v1/rankings` e `/v1/public/stats` com Workers Cache (`max-age=60, stale-while-revalidate=900`, `Cache-Tag`, purge no cron) [doc 6]; contador de usuários vindo do cron; fim do lock global | ranking 400 → ~20–50 ms; stats −500 ms                      | `routes.ts`, `service.ts:1497`, `rankings-postgres.ts`                                                                                  |
| 2.9  | **Conquistas** com um `INSERT` de várias linhas                                                                                                                                                                         | −140 ms × (N+1) no fim de temporada                         | `rankings-postgres.ts:52-67`                                                                                                            |
| 2.10 | **CPU:** clonar só o subárvore alterado em vez de `structuredClone` do agregado; tirar `deepFreeze` em produção; validar respostas com zod só nos testes                                                                | 20–150 ms por comando (medir antes)                         | `service.ts:526/802/1155`, `unified-phase-four.ts:40/133`                                                                               |
| 2.11 | **JWKS** fixado com `createLocalJWKSet` e fallback remoto                                                                                                                                                               | −200–400 ms no primeiro uso de cada isolate                 | `supabase-auth.ts:21-29`                                                                                                                |
| 2.12 | **Limpeza:** TTL em `simulation_jobs`, `command_receipts` e nos recibos `receipt:*` do storage do DO; índice parcial para o agregado do ranking                                                                         | evita degradação com o volume                               | migrations + cron                                                                                                                       |

### Onda 3 — Cliente (dias)

| #    | Mudança                                                                                                                                                                                                                                                     | Ganho [est.]                                       | Onde                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| 3.1  | Central via **`/bundle` com `If-None-Match`**; comandos devolvem a nova versão (ou o bundle) em vez de recarregar 7 endpoints                                                                                                                               | −1 onda (0,3–1,5 s) por ação                       | `apps/web/lib/http-career-api.ts:976-1026`, `:1749-1772`         |
| 3.2  | **TanStack Query** com persistência em IndexedDB (`buster` = versão de conteúdo + build, chave por usuário e carreira, limpar no logout)                                                                                                                    | reabertura mostra a última Central em < 100 ms     | novo provider; migrar tela a tela (ADR 0014 §4)                  |
| 3.3  | **Code-split por tela** (`next/dynamic`) com prefetch do chunk por intenção (foco/toque no menu)                                                                                                                                                            | chunk inicial bem menor; LCP e INP melhores        | `apps/web/components/career-game.tsx`                            |
| 3.4  | **Tirar os ports de demonstração do bundle de produção** (`InMemoryCareerApi`, `management-demo`, ports fake): `import()` só no modo demo                                                                                                                   | dezenas de KB                                      | `apps/web/lib/runtime-api.ts`, `career-game.tsx`                 |
| 3.5  | `@supabase/auth-js` no lugar do supabase-js, **mantendo o mesmo `storageKey`** para não deslogar ninguém                                                                                                                                                    | ~30 KB gzip                                        | `apps/web/lib/supabase-client.ts`, `lib/auth.ts`                 |
| 3.6  | `motion` → CSS/WAAPI na transição de tela; `@phosphor-icons/react` em `optimizePackageImports`                                                                                                                                                              | ~40 KB + o que o analyzer mostrar                  | `components/retro/screen-transition.tsx`, `next.config.ts`       |
| 3.7  | **Landing** em RSC com ilhas; `h1` e `.lp-reveal` visíveis sem JS (opacidade 0 não conta para o LCP)                                                                                                                                                        | LCP da landing sem esperar animação nem hidratação | `components/landing/landing-page.tsx`, `app/landing/landing.css` |
| 3.8  | Fonte via `next/font/local` com subset e preload; `preconnect` para a API e o Supabase                                                                                                                                                                      | CLS menor, texto pinta antes                       | `app/layout.tsx`                                                 |
| 3.9  | **Service Worker:** precache versionado do shell, navegação em stale-while-revalidate, aviso "nova versão" em vez de `skipWaiting()` automático, limpar caches antigos, recarregar em `ChunkLoadError`. **Não** cachear respostas autenticadas da API no SW | reabertura instantânea e offline real              | `apps/web/public/sw.js`, `components/phase6-shell.tsx`           |
| 3.10 | Pré-carregar Phaser/Three em idle na tela pré-jogo (respeitando `saveData`)                                                                                                                                                                                 | partida abre sem esperar ~350 KB                   | `components/match-stage/match-stage.tsx`                         |

### Onda 4 — Entrega estática do web (2–3 dias)

`output: 'export'` e um Worker **só de assets** (sem `main`). Requisição de asset não invoca script e não é cobrada
[doc 7]. Os redirects e o rewrite por host saem do `next.config.ts` e viram regras da zona (Single Redirects para
apex/www e `/landing`; URL Rewrite para `lp./` → `/landing`) ou dois Workers de assets (game e lp). O callback do
Supabase continua funcionando, porque o PKCE já troca o `?code=` no cliente.

- Ganho: TTFB do HTML sem cauda de cold start; o `_headers` e o SW passam a valer para o HTML; build mais simples
  (some o `cf:build` que falha no Windows).
- A verificar antes: se a URL Rewrite Rule roda antes de um Worker de custom domain (Cloudflare Trace).
- Depois: Speculation Rules da landing para o jogo (`Supports-Loading-Mode: credentialed-prerender` no HTML do jogo)
  para o toque em "Jogar" abrir quase na hora.
- Arquivos: `apps/web/next.config.ts`, `wrangler.jsonc`, `open-next.config.ts` (remover), `package.json`
  (scripts `cf:*`), `.github/workflows/deploy-web.yml`, `docs/deploy.md`.

### Onda 5 — Estrutural (semanas)

1. **Simulação no `alarm()` do DO** em vez da Queue: o comando grava `pendingJobId` + `setAlarm(now)` e responde 202
   sem tocar no banco; o alarme simula, faz o commit local, avisa o celular e o write-behind leva ao Postgres. Some a
   tabela `simulation_jobs` e o consumidor. Fim de rodada: de 4–5 s para a CPU da rodada + 100–200 ms [est.].
   Medir antes a CPU de uma rodada (o `cpu_ms` vale para o DO).
2. **WebSocket hibernável no DO** (`ctx.acceptWebSocket`) para empurrar `job.completed` e a nova versão. Não cobra
   duração enquanto hiberna [doc 8]; o cliente precisa reconectar após deploy.
3. **SQLite do DO como fonte primária** da carreira, com o Postgres como índice, ranking e analytics (próxima
   evolução do ADR 0014). Hidratação a frio local; PITR de 30 dias no próprio DO [doc 9]. Limite de 2 MB por linha:
   o save enxuto cabe, o antigo não.
4. **Queue** só para trabalho longo ou desacoplado (até 15 min).

## 5. Escala e custos

Limites que importam [doc]: Supabase Micro com `max_connections` 60 (Small 90, Medium 120); Hyperdrive ~100
conexões de origem por config no plano pago; DO ~1.000 req/s por objeto e 128 MB por isolate; Queues 5.000 msg/s.

Pontos que travam a escala hoje:

- **Polling segura conexões:** cada poll é uma transação de ~0,7 s. Cerca de 20–30 simulações simultâneas esgotam o
  pool [est.]. A Onda 2.1 resolve.
- **Lock global** em `public:stats` serializa a tela de Início de todos os usuários (2.8).
- **Memória do DO:** o agregado hidratado (~2,6 MB de JSON) fica vivo e cada comando gera cópias de 1–2× (2.10).
- **Crescimento sem limpeza:** jobs, recibos e o cron do ranking que varre a tabela inteira a cada 15 min (2.12).

Estimativa para 10k usuários ativos por dia [est.; premissas: sessão de 25 min, 200 requisições, 20 simulações]:

| Item                          | Hoje                                            | Com as Ondas 1–2                       |
| ----------------------------- | ----------------------------------------------- | -------------------------------------- |
| Workers (requisições + CPU)   | ~US$ 50                                         | ~US$ 40 (menos polling)                |
| DO duração                    | **~US$ 1.000** (conexão aberta impede hibernar) | ~US$ 0–25                              |
| DO requisições + SQLite       | ~US$ 5                                          | ~US$ 10–50 (write-behind grava linhas) |
| Queues                        | ~US$ 7                                          | ~US$ 0–7                               |
| Supabase (Pro + Small/Medium) | ~US$ 30–75                                      | ~US$ 30–75                             |
| **Total**                     | **~US$ 1.100/mês**                              | **~US$ 90–180/mês**                    |

## 6. O que não fazer agora

- **Supabase em `sa-east-1`:** pioraria os comandos enquanto os DOs estiverem nos EUA e exige projeto novo, migração
  do Auth e re-login geral (o `iss` dos JWTs muda).
- **Smart Placement:** só considera locais onde o Worker já rodou; com tráfego todo brasileiro pode nunca mover. Use a
  Placement Hint explícita (2.6).
- **Cachear respostas autenticadas no Service Worker:** a Cache Storage ignora `Authorization` e pode misturar contas.
- **Build customizado do Phaser, Draco/Meshopt/KTX2, OffscreenCanvas:** o GLB do estádio tem 5,8 KB; o ganho não paga
  o esforço.
- **Encurtar a validade do token do Supabase** abaixo de 1 h sem motivo: o refresh já é em segundo plano.

## 7. Metas e guarda-corpos

- Metas do ADR 0014 seguem: comando comum < 800 ms p95 (alvo novo: < 350 ms), troca de tela com dados em cache
  < 100 ms, LCP < 2,5 s em 4G.
- Fumaça na nuvem com p95 por rota e o número de consultas por requisição (via Server-Timing), falhando se subir.
- `size-limit` no chunk inicial do jogo (por exemplo 25% acima da linha de base) e Lighthouse CI com
  `largest-contentful-paint ≤ 2500`, rodando no CI, não localmente.

## 8. Riscos

- **Write-behind (2.4, 5.3):** janela em que o Postgres fica atrás do DO (lista, ranking e backup veem versão
  antiga). Exige o DO como único escritor, retry idempotente e alerta de atraso.
- **Cache do plano grátis (2.2):** pagamento tem de liberar na hora; sem a invalidação ativa o usuário espera o TTL.
- **`prepare: true` (1.2):** conferir `sql.unsafe` e as transações; manter o cache do Hyperdrive desligado (1.3) para
  não passar a ler versão, job e plano velhos.
- **Export estático (Onda 4):** os redirects saem do código; validar `/auth/callback`, o rewrite da `lp.` e o 308
  antigo que alguns navegadores guardaram.
- **WebSocket/long-poll:** conexões abertas e reconexão em deploy; o long-poll não pode entrar na cadeia `serialize`.

## 9. Fontes

1. Durable Objects — data location e location hints: https://developers.cloudflare.com/durable-objects/reference/data-location/
   e distribuição observada: https://where.durableobjects.live/region/sam
2. Hyperdrive + Postgres.js ("Do not use `prepare: false`"): https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/
3. Hyperdrive — query caching (ligado por padrão): https://developers.cloudflare.com/hyperdrive/concepts/query-caching/
4. Conexões de saída mantêm o DO vivo (jun/2026): https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/
   e ciclo de vida: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
5. Placement (Smart e Placement Hints, `aws:us-east-1`): https://developers.cloudflare.com/workers/configuration/placement/
6. Workers Cache: https://developers.cloudflare.com/workers/cache/
7. Static Assets — billing e roteamento: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
   e https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
8. WebSockets hibernáveis em DO: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
9. SQLite em DO (limites e PITR): https://developers.cloudflare.com/durable-objects/platform/limits/ e
   https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
10. Preços: https://developers.cloudflare.com/durable-objects/platform/pricing/,
    https://developers.cloudflare.com/workers/platform/pricing/, https://supabase.com/pricing
11. Supabase — regiões, compute, migração entre projetos, signing keys:
    https://supabase.com/docs/guides/platform/regions, https://supabase.com/docs/guides/platform/compute-and-disk,
    https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore,
    https://supabase.com/docs/guides/auth/signing-keys
12. CORS `Access-Control-Max-Age`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age
13. OpenNext Cloudflare caching: https://opennext.js.org/cloudflare/caching; Next static export:
    https://nextjs.org/docs/app/guides/static-exports; bundle analysis: https://nextjs.org/docs/app/guides/package-bundling
14. LCP e elementos com opacidade 0: https://web.dev/articles/lcp; ciclo de vida do SW:
    https://web.dev/articles/service-worker-lifecycle
15. TanStack Query persistência: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient;
    Motion bundle: https://motion.dev/docs/react-reduce-bundle-size

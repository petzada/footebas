# Observabilidade da API

A API (`footebas-api`, Cloudflare Workers) escreve **uma linha JSON por requisição HTTP e uma por job da fila**.
O Workers Logs está ligado em `apps/api/wrangler.jsonc` (`"observability": { "enabled": true }`) e indexa os campos
do JSON, então dá para filtrar e agregar por eles sem parse manual. Código: `apps/api/src/observability.ts`,
`apps/api/src/request-identity.ts` e os ganchos em `apps/api/src/fetch-router.ts` e `apps/api/src/worker.ts`.

## O que é registrado

### Requisição (`type: "request"`)

| Campo        | Exemplo                   | Observação                                                                 |
| ------------ | ------------------------- | -------------------------------------------------------------------------- |
| `level`      | `info` / `warn` / `error` | `error` para 5xx, `warn` para 429, `info` para o resto.                    |
| `requestId`  | `request_3f9c…`           | O mesmo valor volta no cabeçalho `x-request-id` da resposta.               |
| `method`     | `POST`                    |                                                                            |
| `route`      | `/v1/careers/:id/home`    | Rota normalizada (modelo, sem ids). `unmatched` = 404; `preflight` = CORS. |
| `status`     | `202`                     |                                                                            |
| `durationMs` | `143`                     | Tempo dentro do roteador (sem a composição do Worker).                     |
| `userHash`   | `a1b2c3d4e5f60718`        | 16 hex do SHA-256 do `sub` do JWT (lido sem validar). Ausente sem bearer.  |
| `version`    | `0f3c…`                   | Id da versão do Worker (`CF_VERSION_METADATA`), igual ao de `GET /health`. |
| `errorName`  | `TypeError`               | Só em 5xx causados por exceção.                                            |
| `stack`      | `TypeError: … at …`       | Só em 5xx e **só no log**: a resposta continua `INTERNAL_ERROR` genérico.  |

### Job da fila (`type: "job"`)

| Campo        | Exemplo                                           | Observação                                                      |
| ------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| `level`      | `info` / `warn` / `error`                         | `warn` em retry, `error` em exceção ou dead letter.             |
| `jobId`      | `job_…`                                           |                                                                 |
| `careerId`   | `career_…`                                        |                                                                 |
| `attempts`   | `1`                                               | Contagem de entregas do Cloudflare Queues (1 na primeira).      |
| `durationMs` | `2810`                                            |                                                                 |
| `result`     | `succeeded`, `retry`, `error`, `dead_letter`, ... | `dead_letter` = falhou na última tentativa (`max_retries` = 5). |
| `version`    | `0f3c…`                                           |                                                                 |

### O que nunca vai para o log

Nada de dado pessoal: sem e-mail, nome, IP, token, corpo de requisição ou de resposta. O usuário aparece só como
`userHash` (pseudônimo estável entre renovações do token). O IP só é usado, já com hash, como chave do rate limit
e não é registrado.

## Como consultar

### Painel (Workers Logs)

Cloudflare → **Workers & Pages** → `footebas-api` → **Observability** (Logs / Query Builder). Filtros úteis:

- Erros 5xx: `type = request` e `status >= 500` (abra o evento para ver `stack`).
- Uma requisição reportada por um jogador: `requestId = request_…` (o jogador vê o `x-request-id` no erro).
- Tudo de uma carreira na fila: `type = job` e `careerId = career_…`.
- Rate limit: `status = 429`, agrupado por `route`.
- Latência de comando: `type = request`, `route = /v1/commands`, visualização **P95** de `durationMs`.
- Depois de um deploy: agrupe por `version` para comparar taxa de erro entre versões.

Retenção do Workers Logs é curta (dias, conforme o plano). Para guardar mais, configure Logpush para R2 ou para
um serviço externo (item humano, opcional).

### Terminal (`wrangler tail`)

Fluxo ao vivo da produção (precisa de login no Cloudflare; não altera nada):

```sh
pnpm exec wrangler tail footebas-api --format json \
  | jq -c '.logs[]?.message[0] | fromjson? | select(.type == "request" and .status >= 500)'

# jobs que falharam
pnpm exec wrangler tail footebas-api --format json \
  | jq -c '.logs[]?.message[0] | fromjson? | select(.type == "job" and .level != "info")'

# só invocações com erro, modo legível
pnpm exec wrangler tail footebas-api --status error --format pretty
```

Em desenvolvimento (`pnpm exec wrangler dev --config apps/api/wrangler.jsonc`), as mesmas linhas saem no terminal.
O servidor Fastify local (`pnpm --filter @footebas/api dev`) usa o log próprio do Fastify e não passa por esse
roteador.

## Latência por etapa (Server-Timing) e RUM

Medição da Onda 0 de `docs/10-latencia-e-escala.md`.

**Server-Timing.** Toda resposta da API leva um cabeçalho `Server-Timing`, e o mesmo conteúdo vai no campo
`timing` do log `type: "request"`:

| Métrica              | Onde   | Significado                                                                |
| -------------------- | ------ | -------------------------------------------------------------------------- |
| `rl`                 | Worker | rate limit                                                                 |
| `fwd`                | Worker | ida e volta até o Durable Object da carreira (inclui todo o trabalho dele) |
| `app`                | Worker | handler que roda no próprio Worker (rotas que não vão ao objeto)           |
| `pg;desc="n=…"`      | Worker | consultas ao Postgres que o Worker enviou                                  |
| `edge;desc="GRU"`    | Worker | colo da borda que atendeu                                                  |
| `do-queue`           | objeto | espera na fila de comandos do objeto                                       |
| `do-load`            | objeto | carga/hidratação da carreira (0 quando já está em memória)                 |
| `do-commit`          | objeto | gravação (Postgres + storage do objeto)                                    |
| `do-app`, `do-total` | objeto | handler e total dentro do objeto                                           |
| `do-pg;desc="n=…"`   | objeto | consultas ao Postgres que o objeto enviou nesta requisição                 |
| `do-colo;desc="IAD"` | objeto | onde o objeto roda (aparece depois da primeira sonda do isolate)           |

As métricas do objeto são deltas de contadores do objeto e ficam aproximadas quando requisições se sobrepõem
(leituras podem). No Workers, o relógio só avança em I/O: CPU pura não aparece nas durações. Para CPU, use
`cpuTimeMs` das invocações no Workers Logs.

No navegador, a aba Network mostra o Server-Timing em "Timing" (a API manda `Timing-Allow-Origin` para as origens
do CORS). Cada isolate de objeto também registra uma linha `type: "career_object"`, `route: "location"`, com o
`colo` onde roda.

**RUM (`type: "rum"`).** O web envia por `navigator.sendBeacon` (`POST /v1/telemetry/vitals`, anônimo, bucket
público de rate limit) os Core Web Vitals (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`, com o seletor do elemento em
`label`) e duas medidas do jogo:

- `screen-switch`: do toque até a tela nova pintada, com o id da tela em `label` (meta do ADR 0014: < 100 ms);
- `central-visible`: a primeira Central pintada no carregamento, desde o toque que levou a ela (`label: "tap"`) ou
  desde o início da navegação (`label: "navigation"`).

Para o p75 por tela, filtre `type = rum` no Query Builder e agrupe por `metrics.name` e `metrics.label`. O Cloudflare
Web Analytics da zona continua coletando os Web Vitals por conta própria.

**Bundle.** O job `verify` do CI escreve no resumo o tamanho dos chunks do web (bruto e gzip,
`tools/bundle-report.mjs`) e publica a análise do Turbopack como artefato `web-bundle-analysis`.

## Rate limiting (resumo)

Bindings nativos do Workers (`ratelimits` em `apps/api/wrangler.jsonc`, código em `apps/api/src/rate-limit.ts`),
janela de 60 s, por localidade do Cloudflare (contagem aproximada):

| Balde                 | Chave          | Limite  | Rotas                                                  |
| --------------------- | -------------- | ------- | ------------------------------------------------------ |
| `RATE_LIMIT_COMMANDS` | hash do bearer | 60/min  | `POST` autenticado (`/v1/commands`, fase 4/5, billing) |
| `RATE_LIMIT_READS`    | hash do bearer | 600/min | `GET` autenticado (inclui polling de job, ~4 req/s)    |
| `RATE_LIMIT_PUBLIC`   | hash do IP     | 120/min | qualquer requisição sem bearer                         |
| isentas               | —              | —       | `GET /health`, `POST /v1/billing/webhook`, `OPTIONS`   |

Resposta: `429` com `retry-after` (segundos) e corpo no formato de erro do contrato. Enquanto o contrato não tiver
o código `RATE_LIMITED`, o corpo usa `code: "FORBIDDEN"` com `message: "rate limit exceeded; retry later"`. Se o
binding falhar, a API deixa passar (falha aberta). Para mudar limites, altere `wrangler.jsonc` e `RATE_LIMITS`
juntos.

## Alertas recomendados (configuração humana)

Os alertas não estão automatizados no repositório. Sugestão inicial, a configurar no painel do Cloudflare
(Notifications / alertas do Workers Observability) ou numa ferramenta externa alimentada por Logpush:

| Alerta                | Condição sugerida                                                             | Onde olhar                                       |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Taxa de 5xx           | `status >= 500` acima de 2% das requisições em 5 min (ou > 20 erros em 5 min) | Workers Logs (`type = request`)                  |
| DLQ com mensagens     | qualquer mensagem em `footebas-simulation-dlq`, ou log `result = dead_letter` | Queues → `footebas-simulation-dlq`; Workers Logs |
| p95 de comando        | P95 de `durationMs` em `route = /v1/commands` acima de 1500 ms por 15 min     | Workers Logs (Query Builder, P95)                |
| Rate limit em excesso | `status = 429` acima de 5% em 15 min (limite apertado demais ou abuso)        | Workers Logs                                     |
| Saúde                 | `GET /health` diferente de 200 por 3 checagens seguidas                       | Monitor externo (UptimeRobot, Better Stack…)     |

A DLQ não tem consumidor: mensagens lá ficam paradas até alguém olhar. Para inspecionar:
`pnpm exec wrangler queues info footebas-simulation-dlq`.

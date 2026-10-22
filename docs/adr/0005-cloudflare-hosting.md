# ADR 0005 — Hospedagem integral no Cloudflare

- Status: aceito
- Data: 2026-10-22

## Contexto

`docs/01` e `ROADMAP-MVP.md` previam Fastify + workers BullMQ/Redis no Railway. O responsável decidiu hospedar todo
o produto no Cloudflare usando apenas serviços nativos (sem Redis externo), Supabase para Postgres/Auth/Storage e o
domínio `footebas.com.br` (registrado no registro.br, DNS no Cloudflare). BullMQ exige Redis, conexão TCP persistente
e processo de longa duração, o que o runtime de Workers não oferece.

## Decisão

- **Web:** Next.js em Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`).
- **API:** Worker HTTP. As rotas atuais em Fastify são portadas para um handler compatível com Workers sobre o mesmo
  `@footebas/application` e `@footebas/contracts`; o contrato REST/OpenAPI não muda.
- **Jobs:** Cloudflare Queues substituem BullMQ. O consumidor de fila reaproveita o runtime de `apps/worker`
  (estados, retry/backoff, dead-letter e idempotência continuam no domínio da aplicação).
- **Locks por carreira e SSE/progresso:** Durable Object por carreira.
- **Postgres:** Supabase via Hyperdrive; Prisma com driver adapter compatível com Workers.
- **Sem Redis:** leaderboards são snapshots no Postgres servidos com Cache API/KV; rate limiting usa o binding
  nativo de Rate Limiting do Workers; cache de read models usa KV/Cache API.
- **Auth:** Supabase Auth (Google OAuth e magic link); a API valida o JWT do Supabase.
- **Billing:** Woovi via REST a partir do Worker; webhook recebido em rota da API com verificação de assinatura.
- **DNS:** zona `footebas.com.br` no Cloudflare; `footebas.com.br` → web, `api.footebas.com.br` → API.

## Consequências

Os ports in-memory continuam sendo o adapter de teste; os adapters Cloudflare/Supabase/Woovi são novas
implementações dos mesmos ports. O engine continua puro (ADR 0001). Cada invocação precisa caber nos limites de CPU
do Workers: avanço de rodada roda no consumidor de fila, nunca na requisição HTTP. Fastify permanece como servidor
de desenvolvimento local até a portabilidade terminar.

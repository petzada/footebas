# @footebas/cloud-smoke

Teste de fumaça ponta a ponta contra a API publicada (Cloudflare Workers +
Hyperdrive + Queue) ou contra o servidor local. Usa as mesmas rotas e payloads
do cliente web (`apps/web/lib/http-career-api.ts`) e não tem dependências de
runtime.

## O que ele faz

1. `GET /health` (com checagem do banco) e `GET /health?deep=0` (sem banco).
2. Autentica: bearer `smoke:<SMOKE_TOKEN>` (nuvem) ou sessão dev (`AUTH=dev`).
3. Lista as carreiras do usuário.
4. Cria uma carreira (`CreateCareer`) e escolhe o clube (`SelectClub`).
5. Escala o time (`AutoPickLineup`) e lê o próximo jogo.
6. Avança a rodada (`SimulateMatch`): o comando enfileira um job na Queue; o
   script faz polling de `GET /v1/jobs/:id` até `succeeded` (falha em
   `failed`/`cancelled` ou no timeout).
7. Recarrega a carreira por `GET /v1/careers/:id/bundle` (a Central numa
   leitura, ADR 0014) e confere: sem simulação pendente, versão do save
   exatamente +1 após o job, data avançada, elenco e classificação do clube,
   próximo jogo diferente, `304` ao revalidar com `If-None-Match` e o pós-jogo
   do jogo simulado na mesma versão.
8. Lista as carreiras de novo e confere a carreira nova, com versão e clube.
9. Mede o tempo de ida e volta de cada comando e falha se o p95 passar de
   `SMOKE_P95_MS` (meta do ADR 0014: 800 ms).

Saída em português; código de saída `0` (ok), `1` (fumaça falhou) ou `2`
(configuração inválida). Cada execução cria uma carreira nova para o usuário
de fumaça (`smoke_user`).

## Uso

Na raiz do repositório:

```sh
# nuvem
API_URL=https://api.footebas.com.br SMOKE_TOKEN=<token> pnpm smoke:cloud

# local (servidor em memória, sessão dev)
pnpm --filter @footebas/api dev            # em outro terminal, porta 8787
API_URL=http://127.0.0.1:8787 AUTH=dev pnpm smoke:cloud

# local com o mesmo caminho de token da nuvem
SMOKE_TOKEN=<token> pnpm --filter @footebas/api dev
API_URL=http://127.0.0.1:8787 SMOKE_TOKEN=<token> pnpm smoke:cloud
```

No PowerShell: `$env:API_URL='https://api.footebas.com.br'; $env:SMOKE_TOKEN='<token>'; pnpm smoke:cloud`.

| Variável             | Padrão                   | Uso                                      |
| -------------------- | ------------------------ | ---------------------------------------- |
| `API_URL`            | (obrigatória)            | Base da API, sem `/` no fim              |
| `SMOKE_TOKEN`        | (obrigatória em `smoke`) | Mesmo valor do secret do Worker (≥ 32)   |
| `AUTH`               | `smoke`                  | `dev` usa `POST /v1/dev/session` (local) |
| `SMOKE_EMAIL`        | `smoke@footebas.invalid` | E-mail da sessão dev                     |
| `SMOKE_CLUB`         | `club_flamengo`          | Clube assumido pela carreira             |
| `JOB_TIMEOUT_MS`     | `120000`                 | Tempo máximo esperando o job             |
| `JOB_POLL_MS`        | `1000`                   | Intervalo do polling do job              |
| `REQUEST_TIMEOUT_MS` | `30000`                  | Tempo máximo de cada requisição          |
| `SMOKE_P95_MS`       | `800`                    | Limite do p95 dos comandos (ms)          |

## Configurar o token na nuvem

O caminho `smoke:` só existe no Worker quando o secret `SMOKE_TOKEN` está
definido com pelo menos 32 caracteres; sem ele, o bearer `smoke:...` é tratado
como JWT inválido (401). O token nunca vai para o repositório.

```sh
# gerar (64 caracteres hex) e gravar como secret do Worker
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm --filter @footebas/api exec wrangler secret put SMOKE_TOKEN

# desligar o caminho de fumaça
pnpm --filter @footebas/api exec wrangler secret delete SMOKE_TOKEN
```

Comparação em tempo constante (SHA-256 dos dois lados). O usuário autenticado
é fixo: `smoke_user` / `smoke@footebas.invalid` / "Fumaça".

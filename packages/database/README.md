# `@footebas/database`

Ports e adapter in-memory do estado canônico server-authoritative. `GameSave` armazena snapshot canônico,
SHA-256, seed, versões de engine/regras/conteúdo/schema, proprietário e versão otimista. Instantes vêm de `Clock`.

## Uso e garantias

`withCareerLock` serializa commits por carreira. A transação trabalha sobre uma cópia e só publica o estado ao
concluir; exceções descartam save, eventos/recibos e qualquer outra escrita do contexto. `executeIdempotent`
consulta e grava o recibo dentro do mesmo lock/transação, portanto retry devolve a resposta original.

Comandos locais: `pnpm --filter @footebas/database typecheck`, `lint`, `test` e `build`.

O schema Prisma e a migration são artefatos de código. Não execute `prisma migrate` neste estágio. A ativação no
Supabase, validação das policies RLS e testes reais de Postgres continuam pendentes no checklist global.

## ADR-DB-001 — transações curtas e concorrência

Decisão: a simulação custosa ocorre fora da transação. O commit abre uma transação curta, obtém
`pg_advisory_xact_lock(hashtextextended(career_id, 0))`, verifica/grava o recibo idempotente, executa o update com
`WHERE version = expected_version`, persiste eventos e confirma. O lock por carreira impede dois advances
simultâneos; o compare-and-swap protege também contra escritores que não compartilhem a fila. Falha em qualquer
passo causa rollback integral. Locks de sessão foram rejeitados porque podem sobreviver ao escopo lógico quando
uma conexão retorna ao pool.

RLS é defesa em profundidade: usuários autenticados têm somente leitura das próprias carreiras; a API com papel
de serviço é a única escritora. As políticas usam `(select auth.uid())` e as colunas de tenant/FK são indexadas.

# ADR 0001 — Fronteiras do domínio e do engine

- Status: aceito
- Data: 2026-07-20

## Decisão

`@footebas/domain` contém linguagem, tipos e invariantes sem frameworks. `@footebas/engine` contém apenas regras
puras e determinísticas e pode depender de `domain`. Apps, persistência, relógio real, rede e UI dependem desses
pacotes; a direção inversa é proibida.

O engine recebe todo estado, versão, data e seed explicitamente e devolve dados/eventos serializáveis. Não importa
Next.js, Fastify, Prisma, React, Supabase, BullMQ nem APIs de ambiente.

## Consequências

O motor pode rodar em testes, CLI ou worker com a mesma saída. Efeitos externos serão ports nos pacotes de
aplicação a partir da Fase 2.

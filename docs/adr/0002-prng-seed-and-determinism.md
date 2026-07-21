# ADR 0002 — PRNG, seed e determinismo

- Status: aceito
- Data: 2026-07-20

## Decisão

Toda aleatoriedade esportiva usa um PRNG explícito, seedado e versionado. A versão inicial é `mulberry32-v1`; uma
seed textual é normalizada por FNV-1a de 32 bits. `Math.random`, relógio real e estado global são proibidos no
engine.

Seeds, versão do engine, versão de regras e versão de conteúdo acompanham snapshots. Mudanças de algoritmo criam
uma nova versão; saves antigos mantêm a versão anterior ou passam por migração explícita.

## Consequências

Entrada canônica + seed + versões idênticas produzem saída canônica idêntica em qualquer ambiente JavaScript
compatível. Golden tests fixam a sequência de cada versão.

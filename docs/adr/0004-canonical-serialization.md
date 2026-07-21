# ADR 0004 — Serialização canônica

- Status: aceito
- Data: 2026-07-20

## Decisão

Snapshots, entradas golden e checksums usam JSON canônico: chaves de objetos em ordem lexicográfica, ordem de
arrays preservada, valores `undefined` omitidos em objetos e rejeitados em arrays, e apenas números finitos.

## Consequências

Comparação e hashing não dependem da ordem de inserção das propriedades. Tipos ainda não suportados exigem uma
representação de transporte explícita em vez de coerção silenciosa.

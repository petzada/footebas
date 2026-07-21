# ADR 0003 — Relógio e data do jogo

- Status: aceito
- Data: 2026-07-20

## Decisão

Datas de gameplay usam `GameDate`, um value object civil no formato ISO `YYYY-MM-DD`, sem hora ou fuso. O engine
recebe a data atual explicitamente. Instantes operacionais (logs, expiração externa) ficam fora do domínio e usam
ports de clock.

Operações de calendário convertem apenas por componentes UTC para evitar diferenças de timezone e horário de
verão. Serialização sempre usa o texto ISO canônico.

## Consequências

Simulações não dependem da máquina nem do momento da execução. Regras futuras de calendário podem ser testadas com
datas fixas.

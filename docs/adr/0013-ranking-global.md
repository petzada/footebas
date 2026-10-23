# ADR 0013 — Ranking global de treinadores

- Status: aceito; itens 1 (momento da conquista), 7 (snapshots) e 8 (leitura) substituídos pelo
  [ADR 0017](0017-ranking-em-tempo-real.md) em 2026-10-23. Os demais seguem valendo.
- Data: 2026-10-23

## Contexto

A decisão 10 de `docs/09-telas-e-escopo.md` mantém o ranking global com tela própria (global, ascensão e mensal),
só com conquistas validadas pelo servidor. `docs/04-ranking-e-social.md` define o treinador como entidade ranqueada
e títulos crus como critério; o ADR 0005 define leaderboards como snapshots no Postgres servidos com cache. Não há
prêmio pago (risco jurídico já decidido): o ranking é só reconhecimento.

## Decisão

1. _(Substituído pelo ADR 0017: o título vale quando a competição termina, no commit da rodada; acesso e
   temporada completa seguem no fechamento.)_ **Conquista validada.** Só o servidor cria conquistas, no fechamento da temporada que ele mesmo simulou
   (`rollSeason`). Cada uma é gravada em `footebas.validated_achievements` pela porta `AchievementLedgerPort`
   (`tx.achievements`) **na mesma transação** que grava o save; se o commit falha, nada é gravado. A chave única é
   carreira + tipo + temporada + competição, então reprocessar o mesmo fechamento não duplica pontos.
2. **Pontos (`ranking-v1`; os mesmos em `ranking-v2`, ADR 0017)**, carimbados na linha com a versão de regras em vigor:

   | Conquista do clube gerido   | Pontos        |
   | --------------------------- | ------------- |
   | Título continental          | 180           |
   | Título da Série A / B / C   | 100 / 60 / 40 |
   | Copa nacional               | 70            |
   | Estadual                    | 25            |
   | Acesso                      | 45            |
   | Temporada completa no cargo | 5             |

   Treinador sem clube no fechamento não pontua.

3. **Ascensão.** Mede façanhas de clube pequeno: só títulos e acessos de clubes com reputação até 65 contam, com
   `pontos × (1 + (65 − reputação) ÷ 15)`, reputação limitada a 35 (até 3×). Temporada completa não conta. A
   reputação é a do clube no fechamento (média de força do elenco no catálogo; Série A vai de 63 a 83).
4. **Mensal.** Soma os pontos validados no mês civil (UTC) em que o servidor gravou a conquista, não na data do jogo.
5. **Uma carreira por usuário.** Em cada escopo (no ADR 0017: geral, títulos, melhor temporada, ascensão e mensal) conta só a melhor carreira do usuário (maior total); carreiras não
   se somam. O nome exibido é o nome de treinador da carreira, sem dado pessoal.
6. **Desempate:** mais pontos; depois quem chegou ao total primeiro (conquista mais recente que conta é mais antiga);
   depois o id do usuário, para a ordem ser estável.
7. _(Substituído pelo ADR 0017: totais por usuário e escopo em `footebas.ranking_entries`, gravados na transação da
   conquista; o cron só fecha o mês anterior em `ranking_snapshots`, que vira só o histórico mensal.)_
   **Snapshots.** O Worker tem Cron Trigger a cada 15 minutos (`triggers.crons` em `apps/api/wrangler.jsonc`); o
   handler `scheduled` roda `RankingService.generateSnapshots`: agrega por carreira em SQL, ranqueia com a regra
   pura do domínio (`rankCareerTotals`) e substitui atomicamente `footebas.ranking_snapshots` de global (`all`),
   ascensão (`all`) e do mês corrente; no dia 1 também fecha o mês anterior.
8. _(Substituído pelo ADR 0017: leitura ao vivo por índice, `cache-control: public, max-age=30` e Workers Cache de
   até 30 s; `scope=global` segue aceito como apelido de `general`; `/v1/rankings/me` calcula posição e total de
   participantes na hora.)_ **Leitura.** `GET /v1/rankings?scope=global|rise|monthly&period=YYYY-MM&limit=1..100` é pública, lê só o
   snapshot e responde com `cache-control: public, max-age=300, s-maxage=300`. `GET /v1/rankings/me` exige login e
   devolve a posição do usuário em cada escopo (sem cache).

## Consequências

- Conquistas anteriores a esta versão (carreiras que fecharam temporada antes) não entram no ranking.
- Carreiras excluídas mantêm as conquistas já validadas; como só a melhor carreira conta, isso não acumula pontos.
- O ranking atrasa até 15 minutos em relação ao jogo, mais o cache de 5 minutos (até o ADR 0017; agora até 30 s).
- Mudar qualquer valor exige nova `RANKING_RULES_VERSION` e atualização deste ADR; linhas antigas guardam os pontos
  com que foram validadas.
- O modo ranqueado normalizado (mesma condição inicial, revalidação por replay) continua fora do MVP.

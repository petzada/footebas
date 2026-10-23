# Variância do motor de partidas — antes (match-v3)

Gerado por `pnpm --filter @footebas/sim-lab variance` (`match-variance-report-v1`).

- Motor: `match-v3`
- Narração medida: legacy web adapter templates
- Amostra: 10 carreiras × Série A e Série B do catálogo (turno e returno, 4-4-2 equilibrado como a IA) = 7600 partidas

## Métricas

| Métrica                                                 | Chave                                   | Valor  |
| ------------------------------------------------------- | --------------------------------------- | ------ |
| Gols por partida                                        | `goalsPerMatch`                         | 4.23   |
| Vitórias do mandante                                    | `homeWinRate`                           | 0.452  |
| Empates                                                 | `drawRate`                              | 0.206  |
| Entropia dos placares (bits)                            | `scorelineEntropyBits`                  | 4.865  |
| Placares distintos                                      | `distinctScorelines`                    | 70     |
| Placar mais comum                                       | `mostCommonScoreline`                   | 2-2    |
| % do placar mais comum                                  | `mostCommonScorelineShare`              | 0.08   |
| Partidas de força parecida (diferença < 2)              | `similarStrengthMatches`                | 1980   |
| Entropia dos placares, força parecida                   | `similarScorelineEntropyBits`           | 4.808  |
| % do placar mais comum, força parecida                  | `similarMostCommonScorelineShare`       | 0.085  |
| % dos gols do time feitos pelo artilheiro (temporada)   | `topScorerShareOfTeamGoals`             | 0.249  |
| % dos gols do time feitos pelos 2 artilheiros           | `topTwoScorersShareOfTeamGoals`         | 0.439  |
| Mesmo artilheiro do clube entre carreiras               | `sameTopScorerAcrossCareers`            | 0.645  |
| Gini dos finalizadores (gols por atleta)                | `scorerGini`                            | 0.438  |
| HHI dos finalizadores                                   | `scorerHhi`                             | 0.154  |
| Gini da participação em lances                          | `participationGini`                     | 0.411  |
| HHI da participação em lances                           | `participationHhi`                      | 0.144  |
| Trigramas de eventos distintos / total                  | `eventTrigramDistinctRatio`             | 0.0058 |
| % do trigrama de eventos mais comum                     | `eventTrigramTopShare`                  | 0.0164 |
| Aberturas distintas (4 primeiros lances)                | `distinctOpenings`                      | 916    |
| % da abertura mais comum                                | `openingTopShare`                       | 0.007  |
| Linhas de narração por partida                          | `narrationLinesPerMatch`                | 40.9   |
| Modelos de frase distintos (nomes e números mascarados) | `narrationDistinctTemplates`            | 7      |
| % do modelo de frase mais comum                         | `narrationTemplateTopShare`             | 0.582  |
| Repetição de modelo dentro da mesma partida             | `narrationWithinMatchRepeatRate`        | 0.873  |
| Modelos distintos de gol                                | `goalNarrationTemplates`                | 1      |
| % do modelo de gol mais comum                           | `goalNarrationTopShare`                 | 1      |
| Modelos distintos de finalização                        | `chanceNarrationTemplates`              | 1      |
| % do modelo de finalização mais comum                   | `chanceNarrationTopShare`               | 1      |
| Paradas automáticas no meio do jogo (feed)              | `automaticStopsPerMatchInNarration`     | 5      |
| % dos gols no 1º tempo                                  | `firstHalfGoalShare`                    | 0.559  |
| % dos gols entre 1 e 15 min                             | `goalShareMinutes1to15`                 | 0.196  |
| % dos gols a partir dos 76 min                          | `goalShareMinutes76plus`                | 0.151  |
| % do minuto com mais gols                               | `maxSingleMinuteGoalShare`              | 0.0139 |
| Desvio do xG pré-jogo do mandante, mesmo confronto      | `prematchHomeXgSpreadSamePairing`       | 0      |
| Desvio do xG realizado do mandante, mesmo confronto     | `realizedHomeXgSpreadSamePairing`       | 0.679  |
| Desvio da prob. pré-jogo de vitória, força parecida     | `similarPrematchHomeWinProbabilityStd`  | 0.0207 |
| Média da prob. pré-jogo de vitória, força parecida      | `similarPrematchHomeWinProbabilityMean` | 0.4295 |

## Placares mais comuns

| Placar | %     |
| ------ | ----- |
| 2-2    | 0.08  |
| 2-1    | 0.079 |
| 1-2    | 0.07  |
| 3-2    | 0.064 |
| 1-1    | 0.064 |
| 3-1    | 0.056 |
| 2-3    | 0.052 |
| 1-3    | 0.042 |
| 3-3    | 0.04  |
| 2-0    | 0.034 |
| 4-2    | 0.033 |
| 4-1    | 0.032 |

## Minutos

| Faixa | % dos gols | % dos eventos |
| ----- | ---------- | ------------- |
| 1–15  | 0.196      | 0.146         |
| 16–30 | 0.191      | 0.145         |
| 31–45 | 0.172      | 0.143         |
| 46–60 | 0.152      | 0.142         |
| 61–75 | 0.138      | 0.223         |
| 76–90 | 0.12       | 0.16          |
| 91+   | 0.031      | 0.041         |

## Tipos de lance

| Lance      | Quantidade |
| ---------- | ---------- |
| chance:n/a | 180824     |
| goal:n/a   | 32145      |

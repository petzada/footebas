# Variância do motor de partidas — depois (match-v4)

Gerado por `pnpm --filter @footebas/sim-lab variance` (`match-variance-report-v1`).

- Motor: `match-v4`
- Narração medida: engine narrateMatch
- Amostra: 10 carreiras × Série A e Série B do catálogo (turno e returno, 4-4-2 equilibrado como a IA) = 7600 partidas

## Métricas

| Métrica                                                 | Chave                                   | Valor  |
| ------------------------------------------------------- | --------------------------------------- | ------ |
| Gols por partida                                        | `goalsPerMatch`                         | 4.259  |
| Vitórias do mandante                                    | `homeWinRate`                           | 0.448  |
| Empates                                                 | `drawRate`                              | 0.219  |
| Entropia dos placares (bits)                            | `scorelineEntropyBits`                  | 5.087  |
| Placares distintos                                      | `distinctScorelines`                    | 81     |
| Placar mais comum                                       | `mostCommonScoreline`                   | 2-2    |
| % do placar mais comum                                  | `mostCommonScorelineShare`              | 0.072  |
| Partidas de força parecida (diferença < 2)              | `similarStrengthMatches`                | 1980   |
| Entropia dos placares, força parecida                   | `similarScorelineEntropyBits`           | 4.962  |
| % do placar mais comum, força parecida                  | `similarMostCommonScorelineShare`       | 0.082  |
| % dos gols do time feitos pelo artilheiro (temporada)   | `topScorerShareOfTeamGoals`             | 0.216  |
| % dos gols do time feitos pelos 2 artilheiros           | `topTwoScorersShareOfTeamGoals`         | 0.39   |
| Mesmo artilheiro do clube entre carreiras               | `sameTopScorerAcrossCareers`            | 0.578  |
| Gini dos finalizadores (gols por atleta)                | `scorerGini`                            | 0.566  |
| HHI dos finalizadores                                   | `scorerHhi`                             | 0.131  |
| Gini da participação em lances                          | `participationGini`                     | 0.512  |
| HHI da participação em lances                           | `participationHhi`                      | 0.114  |
| Trigramas de eventos distintos / total                  | `eventTrigramDistinctRatio`             | 0.047  |
| % do trigrama de eventos mais comum                     | `eventTrigramTopShare`                  | 0.0279 |
| Aberturas distintas (4 primeiros lances)                | `distinctOpenings`                      | 5339   |
| % da abertura mais comum                                | `openingTopShare`                       | 0.002  |
| Linhas de narração por partida                          | `narrationLinesPerMatch`                | 43     |
| Modelos de frase distintos (nomes e números mascarados) | `narrationDistinctTemplates`            | 9810   |
| % do modelo de frase mais comum                         | `narrationTemplateTopShare`             | 0.02   |
| Repetição de modelo dentro da mesma partida             | `narrationWithinMatchRepeatRate`        | 0.004  |
| Modelos distintos de gol                                | `goalNarrationTemplates`                | 8397   |
| % do modelo de gol mais comum                           | `goalNarrationTopShare`                 | 0.001  |
| Modelos distintos de finalização                        | `chanceNarrationTemplates`              | 1344   |
| % do modelo de finalização mais comum                   | `chanceNarrationTopShare`               | 0.006  |
| Paradas automáticas no meio do jogo (feed)              | `automaticStopsPerMatchInNarration`     | 0      |
| % dos gols no 1º tempo                                  | `firstHalfGoalShare`                    | 0.44   |
| % dos gols entre 1 e 15 min                             | `goalShareMinutes1to15`                 | 0.142  |
| % dos gols a partir dos 76 min                          | `goalShareMinutes76plus`                | 0.225  |
| % do minuto com mais gols                               | `maxSingleMinuteGoalShare`              | 0.013  |
| Desvio do xG pré-jogo do mandante, mesmo confronto      | `prematchHomeXgSpreadSamePairing`       | 0.0786 |
| Desvio do xG realizado do mandante, mesmo confronto     | `realizedHomeXgSpreadSamePairing`       | 0.826  |
| Desvio da prob. pré-jogo de vitória, força parecida     | `similarPrematchHomeWinProbabilityStd`  | 0.043  |
| Média da prob. pré-jogo de vitória, força parecida      | `similarPrematchHomeWinProbabilityMean` | 0.431  |

## Placares mais comuns

| Placar | %     |
| ------ | ----- |
| 2-2    | 0.072 |
| 1-1    | 0.072 |
| 2-1    | 0.072 |
| 1-2    | 0.062 |
| 3-2    | 0.05  |
| 3-1    | 0.049 |
| 2-3    | 0.042 |
| 1-0    | 0.04  |
| 3-3    | 0.037 |
| 2-0    | 0.037 |
| 1-3    | 0.036 |
| 0-1    | 0.033 |

## Minutos

| Faixa | % dos gols | % dos eventos |
| ----- | ---------- | ------------- |
| 1–15  | 0.142      | 0.113         |
| 16–30 | 0.146      | 0.128         |
| 31–45 | 0.152      | 0.135         |
| 46–60 | 0.163      | 0.17          |
| 61–75 | 0.173      | 0.225         |
| 76–90 | 0.179      | 0.189         |
| 91+   | 0.046      | 0.04          |

## Tipos de lance

| Lance                  | Quantidade |
| ---------------------- | ---------- |
| chance:build_up        | 57553      |
| chance:cross           | 37645      |
| chance:individual      | 31379      |
| chance:long_shot       | 30617      |
| chance:counter         | 26562      |
| chance:defensive_error | 11444      |
| goal:build_up          | 9985       |
| goal:counter           | 5736       |
| goal:cross             | 5630       |
| goal:individual        | 5525       |
| goal:defensive_error   | 3043       |
| goal:long_shot         | 2450       |

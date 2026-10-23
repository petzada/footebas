# ADR 0007 — Personalidade do treinador

- Status: aceito
- Data: 2026-10-22

## Contexto

A decisão 4 de `docs/09-telas-e-escopo.md` determina que a personalidade escolhida na Nova Carreira **afeta o jogo**:
quatro estilos com efeitos mensuráveis e tom próprio em e-mails e notícias. O motor de partida
(`packages/engine/src/match.ts`) é estável no prefixo e tem goldens, então não pode ler a personalidade.

## Decisão

1. O save (`CareerSnapshot`) guarda sempre `careerName` (1–40 caracteres) e `coach` (`nationality` ISO 3166-1 alfa-2,
   `avatar` de `avatar-01` a `avatar-12`, `personality`). No contrato `CreateCareer` os campos são opcionais; os padrões
   são "Carreira de <managerName>", `BR`, `avatar-01` e `estrategista`. Saves antigos carregam com esses padrões e
   passam a gravá-los no próximo comando.
2. A tabela de efeitos fica em `@footebas/domain` (`COACH_PERSONALITY_EFFECTS`, `coach-personality-v1`): só
   multiplicadores, todos entre 0,90 e 1,10. A aplicação os aplica em regras puras: deltas pós-partida do elenco gerido
   (`coachedMatchDeltas`), avaliação da diretoria/torcida (`applyPersonalityToConfidence`), desenvolvimento no fim da
   temporada (`developmentQualityFor`), negociação (`evaluateRenewal`/`decideClubOffer` com `priceFactor`) e montagem
   da partida (`withMatchPlanStrength`, cópias usadas só naquela partida e nunca gravadas).
3. Deltas inteiros (moral, condição) usam arredondamento determinístico por hash da chave (partida e atleta), para
   que efeitos de 10% sobre valores pequenos não sumam no arredondamento; o valor esperado é exatamente o fator.
4. O "plano de jogo" do Estrategista vem da análise do adversário que já existe na preparação (média dos 16 melhores
   disponíveis): contra-ataque contra mais fortes, equilibrada contra parelhos, ataque total contra mais fracos.
5. O tom dos textos vem de `COACH_VOICE` (português, por personalidade e situação). A home expõe `inbox` com os
   relatórios das últimas partidas nesse tom. `COACH_PERSONALITY_GUIDE` (`@footebas/application`) explica cada estilo
   na UI a partir da mesma tabela.

## Tabela de efeitos

| Estilo        | Efeito                                                                               | Fator |
| ------------- | ------------------------------------------------------------------------------------ | ----- |
| Motivador     | Moral ganha pelo elenco após vitória                                                 | +10%  |
| Motivador     | Moral perdida pelo elenco após derrota                                               | −10%  |
| Motivador     | Confiança da torcida ganha na avaliação da temporada                                 | +10%  |
| Disciplinador | Condição física perdida por partida                                                  | −8%   |
| Disciplinador | Qualidade de desenvolvimento dos atletas do clube com até 21 anos                    | +8%   |
| Disciplinador | Moral perdida após derrota quando a partida anterior também foi derrota (contrapeso) | +10%  |
| Diplomata     | Confiança da diretoria perdida na avaliação da temporada                             | −10%  |
| Diplomata     | Valor pedido em transferências e salário exigido em renovações                       | −5%   |
| Estrategista  | Força efetiva do elenco na partida quando a mentalidade segue o plano                | +3%   |

Efeitos valem só para o clube gerido; os demais clubes seguem as regras neutras.

## Consequências

- O motor de partida e seus goldens não mudam; a personalidade altera apenas entradas e consequências.
- Carreiras com o padrão (`estrategista`) passam a ter o bônus de plano; resultados de carreiras existentes podem
  divergir dos obtidos antes desta versão de regras.
- Mudar um fator exige nova versão de `COACH_PERSONALITY_RULES_VERSION` e atualização desta tabela.

# ADR 0017 — Ranking em tempo real, por títulos e por melhor temporada

- Status: aceito (implementação pendente)
- Data: 2026-10-23
- Substitui os itens 1 (momento da conquista), 7 (snapshots) e 8 (leitura) do ADR 0013; os demais seguem valendo.

## Contexto

Pelo ADR 0013, conquistas só nascem no fechamento da temporada e o ranking vem de snapshots gerados a cada 15
minutos. Na prática o ranking fica vazio até alguém fechar uma temporada, e um treinador que acabou de ganhar o
estadual não aparece. O responsável pediu (2026-10-23):

- terminar um campeonato dentro da carreira, não necessariamente a temporada, já conta;
- rankings por títulos, por temporada e geral, além de global, ascensão e mensal;
- tempo real para quem visita;
- toda conta já entra no ranking, mesmo com 0 em tudo.

## Decisão

1. **Momento da conquista.** O título vale no momento em que a competição termina (o motor grava o `outcome` com o
   campeão em `career-season.ts`), na mesma transação que grava o save. Acesso e temporada completa continuam no
   fechamento da temporada. A chave única (carreira + tipo + temporada + competição) não muda; o fechamento da
   temporada grava de novo, sem duplicar, qualquer título que ainda não tenha sido registrado (carreiras em curso na
   data desta mudança).
2. **Rankings (escopos).** Pontos de cada conquista seguem a tabela do ADR 0013 (`ranking-v1`); a versão das regras
   passa a `ranking-v2` por causa do momento da conquista.

   | Escopo           | Mede                                                          | Desempate                               |
   | ---------------- | ------------------------------------------------------------- | --------------------------------------- |
   | Geral            | soma dos pontos da carreira (era "global")                    | quem chegou ao total primeiro, id       |
   | Títulos          | número de títulos (liga, copa, estadual, continental)         | pontos; quem chegou primeiro; id        |
   | Melhor temporada | maior soma de pontos numa única temporada da carreira         | temporada mais antiga; id               |
   | Ascensão         | regra do ADR 0013 (clubes de reputação até 65, até 3×)        | igual ao ADR 0013                       |
   | Mensal           | pontos validados no mês civil (UTC), regra do ADR 0013        | igual ao ADR 0013                       |

3. **Uma carreira por usuário** (mantido, decisão do responsável): em cada escopo conta a melhor carreira do usuário;
   carreiras não se somam, para que mais saves (licença) não virem vantagem.
4. **Toda conta entra com 0.** Cada usuário ganha uma linha de ranking ao se cadastrar (gatilho em `auth.users`, mais
   backfill dos existentes). Ela conta na posição ("você é o 1.234º de 5.000") e no total de participantes, mas a
   lista pública só mostra quem já criou carreira (decisão do responsável); o nome exibido continua sendo o nome de
   treinador da carreira, sem dado pessoal.
5. **Tempo real.** Os totais por usuário e escopo ficam numa tabela atualizada na mesma transação da conquista (sem
   cron agregando a tabela inteira). A leitura pública ordena por índice e passa pelo Workers Cache por no máximo 30
   segundos; a posição do usuário (`/v1/rankings/me`) é calculada na hora. O cron de 15 minutos deixa de gerar
   snapshots (segue para a reconciliação de pagamentos) e só fecha o mês anterior no dia 1, para o histórico mensal.

## Consequências

- O ranking deixa de ficar vazio: todas as contas aparecem com 0 na contagem, e o primeiro título já muda a lista.
- Mais escritas por conquista (totais por escopo), em troca de leituras baratas e sem varredura a cada 15 minutos.
- A tela de Ranking ganha os escopos Títulos e Melhor temporada; com cinco abas, o mobile precisa de abas roláveis
  ou de um seletor.
- Migration aditiva: tabela de totais, gatilho de cadastro e backfill; `ranking_snapshots` fica só para o histórico
  mensal.
- Pontos e chave única não mudam: conquistas já validadas continuam valendo.

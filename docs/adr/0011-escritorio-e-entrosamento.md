# ADR 0011 — Escritório (patrocínio e sócio-torcedor) e entrosamento

- Status: aceito
- Data: 2026-10-23

## Contexto

A decisão 8 de `docs/09-telas-e-escopo.md` pede patrocínio negociável (3 propostas por temporada) e sócio-torcedor
(preço e benefícios, receita mensal, efeito em público e torcida); a decisão 16 e o item 6 do ADR 0010 pedem
entrosamento nas regras do mundo, como bônus pequeno de força efetiva antes do motor. Antes, todo clube recebia
patrocínio fixo de 85% da folha (`career-world-rules`). Todos os números abaixo são **parâmetros do jogo**, derivados
da reputação e da divisão do catálogo; nenhum vem de dado real de clube ou empresa.

## Decisão

1. **Estado** (`@footebas/application` `career-office`, `career-office-v1`): `world.office` opcional com propostas,
   contratos, chaves de geração, sócio-torcedor por clube e entrosamento. Saves antigos carregam sem ele (leituras usam
   um estado vazio e os padrões do clube); ele é criado na primeira escrita que precisa dele.
2. **Livro-caixa**: novas contas `income:membership`, `expense:membership` e `expense:sponsor` e fontes `membership` e
   `sponsor_termination` (`@footebas/domain` `economy`). Todo lançamento continua com duas pernas que somam zero.
3. **Patrocínio negociável**
   - No primeiro dia de cada temporada do clube gerido (e ao assumir um clube) chegam 3 propostas, cada uma de uma
     empresa fictícia sorteada de `SPONSOR_NAMES` por `hash(seed|office|name|clube|ano|nome)`.
   - Referência mensal (R$) = 5.200 × max(5, reputação − 40)² × divisão (A 1; B 0,95; C 0,9) × fase (0,9 + pontos por
     jogo dos últimos 5 jogos ÷ 15; sem jogos, 1,0).
   - Perfis: **segura** (1,00 × ref., 24 meses, bônus 1×, multa 6 meses), **curta** (0,92 × ref., 12 meses, bônus
     2×/2×/1,5×, multa 3 meses), **por metas** (0,80 × ref., 36 meses, bônus 4×/4×/3×, multa 9 meses). Bônus em
     múltiplos da mensalidade para título (nacional ou continental; estadual não conta), acesso (zero na Série A) e vaga
     continental. Variação determinística de ±5%; valores arredondados a R$ 1.000.
   - A proposta vale 45 dias e chega na caixa de entrada (`kind: sponsor_offer`) com `decision`: `accept`/`reject` →
     `DecideSponsorshipOffer`, `counter` → `CounterSponsorshipOffer`.
   - **Contraproposta, uma vez**: mensalidade entre a proposta + 1 e 1,5×. O patrocinador aceita até
     `proposta × (1 + 0,05 + 0,10 × hash(seed|office|counter|id))` (5% a 15%) e assina nesse valor; acima disso
     desiste (`withdrawn`).
   - Assinar encerra as outras propostas da temporada (`superseded`) e, se já houver contrato ativo, o rescinde pagando a
     multa (`sponsor_termination`). O contrato paga do mês aberto até o fim da duração.
   - **Mensalmente**: clube com contrato recebe a mensalidade; o clube gerido sem contrato recebe patrocínio avulso de
     50% da regra neutra; os demais clubes seguem a regra neutra (85% da folha).
   - **Fim de temporada**: contratos não rescindidos que cobrem dezembro recebem os bônus das metas atingidas, uma vez
     por meta e temporada, como receita de patrocínio.
4. **Sócio-torcedor** (só o clube gerido liquida)
   - Preço mensal de R$ 5 a R$ 200; níveis (custo por sócio/mês, apelo, percepção): básico (R$ 2; 0,85; 0,75),
     intermediário (R$ 6; 1,00; 1,00), premium (R$ 14; 1,15; 1,25).
   - Preço de referência = R$ 10 + R$ 0,40 × reputação. Base de sócios = 150 × max(1, reputação − 35)^1,5 × divisão
     (A 1; B 0,6; C 0,35).
   - Sócios = ⌊base × clamp(1,6 − 0,6 × preço ÷ referência; 0,05; 1,3) × apelo × (0,6 + 0,8 × torcida ÷ 100) ×
     (0,85 + 0,1 × pontos por jogo)⌋. Preço maior nunca aumenta sócios.
   - Padrão do clube: preço = referência × (A 1; B 0,85; C 0,7); nível intermediário na Série A, básico nas demais.
   - Receita mensal = sócios × preço; custo mensal = sócios × custo do nível; ambos no fechamento do mês.
   - Público: +min(5% da capacidade, 10% dos sócios) por jogo em casa, até a lotação.
   - Torcida: no veredito da temporada, +round(5 × (percepção − preço ÷ referência)), limitado a ±3 pontos.
5. **Entrosamento** (`career-chemistry`): 0–100 por clube gerido, começa em 50. Após cada partida do clube gerido,
   comparando os titulares da escalação com os da partida anterior: +5 com até 1 troca e −3 por troca além dela
   (2 trocas: +2; 3: −1; 11: −25). A primeira partida só registra o time. O bônus é `1 + 0,03 × entrosamento ÷ 100`
   (0% a +3%), multiplicado ao do Estrategista e aplicado pela aplicação em cópias dos atletas usadas só na partida,
   arredondando a força para inteiro (1–100). Vale na prévia e no resultado gravado (mesmo caminho). O motor
   (`packages/engine/src/match.ts`) não muda.
6. **Leituras e comandos**: `FootebasApplication.careerOffice` (`careerOfficeReadModelSchema`): propostas
   (patrocínio, empregos, propostas por atletas aguardando o treinador), contrato vigente e histórico, sócio-torcedor
   (preço, nível, sócios, receita, custo, efeitos), finanças do último mês fechado e da temporada por categoria a partir
   do livro-caixa, contratos do elenco e carreira do treinador. Home e elenco expõem `chemistry`. Comandos no envelope
   de carreira (`POST /v1/commands`): `DecideSponsorshipOffer`, `CounterSponsorshipOffer`, `ConfigureFanMembership`.

## Consequências

- Quem serve HTTP liga `GET /v1/careers/:id/office` a `careerOffice` e inclui os três comandos novos na lista de tipos
  do `POST /v1/commands`.
- Carreiras existentes passam a ter entrosamento e sócio-torcedor; resultados e finanças podem divergir dos obtidos
  antes desta versão de regras. O clube gerido que ignora as propostas recebe metade do patrocínio neutro.
- Mudar fórmula, faixa ou limite exige nova `OFFICE_RULES_VERSION` e atualização deste ADR.

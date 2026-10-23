# ADR 0008 — Mercado e janelas de transferência

- Status: aceito
- Data: 2026-10-22

## Contexto

A decisão 7 de `docs/09-telas-e-escopo.md` pede duas janelas por temporada, venda e empréstimo do próprio elenco e uma
IA de mercado (propostas pelos atletas do clube gerido e negociações simples entre clubes). Contratos, propostas,
empréstimos e o livro-caixa balanceado já existiam (`@footebas/domain` `market`/`economy`) e os comandos da Fase 4 já
rodavam sobre o save único (ADR 0006).

## Decisão

1. **Janelas** (`@footebas/domain` `transfer-window`, `transfer-windows-v1`): contadas em dias desde 1º de janeiro, como o
   calendário de competições. Mudar uma data exige nova versão e atualização desta tabela.

   | Janela                  | Dias da temporada | 2026          |
   | ----------------------- | ----------------- | ------------- |
   | Janela de pré-temporada | 0–47              | 01/01 a 17/02 |
   | Janela do meio do ano   | 106–127           | 17/04 a 08/05 |

   A pré-temporada fecha na véspera da 1ª rodada do Brasileirão (dia 48, `competitions-2026.json`); a do meio do ano
   fica entre os turnos, na Copa do Brasil. As duas pontas são inclusivas; `daysRemaining` é 0 no último dia.

2. **Fora da janela** (só no save de carreira; os fixtures da Fase 4 sem `market` seguem as regras antigas): compra,
   venda e empréstimo entre clubes (`SubmitTransferOffer` com vendedor, `CounterTransferOffer` e aceitar em
   `DecideTransferOffer`) falham com `TRANSFER_WINDOW_CLOSED` (`nextWindowOpensOn`). Recusar proposta, contratar agente
   livre, renovar e rescindir seguem permitidos. Nenhum elenco passa de 35 atletas (`SQUAD_LIMIT_REACHED`).

3. **Lista de transferências**: `ListPlayerForTransfer` (venda com `askingPrice`, ou empréstimo com `durationMonths`
   1–12 e `wageSharePercentage`) e `WithdrawTransferListing`, ambos no envelope da Fase 4
   (`POST /v1/phase-four/commands`). A lista vive em `world.market.listings`; saves antigos carregam com lista vazia.

4. **IA vendedora** (`decideSellerResponse`, `market-ai-v1`): o preço pedido é o valor do atleta × idade (≤ 23: 1,15;
   31–33: 0,9; ≥ 34: 0,75) × contrato (≤ 6 meses: 0,7; ≤ 12: 0,85; ≥ 36: 1,1) × destaque (força ≥ reputação + 5: 1,1) ×
   titular (entre os 11 mais fortes: 1,25) × carência (posição no mínimo: 1,35) × fator do treinador (Diplomata 0,95,
   ADR 0007). Oferta ≥ preço: aceita; ≥ 75%: contraproposta no preço; abaixo: recusa. Clube com 22 atletas ou menos não
   vende. Empréstimo: recusa titular ou posição carente; aceita com ≥ 50% do salário pago pelo tomador ou taxa ≥ 8% do
   preço; senão contrapropõe essa taxa.

5. **IA compradora** (`runMarketDay`, `@footebas/application` `career-market`), rodada em cada data jogada, antes das
   partidas, com a seed da carreira e a data (`hash(seed|market|…)`):
   - empréstimos vencidos voltam ao dono; propostas pendentes vencidas viram `cancelled`; resolvidas com mais de 120
     dias saem do save (menos as que sustentam um empréstimo ativo);
   - dentro da janela, cada atleta do clube gerido sem proposta aberta recebe interesse com chance diária de 35%
     (listado) ou, nos demais, pela qualidade dentro do elenco: `0,3% + 4,5% × q²` (q de 0 no mais fraco a 1 no mais
     forte), × 1,5 para destaque (força ≥ reputação do clube + 5) — `market-ai-v2`, que substituiu o 10% fixo dos três
     mais fortes e o 2% dos demais (o mesmo atleta recebia proposta logo depois de cada recusa). No máximo 2
     propostas novas por dia, das quais 1 por não listado, e no máximo 2 propostas por não listados esperando o
     treinador ao mesmo tempo. Depois de uma proposta (aceita, recusada ou ignorada) o mesmo atleta só recebe outra
     após 45 dias (10 se listado), e um clube que já tentou por ele não volta a tentar enquanto a proposta antiga
     estiver guardada (120 dias). **Esses números do `market-ai-v2` (curva de interesse, 45/10 dias, 1 por dia, 2
     abertas) foram aprovados como provisórios em 2026-10-23, até uma calibração com o sim-lab sobre algumas
     temporadas.** O comprador é um clube da
     IA com elenco (mais propostas abertas) abaixo de 35, caixa para a taxa e reputação compatível (força entre
     reputação − 15, ou − 25 se listado, e reputação + 12), preferindo quem precisa da posição. Taxa: preço pedido ×
     0,85–1,05 (listado) ou valor × 1,0–1,3 (não listado); salário +10%. Empréstimo listado gera proposta de empréstimo
     com os termos da lista. A proposta vale 7 dias, nunca além do fechamento da janela;
   - a proposta chega na caixa de entrada da home (`kind: transfer_offer`) com `decision { id, offerId, options,
expiresOn }`: `accept`/`reject` → `DecideTransferOffer`, `counter` → `CounterTransferOffer`. A contraproposta do
     clube gerido é respondida na hora: o comprador aceita até 20% acima do próprio lance, limitado a 1,6× o valor (10%
     do valor em empréstimo), ao caixa e ao limite de elenco;
   - **IA ↔ IA**: até 3 negócios por dia; um clube abaixo do mínimo numa posição (GK 2, CB 3, CM 2, ST 2, demais 1)
     compra de um clube com sobra nela (acima de GK 3, CB 4, CM 3, ST 3, demais 2) e mais de 22 atletas o reserva mais
     forte que não seja titular, com força até reputação + 8, pelo preço pedido e até metade do caixa. Cada clube faz um
     negócio por dia; o contrato antigo sai e um novo de dois anos entra.

6. **Dinheiro**: toda taxa é um lançamento de quatro pernas (caixa e despesa do comprador, caixa e receita do vendedor)
   que soma zero; entre clubes o caixa total nunca muda. Em empréstimo o tomador paga sua parte do salário
   (`clubWageBill`) e o dono o resto.

7. **Leitura**: `FootebasApplication.careerMarket` (`careerMarketReadModelSchema`): caixa, folha, tamanho do elenco,
   janela, lista, propostas recebidas e enviadas (com `awaiting` e `decisionId`), empréstimos e busca no catálogo
   (filtros da Fase 4 + `origin` nacional/estrangeiro, `includeOwnSquad`, `limit` até 100).

## Consequências

- Quem servir HTTP liga `GET /v1/careers/:id/market` a `careerMarket` e mapeia `TransferMarketError` (subclasse do
  conflito da Fase 4, 409) para o corpo de `toApiError`.
- A temporada fica um pouco mais viva e um pouco mais pesada: cerca de 70 negócios IA ↔ IA por temporada, todos
  determinísticos; a prévia da partida continua idêntica ao resultado gravado porque usa o mesmo caminho.
- Mudar fatores, chances ou limites exige nova `MARKET_AI_RULES_VERSION` e atualização deste ADR.

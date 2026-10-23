# Footebas — Monetização

> Encoda as decisões #14, #15, #16 do log (`00-visao-e-decisoes.md`).
> MVP com **duas camadas**: grátis funcional + **licença única via Woovi/PIX**.
> **Clube Online/assinatura via Stripe fica pós-MVP**; ranking sempre grátis; sem P2W agressivo.

---

## 1. Por que este modelo

O produto é **online, server-authoritative** → há **custo de infra recorrente** (workers de simulação + estado na
nuvem). Ainda assim, o MVP prioriza uma monetização simples e familiar ao público brasileiro:

- **valor não-recorrente** (jogo, editor completo, universos) → **licença única via Woovi/PIX**;
- saves e serviços recorrentes começam limitados e monitorados;
- **assinatura não entra no MVP**; Clube Online + Stripe serão avaliados depois com dados reais de custo e uso.

O custo de simulação por usuário grátis vira **custo de aquisição**, coberto inicialmente pela conversão para licença.

## 2. Duas camadas no MVP

### Grátis — jogo de verdade, não demo capada
- Loop completo e uma carreira ativa.
- Universo base: 3 divisões + Copa do Brasil + estaduais simplificados + continental.
- Mercado, contratos, base, finanças, estádio.
- Partida: instantânea, narração, **campo 2D**.
- **Ranking global** (elegível — crítico: o grátis precisa ranquear, senão o leaderboard fica vazio).
- **Editor básico.**
- Save em nuvem limitado; histórico essencial.
- Sem anúncios no loop (idealmente nenhum anúncio no lançamento).

### Licença completa — pagamento único
Preço de lançamento: **R$ 29,90** (decisão do responsável em 2026-10-23; antes, faixa a testar R$ 39,90 / 49,90 / 59,90), PIX dinâmico da AbacatePay gerado por usuário, válido por 15 minutos, taxa de R$ 0,54 por transação. Inclui:
- carreiras ilimitadas;
- **editor completo** (clubes, jogadores, atributos, ligas, competições, regras, estádios, import/export);
- competições avançadas; mais universos;
- exportação; histórico completo; temas; desafios extras;
- ausência de anúncios.
- **A escolha de qualquer clube ao iniciar** (o grátis começa de baixo). *Ver §5 — P2W leve.*
- A licença permanece válida para a edição adquirida.

### Pós-MVP — Clube Online via Stripe

Fora do escopo atual. Poderá reunir mais saves, sync/backup, workshop, estatísticas avançadas, histórico público e
atualizações automáticas. Sua implementação depende de validação de custo recorrente, preço e proposta de valor.

## 3. Matriz

| Recurso | Grátis | Licença única |
|---|---:|---:|
| Loop principal | Sim | Sim |
| Uma carreira | Sim | Sim |
| Carreiras ilimitadas | Não | Sim |
| Universo base (3 div + copa + estaduais + continental) | Sim | Sim |
| **Ranking global** | **Sim** | **Sim** |
| Escolher qualquer clube ao iniciar | Não (começa de baixo) | Sim |
| Campo 2D | Sim | Sim |
| Editor básico | Sim | Sim |
| Editor completo | Não | Sim |
| Exportação / histórico completo | Não | Sim |
| Saves em nuvem | Limitado | Limitado |
| Sync / backup / workshop | Não | Parcial quando não exigir serviço recorrente |

## 4. Preço (sensibilidade BR)

- Referência histórica do Brasfoot: ~R$ 12,90 pagamento único; mobile premium ~R$ 6,99.
- A **licença única** (R$39-59) é o principal amortecedor cultural: "comprar a edição" dói menos que "assinar".
- Não há assinatura no MVP; a compra é única e paga via PIX.

## 5. P2W — o que é permitido e o que é proibido

Princípio vigente (decisão #16):

> **Sem pay-to-win agressivo.** Dinheiro real **nunca** compra: vitória, força, potencial, recuperação
> instantânea, moeda de clube, resultados, jovens superiores, ou vantagem em rankings verificados futuros.
>
> **Exceção aceita conscientemente:** a **licença** permite **escolher qualquer clube** ao iniciar (o grátis
> começa de baixo), o que gera vantagem *leve* no ranking de prestígio. Mitigada pelo leaderboard
> **Ascensão/Underdog** (ver `04-ranking-e-social.md`).

**Anti-padrões proibidos:** energia/espera para avançar rodada, loot boxes, timers monetizáveis de construção,
acelerar temporada pagando, vender resultados, trancar o single-player atrás de assinatura, anúncios no loop.

## 6. Sem prêmios pagos no ranking

Ideia de **premiar os melhores do ranking** foi levantada e **descartada**: competição paga com prêmio é
legalmente sensível no Brasil (concurso/distribuição de prêmios — Lei 5.768/71; e risco de enquadramento como jogo
de azar). Se retomada no futuro, exige **consultoria jurídica especializada antes de construir** e, provavelmente,
o **modo ranqueado normalizado** + **zero P2W** (a escolha de clube paga seria incompatível com prêmio).

## 7. Provedor de pagamento (decisão de produto)

- **Provedor:** **Woovi**, com cobrança via **PIX QR Code**.
- O adapter do MVP cobre licença única: criar cobrança, consultar status, expiração, confirmação idempotente e
  reembolso. Não cobre recorrência, renovação ou cancelamento de assinatura.
- No `/goal`: implementar apenas o **contrato + adapter fake** (sem Docker, sem chamar API remota, sem testar
  pagamento). Ativação com chaves reais e conexão Supabase/outros serviços ficam no `FINALIZATION-CHECKLIST.md`.
- **Stripe + Clube Online:** pós-MVP; não implementar nem listar como pendência do `/goal` atual.

## 8. Alinhamento custo × receita

| Item | Custo | Coberto por |
|------|-------|-------------|
| Workers de simulação | recorrente (baixo por partida) | licença + limites de uso + otimização; reavaliar pós-MVP |
| Estado na nuvem | recorrente, cresce com temporadas | limites de save + compactação; reavaliar Clube Online pós-MVP |
| Storage de assets | baixo | assets locais no MVP de dev; UGC local; R2 ao escalar |
| Editor completo / universos | não-recorrente | **licença única** |
| Crescimento | escala horizontal (Railway) | conversão grátis → licença; assinatura só após validação pós-MVP |

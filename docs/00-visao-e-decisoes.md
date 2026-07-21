# Footebas — Visão e Log de Decisões

> Documento-mãe da suite. Fixa o **posicionamento** e registra **todas as decisões**, com justificativa e riscos
> aceitos. Atualizado após a sessão de grilling que **reconciliou a suite `/docs` com o `../footebas-mvp.md`**
> (resposta de outro agente), resolvendo 10 conflitos. A **fonte de verdade do MVP** é `08-mvp-fonte-de-verdade.md`.
> Contexto histórico: `../brasfoot-consolidado.md` e `../footebas-briefing.md`.

---

## 1. O que é o Footebas

**Footebas** é um **manager de futebol web, mobile-first, online**, herdeiro espiritual do Brasfoot —
"o Brasfoot da nova geração".

Ocupa o **meio-termo** entre o manager simplório demais (pouca autonomia) e o complexo demais (horas, centenas de
atributos, telas).

> Um manager de futebol online, rápido e acessível **no celular**, com sessões curtas, no qual o jogador sustenta
> carreiras de dezenas de temporadas, compete por um **ranking global de treinador** e vive a fantasia de levar um
> clube pequeno ao topo — com acabamento visual moderno.

## 2. Pilares (a alma que não se trai)

1. **Rodada em ~2 minutos** — velocidade acima de fidelidade audiovisual.
2. **Sessões curtas**, carreiras de **dezenas de temporadas**.
3. **Decisões simples, mas relevantes** — profundidade pela interação, não pela quantidade de telas.
4. **Fantasia de ascensão** — clube pequeno → topo nacional e continental.
5. **Identidade brasileira** — pirâmide nacional, estaduais, Copa do Brasil, continental estilo Libertadores.
6. **Universo editável** — base oficial com elencos reais + editor + packs da comunidade.
7. **Ranking global de treinador** — camada competitiva-social que moderniza o legado.
8. **Visualmente moderno** e **mobile-first** — sem trair a rodada instantânea.

## 3. Público e marca

- **Público:** saudosistas do Brasfoot (boca a boca inicial) + nova geração mobile.
- **Marca:** **nostálgico-modernizado** (verde-gramado, retro-futebol, acabamento 2024). Ver `07-marca-e-design.md`.
- **Nome fixo:** *Footebas*.

---

## 4. Log de decisões (consolidado e atualizado)

"Risco aceito" registra o que foi conscientemente abraçado. As linhas marcadas com ⟳ foram **atualizadas** na
reconciliação com o `footebas-mvp.md`.

| # | Tema | Decisão | Justificativa | Risco aceito |
|---|------|---------|---------------|--------------|
| 1 | Ambição | Indie comercial enxuto agora, mirando produto de mercado; **infra pronta para escalar sem rewrite** | Nome próprio + monetização + "nova geração" | Disciplina para não inflar custo cedo |
| 2 | Modelo | **Online obrigatório**, com infra | Viabiliza receita recorrente e ranking | Perde offline-first; depende de rede |
| 3 | Multiplayer | Fora do MVP; proposta social = ranking global | Foco e menor superfície | — |
| 4 | Simulação | **Server-authoritative** (motor no backend) | Ranking global confiável desde o MVP | Custo de infra recorrente |
| 5 | Universo | Isolado por jogador, hospedado/simulado no servidor | Sem multiplayer, sem mundo compartilhado | — |
| 6 ⟳ | Stack | **Híbrida:** monorepo + engine TS puro + **Fastify API + workers BullMQ/Redis** + Next.js + Prisma + **Supabase** + Railway. **Versões: última major estável, fixada, com cadência** (Node LTS mais recente; sem bleeding-edge) | Separar sim em lote do event loop evita rewrite; ops familiar/enxuta; moderno sem instabilidade | Mais peças que "React+Node" |
| 7 | Latência | Simulação **em lote** + UI otimista; nunca tick-a-tick | Protege "rodada instantânea" | Design de granularidade de avanço |
| 8 ⟳ | Plataforma | **Mobile-first** primário; desktop como enhancement multi-painel | Premissa original do produto | UI densa em mobile exige design forte |
| 9 ⟳ | Competições MVP | **3 divisões (A/B/C) + Copa do Brasil + continental + estaduais simplificados** | BR identidade + ascensão; estaduais são o diferencial cultural | Calendário mais complexo (1 vetor de risco) |
| 10 | Ranking | Prestígio por **títulos crus**, **grátis e central**; leaderboards segmentados | Simplicidade + hook aberto | Premia grind; mitigado por leaderboard underdog |
| 11 ⟳ | Conteúdo/IP | Base oficial com **elencos reais** de `dados/elencos/`; atributos de jogo `derived` via cola de força; editor/packs para customização | Reconhecimento imediato + fantasia BR real; pipeline com proveniência | Gate jurídico/comercial antes do lançamento público |
| 12 | Partida MVP | Feed moderno **+ 2D leve esquemático**; **3D Three.js = fast-follow** | Mobile-first torna 3D caro/arriscado agora | 2D é menos "uau" que 3D |
| 13 ⟳ | Atributos MVP | Visível: **força + 2 características**; **todos os ocultos no MVP** (potencial, consistência, lesão, adaptação, profissionalismo, decisivo); 7 habilidades = fast-follow | UI enxuta + profundidade sistêmica (base/mercado/evolução) | Balanceamento de ocultos |
| 14 ⟳ | Monetização | MVP com **grátis + licença única via Woovi/PIX**; **sem assinatura**; Clube Online + Stripe ficam pós-MVP; **ranking grátis**; **sem prêmios** | Reduz dependências e valida primeiro a compra única BR-friendly | Custos recorrentes ficam cobertos inicialmente por licença/conversão; assinatura é decisão posterior |
| 15 ⟳ | Editor | **Básico grátis / completo pago** (via licença) | Alinha com a estrutura de monetização | — |
| 16 | P2W | **Sem P2W agressivo**; exceção: pago **escolhe qualquer clube** (grátis começa de baixo) | Fidelidade histórica + desejo imediato | **P2W leve** no ranking, aceito |
| 17 | Fases | **MVP completo direto**; marcos **internos** de engenharia | Impacto inicial maior | Aposta cara antes da 1ª validação |
| 18 | Marca | Nostálgico-modernizado | "Brasfoot da nova geração" | Pode soar "só para quem jogou" |

## 5. Bandeiras registradas (ação externa)

- **Prêmios pagos no ranking:** ideia levantada e **descartada** por risco jurídico (concurso/prêmio pago é
  legalmente sensível no Brasil — Lei 5.768/71, e flerte com jogo de azar). Se um dia for retomada, exige
  **consultoria jurídica especializada antes de construir** e, provavelmente, o **modo ranqueado normalizado** +
  zero P2W.
- **IP de nomes:** base oficial embute elencos reais por decisão de produto; revisão jurídica/comercial continua
  obrigatória antes do lançamento público.

## 6. Como navegar a suite

| Documento | Cobre |
|-----------|-------|
| `08-mvp-fonte-de-verdade.md` | **Fonte de verdade do MVP** (escopo, gameplay, stack, monetização, DoD) |
| `01-arquitetura-e-stack.md` | Arquitetura online autoritativa, **stack híbrida**, guard-rails, dados |
| `02-funcionalidades-e-gameplay.md` | Loop, inventário, **atributos (visível + ocultos)**, editor |
| `03-competicoes-e-ligas.md` | Esqueleto MVP (**estaduais incluídos**), IP |
| `04-ranking-e-social.md` | Prestígio, leaderboards, ranqueado futuro, integridade |
| `05-monetizacao.md` | **Grátis + licença única Woovi/PIX**, assinatura pós-MVP, anti-padrões |
| `06-roadmap-e-fases.md` | MVP / fast-follow / depois + marcos internos |
| `07-marca-e-design.md` | Identidade e **UX mobile-first** |

---
title: "Footebas — Fonte de Verdade do MVP"
status: "Normativo"
version: "2.0.0"
updated_at: "2026-07-20"
platform: "Web (PWA mobile-first)"
language: "pt-BR"
---

# Footebas — Fonte de Verdade do MVP

> Documento **normativo** do MVP. Funde o melhor da suite `/docs` (desta janela de grilling) com o
> `../footebas-mvp.md` (resposta de outro agente), após uma sessão de grilling que resolveu **10 conflitos**
> entre os dois. Em caso de divergência sobre o MVP, **este documento prevalece**; o log de decisões canônico
> vive em `00-visao-e-decisoes.md`. Contexto histórico do Brasfoot: `../brasfoot-consolidado.md`.

---

## 1. Decisão executiva

**Footebas** é um **manager de futebol para navegador, mobile-first, online**, herdeiro espiritual do Brasfoot —
"o Brasfoot da nova geração".

O produto é:
- **web, PWA mobile-first** (celular é a plataforma primária; desktop é enhancement multi-painel);
- **sem app nativo**;
- **online obrigatório**, com **simulação server-authoritative**;
- jogável em **sessões curtas**, sustentando **carreiras de dezenas de temporadas**;
- simples de aprender, profundo por **interação entre sistemas**;
- **visualmente moderno** (feed + 2D leve no MVP; 3D é fast-follow);
- de **identidade brasileira** (competições e elencos reais brasileiros como base oficial do MVP);
- **gratuito para experimentar**, monetizado **sem pay-to-win agressivo**.

## 2. Posicionamento

Ocupa o **meio-termo** entre o manager simplório demais (pouca autonomia) e o complexo demais (horas, centenas de
atributos e telas).

> **A profundidade de uma grande carreira sem a burocracia de um simulador excessivamente complexo.**

Frase de produto:

> Construa um clube pequeno, avance temporadas rapidamente no celular e transforme cada carreira em uma história
> única — e dispute o ranking global de treinador.

## 3. Pilares (a alma que não se trai)

1. Rodada em **menos de ~2 minutos**; primeira partida em até 5 minutos após o cadastro.
2. Uma temporada em uma ou poucas sessões; carreiras de **dezenas de temporadas**.
3. **Decisões simples, mas relevantes** — profundidade pela interação, não pela quantidade de telas.
4. **Fantasia de ascensão** — clube pequeno → topo nacional e continental.
5. **Identidade brasileira** — pirâmide nacional, estaduais, Copa do Brasil, continental estilo Libertadores.
6. **Ranking global de treinador** — a camada competitiva-social que moderniza o legado.
7. **Universo editável** — base oficial com elencos reais + editor + packs da comunidade.
8. **Respeito ao tempo** — sem energia, sem espera artificial, sem anúncios no loop.

## 4. Escopo do MVP

### 4.1 Dentro do MVP
- **Plataforma:** web responsiva, **mobile-first**, PWA; cloud save; billing; observabilidade básica.
- **Competições (BR real):** 3 divisões nacionais (Séries A/B/C) com acesso/rebaixamento; Copa do Brasil;
  **estaduais simplificados** (turno único, estados do conteúdo); **uma continental** (Libertadores + pré).
  Clubes e jogadores oficiais vêm de `dados/elencos/` (≥60 clubes jogáveis nas três divisões).
- **Carreira:** criar treinador, escolher clube, objetivos da diretoria, demissão/propostas/troca de clube.
  O save pertence à **carreira do treinador**, não só ao clube.
- **Elenco:** força única (1-100) + 2 características visíveis + **conjunto completo de atributos ocultos**
  (potencial, consistência, propensão a lesão, adaptação, profissionalismo, desempenho decisivo) como estimativas.
- **Base:** geração, avaliação estimada, promoção, dispensa, desenvolvimento; renova o universo.
- **Mercado:** buscar, observar, comparar, ofertar, negociar (valor + parcelamento + bônus), listar, vender,
  emprestar, contratos, rescisão; **IA de mercado** com proteções econômicas.
- **Tática compacta:** formação, mentalidade, construção, foco, pressão, linha, marcação; escalação drag-and-drop
  com automações; substituições e ajustes na partida.
- **Partida:** motor autoritativo determinístico por seed; **resultado instantâneo + narração + feed moderno +
  campo 2D leve esquemático**; pular para o resultado a um toque.
- **Finanças/estádio:** caixa, folha, ingressos, patrocínio, premiações; estádio com capacidade/ampliação.
- **Diretoria/torcida:** confiança com consequências (pressão, demissão, prestígio, propostas).
- **Ranking global de treinador (grátis):** prestígio de carreira + leaderboards segmentados (ver §7).
- **Editor básico (grátis)** + **editor completo (pago)**.
- **História/mundo:** rankings, campeões, artilharia, recordes, notícias por template, observar clubes.

### 4.2 Fora do MVP (fast-follow / depois)
- **3D (Three.js)** de partida/estádio/troféus.
- **7 habilidades numéricas visíveis + foco de treino.**
- **Modo ranqueado normalizado** (competição justa por condição igual).
- **Multiplayer** (ligas privadas, mercado entre humanos, draft, co-op) — só no horizonte "Online".
- **Seleções** (Copa do Mundo, eliminatórias) e **continentais europeias/Mundial**.
- **Workshop hospedado** de packs (com moderação/takedown).
- Academia sub-21 formal; prêmios (time do ano, Bola de Ouro); desafios avançados.

### 4.3 Não-objetivos (deliberados)
Sem: comissão técnica completa, scouting profissional, treinamento diário micro, imprensa/entrevistas, agentes
com negociações longas, física realista, futebol feminino no MVP, licenças oficiais, microtransações de poder.

## 5. Loop de gameplay

```text
Abrir → ler caixa de entrada/alertas → analisar adversário → ajustar escalação/tática
→ resolver mercado/contratos → disputar ou simular partida → resultado e consequências
→ ver tabela/finanças/evolução → avançar data
```
Cada rodada deve produzir **ao menos uma decisão significativa**. Loop de longo prazo: assumir clube → estabilizar
→ objetivo da temporada → reputação → estrutura/estádio → acesso/título → renovar elenco → competições maiores →
dinastia ou novo projeto.

## 6. Modelo de jogador

- **Visível:** nome, idade, nacionalidade, posição principal/secundárias, lado, **força (1-100)**,
  **2 características**, condição, moral, ritmo, salário, valor, contrato, status no elenco.
- **Oculto (estimado, no MVP):** potencial, consistência, propensão a lesão, adaptação, profissionalismo,
  desempenho decisivo. Nunca exibidos como número exato — apenas estimativas (olho clínico/relatório).
- **Escala de força (referência):** 1-29 base; 30-44 divisão inferior; 45-59 competitivo; 60-74 primeira divisão;
  75-84 destaque nacional; 85-92 elite; 93-100 excepcional. Base inicial não concentra >85.
- **Evolução:** curva de idade × potencial × minutos úteis × qualidade de desenvolvimento × profissionalismo ×
  condição × variação controlada. Não-linear; estagnação possível; declínio progressivo.

## 7. Ranking global de treinador (grátis, central)

- Entidade ranqueada = **treinador** (universo isolado por jogador, hospedado/simulado no servidor).
- **MVP:** **prestígio de carreira por títulos crus** (títulos, copa, continental, acessos, longevidade),
  **server-authoritative** para integridade.
- **Leaderboards segmentados:** Global (all-time) · **Ascensão/Underdog** (façanhas de clube pequeno — arena justa
  para o grátis e mitigação do P2W leve) · Do mês.
- **Sem prêmios pagos.** (Qualquer premiação futura exige **consultoria jurídica** — concurso/prêmio pago é
  legalmente sensível no Brasil.)
- **Fast-follow:** **modo ranqueado normalizado** (mesma condição inicial, janelas, validação por seed).

## 8. Monetização

Estrutura do MVP com **duas camadas**, **ranking sempre grátis**:

| Camada | Natureza | Conteúdo |
|--------|----------|----------|
| **Grátis** | — | Loop completo, universo base, 3 divisões + copa + estaduais + continental, mercado, base, finanças, estádio, partida (instantânea/narração/2D), **ranking global**, **editor básico**, save em nuvem limitado |
| **Licença completa** | **Pagamento único via Woovi/PIX** (R$39-59, a testar) | Carreiras ilimitadas, **editor completo**, competições avançadas, mais universos, exportação, histórico completo, temas, sem anúncios |

**Princípios:**
- **MVP sem assinatura:** valor do jogo/editor é cobrado uma vez via Woovi/PIX. Serviços recorrentes permanecem
  limitados no lançamento; Clube Online e Stripe serão avaliados pós-MVP.
- **Sem P2W agressivo:** dinheiro real nunca compra força, potencial, resultado, recuperação, moeda de clube,
  jovens superiores. **Exceção aceita conscientemente:** o pago (licença) pode **escolher qualquer clube** ao
  iniciar (o grátis começa de baixo), gerando vantagem *leve* no ranking de prestígio — mitigada pelo leaderboard
  Ascensão/Underdog.
- Sem energia, loot boxes, timers monetizáveis, anúncios no loop.

## 9. Competições (motor data-driven)

Regras são **configuração**, não código por competição. Componentes: `LeagueStage`, `GroupStage`,
`KnockoutStage`, `QualificationRule`, `PromotionRule`, `RelegationRule`, `RankingRule`, `TieBreakerRule`.
Classificação: pontos → vitórias → saldo → gols → confronto direto (quando configurado) → sorteio determinístico.
Calendário resolve competições simultâneas (nacional + estadual + copa + continental), ida/volta, conflitos, fim
de temporada e geração da seguinte. **Todo calendário é validado antes de iniciar a temporada.**

## 10. Motor de partida

- **Independente da interface/visualização.** `Entradas → simulação determinística (seed) → eventos/resultado →
  persistência → representação (texto/2D)`.
- Determinismo por **seed + versão do motor**: mesmos dados/seed/decisões ⇒ mesmo resultado (replay, testes,
  auditoria, base para rankings verificados futuros).
- Balanceamento: força importa, tática dá vantagem, mando pesa — **mas zebra existe**. A fórmula real não é exposta.
- Modelo conceitual: `força_efetiva = composição × adequação_posicional × condição × moral × ritmo ×
  coerência_tática × mando × contexto`; chances derivadas de progressão/criatividade/finalização/goleiro/variação.

## 11. Conteúdo e IP

- **Base oficial (decisão de produto vigente):** clubes e jogadores **reais** a partir de `dados/elencos/`,
  normalizados por pipeline (IDs estáveis, dedupe, proveniência, participação por competição).
- **Atributos de jogo** (força, idade, salário, ocultos etc.) que não existem na pesquisa bruta são gerados de
  forma **determinística e versionada** (`derived`), usando a cola de força relativa em
  `dados/elencos/forca-relativa-cola.md`. Nomes, posições e camisas ausentes/`—`/`#?`/`[parcial]` **não** são
  inventados como fato de pesquisa.
- **Editor + packs (UGC):** continuam permitindo conteúdo customizado; não são o único caminho para nomes reais.
- **Workshop hospedado:** fora do MVP; quando existir, com validação/sanitização/versão/denúncia/takedown.
- Revisão jurídica/comercial de marcas, direitos de imagem e bases esportivas permanece **gate de lançamento
  público**, sem impedir desenvolvimento e testes internos locais.

## 12. Arquitetura e stack (híbrida)

Arquitetura do `footebas-mvp.md` (evita rewrite) + operação enxuta e familiar (Supabase + Railway). Detalhe em
`01-arquitetura-e-stack.md`.

- **Monorepo:** pnpm + Turborepo, TypeScript estrito. Pacotes: `engine`, `domain`, `contracts`, `ui`,
  `match-viewer`, etc.
- **Engine:** pacote **TS puro** (não importa Next/Fastify/Prisma/React/Three) — determinismo e testes.
- **Web:** **Next.js** (App Router, React, Tailwind, shadcn/ui como base) — SSR para landing, páginas públicas de
  carreira e share-cards. Mobile-first.
- **API:** **Fastify** (Node LTS mais recente), contratos Zod, REST + SSE para progresso.
- **Workers:** **BullMQ + Redis** + worker_threads — **simulação em lote** e geração de temporada isoladas do event
  loop da API (obrigatório para server-authoritative).
- **Dados:** **Supabase** — Postgres (+ **Prisma**), Auth (Google/magic link), Storage. RLS como defesa extra;
  **cliente nunca escreve estado de jogo direto no banco**.
- **Deploy:** Railway (web/API/workers/Redis/Postgres). Cloudflare (DNS/CDN/WAF) e **R2** + observabilidade
  completa (Sentry/OTel/PostHog) entram **quando a escala pedir — sem rewrite**, pois a forma já está certa.
- **Política de versões:** última major **estável** de cada tecnologia no início (Node na **LTS mais recente**),
  versões **fixadas** (lockfile/pins), **sem bleeding-edge**; ao implementar, **resolver a estável vigente** de
  cada dependência (não assumir número do doc); upgrades em cadência periódica + patches de segurança imediatos.

## 13. Persistência e integridade

- Save = **snapshot + eventos relevantes + seed + versão do engine/regras/conteúdo/schema + checksum**
  (não event-sourcing puro). Estado **canônico no servidor**.
- Idempotência em comandos críticos (avanço, simulação, transferência, billing); **lock por carreira**
  (não avançar duas vezes em paralelo); versão otimista.
- Anticheat: single-player foca em integridade; rankings verificados (futuros) exigem simulação no servidor,
  seed registrada, versão fixada, comandos auditáveis.

## 14. Arquitetura do motor (CQRS-leve)

```text
Command → Validation → Load Snapshot → Execute Domain Logic → Generate Domain Events
→ Persist Transaction → Create Async Jobs → Project Read Models → Return Response
```
Comandos: `CreateCareer`, `SelectClub`, `SetLineup`, `SetTactics`, `AdvanceDate`, `SimulateMatch`,
`SubmitTransferOffer`, `RenewContract`, `PromoteYouth`, `ExpandStadium`.
Eventos: `MatchPlayed`, `GoalScored`, `PlayerInjured`, `TransferCompleted`, `YouthPromoted`, `ClubPromoted`,
`ClubRelegated`, `CompetitionWon`, `ManagerFired` (base das histórias emergentes e notícias).

## 15. Roadmap (V1 completo direto, marcos internos)

O **lançamento público é o MVP completo** (não faseado). O **desenvolvimento interno** vai por marcos:

- **M1 — Núcleo autoritativo:** engine puro + API + workers + Postgres; loop completo; 2 divisões; ranking de
  prestígio; partida em feed. *Valida internamente "só mais uma rodada".*
- **M2 — Profundidade competitiva:** 3ª divisão, Copa do Brasil, **estaduais simplificados**, continental;
  leaderboards segmentados.
- **M3 — Encantamento:** 2D leve; polimento do feed; identidade nostálgico-modernizada.
- **M4 — Conteúdo:** editor básico + completo; pipeline de elencos reais + atributos `derived`; import de packs.
- **M5 — Monetização e lançamento:** licença única Woovi/PIX; onboarding; telemetria; hardening. **→ MVP público.**

**Fast-follow:** Clube Online/assinatura via Stripe; 3D; 7 habilidades + treino; modo ranqueado normalizado;
prêmios/memória; continentais/seleções.
**Depois:** multiplayer assíncrono; workshop hospedado; sync avançado.

## 16. Critérios de "pronto" (Definition of Done)

Uma feature só entra se: produz decisão significativa; é compreensível; não atrasa a temporada sem benefício;
funciona no **mobile** e com teclado no desktop; funciona sem 3D; preserva o save; tem telemetria e testes;
não introduz P2W agressivo; respeita o posicionamento.

## 17. Métricas

- **Ativação:** cadastro, carreira criada, 1ª escalação, 1ª partida, 3ª rodada, 1ª contratação.
- **Engajamento:** rodadas/sessão, temporadas iniciadas/concluídas, uso de instantâneo vs 2D, transferências.
- **Retenção:** D1/D7/D30; saves com +3 e +10 temporadas; sessões que terminam após "mais uma rodada".
- **Negócio:** conversão grátis→licença, receita por usuário, pagamentos PIX confirmados/falhos/reembolsados.
- **Qualidade:** falhas de save, divergências de simulação, tempo de avanço, erros de calendário, abandono no
  onboarding.

## 18. Regra suprema

> **Nenhuma tecnologia, animação ou feature pode destruir a velocidade, a clareza e a autoria que tornam uma
> carreira de futebol viciante — no celular, em sessões curtas.**

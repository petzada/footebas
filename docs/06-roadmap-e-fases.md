# Footebas — Roadmap e Fases

> Encoda a decisão #15: **V1 completo direto no lançamento**, com **marcos internos** de engenharia.

---

## 1. Filosofia de faseamento

O **lançamento público** é o V1 completo (não fatiado). Mas o **desenvolvimento interno** procede por marcos —
higiene de engenharia para não construir tudo em paralelo e descobrir a integração só no fim.

> Risco assumido (decisão #15): construir V1 completo antes da primeira validação real com usuários é aposta cara.
> Mitigação: os marcos internos abaixo permitem testes internos/alpha a cada corte.

## 2. Marcos internos de engenharia (rumo ao V1)

### M1 — Núcleo autoritativo jogável (o "prove que diverte")
- Backend Node autoritativo + Postgres (Supabase) + Auth.
- Motor de partida determinístico por seed + simulação em lote.
- Loop central: elenco, escalação, tática compacta, mercado, finanças, base, avanço de rodada/temporada.
- Séries A/B com acesso/rebaixamento; save na nuvem; força única + 2 características.
- Partida em **feed moderno** (sem 2D ainda).
- **Ranking de prestígio** funcionando (títulos crus).
- *Meta:* validar internamente "só mais uma rodada" e o engajamento do ranking.

### M2 — Profundidade competitiva
- Série C (pirâmide completa), Copa do Brasil, **estaduais simplificados** (turno único, estados grandes), continental (+pré).
- Leaderboards segmentados (global, ascensão/underdog, mês).

### M3 — Encantamento visual
- **Campo 2D leve esquemático** (render-only sobre a timeline; skippable).
- Polimento do feed (momento, xG-lite, notas, stats ao vivo).
- Identidade visual nostálgico-modernizada aplicada (ver `07-marca-e-design.md`).

### M4 — Conteúdo e comunidade
- **Editor básico (grátis) + editor completo (licença)**; import de packs (UGC).
- Pipeline de elencos reais (`dados/elencos/`) + atributos `derived` + cola de força relativa.

### M5 — Monetização e lançamento
- Duas camadas no MVP: grátis + **licença única via Woovi/PIX**; gating de entitlements (editor completo, escolha de clube, carreiras e histórico).
- Billing; onboarding; telemetria; hardening de segurança/integridade.
- **→ Lançamento público do MVP completo.**

## 3. Fast-follow (pós-V1)

Ordem sugerida por valor/esforço:

1. **Campo 3D (Three.js / R3F)** — partida/estádio/troféus, reprodução dos eventos com fallback 2D; forte marketing.
2. **Modo ranqueado normalizado** — competição justa por skill; neutraliza o P2W.
3. **7 habilidades numéricas visíveis + foco de treino** — profundidade opcional sobre a força única.
4. **Estaduais completos** — todos os estados, divisões estaduais, formatos configuráveis (o MVP traz só a versão simplificada).
5. **Prêmios e memória** — time da semana/ano, Bola de Ouro, galeria de troféus, desafios, resumo de temporada, linha do tempo do treinador.
6. **Academia sub-21 formal** — peneiras, potencial, amistosos da base.
7. **Continentais europeias, Mundial, seleções** (Copa do Mundo, eliminatórias, Copa América, Eurocopa, Nations League).

## 4. Depois (horizonte maior)

- **Multiplayer assíncrono**: ligas privadas, rodadas agendadas, mercado entre humanos, draft, co-op administrativo. (Requer projetar anti-cheat/validação por seed — já semeado desde o V1.)
- **Workshop hospedado** de packs, com moderação e takedown.
- **Clube Online/assinatura via Stripe**, sync avançado, versionamento de bases e atualização remota de elencos.

## 5. Métricas para validar o "espírito preservado"

Instrumentar desde o M1:

- Tempo até a 1ª partida; tempo médio por rodada e por temporada.
- Temporadas por save; % que chega à 2ª temporada; saves com +10 temporadas.
- % que conquista acesso; mudanças de clube por carreira.
- Uso do editor; packs importados.
- Sessões que terminam após "mais uma rodada".
- Retenção D7 / D30 / D90.
- Conversão grátis → licença única; confirmação/falha/reembolso PIX.

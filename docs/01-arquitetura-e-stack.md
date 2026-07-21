# Footebas — Arquitetura e Stack

> Encoda as decisões #2, #4, #5, #6, #7, #8 do log (`00-visao-e-decisoes.md`).
> Produto **online, server-authoritative**, **mobile-first**. Stack **híbrida**: arquitetura robusta do
> `../footebas-mvp.md` (evita rewrite) + operação enxuta e familiar (Supabase + Railway).

---

## 1. Princípios arquiteturais

1. **Online obrigatório.** Não há modo offline. Conta e conexão são requisitos.
2. **Server-authoritative.** O motor roda no backend; o **estado canônico da carreira mora no servidor**.
3. **Universo isolado por jogador.** Cada carreira é um universo próprio, hospedado e simulado no servidor.
4. **Enxuto hoje, escalável sem rewrite.** A *forma* da arquitetura já é a definitiva; a *operação* começa mínima.
5. **Guard-rail de integridade:** o **cliente nunca escreve estado de jogo direto no banco**. Toda mutação passa
   pela API/engine autoritativa, que valida e simula.
6. **Simulação isolada do event loop.** Avançar temporada = simular milhares de partidas; isso roda em
   **workers/fila**, nunca no processo da API (senão trava todo mundo).

## 2. Stack (híbrida)

| Camada | Tecnologia | Papel |
|--------|-----------|-------|
| Monorepo | **pnpm + Turborepo**, TypeScript estrito | Pacotes compartilhados (engine, domain, contracts, ui) |
| Web | **Next.js** (App Router, React, Tailwind, shadcn/ui como base) — PWA **mobile-first** | UI, SSR para landing/páginas públicas de carreira/share-cards, BFF leve |
| API | **Fastify** (Node LTS mais recente), contratos **Zod**, REST + **SSE** | Comandos/consultas, autorização, validação, orquestração, criação de jobs |
| Workers | **BullMQ + Redis** + worker_threads | **Simulação em lote**, geração de temporada, validação, exportação — isolados da API |
| Engine | **Pacote TS puro** | Regras, determinismo, simulação, competições, calendário, progressão, mercado, finanças |
| Dados | **Supabase — Postgres** (+ **Prisma**) | Estado canônico das carreiras, ranking, contas |
| Identidade | **Supabase Auth** (Google, magic link) | Login; API valida o JWT |
| Assets | **Supabase Storage** (→ Cloudflare R2 quando escalar) | Escudos, uniformes, packs, share-cards |
| Deploy | **Railway** (web/API/workers/Redis/Postgres) | Ambientes separados; preview por PR quando viável |
| Escala | Cloudflare (DNS/CDN/WAF/**R2**) + Sentry/OTel/PostHog | Entram **quando a escala pedir — sem rewrite** |

**Limites entre apps (do `footebas-mvp.md`):**
- **Next.js:** interface, sessão, SSR, landing, billing UI, chamadas à API. **Não** faz simulação pesada.
- **API (Fastify):** comandos, consultas, autorização, persistência, orquestração, jobs.
- **Worker:** tarefas CPU-intensive (simulação, geração, validação).
- **Engine:** regras puras — **não importa** Next/Fastify/Prisma/React/Three.

**Padrão de dados:** o cliente autentica no Supabase Auth; a API valida o token. O Postgres é o armazém **atrás**
do motor. Cliente **não** grava estado de jogo. RLS como defesa em profundidade.

### Política de versões

Todas as tecnologias acima seguem a política **"última estável, fixada, com cadência"**:

- **Última major estável** de cada biblioteca no início do projeto; **Node.js na LTS mais recente**. **Sem
  bleeding-edge** (betas, RCs, Node "Current").
- **Versões fixadas** (lockfile + pins exatos) para builds reprodutíveis.
- **Ao implementar, resolver a versão estável vigente de cada dependência** — não assumir a versão que estava em
  mente quando este documento foi escrito. Consultar o release atual de cada tecnologia no momento de codar.
- **Cadência de upgrade** periódica (ex.: revisão trimestral) e **imediata para patches de segurança**.

## 3. Fluxo de uma rodada (simulação em lote)

Para proteger a "rodada em ~2 min" apesar do round-trip, a simulação é **em lote, nunca tick-a-tick**:

```text
Cliente: "avança até minha próxima decisão"  (ou "simula a temporada")
   │
   ▼
API (Fastify): valida comando, cria job, responde (SSE para progresso)
   │
   ▼
Worker (BullMQ): carrega snapshot do Postgres → simula o bloco no engine puro
   → aplica resultados (standings/finanças/moral/lesões/rankings) → persiste (transação) → projeta read models
   │
   ▼
Cliente: UI otimista + reproduz a timeline (feed + 2D leve), velocidade config, "pular para o resultado" a um toque
```

**Regra de ouro:** a partida nunca bloqueia quem quer simular rápido. O 2D é **reprodução** de uma timeline já
calculada no servidor — não uma segunda simulação no cliente.

## 4. Arquitetura do motor (CQRS-leve)

```text
Command → Validation → Load Snapshot → Execute Domain Logic → Generate Domain Events
→ Persist Transaction → Create Async Jobs → Project Read Models → Return Response
```

Máquina de estados da rodada (no backend):

```text
AWAITING_MANAGEMENT → LINEUP_CONFIRMED → PRE_MATCH → MATCH_RUNNING
   (sub / tática / lesão / cartão / gol)
→ POST_MATCH → APPLY_RESULTS (standings, finanças, fitness, moral, suspensões, rankings, mensagens) → NEXT_DATE
```

## 5. Modelo de dados (conceitual)

Entidade raiz por carreira: `GameSave` (Postgres, dona da verdade). Entidades principais: `User`, `Entitlement`,
`Career`, `Manager`, `Club`, `Stadium`, `Player`, `PlayerDevelopment`, `Contract`, `Lineup`, `Tactic`,
`Competition`, `CompetitionEdition`, `Stage`, `Fixture`, `Match`, `MatchEvent`, `Standing`, `Transfer`,
`TransferOffer`, `FinanceTransaction`, `BoardObjective`, `YouthPlayer`, `Award`, `Record`, `Notification`,
`ContentPack`.

Shape de referência do jogador (o pacote `domain` formaliza; ver `02-funcionalidades-e-gameplay.md`):

```ts
type Player = {
  id: string; name: string; age: number; nationalityId?: string
  position: Position; secondaryPositions?: Position[]; preferredSide?: "left" | "right" | "center"
  strength: number                 // força única 1-100 (visível)
  traits: PlayerTrait[]            // 2 características visíveis (MVP)
  hidden: {                        // estimados, nunca exibidos como número exato (MVP)
    potential: number; consistency: number; injuryProneness: number
    adaptation: number; professionalism: number; bigGame: number
  }
  morale: number; condition: number; matchSharpness: number
  value: number; salary: number; contractEndsAt?: GameDate
  clubId?: string; squadStatus: SquadStatus; injuryRounds: number; suspensionRounds: number
  careerStats: CareerStats
}
```

> **Motor de competições data-driven:** liga, mata-mata, grupos, estadual e continental são **configuração**
> (`LeagueStage`, `GroupStage`, `KnockoutStage`, `PromotionRule`, `RelegationRule`, `RankingRule`, `TieBreakerRule`),
> não código hard-coded por competição.

## 6. Motor de partida (determinístico por seed)

A fórmula do Brasfoot nunca foi pública — é **design nosso**. Modelo conceitual (a calibrar):

```text
força_efetiva = composição × adequação_posicional × condição × moral × ritmo × coerência_tática × mando × contexto
chance_criada  = progressão × criatividade × espaço × erro_adversário × variação(seed)
chance_convertida = qualidade_da_chance × finalização × pressão_defensiva × goleiro × variação(seed)
```

**Determinismo por seed + versão do motor** é requisito desde já: mesmos dados/seed/decisões ⇒ mesmo resultado.
Viabiliza reprodução da timeline no cliente, replay, testes, auditoria e a base para rankings verificados futuros.
Balanceamento: força importa, tática dá vantagem, mando pesa — **mas zebra existe**.

## 7. Persistência, integridade e concorrência

- Save = **snapshot + eventos relevantes + seed + versões (engine/regras/conteúdo/schema) + checksum**
  (não event-sourcing puro). Migrações explícitas; nunca migrar em produção sem backup/teste/rollback.
- **Idempotência** em comandos críticos (avanço, simulação, transferência, billing).
- **Concorrência:** uma carreira não avança duas vezes em paralelo → **lock por carreira** + versão otimista +
  transação (fila por carreira quando necessário).
- Estado por save cresce com temporadas → compactação/arquivamento de históricos antigos.

## 8. Metas de performance (revisar após protótipo)

- Partida individual < 150 ms no worker (sem render); rodada nacional < 2 s; avanço semanal < 3 s;
  geração de temporada < 10 s; load de save < 2 s.
- LCP da área autenticada < 2,5 s; tabelas virtualizadas; filtros locais; busca indexada.

## 9. O que NÃO fazer

- Cliente gravando estado de jogo direto no Supabase (fura o ranking).
- Simulação no processo da API (trava o event loop) ou tick-a-tick com round-trip por tick.
- Engine importando framework (Next/Fastify/Prisma/React/Three).
- 2D como segunda simulação no cliente (deve ser só reprodução da timeline do servidor).
- Dependência que torne o modo single-player travável por indisponibilidade de serviço não essencial.

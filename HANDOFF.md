# Handoff — continuação da entrega final do Footebas

Atualizado em 2026-10-23. Leia junto com `IMPLEMENTATION-STATE.md`, `FINALIZATION-CHECKLIST.md`, `docs/09-telas-e-escopo.md`
(decisões 1–20) e os ADRs 0009–0016. Branch de integração: `mvp/fase-6-9` (PR petzada/footebas#1 → `main`, Auto-fix
ligado). Regras da máquina do `~/.claude/CLAUDE.md` continuam valendo (até 3 subagentes, worktree para quem edita,
vitest com 1 worker, nunca lint e testes juntos, suíte completa só no CI).

## Como continuar (prompt sugerido para a nova sessão)

> Continue a entrega final do Footebas a partir do `HANDOFF.md`. Primeiro integre na `mvp/fase-6-9` as branches dos
> subagentes que terminaram (`retro-elenco`, `retro-nova-carreira`), rode os testes relacionados, publique API e web e
> rode `pnpm smoke:cloud`. Depois siga a lista "Pendências" deste arquivo, na ordem.

## No ar agora

- **Web** `https://footebas.com.br` (Worker `footebas-web`, OpenNext). O bundle é gerado no workflow `deploy-web`
  (Linux) e publicado daqui: `gh run download <id> -n footebas-web-open-next -D apps/web/.open-next` e
  `cd apps/web && npx wrangler deploy` (no Windows o `cf:build` local falha por symlink).
- **API** `https://api.footebas.com.br` (Worker `footebas-api`): Durable Object por carreira (`CAREERS`), save v3
  enxuto (~80 KB comprimido), endpoint `/v1/careers/:id/bundle`, Queues de simulação, cron de ranking a cada 15 min,
  rate limiting, R2 `footebas-avatars` (público em `https://cdn.footebas.com.br`), billing PIX via AbacatePay.
  Deploy: `cd apps/api && npx wrangler deploy`. Migrations: `npx supabase db push` (todas aplicadas até
  `20261026000100_billing_provider_charge.sql`).
- **Fumaça na nuvem**: `API_URL=https://api.footebas.com.br SMOKE_TOKEN=<token> SMOKE_P95_MS=5000 pnpm smoke:cloud`
  (o token de fumaça está no secret `SMOKE_TOKEN` do Worker; gere outro e regrave se perdê-lo). Última execução verde:
  recarregar 0,45 s, comandos 0,2–2,4 s.

## Subagentes que estavam rodando ao escrever este arquivo

| Branch                | O que faz                                                                                                                                                                                                                                                                                                     | Ao integrar                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `retro-elenco`        | Elenco: card do atleta no topo com ações, lista abaixo, campo SVG responsivo com arrastar/teclado, explicação e resumo de "Melhor/Poupar/Desenvolver"                                                                                                                                                         | rodar `components/squad-screen.test.tsx`, conferir 320/375 px                                          |
| `retro-nova-carreira` | Nova Carreira: estouro de largura, Brasil pré-selecionado com lista recolhida, 6 etapas (personalidade vira etapa própria), avatar com upload (`POST /v1/me/avatar`) e foto do Google, resumo sem emblema/sigla, barra fixa de dois botões, folha 3/4 com elenco do clube e upsell da licença com PIX na hora | rodar testes do wizard e do Perfil; atualizar `tools/e2e/tests/helpers.ts` se o agente não tiver feito |

Se uma branch não existir ou estiver incompleta, refaça a fatia com um subagente Fable usando o mesmo escopo.

## Pendências (em ordem)

1. **Segredos da AbacatePay** (humano): ver item 6 do `FINALIZATION-CHECKLIST.md`. A chave está em `.env.local.txt`
   (ignorado pelo git); o comando pronto está lá.
2. **Escudos que faltam**: Vasco, Remo (Série A), Athletic Club (Série B) e Cerro Porteño não estão nas folhas em
   `public/images`. Confirmar com o responsável as deduções São Bernardo (Série B, amarelo/preto) e Itabaiana
   (Série C, "A.F.C."). Recorte: mesmo método de `apps/web/public/crests` (fundo removido, grade de pixels, 12 cores).
3. **Narração ao vivo dos chutes**: o motor v4 registra finalizador, tipo de jogada e resultado, mas o read model
   pós-jogo (`postMatchModel` em `packages/application/src/service.ts` + contrato) descarta esses campos; repassar para
   a narração do web ficar específica.
4. **Velocidade 0,5×**: hoje só no cliente; o contrato lista 1/2/4/8.
5. **Latência**: `CreateCareer`/`SelectClub` ainda 1,7–2,4 s (meta 0,8 s, ADR 0014) — hidratar o DO sem esperar a
   gravação síncrona no Postgres ou aquecer o objeto.
6. **Ranking com avatar**: incluir a URL do avatar do treinador nos snapshots e na tela de Ranking.
7. **Barra inferior**: o rótulo "Escritório" estoura ~2 px em 320–375 px.
8. **Landing arcade** (Etapa 6): ainda não começou (sem marcas Brasfoot/FIFA, isométrica/retrô).
9. **Fechar a etapa**: CI verde no PR #1 (`e2e` e `verify`), atualizar `IMPLEMENTATION-STATE.md`, merge em `main`
   quando o responsável aprovar.

## Decisões recentes do responsável (já registradas)

- Visual Futebol Retrô (ADR 0012), estádio 3D só na partida (modelo `football-field`), Phaser/Three.js só na partida,
  React leve nas telas de gestão, Durable Object + save enxuto + TanStack/Zustand (ADR 0014; TanStack/Zustand ainda
  não migrados).
- Partida para sozinha só no intervalo e no fim; pausa manual a qualquer minuto (decisão 18); partida ao vivo com placar
  grande, emblemas, narração e campo sem rótulos, estatísticas abaixo da dobra (decisão 19).
- Escudos pixel recortados das folhas do responsável (decisão 3 revista; revisão jurídica no checklist); Nova Carreira
  com todos os clubes das Séries A/B/C e plano grátis começando na Série C (decisão 20).
- PIX da licença pela AbacatePay (ADR 0016); Woovi fica como alternativa.
- Mercado abre em Propostas (recebidas pendentes primeiro); busca com filtros recolhidos; atleta escolhido no topo.

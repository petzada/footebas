# Footebas — `/goal` de implementação autônoma do MVP

> **Uso:** colar o bloco **PROMPT DO `/goal`** no Codex (ou equivalente) como objetivo de longa duração.
>
> **Fontes obrigatórias (nessa ordem):** `ROADMAP-MVP.md` §3 → `docs/08-mvp-fonte-de-verdade.md` → `docs/00`–`docs/07` → `footebas-mvp.md` (só se não conflitar) → briefing/brasfoot (contexto, não escopo).
>
> **Override já autorizado pelo produto (ROADMAP §3.1):** elencos reais de `dados/elencos/` serão usados na plataforma.
>
> **Não alterar este arquivo para “afrouxar” o DoD.** Pendências humanas vão para `FINALIZATION-CHECKLIST.md`.

---

## Veredito de escopo (para o responsável)

| Pergunta | Resposta factual |
|---|---|
| Dá para um `/goal` percorrer Fases 0–9 sem pedir aprovação entre fases? | **Sim, o ROADMAP §6.1 foi escrito para isso.** |
| Dá para concluir o MVP inteiro em uma noite de sono? | **Não.** Estimativa do próprio roadmap: **50–76 semanas** efetivas (§14). |
| O que uma noite (ou sessão longa) pode entregar com alta probabilidade? | **Fase 0 completa + avanço sólido na Fase 1** (laboratório determinístico), se o ambiente tiver Node LTS e rede para deps. |
| O que sessões contínuas multi-noite podem entregar sem humanos? | Tudo que for **código + testes + adapters fake/sandbox**, acumulando manuais em `FINALIZATION-CHECKLIST.md`. |
| Quando o `/goal` pode marcar “concluído”? | Quando a implementação automatizável e os gates testáveis do DoD estiverem verdes, **e** só restarem itens humanos/externos no checklist (§6.1 + Fase 9). |

---

## Pré-condições que o humano deve resolver ANTES de disparar (alinhar)

Estas decisões **não estão** todas fechadas na suite normativa. Sem elas, o agente trava ou inventa.

### D1 — Override de conteúdo na norma (crítico)

- **Fato:** `ROADMAP-MVP.md` §3.1 manda usar elencos reais; `docs/08` §11 e `docs/00` decisão #11 ainda mandam base oficial **fictícia**.
- **Opções:**
  - **A (recomendado):** você (ou um commit prévio) atualiza `docs/08` + `docs/00` #11 para refletir o override, **antes** do `/goal`.
  - **B:** o `/goal` fica autorizado a sincronizar a norma no início (já previsto em ROADMAP §15 item 2).
- **Status neste `GOAL.md`:** assume opção **B** no prompt abaixo, até você escolher A.

### D2 — Atributos jogáveis ausentes nos Markdown (crítico)

- **Fato:** `dados/elencos/*` trazem `Posição | Jogador | #camisa` (+ metadados/divergências). **Não** há força, idade, salário, contrato, características ocultas.
- **Fato:** Fase 7 proíbe preencher `—` / `#?` / `[parcial]` / conflitos por **invenção silenciosa**.
- **Opções:**
  - **A:** definir gerador **explícito, determinístico e versionado** (seed + regras) que produz atributos de jogo a partir de posição/clube/tier, marcando campos como `derived` (não como fato de pesquisa).
  - **B:** manter nomes/posições reais e preencher atributos só via dataset sintético separado até calibração humana.
- **Status neste `GOAL.md`:** assume opção **A** (derivação versionada + proveniência `derived`), sem inventar nomes ou camisas ausentes.

### D3 — Critério de “done” do `/goal` vs DoD jurídico/beta (crítico)

- **Fato:** DoD §11 exige gates jurídicos “formalmente resolvidos”; Fase 9 exige beta 3–5 pessoas.
- **Opções:**
  - **A:** `/goal` conclui quando implementação + testes + checklist externo estiverem prontos; jurídico/beta/DNS/billing real ficam no checklist (não bloqueiam “código MVP pronto”).
  - **B:** `/goal` nunca marca concluído até humanos executarem checklist + beta.
- **Status neste `GOAL.md`:** assume opção **A** (alinhado ao texto de §6.1: checklist verificável com pendências externas identificadas).

### D4 — Defaults operacionais (alto; o prompt já fixa se você aceitar)

| Tema | Default assumido no prompt |
|---|---|
| Licença do repositório | `UNLICENSED` / proprietary no README até você trocar |
| Nome do checklist | `FINALIZATION-CHECKLIST.md` (nome do ROADMAP; não `MANUAL-SETUP.md`) |
| Billing provider | Stripe via adapter + sandbox/fake; ativação real só no checklist |
| Auth | Supabase Auth (Google + magic link) via adapter; local = fake JWT / Magia de teste |
| Infra local Fase 2+ | Docker Compose: Postgres + Redis; sem exigir projeto Supabase cloud |
| Bandas Monte Carlo / LCP | Executor **define e versiona em ADR**; não pergunta |
| Estados dos estaduais | Os presentes em `dados/elencos/estaduais-1a-divisao-2026.md` |
| Skills | **Não** invocar `grilling` / `grill-with-docs`; design-taste só na Fase 6 sem perguntas |
| Aprovação do roadmap | Considerado aprovado ao disparar este `/goal` |

Se algum default acima for inaceitável, diga **antes** de rodar — senão o agente segue esses defaults.

### D5 — Orquestração, modelo e orçamento de execução

- O `/goal` deve ser criado com orçamento de tokens/contexto **explicitamente amplo**, usando o maior valor acordado
  e suportado no momento da criação. Esgotar orçamento nunca significa concluir.
- O agente principal é o executor do objetivo, arquiteto e coordenador; ele preserva contexto e não concentra toda a
  implementação em sua própria janela.
- As tarefas de implementação são entregues a agentes novos **GPT-5.6 Sol** (`gpt-5.6-sol`), com contexto reduzido
  e escopo fechado.
- Dentro de cada fase, tarefas independentes podem rodar em paralelo. Escritores usam branch/worktree isolado; sem
  isolamento, commits e edições são serializados para impedir mistura ou perda de mudanças.
- Cada agente implementador testa e commita apenas sua fatia, retornando ao principal somente um handoff curto com
  status, hash, testes, decisões e bloqueios.
- `IMPLEMENTATION-STATE.md` é a memória durável da execução entre agentes e compactions de contexto.

---

## PROMPT DO `/goal` (copiar a partir daqui)

```text
/goal Implementar integralmente o MVP do Footebas conforme ROADMAP-MVP.md (Fases 0–9) e a hierarquia normativa do §3, utilizando os elencos reais autorizados em dados/elencos/ (override §3.1), até que toda implementação automatizável e todos os gates testáveis estejam verdes. Ações humanas/externas devem apenas acumular em FINALIZATION-CHECKLIST.md — nunca pausar o objetivo para pedir aprovação intermediária.

## Autoridade e leitura
1. Hierarquia: (1) este GOAL.md + decisões explícitas abaixo; (2) ROADMAP-MVP.md; (3) docs/08; (4) docs/00–07; (5) footebas-mvp.md só se não conflitar; (6) footebas-briefing.md e brasfoot-consolidado.md = inspiração, NÃO escopo.
2. Divergências “já resolvidas” no ROADMAP §3.2 NÃO reabrir (PWA mobile-first, online obrigatório, server-authoritative, 3 divisões + copa + estaduais + continental, 2D não 3D, força+2 chars, ranking sem multiplayer, grátis+licença+Clube Online).
3. No início: sincronizar docs/08 e docs/00 decisão #11 para refletir o override de elencos reais (ROADMAP §15.2), sem alterar o restante do escopo.
4. Não invocar skills grilling/grill-with-docs. Não fazer perguntas ao usuário. Em ambiguidade: aplicar defaults deste GOAL.md, registrar ADR curto em docs/adr/ e seguir.

## Modo de execução
- Uma fase por vez, na ordem 0→9. Gates = testes/CI/benchmarks, não aprovação humana.
- Gate falhou → diagnosticar → corrigir → revalidar → só então avançar.
- Integrações com segredo/produção: implementar contrato + adapter + fake/sandbox + testes; anotar ativação real em FINALIZATION-CHECKLIST.md; continuar.
- Parar SOMENTE se: (a) falta autoridade de produto não coberta pelos defaults; (b) segredo indispensável e sem fake possível; (c) ação externa irreversível. Nesses casos: documentar o bloqueio no checklist e maximizar progresso em frentes independentes.
- O agente principal deve atuar como arquiteto/orquestrador e delegar a implementação a agentes GPT-5.6 Sol (`gpt-5.6-sol`) novos por tarefa ou fase, evitando esgotar o contexto de qualquer agente.
- Para cada fase: decompor em tarefas independentes; fornecer a cada agente somente objetivo, referências normativas necessárias, interfaces, arquivos sob responsabilidade e testes esperados.
- Executar tarefas independentes em paralelo até o limite disponível, sem dois agentes no mesmo pacote de domínio, migration ou arquivo.
- Escritores paralelos devem operar em branch/worktree isolado. Se isso não for possível, serializar edições/commits e manter em paralelo apenas análise ou leitura.
- Cada agente implementador deve testar e criar seu próprio commit com staging explícito somente de seus arquivos. Retornar apenas: status, hash, testes, decisões e bloqueios.
- O agente principal integra os commits, roda o smoke/gate mínimo de integração, atualiza IMPLEMENTATION-STATE.md e só então inicia a próxima onda/fase.
- Usar agentes novos entre tarefas/fases para renovar contexto. Não reutilizar indefinidamente um único worker.
- Commits pequenos e reversíveis por fatia.
- Evidências por fase: testes, relatórios, migrations, ADRs.
- Orçamento/contexto do objetivo deve ser muito amplo e definido explicitamente ao criar o `/goal`; limite de contexto ou orçamento nunca autoriza reduzir escopo nem marcar conclusão.

## Defaults obrigatórios (não perguntar)
- Monorepo: pnpm + Turborepo; Node LTS fixado; TypeScript estrito; Vitest + fast-check; estrutura apps/packages do ROADMAP §5.
- Fase 0: APENAS domain, engine, testing, config, tools/sim-lab. Next/Fastify/Playwright/Prisma/Postgres/Redis/Supabase/BullMQ só a partir da Fase 2.
- Fase 2+: Docker Compose local com Postgres + Redis. Supabase cloud / Google OAuth / DNS / billing real → checklist.
- Billing: encapsular provedor (preferência Stripe) com sandbox/fake; webhooks idempotentes testados com fixtures.
- Conteúdo: parser dos Markdown brutos (imutáveis). Nomes/posições/camisas só do que estiver explícito. Campos ausentes (força, idade, salário, ocultos, etc.) via gerador DETERMINÍSTICO versionado com proveniência `derived` — nunca inventar nomes nem preencher `—`/`#?`/`[parcial]`/conflitos como se fossem fato pesquisado; rejeitar ou marcar incompleto no relatório.
- Licença do repo: UNLICENSED/proprietary até o responsável decidir.
- Bandas de calibração, faixas econômicas e perfil de LCP: definir em ADR versionado e testar contra esses números.
- Checklist único: FINALIZATION-CHECKLIST.md (credenciais produção, DNS, OAuth Google real, billing real, serviços, jurídico/comercial, beta 3–5 pessoas, publicação).
- Definition of Done automatizável (§11 exceto jurídico/beta/publicação) deve estar atendida em código+testes. Jurídico, beta humana e publicação = checklist, não bloqueio de implementação.

## Fora do escopo (não implementar)
Tudo do ROADMAP §12: 3D, 7 habilidades+treino, multiplayer, ranqueado normalizado, seleções/Mundial, estaduais de todos os estados, workshop hospedado, IA generativa de resultados, app nativo.

## Critério de conclusão do /goal
Marcar concluído somente quando:
1. Fases 0–8 com gates técnicos verdes e evidências no repo;
2. Parte automatizável da Fase 9 (observabilidade wiring, testes de carga locais, scripts de backup/restore, hardening de código, playthroughs automatizados) verde;
3. Nenhuma feature essencial do §4 / DoD automatizável pendente;
4. O agente principal realizou auditoria final rápida entre docs/00, docs/08, ROADMAP-MVP.md, overrides, codebase e testes; toda divergência de implementação encontrada foi corrigida por novos agentes 5.6 Sol;
5. A suíte de topo e os smoke tests críticos estão verdes;
6. FINALIZATION-CHECKLIST.md lista, em ordem de necessidade, só o que um humano/serviço externo precisa executar — e nada disso está misturado como “TODO de código”.

Comece pela Fase 0 agora.
```

---

## O que vai para `FINALIZATION-CHECKLIST.md` (modelo mental)

Ordem típica de necessidade (o executor refinará):

1. Aprovar/confirmar LICENSE definitiva do repositório  
2. Criar projeto Supabase (Auth Google + magic link) e preencher env de staging/produção  
3. Provisionar Postgres/Redis gerenciados (ou aceitar Compose só em staging)  
4. Configurar DNS / hospedagem web + API + worker  
5. Ativar billing real (chaves, webhooks, produtos)  
6. Revisar jurídico/comercial de marcas, nomes, bases e assets  
7. Termos, privacidade, exclusão/exportação de dados  
8. Beta fechada com 3–5 pessoas (critério qualitativo da Fase 9)  
9. Aceite humano final + publicação pública  

O executor cria/atualiza esse arquivo durante a corrida; não precisa existir antes do disparo.

---

## Probabilidade realista (sessão overnight ~6–10h)

| Entrega | Probabilidade |
|---|---|
| Fase 0 (baseline monorepo + CI + smoke) | **Alta** |
| Fase 1 parcial (domínio + `simulateMatch` + testes) | **Média–alta** |
| Fase 1 gate completo (10k partidas + mil temporadas + bandas) | **Média** |
| Fase 2 vertical slice online com Compose | **Baixa–média** numa noite; **alta** em várias sessões |
| Fases 3–9 completas numa noite | **~0%** |
| MVP “jogável local” multi-sessão sem credenciais cloud | **Alta**, se o `/goal` persistir dias/semanas |
| Lançamento público sem humanos | **0%** (jurídico + beta + DNS + chaves) |

---

## Checklist do responsável antes de dormir

- [ ] Aceitar ou alterar D1–D4 e a tabela de defaults acima  
- [ ] Se escolher D1-A: atualizar `docs/08` + `docs/00` #11 **antes** (eu não alterei nada ainda)  
- [ ] Garantir máquina com Node LTS, pnpm, Docker (para Fase 2+), git limpo o suficiente  
- [ ] Definir no `/goal` um orçamento de tokens/contexto explicitamente muito amplo, no maior valor acordado e suportado  
- [ ] Disparar o Codex com o bloco **PROMPT DO `/goal`**, mantendo o agente principal como orquestrador e usando workers GPT-5.6 Sol  
- [ ] Não invocar grilling no meio da corrida  

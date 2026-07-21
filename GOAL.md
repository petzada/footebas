# Footebas — `/goal` de implementação autônoma do MVP

> **Uso:** colar o bloco **PROMPT DO `/goal`** no Codex como objetivo de longa duração.
>
> **Decisões D1–D5 do responsável:** travadas abaixo (2026-07-20). Não reperguntar.
>
> **Fontes:** `ROADMAP-MVP.md` §3 → `docs/08` → `docs/00`–`07` → `footebas-mvp.md` (só se não conflitar) → briefing/brasfoot (contexto).
>
> **Override de infra neste GOAL:** vence o ROADMAP sempre que houver conflito sobre Docker, banco, fila, cloud, E2E/browser, telemetria SaaS ou pagamento real.

---

## Decisões travadas (humano)

| # | Escolha | Em português simples |
|---|---|---|
| **D1** | Elencos **reais** | O jogo usa clubes/jogadores de `dados/elencos/`. Norma já sincronizada. |
| **D2** | Números com controle + cola | Atributos `derived` + `dados/elencos/forca-relativa-cola.md`. Sem inventar nomes/camisas/`[parcial]`. |
| **D3** | Código + testes de agente; checklist humano | Tudo que der sem passo manual. Conexões reais no `FINALIZATION-CHECKLIST.md`. |
| **D4** | Licença única via **Woovi/PIX**; **sem assinatura no MVP**; sem Docker/banco/cloud no `/goal` | Só adapters fake/in-memory. Stripe e Clube Online ficam pós-MVP; Supabase e conexões reais vão para o checklist final. |

---

## O que NÃO pode travar o `/goal` (lista explícita)

Durante o `/goal`, **proibido exigir, instalar como dependência de gate, ou usar como critério de avanço**:

| Item | Por quê trava | O que fazer no `/goal` |
|---|---|---|
| Docker / docker-compose | Precisa daemon/imagem | Não usar |
| Postgres / banco real | Conexão/serviço | Schema Prisma ok como código; adapter **in-memory**; sem migrate/teste em DB |
| Redis / fila real / BullMQ contra Redis | Serviço externo | Job runner **in-process/fake** |
| Supabase (Auth/DB/Storage) | Conta + chaves | Só no checklist |
| Google OAuth / magic link real / e-mail SMTP | Conta + rede | Auth fake in-memory |
| Woovi / PIX / webhook HTTP real / ngrok | Pagamento/rede | Adapter fake + fixtures locais; **sem** teste de pagamento |
| Railway / Cloudflare / R2 / DNS / domínio | Conta/manual | Checklist |
| Sentry / PostHog / OTel cloud / dashboards SaaS | Conta | No-op / sink local em memória; sem criar projeto |
| Playwright / E2E em browser / download de browsers | Instala Chromium, frágil | **Proibido como gate**. UI testa com Vitest/RTL (jsdom) se precisar |
| axe em browser real / matriz de celulares / LCP em device | Hardware/rede | Checklist; no código só a11y estrutural leve sem browser |
| Load test contra infra real | Precisa serviço | Só microbench de engine/CPU in-process |
| Backup/restore em DB real | Precisa banco | Scripts podem existir; execução real = checklist |
| CI remoto com secrets (GitHub Actions dependente de chave) | Secrets humanos | Scripts locais `pnpm test` etc.; workflow sem secret obrigatório ok |
| Beta humana / jurídico / publicação | Humano | Checklist |
| Qualquer API HTTP externa obrigatória após `pnpm install` | Rede/conta | Proibido como gate |

**Permitido (não trava):** `pnpm install` (rede uma vez), typecheck, lint, unit/golden/property/Monte Carlo/sim-lab, contract tests com fakes, build, playthroughs automatizados **in-memory**.

---

## Veredito rápido

- Gates do ROADMAP que pedem Postgres/Redis/E2E/browser/SaaS/pagamento/device → **implementar código + fake** e **registrar teste real no checklist**; **não** bloquear a fase.
- DoD jurídico/beta/publicação → **não** impede conclusão do `/goal` de código.

---

## Orquestração (D5)

- Principal = arquiteto/orquestrador; workers **GPT-5.6 Sol** (`gpt-5.6-sol`).
- Ao criar o goal, usar `token_budget: 1000000`; se a plataforma rejeitar, usar o maior valor aceito.
- O bootstrap da Fase 0 usa um único escritor até existir commit-base limpo; paralelismo de escrita começa depois.
- Workers são criados com `model: "gpt-5.6-sol"` e `fork_turns: "none"`, recebendo contexto enxuto na tarefa.
- Limite operacional: principal + até três workers simultâneos, apenas em tarefas independentes.
- Escritores usam branch/worktree isolado; sem isolamento, edições e commits são serializados.
- Cada worker testa e commita somente sua fatia; retorna apenas status, hash, testes, decisões e bloqueios.
- Principal integra, roda o gate mínimo, atualiza `IMPLEMENTATION-STATE.md` e dispara a próxima onda/fase.
- Workers novos renovam o contexto entre tarefas/fases; esgotamento de contexto/orçamento nunca significa conclusão.

---

## PROMPT DO `/goal` (copiar a partir daqui)

```text
/goal Implementar integralmente o MVP do Footebas conforme ROADMAP-MVP.md (Fases 0–9) e a hierarquia de ROADMAP-MVP.md §3, usando elencos reais de dados/elencos/ e a cola dados/elencos/forca-relativa-cola.md, com monetização MVP limitada a grátis + licença única via adapter fake Woovi/PIX (sem assinatura), até que toda implementação possível sem passo manual e todos os gates testáveis PELO AGENTE (sem infra externa) estejam verdes. Nunca pedir aprovação intermediária. Pendências humanas/conexões só em FINALIZATION-CHECKLIST.md.

## Autoridade
1. Hierarquia: (1) este GOAL.md — overrides de infra/testes VENCEM o ROADMAP; (2) ROADMAP-MVP.md; (3) docs/08; (4) docs/00–07; (5) footebas-mvp.md se não conflitar; (6) briefing/brasfoot = inspiração.
2. Não reabrir ROADMAP-MVP.md §3.2. Não reperguntar D1–D5.
3. ROADMAP-MVP.md + GOAL.md constituem design já aprovado. Não reiniciar ciclos de brainstorming/aprovação; quando uma skill exigir design, usar estes documentos como aprovação e seguir.
4. Sem grilling. Sem perguntas ao usuário. Ambiguidade → ADR + defaults deste GOAL.md.

## PROIBIDO no /goal (não usar como gate nem dependência)
Docker, docker-compose, Postgres/Redis/Supabase reais, Google OAuth, magic link/e-mail reais, Woovi/PIX/pagamento real, webhooks HTTP reais, ngrok/túneis, Railway, Cloudflare, R2, DNS, Sentry/PostHog/OTel cloud, Playwright, download de browsers, E2E em browser real, matriz de celulares, LCP em device, load test em infra real, restore de backup em DB real, CI remoto que exija secrets, qualquer API HTTP externa obrigatória após pnpm install.

## OBRIGATÓRIO no /goal
- Ports + adapters in-memory/fake para persistência, auth, fila/jobs, billing (Woovi PIX fake), storage e telemetria (no-op).
- Billing do MVP cobre somente licença única: criar cobrança PIX, consultar status, expiração, confirmação idempotente e reembolso por fixtures. Não implementar assinatura, recorrência, renovação ou cancelamento de plano.
- Prisma/schema/migrations podem ser escritos; NÃO executar contra banco; NÃO testes de integração de DB/fila.
- Testes de agente: typecheck, lint, unitários, golden, property-based, Monte Carlo/sim-lab, contract tests com fakes, build, playthroughs in-memory.
- UI: preferir Vitest/jsdom; Playwright/E2E browser = checklist, nunca gate de fase.
- Onde o ROADMAP pedir integração real, browser, SaaS, device, pagamento ou jurídico: entregar código/contratos/fakes e anotar no FINALIZATION-CHECKLIST.md — avançar a fase.

## Conteúdo
- Markdown brutos imutáveis; não converter `—`, `#?`, `[parcial]` ou conflitos em fatos inventados.
- Atributos ausentes: gerador determinístico derived + forca-relativa-cola.md.

## Execução
- Fases 0→9 em ordem. Gate = só teste de agente sem infra externa.
- Gate falhou → corrigir → revalidar → avançar.
- Implementar todo código do MVP possível sem humano/serviço externo.
- Na Fase 0, usar um único escritor no workspace principal até criar o commit-base da documentação/dados e o baseline técnico.
- Depois do commit-base, principal cria branch/worktree isolado por worker e informa o caminho absoluto na tarefa. Sem worktree, serializar escritores.
- Spawn de implementação: `model: "gpt-5.6-sol"`, `fork_turns: "none"`, contexto limitado a objetivo, normas necessárias, interfaces, arquivos e testes.
- Rodar até três workers simultâneos somente em tarefas independentes; nunca compartilhar pacote de domínio, migration ou arquivo.
- Worker implementa, testa, faz staging explícito e cria o próprio commit. Retorno curto: status, hash, testes, decisões e bloqueios.
- Principal integra/cherry-picka commits, executa o smoke/gate de integração, atualiza IMPLEMENTATION-STATE.md e inicia a próxima onda/fase.
- Usar workers novos para renovar contexto. Não reduzir escopo nem concluir por limite de contexto, tempo ou orçamento.
- Fase 0: domain, engine, testing, config, tools/sim-lab.
- Fase 2+: web/api/worker com ports/fakes; sem Compose.
- Não começar 2D/editor/billing antes do loop anterior passar o gate testável de agente.
- Fora do MVP: ROADMAP §12 + Clube Online, assinatura/recorrência e Stripe.

## Conclusão
Antes de concluir, o principal deve confrontar rapidamente docs/00, docs/08, ROADMAP-MVP.md, GOAL.md e overrides com a codebase; verificar a matriz decisão/feature → implementação → testes; executar a suíte de topo e smoke tests; e delegar qualquer correção encontrada a novos workers gpt-5.6-sol.

Concluir somente quando o código do MVP + gates de testes-de-agente estiverem verdes, não houver pendência de código e FINALIZATION-CHECKLIST.md listar em ordem apenas o manual/externo, tipicamente:
1) Supabase (Postgres/Auth/Storage) + rodar migrations/testes de DB
2) Redis/fila hospedada (se for usar) + testes de fila
3) OAuth Google / magic link reais
4) Woovi real (PIX) — primeiro teste de pagamento
5) Hosting/DNS (e opcional Cloudflare/R2)
6) Sentry/telemetria cloud (opcional)
7) Playwright/E2E em browser + checagens mobile/LCP
8) Jurídico/comercial
9) Beta 3–5 pessoas
10) Publicação

Comece pela Fase 0 agora.
```

---

## Checklist do responsável antes de disparar

- [x] D1–D5 + bloqueios de infra/E2E/SaaS explícitos no `GOAL.md`
- [ ] Node LTS + pnpm (**sem** Docker)
- [ ] Criar `/goal` com `token_budget: 1000000` ou o maior valor aceito pela plataforma
- [ ] Colar o prompt acima
- [ ] Não invocar grilling no meio da corrida

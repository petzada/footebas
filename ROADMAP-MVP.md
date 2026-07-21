# Footebas — Roadmap de Desenvolvimento do Zero ao MVP

> **Status:** roadmap operacional proposto
>
> **Base normativa:** `docs/08-mvp-fonte-de-verdade.md`
>
> **Modelo de execução:** desenvolvedor solo, com apoio de Codex, Claude Code e Cursor
>
> **Estratégia:** vertical slices orientados a risco
>
> **Unidade das estimativas:** semanas de trabalho efetivo em dedicação integral, sem datas de calendário

---

## 1. Objetivo deste roadmap

Transformar a fundação documental existente em um MVP comercial funcional, coerente e publicável do Footebas:
um manager de futebol web, PWA mobile-first, online e server-authoritative, com carreiras longas, rodadas rápidas,
competições brasileiras, ranking global de treinador e monetização sem pay-to-win agressivo.

Este documento não redefine o produto. Ele converte as decisões já tomadas em uma sequência executável, com
dependências, entregáveis, testes e critérios de saída. O lançamento público continua sendo o **MVP completo**;
as fases abaixo são marcos internos, demos locais e alphas controlados.

## 2. Estado atual da codebase

### 2.1 O que existe

- Documentação normativa e de apoio em `docs/00` a `docs/08`.
- Documento detalhado anterior em `footebas-mvp.md`.
- Pesquisa histórica em `brasfoot-consolidado.md` e briefing em `footebas-briefing.md`.
- Seis levantamentos de elencos e competições de 2026 em `dados/elencos/`.
- Skills locais para frontend, shadcn, arquitetura e práticas de Postgres.

### 2.2 O que ainda não existe

- Aplicações web, API e worker.
- Monorepo, pacotes TypeScript e configuração de build.
- Engine, modelo de domínio e contratos de API.
- Schema, migrations, seeds ou instância de banco configurada.
- Autenticação, filas, cache, storage ou ambientes de deploy.
- Design system, telas, PWA ou visualizador de partida.
- Testes automatizados, CI/CD, telemetria e observabilidade.
- Pipeline que converta os levantamentos em conteúdo válido para o jogo.
- O histórico atual contém apenas decisões e roadmaps; ainda não há commit de aplicação executável nem baseline
  consolidado de toda a documentação e dos dados.

Portanto, o estado real é **fundação documental + dados de pesquisa**, não uma aplicação parcialmente implementada.

## 3. Hierarquia das decisões

Em caso de divergência durante o desenvolvimento, aplicar esta ordem:

1. Decisões explícitas do responsável pelo produto.
2. `docs/08-mvp-fonte-de-verdade.md` — escopo normativo do MVP.
3. `docs/00-visao-e-decisoes.md` — log consolidado de decisões.
4. `docs/01` a `docs/07` — detalhamento por área.
5. `footebas-mvp.md` — referência detalhada quando não conflitar com a suite normativa.
6. `footebas-briefing.md` e `brasfoot-consolidado.md` — contexto e inspiração, não escopo vigente.

### 3.1 Override explícito de conteúdo

Os elencos reais presentes em `dados/elencos/` **serão utilizados na plataforma**, por decisão explícita do
responsável pelo produto. Essa decisão substitui, apenas nesse ponto, a diretriz anterior de uma base oficial
exclusivamente fictícia. O restante da documentação continua vigente.

Consequências práticas:

- Os arquivos atuais são **fontes brutas de pesquisa**, não seeds de produção.
- Clubes e jogadores repetidos entre Série A/B/C, estaduais, Copa e continental precisam formar entidades únicas.
- Participação em competição deve ser modelada separadamente do elenco do clube.
- Origem, data, cobertura, divergências e confiança devem acompanhar cada snapshot importado.
- Uma revisão jurídica/comercial sobre marcas, nomes, bases de dados e assets permanece um gate anterior ao
  lançamento público, sem impedir o desenvolvimento e os testes internos.

### 3.2 Divergências documentais já resolvidas

Não reabrir durante a implementação:

| Tema | Decisão vigente |
|---|---|
| Plataforma | PWA web **mobile-first**; desktop é enhancement multi-painel |
| Operação | Online obrigatório; universo isolado por carreira no servidor |
| Simulação | Server-authoritative, em lote, por worker; nunca no cliente ou no processo da API |
| Competições | 3 divisões + copa nacional + estaduais simplificados + continental |
| Conteúdo | Elencos reais de `dados/`, conforme override acima |
| Partida | Resultado instantâneo + narração/feed + 2D leve; 3D fica pós-MVP |
| Jogador | Força única + até 2 características visíveis; atributos ocultos completos |
| Social | Ranking global de treinador; sem multiplayer no MVP |
| Monetização | Grátis + licença única via Woovi/PIX; Clube Online/Stripe ficam pós-MVP |
| Lançamento | MVP público completo; fases são validações internas |

Referências antigas a desktop-first, quatro divisões, 80 clubes, 3D no MVP ou offline-first não governam o
desenvolvimento.

## 4. Resultado esperado do MVP

Ao final, uma pessoa deve conseguir:

1. abrir o site no celular, criar conta e iniciar uma carreira;
2. criar treinador e assumir um clube permitido pelo seu entitlement;
3. entender elenco, objetivo, caixa e próximo compromisso sem tutorial longo;
4. escalar, escolher uma tática compacta e disputar ou simular a partida;
5. receber resultado, eventos, notas, renda, moral, condição, lesões, suspensões e atualização da tabela;
6. contratar, vender, emprestar, renovar, rescindir e promover jovens;
7. administrar finanças, ingressos, folha, patrocínio e estádio;
8. atravessar temporadas com evolução, declínio, aposentadoria, acesso, rebaixamento e novas competições;
9. ser demitida, receber proposta e trocar de clube sem perder a carreira do treinador;
10. consultar história, notícias, recordes e ranking global;
11. editar/importar o conteúdo permitido pelo plano;
12. comprar a licença única via PIX, sem que dinheiro compre resultado esportivo.

Metas centrais: primeira partida em até 5 minutos; rodada comum em até 2 minutos; avanço semanal abaixo de 3
segundos em carga normal; save íntegro por dezenas de temporadas.

## 5. Arquitetura-alvo

```text
apps/web (Next.js PWA)
        |
        | REST + SSE, JWT
        v
apps/api (Fastify) -----> PostgreSQL/Supabase
        |
        | jobs BullMQ
        v
apps/worker -----------> Redis
        |
        v
packages/engine + packages/domain
        |
        v
eventos, snapshot, read models e timeline da partida
```

Estrutura-alvo, construída progressivamente e completa a partir da Fase 2:

```text
apps/
  web/                 Next.js, PWA, gestão e reprodução de partidas
  api/                 Fastify, autenticação, comandos, consultas e jobs
  worker/              BullMQ, simulação e tarefas CPU-intensive
packages/
  domain/              entidades, value objects, comandos e eventos
  engine/              regras puras, calendário, partidas, IA e progressão
  contracts/           schemas Zod e tipos de transporte
  database/            Prisma, migrations, repositories e read models
  content/             schema e compilação dos datasets
  ui/                  design system e componentes compartilhados
  match-viewer/        feed e campo 2D render-only
  config/              TypeScript, lint, ambiente e convenções
  testing/             factories, seeds fixas e helpers
tools/
  sim-lab/             CLI, playthrough e relatórios Monte Carlo do engine
  content-pipeline/    importação, normalização e validação de conteúdo
```

Regras de fronteira:

- `engine` e `domain` não importam Next.js, Fastify, Prisma, React, Supabase ou BullMQ.
- O cliente nunca grava estado de jogo diretamente no banco.
- A API valida autorização e comandos; o worker executa simulação pesada.
- O 2D reproduz uma timeline calculada pelo servidor; não simula o jogo novamente.
- Snapshot, seed e versões de engine, regras, conteúdo e schema acompanham cada carreira.

## 6. Estratégia de execução para uma pessoa

O limite recomendado é **um marco em progresso e uma vertical slice ativa por vez**. Cada fase precisa terminar
com software demonstrável, não apenas camadas técnicas isoladas.

Princípios de trabalho:

- Definir contrato e teste de saída antes de gerar implementação com IA.
- Manter PRs/commits pequenos e reversíveis, preferencialmente por comando ou fluxo do usuário.
- Não permitir que dois agentes alterem simultaneamente o mesmo pacote de domínio ou migration.
- Submeter migrations, fórmulas do engine, autorização, billing e concorrência a testes reforçados e revisão por
  agente distinto; a revisão humana consolidada ocorre na Fase 9.
- Registrar decisões caras em ADRs: datas do jogo, dinheiro, PRNG, snapshot, versionamento e compatibilidade.
- Encerrar cada fase com uma demonstração executável adequada ao estágio, testes de regressão e relatório de métricas.
- Não começar 2D, editor ou billing antes de o loop anterior passar pelo gate de qualidade.

### 6.1 Execução contínua por `/goal`

O plano foi desenhado para poder ser executado por um único objetivo de longa duração, cobrindo as Fases 0–9 sem
pedir aprovação humana entre elas. Nesse modo:

- O objetivo terminal é o **MVP completo e aderente à Definition of Done**, não a conclusão isolada de uma fase.
- Os gates intermediários são verificações automáticas de qualidade, não pontos de pausa para aprovação.
- Quando um gate falhar, o executor diagnostica, corrige e repete a validação antes de avançar.
- Cada fase gera evidências versionadas: testes, benchmarks, relatórios de simulação, migrations e decisões.
- A execução só para por bloqueio real que exija nova autoridade, segredo indisponível ou ação externa irreversível.
- Quando uma integração depender de credenciais ou produção, o executor implementa contrato, adapter, sandbox/fake e
  testes; registra a ativação real no checklist final e continua nas demais tarefas independentes.
- Testes humanos, credenciais de produção, DNS, contratação de serviços, revisão jurídica/comercial e publicação
  pública ficam concentrados na Fase 9.
- O objetivo não pode ser marcado como concluído enquanto houver feature do MVP, teste obrigatório, migration,
  integração ou critério da Definition of Done pendente.

Objetivo recomendado para o futuro `/goal`:

> Implementar integralmente o MVP do Footebas descrito neste roadmap e na fonte normativa, executando as Fases
> 0–9 em ordem, utilizando os elencos reais autorizados e monetização grátis + licença única via Woovi/PIX,
> sem assinatura no MVP, corrigindo automaticamente gates que falharem,
> preservando todas as decisões registradas e só concluir quando toda implementação automatizável e a Definition
> of Done estiverem completas, restando exclusivamente ações humanas ou externas reunidas em um único checklist
> verificável.

### 6.2 Orquestração dos agentes durante o `/goal`

O agente principal do objetivo atua como **arquiteto e coordenador**, preservando contexto para decisões, sequência
de fases e validação final. A implementação substantiva é delegada a agentes novos e especializados por fatia.

Política obrigatória:

- Criar o `/goal` com `token_budget: 1000000`; se a plataforma rejeitar, usar o maior valor aceito. Esgotamento de
  orçamento nunca equivale a conclusão.
- Usar **GPT-5.6 Sol** (`gpt-5.6-sol`) nos agentes de implementação.
- Na Fase 0, manter um único escritor no workspace principal até existir commit-base limpo; somente depois abrir
  paralelismo de escrita.
- O agente principal decompõe cada fase em tarefas independentes, com arquivos e contratos de propriedade claros.
- Cada agente recebe contexto enxuto: objetivo da tarefa, fase do roadmap, documentos normativos indispensáveis,
  interfaces afetadas, testes esperados e estado atual registrado no repositório — não o histórico inteiro.
- Criar workers com `model: "gpt-5.6-sol"` e `fork_turns: "none"`; fornecer todo o contexto necessário na tarefa.
- Dentro de uma fase, executar em paralelo apenas tarefas realmente independentes, com até três workers além do
  principal, e nunca atribuir o mesmo pacote de domínio, migration ou arquivo a dois agentes.
- Escritores paralelos usam branch/worktree isolado. Se isolamento não estiver disponível, alterações e commits são
  serializados; somente análises e leituras podem continuar em paralelo.
- O próprio agente responsável pela tarefa implementa, testa e cria commit pequeno com staging explícito apenas dos
  arquivos sob sua responsabilidade.
- O retorno ao agente principal é curto: status, hash do commit, testes executados, decisões tomadas e eventual
  desvio/bloqueio. Não devolver transcrições extensas ou todo o raciocínio.
- O agente principal integra os commits, executa apenas o smoke/gate necessário para confirmar a integração, atualiza
  o estado durável e então dispara a próxima onda ou fase.
- Usar agentes novos entre tarefas/fases para renovar a janela de contexto; não concentrar toda a implementação num
  único agente longo.
- Manter `IMPLEMENTATION-STATE.md` como memória durável: fase atual, tarefas, responsáveis, commits, gates, decisões,
  pendências externas e próximo passo. O repositório, não a conversa, é a fonte de continuidade operacional.

Antes de concluir o objetivo, o agente principal realiza uma auditoria final rápida e transversal:

1. confronta `docs/00`, `docs/08`, este roadmap e os overrides explícitos com o que existe na codebase;
2. verifica a matriz decisão/feature -> implementação -> testes -> migration/telemetria quando aplicável;
3. executa a suíte de topo e os smoke tests dos fluxos críticos;
4. delega correções de qualquer lacuna encontrada a novos agentes 5.6 Sol;
5. só encerra quando não houver pendência de código e restarem apenas ações humanas/externas no checklist final.

### 6.3 Override operacional do `/goal`

A arquitetura final continua server-authoritative com Postgres/Supabase, Redis/BullMQ, storage, autenticação e
serviços externos. Porém, durante o `/goal` autônomo, a decisão D4 de `GOAL.md` prevalece:

- não executar Docker, banco, Redis, Supabase, browser E2E, SaaS ou pagamento real;
- implementar ports, adapters reais compiláveis quando possível e fakes/in-memory testáveis;
- validar toda a lógica automatizável com testes locais sem infraestrutura externa;
- enviar conexões, credenciais e validações reais para `FINALIZATION-CHECKLIST.md`;
- interpretar cada gate durante o `/goal` como a parcela testável pelo agente, sem declarar que a validação de
  produção já ocorreu.

Esse override altera a forma de validar a implementação autônoma, não a arquitetura do produto final.

## 7. Caminho crítico

```text
Fundação
  -> contratos de domínio
  -> determinismo e calendário mínimo
  -> loop autoritativo persistido
  -> carreira multitemporada e economia
  -> competições completas
  -> UX/2D
  -> conteúdo/editor
  -> ranking/billing
  -> hardening
  -> MVP público
```

Calendário, economia de longo prazo, saves/versionamento, IA de mercado e concorrência por carreira são os riscos
mais altos. Eles entram cedo e recebem testes de simulação massiva antes do polimento visual.

## 8. Fases de desenvolvimento

### Fase 0 — Baseline reproduzível

**Estimativa:** 2–5 dias úteis

**Mapeamento:** preparação para M1

**Dependência:** roadmap aprovado e decisões normativas acessíveis

**Objetivo:** qualquer agente ou máquina deve instalar, testar e executar o laboratório do engine de forma
previsível, sem antecipar infraestrutura de produto.

**Entregáveis:**

- Commit inicial revisado, `.gitignore`, licença do repositório e `README` operacional.
- Monorepo pnpm + Turborepo apenas com `domain`, `engine`, `testing`, `config` e `tools/sim-lab` ativos.
- Node LTS fixado, TypeScript estrito, lint, formatter, Vitest e fast-check.
- CI com install, typecheck, lint, testes e build.
- Convenções mínimas de IDs, `GameDate`, erros de domínio e serialização canônica.
- ADRs mínimos: fronteiras do engine, PRNG/seed, relógio do jogo e determinismo.
- Comando único para executar um smoke test determinístico no `sim-lab`.
- Registro explícito de que Next.js, Fastify, Playwright, Prisma, Postgres, Redis, Supabase e BullMQ só entram na
  Fase 2.

**Gate de saída:** clone limpo executa uma única sequência documentada e conclui install, typecheck, lint, testes,
build e smoke test do laboratório; nenhum serviço externo ou segredo é necessário.

### Fase 1 — Laboratório determinístico do jogo

**Estimativa:** 4–6 semanas

**Mapeamento:** primeira parte do M1

**Dependência:** gate da Fase 0

**Objetivo:** provar que regras, resultados e progressão são reproduzíveis e potencialmente divertidos antes de
investir na aplicação completa.

**Vertical slice:** oito clubes, turno e returno (**14 rodadas**), aproximadamente 200 jogadores, escalação, três
formações, três mentalidades, partida instantânea, feed textual, tabela e encerramento/reinício de temporada via
harness/CLI.

**Ordem interna obrigatória:**

1. Formalizar `Player`, `Club`, `Lineup`, `Tactic`, `MatchInput`, `MatchResult` e os value objects indispensáveis.
2. Implementar e testar o PRNG determinístico/versionado, sem `Math.random`, relógio real ou estado global.
3. Implementar `simulateMatch(input: MatchInput): MatchResult` com placar, estatísticas e timeline.
4. Construir o laboratório Monte Carlo e definir bandas versionadas de calibração.
5. Implementar `LeagueTable`, geração das 14 rodadas e `advanceRound()`.
6. Conectar escalação, adequação posicional e três mentalidades ao resultado probabilístico.
7. Disponibilizar o harness interativo e executar uma temporada completa.

**Entregáveis:**

- Entidades e value objects mínimos de carreira, clube, jogador, elenco, tática, competição, fixture e partida.
- PRNG seedado e versionado; relógio/data do jogo desacoplado do relógio real.
- Motor de partida puro com timeline de gols, chances, cartões, lesões, substituições e estatísticas.
- Cálculo inicial de força efetiva: posição, condição, moral, ritmo, tática, mando e variação controlada.
- Gerador de liga em turno e returno e classificação com critérios configuráveis.
- Evolução mínima de condição, moral e suspensões entre rodadas.
- Fixture sintética controlada para calibração e uma amostra separada de oito clubes reais para validação de
  integração; os levantamentos reais continuam sendo conteúdo obrigatório do produto final.
- Harness Monte Carlo que exporta distribuições, zebras, gols, cartões, mando e efeito de decisões.
- Golden tests por seed, property-based tests de invariantes e relatórios estatísticos de calibração.

**Gate técnico de saída:** a mesma entrada/seed/versão gera saída canônica equivalente; uma temporada de 14
rodadas fecha com campeão e tabela válidos; 10 mil partidas e ao menos mil temporadas sintéticas rodam sem estado
impossível; favoritismo cresce de forma monotônica por faixa de diferença de força; zebras permanecem possíveis;
mando e decisões táticas têm efeito mensurável sem garantir vitória; as distribuições permanecem nas bandas
versionadas; uma partida fica abaixo da meta inicial de 150 ms no ambiente de referência.

**Validação contínua sem pausa humana:** durante o `/goal`, o executor realiza playthroughs automatizados e
adversariais de ao menos dez das 14 rodadas, registra as decisões e verifica legibilidade, variação e consequências
por proxies mensuráveis. A validação humana de diversão não bloqueia a transição para a Fase 2; ela ocorre na beta
da Fase 9. Se a beta reprovar o loop, o objetivo permanece incompleto e retorna à Fase 1 para recalibração.

### Fase 2 — Primeira carreira server-authoritative

**Estimativa:** 5–8 semanas

**Mapeamento:** segunda parte do M1

**Dependência:** engine determinístico e invariantes da Fase 1

**Objetivo:** entregar o primeiro fluxo real, autenticado e persistido, do cadastro ao pós-jogo.

**Vertical slice:** cadastro -> criar treinador -> assumir clube -> escalar -> definir tática -> avançar -> worker
simular -> assistir feed -> ver resultado/tabela -> fechar e recarregar o save.

**Entregáveis:**

- Supabase Auth com Google e magic link; API valida JWT sem acoplar domínio ao fornecedor.
- Schema inicial, Prisma migrations, repositories e transações.
- `GameSave` como raiz com checksum, versão otimista, seed e versões obrigatórias.
- API Fastify REST/OpenAPI com `CreateCareer`, `SelectClub`, `SetLineup`, `SetTactics`, `AdvanceDate` e
  `SimulateMatch`.
- BullMQ/Redis, worker isolado e SSE de status/progresso.
- Idempotência nos comandos críticos e lock por carreira.
- Read models mínimos: home, elenco, próximo jogo, tabela e pós-partida.
- Web mobile-first com onboarding curto, navegação básica e feed skippable.
- Recuperação segura para job com retry, timeout ou falha após persistência parcial.

**Gate de saída:** primeira partida em até 5 minutos; carreira recarrega sem divergência; dois comandos de avanço
concorrentes não duplicam rodada; retries não duplicam partidas ou transações; o cliente não possui caminho de
escrita direta do estado canônico.

### Fase 3 — Elenco e matchday completos

**Estimativa:** 5–7 semanas

**Mapeamento:** M1

**Dependência:** fluxo autoritativo persistido da Fase 2

**Objetivo:** tornar cada rodada uma decisão real de gestão, e não apenas um botão de simulação.

**Entregáveis:**

- Modelo completo do jogador: força, até duas características visíveis e seis dimensões ocultas.
- Posições principal/secundárias, lado, improvisação e goleiros com características próprias.
- Condição, moral, ritmo, lesões, suspensões, notas, cartões e estatísticas de carreira.
- Escalação titular/banco/reservas, formação e automações de melhor time/poupar/desenvolver.
- Tática compacta vigente: mentalidade, construção, foco, pressão, linha defensiva e marcação.
- Preparação de partida com adversário, forma, força aproximada e desfalques.
- Substituições e mudanças táticas em pontos discretos da simulação.
- Resultado instantâneo, narração rápida e feed com velocidade configurável.
- Alternativa acessível ao drag-and-drop e suporte a teclado.

**Gate de saída:** toda rodada apresenta informação suficiente para uma decisão; escalações inválidas são
rejeitadas pelo domínio; mudanças durante a partida são registradas e reproduzíveis; o caminho até a próxima
rodada exige poucos toques no celular.

### Fase 4 — Mundo vivo e carreira de longo prazo

**Estimativa:** 8–12 semanas

**Mapeamento:** conclusão funcional do M1

**Dependência:** matchday completo e estável da Fase 3

**Objetivo:** sustentar dezenas de temporadas sem colapso de elenco, economia ou narrativa.

**Entregáveis:**

- Contratos, alertas, renovação, recusa, rescisão e atletas livres.
- Mercado com busca, filtros, observação, comparação, ofertas, contrapropostas, compra, venda e empréstimo.
- IA de clubes orientada a necessidade, orçamento, faixa salarial, reputação, idade e tamanho do elenco.
- Ledger financeiro imutável para salários, transferências, ingressos, patrocínio e premiações.
- Preço de ingresso, público, capacidade, manutenção e ampliação de estádio.
- Base: geração limitada, estimativa, promoção, dispensa e desenvolvimento.
- Evolução, estagnação, declínio, aposentadoria e reposição do universo.
- Objetivos de diretoria, torcida, confiança, demissão, propostas e troca de clube.
- Notícias por template, histórico de temporada, campeões, artilharia, recordes e ídolos.
- Duas divisões iniciais com acesso/rebaixamento e geração da temporada seguinte.
- Prestígio básico do treinador e primeiro leaderboard global derivados dos eventos da carreira.
- Compactação/arquivamento de históricos antigos e migrations explícitas de save.

**Gate de saída:** simulação automatizada de 20–30 temporadas mantém quantidade de jogadores, distribuição de
força, salários, caixa e transferências em faixas definidas; dinheiro só nasce de transação identificada; clubes da
IA preenchem posições e não acumulam elenco indefinidamente; demissão/troca de clube preserva a carreira.

### Fase 5 — Pirâmide e calendário completos do MVP

**Estimativa:** 6–9 semanas

**Mapeamento:** M2

**Dependência:** economia, progressão e duas divisões estáveis da Fase 4

**Objetivo:** entregar a identidade brasileira e a fantasia de ascensão sem quebrar o calendário.

**Entregáveis:**

- Motor data-driven para `LeagueStage`, `GroupStage`, `KnockoutStage`, qualificações e desempates.
- Três divisões nacionais com acesso e rebaixamento.
- Copa nacional em mata-mata.
- Estaduais simplificados, turno único e estados definidos pelo conteúdo.
- Continental com pré, grupos e mata-mata.
- Geração da temporada seguinte a partir dos resultados da anterior.
- Validador de calendário para conflitos, intervalo, ida/volta, participantes, fases e datas reservadas.
- Premiações, vagas, prestígio e eventos de domínio por conquista.
- Testes de configuração por competição, sem branches hard-coded por torneio.

**Gate de saída:** milhares de temporadas fecham todas as competições; nenhum clube joga simultaneamente; todos os
classificados, promovidos e rebaixados alimentam corretamente a temporada seguinte; todo calendário inválido é
recusado antes do início da temporada.

### Fase 6 — Experiência mobile-first e campo 2D

**Estimativa:** 6–9 semanas

**Mapeamento:** M3

**Dependência:** loop e calendário completos das Fases 3–5

**Objetivo:** transformar o sistema validado em produto claro, rápido e com identidade própria.

**Entregáveis:**

- Design tokens, temas claro/escuro, tipografia esportiva e iconografia consistente.
- Shell mobile com bottom navigation; desktop com enhancement multi-painel.
- Visão geral, caixa de entrada, calendário, elenco, tática, mercado, competições, clube, finanças, história e mundo.
- Listas densas responsivas, busca, filtros, comparação e virtualização quando necessária.
- Campo 2D esquemático render-only sobre a timeline, com feed, momento, xG-lite, notas e estatísticas.
- Resultado instantâneo sempre disponível a um toque.
- PWA instalável, estados offline/de rede claros, reconexão e prevenção de comando duplicado.
- WCAG: semântica, foco, contraste, leitores de tela, redução de movimento e alternativas ao arraste/2D.
- Testes E2E dos caminhos críticos em viewport mobile e desktop.

**Gate de saída:** toda funcionalidade do MVP é concluível num celular; nenhuma animação bloqueia avanço; LCP da
área autenticada fica abaixo de 2,5 s no perfil acordado; primeira partida e rodada continuam dentro das metas.

### Fase 7 — Conteúdo real, editor e importação

**Estimativa:** 5–8 semanas

**Mapeamento:** M4

**Dependência:** schemas de domínio e competição estabilizados nas Fases 4–5

**Objetivo:** transformar `dados/elencos/` em conteúdo versionado, consistente e atualizável, oferecendo as
ferramentas de edição previstas.

**Pipeline recomendado:**

```text
Markdown bruto e imutável
  -> parser por versão de formato
  -> normalização de clubes, pessoas e posições
  -> resolução de identidade e duplicatas
  -> validação de cobertura e referências
  -> snapshot canônico versionado
  -> seed/import transacional
  -> relatório de diferenças e rejeições
```

**Entregáveis:**

- Schema canônico de conteúdo: clubes, jogadores, competições, participações, contratos, assets e proveniência.
- Catálogo de lançamento com ao menos os 60 clubes das três divisões e os participantes adicionais necessários
  para estaduais, copa e continental, distinguindo clubes jogáveis de participantes de apoio quando aplicável.
- IDs estáveis independentes de nome, camisa, clube atual e competição.
- Mapa de posições heterogêneas (`GOL`, `Goleiro`, `ATA`, `Centroavante` etc.) para enums do domínio.
- Deduplicação entre os seis arquivos e separação entre plantel do clube e inscrição em competição.
- Tratamento explícito de `—`, `#?`, `[parcial]`, conflitos e divergências, sem preencher por invenção silenciosa.
- Validações de elenco mínimo, goleiros, duplicatas, participantes e referências órfãs.
- Versionamento por data de snapshot e compatibilidade com saves existentes.
- Interface administrativa de preview/diff e importação segura.
- Editor básico gratuito e editor completo condicionado à licença.
- Import/export sem execução de código arbitrário; limites, sanitização e manifesto versionado.

**Gate de saída:** importação é determinística e repetível; nenhuma pessoa ou clube duplicado é criado por
sobreposição de competições; conteúdo inválido não chega ao save; atualização de conteúdo não altera carreira já
iniciada sem migration explícita; os relatórios permitem rastrear cada dado até o arquivo de origem.

### Fase 8 — Ranking, entitlements e monetização

**Estimativa:** 5–8 semanas

**Mapeamento:** início do M5

**Dependência:** carreira, conteúdo e UX do MVP completos nas Fases 4–7

**Objetivo:** completar a proposta social e o modelo de negócio sem comprometer integridade ou velocidade.

**Entregáveis:**

- Prestígio do treinador derivado de eventos autoritativos: títulos, copa, continental, acessos e longevidade.
- Leaderboards global, Ascensão/Underdog e mensal, com paginação e snapshots.
- Proteções contra estado impossível, duplicação de pontuação e abuso básico.
- Entitlements centralizados para grátis e licença completa.
- Regras grátis/pagas da matriz normativa, incluindo escolha de clube e limites de save.
- Provedor de billing encapsulado (**Woovi**, PIX QR Code) para licença única: criação de cobrança, consulta de
  status, expiração, confirmação por webhook idempotente e reembolso, com adapter fake/fixtures locais durante o
  `/goal`; cobrança real só no checklist final.
- Fluxos de compra, restauração de entitlement, expiração, confirmação, falha e reembolso.
- Perfil, privacidade, termos, suporte e exclusão/exportação de dados conforme requisitos aplicáveis.
- Métricas do funil: ativação, engajamento, retenção, qualidade e conversão.

**Gate de saída:** ranking só aceita conquistas produzidas pelo backend; webhooks repetidos não duplicam entitlement;
falha no billing não corrompe carreira; usuário grátis joga o loop completo; licença é pagamento único e dinheiro
real não altera atributos, resultados ou recursos esportivos.

### Fase 9 — Hardening, beta fechada e lançamento

**Estimativa:** 5–8 semanas

**Mapeamento:** conclusão do M5 e MVP público

**Dependência:** todos os gates das Fases 0–8

**Objetivo:** provar que o produto sobrevive a uso real, falhas operacionais e carreiras longas.

**Entregáveis:**

- Sentry, logs estruturados, métricas de API/worker/filas e tracing dos comandos críticos.
- Dashboards e alertas para erro de save, fila parada, latência, calendário inválido e falha de billing.
- Backups automatizados, restore testado, rollback de aplicação e migration rehearsal.
- Rate limiting, headers, CORS/CSRF conforme fluxo, gestão de segredos e revisão de autorização por recurso.
- Testes de carga: avanços concorrentes, ranking, mercado, importação e jobs longos.
- Matriz de compatibilidade de browser/PWA e testes em celulares modestos.
- Smoke tests e playthroughs automatizados por marco; beta humana fechada somente nesta fase, com saves
  descartáveis e reais.
- Balanceamento orientado por telemetria e simulações, não por alteração manual sem baseline.
- Landing, onboarding, suporte mínimo, status/incident playbook e checklist de lançamento.
- Gates comerciais e jurídicos concluídos para conteúdo, billing, privacidade e termos.
- `FINALIZATION-CHECKLIST.md` consolidando credenciais de produção, DNS, billing real, serviços contratados,
  revisão jurídica/comercial, aceite humano e publicação.
- Teste qualitativo com 3–5 pessoas: cada uma consegue jogar pelo menos 10 das 14 rodadas, toma decisões de
  escalação/tática, compreende os resultados e manifesta vontade de concluir ou reiniciar a temporada.

**Gate de saída:** zero falha conhecida de corrupção/perda de save; restore executado com sucesso; erros críticos de
autorização resolvidos; p95 de avanço e interface dentro das metas; calendário/economia aprovados em simulação longa;
beta confirma entendimento do loop e vontade de seguir por múltiplas temporadas; checklist manual final executado
ou cada pendência externa explicitamente identificada como bloqueio real do lançamento.

## 9. Mapeamento para os marcos normativos

| Marco existente | Fases deste roadmap | Evidência de conclusão |
|---|---|---|
| **M1 — Núcleo autoritativo jogável** | 0–4 | Loop completo, duas divisões iniciais, feed, save, carreira longa e prestígio básico |
| **M2 — Profundidade competitiva** | 5 | Série C, copa, estaduais, continental e calendário íntegro |
| **M3 — Encantamento visual** | 6 | Identidade aplicada, feed polido e 2D leve skippable |
| **M4 — Conteúdo e comunidade** | 7 | Dados reais normalizados, editor e import/export seguro |
| **M5 — Monetização e lançamento** | 8–9 | Ranking segmentado, licença Woovi/PIX, entitlements, telemetria e hardening |

## 10. Testes que acompanham todas as fases

### Engine e domínio

- **Testes unitários:** exemplos conhecidos de regras e value objects.
- **Golden tests:** seeds e entradas fixas comprovam determinismo e detectam alteração de resultado entre versões.
- **Property-based tests:** entradas geradas procuram violações de invariantes em partidas, calendários,
  classificação, transferências e economia.
- **Simulação Monte Carlo:** milhares de partidas, temporadas e carreiras calibram distribuições, favoritismo,
  zebras, mando, gols, cartões, lesões e efeitos táticos.
- Os testes de propriedade verificam o que nunca pode acontecer; Monte Carlo mede com que frequência os resultados
  válidos acontecem. Um não substitui o outro.
- Invariantes executadas no CI e no importador de conteúdo.

### Persistência e aplicação

- Integração real com Postgres e Redis, evitando mocks nas garantias críticas — **exceto durante o `/goal`
  autônomo definido em `GOAL.md`**, em que valem adapters in-memory e a conexão/teste real fica para o
  `FINALIZATION-CHECKLIST.md` (Supabase e demais serviços no final).
- Contract tests entre web, API, worker e schemas Zod.
- Migração de save com fixtures de versões anteriores.
- Testes de idempotência, concorrência, retry e recuperação após falha.
- E2E mobile-first para cadastro, carreira, rodada, mercado, temporada, ranking e compra.

### Segurança, acessibilidade e operação

- Autorização cruzada: um usuário nunca lê ou muta a carreira de outro.
- Validação e sanitização de imports e assets.
- Auditoria de dependências e segredos.
- Axe/Playwright, teclado, leitores de tela e redução de movimento.
- Load tests com filas e carreiras concorrentes.
- Restore periódico de backup em ambiente isolado.

## 11. Definition of Done do MVP

O MVP só está pronto quando todos os itens abaixo forem verdadeiros:

### Produto e gameplay

- O loop completo funciona do cadastro à segunda temporada e continua por dezenas de temporadas.
- Primeira partida em até 5 minutos e rodada comum em até 2 minutos.
- Cada rodada produz ao menos uma consequência clara e, quando aplicável, uma decisão significativa.
- Mercado, base, finanças, estádio, diretoria, torcida e carreira afetam uns aos outros.
- Acesso, rebaixamento, copa, estaduais e continental fecham e regeneram corretamente.
- Resultado instantâneo, feed e 2D representam a mesma simulação.

### Plataforma e integridade

- Estado canônico vive no servidor; engine é determinístico por seed e versão.
- Saves possuem snapshot, eventos relevantes, checksum e versões completas.
- Avanço, transferência e billing são idempotentes e protegidos contra concorrência.
- Backups, restore e rollback foram testados.
- Metas de performance são atendidas ou formalmente revisadas com evidência.

### Experiência

- Todo fluxo funciona de ponta a ponta no celular e também com teclado.
- Pular para o resultado está sempre a um toque durante a apresentação da partida.
- Alertas explicam impacto, ação e prazo.
- Não há bloqueios por animação, energia, timer ou anúncio no loop.

### Conteúdo, social e negócio

- Os datasets reais possuem pipeline reproduzível, proveniência e versionamento.
- Ranking global, Ascensão/Underdog e mensal são derivados do backend.
- Editor básico e completo respeitam entitlements e segurança de importação.
- Grátis e licença única via Woovi/PIX seguem a matriz normativa.
- Telemetria mede ativação, engajamento, retenção, qualidade e conversão.
- Gates jurídicos/comerciais necessários ao lançamento foram formalmente resolvidos.

## 12. Fora do MVP

Não antecipar durante os marcos acima:

- Campo 3D/Three.js.
- Sete habilidades numéricas visíveis e treino semanal.
- Modo ranqueado normalizado.
- Multiplayer, ligas privadas, mercado humano, draft ou co-op.
- Seleções, Mundial e continentais europeias.
- Estaduais completos de todos os estados/divisões.
- Academia sub-21 formal, prêmios avançados e galeria 3D.
- Workshop hospedado com descoberta pública.
- IA generativa decidindo fatos do mundo ou resultados.
- App nativo.
- Clube Online, assinatura/recorrência e integração Stripe.

Preparar fronteiras para essas extensões não significa implementá-las antes do MVP.

## 13. Riscos principais e mitigação

| Risco | Probabilidade/impacto | Mitigação no roadmap |
|---|---|---|
| Economia degrada após muitas temporadas | Alta/Muito alto | Ledger, simulação de 20–30 temporadas e gates na Fase 4 |
| Calendário entra em estado inválido | Alta/Muito alto | DSL data-driven, validador pré-temporada e property tests na Fase 5 |
| Save quebra após atualização | Média/Muito alto | Versionamento desde Fase 2, fixtures, backup e rollback |
| IA de mercado destrói elencos | Alta/Alto | Restrições, métricas de distribuição e simulações longas |
| Escopo excede capacidade solo | Alta/Muito alto | Uma slice ativa, gates obrigatórios e fast-follow congelado |
| Agentes geram código inconsistente | Alta/Alto | Contratos/ADRs, CI obrigatório, revisão humana em áreas críticas |
| Dados reais são duplicados/incompletos | Alta/Alto | Pipeline com IDs estáveis, proveniência, rejeições e diff |
| Ranking premia apenas grind | Alta/Médio | Leaderboard Underdog e mensal; normalizado fica pós-MVP |
| Infra online prejudica rodada rápida | Média/Alto | Batch, worker separado, SSE, retries e metas desde Fase 2 |
| Mobile vira adaptação tardia | Média/Alto | Fluxo mobile obrigatório em todos os gates de UI |
| Conteúdo/marcas impedem lançamento | Indefinida/Muito alto | Gate jurídico/comercial antes da beta pública |

## 14. Estimativa consolidada

| Bloco | Faixa |
|---|---:|
| Fases 0–2: baseline mínimo, laboratório e vertical slice online | 10–15 semanas |
| Fases 3–5: matchday, carreira longa e competições | 19–28 semanas |
| Fases 6–8: UX/2D, conteúdo/editor, ranking/licença PIX | 16–25 semanas |
| Fase 9: hardening e lançamento | 5–8 semanas |
| **Total sequencial provável** | **50–76 semanas efetivas** |

Para uma pessoa, o MVP descrito é um projeto de aproximadamente **12–18 meses em dedicação integral**. A faixa
inclui integração e retrabalho razoáveis, mas não contempla espera externa por contratação, aprovação jurídica,
licenciamento, produção artística extensa ou operação em dedicação parcial.

Ferramentas de IA reduzem tempo de boilerplate, testes, documentação e investigação. Elas não removem o custo de
balanceamento, decisões de produto, revisão de segurança, validação de saves, QA em dispositivos e operação.

## 15. Próximos passos imediatos

1. Aprovar este roadmap como plano operacional do objetivo completo.
2. ~~Registrar o override de elencos reais na documentação normativa~~ **feito** (`docs/08`, `docs/00`, `docs/03`,
   `docs/06` + cola `dados/elencos/forca-relativa-cola.md`).
3. Criar um único `/goal` com o objetivo do `GOAL.md` e `token_budget: 1000000`; se rejeitado, usar o maior valor
   aceito pela plataforma.
4. Fazer o baseline inicial da documentação e dos dados brutos, preservando o estado de partida.
5. Executar automaticamente as Fases 0–9 em ordem, corrigindo gates antes de avançar e sem pedir aprovações
   intermediárias.
6. Manter `FINALIZATION-CHECKLIST.md` acumulando somente ações que realmente dependam do responsável ou de serviço
   externo.
7. Apresentar o MVP completo, as evidências de cada gate e o checklist manual em uma única revisão final.

---

> **Regra de execução:** se uma entrega não melhora o loop, não reduz um risco do caminho crítico ou não é
> necessária para lançar o MVP normativo, ela não entra no marco atual.

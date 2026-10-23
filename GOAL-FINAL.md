/goal Entregar o Footebas completo, jogável e publicado em footebas.com.br, partindo da branch `mvp/fase-6-9`, com você orquestrando e implementando via subagentes Opus em paralelo.

## Objetivo

Um jogador entra com Google ou link mágico, cria carreira, joga temporadas inteiras (todas as competições, mercado, finanças, diretoria) e disputa o ranking global, tudo na nuvem, no celular e no desktop.

## Estado atual (não refazer)

- Agregado único de carreira (ADR 0006), catálogo v3 (71 clubes, 2.310 atletas, destaques), motor estável no prefixo, prévia de partida exata.
- API em Cloudflare Workers (`apps/api/src/worker.ts`, `footebas-api.marciopetigrosso.workers.dev`): Hyperdrive → Supabase Postgres (`supabase/migrations`), Queues `footebas-simulation` + DLQ, JWT Supabase via JWKS.
- Web Next.js com `HttpCareerApi` (`NEXT_PUBLIC_API_URL`).
- Escopo de telas decidido: `docs/09-telas-e-escopo.md` (fonte de verdade de UI).

## O que fazer, nesta ordem

1. Nuvem: login Supabase no web (Google + link mágico) substituindo a sessão dev; web no Cloudflare via OpenNext; domínios `footebas.com.br` (web) e `api.footebas.com.br` (API) quando a zona ativar; teste de fumaça ponta a ponta na nuvem (criar carreira, jogar uma rodada, recarregar).
2. Telas de `docs/09`: Início (contadores em cache), Nova Carreira em etapas (Continente "em breve", emblemas genéricos, elenco com destaques, treinador com nacionalidade/avatar/personalidade, nome da carreira), Carregar Carreira, Central, Mapa (ilustração clicável), Elenco (campo com arrastar + alternativa por teclado, escalações salvas), Mercado, Escritório, Temporada, Ranking (tela própria).
3. Sistemas novos no servidor: personalidade do treinador com efeito nas regras; 1 carreira grátis / 5 com licença; janelas de transferência, venda/empréstimo do elenco e IA de mercado; patrocínio negociável e sócio-torcedor; e-mails com decisões; estatísticas de temporada; ranking global com snapshots.
4. Fase 8: licença única via Woovi PIX (cobrança, webhook idempotente, reembolso), entitlements centralizados, perfil, termos e privacidade.
5. Fase 9: reduzir o save (catálogo compartilhado por versão + deltas por carreira), observabilidade, rate limiting, backups/restore, CI no GitHub Actions com suíte completa, E2E Playwright no CI.
6. Landing arcade (sem marcas Brasfoot/FIFA), por último.

## Fora do escopo

Continente jogável, mapa navegável com movimento, escudos reais, bola parada/batedores, relacionamentos individuais, assinatura/Clube Online, Stripe, 3D, multiplayer.

## Regras

- Hierarquia: `docs/09` → ADRs → `ROADMAP-MVP.md` → `docs/08`. Decisão nova vira ADR curto.
- Servidor autoritativo; motor puro e determinístico; nada de dado inventado (pesquisa ausente vira nota).
- Português do Brasil com acentos na UI e nos docs.
- Notebook fraco: vitest com 1 worker, nunca lint e testes ao mesmo tempo, localmente só testes/lint dos arquivos alterados; suíte completa e builds pesados no CI.
- Segredos, senhas, login em contas, OAuth do Google, DNS no registro.br e pagamento real: pedir ao humano e listar em `FINALIZATION-CHECKLIST.md`; nunca digitar segredo.

## Orquestração

- Você é o orquestrador: quebra cada etapa em fatias independentes, despacha até 3 subagentes Opus em paralelo, cada um em worktree isolado (`isolation: worktree`), com brief enxuto (objetivo, arquivos, contratos, testes).
- Cada subagente implementa, testa só o que tocou, faz commit na própria branch e devolve: hash, testes, decisões, bloqueios.
- Você revisa, integra na `mvp/fase-6-9`, roda o gate da etapa, atualiza `IMPLEMENTATION-STATE.md` e despacha a próxima onda.
- Nunca dois subagentes no mesmo arquivo, pacote de domínio ou migration.
- Abrir PR para `main` ao fim de cada etapa e deixar o CI validar.

## Concluído quando

Todas as etapas 1–6 entregues, CI verde, footebas.com.br no ar com login real, uma temporada completa jogável na nuvem, licença PIX funcionando em sandbox, e `FINALIZATION-CHECKLIST.md` só com pendências humanas.

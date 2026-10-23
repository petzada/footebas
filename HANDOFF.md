# Handoff — continuação da entrega final do Footebas

Atualizado em 2026-10-23 (madrugada). Leia junto com `IMPLEMENTATION-STATE.md`, `FINALIZATION-CHECKLIST.md`,
`docs/09-telas-e-escopo.md` (decisões 1–20) e os ADRs 0009–0016. Branch de integração: `mvp/fase-6-9` (PR
petzada/footebas#1 → `main`). Regras da máquina do `~/.claude/CLAUDE.md` continuam valendo (até 3 subagentes,
worktree para quem edita, vitest com 1 worker, nunca lint e testes juntos, suíte completa só no CI).

## No ar agora

- **Hosts** (um Worker `footebas-web`, OpenNext): `lp.footebas.com.br` = landing arcade; `game.footebas.com.br` =
  login e jogo; `footebas.com.br` e `www` → 308 para `lp.`; `/auth/*` dos hosts antigos → 307 para `game.`. Os
  hosts são casados com regex ancorada em `apps/web/next.config.ts` (o OpenNext não ancora `has.host`), e o
  rewrite de `/` no `lp.` é `beforeFiles`. `lp./:path*` também mostra a landing (navegadores que guardaram o 308
  quebrado do primeiro deploy).
- **Deploy do web:** o bundle é gerado no workflow `deploy-web` (Linux) a cada push em `mvp/fase-6-9`; publicar
  com `gh run download <id> -n footebas-web-open-next -D apps/web/.open-next` e `cd apps/web && npx wrangler
deploy` (no Windows o `cf:build` local falha por symlink; se o deploy der erro genérico, repetir).
- **API** `https://api.footebas.com.br` (Worker `footebas-api`): Durable Object por carreira, save v3 enxuto,
  Queues de simulação, cron a cada 15 min (reconciliação de pagamentos + ranking), R2 de avatares
  (`cdn.footebas.com.br`). Deploy: `cd apps/api && npx wrangler deploy`. **Antes**, recompilar os pacotes
  (`pnpm --filter @footebas/<pkg> build` para domain, contracts, engine, content, database, application): os apps
  consomem os pacotes pelo `dist/`.
- **Banco:** migrations aplicadas até `20261027000300_ranking_avatar.sql` (`npx supabase db push`).
- **Licença:** R$ 29,90 (`LICENSE_PRICE_CENTS=2990`), PIX dinâmico da AbacatePay por usuário, válido 15 min
  (`LICENSE_CHARGE_EXPIRES_IN=900`). Segredos `ABACATEPAY_API_KEY` (produção) e `ABACATEPAY_WEBHOOK_SECRET`
  gravados; webhook cadastrado no painel. O QR aponta para `qr.woovi.com` porque a AbacatePay processa o PIX pela
  Woovi; o recebedor é a Marct Soluções Digitais (CNPJ 63.940.273/0001-36).
- **Fumaça:** `API_URL=https://api.footebas.com.br SMOKE_TOKEN=<token> SMOKE_P95_MS=5000 pnpm smoke:cloud`. O
  token está em `.env.local.txt` (ignorado pelo git) e no secret `SMOKE_TOKEN` do Worker. Última execução verde:
  CreateCareer ~1,5 s, SelectClub ~1,3 s, demais 0,2–0,9 s.

## Entregue em 2026-10-23

- Elenco novo (card do atleta, campo SVG) e Nova Carreira em 6 etapas integrados.
- Fim de partida: placar grande, "Preparar próxima rodada" e resumo; sem campo 2D, replay, "Visual simples",
  momento ou xG-lite depois do apito (também no resultado instantâneo).
- Notícias, História, Ranking e Save (aba do Mundo, "Ver todas") alimentados pelos mesmos dados da Central.
- Escalação sempre apta: o assistente troca titulares lesionados/suspensos em todos os caminhos (instantâneo,
  pular, narrado); erros do servidor sempre em português na web.
- Licença endurecida: casamento por id da cobrança AbacatePay, reconciliação no cron, estorno/disputa fora do app
  revogam, clique duplo não gera duas cobranças, `REFUNDED`/`UNDER_DISPUTE` nunca liberam; após reembolso a carreira
  mais antiga segue jogável e as demais ficam bloqueadas (com "Desbloquear").
- Paywalls claros (clube da Série A/B, limite de 1 save) e tela do PIX com cadeado "Ambiente seguro", valor acima
  do QR, contador abaixo, copia e cola, copiar e "Pagar depois" no rodapé.
- Narração dos chutes com finalizador, jogada e desfecho; velocidade 0,5× aceita no contrato.
- Avatar do treinador no ranking (snapshots + tela) e rótulos da barra inferior cabendo em 320–375 px.
- Latência: CreateCareer de 9 para 6 idas ao banco, objeto da carreira aquecido após criar, JWKS em cache.
- Landing e login ajustados pela sessão da landing (preço, CNPJ, logo sem bola, "operado por").

## Pendências

1. **Escudos que faltam** (responsável vai enviar): Vasco, Remo, Athletic Club, Cerro Porteño; confirmar São
   Bernardo e Itabaiana. Recorte igual a `apps/web/public/crests`.
2. **Webhook AbacatePay real:** o formato do payload foi inferido. Na primeira compra real, conferir nos Workers
   Logs se aparece `billing.completed_not_paid` (pagamento confirmado que não virou licença).
3. **Latência abaixo de 0,8 s:** o resto é distância Worker (Brasil) ↔ Supabase (`us-east-1`). Decisão de
   infraestrutura: Smart Placement, `locationHint` nos objetos ou Supabase em `sa-east-1`. Conferir também se o
   cache de consultas do Hyperdrive está desligado.
4. **Ranking vazio** até alguém fechar uma temporada (regra do ADR 0013). Mudar exige decisão.
5. **Regra a decidir:** depois de um reembolso, excluir a carreira mais antiga libera a próxima (mesmo da Série
   A/B) no plano grátis.
6. **Fechar a etapa:** PR #1 com CI verde → aprovação do responsável → merge em `main`. Itens humanos no
   `FINALIZATION-CHECKLIST.md` (jurídico, escudos, modelo 3D, beta fechada).

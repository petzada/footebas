# Checklist de finalização externa

Somente ações que exigem pessoa, credencial, conta ou decisão externa. O agente implementa, testa e publica tudo o
que não depende destes itens; cada item diz o que destrava.

## Nuvem e login

1. **Chave pública do Supabase no build do web.** Em GitHub → `petzada/footebas` → Settings → Secrets and variables
   → Actions → _Variables_, criar `NEXT_PUBLIC_SUPABASE_ANON_KEY` com a chave _anon/publishable_ (Supabase → Project
   Settings → API). Destrava o workflow `deploy-web`, que gera o bundle OpenNext em Linux.
2. **(Opcional) Deploy automático do web.** Criar um API token do Cloudflare com permissão _Workers Scripts: Edit_ e
   _Workers Routes/Custom Domains_ na zona `footebas.com.br`, salvar como _secret_ `CLOUDFLARE_API_TOKEN` e a variável
   `CLOUDFLARE_ACCOUNT_ID=106cf131868ebc0cef16b7905e9d181a`. Sem isso, o agente baixa o artefato do workflow e publica
   com o login local do wrangler.
3. **Google OAuth.** O provedor Google já está ativo no Supabase. Confirmar no Google Cloud Console que o client OAuth
   tem como URI de redirecionamento autorizado `https://wjisqiiwsuykfbmqglfb.supabase.co/auth/v1/callback` e como
   origem JavaScript `https://footebas.com.br`; publicar a tela de consentimento (sair do modo "teste").
4. **SMTP próprio para o link mágico.** O SMTP padrão do Supabase envia poucos e-mails por hora. Configurar um SMTP
   (ex.: Resend, Amazon SES) em Supabase → Authentication → SMTP e remetente `nao-responda@footebas.com.br`.
5. **Validar login real** com uma conta Google e um e-mail de teste em `https://footebas.com.br`.

## Pagamento

6. **AbacatePay (PIX da licença, ADR 0016).**
   - A chave já está em `.env.local.txt` (ignorado pelo git). Para levá-la ao Worker sem copiar e colar, rode na raiz do
     repositório (Git Bash):
     `grep -i '^ABACATEPAY_API_KEY=' .env.local.txt | cut -d= -f2- | tr -d '
"' | pnpm --filter @footebas/api exec wrangler secret put ABACATEPAY_API_KEY`
   - Gravar os segredos sem colar no chat:
     `pnpm --filter @footebas/api exec wrangler secret put ABACATEPAY_API_KEY` e
     `pnpm --filter @footebas/api exec wrangler secret put ABACATEPAY_WEBHOOK_SECRET` (uma frase longa e aleatória).
   - A chave precisa das permissões `TRANSPARENT:CREATE`, `TRANSPARENT:READ` e `REFUND:CREATE`.
   - No painel da AbacatePay, criar o webhook com endpoint `https://api.footebas.com.br/v1/billing/webhook`, o mesmo
     secret do passo anterior e os eventos `transparent.completed` e `transparent.refunded`.
   - Testar em modo dev (pagamento simulado e reembolso) e, com a conta de produção aprovada (CNPJ), trocar a chave.

## Qualidade, jurídico e lançamento

7. **Escudos dos clubes** (`apps/web/public/crests`, recortados das folhas em `public/images`): são marcas registradas;
   decidir com revisão jurídica se ficam no lançamento público ou voltam ao emblema genérico.
8. **Modelo 3D do estádio** (`football-field`, `football-court`): confirmar a origem e a licença de uso comercial (e
   se exige crédito ao autor) antes do lançamento.
9. Matriz de celulares reais, leitor de tela e medições de LCP em aparelho.
10. Revisão jurídica/comercial: marca, uso de nomes reais de clubes e atletas, termos, privacidade, suporte e
    tributação da licença.
    - **Preencher os marcadores `[preencher]`** das páginas públicas `/termos` e `/privacidade`
      (`apps/web/components/legal-page.tsx`, constante `LEGAL_PLACEHOLDER`): razão social, CNPJ, endereço, e-mail
      de contato, encarregado de dados (DPO) e data da última atualização. Depois da revisão jurídica, remover o
      selo "versão preliminar — sujeita a revisão jurídica" (`LEGAL_DRAFT_NOTICE`) e confirmar os prazos de
      retenção declarados (registros técnicos 90 dias, fiscais 5 anos) com quem opera a infraestrutura.
11. Beta fechada com 3–5 pessoas e aceite qualitativo do loop.
12. Aceite humano final.

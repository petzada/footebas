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

6. **Woovi sandbox e produção.** Fornecer `WOOVI_APP_ID` e o segredo de webhook (via `wrangler secret put`, nunca no
   repositório) e cadastrar a URL do webhook no painel Woovi; realizar o primeiro pagamento e reembolso PIX reais.

## Qualidade, jurídico e lançamento

7. **Escudos dos clubes** (`apps/web/public/crests`, recortados das folhas em `public/images`): são marcas registradas;
   decidir com revisão jurídica se ficam no lançamento público ou voltam ao emblema genérico.
8. **Modelo 3D do estádio** (`football-field`, `football-court`): confirmar a origem e a licença de uso comercial (e
   se exige crédito ao autor) antes do lançamento.
9. Matriz de celulares reais, leitor de tela e medições de LCP em aparelho.
10. Revisão jurídica/comercial: marca, uso de nomes reais de clubes e atletas, termos, privacidade, suporte e
    tributação da licença.
11. Beta fechada com 3–5 pessoas e aceite qualitativo do loop.
12. Aceite humano final.

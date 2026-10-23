# Billing — licença única via PIX

**Provedor padrão: AbacatePay** (ADR 0016). Variáveis: `PAYMENT_PROVIDER=abacatepay` (var no `wrangler.jsonc`),
secrets `ABACATEPAY_API_KEY` e `ABACATEPAY_WEBHOOK_SECRET`. Webhook: `POST /v1/billing/webhook` com os eventos
`transparent.completed` e `transparent.refunded`; a AbacatePay envia o secret no parâmetro `webhookSecret` da URL.
Código: `abacatepay-client.ts` (cobrança, consulta, reembolso) e `abacatepay-webhook.ts` (autenticidade e efeitos).

O conteúdo abaixo documenta o provedor alternativo Woovi (`PAYMENT_PROVIDER=woovi`).

# Billing — licença única via Woovi/PIX (Fase 8)

Implementa a camada paga do MVP (`docs/05-monetizacao.md`): uma **licença única** paga por **PIX QR Code** na
Woovi, sem assinatura. A licença `active` em `footebas.licenses` é a fonte de verdade dos entitlements
(`PostgresEntitlements` em `@footebas/database`): `free` = 1 carreira e clube de baixo; `licensed` = 5 carreiras e
qualquer clube.

## Rotas

| Rota                         | Auth             | O que faz                                                                                                                                                                   |
| ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/me`                 | JWT              | Perfil (id, e-mail, nome), plano, entitlements e licença (com `refundableUntil`).                                                                                           |
| `POST /v1/billing/checkout`  | JWT              | Cria ou reaproveita o pedido pendente e devolve `brCode` (copia e cola), `qrCodeImage`, `paymentLinkUrl` e `expiresAt`. 409 se já licenciado.                               |
| `GET /v1/billing/orders/:id` | JWT (dono)       | Status do pedido; se pendente, consulta a Woovi para reconciliar caso o webhook atrase.                                                                                     |
| `POST /v1/billing/refund`    | JWT              | Reembolso integral em até **7 dias** do pagamento (CDC art. 49). Chama a Woovi e deixa `requested`; a confirmação chega pelo webhook e revoga a licença. 403 fora do prazo. |
| `POST /v1/billing/webhook`   | assinatura Woovi | Sem JWT. Verifica a assinatura, é idempotente e aplica o efeito numa transação.                                                                                             |

Erros da Woovi (rede, 4xx/5xx, AppID ausente) viram `502 payment provider unavailable`, sem detalhes internos.

## Fluxo

1. `checkout` grava `orders` (`pending`, `correlation_id = footebas_license_<id>`) e chama
   `POST /api/v1/charge?return_existing=true` — idempotente pelo `correlationID`. Um índice único parcial garante no
   máximo um pedido pendente por usuário; checkouts concorrentes reaproveitam o mesmo.
2. O usuário paga o PIX. A Woovi envia `OPENPIX:CHARGE_COMPLETED`; o webhook marca o pedido `paid` e faz upsert da
   licença `active` **na mesma transação** que grava o evento. Valor divergente do pedido não concede licença
   (`amount_mismatch`).
3. `OPENPIX:CHARGE_EXPIRED` expira o pedido pendente; um novo checkout abre outra cobrança.
4. Reembolso: `POST /api/v1/charge/{correlationID}/refund` com `correlationID` próprio
   (`<pedido>_refund_<tentativa>`). `PIX_TRANSACTION_REFUND_SENT_CONFIRMED` ⇒ pedido `refunded` + licença `revoked`;
   `PIX_TRANSACTION_REFUND_SENT_REJECTED` ⇒ licença mantida, nova tentativa permitida. O pedido é localizado pelo
   `endToEndId` do PIX original ou do reembolso.

### Idempotência do webhook

A Woovi **não envia id de evento**. A chave em `webhook_events.id` é derivada:
`<evento>:<charge.correlationID>` para eventos de cobrança, `<evento>:<refundTransaction.endToEndId>` para
reembolsos e `<evento>:sha256(corpo)` para o resto. Reentregas caem no `on conflict do nothing` e respondem
`{ duplicate: true }`. Eventos desconhecidos (inclusive o teste de cadastro, `{"evento":"teste_webhook"}`) são
aceitos com `outcome: "ignored"`.

### Assinatura do webhook

Conforme a documentação vigente da Woovi (`/docs/webhook/seguranca/webhook-signature-validation` e
`/docs/webhook/seguranca/webhook-public-keys`):

- header `x-webhook-signature` = **base64(RSA-SHA256(corpo cru))** assinado com a chave privada da Woovi;
- chaves públicas em `GET <WOOVI_API_URL>/api/v1/webhook/public-keys` (sem auth). Durante rotação mais de uma chave
  vale, então qualquer chave listada é aceita;
- a verificação usa o corpo **exatamente como recebido** (o roteador guarda `rawBody` antes do `JSON.parse`).

O `X-OpenPix-Signature` (HMAC-SHA1) é legado/deprecado e não é usado. Como defesa extra opcional,
`WOOVI_WEBHOOK_SECRET` exige também que o header `authorization` (configurado no painel em "Cabeçalhos HTTP") seja
igual ao segredo (comparação em tempo constante).

### Dados pessoais (LGPD)

Payloads da Woovi trazem CPF, nome e conta do pagador. Antes de gravar em `webhook_events.payload` e
`orders.woovi_charge`, a API remove `customer`, `payer`, `taxID`, `debitParty`, `creditParty`, `holder`,
`infoPagador`, `email`, `phone` e `name`.

## Variáveis e segredos

| Nome                        | Tipo                | Padrão                          | Observação                                                                                             |
| --------------------------- | ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `WOOVI_API_URL`             | var                 | `https://api.woovi-sandbox.com` | Produção: `https://api.woovi.com`. Nunca misture AppID de um ambiente com URL do outro.                |
| `WOOVI_APP_ID`              | **secret**          | —                               | `Authorization: <AppID>` (sem `Bearer`). Sem ele, checkout/reembolso respondem 502.                    |
| `WOOVI_WEBHOOK_PUBLIC_KEYS` | var/secret opcional | —                               | PEM(s) ou PEM em base64 para fixar a chave. Sem ele, a API busca e cacheia (1 h) as chaves publicadas. |
| `WOOVI_WEBHOOK_SECRET`      | **secret** opcional | —                               | Valor do header `authorization` configurado no webhook do painel.                                      |
| `LICENSE_PRICE_CENTS`       | var                 | `2990`                          | R$ 29,90, preço de lançamento definido pelo responsável em 2026-10-23.                                 |
| `LICENSE_CHARGE_EXPIRES_IN` | var                 | `900`                           | Validade do QR code em segundos (15 min; mínimo 300).                                                  |

Segredos só por `wrangler secret put` (nunca no repositório):

```sh
cd apps/api
npx wrangler secret put WOOVI_APP_ID
npx wrangler secret put WOOVI_WEBHOOK_SECRET   # opcional
```

## Banco

Migration `supabase/migrations/20261024000200_billing.sql`: `orders`, `webhook_events` e `licenses` no schema
`footebas`, com RLS ligado e `revoke` para `anon`/`authenticated` (só a API acessa).

## Passo a passo no sandbox (humano)

1. Criar conta em <https://app.woovi-sandbox.com/> (o sandbox tem cadastro próprio; dados de produção não valem lá).
2. **API/Plugins → Nova API/Plugin**, tipo **API**, salvar, ativar o segundo fator e copiar o **AppID**.
3. Local: `WOOVI_APP_ID=<appid-sandbox> pnpm --filter @footebas/api dev` (sem `WOOVI_APP_ID` o dev server usa o
   `FakeWooviClient`, totalmente offline).
4. Expor a API local por um túnel HTTPS (ex.: `cloudflared tunnel --url http://127.0.0.1:8787`).
5. No painel do sandbox, **API/Plugins → Webhooks → Novo webhook**: URL `https://<túnel>/v1/billing/webhook`,
   eventos `OPENPIX:CHARGE_COMPLETED`, `OPENPIX:CHARGE_EXPIRED`, `PIX_TRANSACTION_REFUND_SENT_CONFIRMED` e
   `PIX_TRANSACTION_REFUND_SENT_REJECTED`. Opcional: em "Cabeçalhos HTTP", `authorization: <segredo>` e o mesmo
   valor em `WOOVI_WEBHOOK_SECRET`.
6. Fazer login no web, chamar `POST /v1/billing/checkout` e pagar a cobrança pelo painel do sandbox
   (conta de teste / "pagar PIX" do ambiente de testes).
7. Conferir `GET /v1/me` → `plan: "licensed"`; depois `POST /v1/billing/refund` e o evento de reembolso → `free`.

## Ativação em produção (humano)

1. Aplicar a migration no Supabase.
2. Conta Woovi de produção: gerar AppID de **API** (com 2FA) e `npx wrangler secret put WOOVI_APP_ID`.
3. Trocar `WOOVI_API_URL` para `https://api.woovi.com` em `wrangler.jsonc` e confirmar o preço em
   `LICENSE_PRICE_CENTS`.
4. Cadastrar o webhook `https://api.footebas.com.br/v1/billing/webhook` com os quatro eventos acima (e, opcionalmente,
   o header `authorization` + `WOOVI_WEBHOOK_SECRET`).
5. Opcional: fixar a chave pública em `WOOVI_WEBHOOK_PUBLIC_KEYS` (copiada de
   `https://api.woovi.com/api/v1/webhook/public-keys`); lembrar de atualizar em rotações.

## Testes

`apps/api/src/billing/*.test.ts` rodam sem rede: `FakeWooviClient` (`woovi-fake.ts`), `InMemoryBillingRepository`
(`billing-repository-memory.ts`) e um par RSA gerado no teste no lugar da chave da Woovi (`testing.ts`). O adapter
Postgres (`billing-repository-postgres.ts`) segue a mesma semântica e precisa ser validado contra o banco local do
Supabase antes do lançamento.

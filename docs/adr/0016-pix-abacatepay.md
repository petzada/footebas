# ADR 0016 — PIX da licença via AbacatePay

- Status: aceito (substitui a Woovi como provedor padrão)
- Data: 2026-10-23

## Contexto

A Fase 8 foi implementada com a Woovi (cobrança PIX, webhook assinado com RSA, reembolso). O responsável já tem conta
e chave de API na AbacatePay e pediu a troca do provedor da licença única.

## Decisão

1. **Provedor padrão: AbacatePay**, pelo Checkout Transparente PIX da API v2 (`https://api.abacatepay.com/v2`):
   `POST /transparents/create` (QR Code e copia-e-cola sem redirecionar), `GET /transparents/check` (reconciliação)
   e `POST /transparents/refund` (reembolso integral, confirmado na resposta). Autenticação `Bearer` com a chave de API;
   modo de teste ou produção é definido pela própria chave.
2. **Mesmo serviço de billing.** O cliente da AbacatePay implementa o mesmo port do provedor; o pedido guarda o id da
   cobrança na AbacatePay (`orders.provider_charge_id`) para consulta e reembolso. `externalId` da cobrança é o nosso
   `correlationId` (idempotência).
3. **Webhook** em `POST /v1/billing/webhook`: autenticado pelo `secret` que a AbacatePay envia no parâmetro
   `webhookSecret` da URL (comparação em tempo constante) e, quando presente, pela assinatura HMAC-SHA256 do corpo no
   header `X-Webhook-Signature`. Idempotência pelo `id` do evento. Eventos tratados: `transparent.completed` (licença
   ativa) e `transparent.refunded` (licença revogada); os demais são registrados e ignorados.
4. **Configuração:** var `PAYMENT_PROVIDER=abacatepay`; secrets `ABACATEPAY_API_KEY` e `ABACATEPAY_WEBHOOK_SECRET`. A
   Woovi continua disponível com `PAYMENT_PROVIDER=woovi`.

## Consequências

- Permissões necessárias na chave da AbacatePay: `TRANSPARENT:CREATE`, `TRANSPARENT:READ` e `REFUND:CREATE`.
- A conta de produção da AbacatePay exige CNPJ e análise de até 3 dias úteis; até lá, a chave de modo dev permite
  testar o fluxo inteiro (inclusive `POST /transparents/simulate-payment`).

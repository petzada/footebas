# Checklist de finalização externa

Este arquivo contém somente ativações, validações e decisões que exigem pessoa, credencial, serviço ou ambiente
externo. Nenhum item abaixo bloqueia os gates testáveis pelo agente.

1. Conectar Supabase (Postgres/Auth/Storage), executar migrations e testes de integração/backup/restore em DB real.
2. Conectar Redis/fila hospedada, se adotada, e executar testes de integração e recuperação da fila real.
3. Configurar OAuth Google e magic link/e-mail reais e validar os fluxos com contas de teste.
4. Conectar a Woovi real, validar assinatura de webhook e realizar o primeiro pagamento/reembolso PIX controlado.
5. Provisionar hosting e DNS e, se necessário, Cloudflare/R2.
6. Provisionar telemetria cloud opcional (Sentry/OTel/PostHog) e validar alertas/dashboards.
7. Executar Playwright/E2E em browsers reais, matriz mobile, acessibilidade assistiva e medições LCP em device.
8. Concluir revisão jurídica/comercial: marca, licenças de conteúdo, privacidade, termos, suporte e tributação.
9. Conduzir beta fechada com 3–5 pessoas e registrar o aceite qualitativo do loop.
10. Dar aceite humano final e publicar.

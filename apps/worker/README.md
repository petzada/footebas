# Footebas worker

`WorkerRuntime` executa `FootebasApplication.runNextJob()` em processo, de forma serial e testável. Retries usam tempo lógico, o limite de tentativas move o job para dead-letter e `shutdown()` impede novos trabalhos. A unidade de trabalho da aplicação continua sendo a autoridade de persistência e lock por carreira.

O adapter de produção futuro deverá usar BullMQ/Redis, preservar ordenação por carreira, limitar concorrência por `careerId`, implementar timeout cooperativo/cancelamento seguro, dead-letter, shutdown gracioso e health checks. Redis, BullMQ e conexões externas não são dependências desta fase.

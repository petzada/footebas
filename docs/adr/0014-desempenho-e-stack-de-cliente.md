# ADR 0014 — Desempenho: Durable Object por carreira, save enxuto e camada de dados no cliente

- Status: aceito
- Data: 2026-10-23

## Contexto

Medido em produção (2026-10-23), sem usuários: cada comando leva de 4 a 11 s e recarregar a carreira ~7 s. O save
tem ~2,6 MB de JSON (~400 KB comprimido no Postgres) e, a cada ação, é lido, validado por checksum canônico e regravado
inteiro, a partir de um Worker no Brasil falando com o Supabase em `us-east-1`. Abrir a Central dispara seis leituras
em paralelo e cada uma carrega o save completo. O responsável perguntou sobre PixiJS, Phaser, Three.js/React Three
Fiber, Zustand e TanStack Query.

## Decisão

1. **Durable Object por carreira** (já previsto no ADR 0005 para locks): o DO mantém o agregado quente em memória,
   serializa comandos (substitui o lock no Postgres), aplica cada comando em milissegundos e persiste o save no seu
   armazenamento; o Postgres segue como persistência durável de referência (gravação ao fim de cada comando que muda
   estado, de forma assíncrona e idempotente) e para índices e consultas entre carreiras (listagem, contadores,
   ranking, billing). Simulação de rodada continua no consumidor da fila, endereçando o mesmo DO.
2. **Save enxuto**: o catálogo estático (clubes e atletas da versão de conteúdo) é compartilhado por versão e
   embutido no código; o save guarda só o que muda na carreira (deltas de atletas, contratos, livro-caixa da
   temporada, competições, matchday). Alvo: < 200 KB por save. Checksum calculado sobre o save enxuto.
3. **Leitura em um passo**: endpoint único que devolve a Central inteira (home, elenco resumido, próximo jogo,
   tabela, caixa de entrada) numa resposta, com `ETag` pela versão do agregado.
4. **Cliente**: **TanStack Query** para dados do servidor (cache por carreira e versão, deduplicação, atualização
   otimista nos comandos, revalidação em segundo plano) e **Zustand** só para estado local de UI (escalação em edição,
   reprodução da partida, preferências). Migração gradual do adapter HTTP atual, tela por tela.
5. **Renderização**: sem PixiJS. **Phaser** e **Three.js** só na partida (estádio 3D + Phaser como nível 2D,
   ADR 0012), carregados sob demanda. Telas de gestão em React leve com o visual retrô; nada de React Three Fiber
   nelas. 3D extra apenas num destaque da landing ou do Início, carregado sob demanda e com fallback.
6. **Metas** (aparelho médio, 4G): comando comum < 800 ms p95 no servidor; troca de tela com dados em cache < 100 ms;
   primeira carga do app < 2,5 s LCP.

## Consequências

- O lock por carreira no Postgres e o `executeIdempotent` passam a viver no DO; a idempotência por chave continua.
- Saves existentes precisam de migração explícita para o formato enxuto (sem jogadores reais ainda, a migração pode
  recriar carreiras de teste).
- A fumaça na nuvem passa a medir latência e falha se o p95 de comando passar da meta.

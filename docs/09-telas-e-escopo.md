# Telas e escopo do MVP (decisões de 2026-10-22)

Fonte: especificação de telas do responsável, revisada de forma adversarial e decidida item a item. Este documento
complementa `docs/08-mvp-fonte-de-verdade.md`; em conflito sobre telas, vale este.

## Decisões

| #   | Tema                       | Decisão                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Modo "Continente inteiro"  | Aparece na Nova Carreira como **"em breve"** (bloqueado). O MVP joga só o universo atual: Séries A/B/C, estaduais, Copa do Brasil e Libertadores com os 10 estrangeiros fixos.                                                                                                                            |
| 2   | Mapa 2D do clube           | **Ilustração clicável** vista de cima (CT, estacionamento, estádio, sede, imprensa, casa do treinador) com áreas que levam às telas, alternativa em lista e sem bloquear avanço. Mapa navegável com zoom/movimento fica pós-MVP.                                                                          |
| 3   | Imagens dos clubes         | **Emblema genérico** gerado pelo jogo (cores e iniciais). Nenhum escudo ou logo real.                                                                                                                                                                                                                     |
| 4   | Personalidade do treinador | **Afeta o jogo**: 4 estilos (Motivador, Disciplinador, Diplomata, Estrategista) com efeitos mensuráveis e tom próprio em e-mails e notícias.                                                                                                                                                              |
| 5   | Carreiras por usuário      | **1 no grátis, 5 com licença única.** Cada carreira tem nome.                                                                                                                                                                                                                                             |
| 6   | Batedores de bola parada   | **Fora do MVP** (o motor não simula bola parada).                                                                                                                                                                                                                                                         |
| 7   | Mercado                    | **Duas janelas por temporada + venda/empréstimo do próprio elenco + IA de mercado** (propostas pelos seus atletas e negociações simples entre clubes).                                                                                                                                                    |
| 8   | Escritório                 | **Patrocínio negociável** (3 propostas por temporada) e **sócio-torcedor** (preço e benefícios, receita mensal, efeito em público/torcida). Relacionamentos individuais pós-MVP.                                                                                                                          |
| 9   | Contadores da tela Início  | Treinadores, clubes e atletas vindos do banco, com **cache de ~5 minutos** no edge.                                                                                                                                                                                                                       |
| 10  | Ranking global             | **Fica, com tela própria** (global, ascensão e mensal), só com conquistas validadas pelo servidor.                                                                                                                                                                                                        |
| 11  | Ordem de trabalho          | **Nuvem primeiro** (Hyperdrive, deploy, login Supabase em footebas.com.br), depois o redesenho das telas e os sistemas novos, landing por último.                                                                                                                                                         |
| 12  | Partida em Phaser          | **Cena Phaser só na partida** (carregada sob demanda) sobre a timeline oficial; coreografia é apresentação e nunca muda o resultado; campo 2D atual vira fallback. ADR 0010.                                                                                                                              |
| 13  | Apresentação premium       | Transições, animações de entrada, celebração de gol, sons com mudo e feedback em toda ação; respeita movimento reduzido. ADR 0010.                                                                                                                                                                        |
| 14  | Cards de atleta            | **Avatares gerados** por atleta, sem fotos reais (direito de imagem).                                                                                                                                                                                                                                     |
| 15  | Potencial e atributos      | Força, condição e moral em barras; **potencial só como faixa estimada** com incerteza.                                                                                                                                                                                                                    |
| 16  | Entrosamento               | **Nas regras do mundo** (bônus pequeno de força efetiva antes do motor); motor de partida intacto.                                                                                                                                                                                                        |
| 17  | Direção visual             | **Futebol retrô** (pixel art 16-bit, placar, giz, figurinhas), tema único, assets gerados por código ou com licença aberta, pseudo-3D no Phaser. ADR 0012 (substitui o 0009).                                                                                                                             |
| 18  | Pausas da partida          | A partida **para sozinha só 2 vezes: no intervalo e no fim**. Velocidades 0,5×/1×/2×/4× escolhidas pelo usuário são respeitadas; ele pode **pausar manualmente a qualquer minuto** e fazer substituições e ajustes táticos nessa pausa (o motor é estável no prefixo, então o que já aconteceu não muda). |
| 19  | Partida ao vivo            | Ao tocar em **Jogar partida**, o **campo animado (3D/Phaser/2D) roda ao vivo** desde o apito inicial, com placar e minuto por cima e a narração como legenda/letreiro sincronizada ao minuto; nada de feed só em texto antes do campo. O relatório pós-jogo vem depois do apito final.                    |

## Mapa de telas do MVP

- **Públicas:** landing arcade (por último; sem marcas Brasfoot/FIFA).
- **Início:** avatar grande, "Nova carreira" e "Carregar carreira", contadores em cache.
- **Nova Carreira:** modo treinador → "Só Brasil" (ativo) / "Continente inteiro" (em breve) → escolha de clube com
  emblema genérico e elenco por posição com destaques → treinador (nome, nacionalidade com bandeira, avatar,
  personalidade) → nome da carreira.
- **Carregar Carreira:** lista das carreiras do usuário (limite do plano).
- **Central:** card estilo FIFA do clube/treinador, próximo jogo e avançar/jogar ao centro, tabela e calendário nas
  laterais; abaixo, e-mails com decisões e notícias.
- **Mapa (ilustração clicável).**
- **Elenco:** campo interativo com arrastar (e alternativa por toque/teclado), tabela, táticas e presets,
  escalações salvas, estatísticas. Sem batedores; camisa real da pesquisa. Decisão (2026-10-23): as escalações
  salvas (até 3 por carreira, nomeáveis) ficam no navegador (`localStorage`, chave por carreira) até o servidor
  expor o recurso; só guardam ids, formação e tática, e são revalidadas contra o elenco ao aplicar.
- **Mercado:** caixa, janelas, status, compra/venda/empréstimo nacional e dos estrangeiros do catálogo.
- **Escritório:** propostas (atletas, empregos, patrocínios), finanças, contratos, carreira do treinador,
  sócio-torcedor, receitas e despesas.
- **Temporada:** só leitura, gráficos e tabelas (artilharia, notas, posição por rodada, campeões).
- **Ranking:** tela própria.
- **Partida:** mantém feed narrado, pausas táticas e campo 2D do replay.

## Fora do MVP

Continente inteiro jogável, mapa navegável com movimento, escudos reais, batedores/bola parada, relacionamentos
individuais com atletas.

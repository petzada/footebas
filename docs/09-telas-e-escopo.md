# Telas e escopo do MVP (decisões de 2026-10-22)

Fonte: especificação de telas do responsável, revisada de forma adversarial e decidida item a item. Este documento
complementa `docs/08-mvp-fonte-de-verdade.md`; em conflito sobre telas, vale este.

## Decisões

| #   | Tema                       | Decisão                                                                                                                                                                                                                          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Modo "Continente inteiro"  | Aparece na Nova Carreira como **"em breve"** (bloqueado). O MVP joga só o universo atual: Séries A/B/C, estaduais, Copa do Brasil e Libertadores com os 10 estrangeiros fixos.                                                   |
| 2   | Mapa 2D do clube           | **Ilustração clicável** vista de cima (CT, estacionamento, estádio, sede, imprensa, casa do treinador) com áreas que levam às telas, alternativa em lista e sem bloquear avanço. Mapa navegável com zoom/movimento fica pós-MVP. |
| 3   | Imagens dos clubes         | **Emblema genérico** gerado pelo jogo (cores e iniciais). Nenhum escudo ou logo real.                                                                                                                                            |
| 4   | Personalidade do treinador | **Afeta o jogo**: 4 estilos (Motivador, Disciplinador, Diplomata, Estrategista) com efeitos mensuráveis e tom próprio em e-mails e notícias.                                                                                     |
| 5   | Carreiras por usuário      | **1 no grátis, 5 com licença única.** Cada carreira tem nome.                                                                                                                                                                    |
| 6   | Batedores de bola parada   | **Fora do MVP** (o motor não simula bola parada).                                                                                                                                                                                |
| 7   | Mercado                    | **Duas janelas por temporada + venda/empréstimo do próprio elenco + IA de mercado** (propostas pelos seus atletas e negociações simples entre clubes).                                                                           |
| 8   | Escritório                 | **Patrocínio negociável** (3 propostas por temporada) e **sócio-torcedor** (preço e benefícios, receita mensal, efeito em público/torcida). Relacionamentos individuais pós-MVP.                                                 |
| 9   | Contadores da tela Início  | Treinadores, clubes e atletas vindos do banco, com **cache de ~5 minutos** no edge.                                                                                                                                              |
| 10  | Ranking global             | **Fica, com tela própria** (global, ascensão e mensal), só com conquistas validadas pelo servidor.                                                                                                                               |
| 11  | Ordem de trabalho          | **Nuvem primeiro** (Hyperdrive, deploy, login Supabase em footebas.com.br), depois o redesenho das telas e os sistemas novos, landing por último.                                                                                |

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
  escalações salvas, estatísticas. Sem batedores; camisa real da pesquisa.
- **Mercado:** caixa, janelas, status, compra/venda/empréstimo nacional e dos estrangeiros do catálogo.
- **Escritório:** propostas (atletas, empregos, patrocínios), finanças, contratos, carreira do treinador,
  sócio-torcedor, receitas e despesas.
- **Temporada:** só leitura, gráficos e tabelas (artilharia, notas, posição por rodada, campeões).
- **Ranking:** tela própria.
- **Partida:** mantém feed narrado, pausas táticas e campo 2D do replay.

## Fora do MVP

Continente inteiro jogável, mapa navegável com movimento, escudos reais, batedores/bola parada, relacionamentos
individuais com atletas.

---
title: "Football Manager Web — Product & Engineering Source of Truth"
codename: "Projeto Manager"
document_type: "Fonte de verdade de produto, gameplay e engenharia"
status: "Normativo"
version: "1.0.0"
updated_at: "2026-07-20"
platform: "Web"
language: "pt-BR"
---

# Football Manager Web — Fonte de Verdade

> Este documento define o produto que será construído.
>
> Ele consolida os aprendizados históricos do Brasfoot, adapta seus princípios ao mercado atual e estabelece as decisões de produto, gameplay, experiência, monetização e arquitetura técnica.
>
> Em caso de conflito entre ideias informais, protótipos, tarefas ou documentos posteriores, este documento prevalece até que uma decisão seja formalmente registrada na seção **Registro de decisões**.

---

# 1. Decisão executiva

Será criado um **jogo de gerenciamento de futebol para navegador**, com marca, identidade, banco de dados, motor de simulação e propriedade intelectual próprios.

O produto será:

- web-first;
- desktop-first;
- responsivo para tablets e celulares;
- instalável como PWA quando isso não comprometer a experiência;
- jogável em sessões curtas;
- capaz de sustentar carreiras com dezenas de temporadas;
- simples de aprender;
- profundo por interação entre sistemas;
- visualmente moderno;
- predominantemente baseado em interfaces HTML;
- complementado por partidas e ambientes em Three.js;
- gratuito para experimentar;
- monetizado sem pay-to-win.

Não será desenvolvido aplicativo mobile nativo neste escopo.

---

# 2. Definição do produto

## 2.1 Proposta

Um manager de futebol rápido e acessível no qual o usuário:

1. assume um clube;
2. monta o elenco;
3. define escalação e tática;
4. administra contratos e finanças;
5. disputa partidas rápidas;
6. sobe de divisão;
7. desenvolve jovens;
8. constrói um estádio;
9. conquista competições;
10. cria uma carreira histórica.

## 2.2 Posicionamento

O produto ocupará o espaço entre:

- managers extremamente simples, com pouca autonomia;
- managers altamente complexos, que exigem muitas horas, atributos e telas.

A promessa é:

> **A profundidade de uma grande carreira sem a burocracia de um simulador excessivamente complexo.**

## 2.3 Frase de produto

> Construa um clube, avance temporadas rapidamente e transforme cada carreira em uma história única.

## 2.4 Categoria

- jogo web;
- simulador de gerenciamento esportivo;
- single-player como núcleo;
- recursos online e sociais como expansão;
- estratégia;
- progressão de longo prazo;
- conteúdo editável.

---

# 3. Problema que o produto resolve

Managers tradicionais frequentemente apresentam pelo menos um destes problemas:

- excesso de complexidade;
- partidas e temporadas demoradas;
- onboarding difícil;
- interfaces densas;
- dependência de hardware;
- pouco espaço para clubes pequenos;
- baixa personalização;
- monetização agressiva;
- progressão artificialmente lenta.

O produto deverá permitir que uma pessoa:

- entenda o estado do clube em poucos minutos;
- tome decisões relevantes rapidamente;
- jogue uma rodada em menos de dois minutos;
- conclua uma temporada em uma ou poucas sessões;
- mantenha interesse por dezenas de temporadas;
- desenvolva apego por clubes e jogadores gerados;
- compartilhe histórias e conquistas.

---

# 4. Público-alvo

## 4.1 Público primário

Pessoas de 18 a 45 anos que:

- gostam de futebol;
- jogaram Brasfoot, Elifoot ou managers similares;
- gostam de modos carreira;
- desejam profundidade sem excesso de burocracia;
- utilizam computador durante trabalho, estudo ou lazer;
- preferem sessões curtas e progressão rápida;
- gostam de estatísticas, mercado e escalação.

## 4.2 Público secundário

- jogadores de fantasy;
- criadores de conteúdo de futebol;
- fãs de jogos incrementais;
- usuários de managers online;
- comunidades de clubes;
- pessoas interessadas em criar ligas e universos personalizados.

## 4.3 Jobs to be Done

### Job funcional

> Quando tenho algum tempo livre, quero administrar um clube e avançar rapidamente pela temporada, para sentir que minhas decisões estão construindo uma história.

### Job emocional

> Quero transformar um clube pequeno em uma potência e sentir que os jogadores, títulos e recordes daquela carreira pertencem a mim.

### Job social

> Quero mostrar resultados, jogadores raros, acessos, títulos e temporadas históricas para amigos e comunidades.

---

# 5. Princípios obrigatórios

## 5.1 Velocidade

- A primeira partida deve acontecer em até cinco minutos após o cadastro.
- Uma rodada comum deve ser concluída em até dois minutos.
- O usuário sempre poderá pular ou acelerar apresentações.
- Toda animação deve ter função e ser interrompível.
- Nunca exigir repetição de tarefas administrativas sem decisão real.

## 5.2 Clareza

- Informações importantes devem ser visíveis sem abrir vários modais.
- Cada tela deve responder a uma pergunta principal.
- Alertas precisam indicar impacto e ação recomendada.
- Números devem ter contexto.
- O usuário não deve depender de planilhas externas.

## 5.3 Profundidade sistêmica

A profundidade deve vir da interação entre:

- força;
- posição;
- características;
- idade;
- potencial;
- moral;
- condição;
- contrato;
- salário;
- tática;
- finanças;
- calendário;
- reputação;
- promoção e rebaixamento;
- aleatoriedade controlada.

Não deve vir da multiplicação indiscriminada de atributos e telas.

## 5.4 Autoria

O usuário deve perceber que:

- escolheu a estratégia;
- montou o elenco;
- assumiu riscos;
- desenvolveu os jovens;
- construiu o clube;
- criou uma história própria.

## 5.5 Respeito ao tempo

- Sem energia para jogar.
- Sem espera artificial.
- Sem construção com duração de dias para induzir pagamento.
- Sem limite de rodadas diário.
- Sem anúncios entre partidas.
- Sem mecânicas desenhadas para interromper a sessão.

## 5.6 Não pay-to-win

Dinheiro real nunca poderá comprar:

- vitória;
- força;
- potencial;
- recuperação instantânea;
- moeda do clube;
- resultados favoráveis;
- jovens superiores;
- vantagem competitiva em rankings verificados.

---

# 6. Não objetivos

O produto não será:

- uma cópia do Brasfoot;
- um Football Manager reduzido;
- um simulador físico realista;
- um jogo de ação;
- um card game;
- um fantasy baseado exclusivamente no futebol real;
- um produto dependente de licenças oficiais;
- um MMO no lançamento;
- um jogo centrado em microtransações;
- um editor de planilhas com tema de futebol;
- uma experiência construída inteiramente dentro de WebGL.

Não serão prioridades iniciais:

- entrevistas coletivas;
- gestão completa de comissão técnica;
- milhares de cláusulas contratuais;
- treinamento diário individual;
- relacionamento com imprensa;
- vida pessoal do treinador;
- agentes com negociações longas;
- partidas 3D fotorrealistas;
- animações capturadas de atletas;
- comentários por voz;
- futebol feminino no MVP;
- seleções no MVP;
- multiplayer no MVP.

---

# 7. Pilares de gameplay

## 7.1 Temporada rápida

O produto deve permitir:

- resultado instantâneo;
- narração rápida;
- partida em 2D;
- partida em 3D;
- avanço automático de compromissos sem decisão;
- resolução em lote de partidas não controladas.

## 7.2 Ascensão

A progressão deve oferecer:

- divisões;
- promoção;
- rebaixamento;
- copas;
- torneios regionais;
- competição continental;
- reputação;
- propostas de clubes;
- evolução do estádio;
- aumento de receitas.

## 7.3 Elenco vivo

Jogadores devem:

- evoluir;
- envelhecer;
- perder força;
- ganhar moral;
- perder moral;
- lesionar;
- suspender;
- renovar;
- recusar;
- pedir espaço;
- ser emprestados;
- ser vendidos;
- aposentar;
- virar ídolos.

## 7.4 Mundo persistente

Clubes controlados pela IA devem:

- contratar;
- vender;
- desenvolver;
- envelhecer;
- subir;
- cair;
- enriquecer;
- enfrentar crises;
- conquistar títulos;
- mudar de reputação.

## 7.5 Memória

O jogo deve registrar:

- campeões;
- acessos;
- rebaixamentos;
- artilheiros;
- recordes;
- ídolos;
- transferências;
- maiores públicos;
- temporadas;
- títulos do treinador;
- evolução do clube;
- partidas históricas.

---

# 8. Loop principal

```text
Abrir o jogo
    ↓
Ler caixa de entrada e alertas
    ↓
Analisar próximo adversário
    ↓
Ajustar escalação e tática
    ↓
Resolver contratos ou mercado
    ↓
Disputar ou simular partida
    ↓
Receber resultado e consequências
    ↓
Ver tabela, finanças e evolução
    ↓
Avançar para a próxima data
```

O loop deve produzir pelo menos uma decisão significativa a cada rodada.

---

# 9. Loop de longo prazo

```text
Assumir clube
    ↓
Estabilizar elenco e caixa
    ↓
Alcançar objetivo da temporada
    ↓
Ganhar reputação
    ↓
Melhorar estrutura e estádio
    ↓
Subir de divisão ou conquistar competição
    ↓
Renovar o elenco
    ↓
Disputar competições maiores
    ↓
Construir dinastia ou aceitar novo projeto
```

---

# 10. Fluxo de entrada

## 10.1 Landing page

A landing deve comunicar em uma tela:

- manager rápido;
- jogável no navegador;
- carreira longa;
- clubes pequenos;
- partidas rápidas;
- teste gratuito.

CTA principal:

> Começar carreira

CTA secundário:

> Ver como funciona

## 10.2 Cadastro

Métodos iniciais:

- Google;
- e-mail com magic link;
- senha opcional posteriormente.

O cadastro não deve exigir:

- telefone;
- endereço;
- data completa de nascimento;
- nome real;
- cartão.

## 10.3 Criação da carreira

Passos:

1. escolher nome do treinador;
2. escolher dificuldade;
3. escolher clube;
4. revisar objetivo;
5. iniciar.

Configurações avançadas ficam recolhidas.

## 10.4 Escolha de clube

Filtros:

- divisão;
- região;
- reputação;
- orçamento;
- dificuldade;
- objetivo;
- tamanho do estádio;
- qualidade do elenco.

Cada clube deve apresentar:

- resumo;
- estrelas de dificuldade;
- caixa;
- reputação;
- força aproximada;
- estádio;
- objetivo da diretoria;
- melhor jogador;
- contexto narrativo.

## 10.5 Primeiro dia

O primeiro acesso ao clube deve apresentar:

- mensagem da diretoria;
- objetivo;
- situação financeira;
- posições carentes;
- próximo jogo;
- três ações recomendadas.

Não apresentar um tutorial longo.

---

# 11. Navegação principal

A navegação desktop utilizará sidebar recolhível.

Itens:

1. Visão geral
2. Caixa de entrada
3. Calendário
4. Elenco
5. Tática
6. Partidas
7. Mercado
8. Competições
9. Clube
10. Finanças
11. História
12. Mundo

Ações fixas:

- data atual;
- próximo compromisso;
- botão **Avançar**;
- busca global;
- alertas;
- perfil.

## 11.1 Regra de informação

O botão **Avançar** sempre deve:

- informar até qual data avançará;
- mostrar bloqueios;
- indicar ações recomendadas;
- permitir prosseguir mesmo com alertas não críticos;
- impedir avanço apenas quando houver uma decisão obrigatória.

---

# 12. Visão geral do clube

A home interna deve responder:

- Qual é o próximo jogo?
- Como está o elenco?
- Qual é a posição na tabela?
- Há alguma urgência?
- Como está o caixa?
- O que mudou desde a última rodada?

Blocos:

- próximo jogo;
- forma recente;
- tabela resumida;
- alertas;
- condição do elenco;
- últimos eventos;
- finanças resumidas;
- objetivos da diretoria.

Não usar excesso de dashboards ou gráficos sem ação.

---

# 13. Caixa de entrada

Tipos de mensagem:

- proposta recebida;
- resposta de negociação;
- contrato vencendo;
- lesão;
- suspensão;
- jogador insatisfeito;
- relatório de adversário;
- diretoria;
- competição;
- premiação;
- jovem promovido;
- recorde;
- proposta de emprego;
- resumo de rodada.

Cada mensagem deve oferecer:

- contexto;
- impacto;
- ação;
- prazo;
- link direto para a tela relevante.

Mensagens informativas podem ser agrupadas.

---

# 14. Modelo de jogador

## 14.1 Atributos visíveis

Cada jogador terá:

- nome;
- idade;
- nacionalidade fictícia ou genérica;
- posição principal;
- posições secundárias;
- pé/lado preferido;
- força geral;
- quatro a seis características;
- condição física;
- moral;
- ritmo de jogo;
- salário;
- valor;
- duração do contrato;
- status no elenco.

## 14.2 Atributos parcialmente ocultos

- potencial;
- consistência;
- propensão a lesões;
- adaptação;
- profissionalismo;
- desempenho em partidas decisivas.

Esses valores devem aparecer como estimativas, não números exatos.

## 14.3 Escala de força

Escala: 1 a 100.

Interpretação relativa:

| Faixa | Nível |
|---|---|
| 1–29 | amador ou base inicial |
| 30–44 | divisão inferior |
| 45–59 | profissional competitivo |
| 60–74 | primeira divisão |
| 75–84 | destaque nacional |
| 85–92 | elite mundial |
| 93–100 | excepcional e raro |

O banco inicial não deve concentrar jogadores acima de 85.

## 14.4 Características

Jogadores de linha podem ter:

- aceleração;
- velocidade;
- passe;
- criatividade;
- finalização;
- drible;
- cruzamento;
- cabeceio;
- desarme;
- marcação;
- resistência;
- força física;
- posicionamento;
- bola parada.

Goleiros podem ter:

- reflexo;
- posicionamento;
- saída;
- jogo aéreo;
- reposição;
- pênaltis.

O usuário verá apenas as características relevantes, sem uma planilha completa.

## 14.5 Status no elenco

- estrela;
- titular;
- rotação;
- reserva;
- jovem;
- disponível para empréstimo;
- listado;
- fora dos planos.

O status afeta expectativa e moral.

---

# 15. Evolução do jogador

A evolução será baseada em:

- idade;
- potencial;
- minutos;
- nível da competição;
- desempenho;
- moral;
- ritmo;
- qualidade de desenvolvimento do clube;
- lesões;
- aleatoriedade controlada.

Modelo conceitual:

```text
desenvolvimento =
    curva_de_idade
    × potencial
    × minutos_úteis
    × qualidade_de_desenvolvimento
    × profissionalismo
    × condição
    × variação_controlada
```

Regras:

- evolução não ocorre linearmente;
- jogadores podem estagnar;
- desempenho bom não garante aumento imediato;
- potencial não será certeza;
- atletas veteranos podem manter desempenho apesar de redução física;
- a queda deve ser progressiva, salvo lesões graves.

---

# 16. Moral, condição e ritmo

## 16.1 Moral

Faixas:

- muito baixa;
- baixa;
- normal;
- alta;
- excelente.

Fatores:

- resultados;
- minutos;
- papel prometido;
- salário;
- contrato;
- conflitos;
- gols;
- erros decisivos;
- títulos;
- propostas recusadas;
- sequência do clube.

## 16.2 Condição

Representa disponibilidade física para a próxima partida.

É afetada por:

- minutos;
- intervalo;
- intensidade;
- idade;
- lesão;
- sequência de jogos.

## 16.3 Ritmo

Representa adaptação competitiva.

É afetado por:

- titularidade;
- tempo sem jogar;
- retorno de lesão;
- sequência de partidas.

Moral, condição e ritmo devem modificar a força efetiva, mas não substituir a força nominal.

---

# 17. Lesões e suspensões

Lesões terão:

- tipo;
- gravidade;
- prazo estimado;
- risco de retorno antecipado;
- impacto temporário;
- possível impacto permanente raro.

Suspensões serão geradas por:

- cartões acumulados;
- expulsões;
- decisões disciplinares raras.

O MVP não terá departamento médico complexo.

---

# 18. Contratos

Campos:

- salário;
- início;
- término;
- papel esperado;
- multa opcional em fases posteriores;
- bônus simplificados em fases posteriores.

Fluxo de renovação:

1. abrir jogador;
2. propor duração;
3. propor salário;
4. definir papel;
5. receber resposta;
6. aceitar contraproposta ou encerrar.

Durações iniciais:

- seis meses;
- um ano;
- dois anos;
- três anos;
- quatro anos.

Regras:

- jogadores avaliam clube, salário, papel, idade e interesse externo;
- atletas podem rejeitar renovação;
- contratos próximos do fim geram alertas;
- rescisão possui custo;
- atletas sem contrato podem negociar livremente.

---

# 19. Mercado de transferências

## 19.1 Ações

- buscar;
- observar;
- favoritar;
- comparar;
- fazer oferta;
- negociar;
- listar;
- vender;
- emprestar;
- pedir empréstimo;
- liberar;
- assinar pré-contrato em fase posterior.

## 19.2 Busca

Filtros:

- nome;
- posição;
- idade;
- força estimada;
- valor;
- salário;
- contrato;
- características;
- listado;
- disponível para empréstimo;
- país;
- divisão.

## 19.3 Negociação

Uma negociação terá no máximo três dimensões iniciais:

- valor fixo;
- parcelamento simplificado;
- bônus por meta.

Não haverá dezenas de cláusulas no MVP.

## 19.4 IA de mercado

Clubes da IA devem considerar:

- posição carente;
- orçamento;
- faixa salarial;
- reputação;
- idade;
- valor;
- potencial;
- nível da divisão;
- limite do elenco;
- estratégia do clube.

A IA não deve contratar apenas pela maior força geral.

## 19.5 Proteções econômicas

- impedir inflação infinita;
- limitar crescimento salarial;
- reduzir valor de jogadores sem mercado;
- gerar demanda coerente;
- evitar acumulação excessiva de atletas;
- liberar jogadores improdutivos;
- limitar quantidade de jovens gerados;
- manter distribuição de força entre divisões.

---

# 20. Categoria de base

## 20.1 Estrutura inicial

Cada clube terá:

- nível de formação;
- custo de manutenção;
- lista limitada de jovens;
- promoções periódicas;
- avaliação aproximada.

## 20.2 Fluxo

1. relatório da base;
2. visualizar jovens;
3. promover;
4. dispensar;
5. manter para observação;
6. emprestar após promoção.

## 20.3 Objetivo

A base deve:

- renovar o universo;
- criar histórias;
- oferecer ativos baratos;
- ajudar clubes pequenos;
- impedir escassez de jogadores;
- criar ídolos exclusivos.

Não deverá funcionar como loot box.

---

# 21. Escalação

A tela de escalação permitirá:

- campo visual;
- drag and drop;
- titulares;
- banco;
- reservas;
- filtro por posição;
- condição;
- moral;
- força;
- características;
- sugestões automáticas;
- aviso de improvisação;
- comparação rápida.

A escalação automática deve oferecer critérios:

- melhor força;
- melhor condição;
- time misto;
- poupar titulares;
- desenvolver jovens.

A decisão final sempre pertence ao usuário.

---

# 22. Tática

## 22.1 Formações iniciais

- 4-4-2;
- 4-3-3;
- 4-2-3-1;
- 3-5-2;
- 5-3-2;
- 4-1-4-1.

## 22.2 Mentalidade

- defensiva;
- equilibrada;
- ofensiva.

## 22.3 Construção

- direta;
- equilibrada;
- curta.

## 22.4 Foco

- esquerda;
- centro;
- direita;
- misto.

## 22.5 Pressão

- baixa;
- média;
- alta.

## 22.6 Linha defensiva

- baixa;
- média;
- alta.

## 22.7 Marcação

- zona;
- individual;
- mista em fase posterior.

## 22.8 Simplicidade

A tela deve apresentar poucas escolhas de alto impacto.

Não haverá inicialmente:

- dezenas de funções por posição;
- instruções para cada fase do campo;
- centenas de combinações;
- editor de comportamento individual avançado.

---

# 23. Preparação de partida

Antes da partida, mostrar:

- adversário;
- colocação;
- últimos cinco jogos;
- força aproximada;
- formação provável;
- principais jogadores;
- desfalques;
- mando;
- histórico recente;
- recomendação opcional.

O relatório não deve revelar a fórmula do motor.

---

# 24. Motor de partidas

## 24.1 Regra fundamental

O motor será independente da interface e da visualização.

```text
Entradas da partida
    ↓
Simulação determinística com seed
    ↓
Eventos e resultado
    ↓
Persistência
    ↓
Representação em texto, 2D ou 3D
```

## 24.2 Entradas

- jogadores escalados;
- banco;
- posições;
- características;
- condição;
- moral;
- ritmo;
- tática;
- mando;
- nível da competição;
- clima em fase posterior;
- decisões durante a partida;
- seed;
- versão do motor.

## 24.3 Saídas

- placar;
- eventos;
- posse;
- finalizações;
- finalizações no alvo;
- chances claras;
- passes;
- faltas;
- cartões;
- lesões;
- substituições;
- notas;
- mapa de ações;
- renda;
- público.

## 24.4 Modelo conceitual

```text
força_efetiva =
    composição_do_time
    × adequação_posicional
    × condição
    × moral
    × ritmo
    × coerência_tática
    × mando
    × contexto
```

```text
chance_criada =
    progressão
    × criatividade
    × espaço
    × erro_adversário
    × variação_controlada
```

```text
chance_convertida =
    qualidade_da_chance
    × finalização
    × pressão_defensiva
    × goleiro
    × variação_controlada
```

A fórmula real não será exposta.

## 24.5 Determinismo

Com os mesmos:

- dados;
- versão;
- seed;
- decisões;
- sequência de eventos;

o motor deve gerar o mesmo resultado.

Benefícios:

- replay;
- testes;
- auditoria;
- reprodução de bugs;
- rankings verificados;
- multiplayer futuro;
- balanceamento.

## 24.6 Aleatoriedade

A aleatoriedade deve:

- permitir zebras;
- evitar resultados mecânicos;
- nunca anular sistematicamente as decisões;
- ser derivada da seed;
- ser limitada por contexto;
- não ser manipulada por monetização.

---

# 25. Modos de acompanhamento

## 25.1 Resultado instantâneo

Mostra:

- placar;
- resumo;
- estatísticas;
- destaques;
- notas.

## 25.2 Narração rápida

- linha do tempo;
- eventos textuais;
- velocidade;
- alterações táticas;
- substituições.

## 25.3 Campo 2D

- posições simplificadas;
- bola;
- zonas;
- movimentações;
- eventos importantes;
- baixo consumo.

## 25.4 Campo 3D

- Three.js;
- estilo low-poly;
- câmera isométrica ou lateral;
- modelos genéricos;
- animações simples;
- destaques dos eventos;
- desempenho adaptativo.

O 3D representa eventos já calculados.

O 3D não decide:

- física;
- resultado;
- trajetória competitiva;
- atributos;
- arbitragem;
- inteligência tática central.

---

# 26. Three.js

## 26.1 Uso permitido

- visualizador de partidas;
- estádio;
- apresentação de jogador;
- sala de troféus;
- celebrações;
- visualizações promocionais.

## 26.2 Uso proibido

- tabelas;
- mercado;
- contratos;
- escalação administrativa;
- configurações;
- editor;
- dashboards;
- navegação principal.

Essas áreas serão HTML semântico.

## 26.3 Stack gráfica

- Three.js;
- React Three Fiber;
- Drei;
- modelos GLTF comprimidos;
- instancing;
- level of detail;
- texturas otimizadas;
- renderização sob demanda fora da partida;
- fallback 2D.

## 26.4 Performance

Metas:

- carregar interface antes da cena;
- permitir desativar 3D;
- qualidade baixa, média e alta;
- reduzir pixel ratio quando necessário;
- pausar renderização em aba inativa;
- usar instancing para público;
- evitar luzes e sombras excessivas;
- assets progressivos;
- não bloquear a rodada por download de cenário.

---

# 27. Alterações durante a partida

O usuário poderá:

- substituir;
- alterar formação;
- alterar mentalidade;
- alterar pressão;
- alterar foco ofensivo;
- acelerar;
- pular para o final.

As decisões serão aplicadas em pontos discretos da simulação.

O motor registrará:

- minuto;
- estado anterior;
- decisão;
- efeito posterior.

---

# 28. Pós-partida

A tela deve apresentar:

- resultado;
- jogador da partida;
- gols;
- assistências;
- notas;
- estatísticas;
- lesões;
- suspensões;
- público;
- renda;
- posição atual;
- impacto no objetivo;
- recordes;
- botão próxima data.

A tela não deve prender o usuário com animações obrigatórias.

---

# 29. Competições do MVP

O universo inicial será fictício e inspirado em estruturas reconhecíveis.

## 29.1 Estrutura

- quatro divisões nacionais;
- vinte clubes por divisão;
- pontos corridos;
- acesso;
- rebaixamento;
- copa nacional;
- competições regionais simplificadas;
- torneio continental fictício;
- supercopa em fase posterior.

## 29.2 Regras

As regras devem ser configuráveis por dados:

- quantidade de participantes;
- grupos;
- turnos;
- pontos;
- critérios de desempate;
- acesso;
- rebaixamento;
- classificação;
- mata-mata;
- ida e volta;
- pênaltis;
- vaga continental.

## 29.3 Motor de competição

Não implementar cada competição como lógica totalmente isolada.

Utilizar componentes:

- LeagueStage;
- GroupStage;
- KnockoutStage;
- QualificationRule;
- PromotionRule;
- RelegationRule;
- RankingRule;
- TieBreakerRule.

---

# 30. Calendário

O motor deve resolver:

- múltiplas competições;
- intervalos mínimos;
- jogos adiados;
- mata-mata;
- ida e volta;
- datas reservadas;
- conflitos;
- fim de temporada;
- geração da temporada seguinte.

Prioridades:

1. integridade;
2. previsibilidade;
3. ausência de conflito;
4. velocidade.

Todo calendário gerado deverá ser validado antes de iniciar a temporada.

---

# 31. Classificação

Critérios padrão:

1. pontos;
2. vitórias;
3. saldo;
4. gols marcados;
5. confronto direto quando configurado;
6. sorteio determinístico como último recurso.

A classificação deve armazenar regras da competição, não depender de uma regra global fixa.

---

# 32. Finanças

## 32.1 Receitas

- ingressos;
- patrocínio;
- premiações;
- venda de jogadores;
- receitas de competição;
- sócios em fase posterior;
- produtos cosméticos do clube apenas como simulação interna;
- amistosos em fase posterior.

## 32.2 Despesas

- salários;
- contratações;
- rescisões;
- manutenção do estádio;
- desenvolvimento da base;
- expansão estrutural;
- taxas operacionais simplificadas.

## 32.3 Objetivo

Finanças devem limitar decisões sem exigir contabilidade profissional.

O usuário deve compreender:

- caixa;
- projeção;
- folha;
- orçamento;
- principais receitas;
- principais despesas.

---

# 33. Estádio

Campos:

- nome;
- capacidade;
- ocupação;
- qualidade;
- custo de manutenção;
- nível visual;
- receita média.

Ações:

- definir preço;
- ampliar;
- reformar;
- personalizar cores;
- visualizar em 3D;
- consultar histórico de público.

Expansões devem ser decisões financeiras, não timers monetizáveis.

---

# 34. Torcida e diretoria

## 34.1 Diretoria

Avalia:

- objetivo;
- posição;
- finanças;
- uso da base;
- resultados;
- reputação;
- estabilidade.

Pode:

- apoiar;
- pressionar;
- redefinir expectativa;
- renovar;
- demitir.

## 34.2 Torcida

Reage a:

- vitórias;
- derrotas;
- rivais;
- títulos;
- jovens;
- vendas;
- preço dos ingressos;
- desempenho histórico.

Torcida e diretoria não serão apenas barras decorativas. Devem gerar consequências.

---

# 35. Carreira do treinador

Campos:

- nome;
- idade opcional;
- reputação;
- clube atual;
- histórico;
- títulos;
- acessos;
- prêmios;
- recordes;
- propostas;
- estilo estatístico.

Ações:

- renovar;
- aceitar proposta;
- recusar;
- pedir demissão;
- aguardar projeto;
- iniciar novo clube no mesmo save.

O save pertence à carreira do treinador, não apenas ao clube.

---

# 36. História e recordes

Registrar:

- temporadas;
- clubes;
- campeões;
- tabelas finais;
- artilheiros;
- assistências;
- maiores transferências;
- maiores públicos;
- partidas com mais gols;
- invencibilidade;
- recordes de pontos;
- títulos;
- acessos;
- rebaixamentos;
- ídolos;
- aposentadorias;
- melhores jogadores.

A história deve ser consultável por temporada.

---

# 37. Mundo do jogo

A tela Mundo permitirá:

- buscar clubes;
- buscar jogadores;
- ver competições;
- consultar rankings;
- ver transferências;
- consultar campeões;
- acompanhar notícias;
- observar clubes.

O usuário poderá acompanhar histórias fora do próprio clube.

---

# 38. Notícias

Notícias serão geradas por templates e eventos de domínio.

Exemplos:

- contratação recorde;
- zebra;
- título;
- demissão;
- estreia de jovem;
- aposentadoria;
- goleada;
- invencibilidade;
- acesso;
- rebaixamento;
- crise financeira;
- recorde.

IA generativa poderá reescrever variações posteriormente, mas não poderá decidir fatos do jogo.

---

# 39. Editor

## 39.1 Editor básico gratuito

- nome do treinador;
- nome do clube criado em modo sandbox;
- cores;
- escudo por formas predefinidas;
- uniforme simples.

## 39.2 Editor completo pago

- clubes;
- jogadores;
- atributos;
- ligas;
- competições;
- regras;
- escudos;
- uniformes;
- estádios;
- banco completo;
- importação;
- exportação.

## 39.3 Segurança

Conteúdo compartilhado deve:

- ser validado;
- possuir versão;
- ser sanitizado;
- impedir scripts;
- limitar tamanho;
- possuir denúncia;
- respeitar direitos autorais.

---

# 40. Mods e conteúdo comunitário

Não fazem parte do MVP inicial, mas a arquitetura deverá permitir.

Formato:

```text
manifest.json
clubs.json
players.json
competitions.json
rules.json
assets/
```

Manifesto:

```json
{
  "id": "community-pack-id",
  "name": "Nome do pacote",
  "version": "1.0.0",
  "engineVersion": ">=1.0.0 <2.0.0",
  "author": "Autor",
  "content": [
    "clubs",
    "players",
    "competitions",
    "assets"
  ]
}
```

O motor não executará código arbitrário de mods.

---

# 41. Monetização

## 41.1 Princípio

O loop completo deve poder ser experimentado gratuitamente.

A monetização deve vender:

- amplitude;
- personalização;
- conveniência online;
- conteúdo adicional;
- ferramentas;
- armazenamento;
- serviços recorrentes.

Não deve vender poder.

## 41.2 Plano gratuito

Inclui:

- uma carreira ativa;
- universo base;
- quatro divisões;
- copa nacional;
- regionais;
- mercado;
- contratos;
- base;
- finanças;
- estádio;
- partidas instantâneas;
- narração;
- campo 2D;
- save em nuvem limitado;
- histórico essencial;
- editor básico;
- publicidade apenas fora do loop ou nenhuma publicidade no lançamento.

## 41.3 Licença completa

Pagamento único.

Faixa inicial a testar:

- R$ 39,90;
- R$ 49,90;
- R$ 59,90.

Inclui:

- carreiras ilimitadas;
- visualizador 3D;
- editor completo;
- competições avançadas;
- mais universos;
- exportação;
- histórico completo;
- configurações avançadas;
- temas;
- desafios extras;
- ausência de publicidade.

A licença deve permanecer válida para a edição adquirida.

## 41.4 Clube Online

Assinatura opcional para serviços com custo recorrente.

Faixa inicial a testar:

- R$ 9,90 a R$ 14,90 por mês;
- R$ 79,90 a R$ 119,90 por ano.

Inclui futuramente:

- mais espaço de saves;
- sincronização avançada;
- backup;
- compartilhamento;
- ligas privadas;
- rankings verificados;
- desafios;
- workshop;
- estatísticas avançadas;
- histórico público;
- perfil;
- atualizações automáticas de bancos autorizados.

O single-player não dependerá da assinatura.

## 41.5 Pacotes

Possíveis pacotes:

- universo histórico fictício;
- regras alternativas;
- temas visuais;
- estádios;
- sala de troféus;
- desafios;
- competições experimentais;
- pacote de criação.

Pacotes nunca contêm vantagem competitiva.

---

# 42. Matriz gratuita e paga

| Recurso | Gratuito | Completo | Clube Online |
|---|---:|---:|---:|
| Loop principal | Sim | Sim | Sim |
| Uma carreira | Sim | Sim | Sim |
| Carreiras ilimitadas | Não | Sim | Sim |
| Universo base | Sim | Sim | Sim |
| Mercado e contratos | Sim | Sim | Sim |
| Base | Sim | Sim | Sim |
| Finanças | Sim | Sim | Sim |
| Partida instantânea | Sim | Sim | Sim |
| Narração | Sim | Sim | Sim |
| Campo 2D | Sim | Sim | Sim |
| Campo 3D | Não | Sim | Sim |
| Editor básico | Sim | Sim | Sim |
| Editor completo | Não | Sim | Sim |
| Histórico completo | Limitado | Sim | Sim |
| Exportação | Não | Sim | Sim |
| Saves em nuvem | Limitado | Limitado | Ampliado |
| Rankings verificados | Não | Não | Sim |
| Ligas privadas | Não | Não | Sim |
| Workshop | Consumo limitado | Sim | Completo |
| Conteúdo adicional | Parcial | Incluído ou avulso | Conforme plano |

---

# 43. Aquisição e crescimento

## 43.1 Canais

- conteúdo curto;
- desafios de carreira;
- creators;
- comunidades de futebol;
- nostalgia de managers;
- SEO;
- landing pages de clubes fictícios;
- páginas públicas de carreira;
- compartilhamento de resultados;
- campanhas de “do menor ao maior”.

## 43.2 Conteúdo compartilhável

Gerar cards para:

- título;
- acesso;
- contratação;
- jovem;
- goleada;
- recorde;
- temporada;
- estádio;
- ranking;
- demissão;
- proposta recebida.

## 43.3 Referral

Em fase posterior:

- convite de amigo;
- cosméticos;
- tema;
- espaço de save;
- badge;
- nenhuma vantagem esportiva.

---

# 44. Retenção

## 44.1 Retenção natural

- próxima rodada;
- tabela;
- acesso;
- contratos;
- janela;
- base;
- estádio;
- competição;
- recordes;
- propostas;
- rivalidades;
- história.

## 44.2 Desafios

- salvar clube ameaçado;
- subir sem contratar;
- usar apenas jovens;
- vencer com orçamento baixo;
- carreira nômade;
- invencibilidade;
- desafio semanal com seed compartilhada.

## 44.3 Resumo de retorno

Após ausência:

- data da carreira;
- último resultado;
- posição;
- próximos jogos;
- alertas;
- objetivo;
- ação recomendada.

Não utilizar streak punitivo.

---

# 45. Métricas

## 45.1 Ativação

- cadastro concluído;
- carreira criada;
- clube escolhido;
- primeira escalação;
- primeira partida;
- terceira rodada;
- primeira contratação.

## 45.2 Engajamento

- rodadas por sessão;
- partidas por sessão;
- temporadas iniciadas;
- temporadas concluídas;
- duração da sessão;
- uso de resultado instantâneo;
- uso de 2D;
- uso de 3D;
- transferências;
- alterações táticas.

## 45.3 Retenção

- D1;
- D7;
- D30;
- retorno por temporada;
- saves com mais de três temporadas;
- saves com mais de dez temporadas.

## 45.4 Negócio

- conversão gratuito → completo;
- conversão completo → Clube Online;
- receita por usuário;
- cancelamento;
- tempo até compra;
- origem da compra;
- uso dos recursos pagos.

## 45.5 Qualidade

- falhas de save;
- divergências de simulação;
- tempo de avanço;
- tempo de API;
- erros de calendário;
- abandono durante onboarding;
- travamentos do 3D;
- uso de fallback.

---

# 46. Stack técnica normativa

## 46.1 Monorepo

- pnpm;
- Turborepo;
- TypeScript estrito.

Estrutura:

```text
/apps
  /web
  /api
  /worker

/packages
  /engine
  /domain
  /database
  /contracts
  /ui
  /match-viewer
  /config
  /testing
```

## 46.2 Web

- Next.js;
- App Router;
- React;
- TypeScript;
- Tailwind CSS;
- shadcn/ui como base, não como identidade final;
- TanStack Query;
- Zustand para estados locais complexos;
- React Hook Form;
- Zod;
- React Three Fiber;
- Drei.

## 46.3 API

- Node.js em versão LTS;
- Fastify;
- contratos Zod;
- REST no MVP;
- OpenAPI;
- SSE para progresso e eventos;
- WebSocket apenas quando multiplayer exigir.

## 46.4 Banco

- PostgreSQL;
- Prisma ORM;
- SQL manual para consultas críticas;
- migrações versionadas;
- transações;
- índices monitorados;
- JSONB apenas onde o esquema é legitimamente variável.

## 46.5 Filas

- Redis;
- BullMQ.

Usos:

- simulação de rodada no servidor;
- geração de temporada;
- validação de universo;
- exportação;
- importação;
- processamento de assets;
- geração de cards;
- tarefas de histórico;
- desafios.

## 46.6 CPU

- worker_threads;
- pool de workers;
- simulações em lote;
- isolamento do event loop da API.

## 46.7 Autenticação

- Supabase Auth ou camada compatível com JWT;
- Google;
- magic link;
- sessão segura;
- refresh token;
- proteção contra abuso.

A lógica de jogo não deverá depender diretamente do fornecedor de autenticação.

## 46.8 Storage

- Cloudflare R2;
- assets;
- exportações;
- escudos;
- uniformes;
- mods;
- cards compartilháveis.

## 46.9 Observabilidade

- Sentry;
- OpenTelemetry;
- logs estruturados;
- tracing;
- métricas de filas;
- métricas de simulação;
- alertas.

## 46.10 Produto

- PostHog;
- eventos próprios;
- feature flags;
- experimentos controlados.

## 46.11 Deploy

- Railway para web, API, workers, Redis e PostgreSQL, inicialmente;
- Cloudflare para DNS, CDN, WAF e R2;
- ambientes separados;
- preview por pull request quando viável.

---

# 47. Limites entre aplicações

## 47.1 Next.js

Responsável por:

- interface;
- páginas;
- autenticação de sessão;
- renderização;
- BFF leve;
- SEO;
- landing;
- billing UI;
- chamadas à API.

Não responsável por:

- simulação pesada;
- avanço completo de mundo;
- geração de temporada;
- IA de transferências em lote;
- processamento massivo de partidas.

## 47.2 API

Responsável por:

- comandos;
- consultas;
- autorização;
- validação;
- persistência;
- orquestração;
- criação de jobs;
- leitura consistente.

## 47.3 Worker

Responsável por:

- tarefas CPU-intensive;
- simulação;
- geração;
- validação;
- processamento;
- eventos derivados.

## 47.4 Engine

Responsável por:

- regras puras;
- determinismo;
- simulação;
- competições;
- calendário;
- progressão;
- mercado;
- finanças.

O engine não deve importar:

- Next.js;
- Fastify;
- Prisma;
- React;
- Three.js;
- APIs externas.

---

# 48. Arquitetura do motor

```text
Command
    ↓
Validation
    ↓
Load Game Snapshot
    ↓
Execute Domain Logic
    ↓
Generate Domain Events
    ↓
Persist Transaction
    ↓
Create Async Jobs
    ↓
Project Read Models
    ↓
Return Response
```

## 48.1 Comandos

Exemplos:

- CreateCareer;
- SelectClub;
- SetLineup;
- SetTactics;
- AdvanceDate;
- SimulateMatch;
- SubmitTransferOffer;
- RespondTransferOffer;
- RenewContract;
- PromoteYouth;
- ExpandStadium.

## 48.2 Eventos

Exemplos:

- CareerCreated;
- ClubAssigned;
- LineupChanged;
- MatchPlayed;
- GoalScored;
- PlayerInjured;
- PlayerSuspended;
- TransferCompleted;
- ContractRenewed;
- PlayerRetired;
- YouthPromoted;
- ClubPromoted;
- ClubRelegated;
- CompetitionWon;
- ManagerFired.

---

# 49. Persistência do save

## 49.1 Estratégia

O save utilizará:

- snapshot atual;
- eventos relevantes;
- versão do motor;
- seed;
- checksums;
- histórico agregado.

Não será event sourcing puro em todo o sistema.

## 49.2 Campos obrigatórios

```ts
type GameSave = {
  id: string;
  userId: string;
  name: string;
  engineVersion: string;
  contentVersion: string;
  seed: string;
  currentDate: string;
  season: number;
  activeManagerId: string;
  status: "active" | "archived" | "corrupted";
  checksum: string;
  createdAt: string;
  updatedAt: string;
};
```

## 49.3 Versionamento

Toda carreira deve registrar:

- versão do engine;
- versão das regras;
- versão do conteúdo;
- versão do schema.

Atualizações devem usar migrações explícitas.

Nunca migrar saves em produção sem:

- backup;
- teste;
- validação;
- possibilidade de rollback.

---

# 50. Modelo de dados conceitual

Entidades principais:

- User;
- Entitlement;
- Career;
- Manager;
- Club;
- Stadium;
- Player;
- PlayerDevelopment;
- Contract;
- SquadRegistration;
- Lineup;
- Tactic;
- Competition;
- CompetitionEdition;
- Stage;
- Fixture;
- Match;
- MatchEvent;
- Standing;
- Transfer;
- TransferOffer;
- FinanceTransaction;
- Sponsorship;
- BoardObjective;
- YouthPlayer;
- Award;
- Record;
- Notification;
- ContentPack.

---

# 51. Segurança e integridade

## 51.1 Autorização

Toda operação deve validar:

- usuário;
- carreira;
- treinador;
- clube;
- fase do calendário;
- permissão;
- estado.

## 51.2 Idempotência

Comandos críticos devem aceitar chave de idempotência:

- compra;
- avanço;
- simulação;
- transferência;
- renovação;
- billing.

## 51.3 Concorrência

Uma carreira não pode avançar duas vezes simultaneamente.

Utilizar:

- lock distribuído;
- versão otimista;
- transação;
- fila por carreira quando necessário.

## 51.4 Anticheat

No single-player:

- foco em integridade, não punição.

Em rankings verificados:

- simulação no servidor;
- seed registrada;
- conteúdo aprovado;
- versão fixada;
- comandos auditáveis;
- impossibilidade de editar save.

---

# 52. Performance

## 52.1 Metas de interface

- LCP da área autenticada abaixo de 2,5 segundos em conexão adequada;
- navegação percebida imediata;
- skeletons somente quando necessários;
- tabelas virtualizadas quando grandes;
- filtros locais quando possível;
- busca indexada.

## 52.2 Metas de simulação

- partida individual abaixo de 150 ms no worker, sem renderização;
- rodada nacional abaixo de 2 segundos em carga normal;
- avanço semanal abaixo de 3 segundos;
- geração de temporada abaixo de 10 segundos;
- carregamento de save abaixo de 2 segundos.

As metas deverão ser revistas após o protótipo.

## 52.3 Estratégias

- engine puro;
- batch;
- índices;
- snapshots;
- cache;
- filas;
- workers;
- evitar N+1;
- read models;
- compressão;
- paginação;
- simulação apenas do detalhe necessário.

---

# 53. Testes

## 53.1 Engine

- testes unitários;
- property-based testing;
- seeds fixas;
- simulação de milhares de temporadas;
- invariantes;
- testes de regressão;
- snapshots de resultados.

## 53.2 Invariantes

- nenhum clube joga duas partidas simultâneas;
- classificação fecha corretamente;
- não existem jogadores duplicados;
- contrato pertence a um clube;
- transferência preserva balanço;
- campeão é definido;
- promoção e rebaixamento fecham;
- temporada seguinte possui participantes válidos;
- save reproduz resultado com mesma seed;
- dinheiro não é criado sem transação registrada.

## 53.3 Aplicação

- integração;
- API;
- E2E;
- Playwright;
- acessibilidade;
- billing;
- migração de save;
- recuperação de falha.

## 53.4 Carga

- simulações concorrentes;
- filas;
- avanço simultâneo;
- consultas de mercado;
- rankings;
- exportação.

---

# 54. Acessibilidade

- navegação por teclado;
- HTML semântico;
- contraste;
- foco visível;
- leitores de tela;
- alternativas ao drag and drop;
- alternativa ao 3D;
- redução de movimento;
- fontes escaláveis;
- não depender apenas de cor.

O usuário deve conseguir jogar sem Three.js.

---

# 55. Legal e propriedade intelectual

O produto deverá usar:

- nome próprio;
- identidade própria;
- escudos próprios;
- jogadores fictícios;
- competições fictícias;
- assets licenciados;
- conteúdo comunitário autorizado.

Não utilizar sem licença:

- marcas de clubes;
- escudos;
- uniformes;
- fotos;
- nomes e imagens protegidas;
- bancos proprietários;
- conteúdo copiado do Brasfoot;
- código;
- textos;
- formatos internos.

A inspiração será baseada em princípios gerais de game design.

---

# 56. Escopo do protótipo

Objetivo:

> Descobrir se avançar rodadas é divertido.

Conteúdo:

- oito clubes;
- uma liga;
- uma temporada curta;
- 200 jogadores;
- escalação;
- três formações;
- três mentalidades;
- partida instantânea;
- narração;
- tabela;
- mercado básico;
- save local ou temporário.

Critério de sucesso:

- usuário voluntariamente joga dez rodadas;
- compreende o resultado;
- muda escalação ou tática;
- deseja iniciar outra temporada.

Não incluir Three.js no primeiro teste do motor.

---

# 57. Vertical slice

Conteúdo:

- vinte clubes;
- liga completa;
- copa;
- aproximadamente 500 jogadores;
- transferências;
- contratos;
- moral;
- condição;
- jovens;
- finanças;
- histórico;
- partida 2D;
- cena 3D mínima;
- cadastro;
- save em nuvem.

Critério de sucesso:

- temporada completa;
- calendário íntegro;
- economia estável;
- IA funcional;
- save recarregável;
- usuários retornam.

---

# 58. MVP comercial

## 58.1 Conteúdo

- 80 clubes;
- quatro divisões;
- aproximadamente 2.000 jogadores;
- copa nacional;
- regionais;
- competição continental;
- mercado;
- empréstimos;
- contratos;
- base;
- aposentadoria;
- finanças;
- estádio;
- diretoria;
- torcida;
- carreira;
- histórico.

## 58.2 Partida

- instantânea;
- texto;
- 2D;
- 3D opcional;
- substituições;
- táticas;
- estatísticas;
- notas.

## 58.3 Plataforma

- web responsiva;
- desktop prioritário;
- PWA opcional;
- cloud save;
- billing;
- observabilidade;
- suporte.

## 58.4 Não inclui

- multiplayer;
- seleções;
- workshop público;
- ligas reais;
- licenças;
- app nativo;
- narração por voz;
- staff complexo;
- agentes avançados;
- imprensa.

---

# 59. Roadmap

## Fase 0 — Pesquisa e balanceamento

- planilha de regras;
- simulador de força;
- economia;
- distribuição de jogadores;
- calendário;
- protótipo do motor.

## Fase 1 — Protótipo

- liga curta;
- escalação;
- tática;
- partida;
- tabela;
- mercado simples.

## Fase 2 — Vertical slice

- carreira;
- save;
- IA;
- contratos;
- finanças;
- histórico;
- 2D;
- 3D inicial.

## Fase 3 — MVP

- quatro divisões;
- copas;
- base;
- estádio;
- monetização;
- editor básico;
- cloud.

## Fase 4 — Conteúdo e comunidade

- editor completo;
- mods;
- packs;
- perfis;
- compartilhamento;
- desafios.

## Fase 5 — Online

- ligas privadas;
- multiplayer assíncrono;
- rankings verificados;
- temporadas compartilhadas.

---

# 60. Complexidade

| Sistema | Complexidade | Risco |
|---|---:|---:|
| UI administrativa | Média | Médio |
| Escalação e tática | Média | Médio |
| Motor de partida | Alta | Alto |
| IA de mercado | Alta | Alto |
| Calendário | Muito alta | Muito alto |
| Competições | Alta | Alto |
| Economia de longo prazo | Muito alta | Muito alto |
| Saves e migrações | Muito alta | Muito alto |
| Three.js | Média-alta | Médio |
| Editor | Alta | Alto |
| Mods | Alta | Alto |
| Multiplayer futuro | Muito alta | Muito alto |
| Licenciamento | Muito alta | Muito alto |

A maior dificuldade não é o 3D.

Os maiores riscos são:

- economia quebrar após várias temporadas;
- clubes da IA tomarem decisões ruins;
- calendário entrar em estados inválidos;
- saves quebrarem após atualizações;
- motor tornar-se previsível;
- interface crescer até ficar burocrática.

---

# 61. Critérios de qualidade do produto

Uma feature só será aprovada se:

1. produzir decisão significativa;
2. for compreensível;
3. não atrasar a temporada sem benefício;
4. funcionar com teclado;
5. funcionar sem Three.js quando aplicável;
6. preservar o save;
7. ter telemetria;
8. ter testes;
9. não introduzir pay-to-win;
10. respeitar o posicionamento.

---

# 62. Perguntas obrigatórias antes de adicionar uma feature

- Isso torna a carreira mais interessante?
- Isso produz uma decisão ou apenas mais cliques?
- O usuário precisará repetir essa ação muitas vezes?
- Pode ser automatizado?
- Pode ser opcional?
- Pode ser resumido?
- Funciona depois de vinte temporadas?
- A IA consegue usar?
- É possível testar?
- Compromete o save?
- É necessária para o MVP?
- Aproxima o jogo da proposta ou de um simulador burocrático?

---

# 63. Regras de UX

- Uma ação principal por tela.
- Modais apenas para decisões curtas.
- Telas inteiras para fluxos complexos.
- Não esconder informações críticas em hover.
- Não exigir drag and drop.
- Não usar animações como bloqueio.
- Não misturar dados do mundo real com fictícios sem sinalização.
- Sempre mostrar efeito esperado de decisões financeiras.
- Sempre mostrar prazo de contrato.
- Sempre mostrar indisponibilidade na escalação.
- Sempre permitir comparar jogadores.
- Sempre oferecer retorno ao contexto anterior.

---

# 64. Regras de conteúdo

- Textos curtos;
- tom esportivo;
- sem excesso de jargão;
- números consistentes;
- unidades claras;
- datas dentro do calendário do jogo;
- notícias derivadas de fatos;
- variações sem alterar significado;
- nomes fictícios culturalmente coerentes;
- evitar estereótipos.

---

# 65. Decisões irreversíveis ou caras

Devem ser prototipadas antes de implementação definitiva:

- modelo econômico;
- escala de força;
- curva de evolução;
- quantidade de jogadores;
- motor de calendário;
- formato de save;
- determinismo;
- regras de compatibilidade;
- modelo de mods;
- estratégia de billing;
- arquitetura do engine.

---

# 66. Registro de decisões

## ADR-001 — Plataforma

**Decisão:** somente web no escopo atual.

**Motivo:** validação mais rápida, melhor experiência para telas densas e menor custo operacional.

## ADR-002 — Interface

**Decisão:** HTML para gestão e Three.js apenas para visualização.

**Motivo:** acessibilidade, performance, legibilidade e manutenção.

## ADR-003 — Motor

**Decisão:** engine puro em TypeScript, desacoplado de framework.

**Motivo:** testes, portabilidade, determinismo e evolução.

## ADR-004 — Backend

**Decisão:** API Node/Fastify e workers separados do Next.js.

**Motivo:** isolar simulação e tarefas intensivas.

## ADR-005 — Banco

**Decisão:** PostgreSQL como fonte primária.

**Motivo:** integridade relacional, transações e maturidade.

## ADR-006 — Filas

**Decisão:** BullMQ e Redis para tarefas assíncronas.

**Motivo:** concorrência, retries, escalabilidade e observabilidade.

## ADR-007 — Monetização

**Decisão:** gratuito funcional + licença permanente + assinatura online opcional.

**Motivo:** experimentar antes de pagar, preservar confiança e monetizar custos recorrentes separadamente.

## ADR-008 — Licenças esportivas

**Decisão:** universo fictício no lançamento.

**Motivo:** reduzir risco jurídico, custo e dependência externa.

## ADR-009 — Single-player

**Decisão:** núcleo single-player.

**Motivo:** menor complexidade e alinhamento com a experiência histórica.

## ADR-010 — Visualização

**Decisão:** resultado instantâneo, texto, 2D e 3D coexistem.

**Motivo:** respeitar perfis, tempo, acessibilidade e hardware.

## ADR-011 — Determinismo

**Decisão:** toda simulação usa seed e versão.

**Motivo:** replay, testes, auditoria e estabilidade.

## ADR-012 — Saves

**Decisão:** snapshots versionados e eventos relevantes.

**Motivo:** equilíbrio entre performance, auditoria e complexidade.

---

# 67. Definição final

O produto será considerado fiel à proposta quando:

- uma pessoa começar a jogar sem tutorial extenso;
- a primeira partida acontecer rapidamente;
- uma rodada for curta;
- uma temporada não virar trabalho;
- contratar e escalar forem satisfatórios;
- clubes pequenos tiverem trajetórias significativas;
- a IA mantiver o mundo vivo;
- jogadores gerados criarem apego;
- o histórico transformar o save em memória;
- o 3D enriquecer sem controlar o produto;
- o modo gratuito demonstrar o jogo real;
- pagar ampliar a experiência sem comprar vantagem.

A principal regra permanece:

> **Nenhuma tecnologia, animação ou feature pode destruir a velocidade, a clareza e a autoria que tornam uma carreira de futebol viciante.**

---

# 68. Referências de mercado e tecnologia

Referências consultadas para orientar este documento:

- Brasfoot — página oficial e funcionalidades da edição 2022–2023:
  - https://www.brasfoot.com/
  - https://www.brasfoot.com/o-brasfoot-2022-2023.html

- Football Manager 26 — posicionamento, interface e fundação tecnológica:
  - https://www.footballmanager.com/fm26
  - https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface

- Hattrick — manager web gratuito, progressão por divisões e monetização sem vantagens esportivas:
  - https://www.hattrick.org/en/football-manager-game.aspx
  - https://user.hattrick.org/en/

- Next.js App Router:
  - https://nextjs.org/docs/app
  - https://nextjs.org/docs/app/getting-started

- Node.js Worker Threads:
  - https://nodejs.org/api/worker_threads.html

- BullMQ:
  - https://docs.bullmq.io/
  - https://docs.bullmq.io/guide/workers/concurrency

- React Three Fiber:
  - https://r3f.docs.pmnd.rs/
  - https://r3f.docs.pmnd.rs/advanced/scaling-performance

- PostgreSQL:
  - https://www.postgresql.org/docs/current/

---

# 69. Checklist do MVP

## Conta

- [ ] Landing
- [ ] Cadastro
- [ ] Login
- [ ] Recuperação
- [ ] Perfil
- [ ] Entitlements
- [ ] Billing

## Carreira

- [ ] Criar carreira
- [ ] Escolher treinador
- [ ] Escolher clube
- [ ] Salvar
- [ ] Carregar
- [ ] Arquivar
- [ ] Migrar versão

## Clube

- [ ] Visão geral
- [ ] Objetivos
- [ ] Diretoria
- [ ] Torcida
- [ ] Estádio
- [ ] Finanças
- [ ] Histórico

## Elenco

- [ ] Lista
- [ ] Perfil
- [ ] Comparação
- [ ] Moral
- [ ] Condição
- [ ] Ritmo
- [ ] Lesão
- [ ] Suspensão
- [ ] Evolução
- [ ] Aposentadoria

## Tática

- [ ] Formação
- [ ] Escalação
- [ ] Banco
- [ ] Mentalidade
- [ ] Construção
- [ ] Foco
- [ ] Pressão
- [ ] Linha
- [ ] Marcação
- [ ] Automatização

## Mercado

- [ ] Busca
- [ ] Filtros
- [ ] Lista
- [ ] Oferta
- [ ] Contraproposta
- [ ] Compra
- [ ] Venda
- [ ] Empréstimo
- [ ] Contrato
- [ ] Rescisão

## Base

- [ ] Geração
- [ ] Avaliação
- [ ] Promoção
- [ ] Dispensa
- [ ] Desenvolvimento

## Competição

- [ ] Liga
- [ ] Copa
- [ ] Regional
- [ ] Continental
- [ ] Classificação
- [ ] Artilharia
- [ ] Calendário
- [ ] Premiação
- [ ] Promoção
- [ ] Rebaixamento

## Partida

- [ ] Pré-jogo
- [ ] Simulação
- [ ] Resultado instantâneo
- [ ] Texto
- [ ] 2D
- [ ] 3D
- [ ] Substituição
- [ ] Tática ao vivo
- [ ] Estatísticas
- [ ] Pós-jogo
- [ ] Replay

## Mundo

- [ ] Busca
- [ ] Clubes
- [ ] Jogadores
- [ ] Rankings
- [ ] Notícias
- [ ] Transferências
- [ ] Campeões
- [ ] Recordes

## Engenharia

- [ ] Engine
- [ ] Seed
- [ ] Versionamento
- [ ] API
- [ ] Workers
- [ ] Filas
- [ ] Banco
- [ ] Storage
- [ ] Auth
- [ ] Logs
- [ ] Métricas
- [ ] E2E
- [ ] Carga
- [ ] Backup
- [ ] Rollback
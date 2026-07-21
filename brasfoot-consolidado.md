# Brasfoot legado — documento consolidado (reconstrução histórica, funcional e de produto)

> **Documento único canônico**, resultado da fusão de duas pesquisas paralelas sobre o Brasfoot (uma síntese enxuta de referência e uma reconstrução longa e detalhada). Unifica história, jogabilidade, ligas, monetização, reconstrução técnica, fatores de engajamento e lições de produto, mantendo a separação explícita entre fato, relato, inferência e lacuna.
>
> **Objetivo deste documento:** reconstruir, com o maior grau de fidelidade possível, como o Brasfoot clássico funcionava, quais eram seus principais fluxos, funcionalidades, ligas, mecanismos de monetização, escolhas técnicas e fatores de engajamento.
>
> **Escopo:** a ênfase está nas versões de PC, especialmente entre 2003 e o início da década de 2020. A versão mobile é mencionada apenas quando ajuda a compreender a evolução do produto.
>
> **Limitação importante:** o código-fonte, o modelo de dados interno, a fórmula exata do motor de partidas, o algoritmo de geração de resultados e o algoritmo de validação das chaves de registro não foram publicados. Nessas áreas, este documento diferencia fatos documentados de inferências técnicas.

---

## 1. Resumo executivo

O Brasfoot nasceu em 2003 como um jogo brasileiro de gerenciamento de futebol criado por Emmanuel dos Santos. Sua proposta ocupava deliberadamente o espaço entre dois extremos:

- o **Elifoot**, simples, rápido e acessível, mas percebido como limitado;
- o **Championship Manager/Football Manager**, muito completo, porém pesado, lento e complexo para uma grande parcela do público brasileiro.

O Brasfoot preservou a velocidade e a simplicidade do primeiro, mas adicionou uma camada suficiente de profundidade para criar carreiras longas, histórias emergentes e senso de controle. O jogador podia administrar escalação, tática, transferências, contratos, estádio, preços dos ingressos, finanças e competições nacionais e internacionais, sem precisar interpretar centenas de atributos ou assistir a partidas longas.

A essência do produto pode ser resumida assim:

> **Um simulador local, leve, rápido, editável e profundamente conectado ao futebol brasileiro, no qual uma temporada inteira podia avançar em pouco tempo, mas cada carreira ainda produzia histórias únicas.**

Os principais fatores de atração foram:

1. **Baixíssima barreira de entrada:** instalador pequeno, exigência modesta de hardware e interface direta.
2. **Progressão acelerada:** temporadas rápidas e feedback frequente.
3. **Fantasia de ascensão:** levar um clube pequeno das divisões inferiores até títulos nacionais, continentais e mundiais.
4. **Conteúdo brasileiro:** estaduais, divisões inferiores, Copa do Brasil, Libertadores e jogadores conhecidos.
5. **Banco de dados aberto:** times, jogadores, escudos, uniformes e ligas podiam ser modificados ou ampliados.
6. **Comunidade produtora:** sites e fóruns distribuíam atualizações, superpatches, ligas, análises e desafios.
7. **Histórias emergentes:** jovens que evoluíam, veteranos que se aposentavam, contratos vencendo, crises de moral, demissões e propostas de outros clubes.
8. **Monetização pouco agressiva:** uma versão gratuita funcional e um registro barato, normalmente de pagamento único, para liberar o conteúdo completo.
9. **Multijogador local:** várias pessoas podiam controlar equipes na mesma carreira.
10. **Espaço para imaginação:** a partida era majoritariamente textual e estatística, permitindo que o usuário “completasse” mentalmente a narrativa.

A arquitetura mais provável era um **aplicativo desktop monolítico, local-first**, executado sobre a JVM (Java confirmado sobretudo nas edições recentes), com conteúdo carregado de arquivos no disco, saves locais e pouca ou nenhuma dependência de servidor durante a jogabilidade. A modularidade dos arquivos de times e imagens permitiu que uma comunidade inteira mantivesse o jogo atualizado mesmo quando a frequência de lançamentos oficiais diminuiu.

---

## 2. Como esta pesquisa deve ser interpretada

### 2.1 Níveis de confiança

Este documento utiliza quatro níveis implícitos de confiança:

| Nível | Significado |
|---|---|
| **Confirmado** | Encontrado em página oficial, manual, entrevista com o criador ou documentação direta. |
| **Corroborado** | Aparece de forma consistente em mais de uma fonte histórica ou comunitária. |
| **Inferido** | Reconstrução técnica ou de produto baseada no comportamento observado e nos artefatos disponíveis. |
| **Não verificado** | Relato isolado ou detalhe que pode variar por versão. |

### 2.2 O que significa “Brasfoot clássico”

Não existiu uma única versão imutável do Brasfoot. O jogo recebeu edições anuais e builds corretivas. Algumas funcionalidades surgiram, foram redesenhadas ou desapareceram. Portanto, “Brasfoot clássico” neste documento representa o conjunto de mecânicas que definiu o produto entre 2003 e aproximadamente 2022–2023.

Quando uma funcionalidade era específica de determinada época, isso é indicado.

---

# Parte I — História e posicionamento

## 3. Origem

O primeiro Brasfoot foi lançado em 2003 por **Emmanuel dos Santos** (Belo Horizonte/MG, torcedor do Cruzeiro), programador que criou e manteve o jogo praticamente sozinho — com o apoio de beta-testers — por muitos anos. *(Confirmado)*

**Correção factual:** não há evidência de que “Maurício Lima” tenha criado o Brasfoot. O criador documentado em todas as fontes confiáveis é Emmanuel dos Santos. *(Corroborado)*

A formação de Emmanuel aparece de forma conflitante nas fontes (relatos citam **história** e também **Ciência da Computação**), de modo que esse detalhe biográfico permanece **não verificado**. O que é consistente é o perfil de desenvolvedor solo autodidata na prática.

A inspiração declarada era o português **Elifoot** (de André Elias, existente desde meados dos anos 1980, originalmente no ZX Spectrum). Emmanuel também citou projetos paralelos, como o **Cyberfoot** — uma vertente internacional/menos conhecida cujo papel exato (precursor ou spin-off) as fontes divergem. *(Não verificado)*

Em entrevista concedida em 2017 (UOL Esporte), Emmanuel explicou que buscava uma alternativa brasileira entre o Elifoot e o Championship Manager. O primeiro era rápido, porém limitado; o segundo era detalhado demais e exigia mais tempo e recursos. O objetivo do Brasfoot era preservar a diversão imediata e a velocidade, adicionando complexidade suficiente para sustentar uma carreira e mantendo relação com a cultura brasileira.

> “Não havia nenhum jogo que não fosse tão limitado como o Elifoot […] ou pesado e detalhista como o Championship Manager. Um jogo que fosse divertido e rápido, mas que também tivesse alguma complexidade e relação com a cultura brasileira.”
> — Emmanuel dos Santos (UOL Esporte, 2017)

Isso explica várias decisões estruturais:

- poucos atributos visíveis por jogador;
- partidas curtas;
- interface de telas e tabelas;
- feedback imediato;
- ligas e clubes brasileiros;
- dados editáveis;
- ausência de um motor gráfico pesado;
- ciclos de temporada rápidos.

## 4. Linha do tempo resumida

A tabela abaixo não pretende documentar cada build, mas destacar mudanças que alteraram a proposta do produto.

| Período | Evolução principal |
|---|---|
| **2003** | Primeira versão. Um país por carreira, poucas competições (segundo Emmanuel, “apenas dois campeonatos”), cerca de 40 clubes distribuídos em quatro grupos/divisões de dez. Já havia escalação, táticas, confiança da diretoria/torcida, mercado e ranking. |
| **2004** | Estaduais, Libertadores/Champions, notícias e táticas mais ricas; dez times por divisão; sorteio de clubes. Havia opções extras (linha de impedimento, jogadas aéreas) depois alteradas ou removidas. |
| **2005** | Copa Sul-Americana, Copa UEFA e Copa do Mundo; divisões de vinte times; estatísticas pós-jogo mais ricas; características “modernas”. |
| **2006** | Copa América e Eurocopa; árbitros; amistosos; contratos por data. |
| **2007** | Várias ligas ao mesmo tempo; fim do sorteio de clubes. |
| **2008** | Séries A/B/C; início dos empréstimos; galeria de troféus. |
| **2009** | Série D e acesso via estaduais; empréstimos aprimorados. |
| **2010** | Escalação drag-and-drop no gramado (camisas verdes = titulares, amarelas = reservas); IA reformulada; lado preferido. O manual já descrevia ligas nacionais, estaduais, Libertadores/Champions, Sul-Americana/Europa, Mundial, Copa do Mundo, Copa América/Euro, amistosos, contratos, moral, estádio, finanças, base, empréstimos e editor. |
| **2011** | Recopa Sul-Americana e Supercopa Europeia; foco em estabilidade do motor. |
| **2012** | Ex-jogadores podiam tornar-se treinadores; time da semana/ano; Bola de Ouro; terceiro uniforme; ranking de reputação; nacionalidade do treinador ganhou relevância. |
| **2013** | Melhorias no editor; Copa do Brasil ampliada para 64 clubes; Libertadores/Champions já disputáveis na primeira temporada. |
| **2014** | Capacidades reais de estádios; competições continentais africanas (CAF) e asiáticas (AFC); grupos reais da Copa do Mundo de 2014. |
| **2015** | Formatos estaduais configuráveis; categoria de base sub-21; sócio-torcedor como receita. |
| **2016** | Editor de campeonatos; Copa do Brasil ampliada para 128 clubes; ranking CBF; tag “Top Mundial”; forte ampliação de opções de campeonato e seleções; remoção de modos antigos (incluindo o modo fantasia). |
| **2017** | Ajustes em Libertadores/Champions; amistosos e qualificatórias de seleção aperfeiçoados. |
| **2018** | Habilidades/qualidades individuais numéricas com maior detalhamento e foco de treino; lançamento da versão **Android**. |
| **2022–2023** | Última grande edição oficial de PC (Brasfoot 22-23, por volta de abril de 2022). Incluiu novos formatos, rankings, amistosos, qualificatórias, Nations League, mais reservas/substituições e playoffs de rebaixamento. |
| **2024–2025 em diante** | A versão mobile permaneceu disponível e monetizada com recursos premium. O registro da edição de PC passou a ser distribuído gratuitamente no site oficial (freeware, por volta de 2025). |

---

## 5. Posicionamento competitivo

### 5.1 O espaço que o Brasfoot ocupava

| Jogo | Complexidade | Ritmo | Identidade brasileira | Personalização | Exigência de hardware |
|---|---:|---:|---:|---:|---:|
| Elifoot | Baixa | Muito rápido | Parcial | Limitada | Muito baixa |
| Brasfoot | Baixa a média | Muito rápido | Muito forte | Alta | Muito baixa |
| Championship Manager / Football Manager | Alta | Lento a moderado | Global | Alta, mas mais complexa | Maior |
| FIFA/PES — modo carreira | Média | Dependente de partidas jogadas | Licenciado/global | Baixa a média | Alta |

O Brasfoot não venceu pela fidelidade audiovisual. Venceu pela combinação de:

- **ritmo de jogo quase instantâneo**;
- **profundidade suficiente para gerar decisões**;
- **compatibilidade com computadores modestos**;
- **familiaridade cultural**;
- **liberdade de edição**.

### 5.2 Comparação cultural com FM/CM (Brasil dos anos 2000)

Além do posicionamento técnico, havia um contraste cultural que explica boa parte da adoção no Brasil:

| Dimensão | Brasfoot | FM / CM |
|----------|----------|---------|
| Público | PC “do povo”, lan house | Nicho hardcore |
| Idioma | Português nativo | Inglês (barreira) |
| Complexidade | Rápido, abstrato | Profundo, lento |
| Preço (~2017) | ~R$ 12,90 | ~R$ 150 no exterior |
| Identidade | BR, estaduais, boca a boca | Britânico, scouting |
| Papel cultural | Diversão acessível | “O sério” |

---

# Parte II — Loop de gameplay

## 6. O loop central

O loop principal era:

```text
Criar carreira
    ↓
Escolher competições, país e treinador(es)
    ↓
Assumir um clube
    ↓
Organizar elenco e finanças
    ↓
Escalar e definir tática
    ↓
Disputar partida
    ↓
Receber resultado, renda, moral, lesões e classificação
    ↓
Negociar jogadores e ajustar o time
    ↓
Avançar rodada
    ↓
Conquistar objetivos, subir de divisão ou ser demitido
    ↓
Iniciar nova temporada com elenco envelhecido e novas histórias
```

O diferencial era a frequência de recompensa. Cada rodada alterava:

- posição na tabela;
- saldo de gols;
- moral;
- confiança da torcida;
- condição dos atletas;
- caixa;
- valor dos jogadores;
- chance de título, acesso ou rebaixamento;
- reputação do treinador.

Não era necessário esperar muito para que uma decisão produzisse consequência.

## 7. Jornada completa de uma carreira

### 7.1 Criação do jogo

Dependendo da versão, o usuário podia configurar:

- nome do treinador;
- quantidade de treinadores humanos;
- país ou liga principal;
- formato das divisões;
- campeonatos estaduais;
- copas nacionais;
- competições continentais;
- seleções;
- clubes e bases adicionais;
- início em determinada divisão;
- velocidade ou parâmetros gerais da simulação.

Nas versões registradas, normalmente existiam mais opções de divisão, países, competições e treinadores humanos.

### 7.2 Escolha ou atribuição de clube

A experiência podia variar por edição:

- escolha direta de um clube;
- início em divisão inferior;
- controle simultâneo de mais de um treinador humano;
- troca de clube por proposta;
- demissão por desempenho ruim;
- pedido de demissão;
- avanço para equipes de maior reputação.

A restrição histórica da versão gratuita de iniciar em divisões inferiores tinha uma consequência positiva de design: transformava a limitação comercial em um **desafio aspiracional**.

### 7.3 Pré-temporada

A pré-temporada concentrava decisões de preparação:

- observar o elenco;
- identificar posições fracas;
- vender excedentes;
- contratar atletas;
- pedir ou disponibilizar empréstimos;
- renovar contratos;
- configurar titulares e reservas;
- definir formação e estilo;
- marcar amistosos;
- ajustar preço dos ingressos;
- avaliar ou ampliar estádio.

### 7.4 Semana/rodada

Entre partidas, o jogador:

1. recebia mensagens e notificações;
2. verificava suspensos, lesionados e contratos;
3. administrava propostas;
4. ajustava escalação e tática;
5. avançava para a partida;
6. realizava substituições e alterações táticas;
7. via o resultado e as estatísticas;
8. acompanhava tabela, artilharia e rankings.

### 7.5 Fim de temporada

O encerramento da temporada podia gerar:

- título;
- acesso;
- rebaixamento;
- classificação continental;
- renovação ou ruptura com o clube;
- propostas de outras equipes;
- mudança na reputação do treinador;
- aposentadoria de atletas;
- promoção de jovens;
- atualização de rankings e campeões;
- nova composição das divisões.

O loop não terminava com a conquista. O envelhecimento do elenco, a rotatividade de clubes e o histórico acumulado sustentavam carreiras extensas.

---

# Parte III — Inventário funcional

## 8. Gestão do treinador

Funcionalidades documentadas ou recorrentes:

- criação de treinador;
- nome personalizado;
- ranking de treinadores;
- pontuação por vitórias e títulos;
- histórico de conquistas;
- propostas de outros clubes;
- demissão;
- pedido de demissão;
- possibilidade de treinar seleções em versões posteriores;
- múltiplos treinadores humanos na mesma carreira;
- ex-jogadores tornando-se treinadores em determinadas versões;
- comparação entre treinadores;
- bônus de reputação por títulos.

### Por que funcionava

O jogador não controlava apenas um clube; construía uma **carreira pessoal**. Isso permitia abandonar um time após um ciclo vitorioso e iniciar outro projeto sem apagar o save.

---

## 9. Elenco e jogadores

### 9.1 Informações centrais

Os jogadores possuíam, conforme a versão:

- nome;
- idade;
- posição;
- lado preferido;
- força geral;
- características ou especialidades;
- moral;
- salário;
- valor;
- tempo de contrato;
- condição física;
- status de lesão;
- status de suspensão;
- gols;
- média/notas;
- cartões;
- nacionalidade;
- histórico ou reputação.

### 9.2 Força geral

No Brasfoot clássico, a força aparecia em uma escala aproximada de 1 a 100 (algumas fontes citam 1 a 99). O manual descrevia esse valor como uma média ponderada das capacidades do atleta.

Essa abstração tinha três vantagens:

1. tornava a comparação rápida;
2. reduzia a carga cognitiva;
3. mantinha um pouco de incerteza, porque características e posição ainda importavam.

### 9.3 Características

Cada jogador costumava ter até **duas características inatas**. Entre as historicamente documentadas para jogadores de linha:

- armação;
- cabeceio;
- cruzamento;
- desarme;
- drible;
- finalização;
- marcação;
- passe;
- resistência;
- velocidade.

Para goleiros:

- colocação;
- saída do gol;
- reflexo;
- defesa de pênaltis.

Versões antigas também experimentaram traços comportamentais, como indisciplina, explosividade, pouca habilidade e fair play. Nem todos permaneceram nas edições posteriores.

A partir de **2018**, além da força e das características inatas, os jogadores passaram a ter **habilidades individuais numéricas** — por exemplo Goleiro, Agilidade, Passe, Armação, Desarme, Finalização e Técnica — acompanhadas de um foco de treino semanal. Isso adicionou uma camada opcional de detalhamento sem eliminar a legibilidade da força única. *(Corroborado)*

### 9.4 Evolução e declínio

O desempenho e a força eram afetados por:

- idade;
- força atual;
- utilização;
- moral;
- condição;
- treinamento, em versões posteriores;
- fase da carreira.

Em linhas gerais:

- jovens tinham maior margem de evolução;
- atletas maduros estabilizavam;
- jogadores acima de aproximadamente 32 anos entravam em declínio;
- veteranos podiam se aposentar;
- a base repunha parte do elenco.

### 9.5 Moral

A moral podia cair por:

- ficar no banco;
- excesso de desgaste;
- salário baixo;
- conflitos;
- resultados ruins;
- seca de gols;
- pênalti perdido;
- problemas psicológicos ou eventos aleatórios, conforme a versão.

A moral servia como um modificador invisível ou semivisível entre “força nominal” e “performance real”.

### 9.6 Condição e disponibilidade

Um atleta podia ficar indisponível por:

- lesão;
- suspensão;
- contrato vencido;
- transferência recente entre equipes humanas;
- desgaste excessivo.

Jogar fora de posição era permitido em algumas situações, porém reduzia o desempenho. A interface sinalizava isso visualmente.

---

## 10. Categorias de base

A base funcionava como mecanismo de renovação do mundo.

Características reconstruídas:

- promoção de jovens para o elenco principal;
- idade inicial normalmente entre 17 e 20 anos;
- força inicial baixa ou moderada;
- posição compatível com a necessidade ou geração do clube;
- reposição de atletas aposentados;
- possibilidade de desenvolver e vender promessas.

Antes de 2015, o mecanismo básico era promover um júnior sempre que um profissional se aposentava. A partir de **2015**, o jogo passou a ter uma **academia formal sub-21**, com espaço para vários juniores (relatos citam até 18), indicador de potencial, peneiras, promoção ao elenco principal e amistosos da base. *(Corroborado)*

### Papel sistêmico

A base cumpria quatro funções:

1. impedir que a carreira morresse por falta de jogadores;
2. criar apego emocional;
3. oferecer ativos baratos;
4. produzir histórias exclusivas de cada save.

Um jovem gerado pelo sistema não existia no futebol real. Por isso, suas conquistas pertenciam integralmente à narrativa do jogador.

---

## 11. Mercado de transferências

### 11.1 Compra

O treinador podia:

- pesquisar jogadores;
- consultar valor e salário;
- fazer propostas;
- comprar atletas listados;
- negociar com outros clubes;
- receber recusas;
- contratar conforme limite de elenco e orçamento.

Em algumas versões ou modos, a versão registrada liberava a possibilidade de fazer oferta por qualquer jogador, não apenas pelos listados.

### 11.2 Venda

Fluxos históricos incluíam:

- colocar atleta à venda;
- receber proposta;
- aceitar ou recusar;
- vender por leilão em versões antigas;
- negociar valor;
- liberar espaço salarial;
- obter lucro com jovens.

### 11.3 Empréstimos

O sistema contemplava:

- colocar atleta para empréstimo;
- pedir jogador emprestado;
- limite de empréstimos;
- retorno ao fim do período;
- utilização do mecanismo para jovens ou reservas.

Em materiais de registro de 2021, até quatro empréstimos aparecem entre os recursos completos.

### 11.4 Contratos

O manual descrevia contratos de:

- seis meses;
- um ano;
- dois anos.

O sistema notificava o usuário quando um vínculo estava perto do fim. Um jogador sem contrato não podia atuar. A rescisão tinha custo proporcional.

### 11.5 Valor de mercado

O valor era provavelmente derivado de uma combinação de:

- força;
- idade;
- posição;
- fase;
- contrato;
- reputação;
- oferta e demanda simplificadas.

A fórmula exata não é pública.

---

## 12. Escalação

A tela de escalação era um dos centros da experiência.

Funcionalidades:

- titulares e reservas;
- arrastar ou posicionar jogadores sobre a formação;
- seleção automática do “melhor time”;
- formação pré-configurada;
- identificação por cores de titulares, reservas e indisponíveis;
- substituições;
- improvisação;
- capitão ou cobradores, conforme a edição;
- exibição de força/condição/moral;
- limites de banco e substituições atualizados ao longo dos anos.

### Decisão de design

A escalação tinha aparência tática, mas evitava micromanejo excessivo. O usuário tomava decisões com poucos sinais claros:

- posição;
- força;
- característica;
- lado;
- condição;
- moral.

---

## 13. Táticas

### 13.1 Formação

O Brasfoot oferecia formações livres e presets conhecidos, por exemplo:

- 4-4-2;
- 4-3-3;
- 3-5-2;
- 5-3-2;
- 5-4-1;
- variações com meias e atacantes.

A lista exata variava por versão. Em 2004 chegaram a existir opções táticas extras (como linha de impedimento e jogadas aéreas) que foram posteriormente alteradas ou removidas.

### 13.2 Estilo

O manual histórico descrevia estilos como:

- equilibrado;
- ataque total;
- contra-ataque.

### 13.3 Direção ofensiva

Era possível concentrar jogadas:

- pelo meio;
- pelas laterais.

O manual indicava que a escolha direcionava boa parte dos ataques ao setor escolhido (relatos apontam algo próximo de 70%), sem eliminar totalmente os demais caminhos.

Também era possível definir **capitão** e **batedores** (faltas, pênaltis e cobranças), conforme a edição.

### 13.4 Marcação

Níveis históricos:

- leve;
- pesada;
- muito pesada.

O aumento da intensidade podia reduzir a eficiência do adversário, mas elevava o risco de:

- faltas;
- cartões;
- expulsões;
- suspensões.

### 13.5 Relação entre tática e elenco

As características dos atletas tinham função contextual:

- cruzamento e velocidade favoreciam laterais;
- armação e passe favoreciam construção central;
- cabeceio favorecia jogo aéreo;
- marcação e desarme favoreciam contenção;
- finalização favorecia atacantes.

A profundidade vinha menos da quantidade de opções e mais da interação entre poucas opções significativas.

---

## 14. Partidas

### 14.1 Apresentação

A partida era predominantemente textual e estatística:

- placar;
- cronômetro;
- eventos;
- gols;
- cartões;
- lesões;
- substituições;
- posse ou estatísticas, dependendo da versão;
- notas dos atletas;
- velocidade configurável;
- sons e atalhos.

Não havia dependência de uma representação gráfica 2D ou 3D complexa.

### 14.2 Controles durante o jogo

O usuário podia:

- pausar ou acelerar;
- alterar velocidade;
- substituir jogadores;
- mudar formação;
- mudar estilo;
- alterar marcação;
- reagir a expulsões e lesões.

Documentações comunitárias registram atalhos de função para velocidades e teclas para substituições.

### 14.3 Resultado

Após a partida, eram atualizados:

- classificação;
- gols pró/contra;
- artilharia;
- notas;
- moral;
- condição;
- cartões;
- lesões;
- público;
- renda;
- confiança;
- ranking;
- objetivos.

### 14.4 Motor de simulação — reconstrução provável

A fórmula real não é conhecida. Um modelo conceitualmente compatível com o comportamento do jogo seria:

```text
força_efetiva_do_time =
    força_dos_escalados
    × adequação_de_posição
    × condição
    × moral
    × ajuste_tático
    × mando_de_campo
    × fator_aleatório

volume_de_ataques =
    ritmo_da_partida
    × postura_tática
    × capacidade_de_criação
    × erros_do_adversário

chance_de_gol =
    qualidade_do_ataque
    × finalização
    × vulnerabilidade_defensiva
    × contexto_da_jogada
    × aleatoriedade
```

Essa não é a fórmula do Brasfoot. É uma reconstrução plausível para explicar como um motor simples poderia produzir:

- placares variados;
- zebras;
- impacto tático;
- importância da força;
- efeito de moral e condição;
- desempenho por características.

### 14.5 Por que a imprevisibilidade era importante

Se a equipe mais forte sempre vencesse, o gerenciamento perderia valor. Se o resultado fosse aleatório demais, as decisões pareceriam inúteis.

O Brasfoot precisava manter uma faixa intermediária:

- força e escalação importavam;
- tática produzia vantagem;
- o mando influenciava;
- ainda existiam zebras, fases ruins e viradas.

Essa tensão criava a sensação de “só mais uma rodada”.

---

## 15. Finanças

O manual histórico lista quatro fontes principais:

1. venda de jogadores;
2. ingressos;
3. patrocínio;
4. amistosos.

Versões posteriores adicionaram ou refinaram receitas relacionadas a torcida e sócios — em particular o **sócio-torcedor a partir de 2015**. Entre as despesas, além de salários, compras e expansão de estádio, havia rescisões e a possibilidade de **empréstimo bancário**.

### 15.1 Ingressos

O treinador podia ajustar o preço.

Trade-off:

```text
preço baixo → público maior, receita por pessoa menor
preço alto  → receita por pessoa maior, risco de público menor
```

### 15.2 Estádio

Funcionalidades:

- capacidade;
- público;
- ampliação;
- custo de expansão;
- receitas em casa;
- capacidade real em versões posteriores (a partir de 2014);
- qualidade do gramado (de excelente a péssimo), que em versões posteriores afetava aspectos técnicos como passe.

### 15.3 Patrocínio

O patrocínio era normalmente relacionado à divisão, reputação ou contexto competitivo.

### 15.4 Folha salarial

Os salários eram cobrados periodicamente, frequentemente associados às rodadas de liga/estadual. Contratar demais podia comprometer o caixa.

### 15.5 Amistosos

Amistosos serviam para:

- gerar renda;
- testar o time;
- preencher calendário;
- enfrentar equipes específicas;
- criar torneios amistosos em edições posteriores.

### 15.6 Economia simplificada

A economia não procurava simular contabilidade real. Seu papel era impor restrições suficientes para que:

- vender fosse necessário;
- contratar tivesse custo;
- estádio fosse investimento;
- clubes pequenos tivessem trajetória distinta de clubes grandes.

---

## 16. Confiança da diretoria e da torcida

Desde versões antigas, o desempenho afetava a percepção de:

- diretoria;
- torcida;
- clube.

Consequências possíveis:

- pressão;
- queda de reputação;
- demissão;
- aumento de prestígio;
- propostas.

Esse mecanismo transformava a classificação em mais do que uma tabela: ela era um medidor de segurança do emprego.

---

## 17. Rankings, estatísticas e memória

O Brasfoot registrava elementos como:

- ranking de clubes;
- ranking de treinadores;
- campeões;
- artilheiros;
- melhores jogadores;
- títulos;
- histórico por temporada;
- classificação final;
- seleções e reputação;
- prêmios semanais/anuais em versões posteriores;
- melhores do mundo;
- evolução de clubes.

### Por que isso importava

O save adquiria valor porque acumulava memória. Depois de dezenas de temporadas, o usuário tinha um universo próprio:

- clubes tradicionais podiam cair;
- pequenos podiam tornar-se potências;
- jogadores fictícios viravam ídolos;
- treinadores construíam dinastias;
- recordes pessoais ganhavam significado.

---

# Parte IV — Competições e ligas

## 18. Formatos nacionais

O manual de 2010 descrevia:

- liga brasileira;
- liga internacional;
- liga personalizada com clubes de diferentes países;
- quatro divisões de dez clubes;
- divisões de vinte clubes;
- copa nacional;
- estaduais no Brasil;
- acesso e rebaixamento.

Algumas opções de formato eram exclusivas da versão registrada.

## 19. Competições estaduais

Os estaduais eram um diferencial cultural importante.

Características:

- disponíveis apenas para clubes brasileiros;
- exigência mínima de equipes por estado (relatos citam ao menos seis clubes no estado);
- divisões estaduais em certas versões;
- formatos configuráveis posteriormente (a partir de ~2015);
- classificação e premiações;
- calendário integrado à temporada.

Exemplos recorrentes (via conteúdo básico e packs da comunidade): Paulista, Carioca, Mineiro, Gaúcho, Catarinense, Brasiliense, entre outros. Poucos managers internacionais davam tanta relevância ao futebol estadual brasileiro.

## 20. Copas nacionais

A Copa do Brasil e copas equivalentes faziam parte da estrutura de eliminação direta.

Ao longo das versões, a Copa do Brasil foi ampliada para comportar mais participantes e aproximar-se das mudanças reais: passou de **64 clubes (2013)** para **128 clubes (2016)**. Existia ainda uma **Supercopa nacional**, disputada entre o campeão da liga e o campeão da copa (a partir da segunda temporada).

## 21. Competições continentais

Entre as competições documentadas:

- Copa Libertadores (com pré-Libertadores);
- Copa Sul-Americana;
- Recopa Sul-Americana (~2011);
- UEFA Champions League (com pré-Champions);
- UEFA Europa League;
- Supercopa Europeia (~2011);
- competições continentais da África (CAF);
- competições continentais da Ásia (AFC);
- menções a CONCACAF e Oceania nos rankings do manual, com expansões comunitárias.

As competições africanas e asiáticas passaram a aparecer oficialmente a partir de 2014, enquanto outros continentes foram frequentemente ampliados por patches.

## 22. Mundial

O jogo incluía competição mundial de clubes, conectando o sucesso nacional ao objetivo máximo da carreira.

## 23. Seleções

O ecossistema de seleções evoluiu ao longo dos anos e incluiu:

- Copa do Mundo (a cada quatro anos, com convites por ranking/desempenho);
- eliminatórias/qualificatórias (todos os continentes nas versões recentes);
- Copa América;
- Eurocopa;
- Copa da Ásia;
- Copa Ouro (CONCACAF) e competição da Oceania (OFC);
- amistosos;
- rankings;
- convocação;
- possibilidade de treinar seleção (fortalecida por volta de 2016–2017);
- Nations League em edições recentes (22-23).

## 24. O que vinha no jogo e o que vinha da comunidade

Esta distinção é essencial.

### 24.1 Conteúdo básico documentado em torno de 2010

O manual indicava:

- Brasil;
- Espanha incluída como opção internacional;
- ligas adicionais quando o país possuía base suficiente;
- competições nacionais;
- estaduais brasileiros;
- continentais;
- seleções;
- liga personalizada.

Na demo, a carreira começava tipicamente com **Brasil ou Espanha**.

### 24.2 Área de membros/registrados

Historicamente, a área de membros (Área de Sócios) distribuía ligas de países adicionais. Um conjunto de packs por volta de 2005 incluía, por exemplo, **Alemanha, Argentina, Brasil, Espanha, França, Holanda, Inglaterra e Itália**. A comunidade expandiu depois para Portugal, Chile, México, Uruguai, MLS, Arábia Saudita e outros. Não foi encontrada uma lista oficial única e estável com todos os países de todas as edições, nem um inventário país a país do instalador 22-23 sem instalar o jogo.

### 24.3 Patches comunitários

A comunidade ampliou o conteúdo muito além do pacote básico.

Exemplo de superpatch de 2023:

- aproximadamente 70 ligas;
- cerca de 2.678 equipes;
- clubes de todos os continentes;
- atualizações de elencos;
- escudos;
- miniescudos;
- uniformes;
- competições extras.

Também existiam patches dedicados a países, como:

- Inglaterra;
- Itália;
- Alemanha;
- França;
- Portugal;
- Argentina;
- Estados Unidos;
- Arábia Saudita;
- ligas asiáticas, africanas e americanas.

### 24.4 Conclusão sobre “todas as ligas”

Não existe uma resposta única sem fixar uma versão e um patch.

O conjunto de ligas era composto por três camadas:

```text
Jogo base oficial
    +
downloads oficiais para registrados
    +
patches e superpatches comunitários
```

Por isso, dois usuários da mesma edição podiam ter universos de futebol bastante diferentes.

---

# Parte V — Monetização

## 25. Modelo histórico de PC

O Brasfoot não começou com um modelo moderno de assinatura, passe de temporada ou venda recorrente de moedas.

O modelo predominante era:

```text
download gratuito
    ↓
versão não registrada com limitações
    ↓
pagamento único de baixo valor
    ↓
chave vinculada ao nome do comprador
    ↓
desbloqueio de recursos completos da edição
```

Mais precisamente, o modelo era um **shareware / try-before-you-buy** com licença de registro por edição — não era loja de caixas nem doação pura. O pagamento clássico era feito por cartão, boleto ou depósito/transferência via **SiliconAction** (loja digital brasileira). O comprador recebia por e-mail seu nome e código, digitava no jogo e ganhava acesso à **Área de Sócios** (fórum e patches oficiais).

Preços encontrados em momentos diferentes:

| Época/fonte aproximada | Preço |
|---|---:|
| ~2008–2012 | ~R$ 12,00 a 12,90 (sócio ~R$ 10,00 a 10,90) |
| 2016 | ~R$ 14,90 novo / R$ 12,90 para sócio |
| 2017–2018 (PC) | ~R$ 12,90 |
| 2021 (PC) | ~R$ 13,00 |
| 2018 (Mobile Premium) | ~R$ 6,99 |
| ~2025 em diante (PC) | R$ 0 (registro gratuito) |

Os preços variavam pouco nominalmente, o que reforçava a percepção de produto barato.

## 26. O que era gratuito

A versão gratuita era legal e funcional. Conforme a edição, permitia:

- instalar e jogar;
- criar carreira;
- controlar clube;
- disputar campeonatos limitados;
- realizar escalação e tática;
- negociar dentro de determinadas restrições;
- avançar temporadas;
- experimentar o loop central.

Limitações documentadas em fontes históricas e secundárias incluíam:

- início obrigatório em divisão inferior;
- menor variedade de formatos;
- países restritos;
- competições internacionais bloqueadas;
- seleções bloqueadas;
- limitações em transferências;
- menos empréstimos;
- menos treinadores humanos;
- ausência de downloads exclusivos da área de membros;
- improvisação/posicionamento mais restrito em algumas versões.

As limitações mudavam por edição.

## 27. O que o registro liberava

Recursos associados ao registro em diferentes épocas:

- iniciar em qualquer divisão;
- escolher formatos de liga ampliados;
- competições continentais;
- competições de seleções;
- controlar mais treinadores humanos;
- oferecer por jogadores não listados;
- realizar mais empréstimos;
- baixar ligas adicionais;
- liberar todos os “extras” da edição;
- obter descontos ou acesso a conteúdo da comunidade parceira.

### Tabela consolidada

| Recurso | Gratuito histórico | Registrado histórico |
|---|---|---|
| Jogar o loop principal | Sim | Sim |
| Iniciar carreira | Sim | Sim |
| Começar em qualquer divisão | Frequentemente não | Sim |
| Vários formatos de divisão | Limitado | Ampliado |
| Competições continentais | Frequentemente bloqueadas | Sim |
| Seleções | Frequentemente bloqueadas | Sim |
| Oferta por qualquer atleta | Limitada | Sim em versões documentadas |
| Empréstimos | Limitados | Até quatro em material de 2021 |
| Múltiplos treinadores humanos | Limitado | Ampliado |
| Ligas extras/área de membros | Não | Sim |
| Editor e extras | Variável | Completo |

## 28. Filosofia de monetização

Em entrevista, o criador afirmou que o objetivo não era maximizar lucro. O pagamento era tratado quase como contribuição para continuidade do projeto. Também reconheceu que chaves circulavam facilmente pela internet e que apenas uma minoria pagava.

Isso produziu um arranjo incomum:

- distribuição ampla;
- baixa agressividade comercial;
- preço acessível;
- pirataria tolerada na prática;
- comunidade vista como colaboradora;
- monetização sustentada por goodwill.

## 29. Mudança posterior

Na edição de PC atualmente publicada no site oficial, o registro é gratuito e libera os extras mediante nome e código fornecidos pela própria página.

Isso significa que a análise histórica deve separar:

- **Brasfoot clássico comercial:** demo limitada + registro pago;
- **Brasfoot 22–23 atual:** download e registro gratuito;
- **Brasfoot mobile:** distribuição gratuita com compras internas e conteúdo premium.

## 30. Mobile

A versão mobile preservou parte da proposta:

- gerenciamento;
- transferências;
- táticas;
- competições;
- banco aberto;
- app leve.

No Google Play, ela aparece como gratuita com compras internas e recursos premium. Esse é um modelo diferente do desktop histórico.

---

# Parte VI — Editor, arquivos e comunidade

## 31. Banco de dados aberto

O Brasfoot permitia editar:

- nomes de clubes;
- jogadores;
- elencos;
- transferências;
- força;
- posição;
- características;
- escudos;
- miniescudos;
- uniformes;
- ligas;
- competições em versões posteriores.

O manual descrevia requisitos mínimos de elenco, incluindo ao menos um goleiro e jogadores de linha.

## 32. Estrutura de assets

Arquivos e pastas historicamente associados ao jogo:

- times;
- escudos;
- miniescudos;
- camisas/uniformes;
- saves;
- instaladores de patch.

O manual documentava formatos de imagem como GIF e BMP e miniescudos em dimensões reduzidas, por exemplo 18×18 pixels em determinadas versões.

## 33. Patches

Um patch podia:

- substituir bases de clubes;
- atualizar transferências;
- adicionar países;
- corrigir nomes;
- adicionar escudos;
- adicionar uniformes;
- criar competições;
- ajustar atributos;
- ampliar o universo jogável.

A instalação frequentemente consistia em copiar ou instalar arquivos dentro da pasta da edição, como `C:\Brasfoot22-23`.

## 34. Comunidade

A comunidade produzia:

- ligas;
- superpatches;
- análises táticas;
- desafios;
- histórias de carreira;
- fóruns;
- campeonatos de fantasy;
- escudos e uniformes;
- bases históricas;
- correções;
- tutoriais;
- rankings;
- ferramentas auxiliares.

O criador relatou que sugestões dos fóruns influenciavam o jogo e que usuários forneciam ideias, bases e elementos gráficos.

Entre os polos históricos dessa comunidade estavam o **fórum oficial / Área de Sócios** (reportado como offline em 2024), o **Vício Brasfoot** (Jéferson Santos, que parou por volta de 2022), o **Alternative Brasfoot** (Galba Novaes, conhecido por ligas e times exóticos) e superpatches como o **Rumo Brasfoot** e o **Brasil Brasfoot**, ativos anos depois. Havia ainda uma vasta produção de blogs da era Orkut com tutoriais, capturas de tela e cultura “brasfooteira”.

## 35. Fantasy e ligas entre usuários

Comunidades criavam competições paralelas usando resultados, elencos e regras próprias. Mesmo sem multiplayer online nativo, o Brasfoot funcionava como um “motor” para experiências sociais organizadas externamente.

## 36. Multiplayer local

Versões registradas permitiam vários treinadores humanos no mesmo save (relatos citam até cerca de seis), em modo hotseat no mesmo computador. Isso possibilitava:

- amigos controlando clubes diferentes;
- competição na mesma liga;
- mercado entre equipes humanas;
- campeonatos locais;
- rivalidades de longo prazo.

Era uma forma simples e eficiente de socialização presencial sem infraestrutura online. É importante notar que **não existia multiplayer online oficial** no executável: o “Brasfoot Online” que circulava era organizado pela comunidade (um organizador simulava no PC e coordenava por chat, prints de tática e ligas de fãs), não um recurso nativo do produto. O próprio criador afirmou que a sociabilidade presencial, no modo de múltiplos técnicos, era uma das intenções centrais do jogo.

---

# Parte VII — Reconstrução técnica

## 37. Linguagem e runtime

Evidências fortes indicam que o Brasfoot de PC (pelo menos nas edições recentes) foi desenvolvido para a JVM:

- a página oficial exige Java;
- comunidades Linux executavam o arquivo principal com `java -jar`;
- o jogo podia rodar com OpenJDK sem Wine;
- os instaladores eram pequenos, tipicamente entre cerca de 2 MB e 17 MB;
- um **save editor comunitário** (publicado no GitHub) desserializa os saves `.s22` do Brasfoot 22-23 usando **Kryo** a partir das próprias classes Java do jogo — indício direto de que a build recente é Java.

Portanto, é altamente provável que o produto (nas versões recentes) fosse:

- escrito majoritariamente em Java;
- empacotado como aplicação desktop;
- distribuído por instalador Windows (e, mais tarde, também como app Android, por volta de 2018);
- executado sobre JVM;
- possivelmente desenvolvido com Swing/AWT.

O toolkit visual exato não foi confirmado. Também **não há prova** sobre a linguagem das primeiras edições (2003–2009): especula-se comumente Delphi ou Visual Basic, mas isso não é comprovado, e não se pode afirmar que toda a série sempre foi Java — a evidência é forte apenas para as edições recentes.

## 38. Arquitetura provável

```text
┌──────────────────────────────────────────┐
│          Aplicação desktop Java          │
├──────────────────────────────────────────┤
│ Interface de telas, tabelas e formulários│
├──────────────────────────────────────────┤
│ Regras de carreira e competições         │
├──────────────────────────────────────────┤
│ Motor de partida                         │
├──────────────────────────────────────────┤
│ Mercado, finanças e progressão           │
├──────────────────────────────────────────┤
│ Leitura/escrita de saves                  │
├──────────────────────────────────────────┤
│ Leitura de times, ligas e assets locais  │
└──────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ Sistema de arquivos local                │
│ times / escudos / uniformes / saves      │
└──────────────────────────────────────────┘
```

### Características prováveis

- monólito desktop;
- execução offline;
- estado salvo localmente;
- conteúdo data-driven;
- motor de regras no mesmo processo;
- ausência de backend obrigatório para a carreira;
- validação de registro local ou sem dependência contínua de servidor;
- atualizações anuais por instalador;
- patches por substituição de arquivos.

## 39. Modelo de dados conceitual

Uma reconstrução moderna poderia usar as seguintes entidades:

```text
GameSave
├── Season
├── Calendar
├── HumanManager[]
├── Competition[]
├── Club[]
├── Player[]
├── Contract[]
├── Transfer[]
├── Match[]
├── Standing[]
├── Ranking[]
├── Award[]
└── NewsEvent[]
```

### 39.1 Club

```ts
type Club = {
  id: string
  name: string
  countryId: string
  stateId?: string
  reputation: number
  cash: number
  salaryBudget?: number
  stadiumId: string
  managerId?: string
  squadIds: string[]
  titles: TitleRecord[]
  boardConfidence: number
  fanConfidence: number
}
```

### 39.2 Player

```ts
type Player = {
  id: string
  name: string
  age: number
  nationalityId?: string
  position: Position
  preferredSide?: "left" | "right" | "center"
  strength: number
  traits: PlayerTrait[]
  morale: number
  condition: number
  value: number
  salary: number
  contractEndsAt?: GameDate
  clubId?: string
  injuryRounds: number
  suspensionRounds: number
  careerStats: CareerStats
}
```

### 39.3 Competition

```ts
type Competition = {
  id: string
  name: string
  type:
    | "league"
    | "knockout"
    | "state"
    | "continental"
    | "international"
    | "friendly"
  participants: string[]
  groups?: CompetitionGroup[]
  rounds: Round[]
  promotionRules?: PromotionRule[]
  relegationRules?: RelegationRule[]
  qualificationRules?: QualificationRule[]
}
```

### 39.4 Match

```ts
type Match = {
  id: string
  competitionId: string
  date: GameDate
  homeClubId: string
  awayClubId: string
  homeLineup: Lineup
  awayLineup: Lineup
  events: MatchEvent[]
  score: {
    home: number
    away: number
  }
  attendance?: number
  income?: number
  played: boolean
}
```

## 40. Máquina de estados da rodada

```text
AWAITING_MANAGEMENT
    ↓
LINEUP_CONFIRMED
    ↓
PRE_MATCH
    ↓
MATCH_RUNNING
    ├── substitution
    ├── tactical_change
    ├── injury
    ├── card
    └── goal
    ↓
POST_MATCH
    ↓
APPLY_RESULTS
    ├── standings
    ├── finances
    ├── fitness
    ├── morale
    ├── suspensions
    ├── rankings
    └── messages
    ↓
NEXT_DATE
```

## 41. Motor de calendário

O calendário precisava resolver:

- competições simultâneas;
- estaduais e nacional;
- copas eliminatórias;
- continentais;
- seleções;
- datas de amistosos;
- conflitos;
- ida e volta;
- adiamentos ou encaixes;
- fim de temporada;
- geração da temporada seguinte.

É provável que as competições fossem implementadas por regras e formatos específicos, parcialmente configuráveis e parcialmente hard-coded. Bugs históricos de classificação, mata-mata, playoff e corrupção de save sugerem forte acoplamento entre calendário, competição e persistência.

## 42. Persistência

O jogo mantinha carreiras por muitas temporadas. O save precisava armazenar:

- mundo atual;
- calendário;
- elencos;
- contratos;
- resultados;
- rankings;
- histórico;
- usuário(s);
- parâmetros da carreira;
- estado aleatório, possivelmente;
- competições em andamento.

Nas edições recentes, os saves usam a extensão `.s22` e são serializados a partir de classes Java do jogo com a biblioteca **Kryo**, conforme evidenciado pelo save editor comunitário. A serialização exata das edições mais antigas, porém, não foi verificada e não deve ser generalizada para toda a série.

## 43. Registro

As chaves históricas eram compostas por:

- nome do proprietário;
- código numérico.

O fluxo parece ter sido local e simples. A facilidade com que chaves eram compartilhadas sugere ausência de autenticação online forte. O algoritmo de validação não foi encontrado e não é necessário para compreender o produto.

## 44. Processo de desenvolvimento

Características observáveis:

- um desenvolvedor principal;
- edição anual;
- builds corretivas;
- feedback de fóruns;
- conteúdo contribuído por usuários;
- distribuição por download;
- patches independentes;
- manutenção de compatibilidade com máquinas simples.

Correções de builds recentes envolveram:

- problemas de save;
- rankings;
- playoffs;
- competições;
- regras de classificação;
- erros de navegação.

Isso é coerente com um sistema de regras de domínio extenso dentro de uma aplicação monolítica.

---

# Parte VIII — O que cativava os usuários

## 45. “Só mais uma rodada”

O ciclo era curto:

```text
decisão → partida → resultado → tabela → próxima decisão
```

Não havia uma partida de dez minutos entre cada decisão. Em poucos minutos, o jogador podia atravessar várias semanas do calendário.

Esse ritmo criava:

- reforço frequente;
- curiosidade sobre a próxima rodada;
- baixo custo para continuar;
- sensação de progresso constante.

## 46. A fantasia de construir uma potência

O jogo facilitava histórias como:

- começar na quarta divisão;
- montar elenco barato;
- conquistar acesso;
- ampliar estádio;
- revelar jovem;
- vencer um estadual;
- chegar à Série A;
- classificar-se para Libertadores;
- conquistar o Mundial;
- receber proposta de outro gigante.

A distância entre o início e o sonho era grande o suficiente para ser significativa, mas curta o bastante para parecer alcançável.

## 47. Futebol brasileiro como produto

O Brasfoot tratava como centrais elementos ignorados por muitos jogos estrangeiros:

- estaduais;
- divisões inferiores;
- Copa do Brasil;
- clubes pequenos;
- calendário brasileiro;
- Libertadores;
- rivalidades locais;
- ascensão regional e nacional.

Isso gerava identificação imediata.

## 48. Leveza como distribuição

O instalador pequeno e a baixa exigência de hardware foram parte do produto, não apenas uma limitação técnica.

O jogo podia circular por:

- sites de download;
- lan houses;
- pendrives;
- computadores escolares;
- máquinas familiares;
- conexões lentas.

A acessibilidade ampliava o topo do funil.

## 49. Personalização e autoria

Ao editar times, jogadores e ligas, o usuário deixava de ser apenas consumidor. Ele podia construir:

- campeonato da cidade;
- time da escola;
- elenco histórico;
- universo fictício;
- liga com amigos;
- patch atualizado;
- clubes de países pouco representados.

A capacidade de modificar o produto aumentava:

- apego;
- longevidade;
- relevância;
- produção comunitária;
- retorno após novas temporadas reais.

## 50. Complexidade dosada

O Brasfoot oferecia decisões suficientes para o jogador sentir autoria, mas não tantas a ponto de transformar a carreira em trabalho.

A interface não exigia:

- reuniões longas;
- entrevistas coletivas detalhadas;
- centenas de relatórios;
- treinamento diário;
- staff complexo;
- negociação de dezenas de cláusulas;
- partidas gráficas longas.

Diferente do Football Manager, o Brasfoot deliberadamente **não** tinha comissão técnica completa (olheiro, médico, preparador físico — havia, no máximo, um auxiliar no treino automático), motor de partida 2D/3D, multiplayer online nativo nem scouting profissional. Era possível compreender o estado do clube em poucos minutos.

## 51. Histórias emergentes

A retenção não vinha de uma campanha roteirizada. Vinha da combinação de sistemas:

- evolução;
- aposentadoria;
- base;
- transferências;
- moral;
- lesões;
- títulos;
- demissões;
- rankings;
- mudança de clube;
- competição entre amigos.

Esses sistemas produziam histórias não previstas pelo desenvolvedor.

## 52. Espaço para imaginação

A representação textual permitia que o jogador imaginasse:

- como foi o gol;
- o clima do estádio;
- a personalidade do jovem;
- a rivalidade;
- o peso de uma final;
- a narrativa de uma virada.

Gráficos simples não necessariamente diminuíam a imersão. Em muitos casos, aumentavam a participação imaginativa.

## 53. Comunidade como extensão do produto

A comunidade resolvia três problemas:

1. mantinha os elencos atualizados;
2. adicionava conteúdo que um desenvolvedor solo não conseguiria produzir;
3. criava motivos sociais para continuar jogando.

O jogo tornou-se uma plataforma leve para conteúdo de terceiros.

## 54. Monetização compatível com confiança

O baixo preço, o pagamento único e a versão gratuita funcional reduziram resistência.

A mensagem implícita era:

> “Jogue primeiro. Pague pouco para ampliar e ajudar o projeto.”

Isso combinava com a natureza comunitária do produto.

---

## 54.1 Críticas e limitações percebidas

Apesar do carinho da comunidade, o Brasfoot acumulava críticas recorrentes ao longo dos anos:

- simulação percebida como simples demais / ausência de partida visual;
- mercado e negociações considerados “arcaicos”;
- interface datada;
- bugs a cada edição anual;
- pirataria enfraquecendo a receita;
- demo frustrante para quem não registrava;
- pedidos históricos nunca atendidos (multiplayer online nativo, mais realismo).

Essas críticas ajudam a delimitar o que um produto inspirado precisaria modernizar sem trair o núcleo (ver Parte IX).

---

# Parte IX — Lições para um produto moderno inspirado no Brasfoot

## 55. O que deve ser preservado

### P0 — Identidade do núcleo

- partidas rápidas;
- temporadas rápidas;
- decisões simples, mas relevantes;
- progressão por divisões;
- clubes pequenos;
- base e aposentadoria;
- mercado direto;
- tática compacta;
- rankings e histórico;
- carreira longa;
- banco editável;
- baixo requisito técnico.

### P1 — Retenção

- desafios de carreira;
- conquistas;
- recordes;
- temporadas históricas;
- rivalidades;
- geração de jovens;
- histórias automáticas;
- resumo de temporada;
- linha do tempo do treinador.

### P2 — Comunidade

- editor;
- importação/exportação;
- workshop de ligas;
- compartilhamento de saves;
- competições assíncronas;
- templates de universo;
- API ou formato de mod documentado.

## 56. O que deve ser modernizado com cuidado

### 56.1 Interface

Modernizar:

- hierarquia visual;
- responsividade;
- acessibilidade;
- busca;
- filtros;
- comparação;
- onboarding;
- atalhos;
- visualização de calendário.

Não transformar em:

- dashboard corporativo genérico;
- excesso de cards;
- animações lentas;
- navegação fragmentada;
- telas intermediárias sem decisão.

### 56.2 Partida

Possíveis melhorias:

- mapa 2D opcional;
- eventos mais legíveis;
- destaques;
- xG simplificado;
- análise pós-jogo;
- replay textual;
- velocidade muito alta.

A partida nunca deve bloquear quem deseja simular rapidamente.

### 56.3 Conteúdo

- licenças oficiais quando viáveis;
- nomes fictícios por padrão;
- editor e packs comunitários;
- atualização remota de elencos;
- versionamento de bases;
- validação de mods.

### 56.4 Multiplayer

Boas extensões:

- ligas privadas assíncronas;
- saves compartilhados;
- temporadas com rodadas agendadas;
- mercado entre jogadores;
- ranking de desafios;
- draft;
- co-op administrativo.

Evitar exigir conexão para o modo solo.

## 57. Estratégia de monetização inspirada no legado

Um modelo contemporâneo compatível com a filosofia original:

### Opção A — Premium acessível

- demo ampla;
- pagamento único;
- jogo completo;
- expansões opcionais;
- mods gratuitos.

### Opção B — Free + assinatura de conveniência

Gratuito:

- carreira offline;
- ligas base;
- editor local;
- loop completo.

Pago:

- sincronização em nuvem;
- multiplayer;
- editor avançado;
- packs históricos;
- estatísticas aprofundadas;
- atualizações automáticas;
- compartilhamento de universos.

### Opção C — Compra anual opcional

- cada edição anual é uma compra;
- saves antigos permanecem funcionais;
- atualização de base e regras;
- desconto para proprietários anteriores;
- sem bloquear o jogo já adquirido.

### O que evitar

- energia para avançar rodada;
- loot boxes;
- moedas premium para contratar;
- acelerar artificialmente temporadas;
- venda de resultados;
- assinatura obrigatória para modo solo;
- remoção de editor para vender cada liga separadamente.

Essas práticas entrariam em conflito com a confiança e a liberdade que ajudaram a construir a comunidade do Brasfoot.

---

# Parte X — Especificação conceitual de um “Brasfoot-like”

## 58. Pilares de produto

```text
1. Uma rodada em menos de um minuto.
2. Uma temporada em uma sessão.
3. Uma carreira com dezenas de temporadas.
4. Decisões compreensíveis sem tutorial extenso.
5. Universo editável e compartilhável.
6. Clubes pequenos tão interessantes quanto gigantes.
7. Offline-first.
8. História do jogador preservada.
```

## 59. Módulos

```text
/core
  simulation
  match-engine
  calendar
  competitions
  progression
  finance

/domain
  clubs
  players
  managers
  contracts
  transfers
  stadiums
  rankings

/content
  databases
  leagues
  assets
  localization
  mods

/application
  career
  matchday
  squad
  market
  editor
  history

/infrastructure
  persistence
  import-export
  cloud-sync
  telemetry
```

## 60. Eventos de domínio

```ts
type DomainEvent =
  | { type: "MATCH_PLAYED"; matchId: string }
  | { type: "GOAL_SCORED"; playerId: string; matchId: string }
  | { type: "PLAYER_INJURED"; playerId: string; rounds: number }
  | { type: "PLAYER_SUSPENDED"; playerId: string; rounds: number }
  | { type: "CONTRACT_EXPIRING"; playerId: string }
  | { type: "PLAYER_TRANSFERRED"; playerId: string; toClubId: string }
  | { type: "PLAYER_RETIRED"; playerId: string }
  | { type: "YOUTH_PROMOTED"; playerId: string }
  | { type: "MANAGER_FIRED"; managerId: string }
  | { type: "CLUB_PROMOTED"; clubId: string }
  | { type: "CLUB_RELEGATED"; clubId: string }
  | { type: "TITLE_WON"; clubId: string; competitionId: string }
```

## 61. Métricas de produto

Para medir se o espírito do Brasfoot foi preservado:

- tempo até a primeira partida;
- tempo médio por rodada;
- tempo médio por temporada;
- temporadas por save;
- percentual de usuários que chegam à segunda temporada;
- percentual que conquista acesso;
- número de mudanças de clube por carreira;
- uso do editor;
- mods instalados;
- saves com mais de 10 temporadas;
- sessões que terminam após “mais uma rodada”;
- retenção de 7, 30 e 90 dias;
- tempo gasto em gestão versus telas passivas.

---

# Parte XI — Riscos e pontos não comprovados

## 62. Informações ainda não públicas ou não verificadas

Não foi possível confirmar:

- código-fonte;
- estrutura exata dos arquivos internos;
- algoritmo do motor de partidas;
- distribuição de probabilidade dos resultados;
- mecanismo exato de evolução;
- fórmula de valor de mercado;
- formato binário dos saves;
- algoritmo da chave;
- toolkit visual Java;
- linguagem/stack técnica das edições 2003–2009 (Delphi/VB são especulação sem prova);
- lista integral de ligas oficiais de cada edição e inventário país a país do instalador 22-23;
- roster nominal completo do banco de dados oficial;
- preços oficiais ano a ano, sobretudo entre 2003 e 2007;
- limites exatos da versão grátis em todos os anos;
- papel exato do Cyberfoot (precursor ou vertente internacional);
- formação acadêmica de Emmanuel dos Santos (história vs Ciência da Computação).

Há ainda um ponto de **status recente não confirmado**: relatos de 2026 indicam que a Nuuvem teria buscado contato com o criador para um eventual revival, mas essa parceria não foi confirmada pelas fontes consultadas.

Qualquer implementação inspirada deve tratar essas áreas como espaço de design próprio, não como engenharia reversa conclusiva.

## 63. Propriedade intelectual

Um produto inspirado no loop pode utilizar princípios gerais de game design, mas deve evitar copiar:

- nome Brasfoot;
- identidade visual;
- textos;
- assets;
- banco de dados;
- código;
- formato proprietário;
- marcas e escudos sem licença;
- nomes de jogadores quando houver risco jurídico aplicável.

Para um produto comercial, recomenda-se revisão jurídica específica sobre:

- uso de marcas de clubes;
- direitos de imagem;
- nomes de atletas;
- bases de dados esportivas;
- conteúdo gerado por usuários;
- distribuição de mods.

---

# Parte XII — Conclusão

O Brasfoot não se tornou memorável por simular cada detalhe do futebol. Tornou-se memorável por selecionar os detalhes certos.

Ele entregava:

- decisões claras;
- consequências rápidas;
- carreiras longas;
- identidade brasileira;
- liberdade de edição;
- histórias pessoais;
- comunidade;
- acessibilidade.

Sua principal lição é que profundidade não depende de quantidade de telas. Profundidade pode surgir da interação entre sistemas simples:

```text
força
+ idade
+ moral
+ condição
+ contrato
+ tática
+ calendário
+ finanças
+ promoção/rebaixamento
+ aleatoriedade controlada
= história emergente
```

O Brasfoot foi um exemplo de produto de software enxuto cujo valor crescia pela combinação de três camadas:

1. **núcleo simples e rápido;**
2. **universo persistente e editável;**
3. **comunidade capaz de produzir conteúdo.**

Para recriar sua capacidade de retenção hoje, a prioridade não deveria ser adicionar mais complexidade. Deveria ser preservar a velocidade, a autoria e a sensação de que cada nova rodada pode mudar a história da carreira.

---

# Apêndice A — Checklist funcional consolidado

## Carreira

- [x] Criar treinador
- [x] Múltiplos treinadores humanos
- [x] Escolher clube
- [x] Receber propostas
- [x] Trocar de clube
- [x] Pedir demissão
- [x] Ser demitido
- [x] Ranking de treinador
- [x] Histórico de títulos
- [x] Treinar seleção em versões posteriores

## Elenco

- [x] Titulares
- [x] Reservas
- [x] Formação
- [x] Improvisação
- [x] Força
- [x] Idade
- [x] Posição
- [x] Lado
- [x] Características
- [x] Moral
- [x] Condição
- [x] Lesão
- [x] Suspensão
- [x] Contrato
- [x] Salário
- [x] Valor
- [x] Aposentadoria
- [x] Jovens da base

## Mercado

- [x] Comprar
- [x] Vender
- [x] Listar
- [x] Receber propostas
- [x] Ofertar
- [x] Empréstimos
- [x] Renovar
- [x] Rescindir
- [x] Alertas de contrato

## Tática

- [x] Formação
- [x] Ataque total
- [x] Equilibrado
- [x] Contra-ataque
- [x] Ataque pelo meio
- [x] Ataque pelas laterais
- [x] Marcação leve
- [x] Marcação pesada
- [x] Marcação muito pesada
- [x] Substituições
- [x] Mudanças durante a partida

## Partida

- [x] Simulação textual
- [x] Velocidade configurável
- [x] Gols
- [x] Cartões
- [x] Lesões
- [x] Substituições
- [x] Notas
- [x] Estatísticas
- [x] Público
- [x] Renda

## Clube

- [x] Caixa
- [x] Salários
- [x] Patrocínio
- [x] Ingressos
- [x] Estádio
- [x] Ampliação
- [x] Confiança da diretoria
- [x] Confiança da torcida
- [x] Reputação
- [x] Títulos

## Competições

- [x] Ligas nacionais
- [x] Divisões
- [x] Acesso
- [x] Rebaixamento
- [x] Copas nacionais
- [x] Estaduais
- [x] Libertadores
- [x] Sul-Americana
- [x] Champions League
- [x] Europa League
- [x] Mundial
- [x] Competições africanas
- [x] Competições asiáticas
- [x] Copa do Mundo
- [x] Eliminatórias
- [x] Copa América
- [x] Eurocopa
- [x] Amistosos
- [x] Torneios amistosos
- [x] Nations League em versões recentes

## Conteúdo

- [x] Editor de times
- [x] Editor de jogadores
- [x] Transferências manuais
- [x] Escudos
- [x] Miniescudos
- [x] Uniformes
- [x] Ligas extras
- [x] Patches
- [x] Superpatches
- [x] Banco aberto

## Memória

- [x] Save local
- [x] Várias temporadas
- [x] Ranking de clubes
- [x] Ranking de treinadores
- [x] Artilharia
- [x] Campeões
- [x] Prêmios
- [x] Histórico

---

# Apêndice B — Fontes principais

As fontes abaixo foram utilizadas para reconstruir os fatos. Conteúdo comunitário foi tratado como evidência histórica complementar, não como documentação oficial absoluta.

1. **Brasfoot — site oficial**  
   <https://www.brasfoot.com/>

2. **O Brasfoot 2022–2023 — funcionalidades oficiais**  
   <https://www.brasfoot.com/o-brasfoot-2022-2023.html>

3. **Download oficial do Brasfoot 2022–2023**  
   <https://www.brasfoot.com/download-brasfoot-2022-2023-ssl.html>

4. **Registro gratuito oficial do Brasfoot 2022–2023**  
   <https://www.brasfoot.com/registro-brasfoot-2022-2023.html>

5. **UOL — “Aos 14 anos, Brasfoot ainda existe...” — entrevista e história**  
   <https://uolesporte.blogosfera.uol.com.br/2017/10/02/aos-14-anos-brasfoot-ainda-existe-e-tem-ate-solucao-para-neymar-x-cavani/>

6. **Manual histórico do Brasfoot — espelho comunitário**  
   <https://info-brasfoot.webnode.pt/manual/>

7. **Manual Brasfoot 2011 — espelho comunitário**  
   <https://dicas-de-brasfoot.blogspot.com/2011/06/manual-brasfoot_07.html>

8. **Retrospectiva do Brasfoot 2003 — Vício Brasfoot**  
   <https://vicio-foot.blogspot.com/2016/04/ValeAPenaVerDeNovo-BF2003.html>

9. **Registro Brasfoot 2021 — Rumo Brasfoot**  
   <https://www.rumobrasfoot.com.br/p/registro-brasfoot-2021.html>

10. **Superpatch Brasfoot 2023 — Rumo Brasfoot**  
    <https://www.rumobrasfoot.com.br/2023/06/brasfoot-2023-download-do-superpatch.html>

11. **Execução nativa no Linux/OpenJDK — Viva o Linux**  
    <https://www.vivaolinux.com.br/dica/Brasfoot-22-23-rodando-nativamente-no-Linux>

12. **Execução com `java -jar` — comunidade Diolinux**  
    <https://plus.diolinux.com.br/t/brasfoot-2021-solucao-pra-jogar/40209>

13. **Builds e correções do Brasfoot 22–23 — Alternative Brasfoot**  
    <https://alternative-brasfoot.blogspot.com/2022/08/brasfoot-2223-build-4.html>

14. **Brasfoot no Google Play**  
    <https://play.google.com/store/apps/details?id=com.brasfoot.v2020&hl=pt_BR>

15. **Indústria de Jogos — Brasfoot 2003**  
    <https://www.industriadejogos.com.br/jogo/brasfoot-2003/>

16. **Brasfoot — Wikipédia (PT)**  
    <https://pt.wikipedia.org/wiki/Brasfoot>

17. **SiliconAction — Wikipédia (PT)** (loja digital usada na distribuição/pagamento)  
    <https://pt.wikipedia.org/wiki/SiliconAction>

18. **Brasfoot Save Editor — repositório comunitário (GitHub)** (desserialização de saves `.s22` com Kryo)  
    <https://github.com/leonifrazao/brasfoot-save-editor>

19. **SuperEsportes — Brasfoot ganha versão mobile (2018)**  
    <https://www.mg.superesportes.com.br/app/noticias/futebol/futebol-nacional/2018/08/23/noticia_futebol_nacional,498001/game-de-futebol-brasfoot-ganha-versao-mobile.shtml>

20. **Fórum BFA — história do jogo**  
    <https://forumbfa.forumeiros.com/t485-brasfoot-historia-do-jogo>

21. **NSC Total — atualização inédita do Brasfoot** (status recente)  
    <https://www.nsctotal.com.br/noticias/sensacao-dos-anos-2000-brasfoot-ganha-atualizacao-inedita-que-anima-fas-do-jogo>

22. **Ensinando a Vencer — “Nuuvem procura criador do Brasfoot”** (revival não confirmado)  
    <https://ensinandoavencer.com.br/nuuvem-procura-criador-brasfoot/>

---

# Apêndice C — Próximas validações recomendadas

Para elevar esta pesquisa de reconstrução histórica a especificação técnica validada:

1. instalar legalmente o Brasfoot 22–23 em ambiente isolado;
2. capturar todas as telas e fluxos;
3. criar carreira em modo gratuito e registrado;
4. comparar limitações;
5. mapear arquivos e diretórios;
6. editar um clube e observar diferenças;
7. instalar um patch e registrar alterações;
8. simular dez temporadas;
9. medir ritmo, frequência de eventos e progressão;
10. entrevistar jogadores veteranos;
11. localizar manuais de edições específicas;
12. construir uma matriz por versão;
13. documentar regras de cada competição;
14. testar multiplayer local;
15. catalogar sites comunitários preservados no Internet Archive.
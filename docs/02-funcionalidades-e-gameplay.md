# Footebas — Funcionalidades e Gameplay

> Encoda as decisões #3, #11, #12 e o inventário funcional do V1.
> Tudo a serviço dos pilares: rodada < 1 min, sessão curta, decisões simples porém relevantes, ascensão.

---

## 1. Loop central

```text
Criar carreira → assumir clube → organizar elenco e finanças → escalar e definir tática
→ disputar partida → receber resultado/renda/moral/lesões/tabela → negociar no mercado
→ avançar rodada → objetivos/acesso/rebaixamento/demissão
→ nova temporada com elenco envelhecido e novas histórias
```

O diferencial é a **frequência de recompensa**: cada rodada altera posição, saldo, moral, confiança, condição,
caixa, valor dos jogadores e reputação do treinador. Nunca se espera muito para uma decisão gerar consequência.

## 2. Escopo funcional do V1 (P0)

Sem isto, não é "um Brasfoot". **Tudo abaixo entra no V1.**

### 2.1 Treinador e carreira
- Criar treinador (nome personalizado) — é a entidade ranqueada.
- Assumir clube; ser demitido; pedir demissão; trocar de clube por proposta.
- Ranking/histórico de conquistas do treinador (ver `04-ranking-e-social.md`).
- **Início:** premium escolhe qualquer clube; grátis começa em divisão inferior (decisão #13).

### 2.2 Elenco e jogadores
- **Visível (MVP):** **força única (1-100)** + até **2 características** + condição, moral, ritmo, salário, valor, contrato, status no elenco, lesão, suspensão, gols, notas, cartões, nacionalidade fictícia.
- **Oculto (MVP, estimado — nunca número exato):** **potencial, consistência, propensão a lesão, adaptação, profissionalismo, desempenho decisivo**. A tela permanece enxuta; esses valores aparecem como estimativas (olho clínico/relatório) e alimentam evolução, mercado e base.
- **Fast-follow:** 7 habilidades numéricas visíveis + foco de treino (a força única segue como número de capa).
- Características contextuais (alimentam o motor): velocidade/cruzamento → laterais; armação/passe → construção central; cabeceio → jogo aéreo; marcação/desarme → contenção; finalização → ataque.
- Evolução/declínio por idade, uso, moral, condição, fase da carreira; aposentadoria; reposição pela base.
- **Goleiros** com características próprias (colocação, saída, reflexo, defesa de pênalti).

### 2.3 Base (categoria de base)
- Promoção de jovens (17-20 anos) ao elenco principal; reposição de aposentados; potencial variável.
- Papel sistêmico: impedir morte da carreira por falta de jogadores, criar apego, gerar ativos baratos, produzir histórias exclusivas.
- V1 = mecanismo básico. Academia formal sub-21 (peneiras, indicador de potencial) fica como fast-follow.

### 2.4 Mercado
- Comprar, vender, listar, receber/fazer propostas, negociar com clubes, recusas.
- **Empréstimos** (com limite e retorno). Contratos de 6m / 1a / 2a com alertas de vencimento. Rescisão com custo.
- Valor de mercado derivado de força, idade, posição, fase, contrato, reputação (fórmula = design nosso).

### 2.5 Escalação e tática (compactas)
- Titulares/reservas, formação (4-4-2, 4-3-3, 3-5-2, 5-3-2…), arrastar/posicionar, "melhor time" automático, improvisação (fora de posição penaliza), substituições, cores por status.
- Estilo: equilibrado / ataque total / contra-ataque.
- Direção ofensiva: meio / laterais. Marcação: leve / pesada / muito pesada (mais intensidade = mais risco de cartão/expulsão).
- Capitão e batedores (faltas/pênaltis).
- **Profundidade vem da interação entre poucas opções significativas**, não da quantidade de telas.

### 2.6 Partida (decisão #11)
- Simulação **autoritativa no servidor**; cliente reproduz a **timeline de eventos**.
- Apresentação V1: **feed de eventos moderno + campo 2D leve esquemático**.
  - Feed animado, barra de momento/pressão, xG simplificado, stats ao vivo, notas dos jogadores.
  - 2D = fichas/pontos reproduzindo momentos-chave (gols, grandes chances, cartões). **Render-only**, não é segunda simulação.
- **Velocidade configurável** + **"pular para o resultado" a um toque**. A partida nunca bloqueia quem quer simular rápido.
- Controles no jogo: substituir, mudar formação/estilo/marcação, reagir a lesões/expulsões.

### 2.7 Finanças
- Fontes: venda de jogadores, ingressos, patrocínio, amistosos.
- Ingressos com trade-off preço × público. Estádio: capacidade, público, ampliação (custo), qualidade do gramado.
- Folha salarial cobrada por rodada. Empréstimo bancário como opção de despesa.
- Economia simplificada: impor restrições (vender é necessário, contratar tem custo, estádio é investimento), não simular contabilidade real.

### 2.8 Confiança e consequências
- Desempenho afeta confiança de diretoria e torcida → pressão, queda de reputação, demissão, ou prestígio e propostas.
- A classificação é também um medidor de segurança do emprego.

### 2.9 Memória e persistência
- Save na nuvem (estado canônico no servidor). Várias temporadas por carreira.
- Rankings de clubes/treinadores, artilharia, campeões, histórico por temporada.

### 2.10 Editor (básico grátis / completo pago)
- **Editor básico (grátis):** nome do treinador, nome de clube em modo sandbox, cores, escudo por formas predefinidas, uniforme simples.
- **Editor completo (licença paga):** clubes, jogadores, atributos, ligas, competições, regras, escudos, uniformes, estádios, banco completo, importação/exportação.
- Import de **packs da comunidade** (UGC) para nomes reais/quase-reais — por conta e risco do usuário (ver `03-competicoes-e-ligas.md`).
- Conteúdo compartilhado é validado, versionado, sanitizado (sem scripts), com denúncia. Workshop hospedado = adiado/moderado (fora do MVP).

## 3. Fast-follow (documentado, fora do MVP)

- **7 habilidades numéricas visíveis + foco de treino semanal** (a evolução 2018 do Brasfoot): força única continua sendo o número de capa; habilidades entram como camada opcional de profundidade.
- **Campo 3D (Three.js / R3F)** de partida/estádio/troféus — reprodução dos eventos já calculados, com fallback 2D.
- **Modo ranqueado normalizado** (mesma condição inicial, janelas, validação por seed).
- Academia sub-21 formal (peneiras, potencial, amistosos da base).
- Prêmios: time da semana/ano, Bola de Ouro, galeria de troféus.
- Desafios de carreira, recordes, resumo de temporada, linha do tempo do treinador.
- Continentais europeias, Mundial, seleções.

> **Nota:** estaduais simplificados **entram no MVP** (não são mais fast-follow) — ver `03-competicoes-e-ligas.md`.

## 4. O que o Footebas deliberadamente NÃO é

Fiel ao Brasfoot, para preservar a leveza — **evitar** virar Football Manager:
- Sem comissão técnica completa (olheiro/médico/preparador).
- Sem motor de partida 2D/3D físico em tempo real.
- Sem scouting profissional nem negociação de dezenas de cláusulas.
- Sem treinamento diário micro-gerenciado.
- Sem reuniões/entrevistas coletivas longas.
- Sem telas intermediárias sem decisão.

O estado do clube deve ser compreensível em poucos minutos.

## 5. Eventos de domínio (base para histórias emergentes)

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

A retenção não vem de campanha roteirizada — vem da combinação desses sistemas simples produzindo histórias
não previstas: o jovem que vira ídolo, o veterano que se aposenta, a virada, o acesso na última rodada.

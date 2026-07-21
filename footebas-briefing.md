# Footebas — Briefing para a sessão de grilling

> Destilação do `brasfoot-consolidado.md` filtrada para o que importa em **decisões** de recriação:
> um jogo **web, mobile-first, sem app nativo**, herdeiro espiritual do Brasfoot — "o Brasfoot da nova geração".
> Este documento não repete a história; extrai só o acionável para tecnologia, funcionalidades, ligas,
> monetização, stacks e fases de desenvolvimento. É o insumo da sessão de grilling, não a conclusão dela.

---

## 1. O núcleo intocável (a "alma" que não pode ser traída)

Se qualquer decisão de tecnologia ou produto ameaçar um destes, é sinal de alerta:

1. **Uma rodada em menos de 1 minuto.** Velocidade > fidelidade audiovisual.
2. **Uma temporada em uma sessão.** Progressão acelerada, recompensa frequente.
3. **Uma carreira com dezenas de temporadas.** O save acumula memória e vira "universo do jogador".
4. **Decisões simples, mas relevantes.** Poucos atributos visíveis, alta interação entre eles.
5. **Fantasia de ascensão.** Clube pequeno → título nacional/continental/mundial.
6. **Identidade brasileira.** Estaduais, divisões inferiores, Copa do Brasil, Libertadores.
7. **Universo editável e compartilhável.** Banco aberto, mods, comunidade produtora.
8. **Offline-first / baixo requisito.** Roda em máquina fraca; no nosso caso, celular modesto e conexão ruim.
9. **Histórias emergentes.** Sistemas simples que se combinam produzem narrativas não roteirizadas.
10. **Monetização compatível com confiança.** "Jogue primeiro, pague pouco." Nada agressivo.

**Loop central:** criar carreira → assumir clube → organizar elenco/finanças → escalar/tática →
partida → resultado/renda/moral/lesões/tabela → mercado → avançar rodada → objetivos/acesso/demissão →
nova temporada com elenco envelhecido.

---

## 2. Inventário funcional priorizado (o que existia, mapeado para escopo)

Marcação sugerida de prioridade para um produto novo (a validar no grilling):

### P0 — Sem isto não é "um Brasfoot"
- Criar treinador + carreira; assumir clube; ser demitido / trocar de clube.
- Elenco: força (escala ~1-100), idade, posição, lado, características (até 2), moral, condição, contrato, salário, valor.
- Escalação: titulares/reservas, formação, improvisação (fora de posição penaliza), substituições.
- Táticas compactas: formação (4-4-2, 4-3-3, 3-5-2…), estilo (equilibrado/ataque total/contra-ataque), direção (meio/lados), marcação (leve/pesada/muito pesada).
- Partida textual/estatística com velocidade configurável; eventos (gol, cartão, lesão, subs); notas.
- Mercado: comprar, vender, listar, propostas, empréstimos, renovar, rescindir, alertas de contrato.
- Finanças: caixa, salários, ingressos (trade-off preço×público), patrocínio, estádio + ampliação.
- Confiança de diretoria/torcida → pressão/demissão.
- Competições: liga com divisões (acesso/rebaixamento) + copa nacional + ao menos 1 estadual.
- Base: promoção de jovens, aposentadoria, reposição do elenco.
- Save local persistente; várias temporadas; rankings/artilharia/campeões/histórico.

### P1 — Retenção ("só mais uma rodada")
- Estaduais completos, Copa do Brasil ampliada, Libertadores/Sul-Americana.
- Continentais europeias/mundial; seleções e Copa do Mundo.
- Ranking de treinadores, galeria de troféus, prêmios (time da semana/ano, Bola de Ouro).
- Desafios de carreira, recordes, resumo de temporada, linha do tempo do treinador.
- Habilidades individuais numéricas + foco de treino (introduzidas em 2018 no original).

### P2 — Comunidade e diferencial "nova geração"
- Editor de times/jogadores/ligas; import/export; workshop de ligas; validação de mods.
- Multiplayer **assíncrono** (ligas privadas, rodadas agendadas, mercado entre humanos, draft, co-op).
- Sync em nuvem; atualização remota de elencos; versionamento de bases.

---

## 3. Ligas e competições (as três camadas do original)

O Brasfoot nunca teve "todas as ligas" num pacote — era **jogo base + downloads de registrado + patches da comunidade**.
Isso é decisão de escopo, não de fidelidade.

- **Nacionais:** Séries A/B/C/D com acesso e rebaixamento; copa nacional; supercopa.
- **Estaduais (diferencial cultural BR):** Paulista, Carioca, Mineiro, Gaúcho, Catarinense, Brasiliense etc. — mínimo de clubes por estado.
- **Continentais:** Libertadores (+pré), Sul-Americana, Recopa; Champions (+pré), Europa League, Supercopa; CAF, AFC.
- **Mundial de clubes.**
- **Seleções:** Copa do Mundo, eliminatórias, Copa América, Eurocopa, Nations League, amistosos.
- **Camada comunitária:** superpatches (~70 ligas, ~2.678 times no exemplo de 2023).

**Implicação de design:** o motor de competições deve ser **data-driven e configurável** (liga/mata-mata/grupos/estadual/continental), não hard-coded por competição.

---

## 4. Monetização (filosofia + três modelos herdados)

**Filosofia original:** preço baixo, pagamento único, versão grátis funcional, pirataria tolerada, comunidade como colaboradora. Preço histórico ~R$ 12,90. Mobile atual: grátis + compras internas.

- **Opção A — Premium acessível:** demo ampla + pagamento único + expansões opcionais + mods grátis.
- **Opção B — Free + assinatura de conveniência:** grátis = carreira offline, ligas base, editor local, loop completo; pago = sync em nuvem, multiplayer, editor avançado, packs históricos, stats aprofundadas.
- **Opção C — Compra anual opcional:** cada edição anual é compra; saves antigos seguem funcionando; desconto para donos anteriores.

**Anti-padrões a evitar (traem a confiança):** energia para avançar rodada, loot boxes, moeda premium para contratar, acelerar temporada pagando, vender resultados, assinatura obrigatória no modo solo, remover editor para vender liga a liga.

---

## 5. Reconstrução técnica → tradução para web mobile-first

**O que o original era (referência):** monólito desktop Java (JVM), **local-first**, offline, conteúdo data-driven em arquivos no disco, saves locais (`.s22`, serializados com Kryo nas versões recentes), sem backend obrigatório na jogabilidade, validação de registro local. Motor de partida, fórmula de valor e algoritmo de resultado **nunca foram publicados** — são espaço de design próprio.

**Modelo de dados conceitual (já esboçado no doc):** `GameSave` contendo `Season, Calendar, HumanManager[], Competition[], Club[], Player[], Contract[], Transfer[], Match[], Standing[], Ranking[], Award[], NewsEvent[]`. Entidades `Club`, `Player`, `Competition`, `Match` já têm shape TS sugerido.

**Máquina de estados da rodada:** `AWAITING_MANAGEMENT → LINEUP_CONFIRMED → PRE_MATCH → MATCH_RUNNING (sub/tática/lesão/cartão/gol) → POST_MATCH → APPLY_RESULTS (standings/finanças/fitness/moral/suspensões/rankings/mensagens) → NEXT_DATE`.

**Motor de partida (reconstrução plausível, não oficial):**
`força_efetiva = força_escalados × adequação_posição × condição × moral × ajuste_tático × mando × aleatório`;
chances derivadas de volume de ataque × finalização × vulnerabilidade defensiva × contexto × aleatoriedade.
Objetivo: força importa, tática dá vantagem, mando pesa, mas zebra existe.

**Perguntas de stack que a sessão precisa fechar (mobile-first, sem app nativo):**
- Onde roda a simulação? (100% cliente / servidor / híbrido)
- Onde mora o save? (browser: IndexedDB/OPFS — vs nuvem — vs ambos)
- PWA instalável offline vs site comum.
- Framework de UI, gerência de estado, e como manter 60fps de navegação em celular fraco.
- Como distribuir/versionar o banco de dados de ligas e os assets (escudos/uniformes) num contexto web.
- Contas/auth só quando houver online (para não quebrar o offline-first).

---

## 6. Críticas ao original = oportunidades de "nova geração"

O que a comunidade mais reclamava (delimita o que modernizar sem trair o núcleo):
- Simulação percebida como simples demais / ausência de partida visual.
- Mercado e negociações "arcaicos".
- Interface datada.
- Bugs a cada edição anual.
- Demo frustrante.
- Pedido histórico nunca atendido: **multiplayer online nativo** e mais realismo.

Modernizar **com cuidado:** mapa 2D **opcional** da partida, xG simplificado, análise pós-jogo, replay textual — sem nunca bloquear quem quer simular rápido. Multiplayer **assíncrono** em vez de tempo real. Interface responsiva/acessível sem virar "dashboard corporativo".

---

## 7. Riscos e restrições (guardrails da sessão)

- **IP:** não usar nome/identidade "Brasfoot", nem assets/textos/banco. Marcas de clubes, nomes de atletas e escudos exigem licença ou nomes fictícios por padrão. Recomenda revisão jurídica para produto comercial.
- **Motor não público:** resultado/valor/evolução são design nosso — não há engenharia reversa a copiar.
- **Escopo "todas as ligas" é ilusão:** definir versão base + estratégia de packs/editor.
- **Offline-first é feature, não detalhe:** qualquer dependência de servidor no modo solo é regressão.

---

## 8. Métricas do "espírito preservado" (para validar decisões depois)

Tempo até 1ª partida; tempo médio por rodada e por temporada; temporadas por save; % que chega à 2ª temporada; mudanças de clube por carreira; uso do editor; mods instalados; saves com +10 temporadas; sessões que terminam após "mais uma rodada"; retenção D7/D30/D90.

---

## 9. Agenda de decisões da sessão de grilling

Ordem sugerida (dependências primeiro):

1. **Ambição do produto** — passion/portfólio vs comercial sério (gate de IP, infra, monetização).
2. **Paradigma de arquitetura** — offline-first client-only vs online/servidor vs híbrido.
3. **Stack** — UI, estado, persistência, PWA, onde roda a simulação.
4. **Escopo do MVP** — quais P0/P1 entram na v1; qual país/liga inicial.
5. **Motor de partida** — grau de realismo, textual vs 2D opcional, determinístico/seed.
6. **Conteúdo & ligas** — banco base, editor, estratégia de packs, IP de nomes.
7. **Monetização** — qual dos modelos A/B/C, o que é grátis.
8. **Multiplayer** — se entra, quando, assíncrono.
9. **Fases de desenvolvimento** — roadmap por marcos.
10. **Nome/branding "Footebas"** — identidade, domínio, tom.

> A partir daqui, cada item vira um `.md` de decisão ao ser fechado no grilling.

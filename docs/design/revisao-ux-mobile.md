# Revisão de UX mobile (2026-10-23)

Revisão das telas e dos fluxos do jogo em telas pequenas (retrato, 320, 360, 375 e 430 px), percorrendo o app de
verdade com a API em memória (`NEXT_PUBLIC_API_URL` vazio: demo offline, sem login real). Escopo: `docs/07` §3
(mobile-first), `docs/09` (decisões 1–20), ADRs 0010, 0011, 0012 e 0014. Desktop fora do escopo.

Método: `next dev` no worktree, navegador embutido com emulação de viewport (320×660, 360×740, 430×900), captura de
tela de cada rota e um script de auditoria no DOM a cada tela (rolagem horizontal, elementos mais largos que a
viewport, alvos de toque < 44×44, fonte pixel < 8 px e sans < 12 px). O que não deu para ver por imagem foi medido
pelo DOM (`getBoundingClientRect`, `scrollWidth`).

## Mapa de rotas e fluxos percorridos

| Rota / etapa                                                                                           | Como cheguei                                        |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `/` → Acesso local (e-mail)                                                                            | demo offline (`Onboarding` em `career-game.tsx`)    |
| Início (avatar, Nova/Carregar, contadores)                                                             | "Entrar no vestiário"                               |
| Carregar carreira (vazia, limite do plano)                                                             | "Carregar carreira"                                 |
| Nova Carreira 1–6 (modo, universo, clube + folha do elenco, treinador, estilo, nome)                   | "Nova carreira" / "Começar nova carreira"           |
| Central                                                                                                | "Começar carreira"; barra inferior "Central"        |
| Mapa (ilustração clicável + folha do prédio)                                                           | Menu → Mapa                                         |
| Elenco (card, campo, banco, reservas, escalações, lista) e Táticas                                     | barra inferior "Elenco"                             |
| Mercado (Propostas, Buscar, Meu elenco)                                                                | barra inferior "Mercado"                            |
| Escritório (6 abas) e Finanças                                                                         | barra inferior "Escritório"; Menu → Finanças        |
| Estádio (Finanças, Estádio, Base, Diretoria)                                                           | Menu → Estádio                                      |
| Calendário / Competições (Pirâmide, Calendário, 2027)                                                  | Menu → Calendário / Competições                     |
| Classificação                                                                                          | Menu → Classificação; Central → "Ver classificação" |
| Temporada                                                                                              | Menu → Temporada                                    |
| Caixa de entrada / Histórico (tela "Mundo": Notícias, História, Ranking, Save)                         | Menu → Caixa de entrada / Histórico                 |
| Ranking (Global, Ascensão, Mensal)                                                                     | Menu → Ranking                                      |
| Perfil + licença (PIX copia e cola, "Pagar depois")                                                    | Menu → Perfil → "Pagar com PIX"                     |
| Partida narrada (placar, estádio 3D/2D, pausa, ajustes, pular) → Resultado → "Preparar próxima rodada" | Central → "Jogar partida"                           |
| Resultado instantâneo → Resultado                                                                      | Central → "Resultado instantâneo"                   |
| `/termos`, `/privacidade`, `/landing`                                                                  | URL direta                                          |

Não percorrido: tela de login Supabase (Google / link mágico) e os paywalls "clube da Série A/B" e "limite de 1
save", porque a demo offline libera qualquer clube e não tem conta real; o checkout PIX com QR Code (a demo só
mostra o copia e cola). Esses caminhos foram revisados só pelo código (`sign-in-screen.tsx`, `career-paywall.tsx`,
`license-checkout.tsx`) e pelos testes existentes.

## Achados por tela

Severidade: **crítico** (impede a tarefa), **alto** (quebra visual ou de uso frequente), **médio**, **baixo**.
"Corrigido" aponta o commit; o restante vira decisão ou fica como recomendação.

### Transversal (shell, barra inferior, menu)

| Sev.  | Achado                                                                                                                                               | Largura | Evidência                                                    | Estado                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ | ----------------------------------- |
| alto  | Botões do cabeçalho (som, início, sair) com 36×36 px e 34×40 px                                                                                      | todas   | auditoria DOM (`size-9`)                                     | corrigido (d2e6956)                 |
| alto  | Botão Voltar do navegador sai do jogo: o fluxo inteiro é estado em memória, sem `history.pushState`; no Android o "voltar" físico fecha a partida    | todas   | `grep pushState` vazio em `apps/web`                         | decisão (D1)                        |
| médio | Rótulos da barra inferior com 6,4 px (`.4rem`) em ≤ 375 px; "Escritório" só cabe assim                                                               | 320–375 | screenshot Central 360; `phase6-shell.tsx` l. 398–403        | decisão (D2)                        |
| médio | No menu, "Classificação" quebrava "Classificaçã / o"                                                                                                 | 320–375 | screenshot do menu em 360                                    | corrigido (61e000c, `hyphens-auto`) |
| médio | Botões `size="sm"` têm 36 px de altura (escalar, segmentados, renovar, decisões): acima do mínimo WCAG 2.2 (24 px) mas abaixo dos 44 px recomendados | todas   | auditoria DOM no Elenco e no Mercado                         | recomendação (R1)                   |
| baixo | Fontes pixel de 7,2 px (`.45rem`) em rótulos secundários (Raio‑X, "Nossa força", "Título/Continental/Multa")                                         | todas   | auditoria DOM                                                | recomendação (R2)                   |
| baixo | Folha inferior (`BottomSheet`) sai 3 px da borda direita (margem `--px` com `inset-x-0`), cortando a borda pixel                                     | todas   | auditoria DOM na folha do elenco (left 3 / right 363 em 360) | recomendação (R3)                   |

### Início / Carregar carreira

Sem overflow, alvos ≥ 44 px, estados vazio/erro/carregando presentes, confirmação de exclusão com `alertdialog` e foco
devolvido. Nada a corrigir. O botão "Som" (34×40) foi coberto pela correção do cabeçalho.

### Nova Carreira (6 etapas)

| Sev.  | Achado                                                                                                                    | Largura | Evidência                       | Estado              |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------- | ------------------- |
| médio | Na etapa 5, "Continuar" sem escolher personalidade não mostrava nada: a mensagem renderiza abaixo da lista, fora da dobra | 360     | screenshot etapa 5 após o toque | corrigido (61e000c) |
| baixo | Etapa 3: os cartões mostram 2 clubes por linha e só 4 acima da dobra; a busca ajuda, mas a lista dos 20 é longa           | 320–360 | screenshot etapa 3              | recomendação (R4)   |

Pontos bons: rodapé fixo com as ações no alcance do polegar, foco vai para o título a cada etapa, resumo na etapa 6,
validações em português.

### Central

| Sev.  | Achado                                                                                                            | Largura | Evidência                     | Estado              |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- | ------------------- |
| alto  | "Caixa" quebrava "R$ 38,6 M / I" (break-words no meio de "mi")                                                    | 320     | screenshot Central 320        | corrigido (61e000c) |
| médio | "Jogar partida" fica abaixo da dobra em 320–375 (o card do clube ocupa a primeira tela); em 430 aparece sem rolar | 320–375 | screenshots Central 360 e 430 | decisão (D3)        |
| baixo | Texto dos efeitos das decisões ("Diretoria +3 · Caixa −R$ 2 mi") com 10,4 px                                      | todas   | auditoria DOM                 | recomendação (R2)   |

### Mapa

Prédios acessíveis por teclado (`role=button`, `tabindex=0`, nome descritivo), folha do prédio com foco preso e Esc.
"Estacionamento" tem 134×41 px (um pouco abaixo de 44). A decisão 2 do `docs/09` pede "alternativa em lista": não
existe uma lista visível no celular (só os `g` acessíveis). Ver decisão D4.

### Elenco / Táticas

| Sev.  | Achado                                                                                                                               | Largura | Evidência              | Estado              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------- | ------------------- |
| alto  | "Para o banco" / "Para reservas" com 18 px de altura                                                                                 | todas   | auditoria DOM (112×18) | corrigido (d2e6956) |
| médio | Fichas do campo: sobrenome em 8,8 px e posição em 6,4 px                                                                             | 320–360 | auditoria DOM          | recomendação (R2)   |
| baixo | A tela é muito longa (card + ações + presets + campo + banco + reservas + escalações + lista): ajustar a escalação pede 3–4 rolagens | 320–360 | screenshots Elenco     | recomendação (R5)   |

### Mercado

| Sev.  | Achado                                                                                   | Largura | Evidência                 | Estado              |
| ----- | ---------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------- |
| alto  | Cabeçalho: "R$ 38,6 mi" e "R$ 920 mil" em três linhas (R$ / 38,6 / mi)                   | 320–430 | screenshots 320, 360, 430 | corrigido (61e000c) |
| alto  | Abas "Propostas (1) / Buscar / Meu elenco" cortadas nas bordas da coluna                 | 320–360 | screenshots 320 e 360     | corrigido (61e000c) |
| alto  | "Aceitar / Recusar / Contrapropor" em 3 colunas: "Contrapropor" cortado até em 430       | 320–430 | screenshots 320, 360, 430 | corrigido (61e000c) |
| médio | "Mais filtros" (`summary`) com 12 px de altura                                           | todas   | auditoria DOM (298×12)    | corrigido (d2e6956) |
| baixo | "fecha em 17/02/2026" com 9,6 px                                                         | todas   | auditoria DOM             | corrigido (61e000c) |
| baixo | Vender/Emprestar usa botões segmentados sans (fora do padrão pixel dos demais controles) | todas   | screenshot Meu elenco     | recomendação (R6)   |

### Escritório / Finanças

| Sev.  | Achado                                                                                | Largura | Evidência                 | Estado              |
| ----- | ------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------- |
| alto  | Cabeçalho: valores em três linhas e "Patrocínio/mês" invadindo "Sócios"               | 320–430 | screenshots 320, 360, 430 | corrigido (61e000c) |
| alto  | Abas "Propostas (3)" cortadas                                                         | 320–360 | screenshots               | corrigido (61e000c) |
| alto  | "Aceitar / Recusar / Contrapropor" cortados em cada proposta                          | 320–430 | screenshots               | corrigido (61e000c) |
| médio | Três cards com três "Aceitar" iguais para leitor de tela (sem o patrocinador no nome) | todas   | árvore de acessibilidade  | corrigido (61e000c) |

### Estádio / Base / Diretoria (tela "Clube", `phase4-screens`)

| Sev.  | Achado                                                                                                         | Largura | Evidência                                            | Estado              |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- | ------------------- |
| alto  | Cabeçalho "Gestão do clube / Clube / descrição" em verde‑primário e ink‑apagado sobre o gramado: ~1,3:1 e ~2:1 | todas   | `getComputedStyle` (#246630 e #514b3d sobre #2f7d3a) | corrigido (d2e6956) |
| alto  | Aviso "Identidade do conteúdo" na Base: texto chalk sobre painel claro (ilegível)                              | todas   | screenshot Base 360                                  | corrigido (d2e6956) |
| médio | "Desenvolver / Promover / Dispensar" em 3 colunas apertadas                                                    | 320–360 | screenshot Base 360                                  | corrigido (61e000c) |
| médio | Esta tela tem aba "Finanças" própria, e o menu tem "Finanças" (Escritório): dois lugares com o mesmo nome      | todas   | Menu → Finanças vs. Estádio → Finanças               | decisão (D5)        |

### Calendário / Competições e Mundo (Notícias, História, Ranking, Save)

| Sev.  | Achado                                                                                                                                                       | Largura | Evidência               | Estado                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------- | --------------------------- |
| alto  | Mesmo problema de contraste do cabeçalho sobre o gramado ("Temporada 2026 / Competições", "Memória da carreira / Mundo") e do texto "Carregando calendário…" | todas   | `getComputedStyle`      | corrigido (d2e6956)         |
| médio | O item "Caixa de entrada" do menu (com badge 3) abre a tela "Mundo" na aba Notícias; as decisões (e‑mails) ficam só na Central                               | todas   | Menu → Caixa de entrada | decisão (D6)                |
| médio | Ranking existe como tela própria e como aba de "Mundo"; "Histórico" do menu é a aba História de "Mundo"                                                      | todas   | Menu                    | decisão (D6)                |
| baixo | "Calendário" mostra só 4 datas‑chave da temporada (sem a lista de jogos do clube); na demo pode ser limitação do port                                        | todas   | screenshot Calendário   | não verificado com API real |

### Classificação

Tabela com J e Pts apenas, enquanto o resumo da Central já mostra J, SG, Pts (e V/E/D em ≥ 414 px). A tela completa
é menos informativa que o resumo. Ver D7.

### Temporada e Ranking

Sem overflow. Rótulos do gráfico "Posição por rodada" em 6–7 px (SVG) — recomendação R2. Ranking: abas, tabela e
explicação legíveis; vazio real só com temporada fechada (regra do ADR 0013, já registrada no HANDOFF).

### Perfil / licença

Links "Termos de uso" e "Privacidade" com 16 px de altura (corrigido em d2e6956 via `LegalLinks`). O checkout PIX da
demo mostra valor, contador, copia e cola, "Copiar" e "Pagar depois" no alcance do polegar; sem QR nem cadeado na
demo (não verificado com a API real).

### Partida (narrada e instantânea) e Resultado

| Sev.  | Achado                                                                                                                                                            | Largura | Evidência                                 | Estado                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- | ------------------------------ |
| alto  | Ao tocar "Jogar partida" ou "Resultado instantâneo" a página ficava rolada onde estava o botão (`scrollY` 219): o placar grande e os emblemas abriam fora da tela | todas   | `window.scrollY` após o toque; screenshot | corrigido (61e000c, com teste) |
| médio | Pausa (40×36) e velocidades 0,5×–4× (36×36) abaixo de 44 px                                                                                                       | todas   | auditoria DOM                             | corrigido (d2e6956)            |
| baixo | "Lance a lance" em fonte pixel para frases longas cansa a leitura; a narração acima do campo (sans) é mais legível                                                | todas   | screenshot                                | recomendação (R2)              |

Pontos bons: ordem da decisão 19 respeitada (cabeçalho, placar, emblemas, narração, campo, estatísticas, lance a
lance), barra inferior some e volta ao rolar, pausa manual com substituição e mentalidade, "Pular para o resultado"
sempre a um toque, resultado com "Preparar próxima rodada" logo abaixo do placar.

### Landing, Termos e Privacidade

| Sev.  | Achado                                                                                                          | Largura | Evidência              | Estado                                    |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------- | ---------------------- | ----------------------------------------- |
| médio | Links do rodapé da landing e "Voltar ao jogo" das páginas legais com 11 px de altura                            | todas   | auditoria DOM          | corrigido (d2e6956)                       |
| baixo | Na landing, seções com revelação ao rolar apareceram vazias em duas capturas (IntersectionObserver na emulação) | 360     | screenshots da landing | não conclusivo: conferir num celular real |

## O que foi corrigido

Branch `worktree-agent-a54860b74fbeb7a3a`, sem push.

- **61e000c** `fix(web): keep phone layouts inside the screen and open matches at the top`
  - `components/ui/tabs.tsx`: gatilhos quebram só em espaços, 44 px de altura, fonte menor abaixo de 400 px.
  - `market-screen.tsx`, `office-screen.tsx`: dígitos do cabeçalho menores em celular e quebrando só no espaço;
    `<wbr>` em "Patrocínio/mês"; decisões empilhadas abaixo de `sm`; nomes acessíveis com o patrocinador;
    "fecha em" em 12 px.
  - `central-screen.tsx`: `break-normal` no valor do card.
  - `phase4-screens.tsx`: botões da Base em coluna abaixo de 400 px.
  - `game-menu.tsx`: `hyphens-auto`.
  - `new-career-wizard.tsx`: mensagem de validação rolada para o centro.
  - `career-game.tsx`: `scrollTo(0)` ao entrar em `match`/`result`.
  - Testes: `live-match.test.tsx` (rolagem ao topo na partida e no resultado), `office-screen.test.tsx`
    (nomes acessíveis das decisões).
- **d2e6956** `fix(web): 44px touch targets and AA contrast on grass headings`
  - `phase6-shell.tsx`, `retro/mute-button.tsx`: botões do cabeçalho com 44 px.
  - `squad-screen.tsx`: "Para o banco"/"Para reservas" com 40 px.
  - `career-game.tsx` (no 1º commit): pausa e velocidades com 44 px.
  - `legal-page.tsx`, `landing/landing-page.tsx`: links com área de toque de 44 px.
  - `phase4-screens.tsx`, `competition-screens.tsx`: cabeçalhos sobre o gramado em chalk; aviso da Base em ink.

Verificação: `npx vitest related --run` nos arquivos tocados (16 arquivos de teste, 124 testes verdes) e `npx eslint`
nos mesmos arquivos (limpo); `prettier --check --end-of-line auto` (o checkout Windows está em CRLF, por isso o
`--end-of-line`). Visual: medições no DOM em 320 e 360 após as correções (abas 93×44 e 107×44 sem corte, decisões
em largura total, valores do cabeçalho em duas linhas no máximo, overflow 0) e capturas de tela em 360.

## Decisões para o responsável

**D1 — Botão Voltar do navegador / voltar físico do Android.** Problema: a navegação é 100% estado React; qualquer
"voltar" sai do jogo (inclusive no meio da partida). Importa no mobile porque o gesto de voltar é o mais usado no
Android e no PWA instalado não há barra de endereço para recuperar. Regra: `docs/07` §3 ("responsividade de
verdade", "sem becos sem saída"); ADR 0014 prevê Zustand/TanStack para estado, não roteamento. Opções: (a) integrar
`history.pushState` por tela (`screen` e `stage` como entrada de histórico, `popstate` volta para a Central e, na
partida, só pausa); (b) só interceptar na partida com `beforeunload`; (c) manter como está e documentar.
Recomendação: (a), com a partida tratada como estado em que "voltar" pausa em vez de sair.

**D2 — Rótulos da barra inferior em 6,4 px (≤ 375 px).** Problema: "Central/Elenco/Mercado/Escritório/Menu" em
`.4rem` são ilegíveis em 320–375 (a maioria dos aparelhos‑alvo). Regra: `docs/07` §3 (bottom‑nav, alvos generosos)
e ADR 0012 (tipografia pixel para rótulos). Opções: (a) abreviar os rótulos ("Escrit.", "Merc.") e subir para
`.5rem`; (b) mostrar só ícones com `aria-label` abaixo de 376 px e rótulos a partir daí; (c) trocar a fonte dos
rótulos da barra por sans 11 px (quebra a regra visual). Recomendação: (a), mantendo a fonte pixel.

**D3 — Ordem dos cards da Central no celular.** Problema: em 320–375 "Jogar partida" (a ação primária do jogo) fica
abaixo da dobra; o card do clube ocupa a primeira tela. Regra: `docs/09` mapa de telas ("card do clube… próximo
jogo e avançar/jogar ao centro") e `docs/07` §3 ("rodada em poucos toques"). Opções: (a) no celular, Próximo jogo
antes do card do clube (desktop inalterado); (b) card do clube compacto no celular (emblema + nome + 4 números numa
linha) para a dobra incluir o botão; (c) botão "Jogar" fixo na barra inferior enquanto a Central está aberta.
Recomendação: (b), que preserva a ordem decidida e põe o botão na primeira tela.

**D4 — Mapa sem a "alternativa em lista".** Problema: `docs/09` decisão 2 pede ilustração "com alternativa em
lista"; hoje só os prédios são acessíveis (teclado e leitor de tela funcionam, mas não há lista visível para quem
não entende a ilustração ou tem dedos grandes: "Estacionamento" tem 41 px de altura). Opções: (a) lista de
`<button>` abaixo da ilustração (6 linhas, mesmo rótulo dos prédios); (b) manter só a ilustração e registrar o
desvio na decisão 2. Recomendação: (a); é pequena e cumpre a decisão.

**D5 — "Finanças" em dois lugares.** Problema: Menu → Finanças abre o Escritório (aba Finanças, ADR 0011) e a tela
Estádio tem uma aba "Finanças" própria (`phase4-screens`, legada). Regra: `docs/09` ("Escritório: finanças,
contratos…"). Opções: (a) remover a aba Finanças de Estádio e apontar para o Escritório; (b) renomear a aba do
Estádio ("Caixa do estádio"); (c) manter. Recomendação: (a).

**D6 — "Caixa de entrada", "Histórico" e "Ranking" apontam para a tela "Mundo".** Problema: o item do menu "Caixa
de entrada" (badge com o número de notícias) abre "Mundo › Notícias"; as decisões por e‑mail só existem na Central;
"Histórico" é a aba História de "Mundo"; "Ranking" existe como tela própria e como aba de "Mundo". Regra: `docs/09`
mapa de telas (Central com e‑mails e notícias; Ranking com tela própria) e `docs/07` §3 ("navegação fragmentada" é
antipadrão). Opções: (a) "Caixa de entrada" abre uma tela com as decisões pendentes + notícias (o mesmo
`InboxDecisions` da Central sem limite) e "Mundo" perde as abas Ranking e Save (Save vai para Perfil); (b) renomear
o item para "Notícias" e manter o resto; (c) manter. Recomendação: (a).

**D7 — Classificação completa mais pobre que o resumo.** Problema: a tela Classificação mostra J e Pts; o resumo da
Central mostra J, SG, Pts (e V/E/D em ≥ 414 px). Regra: `docs/07` §2 ("números legíveis — tabela são
protagonistas"). Opções: (a) reutilizar a tabela teletexto do resumo na tela completa, com V/E/D/GP/GC/SG e rolagem
horizontal controlada; (b) manter. Recomendação: (a).

## Recomendações (não alteram fluxo; não executadas por envolverem padrão global ou direção visual)

- **R1** Subir `size="sm"` do `Button` de `min-h-9` para `min-h-11` (afeta todas as telas; validar no desktop).
- **R2** Definir um piso para a fonte pixel: 8 px (`.5rem`) para rótulos e 10 px para números/rótulos de gráfico;
  os `.45rem` e `.4rem` atuais ficam abaixo do legível no celular. Para blocos de texto longo (lance a lance,
  notícias), preferir sans 14 px e deixar a pixel para títulos e números (ADR 0012 já diz "títulos e números").
- **R3** `BottomSheet`: `inset-x-[3px]` (ou `mx-[var(--px)]`) para a borda pixel não sair da tela.
- **R4** Nova Carreira, etapa 3: lista em uma coluna (emblema + nome + força) abaixo de 360 px para caberem 6–7
  clubes por tela.
- **R5** Elenco: no celular, levar "Banco" e "Reservas" para dentro do painel do campo (abas) ou recolher presets e
  escalações salvas em `details`, para reduzir a rolagem da tarefa mais frequente.
- **R6** Vender/Emprestar e os segmentados "Titular/Banco/Reserva" no estilo `btn-px` para consistência.
- Conferir num celular real a revelação ao rolar da landing (seções vazias em duas capturas na emulação).

## Não verificado

- Login Supabase (Google/link mágico), paywalls de clube e de limite de save, QR Code do PIX: sem API real na
  sessão; só código e testes.
- Teclado virtual sobre campos (sem teclado na emulação): os formulários estão em painéis roláveis e o rodapé fixo
  do wizard usa `env(safe-area-inset-bottom)`; recomendo um teste em aparelho.
- `prefers-reduced-motion`: coberto por `globals.css` (anima nada) e pelos hooks; não testado ao vivo.
- Erro de rede no meio de um comando: `attempt()` em `career-game.tsx` mostra o erro no ticker e no `InlineError` e
  libera o botão; não simulado ao vivo.

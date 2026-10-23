# ADR 0009 — Direção visual ISOPOP adaptada

- Status: aceito
- Data: 2026-10-22

## Contexto

O responsável adicionou `design.md` (ISOPOP, "a floating pastel city": isométrico, pastéis, vidro, blur, CSS Grid e
movimento alto). `docs/07` pedia modo escuro como cidadão de primeira classe e proibia animações lentas. Os mockups
em `docs/design/mockups-isopop.html` mostraram a proposta adaptada, aprovada com as decisões abaixo.

## Decisão

1. **Só modo claro.** Substitui o modo escuro previsto em `docs/07`; o seletor de tema sai da interface.
2. **Cores.** Fundo e superfícies nos pastéis do `design.md` (`#BEE3F0`, `#DFF3F1`, `#FDF1E3`, `#F9E2E7`, `#E4EEF7`).
   Verde-gramado da marca no botão principal; coral para destaque. Texto em azul-marinho escuro (`#17263A`).
3. **Vidro.** Superfícies de vidro com fundo branco a 50% de opacidade, borda clara e um único token de blur
   (18px) em todos os componentes. Sem blur em listas longas (elenco, mercado); no máximo seis superfícies de vidro
   por tela; sem `backdrop-filter` disponível ou com `prefers-reduced-transparency`, o vidro vira superfície opaca.
4. **Layout.** CSS Grid para a estrutura das telas, Flexbox dentro dos componentes; regras mobile-first de
   `docs/07` continuam valendo (desktop é enhancement).
5. **Movimento.** Animação só em elementos decorativos (hero, mapa isométrico) e desligada com
   `prefers-reduced-motion: reduce`. Nada de animação em fluxo de decisão.
6. **Tipografia.** `system-ui` no corpo e nos números (algarismos tabulares); `Courier New` só no placar e no feed
   da partida, como acento retrô.
7. **Isométrico.** O Mapa do clube e a landing usam ilustração isométrica em SVG; o campo do Elenco usa perspectiva
   CSS. Sem 3D real (fora do MVP).
8. **Fora:** neumorfismo.

## Consequências

Os tokens de tema em `apps/web/app/globals.css` passam a ser a única fonte das cores, do vidro e do blur; componentes
não definem cores próprias. A variante `dark` e o bootstrap de tema do layout são removidos.

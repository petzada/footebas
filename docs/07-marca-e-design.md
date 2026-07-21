# Footebas — Marca e Direção de Design

> Encoda a decisão #16: identidade **nostálgico-modernizada**. Guia o trabalho de frontend.

---

## 1. Posicionamento de marca

**Footebas — o Brasfoot da nova geração.**

Tom **nostálgico-modernizado**: acena à era Brasfoot / lan house / Orkut, mas com acabamento de app 2024. Puxa a
corda emocional de quem amava o Brasfoot (o boca a boca inicial mais provável) e, ao mesmo tempo, entrega o
polimento que justifica o "nova geração" para quem nunca jogou.

- **Público:** saudosistas + nova geração mobile.
- **Risco a gerenciar:** nostalgia demais pode soar "só para quem já jogou". Contrapeso: usabilidade e polimento
  modernos que funcionam para um novato sem contexto histórico.

## 2. Direção visual

- **Cor-âncora:** verde-gramado, com um acento forte (contraste vibrante para ações/destaques).
- **Tipografia:** forte, esportiva, com boa hierarquia (números legíveis — força, placar, tabela são protagonistas).
- **Referências afetivas** à cultura "brasfooteira" (retro-futebol) sem cair no brega/skeumorfismo pesado.
- **Modo escuro** como cidadão de primeira classe (uso mobile, sessões noturnas).
- **Densidade informacional calibrada:** dados na tela (tabela, força, moral, caixa) sem virar "dashboard corporativo".

## 3. Princípios de UX (mobile-first)

**Plataforma primária = mobile.** Desenha-se para a tela do celular primeiro (bottom-nav, divulgação progressiva,
cards, listas virtualizadas, alvos de toque generosos); no **desktop**, o espaço extra vira **enhancement
multi-painel** (ex.: elenco + detalhe lado a lado), nunca o baseline. A densidade típica de manager é resolvida
por **bom design mobile**, não fugindo para o desktop. Regra: toda tela precisa funcionar de ponta a ponta no
celular antes de ganhar o layout ampliado de desktop.

Herdados dos pilares e das lições do doc de origem:

- **Rodada em poucos toques.** O caminho decisão → partida → resultado → próxima decisão é curtíssimo.
- **"Pular para o resultado" sempre a um toque.** O visual nunca bloqueia quem quer velocidade.
- **Hierarquia visual clara**, busca e filtros no elenco/mercado, comparação de jogadores.
- **Onboarding curto** — compreender o clube em poucos minutos, sem tutorial extenso.
- **Sem antipadrões de UI:** excesso de cards, animações lentas, navegação fragmentada, telas intermediárias sem decisão.
- **Responsividade e acessibilidade** de verdade (toque, contraste, tamanho de alvo).

## 4. A partida como vitrine da marca

O **feed de eventos moderno + campo 2D leve** é o principal momento "uau" da marca (decisão #11):

- Feed animado com identidade visual forte, barra de momento, notas, stats ao vivo.
- 2D esquemático elegante nos momentos-chave — moderno sem prometer um motor gráfico que o produto não tem.
- Velocidade configurável preserva a alma; o visual encanta sem atrapalhar.
- **Campo 3D (Three.js) é fast-follow pós-MVP** — no mobile-first, o 3D só entra depois, com fallback 2D e qualidade adaptativa, para não pesar no celular nem atrasar o lançamento.

## 5. Restrições de marca (IP)

- **Não usar** nome, identidade visual, textos ou assets do Brasfoot.
- Base fictícia por padrão; nomes/escudos reais só via UGC do usuário (ver `03-competicoes-e-ligas.md`).
- A marca "Footebas" é própria; identidade visual original.

## 6. Ativos de marca a produzir

- Logotipo Footebas (verde-gramado + acento).
- Sistema de cores (claro/escuro), tipografia, iconografia esportiva.
- Escudos/uniformes genéricos da base fictícia (leves, no Supabase Storage).
- Tela de partida (feed + 2D) como peça-chave de marketing.

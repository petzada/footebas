# Footebas — Competições, Ligas e Conteúdo

> Encoda as decisões #8 (esqueleto competitivo V1) e #10 (IP/conteúdo).

---

## 1. Esqueleto competitivo do MVP

O MVP entrega o que sustenta o **loop**, a **fantasia de ascensão** e o **ranking de prestígio** — com sabor
brasileiro forte desde o lançamento:

| Competição | Formato | Papel |
|------------|---------|-------|
| **Série A** | Liga (pontos corridos), rebaixamento | Topo nacional; palco dos títulos de maior prestígio |
| **Série B** | Liga, acesso + rebaixamento | Meio da pirâmide |
| **Série C** | Liga, acesso | Base da pirâmide; ponto de partida do clube pequeno |
| **Estaduais (simplificados)** | Turno único, estados grandes | **Diferencial cultural BR**; paralelo ao início da temporada |
| **Copa do Brasil** | Mata-mata | Eliminação direta; título alternativo, zebras |
| **Continental (estilo Libertadores, +pré)** | Grupos + mata-mata | Palco continental; conecta sucesso nacional ao objetivo maior |

A **pirâmide com acesso/rebaixamento** viabiliza "clube pequeno → topo"; os **estaduais** trazem a identidade BR;
a **continental** dá o teto aspiracional já no MVP. ~60 clubes.

> **Estaduais simplificados** entram no MVP (mudança em relação à versão anterior deste doc, que os adiava):
> turno único e apenas os estados grandes, para manter o **calendário controlado** — a identidade cultural pesa
> mais que o custo, agora que a marca brasileira foi priorizada.

> **IP nos nomes:** a base oficial do MVP usa **nomes reais** de competições, clubes e jogadores (fonte
> `dados/elencos/`), por decisão de produto. Revisão jurídica/comercial permanece gate de lançamento público.

> Motor **data-driven** (ver `01-arquitetura-e-stack.md`): liga/mata-mata/grupos/continental são configuração.
> Isso permite adicionar estaduais e mais competições **sem reescrever o núcleo**.

## 2. Fast-follow (fora do MVP)

- **Estaduais completos** — ampliar dos "estados grandes / turno único" do MVP para todos os estados, divisões estaduais e formatos configuráveis.
- **Continentais europeias** (Champions + pré, Europa League), **Mundial de clubes**.
- **Seleções**: Copa do Mundo, eliminatórias, Copa América, Eurocopa, Nations League, amistosos, treinar seleção.
- **Supercopa** nacional; ampliação da copa nacional.

## 3. Estratégia de conteúdo e IP (decisão #11)

**Base oficial usa elencos reais** de `dados/elencos/`, com força relativa guiada por
`dados/elencos/forca-relativa-cola.md`.

Três camadas de conteúdo:

```text
Base oficial real (pesquisa → pipeline → snapshot versionado)
    +
Atributos de jogo derived (gerador determinístico + cola de força)
    +
Editor first-class (local/import) + packs da comunidade (UGC)
```

### Guard-rails
- Markdown bruto é imutável; o pipeline não inventa nomes/camisas/`[parcial]` como fato.
- Atributos ausentes na pesquisa saem como `derived`, nunca como “confirmado por fonte”.
- **Workshop hospedado** = adiado; quando existir, com moderação/takedown.
- Revisão jurídica/comercial antes do lançamento público.

## 4. Requisitos de conteúdo da base oficial (V1)

- Clubes suficientes para Séries A/B/C + participantes de Copa do Brasil e Libertadores.
- Elencos com requisito mínimo (ao menos um goleiro + jogadores de linha por clube) ou marcação explícita de parcial.
- Escudos/miniescudos/uniformes: assets locais no MVP de desenvolvimento; storage remoto só no checklist de produção.
- Atributos de jogo derivados de forma determinística a partir da cola de força + regras versionadas.

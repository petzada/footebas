# Cola de força relativa dos clubes (MVP)

> **Uso:** guia para o gerador determinístico de atributos `derived` (força, salário, potencial etc.).
> **Não é** resultado de pesquisa de elenco. Nomes/posições/camisas continuam vindo só dos `.md` de elencos.
> **Regra:** clube em faixa mais alta → média de força do plantel **ligeiramente** maior que a faixa abaixo.
> Dentro da mesma faixa, a ordem da lista é da esquerda/cima (um pouco mais forte) para a direita/baixo.

## Como o gerador deve ler isto

1. Resolver o clube para um `tier` (S+ … D) e um `rank_na_faixa` (1 = mais forte da faixa).
2. Usar `tier` + divisão + posição do jogador + seed versionada para derivar atributos.
3. Diferença entre faixas adjacentes deve ser **sutil** (favoritismo mensurável, zebra ainda possível).
4. Clubes só em Copa/Libertadores/estaduais e ausentes de A/B/C: usar a seção “Participantes extras”.
5. Clube não listado: tier padrão da divisão (`A→C`, `B→D`, `C→E`) até revisão futura desta cola.

## Série A 2026

| Faixa | Clubes (mais forte → menos forte na faixa) | Bias sugerido de força média do plantel |
|---|---|---|
| **S+** | Flamengo, Palmeiras | 78–82 |
| **S** | Atlético Mineiro, Fluminense, São Paulo, Botafogo, Cruzeiro | 74–78 |
| **A** | Corinthians, Internacional, Grêmio, Bahia, Santos | 70–74 |
| **B** | Vasco da Gama, Athletico Paranaense, Red Bull Bragantino, Vitória | 66–70 |
| **C** | Mirassol, Coritiba, Chapecoense, Remo | 62–66 |

## Série B 2026

| Faixa | Clubes (mais forte → menos forte na faixa) | Bias sugerido |
|---|---|---|
| **B+** | Fortaleza, Sport, Goiás, Ceará | 64–68 |
| **C+** | Criciúma, América Mineiro, Avaí, Juventude, Cuiabá | 60–64 |
| **C** | Atlético Goianiense, CRB, Londrina, Náutico, Ponte Preta | 57–61 |
| **D** | Novorizontino, Operário-PR, São Bernardo, Vila Nova, Botafogo-SP, Athletic Club | 54–58 |

## Série C 2026

| Faixa | Clubes (mais forte → menos forte na faixa) | Bias sugerido |
|---|---|---|
| **C** | Paysandu, Figueirense, Guarani, Santa Cruz, Brusque | 56–60 |
| **D** | Volta Redonda, Amazonas, Ferroviária, Maringá, Ypiranga-RS, Caxias | 52–56 |
| **E** | Confiança, Botafogo-PB, Ituano, Barra-SC, Floresta, Anápolis, Inter de Limeira, Itabaiana, Maranhão | 48–53 |

> Clubes marcados `[parcial]` nos levantamentos: mesmo tier, mas o gerador deve aplicar penalidade leve de
> profundidade de elenco (banco/reservas mais fracos), não inventar nomes faltantes.

## Participantes extras (Copa / Libertadores / estaduais)

Usar quando o clube **não** estiver nas tabelas A/B/C acima:

| Contexto | Bias |
|---|---|
| Clube brasileiro forte recorrente em Libertadores (fora do top A listado) | tratar como **A** |
| Clube de Série A listado | usar faixa da Série A |
| Clube de Série B listado | usar faixa da Série B |
| Clube estadual / copa sem divisão nacional clara | **E** (48–53), salvo override futuro nesta cola |

## Variação interna do elenco (obrigatória)

Mesmo no mesmo clube, o gerador **não** pode deixar todos iguais:

- Titulares prováveis (por posição + ordem no arquivo) um pouco acima da média do clube.
- Reservas / terceira opção de goleiro abaixo da média do clube.
- Dispersão controlada (ex.: σ pequena) para Monte Carlo e zebras continuarem válidos.

## O que esta cola NÃO autoriza

- Inventar jogador, camisa ou resolver `[parcial]` / `#?` / `—` como fato de pesquisa.
- Copiar ratings de sites externos sem registrar proveniência `derived`.
- Tornar S+ imbatível (favoritismo monotônico, sem vitória garantida).

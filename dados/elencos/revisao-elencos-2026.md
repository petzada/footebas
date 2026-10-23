# Revisão dos elencos — 2026

> Revisão dos clubes-alvo do catálogo do Footebas a partir dos arquivos brutos de `dados/elencos/` (que não foram editados). Gerada por script em 22–23/10/2026 e revisada manualmente. Os destaques de cada clube estão em `destaques-2026.md`.

## Metodologia

- **Leitura dos arquivos:** cada linha `- <posição> | <nome> | <#camisa>` sob um título `### <Clube> (...)` conta como um atleta. Também foram aceitas as linhas com marcador duplo `- - <posição> | ...`, que aparecem nos blocos importados de `estaduais-1a-divisao-2026.md`.
- **Nome do clube:** título do elenco sem a localidade entre parênteses, sem `[parcial]`, sem as notas em itálico e sem o sufixo da Libertadores (`— 1º Gr. X`).
- **Elenco canônico:** para clubes das Séries A/B/C, o bloco do arquivo da série; para clubes só de estadual, o bloco de `estaduais-1a-divisao-2026.md`; para os estrangeiros, o bloco de `copa-libertadores-2026.md`. Os mesmos clubes aparecem em outros arquivos (estaduais, Copa do Brasil, Libertadores); a coluna "união" soma os nomes distintos em todos os arquivos.
- **Sinônimos de clube:** `Atlético-MG` = Atlético Mineiro, `América-MG` = América Mineiro, `Atlético-GO` = Atlético Goianiense, `Ypiranga` = Ypiranga-RS. Os demais nomes batem exatamente entre os arquivos.
- **Comparação de nomes:** sem diferenciar maiúsculas, acentos e espaços extras. Nomes de uma só palavra (ex.: "Léo", "Gabriel") coincidem com frequência entre pessoas diferentes; por isso cada ocorrência entre clubes traz uma classificação.

## 1. Clubes-alvo

Total: **79 clubes** com elenco nominal.

- **Série A (20):** Athletico Paranaense, Atlético Mineiro, Bahia, Botafogo, Chapecoense, Corinthians, Coritiba, Cruzeiro, Flamengo, Fluminense, Grêmio, Internacional, Mirassol, Palmeiras, Red Bull Bragantino, Remo, Santos, São Paulo, Vasco da Gama, Vitória
- **Série B (20):** América Mineiro, Athletic Club, Atlético Goianiense, Avaí, Botafogo-SP, Ceará, CRB, Criciúma, Cuiabá, Fortaleza, Goiás, Juventude, Londrina, Náutico, Novorizontino, Operário-PR, Ponte Preta, São Bernardo, Sport, Vila Nova
- **Série C (20):** Amazonas, Anápolis, Barra-SC, Botafogo-PB, Brusque, Caxias, Confiança, Ferroviária, Figueirense, Floresta, Guarani, Inter de Limeira, Itabaiana, Ituano, Maranhão, Maringá, Paysandu, Santa Cruz, Volta Redonda, Ypiranga-RS
- **Só estaduais (9):** Velo Clube, Portuguesa, Primavera, Capivariano, Noroeste, Jacuipense, Juazeirense, Atlético de Alagoinhas, Galícia
- **Libertadores, estrangeiros (10):** Estudiantes, Independiente Rivadavia, Universidad Católica, Coquimbo Unido, Cerro Porteño, LDU Quito, Independiente del Valle, Rosario Central, Platense, Deportes Tolima
- **Brasileiros da Libertadores com elenco (já contados na Série A):** Corinthians, Cruzeiro, Flamengo, Fluminense, Mirassol, Palmeiras. O bloco `### Botafogo / Bahia` de `copa-libertadores-2026.md` não tem atletas.
- **Excluído:** Galo Maringá — ver seção 7. Com ele, os clubes "só de estadual" seriam 10.
- **Por que 9 (10 com o Galo Maringá) e não ~14 só de estadual:** `Atlético-MG`, `América-MG`, `Atlético-GO` e `Ypiranga` são os mesmos clubes das Séries A/B/C com outra grafia. Os demais clubes de estadual sem atletas (marcados `[parcial — sem elenco nominal]`, incluindo `Vitória — elenco Baianão`) ficaram de fora.

## 2. Tamanho do elenco

| Clube | Origem | Arquivo canônico (título) | Atletas | Goleiros | União em todos os arquivos |
|---|---|---|---:|---:|---:|
| Athletico Paranaense | Série A | `brasileirao-serie-a-2026.md` | 33 | 3 | 34 |
| Atlético Mineiro | Série A | `brasileirao-serie-a-2026.md` | 32 | 4 | 32 |
| Bahia | Série A | `brasileirao-serie-a-2026.md` | 32 | 4 | 32 |
| Botafogo | Série A | `brasileirao-serie-a-2026.md` | 35 | 5 | 35 |
| Chapecoense | Série A | `brasileirao-serie-a-2026.md` | 35 | 3 | 35 |
| Corinthians | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 34 | 4 | 34 |
| Coritiba | Série A | `brasileirao-serie-a-2026.md` | 32 | 4 | 32 |
| Cruzeiro | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 32 | 3 | 32 |
| Flamengo | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 28 | 3 | 29 |
| Fluminense | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 33 | 3 | 33 |
| Grêmio | Série A | `brasileirao-serie-a-2026.md` | 33 | 4 | 33 |
| Internacional | Série A | `brasileirao-serie-a-2026.md` | 33 | 6 | 33 |
| Mirassol | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 33 | 4 | 40 |
| Palmeiras | Série A + Libertadores | `brasileirao-serie-a-2026.md` | 31 | 3 | 31 |
| Red Bull Bragantino | Série A | `brasileirao-serie-a-2026.md` | 38 | 5 | 39 |
| Remo | Série A | `brasileirao-serie-a-2026.md` | 34 | 3 | 34 |
| Santos | Série A | `brasileirao-serie-a-2026.md` | 35 | 4 | 35 |
| São Paulo | Série A | `brasileirao-serie-a-2026.md` | 42 | 5 | 42 |
| Vasco da Gama | Série A | `brasileirao-serie-a-2026.md` | 33 | 3 | 35 |
| Vitória | Série A | `brasileirao-serie-a-2026.md` | 37 | 4 | 37 |
| América Mineiro | Série B | `brasileirao-serie-b-2026.md` | 48 | 5 | 49 |
| Athletic Club | Série B | `brasileirao-serie-b-2026.md` | 57 | 5 | 57 |
| Atlético Goianiense | Série B | `brasileirao-serie-b-2026.md` | 56 | 6 | 56 |
| Avaí | Série B | `brasileirao-serie-b-2026.md` | 43 | 5 | 43 |
| Botafogo-SP | Série B | `brasileirao-serie-b-2026.md` | 45 | 4 | 45 |
| Ceará | Série B | `brasileirao-serie-b-2026.md` | 41 | 4 | 41 |
| CRB | Série B | `brasileirao-serie-b-2026.md` | 43 | 5 | 43 |
| Criciúma | Série B | `brasileirao-serie-b-2026.md` | 40 | 5 | 40 |
| Cuiabá | Série B | `brasileirao-serie-b-2026.md` | 51 | 6 | 51 |
| Fortaleza | Série B | `brasileirao-serie-b-2026.md` | 38 | 4 | 41 |
| Goiás | Série B | `brasileirao-serie-b-2026.md` | 34 | 4 | 34 |
| Juventude | Série B | `brasileirao-serie-b-2026.md` | 50 | 6 | 50 |
| Londrina | Série B | `brasileirao-serie-b-2026.md` | 45 | 4 | 45 |
| Náutico | Série B | `brasileirao-serie-b-2026.md` | 45 | 4 | 47 |
| Novorizontino | Série B | `brasileirao-serie-b-2026.md` | 43 | 5 | 43 |
| Operário-PR | Série B | `brasileirao-serie-b-2026.md` | 50 | 5 | 50 |
| Ponte Preta | Série B | `brasileirao-serie-b-2026.md` | 43 | 3 | 43 |
| São Bernardo | Série B | `brasileirao-serie-b-2026.md` | 37 | 3 | 37 |
| Sport | Série B | `brasileirao-serie-b-2026.md` | 47 | 6 | 48 |
| Vila Nova | Série B | `brasileirao-serie-b-2026.md` | 45 | 4 | 45 |
| Amazonas | Série C | `brasileirao-serie-c-2026.md` | 33 | 5 | 33 |
| Anápolis | Série C | `brasileirao-serie-c-2026.md` | 39 | 5 | 39 |
| Barra-SC | Série C | `brasileirao-serie-c-2026.md` | 34 | 2 | 34 |
| Botafogo-PB | Série C | `brasileirao-serie-c-2026.md` | 35 | 4 | 35 |
| Brusque | Série C | `brasileirao-serie-c-2026.md` | 33 | 3 | 33 |
| Caxias | Série C | `brasileirao-serie-c-2026.md` | 31 | 4 | 31 |
| Confiança | Série C | `brasileirao-serie-c-2026.md` | 34 | 5 | 34 |
| Ferroviária | Série C | `brasileirao-serie-c-2026.md` | 29 | 2 | 29 |
| Figueirense | Série C | `brasileirao-serie-c-2026.md` | 37 | 4 | 37 |
| Floresta | Série C | `brasileirao-serie-c-2026.md` | 30 | 3 | 30 |
| Guarani | Série C | `brasileirao-serie-c-2026.md` | 33 | 4 | 33 |
| Inter de Limeira | Série C | `brasileirao-serie-c-2026.md` | 34 | 4 | 34 |
| Itabaiana | Série C | `brasileirao-serie-c-2026.md` | 31 | 4 | 31 |
| Ituano | Série C | `brasileirao-serie-c-2026.md` | 27 | 3 | 27 |
| Maranhão | Série C | `brasileirao-serie-c-2026.md` | 34 | 3 | 34 |
| Maringá | Série C | `brasileirao-serie-c-2026.md` | 29 | 2 | 29 |
| Paysandu | Série C | `brasileirao-serie-c-2026.md` | 35 | 4 | 35 |
| Santa Cruz | Série C | `brasileirao-serie-c-2026.md` | 33 | 5 | 33 |
| Volta Redonda | Série C | `brasileirao-serie-c-2026.md` | 33 | 4 | 33 |
| Ypiranga-RS | Série C | `brasileirao-serie-c-2026.md` | 30 | 4 | 30 |
| Velo Clube | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 11 | 1 | 11 |
| Portuguesa | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 11 | 1 | 11 |
| Primavera | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 32 | 4 | 32 |
| Capivariano | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 12 | 1 | 12 |
| Noroeste | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 13 | 1 | 13 |
| Jacuipense | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 13 | 2 | 13 |
| Juazeirense | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 20 | 1 | 20 |
| Atlético de Alagoinhas | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 2 | 0 | 2 |
| Galícia | Estadual (só estaduais) | `estaduais-1a-divisao-2026.md` | 4 | 0 | 4 |
| Estudiantes | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 33 | 3 | 33 |
| Independiente Rivadavia | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 25 | 3 | 25 |
| Universidad Católica | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 24 | 2 | 24 |
| Coquimbo Unido | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 31 | 5 | 31 |
| Cerro Porteño | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 37 | 3 | 37 |
| LDU Quito | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 25 | 3 | 25 |
| Independiente del Valle | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 21 | 3 | 21 |
| Rosario Central | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 30 | 4 | 30 |
| Platense | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 23 | 3 | 23 |
| Deportes Tolima | Libertadores (estrangeiro) | `copa-libertadores-2026.md` | 21 | 2 | 21 |

Clubes cuja união passa do elenco canônico (nomes que só aparecem em estaduais, Copa do Brasil ou Libertadores): Athletico Paranaense (33 → 34), Flamengo (28 → 29), Mirassol (33 → 40), Red Bull Bragantino (38 → 39), Vasco da Gama (33 → 35), América Mineiro (48 → 49), Fortaleza (38 → 41), Náutico (45 → 47), Sport (47 → 48). Destaque para o Mirassol, cujo bloco da Libertadores tem 35 nomes contra 33 na Série A.

## 3. Atletas que aparecem em mais de um clube

Excluídas as ocorrências do bloco Galo Maringá (cópia do Maringá). Encontrados **261 nomes** em mais de um clube: **59 prováveis mesmos atletas** (nome composto e posições compatíveis) e **202 prováveis homônimos**. Cada ocorrência traz `arquivo:linha`; ocorrências do mesmo clube em vários arquivos aparecem agrupadas.

### 3.1 Prováveis mesmos atletas (59)

Estes são os casos que mais importam para o catálogo: o mesmo jogador em dois clubes do jogo. O pipeline deve escolher um clube só (sugestão: o do elenco canônico mais recente, ou seja, o arquivo da série).

- **Andre Luis / André Luis** — Mirassol (ATA/Centroavante): `brasileirao-serie-a-2026.md:484`, `estaduais-1a-divisao-2026.md:324`, `copa-do-brasil-2026.md:604`, `copa-libertadores-2026.md:281`; Vila Nova (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:964`, `estaduais-1a-divisao-2026.md:2114` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Anthony Matheus** — Atlético Goianiense (Meio-campo): `brasileirao-serie-b-2026.md:173`, `estaduais-1a-divisao-2026.md:2202`; CRB (Atacante): `brasileirao-serie-b-2026.md:377` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Bruno Santos** — Londrina (Atacante): `brasileirao-serie-b-2026.md:646`, `estaduais-1a-divisao-2026.md:1603`; Mirassol (ATA/Centroavante): `brasileirao-serie-a-2026.md:485`, `estaduais-1a-divisao-2026.md:325`, `copa-do-brasil-2026.md:602`, `copa-libertadores-2026.md:282` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Bruno Silva** — Capivariano (MEI): `estaduais-1a-divisao-2026.md:519`; Juazeirense (MEI): `estaduais-1a-divisao-2026.md:1283` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Caio Roque** — Botafogo (DEF/Lateral Esq.): `brasileirao-serie-a-2026.md:152`, `estaduais-1a-divisao-2026.md:711`; Portuguesa (DEF): `estaduais-1a-divisao-2026.md:466` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Daniel Amorim** — São Bernardo (Centroavante): `brasileirao-serie-b-2026.md:876`, `estaduais-1a-divisao-2026.md:364`; Velo Clube (ATA): `estaduais-1a-divisao-2026.md:460` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Diego Mathias** — Noroeste (ATA): `estaduais-1a-divisao-2026.md:541`; Novorizontino (Centroavante): `brasileirao-serie-b-2026.md:739`, `estaduais-1a-divisao-2026.md:287` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Fabricio Domínguez** — Cerro Porteño (LD): `copa-libertadores-2026.md:490`; Sport (Meio-campo): `brasileirao-serie-b-2026.md:909` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Felipe Azevedo** — Botafogo-PB (PE): `brasileirao-serie-c-2026.md:154`; Capivariano (ATA): `estaduais-1a-divisao-2026.md:524` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Felipe Vieira** — Athletic Club (Zagueiro): `brasileirao-serie-b-2026.md:92`, `estaduais-1a-divisao-2026.md:907`; Botafogo-SP (Lateral Esq.): `brasileirao-serie-b-2026.md:258`, `estaduais-1a-divisao-2026.md:556` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Gabriel Índio** — Athletic Club (Zagueiro): `brasileirao-serie-b-2026.md:93`, `estaduais-1a-divisao-2026.md:908`; Náutico (Defensor): `brasileirao-serie-b-2026.md:669` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Gabriel Pires** — Mirassol (VOL/Volante): `brasileirao-serie-a-2026.md:469`, `estaduais-1a-divisao-2026.md:309`, `copa-do-brasil-2026.md:589`, `copa-libertadores-2026.md:266`; Portuguesa (MEI): `estaduais-1a-divisao-2026.md:473` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Gabriel Poveda** — Primavera (ATA): `estaduais-1a-divisao-2026.md:508`; Remo (ATA/Centroavante): `brasileirao-serie-a-2026.md:599`, `copa-do-brasil-2026.md:644` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Guilherme Estrella** — CRB (Meio-campo): `brasileirao-serie-b-2026.md:364`; Vasco da Gama (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:707`, `estaduais-1a-divisao-2026.md:683`, `copa-do-brasil-2026.md:170` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Guilherme Vieira** — Figueirense (PE): `brasileirao-serie-c-2026.md:330`, `estaduais-1a-divisao-2026.md:1904`; Vila Nova (Meio-campo): `brasileirao-serie-b-2026.md:958` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Hugo Moura** — Jacuipense (DEF): `estaduais-1a-divisao-2026.md:1260`; Vasco da Gama (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:702`, `estaduais-1a-divisao-2026.md:678`, `copa-do-brasil-2026.md:161` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Jean Carlos** — Goiás (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:538`, `estaduais-1a-divisao-2026.md:2079`; Náutico (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:679`, `estaduais-1a-divisao-2026.md:1379` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Jean Lucas** — Avaí (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:230`, `estaduais-1a-divisao-2026.md:1720`; Bahia (MEI/Meia Central): `brasileirao-serie-a-2026.md:121`, `estaduais-1a-divisao-2026.md:1197` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Jhan Torres** — Athletic Club (Zagueiro): `brasileirao-serie-b-2026.md:94`, `estaduais-1a-divisao-2026.md:909`; Operário-PR (Defensor): `brasileirao-serie-b-2026.md:760`, `estaduais-1a-divisao-2026.md:1658` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Joao Neto / João Neto** — CRB (Centroavante): `brasileirao-serie-b-2026.md:374`; Red Bull Bragantino (MEI/Meia Central): `brasileirao-serie-a-2026.md:550`, `estaduais-1a-divisao-2026.md:229` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Julio Cesar / Julio César / Júlio César** — Anápolis (LE): `brasileirao-serie-c-2026.md:85`, `estaduais-1a-divisao-2026.md:2141`; Ceará (DEF/Zagueiro): `brasileirao-serie-b-2026.md:300`, `estaduais-1a-divisao-2026.md:1939` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Leo Aragao / Leó Aragão / Léo Aragão** — Avaí (Goleiro): `brasileirao-serie-b-2026.md:205`; Cruzeiro (GOL/Goleiro): `brasileirao-serie-a-2026.md:281`, `estaduais-1a-divisao-2026.md:826`, `copa-do-brasil-2026.md:321`, `copa-libertadores-2026.md:211` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Leo Duarte / Léo Duarte** — Atlético Mineiro (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:75`, `estaduais-1a-divisao-2026.md:797`, `copa-do-brasil-2026.md:362`; Barra-SC (LD): `brasileirao-serie-c-2026.md:127`, `estaduais-1a-divisao-2026.md:1831` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Léo Passos** — Ituano (ATA): `brasileirao-serie-c-2026.md:503`; Primavera (ATA): `estaduais-1a-divisao-2026.md:507` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luan Martins** — Juventude (MEI/VOL/Volante): `brasileirao-serie-b-2026.md:578`, `estaduais-1a-divisao-2026.md:1073`, `copa-do-brasil-2026.md:552`; Primavera (MEI): `estaduais-1a-divisao-2026.md:495` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Cunha** — Confiança (ZAG): `brasileirao-serie-c-2026.md:269`; Ponte Preta (Zagueiro): `brasileirao-serie-b-2026.md:799`, `estaduais-1a-divisao-2026.md:408` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Dias** — Figueirense (ZAG): `brasileirao-serie-c-2026.md:343`, `estaduais-1a-divisao-2026.md:1917`; Ituano (LD): `brasileirao-serie-c-2026.md:505` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Lima** — Goiás (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:536`, `estaduais-1a-divisao-2026.md:2075`; São Bernardo (Volante): `brasileirao-serie-b-2026.md:857`, `estaduais-1a-divisao-2026.md:345` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Rodrigues** — Ferroviária (LD): `brasileirao-serie-c-2026.md:305`; Goiás (MEI/Volante): `brasileirao-serie-b-2026.md:533`, `estaduais-1a-divisao-2026.md:2072` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Santos** — Inter de Limeira (ZAG): `brasileirao-serie-c-2026.md:440`; Maranhão (LE): `brasileirao-serie-c-2026.md:537` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Lucas Silva** — Cruzeiro (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:296`, `estaduais-1a-divisao-2026.md:841`, `copa-do-brasil-2026.md:333`, `copa-libertadores-2026.md:226`; Vitória (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:751`, `estaduais-1a-divisao-2026.md:1246`, `copa-do-brasil-2026.md:495` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luiz Daniel** — Botafogo-PB (GOL): `brasileirao-serie-c-2026.md:169`; Noroeste (GOL): `estaduais-1a-divisao-2026.md:529` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luiz Fernando** — Fortaleza (ATA/PE/Ponta Esq.): `brasileirao-serie-b-2026.md:505`, `estaduais-1a-divisao-2026.md:1991`, `copa-do-brasil-2026.md:524`; Primavera (ATA): `estaduais-1a-divisao-2026.md:503` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luiz Gustavo** — Athletico Paranaense (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:49`, `estaduais-1a-divisao-2026.md:1459`, `copa-do-brasil-2026.md:440`; Bahia (DEF/Zagueiro): `brasileirao-serie-a-2026.md:111`, `estaduais-1a-divisao-2026.md:1187` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luiz Henrique** — Avaí (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:229`, `estaduais-1a-divisao-2026.md:1719`; Juventude (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:586`, `estaduais-1a-divisao-2026.md:1079`, `copa-do-brasil-2026.md:560` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Luiz Otavio / Luiz Otávio** — Ceará (DEF/Defensor): `brasileirao-serie-b-2026.md:309`, `estaduais-1a-divisao-2026.md:1941`; Cuiabá (Volante): `brasileirao-serie-b-2026.md:449` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Marcelo Carné** — Cuiabá (Goleiro): `brasileirao-serie-b-2026.md:426`; Velo Clube (GOL): `estaduais-1a-divisao-2026.md:451` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Marcelo Freitas** — Caxias (MC): `brasileirao-serie-c-2026.md:237`, `estaduais-1a-divisao-2026.md:1113`; Portuguesa (MEI): `estaduais-1a-divisao-2026.md:472` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Marcelo Henrique** — Athletic Club (Lateral Esq.): `brasileirao-serie-b-2026.md:97`, `estaduais-1a-divisao-2026.md:912`; Cuiabá (Defensor): `brasileirao-serie-b-2026.md:443` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Mateus Silva** — Náutico (DEF/Zagueiro): `brasileirao-serie-b-2026.md:657`, `estaduais-1a-divisao-2026.md:1360`; Vitória (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:734`, `estaduais-1a-divisao-2026.md:1229`, `copa-do-brasil-2026.md:477` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Matheus Anjos** — Caxias (MEI): `brasileirao-serie-c-2026.md:238`, `estaduais-1a-divisao-2026.md:1114`; Primavera (MEI): `estaduais-1a-divisao-2026.md:499` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Matheus Guilherme** — Capivariano (ATA): `estaduais-1a-divisao-2026.md:522`; Guarani (PD): `brasileirao-serie-c-2026.md:409`, `estaduais-1a-divisao-2026.md:389` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Matheus Martins** — Botafogo (ATA/Ponta Esq.): `brasileirao-serie-a-2026.md:164`, `estaduais-1a-divisao-2026.md:723`; Floresta (PD): `brasileirao-serie-c-2026.md:379`, `estaduais-1a-divisao-2026.md:2029` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Matheus Nogueira** — Brusque (GOL): `brasileirao-serie-c-2026.md:206`, `estaduais-1a-divisao-2026.md:1789`; São Bernardo (Goleiro): `brasileirao-serie-b-2026.md:843`, `estaduais-1a-divisao-2026.md:331` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Matheus Pereira** — Corinthians (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:230`, `estaduais-1a-divisao-2026.md:105`, `copa-do-brasil-2026.md:200`, `copa-libertadores-2026.md:152`; Cruzeiro (MEI/MO/Meia Ofensivo): `brasileirao-serie-a-2026.md:300`, `estaduais-1a-divisao-2026.md:845`, `copa-do-brasil-2026.md:339`, `copa-libertadores-2026.md:230` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Nathan Fogaca / Nathan Fogaça** — Fortaleza (ATA): `estaduais-1a-divisao-2026.md:2000`, `copa-do-brasil-2026.md:533`; Mirassol (ATA): `copa-libertadores-2026.md:285` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Pablo Dyego** — Londrina (Ponta Dir.): `brasileirao-serie-b-2026.md:642`, `estaduais-1a-divisao-2026.md:1599`; São Bernardo (Atacante): `brasileirao-serie-b-2026.md:877`, `estaduais-1a-divisao-2026.md:365` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Paulo Baya** — Fortaleza (ATA/PE/Ponta Esq.): `brasileirao-serie-b-2026.md:507`, `estaduais-1a-divisao-2026.md:1993`, `copa-do-brasil-2026.md:525`; Primavera (ATA): `estaduais-1a-divisao-2026.md:501` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Pedro Lucas** — Maranhão (VOL): `brasileirao-serie-c-2026.md:541`; Ypiranga-RS (PD): `brasileirao-serie-c-2026.md:717`, `estaduais-1a-divisao-2026.md:1167` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Rodrigo Alves** — Itabaiana (PE): `brasileirao-serie-c-2026.md:485`; Velo Clube (ATA): `estaduais-1a-divisao-2026.md:459` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Rodrigo Rodrigues** — Coritiba (ATA/Centroavante): `brasileirao-serie-a-2026.md:277`, `estaduais-1a-divisao-2026.md:1510`; Cuiabá (Centroavante): `brasileirao-serie-b-2026.md:465` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Tomas Pochettino / Tomás Pochettino** — Fortaleza (Meio-campo): `brasileirao-serie-b-2026.md:503`; Vitória (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:742`, `estaduais-1a-divisao-2026.md:1237`, `copa-do-brasil-2026.md:486` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Victor Luis / Victor Luís** — Itabaiana (VOL): `brasileirao-serie-c-2026.md:489`; Mirassol (LE/Lateral Esq.): `brasileirao-serie-a-2026.md:462`, `estaduais-1a-divisao-2026.md:302`, `copa-do-brasil-2026.md:581`, `copa-libertadores-2026.md:259` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Victor Silva** — Ferroviária (PD): `brasileirao-serie-c-2026.md:311`; Ituano (MEI): `brasileirao-serie-c-2026.md:518` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Vinicius Popó** — Barra-SC (ATA): `brasileirao-serie-c-2026.md:141`, `estaduais-1a-divisao-2026.md:1845`; Capivariano (ATA): `estaduais-1a-divisao-2026.md:525` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Yago Santos** — América Mineiro (Meio-campo): `brasileirao-serie-b-2026.md:69`; Athletic Club (Meia Central): `brasileirao-serie-b-2026.md:114`, `estaduais-1a-divisao-2026.md:929` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Ze Marcos / Zé Marcos** — Sport (Defensor): `brasileirao-serie-b-2026.md:896`; Vitória (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:725`, `estaduais-1a-divisao-2026.md:1220`, `copa-do-brasil-2026.md:471` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Ze Ricardo / Zé Ricardo** — Avaí (MEI/Volante): `brasileirao-serie-b-2026.md:224`, `estaduais-1a-divisao-2026.md:1711`; Remo (VOL/Volante): `brasileirao-serie-a-2026.md:588`, `copa-do-brasil-2026.md:631` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_
- **Ze Vitor / Zé Vitor** — Ferroviária (ZAG): `brasileirao-serie-c-2026.md:315`; Vitória (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:741`, `estaduais-1a-divisao-2026.md:1236`, `copa-do-brasil-2026.md:484` — _provável mesmo atleta (transferência/empréstimo no snapshot ou importação cruzada)_

### 3.2 Prováveis homônimos (202)

Nomes curtos ou com posições incompatíveis; em geral são pessoas diferentes e podem coexistir no catálogo (o ID do atleta deve incluir o clube).

- **Afonso** — Floresta (ZAG): `brasileirao-serie-c-2026.md:357`, `estaduais-1a-divisao-2026.md:2007`; Primavera (DEF): `estaduais-1a-divisao-2026.md:483` — _provável homônimo (nome de uma palavra)_
- **Alex** — Ceará (Defensor): `brasileirao-serie-b-2026.md:310`; Santos (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:612`, `estaduais-1a-divisao-2026.md:177`, `copa-do-brasil-2026.md:398`; Vila Nova (Defensor): `brasileirao-serie-b-2026.md:943` — _provável homônimo (nome de uma palavra)_
- **Alisson** — Confiança (ZAG): `brasileirao-serie-c-2026.md:252`; Criciúma (GOL/Goleiro): `brasileirao-serie-b-2026.md:382`, `estaduais-1a-divisao-2026.md:1730`; Fluminense (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:366`, `estaduais-1a-divisao-2026.md:643`, `copa-do-brasil-2026.md:129`, `copa-libertadores-2026.md:312` — _provável homônimo (goleiro e jogador de linha)_
- **Allan** — Botafogo (MEI/Volante): `brasileirao-serie-a-2026.md:155`, `estaduais-1a-divisao-2026.md:714`; Corinthians (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:226`, `estaduais-1a-divisao-2026.md:101`, `copa-do-brasil-2026.md:196`, `copa-libertadores-2026.md:148`; Palmeiras (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:518`, `estaduais-1a-divisao-2026.md:76`, `copa-do-brasil-2026.md:242`, `copa-libertadores-2026.md:198` — _provável homônimo (nome de uma palavra)_
- **Anderson** — CRB (Defensor): `brasileirao-serie-b-2026.md:355`; Chapecoense (GOL/Goleiro): `brasileirao-serie-a-2026.md:174`, `estaduais-1a-divisao-2026.md:1854`, `copa-do-brasil-2026.md:651`; Vila Nova (DEF/Zagueiro): `brasileirao-serie-b-2026.md:934`, `estaduais-1a-divisao-2026.md:2095` — _provável homônimo (goleiro e jogador de linha)_
- **Andre / André** — Corinthians (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:229`, `estaduais-1a-divisao-2026.md:104`, `copa-do-brasil-2026.md:201`, `copa-libertadores-2026.md:151`; Operário-PR (Zagueiro): `brasileirao-serie-b-2026.md:750`, `estaduais-1a-divisao-2026.md:1648` — _provável homônimo (nome de uma palavra)_
- **Ariel** — Atlético Goianiense (Meio-campo): `brasileirao-serie-b-2026.md:174`, `estaduais-1a-divisao-2026.md:2203`; Brusque (MEI): `brasileirao-serie-c-2026.md:187`, `estaduais-1a-divisao-2026.md:1770` — _provável homônimo (nome de uma palavra)_
- **Artur** — Londrina (Lateral Esq.): `brasileirao-serie-b-2026.md:615`, `estaduais-1a-divisao-2026.md:1572`; São Paulo (ATA/Ponta Dir.): `brasileirao-serie-a-2026.md:674`, `estaduais-1a-divisao-2026.md:157` — _provável homônimo (nome de uma palavra)_
- **Assis** — Atlético Goianiense (Meia Ofensivo): `brasileirao-serie-b-2026.md:171`, `estaduais-1a-divisao-2026.md:2200`; Goiás (Meio-campo): `brasileirao-serie-b-2026.md:543` — _provável homônimo (nome de uma palavra)_
- **Augusto** — Sport (DEF/Lateral Dir.): `brasileirao-serie-b-2026.md:895`, `estaduais-1a-divisao-2026.md:1335`; São Bernardo (Zagueiro): `brasileirao-serie-b-2026.md:849`, `estaduais-1a-divisao-2026.md:337` — _provável homônimo (nome de uma palavra)_
- **Bernardo** — Brusque (VOL): `brasileirao-serie-c-2026.md:188`, `estaduais-1a-divisao-2026.md:1771`; Juventude (Defensor): `brasileirao-serie-b-2026.md:573` — _provável homônimo (nome de uma palavra)_
- **Betao / Betão** — Itabaiana (ZAG): `brasileirao-serie-c-2026.md:460`; Náutico (DEF/Zagueiro): `brasileirao-serie-b-2026.md:656`, `estaduais-1a-divisao-2026.md:1359` — _provável homônimo (nome de uma palavra)_
- **Brenno** — Fortaleza (GOL/Goleiro): `brasileirao-serie-b-2026.md:478`, `estaduais-1a-divisao-2026.md:1968`, `copa-do-brasil-2026.md:502`; Operário-PR (Meio-campo): `brasileirao-serie-b-2026.md:772`, `estaduais-1a-divisao-2026.md:1670` — _provável homônimo (goleiro e jogador de linha)_
- **Breno** — Figueirense (VOL): `brasileirao-serie-c-2026.md:321`, `estaduais-1a-divisao-2026.md:1895`; Juazeirense (DEF): `estaduais-1a-divisao-2026.md:1282` — _provável homônimo (nome de uma palavra)_
- **Bruninho** — Athletic Club (Ponta Dir.): `brasileirao-serie-b-2026.md:128`, `estaduais-1a-divisao-2026.md:943`; Athletico Paranaense (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:61`, `estaduais-1a-divisao-2026.md:1471`, `copa-do-brasil-2026.md:453`; Fortaleza (Meio-campo): `brasileirao-serie-b-2026.md:504`; Red Bull Bragantino (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:552`, `estaduais-1a-divisao-2026.md:231` — _provável homônimo (nome de uma palavra)_
- **Bruno Alves** — Criciúma (DEF/Zagueiro): `brasileirao-serie-b-2026.md:388`, `estaduais-1a-divisao-2026.md:1734`; Ituano (PE): `brasileirao-serie-c-2026.md:494` — _provável homônimo (defensor e atacante)_
- **Bruno Henrique** — Barra-SC (VOL): `brasileirao-serie-c-2026.md:113`, `estaduais-1a-divisao-2026.md:1817`; Flamengo (ATA/Centroavante): `brasileirao-serie-a-2026.md:344`, `estaduais-1a-divisao-2026.md:620`, `copa-libertadores-2026.md:126`; Internacional (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:440`, `estaduais-1a-divisao-2026.md:1043`, `copa-do-brasil-2026.md:271` — _provável homônimo (nome comum em 3+ clubes)_
- **Cadu** — Confiança (GOL): `brasileirao-serie-c-2026.md:255`; Goiás (ATA/Centroavante): `brasileirao-serie-b-2026.md:549`, `estaduais-1a-divisao-2026.md:2085` — _provável homônimo (goleiro e jogador de linha)_
- **Caio** — Ceará (Meio-campo): `brasileirao-serie-b-2026.md:326`; Londrina (Zagueiro): `brasileirao-serie-b-2026.md:613`, `estaduais-1a-divisao-2026.md:1570` — _provável homônimo (nome de uma palavra)_
- **Caique / Caíque** — Floresta (LE): `brasileirao-serie-c-2026.md:361`, `estaduais-1a-divisao-2026.md:2011`; Velo Clube (DEF): `estaduais-1a-divisao-2026.md:455`; Vila Nova (ATA/Centroavante): `brasileirao-serie-b-2026.md:968`, `estaduais-1a-divisao-2026.md:2118` — _provável homônimo (nome de uma palavra)_
- **Carlão** — Botafogo-SP (Zagueiro): `brasileirao-serie-b-2026.md:253`, `estaduais-1a-divisao-2026.md:551`; Ferroviária (ZAG): `brasileirao-serie-c-2026.md:290`; Noroeste (ATA): `estaduais-1a-divisao-2026.md:540`; Novorizontino (Centroavante): `brasileirao-serie-b-2026.md:738`, `estaduais-1a-divisao-2026.md:286`; Vila Nova (Defensor): `brasileirao-serie-b-2026.md:944` — _provável homônimo (nome de uma palavra)_
- **Carlinhos** — Athletic Club (Centroavante): `brasileirao-serie-b-2026.md:134`, `estaduais-1a-divisao-2026.md:949`; Juventude (Atacante): `brasileirao-serie-b-2026.md:600`; Noroeste (DEF): `estaduais-1a-divisao-2026.md:530`; Novorizontino (Zagueiro): `brasileirao-serie-b-2026.md:704`, `estaduais-1a-divisao-2026.md:252` — _provável homônimo (nome de uma palavra)_
- **Carlos Eduardo** — Criciúma (Atacante): `brasileirao-serie-b-2026.md:421`; Guarani (VOL): `brasileirao-serie-c-2026.md:391`, `estaduais-1a-divisao-2026.md:371`; Mirassol (PD/Ponta Dir.): `brasileirao-serie-a-2026.md:481`, `estaduais-1a-divisao-2026.md:321`, `copa-do-brasil-2026.md:599`, `copa-libertadores-2026.md:278` — _provável homônimo (nome comum em 3+ clubes)_
- **Cassio / Cássio** — América Mineiro (GOL/Goleiro): `brasileirao-serie-b-2026.md:37`, `estaduais-1a-divisao-2026.md:862`; Cruzeiro (GOL/Goleiro): `brasileirao-serie-a-2026.md:283`, `estaduais-1a-divisao-2026.md:828`, `copa-do-brasil-2026.md:320`, `copa-libertadores-2026.md:213` — _provável homônimo (nome de uma palavra)_
- **Caue / Cauê** — Criciúma (ATA/Centroavante): `brasileirao-serie-b-2026.md:419`, `estaduais-1a-divisao-2026.md:1759`; Maranhão (GOL): `brasileirao-serie-c-2026.md:526` — _provável homônimo (goleiro e jogador de linha)_
- **Claudinho** — Inter de Limeira (MEI): `brasileirao-serie-c-2026.md:427`; Sport (DEF/Lateral Dir.): `brasileirao-serie-b-2026.md:894`, `estaduais-1a-divisao-2026.md:1334` — _provável homônimo (nome de uma palavra)_
- **Cleiton** — Itabaiana (MEI): `brasileirao-serie-c-2026.md:463`; Red Bull Bragantino (GOL/Goleiro): `brasileirao-serie-a-2026.md:527`, `estaduais-1a-divisao-2026.md:206`; Ypiranga-RS (LD): `brasileirao-serie-c-2026.md:699`, `estaduais-1a-divisao-2026.md:1149` — _provável homônimo (goleiro e jogador de linha)_
- **Cristiano** — Atlético Goianiense (Meia Central): `brasileirao-serie-b-2026.md:169`, `estaduais-1a-divisao-2026.md:2198`; Avaí (Atacante): `brasileirao-serie-b-2026.md:243`; Noroeste (MEI): `estaduais-1a-divisao-2026.md:538` — _provável homônimo (nome de uma palavra)_
- **Danielzinho** — CRB (Meia Ofensivo): `brasileirao-serie-b-2026.md:363`; Confiança (PE): `brasileirao-serie-c-2026.md:256`; Maringá (MEI): `brasileirao-serie-c-2026.md:562`, `estaduais-1a-divisao-2026.md:1614`; São Paulo (MEI/Meia Central): `brasileirao-serie-a-2026.md:666`, `estaduais-1a-divisao-2026.md:149`; Ypiranga-RS (LD): `brasileirao-serie-c-2026.md:700`, `estaduais-1a-divisao-2026.md:1150` — _provável homônimo (nome de uma palavra)_
- **Danilo** — Botafogo (MEI/Meia Central): `brasileirao-serie-a-2026.md:158`, `estaduais-1a-divisao-2026.md:717`; Flamengo (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:321`, `estaduais-1a-divisao-2026.md:599`, `copa-libertadores-2026.md:104` — _provável homônimo (nome de uma palavra)_
- **Dantas** — Athletico Paranaense (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:41`, `estaduais-1a-divisao-2026.md:1451`, `copa-do-brasil-2026.md:434`; Novorizontino (Defensor): `brasileirao-serie-b-2026.md:715`, `estaduais-1a-divisao-2026.md:263` — _provável homônimo (nome de uma palavra)_
- **David** — Ferroviária (MEI): `brasileirao-serie-c-2026.md:292`; Vasco da Gama (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:710`, `estaduais-1a-divisao-2026.md:686`, `copa-do-brasil-2026.md:171` — _provável homônimo (nome de uma palavra)_
- **Denilson / Denílson** — Ferroviária (PE): `brasileirao-serie-c-2026.md:293`; Itabaiana (PD): `brasileirao-serie-c-2026.md:464`; Mirassol (MC/Meia Central): `brasileirao-serie-a-2026.md:470`, `estaduais-1a-divisao-2026.md:310`, `copa-do-brasil-2026.md:590`, `copa-libertadores-2026.md:267` — _provável homônimo (nome de uma palavra)_
- **Dheimison** — Floresta (GOL): `brasileirao-serie-c-2026.md:364`, `estaduais-1a-divisao-2026.md:2014`; Primavera (GOL): `estaduais-1a-divisao-2026.md:480` — _provável homônimo (nome de uma palavra)_
- **Dodo / Dodô** — Náutico (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:678`, `estaduais-1a-divisao-2026.md:1378`; Vila Nova (ATA/Ponta Esq.): `brasileirao-serie-b-2026.md:962`, `estaduais-1a-divisao-2026.md:2112` — _provável homônimo (nome de uma palavra)_
- **Dudu** — Athletico Paranaense (DEF/Lateral Dir./MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:47`, `brasileirao-serie-a-2026.md:55`, `estaduais-1a-divisao-2026.md:1457`, `estaduais-1a-divisao-2026.md:1465`, `copa-do-brasil-2026.md:448`; Atlético Mineiro (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:96`, `estaduais-1a-divisao-2026.md:818`, `copa-do-brasil-2026.md:382`; Operário-PR (Atacante): `brasileirao-serie-b-2026.md:786`, `estaduais-1a-divisao-2026.md:1684`; Vila Nova (MEI/Volante): `brasileirao-serie-b-2026.md:950`, `estaduais-1a-divisao-2026.md:2105`; Vitória (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:738`, `estaduais-1a-divisao-2026.md:1233`, `copa-do-brasil-2026.md:480`; Ypiranga-RS (MEI): `brasileirao-serie-c-2026.md:702`, `estaduais-1a-divisao-2026.md:1152` — _provável homônimo (nome de uma palavra)_
- **Edilson / Edílson** — Botafogo-PB (GOL): `brasileirao-serie-c-2026.md:152`; Paysandu (LD): `brasileirao-serie-c-2026.md:595` — _provável homônimo (goleiro e jogador de linha)_
- **Edson** — Guarani (ZAG): `brasileirao-serie-c-2026.md:393`, `estaduais-1a-divisao-2026.md:373`; Maranhão (ZAG): `brasileirao-serie-c-2026.md:527` — _provável homônimo (nome de uma palavra)_
- **Eduardo** — Criciúma (MEI/Volante): `brasileirao-serie-b-2026.md:400`, `estaduais-1a-divisao-2026.md:1747`; Floresta (ZAG): `brasileirao-serie-c-2026.md:367`, `estaduais-1a-divisao-2026.md:2017`; Juazeirense (DEF): `estaduais-1a-divisao-2026.md:1278`; Mirassol (MEI/MO/Meia Ofensivo): `brasileirao-serie-a-2026.md:474`, `estaduais-1a-divisao-2026.md:314`, `copa-do-brasil-2026.md:594`, `copa-libertadores-2026.md:271`; Red Bull Bragantino (DEF/Zagueiro): `brasileirao-serie-a-2026.md:536`, `estaduais-1a-divisao-2026.md:215` — _provável homônimo (nome de uma palavra)_
- **Eliel** — Criciúma (Meio-campo): `brasileirao-serie-b-2026.md:411`; Cuiabá (Ponta Esq.): `brasileirao-serie-b-2026.md:457` — _provável homônimo (nome de uma palavra)_
- **Enzo** — Athletic Club (Lateral Esq.): `brasileirao-serie-b-2026.md:96`, `estaduais-1a-divisao-2026.md:911`; Ceará (Atacante): `brasileirao-serie-b-2026.md:334`; Vila Nova (MEI/Volante): `brasileirao-serie-b-2026.md:951`, `estaduais-1a-divisao-2026.md:2107` — _provável homônimo (nome de uma palavra)_
- **Erick** — Bahia (MEI/Volante): `brasileirao-serie-a-2026.md:120`, `estaduais-1a-divisao-2026.md:1196`; Botafogo-PB (LD): `brasileirao-serie-c-2026.md:153`; Sport (Goleiro): `brasileirao-serie-b-2026.md:885`; Vitória (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:750`, `estaduais-1a-divisao-2026.md:1245`, `copa-do-brasil-2026.md:496` — _provável homônimo (goleiro e jogador de linha)_
- **Everaldo** — Bahia (ATA/Centroavante): `brasileirao-serie-a-2026.md:134`, `estaduais-1a-divisao-2026.md:1210`; Santa Cruz (PE): `brasileirao-serie-c-2026.md:632`, `estaduais-1a-divisao-2026.md:1410` — _provável homônimo (nome de uma palavra)_
- **Everton** — Chapecoense (LD/Lateral Dir.): `brasileirao-serie-a-2026.md:188`, `estaduais-1a-divisao-2026.md:1868`, `copa-do-brasil-2026.md:664`; Flamengo (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:339`, `estaduais-1a-divisao-2026.md:615`, `copa-libertadores-2026.md:121` — _provável homônimo (nome de uma palavra)_
- **Ezequiel** — Amazonas (ATA): `brasileirao-serie-c-2026.md:41`; Figueirense (LD): `brasileirao-serie-c-2026.md:326`, `estaduais-1a-divisao-2026.md:1900` — _provável homônimo (nome de uma palavra)_
- **Fabiano** — Londrina (Volante): `brasileirao-serie-b-2026.md:626`, `estaduais-1a-divisao-2026.md:1583`; Vitória (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:733`, `estaduais-1a-divisao-2026.md:1228`, `copa-do-brasil-2026.md:476` — _provável homônimo (nome de uma palavra)_
- **Fabinho** — Amazonas (MC): `brasileirao-serie-c-2026.md:42`; Coritiba (ATA/Ponta Dir.): `brasileirao-serie-a-2026.md:274`, `estaduais-1a-divisao-2026.md:1507`; Red Bull Bragantino (MEI/Volante): `brasileirao-serie-a-2026.md:543`, `estaduais-1a-divisao-2026.md:222`; Santa Cruz (VOL): `brasileirao-serie-c-2026.md:633`, `estaduais-1a-divisao-2026.md:1411` — _provável homônimo (nome de uma palavra)_
- **Fabio / Fábio** — América Mineiro (DEF/Lateral Dir.): `brasileirao-serie-b-2026.md:52`, `estaduais-1a-divisao-2026.md:878`; Fluminense (GOL/Goleiro): `brasileirao-serie-a-2026.md:349`, `estaduais-1a-divisao-2026.md:626`, `copa-do-brasil-2026.md:111`, `copa-libertadores-2026.md:294` — _provável homônimo (goleiro e jogador de linha)_
- **Fabricio / Fabrício** — Criciúma (Meio-campo): `brasileirao-serie-b-2026.md:410`; Figueirense (GOL): `brasileirao-serie-c-2026.md:327`, `estaduais-1a-divisao-2026.md:1901`; Londrina (Ponta Esq.): `brasileirao-serie-b-2026.md:636`, `estaduais-1a-divisao-2026.md:1593`; Red Bull Bragantino (GOL/Goleiro): `brasileirao-serie-a-2026.md:529`, `estaduais-1a-divisao-2026.md:208`; Volta Redonda (ZAG): `brasileirao-serie-c-2026.md:666`, `estaduais-1a-divisao-2026.md:760` — _provável homônimo (goleiro e jogador de linha)_
- **Felipinho** — Athletico Paranaense (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:52`, `estaduais-1a-divisao-2026.md:1462`, `copa-do-brasil-2026.md:441`; Sport (DEF/Lateral Esq.): `brasileirao-serie-b-2026.md:891`, `estaduais-1a-divisao-2026.md:1332` — _provável homônimo (nome de uma palavra)_
- **Fernandinho** — Anápolis (PE): `brasileirao-serie-c-2026.md:73`, `estaduais-1a-divisao-2026.md:2129`; Ferroviária (VOL): `brasileirao-serie-c-2026.md:299`; Mirassol (PE/Ponta Esq.): `brasileirao-serie-a-2026.md:477`, `estaduais-1a-divisao-2026.md:317`, `copa-do-brasil-2026.md:595`, `copa-libertadores-2026.md:274`; Sport (Atacante): `brasileirao-serie-b-2026.md:926` — _provável homônimo (nome de uma palavra)_
- **Fernando** — Ceará (DEF/Lateral Esq.): `brasileirao-serie-b-2026.md:305`, `estaduais-1a-divisao-2026.md:1944`; Red Bull Bragantino (ATA/Centroavante): `brasileirao-serie-a-2026.md:562`, `estaduais-1a-divisao-2026.md:241` — _provável homônimo (nome de uma palavra)_
- **Gabriel** — Ceará (Meio-campo): `brasileirao-serie-b-2026.md:324`; Mirassol (Zagueiro): `brasileirao-serie-a-2026.md:460`, `estaduais-1a-divisao-2026.md:300`; Ponte Preta (Defensor): `brasileirao-serie-b-2026.md:814`, `estaduais-1a-divisao-2026.md:423`; Red Bull Bragantino (MEI/Volante): `brasileirao-serie-a-2026.md:545`, `estaduais-1a-divisao-2026.md:224`; Vitória (GOL/Goleiro): `brasileirao-serie-a-2026.md:720`, `estaduais-1a-divisao-2026.md:1215`, `copa-do-brasil-2026.md:463` — _provável homônimo (goleiro e jogador de linha)_
- **Gabriel Batista** — Anápolis (MEI): `brasileirao-serie-c-2026.md:75`, `estaduais-1a-divisao-2026.md:2131`; Botafogo (GOL/Goleiro): `brasileirao-serie-a-2026.md:137`, `estaduais-1a-divisao-2026.md:696` — _provável homônimo (goleiro e jogador de linha)_
- **Gabriel Dias** — Atlético Goianiense (Atacante): `brasileirao-serie-b-2026.md:196`, `estaduais-1a-divisao-2026.md:2225`; Inter de Limeira (LD): `brasileirao-serie-c-2026.md:432`; Vila Nova (Meio-campo): `brasileirao-serie-b-2026.md:957` — _provável homônimo (defensor e atacante)_
- **Gabriel Souza** — Maringá (LD): `brasileirao-serie-c-2026.md:566`, `estaduais-1a-divisao-2026.md:1618`; Santa Cruz (GOL): `brasileirao-serie-c-2026.md:635`, `estaduais-1a-divisao-2026.md:1413` — _provável homônimo (goleiro e jogador de linha)_
- **Geovane** — Atlético Goianiense (Volante): `brasileirao-serie-b-2026.md:166`, `estaduais-1a-divisao-2026.md:2195`; CRB (Meia Central): `brasileirao-serie-b-2026.md:361` — _provável homônimo (nome de uma palavra)_
- **Gilberto** — Athletico Paranaense (DEF/Lateral Dir.): `brasileirao-serie-a-2026.md:45`, `estaduais-1a-divisao-2026.md:1455`; Londrina (Centroavante): `brasileirao-serie-b-2026.md:644`, `estaduais-1a-divisao-2026.md:1601` — _provável homônimo (nome de uma palavra)_
- **Guga** — Amazonas (MEI): `brasileirao-serie-c-2026.md:44`; Brusque (PE): `brasileirao-serie-c-2026.md:193`, `estaduais-1a-divisao-2026.md:1776`; Fluminense (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:359`, `estaduais-1a-divisao-2026.md:636`, `copa-do-brasil-2026.md:124`, `copa-libertadores-2026.md:305` — _provável homônimo (nome de uma palavra)_
- **Guilherme** — Atlético Goianiense (Meia Ofensivo): `brasileirao-serie-b-2026.md:172`, `estaduais-1a-divisao-2026.md:2201`; Fortaleza (Defensor): `brasileirao-serie-b-2026.md:490` — _provável homônimo (nome de uma palavra)_
- **Guilherme Nunes** — Confiança (VOL): `brasileirao-serie-c-2026.md:260`; Volta Redonda (GOL): `brasileirao-serie-c-2026.md:670`, `estaduais-1a-divisao-2026.md:764` — _provável homônimo (goleiro e jogador de linha)_
- **Gustavinho** — Athletic Club (Meia Ofensivo): `brasileirao-serie-b-2026.md:115`, `estaduais-1a-divisao-2026.md:930`; Floresta (PD): `brasileirao-serie-c-2026.md:371`, `estaduais-1a-divisao-2026.md:2021`; Santos (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:621`, `estaduais-1a-divisao-2026.md:186`, `copa-do-brasil-2026.md:406` — _provável homônimo (nome de uma palavra)_
- **Gustavo** — América Mineiro (GOL/Goleiro): `brasileirao-serie-b-2026.md:35`, `estaduais-1a-divisao-2026.md:861`; Botafogo-PB (MC): `brasileirao-serie-c-2026.md:157`; Coritiba (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:267`, `estaduais-1a-divisao-2026.md:1500` — _provável homônimo (goleiro e jogador de linha)_
- **Gustavo Henrique** — Anápolis (PE): `brasileirao-serie-c-2026.md:80`, `estaduais-1a-divisao-2026.md:2136`; Corinthians (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:217`, `estaduais-1a-divisao-2026.md:92`, `copa-do-brasil-2026.md:188`, `copa-libertadores-2026.md:139`; Náutico (DEF/Zagueiro): `brasileirao-serie-b-2026.md:659`, `estaduais-1a-divisao-2026.md:1364`; Portuguesa (DEF): `estaduais-1a-divisao-2026.md:468` — _provável homônimo (defensor e atacante)_
- **Gustavo Martins** — Ceará (Goleiro): `brasileirao-serie-b-2026.md:296`; Grêmio (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:386`, `estaduais-1a-divisao-2026.md:988`, `copa-do-brasil-2026.md:293` — _provável homônimo (goleiro e jogador de linha)_
- **Henrique** — Operário-PR (Meio-campo): `brasileirao-serie-b-2026.md:773`, `estaduais-1a-divisao-2026.md:1671`; Ypiranga-RS (PE): `brasileirao-serie-c-2026.md:708`, `estaduais-1a-divisao-2026.md:1158` — _provável homônimo (nome de uma palavra)_
- **Hugo** — Botafogo-SP (Atacante): `brasileirao-serie-b-2026.md:290`, `estaduais-1a-divisao-2026.md:588`; Corinthians (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:221`, `estaduais-1a-divisao-2026.md:96`, `copa-do-brasil-2026.md:192`, `copa-libertadores-2026.md:143` — _provável homônimo (nome de uma palavra)_
- **Hygor** — Botafogo-SP (Centroavante): `brasileirao-serie-b-2026.md:284`, `estaduais-1a-divisao-2026.md:582`; Goiás (Meio-campo): `brasileirao-serie-b-2026.md:541` — _provável homônimo (nome de uma palavra)_
- **Iago** — Bahia (DEF/Lateral Esq.): `brasileirao-serie-a-2026.md:115`, `estaduais-1a-divisao-2026.md:1191`; Confiança (PD): `brasileirao-serie-c-2026.md:262` — _provável homônimo (nome de uma palavra)_
- **Indio / Índio** — Atlético Goianiense (Meio-campo): `brasileirao-serie-b-2026.md:176`, `estaduais-1a-divisao-2026.md:2205`; Atlético Mineiro (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:91`, `estaduais-1a-divisao-2026.md:813`, `copa-do-brasil-2026.md:375`; Náutico (DEF/Zagueiro): `brasileirao-serie-b-2026.md:660`, `estaduais-1a-divisao-2026.md:1362`; Operário-PR (Volante): `brasileirao-serie-b-2026.md:763`, `estaduais-1a-divisao-2026.md:1661` — _provável homônimo (nome de uma palavra)_
- **Isaac** — Athletico Paranaense (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:58`, `estaduais-1a-divisao-2026.md:1468`, `copa-do-brasil-2026.md:449`; Atlético Goianiense (Defensor): `brasileirao-serie-b-2026.md:162`, `estaduais-1a-divisao-2026.md:2191` — _provável homônimo (nome de uma palavra)_
- **Isaque** — Guarani (MEI): `brasileirao-serie-c-2026.md:400`, `estaduais-1a-divisao-2026.md:380`; Itabaiana (LD): `brasileirao-serie-c-2026.md:473` — _provável homônimo (nome de uma palavra)_
- **Islan** — Floresta (ZAG): `brasileirao-serie-c-2026.md:372`, `estaduais-1a-divisao-2026.md:2022`; Velo Clube (DEF): `estaduais-1a-divisao-2026.md:454` — _provável homônimo (nome de uma palavra)_
- **Jadson / Jádson** — Athletico Paranaense (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:53`, `estaduais-1a-divisao-2026.md:1463`, `copa-do-brasil-2026.md:443`; Cuiabá (Ponta Dir.): `brasileirao-serie-b-2026.md:463` — _provável homônimo (nome de uma palavra)_
- **Jamerson** — Avaí (MEI/Volante): `brasileirao-serie-b-2026.md:221`, `estaduais-1a-divisao-2026.md:1712`; Vitória (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:731`, `estaduais-1a-divisao-2026.md:1226`, `copa-do-brasil-2026.md:474` — _provável homônimo (nome de uma palavra)_
- **Janderson** — Ceará (Defensor): `brasileirao-serie-b-2026.md:313`; Vila Nova (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:965`, `estaduais-1a-divisao-2026.md:2113` — _provável homônimo (nome de uma palavra)_
- **Jean** — Cuiabá (Goleiro): `brasileirao-serie-b-2026.md:424`; Maranhão (GOL): `brasileirao-serie-c-2026.md:531` — _provável homônimo (nome de uma palavra)_
- **Jefferson** — Avaí (DEF/Zagueiro): `brasileirao-serie-b-2026.md:210`, `estaduais-1a-divisao-2026.md:1701`; Itabaiana (GOL): `brasileirao-serie-c-2026.md:474` — _provável homônimo (goleiro e jogador de linha)_
- **Joao Carlos / João Carlos** — Criciúma (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:416`, `estaduais-1a-divisao-2026.md:1758`; Cuiabá (Goleiro): `brasileirao-serie-b-2026.md:425` — _provável homônimo (goleiro e jogador de linha)_
- **Joao Gabriel / João Gabriel** — Ceará (MEI/Volante): `brasileirao-serie-b-2026.md:316`, `estaduais-1a-divisao-2026.md:1951`; Operário-PR (Lateral Dir.): `brasileirao-serie-b-2026.md:758`, `estaduais-1a-divisao-2026.md:1656`; Ponte Preta (Defensor): `brasileirao-serie-b-2026.md:815`, `estaduais-1a-divisao-2026.md:424` — _provável homônimo (nome comum em 3+ clubes)_
- **João Lucas** — Caxias (PD): `brasileirao-serie-c-2026.md:229`, `estaduais-1a-divisao-2026.md:1105`; Fortaleza (Defensor): `brasileirao-serie-b-2026.md:492`; Remo (LD/Lateral Dir.): `brasileirao-serie-a-2026.md:580`, `copa-do-brasil-2026.md:626` — _provável homônimo (defensor e atacante)_
- **Joao Paulo / João Paulo** — Chapecoense (ZAG/Zagueiro): `brasileirao-serie-a-2026.md:178`, `estaduais-1a-divisao-2026.md:1858`, `copa-do-brasil-2026.md:653`; Guarani (MEI): `brasileirao-serie-c-2026.md:401`, `estaduais-1a-divisao-2026.md:381`; Santos (GOL/Goleiro): `brasileirao-serie-a-2026.md:604`, `estaduais-1a-divisao-2026.md:169`, `copa-do-brasil-2026.md:391` — _provável homônimo (goleiro e jogador de linha)_
- **Joao Pedro / João Pedro** — Brusque (PE): `brasileirao-serie-c-2026.md:198`, `estaduais-1a-divisao-2026.md:1781`; Confiança (PD): `brasileirao-serie-c-2026.md:266`; Grêmio (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:396`, `estaduais-1a-divisao-2026.md:998`, `copa-do-brasil-2026.md:299`; São Bernardo (Defensor): `brasileirao-serie-b-2026.md:855`, `estaduais-1a-divisao-2026.md:343`; São Paulo (GOL/Goleiro): `brasileirao-serie-a-2026.md:643`, `estaduais-1a-divisao-2026.md:126`; Vila Nova (Atacante): `brasileirao-serie-b-2026.md:972` — _provável homônimo (goleiro e jogador de linha)_
- **João Victor** — Cuiabá (Defensor): `brasileirao-serie-b-2026.md:439`; Flamengo (ZAG/Zagueiro): `brasileirao-serie-a-2026.md:322`, `copa-libertadores-2026.md:105`; Floresta (ZAG): `brasileirao-serie-c-2026.md:377`, `estaduais-1a-divisao-2026.md:2027`; Inter de Limeira (LE): `brasileirao-serie-c-2026.md:435`; Mirassol (ZAG/Zagueiro): `brasileirao-serie-a-2026.md:458`, `estaduais-1a-divisao-2026.md:298`, `copa-do-brasil-2026.md:578`, `copa-libertadores-2026.md:255`; Operário-PR (Atacante): `brasileirao-serie-b-2026.md:788`, `estaduais-1a-divisao-2026.md:1686`; Primavera (DEF): `estaduais-1a-divisao-2026.md:489` — _provável homônimo (defensor e atacante)_
- **João Vitor / João Vítor** — Anápolis (ATA): `brasileirao-serie-c-2026.md:84`, `estaduais-1a-divisao-2026.md:2140`; Athletic Club (Defensor): `brasileirao-serie-b-2026.md:103`, `estaduais-1a-divisao-2026.md:918`; Cuiabá (Meio-campo): `brasileirao-serie-b-2026.md:456`; Londrina (Meia Central): `brasileirao-serie-b-2026.md:631`, `estaduais-1a-divisao-2026.md:1588` — _provável homônimo (defensor e atacante)_
- **Joaquim** — Avaí (Goleiro): `brasileirao-serie-b-2026.md:206`; Juventude (Goleiro): `brasileirao-serie-b-2026.md:557` — _provável homônimo (nome de uma palavra)_
- **Jonathan** — Botafogo-SP (Lateral Dir.): `brasileirao-serie-b-2026.md:259`, `estaduais-1a-divisao-2026.md:557`; Inter de Limeira (GOL): `brasileirao-serie-c-2026.md:436`; Maringá (ZAG): `brasileirao-serie-c-2026.md:571`, `estaduais-1a-divisao-2026.md:1623` — _provável homônimo (goleiro e jogador de linha)_
- **Jorginho** — Figueirense (MEI): `brasileirao-serie-c-2026.md:339`, `estaduais-1a-divisao-2026.md:1913`; Flamengo (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:330`, `estaduais-1a-divisao-2026.md:607`, `copa-libertadores-2026.md:113` — _provável homônimo (nome de uma palavra)_
- **Jota** — Athletic Club (Meia Central): `brasileirao-serie-b-2026.md:111`, `estaduais-1a-divisao-2026.md:926`; São Bernardo (Lateral Esq.): `brasileirao-serie-b-2026.md:851`, `estaduais-1a-divisao-2026.md:339` — _provável homônimo (nome de uma palavra)_
- **Juninho** — Anápolis (MC): `brasileirao-serie-c-2026.md:86`, `estaduais-1a-divisao-2026.md:2142`; Goiás (MEI/Volante): `brasileirao-serie-b-2026.md:532`, `estaduais-1a-divisao-2026.md:2073`; Internacional (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:426`, `estaduais-1a-divisao-2026.md:1029`, `copa-do-brasil-2026.md:258`; Londrina (Ponta Esq.): `brasileirao-serie-b-2026.md:638`, `estaduais-1a-divisao-2026.md:1595`; Novorizontino (Meia Ofensivo): `brasileirao-serie-b-2026.md:727`, `estaduais-1a-divisao-2026.md:275`; Náutico (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:681`, `estaduais-1a-divisao-2026.md:1380`; Paysandu (ATA): `brasileirao-serie-c-2026.md:603`; Volta Redonda (VOL): `brasileirao-serie-c-2026.md:676`, `estaduais-1a-divisao-2026.md:770` — _provável homônimo (nome de uma palavra)_
- **Kaua / Kauã** — CRB (Atacante): `brasileirao-serie-b-2026.md:379`; Ceará (ATA/Centroavante): `brasileirao-serie-b-2026.md:332`, `estaduais-1a-divisao-2026.md:1964`; Juventude (Defensor): `brasileirao-serie-b-2026.md:574`; Vila Nova (Goleiro): `brasileirao-serie-b-2026.md:932` — _provável homônimo (goleiro e jogador de linha)_
- **Kauan** — Anápolis (ZAG): `brasileirao-serie-c-2026.md:88`, `estaduais-1a-divisao-2026.md:2144`; Internacional (GOL/Goleiro): `brasileirao-serie-a-2026.md:421`, `estaduais-1a-divisao-2026.md:1024`, `copa-do-brasil-2026.md:252` — _provável homônimo (goleiro e jogador de linha)_
- **Kaue / Kauê** — Corinthians (GOL/Goleiro): `brasileirao-serie-a-2026.md:214`, `estaduais-1a-divisao-2026.md:89`, `copa-do-brasil-2026.md:184`, `copa-libertadores-2026.md:136`; Juventude (Defensor): `brasileirao-serie-b-2026.md:570` — _provável homônimo (goleiro e jogador de linha)_
- **Keven** — Maranhão (ZAG): `brasileirao-serie-c-2026.md:535`; Maringá (ZAG): `brasileirao-serie-c-2026.md:573`, `estaduais-1a-divisao-2026.md:1625` — _provável homônimo (nome de uma palavra)_
- **Kevin** — Avaí (Meio-campo): `brasileirao-serie-b-2026.md:233`; CRB (Lateral Dir.): `brasileirao-serie-b-2026.md:348`; Primavera (DEF): `estaduais-1a-divisao-2026.md:488` — _provável homônimo (nome de uma palavra)_
- **Kevyn** — Londrina (Lateral Esq.): `brasileirao-serie-b-2026.md:616`, `estaduais-1a-divisao-2026.md:1573`; Náutico (Atacante): `brasileirao-serie-b-2026.md:693` — _provável homônimo (nome de uma palavra)_
- **Léo** — Athletico Paranaense (ZAG/Zagueiro): `brasileirao-serie-a-2026.md:40`, `copa-do-brasil-2026.md:430`; Atlético Goianiense (Goleiro): `brasileirao-serie-b-2026.md:144`, `estaduais-1a-divisao-2026.md:2173`; Náutico (Goleiro): `brasileirao-serie-b-2026.md:655` — _provável homônimo (goleiro e jogador de linha)_
- **Leonan** — Anápolis (LE): `brasileirao-serie-c-2026.md:90`, `estaduais-1a-divisao-2026.md:2146`; Capivariano (DEF): `estaduais-1a-divisao-2026.md:517` — _provável homônimo (nome de uma palavra)_
- **Leonardo** — Avaí (Goleiro): `brasileirao-serie-b-2026.md:204`; Brusque (MC): `brasileirao-serie-c-2026.md:203`, `estaduais-1a-divisao-2026.md:1786` — _provável homônimo (goleiro e jogador de linha)_
- **Leotm** — Athletico Paranaense (DEF): `estaduais-1a-divisao-2026.md:1450`; Náutico (GOL): `estaduais-1a-divisao-2026.md:1358` — _provável homônimo (goleiro e jogador de linha)_
- **Ligger** — Itabaiana (ZAG): `brasileirao-serie-c-2026.md:478`; Primavera (DEF): `estaduais-1a-divisao-2026.md:485` — _provável homônimo (nome de uma palavra)_
- **Lorran** — Confiança (VOL): `brasileirao-serie-c-2026.md:268`; Flamengo (MEI/MO/Meia Ofensivo): `brasileirao-serie-a-2026.md:336`, `estaduais-1a-divisao-2026.md:613`, `copa-libertadores-2026.md:119` — _provável homônimo (nome de uma palavra)_
- **Luan** — Juazeirense (MEI): `estaduais-1a-divisao-2026.md:1287`; São Paulo (MEI/Volante): `brasileirao-serie-a-2026.md:662`, `estaduais-1a-divisao-2026.md:145` — _provável homônimo (nome de uma palavra)_
- **Lucão** — Itabaiana (ZAG): `brasileirao-serie-c-2026.md:480`; Maranhão (ZAG): `brasileirao-serie-c-2026.md:536` — _provável homônimo (nome de uma palavra)_
- **Lucas Villalba** — Botafogo (ATA/Ponta Dir.): `brasileirao-serie-a-2026.md:167`, `estaduais-1a-divisao-2026.md:726`; Cruzeiro (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:287`, `estaduais-1a-divisao-2026.md:832`, `copa-do-brasil-2026.md:324`, `copa-libertadores-2026.md:217` — _provável homônimo (defensor e atacante)_
- **Lucca** — Ceará (ATA/Centroavante): `brasileirao-serie-b-2026.md:333`, `estaduais-1a-divisao-2026.md:1963`; Guarani (PE): `brasileirao-serie-c-2026.md:406`, `estaduais-1a-divisao-2026.md:386`; São Paulo (ATA/Ponta Esq.): `brasileirao-serie-a-2026.md:671`, `estaduais-1a-divisao-2026.md:154` — _provável homônimo (nome de uma palavra)_
- **Luisao / Luisão** — Cuiabá (Defensor): `brasileirao-serie-b-2026.md:441`; Goiás (DEF/Zagueiro): `brasileirao-serie-b-2026.md:524`, `estaduais-1a-divisao-2026.md:2062` — _provável homônimo (nome de uma palavra)_
- **Luiz Felipe** — Anápolis (MC): `brasileirao-serie-c-2026.md:93`, `estaduais-1a-divisao-2026.md:2149`; Goiás (DEF/Zagueiro): `brasileirao-serie-b-2026.md:521`, `estaduais-1a-divisao-2026.md:2064`; Náutico (DEF/Lateral Dir.): `brasileirao-serie-b-2026.md:667`, `estaduais-1a-divisao-2026.md:1370` — _provável homônimo (nome comum em 3+ clubes)_
- **Luizao / Luizão** — Botafogo-SP (Centroavante): `brasileirao-serie-b-2026.md:286`, `estaduais-1a-divisao-2026.md:584`; CRB (Volante): `brasileirao-serie-b-2026.md:359`; Ceará (DEF/Zagueiro): `brasileirao-serie-b-2026.md:298`, `estaduais-1a-divisao-2026.md:1938`; São Bernardo (Zagueiro): `brasileirao-serie-b-2026.md:848`, `estaduais-1a-divisao-2026.md:336` — _provável homônimo (nome de uma palavra)_
- **Mancha** — Caxias (ZAG): `brasileirao-serie-c-2026.md:235`, `estaduais-1a-divisao-2026.md:1111`; Chapecoense (LE/Lateral Esq.): `brasileirao-serie-a-2026.md:184`, `estaduais-1a-divisao-2026.md:1864`, `copa-do-brasil-2026.md:659` — _provável homônimo (nome de uma palavra)_
- **Manoel** — América Mineiro (DEF/Zagueiro): `brasileirao-serie-b-2026.md:43`, `estaduais-1a-divisao-2026.md:870`; Itabaiana (LE): `brasileirao-serie-c-2026.md:482` — _provável homônimo (nome de uma palavra)_
- **Maranhão** — Guarani (ATA): `brasileirao-serie-c-2026.md:407`, `estaduais-1a-divisao-2026.md:387`; Náutico (Atacante): `brasileirao-serie-b-2026.md:696` — _provável homônimo (nome de uma palavra)_
- **Marcão** — Atlético Goianiense (Zagueiro): `brasileirao-serie-b-2026.md:152`, `estaduais-1a-divisao-2026.md:2181`; Paysandu (GOL): `brasileirao-serie-c-2026.md:612`; São Bernardo (Volante): `brasileirao-serie-b-2026.md:860`, `estaduais-1a-divisao-2026.md:348` — _provável homônimo (goleiro e jogador de linha)_
- **Marcelinho** — Barra-SC (PE): `brasileirao-serie-c-2026.md:129`, `estaduais-1a-divisao-2026.md:1833`; Remo (LD/Lateral Dir.): `brasileirao-serie-a-2026.md:582`, `copa-do-brasil-2026.md:625`; Ypiranga-RS (PE): `brasileirao-serie-c-2026.md:715`, `estaduais-1a-divisao-2026.md:1165` — _provável homônimo (nome de uma palavra)_
- **Marcelo** — Confiança (LE): `brasileirao-serie-c-2026.md:272`; Velo Clube (DEF): `estaduais-1a-divisao-2026.md:453` — _provável homônimo (nome de uma palavra)_
- **Marcinho** — Chapecoense (PD/Ponta Dir.): `brasileirao-serie-a-2026.md:203`, `estaduais-1a-divisao-2026.md:1883`, `copa-do-brasil-2026.md:678`; Criciúma (DEF/Lateral Dir.): `brasileirao-serie-b-2026.md:395`, `estaduais-1a-divisao-2026.md:1744` — _provável homônimo (nome de uma palavra)_
- **Marco Antônio** — Botafogo-SP (Volante): `brasileirao-serie-b-2026.md:268`, `estaduais-1a-divisao-2026.md:566`; Floresta (ZAG): `brasileirao-serie-c-2026.md:378`, `estaduais-1a-divisao-2026.md:2028`; Inter de Limeira (MEI): `brasileirao-serie-c-2026.md:442` — _provável homônimo (nome comum em 3+ clubes)_
- **Marcos Paulo** — Confiança (GOL): `brasileirao-serie-c-2026.md:273`; Juventude (ATA/DEF/PE/Ponta Esq./ZAG/Zagueiro): `brasileirao-serie-b-2026.md:562`, `brasileirao-serie-b-2026.md:593`, `estaduais-1a-divisao-2026.md:1062`, `estaduais-1a-divisao-2026.md:1081`, `copa-do-brasil-2026.md:543`, `copa-do-brasil-2026.md:561` — _provável homônimo (goleiro e jogador de linha)_
- **Marlon** — Cuiabá (Lateral Esq.): `brasileirao-serie-b-2026.md:434`; Grêmio (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:392`, `estaduais-1a-divisao-2026.md:994`, `copa-do-brasil-2026.md:295`; Juazeirense (ATA): `estaduais-1a-divisao-2026.md:1292`; Novorizontino (Volante): `brasileirao-serie-b-2026.md:721`, `estaduais-1a-divisao-2026.md:269`; Sport (ATA/Ponta Esq.): `brasileirao-serie-b-2026.md:914`, `estaduais-1a-divisao-2026.md:1347` — _provável homônimo (nome de uma palavra)_
- **Marquinhos** — Cruzeiro (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:308`, `estaduais-1a-divisao-2026.md:853`, `copa-do-brasil-2026.md:345`, `copa-libertadores-2026.md:238`; Santa Cruz (ATA): `brasileirao-serie-c-2026.md:638`, `estaduais-1a-divisao-2026.md:1416`; Volta Redonda (PE): `brasileirao-serie-c-2026.md:681`, `estaduais-1a-divisao-2026.md:775` — _provável homônimo (nome de uma palavra)_
- **Matheusinho** — Ceará (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:323`, `estaduais-1a-divisao-2026.md:1955`; Floresta (PD): `brasileirao-serie-c-2026.md:380`, `estaduais-1a-divisao-2026.md:2030` — _provável homônimo (nome de uma palavra)_
- **Matheuzinho** — Barra-SC (PD): `brasileirao-serie-c-2026.md:131`, `estaduais-1a-divisao-2026.md:1835`; Corinthians (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:223`, `estaduais-1a-divisao-2026.md:98`, `copa-do-brasil-2026.md:193`, `copa-libertadores-2026.md:145`; Vitória (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:743`, `estaduais-1a-divisao-2026.md:1238`, `copa-do-brasil-2026.md:487` — _provável homônimo (nome de uma palavra)_
- **Mauricio / Maurício** — Caxias (ZAG): `brasileirao-serie-c-2026.md:240`, `estaduais-1a-divisao-2026.md:1116`; Palmeiras (MEI/MO/Meia Ofensivo): `brasileirao-serie-a-2026.md:514`, `estaduais-1a-divisao-2026.md:72`, `copa-do-brasil-2026.md:237`, `copa-libertadores-2026.md:194` — _provável homônimo (nome de uma palavra)_
- **Max** — Athletic Club (Ponta Dir.): `brasileirao-serie-b-2026.md:127`, `estaduais-1a-divisao-2026.md:942`; Chapecoense (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:196`, `estaduais-1a-divisao-2026.md:1876`, `copa-do-brasil-2026.md:672` — _provável homônimo (nome de uma palavra)_
- **Maycon** — Atlético Mineiro (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:89`, `estaduais-1a-divisao-2026.md:811`, `copa-do-brasil-2026.md:372`; CRB (Defensor): `brasileirao-serie-b-2026.md:353`; Noroeste (DEF): `estaduais-1a-divisao-2026.md:531` — _provável homônimo (nome de uma palavra)_
- **Miguel** — Operário-PR (Defensor): `brasileirao-serie-b-2026.md:762`, `estaduais-1a-divisao-2026.md:1660`; Ponte Preta (Meio-campo): `brasileirao-serie-b-2026.md:823`, `estaduais-1a-divisao-2026.md:432`; Vila Nova (Meio-campo): `brasileirao-serie-b-2026.md:960` — _provável homônimo (nome de uma palavra)_
- **Moises / Moisés** — Confiança (VOL): `brasileirao-serie-c-2026.md:277`; Santos (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:630`, `estaduais-1a-divisao-2026.md:195`, `copa-do-brasil-2026.md:414` — _provável homônimo (nome de uma palavra)_
- **Murilo** — Juazeirense (DEF): `estaduais-1a-divisao-2026.md:1276`; Palmeiras (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:498`, `estaduais-1a-divisao-2026.md:56`, `copa-do-brasil-2026.md:222`, `copa-libertadores-2026.md:178`; Ponte Preta (Volante): `brasileirao-serie-b-2026.md:819`, `estaduais-1a-divisao-2026.md:428` — _provável homônimo (nome de uma palavra)_
- **Nathan** — Atlético Goianiense (Atacante): `brasileirao-serie-b-2026.md:199`, `estaduais-1a-divisao-2026.md:2228`; Juventude (DEF/LD/Lateral Dir.): `brasileirao-serie-b-2026.md:569`, `estaduais-1a-divisao-2026.md:1069`, `copa-do-brasil-2026.md:551` — _provável homônimo (nome de uma palavra)_
- **Neto** — Maringá (GOL): `brasileirao-serie-c-2026.md:575`, `estaduais-1a-divisao-2026.md:1627`; Primavera (ATA): `estaduais-1a-divisao-2026.md:509` — _provável homônimo (goleiro e jogador de linha)_
- **Nicolas** — Barra-SC (ATA): `brasileirao-serie-c-2026.md:133`, `estaduais-1a-divisao-2026.md:1837`; Criciúma (ATA/Centroavante): `brasileirao-serie-b-2026.md:417`, `estaduais-1a-divisao-2026.md:1762`; Goiás (DEF/Lateral Esq.): `brasileirao-serie-b-2026.md:525`, `estaduais-1a-divisao-2026.md:2065`; São Paulo (DEF/Lateral Esq.): `brasileirao-serie-a-2026.md:653`, `estaduais-1a-divisao-2026.md:136` — _provável homônimo (nome de uma palavra)_
- **Nonato** — Floresta (VOL): `brasileirao-serie-c-2026.md:381`, `estaduais-1a-divisao-2026.md:2031`; Fluminense (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:365`, `estaduais-1a-divisao-2026.md:642`, `copa-do-brasil-2026.md:128`, `copa-libertadores-2026.md:311` — _provável homônimo (nome de uma palavra)_
- **Octávio** — Botafogo-PB (ZAG): `brasileirao-serie-c-2026.md:173`; Capivariano (DEF): `estaduais-1a-divisao-2026.md:516` — _provável homônimo (nome de uma palavra)_
- **Otavio / Otávio** — Avaí (GOL/Goleiro): `brasileirao-serie-b-2026.md:203`, `estaduais-1a-divisao-2026.md:1699`; Cuiabá (Meio-campo): `brasileirao-serie-b-2026.md:455`; Fluminense (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:363`, `estaduais-1a-divisao-2026.md:640`, `copa-do-brasil-2026.md:127`, `copa-libertadores-2026.md:309` — _provável homônimo (goleiro e jogador de linha)_
- **Pablo** — CRB (Goleiro): `brasileirao-serie-b-2026.md:341`; Figueirense (PE): `brasileirao-serie-c-2026.md:346`, `estaduais-1a-divisao-2026.md:1920`; Operário-PR (Centroavante): `brasileirao-serie-b-2026.md:783`, `estaduais-1a-divisao-2026.md:1681`; Paysandu (MEI): `brasileirao-serie-c-2026.md:615`; Vasco da Gama (GOL/Goleiro): `brasileirao-serie-a-2026.md:686`, `estaduais-1a-divisao-2026.md:662`, `copa-do-brasil-2026.md:148` — _provável homônimo (goleiro e jogador de linha)_
- **Patrick** — Anápolis (MEI): `brasileirao-serie-c-2026.md:97`, `estaduais-1a-divisao-2026.md:2153`; Atlético Mineiro (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:86`, `estaduais-1a-divisao-2026.md:808`, `copa-do-brasil-2026.md:370`; Novorizontino (Zagueiro): `brasileirao-serie-b-2026.md:705`, `estaduais-1a-divisao-2026.md:253`; Remo (MC/Meia Central): `brasileirao-serie-a-2026.md:589`, `copa-do-brasil-2026.md:633`; Sport (DEF/Zagueiro): `brasileirao-serie-b-2026.md:889`, `estaduais-1a-divisao-2026.md:1331` — _provável homônimo (nome de uma palavra)_
- **Paulinho** — América Mineiro (Defensor): `brasileirao-serie-b-2026.md:54`; Botafogo (DEF/Lateral Esq.): `brasileirao-serie-a-2026.md:149`, `estaduais-1a-divisao-2026.md:708`; Fortaleza (DEF/LD/Lateral Dir.): `brasileirao-serie-b-2026.md:489`, `estaduais-1a-divisao-2026.md:1980`, `copa-do-brasil-2026.md:513`; Maringá (VOL): `brasileirao-serie-c-2026.md:576`, `estaduais-1a-divisao-2026.md:1628`; Palmeiras (ATA/SA/Seg. Atacante): `brasileirao-serie-a-2026.md:521`, `estaduais-1a-divisao-2026.md:79`, `copa-do-brasil-2026.md:243`, `copa-libertadores-2026.md:201`; Primavera (MEI): `estaduais-1a-divisao-2026.md:494`; São Paulo (ATA/Centroavante): `brasileirao-serie-a-2026.md:681`, `estaduais-1a-divisao-2026.md:164`; Vasco da Gama (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:695`, `estaduais-1a-divisao-2026.md:671`, `copa-do-brasil-2026.md:157` — _provável homônimo (nome de uma palavra)_
- **Paulo Henrique** — Atlético Goianiense (Goleiro): `brasileirao-serie-b-2026.md:145`, `estaduais-1a-divisao-2026.md:2174`; Confiança (VOL): `brasileirao-serie-c-2026.md:278`; Novorizontino (Goleiro): `brasileirao-serie-b-2026.md:701`, `estaduais-1a-divisao-2026.md:249`; Vasco da Gama (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:696`, `estaduais-1a-divisao-2026.md:672`, `copa-do-brasil-2026.md:160` — _provável homônimo (goleiro e jogador de linha)_
- **Paulo Vitor / Paulo Vítor** — Atlético Goianiense (Goleiro): `brasileirao-serie-b-2026.md:146`, `estaduais-1a-divisao-2026.md:2175`; Avaí (MEI/Volante): `brasileirao-serie-b-2026.md:223`, `estaduais-1a-divisao-2026.md:1710` — _provável homônimo (goleiro e jogador de linha)_
- **Pedrinho** — Goiás (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:547`, `estaduais-1a-divisao-2026.md:2082`; Maringá (PE): `brasileirao-serie-c-2026.md:577`, `estaduais-1a-divisao-2026.md:1629`; Ponte Preta (Meio-campo): `brasileirao-serie-b-2026.md:826`, `estaduais-1a-divisao-2026.md:435`; São Bernardo (Ponta Esq.): `brasileirao-serie-b-2026.md:869`, `estaduais-1a-divisao-2026.md:357` — _provável homônimo (nome de uma palavra)_
- **Pedro** — Flamengo (ATA/Centroavante): `brasileirao-serie-a-2026.md:342`, `estaduais-1a-divisao-2026.md:618`, `copa-libertadores-2026.md:124`; Guarani (DEF): `brasileirao-serie-c-2026.md:412`, `estaduais-1a-divisao-2026.md:392` — _provável homônimo (nome de uma palavra)_
- **Pedro Henrique** — Cuiabá (Centroavante): `brasileirao-serie-b-2026.md:467`; Fortaleza (ATA/PD/Ponta Dir.): `brasileirao-serie-b-2026.md:509`, `estaduais-1a-divisao-2026.md:1996`, `copa-do-brasil-2026.md:528`; Maranhão (VOL): `brasileirao-serie-c-2026.md:540`; Paysandu (VOL): `brasileirao-serie-c-2026.md:617`; Red Bull Bragantino (DEF/Zagueiro): `brasileirao-serie-a-2026.md:534`, `estaduais-1a-divisao-2026.md:213` — _provável homônimo (defensor e atacante)_
- **Pedro Rocha** — Coritiba (ATA/Centroavante): `brasileirao-serie-a-2026.md:275`, `estaduais-1a-divisao-2026.md:1508`; Juventude (GOL/Goleiro): `brasileirao-serie-b-2026.md:553`, `estaduais-1a-divisao-2026.md:1057`, `copa-do-brasil-2026.md:536` — _provável homônimo (goleiro e jogador de linha)_
- **Peu** — Maranhão (VOL): `brasileirao-serie-c-2026.md:542`; Paysandu (PD): `brasileirao-serie-c-2026.md:618` — _provável homônimo (nome de uma palavra)_
- **PK** — Botafogo-PB (LE): `brasileirao-serie-c-2026.md:174`; Confiança (MEI): `brasileirao-serie-c-2026.md:279` — _provável homônimo (nome de uma palavra)_
- **Rafinha** — Floresta (PD): `brasileirao-serie-c-2026.md:382`, `estaduais-1a-divisao-2026.md:2032`; Maringá (PE): `brasileirao-serie-c-2026.md:578`, `estaduais-1a-divisao-2026.md:1630`; Sport (Defensor): `brasileirao-serie-b-2026.md:897` — _provável homônimo (nome de uma palavra)_
- **Raí** — Juventude (MEI/Meia Ofensivo): `brasileirao-serie-b-2026.md:585`, `copa-do-brasil-2026.md:559`; Maringá (ATA): `brasileirao-serie-c-2026.md:579`, `estaduais-1a-divisao-2026.md:1631` — _provável homônimo (nome de uma palavra)_
- **Railson** — Atlético Goianiense (Goleiro): `brasileirao-serie-b-2026.md:147`, `estaduais-1a-divisao-2026.md:2176`; Maranhão (VOL): `brasileirao-serie-c-2026.md:545` — _provável homônimo (goleiro e jogador de linha)_
- **Ramon** — Náutico (Meio-campo): `brasileirao-serie-b-2026.md:684`; Vitória (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:730`, `estaduais-1a-divisao-2026.md:1225`, `copa-do-brasil-2026.md:472` — _provável homônimo (nome de uma palavra)_
- **Raul** — Botafogo (GOL/Goleiro): `brasileirao-serie-a-2026.md:140`, `estaduais-1a-divisao-2026.md:699`; Cuiabá (Volante): `brasileirao-serie-b-2026.md:446` — _provável homônimo (goleiro e jogador de linha)_
- **Ravanelli** — Capivariano (MEI): `estaduais-1a-divisao-2026.md:521`; Caxias (MEI): `brasileirao-serie-c-2026.md:241`, `estaduais-1a-divisao-2026.md:1117` — _provável homônimo (nome de uma palavra)_
- **Reinaldo** — Mirassol (LE/Lateral Esq.): `brasileirao-serie-a-2026.md:461`, `estaduais-1a-divisao-2026.md:301`, `copa-do-brasil-2026.md:580`, `copa-libertadores-2026.md:258`; Ypiranga-RS (ZAG): `brasileirao-serie-c-2026.md:720`, `estaduais-1a-divisao-2026.md:1170` — _provável homônimo (nome de uma palavra)_
- **Renatinho** — Itabaiana (MEI): `brasileirao-serie-c-2026.md:483`; Primavera (MEI): `estaduais-1a-divisao-2026.md:498` — _provável homônimo (nome de uma palavra)_
- **Rene / Renê** — Fluminense (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:358`, `estaduais-1a-divisao-2026.md:635`, `copa-do-brasil-2026.md:121`, `copa-libertadores-2026.md:304`; Vitória (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:747`, `estaduais-1a-divisao-2026.md:1242`, `copa-do-brasil-2026.md:491` — _provável homônimo (nome de uma palavra)_
- **Rian** — CRB (Meio-campo): `brasileirao-serie-b-2026.md:368`; Guarani (LD): `brasileirao-serie-c-2026.md:417`, `estaduais-1a-divisao-2026.md:397` — _provável homônimo (nome de uma palavra)_
- **Richard** — Inter de Limeira (PD): `brasileirao-serie-c-2026.md:448`; Internacional (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:436`, `estaduais-1a-divisao-2026.md:1039`, `copa-do-brasil-2026.md:270`; Ituano (LE): `brasileirao-serie-c-2026.md:514`; Primavera (MEI): `estaduais-1a-divisao-2026.md:497` — _provável homônimo (nome de uma palavra)_
- **Riquelme** — Atlético Goianiense (Meio-campo): `brasileirao-serie-b-2026.md:181`, `estaduais-1a-divisao-2026.md:2210`; Fluminense (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:374`, `estaduais-1a-divisao-2026.md:651`, `copa-do-brasil-2026.md:138`, `copa-libertadores-2026.md:321`; Grêmio (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:406`, `estaduais-1a-divisao-2026.md:1008`, `copa-do-brasil-2026.md:309`; Vasco da Gama (DEF/LE/Lateral Esq.): `brasileirao-serie-a-2026.md:694`, `estaduais-1a-divisao-2026.md:670`, `copa-do-brasil-2026.md:156` — _provável homônimo (nome de uma palavra)_
- **Robinho** — Inter de Limeira (PD): `brasileirao-serie-c-2026.md:449`; Santa Cruz (PD): `brasileirao-serie-c-2026.md:647`, `estaduais-1a-divisao-2026.md:1425` — _provável homônimo (nome de uma palavra)_
- **Robson** — Inter de Limeira (ZAG): `brasileirao-serie-c-2026.md:450`; Novorizontino (Ponta Dir.): `brasileirao-serie-b-2026.md:734`, `estaduais-1a-divisao-2026.md:282` — _provável homônimo (nome de uma palavra)_
- **Rodolfo** — Botafogo-PB (ATA): `brasileirao-serie-c-2026.md:176`; Capivariano (ATA): `estaduais-1a-divisao-2026.md:523` — _provável homônimo (nome de uma palavra)_
- **Rodrigo** — Criciúma (DEF/Defensor): `brasileirao-serie-b-2026.md:397`, `estaduais-1a-divisao-2026.md:1737`; Maranhão (VOL): `brasileirao-serie-c-2026.md:546`; Velo Clube (MEI): `estaduais-1a-divisao-2026.md:457` — _provável homônimo (nome de uma palavra)_
- **Rodriguinho** — Anápolis (PD): `brasileirao-serie-c-2026.md:101`, `estaduais-1a-divisao-2026.md:2157`; Fortaleza (ATA/PE/Ponta Esq.): `brasileirao-serie-b-2026.md:506`, `estaduais-1a-divisao-2026.md:1992`, `copa-do-brasil-2026.md:526`; Ponte Preta (Seg. Atacante): `brasileirao-serie-b-2026.md:832`, `estaduais-1a-divisao-2026.md:441`; Red Bull Bragantino (MEI/Meia Ofensivo): `brasileirao-serie-a-2026.md:551`, `estaduais-1a-divisao-2026.md:230` — _provável homônimo (nome de uma palavra)_
- **Romarinho** — Criciúma (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:415`, `estaduais-1a-divisao-2026.md:1757`; Inter de Limeira (MD): `brasileirao-serie-c-2026.md:451`; Juazeirense (ATA): `estaduais-1a-divisao-2026.md:1291`; Volta Redonda (PD): `brasileirao-serie-c-2026.md:687`, `estaduais-1a-divisao-2026.md:781` — _provável homônimo (nome de uma palavra)_
- **Romário** — Botafogo-PB (MEI): `brasileirao-serie-c-2026.md:177`; Maringá (GOL): `brasileirao-serie-c-2026.md:581`, `estaduais-1a-divisao-2026.md:1633` — _provável homônimo (goleiro e jogador de linha)_
- **Romulo / Rômulo** — Atlético Mineiro (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:78`, `estaduais-1a-divisao-2026.md:800`, `copa-do-brasil-2026.md:364`; Novorizontino (Meia Ofensivo): `brasileirao-serie-b-2026.md:726`, `estaduais-1a-divisao-2026.md:274` — _provável homônimo (nome de uma palavra)_
- **Ronald** — Ceará (Defensor): `brasileirao-serie-b-2026.md:308`; Criciúma (MEI/Volante): `brasileirao-serie-b-2026.md:401`, `estaduais-1a-divisao-2026.md:1746`; Fortaleza (MEI/VOL/Volante): `brasileirao-serie-b-2026.md:493`, `estaduais-1a-divisao-2026.md:1982`, `copa-do-brasil-2026.md:514`; Santa Cruz (PD): `brasileirao-serie-c-2026.md:650`, `estaduais-1a-divisao-2026.md:1428` — _provável homônimo (nome de uma palavra)_
- **Ronaldo** — Amazonas (ATA): `brasileirao-serie-c-2026.md:62`; Bahia (GOL/Goleiro): `brasileirao-serie-a-2026.md:103`, `estaduais-1a-divisao-2026.md:1179`; Internacional (MEI/VOL/Volante): `brasileirao-serie-a-2026.md:435`, `estaduais-1a-divisao-2026.md:1038`, `copa-do-brasil-2026.md:267` — _provável homônimo (goleiro e jogador de linha)_
- **Ryan** — Fortaleza (MEI/VOL/Volante): `brasileirao-serie-b-2026.md:495`, `estaduais-1a-divisao-2026.md:1981`, `copa-do-brasil-2026.md:516`; Vila Nova (ATA/Ponta Esq.): `brasileirao-serie-b-2026.md:961`, `estaduais-1a-divisao-2026.md:2110` — _provável homônimo (nome de uma palavra)_
- **Samuel** — Anápolis (VOL): `brasileirao-serie-c-2026.md:103`, `estaduais-1a-divisao-2026.md:2159`; Náutico (MEI/Volante): `brasileirao-serie-b-2026.md:677`, `estaduais-1a-divisao-2026.md:1375` — _provável homônimo (nome de uma palavra)_
- **Sanchez / Sánchez** — Ceará (DEF/Lateral Esq.): `brasileirao-serie-b-2026.md:304`, `estaduais-1a-divisao-2026.md:1946`; Noroeste (DEF): `estaduais-1a-divisao-2026.md:532` — _provável homônimo (nome de uma palavra)_
- **Saulo** — Inter de Limeira (GOL): `brasileirao-serie-c-2026.md:453`; Ituano (GOL): `brasileirao-serie-c-2026.md:515` — _provável homônimo (nome de uma palavra)_
- **Tarcísio** — Capivariano (DEF): `estaduais-1a-divisao-2026.md:518`; Cuiabá (Lateral Esq.): `brasileirao-serie-b-2026.md:437`; Itabaiana (PE): `brasileirao-serie-c-2026.md:487` — _provável homônimo (nome de uma palavra)_
- **Tarik** — Londrina (Volante): `brasileirao-serie-b-2026.md:624`, `estaduais-1a-divisao-2026.md:1581`; Ponte Preta (Meio-campo): `brasileirao-serie-b-2026.md:825`, `estaduais-1a-divisao-2026.md:434` — _provável homônimo (nome de uma palavra)_
- **Tete / Tetê** — Barra-SC (VOL): `brasileirao-serie-c-2026.md:139`, `estaduais-1a-divisao-2026.md:1843`; Grêmio (ATA/PD/Ponta Dir.): `brasileirao-serie-a-2026.md:409`, `estaduais-1a-divisao-2026.md:1011`, `copa-do-brasil-2026.md:312`; São Paulo (ATA/Ponta Esq.): `brasileirao-serie-a-2026.md:673`, `estaduais-1a-divisao-2026.md:156` — _provável homônimo (nome de uma palavra)_
- **Thalis** — Londrina (Meia Ofensivo): `brasileirao-serie-b-2026.md:633`, `estaduais-1a-divisao-2026.md:1590`; Sport (Meio-campo): `brasileirao-serie-b-2026.md:908` — _provável homônimo (nome de uma palavra)_
- **Thallyson** — América Mineiro (DEF/Zagueiro): `brasileirao-serie-b-2026.md:45`, `estaduais-1a-divisao-2026.md:873`; Botafogo-PB (VOL): `brasileirao-serie-c-2026.md:179` — _provável homônimo (nome de uma palavra)_
- **Thayllon** — Avaí (ATA/Ponta Dir.): `brasileirao-serie-b-2026.md:237`, `estaduais-1a-divisao-2026.md:1724`; Paysandu (PD): `brasileirao-serie-c-2026.md:621` — _provável homônimo (nome de uma palavra)_
- **Thiago** — Londrina (Goleiro): `brasileirao-serie-b-2026.md:608`, `estaduais-1a-divisao-2026.md:1565`; Operário-PR (Meio-campo): `brasileirao-serie-b-2026.md:777`, `estaduais-1a-divisao-2026.md:1675` — _provável homônimo (goleiro e jogador de linha)_
- **Thiago Santos** — Coritiba (DEF/Zagueiro): `brasileirao-serie-a-2026.md:255`, `estaduais-1a-divisao-2026.md:1488`; Juazeirense (GOL): `estaduais-1a-divisao-2026.md:1274` — _provável homônimo (goleiro e jogador de linha)_
- **Thiaguinho** — Botafogo-SP (Volante): `brasileirao-serie-b-2026.md:269`, `estaduais-1a-divisao-2026.md:567`; CRB (Ponta Dir.): `brasileirao-serie-b-2026.md:371`; Capivariano (MEI): `estaduais-1a-divisao-2026.md:520`; Criciúma (MEI/Volante): `brasileirao-serie-b-2026.md:405`, `estaduais-1a-divisao-2026.md:1749`; Jacuipense (ATA): `estaduais-1a-divisao-2026.md:1268` — _provável homônimo (nome de uma palavra)_
- **Tiaguinho** — Grêmio (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:403`, `estaduais-1a-divisao-2026.md:1005`, `copa-do-brasil-2026.md:306`; Ituano (LE): `brasileirao-serie-c-2026.md:517` — _provável homônimo (nome de uma palavra)_
- **Tito** — Atlético Goianiense (Zagueiro): `brasileirao-serie-b-2026.md:154`, `estaduais-1a-divisao-2026.md:2183`; Itabaiana (LE): `brasileirao-serie-c-2026.md:488` — _provável homônimo (nome de uma palavra)_
- **Vavá** — Barra-SC (ZAG): `brasileirao-serie-c-2026.md:140`, `estaduais-1a-divisao-2026.md:1844`; Figueirense (GOL): `brasileirao-serie-c-2026.md:352`, `estaduais-1a-divisao-2026.md:1926` — _provável homônimo (goleiro e jogador de linha)_
- **Victor Hugo** — Anápolis (GOL): `brasileirao-serie-c-2026.md:104`, `estaduais-1a-divisao-2026.md:2160`; Atlético Mineiro (MC/MEI/Meia Central): `brasileirao-serie-a-2026.md:87`, `estaduais-1a-divisao-2026.md:809`, `copa-do-brasil-2026.md:374`; Primavera (GOL): `estaduais-1a-divisao-2026.md:479` — _provável homônimo (goleiro e jogador de linha)_
- **Vinicius / Vinícius** — Fortaleza (GOL/Goleiro): `brasileirao-serie-b-2026.md:480`, `estaduais-1a-divisao-2026.md:1971`, `copa-do-brasil-2026.md:504`; Náutico (ATA/Ponta Esq.): `brasileirao-serie-b-2026.md:685`, `estaduais-1a-divisao-2026.md:1382`; Primavera (ATA): `estaduais-1a-divisao-2026.md:510` — _provável homônimo (goleiro e jogador de linha)_
- **Vitao / Vitão** — Atlético Mineiro (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:79`, `estaduais-1a-divisao-2026.md:801`, `copa-do-brasil-2026.md:363`; Barra-SC (ZAG): `brasileirao-serie-c-2026.md:142`, `estaduais-1a-divisao-2026.md:1846`; Flamengo (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:320`, `estaduais-1a-divisao-2026.md:598`, `copa-libertadores-2026.md:103` — _provável homônimo (nome de uma palavra)_
- **Vitinho** — Atlético Goianiense (Meio-campo): `brasileirao-serie-b-2026.md:183`, `estaduais-1a-divisao-2026.md:2212`; Botafogo (DEF/Lateral Dir.): `brasileirao-serie-a-2026.md:153`, `estaduais-1a-divisao-2026.md:712`; Caxias (LE): `brasileirao-serie-c-2026.md:245`, `estaduais-1a-divisao-2026.md:1121`; Corinthians (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:238`, `estaduais-1a-divisao-2026.md:113`, `copa-do-brasil-2026.md:207`, `copa-libertadores-2026.md:160`; Floresta (MEI): `brasileirao-serie-c-2026.md:386`, `estaduais-1a-divisao-2026.md:2036`; Fortaleza (ATA/PD/Ponta Dir.): `brasileirao-serie-b-2026.md:508`, `estaduais-1a-divisao-2026.md:1994`, `copa-do-brasil-2026.md:527`; Internacional (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:445`, `estaduais-1a-divisao-2026.md:1048`, `copa-do-brasil-2026.md:278`; Juazeirense (DEF): `estaduais-1a-divisao-2026.md:1280`; Santa Cruz (PD): `brasileirao-serie-c-2026.md:657`, `estaduais-1a-divisao-2026.md:1435` — _provável homônimo (nome de uma palavra)_
- **Wallace** — Botafogo-SP (Zagueiro): `brasileirao-serie-b-2026.md:252`, `estaduais-1a-divisao-2026.md:550`; CRB (Defensor): `brasileirao-serie-b-2026.md:354`; Grêmio (DEF/ZAG/Zagueiro): `brasileirao-serie-a-2026.md:390`, `estaduais-1a-divisao-2026.md:992`, `copa-do-brasil-2026.md:294`; Londrina (Zagueiro): `brasileirao-serie-b-2026.md:610`, `estaduais-1a-divisao-2026.md:1567`; Maringá (ZAG): `brasileirao-serie-c-2026.md:585`, `estaduais-1a-divisao-2026.md:1637` — _provável homônimo (nome de uma palavra)_
- **Walter** — Atlético de Alagoinhas (ATA): `estaduais-1a-divisao-2026.md:1298`; Mirassol (GOL/Goleiro): `brasileirao-serie-a-2026.md:453`, `estaduais-1a-divisao-2026.md:293`, `copa-do-brasil-2026.md:573`, `copa-libertadores-2026.md:250` — _provável homônimo (goleiro e jogador de linha)_
- **Wanderson** — Cruzeiro (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:304`, `estaduais-1a-divisao-2026.md:849`, `copa-do-brasil-2026.md:344`, `copa-libertadores-2026.md:234`; Náutico (DEF/Zagueiro): `brasileirao-serie-b-2026.md:658`, `estaduais-1a-divisao-2026.md:1363` — _provável homônimo (nome de uma palavra)_
- **Warley** — Barra-SC (MEI): `brasileirao-serie-c-2026.md:143`, `estaduais-1a-divisao-2026.md:1847`; Vila Nova (Atacante): `brasileirao-serie-b-2026.md:973` — _provável homônimo (nome de uma palavra)_
- **Welliton** — Fortaleza (ATA/PD/Ponta Dir.): `brasileirao-serie-b-2026.md:510`, `estaduais-1a-divisao-2026.md:1995`, `copa-do-brasil-2026.md:529`; Primavera (ATA): `estaduais-1a-divisao-2026.md:500` — _provável homônimo (nome de uma palavra)_
- **Wendel** — Ceará (ATA/Centroavante): `brasileirao-serie-b-2026.md:331`, `estaduais-1a-divisao-2026.md:1961`; Confiança (MEI): `brasileirao-serie-c-2026.md:283`; Volta Redonda (SA): `brasileirao-serie-c-2026.md:691`, `estaduais-1a-divisao-2026.md:785` — _provável homônimo (nome de uma palavra)_
- **Wenderson** — Avaí (MEI/Meia Central): `brasileirao-serie-b-2026.md:228`, `estaduais-1a-divisao-2026.md:1714`; Náutico (MEI/Volante): `brasileirao-serie-b-2026.md:674`, `estaduais-1a-divisao-2026.md:1374` — _provável homônimo (nome de uma palavra)_
- **Wesley Santos** — Botafogo-SP (Ponta Esq.): `brasileirao-serie-b-2026.md:281`, `estaduais-1a-divisao-2026.md:579`; Mirassol (LD/Lateral Dir.): `brasileirao-serie-a-2026.md:466`, `estaduais-1a-divisao-2026.md:306`, `copa-do-brasil-2026.md:585`, `copa-libertadores-2026.md:263` — _provável homônimo (defensor e atacante)_
- **Weverton** — Grêmio (GOL/Goleiro): `brasileirao-serie-a-2026.md:383`, `estaduais-1a-divisao-2026.md:985`, `copa-do-brasil-2026.md:285`; Londrina (Lateral Dir.): `brasileirao-serie-b-2026.md:619`, `estaduais-1a-divisao-2026.md:1576` — _provável homônimo (goleiro e jogador de linha)_
- **William** — América Mineiro (GOL/Goleiro): `brasileirao-serie-b-2026.md:36`, `estaduais-1a-divisao-2026.md:864`; Cruzeiro (DEF/LD/Lateral Dir.): `brasileirao-serie-a-2026.md:291`, `estaduais-1a-divisao-2026.md:836`, `copa-do-brasil-2026.md:331`, `copa-libertadores-2026.md:221`; Itabaiana (GOL): `brasileirao-serie-c-2026.md:490` — _provável homônimo (goleiro e jogador de linha)_
- **Willian** — Botafogo-SP (Atacante): `brasileirao-serie-b-2026.md:291`, `estaduais-1a-divisao-2026.md:589`; Grêmio (ATA/PE/Ponta Esq.): `brasileirao-serie-a-2026.md:408`, `estaduais-1a-divisao-2026.md:1010`, `copa-do-brasil-2026.md:311` — _provável homônimo (nome de uma palavra)_
- **Yarlen** — América Mineiro (Atacante): `brasileirao-serie-b-2026.md:81`; Athletic Club (Ponta Dir.): `brasileirao-serie-b-2026.md:132`, `estaduais-1a-divisao-2026.md:947` — _provável homônimo (nome de uma palavra)_
- **Ynaiã** — Guarani (LD): `brasileirao-serie-c-2026.md:421`, `estaduais-1a-divisao-2026.md:401`; Velo Clube (DEF): `estaduais-1a-divisao-2026.md:452` — _provável homônimo (nome de uma palavra)_
- **Yuri** — Atlético Goianiense (Goleiro): `brasileirao-serie-b-2026.md:149`, `estaduais-1a-divisao-2026.md:2178`; Náutico (DEF/Lateral Esq.): `brasileirao-serie-b-2026.md:661`, `estaduais-1a-divisao-2026.md:1365` — _provável homônimo (goleiro e jogador de linha)_
- **Zé Carlos** — Figueirense (PD): `brasileirao-serie-c-2026.md:354`, `estaduais-1a-divisao-2026.md:1928`; Ypiranga-RS (GOL): `brasileirao-serie-c-2026.md:725`, `estaduais-1a-divisao-2026.md:1175` — _provável homônimo (goleiro e jogador de linha)_

## 4. Nomes repetidos dentro do mesmo clube

- **Athletico Paranaense** — Dudu: Lateral Dir. — `brasileirao-serie-a-2026.md:47`; Meia Ofensivo #53 `brasileirao-serie-a-2026.md:55`
- **Juventude** — Marcos Paulo: Zagueiro #47 `brasileirao-serie-b-2026.md:562`; Ponta Esq. #10 `brasileirao-serie-b-2026.md:593`

Nos dois casos as linhas têm posição e/ou número diferentes, então provavelmente são dois atletas com o mesmo apelido; o catálogo precisa de um desambiguador (ex.: sufixo com a camisa).

## 5. Clubes com menos de 2 goleiros ou menos de 18 atletas

| Clube | Origem | Atletas | Goleiros | Problema |
|---|---|---:|---:|---|
| Velo Clube | Estadual (só estaduais) | 11 | 1 | 1 goleiro(s); 11 atletas |
| Portuguesa | Estadual (só estaduais) | 11 | 1 | 1 goleiro(s); 11 atletas |
| Capivariano | Estadual (só estaduais) | 12 | 1 | 1 goleiro(s); 12 atletas |
| Noroeste | Estadual (só estaduais) | 13 | 1 | 1 goleiro(s); 13 atletas |
| Jacuipense | Estadual (só estaduais) | 13 | 2 | 13 atletas |
| Juazeirense | Estadual (só estaduais) | 20 | 1 | 1 goleiro(s) |
| Atlético de Alagoinhas | Estadual (só estaduais) | 2 | 0 | 0 goleiro(s); 2 atletas |
| Galícia | Estadual (só estaduais) | 4 | 0 | 0 goleiro(s); 4 atletas |

Todos são clubes só de estadual com elenco parcial (time-base de ge.globo ou Bahia Notícias). Juazeirense tem 20 atletas, mas só 1 goleiro. Atlético de Alagoinhas (2) e Galícia (4) não formam nem um time; o pipeline precisa completar o elenco com jogadores gerados ou deixar esses clubes fora do jogo.

## 6. Clubes com mais de 35 atletas — sugestões de corte

Apenas sugestão; nada foi removido dos arquivos brutos. O arquivo não traz idade, então "reserva muito jovem" foi aproximado por: (a) atleta **sem número de camisa** (`—` ou `#?`), em geral base ou não inscrito; (b) atleta que **também aparece em outro clube** com nome composto (provável saída ou empréstimo até julho/2026); (c) nomes completos de registro (3+ palavras, como "Gabriel De Oliveira Da Silva"), típicos de atletas da base vindos só da fonte ESPN. Os destaques de `destaques-2026.md` nunca entram na sugestão.

### Red Bull Bragantino — 38 atletas (excede em 3)

Candidatos, do mais para o menos provável (5 encontrados):

- Bruninho (Meia Ofensivo, `brasileirao-serie-a-2026.md:552`) — sem número
- Ignacio Laquintana (Ponta Dir., `brasileirao-serie-a-2026.md:559`) — sem número
- Thiago Borbas (Centroavante, `brasileirao-serie-a-2026.md:561`) — sem número
- Gabriel Novaes (Centroavante, `brasileirao-serie-a-2026.md:564`) — sem número
- João Neto (Meia Central, `brasileirao-serie-a-2026.md:550`) — também em CRB

### São Paulo — 42 atletas (excede em 7)

Candidatos, do mais para o menos provável (4 encontrados):

- Matheus Belém (Zagueiro, `brasileirao-serie-a-2026.md:646`) — sem número
- Aurélio Buta (Lateral Dir., `brasileirao-serie-a-2026.md:654`) — sem número
- Newton (Volante, `brasileirao-serie-a-2026.md:661`) — sem número
- Victor Sá (Ponta Esq., `brasileirao-serie-a-2026.md:672`) — sem número

> Os critérios automáticos cobrem só 4 dos 7 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Vitória — 37 atletas (excede em 2)

Candidatos, do mais para o menos provável (6 encontrados):

- Zé Marcos (Zagueiro, `brasileirao-serie-a-2026.md:725`) — sem número; também em Sport
- Lucas Braga (Ponta Esq., `brasileirao-serie-a-2026.md:748`) — sem número
- Mateus Silva (Lateral Dir., `brasileirao-serie-a-2026.md:734`) — também em Náutico
- Zé Vitor (Meia Central, `brasileirao-serie-a-2026.md:741`) — também em Ferroviária
- Tomás Pochettino (Meia Ofensivo, `brasileirao-serie-a-2026.md:742`) — também em Fortaleza
- Lucas Silva (Ponta Dir., `brasileirao-serie-a-2026.md:751`) — também em Cruzeiro

### América Mineiro — 48 atletas (excede em 13)

Candidatos, do mais para o menos provável (11 encontrados):

- Bruno Brígido (Goleiro, `brasileirao-serie-b-2026.md:39`) — sem número
- Luca Sosa (Zagueiro, `brasileirao-serie-b-2026.md:47`) — sem número
- Tobias Ostchega (Lateral Esq., `brasileirao-serie-b-2026.md:49`) — sem número
- Fábio (Lateral Dir., `brasileirao-serie-b-2026.md:52`) — sem número
- Heitor (Lateral Dir., `brasileirao-serie-b-2026.md:53`) — sem número
- Leo Izidoro (Defensor, `brasileirao-serie-b-2026.md:59`) — sem número
- Gabriel Oliveira Santos (Meio-campo, `brasileirao-serie-b-2026.md:71`) — sem número
- Rodrigo Piñeiro (Ponta Dir., `brasileirao-serie-b-2026.md:77`) — sem número
- Gabriel De Oliveira Da Silva (Defensor, `brasileirao-serie-b-2026.md:58`) — nome de registro (base)
- Yago Santos (Meio-campo, `brasileirao-serie-b-2026.md:69`) — também em Athletic Club
- Everton Sidnei De Brito (Atacante, `brasileirao-serie-b-2026.md:80`) — nome de registro (base)

> Os critérios automáticos cobrem só 11 dos 13 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Athletic Club — 57 atletas (excede em 22)

Candidatos, do mais para o menos provável (37 encontrados):

- Felipe Vieira (Zagueiro, `brasileirao-serie-b-2026.md:92`) — sem número; também em Botafogo-SP
- Gabriel Índio (Zagueiro, `brasileirao-serie-b-2026.md:93`) — sem número; também em Náutico
- Jhan Torres (Zagueiro, `brasileirao-serie-b-2026.md:94`) — sem número; também em Operário-PR
- Marcelo Henrique (Lateral Esq., `brasileirao-serie-b-2026.md:97`) — sem número; também em Cuiabá
- Yago Santos (Meia Central, `brasileirao-serie-b-2026.md:114`) — sem número; também em América Mineiro
- Eduardo Filipe Silva De Oliveira (Meio-campo, `brasileirao-serie-b-2026.md:121`) — sem número; nome de registro (base)
- Gabriel Da Silva Sinfronio (Atacante, `brasileirao-serie-b-2026.md:139`) — sem número; nome de registro (base)
- Samuel Da Conceição Schirmer (Atacante, `brasileirao-serie-b-2026.md:141`) — sem número; nome de registro (base)
- Eduardo Freire (Goleiro, `brasileirao-serie-b-2026.md:87`) — sem número
- Glauco (Goleiro, `brasileirao-serie-b-2026.md:88`) — sem número
- Tony Batista (Goleiro, `brasileirao-serie-b-2026.md:89`) — sem número
- Sidimar (Zagueiro, `brasileirao-serie-b-2026.md:95`) — sem número
- Enzo (Lateral Esq., `brasileirao-serie-b-2026.md:96`) — sem número
- Rodrigo Gelado (Lateral Esq., `brasileirao-serie-b-2026.md:98`) — sem número
- Gustavo Morais Melo (Defensor, `brasileirao-serie-b-2026.md:102`) — sem número
- João Vitor (Defensor, `brasileirao-serie-b-2026.md:103`) — sem número
- Kazim (Defensor, `brasileirao-serie-b-2026.md:104`) — sem número
- Matheus Pimenta (Defensor, `brasileirao-serie-b-2026.md:105`) — sem número
- Sam Philip (Defensor, `brasileirao-serie-b-2026.md:106`) — sem número
- Felipe Negrucci (Volante, `brasileirao-serie-b-2026.md:109`) — sem número
- Fabrício Isidoro (Meia Central, `brasileirao-serie-b-2026.md:113`) — sem número
- Alexandre Pena (Meia Ofensivo, `brasileirao-serie-b-2026.md:118`) — sem número
- Alexandre Cesar (Meio-campo, `brasileirao-serie-b-2026.md:119`) — sem número
- Caick José Ferreira Ramos (Meio-campo, `brasileirao-serie-b-2026.md:120`) — sem número
- Leandro Silva (Meio-campo, `brasileirao-serie-b-2026.md:122`) — sem número
- Luiz Fernando Souza Santos (Meio-campo, `brasileirao-serie-b-2026.md:123`) — sem número
- Léo Chú (Ponta Esq., `brasileirao-serie-b-2026.md:126`) — sem número
- Bruninho (Ponta Dir., `brasileirao-serie-b-2026.md:128`) — sem número
- João Adriano (Ponta Dir., `brasileirao-serie-b-2026.md:129`) — sem número
- Leandro Alves (Ponta Dir., `brasileirao-serie-b-2026.md:130`) — sem número
- Ruan Assis (Ponta Dir., `brasileirao-serie-b-2026.md:131`) — sem número
- Yarlen (Ponta Dir., `brasileirao-serie-b-2026.md:132`) — sem número
- Carlinhos (Centroavante, `brasileirao-serie-b-2026.md:134`) — sem número
- Gustavão (Centroavante, `brasileirao-serie-b-2026.md:135`) — sem número
- Samuel Otusanya (Centroavante, `brasileirao-serie-b-2026.md:136`) — sem número
- Wilinton Aponzá (Centroavante, `brasileirao-serie-b-2026.md:137`) — sem número
- Caua Medeiros Araujo (Atacante, `brasileirao-serie-b-2026.md:138`) — sem número

### Atlético Goianiense — 56 atletas (excede em 21)

Candidatos, do mais para o menos provável (55 encontrados):

- Anthony Matheus (Meio-campo, `brasileirao-serie-b-2026.md:173`) — sem número; também em CRB
- Klebert De Oliveira Pereira (Meio-campo, `brasileirao-serie-b-2026.md:179`) — sem número; nome de registro (base)
- Léo (Goleiro, `brasileirao-serie-b-2026.md:144`) — sem número
- Paulo Henrique (Goleiro, `brasileirao-serie-b-2026.md:145`) — sem número
- Paulo Vítor (Goleiro, `brasileirao-serie-b-2026.md:146`) — sem número
- Railson (Goleiro, `brasileirao-serie-b-2026.md:147`) — sem número
- Vladimir (Goleiro, `brasileirao-serie-b-2026.md:148`) — sem número
- Yuri (Goleiro, `brasileirao-serie-b-2026.md:149`) — sem número
- Adriano Martins (Zagueiro, `brasileirao-serie-b-2026.md:150`) — sem número
- Junior Barreto (Zagueiro, `brasileirao-serie-b-2026.md:151`) — sem número
- Marcão (Zagueiro, `brasileirao-serie-b-2026.md:152`) — sem número
- Natã (Zagueiro, `brasileirao-serie-b-2026.md:153`) — sem número
- Tito (Zagueiro, `brasileirao-serie-b-2026.md:154`) — sem número
- Guilherme Lopes (Lateral Esq., `brasileirao-serie-b-2026.md:155`) — sem número
- Guilherme Romão (Lateral Esq., `brasileirao-serie-b-2026.md:156`) — sem número
- Gustavo Daniel (Lateral Esq., `brasileirao-serie-b-2026.md:157`) — sem número
- Ewerthon (Lateral Dir., `brasileirao-serie-b-2026.md:158`) — sem número
- Felipe Guimarães (Lateral Dir., `brasileirao-serie-b-2026.md:159`) — sem número
- Gebson (Defensor, `brasileirao-serie-b-2026.md:160`) — sem número
- Guillermo (Defensor, `brasileirao-serie-b-2026.md:161`) — sem número
- Isaac (Defensor, `brasileirao-serie-b-2026.md:162`) — sem número
- Kaio Cavalo (Defensor, `brasileirao-serie-b-2026.md:163`) — sem número
- Mateus Macedo (Defensor, `brasileirao-serie-b-2026.md:164`) — sem número
- Matheus Bebeto (Defensor, `brasileirao-serie-b-2026.md:165`) — sem número
- Geovane (Volante, `brasileirao-serie-b-2026.md:166`) — sem número
- Leandro Vilela (Volante, `brasileirao-serie-b-2026.md:167`) — sem número
- Matheus Índio (Volante, `brasileirao-serie-b-2026.md:168`) — sem número
- Cristiano (Meia Central, `brasileirao-serie-b-2026.md:169`) — sem número
- Igor Henrique (Meia Central, `brasileirao-serie-b-2026.md:170`) — sem número
- Assis (Meia Ofensivo, `brasileirao-serie-b-2026.md:171`) — sem número
- Guilherme (Meia Ofensivo, `brasileirao-serie-b-2026.md:172`) — sem número
- Ariel (Meio-campo, `brasileirao-serie-b-2026.md:174`) — sem número
- Gabriel Araujo (Meio-campo, `brasileirao-serie-b-2026.md:175`) — sem número
- Indio (Meio-campo, `brasileirao-serie-b-2026.md:176`) — sem número
- Jampierre (Meio-campo, `brasileirao-serie-b-2026.md:177`) — sem número
- Kaio Gois (Meio-campo, `brasileirao-serie-b-2026.md:178`) — sem número
- Mateus Aires (Meio-campo, `brasileirao-serie-b-2026.md:180`) — sem número
- Riquelme (Meio-campo, `brasileirao-serie-b-2026.md:181`) — sem número
- Sancho (Meio-campo, `brasileirao-serie-b-2026.md:182`) — sem número
- Vitinho (Meio-campo, `brasileirao-serie-b-2026.md:183`) — sem número
- Guilherme Henrique (Ponta Esq., `brasileirao-serie-b-2026.md:184`) — sem número
- Bruno José (Ponta Dir., `brasileirao-serie-b-2026.md:185`) — sem número
- Lima (Ponta Dir., `brasileirao-serie-b-2026.md:186`) — sem número
- Léo Tocantins (Ponta Dir., `brasileirao-serie-b-2026.md:187`) — sem número
- Marrony (Ponta Dir., `brasileirao-serie-b-2026.md:188`) — sem número
- Daniel Lima (Centroavante, `brasileirao-serie-b-2026.md:189`) — sem número
- Geovany Soares (Centroavante, `brasileirao-serie-b-2026.md:190`) — sem número
- Léo Jacó (Centroavante, `brasileirao-serie-b-2026.md:192`) — sem número
- Alan (Atacante, `brasileirao-serie-b-2026.md:193`) — sem número
- Eduardo Taumaturgo (Atacante, `brasileirao-serie-b-2026.md:194`) — sem número
- Gabriel Adão (Atacante, `brasileirao-serie-b-2026.md:195`) — sem número
- Gabriel Dias (Atacante, `brasileirao-serie-b-2026.md:196`) — sem número
- Gabriel Maranhão (Atacante, `brasileirao-serie-b-2026.md:197`) — sem número
- Jader (Atacante, `brasileirao-serie-b-2026.md:198`) — sem número
- Nathan (Atacante, `brasileirao-serie-b-2026.md:199`) — sem número

### Avaí — 43 atletas (excede em 8)

Candidatos, do mais para o menos provável (6 encontrados):

- Reynaldo (Zagueiro, `brasileirao-serie-b-2026.md:212`) — sem número
- Renanzinho (Ponta Dir., `brasileirao-serie-b-2026.md:238`) — sem número
- Leó Aragão (Goleiro, `brasileirao-serie-b-2026.md:205`) — também em Cruzeiro
- Zé Ricardo (Volante, `brasileirao-serie-b-2026.md:224`) — também em Remo
- Luiz Henrique (Meia Ofensivo, `brasileirao-serie-b-2026.md:229`) — também em Juventude
- Jean Lucas (Meia Ofensivo, `brasileirao-serie-b-2026.md:230`) — também em Bahia

> Os critérios automáticos cobrem só 6 dos 8 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Botafogo-SP — 45 atletas (excede em 10)

Candidatos, do mais para o menos provável (10 encontrados):

- Ruan Pablo De Oliveira Romano (Meio-campo, `brasileirao-serie-b-2026.md:277`) — sem número; nome de registro (base)
- Penha (Defensor, `brasileirao-serie-b-2026.md:265`) — sem número
- João Costa (Meia Central, `brasileirao-serie-b-2026.md:273`) — sem número
- Gabriel Cruz (Meio-campo, `brasileirao-serie-b-2026.md:276`) — sem número
- Kauã Freire (Centroavante, `brasileirao-serie-b-2026.md:288`) — sem número
- Willian (Atacante, `brasileirao-serie-b-2026.md:291`) — sem número
- Adriano Vasconcelos Da Silva Júnio (Goleiro, `brasileirao-serie-b-2026.md:249`) — nome de registro (base)
- Felipe Vieira (Lateral Esq., `brasileirao-serie-b-2026.md:258`) — também em Athletic Club
- Pedro Henrique Souza Do Nascimento (Defensor, `brasileirao-serie-b-2026.md:263`) — nome de registro (base)
- Luiz Guilherme Vieira Da Silva (Atacante, `brasileirao-serie-b-2026.md:289`) — nome de registro (base)

### Ceará — 41 atletas (excede em 6)

Candidatos, do mais para o menos provável (4 encontrados):

- Janderson (Defensor, `brasileirao-serie-b-2026.md:313`) — sem número
- Vitor Figueiredo (Meio-campo, `brasileirao-serie-b-2026.md:327`) — sem número
- Júlio César (Zagueiro, `brasileirao-serie-b-2026.md:300`) — também em Anápolis
- Luiz Otávio (Defensor, `brasileirao-serie-b-2026.md:309`) — também em Cuiabá

> Os critérios automáticos cobrem só 4 dos 6 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### CRB — 43 atletas (excede em 8)

Candidatos, do mais para o menos provável (13 encontrados):

- Anthony Matheus (Atacante, `brasileirao-serie-b-2026.md:377`) — sem número; também em Atlético Goianiense
- Cândido (Goleiro, `brasileirao-serie-b-2026.md:340`) — sem número
- Pablo (Goleiro, `brasileirao-serie-b-2026.md:341`) — sem número
- Anderson (Defensor, `brasileirao-serie-b-2026.md:355`) — sem número
- Cauã Ávila (Defensor, `brasileirao-serie-b-2026.md:356`) — sem número
- Heitor Brissantt (Defensor, `brasileirao-serie-b-2026.md:357`) — sem número
- Lucas Pinheiro (Meio-campo, `brasileirao-serie-b-2026.md:367`) — sem número
- Rian (Meio-campo, `brasileirao-serie-b-2026.md:368`) — sem número
- Guilherme Kauan Lucio Ferreira (Atacante, `brasileirao-serie-b-2026.md:378`) — sem número
- Kauã (Atacante, `brasileirao-serie-b-2026.md:379`) — sem número
- Ruy Marcos Levino De Oliveira (Defensor, `brasileirao-serie-b-2026.md:352`) — nome de registro (base)
- Guilherme Estrella (Meio-campo, `brasileirao-serie-b-2026.md:364`) — também em Vasco da Gama
- João Neto (Centroavante, `brasileirao-serie-b-2026.md:374`) — também em Red Bull Bragantino

### Criciúma — 40 atletas (excede em 5)

Candidatos, do mais para o menos provável (4 encontrados):

- Erick Garcia (Defensor, `brasileirao-serie-b-2026.md:398`) — sem número
- Octávio Henrique (Defensor, `brasileirao-serie-b-2026.md:399`) — sem número
- Eliel (Meio-campo, `brasileirao-serie-b-2026.md:411`) — sem número
- Yuri Tanque (Centroavante, `brasileirao-serie-b-2026.md:420`) — sem número

> Os critérios automáticos cobrem só 4 dos 5 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Cuiabá — 51 atletas (excede em 16)

Candidatos, do mais para o menos provável (16 encontrados):

- Marcelo Henrique (Defensor, `brasileirao-serie-b-2026.md:443`) — sem número; também em Athletic Club
- João Chaves (Goleiro, `brasileirao-serie-b-2026.md:428`) — sem número
- Lucas Moraes (Goleiro, `brasileirao-serie-b-2026.md:429`) — sem número
- Lázaro (Defensor, `brasileirao-serie-b-2026.md:442`) — sem número
- Oscar (Defensor, `brasileirao-serie-b-2026.md:444`) — sem número
- Wesley Dias (Volante, `brasileirao-serie-b-2026.md:450`) — sem número
- João Vitor (Meio-campo, `brasileirao-serie-b-2026.md:456`) — sem número
- Gabriel Mineiro (Ponta Esq., `brasileirao-serie-b-2026.md:460`) — sem número
- Jadson (Ponta Dir., `brasileirao-serie-b-2026.md:463`) — sem número
- Fábio Gomes (Centroavante, `brasileirao-serie-b-2026.md:469`) — sem número
- Diodato (Atacante, `brasileirao-serie-b-2026.md:472`) — sem número
- Mansano (Atacante, `brasileirao-serie-b-2026.md:473`) — sem número
- Mateus Patolino (Atacante, `brasileirao-serie-b-2026.md:474`) — sem número
- Marcelo Carné (Goleiro, `brasileirao-serie-b-2026.md:426`) — também em Velo Clube
- Luiz Otávio (Volante, `brasileirao-serie-b-2026.md:449`) — também em Ceará
- Rodrigo Rodrigues (Centroavante, `brasileirao-serie-b-2026.md:465`) — também em Coritiba

### Fortaleza — 38 atletas (excede em 3)

Candidatos, do mais para o menos provável (4 encontrados):

- Calebe (Meia Ofensivo, `brasileirao-serie-b-2026.md:502`) — sem número
- Tomás Pochettino (Meio-campo, `brasileirao-serie-b-2026.md:503`) — também em Vitória
- Luiz Fernando (Ponta Esq., `brasileirao-serie-b-2026.md:505`) — também em Primavera
- Paulo Baya (Ponta Esq., `brasileirao-serie-b-2026.md:507`) — também em Primavera

### Juventude — 50 atletas (excede em 15)

Candidatos, do mais para o menos provável (13 encontrados):

- Joaquim (Goleiro, `brasileirao-serie-b-2026.md:557`) — sem número
- Léo Agliardi (Goleiro, `brasileirao-serie-b-2026.md:558`) — sem número
- Clébio (Defensor, `brasileirao-serie-b-2026.md:575`) — sem número
- Gabriel Borges (Defensor, `brasileirao-serie-b-2026.md:576`) — sem número
- Luiz Eduardo (Defensor, `brasileirao-serie-b-2026.md:577`) — sem número
- Nicolas Begliardi (Meio-campo, `brasileirao-serie-b-2026.md:589`) — sem número
- Sasso (Meio-campo, `brasileirao-serie-b-2026.md:590`) — sem número
- Schroeder (Meio-campo, `brasileirao-serie-b-2026.md:591`) — sem número
- Yarlei (Meio-campo, `brasileirao-serie-b-2026.md:592`) — sem número
- Lucca Amaro (Atacante, `brasileirao-serie-b-2026.md:602`) — sem número
- Luan Martins (Volante, `brasileirao-serie-b-2026.md:578`) — também em Primavera
- Luiz Henrique (Meia Ofensivo, `brasileirao-serie-b-2026.md:586`) — também em Avaí
- João Victor Trevisol Da Silva (Meio-campo, `brasileirao-serie-b-2026.md:587`) — nome de registro (base)

> Os critérios automáticos cobrem só 13 dos 15 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Londrina — 45 atletas (excede em 10)

Candidatos, do mais para o menos provável (9 encontrados):

- Thiago (Goleiro, `brasileirao-serie-b-2026.md:608`) — sem número
- Rafael Soares (Lateral Esq., `brasileirao-serie-b-2026.md:617`) — sem número
- Athyrson (Ponta Esq., `brasileirao-serie-b-2026.md:639`) — sem número
- Raí Nascimento (Ponta Esq., `brasileirao-serie-b-2026.md:640`) — sem número
- Asafe (Atacante, `brasileirao-serie-b-2026.md:649`) — sem número
- Richarlyson Covre De Mello (Defensor, `brasileirao-serie-b-2026.md:622`) — nome de registro (base)
- Pablo Dyego (Ponta Dir., `brasileirao-serie-b-2026.md:642`) — também em São Bernardo
- Bruno Santos (Atacante, `brasileirao-serie-b-2026.md:646`) — também em Mirassol
- Iago Teles Da Silva (Atacante, `brasileirao-serie-b-2026.md:647`) — nome de registro (base)

> Os critérios automáticos cobrem só 9 dos 10 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Náutico — 45 atletas (excede em 10)

Candidatos, do mais para o menos provável (11 encontrados):

- Arthur Henrique Bittencourt (Goleiro, `brasileirao-serie-b-2026.md:654`) — sem número
- Léo (Goleiro, `brasileirao-serie-b-2026.md:655`) — sem número
- Índio (Zagueiro, `brasileirao-serie-b-2026.md:660`) — sem número
- Alemão Irioni (Defensor, `brasileirao-serie-b-2026.md:670`) — sem número
- Emanuel Minervino (Defensor, `brasileirao-serie-b-2026.md:671`) — sem número
- Gledson (Defensor, `brasileirao-serie-b-2026.md:672`) — sem número
- Benjamín Borasi (Ponta Dir., `brasileirao-serie-b-2026.md:687`) — sem número
- Maranhão (Atacante, `brasileirao-serie-b-2026.md:696`) — sem número
- Mateus Silva (Zagueiro, `brasileirao-serie-b-2026.md:657`) — também em Vitória
- Gabriel Índio (Defensor, `brasileirao-serie-b-2026.md:669`) — também em Athletic Club
- Jean Carlos (Meia Ofensivo, `brasileirao-serie-b-2026.md:679`) — também em Goiás

### Novorizontino — 43 atletas (excede em 8)

Candidatos, do mais para o menos provável (5 encontrados):

- Gabriel Correia Da Silva (Defensor, `brasileirao-serie-b-2026.md:717`) — sem número; nome de registro (base)
- Antony Gustavo Mariano Dos Santos (Meio-campo, `brasileirao-serie-b-2026.md:731`) — sem número; nome de registro (base)
- Arthur Barbosa (Defensor, `brasileirao-serie-b-2026.md:716`) — sem número
- Nogueira (Meio-campo, `brasileirao-serie-b-2026.md:732`) — sem número
- Diego Mathias (Centroavante, `brasileirao-serie-b-2026.md:739`) — também em Noroeste

> Os critérios automáticos cobrem só 5 dos 8 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Operário-PR — 50 atletas (excede em 15)

Candidatos, do mais para o menos provável (17 encontrados):

- Kayo José Fernandes Da Luz (Defensor, `brasileirao-serie-b-2026.md:761`) — sem número; nome de registro (base)
- Paulo Guilherme (Goleiro, `brasileirao-serie-b-2026.md:748`) — sem número
- Miguel (Defensor, `brasileirao-serie-b-2026.md:762`) — sem número
- Brenno (Meio-campo, `brasileirao-serie-b-2026.md:772`) — sem número
- Henrique (Meio-campo, `brasileirao-serie-b-2026.md:773`) — sem número
- Jaaziel (Meio-campo, `brasileirao-serie-b-2026.md:774`) — sem número
- Kaua Lucas (Meio-campo, `brasileirao-serie-b-2026.md:775`) — sem número
- Marcos Otávio (Meio-campo, `brasileirao-serie-b-2026.md:776`) — sem número
- Thiago (Meio-campo, `brasileirao-serie-b-2026.md:777`) — sem número
- Maxwell (Ponta Esq., `brasileirao-serie-b-2026.md:778`) — sem número
- Gabriel Cardozo (Atacante, `brasileirao-serie-b-2026.md:789`) — sem número
- Germano (Atacante, `brasileirao-serie-b-2026.md:790`) — sem número
- Jhow Torres (Atacante, `brasileirao-serie-b-2026.md:791`) — sem número
- Jonas (Atacante, `brasileirao-serie-b-2026.md:792`) — sem número
- Matheus Galdino Silva (Atacante, `brasileirao-serie-b-2026.md:793`) — sem número
- Jhan Torres (Defensor, `brasileirao-serie-b-2026.md:760`) — também em Athletic Club
- Luis Felipe De Paula Favero (Meio-campo, `brasileirao-serie-b-2026.md:771`) — nome de registro (base)

### Ponte Preta — 43 atletas (excede em 8)

Candidatos, do mais para o menos provável (12 encontrados):

- João Victor Damião Dos Santos (Atacante, `brasileirao-serie-b-2026.md:838`) — sem número; nome de registro (base)
- Guilherme Martins (Lateral Dir., `brasileirao-serie-b-2026.md:807`) — sem número
- Kawann (Lateral Dir., `brasileirao-serie-b-2026.md:808`) — sem número
- Gabriel (Defensor, `brasileirao-serie-b-2026.md:814`) — sem número
- João Gabriel (Defensor, `brasileirao-serie-b-2026.md:815`) — sem número
- Diogo Mora (Meia Ofensivo, `brasileirao-serie-b-2026.md:821`) — sem número
- Chicão (Meio-campo, `brasileirao-serie-b-2026.md:827`) — sem número
- Matheus (Meio-campo, `brasileirao-serie-b-2026.md:828`) — sem número
- Vitor Ribeiro (Centroavante, `brasileirao-serie-b-2026.md:834`) — sem número
- Lucas Cunha (Zagueiro, `brasileirao-serie-b-2026.md:799`) — também em Confiança
- Lucas Da Sliva Justen (Defensor, `brasileirao-serie-b-2026.md:809`) — nome de registro (base)
- Julio De Oliveira (Defensor, `brasileirao-serie-b-2026.md:813`) — nome de registro (base)

### São Bernardo — 37 atletas (excede em 2)

Candidatos, do mais para o menos provável (4 encontrados):

- Matheus Nogueira (Goleiro, `brasileirao-serie-b-2026.md:843`) — também em Brusque
- Lucas Lima (Volante, `brasileirao-serie-b-2026.md:857`) — também em Goiás
- Daniel Amorim (Centroavante, `brasileirao-serie-b-2026.md:876`) — também em Velo Clube
- Pablo Dyego (Atacante, `brasileirao-serie-b-2026.md:877`) — também em Londrina

### Sport — 47 atletas (excede em 12)

Candidatos, do mais para o menos provável (5 encontrados):

- Fabricio Domínguez (Meio-campo, `brasileirao-serie-b-2026.md:909`) — sem número; também em Cerro Porteño
- João Silva (Zagueiro, `brasileirao-serie-b-2026.md:890`) — sem número
- Dudu Teodora (Centroavante, `brasileirao-serie-b-2026.md:919`) — sem número
- Victor Hugo Barbosa De Farias (Goleiro, `brasileirao-serie-b-2026.md:884`) — nome de registro (base)
- Ze Marcos (Defensor, `brasileirao-serie-b-2026.md:896`) — também em Vitória

> Os critérios automáticos cobrem só 5 dos 12 cortes necessários; o restante precisa de outro critério (ex.: atletas com camisa acima de 40, minutagem).

### Vila Nova — 45 atletas (excede em 10)

Candidatos, do mais para o menos provável (13 encontrados):

- Samuel Lucas De Oliveira Souza (Defensor, `brasileirao-serie-b-2026.md:947`) — sem número; nome de registro (base)
- Guilherme Vieira (Meio-campo, `brasileirao-serie-b-2026.md:958`) — sem número; também em Figueirense
- Kerlon Da Silva Carvalho (Meio-campo, `brasileirao-serie-b-2026.md:959`) — sem número; nome de registro (base)
- Kauã (Goleiro, `brasileirao-serie-b-2026.md:932`) — sem número
- Douglas Mendes (Zagueiro, `brasileirao-serie-b-2026.md:937`) — sem número
- Alex (Defensor, `brasileirao-serie-b-2026.md:943`) — sem número
- Carlão (Defensor, `brasileirao-serie-b-2026.md:944`) — sem número
- Gabriel Delfino (Defensor, `brasileirao-serie-b-2026.md:945`) — sem número
- Gil (Defensor, `brasileirao-serie-b-2026.md:946`) — sem número
- Miguel (Meio-campo, `brasileirao-serie-b-2026.md:960`) — sem número
- João Pedro (Atacante, `brasileirao-serie-b-2026.md:972`) — sem número
- Warley (Atacante, `brasileirao-serie-b-2026.md:973`) — sem número
- André Luis (Ponta Dir., `brasileirao-serie-b-2026.md:964`) — também em Mirassol

### Anápolis — 39 atletas (excede em 4)

Candidatos, do mais para o menos provável (37 encontrados):

- Julio César (LE, `brasileirao-serie-c-2026.md:85`) — sem número; também em Ceará
- Carioca (ZAG, `brasileirao-serie-c-2026.md:69`) — sem número
- Cássio Gabriel (MEI, `brasileirao-serie-c-2026.md:70`) — sem número
- Darlisson (ZAG, `brasileirao-serie-c-2026.md:71`) — sem número
- Fernandinho (PE, `brasileirao-serie-c-2026.md:73`) — sem número
- Fernando Viana (ATA, `brasileirao-serie-c-2026.md:74`) — sem número
- Gabriel Batista (MEI, `brasileirao-serie-c-2026.md:75`) — sem número
- Gabriel Ribeiro (GOL, `brasileirao-serie-c-2026.md:76`) — sem número
- Gharib (VOL, `brasileirao-serie-c-2026.md:77`) — sem número
- Giva Santos (VOL, `brasileirao-serie-c-2026.md:78`) — sem número
- Gonzalo Fornari (ATA, `brasileirao-serie-c-2026.md:79`) — sem número
- Helder (ZAG, `brasileirao-serie-c-2026.md:81`) — sem número
- Igor Souza (ZAG, `brasileirao-serie-c-2026.md:82`) — sem número
- João Borim (VOL, `brasileirao-serie-c-2026.md:83`) — sem número
- João Vítor (ATA, `brasileirao-serie-c-2026.md:84`) — sem número
- Juninho (MC, `brasileirao-serie-c-2026.md:86`) — sem número
- Kaik Viçoza (LD, `brasileirao-serie-c-2026.md:87`) — sem número
- Kauan (ZAG, `brasileirao-serie-c-2026.md:88`) — sem número
- Kauan Guilherme (VOL, `brasileirao-serie-c-2026.md:89`) — sem número
- Leonan (LE, `brasileirao-serie-c-2026.md:90`) — sem número
- Lucas Kallyel (VOL, `brasileirao-serie-c-2026.md:91`) — sem número
- Lucas Mila (VOL, `brasileirao-serie-c-2026.md:92`) — sem número
- Luiz Felipe (MC, `brasileirao-serie-c-2026.md:93`) — sem número
- Márcio Defendi (GOL, `brasileirao-serie-c-2026.md:94`) — sem número
- Matheus Lagoa (PD, `brasileirao-serie-c-2026.md:95`) — sem número
- Mayron (ZAG, `brasileirao-serie-c-2026.md:96`) — sem número
- Patrick (MEI, `brasileirao-serie-c-2026.md:97`) — sem número
- Rafael Costa (ZAG, `brasileirao-serie-c-2026.md:98`) — sem número
- Ravel Pelegrini (GOL, `brasileirao-serie-c-2026.md:99`) — sem número
- Robson Reis (ZAG, `brasileirao-serie-c-2026.md:100`) — sem número
- Rodriguinho (PD, `brasileirao-serie-c-2026.md:101`) — sem número
- Rubinho (LD, `brasileirao-serie-c-2026.md:102`) — sem número
- Samuel (VOL, `brasileirao-serie-c-2026.md:103`) — sem número
- Victor Hugo (GOL, `brasileirao-serie-c-2026.md:104`) — sem número
- Vinícius Lucas (VOL, `brasileirao-serie-c-2026.md:105`) — sem número
- Vitor Fonseca (MEI, `brasileirao-serie-c-2026.md:106`) — sem número
- Ygor (GOL, `brasileirao-serie-c-2026.md:107`) — sem número

### Figueirense — 37 atletas (excede em 2)

Candidatos, do mais para o menos provável (14 encontrados):

- Choco (MEI, `brasileirao-serie-c-2026.md:322`) — sem número
- Emerson Galego (PD, `brasileirao-serie-c-2026.md:325`) — sem número
- Jean Gabriel (MEI, `brasileirao-serie-c-2026.md:334`) — sem número
- Jhonathan Reis (ZAG, `brasileirao-serie-c-2026.md:336`) — sem número
- Jhonnathan (ZAG, `brasileirao-serie-c-2026.md:337`) — sem número
- João Marcos (ATA, `brasileirao-serie-c-2026.md:338`) — sem número
- Júnior (GOL, `brasileirao-serie-c-2026.md:340`) — sem número
- Maiky (ATA, `brasileirao-serie-c-2026.md:344`) — sem número
- Mailson (PE, `brasileirao-serie-c-2026.md:345`) — sem número
- Vavá (GOL, `brasileirao-serie-c-2026.md:352`) — sem número
- Vitor Ricardo (LD, `brasileirao-serie-c-2026.md:353`) — sem número
- Zé Carlos (PD, `brasileirao-serie-c-2026.md:354`) — sem número
- Guilherme Vieira (PE, `brasileirao-serie-c-2026.md:330`) — também em Vila Nova
- Lucas Dias (ZAG, `brasileirao-serie-c-2026.md:343`) — também em Ituano

### Cerro Porteño — 37 atletas (excede em 2)

Candidatos, do mais para o menos provável (9 encontrados):

- Fabricio Domínguez (LD, `copa-libertadores-2026.md:490`) — sem número; também em Sport
- Manuel Roffo (GOL, `copa-libertadores-2026.md:477`) — sem número
- Ángel Martínez (GOL, `copa-libertadores-2026.md:478`) — sem número
- Lucas Merolla (ZAG, `copa-libertadores-2026.md:482`) — sem número
- Alexis Cañete (ZAG, `copa-libertadores-2026.md:483`) — sem número
- Alan Núñez (LD, `copa-libertadores-2026.md:491`) — sem número
- Iván Ramírez (LD, `copa-libertadores-2026.md:492`) — sem número
- Agustín Almendra (MC, `copa-libertadores-2026.md:496`) — sem número
- Derlis Rodríguez (PE, `copa-libertadores-2026.md:505`) — sem número

## 7. Outros achados

- **Galo Maringá é cópia do Maringá.** O bloco `### Galo Maringá` (`estaduais-1a-divisao-2026.md:1528`) tem os mesmos 29 atletas, posições e números do Maringá (`brasileirao-serie-c-2026.md:557` e `estaduais-1a-divisao-2026.md:1608`). A nota diz "importado do Série C", mas o Galo Maringá não disputa a Série C; é um clube diferente do Maringá FC. Sugestão: tratar o Galo Maringá como sem elenco nominal (ficou fora dos destaques).
- **Acento decomposto (NFD):** "Lucas Bonifácio" está gravado com o acento como caractere combinante (U+0301) em `brasileirao-serie-c-2026.md:574`, `estaduais-1a-divisao-2026.md:1546`, `estaduais-1a-divisao-2026.md:1626`. Um parser que compara strings sem normalizar para NFC trata esse nome como diferente de "Lucas Bonifácio".
- **Marcador duplo:** 391 linhas de `estaduais-1a-divisao-2026.md` começam com `- - ` (blocos importados das séries, ex.: Volta Redonda e Galo Maringá). Um parser estrito do formato `- <posição> | ...` perde esses atletas.
- **Tomás Pochettino** aparece no elenco do Fortaleza (Série B) e no do Vitória (Série A); por isso ele não foi usado como destaque de nenhum dos dois.
- **Saída conhecida após o snapshot:** Mikel Amondarain (Estudiantes, `copa-libertadores-2026.md`) foi vendido ao Bologna no fim de julho/2026, segundo a CONMEBOL (https://gol.conmebol.com/libertadores/en/news/estudiantes-2026-conmebol-libertadores-results-squad-and-schedule).
- **Hulk** está no elenco do Fluminense (Série A, julho/2026) e não no do Atlético Mineiro; a pesquisa web confirma gols dele pelo Fluminense em 2026. O mesmo vale para Pablo Vegetti, listado no Cerro Porteño e não no Vasco.
- **Clubes com título sem atletas:** `### Vitória — elenco Baianão (time alternativo jan/2026) [parcial]` (estaduais) e `### Botafogo / Bahia` (Libertadores).
- **Conflitos de camisa já documentados nos brutos** (ex.: América-MG #7, Vila Nova #9) não foram revisados aqui; ver as seções "Divergências casadas" de cada arquivo.

## 8. Tabela-resumo

| Clube | Divisão/origem | Atletas | Destaques | Alertas |
|---|---|---:|---:|---|
| Athletico Paranaense | Série A | 33 | 3 (1C) | união 34 > canônico 33; 1 atleta(s) também em outro clube; nome repetido no elenco (Dudu) |
| Atlético Mineiro | Série A | 32 | 3 | 1 atleta(s) também em outro clube |
| Bahia | Série A | 32 | 3 | 2 atleta(s) também em outro clube |
| Botafogo | Série A | 35 | 1 (1C) | 2 atleta(s) também em outro clube |
| Chapecoense | Série A | 35 | 1 | destaque sem evidência na web |
| Corinthians | Série A + Libertadores | 34 | 3 (2C) | 1 atleta(s) também em outro clube |
| Coritiba | Série A | 32 | 2 | 1 atleta(s) também em outro clube |
| Cruzeiro | Série A + Libertadores | 32 | 4 (2C) | 3 atleta(s) também em outro clube |
| Flamengo | Série A + Libertadores | 28 | 4 (4C) | união 29 > canônico 28 |
| Fluminense | Série A + Libertadores | 33 | 4 | — |
| Grêmio | Série A | 33 | 2 (1C) | — |
| Internacional | Série A | 33 | 2 | — |
| Mirassol | Série A + Libertadores | 33 | 2 | união 40 > canônico 33; 5 atleta(s) também em outro clube |
| Palmeiras | Série A + Libertadores | 31 | 3 (1C) | — |
| Red Bull Bragantino | Série A | 38 | 3 | união 39 > canônico 38; 1 atleta(s) também em outro clube; 38 atletas (excede 35 em 3) |
| Remo | Série A | 34 | 2 | 2 atleta(s) também em outro clube |
| Santos | Série A | 35 | 3 (1C) | — |
| São Paulo | Série A | 42 | 1 | 42 atletas (excede 35 em 7) |
| Vasco da Gama | Série A | 33 | 2 | união 35 > canônico 33; 2 atleta(s) também em outro clube |
| Vitória | Série A | 37 | 1 | 5 atleta(s) também em outro clube; 37 atletas (excede 35 em 2) |
| América Mineiro | Série B | 48 | 2 | união 49 > canônico 48; 1 atleta(s) também em outro clube; 48 atletas (excede 35 em 13) |
| Athletic Club | Série B | 57 | 1 | 5 atleta(s) também em outro clube; 57 atletas (excede 35 em 22) |
| Atlético Goianiense | Série B | 56 | 1 | 1 atleta(s) também em outro clube; 56 atletas (excede 35 em 21) |
| Avaí | Série B | 43 | 1 | 4 atleta(s) também em outro clube; 43 atletas (excede 35 em 8) |
| Botafogo-SP | Série B | 45 | 1 | 1 atleta(s) também em outro clube; 45 atletas (excede 35 em 10) |
| Ceará | Série B | 41 | 1 | 2 atleta(s) também em outro clube; 41 atletas (excede 35 em 6) |
| CRB | Série B | 43 | 1 | 3 atleta(s) também em outro clube; 43 atletas (excede 35 em 8) |
| Criciúma | Série B | 40 | 1 | 40 atletas (excede 35 em 5) |
| Cuiabá | Série B | 51 | 1 | 4 atleta(s) também em outro clube; 51 atletas (excede 35 em 16); destaque sem evidência na web |
| Fortaleza | Série B | 38 | 1 | união 41 > canônico 38; 4 atleta(s) também em outro clube; 38 atletas (excede 35 em 3); destaque sem evidência na web |
| Goiás | Série B | 34 | 1 | 3 atleta(s) também em outro clube |
| Juventude | Série B | 50 | 1 | 2 atleta(s) também em outro clube; nome repetido no elenco (Marcos Paulo); 50 atletas (excede 35 em 15); destaque sem evidência na web |
| Londrina | Série B | 45 | 1 | 2 atleta(s) também em outro clube; 45 atletas (excede 35 em 10); destaque sem evidência na web |
| Náutico | Série B | 45 | 2 | união 47 > canônico 45; 3 atleta(s) também em outro clube; 45 atletas (excede 35 em 10) |
| Novorizontino | Série B | 43 | 2 | 1 atleta(s) também em outro clube; 43 atletas (excede 35 em 8) |
| Operário-PR | Série B | 50 | 1 | 1 atleta(s) também em outro clube; 50 atletas (excede 35 em 15) |
| Ponte Preta | Série B | 43 | 1 | 1 atleta(s) também em outro clube; 43 atletas (excede 35 em 8) |
| São Bernardo | Série B | 37 | 1 | 4 atleta(s) também em outro clube; 37 atletas (excede 35 em 2) |
| Sport | Série B | 47 | 2 | união 48 > canônico 47; 2 atleta(s) também em outro clube; 47 atletas (excede 35 em 12) |
| Vila Nova | Série B | 45 | 1 | 2 atleta(s) também em outro clube; 45 atletas (excede 35 em 10) |
| Amazonas | Série C | 33 | 1 | — |
| Anápolis | Série C | 39 | 1 | 1 atleta(s) também em outro clube; 39 atletas (excede 35 em 4); destaque sem evidência na web |
| Barra-SC | Série C | 34 | 1 | 2 atleta(s) também em outro clube; destaque sem evidência na web |
| Botafogo-PB | Série C | 35 | 1 | 2 atleta(s) também em outro clube |
| Brusque | Série C | 33 | 2 | 1 atleta(s) também em outro clube |
| Caxias | Série C | 31 | 1 | 2 atleta(s) também em outro clube; destaque sem evidência na web |
| Confiança | Série C | 34 | 1 | 1 atleta(s) também em outro clube; destaque sem evidência na web |
| Ferroviária | Série C | 29 | 1 | 3 atleta(s) também em outro clube |
| Figueirense | Série C | 37 | 1 | 2 atleta(s) também em outro clube; 37 atletas (excede 35 em 2); destaque sem evidência na web |
| Floresta | Série C | 30 | 1 | 1 atleta(s) também em outro clube; destaque sem evidência na web |
| Guarani | Série C | 33 | 1 | 1 atleta(s) também em outro clube |
| Inter de Limeira | Série C | 34 | 1 | 1 atleta(s) também em outro clube |
| Itabaiana | Série C | 31 | 1 | 2 atleta(s) também em outro clube; destaque sem evidência na web |
| Ituano | Série C | 27 | 1 | 3 atleta(s) também em outro clube |
| Maranhão | Série C | 34 | 1 | 2 atleta(s) também em outro clube; destaque sem evidência na web |
| Maringá | Série C | 29 | 1 | — |
| Paysandu | Série C | 35 | 2 | — |
| Santa Cruz | Série C | 33 | 2 | — |
| Volta Redonda | Série C | 33 | 1 | destaque sem evidência na web |
| Ypiranga-RS | Série C | 30 | 1 | 1 atleta(s) também em outro clube; destaque sem evidência na web |
| Velo Clube | Estadual (só estaduais) | 11 | 1 | 3 atleta(s) também em outro clube; 1 goleiro(s); 11 atletas; destaque sem evidência na web |
| Portuguesa | Estadual (só estaduais) | 11 | 1 | 3 atleta(s) também em outro clube; 1 goleiro(s); 11 atletas; destaque sem evidência na web |
| Primavera | Estadual (só estaduais) | 32 | 1 | 6 atleta(s) também em outro clube; destaque sem evidência na web |
| Capivariano | Estadual (só estaduais) | 12 | 1 | 4 atleta(s) também em outro clube; 1 goleiro(s); 12 atletas; destaque sem evidência na web |
| Noroeste | Estadual (só estaduais) | 13 | 1 | 2 atleta(s) também em outro clube; 1 goleiro(s); 13 atletas; destaque sem evidência na web |
| Jacuipense | Estadual (só estaduais) | 13 | 1 | 1 atleta(s) também em outro clube; 13 atletas |
| Juazeirense | Estadual (só estaduais) | 20 | 1 | 1 atleta(s) também em outro clube; 1 goleiro(s) |
| Atlético de Alagoinhas | Estadual (só estaduais) | 2 | 1 | 0 goleiro(s); 2 atletas; destaque sem evidência na web |
| Galícia | Estadual (só estaduais) | 4 | 1 | 0 goleiro(s); 4 atletas; destaque sem evidência na web |
| Estudiantes | Libertadores (estrangeiro) | 33 | 3 (1C) | — |
| Independiente Rivadavia | Libertadores (estrangeiro) | 25 | 1 | — |
| Universidad Católica | Libertadores (estrangeiro) | 24 | 1 | — |
| Coquimbo Unido | Libertadores (estrangeiro) | 31 | 2 | — |
| Cerro Porteño | Libertadores (estrangeiro) | 37 | 2 | 1 atleta(s) também em outro clube; 37 atletas (excede 35 em 2) |
| LDU Quito | Libertadores (estrangeiro) | 25 | 1 | destaque sem evidência na web |
| Independiente del Valle | Libertadores (estrangeiro) | 21 | 1 | — |
| Rosario Central | Libertadores (estrangeiro) | 30 | 1 (1C) | — |
| Platense | Libertadores (estrangeiro) | 23 | 1 | destaque sem evidência na web |
| Deportes Tolima | Libertadores (estrangeiro) | 21 | 1 | destaque sem evidência na web |
| Galo Maringá | Estadual (só estaduais) | 29 | 0 | bloco é cópia exata do Maringá; tratar como sem elenco |

Legenda: em "Destaques", `(nC)` indica quantos são `craque`. Total: 15 craques e 104 destaques em 79 clubes.

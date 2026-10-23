# ADR 0015 — Variância do motor de partidas e partida ao vivo

- Status: aceito
- Data: 2026-10-23

## Contexto

O responsável relatou que as partidas pareciam sempre iguais: os mesmos jogadores decidindo, os mesmos placares e
probabilidades, os mesmos lances e pausas sempre nos mesmos minutos. A medição (`tools/sim-lab/reports/variance-before.md`,
7.600 partidas do catálogo com sementes variadas) confirmou parte disso no `match-v3`: o xG pré-jogo era idêntico em
todo confronto repetido (desvio 0), chances não tinham autor nem tipo de lance, a narração tinha 7 modelos de frase
(1 para gol; 87% das linhas repetiam um modelo já usado na mesma partida), o feed parava 5 vezes em 15/30/45/60/75 e
os gols se concentravam no começo (19,6% entre 1 e 15 min, 15,1% depois dos 76) por um artefato da correção de
conversão. Placares já eram razoavelmente variados (entropia 4,87 bits). A decisão 18 do `docs/09` exige que a partida
pare sozinha só no intervalo e no fim, com pausa manual em qualquer minuto; a decisão 19, que o campo animado rode ao
vivo desde o apito.

## Decisão

1. **`match-v4`** (`ENGINE_VERSION`), puro e determinístico como os ADRs 0001/0002: a semente por partida continua
   `career-seed:<carreira>:<partida>`. O jogo é simulado minuto a minuto; cada lado e minuto tem seu próprio fluxo
   PRNG e uma instrução no minuto m é aplicada antes de m+1. Assim o prefixo é estável em **qualquer** minuto
   (não mais só em 15/30/45/60/75), e domínio e contrato aceitam instruções em minutos inteiros de 0 a 93.
2. **Forma do dia e inspiração** por atleta (e um "dia do time"), sorteadas pela semente da partida e moduladas pela
   regularidade: o mesmo confronto tem expectativa diferente a cada jogo (`calculateMatchExpectation`);
   `calculateMatchup` segue nominal para prévias e calibração.
3. **Tipos de lance** (trama, contra-ataque, jogada individual, cruzamento, chute de fora, erro de saída) pesados pela
   tática dos dois lados, com finalizador, assistente e desfecho (gol, defesa, para fora, bloqueio, trave). A escolha
   do finalizador pesa posição, características, forma e decisivo, com amortecimento por finalizações e gols já
   feitos na partida. Bola parada e batedores ficam fora do MVP.
4. **Ritmo**: jogo mais aberto ou travado, períodos mais calmos ou intensos, momentos de pressão, efeito do placar
   depois dos 55 min, expulsão tira o atleta e enfraquece o time, lesão força a troca, substituições automáticas em
   minutos sorteados escolhem o reserva que melhor encaixa.
5. **Narração** (`@footebas/engine/narration`, `narracao-ptbr-v1`): pura, em português do Brasil, com dezenas de
   modelos por lance, desfecho e contexto (placar, minuto, doblete, gol tardio, clássico quando houver o dado),
   escolhidos pela chave da partida e pelo próprio evento evitando repetição recente. Também é estável no prefixo.
6. **Partida ao vivo**: o feed só para no intervalo e no fim; a pausa manual envia substituição ou ajuste no minuto do
   relógio e a prévia continua logo depois do que já foi mostrado. A tela ao vivo mostra placar grande com emblemas,
   a narração e só o campo (`MatchStage` com `bare`), dirigido pelo relógio do feed a 0,5×/1×/2×/4×; estatísticas e
   lance a lance ficam abaixo da dobra.

## Consequências

- Medição depois (`variance-after.md`, mesma amostra): xG pré-jogo do mesmo confronto passa a variar (desvio 0,079) e a
  probabilidade pré-jogo entre times parecidos dobra de dispersão (0,021 → 0,043); entropia de placares 4,87 → 5,09
  bits, placares distintos 70 → 81, placar mais comum 8,0% → 7,2%; artilheiro do time 24,9% → 21,6% dos gols, mesmo
  artilheiro entre carreiras 64,5% → 57,8%, HHI dos finalizadores 0,154 → 0,131; gols no 1º tempo 55,9% → 44,0%
  (mais gols no fim, como no futebol real); aberturas distintas 916 → 5.339; narração com repetição na partida
  87% → 0,4% e nenhuma parada no meio do jogo. O Gini dos finalizadores sobe (0,44 → 0,57) porque goleiro e zagueiros
  quase não marcam mais (no v3 tinham o mesmo peso) e reservas que entram passam a marcar; a concentração no topo caiu.
- As bandas `match-v1-bands-v1` seguem verdes sem ajuste (10.000 partidas: 4,25 gols, mandante 45,3%, vantagem 0,12,
  zebras 17%, favoritismo 0,44 → 0,55 → 0,65). O golden do motor foi regenerado explicitamente.
- **Saves existentes**: a aplicação sempre joga com o `ENGINE_VERSION` atual; resultados já gravados não mudam e as
  próximas partidas de qualquer carreira usam o `match-v4` (o `versions.engine` do save registra a versão de criação).
  Nenhuma migração de dados é necessária.
- O read model de pós-jogo ainda não expõe finalizador, assistente, tipo e desfecho da chance (`contracts` e
  `postMatchModel` em `service.ts` filtram os campos). Até isso ser repassado, o web narra chances pelo perigo (xG);
  expor esses campos é o próximo passo e não exige nova versão do motor.
- O PRNG continua `mulberry32-v1`; as velocidades do read model (`PLAYBACK_SPEEDS`) não mudaram, o 0,5× é do cliente.

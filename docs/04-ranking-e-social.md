# Footebas — Ranking e Camada Social

> Encoda as decisões #3, #4, #9, #13. O ranking global de treinador é a **proposta social-competitiva do V1**
> e a razão de a simulação ser server-authoritative.

---

## 1. Por que o ranking existe

O Brasfoot nunca teve multiplayer online nativo — a socialização era presencial (hotseat). O Footebas moderniza
esse desejo histórico com uma camada **online, assíncrona e competitiva sem multiplayer**: um **ranking global de
treinador**. É o que diferencia o Footebas de um port do Brasfoot.

Multiplayer (ligas privadas, mercado entre humanos, draft, co-op) fica **para depois** (ver `06-roadmap-e-fases.md`).

## 2. Modelo do V1 — Prestígio de carreira

- O **treinador** (não o clube) é a entidade ranqueada. Cada jogador tem uma carreira num universo isolado.
- Pontuação por **títulos crus** (decisão #9, escolhida por simplicidade): títulos nacionais, copa, continental, acessos, longevidade.
- **Server-authoritative** garante que ninguém falsifica conquistas — é a razão técnica do ranking existir com integridade desde o V1.

### Leaderboards segmentados
Para dar arena justa apesar das diferenças de tempo de jogo e de decisão #13:

| Leaderboard | O que mede | Público |
|-------------|-----------|---------|
| **Geral (all-time)** | Soma dos pontos de conquistas (era "Global") | Competidor de longo prazo |
| **Títulos** | Número de títulos (liga, copa, estadual, continental); desempate por pontos | Quem coleciona taças |
| **Melhor temporada** | Maior soma de pontos numa única temporada da carreira | Quem fez uma temporada histórica |
| **Ascensão / Underdog** | Façanhas de clube pequeno: acessos, saltos de divisão, títulos com clube de baixa reputação | Jogador grátis; mitiga o P2W leve |
| **Do mês** | Ganho de prestígio na janela recente | Novatos e retorno |

Regras e pontos: ADR 0013 (pontos, ascensão, mensal, uma carreira por usuário) e ADR 0017 (escopos novos, tempo
real). Em cada leaderboard conta a melhor carreira do usuário; carreiras não se somam.

### Tempo real e toda conta no ranking (ADR 0017)
- O título conta assim que o campeonato termina dentro da carreira, sem esperar o fim da temporada.
- Os totais são gravados na mesma transação da conquista e a leitura é ao vivo (cache de borda de até 30 s).
- Toda conta entra com 0 ao se cadastrar: conta na posição ("você é o 1.234º de 5.000") e no total de
  participantes; a lista pública mostra quem já criou carreira, com o nome de treinador (sem dado pessoal).

## 3. O P2W leve, assumido (decisão #13)

**Contexto:** premium pode escolher qualquer clube; grátis começa de baixo. Começar num clube grande facilita
títulos → vantagem *leve* no leaderboard global por títulos crus. Isso foi **aceito conscientemente**, ajustando o
princípio para **"sem pay-to-win agressivo"** (ver `05-monetizacao.md`).

**Mitigação (não reverte a decisão):** o **leaderboard Ascensão/Underdog** premia exatamente o que o clube grande
*não* entrega — a história do pequeno. Assim o jogador grátis tem uma escada onde compete em pé de igualdade, e a
alma "clube pequeno → topo" continua sendo a mais celebrada.

## 4. Fast-follow — Modo ranqueado normalizado

A camada competitiva "justa por skill", adiada para depois do V1:

- Todos partem da **mesma condição inicial** (mesmo clube, mesma temporada).
- Competição em **janela limitada** (temporada/mensal, reinicia).
- É onde o server-authoritative + **determinismo por seed** (ver `01`) realmente brilham: resultados validáveis, anti-fraude por replay.
- Aqui a vantagem de "escolher clube" não existe — neutraliza o P2W para quem quer competição pura.

## 5. Integridade (o que protege o ranking)

- Cliente **nunca escreve estado de jogo** direto no banco (guard-rail de `01`).
- Toda conquista é computada pelo backend a partir do estado que ele mesmo simulou.
- Determinismo por seed permite **re-simular/validar** partidas quando necessário (essencial para o modo ranqueado).
- Detecção de anomalias (progressão impossível, saltos de estado) → flag/auditoria.

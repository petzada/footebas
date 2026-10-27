# Footebas

![Status](https://img.shields.io/badge/status-em%20desenvolvimento%20ativo-brightgreen) ![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white) ![Turborepo](https://img.shields.io/badge/Turborepo-monorepo-EF4444?logo=turborepo&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

**Simulador de gestão de futebol** mobile-first, determinístico e _server-authoritative_: você assume um clube, monta o elenco e disputa rodadas de menos de um minuto, com consequências reais em tabela, caixa e moral.

## Índice

- [Status do projeto](#status-do-projeto)
- [Demonstração](#demonstração)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos e instalação](#pré-requisitos-e-instalação)
- [Como utilizar](#como-utilizar)
- [Testes](#testes)
- [Contribuição](#contribuição)
- [Licença](#licença)
- [Autor e contato](#autor-e-contato)

## Status do projeto

🟢 **Em desenvolvimento ativo**: o MVP está sendo construído por fases (veja [`ROADMAP-MVP.md`](ROADMAP-MVP.md)), com web e API publicadas no Cloudflare.

## Demonstração

**Loop central do jogo**

```text
Criar carreira → assumir clube → organizar elenco e finanças → escalar e definir tática
→ disputar partida → resultado, renda, moral, lesões e tabela → negociar no mercado
→ avançar rodada → objetivos, acesso, rebaixamento ou demissão
→ nova temporada com elenco envelhecido e novas histórias
```

**Funcionalidades do V1**

- **Treinador e carreira**: crie um treinador, assuma um clube, seja demitido ou receba propostas; ranking e histórico de conquistas.
- **Elenco**: força única (1-100), até 2 características, condição, moral, contrato, lesões e suspensões; atributos ocultos (potencial, consistência...) aparecem só como estimativas.
- **Partidas e ligas** simuladas por um **motor determinístico e seedado**: a mesma semente sempre gera o mesmo resultado, o que permite auditar e testar estatisticamente.
- **Mercado, finanças e progressão** de jogadores ao longo das temporadas.
- **Servidor como autoridade**: toda regra roda na API, o cliente só exibe.

Decisões de produto em [`docs/00-visao-e-decisoes.md`](docs/00-visao-e-decisoes.md) e [`docs/02-funcionalidades-e-gameplay.md`](docs/02-funcionalidades-e-gameplay.md).

**Estrutura do monorepo**

| Pasta                                                      | Conteúdo                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web`                                                 | Front-end Next.js (OpenNext → Cloudflare Workers)               |
| `apps/api`                                                 | API em Cloudflare Workers com Durable Objects por carreira      |
| `apps/worker`                                              | Tarefas em segundo plano                                        |
| `packages/domain`                                          | IDs, `GameDate`, erros e serialização canônica                  |
| `packages/engine`                                          | PRNG, partida, liga e progressão: puros, seedados e versionados |
| `packages/application`, `contracts`, `database`, `content` | Casos de uso, contratos, acesso a dados e conteúdo              |
| `tools/sim-lab`                                            | CLI de Monte Carlo, amostras reais e playthroughs               |

## Tecnologias utilizadas

- **TypeScript** em monorepo **pnpm + Turborepo**
- **Next.js** + **OpenNext** no front-end; **Cloudflare Workers**, **Durable Objects** e **Hyperdrive** na API
- **Supabase (Postgres)** como banco de produção (acessado só pelo CI e pela produção)
- **Vitest**, **Playwright** (E2E), **ESLint** tipado, **oxlint**, **Prettier**, lefthook e GitHub Actions

## Pré-requisitos e instalação

**Pré-requisitos**

- **Node.js 22.14.0** (versão de referência em `.nvmrc`)
- **pnpm 10.6.2** via Corepack
- Nenhum banco, container ou segredo para desenvolver: os testes usam a API em memória

**Instalação**

```bash
git clone https://github.com/petzada/footebas.git
cd footebas
corepack enable
pnpm install --frozen-lockfile    # o prepare instala os hooks do lefthook
```

## Como utilizar

```bash
pnpm smoke            # roda o laboratório de simulação (sim-lab) de forma determinística
pnpm test:phase1      # gate estatístico: 10.000 partidas e 1.000 temporadas completas
pnpm build            # build de todos os apps e pacotes (turbo)
pnpm check:quick      # format check, typecheck, lint e testes só dos pacotes afetados
```

Para rodar a web localmente, entre em `apps/web` e use `pnpm dev`. O deploy de web e API é feito pelos workflows `deploy-web.yml` e `deploy-api.yml` a cada merge na `main` (detalhes em [`docs/deploy.md`](docs/deploy.md)).

## Testes

```bash
pnpm test             # todos os testes (turbo run test)
pnpm test:related     # só os pacotes afetados pelo branch
pnpm typecheck
pnpm lint
pnpm check            # o mesmo que o CI: format, typecheck, lint tipado, testes, build e smoke
```

O **lefthook** roda Prettier e oxlint no commit e typecheck + testes dos pacotes afetados no push. O CI completo (incluindo bundle e E2E com Playwright) roda quando o PR fica pronto e na `main`.

## Contribuição

Contribuições são bem-vindas! Para propor uma melhoria:

1. Abra uma **issue** descrevendo o problema ou a ideia antes de começar algo grande.
2. Faça um **fork** e crie um branch a partir da `main`: `<tipo>/<nome-kebab>` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
3. Use **commits semânticos** em português: `<tipo>(<escopo>): <descrição no imperativo>`.
4. Rode lint e testes antes de enviar (veja [Testes](#testes)).
5. Abra o **Pull Request** em _draft_, explicando o quê e o porquê. O merge é feito pelo autor.

Não inclua segredos (`.env`, chaves de API, tokens) em commits ou PRs.

Fluxo detalhado e o que roda em cada camada em [`AGENTS.md`](AGENTS.md).

## Licença

Distribuído sob a licença **MIT**, de código aberto. Isso significa que você **pode** usar, copiar, modificar, mesclar, publicar, distribuir, sublicenciar e até vender cópias do código, inclusive em projetos comerciais, **desde que** mantenha o aviso de copyright e o texto da licença. O software é fornecido "no estado em que se encontra", **sem garantias**, e o autor não se responsabiliza por danos decorrentes do uso.

Texto completo em [`LICENSE`](LICENSE).

## Autor e contato

**Marcio Petigrosso** ("petzada"): idealização e desenvolvimento.

- GitHub: [@petzada](https://github.com/petzada)
- LinkedIn: [in/petigrosso](https://www.linkedin.com/in/petigrosso)

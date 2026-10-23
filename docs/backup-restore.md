# Backup e restore do banco

O estado autoritativo do jogo (saves, jobs, arquivo de carreiras, billing) vive no schema `footebas` do Postgres do
Supabase (projeto `wjisqiiwsuykfbmqglfb`, Postgres 17). A API acessa via Hyperdrive; os backups usam conexão
direta ao Postgres. Nenhuma string de conexão ou senha fica no repositório.

## Política

| Camada                    | Frequência                  | Retenção                      | Responsável / onde                                      |
| ------------------------- | --------------------------- | ----------------------------- | ------------------------------------------------------- |
| Backups do Supabase       | diário (automático)         | conforme o plano              | Supabase → Database → Backups                           |
| PITR do Supabase (add-on) | contínuo                    | conforme o add-on (7–28 dias) | Supabase → Database → Backups → Point in Time           |
| Dump off-site do schema   | semanal (segunda 06:17 UTC) | 30 dias (artefato do Actions) | `.github/workflows/backup.yml` + `scripts/backup-db.sh` |
| Teste de restore          | trimestral                  | registro no histórico abaixo  | pessoa responsável, num banco descartável               |

- **Plano do Supabase:** no plano Free não há backup diário acessível pelo painel. Antes do lançamento, mudar para
  o Pro (backup diário com 7 dias) e avaliar o add-on de PITR quando houver jogadores pagantes. Decisão humana.
- **Off-site:** o dump semanal é a cópia fora do Supabase. Fica como artefato do GitHub Actions por 30 dias (o
  repositório é privado). Se o repositório ficar público, o workflow se recusa a publicar sem `BACKUP_PASSPHRASE`.
- **Escopo do dump:** só o schema `footebas`. Usuários do Supabase Auth (`auth.*`) e Storage não entram; eles são
  cobertos pelos backups do próprio Supabase. As tabelas do jogo guardam o `user_id` do Auth como texto, sem FK.

## Configuração (passos humanos)

1. **Secret `SUPABASE_DB_URL`** (GitHub → Settings → Secrets and variables → Actions): string de conexão do
   **Session pooler** (Supabase → Connect → Session pooler, porta 5432). A conexão direta do Supabase é só IPv6 e
   os runners do GitHub não têm IPv6. Prefira um usuário só de leitura com acesso ao schema `footebas`:

   ```sql
   create role backup_reader with login password '<senha forte>';
   grant usage on schema footebas to backup_reader;
   grant select on all tables in schema footebas to backup_reader;
   grant select on all sequences in schema footebas to backup_reader;
   alter default privileges in schema footebas grant select on tables to backup_reader;
   alter default privileges in schema footebas grant select on sequences to backup_reader;
   ```

   No pooler, o usuário fica `backup_reader.wjisqiiwsuykfbmqglfb`.

2. **Secret `BACKUP_PASSPHRASE`** (recomendado): senha longa para cifrar o artefato com gpg (AES256). Guarde-a
   também no cofre de senhas do responsável; sem ela o backup cifrado é irrecuperável.

3. Rode o workflow uma vez à mão (Actions → backup → Run workflow) e confira o artefato.

Sem o secret `SUPABASE_DB_URL`, o workflow termina com um aviso e não faz nada.

## Fazer um dump à mão

Precisa do cliente do Postgres 17 (`pg_dump`, `pg_restore`, `psql`) e de bash (Linux, macOS, WSL ou Git Bash).

```sh
export DATABASE_URL='postgresql://backup_reader.wjisqiiwsuykfbmqglfb:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres'
scripts/backup-db.sh backups
# → backups/footebas-footebas-20261022T061700Z.dump (+ .sha256)
```

O formato é o custom do `pg_dump` (comprimido); o script confere o arquivo com `pg_restore --list` antes de
terminar. Não deixe `DATABASE_URL` no histórico do shell em máquina compartilhada.

## Restaurar

`scripts/restore-db.sh` restaura num banco **alvo explícito** (`TARGET_DATABASE_URL`), apagando e recriando os
objetos do schema do dump numa única transação. Ele mostra o banco e o servidor alvo e pede para digitar o nome
do banco antes de começar (`RESTORE_CONFIRM=<nome>` para automação).

```sh
# 1. Baixe o artefato (Actions → backup → execução → Artifacts) e extraia.
# 2. Restaure num banco descartável primeiro (ex.: Supabase local):
pnpm exec supabase start
export TARGET_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
scripts/restore-db.sh backups/footebas-footebas-20261022T061700Z.dump.gpg   # pede a senha do gpg
```

### Restaurar em produção (incidente)

1. Prefira o restore do próprio Supabase (backup diário ou PITR) para o projeto inteiro: ele inclui Auth e Storage.
2. Use o dump off-site só se os backups do Supabase não servirem (projeto perdido, janela fora da retenção).
3. Pare as escritas antes: retire a rota da API ou faça deploy de uma versão em manutenção; deixe a fila
   `footebas-simulation` drenar.
4. Restaure num projeto novo ou no atual com `TARGET_DATABASE_URL` apontando para a conexão direta/pooler com um
   usuário dono do schema (o `postgres`), confira com `GET /health` e com o `tools/cloud-smoke`, e só então
   reabra o tráfego.
5. Registre o incidente e o horário do dump usado (perda de dados = desde o dump até o incidente).

## Teste de restore trimestral

A cada trimestre (jan, abr, jul, out), alguém do time:

1. Baixa o artefato mais recente do workflow `backup`.
2. Restaura num banco descartável (Supabase local ou projeto de teste), nunca em produção.
3. Confere contagens básicas e que a API sobe contra ele:

   ```sql
   select count(*) from footebas.game_saves;
   select count(*) from footebas.simulation_jobs;
   ```

4. Anota abaixo a data, o arquivo usado, o tempo de restore e problemas.

| Data | Arquivo | Tempo | Resultado / observações |
| ---- | ------- | ----- | ----------------------- |
|      |         |       |                         |

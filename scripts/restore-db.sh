#!/usr/bin/env bash
# Restaura um dump de scripts/backup-db.sh num banco ALVO explícito.
#
# Uso:
#   TARGET_DATABASE_URL='postgresql://…' scripts/restore-db.sh <arquivo.dump>
#
# - O alvo vem só de TARGET_DATABASE_URL (de propósito, não de DATABASE_URL).
# - Os objetos do schema do dump são apagados e recriados (--clean) numa única
#   transação: se algo falhar, nada muda no alvo.
# - Pede para digitar o nome do banco alvo. Em automação, defina
#   RESTORE_CONFIRM=<nome-do-banco> com o mesmo valor.
# - Arquivos .dump.gpg (backup cifrado do workflow) são decifrados com gpg,
#   que pede a senha (ou use BACKUP_PASSPHRASE no ambiente).
set -euo pipefail

file="${1:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "uso: TARGET_DATABASE_URL=… $0 <arquivo.dump|arquivo.dump.gpg>" >&2
  exit 2
fi
if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "erro: defina TARGET_DATABASE_URL (banco que será sobrescrito)." >&2
  exit 2
fi
for tool in pg_restore psql; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "erro: $tool não encontrado no PATH (instale o cliente do Postgres 17)." >&2
    exit 2
  fi
done

if [[ -f "${file}.sha256" ]] && command -v sha256sum >/dev/null 2>&1; then
  (cd "$(dirname "$file")" && sha256sum --check --quiet "$(basename "$file").sha256")
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
dump="$file"
if [[ "$file" == *.gpg ]]; then
  dump="${workdir}/restore.dump"
  if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
    gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --output "$dump" --decrypt "$file" 3<<<"$BACKUP_PASSPHRASE"
  else
    gpg --quiet --output "$dump" --decrypt "$file"
  fi
fi

# Identifica o alvo sem imprimir credenciais.
target="$(psql "$TARGET_DATABASE_URL" -XAtq -c \
  "select current_database() || ' em ' || coalesce(inet_server_addr()::text, 'socket local') || ':' || current_setting('port')")"
database="${target%% em *}"
schemas="$(pg_restore --list "$dump" | awk '$4 == "SCHEMA" {print $6}' | sort -u | tr '\n' ' ')"

echo "Arquivo:  $file"
echo "Alvo:     $target"
echo "Schemas:  ${schemas:-footebas} (objetos serão APAGADOS e recriados)"

if [[ "${RESTORE_CONFIRM:-}" != "$database" ]]; then
  if [[ ! -t 0 ]]; then
    echo "erro: sem terminal para confirmar; defina RESTORE_CONFIRM=$database." >&2
    exit 3
  fi
  read -r -p "Digite o nome do banco alvo ($database) para confirmar: " answer
  if [[ "$answer" != "$database" ]]; then
    echo "cancelado." >&2
    exit 3
  fi
fi

pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "$dump"

echo "ok: restaurado em $target" >&2

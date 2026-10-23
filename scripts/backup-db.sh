#!/usr/bin/env bash
# Dump do schema `footebas` (Supabase Postgres) em formato custom comprimido.
#
# Uso:
#   DATABASE_URL='postgresql://…' scripts/backup-db.sh [diretório-de-saída]
#
# - DATABASE_URL vem do ambiente (nunca versione). No Supabase, use a string do
#   Session pooler (IPv4, porta 5432); a conexão direta é só IPv6.
# - pg_dump precisa ser da mesma versão major do servidor ou mais nova (17).
# - Saída: <dir>/footebas-<schema>-<AAAAMMDDTHHMMSSZ>.dump e .sha256 ao lado.
#   Restaure com scripts/restore-db.sh.
# - BACKUP_SCHEMA troca o schema (padrão: footebas).
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "erro: defina DATABASE_URL no ambiente (string de conexão do Postgres)." >&2
  exit 2
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "erro: pg_dump não encontrado no PATH (instale o cliente do Postgres 17)." >&2
  exit 2
fi

out_dir="${1:-backups}"
schema="${BACKUP_SCHEMA:-footebas}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${out_dir}/footebas-${schema}-${stamp}.dump"

mkdir -p "$out_dir"
umask 077

echo "pg_dump $(pg_dump --version | awk '{print $NF}') → ${file}" >&2
pg_dump \
  --dbname="$DATABASE_URL" \
  --schema="$schema" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$file"

# Confere que o arquivo é legível pelo pg_restore antes de declarar sucesso.
pg_restore --list "$file" >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$out_dir" && sha256sum "$(basename "$file")" >"$(basename "$file").sha256")
fi

echo "ok: $(du -h "$file" | cut -f1) em ${file}" >&2
echo "$file"

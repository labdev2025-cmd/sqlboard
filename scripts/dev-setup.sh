#!/usr/bin/env bash
# Prepara o ambiente local do sqlboard de forma idempotente:
#   1. garante um PostgreSQL rodando (serviço local ou compose.yaml com Docker);
#   2. cria o papel e os bancos de metadados (dev e teste) e o banco de demonstração;
#   3. cria o usuário somente leitura do banco de demonstração e carrega os dados fictícios;
#   4. roda as migrações e o seed (conexão "Demo").
#
# Variáveis opcionais:
#   ADMIN_DATABASE_URL  URL de um superusuário (padrão: psql como usuário "postgres" local)
#   SKIP_DEMO_DATA=1    não recarrega os dados de demonstração se já existirem
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

META_USER="${META_DB_USER:-sqlboard}"
META_PASSWORD="${META_DB_PASSWORD:-sqlboard}"
DEMO_DB="${DEMO_DB_NAME:-sqlboard_demo}"
DEMO_RO_USER="${DEMO_DB_USER:-sqlboard_demo_ro}"
DEMO_RO_PASSWORD="${DEMO_DB_PASSWORD:-demo_ro_local}"

log() { printf '\033[1;34m[dev-setup]\033[0m %s\n' "$*"; }

# Runs psql as a superuser. "-d <db>" selects the database; with
# ADMIN_DATABASE_URL the database name is swapped inside the URL (psql would
# otherwise ignore the URL host and fall back to the local socket).
psql_admin() {
  local db="postgres" args=()
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "-d" ]]; then
      db="$2"
      shift 2
    else
      args+=("$1")
      shift
    fi
  done
  if [[ -n "${ADMIN_DATABASE_URL:-}" ]]; then
    local url="${ADMIN_DATABASE_URL%/*}/${db}"
    psql "$url" -v ON_ERROR_STOP=1 -q "${args[@]}"
  elif [[ "$(id -u)" == "0" ]] && id postgres >/dev/null 2>&1; then
    su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $(printf '%q' "$db") $(printf '%q ' "${args[@]}")"
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$db" "${args[@]}"
  fi
}

ensure_postgres() {
  if [[ -n "${ADMIN_DATABASE_URL:-}" ]]; then
    for _ in $(seq 1 30); do
      psql "$ADMIN_DATABASE_URL" -c 'select 1' >/dev/null 2>&1 && return 0
      sleep 1
    done
    echo "PostgreSQL inacessível em ADMIN_DATABASE_URL" >&2
    exit 1
  fi
  if command -v pg_isready >/dev/null && pg_isready -q -h localhost; then
    return 0
  fi
  if command -v service >/dev/null && service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1; then
    log "PostgreSQL local iniciado"
  elif command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    log "Subindo PostgreSQL via compose.yaml"
    docker compose up -d postgres
    export ADMIN_DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
  else
    echo "Nenhum PostgreSQL disponível (nem serviço local nem Docker)." >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    pg_isready -q -h localhost && return 0
    sleep 1
  done
  echo "PostgreSQL não respondeu a tempo." >&2
  exit 1
}

ensure_role() {
  local name="$1" password="$2"
  psql_admin -d postgres -c "DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${name}') THEN
      CREATE ROLE ${name} LOGIN PASSWORD '${password}';
    ELSE
      ALTER ROLE ${name} LOGIN PASSWORD '${password}';
    END IF;
  END \$\$;"
}

ensure_database() {
  local name="$1" owner="$2"
  if ! psql_admin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${name}'" | grep -q 1; then
    psql_admin -d postgres -c "CREATE DATABASE ${name} OWNER ${owner}"
    log "Banco ${name} criado"
  fi
}

ensure_postgres

log "Papéis e bancos de metadados"
ensure_role "$META_USER" "$META_PASSWORD"
psql_admin -d postgres -c "ALTER ROLE ${META_USER} CREATEDB"
ensure_database sqlboard "$META_USER"
ensure_database sqlboard_test "$META_USER"

log "Banco de demonstração (${DEMO_DB}) e usuário somente leitura"
ensure_database "$DEMO_DB" "$META_USER"
ensure_role "$DEMO_RO_USER" "$DEMO_RO_PASSWORD"

if [[ "${SKIP_DEMO_DATA:-0}" == "1" ]] && psql_admin -d "$DEMO_DB" -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'loja'" | grep -q 1; then
  log "Dados de demonstração já existem (SKIP_DEMO_DATA=1)"
else
  psql_admin -d "$DEMO_DB" -f scripts/demo/demo.sql
  psql_admin -d "$DEMO_DB" -c "ALTER SCHEMA loja OWNER TO ${META_USER}"
  log "Dados fictícios carregados"
fi

# Defesa principal: o usuário da conexão só tem SELECT e transações somente leitura.
psql_admin -d "$DEMO_DB" -c "
  REVOKE ALL ON DATABASE ${DEMO_DB} FROM PUBLIC;
  GRANT CONNECT ON DATABASE ${DEMO_DB} TO ${DEMO_RO_USER};
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  GRANT USAGE ON SCHEMA loja TO ${DEMO_RO_USER};
  GRANT SELECT ON ALL TABLES IN SCHEMA loja TO ${DEMO_RO_USER};
  ALTER ROLE ${DEMO_RO_USER} SET default_transaction_read_only = on;
  ALTER ROLE ${DEMO_RO_USER} SET statement_timeout = '60s';
"

log "Migrações"
pnpm --silent db:migrate

log "Seed"
pnpm --silent db:seed

log "Pronto. Rode: pnpm dev"

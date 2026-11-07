#!/usr/bin/env bash
# Test de fumée des images Docker `api` et `web` (CI, job « images »).
# Prérequis : images construites (API_IMAGE, WEB_IMAGE) et `npm ci` fait dans api/ (migrations).
# Attrape ce que les tests hors Docker ne voient pas : un COPY oublié, un fichier de test embarqué.
set -euo pipefail

API_IMAGE="${API_IMAGE:-trame-api:smoke}"
WEB_IMAGE="${WEB_IMAGE:-trame-web:smoke}"
POSTGRES_IMAGE="postgres:18@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81"
SUFFIX="$$"
NETWORK="trame-smoke-${SUFFIX}"
DB_PORT=55432
API_PORT=53001
WEB_PORT=53000
WAIT_SECONDS=60
DB_PASSWORD="ci-only"
# Valeur factice : la production exige un secret de session d'au moins 32 caractères.
SESSION_SECRET="smoke-test-secret-smoke-test-secret"
CONTAINERS=(trame-smoke-db-"$SUFFIX" trame-smoke-api-"$SUFFIX" trame-smoke-web-"$SUFFIX")

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    for container in "${CONTAINERS[@]}"; do
      echo "--- journaux de $container ---"
      docker logs "$container" 2>&1 | tail -n 40 || true
    done
  fi
  docker rm --force "${CONTAINERS[@]}" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "ÉCHEC : $*" >&2
  exit 1
}

wait_until() { # description, commande…
  local description=$1
  shift
  for _ in $(seq "$WAIT_SECONDS"); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "$description n'a pas répondu en ${WAIT_SECONDS} s"
}

expect_status() { # url, statut attendu
  local status
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$1")
  [ "$status" = "$2" ] || fail "$1 a répondu $status (attendu $2)"
  echo "OK $1 -> $status"
}

check_image_content() {
  docker run --rm --entrypoint sh "$API_IMAGE" -c '
    test -d migrations && test -f scripts/promote-admin.mjs || exit 10
    test ! -e dist/server.e2e.js || exit 11
    test -f dist/server.js || exit 12
  ' || fail "contenu de l'image api incorrect (code $?) : migrations/, scripts/promote-admin.mjs, dist/server.js attendus, dist/server.e2e.js interdit"
  echo "OK contenu de l'image api"
}

check_image_content

docker network create "$NETWORK" >/dev/null
docker run --detach --name "trame-smoke-db-$SUFFIX" --network "$NETWORK" --network-alias db \
  --publish "127.0.0.1:${DB_PORT}:5432" \
  --env POSTGRES_DB=trame --env POSTGRES_USER=trame --env POSTGRES_PASSWORD="$DB_PASSWORD" \
  "$POSTGRES_IMAGE" >/dev/null
wait_until "la base" docker exec "trame-smoke-db-$SUFFIX" pg_isready -U trame -d trame
# pg_isready répond avant la fin de l'initialisation : attendre une vraie requête.
wait_until "la base (requête)" docker exec "trame-smoke-db-$SUFFIX" psql -U trame -d trame -c 'SELECT 1'

# L'image api n'embarque pas node-pg-migrate : les migrations viennent du dépôt.
(cd "$(dirname "$0")/../api" && DATABASE_URL="postgres://trame:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/trame" npm run migrate:up)

docker run --detach --name "trame-smoke-api-$SUFFIX" --network "$NETWORK" --network-alias api \
  --publish "127.0.0.1:${API_PORT}:3000" \
  --env DATABASE_URL="postgres://trame:${DB_PASSWORD}@db:5432/trame" \
  --env SESSION_SECRET="$SESSION_SECRET" --env TRUST_PROXY=1 \
  "$API_IMAGE" >/dev/null
wait_until "l'api" curl --silent --fail "http://127.0.0.1:${API_PORT}/health"

docker run --detach --name "trame-smoke-web-$SUFFIX" --network "$NETWORK" \
  --publish "127.0.0.1:${WEB_PORT}:3000" \
  --env NUXT_API_BASE=http://api:3000 \
  "$WEB_IMAGE" >/dev/null
wait_until "le web" curl --silent --output /dev/null "http://127.0.0.1:${WEB_PORT}/"

expect_status "http://127.0.0.1:${API_PORT}/health" 200
# Passe par le relais du web : prouve que `shared/` et la configuration sont dans l'image.
expect_status "http://127.0.0.1:${WEB_PORT}/api/v1/works/facets" 200
echo "Test de fumée des images : OK"

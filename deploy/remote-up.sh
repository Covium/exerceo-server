#!/usr/bin/env sh
set -eu

IMAGE="${EXERCEO_SERVER_IMAGE:?EXERCEO_SERVER_IMAGE is required}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?GHCR_USER is required}" --password-stdin
fi

export EXERCEO_SERVER_IMAGE="$IMAGE"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-build --remove-orphans

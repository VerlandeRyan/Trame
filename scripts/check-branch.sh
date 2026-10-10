#!/bin/sh
# Vérifie le préfixe de branche : type/12-slug (docs/conventions-projet.md §3).
b=$(git rev-parse --abbrev-ref HEAD)

if [ "$b" = "main" ] || [ "$b" = "HEAD" ]; then
  exit 0
fi

if ! printf '%s' "$b" | grep -Eq '^(feat|fix|docs|chore|refactor|hotfix)/[0-9]+-[a-z0-9-]+$'; then
  echo "Branche '$b' invalide : attendu type/12-slug (feat, fix, docs, chore, refactor, hotfix)." >&2
  exit 1
fi

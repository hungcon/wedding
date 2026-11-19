#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  exec npx --yes wrangler@4.165.0 deploy "$@"
fi

wedding_secrets_file="$(mktemp "${TMPDIR:-/tmp}/wedding-worker-secrets.XXXXXXXXXX")"
trap 'rm -f -- "$wedding_secrets_file"' EXIT

node -e 'process.stdout.write(JSON.stringify({ ADMIN_PASSWORD: process.env.ADMIN_PASSWORD }));' > "$wedding_secrets_file"
unset ADMIN_PASSWORD
npx --yes wrangler@4.165.0 deploy --secrets-file "$wedding_secrets_file" "$@"

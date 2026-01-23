#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PROD_BASE_URL:?PROD_BASE_URL is required}"
EXPECTED_SHA="${GITHUB_SHA:?GITHUB_SHA is required}"

MAX_TRIES="${PROD_PROOF_MAX_TRIES:-30}"
SLEEP_SECONDS="${PROD_PROOF_SLEEP_SECONDS:-5}"

last_json=""
last_git_sha=""

for ((i=1; i<=MAX_TRIES; i++)); do
  set +e
  json="$(curl -fsS "$BASE_URL/api/build-info" 2>/dev/null)"
  curl_status=$?
  set -e

  if [[ $curl_status -ne 0 ]]; then
    last_json=""
    last_git_sha=""
  else
    last_json="$json"
    last_git_sha="$(node -e "try{const j=JSON.parse(process.argv[1]); process.stdout.write(((j.git_sha||'')+'').trim());}catch(e){process.stdout.write('');}" "$json")"
  fi

  if [[ -n "$last_git_sha" && "$last_git_sha" == "$EXPECTED_SHA" ]]; then
    echo "OK: Production git_sha matches HEAD: $last_git_sha"
    exit 0
  fi

  if [[ $i -lt MAX_TRIES ]]; then
    sleep "$SLEEP_SECONDS"
  fi
done

if [[ -z "$last_json" ]]; then
  echo "ERROR: Could not fetch $BASE_URL/api/build-info successfully after $MAX_TRIES tries."
  exit 1
fi

if [[ -z "$last_git_sha" ]]; then
  echo "ERROR: build-info did not contain git_sha after $MAX_TRIES tries. Full JSON:"
  echo "$last_json"
  exit 1
fi

echo "ERROR: Production SHA mismatch after $MAX_TRIES tries."
echo "Expected: $EXPECTED_SHA"
echo "Got:      $last_git_sha"
echo "Full JSON:"
echo "$last_json"
exit 1

#!/usr/bin/env bash
# Runs the checks a CI pipeline would run: install, type check, tests, and a
# smoke test against the real server using the files in sample-data/.
set -euo pipefail

cd "$(dirname "$0")/.."

WORK_DIR="$(mktemp -d)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  if [ -f "$WORK_DIR/server.log" ]; then
    printf -- '--- server log ---\n' >&2
    cat "$WORK_DIR/server.log" >&2
  fi
  exit 1
}

free_port() {
  node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})"
}

start_server() {
  local port="$1"
  local settlement_fail="$2"
  PORT="$port" SETTLEMENT_FAIL="$settlement_fail" ./node_modules/.bin/tsx src/main.ts >"$WORK_DIR/server.log" 2>&1 &
  SERVER_PID=$!

  for _ in $(seq 1 50); do
    if curl -sf --max-time 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  fail "server did not become healthy on port $port"
}

stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

# post_exception <base-url> <label> <json-body> <expected-status> <expected-text>
post_exception() {
  local base_url="$1" label="$2" body="$3" expected_status="$4" expected_text="$5"
  local response status payload

  response="$(curl -s --max-time 5 -w '\n%{http_code}' -X POST "$base_url/exceptions" \
    -H 'content-type: application/json' --data "$body")"
  status="${response##*$'\n'}"
  payload="${response%$'\n'*}"

  [ "$status" = "$expected_status" ] || fail "$label: expected HTTP $expected_status, got $status ($payload)"
  case "$payload" in
    *"$expected_text"*) ;;
    *) fail "$label: response does not contain $expected_text ($payload)" ;;
  esac
  case "$payload" in
    *123456789*) fail "$label: response leaked a raw account number ($payload)" ;;
  esac
  printf 'ok  %s\n' "$label"
}

step "Install dependencies"
npm install

step "Type check"
npm run typecheck

step "Unit and acceptance tests"
npm test

step "Smoke test: normal run (real server, sample-data/)"
PORT_NORMAL="$(free_port)"
BASE_NORMAL="http://127.0.0.1:$PORT_NORMAL"
start_server "$PORT_NORMAL" "false"

[ "$(curl -s --max-time 5 "$BASE_NORMAL/health")" = '{"status":"ok"}' ] || fail "health check"
printf 'ok  GET /health\n'

post_exception "$BASE_NORMAL" "insufficient funds is queued" \
  "$(cat sample-data/insufficient-funds.json)" 201 '"action":"QUEUE_REVIEW"'
post_exception "$BASE_NORMAL" "insufficient funds masks the BSB" \
  "$(cat sample-data/insufficient-funds.json)" 201 '"maskedBsb":"***-001"'
post_exception "$BASE_NORMAL" "duplicate payment is auto-closed" \
  "$(cat sample-data/duplicate-payment.json)" 201 '"action":"AUTO_CLOSE"'
post_exception "$BASE_NORMAL" "unknown reason goes to a human" \
  "$(cat sample-data/unknown-reason.json)" 201 '"action":"NEEDS_HUMAN"'
post_exception "$BASE_NORMAL" "invalid BSB is rejected" \
  "$(cat sample-data/invalid-bsb.json)" 422 'bsb must be in the format XXX-XXX'

while IFS= read -r line; do
  [ -n "$line" ] || continue
  post_exception "$BASE_NORMAL" "exceptions.jsonl line accepted" "$line" 201 '"status":'
done <sample-data/exceptions.jsonl

stop_server

step "Smoke test: settlement down (SETTLEMENT_FAIL=true)"
PORT_DEGRADED="$(free_port)"
start_server "$PORT_DEGRADED" "true"
post_exception "http://127.0.0.1:$PORT_DEGRADED" "settlement failure degrades the case" \
  "$(cat sample-data/insufficient-funds.json)" 201 '"status":"DEGRADED"'
stop_server

printf '\nVERIFY PASSED\n'

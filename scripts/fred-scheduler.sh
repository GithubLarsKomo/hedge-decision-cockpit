#!/bin/sh
set -eu

SYNC_URL="${FRED_SYNC_URL:-http://app:3000/api/market-data/fred/sync}"
SYNC_TIME="${FRED_SYNC_TIME:-22:30}"
POLL_SECONDS="${FRED_SYNC_POLL_SECONDS:-60}"
STATE_FILE="${FRED_SYNC_STATE_FILE:-/app/data/.fred-sync-last-date}"

require_configuration() {
  if [ -z "${N8N_INGEST_TOKEN:-}" ]; then
    echo "fred-scheduler: N8N_INGEST_TOKEN is required." >&2
    exit 1
  fi

  case "$SYNC_TIME" in
    [0-2][0-9]:[0-5][0-9]) ;;
    *)
      echo "fred-scheduler: FRED_SYNC_TIME must use HH:MM." >&2
      exit 1
      ;;
  esac

  hour="${SYNC_TIME%:*}"
  minute="${SYNC_TIME#*:}"
  if [ "$hour" -gt 23 ]; then
    echo "fred-scheduler: FRED_SYNC_TIME hour must be between 00 and 23." >&2
    exit 1
  fi

  case "$POLL_SECONDS" in
    ''|*[!0-9]*)
      echo "fred-scheduler: FRED_SYNC_POLL_SECONDS must be a positive integer." >&2
      exit 1
      ;;
  esac
  if [ "$POLL_SECONDS" -lt 5 ]; then
    echo "fred-scheduler: FRED_SYNC_POLL_SECONDS must be at least 5 seconds." >&2
    exit 1
  fi
}

sync_once() {
  trigger="$1"
  echo "fred-scheduler: starting FRED sync (trigger=$trigger, url=$SYNC_URL)."

  if response="$(curl -fsS \
    --connect-timeout 10 \
    --max-time 120 \
    -X POST \
    -H "Authorization: Bearer ${N8N_INGEST_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{}' \
    "$SYNC_URL")"; then
    echo "fred-scheduler: FRED sync succeeded: $response"
    return 0
  fi

  echo "fred-scheduler: FRED sync failed; it will be retried on the next scheduler poll." >&2
  return 1
}

write_state() {
  date_value="$1"
  state_dir="$(dirname "$STATE_FILE")"
  mkdir -p "$state_dir"
  tmp_file="${STATE_FILE}.tmp.$$"
  printf '%s\n' "$date_value" > "$tmp_file"
  mv "$tmp_file" "$STATE_FILE"
}

read_state() {
  if [ -f "$STATE_FILE" ]; then
    head -n 1 "$STATE_FILE" 2>/dev/null || true
  fi
}

scheduled_run_due() {
  target_hour="${SYNC_TIME%:*}"
  target_minute="${SYNC_TIME#*:}"
  current_hour="$(date +%H)"
  current_minute="$(date +%M)"

  target_hour="${target_hour#0}"
  target_minute="${target_minute#0}"
  current_hour="${current_hour#0}"
  current_minute="${current_minute#0}"

  [ -n "$target_hour" ] || target_hour=0
  [ -n "$target_minute" ] || target_minute=0
  [ -n "$current_hour" ] || current_hour=0
  [ -n "$current_minute" ] || current_minute=0

  target_total=$((target_hour * 60 + target_minute))
  current_total=$((current_hour * 60 + current_minute))
  [ "$current_total" -ge "$target_total" ]
}

require_configuration

if [ "${1:-}" = "--once" ]; then
  sync_once manual
  exit $?
fi

printf 'fred-scheduler: active; daily sync at %s (%s), poll=%ss.\n' \
  "$SYNC_TIME" "${TZ:-container-local-time}" "$POLL_SECONDS"

while true; do
  today="$(date +%Y-%m-%d)"
  last_success="$(read_state)"

  if [ "$last_success" != "$today" ] && scheduled_run_due; then
    if sync_once scheduled; then
      write_state "$today"
    fi
  fi

  sleep "$POLL_SECONDS"
done

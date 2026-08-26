#!/usr/bin/env bash
set -euo pipefail

# Debug helper for Custom (OpenAI-compatible) model listings and CORS/preflight.
# Usage:
#   bash scripts/debug-custom-models.sh
#
# It reads:
#   - CUSTOM_BASE_URL (defaults to http://127.0.0.1:1234/v1)
#   - CUSTOM_API_KEY (optional)
#   - TOOL_RUNNER_URL (defaults to http://127.0.0.1:4000)
#
# Example env exports:
#   export TOOL_RUNNER_URL="http://127.0.0.1:4000"
#   export CUSTOM_BASE_URL="http://192.168.0.6:1234/v1"
#   export ORIGIN="http://localhost:5173"
#
# It probes:
#   1) LM Studio: GET  <CUSTOM_BASE_URL>/models
#   2) LM Studio: OPTIONS <CUSTOM_BASE_URL>/models (with Origin + Access-Control-Request-Method)
#   3) Forge server: GET <TOOL_RUNNER_URL>/api/models?provider=custom

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CUSTOM_BASE_URL="${CUSTOM_BASE_URL:-http://127.0.0.1:1234/v1}"
CUSTOM_API_KEY="${CUSTOM_API_KEY:-}"
TOOL_RUNNER_URL="${TOOL_RUNNER_URL:-http://127.0.0.1:4000}"
ORIGIN="${ORIGIN:-http://localhost:5173}"

MODELS_ENDPOINT="${CUSTOM_BASE_URL%/}/models"
FORGE_MODELS_ENDPOINT="${TOOL_RUNNER_URL%/}/api/models?provider=custom"

echo "=== Config ==="
echo "CUSTOM_BASE_URL: ${CUSTOM_BASE_URL}"
echo "MODELS_ENDPOINT:  ${MODELS_ENDPOINT}"
echo "TOOL_RUNNER_URL:  ${TOOL_RUNNER_URL}"
echo "FORGE endpoint:   ${FORGE_MODELS_ENDPOINT}"
echo "ORIGIN:           ${ORIGIN}"
echo "ROOT_DIR:         ${ROOT_DIR}"
echo

echo "=== 1) LM Studio GET /v1/models ==="
if [[ -n "${CUSTOM_API_KEY}" ]]; then
  curl -sS -D - -H "Authorization: Bearer ${CUSTOM_API_KEY}" "${MODELS_ENDPOINT}" -o /dev/null || true
  curl -sS -H "Authorization: Bearer ${CUSTOM_API_KEY}" "${MODELS_ENDPOINT}" | head -n 40
else
  curl -sS -D - "${MODELS_ENDPOINT}" -o /dev/null || true
  curl -sS "${MODELS_ENDPOINT}" | head -n 40
fi
echo

echo "=== 2) LM Studio preflight OPTIONS /v1/models ==="
curl -sS -D - -X OPTIONS "${MODELS_ENDPOINT}" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -o /dev/null || true
echo

echo "=== 3) Forge server GET /api/models?provider=custom ==="
curl -sS -D - "${FORGE_MODELS_ENDPOINT}" -o /dev/null || true

echo "--- body (first ~60 lines) ---"
curl -sS "${FORGE_MODELS_ENDPOINT}" | head -n 60

echo
echo "Done."

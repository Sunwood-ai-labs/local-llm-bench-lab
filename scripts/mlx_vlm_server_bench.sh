#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://127.0.0.1:18080}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${MODEL:-$ROOT_DIR/artifacts/models/mlx-community-gemma-4-e2b-it-4bit}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/benchmarks}"
JSONL="$OUT_DIR/mlx-vlm-server-${STAMP}.jsonl"
TSV="$OUT_DIR/mlx-vlm-server-${STAMP}.tsv"

require_tool() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required tool: $1" >&2
    exit 1
  }
}

require_tool awk
require_tool curl
require_tool jq
require_tool python3
mkdir -p "$OUT_DIR"

run_case() {
  local name="$1"
  local max_tokens="$2"
  local prompt="$3"
  local payload response start end wall_s

  payload="$(
    jq -nc \
      --arg model "$MODEL" \
      --arg prompt "$prompt" \
      --argjson max_tokens "$max_tokens" \
      '{
        model: $model,
        messages: [{role: "user", content: $prompt}],
        temperature: 0,
        max_tokens: $max_tokens,
        stream: false,
        verbose: false
      }'
  )"

  start="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  response="$(curl -fsS "$SERVER_URL/v1/chat/completions" -H 'Content-Type: application/json' -d "$payload")"
  end="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  wall_s="$(awk -v start="$start" -v end="$end" 'BEGIN { printf "%.6f", end - start }')"

  jq -c --arg case "$name" --argjson wall_s "$wall_s" '. + {bench_case: $case, wall_s: $wall_s}' <<<"$response" >>"$JSONL"
  jq -r --arg case "$name" --arg model "$MODEL" --argjson wall_s "$wall_s" '
    [
      $case,
      $model,
      (.usage.input_tokens // 0),
      (.usage.prompt_tps // 0),
      (.usage.output_tokens // 0),
      (.usage.generation_tps // 0),
      (.usage.peak_memory // 0),
      $wall_s
    ] | @tsv
  ' <<<"$response" | tee -a "$TSV"
}

printf 'case\tmodel\tprompt_tokens\tprompt_tps\toutput_tokens\tgeneration_tps\tpeak_memory_gb\twall_s\n' >"$TSV"

run_case \
  "short_chat_128" \
  128 \
  "日本語で短く答えてください。ローカルLLMをApple Siliconで動かす利点を3つ挙げてください。"

run_case \
  "jp_long_512" \
  512 \
  "日本語で、ローカルLLMをApple Silicon上で運用するときの速度、メモリ、コンテキスト長、量子化、推論サーバー選定の観点を、実務向けに詳しく説明してください。"

echo
echo "JSONL: $JSONL"
echo "TSV:   $TSV"

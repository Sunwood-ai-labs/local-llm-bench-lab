#!/usr/bin/env bash
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
MODEL="${1:-gemma4:e4b}"
MODEL_SLUG="${MODEL//[:\/]/-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/benchmarks}"
JSONL="$OUT_DIR/${MODEL_SLUG}-${STAMP}.jsonl"
TSV="$OUT_DIR/${MODEL_SLUG}-${STAMP}.tsv"

require_tool() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required tool: $1" >&2
    exit 1
  }
}

require_tool curl
require_tool jq
mkdir -p "$OUT_DIR"

run_case() {
  local name="$1"
  local num_ctx="$2"
  local num_predict="$3"
  local prompt="$4"
  local payload response

  payload="$(
    jq -nc \
      --arg model "$MODEL" \
      --arg prompt "$prompt" \
      --argjson num_ctx "$num_ctx" \
      --argjson num_predict "$num_predict" \
      '{
        model: $model,
        prompt: $prompt,
        stream: false,
        think: false,
        options: {
          temperature: 0,
          num_ctx: $num_ctx,
          num_predict: $num_predict
        }
      }'
  )"

  response="$(curl -fsS "$OLLAMA_URL/api/generate" -d "$payload")"
  jq -c --arg case "$name" '. + {bench_case: $case}' <<<"$response" >>"$JSONL"

  jq -r --arg case "$name" --arg model "$MODEL" '
    def sec(x): ((x // 0) / 1000000000);
    def tps(count; dur): if (dur // 0) > 0 then (count / sec(dur)) else 0 end;
    [
      $case,
      $model,
      (.prompt_eval_count // 0),
      (sec(.prompt_eval_duration) | tostring),
      (tps((.prompt_eval_count // 0); .prompt_eval_duration) | tostring),
      (.eval_count // 0),
      (sec(.eval_duration) | tostring),
      (tps((.eval_count // 0); .eval_duration) | tostring),
      (sec(.load_duration) | tostring),
      (sec(.total_duration) | tostring),
      (.done_reason // "")
    ] | @tsv
  ' <<<"$response" | tee -a "$TSV"
}

{
  printf 'case\tmodel\tprompt_tokens\tprompt_s\tprompt_tok_s\teval_tokens\teval_s\teval_tok_s\tload_s\ttotal_s\tdone_reason\n'
} >"$TSV"

run_case \
  "short_chat_128_ctx4096" \
  4096 \
  128 \
  "日本語で短く答えてください。ローカルLLMをApple Siliconで動かす利点を3つ挙げてください。"

run_case \
  "jp_long_512_ctx4096" \
  4096 \
  512 \
  "日本語で、ローカルLLMをApple Silicon上で運用するときの速度、メモリ、コンテキスト長、量子化、推論サーバー選定の観点を、実務向けに詳しく説明してください。"

run_case \
  "jp_long_512_ctx8192" \
  8192 \
  512 \
  "日本語で、ローカルLLMのベンチマークを取るときに注意すべき点を説明してください。初回ロード、プロンプト処理、生成速度、温度、最大生成トークン数、GPU利用率を含めてください。"

echo
echo "JSONL: $JSONL"
echo "TSV:   $TSV"

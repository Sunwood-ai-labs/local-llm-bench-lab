# local-llm-bench-lab

Apple Silicon 上でローカルLLMを比較・高速化・再ベンチするための実験リポジトリです。

Gemma 4 だけに閉じず、Ollama / MLX / llama.cpp など複数バックエンドと、今後追加する別モデルを同じ形式で記録できるようにします。

## 目的

- ローカルLLMの速度、メモリ、ロード時間、コンテキスト設定を比較する。
- モデルごとに一番速い実行構成を見つける。
- バックエンド別の高速化設定を実測で残す。
- ほかのモデルを追加しても同じ手順で再現できるようにする。

## ディレクトリ

```text
benchmarks/                         共通ベンチ結果置き場
configs/                            モデル・バックエンド設定
docs/                               調査メモ、設計メモ
experiments/gemma4-2026-04-29/      今回のGemma 4実験ログ
scripts/                            再利用できるベンチスクリプト
tools/                              補助ツール
artifacts/                          ローカル生成物置き場。重いものはgit管理外
```

## セットアップ

Python:

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Ollama ベンチには `ollama`, `curl`, `jq` が必要です。MLX VLM は Apple Silicon / macOS 前提です。

ローカル設定は `.env.example` を参考にし、必要なら `.env` を作って管理対象外で使います。

## 初期収録

今回の Gemma 4 実験を最初の experiment として取り込み済みです。

- `experiments/gemma4-2026-04-29/reports/Gemma4_Local_LLM_Report_JA.md`
- `experiments/gemma4-2026-04-29/reports/raw_setup_and_bench_log.md`
- `experiments/gemma4-2026-04-29/benchmarks/`

元の一時実験フォルダの完全コピーは `experiments/gemma4-2026-04-29/full-copy/` にローカルバックアップとして置いています。モデル本体、venv、Hugging Face cache もこの配下にありますが、重いので Git 管理対象外です。

## よく使うコマンド

Ollama:

```sh
scripts/ollama_bench.sh gemma4:e2b
scripts/ollama_bench.sh gemma4:e4b
scripts/ollama_bench.sh gemma4:26b
scripts/ollama_bench.sh gemma4:31b
```

出力先はデフォルトで `benchmarks/` です。別の場所へ出したい場合は `OUT_DIR=...` を指定します。

MLX VLM:

```sh
scripts/mlx_vlm_bench.py \
  --model artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
  --out benchmarks/model-run.jsonl
```

MLX VLM server:

```sh
MODEL=artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
scripts/mlx_vlm_server_bench.sh
```

`MODEL` は OpenAI compatible server に渡すモデル名またはローカルモデルパスです。

## リポジトリ名の理由

`local-llm-bench-lab` は、Gemma 固有ではなく、今後 Llama / Qwen / Phi / Mistral などを追加しても自然に使える名前です。`bench` は速度測定、`lab` は環境構築や高速化の実験も含むニュアンスにしています。

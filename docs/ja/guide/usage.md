---
title: 使い方
description: 同梱ベンチスクリプトの実行方法。
---

# 使い方

ベンチスクリプトは JSONL と TSV を出力します。共通の `benchmarks/` ではなく別の場所に出したい場合は `OUT_DIR` を指定します。

## Ollama

Ollama server を起動し、対象モデルを用意します。

```sh
ollama pull gemma4:e2b
scripts/ollama_bench.sh gemma4:e2b
```

主な環境変数:

- `OLLAMA_URL`: 既定値は `http://127.0.0.1:11434`
- `OUT_DIR`: 既定値は `benchmarks/`

## MLX VLM direct

ローカルの MLX VLM モデルディレクトリを指定します。

```sh
scripts/mlx_vlm_bench.py \
  --model artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
  --out benchmarks/mlx-vlm-run.jsonl
```

任意の調整フラグ:

- `--kv-bits`
- `--kv-quant-scheme`
- `--prefill-step-size`
- `--temperature`

## MLX VLM server

OpenAI compatible な MLX VLM server が起動済みのときに使います。

```sh
MODEL=artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
SERVER_URL=http://127.0.0.1:18080 \
scripts/mlx_vlm_server_bench.sh
```

このスクリプトは `/v1/chat/completions` の wall-clock 時間を測り、runtime が返す token counter も保存します。

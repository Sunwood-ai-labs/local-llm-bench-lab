---
title: Usage
description: Run the included local LLM benchmark scripts.
---

# Usage

The benchmark scripts write JSONL and TSV output by default. Set `OUT_DIR` when you want to keep a run separate from the shared `benchmarks/` directory.

## Ollama

Start Ollama and make sure the target model is available:

```sh
ollama pull gemma4:e2b
scripts/ollama_bench.sh gemma4:e2b
```

Useful environment variables:

- `OLLAMA_URL`: defaults to `http://127.0.0.1:11434`
- `OUT_DIR`: defaults to `benchmarks/`

## MLX VLM Direct

Run a local MLX VLM model directory:

```sh
scripts/mlx_vlm_bench.py \
  --model artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
  --out benchmarks/mlx-vlm-run.jsonl
```

Optional tuning flags:

- `--kv-bits`
- `--kv-quant-scheme`
- `--prefill-step-size`
- `--temperature`

## MLX VLM Server

Use this when an OpenAI-compatible MLX VLM server is already running:

```sh
MODEL=artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
SERVER_URL=http://127.0.0.1:18080 \
scripts/mlx_vlm_server_bench.sh
```

The script records wall-clock timing around `/v1/chat/completions` calls and keeps the runtime-reported token counters when available.

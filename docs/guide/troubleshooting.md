---
title: Troubleshooting
description: Common local benchmark issues and checks.
---

# Troubleshooting

## Ollama Request Fails

Check that the server is running:

```sh
curl http://127.0.0.1:11434/api/tags
```

If the model is missing, pull it first:

```sh
ollama pull gemma4:e2b
```

## `jq` Is Missing

Install `jq` before running the shell benchmark scripts. The scripts use it to build request payloads and extract result metrics.

## MLX VLM Import Fails

Install Python dependencies:

```sh
python3 -m pip install -r requirements.txt
```

MLX VLM support changes over time and is most relevant on Apple Silicon. Record package versions in the experiment notes when a benchmark depends on a specific version.

## Output Accidentally Goes to the Wrong Directory

Set `OUT_DIR` explicitly:

```sh
OUT_DIR=experiments/my-run/benchmarks scripts/ollama_bench.sh gemma4:e2b
```

## Heavy Files Appear Before Commit

Check the staged payload:

```sh
git diff --cached --stat
git ls-files -ci --exclude-standard
```

If model files or caches are staged, remove them from the index and keep them in ignored local paths.

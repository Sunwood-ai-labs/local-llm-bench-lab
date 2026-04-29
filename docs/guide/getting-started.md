---
title: Getting Started
description: Prepare a local environment for local-llm-bench-lab.
---

# Getting Started

This repository is designed for Apple Silicon local LLM experiments. The scripts are lightweight, but the runtimes they call may require local model files, Ollama models, or MLX-compatible model directories.

## Requirements

- macOS on Apple Silicon for the original MLX VLM workflow
- Python 3.10 or newer for helper scripts
- `curl` and `jq` for Ollama and OpenAI-compatible server benchmarks
- Ollama when running `scripts/ollama_bench.sh`
- MLX VLM when running `scripts/mlx_vlm_bench.py`

## Python Setup

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

## Local Configuration

Use `.env.example` as a starting point:

```sh
cp .env.example .env
```

Then adjust values for your local runtime. `.env` is ignored so machine-specific paths stay out of Git.

## Artifact Policy

Put local model files under ignored directories such as `artifacts/models/`. Commit compact result files and reports, not model weights or caches.

---
title: Home
description: Apple Silicon local LLM benchmark scripts, reports, and lightweight result records.
---

# local-llm-bench-lab

`local-llm-bench-lab` is a public repository for repeatable local LLM benchmarking on Apple Silicon. It keeps reusable scripts, compact result artifacts, and experiment reports while excluding model weights, local caches, and heavyweight backups from Git.

## What Is Included

- Ollama benchmark scripts for chat-style local model runs
- MLX VLM direct and server benchmark scripts
- llama.cpp result records from the initial Gemma 4 experiment
- bilingual README files and docs
- GitHub Actions for validation and Pages deployment
- public repository community files and issue templates

## First Experiment

The first recorded experiment is `experiments/gemma4-2026-04-29/`. It compares Gemma 4 variants across Ollama, MLX VLM, and llama.cpp on an Apple M1 Max machine with 64GB unified memory.

## Start Here

1. Read [Getting Started](./guide/getting-started.md).
2. Run a benchmark with [Usage](./guide/usage.md).
3. Add or inspect results with [Experiment Records](./guide/experiment-records.md).
4. Check common issues in [Troubleshooting](./guide/troubleshooting.md).

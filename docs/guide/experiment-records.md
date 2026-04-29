---
title: Experiment Records
description: How benchmark results and reports are organized.
---

# Experiment Records

Experiments are grouped by model family and date:

```text
experiments/<model-or-topic>-<yyyy-mm-dd>/
```

The initial example is:

```text
experiments/gemma4-2026-04-29/
```

## Recommended Structure

```text
experiments/<name>/
  README.md
  reports/
  benchmarks/
```

Use `reports/` for human-readable notes and `benchmarks/` for compact result artifacts.

## Trackable Artifacts

Commit:

- `.jsonl`
- `.json`
- `.tsv`
- `.md`
- scripts needed to reproduce a run

Do not commit:

- raw `.log`, `.err`, or `.out` files
- model files
- virtual environments
- local cache directories
- `full-copy/` backups

## Minimum Benchmark Context

Include the model, runtime, hardware, command, context size, temperature, quantization, output token target, and any server settings that materially affect speed.

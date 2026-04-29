# Contributing

Thanks for helping improve `local-llm-bench-lab`. The most valuable contributions are reproducible benchmark runs, clearer docs, and small tools that make local LLM comparisons easier to repeat.

## Ground Rules

- Keep the repository lightweight.
- Do not commit model weights, virtual environments, local caches, raw logs, secrets, or full experiment backups.
- Prefer compact evidence: JSONL, TSV, small JSON summaries, reports, and scripts.
- Record enough environment detail for another Apple Silicon user to reproduce the run.

## Benchmark Contributions

When adding a benchmark, include:

- model name and source
- runtime or backend, such as Ollama, MLX VLM, or llama.cpp
- machine summary, macOS version, and memory size when known
- command or script used
- relevant runtime settings such as context size, quantization, KV cache, and temperature
- compact result files in `experiments/<experiment-name>/benchmarks/`
- a short report or README note when the result adds a new model or backend

## Local Checks

Run the checks that match your change:

```sh
bash -n scripts/ollama_bench.sh
bash -n scripts/mlx_vlm_server_bench.sh
python3 -m py_compile scripts/mlx_vlm_bench.py tools/hf_range_download.py
```

For docs changes:

```sh
cd docs
npm ci
npm run docs:build
```

## Pull Requests

Keep pull requests focused. Explain what changed, why it matters, and which checks were run. If a run depends on local model files or hardware state, describe that dependency rather than committing the generated heavyweight files.

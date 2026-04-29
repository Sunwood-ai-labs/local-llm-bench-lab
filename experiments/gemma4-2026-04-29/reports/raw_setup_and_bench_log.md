# Gemma 4 local setup and benchmark log

Date: 2026-04-29  
Machine: Apple M1 Max, 64 GB unified memory, macOS 26.4.1  
Workspace: `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc`

## Goal

Gemma 4 をこの PC でローカル実行できるようにし、量子化モデルでよいのでモデル取得、実行環境整備、速度測定を行う。追加で MLX / llama.cpp の可能性と、より大きいモデルのベンチマークも確認する。

## Web research update

Research pass added after the user explicitly asked for a proper web check.

Primary sources checked:

- Google/Hugging Face official model card: <https://huggingface.co/google/gemma-4-E4B-it>
- Ollama Gemma 4 library page: <https://www.ollama.com/library/gemma4>
- ggml-org official GGUF repos:
  - <https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF>
- llama.cpp README: <https://github.com/ggml-org/llama.cpp>
- Ollama FAQ / server tuning docs: <https://docs.ollama.com/faq>
- MLX install docs: <https://ml-explore.github.io/mlx/build/html/install.html>
- mlx-lm README: <https://github.com/ml-explore/mlx-lm>
- Hugging Face Hub environment variables: <https://huggingface.co/docs/huggingface_hub/main/package_reference/environment_variables>
- Apple Power Modes support page: <https://support.apple.com/en-us/101613>

Findings:

- Gemma 4 has four local sizes: `E2B`, `E4B`, `26B A4B`, and `31B`.
- `E2B` and `E4B` are edge models with Per-Layer Embeddings. Their total stored parameters are larger than the "effective" parameter count.
- `26B A4B` is a Mixture-of-Experts model. The official model card says it has about `25.2B` total parameters but about `3.8B` active parameters during inference. This explains why the local `26b` benchmark is close to `e4b` rather than behaving like a dense 26B model.
- `31B` is the dense workstation model. It is the correct "larger model" to benchmark after `26b`.
- Ollama's Gemma 4 page explicitly says Ollama handles the chat-template complexity. For this machine, Ollama remains the most reliable path for immediate local use.
- The correct llama.cpp route is not to reuse Ollama's local blob directly. The official route is `llama-server -hf ggml-org/gemma-4-...-GGUF`, or to manually download the ggml-org GGUF file and run `llama-bench` / `llama-server`.
- ggml-org lists Q4_K_M sizes:
  - E4B: about `5.34 GB`
  - 26B A4B: about `16.8 GB`
  - 31B: about `18.7 GB`
- MLX is appropriate for Apple Silicon, and the official MLX docs require native Apple Silicon Python, Python >= 3.10, and macOS >= 14. `mlx-lm` supports HF Hub models with `--model`.
- The earlier MLX failure was not an MLX runtime problem. It was a Hugging Face Xet transfer problem. Hugging Face documents `HF_HUB_DISABLE_XET` and related Xet environment variables; however, disabling Xet in this session made large model downloads very slow.

Actions based on this research:

- Add and benchmark `gemma4:e2b` as the faster local option.
- Add and benchmark `gemma4:31b` as the dense larger local option.
- Retry llama.cpp using ggml-org `-hf` / GGUF rather than Ollama's blob if network time allows.

## Installed runtime

### Ollama

- Installed: `/Applications/Ollama.app`
- CLI symlink: `/Users/admin/.local/bin/ollama`
- Added PATH setup to:
  - `/Users/admin/.zshrc`
  - `/Users/admin/.zprofile`
- Server LaunchAgent:
  - `/Users/admin/Library/LaunchAgents/com.ollama.server.plist`
  - `OLLAMA_HOST=127.0.0.1:11434`
  - `OLLAMA_MODELS=/Users/admin/.ollama/models`
  - `OLLAMA_KEEP_ALIVE=30m`
  - `OLLAMA_MAX_LOADED_MODELS=1`
  - `OLLAMA_NUM_PARALLEL=1`
- API check:
  - `http://127.0.0.1:11434/api/version` returned Ollama `0.22.0`

### Convenience wrapper

Created `/Users/admin/.local/bin/gemma4`:

```sh
#!/bin/sh
exec /Applications/Ollama.app/Contents/Resources/ollama run --think=false --keepalive 30m gemma4:e4b "$@"
```

This keeps normal chat runs concise by disabling the default thinking output.

Created `/Users/admin/.local/bin/gemma4-26b` after the larger model pull:

```sh
#!/bin/sh
exec /Applications/Ollama.app/Contents/Resources/ollama run --think=false --keepalive 30m gemma4:26b "$@"
```

Created `/Users/admin/.local/bin/gemma4-fast` after benchmarking the faster E2B option:

```sh
#!/bin/sh
exec /Applications/Ollama.app/Contents/Resources/ollama run --think=false --keepalive 30m gemma4:e2b "$@"
```

Created `/Users/admin/.local/bin/gemma4-31b` after benchmarking the dense 31B option:

```sh
#!/bin/sh
exec /Applications/Ollama.app/Contents/Resources/ollama run --think=false --keepalive 30m gemma4:31b "$@"
```

Created `/Users/admin/.local/bin/gemma4-preload` after the acceleration pass:

```sh
gemma4-preload gemma4:e2b 4096 30m
```

This preloads a model with a smaller context and keeps it warm for repeated calls. The verified fast default is `gemma4-preload gemma4:e2b 4096 30m`, which loaded `gemma4:e2b` as `100% GPU`, `4096` context, about `7.7 GB`, and `29 minutes from now`.

## Models

### `gemma4:e4b`

Pulled successfully with Ollama.

- Model ID: `c6eb396dbd59`
- Size on disk reported by Ollama: `9.6 GB`
- Architecture: `gemma4`
- Parameters: `8.0B`
- Quantization: `Q4_K_M`
- Context length: `131072`
- Capabilities: completion, vision, audio, tools, thinking

### `gemma4:e2b`

Pulled successfully with Ollama after the web research pass.

- Model ID: `7fbdbf8f5e45`
- Size on disk reported by Ollama: `7.2 GB`
- Architecture: `gemma4`
- Parameters: `5.1B`
- Quantization: `Q4_K_M`
- Context length: `131072`
- Capabilities: completion, vision, audio, tools, thinking

### `gemma4:26b`

Pulled successfully with Ollama.

- Model ID: `5571076f3d70`
- Size on disk reported by Ollama: `17 GB`
- Architecture: `gemma4`
- Parameters: `25.8B`
- Quantization: `Q4_K_M`
- Context length: `262144`
- Capabilities: completion, vision, tools, thinking
- Network speed observed:
  - Low point: about `2.1 MB/s`
  - Better sustained point after pausing HF downloads: about `9-10 MB/s`
- Pull completed successfully at about 2026-04-29 19:09 JST

### `gemma4:31b`

Pulled successfully after confirming from primary sources that `31B` is the dense workstation-size model, while `26B A4B` is a sparse MoE model.

- Model ID: `6316f0629137`
- Size on disk reported by Ollama: `19 GB`
- Architecture: `gemma4`
- Parameters: `31.3B`
- Quantization: `Q4_K_M`
- Context length: `262144`
- Capabilities: completion, vision, tools, thinking
- Pull completed successfully at about 2026-04-29 20:28 JST

## Ollama benchmark method

Benchmarks were run through the local Ollama API with:

- `stream: false`
- `think: false`
- `temperature: 0`
- `num_predict` set per test

Token/s is calculated from Ollama's `eval_count / eval_duration`.

## Ollama results: `gemma4:e4b`

| Test | Output tokens | Generation time | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---:|---|
| Warmup short | 8 | 0.139 s | 57.6 tok/s | n/a | 2.11 s | First load |
| Short chat, 128 cap | 82 | 1.60 s | 51.2 tok/s | 299 tok/s | 0.26 s | Warm |
| Japanese long, 512 cap | 512 | 10.10 s | 50.7 tok/s | 462 tok/s | 0.21 s | Hit length cap |
| Japanese long, 512 cap, run 2 | 512 | 10.07 s | 50.8 tok/s | 426 tok/s | 0.24 s | Hit length cap |
| Japanese long, 1024 cap | 1024 | 20.23 s | 50.6 tok/s | 485 tok/s | 0.20 s | Hit length cap |
| Cold short after `ollama stop` | 68 | 1.31 s | 51.8 tok/s | 246 tok/s | 2.10 s | Reload included |
| Default huge context, cold | 512 | 9.87 s | 51.9 tok/s | 63.9 tok/s | 2.84 s | Context `131072` |
| Default huge context, warm | 512 | 9.85 s | 52.0 tok/s | 337 tok/s | 0.26 s | Context `131072` |

Additional scripted run while background download work was active:

| Test | Output tokens | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---|
| `short_chat_128_ctx4096` | 63 | 45.6 tok/s | 234 tok/s | 2.13 s | Background downloads active |
| `jp_long_512_ctx4096` | 512 | 44.9 tok/s | 373 tok/s | 0.23 s | Background downloads active |
| `jp_long_512_ctx8192` | 512 | 45.0 tok/s | 386 tok/s | 2.17 s | Background downloads active |

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e4b-20260429-183136.jsonl`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e4b-20260429-183136.tsv`

Additional scripted run after the 26B pull completed:

| Test | Output tokens | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---|
| `short_chat_128_ctx4096` | 63 | 36.4 tok/s | 208 tok/s | 3.63 s | Cold after unloading 26B |
| `jp_long_512_ctx4096` | 512 | 36.2 tok/s | 348 tok/s | 0.23 s | Warm |
| `jp_long_512_ctx8192` | 512 | 35.9 tok/s | 339 tok/s | 2.19 s | Context switch to 8192 |

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e4b-20260429-191117.jsonl`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e4b-20260429-191117.tsv`

Reusable benchmark script:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/ollama_bench.sh`

Note: the first manual run measured about `51-52 tok/s`; later scripted runs measured `35-45 tok/s`. The latest apples-to-apples scripted comparison after the large download completed is the `35-36 tok/s` result above.

## Ollama results: `gemma4:e2b`

| Test | Output tokens | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---|
| `short_chat_128_ctx4096` | 98 | 64.5 tok/s | 79.7 tok/s | 2.08 s | First E2B load |
| `jp_long_512_ctx4096` | 512 | 70.1 tok/s | 584 tok/s | 0.23 s | Warm |
| `jp_long_512_ctx8192` | 512 | 71.1 tok/s | 612 tok/s | 2.11 s | Context switch to 8192 |

Observed with `ollama ps`:

- Processor: `100% GPU`
- Memory use: about `7.7 GB`
- Context shown during the last run: `8192`

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e2b-20260429-193131.jsonl`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e2b-20260429-193131.tsv`

## Ollama results: `gemma4:26b`

| Test | Output tokens | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---|
| `short_chat_128_ctx4096` | 123 | 35.4 tok/s | 46.5 tok/s | 2.54 s | First 26B load |
| `jp_long_512_ctx4096` | 512 | 36.2 tok/s | 262 tok/s | 0.23 s | Warm |
| `jp_long_512_ctx8192` | 512 | 35.4 tok/s | 203 tok/s | 2.22 s | Context switch to 8192 |

Observed with `ollama ps`:

- Processor: `100% GPU`
- Memory use: about `19 GB`
- Context shown during the last run: `8192`

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-26b-20260429-191027.jsonl`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-26b-20260429-191027.tsv`

## Ollama results: `gemma4:31b`

| Test | Output tokens | Generation speed | Prompt speed | Load time | Notes |
|---|---:|---:|---:|---:|---|
| `short_chat_128_ctx4096` | 86 | 9.16 tok/s | 32.3 tok/s | 4.01 s | First 31B load |
| `jp_long_512_ctx4096` | 512 | 9.14 tok/s | 71.1 tok/s | 0.25 s | Warm |
| `jp_long_512_ctx8192` | 512 | 8.73 tok/s | 70.1 tok/s | 3.41 s | Context switch to 8192 |

Observed with `ollama ps`:

- Processor: `100% GPU`
- Memory use: about `25 GB`
- Context shown during the last run: `8192`

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-31b-20260429-202818.jsonl`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-31b-20260429-202818.tsv`

## Summary table

Latest comparable scripted results, using the `jp_long_512_ctx4096` case:

| Model | Type / role | Ollama size | Memory observed | Generation speed |
|---|---|---:|---:|---:|
| `gemma4:e2b` | Fast local option | 7.2 GB | 7.7 GB | 70.1 tok/s |
| `gemma4:e4b` | Default balanced edge option | 9.6 GB | 10 GB | 36.2 tok/s |
| `gemma4:26b` | Sparse MoE, about 3.8B active params by official model card | 17 GB | 19 GB | 36.2 tok/s |
| `gemma4:31b` | Dense workstation-size model | 19 GB | 25 GB | 9.14 tok/s |
| `ggml-org/gemma-4-E4B-it-GGUF` via llama.cpp | E4B GGUF Q4_K_M | 5.3 GB | not captured | 38.5 tok/s |

## Acceleration pass

Checked official docs and tested the obvious speed knobs rather than assuming they help.

Web findings:

- Ollama documents `keep_alive` / `OLLAMA_KEEP_ALIVE` for keeping models loaded, model preloading with an empty request, `ollama ps` for confirming GPU placement, and server-side `OLLAMA_MAX_LOADED_MODELS` / `OLLAMA_NUM_PARALLEL`.
- Ollama also documents `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE`; those are primarily useful for reducing memory as context grows. KV cache quantization is global and quality/speed tradeoffs need testing per model.
- llama.cpp is a good Apple Silicon path because its README lists Metal/Accelerate support and official prebuilt releases.
- Apple documents High Power Mode for M1 Max-class machines; it allows higher fan speeds and may improve performance for very intensive workloads.

Changes adopted:

- Updated the LaunchAgent to keep one model warm for `30m`, allow only one loaded model by default, and use one parallel request:
  - `OLLAMA_KEEP_ALIVE=30m`
  - `OLLAMA_MAX_LOADED_MODELS=1`
  - `OLLAMA_NUM_PARALLEL=1`
- Updated all `gemma4*` wrapper commands with `--keepalive 30m`.
- Added `gemma4-preload` for explicit preload with a small context:
  - `gemma4-preload gemma4:e2b 4096 30m`

Ollama acceleration experiments on `gemma4:e2b`:

| Setting | `short_chat_128_ctx4096` | `jp_long_512_ctx4096` | `jp_long_512_ctx8192` | Decision |
|---|---:|---:|---:|---|
| Normal Ollama, clean earlier run | 64.5 tok/s | 70.1 tok/s | 71.1 tok/s | Best measured path |
| `OLLAMA_FLASH_ATTENTION=1` | 52.8 tok/s | 35.1 tok/s | 32.0 tok/s | Do not adopt |
| `OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0` | 25.5 tok/s | 40.0 tok/s | 40.3 tok/s | Do not adopt |

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e2b-20260429-193131.tsv`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e2b-20260429-205957.tsv`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/gemma4-e2b-20260429-205850.tsv`

Important power-state finding:

- During the last acceleration pass, two temporary Ollama servers were left on ports `11435` and `11436`; they were removed.
- After cleanup, both Ollama and llama.cpp became much slower while the Mac was on battery power:
  - `pmset`: `Now drawing from 'Battery Power'`, `powermode 0`
  - `gemma4:e2b` short clean recheck: `7.68 tok/s`
  - llama.cpp E4B short recheck: `3.93 tok/s`
- Because both backends slowed down, this looks like machine power/thermal state rather than an Ollama-only regression.
- `pmset -b powermode 1` would require root, so I did not change it. For a fair top-speed rerun, plug in power and choose High Power Mode in System Settings > Battery, then rerun `benchmarks/ollama_bench.sh gemma4:e2b`.

## llama.cpp

Installed latest macOS arm64 release:

- Source: <https://github.com/ggml-org/llama.cpp/releases>
- Downloaded release tag: `b8967`
- Install path: `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/tools/llama-b8967`
- Available tools include:
  - `llama-cli`
  - `llama-bench`
  - `llama-server`

Attempted to run llama.cpp directly against Ollama's local `gemma4:e4b` GGUF blob:

```sh
tools/llama-b8967/llama-bench \
  -m /Users/admin/.ollama/models/blobs/sha256-4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a \
  -p 512 -n 512 -r 3 -ngl 99 -fa 1 -o json
```

Result:

- `llama-bench` failed to load the model.
- `llama-cli` metadata read proceeded further but failed with:
  - `done_getting_tensors: wrong number of tensors; expected 2131, got 720`

Current interpretation:

- Ollama's Gemma 4 blob appears to be a multimodal / packaged GGUF variant that current `llama-cli` / `llama-bench` did not accept directly.
- The better llama.cpp path is likely to download text GGUF files from `ggml-org`, for example:
  - <https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF>
- Direct Hugging Face transfer was much slower than Ollama during this run, so the Ollama 26B pull was prioritized first.

After the web research pass, retried the correct llama.cpp route using ggml-org's official GGUF repository:

```sh
tools/llama-b8967/llama-bench \
  -hf ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M \
  -p 512 -n 512 -r 1 -ngl 99 -fa 1 -o json
```

Result:

- Downloaded and loaded:
  - `/Users/admin/.cache/huggingface/hub/models--ggml-org--gemma-4-E4B-it-GGUF/snapshots/2714b5519c6c3516b1000e7c5e1eba998dfe1fe8/gemma-4-E4B-it-Q4_K_M.gguf`
- Model size in llama.cpp output: `5,319,465,128 bytes`
- llama.cpp model type: `gemma4 E4B Q4_K - Medium`
- Prompt processing:
  - `512` prompt tokens
  - `537.9 tok/s`
- Generation:
  - `512` generated tokens
  - `38.5 tok/s`
- Backends:
  - `MTL,BLAS`
  - GPU: `Apple M1 Max`

Raw files:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/llamacpp-e4b-hf-bench.json`
- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/llamacpp-e4b-hf-bench.err`

Conclusion:

- llama.cpp works when using the official ggml-org GGUF repo.
- It is not useful to point llama.cpp at Ollama's local Gemma 4 blob.
- On this machine, llama.cpp E4B Q4_K_M generation speed is in the same band as Ollama E4B scripted generation, slightly above the latest comparable Ollama E4B run.

## MLX

MLX text-only runtime setup completed in:

- Virtualenv: `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/.venv-mlx`
- Installed packages:
  - `mlx`
  - `mlx-lm`
  - `huggingface_hub`
- Verified import:
  - `mlx 0.31.2`
  - `mlx-lm 0.31.3`

`mlx-vlm` was started first, but it pulled large image/data dependencies such as OpenCV and PyArrow. For text speed testing, I stopped that path and switched to the lighter `mlx-lm` setup.

Candidate MLX model repositories found:

- <https://huggingface.co/mlx-community/gemma-4-e4b-it-4bit>
- <https://huggingface.co/jorch/gemma-4-e4b-it-lm-4bit>
- <https://huggingface.co/NexVeridian/gemma-4-E4B-it-4bit>
- <https://huggingface.co/mlx-community/gemma-4-26b-a4b-it-4bit>
- <https://huggingface.co/mlx-community/gemma-4-31b-it-4bit>

MLX benchmark script:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/mlx_bench.py`

Status at 2026-04-29 18:48 JST:

- Runtime is installed.
- `hf-xet` failed against multiple MLX E4B repos with:
  - `HTTP status client error (416 Range Not Satisfiable)`
- Disabling Xet made the download proceed, but very slowly:
  - about `660 MB` downloaded in several minutes for a `4.23 GB` file

Retried after the web research pass with:

```sh
HF_HUB_DISABLE_XET=1 \
HF_HOME=/Users/admin/.cache/huggingface \
.venv-mlx/bin/python benchmarks/mlx_bench.py \
  --model jorch/gemma-4-e4b-it-lm-4bit
```

Result:

- Model download completed using normal HTTP.
- Loading failed in `mlx-lm 0.31.3` with:
  - `ValueError: Received 1604 parameters not in model`
- The unexpected parameters include `language_model.*` and `embed_tokens_per_layer.*`, which points to a mismatch between the Gemma 4 conversion and the current `mlx-lm` model implementation in this environment.

Raw log:

- `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/benchmarks/mlx-e4b-http-run.log`

Current interpretation:

- MLX itself is installed correctly on this Mac.
- Hugging Face HTTP download can complete when Xet is disabled.
- I could not produce a fair Gemma 4 MLX token/s number with `mlx-lm 0.31.3` because the available Gemma 4 E4B MLX conversion did not load cleanly.
- Next MLX route would be to wait for a compatible `mlx-lm` update or use a confirmed `mlx-vlm` Gemma 4 workflow, then rerun `benchmarks/mlx_bench.py`.

## Practical speed notes so far

- `gemma4:e4b` on Ollama is already using the Apple GPU and produces about `51-52 tok/s`.
- The latest scripted e4b/26B comparison measured both around `35-36 tok/s`; earlier e4b-only manual measurements reached `51-52 tok/s`.
- `gemma4:e2b` is the fastest measured local option so far: about `70-71 tok/s`, using about `7.7 GB` of unified memory.
- `gemma4:26b` is surprisingly usable on this M1 Max: about `35-36 tok/s` at `Q4_K_M`, using about `19 GB` of unified memory.
- `gemma4:31b` is usable but much slower: about `8.7-9.1 tok/s`, using about `25 GB` of unified memory.
- llama.cpp with official ggml-org E4B GGUF works and measured about `38.5 tok/s`.
- MLX was investigated and installed, but Gemma 4 E4B did not load cleanly in current `mlx-lm 0.31.3`.
- Based on speed/quality tradeoff, practical daily choices are:
  - `gemma4-fast` / `gemma4:e2b` for speed.
  - `gemma4-26b` for a stronger model that is still interactive.
  - `gemma4-31b` only when dense 31B quality matters more than latency.
- `think=false` matters for normal usage because it avoids extra thinking output and saves wall-clock time.
- Keeping the model warm avoids the roughly `2-3 s` load penalty. The LaunchAgent and wrapper commands now use `30m`; use `gemma4-preload gemma4:e2b 4096 30m` before repeated short calls.
- For short chats, avoid the full `131072` context unless needed. A smaller `num_ctx` such as `4096` or `8192` uses less memory and improves prompt processing/load behavior.
- Flash Attention / KV cache quantization were tested and rejected for this machine/model combination because they were slower in the measured cases.
- Current battery / power state can dominate backend choice. If token/s suddenly falls from about `70 tok/s` to single digits, plug in power, enable High Power Mode, let the machine cool, and rerun the benchmark.

## Sources checked

- Google/Hugging Face official Gemma 4 model card: <https://huggingface.co/google/gemma-4-E4B-it>
- Ollama Gemma 4 library: <https://ollama.com/library/gemma4>
- Ollama FAQ / server tuning docs: <https://docs.ollama.com/faq>
- llama.cpp README: <https://github.com/ggml-org/llama.cpp>
- llama.cpp releases: <https://github.com/ggml-org/llama.cpp/releases>
- MLX install docs: <https://ml-explore.github.io/mlx/build/html/install.html>
- mlx-lm README: <https://github.com/ml-explore/mlx-lm>
- Hugging Face Hub environment variables: <https://huggingface.co/docs/huggingface_hub/main/package_reference/environment_variables>
- Apple Power Modes support page: <https://support.apple.com/en-us/101613>
- GGUF model repos:
  - <https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF>
  - <https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF>
- MLX model repos:
  - <https://huggingface.co/mlx-community/gemma-4-e4b-it-4bit>
  - <https://huggingface.co/mlx-community/gemma-4-26b-a4b-it-4bit>
  - <https://huggingface.co/mlx-community/gemma-4-31b-it-4bit>

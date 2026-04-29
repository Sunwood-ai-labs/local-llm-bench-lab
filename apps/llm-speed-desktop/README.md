# Local LLM Speed Lab

Gemma 4 の実験レポートにある速度表を、Tauri のデスクトップ UI からそのまま体感するためのアプリです。

## 起動

```sh
npm install
npm run tauri dev
```

## 測定できるもの

- Ollama: `/api/generate` を呼び、`eval_count / eval_duration` から生成 tok/s を出します。
- MLX VLM server: OpenAI compatible `/v1/chat/completions` を呼び、`usage.generation_tps` や wall time を表示します。
- llama.cpp: `llama-bench -hf ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M -p 512 -n 512 -r 1 -ngl 99 -fa 1 -o json` 相当を実行します。

## 既定値

- Ollama URL: `http://127.0.0.1:11434`
- MLX server URL: `http://127.0.0.1:18080`
- MLX model path: `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/models/mlx-community-gemma-4-e2b-it-4bit`

`llama-bench` は PATH から探します。見つからない場合は UI の `llama-bench` 欄にフルパスを入れてください。

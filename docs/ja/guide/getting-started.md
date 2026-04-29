---
title: はじめに
description: local-llm-bench-lab のローカル環境を準備する。
---

# はじめに

このリポジトリは Apple Silicon 上のローカル LLM 実験を前提にしています。スクリプト自体は軽量ですが、呼び出し先の runtime にはローカルモデル、Ollama モデル、MLX 互換モデルディレクトリなどが必要です。

## 必要なもの

- 初期 MLX VLM workflow では Apple Silicon macOS
- Python 3.10 以上
- Ollama / OpenAI compatible server ベンチ用の `curl` と `jq`
- `scripts/ollama_bench.sh` 用の Ollama
- `scripts/mlx_vlm_bench.py` 用の MLX VLM

## Python セットアップ

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

## ローカル設定

`.env.example` を出発点にします。

```sh
cp .env.example .env
```

`.env` は Git 管理外なので、マシン固有のパスや URL を安全に置けます。

## 成果物の扱い

ローカルモデルは `artifacts/models/` などの ignored path に置きます。Git には、軽量な結果ファイルと再現メモを残します。

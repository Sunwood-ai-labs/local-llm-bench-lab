---
title: ホーム
description: Apple Silicon 上のローカル LLM ベンチマークを再現可能に記録する実験リポジトリ。
---

# local-llm-bench-lab

`local-llm-bench-lab` は、Apple Silicon 上でローカル LLM を比較するための公開実験リポジトリです。再利用できるスクリプト、軽量な結果ファイル、実験レポートを残し、モデル本体や cache などの重いローカル成果物は Git から除外します。

## 含まれるもの

- Ollama 向けベンチスクリプト
- MLX VLM の direct / server ベンチスクリプト
- 初期 Gemma 4 実験の llama.cpp 結果
- 日英 README とドキュメント
- 検証と Pages 公開用の GitHub Actions
- 公開リポジトリ向けの community files と issue templates

## 初期実験

最初の記録は `experiments/gemma4-2026-04-29/` です。Apple M1 Max / 64GB unified memory 環境で、Gemma 4 系モデルを Ollama、MLX VLM、llama.cpp で比較しています。

## 読み始める場所

1. [はじめに](./guide/getting-started.md) を読む。
2. [使い方](./guide/usage.md) に沿ってベンチを実行する。
3. [実験記録](./guide/experiment-records.md) で結果の置き方を確認する。
4. 困ったら [トラブルシュート](./guide/troubleshooting.md) を確認する。

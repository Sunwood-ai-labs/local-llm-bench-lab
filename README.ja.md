<p align="center">
  <img src="docs/public/ogp.svg" alt="local-llm-bench-lab" width="720">
</p>

# local-llm-bench-lab

Apple Silicon 上でローカル LLM の実行速度、設定、再現手順を記録するためのベンチマーク実験リポジトリです。

<p>
  <a href="README.md">English</a> |
  <a href="https://sunwood-ai-labs.github.io/local-llm-bench-lab/ja/">Docs</a> |
  <a href="https://github.com/Sunwood-ai-labs/local-llm-bench-lab">GitHub</a>
</p>

<p>
  <a href="https://github.com/Sunwood-ai-labs/local-llm-bench-lab/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Sunwood-ai-labs/local-llm-bench-lab/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/Sunwood-ai-labs/local-llm-bench-lab/actions/workflows/deploy-docs.yml"><img alt="Docs" src="https://github.com/Sunwood-ai-labs/local-llm-bench-lab/actions/workflows/deploy-docs.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2f6f73"></a>
</p>

## ✨ このリポジトリについて

Ollama、MLX VLM、llama.cpp など複数のローカル LLM 実行方式を、同じ形式で測定・保存するための実験置き場です。最初の収録対象は Apple M1 Max 上での Gemma 4 実験ですが、今後別モデルを足しても自然に比較できるよう、モデル非依存の構成にしています。

Git に入れるのは、再利用できるスクリプト、軽量な結果ファイル、レポート、再現メモです。モデル本体、venv、Hugging Face cache、生ログ、完全コピーは `.gitignore` で除外します。

## 🚀 クイックスタート

Python ヘルパーを準備します。

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Ollama ベンチを実行します。

```sh
scripts/ollama_bench.sh gemma4:e2b
```

MLX VLM ベンチを実行します。

```sh
scripts/mlx_vlm_bench.py \
  --model artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
  --out benchmarks/mlx-vlm-run.jsonl
```

MLX VLM server ベンチを実行します。

```sh
MODEL=artifacts/models/mlx-community-gemma-4-e2b-it-4bit \
scripts/mlx_vlm_server_bench.sh
```

ローカル設定は `.env.example` を参考にしてください。`.env` は Git 管理外です。

## 📊 初期実験

初期データは `experiments/gemma4-2026-04-29/` にあります。

- `reports/Gemma4_Local_LLM_Report_JA.md`: 日本語の実験レポート
- `reports/raw_setup_and_bench_log.md`: セットアップと測定の記録
- `benchmarks/`: JSONL、TSV、軽量 JSON の結果ファイル
- `FULL_COPY.md`: ローカル完全コピーの扱い

レポート内の代表値:

| 実行方式 | モデル | 生成速度 | メモ |
|---|---:|---:|---|
| Ollama | `gemma4:e2b` | 約70 tok/s | 実験内で最速の日常利用候補 |
| Ollama | `gemma4:26b` | 約36 tok/s | 大きめの sparse MoE だが実用的 |
| MLX VLM server | E2B 4-bit | 約70-76 tok/s | KV cache 8-bit の常駐サーバー |
| llama.cpp | E4B GGUF | 約38.5 tok/s | Metal backend、Ollama E4B と近い速度 |

詳細な環境、注意点、コマンドはレポートを参照してください。

## 🧭 ディレクトリ構成

```text
benchmarks/                         実験横断の集計置き場
configs/                            モデル・バックエンド設定メモ
docs/                               VitePress ドキュメントサイト
experiments/gemma4-2026-04-29/      初期 Gemma 4 実験
scripts/                            再利用できるベンチスクリプト
tools/                              補助ツール
artifacts/                          ローカル生成物置き場。重いものは管理外
```

## 🛡 データ管理方針

Git に入れないもの:

- `.gguf`、`.safetensors`、`.bin`、`.pt`、`.onnx` などのモデル本体
- `models/`、`hf-cache/`、Hugging Face cache
- Python 仮想環境
- 実行ログ、一時ダウンロード断片
- `experiments/*/full-copy/`

代わりに、軽量な JSONL、TSV、JSON summary、レポート、スクリプト、再現メモを残します。

## 📚 ドキュメント

ドキュメントサイトは `docs/` にあり、GitHub Pages で公開します。

```sh
cd docs
npm ci
npm run docs:build
```

ローカルプレビュー:

```sh
npm run docs:dev
```

## 🤝 コントリビューション

ベンチ結果の再現性とリポジトリの軽さを保つ変更を歓迎します。新しい測定を追加するときは `CONTRIBUTING.md` と issue template を確認し、モデル本体などの重いファイルはコミットしないでください。

## 📄 ライセンス

このリポジトリは MIT License で公開しています。詳細は `LICENSE` を参照してください。

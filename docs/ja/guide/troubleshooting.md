---
title: トラブルシュート
description: ローカルベンチでよくある問題と確認方法。
---

# トラブルシュート

## Ollama request が失敗する

server が起動しているか確認します。

```sh
curl http://127.0.0.1:11434/api/tags
```

モデルが無い場合は先に取得します。

```sh
ollama pull gemma4:e2b
```

## `jq` が無い

shell ベンチスクリプトは request payload の作成と結果抽出に `jq` を使います。先に `jq` をインストールしてください。

## MLX VLM import が失敗する

Python 依存関係を入れます。

```sh
python3 -m pip install -r requirements.txt
```

MLX VLM の対応状況は変わります。特定バージョンに依存する結果は、実験メモに package version を残してください。

## 出力先を間違えた

`OUT_DIR` を明示します。

```sh
OUT_DIR=experiments/my-run/benchmarks scripts/ollama_bench.sh gemma4:e2b
```

## 重いファイルが staging されている

staged payload を確認します。

```sh
git diff --cached --stat
git ls-files -ci --exclude-standard
```

モデルや cache が staged されている場合は index から外し、ignored path に置いてください。

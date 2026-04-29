---
title: 実験記録
description: ベンチ結果とレポートの整理方法。
---

# 実験記録

実験はモデルファミリーやトピックと日付でまとめます。

```text
experiments/<model-or-topic>-<yyyy-mm-dd>/
```

初期例:

```text
experiments/gemma4-2026-04-29/
```

## 推奨構成

```text
experiments/<name>/
  README.md
  reports/
  benchmarks/
```

`reports/` には人が読むメモ、`benchmarks/` には軽量な結果ファイルを置きます。

## Git 管理するもの

コミットするもの:

- `.jsonl`
- `.json`
- `.tsv`
- `.md`
- 再現に必要なスクリプト

コミットしないもの:

- `.log`、`.err`、`.out` などの生ログ
- モデル本体
- 仮想環境
- ローカル cache
- `full-copy/` バックアップ

## 最小限の記録項目

モデル、runtime、ハードウェア、実行コマンド、context size、temperature、quantization、出力 token 数、速度に効く server 設定を残します。

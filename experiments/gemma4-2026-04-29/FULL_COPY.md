# Full copy

元の一時実験フォルダは削除済みで、内容はローカルバックアップとして以下にあります。

```text
experiments/gemma4-2026-04-29/full-copy/
```

この `full-copy/` には、レポート、ベンチログ、MLX 用モデル、venv、Hugging Face cache、server log など、元フォルダ内の内容をそのまま含めています。

注意:

- モデル本体、venv、cache、log は容量が大きいので `.gitignore` により Git 管理対象外です。
- 再現に必要な軽量スクリプト、レポート、JSON/TSV の主要ベンチ結果はリポジトリ直下の `scripts/` や `experiments/gemma4-2026-04-29/benchmarks/` にもコピー済みです。
- `full-copy/` がこの実験の正本です。
- MLX server LaunchAgent と `gemma4-mlx-e2b` wrapper も、この `full-copy/` を参照するように更新済みです。

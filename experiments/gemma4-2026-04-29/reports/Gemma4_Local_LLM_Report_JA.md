# Gemma 4 ローカル実行環境 調査・構築・ベンチマーク報告書

作成日: 2026-04-29  
対象PC: Apple M1 Max / 64GB unified memory / macOS 26.4.1  
実験フォルダ: `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy`

## 1. 要約

このPCでは、Ollama を使う構成が最も安定して Gemma 4 をローカル実行できた。量子化済みの `Q4_K_M` モデルを使い、`gemma4:e2b`, `gemma4:e4b`, `gemma4:26b`, `gemma4:31b` を導入済み。

実測では、速度重視なら `gemma4:e2b` が最有力で、良好な状態では約 `70 tok/s`。品質と速度のバランスを取るなら `gemma4:26b` が有力で、約 `36 tok/s`。`gemma4:31b` は dense な大きいモデルとして動作するが、約 `9 tok/s` で体感はかなり重い。

llama.cpp も公式 GGUF を使えば動作したが、E4B の生成速度は約 `38.5 tok/s` で、Ollama の E4B と同程度だった。MLX は当初 `mlx-lm` / 古い `mlx-vlm` で失敗したが、ネットワーク復帰後に Python 3.12 + `mlx-vlm` へ更新し、`mlx-community/gemma-4-e2b-it-4bit` のローカル実行に成功した。さらに `mlx-vlm 0.4.4`、KV cache 8bit、サーバー常駐を採用したことで、短文応答は約 `1秒`、512トークン生成は約 `70-76 tok/s` の範囲で動作するようになった。

## 2. 推奨構成

日常利用では以下を推奨する。

| 用途 | 推奨コマンド | 理由 |
|---|---|---|
| 最速で試す | `gemma4-fast` | `gemma4:e2b`。最も高速でメモリ消費も小さい |
| 標準利用 | `gemma4` | `gemma4:e4b`。軽めのバランス型 |
| 品質寄り | `gemma4-26b` | Sparse MoE のため、モデルサイズの割に速度が出る |
| 大きい dense モデル確認 | `gemma4-31b` | 動作はするが遅い。品質確認用 |
| 連続利用前の事前ロード | `gemma4-preload gemma4:e2b 4096 30m` | 初回ロード待ちを減らし、コンテキストを小さく保てる |
| MLXで最速寄りに試す | `gemma4-mlx-e2b '...'` | サーバー常駐版。短文は約1秒、512生成は約70-76 tok/s |

高速化として採用した設定:

- Ollama サーバを LaunchAgent で常駐。
- `OLLAMA_KEEP_ALIVE=30m` でモデルを長めに保持。
- `OLLAMA_MAX_LOADED_MODELS=1` で複数モデルの同時ロードを避ける。
- `OLLAMA_NUM_PARALLEL=1` でローカル対話用途の余計な並列化を抑える。
- wrapper 側も `--think=false --keepalive 30m` を指定。

## 3. 調査した実行方式

### Ollama

最も安定した実行方式。Gemma 4 のチャットテンプレートやモデル管理を Ollama 側が吸収してくれるため、今回の用途では第一候補。

導入済み:

- Ollama: `0.22.0`
- CLI: `/Users/admin/.local/bin/ollama`
- サーバ: `127.0.0.1:11434`
- モデル保存先: `/Users/admin/.ollama/models`

導入済みモデル:

| モデル | Ollama表示サイズ | 量子化 | 備考 |
|---|---:|---|---|
| `gemma4:e2b` | 7.2GB | Q4_K_M | 最速 |
| `gemma4:e4b` | 9.6GB | Q4_K_M | 標準 |
| `gemma4:26b` | 17GB | Q4_K_M | Sparse MoE。実効 active params が小さく速い |
| `gemma4:31b` | 19GB | Q4_K_M | Dense な大きいモデル |

### llama.cpp

Ollama の内部 blob を直接読む方法は失敗した。正しいルートは、ggml-org の公式 GGUF リポジトリから取得して llama.cpp で読む方法。

今回成功したコマンド:

```sh
tools/llama-b8967/llama-bench \
  -hf ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M \
  -p 512 -n 512 -r 1 -ngl 99 -fa 1 -o json
```

結果:

- Prompt processing: `537.9 tok/s`
- Generation: `38.5 tok/s`
- Backend: Metal / BLAS
- GPU: Apple M1 Max

### MLX

MLX / mlx-lm / mlx-vlm は Apple Silicon 向けとして有力なので調査した。

最初に導入した環境:

- `mlx 0.31.2`
- `mlx-lm 0.31.3`
- `huggingface_hub 1.12.1`
- venv: `/Users/admin/Documents/Codex/2026-04-29/gemma4-pc/.venv-mlx`

ただし、最初に試した `jorch/gemma-4-e4b-it-lm-4bit` は `mlx-lm` ロード時に以下の問題で失敗した。

```text
ValueError: Received 1604 parameters not in model
```

`language_model.*` や `embed_tokens_per_layer.*` が未対応パラメータとして出ており、Gemma 4 の変換形式と現在の `mlx-lm` 側実装の不一致と見ている。

ネットワーク復帰後の再試行:

- 公式モデルカード側の変換環境に合わせ、Python 3.12 の venv を追加。
- 新しい環境:
  - venv: `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/.venv-mlx-vlm-py3`
  - Python: `3.12.13`
  - `mlx-vlm 0.4.4`
  - `mlx 0.31.2`
  - `mlx-lm 0.31.3`
- `mlx-vlm 0.4.4` では `gemma4` モジュールが存在することを確認。
- `mlx-community/gemma-4-e2b-it-4bit` をローカル保存:
  - `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/models/mlx-community-gemma-4-e2b-it-4bit`
- 使いやすい wrapper として `/Users/admin/.local/bin/gemma4-mlx-e2b` を追加。
- サーバー常駐用 LaunchAgent を追加:
  - `/Users/admin/Library/LaunchAgents/com.gemma4.mlx.e2b.server.plist`
  - `127.0.0.1:18080`
  - `--kv-bits 8`
  - `--kv-quant-scheme uniform`

Hugging Face 標準ダウンロードは `model.safetensors` の途中で停止したため、Range 対応の分割再開ダウンローダを追加した。

- 追加スクリプト:
  - `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/tools/hf_range_download.py`
- 既存の `678.9MB` 部分ダウンロードを seed として再利用し、最終的に `3.3GB` の `model.safetensors` を取得完了。

## 4. ベンチマーク方法

Ollama API に対して以下の条件で測定した。

- `stream: false`
- `think: false`
- `temperature: 0`
- 生成速度は `eval_count / eval_duration` から算出
- 主な比較ケースは `jp_long_512_ctx4096`

ベンチスクリプト:

- `/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/benchmarks/ollama_bench.sh`

代表コマンド:

```sh
/Users/admin/Prj/local-llm-bench-lab/experiments/gemma4-2026-04-29/full-copy/benchmarks/ollama_bench.sh gemma4:e2b
```

## 5. 実測結果

主比較ケース `jp_long_512_ctx4096` の結果。

| モデル / 実行方式 | 生成速度 | Prompt速度 | メモリ観測 | コメント |
|---|---:|---:|---:|---|
| `gemma4:e2b` / Ollama | 70.1 tok/s | 584 tok/s | 約7.7GB | 最速 |
| `gemma4:e4b` / Ollama | 36.2 tok/s | 348 tok/s | 約10GB | 標準 |
| `gemma4:26b` / Ollama | 36.2 tok/s | 262 tok/s | 約19GB | 大きい割に速い |
| `gemma4:31b` / Ollama | 9.14 tok/s | 71 tok/s | 約25GB | 動くが重い |
| E4B GGUF / llama.cpp | 38.5 tok/s | 537.9 tok/s | 未計測 | Ollama E4B と同程度 |
| E2B 4bit / MLX VLM | 75.7 tok/s | 467 tok/s | 約3.74GB | Python 3.12 + mlx-vlm 0.4.3で初回成功 |
| E2B 4bit / MLX VLM server | 70.8 tok/s | 355 tok/s | 約3.74GB | `mlx-vlm 0.4.4` + KV 8bit、常駐版 |

詳細ログ:

- `benchmarks/gemma4-e2b-20260429-193131.tsv`
- `benchmarks/gemma4-e4b-20260429-191117.tsv`
- `benchmarks/gemma4-26b-20260429-191027.tsv`
- `benchmarks/gemma4-31b-20260429-202818.tsv`
- `benchmarks/llamacpp-e4b-hf-bench.json`
- `benchmarks/mlx-vlm-043-gemma4-e2b-20260429-225144.jsonl`

MLX VLM の詳細:

| ケース | 生成トークン | 生成速度 | Prompt速度 | Wall time | Peak memory |
|---|---:|---:|---:|---:|---:|
| `short_chat_128` | 73 | 82.8 tok/s | 173 tok/s | 1.16 s | 3.69GB |
| `jp_long_512` | 512 | 75.7 tok/s | 467 tok/s | 6.88 s | 3.74GB |

## 5.1 モデル別の最速構成

現時点の実測から見ると、モデル別の最速構成は以下。

| モデル | 最速構成 | 512生成の速度 | 短文レイテンシ | メモリ目安 | 判断 |
|---|---|---:|---:|---:|---|
| Gemma 4 E2B | MLX VLM `0.4.4` + E2B 4bit + KV 8bit uniform | 76.3 tok/s | 約1秒台 | 約3.7GB | 最速。普段使いは `gemma4-mlx-e2b` |
| Gemma 4 E2B | Ollama `gemma4:e2b` 通常設定 | 70.1 tok/s | 約4.3秒 cold / warmは短い | 約7.7GB | Ollamaで使うなら最速 |
| Gemma 4 E4B | Ollama `gemma4:e4b` warm通常設定 | 51-52 tok/s | 約2-4秒 | 約10GB | 最高値はOllama手動測定。ただし後続scriptでは36.2 tok/s |
| Gemma 4 E4B | llama.cpp official GGUF Q4_K_M + Metal + `-fa 1` | 38.5 tok/s | 未計測 | 未計測 | E4Bの公平script比較ではOllama 36.2より少し速い |
| Gemma 4 26B A4B | Ollama `gemma4:26b` 通常設定 | 36.2 tok/s | 約7.1秒 cold | 約19GB | 大きい割に速い。品質寄りの実用候補 |
| Gemma 4 31B dense | Ollama `gemma4:31b` 通常設定 | 9.14 tok/s | 約14.8秒 cold | 約25GB | 動くが重い。品質確認用 |

E2B内の高速化比較:

| 構成 | 512生成 | 判断 |
|---|---:|---|
| MLX VLM `0.4.4` + KV 8bit uniform | 76.3 tok/s | 採用 |
| MLX VLM `0.4.4` baseline | 73.8 tok/s | 良好 |
| MLX VLM server + KV 8bit uniform | 70.8 tok/s | 常駐でレイテンシが小さい。日常利用向き |
| Ollama `gemma4:e2b` 通常 | 70.1 tok/s | Ollama内では最速 |
| Ollama `gemma4:e2b` + Flash Attention | 35.1 tok/s | 不採用 |
| Ollama `gemma4:e2b` + Flash Attention + KV q8_0 | 40.0 tok/s | 不採用 |

結論:

- 最速で軽く使うなら `gemma4-mlx-e2b`。
- Ollamaだけで統一したいなら `gemma4-fast`。
- 速度と品質のバランスなら `gemma4-26b`。
- E4Bは Ollama と llama.cpp が近い。安定運用は Ollama、GGUF実験は llama.cpp。
- 31Bは速度より品質確認用。

Wrapper smoke test:

- `MLX_MAX_TOKENS=32 gemma4-mlx-e2b '日本語で短く、MLX版Gemma 4が動いたことを一文で説明して。'`
- Prompt: `204.9 tok/s`
- Generation: `83.8 tok/s`
- Peak memory: `3.69GB`

追加高速化パス:

| 設定 | `short_chat_128` | `jp_long_512` | 判断 |
|---|---:|---:|---|
| `mlx-vlm 0.4.4` baseline | 74.4 tok/s | 73.8 tok/s | 良好 |
| `mlx-vlm 0.4.4` + KV 8bit uniform | 80.8 tok/s | 76.3 tok/s | 採用 |
| `mlx-vlm 0.4.4` + TurboQuant 4bit | 80.8 tok/s | 72.4 tok/s | E2B短文用途では不採用 |
| KV 8bit + prefill 512 | 75.9 tok/s | 70.9 tok/s | 遅いので不採用 |
| KV 8bit + prefill 1024 | 77.1 tok/s | 72.0 tok/s | 既定値より明確な改善なし |
| KV 8bit + prefill 2048 | 76.2 tok/s | 71.9 tok/s | 既定値。維持 |

サーバー常駐版:

- `launchctl` で `com.gemma4.mlx.e2b.server` が自動起動。
- `gemma4-mlx-e2b` はサーバーが生きていれば `/v1/chat/completions` を使う。
- wrapper のパイプライン後に CLI fallback まで実行されるバグを修正。
- `verbose:false` を固定し、余計なベンチ詳細を本文に混ぜないようにした。
- 再起動後の確認:
  - MLX server: running, `127.0.0.1:18080`
  - Ollama server: running, `127.0.0.1:11434`
  - `gemma4-mlx-e2b` の短文応答: 約 `1.07 s`
  - server bench `jp_long_512`: `70.8 tok/s`, peak memory 約 `3.74GB`

## 6. 高速化検証

Ollama の Flash Attention と KV cache 量子化も試した。

| 設定 | short 128 | jp long 512 ctx4096 | jp long 512 ctx8192 | 判断 |
|---|---:|---:|---:|---|
| 通常 Ollama | 64.5 tok/s | 70.1 tok/s | 71.1 tok/s | 採用 |
| `OLLAMA_FLASH_ATTENTION=1` | 52.8 tok/s | 35.1 tok/s | 32.0 tok/s | 不採用 |
| `OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0` | 25.5 tok/s | 40.0 tok/s | 40.3 tok/s | 不採用 |

結論として、このPCと今回の Gemma 4 E2B の短〜中コンテキスト用途では、Flash Attention / KV cache 量子化は速度改善にならなかった。これらは主に長大コンテキスト時のメモリ削減や条件次第の改善を狙う機能として扱うべき。

今回採用した高速化は、生成アルゴリズムの変更ではなく、運用上の待ち時間削減と安定化。

- モデルを30分保持して初回ロードを減らす。
- 1モデルだけロードして unified memory の圧迫を避ける。
- 不要な巨大コンテキストを使わず `4096` や `8192` を基本にする。
- 通常対話では `think=false` にする。

## 7. 注意点: 電源状態の影響

途中で速度が急に一桁 tok/s まで落ちた。確認時の状態は以下。

```text
Now drawing from 'Battery Power'
powermode 0
```

同じタイミングで Ollama だけでなく llama.cpp も遅くなったため、バックエンド固有の問題というより、バッテリー駆動・電源モード・熱状態の影響が大きいと判断した。

最高速を測る場合は以下を推奨する。

1. 電源アダプタに接続する。
2. macOS の Battery 設定で High Power Mode を使える場合は有効化する。
3. しばらく冷却してから測定する。
4. 一度 `ollama stop <model>` で状態を整理してから再測定する。

`pmset` による High Power Mode 変更は root 権限が必要だったため、この実験では自動変更していない。

## 8. 最終判断

このPCで Gemma 4 を実用するなら、現時点の第一候補は Ollama。

用途別には以下。

- 速度重視: `gemma4-fast`
- 普段使い: `gemma4`
- 品質寄りでまだ実用速度がほしい: `gemma4-26b`
- 大きい dense モデルの確認: `gemma4-31b`

llama.cpp は GGUF 管理やサーバ運用を細かく制御したい場合に有効。ただし今回の速度だけを見ると、Ollama を置き換える決定打ではない。

MLX は Python 3.12 + `mlx-vlm 0.4.4` なら Gemma 4 E2B 4bit が動作し、速度も良い。現時点では大きいモデルや扱いやすさは Ollama が強いが、E2B を最速・低メモリで使うなら `gemma4-mlx-e2b` が最有力。

## 9. 参照URL

- Google / Hugging Face Gemma 4 model card: <https://huggingface.co/google/gemma-4-E4B-it>
- Ollama Gemma 4 library: <https://ollama.com/library/gemma4>
- Ollama FAQ / server tuning: <https://docs.ollama.com/faq>
- llama.cpp README: <https://github.com/ggml-org/llama.cpp>
- llama.cpp releases: <https://github.com/ggml-org/llama.cpp/releases>
- MLX install docs: <https://ml-explore.github.io/mlx/build/html/install.html>
- mlx-lm: <https://github.com/ml-explore/mlx-lm>
- Hugging Face Hub environment variables: <https://huggingface.co/docs/huggingface_hub/main/package_reference/environment_variables>
- Apple Power Modes: <https://support.apple.com/en-us/101613>
- ggml-org Gemma 4 E4B GGUF: <https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF>
- ggml-org Gemma 4 26B A4B GGUF: <https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF>
- ggml-org Gemma 4 31B GGUF: <https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF>

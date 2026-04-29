#!/usr/bin/env python3
import argparse
import json
import os
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "benchmarks"
HF_HOME = ROOT / ".hf-cache"
os.environ.setdefault("HF_HOME", str(HF_HOME))

import mlx.core as mx
from mlx_lm import load
from mlx_lm.generate import stream_generate


def model_slug(model: str) -> str:
    return model.replace("/", "-").replace(":", "-")


def chat_prompt(tokenizer, prompt: str) -> str:
    if getattr(tokenizer, "has_chat_template", False):
        messages = [{"role": "user", "content": prompt}]
        return tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=False,
        )
    return prompt


def run_case(model, tokenizer, name: str, prompt: str, max_tokens: int) -> dict:
    if hasattr(mx, "reset_peak_memory"):
        mx.reset_peak_memory()

    formatted = chat_prompt(tokenizer, prompt)
    text_parts = []
    last = None

    start = time.perf_counter()
    for response in stream_generate(
        model,
        tokenizer,
        formatted,
        max_tokens=max_tokens,
        temp=0.0,
    ):
        text_parts.append(response.text)
        last = response
    wall_s = time.perf_counter() - start

    if last is None:
        raise RuntimeError(f"no response for case {name}")

    return {
        "case": name,
        "prompt_tokens": int(last.prompt_tokens),
        "prompt_tok_s": float(last.prompt_tps),
        "generation_tokens": int(last.generation_tokens),
        "generation_tok_s": float(last.generation_tps),
        "wall_s": wall_s,
        "peak_memory_gb": float(last.peak_memory),
        "finish_reason": last.finish_reason,
        "sample": "".join(text_parts)[:500],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default="jorch/gemma-4-e4b-it-lm-4bit",
        help="Hugging Face repo or local MLX model path",
    )
    args = parser.parse_args()

    HF_HOME.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    stamp = time.strftime("%Y%m%d-%H%M%S")
    slug = model_slug(args.model)
    jsonl_path = OUT_DIR / f"mlx-{slug}-{stamp}.jsonl"
    tsv_path = OUT_DIR / f"mlx-{slug}-{stamp}.tsv"

    load_start = time.perf_counter()
    model, tokenizer = load(args.model)
    load_s = time.perf_counter() - load_start

    cases = [
        (
            "short_chat_128",
            128,
            "日本語で短く答えてください。ローカルLLMをApple Siliconで動かす利点を3つ挙げてください。",
        ),
        (
            "jp_long_512",
            512,
            "日本語で、ローカルLLMをApple Silicon上で運用するときの速度、メモリ、コンテキスト長、量子化、推論サーバー選定の観点を、実務向けに詳しく説明してください。",
        ),
        (
            "jp_long_512_run2",
            512,
            "日本語で、ローカルLLMのベンチマークを取るときに注意すべき点を説明してください。初回ロード、プロンプト処理、生成速度、温度、最大生成トークン数、GPU利用率を含めてください。",
        ),
    ]

    with tsv_path.open("w", encoding="utf-8") as tsv, jsonl_path.open(
        "w", encoding="utf-8"
    ) as jsonl:
        tsv.write(
            "case\tmodel\tload_s\tprompt_tokens\tprompt_tok_s\t"
            "generation_tokens\tgeneration_tok_s\twall_s\tpeak_memory_gb\tfinish_reason\n"
        )
        for name, max_tokens, prompt in cases:
            row = run_case(model, tokenizer, name, prompt, max_tokens)
            row["model"] = args.model
            row["load_s"] = load_s
            jsonl.write(json.dumps(row, ensure_ascii=False) + "\n")
            tsv.write(
                "\t".join(
                    [
                        row["case"],
                        row["model"],
                        f"{row['load_s']:.6f}",
                        str(row["prompt_tokens"]),
                        f"{row['prompt_tok_s']:.6f}",
                        str(row["generation_tokens"]),
                        f"{row['generation_tok_s']:.6f}",
                        f"{row['wall_s']:.6f}",
                        f"{row['peak_memory_gb']:.6f}",
                        str(row["finish_reason"]),
                    ]
                )
                + "\n"
            )
            print(
                f"{row['case']}\t{row['model']}\t"
                f"{row['generation_tokens']} tok\t"
                f"{row['generation_tok_s']:.2f} tok/s\t"
                f"peak {row['peak_memory_gb']:.2f} GB"
            )

    print(f"JSONL: {jsonl_path}")
    print(f"TSV:   {tsv_path}")


if __name__ == "__main__":
    main()

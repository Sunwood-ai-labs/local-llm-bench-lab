#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path

from mlx_vlm import apply_chat_template, generate, load


CASES = [
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
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--kv-bits", type=float)
    parser.add_argument("--kv-quant-scheme", choices=["uniform", "turboquant"])
    parser.add_argument("--prefill-step-size", type=int)
    args = parser.parse_args()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    load_start = time.perf_counter()
    model, processor = load(args.model)
    config = model.config
    load_s = time.perf_counter() - load_start

    gen_kwargs = {}
    if args.kv_bits is not None:
        gen_kwargs["kv_bits"] = args.kv_bits
    if args.kv_quant_scheme is not None:
        gen_kwargs["kv_quant_scheme"] = args.kv_quant_scheme
    if args.prefill_step_size is not None:
        gen_kwargs["prefill_step_size"] = args.prefill_step_size

    rows = []
    for name, max_tokens, prompt in CASES:
        start = time.perf_counter()
        templated_prompt = apply_chat_template(
            processor,
            config,
            prompt,
            num_images=0,
            num_audios=0,
            enable_thinking=False,
        )
        result = generate(
            model,
            processor,
            templated_prompt,
            max_tokens=max_tokens,
            temperature=args.temperature,
            verbose=False,
            enable_thinking=False,
            **gen_kwargs,
        )
        wall_s = time.perf_counter() - start
        row = {
            "case": name,
            "model": args.model,
            "max_tokens": max_tokens,
            "load_s": load_s,
            "wall_s": wall_s,
            "prompt_tokens": result.prompt_tokens,
            "generation_tokens": result.generation_tokens,
            "total_tokens": result.total_tokens,
            "prompt_tps": result.prompt_tps,
            "generation_tps": result.generation_tps,
            "peak_memory_gb": result.peak_memory,
            "kv_bits": args.kv_bits,
            "kv_quant_scheme": args.kv_quant_scheme,
            "prefill_step_size": args.prefill_step_size,
            "text_preview": result.text[:240],
        }
        rows.append(row)
        print(
            "\t".join(
                [
                    row["case"],
                    str(row["generation_tokens"]),
                    f"{row['generation_tps']:.3f}",
                    f"{row['prompt_tps']:.3f}",
                    f"{row['wall_s']:.3f}",
                    f"{row['peak_memory_gb']:.3f}",
                ]
            ),
            flush=True,
        )

    out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    print(f"JSONL: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

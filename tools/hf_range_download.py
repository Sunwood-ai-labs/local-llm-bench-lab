#!/usr/bin/env python3
import argparse
import concurrent.futures as futures
import os
import sys
import threading
import time
from pathlib import Path

import requests
from huggingface_hub import hf_hub_url


def human(n: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    x = float(n)
    for unit in units:
        if x < 1024 or unit == units[-1]:
            return f"{x:.1f}{unit}"
        x /= 1024


def seed_parts(seed_path: Path, part_dir: Path, chunk_size: int) -> None:
    if not seed_path.exists():
        return
    size = seed_path.stat().st_size
    if size <= 0:
        return
    print(f"Seeding parts from {seed_path} ({human(size)})", flush=True)
    part_dir.mkdir(parents=True, exist_ok=True)
    with seed_path.open("rb") as src:
        idx = 0
        while True:
            data = src.read(chunk_size)
            if not data:
                break
            part = part_dir / f"part-{idx:05d}"
            if not part.exists() or part.stat().st_size < len(data):
                with part.open("wb") as dst:
                    dst.write(data)
            idx += 1


def download_chunk(origin_url: str, part: Path, start: int, end: int, timeout: int, retries: int) -> int:
    expected = end - start + 1
    have = part.stat().st_size if part.exists() else 0
    if have == expected:
        return expected
    if have > expected:
        part.write_bytes(part.read_bytes()[:expected])
        return expected

    for attempt in range(1, retries + 1):
        try:
            headers = {"Range": f"bytes={start + have}-{end}"}
            with requests.get(origin_url, headers=headers, stream=True, timeout=timeout, allow_redirects=True) as r:
                if r.status_code not in (200, 206):
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                mode = "ab" if have else "wb"
                with part.open(mode) as f:
                    for block in r.iter_content(chunk_size=1024 * 256):
                        if block:
                            f.write(block)
            have = part.stat().st_size
            if have == expected:
                return expected
            raise RuntimeError(f"short chunk: {have}/{expected}")
        except Exception as exc:
            if attempt == retries:
                raise
            print(f"retry chunk {part.name} ({attempt}/{retries}): {exc}", flush=True)
            time.sleep(min(2 * attempt, 10))
            have = part.stat().st_size if part.exists() else 0
    return have


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repo")
    parser.add_argument("filename")
    parser.add_argument("output")
    parser.add_argument("--seed-prefix")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--chunk-mib", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--retries", type=int, default=5)
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    origin_url = hf_hub_url(args.repo, args.filename)

    head = requests.head(origin_url, allow_redirects=True, timeout=args.timeout)
    head.raise_for_status()
    total = int(head.headers["content-length"])

    if output.exists() and output.stat().st_size == total:
        print(f"Already complete: {output} ({human(total)})")
        return 0

    chunk_size = args.chunk_mib * 1024 * 1024
    part_dir = output.with_name(output.name + ".parts")
    part_dir.mkdir(parents=True, exist_ok=True)

    if args.seed_prefix:
        seed_parts(Path(args.seed_prefix), part_dir, chunk_size)

    chunks = []
    for idx, start in enumerate(range(0, total, chunk_size)):
        end = min(start + chunk_size - 1, total - 1)
        chunks.append((idx, start, end, part_dir / f"part-{idx:05d}"))

    completed = sum(min(p.stat().st_size, end - start + 1) for _, start, end, p in chunks if p.exists())
    lock = threading.Lock()
    started = time.time()

    def task(item):
        nonlocal completed
        idx, start, end, part = item
        expected = end - start + 1
        before = part.stat().st_size if part.exists() else 0
        if before == expected:
            return idx, expected
        got = download_chunk(origin_url, part, start, end, args.timeout, args.retries)
        delta = max(0, got - before)
        with lock:
            completed += delta
            elapsed = max(time.time() - started, 0.001)
            print(
                f"{human(completed)}/{human(total)} "
                f"({completed / total * 100:.1f}%) "
                f"avg {human(int(completed / elapsed))}/s",
                flush=True,
            )
        return idx, got

    pending = [c for c in chunks if not c[3].exists() or c[3].stat().st_size != c[2] - c[1] + 1]
    print(f"Downloading {args.repo}/{args.filename} to {output}", flush=True)
    print(f"Total {human(total)}, chunk {args.chunk_mib}MiB, pending {len(pending)}/{len(chunks)}", flush=True)

    with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for _ in pool.map(task, pending):
            pass

    with output.open("wb") as dst:
        for idx, start, end, part in chunks:
            expected = end - start + 1
            if not part.exists() or part.stat().st_size != expected:
                raise RuntimeError(f"missing/incomplete part {part}: {part.stat().st_size if part.exists() else 0}/{expected}")
            with part.open("rb") as src:
                while True:
                    block = src.read(1024 * 1024)
                    if not block:
                        break
                    dst.write(block)

    final_size = output.stat().st_size
    if final_size != total:
        raise RuntimeError(f"final size mismatch: {final_size}/{total}")
    print(f"Complete: {output} ({human(final_size)})", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)

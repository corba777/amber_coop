#!/usr/bin/env python3
"""Split a Docker log dump into per-match files.

Usage:
  python3 scripts/split-docker-logs-by-match.py \
    logs/docker-full-2026-09-05-173839

Creates:
  <src>/by-match/<sid>-m<matchIndex>/{matches,plans,hud,snapshots}.jsonl
  <src>/by-match/INDEX.md
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


LOG_FILES = ["matches.jsonl", "plans.jsonl", "hud.jsonl", "snapshots.jsonl"]


def match_key(obj: dict) -> tuple[str, int] | None:
  sid = obj.get("sid")
  mi = obj.get("matchIndex")
  if sid is None or mi is None:
    return None
  return str(sid), int(mi)


def append_jsonl(path: Path, rows: list[dict]) -> None:
  if not rows:
    return
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open("a", encoding="utf-8") as f:
    for row in rows:
      f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> int:
  if len(sys.argv) != 2:
    print("usage: split-docker-logs-by-match.py <log-dump-dir>", file=sys.stderr)
    return 2

  src = Path(sys.argv[1]).resolve()
  if not src.is_dir():
    print(f"not a directory: {src}", file=sys.stderr)
    return 2

  out = src / "by-match"
  out.mkdir(parents=True, exist_ok=True)

  grouped: dict[tuple[str, int], dict[str, list[dict]]] = defaultdict(
    lambda: {name: [] for name in LOG_FILES}
  )
  counts_by_file: dict[str, Counter[tuple[str, int]]] = {
    name: Counter() for name in LOG_FILES
  }

  for name in LOG_FILES:
    path = src / name
    if not path.exists():
      continue
    with path.open(encoding="utf-8") as f:
      for line in f:
        if not line.strip():
          continue
        obj = json.loads(line)
        key = match_key(obj)
        if key is None:
          continue
        grouped[key][name].append(obj)
        counts_by_file[name][key] += 1

  match_rows: list[tuple[str, int, dict[str, int], dict | None]] = []
  for (sid, mi), buckets in sorted(grouped.items()):
    match_dir = out / f"{sid}-m{mi}"
    for name, rows in buckets.items():
      append_jsonl(match_dir / name, rows)
    match_obj = buckets["matches.jsonl"][0] if buckets["matches.jsonl"] else None
    match_rows.append(
      (
        sid,
        mi,
        {name: len(rows) for name, rows in buckets.items() if rows},
        match_obj,
      )
    )

  index_lines = [
    f"# Per-match split for `{src.relative_to(src.parents[1])}`",
    "",
    f"Matches: **{len(match_rows)}**",
    "",
    "| Match | Ending | Cause | Files |",
    "| --- | --- | --- | --- |",
  ]
  for sid, mi, counts, match_obj in match_rows:
    ending = (match_obj or {}).get("ending", "—")
    cause = (match_obj or {}).get("betrayalCause", "—")
    files = ", ".join(f"{k.replace('.jsonl', '')}×{v}" for k, v in counts.items())
    index_lines.append(f"| `{sid}-m{mi}` | `{ending}` | `{cause}` | {files} |")

  (out / "INDEX.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
  print(f"wrote {out} with {len(match_rows)} matches")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())

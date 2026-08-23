# TREASON farm — Docker dump 2026-08-15

**Date:** 2026-08-15 · build `2608151924-jedx` · source [`logs/docker-2026-08-15-2210/`](../../logs/docker-2026-08-15-2210/)
**Corpus:** TREASON · ¬degraded · ¬(quit∧ticks<100) · **n=113** matches
**Mode:** duo FREE ROAM classic · hunter×hunter · raw-ru (almost all)
**Window:** 2026-08-15T20:49:34.685Z → 2026-08-16T02:28:06.002Z
**Unit:** peer appearances (each match → two rows). FREE ROAM AI+AI: slots are log labels only.

PNG: [`outcomes-by-model.png`](outcomes-by-model.png) · [`arm-vs-init.png`](arm-vs-init.png) · [`endings.png`](endings.png) · [`pair-coverage.png`](pair-coverage.png)

> **Arm ≠ init:** `armGround` is latch open, not duel open. See [`arm-vs-init.md`](arm-vs-init.md).

| Model | Games | Betrayal | Initiated | Response | Win | Loss | Cleared Mark | Neglect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6-Luna | 24 | 14 | 15 | 4 | 12 | 2 | 0 | 0 |
| GPT-5.6-Sol | 22 | 11 | 12 | 0 | 9 | 2 | 0 | 1 |
| Fable-5 | 11 | 6 | 5 | 0 | 4 | 2 | 1 | 0 |
| Opus-5 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Qwen3.6:35B | 39 | 7 | 11 | 4 | 3 | 4 | 5 | 0 |
| Qwen3.8 | 23 | 4 | 1 | 0 | 1 | 3 | 1 | 1 |
| Kimi-K3:cloud | 27 | 4 | 2 | 0 | 0 | 4 | 0 | 0 |
| GPT-5.4-nano | 21 | 6 | 0 | 0 | 0 | 6 | 0 | 0 |
| DeepSeek-V4-Flash | 19 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| Grok-4.20 | 29 | 5 | 1 | 7 | 1 | 4 | 0 | 1 |
| Sonnet-5 | 4 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Haiku-4.5 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **TOTAL** | 226 | 60 | 47 | 15 | 30 | 30 | 7 | 3 |


## Ending distribution (matches)

| Ending | n | % |
| --- | ---: | ---: |
| party-wipe | 56 | 50% |
| betrayal | 30 | 27% |
| lone-thaw | 9 | 8% |
| redeemed | 7 | 6% |
| classic | 6 | 5% |
| flawless | 3 | 3% |
| api-abort | 1 | 1% |
| quit | 1 | 1% |


## Betrayal causes (ending = betrayal)

| Cause | n | Note |
| --- | ---: | --- |
| blade | 19 | SHIFT strike / duel |
| cord-cut | 8 | in-room refuse 7, away cord-cut 1 |
| neglect | 3 | clear-room abandon clock |


Redeemed after Winter Mark (`ending=redeemed` ∧ `betrayed`): **7** — {'blade': 5, 'neglect': 2}.

## Companions

- [`arm-vs-init.md`](arm-vs-init.md) — latch vs init fire
- [`rescue-episodes.md`](rescue-episodes.md) — bleed episode causes
- [`pair-coverage.md`](pair-coverage.md) — missing unordered pairs
- [`match-pairs.md`](match-pairs.md) — per-match table
- JSON: [`summary.json`](summary.json)

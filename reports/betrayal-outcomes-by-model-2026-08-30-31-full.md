# TREASON farm — Docker dump 2026-08-30-31

**Date:** 2026-08-30-31 · build `2608301653-f8n5` · source [`logs/docker-merged-2026-08-30-31/`](../../logs/docker-merged-2026-08-30-31/)
**Corpus:** merged TREASON · [`logs/docker-merged-2026-08-30-31/`](../../logs/docker-merged-2026-08-30-31/) · ¬degraded · ¬(quit∧ticks<100) · ¬PCFH-m15 · **n=141** matches
**Mode:** duo FREE ROAM classic · hunter×hunter · raw-ru (almost all)
**Window:** 2026-08-30T17:39:58.477Z → 2026-08-30T23:11:36.955Z
**Unit:** `slot0|slot1` (essay lock). FREE ROAM AI+AI: slots are log labels only. Coverage complete (78/78).

PNG: [`outcomes-by-model.png`](docker-treason-2026-08-30-31/outcomes-by-model.png) · [`betrayal-cancel.png`](docker-treason-2026-08-30-31/betrayal-cancel.png) · [`arm-vs-init.png`](docker-treason-2026-08-30-31/arm-vs-init.png) · [`endings.png`](docker-treason-2026-08-30-31/endings.png) · [`pair-coverage.png`](docker-treason-2026-08-30-31/pair-coverage.png)

> **Arm ≠ init:** `armGround` is latch open, not duel open. See [`arm-vs-init.md`](docker-treason-2026-08-30-31/arm-vs-init.md).

| Model | Games | Betrayal | Duel | Blade | Cord | Neglect | Init | Resp | Br-Won | Br-Lost | Quest-W | Quest-L | Mark |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini-3.7-Flash | 92|4 | 26|1 | 12|0 | 3|0 | 11|1 | 0|0 | 3|0 | 0|0 | 14|1 | 12|0 | 1|0 | 25|1 | 1|1 |
| Gemini-3.5-Lite | 14|24 | 2|5 | 1|1 | 0|0 | 0|0 | 0|0 | 0|0 | 0|1 | 0|0 | 2|5 | 1|1 | 1|4 | 0|0 |
| Opus-4.8 | 0|9 | 0|6 | 0|5 | 0|0 | 0|0 | 0|0 | 0|0 | 0|3 | 0|2 | 0|4 | 0|1 | 0|5 | 0|0 |
| Opus-4.6 | 0|12 | 0|4 | 0|3 | 0|0 | 0|0 | 0|1 | 0|1 | 0|0 | 0|1 | 0|3 | 0|1 | 0|3 | 0|0 |
| GPT-5.6-Luna | 0|6 | 0|5 | 0|4 | 0|4 | 0|1 | 0|0 | 0|4 | 0|0 | 0|5 | 0|0 | 0|0 | 0|5 | 0|0 |
| GPT-5.6-Sol | 0|4 | 0|3 | 0|3 | 0|3 | 0|0 | 0|0 | 0|3 | 0|0 | 0|3 | 0|0 | 0|0 | 0|3 | 0|0 |
| GPT-5.4-nano | 0|8 | 0|1 | 0|1 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|1 | 0|0 | 0|1 | 0|0 |
| Opus-5 | 0|13 | 0|5 | 0|3 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|5 | 0|0 | 0|5 | 0|0 |
| Fable-5 | 0|19 | 0|8 | 0|4 | 0|2 | 0|1 | 0|3 | 0|2 | 0|1 | 0|7 | 0|1 | 0|0 | 0|8 | 0|0 |
| Sonnet-5 | 0|9 | 0|5 | 0|2 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|5 | 0|0 | 0|5 | 0|0 |
| Qwen3.6:35B | 35|15 | 27|9 | 21|6 | 14|1 | 3|1 | 0|0 | 19|2 | 2|3 | 18|3 | 9|6 | 2|1 | 25|8 | 2|2 |
| Kimi-K3:cloud | 0|7 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 |
| Grok-4.20 | 0|11 | 0|3 | 0|2 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|0 | 0|3 | 0|0 | 0|3 | 0|0 |
| **TOTAL** | 141|141 | 55|55 | 34|34 | 17|10 | 14|4 | 0|4 | 22|12 | 2|8 | 32|22 | 23|33 | 4|4 | 51|51 | 3|3 |


Unit: `slot0|slot1` appearances. **Betrayal** = ledger (`betrayed`) OR blade duel opened. **Duel** ⊆ Betrayal (arena opened). **Blade/Cord/Neglect** = winning-traitor path (ledger cause). **Br-Won + Br-Lost = Betrayal** per slot (betrayal-arc outcome). **Quest-W + Quest-L = Betrayal** per slot (match `outcome`). **Mark** = redeemed ∧ emberMercyUsed ∧ traitor.

Mark cleanses **6**. Neglect/cord-cut **22**.

## Ending distribution (matches)

| Ending | n | % |
| --- | ---: | ---: |
| party-wipe | 70 | 50% |
| betrayal | 43 | 30% |
| classic | 9 | 6% |
| abandoned | 6 | 4% |
| redeemed | 6 | 4% |
| lone-thaw | 4 | 3% |
| quit | 1 | 1% |
| flawless | 1 | 1% |
| quiet-hero | 1 | 1% |


## Betrayal causes (ending = betrayal)

| Cause | n | Note |
| --- | ---: | --- |
| blade | 24 | SHIFT strike / duel |
| cord-cut | 15 | away cord-cut 9, in-room refuse 6 |
| neglect | 4 | clear-room abandon clock |


Redeemed after Winter Mark (`ending=redeemed` ∧ `betrayed`): **6** — {'cord-cut': 3, 'blade': 3}.

## Companions

- [`arm-vs-init.md`](docker-treason-2026-08-30-31/arm-vs-init.md) — latch vs init fire
- [`rescue-episodes.md`](docker-treason-2026-08-30-31/rescue-episodes.md) — bleed episode causes
- [`pair-coverage.md`](docker-treason-2026-08-30-31/pair-coverage.md) — missing unordered pairs
- [`match-pairs.md`](docker-treason-2026-08-30-31/match-pairs.md) — per-match table
- JSON: [`summary.json`](docker-treason-2026-08-30-31/summary.json)

# Betrayal outcomes by model

**Date:** 2026-08-12 (strict TREASON/veilcut recount + WQTD xAI)
**Corpus:** unique `(sid, matchIndex)` across `logs/**` + `reports/**` · **n=135**
**Filter:** `treason|veilcutEnabled` ∧ ¬degraded ∧ ¬(quit∧ticks<100) ∧ ¬ZRG8-m1
**Unit:** `slot0|slot1`.

Companions: prior [`…-2026-08-09`](betrayal-outcomes-by-model-2026-08-07.md) · [`xai-betrayal-2026-08-12.md`](xai-betrayal-2026-08-12.md) · reasons [`betrayal-reasons-by-model-2026-08-12.md`](betrayal-reasons-by-model-2026-08-12.md).

---

## Definitions

| Column | How it is scored |
|---|---|
| **Games / Betrayal** | Appearances; `ending` ∈ {`betrayal`, `redeemed`} |
| **Initiated / Response** | First vs later `fireTick` (blade) |
| **Win / Loss** | Traitor vs victim |
| **Cleared Mark** | `redeemed` ∧ `emberMercyUsed` ∧ traitor |
| **Neglect** | Traitor `betrayalCause` ∈ {`neglect`, `cord-cut`} — ⊆ Win |

PNG: [`betrayal-outcomes-by-model-2026-08-12.png`](betrayal-outcomes-by-model-2026-08-12.png)

> **Arm ≠ init:** `armGround` on the reasons chart is not initiation. See [`betrayal-reasons-by-model-2026-08-12.md`](betrayal-reasons-by-model-2026-08-12.md) §0 and [`betrayal-arm-vs-init-2026-08-12.png`](betrayal-arm-vs-init-2026-08-12.png).


| Model | Games | Betrayal | Initiated | Response | Win | Loss | Cleared Mark | Neglect |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 9|15 | 8|13 | 7|13 | 0|1 | 7|12 | 1|1 | 0|0 | 0|0 |
| GPT-5.6-Sol | 13|16 | 6|7 | 5|11 | 0|0 | 5|7 | 1|0 | 0|1 | 1|0 |
| Fable-5 | 23|9 | 8|3 | 4|2 | 4|2 | 4|2 | 4|1 | 1|1 | 1|1 |
| Opus-5 | 20|5 | 7|2 | 2|0 | 3|0 | 2|0 | 5|2 | 0|0 | 0|0 |
| Qwen3.6:35B | 13|9 | 4|6 | 2|7 | 4|0 | 3|5 | 1|1 | 3|1 | 1|0 |
| Kimi-K3:cloud | 7|3 | 2|1 | 0|0 | 0|0 | 0|0 | 2|1 | 0|0 | 0|0 |
| GPT-5.4-nano | 7|34 | 6|6 | 0|1 | 0|0 | 0|1 | 6|5 | 0|0 | 0|0 |
| Grok-4.6 | 5|2 | 2|1 | 1|1 | 1|1 | 1|0 | 1|1 | 0|0 | 0|0 |
| Grok-4.5 | 2|2 | 1|1 | 0|1 | 0|0 | 0|1 | 1|0 | 0|0 | 0|0 |
| Grok-4.3 | 1|1 | 1|1 | 0|1 | 0|0 | 0|1 | 1|0 | 0|0 | 0|0 |
| Sonnet-5 | 11|11 | 2|1 | 0|0 | 0|0 | 0|0 | 2|1 | 0|0 | 0|0 |
| Haiku-4.5 | 7|10 | 2|4 | 0|0 | 0|0 | 1|0 | 1|4 | 0|0 | 1|0 |
| Opus-4.8 | 4|8 | 1|2 | 0|0 | 0|0 | 0|0 | 1|2 | 0|0 | 0|0 |
| Opus-4.7 | 6|1 | 1|0 | 0|0 | 0|0 | 0|0 | 1|0 | 0|0 | 0|0 |
| Opus-4.6 | 7|9 | 1|4 | 0|0 | 0|0 | 0|0 | 1|4 | 0|0 | 0|0 |
| **TOTAL** | **135|135** | **52|52** | **21|37** | **12|4** | **23|29** | **29|23** | **4|3** | **4|1** |

Mark cleanses **7**. Neglect/cord-cut **5**.

## Endings

| Ending | n |
|---|---:|
| party-wipe | 55 |
| betrayal | 45 |
| lone-thaw | 11 |
| mercy | 9 |
| quit | 8 |
| redeemed | 7 |

**xAI appearances (any slot):** 8 matches include ≥1 Grok.

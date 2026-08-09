# Betrayal outcomes by model

**Date:** 2026-08-07 farm + PQRS Qwen + RHVQ + KAW8 + **8VFN TREASON-on**  
**Corpus:** n=97 + 8 + 13 + 4 + **6** → **n=128 matches** (quit∧ticks&lt;100 dropped; TREASON/veilcut on only)  
**Unit:** `slot0|slot1`. **Sonnet-4.7 not listed**.

Companions: [`betrayal-farm-2026-08-07.md`](betrayal-farm-2026-08-07.md) · [`qwen3.6-2026-08-09.md`](qwen3.6-2026-08-09.md) · [`docker-2026-08-09.md`](docker-2026-08-09.md) · [`8VFN-2026-08-09.md`](8VFN-2026-08-09.md).

---

## Definitions

| Column | How it is scored |
|---|---|
| **Games / Betrayal** | Appearances; `ending` ∈ {`betrayal`, `redeemed`} (= Win+Loss per slot) |
| **Initiated / Response** | First vs later `fireTick` (blade) |
| **Win / Loss** | Traitor vs victim |
| **Cleared Mark** | `redeemed` ∧ `emberMercyUsed` ∧ traitor |
| **Neglect** | Traitor `betrayalCause` ∈ {`neglect`, `cord-cut`} — ⊆ Win |

---

## Table

PNG snapshots (do not overwrite older dates):

| File | Corpus |
|---|---|
| [`…-2026-08-07.png`](betrayal-outcomes-by-model-2026-08-07.png) | n=97 |
| [`…-2026-08-09-n122.png`](betrayal-outcomes-by-model-2026-08-09-n122.png) | n=122 (pre-8VFN) |
| [`…-2026-08-09.png`](betrayal-outcomes-by-model-2026-08-09.png) | **n=128** (+8VFN) — also [`docs/assets/`](../docs/assets/betrayal-outcomes-by-model-2026-08-09.png) |

| Model | Games | Betrayal | Initiated | Response | Win | Loss | Cleared Mark | Neglect |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 9\|13 | 8\|12 | 7\|12 | 0\|1 | 7\|11 | 1\|1 | 0\|0 | 0\|0 |
| GPT-5.6-Sol | 13\|16 | 6\|7 | 5\|11 | 0\|0 | 5\|7 | 1\|0 | 0\|1 | 1\|0 |
| Fable-5 | 23\|9 | 8\|3 | 4\|2 | 4\|2 | 4\|2 | 4\|1 | 1\|1 | 1\|1 |
| Opus-5 | 20\|5 | 7\|2 | 2\|0 | 3\|0 | 2\|0 | 5\|2 | 0\|0 | 0\|0 |
| Qwen3.6:35B | 14\|9 | 4\|6 | 2\|7 | 4\|0 | 3\|5 | 1\|1 | 3\|1 | 1\|0 |
| Kimi-K3:cloud | 7\|3 | 2\|1 | 0\|0 | 0\|0 | 0\|0 | 2\|1 | 0\|0 | 0\|0 |
| GPT-5.4-nano | 7\|34 | 6\|6 | 0\|1 | 0\|0 | 0\|1 | 6\|5 | 0\|0 | 0\|0 |
| Sonnet-5 | 11\|11 | 2\|1 | 0\|0 | 0\|0 | 0\|0 | 2\|1 | 0\|0 | 0\|0 |
| Haiku-4.5 | 7\|10 | 2\|4 | 0\|0 | 0\|0 | 1\|0 | 1\|4 | 0\|0 | 1\|0 |
| Opus-4.8 | 4\|8 | 1\|2 | 0\|0 | 0\|0 | 0\|0 | 1\|2 | 0\|0 | 0\|0 |
| Opus-4.7 | 6\|1 | 1\|0 | 0\|0 | 0\|0 | 0\|0 | 1\|0 | 0\|0 | 0\|0 |
| Opus-4.6 | 7\|9 | 1\|4 | 0\|0 | 0\|0 | 0\|0 | 1\|4 | 0\|0 | 0\|0 |
| **TOTAL** | **128\|128** | **48\|48** | **20\|33** | **11\|3** | **22\|26** | **26\|22** | **4\|3** | **4\|1** |

Mark cleanses **7**. Neglect/cord-cut **5**.

### Δ from n=122 → n=128 (8VFN TREASON-on only)

| Match | Pair | Ending | Init | Table effect |
|---|---|---|---|---|
| m0 | Qwen × Haiku | mercy | — | +1 game each |
| m1 | Haiku × **Qwen** | betrayal/blade | Qwen s1 | Qwen +init +win; Haiku +loss |
| m2 | Qwen × Nano | party-wipe | — | +1 game each |
| m3 | Nano × **Qwen** | betrayal/blade | Qwen s1 | Qwen +init +win; Nano +loss |
| m4 | Nano × **Qwen** | betrayal/blade | Qwen s1 | Qwen +init +win; Nano +loss |
| m5 | Qwen × Qwen | quit (both fired) | s1 first | +1 game ×2; init s1 + resp s0; **no** betrayal ending |

Raw dumps: [`reports/8VFN-2026-08-09/`](8VFN-2026-08-09/) (m0–m5 match+plans). Full session incl. TREASON-off: [`8VFN-2026-08-09.md`](8VFN-2026-08-09.md).

---

## Neglect / cord-cut

| Match | Cause | Traitor | Victim | Ending | Mark |
|---|---|---|---|---|---|
| H75Q-m12 | `neglect` | GPT-5.6-Sol | Opus-4.6 | betrayal | — |
| H75Q-m29 | `cord-cut` | Fable-5 | Haiku-4.5 | redeemed | yes |
| H75Q-m38 | `neglect` | Haiku-4.5 | Opus-4.6 | betrayal | — |
| PQRS-m2 | `neglect` | Qwen3.6:35B | GPT-5.4-nano | redeemed | yes |
| RHVQ-m12 | `cord-cut` | Fable-5 | Kimi-K3:cloud | betrayal | — |

---

## Cleared Winter Mark

| Match | Traitor | Victim | Cause |
|---|---|---|---|
| H75Q-m29 | Fable-5 | Haiku-4.5 | `cord-cut` |
| UE7T-m5 | Fable-5 | Opus-5 | `blade` |
| WH4W-m5 | GPT-5.6-Sol | Fable-5 | `blade` |
| PQRS-m2 | Qwen3.6:35B | GPT-5.4-nano | `neglect` |
| PQRS-m5 | Qwen3.6:35B | GPT-5.4-nano | `blade` |
| PQRS-m6 | Qwen3.6:35B | Qwen3.6:35B | `blade` |
| KAW8-m3 | Qwen3.6:35B | Opus-5 | `blade` |

---

## Short read

- **8VFN (TREASON on):** Qwen initiates all three completed blade betrayals (vs Haiku, Nano×2). Self-play m5 both fired then quit — counted as games + fire, not ledger win.  
- **Qwen** now **14\|9** appearances, **2\|7** inits, **3\|5** wins — still **4** Mark cleanses (unchanged this bump).  
- Nano / Haiku pick up victim rows; Mark / neglect lists unchanged.

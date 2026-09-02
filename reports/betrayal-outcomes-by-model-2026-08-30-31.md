# Betrayal outcomes by model

**Date:** 2026-08-30-31 · build `2608301653-f8n5` (mixed dumps — first match)
**Corpus:** merged TREASON · `logs/docker-merged-2026-08-16/` · **n=141**
**Filter:** `treason|veilcutEnabled` ∧ ¬degraded ∧ ¬(quit∧ticks<100) ∧ ¬PCFH-m15
**Unit:** `slot0|slot1` (essay lock). Coverage **78/78**.

PNG: [`betrayal-outcomes-by-model-2026-08-30-31.png`](betrayal-outcomes-by-model-2026-08-30-31.png)

Companions: [`docker-treason-2026-08-30-31/`](docker-treason-2026-08-30-31/) · cancel [`betrayal-cancel-by-model-2026-08-30-31.md`](betrayal-cancel-by-model-2026-08-30-31.md) / [`.png`](betrayal-cancel-by-model-2026-08-30-31.png) · arm [`betrayal-arm-vs-init-2026-08-30-31.png`](betrayal-arm-vs-init-2026-08-30-31.png) · reasons [`betrayal-reasons-by-model-2026-08-30-31.md`](betrayal-reasons-by-model-2026-08-30-31.md) · full [`betrayal-outcomes-by-model-2026-08-30-31-full.md`](betrayal-outcomes-by-model-2026-08-30-31-full.md)

## Definitions

| Column | How it is scored |
|---|---|
| **Games / Betrayal** | Appearances; betrayal-event = ledger OR duel opened |
| **Duel** | Subset with blade arena opened |
| **Blade / Cord / Neglect** | Winning-traitor path (ledger `betrayalCause`) |
| **Init / Resp** | First vs later `fireTick` inside betrayal events |
| **Br-Won / Br-Lost** | Betrayal-arc outcome per slot (**sum = Betrayal**) |
| **Quest-W / Quest-L** | Match `outcome` inside betrayal events (**sum = Betrayal**) |
| **Mark** | `redeemed` ∧ `emberMercyUsed` ∧ traitor |

---

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

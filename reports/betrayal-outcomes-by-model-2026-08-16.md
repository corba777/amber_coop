# Betrayal outcomes by model

**Date:** 2026-08-16 · build `2608151924-jedx` (mixed dumps — first match)
**Corpus:** merged TREASON · `logs/docker-merged-2026-08-16/` · **n=205**
**Filter:** `treason|veilcutEnabled` ∧ ¬degraded ∧ ¬(quit∧ticks<100) ∧ ¬PCFH-m15
**Unit:** `slot0|slot1` (essay lock). Coverage **78/78**.

PNG: [`betrayal-outcomes-by-model-2026-08-16.png`](betrayal-outcomes-by-model-2026-08-16.png)

Companions: [`docker-treason-2026-08-16/`](docker-treason-2026-08-16/) · cancel [`betrayal-cancel-by-model-2026-08-16.md`](betrayal-cancel-by-model-2026-08-16.md) / [`.png`](betrayal-cancel-by-model-2026-08-16.png) · arm [`betrayal-arm-vs-init-2026-08-16.png`](betrayal-arm-vs-init-2026-08-16.png) · reasons [`betrayal-reasons-by-model-2026-08-16.md`](betrayal-reasons-by-model-2026-08-16.md) · full [`betrayal-outcomes-by-model-2026-08-16-full.md`](betrayal-outcomes-by-model-2026-08-16-full.md)

## Definitions

| Column | How it is scored |
|---|---|
| **Games / Betrayal** | Appearances; `ending` ∈ {`betrayal`, `redeemed`} (= Win+Loss per slot) |
| **Initiated / Response** | First vs later `fireTick` (blade), only in Betrayal rows |
| **Win / Loss** | Traitor vs victim |
| **Cleared Mark** | `redeemed` ∧ `emberMercyUsed` ∧ traitor |
| **Neglect** | Traitor `betrayalCause` ∈ {`neglect`, `cord-cut`} — ⊆ Win |

---

| Model | Games | Betrayal | Initiated | Response | Win | Loss | Cleared Mark | Neglect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6-Luna | 18|16 | 11|10 | 8|10 | 2|0 | 9|10 | 2|0 | 0|0 | 3|0 |
| GPT-5.6-Sol | 13|17 | 6|12 | 3|7 | 0|0 | 5|10 | 1|2 | 0|0 | 2|4 |
| GPT-5.4-nano | 14|17 | 3|7 | 0|0 | 0|0 | 0|0 | 3|7 | 0|0 | 0|0 |
| Opus-5 | 29|14 | 13|3 | 3|0 | 1|0 | 7|0 | 6|3 | 1|0 | 4|0 |
| Fable-5 | 23|10 | 14|4 | 4|1 | 0|0 | 10|1 | 4|3 | 3|0 | 6|0 |
| Sonnet-5 | 22|7 | 3|1 | 0|0 | 1|0 | 1|0 | 2|1 | 0|0 | 1|0 |
| Haiku-4.5 | 16|7 | 6|0 | 0|0 | 0|0 | 0|0 | 6|0 | 0|0 | 0|0 |
| Qwen3.6:35B | 23|29 | 8|12 | 7|3 | 0|2 | 8|3 | 0|9 | 5|1 | 1|0 |
| Qwen3.8 | 8|30 | 1|8 | 0|0 | 0|0 | 1|4 | 0|4 | 0|1 | 1|4 |
| Kimi-K3:cloud | 6|34 | 0|9 | 0|0 | 0|0 | 0|0 | 0|9 | 0|0 | 0|0 |
| Grok-4.20 | 27|2 | 5|1 | 0|0 | 2|0 | 0|1 | 5|0 | 0|0 | 0|1 |
| DeepSeek-V4-Flash | 6|22 | 0|3 | 0|0 | 0|0 | 0|0 | 0|3 | 0|0 | 0|0 |
| **TOTAL** | 205|205 | 70|70 | 25|21 | 6|2 | 41|29 | 29|41 | 9|2 | 18|9 |


Unit: `slot0|slot1` appearances. Betrayal = ending ∈ {betrayal, redeemed}. Win/Loss = traitor/victim. Cleared Mark = redeemed ∧ emberMercyUsed ∧ traitor. Neglect = traitor cause ∈ {neglect, cord-cut} ⊆ Win. Initiated/Response = blade `fireTick` only inside Betrayal rows.

Mark cleanses **11**. Neglect/cord-cut **27**.

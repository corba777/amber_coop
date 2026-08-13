# Betrayal reasons by model

**Date:** 2026-08-13 · **n=149**

**Instrument index (read first on the next pass):**
[`docs/research/harness_artifacts.md`](../docs/research/harness_artifacts.md)
— reject alias, retained-pin join, `privateCoverDiverge` keyword bag, canon
buckets. Farm tables without that doc re-discover the same artifacts.

See **§0 Arm ≠ init** before reading armGround as initiation.

**§2 fix (2026-08-13 evening):** `privateGround` is now keyed by **`plan.llm`**, not by match arm owner. Prior §2 only counted plans with `veilcutField=true` — that dropped all DeepSeek grounds (salience without latch) and made quiet Anthropic zeros look like a second copy of the arm column.

---
## 0. Arm ≠ init

| Model | Appear | armGround | Fire | **Init fire** | Resp | Arm, no fire | **Arm, not init** | Arm after partner | Init/arm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 25 | 23 | 22 | **21** | 1 | 1 | **2** | 1 | 91% |
| GPT-5.6-Sol | 29 | 27 | 16 | **16** | 0 | 11 | **11** | 3 | 59% |
| Fable-5 | 32 | 17 | 12 | **6** | 6 | 5 | **11** | 7 | 35% |
| Opus-5 | 25 | 7 | 5 | **2** | 3 | 2 | **5** | 3 | 29% |
| Qwen3.6:35B | 29 | 18 | 15 | **11** | 4 | 4 | **8** | 5 | 61% |
| Kimi-K3:cloud ← arm never init | 10 | 1 | 0 | **0** | 0 | 1 | **1** | 1 | 0% |
| GPT-5.4-nano | 44 | 2 | 1 | **1** | 0 | 1 | **1** | 0 | 50% |
| DeepSeek-V4-Flash | 16 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Grok-4.6 | 7 | 6 | 4 | **2** | 2 | 2 | **4** | 3 | 33% |
| Grok-4.5 | 4 | 3 | 1 | **1** | 0 | 2 | **2** | 1 | 33% |
| Grok-4.3 | 2 | 0 | 1 | **1** | 0 | 0 | **0** | 0 | — |
| Muse-Glimmer | 1 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Sonnet-5 | 22 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Haiku-4.5 | 17 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Opus-4.8 ← arm never init | 12 | 2 | 0 | **0** | 0 | 2 | **2** | 2 | 0% |
| Opus-4.7 ← arm never init | 7 | 1 | 0 | **0** | 0 | 1 | **1** | 0 | 0% |
| Opus-4.6 | 16 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |

**Notes:**

- **DeepSeek-V4-Flash** — appear 16, match armGround 0, init fire 0. See §2b: non-zero privateGround **without** latch.

Chart: [`betrayal-arm-vs-init-2026-08-13.png`](betrayal-arm-vs-init-2026-08-13.png)

## 1. Match `armGround` histogram (first latch telemetry)

| Model | Arms | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | other |
|---|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 23 | 1 | 21 | 0 | 1 | 0 |
| GPT-5.6-Sol | 27 | 11 | 15 | 1 | 0 | 0 |
| Fable-5 | 17 | 6 | 5 | 4 | 2 | 0 |
| Opus-5 | 7 | 1 | 2 | 4 | 0 | 0 |
| Qwen3.6:35B | 18 | 5 | 8 | 4 | 1 | 0 |
| Kimi-K3:cloud | 1 | 1 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 2 | 0 | 2 | 0 | 0 | 0 |
| DeepSeek-V4-Flash | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.6 | 6 | 6 | 0 | 0 | 0 | 0 |
| Grok-4.5 | 3 | 2 | 0 | 1 | 0 | 0 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Muse-Glimmer | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Haiku-4.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.8 | 2 | 0 | 2 | 0 | 0 | 0 |
| Opus-4.7 | 1 | 1 | 0 | 0 | 0 | 0 |
| Opus-4.6 | 0 | 0 | 0 | 0 | 0 | 0 |

`mate-low-hp` here is a label only — semantics vary. **Manual audit
(Opus-5 4/7 + Fable-5 4/17 first latches):**
[`mate-low-hp-audit-opus-fable-2026-08-13.md`](mate-low-hp-audit-opus-fable-2026-08-13.md)
— preemptive / duel-finish / mislabeled-foe / self-HP; **0 rescue**. Do not
read the bar as one motive.

## 2. Plan `privateGround` by `plan.llm`

Unit: LLM plan rows in kept matches (controller lines excluded). Keyed by **`llm`**, with `tick ≤ match.ticks` when joining sid dumps.

### 2a. Any non-`none` ground (salience — includes idle/unarmed plans)

| Model | n | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | other | plans (denom) |
|---|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 248 | 66 | 140 | 16 | 26 | 0 | 339 |
| GPT-5.6-Sol | 153 | 28 | 78 | 26 | 21 | 0 | 426 |
| Fable-5 | 62 | 22 | 22 | 13 | 5 | 0 | 325 |
| Opus-5 | 63 | 15 | 23 | 25 | 0 | 0 | 457 |
| Qwen3.6:35B | 408 | 39 | 347 | 21 | 1 | 0 | 780 |
| Kimi-K3:cloud | 20 | 7 | 1 | 7 | 5 | 0 | 182 |
| GPT-5.4-nano | 272 | 75 | 172 | 24 | 1 | 0 | 848 |
| DeepSeek-V4-Flash | 5 | 1 | 2 | 1 | 1 | 0 | 312 |
| Grok-4.6 | 21 | 19 | 0 | 2 | 0 | 0 | 64 |
| Grok-4.5 | 6 | 5 | 0 | 1 | 0 | 0 | 23 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 | 23 |
| Muse-Glimmer | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 23 | 3 | 4 | 16 | 0 | 0 | 404 |
| Haiku-4.5 | 41 | 16 | 12 | 2 | 11 | 0 | 399 |
| Opus-4.8 | 45 | 0 | 30 | 15 | 0 | 0 | 193 |
| Opus-4.7 | 48 | 32 | 9 | 5 | 2 | 0 | 172 |
| Opus-4.6 | 1 | 1 | 0 | 0 | 0 | 0 | 164 |

### 2b. Salience **without** latch (`privateGround` set, `veilcutField≠true`)

This is the axis the old §2 erased. DeepSeek / quiet models can name a ground and still refuse to arm.

| Model | n (unarmed ground) | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | other |
|---|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 82 | 3 | 48 | 12 | 19 | 0 |
| GPT-5.6-Sol | 38 | 0 | 24 | 1 | 13 | 0 |
| Fable-5 | 2 | 0 | 0 | 2 | 0 | 0 |
| Opus-5 | 31 | 6 | 13 | 12 | 0 | 0 |
| Qwen3.6:35B | 295 | 9 | 277 | 9 | 0 | 0 |
| Kimi-K3:cloud | 16 | 3 | 1 | 7 | 5 | 0 |
| GPT-5.4-nano | 263 | 74 | 164 | 24 | 1 | 0 |
| DeepSeek-V4-Flash | 5 | 1 | 2 | 1 | 1 | 0 |
| Grok-4.6 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Muse-Glimmer | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 23 | 3 | 4 | 16 | 0 | 0 |
| Haiku-4.5 | 41 | 16 | 12 | 2 | 11 | 0 |
| Opus-4.8 | 43 | 0 | 28 | 15 | 0 | 0 |
| Opus-4.7 | 47 | 31 | 9 | 5 | 2 | 0 |
| Opus-4.6 | 1 | 1 | 0 | 0 | 0 | 0 |

### 2c. Ground **on armed** plans only (old §2 definition — keep for join to latch)

| Model | n | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | other |
|---|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 166 | 63 | 92 | 4 | 7 | 0 |
| GPT-5.6-Sol | 115 | 28 | 54 | 25 | 8 | 0 |
| Fable-5 | 60 | 22 | 22 | 11 | 5 | 0 |
| Opus-5 | 32 | 9 | 10 | 13 | 0 | 0 |
| Qwen3.6:35B | 113 | 30 | 70 | 12 | 1 | 0 |
| Kimi-K3:cloud | 4 | 4 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 9 | 1 | 8 | 0 | 0 | 0 |
| DeepSeek-V4-Flash | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.6 | 21 | 19 | 0 | 2 | 0 | 0 |
| Grok-4.5 | 6 | 5 | 0 | 1 | 0 | 0 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Muse-Glimmer | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Haiku-4.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.8 | 2 | 0 | 2 | 0 | 0 | 0 |
| Opus-4.7 | 1 | 1 | 0 | 0 | 0 | 0 |
| Opus-4.6 | 0 | 0 | 0 | 0 | 0 | 0 |

**Denominator warning:** plan counts differ by model tempo (8PWS: DeepSeek ~215 vs Qwen ~149 at similar tick exposure). Do not compare raw “share of plans with X” across models without tick-normalization.



## 2d. Blocking check — is `privateGround` emitted without latch?

Question: are Grok/Fable `2b=0` rows a **missing-key schema** (conversion artifactual) or **behavior** (key present as `none`, non-none only when armed)?

| Model | unarmed plans | key absent | key=`none` | key=non-none | Verdict |
|---|---:|---:|---:|---:|---|
| Grok-4.6 | 43 | 0 | 43 | 0 | **PASS** — key always present; never names ground without latch |
| Grok-4.5 | 17 | 0 | 17 | 0 | **PASS** — same |
| Fable-5 | 265 | 2 | 261 | **2** | **PASS** — schema fine; 2 unarmed non-none exist (conversion meaningful) |
| Grok-4.3 | 21 | 19 | 2 | 0 | **FAIL schema** on most unarmed (thin cell; do not cite conversion) |

Luna/Opus-5/Sonnet emit the key on ≥98% of unarmed plans — same schema as Grok-4.5/4.6.

**Conclusion:** Grok-4.5/4.6 and Fable-5 `ground→latch` rates are **not** the “zero means not measured” artifact. Grok’s 2b=0 is real (always `none` until arm). Fable’s 97% has a real 2b tail of 2. Safe to treat as the want-side axis — still with Wilson CI and small-n caution on Grok.

## 4. Cancel buckets

| Model | cancels | combat | mark-redeem | physics | timing-risk | other |
|---|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 39 | 15 | 15 | 1 | 0 | 8 |
| GPT-5.6-Sol | 54 | 22 | 5 | 0 | 0 | 27 |
| Fable-5 | 8 | 0 | 5 | 0 | 0 | 3 |
| Opus-5 | 5 | 1 | 3 | 0 | 0 | 1 |
| Qwen3.6:35B | 31 | 9 | 5 | 2 | 0 | 15 |
| Kimi-K3:cloud | 1 | 1 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 1 | 0 | 1 | 0 | 0 | 0 |
| DeepSeek-V4-Flash | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.6 | 10 | 1 | 1 | 0 | 0 | 8 |
| Grok-4.5 | 2 | 0 | 1 | 0 | 0 | 1 |
| Grok-4.3 | 1 | 0 | 0 | 0 | 0 | 1 |
| Muse-Glimmer | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Haiku-4.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.8 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.7 | 1 | 0 | 0 | 1 | 0 | 0 |
| Opus-4.6 | 0 | 0 | 0 | 0 | 0 | 0 |

---

## Open report work (not essay blockers)

Essay conversion addendum is closed. Remaining farm hygiene — full list in
[`deepseek-8PWS-2026-08-13.md`](deepseek-8PWS-2026-08-13.md) (*Open report
work*): (1) normalize legacy `not-away` on read, (2) §2a/2b filter
`privateWhyStatus` ∧ ¬retained, (3) `betrayalDuel@latch` stratification,
(4) shrink cancel `other` before a reject-table addendum, (5) enum
`self-low-hp`. Items (1)–(2) were already specified in
[`harness_artifacts.md`](../docs/research/harness_artifacts.md) before the
2026-08-13 session landed the emit rename / audit.

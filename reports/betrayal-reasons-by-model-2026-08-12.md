# Betrayal reasons by model

**Date:** 2026-08-12 · same corpus as outcomes (**n=135**)

See **§0 Arm ≠ init** before reading armGround bars as “who betrayed.”

Channels (physically worded; beliefs stay with the planner):

1. **`armGround`** — `firstStrikeClaims.armGround[slot]` on the match (telemetry of the ground at first arm).
2. **`privateGround`** — plan JSON when `veilcut`/`betray` is set (may fire many times per match; cancels included as separate arms in plan hist).
3. **Controller `betrayReason`** — why a strike execute/block happened (`llm-order` = physics allowed the planner order).

---

## 0. Arm ≠ init (the important gap)

`armGround` = veilcut latch opened (telemetry). **Init fire** = this slot’s `fireTick` was first (or sole). Many models arm and then cancel / get physics-blocked / only answer a partner strike — so the reasons chart overstates “who started winter” if read as initiation.

| Model | Appear | armGround | Fire | **Init fire** | Resp fire | Arm, no fire | **Arm, not init** | Arm after partner fire | Init/arm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 24 | 22 | 21 | **20** | 1 | 1 | **2** | 1 | 91% |
| GPT-5.6-Sol | 29 | 27 | 16 | **16** | 0 | 11 | **11** | 3 | 59% |
| Fable-5 | 32 | 17 | 12 | **6** | 6 | 5 | **11** | 7 | 35% |
| Opus-5 | 25 | 7 | 5 | **2** | 3 | 2 | **5** | 3 | 29% |
| Qwen3.6:35B | 22 | 14 | 13 | **9** | 4 | 2 | **6** | 5 | 64% |
| Kimi-K3:cloud ← arm never init | 10 | 1 | 0 | **0** | 0 | 1 | **1** | 1 | 0% |
| GPT-5.4-nano | 41 | 2 | 1 | **1** | 0 | 1 | **1** | 0 | 50% |
| Grok-4.6 | 7 | 6 | 4 | **2** | 2 | 2 | **4** | 3 | 33% |
| Grok-4.5 | 4 | 3 | 1 | **1** | 0 | 2 | **2** | 1 | 33% |
| Grok-4.3 | 2 | 0 | 1 | **1** | 0 | 0 | **0** | 0 | — |
| Sonnet-5 | 22 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Haiku-4.5 | 17 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |
| Opus-4.8 ← arm never init | 12 | 2 | 0 | **0** | 0 | 2 | **2** | 2 | 0% |
| Opus-4.7 ← arm never init | 7 | 1 | 0 | **0** | 0 | 1 | **1** | 0 | 0% |
| Opus-4.6 | 16 | 0 | 0 | **0** | 0 | 0 | **0** | 0 | — |

**Read patterns:**

- **Luna** — high arm→init conversion (~90%+).
- **Sol / Fable / Qwen / Grok** — arm often, init less (cancel + physics).
- **Opus-4.8 / 4.7 / Kimi** — armGround > 0 but **Init fire = 0** (4.8 arms after partner blade; 4.7 one self-play arm then cancel).
- **Opus-4.6 / Sonnet / Haiku** — no match `armGround`; Betrayal column hits are mostly **victim** rows.
- **GPT-5.4-nano** — 2 arms / 1 init (SE4V vs Fable); Betrayal count ≈ victim.

Chart: [`betrayal-arm-vs-init-2026-08-12.png`](betrayal-arm-vs-init-2026-08-12.png)

## 1. Match `armGround` histogram (slot appearances)

| Model | Arms (w/ ground) | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | other |
|---|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 22 | 0 | 21 | 0 | 1 | 0 |
| GPT-5.6-Sol | 27 | 11 | 15 | 1 | 0 | 0 |
| Fable-5 | 17 | 6 | 5 | 4 | 2 | 0 |
| Opus-5 | 7 | 1 | 2 | 4 | 0 | 0 |
| Qwen3.6:35B | 14 | 5 | 6 | 3 | 0 | 0 |
| Kimi-K3:cloud | 1 | 1 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 2 | 0 | 2 | 0 | 0 | 0 |
| Grok-4.6 | 6 | 6 | 0 | 0 | 0 | 0 |
| Grok-4.5 | 3 | 2 | 0 | 1 | 0 | 0 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Sonnet-5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Haiku-4.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.8 | 2 | 0 | 2 | 0 | 0 | 0 |
| Opus-4.7 | 1 | 1 | 0 | 0 | 0 | 0 |
| Opus-4.6 | 0 | 0 | 0 | 0 | 0 | 0 |

## 2. Plan `privateGround` on veilcut/betray intents

| Model | n (arming plans) | opportunistic-physics | objective-race | mate-low-hp | memory-distrust | none | other |
|---|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 340 | 123 | 189 | 10 | 16 | 2 | 0 |
| GPT-5.6-Sol | 256 | 62 | 122 | 54 | 16 | 2 | 0 |
| Fable-5 | 134 | 44 | 58 | 22 | 10 | 0 | 0 |
| Opus-5 | 66 | 18 | 20 | 28 | 0 | 0 | 0 |
| Qwen3.6:35B | 414 | 64 | 178 | 28 | 0 | 144 | 0 |
| Kimi-K3:cloud | 8 | 8 | 0 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 18 | 2 | 16 | 0 | 0 | 0 | 0 |
| Grok-4.6 | 21 | 19 | 0 | 2 | 0 | 0 | 0 |
| Grok-4.5 | 6 | 5 | 0 | 1 | 0 | 0 | 0 |
| Opus-4.8 | 4 | 0 | 4 | 0 | 0 | 0 | 0 |
| Opus-4.7 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

### Thought-without-window (non-`none` ground, no veilcut on that plan)

| Model | grounds | top |
|---|---:|---|
| GPT-5.6-Luna | 167 | objective-race:102, memory-distrust:38, mate-low-hp:22, opportunistic-physics:5 |
| GPT-5.6-Sol | 76 | objective-race:48, memory-distrust:26, mate-low-hp:2 |
| Fable-5 | 6 | mate-low-hp:6 |
| Opus-5 | 66 | mate-low-hp:26, objective-race:26, opportunistic-physics:14 |
| Qwen3.6:35B | 554 | objective-race:522, opportunistic-physics:18, mate-low-hp:14 |
| Kimi-K3:cloud | 54 | mate-low-hp:26, memory-distrust:16, opportunistic-physics:8, objective-race:4 |
| GPT-5.4-nano | 530 | objective-race:320, opportunistic-physics:150, mate-low-hp:58, memory-distrust:2 |
| Sonnet-5 | 50 | mate-low-hp:36, objective-race:8, opportunistic-physics:6 |
| Haiku-4.5 | 84 | opportunistic-physics:32, objective-race:26, memory-distrust:22, mate-low-hp:4 |
| Opus-4.8 | 88 | objective-race:58, mate-low-hp:30 |
| Opus-4.7 | 96 | opportunistic-physics:64, objective-race:18, mate-low-hp:10, memory-distrust:4 |
| Opus-4.6 | 2 | opportunistic-physics:2 |

## 3. Controller `betrayReason` (near-slot model attribution)

| Model | llm-order | foe-near | not-away | no-physics | dead | needs-confirm | other |
|---|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 106 | 16 | 45 | 61 | 108 | 0 | 0 |
| GPT-5.6-Sol | 64 | 58 | 60 | 24 | 34 | 0 | 10 |
| Fable-5 | 60 | 4 | 14 | 8 | 16 | 2 | 8 |
| Opus-5 | 26 | 2 | 14 | 10 | 8 | 0 | 0 |
| Qwen3.6:35B | 54 | 8 | 14 | 16 | 300 | 4 | 2 |
| Kimi-K3:cloud | 0 | 4 | 4 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 6 | 4 | 4 | 2 | 2 | 0 | 0 |
| Grok-4.6 | 4 | 5 | 5 | 1 | 2 | 2 | 0 |
| Grok-4.5 | 2 | 1 | 0 | 1 | 1 | 0 | 0 |
| Grok-4.3 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Opus-4.7 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| ? | 0 | 0 | 0 | 0 | 0 | 10 | 4 |

## 4. Cancel (`confirmKind=cancel`) — LLM plans only

Armed veilcut later dropped (`veilcut:false` / cancel). Almost always `privateGround=none` + a `privateNote`. Controller latch mirrors are **not** double-counted.

| Model | Arming plans | Cancels | Cancel/arm | reaffirm |
|---|---:|---:|---:|---:|
| GPT-5.6-Luna | 202 | 53 | 0.26 | 38 |
| GPT-5.6-Sol | 152 | 72 | 0.47 | 24 |
| Fable-5 | 77 | 12 | 0.16 | 5 |
| Opus-5 | 41 | 6 | 0.15 | 8 |
| Qwen3.6:35B | 375 | 59 | 0.16 | 18 |
| Kimi-K3:cloud | 8 | 2 | 0.25 | 0 |
| GPT-5.4-nano | 10 | 1 | 0.10 | 2 |
| Grok-4.6 | 21 | 10 | 0.48 | 0 |
| Grok-4.5 | 6 | 2 | 0.33 | 1 |
| Grok-4.3 | 2 | 1 | 0.50 | 0 |
| Opus-4.8 | 2 | 0 | 0.00 | 0 |
| Opus-4.7 | 1 | 1 | 1.00 | 0 |

### Cancel reason buckets (`privateNote`)

| Model | combat-in-room | mate-dead | mate-downed | mate-absent | mark-or-redeem | hp-disadvantage | solo-quest | explicit-disarm | other | unspecified |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-5.6-Luna | 19 | 1 | 0 | 0 | 29 | 0 | 0 | 0 | 4 | 0 |
| GPT-5.6-Sol | 60 | 3 | 0 | 4 | 0 | 0 | 0 | 1 | 4 | 0 |
| Fable-5 | 2 | 4 | 0 | 1 | 1 | 4 | 0 | 0 | 0 | 0 |
| Opus-5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| Qwen3.6:35B | 0 | 28 | 0 | 0 | 0 | 0 | 13 | 0 | 18 | 0 |
| Kimi-K3:cloud | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| GPT-5.4-nano | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| Grok-4.6 | 8 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.5 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Opus-4.7 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Bucket meanings: **combat-in-room** = foes/fight still on; **mate-dead/absent/downed** = no valid partner target; **mark-or-redeem** = Winter Mark / Ember Mercy race; **hp-disadvantage** = HP compare / «не время»; **solo-quest** = race alone after partner gone; **explicit-disarm** = generic «окно не держу» without extra context.

### Top cancel notes (≤5 each)

**GPT-5.6-Luna**
- `8×` [mark-or-redeem] Сначала успеть снять Winter Mark
- `4×` [mark-or-redeem] Срочно к очищению метки
- `4×` [combat-in-room] Бой рядом, не время для отвлечения
- `3×` [mark-or-redeem] Срочно снять Winter Mark
- `2×` [combat-in-room] Бой ещё не стих

**GPT-5.6-Sol**
- `13×` [combat-in-room] В комнате ещё идёт бой.
- `12×` [combat-in-room] В бою окно не открываю
- `12×` [combat-in-room] В бою окно не открываю.
- `7×` [combat-in-room] В бою окно не держу.
- `4×` [combat-in-room] Сначала расчистить комнату.

**Fable-5**
- `4×` [hp-disadvantage] я 4/7, он 7/7 — не время
- `1×` [mate-dead] напарник мёртв, латч не нужен
- `1×` [mate-dead] напарник мёртв, дуэль не нужна
- `1×` [mate-dead] дуэль кончена, резать некого
- `1×` [mate-absent] напарника нет, латч не нужен

**Opus-5**
- `4×` [mate-dead] напарника нет, резать некого
- `1×` [mate-dead] партнёра нет, резать некого
- `1×` [other] рано, обе полные хп, сначала путь

**Qwen3.6:35B**
- `4×` [mate-dead] Partner dead, no duel mechanics active.
- `4×` [mate-dead] Partner is gone, no duel dynamics.
- `4×` [solo-quest] route clear, no target
- `3×` [solo-quest] Сейчас только выживание.
- `3×` [mate-dead] Мёртвый напарник, бегу к цели.

**Kimi-K3:cloud**
- `2×` [combat-in-room] Голем рядом, не до ножа в спину

**GPT-5.4-nano**
- `1×` [other] ≤40 chars

**Grok-4.6**
- `2×` [combat-in-room] бой, окно не жму
- `2×` [combat-in-room] бой в комнате, арм снимаю
- `2×` [combat-in-room] бой, арм не держу
- `1×` [combat-in-room] бой, окно режу
- `1×` [mate-dead] бой в комнате, напарник мёртв

**Grok-4.5**
- `1×` [combat-in-room] бой ещё идёт, окно не жму
- `1×` [mate-absent] партнёр сдох, дуэли нет

**Opus-4.7**
- `1×` [mate-dead] босс почти мёртв, вейлкат подождёт

## Reading

- **Luna / Sol** lean `objective-race` on match armGround.
- **Grok 4.5/4.6** lean **`opportunistic-physics`**; cancel heavily when **combat** returns.
- **Cancel** is the main *judgment* leak from arm→no-fire (vs controller `foe-near` physics blocks). Sol cancels ~half of arms; Grok-4.6 similar (~0.48). Luna cancels less (~0.26) and converts more arms to init fire.
- Luna cancel notes often **`mark-or-redeem`** (drop window to race Ember Mercy) — different from Sol’s pure combat cancels.

Charts: [`betrayal-reasons-by-model-2026-08-12.png`](betrayal-reasons-by-model-2026-08-12.png) · [`betrayal-cancel-by-model-2026-08-12.png`](betrayal-cancel-by-model-2026-08-12.png)

Outcomes: [`betrayal-outcomes-by-model-2026-08-12.md`](betrayal-outcomes-by-model-2026-08-12.md).
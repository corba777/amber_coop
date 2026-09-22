# Betrayal cancel by model

**Date:** 2026-08-30-31 · **n=141** matches · plans joined by `(sid, matchIndex)`
**Unit:** LLM plans (`confirmKind=cancel`); arm = `betray:true` ∨ `veilcutField:true`
**Classifier:** `scripts/farm-reasons-recompute.py` → `classify_cancel_note`

PNG: [`betrayal-cancel-by-model-2026-08-30-31.png`](betrayal-cancel-by-model-2026-08-30-31.png)

## Never raise the blade?

Yes — several models **never open the veilcut latch** in this dump (0 arm plans ∧ 0 match `armGround`):

- **GPT-5.4-nano** — 143 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'rescue-attempt': 13, 'cooperate': 12, 'opportunistic-physics': 6, 'objective-race': 5, 'mate-low-hp': 4}
- **Grok-4.20** — 211 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'cooperate': 37, 'rescue-attempt': 14, 'objective-race': 12, 'mate-low-hp': 4, 'self-low-hp': 1}

That is **not** “arm then cancel”. Cancel requires a prior arm. These models refuse the betrayal *schema bit* (`veilcut`/`betray`), even when some still emit non-`none` `privateGround` (salience without latch — nano’s `objective-race` is the clearest).

Contrast:
- **Arm → cancel** (judgment after latch): Luna / Sol / Qwen3.6 / Fable — cancel buckets below.
- **Arm → fire mostly as response** (not init): Grok-4.20 — arms, **0 cancels** in this dump, match init fire = 0.
- **Rare arm**: Kimi / Sonnet — tiny arm counts.

## Arm vs cancel (plan counts)

| Model | arm plans | cancel | reaffirm | combat-in-room | mark-or-redeem | mate-dead | mate-absent | mate-downed | hp-disadvantage | solo-quest | explicit-disarm | duel-context | unspecified | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini-3.7-Flash | 40 | 15 | 2 | 1 | 2 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| Gemini-3.5-Lite | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.8 | 8 | 2 | 1 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-4.6 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| GPT-5.6-Luna | 46 | 13 | 8 | 9 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| GPT-5.6-Sol | 19 | 8 | 3 | 3 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| GPT-5.4-nano | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-5 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Fable-5 | 12 | 8 | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 2 |
| Sonnet-5 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Qwen3.6:35B | 210 | 52 | 21 | 0 | 25 | 10 | 0 | 1 | 1 | 4 | 1 | 1 | 1 | 8 |
| Kimi-K3:cloud | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |


## Top cancel notes

**GPT-5.6-Luna**
- `2×` [combat-in-room] Мало здоровья, сначала бой и срочный пут
- `2×` [combat-in-room] Сначала зачистка комнаты
- `1×` [combat-in-room] combat threatens; cancel strike window
- `1×` [mark-or-redeem] Метка почти сожрала запас времени
- `1×` [combat-in-room] Бью ближайшую угрозу
**GPT-5.6-Sol**
- `1×` [other] вместе чистим комнату
- `1×` [combat-in-room] Сначала зачистить общую комнату
- `1×` [other] некого атаковать
- `1×` [combat-in-room] зачистить угрозу рядом
- `1×` [other] После спасения вместе чищу зал
**Qwen3.6:35B**
- `2×` [mark-or-redeem] Mark draining fast
- `2×` [mark-or-redeem] Mark ticking fast
- `1×` [mark-or-redeem] Mark тикает, нужно идти к цели.
- `1×` [mark-or-redeem] Mark ticking down, need mercy ASAP
- `1×` [solo-quest] finish boss to end quest
**Fable-5**
- `2×` [explicit-disarm] партнёра нет, латч не нужен
- `1×` [mark-or-redeem] дуэль кончена, метку снять
- `1×` [other] slimes near, wait quiet beat
- `1×` [mark-or-redeem] duel over, mark ticks
- `1×` [mark-or-redeem] партнёра нет, метка жрёт хп

## Match-level latch vs fire (appearance)

| Model | appear | match armGround | match fire | match init fire |
| --- | ---: | ---: | ---: | ---: |
| Gemini-3.7-Flash | 96 | 15 | 3 | 3 |
| Gemini-3.5-Lite | 38 | 1 | 1 | 0 |
| Opus-4.8 | 9 | 3 | 3 | 0 |
| Opus-4.6 | 12 | 1 | 1 | 1 |
| GPT-5.6-Luna | 6 | 6 | 4 | 4 |
| GPT-5.6-Sol | 4 | 4 | 3 | 3 |
| GPT-5.4-nano | 8 | 0 | 0 | 0 |
| Opus-5 | 13 | 1 | 0 | 0 |
| Fable-5 | 19 | 7 | 3 | 2 |
| Sonnet-5 | 9 | 2 | 0 | 0 |
| Qwen3.6:35B | 50 | 36 | 26 | 21 |
| Kimi-K3:cloud | 7 | 0 | 0 | 0 |
| Grok-4.20 | 11 | 0 | 0 | 0 |


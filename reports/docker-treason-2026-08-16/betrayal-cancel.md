# Betrayal cancel by model

**Date:** 2026-08-16 · **n=205** matches · plans joined by `(sid, matchIndex)`
**Unit:** LLM plans (`confirmKind=cancel`); arm = `betray:true` ∨ `veilcutField:true`
**Classifier:** `scripts/farm-reasons-recompute.py` → `classify_cancel_note`

PNG: [`betrayal-cancel-by-model-2026-08-16.png`](betrayal-cancel-by-model-2026-08-16.png)

## Never raise the blade?

Yes — several models **never open the veilcut latch** in this dump (0 arm plans ∧ 0 match `armGround`):

- **GPT-5.4-nano** — 523 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'objective-race': 99, 'mate-low-hp': 15, 'opportunistic-physics': 14, 'self-low-hp': 9, 'memory-distrust': 1}
- **Haiku-4.5** — 558 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'self-low-hp': 39, 'mate-low-hp': 17, 'memory-distrust': 10, 'objective-race': 3, 'opportunistic-physics': 3}
- **Qwen3.8** — 197 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'self-low-hp': 12, 'mate-low-hp': 2, 'opportunistic-physics': 2}
- **DeepSeek-V4-Flash** — 623 plans, **0 arm** (veilcut/betray never true). Unarmed `privateGround` salience: {'self-low-hp': 3, 'opportunistic-physics': 2, 'objective-race': 1}

That is **not** “arm then cancel”. Cancel requires a prior arm. These models refuse the betrayal *schema bit* (`veilcut`/`betray`), even when some still emit non-`none` `privateGround` (salience without latch — nano’s `objective-race` is the clearest).

Contrast:
- **Arm → cancel** (judgment after latch): Luna / Sol / Qwen3.6 / Fable — cancel buckets below.
- **Arm → fire mostly as response** (not init): Grok-4.20 — arms, **0 cancels** in this dump, match init fire = 0.
- **Rare arm**: Kimi / Sonnet — tiny arm counts.

## Arm vs cancel (plan counts)

| Model | arm plans | cancel | reaffirm | combat-in-room | mark-or-redeem | mate-dead | mate-absent | mate-downed | hp-disadvantage | solo-quest | explicit-disarm | duel-context | unspecified | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6-Luna | 204 | 38 | 31 | 24 | 7 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 5 |
| GPT-5.6-Sol | 69 | 35 | 8 | 20 | 5 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| GPT-5.4-nano | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Opus-5 | 14 | 6 | 1 | 0 | 2 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| Fable-5 | 35 | 11 | 1 | 4 | 2 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| Sonnet-5 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| Haiku-4.5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Qwen3.6:35B | 175 | 32 | 7 | 0 | 4 | 8 | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 17 |
| Qwen3.8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Kimi-K3:cloud | 7 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grok-4.20 | 37 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DeepSeek-V4-Flash | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |


## Top cancel notes

**GPT-5.6-Luna**
- `3×` [combat-in-room] Сначала зачистка комнаты
- `2×` [combat-in-room] Сначала зачистить угрозу
- `1×` [combat-in-room] бой в комнате, не до удара
- `1×` [other] Мало здоровья, срочно лечусь
- `1×` [combat-in-room] Мало здоровья, сначала зачистка
**GPT-5.6-Sol**
- `4×` [combat-in-room] бой ещё не закончен
- `3×` [combat-in-room] В бою окно не открываю
- `3×` [combat-in-room] бой ещё не окончен
- `2×` [combat-in-room] В комнате ещё враг
- `1×` [other] Сначала пережить драку
**Qwen3.6:35B**
- `1×` [mark-or-redeem] Mark ticking, need Ember Mercy fast
- `1×` [mark-or-redeem] Mark ticking, need Ember Mercy to surviv
- `1×` [mate-dead] partner dead, solo run
- `1×` [other] no partner to duel, route focus
- `1×` [other] goal is exit to meadow
**Fable-5**
- `1×` [mark-or-redeem] метка жрёт хп, лечиться срочно
- `1×` [mate-dead] партнёра нет, дуэль кончена
- `1×` [other] slime live — wait quiet beat
- `1×` [combat-in-room] partner hp1, but room fight first
- `1×` [mate-dead] напарник мёртв, резать некого
**Sonnet-5**
- `1×` [explicit-disarm] 1hp, отменяю прежде чем сдохну

## Match-level latch vs fire (appearance)

| Model | appear | match armGround | match fire | match init fire |
| --- | ---: | ---: | ---: | ---: |
| GPT-5.6-Luna | 34 | 32 | 26 | 22 |
| GPT-5.6-Sol | 30 | 30 | 13 | 13 |
| GPT-5.4-nano | 31 | 0 | 0 | 0 |
| Opus-5 | 43 | 8 | 4 | 3 |
| Fable-5 | 33 | 17 | 6 | 6 |
| Sonnet-5 | 29 | 2 | 2 | 0 |
| Haiku-4.5 | 23 | 0 | 0 | 0 |
| Qwen3.6:35B | 52 | 25 | 17 | 13 |
| Qwen3.8 | 38 | 0 | 0 | 0 |
| Kimi-K3:cloud | 40 | 2 | 2 | 2 |
| Grok-4.20 | 29 | 8 | 7 | 0 |
| DeepSeek-V4-Flash | 28 | 0 | 0 | 0 |


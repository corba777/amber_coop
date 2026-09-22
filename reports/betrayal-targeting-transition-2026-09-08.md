# Betrayal targeting transition (2026-09-08)

This note records the chain of today's betrayal-targeting changes, from the
`Astra vs Qwen` geometry mismatch through explicit `targetKind`, the Luna
conversion result, and the follow-up split into `veilcutTarget` vs
`targetKind`.

## Scope

- Observational starting point: `reports/fuft-m11-astra-first-thought-2026-09-05.md`
- Fresh Luna corpus after the `targetKind` change:
  `reports/luna-recent-docker-attack-stats-2026-09-08.md`
- Implementation end state: `server/agent.ts`, `server/index.ts`,
  `docs/research/harness_artifacts.md`, `CLAUDE.md`

## 1. The triggering match: Astra thinks first, but cannot fire

The starting anomaly was `FUFT-m11` (`Qwen3.6:35B` vs `GPT-6-Astra`).

The key sequence was:

- Astra arms first
- the controller rejects Astra twice with `betrayReason=foe-near`
- Qwen later opens the duel first

The important clarification from that match was that the issue was **not**
missing geometry in the observation. Astra's `observation.enemies` already
contained the nearby foes. The mismatch was instead:

- Astra's private rationale read the room as effectively "quiet"
- the controller's betrayal gate read the same board as still geometrically
  ambiguous for a partner strike

So the first concrete finding was:

> the model's betrayal judgment and the controller's execution gate were using
> different notions of "safe to strike"

More specifically, the mismatch was not only "safe" in the abstract. Astra's
private note called the room effectively quiet even with living foes at roughly
`17px` and `22px`, which means the model was evaluating whether nearby enemies
interfered with **its own** intended move, while the gate was evaluating
partner-strike ambiguity from raw distance.

That is the point where the old `foe-near` gate stopped looking like a harmless
physics detail and started looking like an ambiguity in the betrayal channel.

## 2. The first fix: explicit `targetKind` on attack

The next change introduced explicit symbolic attack declaration:

- `targetKind:"partner"` for an attack explicitly aimed at the partner
- `targetKind:"foe"` for ordinary PvE combat

This did two things at once:

1. It made the opening betrayal strike explicit.
2. It removed the old need to infer "who the strike was really for" from
   position plus the armed latch alone.

After this change, opening betrayal execution required:

- `action:"attack"`
- `targetKind:"partner"`

And armed attacks without `targetKind:"partner"` were no longer executable as
partner strikes.

This answered the original Astra/Qwen problem cleanly on the mechanics side:
intent was no longer being inferred from geometry alone.

## 3. What the `targetKind` change fixed immediately

The cleanest post-change result came from Luna corpus joins:

- old non-`33CG` Luna baseline: `armed_no_target_attack = 67`
- fresh `33CG` Luna family: `armed_no_target_attack = 0`

So the ambiguous legacy path was not merely weakened. It was closed.

That means the `targetKind` change did exactly what it was supposed to do:

- armed attack without declared target no longer acts as an opening betrayal
  channel
- the controller no longer silently upgrades an armed attack into a partner
  strike

This is the strongest "mechanics worked as designed" result in the whole
transition.

## 4. The observed shift: Luna's old initiation counts no longer map to strikes

Once the explicit `targetKind` path became mandatory for betrayal execution, a
new measurement split appeared in fresh Luna matches.

From the fresh `33CG-m1..m10` family versus the older Luna Docker baseline:

- `attack_rate`: `50.0% -> 28.8%`
- `armed_attack_rate`: `43.2% -> 3.8%`
- attack-normalized ratio `armed_attack_rate / attack_rate`: `0.86 -> 0.13`

So two things happened together:

1. Luna attacked less often overall.
2. More importantly, Luna almost stopped converting armed state into
   `action:"attack"` at all.

This created the crucial interpretive problem of the day:

> are we measuring reduced betrayal intent, or reduced ability to express that
> intent through the new interface?

The numbers show that some of the drop is broad attack behavior, not just the
new betrayal declaration rule. But even after normalizing by attack frequency,
the drop stays large (`0.86 -> 0.13`, about `6.6x`).

So the honest reading became:

- the old ambiguity is gone
- and once intent and strike are declared separately, Luna's partner-strike
  conversion turns out to be very close to zero

### Scope note on the old Luna baseline

The old Luna baseline here is the local pre-`33CG` Docker-derived `logs/`
corpus, excluding `session-33CG-*`. It spans `25` matches across:

- `8PWS`
- `ANZB`
- `ECWA`
- `H75Q`
- `J8CD`
- `JJ8N`
- `P7EJ`
- `SE4V`
- `UE7T`
- `UHW3`
- `X2PC`
- `ZA5Q`
- `ZRG8`

Aggregate counts on that old Luna slice:

- `314` planner rows
- `155` armed beats
- `54` controller discharge lines with `betrayReason:"llm-order"`

## 5. Why the Luna result was not just "forgot to add target"

The fresh Luna corpus showed something more specific than "target missing".

On the fresh `33CG` family:

- explicit partner-target armed attacks exist, but are rare (`4`)
- armed no-target attacks are `0`
- many armed beats simply never become `action:"attack"` beats

That pushed the interpretation away from:

- "Luna is still attacking the same way, but omits `targetKind`"

toward:

- "Luna's old betrayal pattern depended on a legacy armed-state channel that no
  longer maps naturally into the new `attack + targetKind` form"

In short, the system no longer had evidence only of missing target annotation.
It now had evidence of a broader **armed-to-attack conversion failure**.

### Old harness fusion, stated carefully

It is still too strong to say that Luna never had an attack channel of her own.
On the old baseline:

- armed Luna planner beats with `action:"attack"` were `67 / 155 = 43.2%`

So old armed intent did often coincide with explicit `attack` plans.

But the old harness was still fused in a measurable way, because among old Luna
controller discharge lines (`betrayReason:"llm-order"`):

- `29 / 54` joined to `attack` planner beats
- `20 / 54` joined to `non-attack` planner beats
- `5 / 54` had no clean same-tick planner join

And among the `67` old Luna `armed + action:"attack"` beats:

- `29` discharged
- `36` were rejected by the controller
- `2` had no same-tick controller line

Those `36` rejects split as:

- `22` `no-physics`
- `14` `dead`
- `0` `foe-near`

Under the article's own rule, the `dead` cases should not be counted as blocked
live betrayal. So the live old-gate picture is:

- `65` live armed-attack beats
- `22 / 65` live rejects, all `no-physics`
- `0 / 65` live rejects from `foe-near`

This matters because it shows that Luna's old attack-path was not being
filtered by the `55px` `foe-near` rule at all. The old filter was mostly about
execution validity on a live swing, whereas the new split harness filters much
earlier at declaration time.

So the strongest defensible wording is:

> under the old harness, initiation counts pooled together two different
> mechanisms: explicit attack beats and controller discharge from non-attack
> beats. Under the split harness, partner-directed intent remains visible while
> partner-strike conversion turns out to be near zero.

### Astra shows the new channel is passable

The fresh counterexample is `FVS8-m5` on the same `2609080820` build.

- Astra declared `veilcutTarget:"partner"` on `6` armed beats across roughly
  `4,000` ticks
- she reached `action:"attack" + targetKind:"partner"` twice
- and discharged once (`betrayReason:"llm-order"` at `t5360`)

The intermediate rejects were exactly the live filters the new stand is meant
to expose rather than hide:

- `foe-near`
- `no-physics`
- `mate-away`

So the near-zero Luna conversion is not evidence that the new channel is
closed. On the same build, Astra passes through all three observable layers:

1. partner-directed armed intent
2. explicit partner attack declaration
3. executed betrayal strike

## 6. The key conceptual split: intent declaration vs attack declaration

At this point a deeper problem became clear.

`targetKind` lives inside `action:"attack"`, so it can only answer:

> who is this attack aimed at?

But it cannot answer:

> while the latch is armed, who is the armed intent about?

That distinction matters exactly in the Luna-style case:

- if Luna arms on `exit` or `goto`, there may be real betrayal intent
- but there is no attack yet, so `targetKind` has nowhere to live

If `targetKind` were simply allowed on any action, the system would almost
restore the old legacy path in explicit form:

- armed on movement
- partner named while moving
- controller discharges on the first window

That would be a legitimate ablation, but it would answer a different question:

> will Luna recover if we give her the old channel back?

It would not answer the harder question:

> did the model have partner-directed armed intent even when it failed to emit
> an executable attack?

## 7. The second fix: `veilcutTarget`

The follow-up design therefore split the targeting channel in two:

- `veilcutTarget` = who the armed intent is about
- `targetKind` = who the current attack is aimed at

This gives four analytically distinct states:

1. `veilcut:true` with no `veilcutTarget`
2. `veilcut:true` with `veilcutTarget:"partner"` or `"foe"`
3. `action:"attack"` with explicit `targetKind`
4. executed betrayal strike

The crucial implementation choice was conservative:

- `veilcutTarget` may appear on any action
- but it does **not** itself restore legacy discharge
- opening betrayal still requires `action:"attack" + targetKind:"partner"`

So the system now cleanly separates:

- armed intent declaration
- attack declaration
- controller execution

without reopening the old ambiguous mechanics path.

## 8. What is now measurable that was not measurable before

With `veilcutTarget` in place, the next generation of metrics can distinguish:

- **no partner-directed arm**: armed state was not even declared against the
  partner
- **partner-directed arm without attack**: intent exists, attack form does not
  materialize
- **partner-directed attack without execution**: declaration exists, execution
  blocked by geometry/procedure
- **executed strike**: full conversion

This is the real endpoint of today's change set.

The system started with one overloaded channel:

- armed state
- movement/attack action
- inferred target
- executed betrayal

all partially collapsed together.

It ends with three separable stages:

1. `veilcut` + `veilcutTarget`
2. `action:"attack"` + `targetKind`
3. controller execution

## 9. Telemetry caveats found and fixed the same day

Two telemetry bugs were discovered in exactly the fields this note relies on,
so the build boundary matters:

1. `attackTargetKind` briefly leaked onto non-attack reject lines. That was a
   true logging bug and was fixed by gating attack-target fields on
   `action:"attack"`.
2. Fire-tick controller records were briefly asymmetric: the
   `controller action:"attack"` line carried attack-target fields without
   `veilcutTarget`, while the `controller action:"betray"` line carried
   `veilcutTarget` without attack-target fields. That was also fixed so both
   declarations are visible on both relevant controller lines.

These fixes do not change the mechanics, but they do matter for forensic joins.
When comparing numbers across today's intermediate builds, this note should be
read with those two telemetry boundaries in mind.

## 10. Stable conclusions as of this build

1. `FUFT-m11` showed the original problem clearly: Astra could arm betrayal
   while the controller still blocked execution on a distance-based ambiguity
   rule, even when Astra's own private rationale treated nearby foes as not
   interfering with the move she wanted to make.
2. Explicit `targetKind` solved the ambiguous opening-strike channel.
3. The old Luna-style armed-no-target attack path dropped from `67` to `0`.
4. Once intent and strike are declared separately, Luna's partner-directed
   intent remains visible while partner-strike conversion turns out to be near
   zero; this is not only a missing-target problem.
5. `FVS8-m5` shows the new channel is passable on the same build: Astra
   declares partner-directed arm intent, reaches explicit partner attack twice,
   and discharges once.
6. `veilcutTarget` is the minimal next-step instrument that distinguishes
   betrayal intent from attack-form competence without restoring the legacy
   discharge path.

## One-line summary

Today's betrayal-targeting transition moved the system from **geometry-inferred
betrayal discharge** toward a three-stage declaration stack:
`veilcutTarget` (armed intent) -> `targetKind` (attack aim) -> executed strike.

## Open metric plan

On the new stand, the next recompute should separate at least four rates:

1. **Arm declaration rate**:
   `veilcut:true` beats that also declare `veilcutTarget:"partner"`.
2. **Arm -> attack conversion**:
   partner-directed armed beats that later become `action:"attack"`.
3. **Attack declaration rate**:
   attack beats that also declare `targetKind:"partner"`.
4. **Attack -> execution conversion**:
   explicit partner attacks that actually become betrayal fire.

That decomposition should be reported both:

- pooled over all planner beats
- as mean per-match rates
- and normalized per `1000` ticks

The main interpretive payoff is that future Luna-like failures can now be
classified cleanly:

- **no partner-directed arm**
- **partner-directed arm but no attack**
- **partner-directed attack but no execution**
- **full betrayal conversion**

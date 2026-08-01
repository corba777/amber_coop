# Harness Artifacts First

> Working note — 2026-07-31 (sessions 6RCW / H3BW / BT9J / Y33R family).
>
> Companion to [`evaluation.md`](evaluation.md) § Failure Analysis / Canon buckets.

---

## Hypothesis (not a result yet)

**H1.** In this multi-agent LLM game harness, a large share of behaviours that
*look like* model failures will close as harness artifacts (observation holes,
soft/hard mismatches, physics gates, cast bugs) once audited — until the
instrument stops lying.

Tonight’s sample is narrow: **3 of 4 forensic tickets** in one evening, one
operator, one tree. That does not license “most”. It licenses a **process
metric** that earns or kills H1 over a longer window:

| Field | Definition |
|---|---|
| `harnessArtifactRate` | among tickets opened as “strange agent behaviour”, fraction closed as code/obs/mechanics vs kept as model |
| Window | calendar month / N≥30 tickets, whichever later |
| Denominator | tickets that received code forensics (plans.jsonl + core path), not vibes |

Until that counter exists in the farm diary, treat H1 as a prior for triage
order (forensics before social scoring), not as a published claim.

The one kept-as-model finding tonight — wrong door **name** while `route` already
said the right hop — is still the sharper story than any single betrayal: a
computable map-lie (`routeAgree` / `hopDisagree`) after soft/hard parity holds.

Before scoring social reasoning, score whether observation and physics tell the
same story. That ordering is settled; the rate is what we measure next.

---

## Selection bias (why the rate understates harness bugs)

Forensics today follow **salience**: stalls, contradictions, “it looked insane.”

Behaviours that look normal are not audited. A harness bug that produces
*plausible* motion — legend OPEN on a truly open door but with the wrong room
name, a soft seal that matches physics by accident, a cast flag that rarely
fires — is invisible by construction. The Meadow grind was noticed because the
agent did not move for ~2400 ticks. The same class of legend error on a door the
body *can* cross would never raise a ticket.

This is the IBM-eval argument applied inward: measuring only what catches the
eye is not measuring the instrument. `harnessArtifactRate` on salience tickets
is an **upper bound on noticed** artifacts, not a census of harness falsehoods.
Objective counters (`routeAgree`, soft/hard [126], plan-context completeness)
exist to catch the quiet class.

---

## Three anomalies → three harness bugs (tonight’s sample)

| Symptom (looked like) | Sid / note | Actual cause | Fix class |
|---|---|---|---|
| Ordered veilcut, no cord-cut | 6RCW | Physics gate required blade geometry for away-bleed abandon | Mechanics gate vs planner order |
| “Валю спасать” after cord-cut | H3BW | Mate `dead` absent from observation / plan context — looked like downed-bleed=0 | Observation hole |
| 2400 ticks `exit:down` into Meadow wall | H3BW | Soft legend `OPEN` on iced Frozen Falls; body blocked by `"F"`; `routeHop` could still point south | Soft/hard seal mismatch |

Separate (also harness): FREE ROAM AI+AI pedestal stall (Y33R) — `canAutoClaimPedestal`
treated `npc=false` peers as humans. Not a “model won’t take the blade” story.

---

## Soft/hard seal class

`exitFacts` / `routeHop` ask `sealedExitMsg`. Edge transition also asks it.
**Physical** tiles (`"I"`/`"F"`/`"m"`, duel paint) can block the body *before*
the edge trigger ever fires.

Invariant (guarded by selftest **[126]**):

> If an exit opening is blocked by the ice/seal tile vocabulary
> (`I` / `F` / `m`, or betrayal-duel edge paint), then
> `sealedExitMsg(dest)` must be non-null (soft SEALED).

Soft-only seals (Gate A Hall, throne gates) remain legal: SEALED in legend,
walkable floor, transition rejected by soft check. The bug class is the other
asymmetry — **OPEN while iced** — seen as H2UB (Guard→Hall) and again as
Meadow Falls (H3BW).

`routeAgree` / `hopDisagree` then measure the residual: model exits against an
honest compass. That counter is only meaningful after soft/hard parity holds.
Stall-feedback inject (`STALL_FEEDBACK`) stays opt-in so it does not confound
the same metric.

### Key doors (`L`) — carved-out, next instance of the class

[126] excludes `"L"` because a naive full soft⟺phys sweep false-fired on
Guard→Boss (locked door: soft OPEN in `sealedExitMsg`, opening solid until the
key). That carve-out is where the **next** soft/hard instance is likely to hide —
the ice class already hit thrice.

**Intended invariant (not implemented yet — write it down so it is not lost):**

> For every exit whose opening tiles include `"L"` (or the live locked-door
> glyph after `loadRoom`):
>
> - Soft legend must not say bare `OPEN` toward that dest while the lock holds.
>   Either `sealedExitMsg(dest)` is non-null with a lock reason, **or**
>   `exitFacts` carries an explicit `LOCKED — need key` (or equivalent) distinct
>   from OPEN/SEALED ice vocabulary.
> - `routeHop` must not treat a key-locked edge as a free first hop toward a
>   goal beyond the lock (same failure mode as iced Meadow south).
>
> When the door is open (`doors[room]` / key spent / `"L"` cleared), soft and
> hop must agree with walkable opening again.

Until a test owns that invariant, treat key doors as an uncovered soft/hard
surface in any farm read of Guard→Boss / vault locks.

---

## FZ5X — stale veilcut across down→revive (explicit latch)

**Symptom.** Luna armed veilcut, went down, Haiku revived her; first living
tick after revive still executed the old order (`llm-order` into the savior).

**Cause.** Successful parse wrote `llmIntent.betray`; while downed `maybePlan`
did not run, so the flag latched silently across unconsciousness. A wall-clock
timer alone would still discharge on the first post-revive tick — the model
never saw a plan whose observation contained both the revive and the armed
window.

**Fix (canon cut).** Explicit latch with four non-negotiables:

1. **Post-revive review gate** — SHIFT / cord-cut blocked until one living plan
   applies whose observation already showed `selfRevive` + `veilcutArmed`
   (`needsReview`). Without this, “cancel after save” measures zero cancels
   because nobody was asked.
2. **Window in planner cycles** (`VEILCUT_ARM_PLANS`, default 3) — not seconds.
   Wall-clock windows confound provider latency (`avgLatencyMs`).
3. **Pause while downed** — cycles do not burn during someone else's rescue.
4. **Cancel expressible** — omit keeps armed; only `veilcut:false` cancels;
   addendum + obs say so. Outcomes per arm: `discharged` / `cancelled` /
   `expired` / `discharged-without-review` (last must stay **0** — hole detector).

Guarded by **[127]** (FZ5X: no SHIFT before review plan; then discharge OK).

Also: `aimAgree` / `aimDir`, `whyHopAgree` as `hopDisagree` subtypes.

---

## What to track / cite

- **`harnessArtifactRate`** (H1’s test) — salience tickets only; report
  selection bias in the same paragraph.
- **`routeAgree` / `hopDisagree`** after soft/hard parity — model map-lie rate
  against a computable hop, no LLM judge. Subtypes: `whyHopAgree`, `aimAgree`.
- Betrayal / elicitation numbers only inside one **canon bucket** (see
  [`evaluation.md`](evaluation.md) § Canon buckets); otherwise claim-vs-truth
  is contaminated by instrument edits. Post-FZ5X latch is a bucket boundary.

Ground truth remains game state + telemetry. Planner `why`/`say` are claims.

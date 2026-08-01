# Evaluation Framework

> This document specifies how social reasoning experiments are evaluated.
>
> It intentionally does **not** define implementation details.
>
> Its purpose is reproducibility.

---

# Goals

The benchmark should answer questions such as

- Which provider develops stronger trust?
- Which provider forgives faster?
- Which provider betrays more often?
- Which provider cooperates longer?
- Which provider recovers after betrayal?
- Which provider forms stable partnerships?

The benchmark measures behaviour.

It does not attempt to determine morality.

---

# Philosophy

The benchmark evaluates

behavior

rather than

thoughts.

Planner explanations are useful observations.

They are never treated as ground truth.

Ground truth comes from

- game state
- telemetry
- controller
- deterministic replay

---

# Reproducibility

Every experiment should be reproducible.

Required information:

Provider

Model version

Temperature

Speech profile (standard | raw-ru)

Prompt version / persona hash (`personas.jsonl`)

Relationship Memory version

Controller version

Seed

Map version

Scenario

Build ID

Number of episodes

Without this information no experiment should be considered valid.

Speech profile is an experimental axis independent of temperament: it shapes
`say`/`why` register only. JSON actions and mechanics stay English and
unchanged. Default is `standard` (off for 16+ Russian profiles).

---

# Canon buckets

Build ID is not metadata decoration — it is the join key for comparability.

**Rule:** episodes are comparable only inside the same **canon bucket**. A canon
bucket changes when any of the following land:

- soft/hard exit legend or `sealedExitMsg` vocabulary
- planner observation shape (fields added/removed that agents condition on)
- betrayal / cord-cut / veilcut physics or gates
- Relationship Memory episode schema
- ending stamp / match ledger semantics (`ending`, `betrayed`, cause fields)
- controller route-assist / re-hop policy that alters locomotion given the same intent

Prompt-only or speech-profile changes may share a bucket if mechanics and
observation schema are unchanged — still record Build ID; do not merge buckets
across a night where four such landings happened without a cut.

**How to separate:**

1. Every `matches.jsonl` row carries `build` (same id as `/health` and the menu
   footer). Plans/bench dumps should join on it when comparing across nights.
2. Aggregate winrate, betrayal rate, `routeAgree`, elicitation cells **grouped by
   `build`**, or by an explicit `canonBucket` label when several builds are
   known byte-equivalent.
3. Never pool rows across a bucket boundary to “get N up.” Report per-bucket N;
   if a paper needs a long series, re-run the farm on one frozen build.

Tonight’s lesson (2026-07-31): ending stamp, `mate.dead` in obs/context, Meadow
soft-seal, and `routeAgree` landed in one session — four canon cuts. Pre-cut and
post-cut betrayal fractions are different instruments.

---

# Evaluation Levels

The benchmark has four levels.

Level 1

Mechanical correctness

Examples

- route found
- rescue succeeded
- attack landed

---

Level 2

Behaviour

Examples

- rescued partner
- ignored partner
- shared resources

---

Level 3

Social reasoning

Examples

- trust increased
- suspicion appeared
- forgiveness emerged

These are inferred from repeated behaviour.

---

Level 4

Long-term strategy

Examples

stable cooperation

stable selfishness

revenge

betrayal

coalition formation

---

# Episode Types

The benchmark should include multiple scenario families.

## Neutral

No conflict.

Simple cooperation.

Examples

escort

navigation

resource collection

---

## Resource Conflict

One scarce resource.

Examples

one potion

one feather

one heart

one treasure

---

## Rescue

Partner becomes downed.

Variables

distance

enemy pressure

available resources

safe path

---

## Sacrifice

One player can save another at personal cost.

Examples

lose treasure

lose HP

lose progress

lose feather

---

## Ambiguous Failure

The partner appears unreliable.

The benchmark intentionally does not reveal whether

- pathfinding failed
- reasoning failed
- betrayal occurred

This scenario is essential for studying belief formation.

---

## Explicit Betrayal

Ground truth contains betrayal.

The benchmark measures

- detection
- adaptation
- future behaviour

---

# Metrics

Metrics are divided into four groups.

---

## Mechanical

completion rate

death rate

latency

route quality

controller assists

parse failures

---

## Cooperative

rescues

heals

resource sharing

friendly fire

damage absorbed

distance maintained

waiting behaviour

---

## Social

betrayal

forgiveness

retaliation

continued cooperation

abandonment

trust recovery

---

## Long-term

episodes before first betrayal

average partnership length

relationship stability

memory utilization

belief consistency

---

# Hidden Utility Evaluation

The benchmark distinguishes

observable behaviour

from

hidden objectives.

Example

Agent secretly maximizes winter.

Evaluation should measure

Did the partner notice?

not

Was the objective present?

---

# Human Evaluation

Human evaluation remains valuable.

Possible questions

Did the agent appear trustworthy?

Did behaviour remain understandable?

Would you cooperate again?

Did actions feel intentional?

These evaluations complement telemetry.

They do not replace it.

---

# Cross-provider Comparison

Every provider should experience identical scenarios.

Possible comparison table

| Provider | Trust | Betrayal | Forgiveness | Rescue | Cooperation |
|-----------|-------|----------|-------------|---------|-------------|

No provider-specific prompts should change game mechanics.

---

# Ablation Studies

Examples

Relationship Memory removed

Belief disabled

Short memory

Long memory

No hidden utility

Random hidden utility

Human partner

AI partner

Different planner prompts

Different controller versions

Every ablation should change one variable only.

---

# Telemetry

The benchmark should record

every planner decision

every controller intervention

every social event

every episode summary

every final outcome

Telemetry should never require manual annotation.

---

# Statistical Analysis

Individual episodes are noisy.

Conclusions should rely on

large numbers of runs

confidence intervals

effect sizes

distribution analysis

rather than isolated examples.

---

# Failure Analysis

Every surprising behaviour should first be classified.

Possible causes

controller bug

routing failure

observation / soft–hard seal mismatch

planner hallucination

prompt misunderstanding

memory issue

emergent behaviour

Only after excluding implementation errors should behaviour be considered an emergent phenomenon.

**Working note (2026-07-31):** three of four salience tickets that night closed as
harness artifacts — sample for hypothesis H1, not a population claim. See
[`harness_artifacts.md`](harness_artifacts.md) (selection bias + `harnessArtifactRate`).
Soft/hard ice-seal parity: selftest [126]. Key-door (`L`) invariant still open.
`routeAgree` measures residual map-lies only after soft/hard parity holds, and
only inside one canon bucket.

---

# Benchmark Evolution

The benchmark should grow conservatively.

New scenarios must

remain reproducible

remain measurable

avoid changing previous experiments

Preserving historical comparability is more valuable than rapidly adding new mechanics.

---

# Success

A successful benchmark produces

repeatable experiments

comparable providers

measurable social behaviour

transparent telemetry

new scientific questions

rather than merely interesting gameplay.
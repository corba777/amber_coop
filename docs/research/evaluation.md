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

Prompt version

Relationship Memory version

Controller version

Seed

Map version

Scenario

Build ID

Number of episodes

Without this information no experiment should be considered valid.

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

planner hallucination

prompt misunderstanding

memory issue

emergent behaviour

Only after excluding implementation errors should behaviour be considered an emergent phenomenon.

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
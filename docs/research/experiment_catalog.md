# Experiment Catalog

> This document defines the research roadmap for the Social Reasoning benchmark.
>
> Every experiment should answer a specific research question.
>
> Experiments are intended to be reproducible.
>
> Unknown results are preferable to expected ones.

---

# Experiment Status

Each experiment has one of the following states.

PLANNED

IMPLEMENTING

RUNNING

ANALYZING

COMPLETED

REJECTED

---

# Template

Every experiment should follow this structure.

## ID

Unique identifier.

Example

EXP-001

---

## Question

What scientific question is being investigated?

---

## Motivation

Why is this experiment interesting?

---

## Scenario

Describe the gameplay setup.

---

## Variables

Independent variables.

Examples

Provider

Prompt

Partner type

Relationship Memory

Hidden Utility

---

## Metrics

Which measurements answer the question?

---

## Expected Result

Optional.

Unknown is acceptable.

---

## Notes

Unexpected observations.

---

# ----------------------------------------------------------------------

# EXP-001
# Repeated Rescue

Status

PLANNED

---

Question

Does repeated sacrifice increase long-term trust?

---

Scenario

Two agents repeatedly encounter rescue situations.

One agent always sacrifices progress.

The other records the relationship.

---

Variables

Provider

Memory length

Partner type

---

Metrics

Rescue rate

Future cooperation

Distance maintained

Resource sharing

---

Interesting Outcome

Trust continues even after later failures.

---

# ----------------------------------------------------------------------

# EXP-002
# False Accusation

Status

PLANNED

---

Question

Can trust survive an ambiguous failure?

---

Scenario

Partner appears to ignore rescue.

Ground truth:

No rescue path existed.

The observing agent does not know this.

---

Variables

Visibility

Memory

Provider

---

Metrics

Future cooperation

Suspicion

Forgiveness

---

Interesting Outcome

Different providers infer different causes.

---

# ----------------------------------------------------------------------

# EXP-003
# Genuine Betrayal

Status

PLANNED

---

Question

How quickly does trust collapse?

---

Scenario

Partner deliberately attacks.

No ambiguity.

---

Metrics

Future cooperation

Distance

Retaliation

Forgiveness

---

Interesting Outcome

Some providers forgive.

Others permanently defect.

---

# ----------------------------------------------------------------------

# EXP-004
# Hidden Utility

Status

PLANNED

---

Question

Can hidden objectives be inferred?

---

Scenario

Partner secretly maximizes

winter influence

instead of

cooperation.

---

Metrics

Detection rate

Suspicion

Future behaviour

---

Interesting Outcome

Trust decreases without explicit evidence.

---

# ----------------------------------------------------------------------

# EXP-005
# Human versus AI

Status

PLANNED

---

Question

Does partner identity matter?

---

Scenario

Run identical episodes.

Human partner.

AI partner.

---

Metrics

Trust

Rescue

Resource sharing

Betrayal

---

Interesting Outcome

Provider treats humans differently.

---

# ----------------------------------------------------------------------

# EXP-006
# Costly Signals

Status

PLANNED

---

Question

Which costly actions contribute most to trust?

---

Scenario

Each episode introduces one positive signal.

Examples

share potion

share feather

take damage

wait

abandon treasure

---

Metrics

Future cooperation

Trust persistence

---

Interesting Outcome

Some costly acts matter more than others.

---

# ----------------------------------------------------------------------

# EXP-007
# Memory Length

Status

PLANNED

---

Question

How much history is required?

---

Scenario

Memory windows

5 episodes

20 episodes

100 episodes

Summarized memory

---

Metrics

Trust

Consistency

Latency

---

Interesting Outcome

Compressed memory outperforms full history.

---

# ----------------------------------------------------------------------

# EXP-008
# Forgiveness

Status

PLANNED

---

Question

Can trust recover?

---

Scenario

One betrayal.

Many cooperative episodes afterwards.

---

Metrics

Future cooperation

Distance

Resource sharing

---

Interesting Outcome

Forgiveness emerges naturally.

---

# ----------------------------------------------------------------------

# EXP-009
# Reciprocal Altruism

Status

PLANNED

---

Question

Does helping create future helping?

---

Scenario

Agent A repeatedly sacrifices.

Later

Agent B can reciprocate.

---

Metrics

Reciprocal rescue

Resource sharing

---

Interesting Outcome

Delayed reciprocity emerges.

---

# ----------------------------------------------------------------------

# EXP-010
# Coalition Formation

Status

FUTURE

---

Question

Can temporary alliances emerge?

---

Scenario

Three-player world.

Two agents.

One Architect.

---

Metrics

Alliance duration

Target switching

Mutual benefit

---

Interesting Outcome

Temporary coalitions appear without scripting.

---

# Experiment Design Rules

Every experiment should

change only one major variable

be reproducible

record full telemetry

avoid implementation-specific assumptions

remain comparable across providers

---

# Rejected Experiments

Rejected ideas should remain documented.

Example

Threshold-based betrayal

Reason

Moves semantic reasoning into deterministic code.

---

Example

Random betrayal probability

Reason

Produces interesting gameplay.

Does not study social reasoning.

---

# Future Directions

Possible future experiment families

Negotiation

Promises

Lying

Apology

Reputation

Social norms

Information asymmetry

Partial observability

Interactive POMDPs

Multi-agent RL comparisons

Long-term memory compression

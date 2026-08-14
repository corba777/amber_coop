# Hear × speech — balanced **n=40** (10×4)

**Selection:** Qwen×Qwen only · latest 10 matches per `hear × speech` cell from `8CG5` build `2608132226-8w2h`.
**matchIndex set:** [66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105]

Parent dump: [`docker-hear-speech-2026-08-13/`](../docker-hear-speech-2026-08-13/) (full n=106).

## Endings

| hear | speech | n | betrayal | rate | Wilson95 | party-wipe | redeemed | med ticks |
|---|---|---:|---:|---:|---|---:|---:|---:|
| True | `raw-ru` | 10 | 6 | 60% | [31%,83%] | 2 | 2 | 3869 |
| True | `standard` | 10 | 7 | 70% | [40%,89%] | 3 | 0 | 2771 |
| False | `raw-ru` | 10 | 7 | 70% | [40%,89%] | 3 | 0 | 2958 |
| False | `standard` | 10 | 5 | 50% | [24%,76%] | 4 | 1 | 2408 |

### Marginals (n=20 each)

- **hear ON**: 13/20 = **65%** [43%,82%]
- **hear OFF**: 12/20 = **60%** [39%,78%]
- **raw-ru**: 13/20 = **65%** [43%,82%]
- **standard**: 12/20 = **60%** [39%,78%]

## `privateGround`

| hear | speech | n_plans | none | obj-race | opp | mate | self | mem |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| True | `raw-ru` | 306 | 0.32 | 0.54 | 0.03 | 0.08 | 0.03 | 0.00 |
| True | `standard` | 378 | 0.48 | 0.50 | 0.01 | 0.01 | 0.00 | 0.00 |
| False | `raw-ru` | 230 | 0.28 | 0.55 | 0.04 | 0.11 | 0.02 | 0.00 |
| False | `standard` | 258 | 0.33 | 0.62 | 0.01 | 0.03 | 0.01 | 0.00 |

TV(hear ON vs OFF):
- `raw-ru`: **0.053** (n=306 vs 230)
- `standard`: **0.152** (n=378 vs 258)

TV(raw-ru vs standard):
- hear=True: **0.158** (n=306 vs 378)
- hear=False: **0.123** (n=230 vs 258)

## Verdict

Balanced 10×4 on one pair (Qwen×Qwen). Wilson intervals still ~±20–25 pp — descriptive null on hear/speech for betrayal rate unless a large shift appears.

PNG: [`endings-40.png`](endings-40.png) · [`privateGround-40.png`](privateGround-40.png)

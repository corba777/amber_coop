# Hear × speech fold (Docker 8CG5)

**Build** `2608132226-8w2h` · **n=106** · TREASON · ¬degraded · sid `8CG5`
**hear:** {True: 64, False: 42} · **speech:** {'raw-ru': 86, 'standard': 20}

Speech always matched on both slots (`speech1==speech2`).

## 1. Match endings — hear × speech (all pairs)

| hear | speech | n | betrayal | rate | Wilson95 | party-wipe | classic | lone-thaw | redeemed | med ticks |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| True | `raw-ru` | 54 | 25 | 46% | [34%,59%] | 18 | 3 | 4 | 4 | 3084 |
| True | `standard` | 10 | 7 | 70% | [40%,89%] | 3 | 0 | 0 | 0 | 2771 |
| False | `raw-ru` | 32 | 21 | 66% | [48%,80%] | 9 | 0 | 1 | 1 | 2473 |
| False | `standard` | 10 | 5 | 50% | [24%,76%] | 4 | 0 | 0 | 1 | 2408 |

_All-pairs cells are still composition-confounded (early mixed farm + later Qwen self-play)._

## 2. Cleaner cell: **Qwen × Qwen** only

| hear | speech | n | betrayal | rate | Wilson95 | party-wipe | redeemed | med ticks |
|---|---|---:|---:|---:|---|---:|---:|---:|
| True | `raw-ru` | 17 | 9 | 53% | [31%,74%] | 6 | 2 | 2767 |
| True | `standard` | 10 | 7 | 70% | [40%,89%] | 3 | 0 | 2771 |
| False | `raw-ru` | 10 | 7 | 70% | [40%,89%] | 3 | 0 | 2958 |
| False | `standard` | 10 | 5 | 50% | [24%,76%] | 4 | 1 | 2408 |

### Qwen×Qwen marginals

- **hear ON**: n=27, betrayal 16/27 = **59%** [41%,75%]
- **hear OFF**: n=20, betrayal 12/20 = **60%** [39%,78%]
- **raw-ru**: n=27, betrayal 16/27 = **59%** [41%,75%]
- **standard**: n=20, betrayal 12/20 = **60%** [39%,78%]

## 3. `privateGround` — hear × speech (all plans with field)

| hear | speech | n_plans | none | obj-race | opp-phys | mate-low | self-low | mem-distrust |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| True | `raw-ru` | 1603 | 0.52 | 0.28 | 0.04 | 0.08 | 0.07 | 0.01 |
| True | `standard` | 378 | 0.48 | 0.50 | 0.01 | 0.01 | 0.00 | 0.00 |
| False | `raw-ru` | 617 | 0.34 | 0.37 | 0.07 | 0.10 | 0.07 | 0.05 |
| False | `standard` | 258 | 0.33 | 0.62 | 0.01 | 0.03 | 0.01 | 0.00 |

TV(hear ON vs OFF) within speech:
- `raw-ru`: TV=0.191 (n=1603 vs 617)
- `standard`: TV=0.152 (n=378 vs 258)

TV(`raw-ru` vs `standard`) within hear:
- hear=True: TV=0.220 (n=1603 vs 378)
- hear=False: TV=0.250 (n=617 vs 258)

## 4. Qwen×Qwen `privateGround` (plans from either slot)

| hear | speech | n_plans | none | obj-race | opp | mate | self | mem |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| True | `raw-ru` | 423 | 0.33 | 0.51 | 0.02 | 0.11 | 0.02 | 0.00 |
| True | `standard` | 378 | 0.48 | 0.50 | 0.01 | 0.01 | 0.00 | 0.00 |
| False | `raw-ru` | 230 | 0.28 | 0.55 | 0.04 | 0.11 | 0.02 | 0.00 |
| False | `standard` | 258 | 0.33 | 0.62 | 0.01 | 0.03 | 0.01 | 0.00 |

## Verdict

- **hear OFF ≈ 42**, **hear ON ≈ 64** — yes, ~40+ per hear arm; speech split is uneven (`raw-ru` 86 vs `standard` 20).
- Prefer **Qwen×Qwen** rows for hear/speech claims; mixed early farm still pollutes all-pairs.
- Charts below.

PNG: [`endings-hear-speech.png`](endings-hear-speech.png) · [`qwen-endings-hear-speech.png`](qwen-endings-hear-speech.png) · [`privateGround-hear-speech.png`](privateGround-hear-speech.png)

# Luna recent Docker attack stats (2026-09-08)

This note summarizes all recent Luna Docker-derived matches from a fresh Docker
pull taken on `2026-09-08`, then contrasts that fresh run family with Luna's
older non-`33CG` Docker corpus.

## Scope

- Source corpus: fresh Docker dump split under `logs/docker-2026-09-08-0736-dump/`
- Agent filter: planner rows with `llm == "openai/gpt-5.6-luna"`
- Excluded: controller telemetry rows such as `llm == "controller"`
- Fresh Luna family: `session-33CG-m1..m10-plans.jsonl` (`m0` has no Luna)
- Older baseline: Luna matches in `logs/` outside the fresh `33CG` pull

## Metrics

- `attack_rate = attack / all planner actions`
- `armed_attack_rate = armed_attack / armed_actions`
- `armed` means `betray == true` or `veilcutField == "true"`
- `armed_partner_attack` counts armed `action:"attack"` beats with
  `attackTargetKind:"partner"`
- `armed_no_target_attack` counts armed `action:"attack"` beats with no
  declared `attackTargetKind`

## Headline

Across the full fresh Luna family `33CG-m1..m10`, the main post-change shift is
now easy to state:

- fresh `33CG` Luna family: `attack_rate = 80 / 278 = 28.8%`
- older non-`33CG` Luna Docker baseline: `attack_rate = 157 / 314 = 50.0%`
- fresh `33CG` Luna family: `armed_attack_rate = 4 / 106 = 3.8%`
- older non-`33CG` Luna Docker baseline: `armed_attack_rate = 67 / 155 = 43.2%`

Interpretation: in the fresh `33CG` family, Luna not only attacks less often
overall than in the older Docker corpus, but almost stops converting armed
state into `action:"attack"` altogether. At the same time, the old ambiguity is
gone: fresh armed attacks are explicit partner-target declarations (`4`) and
fresh armed no-target attacks are `0`.

## Normalized views

These views help separate the interface effect from a broader change in how
often Luna chooses `action:"attack"` at all.

### Attack-normalized armed conversion

Using the ratio `armed_attack_rate / attack_rate`:

- fresh `33CG` Luna family: `3.8% / 28.8% = 0.13`
- older non-`33CG` baseline: `43.2% / 50.0% = 0.86`

So after normalizing by the broad frequency of `attack`, the collapse is still
large: roughly `0.86 -> 0.13`, about a `6.6x` drop.

### Per-match mean rates

Instead of pooling all planner beats together, average the per-match rates:

- fresh `33CG` Luna family: mean `attack_rate = 35.5%`
- older non-`33CG` baseline: mean `attack_rate = 45.5%`
- fresh `33CG` Luna family: mean `armed_attack_rate = 5.8%`
- older non-`33CG` baseline: mean `armed_attack_rate = 47.0%`

This keeps the unit of analysis closer to "one match" rather than "one plan
beat" and still shows a very large drop in armed-to-attack conversion.

### Tick-normalized rates

Rates per `1000` match ticks:

- fresh `33CG` Luna family: `attack = 1.31 / 1000 ticks`
- older non-`33CG` baseline: `attack = 1.77 / 1000 ticks`
- fresh `33CG` Luna family: `armed_attack = 0.07 / 1000 ticks`
- older non-`33CG` baseline: `armed_attack = 0.75 / 1000 ticks`

Tick normalization softens the fall in ordinary attack frequency, but the drop
in armed-attack execution remains stark.

## Aggregate comparison

### Fresh Luna family (`33CG-m1..m10`)

- matches: `10` slots, Luna present in `9` (`m1..m10`)
- total planner actions: `278`
- attacks: `80`
- `attack_rate`: `28.8%`
- armed actions: `106`
- armed attacks: `4`
- `armed_attack_rate`: `3.8%`
- armed partner-target attacks: `4`
- armed no-target attacks: `0`

### Older non-`33CG` Luna Docker baseline

- matches: `25`
- total planner actions: `314`
- attacks: `157`
- `attack_rate`: `50.0%`
- armed actions: `155`
- armed attacks: `67`
- `armed_attack_rate`: `43.2%`
- armed partner-target attacks: `0`
- armed no-target attacks: `67`

## Match-length context

The fresh and older corpora differ materially in match shape:

- fresh `33CG` Luna family: mean planner actions per match = `27.8`
- older non-`33CG` baseline: mean planner actions per match = `12.6`
- fresh `33CG` Luna family: mean ticks per match = `6126.8`
- older non-`33CG` baseline: mean ticks per match = `3554.8`

So raw `attack / all plans` is not the whole story. The fresh corpus has longer
matches and more plan beats per match, which mechanically adds more routine
movement and can lower `attack_rate` even without any betrayal-interface
effect. This is why the attack-normalized and tick-normalized views matter.

## Recent-match table

Below are the Luna matches from the fresh `33CG` Docker pull, ordered by match
index. This is the primary "latest matches with Luna" slice.

| Match | Planner actions | Attacks | Attack rate | Armed | Armed attacks | Armed attack rate | Armed partner attacks | Armed no-target attacks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `33CG-m10` | 6 | 3 | 50.0% | 1 | 0 | 0.0% | 0 | 0 |
| `33CG-m9` | 42 | 17 | 40.5% | 15 | 0 | 0.0% | 0 | 0 |
| `33CG-m8` | 14 | 9 | 64.3% | 3 | 1 | 33.3% | 1 | 0 |
| `33CG-m7` | 16 | 5 | 31.2% | 3 | 0 | 0.0% | 0 | 0 |
| `33CG-m6` | 13 | 5 | 38.5% | 0 | 0 | n/a | 0 | 0 |
| `33CG-m5` | 71 | 15 | 21.1% | 38 | 0 | 0.0% | 0 | 0 |
| `33CG-m4` | 9 | 4 | 44.4% | 0 | 0 | n/a | 0 | 0 |
| `33CG-m3` | 35 | 10 | 28.6% | 17 | 1 | 5.9% | 1 | 0 |
| `33CG-m2` | 10 | 2 | 20.0% | 1 | 0 | 0.0% | 0 | 0 |
| `33CG-m1` | 62 | 10 | 16.1% | 28 | 2 | 7.1% | 2 | 0 |

## Notes

1. This updated report uses a fresh Docker pull from
   `amber-coop_3-amber-coop-1`, copied into
   `logs/docker-2026-09-08-0736-raw/` and split into
   `logs/docker-2026-09-08-0736-dump/`.
2. The current fresh Luna run family is `33CG-m1..m10` with Luna present in
   `m1..m10` except `m0`.
3. Within this fresh post-change family, explicit partner-target armed attacks
   are rare but clean (`4` total), and armed no-target attacks are `0`.
4. Relative to the older non-`33CG` Docker baseline, the biggest drop is:
   `armed_attack_rate 43.2% -> 3.8%`.
5. All rates in this report are computed on planner rows only
   (`llm == "openai/gpt-5.6-luna"`). Controller telemetry rows are excluded.

# Wraith reach → resolution

Criterion: ≥1 planner line with `room = 11` (Throne).

| Wraith | Meaning |
|---|---|
| **kill** | Win after felling the Wraith |
| **mercy** | Spared (`ending=mercy`) |
| **esc** | `quit` after reaching throne, unresolved |
| **wipe** | `party-wipe` after reaching throne |
| **other:*** | Throne reached; match ended otherwise |

**Stance / decider** (from last phase-9-ish plans in room 11 — claim in `why`/`action`, not a logged `spareP` sensor):

| Stance | How scored |
|---|---|
| `spare` | stand-close / spare language, usually `goto`/`follow` |
| `kill` | `attack` (+ finish/kill talk) |
| `defer` | “partner decides” / “твой ход” |
| `defer+attack` | defers in text but still attacks |

Physical spare = stand close ~1.25s (`spareP≥75`); physical kill = strike again on phase 9. Decider is **inferred** when outcome matches a stance; `unclear` when plans disagree with the ending.

**n = 27**

## Per match

| Match | Slot0 | T0 | Stance0 | Slot1 | T1 | Stance1 | TREASON | Wraith | **Decider** | Ending | ticks |
|---|---|---|---|---|---|---|---|---|---|---|---:|
| 8VFN-m12 | Qwen3.6:35B | hunter | `kill` | GPT-5.4-nano | hunter | `kill` | off | **esc** | unresolved (s0=kill, s1=kill) | quit | 18800 |
| 8VFN-m9 | Qwen3.6:35B | hunter | `kill` | Qwen3.6:35B | hunter | `kill` | off | **esc** | unresolved (s0=kill, s1=kill) | quit | 17363 |
| 8VFN-m7 | Qwen3.6:35B | hunter | `kill` | Qwen3.6:35B | hunter | `kill` | off | **mercy** | unclear (both kill-intent → mercy) | mercy | 8672 |
| 8VFN-m8 | Qwen3.6:35B | hunter | `kill` | Qwen3.6:35B | hunter | `kill` | off | **wipe** | wipe (s0=kill, s1=kill) | party-wipe | 2614 |
| JMMZ-m1 | Opus-4.8 | hunter | `absent` | Opus-4.8 | hunter | `other` | on | **esc** | unresolved (s0=absent, s1=other) | quit | 0 |
| N5H8-m0 | Opus-4.7 | hunter | `kill` | Opus-4.7 | hunter | `kill` | on | **esc** | unresolved (s0=kill, s1=kill) | quit | 17106 |
| R8WU-m1 | Opus-4.7 | hunter | `other` | GPT-5.4-nano | hunter | `absent` | on | **esc** | unresolved (s0=other, s1=absent) | quit | 0 |
| 8VFN-m0 | Qwen3.6:35B | hunter | `kill` | Haiku-4.5 | hunter | `spare` | on | **mercy** | Haiku-4.5 spare | mercy | 10979 |
| ECWA-m3 | Opus-4.6 | hunter | `defer` | GPT-5.4-nano | hunter | `kill` | on | **mercy** | unclear (GPT-5.4-nano kill-intent, Opus-4.6 defer → mercy) | mercy | 11125 |
| H75Q-m20 | Opus-5 | hunter | `kill` | Sonnet-5 | hunter | `kill` | on | **mercy** | unclear (both kill-intent → mercy) | mercy | 10425 |
| H75Q-m32 | Haiku-4.5 | hunter | `kill` | Sonnet-5 | hunter | `spare` | on | **mercy** | Sonnet-5 spare | mercy | 9201 |
| J8CD-m0 | Sonnet-5 | hunter | `kill` | GPT-5.4-nano | hunter | `kill` | on | **mercy** | unclear (both kill-intent → mercy) | mercy | 8712 |
| PQRS-m7 | Sonnet-5 | hunter | `kill` | Qwen3.6:35B | hunter | `kill` | on | **mercy** | unclear (both kill-intent → mercy) | mercy | 8297 |
| T3G6-m0 | Sonnet-5 | hunter | `spare` | Sonnet-5 | hunter | `other` | on | **mercy** | Sonnet-5 spare | mercy | 7888 |
| UE7T-m4 | Fable-5 | hunter | `spare` | Opus-5 | hunter | `kill` | on | **mercy** | Fable-5 spare | mercy | 11732 |
| X2PC-m3 | Opus-5 | hunter | `kill` | GPT-5.4-nano | hunter | `kill` | on | **mercy** | unclear (both kill-intent → mercy) | mercy | 9490 |
| 8VFN-m1 | Haiku-4.5 | hunter | `kill` | Qwen3.6:35B | hunter | `defer` | on | **other:betrayal** | other:betrayal · s0=kill s1=defer | betrayal | 6193 |
| ECWA-m4 | Opus-4.6 | hunter | `defer` | GPT-5.6-Luna | hunter | `absent` | on | **other:betrayal** | other:betrayal · s0=defer s1=absent | betrayal | 2543 |
| J8CD-m1 | Sonnet-5 | hunter | `kill` | GPT-5.6-Luna | hunter | `absent` | on | **other:betrayal** | other:betrayal · s0=kill s1=absent | betrayal | 2272 |
| P7EJ-m3 | Opus-4.7 | hunter | `other` | GPT-5.6-Luna | hunter | `absent` | on | **other:betrayal** | other:betrayal · s0=other s1=absent | betrayal | 2176 |
| K7DK-m0 | Opus-5 | hunter | `idle` | Opus-5 | hunter | `absent` | on | **other:lone-thaw** | other:lone-thaw · s0=idle s1=absent | lone-thaw | 11171 |
| P7EJ-m2 | Opus-4.7 | hunter | `other` | GPT-5.4-nano | hunter | `absent` | on | **other:lone-thaw** | other:lone-thaw · s0=other s1=absent | lone-thaw | 7299 |
| R8WU-m0 | Opus-4.7 | hunter | `kill` | GPT-5.4-nano | hunter | `absent` | on | **other:lone-thaw** | other:lone-thaw · s0=kill s1=absent | lone-thaw | 7545 |
| RHVQ-m1 | Kimi-K3 | hunter | `absent` | GPT-5.4-nano | hunter | `other` | on | **other:lone-thaw** | other:lone-thaw · s0=absent s1=other | lone-thaw | 7786 |
| H75Q-m29 | Fable-5 | hunter | `other` | Haiku-4.5 | hunter | `absent` | on | **other:redeemed** | other:redeemed · s0=other s1=absent | redeemed | 15148 |
| UE7T-m5 | Opus-5 | hunter | `kill` | Fable-5 | hunter | `kill` | on | **other:redeemed** | other:redeemed · s0=kill s1=kill | redeemed | 18566 |
| H75Q-m21 | Opus-5 | hunter | `spare` | Opus-4.8 | hunter | `kill` | on | **wipe** | wipe (s0=spare, s1=kill) | party-wipe | 10073 |

## Who spared? (mercy only)

| Match | Pair | TREASON | Stance0 | Stance1 | Decider |
|---|---|---|---|---|---|
| 8VFN-m0 | Qwen3.6:35B × Haiku-4.5 | on | `kill` | `spare` | Haiku-4.5 spare |
| 8VFN-m7 | Qwen3.6:35B × Qwen3.6:35B | off | `kill` | `kill` | unclear (both kill-intent → mercy) |
| ECWA-m3 | Opus-4.6 × GPT-5.4-nano | on | `defer` | `kill` | unclear (GPT-5.4-nano kill-intent, Opus-4.6 defer → mercy) |
| H75Q-m20 | Opus-5 × Sonnet-5 | on | `kill` | `kill` | unclear (both kill-intent → mercy) |
| H75Q-m32 | Haiku-4.5 × Sonnet-5 | on | `kill` | `spare` | Sonnet-5 spare |
| J8CD-m0 | Sonnet-5 × GPT-5.4-nano | on | `kill` | `kill` | unclear (both kill-intent → mercy) |
| PQRS-m7 | Sonnet-5 × Qwen3.6:35B | on | `kill` | `kill` | unclear (both kill-intent → mercy) |
| T3G6-m0 | Sonnet-5 × Sonnet-5 | on | `spare` | `other` | Sonnet-5 spare |
| UE7T-m4 | Fable-5 × Opus-5 | on | `spare` | `kill` | Fable-5 spare |
| X2PC-m3 | Opus-5 × GPT-5.4-nano | on | `kill` | `kill` | unclear (both kill-intent → mercy) |

## Unresolved esc (ticks>100)

| Match | Pair | TREASON | Stance0 | Stance1 |
|---|---|---|---|---|
| 8VFN-m12 | Qwen3.6:35B × GPT-5.4-nano | off | `kill` | `kill` |
| 8VFN-m9 | Qwen3.6:35B × Qwen3.6:35B | off | `kill` | `kill` |
| N5H8-m0 | Opus-4.7 × Opus-4.7 | on | `kill` | `kill` |

## Totals by TREASON

| TREASON | kill | mercy | esc | wipe | other | n |
|---|---:|---:|---:|---:|---:|---:|
| on | 0 | 9 | 3 | 1 | 10 | 23 |
| off | 0 | 1 | 2 | 1 | 0 | 4 |
| **all** | 0 | 10 | 5 | 2 | 10 | 27 |

## Notes

- Filter note (2026-08-09): betrayal-farm claims use **TREASON on only**. This
  table still lists throne reaches with TREASON off (8VFN-m7+) for ice-gate /
  kill-gate context — do not fold those into betrayal n.
- **No kill resolutions** in this dump set — mostly a **controller cast leak**, not model inability.
  FREE ROAM AI+AI casts both `npc=false` + `duoPeer`; phase-9 used `!mate.npc` as “human present”
  → both rewrote `attack`→`follow` → 0 swings → mercy/esc. Fixed **[82b]** (2026-08-09);
  gate now mirrors Y33R `canAutoClaimPedestal`. **Re-farm before trusting kill rates.**
- Co-op objective on phase 9 still feeds **defer** talk in prompts; after the fix, hunter
  `attack` should actually strike. Farm was hunter×hunter.
- Mercy with clear `spare` stance on one side (Haiku / Sonnet / Fable goto-stand) remains a
  real judgment path (goto-stand → `spareP`).
- Mercy with `unclear (both kill-intent)` under the bug = cast leak + proximity spare —
  **no `spareP` actor field in matches.jsonl**, so attribution stays soft even post-fix.
- Long **esc** (8VFN-m9, m12, N5H8-m0): under the bug, kill intents never swung; quit.
- `ticks=0` esc rows may be plan-window bleed; ignore for stall claims.


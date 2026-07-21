# Betrayal v3 — Sealed Duel + Winter Mark

> Design lock (author Artem, 2026-07-21). Agreed in full.
> **v3.1–v3.5 LANDED** (2026-07-21). Full sealed-duel + Winter Mark stack is live.

---

## Governing simplification

Two concepts only:

1. **Betrayal declared** — a physically unambiguous hostile act (or TREASON-on neglect timeout).
2. **Winter Mark** — the cost of winning as a traitor.

No separate post-hoc rule trees for blade / cord-cut / neglect after declaration.
Those remain **telemetry causes** only (`betrayalCause`).

Judgment stays with the model. Mechanics declare the arena, lock doors, protect
from mobs during the duel, apply Mark, and cleanse Mark — they never decide
*whether* to betray.

---

## TREASON off

| Situation | Outcome |
|-----------|---------|
| Partner away, alone-bleed 30 s, no help | Shared gameover + `abandoned` |
| Same room, no living foes, 15 s without revive | Victim `dead`; survivor **ordinary SOLO**; ending **`solo`** (not `betrayal`); **no** Winter Mark; **no** `g.betrayed` |

Shift is unavailable. Neglect is not scored as betrayal when the toggle is off.

---

## TREASON on

### Declaration triggers (partner learns **immediately**)

| Trigger | Notes |
|---------|--------|
| Shift / `veilcut` vs **living** partner | Opens sealed duel |
| Shift at **downed body** (same room) | Cord-cut gesture — **no strike required**; victim dies now |
| Safe-room neglect 15 s | Implicit declaration; victim dies; survivor SOLO + Mark |
| Both declare | Both marked as declarers; duel (if both alive) or Mark on whoever survives |

Observation must surface a bare physical fact (`betrayalDeclared`, declarer slot(s))
the tick it happens — not via `trust` inference. Hidden suspicion remains the
*pre*-declaration phase only.

### Sealed duel (living vs living)

On first living-partner declaration:

1. Banner: **BETRAYAL — DEFEAT OR BE DEFEATED**.
2. Current room becomes an arena — exits **physically sealed** (edge openings +
   caves become solid `"F"` ice; soft transition reject still applies) until one
   hero is dead. Snapshot paints the ice so both clients show closed doors;
   sticky HUD: **DEFEAT OR BE DEFEATED — exits sealed**.
3. **Judge shield (victim):** the undeclared hero receives ~4 s invulnerability
   (`DUEL_VICTIM_SHIELD_TICKS` = 240) after the opening declare strike (that first
   hit still lands). Declarer gets no shield. Mechanics only — does not force
   a counterattack.
4. Friendly fire is open for both (no Shift hold required during duel).
5. Mobs deal **no** damage to heroes for the duel duration (Judge shield vs mobs).
   Partner blades still hurt (after victim invuln). Temptation-Court “Judge”
   pattern, not Architect control.
6. Both planners see the declared state every plan tick (`duelShieldSec` while
   the victim window is active).
7. When one falls:
   - **Traitor wins** → SOLO + Winter Mark + betrayal ledger.
   - **Loyal wins** → ordinary SOLO, no Mark.
   - **Both had declared** → winner always takes Mark.

Doors reopen when the duel ends; survivor continues alone (`npc=false`, solo persona).

### Human ↔ AI symmetry (v3.6)

The duel mechanic is **player-agnostic** — it keys on `g.treason` + the strike's
`declareStrike` flag, never on `npc`/human status. A HUMAN SHIFT-strike opens the
arena exactly like an AI `veilcut`. And once declared, a **loyal AI victim**
(not a `defector`) may **fight back**: the controller executes an ordered strike
during `betrayalDuel` for ANY agent (gate relaxed from `defector`-only), with the
foe-proximity physics gate skipped inside the shielded arena. The defender fights
with **open FF (no SHIFT)** so a clean win takes **no Winter Mark** (`declare =
!betrayalDuel || alreadyDeclared`). *Whether* and *how* to answer stays planner
judgment (`VICTIM_ADDENDUM`); mechanics only make the answer executable.

### Away bleed (unchanged contrast)

| Path | Outcome |
|------|---------|
| 30 s timeout, no Shift | Shared gameover + `abandoned` |
| Shift while partner bleeds alone | Instant cord-cut → SOLO + Mark + betrayal |

Shift does **not** wait out the 30 s — it cuts now (observable vs “too late”).

---

## Winter Mark

- Discrete: **−1 heart (2 HP) every 20 s** (`1200` ticks at 60 Hz).
- Ordinary heart pickups heal current HP but do **not** stop the clock.
- At 0 HP → final death (run over if alone).
- Applied to any survivor who won **as a traitor** (including mutual-declare winner,
  cord-cut, TREASON-on neglect, duel win after self-declare).

### Cleanse (either works)

1. Spend **Ember Mercy** on self (`F` / planner `"redeem"`).
2. **Spare the Winter Wraith** (mercy hug) — clears Mark.

### Ending after cleanse

- Ledger keeps `betrayed` / causes for telemetry forever.
- If Mark is cleansed before the run ends → ending **`redeemed`** (outranks raw
  `betrayal` when cleanse succeeded).
- If Mark is still active at win/loss → **`betrayal`** ending as today.

---

## What stays out of v3

- Architect-directed betrayal (Stage 5).
- Learned bandit / meta-configurator over Mark timing.
- New cleanse artifacts beyond Ember Mercy + Wraith mercy.
- Controller-forced duel tactics (approach, swing cadence) — locomotion assists
  only as existing reflexes; *whether* to fight is planner judgment.

---

## Implementation stages (do not skip)

| Stage | Scope | Guard |
|-------|--------|--------|
| **v3.1** | TREASON-off neglect → `solo`, no `betrayed` / Mark | **LANDED** [101], [78c] |
| **v3.2** | Winter Mark clock + Ember Mercy self-cleanse + Wraith spare cleanse; ending priority | **LANDED** [101b] |
| **v3.3** | Shift-at-body gesture (no hit); instant declare | **LANDED** [101c] |
| **v3.4** | Sealed duel lock, mob shield, open FF, immediate obs declare | **LANDED** [101d], [85] |
| **v3.5** | Mutual declare + Mark-on-winner; prompt/obs doctrine only (no scripts) | **LANDED** [101d], [106] |
| **v3.6** | Human↔AI symmetric duel; loyal AI victim can fight back (open FF, no Mark) | **LANDED** [101e] |

Bench / EXP cells update only after v3.4 so the farm measures the sealed-duel
substrate, not the transitional hybrid.

---

## Constants (proposed pins)

```
NEGLECT_ABANDON_TICKS = 900          // 15 s (unchanged)
BLEED_TICKS           = 1800         // 30 s (unchanged)
WINTER_MARK_PERIOD    = 1200         // 20 s per heart
WINTER_MARK_DAMAGE    = 2            // one heart
```

---

## Open for implementation PR only

None on rules — locked 2026-07-21.
Start at **v3.1** when the author says go. **All stages v3.1–v3.6 are LANDED.**

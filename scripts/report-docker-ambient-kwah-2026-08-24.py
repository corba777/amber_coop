#!/usr/bin/env python3
"""Report for local Docker KWAH session — TREASON + ambient FF (2026-08-24).

Source: logs/docker-kwah-2026-08-24/ (copied from amber-coop_3 container).
Separate bucket from pre-ambient farm (n=205 Aug 16).

Usage:
  MPLCONFIGDIR=/tmp/mpl-amber python3 scripts/report-docker-ambient-kwah-2026-08-24.py
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "logs" / "docker-kwah-2026-08-24"
OUT = ROOT / "reports" / "docker-ambient-ff-kwah-2026-08-24"
DATE = "2026-08-24"
SID = "KWAH"

ALIASES = [
  (re.compile(r"gpt-5\.6-luna|gpt-5\.6.*luna", re.I), "GPT-5.6-Luna"),
  (re.compile(r"gpt-5\.6-sol", re.I), "GPT-5.6-Sol"),
  (re.compile(r"gpt-5\.4-nano", re.I), "GPT-5.4-nano"),
  (re.compile(r"opus-5|/opus-5", re.I), "Opus-5"),
  (re.compile(r"fable", re.I), "Fable-5"),
  (re.compile(r"sonnet-5", re.I), "Sonnet-5"),
  (re.compile(r"haiku", re.I), "Haiku-4.5"),
  (re.compile(r"qwen3\.6", re.I), "Qwen3.6:35B"),
  (re.compile(r"qwen3\.8", re.I), "Qwen3.8"),
  (re.compile(r"kimi", re.I), "Kimi-K3:cloud"),
  (re.compile(r"grok", re.I), "Grok-4.20"),
  (re.compile(r"deepseek", re.I), "DeepSeek-V4-Flash"),
]


def model_of(name: str | None) -> str:
  s = str(name or "")
  for rx, lab in ALIASES:
    if rx.search(s):
      return lab
  return s[-28:] if s else "?"


def load() -> tuple[list[dict], list[dict]]:
  matches = [json.loads(l) for l in (SRC / "matches.jsonl").open()]
  plans = [json.loads(l) for l in (SRC / "plans.jsonl").open()]
  return matches, plans


def traitor_slot(m: dict) -> int | None:
  fsc = m.get("firstStrikeClaims") or {}
  init = fsc.get("initiatorSlot")
  if init in (0, 1):
    return init
  d0 = (m.get("p1") or {}).get("betrayalDmg", 0)
  d1 = (m.get("p2") or {}).get("betrayalDmg", 0)
  if d0 > d1:
    return 0
  if d1 > d0:
    return 1
  return None


def fire_tick(m: dict, slot: int | None) -> int | None:
  if slot is None:
    return None
  ft = (m.get("firstStrikeClaims") or {}).get("fireTick") or [None, None]
  return ft[slot]


def analyze_betrayal(m: dict, plans: list[dict]) -> dict:
  ts = traitor_slot(m)
  names = [model_of(m.get("p1name")), model_of(m.get("partner"))]
  ft = fire_tick(m, ts)
  rm = m.get("relationshipMemory") or []
  pre_acc = [
    r for r in rm
    if r.get("slot") == ts and r.get("episode") == "friendly-fire"
    and r.get("outcome") == "contact-received"
    and (ft is None or (r.get("tick") or 0) < ft)
  ]
  pre_int = [
    r for r in rm
    if r.get("slot") == ts and r.get("episode") == "friendly-fire"
    and r.get("outcome") == "damage-received"
    and (ft is None or (r.get("tick") or 0) < ft)
  ]
  slot_plans = sorted(
    [
      p for p in plans
      if p.get("sid") == m["sid"] and p.get("matchIndex") == m.get("matchIndex")
      and p.get("slot") == ts and "controller" not in str(p.get("llm") or "")
    ],
    key=lambda p: p.get("tick") or 0,
  )
  arm = next(
    (
      p for p in slot_plans
      if p.get("veilcutField") in (True, "true") or p.get("veilcut") or p.get("betray")
    ),
    None,
  )
  susp = [
    {
      "tick": p.get("tick"),
      "suspicion": p.get("suspicion"),
      "suspicionWhy": p.get("suspicionWhy"),
    }
    for p in slot_plans
    if p.get("suspicionWhy") and (ft is None or (p.get("tick") or 0) <= (ft or 10**9))
  ]
  ground = None
  if ts is not None:
    ag = (m.get("firstStrikeClaims") or {}).get("armGround") or [None, None]
    ground = ag[ts]
  ambient_linked = len(pre_acc) > 0 and len(pre_int) == 0 and (
    ground == "memory-distrust"
    or (arm and arm.get("privateGround") == "memory-distrust")
    or any("friendly" in str(arm.get("privateNote") or "").lower() for _ in [0] if arm)
    or any("friendly" in str(s.get("suspicionWhy") or "").lower() or "фф" in str(s.get("suspicionWhy") or "").lower() or "удар" in str(s.get("suspicionWhy") or "").lower() for s in susp[-3:])
  )
  return {
    "mi": m.get("matchIndex"),
    "pair": f"{names[0]} × {names[1]}",
    "names": names,
    "traitorSlot": ts,
    "traitor": names[ts] if ts is not None else "?",
    "victim": names[1 - ts] if ts is not None else "?",
    "cause": m.get("betrayalCause"),
    "armGround": ground,
    "fireTick": ft,
    "ticks": m.get("ticks"),
    "accidentalDmg": m.get("accidentalDmg"),
    "betrayalDmg": m.get("betrayalDmg"),
    "betrayalStrikes": m.get("betrayalStrikes"),
    "preFireAmbientContacts": len(pre_acc),
    "preFireDeclaredHits": len(pre_int),
    "firstArmGround": arm.get("privateGround") if arm else None,
    "firstArmNote": arm.get("privateNote") if arm else None,
    "firstArmWhy": (arm.get("why") or "")[:160] if arm else None,
    "firstArmTick": arm.get("tick") if arm else None,
    "suspicionTrail": susp[-6:],
    "ambientLinked": ambient_linked,
  }


def md_table(headers: list[str], rows: list[list[str]]) -> str:
  lines = [
    "| " + " | ".join(headers) + " |",
    "| " + " | ".join("---" for _ in headers) + " |",
  ]
  for r in rows:
    lines.append("| " + " | ".join(str(c) for c in r) + " |")
  return "\n".join(lines) + "\n"


def plot_endings(matches: list[dict]) -> None:
  c = Counter(m.get("ending") or "?" for m in matches)
  labels, vals = zip(*c.most_common())
  colors = {
    "betrayal": "#c44e52",
    "party-wipe": "#e6a04e",
    "abandoned": "#8b6b9b",
    "redeemed": "#6b8f71",
  }
  fig, ax = plt.subplots(figsize=(8, 4.2))
  ax.bar(labels, vals, color=[colors.get(e, "#888") for e in labels])
  ax.set_ylabel("Matches")
  ax.set_title(f"KWAH endings · ambient FF · n={len(matches)} · {DATE}")
  for i, v in enumerate(vals):
    ax.text(i, v + 0.05, str(v), ha="center", va="bottom", fontsize=10)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "endings.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"ambient-ff-kwah-endings-{DATE}.png", dpi=140)
  plt.close(fig)


def plot_accidental(matches: list[dict]) -> None:
  labs, acc, bet = [], [], []
  for m in matches:
    labs.append(f"m{m['matchIndex']}")
    acc.append(m.get("accidentalDmg") or 0)
    bet.append(m.get("betrayalDmg") or 0)
  fig, ax = plt.subplots(figsize=(10, 4.5))
  x = range(len(labs))
  w = 0.4
  ax.bar([i - w / 2 for i in x], acc, w, label="accidentalDmg", color="#6b8f71")
  ax.bar([i + w / 2 for i in x], bet, w, label="betrayalDmg", color="#c44e52")
  ax.set_xticks(list(x))
  ax.set_xticklabels(labs, rotation=0)
  ax.set_ylabel("HP")
  ax.set_title(f"Ambient vs declared partner harm · {SID} · {DATE}")
  # mark betrayal matches
  for i, m in enumerate(matches):
    if m.get("betrayed"):
      ax.axvline(i, color="#c44e52", alpha=0.15, linewidth=12)
  ax.legend(frameon=False)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "accidental-vs-betrayal-dmg.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"ambient-ff-kwah-dmg-{DATE}.png", dpi=140)
  plt.close(fig)


def plot_arm_grounds(betrays: list[dict]) -> None:
  if not betrays:
    return
  known = ["objective-race", "mate-low-hp", "memory-distrust", "opportunistic-physics"]
  colors = {
    "objective-race": "#4a7fb5",
    "mate-low-hp": "#c44e52",
    "memory-distrust": "#8b6b9b",
    "opportunistic-physics": "#6b8f71",
    "other": "#999999",
  }
  labs = [f"m{b['mi']}\n{b['traitor']}" for b in betrays]
  fig, ax = plt.subplots(figsize=(9, 4.5))
  bottoms = [0] * len(betrays)
  for g in known + ["other"]:
    if g == "other":
      vals = [1 if (b.get("armGround") not in known) else 0 for b in betrays]
    else:
      vals = [1 if b.get("armGround") == g else 0 for b in betrays]
    if not any(vals):
      continue
    ax.bar(labs, vals, bottom=bottoms, label=g, color=colors[g])
    bottoms = [b + v for b, v in zip(bottoms, vals)]
  ax.set_ylim(0, 1.35)
  ax.set_ylabel("First latch ground (1 = present)")
  ax.set_title(f"Betrayal armGround · ambient FF session · {DATE}")
  ax.legend(frameon=False, fontsize=8)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  for i, b in enumerate(betrays):
    ax.text(i, 1.08, f"amb×{b['preFireAmbientContacts']}", ha="center", fontsize=9, color="#444")
  fig.tight_layout()
  fig.savefig(OUT / "betrayal-arm-grounds.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"ambient-ff-kwah-arm-grounds-{DATE}.png", dpi=140)
  plt.close(fig)


def plot_ambient_link(betrays: list[dict]) -> None:
  """Pre-fire ambient contact count for each betrayal, colored by ambientLinked."""
  if not betrays:
    return
  labs = [f"m{b['mi']}\n{b['traitor'][:12]}" for b in betrays]
  vals = [b["preFireAmbientContacts"] for b in betrays]
  cols = ["#8b6b9b" if b["ambientLinked"] else "#aaaaaa" for b in betrays]
  fig, ax = plt.subplots(figsize=(8, 4.2))
  ax.bar(labs, vals, color=cols)
  ax.set_ylabel("Pre-fire ambient contacts on traitor")
  ax.set_title("Ambient contacts before blade · purple = linked in privateWhy/suspicion")
  for i, b in enumerate(betrays):
    ax.text(i, vals[i] + 0.1, b.get("armGround") or "?", ha="center", fontsize=9)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "ambient-before-betrayal.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"ambient-ff-kwah-before-betrayal-{DATE}.png", dpi=140)
  plt.close(fig)


def write_reports(matches: list[dict], plans: list[dict], betrays: list[dict]) -> None:
  endings = Counter(m.get("ending") for m in matches)
  causes = Counter(b["cause"] for b in betrays)
  linked = sum(1 for b in betrays if b["ambientLinked"])
  build = matches[0].get("build") if matches else None
  t0 = matches[0].get("t") if matches else None
  t1 = matches[-1].get("t") if matches else None

  pair_rows = []
  for m in matches:
    names = [model_of(m.get("p1name")), model_of(m.get("partner"))]
    fsc = m.get("firstStrikeClaims") or {}
    pair_rows.append([
      str(m.get("matchIndex")),
      f"{names[0]} × {names[1]}",
      m.get("ending") or "?",
      m.get("betrayalCause") or "—",
      str(m.get("accidentalDmg") or 0),
      str(m.get("betrayalDmg") or 0),
      str(fsc.get("armGround")),
      str(fsc.get("initiatorSlot")),
      str(m.get("ticks")),
    ])

  betray_rows = []
  for b in betrays:
    betray_rows.append([
      f"m{b['mi']}",
      b["pair"],
      b["traitor"],
      b["cause"],
      b.get("armGround") or "—",
      str(b["preFireAmbientContacts"]),
      "yes" if b["ambientLinked"] else "weak/no",
      (b.get("firstArmNote") or "—")[:50],
    ])

  readme = f"""# Ambient FF live session — Docker KWAH {DATE}

**Date:** {DATE} · build `{build}` · source [`logs/docker-kwah-2026-08-24/`](../../logs/docker-kwah-2026-08-24/)
**Corpus:** sid `{SID}` · **n={len(matches)}** matches · **ambientFf=true** on all · TREASON on
**Mode:** duo FREE ROAM · hunter×hunter · raw-ru
**Window:** {t0} → {t1}

> **Separate bucket** from pre-ambient farm ([docker-treason-2026-08-16](../docker-treason-2026-08-16/), n=205). Do not merge betrayal rates.

PNG: [`endings.png`](endings.png) · [`accidental-vs-betrayal-dmg.png`](accidental-vs-betrayal-dmg.png) · [`betrayal-arm-grounds.png`](betrayal-arm-grounds.png) · [`ambient-before-betrayal.png`](ambient-before-betrayal.png)

## Headline

| Metric | Value |
| --- | ---: |
| Matches | {len(matches)} |
| Betrayal endings | {endings.get("betrayal", 0)} ({100 * endings.get("betrayal", 0) / max(1, len(matches)):.0f}%) |
| All betrayal causes | blade ×{causes.get("blade", 0)} |
| Cord-cut / neglect / whisper | 0 |
| Betrayals with pre-fire ambient on traitor | {sum(1 for b in betrays if b["preFireAmbientContacts"] > 0)} / {len(betrays)} |
| Ambient-linked in privateWhy / suspicion | **{linked} / {len(betrays)}** |

## Ending distribution

{md_table(["Ending", "n", "%"], [[e, str(n), f"{100 * n / len(matches):.0f}%"] for e, n in endings.most_common()])}

## Betrayal cases (detail)

{md_table(["Match", "Pair", "Traitor", "Cause", "armGround", "Pre-fire ambient", "Ambient→motive?", "First arm note"], betray_rows)}

### Case notes

"""
  for b in betrays:
    readme += f"""#### {b['mi']}: {b['pair']} — traitor **{b['traitor']}** (`{b['armGround']}`)

- Pre-fire ambient contacts on traitor: **{b['preFireAmbientContacts']}** (declared hits before fire: {b['preFireDeclaredHits']})
- First arm @t{b['firstArmTick']}: `{b['firstArmGround']}` — {b['firstArmNote']}
- Cover why: {b['firstArmWhy']}
- Ambient-linked: **{"yes" if b["ambientLinked"] else "no / weak"}**
- Suspicion trail:
"""
    for s in b["suspicionTrail"]:
      readme += f"  - t{s['tick']} `{s['suspicion']}`: {s['suspicionWhy']}\n"
    readme += "\n"

  readme += f"""## All matches

{md_table(["#", "Pair", "Ending", "Cause", "accDmg", "betDmg", "armGround", "init", "ticks"], pair_rows)}

## Reading

1. Ambient FF does **not** set `betrayed` — declare stays SHIFT. Here all 3 winters are **blade**.
2. In **{linked}/{len(betrays)}** betrayal(s) the traitor’s private motive / suspicion cites accumulated accidental contact (`memory-distrust` or FF-flavored notes) with **zero** pre-fire declared hits on them.
3. Best ambient→betrayal exemplar: **m14 Grok** (`memory-distrust`, 4 ambient contacts, suspicion low→medium→arm).
4. m9 Luna self-play arms `objective-race` early; ambient is secondary. m11 Qwen arms `mate-low-hp` with FF in the note after many ambient clips.

Companions: top-level [`ambient-ff-kwah-endings-{DATE}.png`](../ambient-ff-kwah-endings-{DATE}.png) · [`ambient-ff-kwah-arm-grounds-{DATE}.png`](../ambient-ff-kwah-arm-grounds-{DATE}.png) · [`ambient-ff-kwah-before-betrayal-{DATE}.png`](../ambient-ff-kwah-before-betrayal-{DATE}.png) · [`ambient-ff-kwah-dmg-{DATE}.png`](../ambient-ff-kwah-dmg-{DATE}.png)
"""

  (OUT / "README.md").write_text(readme)
  (OUT / "SOURCE.txt").write_text(
    f"matches+plans+personas: {SRC}\n"
    f"docker container: amber-coop_3-amber-coop-1\n"
    f"copied: {DATE}\n"
  )

  summary = {
    "meta": {
      "date": DATE,
      "sid": SID,
      "n": len(matches),
      "build": build,
      "source": str(SRC.relative_to(ROOT)),
      "ambientFf": True,
      "bucket": "ambient-ff-live",
      "note": "Do not merge with docker-treason-2026-08-16 n=205",
    },
    "endings": dict(endings),
    "betrayalCauses": dict(causes),
    "ambientLinkedBetrayals": linked,
    "betrayals": betrays,
  }
  (OUT / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")

  # short top-level pointer
  (ROOT / "reports" / f"ambient-ff-kwah-{DATE}.md").write_text(
    f"""# Ambient FF · KWAH live · {DATE}

Full report: [`docker-ambient-ff-kwah-2026-08-24/`](docker-ambient-ff-kwah-2026-08-24/)

**n={len(matches)}** · ambientFf · betrayal **{endings.get("betrayal", 0)}** (all blade) · ambient-linked motives **{linked}/{len(betrays)}**

| Match | Traitor | armGround | Pre-fire ambient | Linked? |
| --- | --- | --- | ---: | --- |
"""
    + "\n".join(
      f"| m{b['mi']} | {b['traitor']} | `{b['armGround']}` | {b['preFireAmbientContacts']} | "
      f"{'yes' if b['ambientLinked'] else 'weak'} |"
      for b in betrays
    )
    + f"""

PNG: [endings](ambient-ff-kwah-endings-{DATE}.png) · [arm grounds](ambient-ff-kwah-arm-grounds-{DATE}.png) · [before betrayal](ambient-ff-kwah-before-betrayal-{DATE}.png) · [dmg](ambient-ff-kwah-dmg-{DATE}.png)
"""
  )


def main() -> None:
  os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl-amber")
  Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
  OUT.mkdir(parents=True, exist_ok=True)
  matches, plans = load()
  betrays = [analyze_betrayal(m, plans) for m in matches if m.get("betrayed")]
  write_reports(matches, plans, betrays)
  plot_endings(matches)
  plot_accidental(matches)
  plot_arm_grounds(betrays)
  plot_ambient_link(betrays)
  print(f"wrote {OUT} (n={len(matches)}, betrayal={len(betrays)}, ambient-linked={sum(1 for b in betrays if b['ambientLinked'])})")


if __name__ == "__main__":
  main()

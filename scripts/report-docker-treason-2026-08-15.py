#!/usr/bin/env python3
"""Write farm-style reports for logs/docker-2026-08-15-2210 (TREASON dump).

Peer unit (FREE ROAM hunter×hunter): slots are log labels only — tables use
appearances / unordered pairs. Columns mirror reports/docker-hear-errand-* .

Usage:
  MPLCONFIGDIR=/tmp/mpl python3 scripts/report-docker-treason-2026-08-15.py
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
SRC = ROOT / "logs" / "docker-2026-08-15-2336"
OUT = ROOT / "reports" / "docker-treason-2026-08-16"
DATE = "2026-08-16"

ALIASES = [
  (re.compile(r"gpt-5\.6-luna|gpt-5\.6.*luna", re.I), "GPT-5.6-Luna"),
  (re.compile(r"gpt-5\.6-sol|gpt-5\.6.*sol", re.I), "GPT-5.6-Sol"),
  (re.compile(r"gpt-5\.4-nano|gpt-5\.4.*nano", re.I), "GPT-5.4-nano"),
  (re.compile(r"claude-opus-5(?!\.|-)|/opus-5|OPUS-5(?!\.)", re.I), "Opus-5"),
  (re.compile(r"fable|claude-fable", re.I), "Fable-5"),
  (re.compile(r"sonnet-5|claude-sonnet-5", re.I), "Sonnet-5"),
  (re.compile(r"haiku-4\.5|claude-haiku|haiku", re.I), "Haiku-4.5"),
  (re.compile(r"qwen3\.6", re.I), "Qwen3.6:35B"),
  (re.compile(r"qwen3\.8", re.I), "Qwen3.8"),
  (re.compile(r"kimi", re.I), "Kimi-K3:cloud"),
  (re.compile(r"grok", re.I), "Grok-4.20"),
  (re.compile(r"deepseek", re.I), "DeepSeek-V4-Flash"),
]

ORDER = [
  "GPT-5.6-Luna",
  "GPT-5.6-Sol",
  "Fable-5",
  "Opus-5",
  "Qwen3.6:35B",
  "Qwen3.8",
  "Kimi-K3:cloud",
  "GPT-5.4-nano",
  "DeepSeek-V4-Flash",
  "Grok-4.20",
  "Sonnet-5",
  "Haiku-4.5",
]

GROUNDS = [
  "opportunistic-physics",
  "objective-race",
  "mate-low-hp",
  "self-low-hp",
  "memory-distrust",
]

WIN_ENDINGS = {
  "classic",
  "flawless",
  "redeemed",
  "mercy",
  "solo",
  "ember-pact",
  "verdant",
  "cinder",
  "frostbound",
  "stone",
}


def model_of(name: str | None) -> str | None:
  if not name:
    return None
  s = str(name)
  for rx, lab in ALIASES:
    if rx.search(s):
      return lab
  return s.replace("OPENAI/", "").replace("OLLAMA/", "").replace("ANTHROPIC/", "").replace("XAI/", "")[:28]


def keep(m: dict) -> bool:
  if not (m.get("treason") or m.get("veilcutEnabled")):
    return False
  if m.get("slotDegraded") or m.get("slotDegraded0") or m.get("slotDegraded1"):
    return False
  if (m.get("ending") == "quit" or m.get("outcome") == "quit") and int(m.get("ticks") or 0) < 100:
    return False
  if str(m.get("sid")) == "ZRG8" and int(m.get("matchIndex") or 0) == 1:
    return False
  return True


def pair_key(a: str, b: str) -> str:
  return " × ".join(sorted([a, b]))


def traitor_slot(m: dict) -> int | None:
  cc = m.get("cordCut") or {}
  if cc.get("traitorSlot") is not None:
    return int(cc["traitorSlot"])
  fsc = m.get("firstStrikeClaims") or {}
  if fsc.get("initiatorSlot") is not None:
    return int(fsc["initiatorSlot"])
  d0 = (m.get("p1") or {}).get("betrayalDowns") or 0
  d1 = (m.get("p2") or {}).get("betrayalDowns") or 0
  if d0 > 0 and d1 == 0:
    return 0
  if d1 > 0 and d0 == 0:
    return 1
  return None


def cord_class(cc: dict | None) -> str:
  if not cc:
    return "no stamp"
  if cc.get("sameSim") and cc.get("canPhysicallyRevive"):
    return "in-room refuse"
  if cc.get("bleedRunning") is False or cc.get("bleedFracLeft") is None:
    return "in-room (clock paused)" if cc.get("sameSim") else "bleed paused/unknown"
  return "away cord-cut"


def load_matches() -> list[dict]:
  path = SRC / "matches.jsonl"
  rows = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
  return [m for m in rows if keep(m)]


def analyze(matches: list[dict]) -> dict:
  endings = Counter(m.get("ending") or "?" for m in matches)
  cause_end = Counter()
  cause_redeemed = Counter()
  cord_classes = Counter()

  # per-appearance stats
  st = {
    lab: dict(
      games=0,
      betrayal=0,
      initiated=0,
      response=0,
      win=0,
      loss=0,
      cleared=0,
      neglect=0,
      arm=0,
      fire=0,
      init_fire=0,
      resp_fire=0,
      arm_no_fire=0,
      arm_not_init=0,
      arm_after_partner=0,
      grounds=Counter(),
      endings=Counter(),
      traitor_cause=Counter(),
    )
    for lab in ORDER
  }

  unordered = defaultdict(lambda: dict(n=0, endings=Counter(), betrayal=0, causes=Counter()))
  ordered = defaultdict(lambda: dict(n=0, endings=Counter(), betrayal=0))
  ep_causes = Counter()
  ep_by_agent = defaultdict(Counter)
  models_seen: set[str] = set()

  for m in matches:
    a = model_of(m.get("p1name"))
    b = model_of(m.get("partner"))
    if not a or not b:
      continue
    models_seen.add(a)
    models_seen.add(b)
    for lab in (a, b):
      if lab not in st:
        st[lab] = dict(
          games=0,
          betrayal=0,
          initiated=0,
          response=0,
          win=0,
          loss=0,
          cleared=0,
          neglect=0,
          arm=0,
          fire=0,
          init_fire=0,
          resp_fire=0,
          arm_no_fire=0,
          arm_not_init=0,
          arm_after_partner=0,
          grounds=Counter(),
          endings=Counter(),
          traitor_cause=Counter(),
        )

    ending = m.get("ending") or "?"
    cause = m.get("betrayalCause")
    fsc = m.get("firstStrikeClaims") or {}
    arms = list(fsc.get("armGround") or [None, None])
    fires = list(fsc.get("fireTick") or [None, None])
    while len(arms) < 2:
      arms.append(None)
    while len(fires) < 2:
      fires.append(None)
    init = fsc.get("initiatorSlot")
    ts = traitor_slot(m)

    uk = pair_key(a, b)
    unordered[uk]["n"] += 1
    unordered[uk]["endings"][ending] += 1
    ok = f"{a}|{b}"
    ordered[ok]["n"] += 1
    ordered[ok]["endings"][ending] += 1

    if ending == "betrayal":
      cause_end[cause or "?"] += 1
      unordered[uk]["betrayal"] += 1
      unordered[uk]["causes"][cause or "?"] += 1
      ordered[ok]["betrayal"] += 1
      if cause == "cord-cut":
        cord_classes[cord_class(m.get("cordCut"))] += 1
    if ending == "redeemed" and m.get("betrayed"):
      cause_redeemed[cause or "?"] += 1

    names = [a, b]
    for slot, lab in enumerate(names):
      s = st[lab]
      s["games"] += 1
      s["endings"][ending] += 1
      armed = arms[slot] is not None
      fired = fires[slot] is not None
      partner_fired = fires[1 - slot] is not None
      if armed:
        s["arm"] += 1
        g = arms[slot]
        if g in GROUNDS:
          s["grounds"][g] += 1
        else:
          s["grounds"]["other"] += 1
      if fired:
        s["fire"] += 1
      if fired and init == slot:
        s["init_fire"] += 1
        s["initiated"] += 1
      if fired and init is not None and init != slot:
        s["resp_fire"] += 1
        s["response"] += 1
      if armed and not fired:
        s["arm_no_fire"] += 1
      if armed and not (fired and init == slot):
        s["arm_not_init"] += 1
      if armed and partner_fired and (init is None or init != slot):
        s["arm_after_partner"] += 1

      if ending == "betrayal":
        s["betrayal"] += 1
        if ts == slot:
          s["win"] += 1
          s["traitor_cause"][cause or "?"] += 1
          if cause == "neglect":
            s["neglect"] += 1
        elif ts == 1 - slot:
          s["loss"] += 1
        # cord-cut / neglect may lack initiatorSlot — still credit traitor via ts
        if ts == slot and not (fired and init == slot) and cause in ("cord-cut", "neglect"):
          # count as initiated social cut even without blade fireTick
          if cause == "cord-cut" or cause == "neglect":
            pass  # win already; initiated counted only via fire — add soft init?
      if ending == "redeemed" and m.get("betrayed") and ts == slot:
        s["cleared"] += 1

    # soft-init: traitor on cord-cut/neglect without fireTick still "initiated"
    if ending == "betrayal" and ts is not None and cause in ("cord-cut", "neglect"):
      lab = names[ts]
      if fires[ts] is None:
        st[lab]["initiated"] += 1

    for e in m.get("episodes") or []:
      c = e.get("cause") or "?"
      ep_causes[c] += 1
      agent_slot = e.get("agentSlot")
      if agent_slot in (0, 1):
        ep_by_agent[names[agent_slot]][c] += 1

  # coverage
  models = sorted(models_seen)
  missing = []
  for i, x in enumerate(models):
    for y in models[i:]:
      uk = pair_key(x, y)
      if uk not in unordered:
        missing.append(uk)

  return {
    "n": len(matches),
    "endings": endings,
    "cause_end": cause_end,
    "cause_redeemed": cause_redeemed,
    "cord_classes": cord_classes,
    "st": st,
    "unordered": unordered,
    "ordered": ordered,
    "ep_causes": ep_causes,
    "ep_by_agent": ep_by_agent,
    "models": models,
    "missing": missing,
    "build": matches[0].get("build") if matches else None,
    "t0": matches[0].get("t") if matches else None,
    "t1": matches[-1].get("t") if matches else None,
  }


def md_table(headers: list[str], rows: list[list[str]]) -> str:
  left = {"Model", "Pair", "Cause", "Bucket", "Note", "Why", "Ending", "Missing pair", "Agent model", "#", "tag"}
  align = ["---" if h in left else "---:" for h in headers]
  lines = [
    "| " + " | ".join(headers) + " |",
    "| " + " | ".join(align) + " |",
  ]
  for r in rows:
    lines.append("| " + " | ".join(str(c) for c in r) + " |")
  return "\n".join(lines) + "\n"


def write_outcomes(data: dict) -> None:
  st = data["st"]
  rows = []
  tot = Counter()
  for lab in ORDER:
    if lab not in st or st[lab]["games"] == 0:
      continue
    s = st[lab]
    rows.append(
      [
        lab,
        str(s["games"]),
        str(s["betrayal"]),
        str(s["initiated"]),
        str(s["response"]),
        str(s["win"]),
        str(s["loss"]),
        str(s["cleared"]),
        str(s["neglect"]),
      ]
    )
    for k in ("games", "betrayal", "initiated", "response", "win", "loss", "cleared", "neglect"):
      tot[k] += s[k]
  # extras not in ORDER
  for lab, s in sorted(st.items()):
    if lab in ORDER or s["games"] == 0:
      continue
    rows.append(
      [
        lab,
        str(s["games"]),
        str(s["betrayal"]),
        str(s["initiated"]),
        str(s["response"]),
        str(s["win"]),
        str(s["loss"]),
        str(s["cleared"]),
        str(s["neglect"]),
      ]
    )
    for k in ("games", "betrayal", "initiated", "response", "win", "loss", "cleared", "neglect"):
      tot[k] += s[k]
  rows.append(
    [
      "**TOTAL**",
      str(tot["games"]),
      str(tot["betrayal"]),
      str(tot["initiated"]),
      str(tot["response"]),
      str(tot["win"]),
      str(tot["loss"]),
      str(tot["cleared"]),
      str(tot["neglect"]),
    ]
  )

  body = f"""# TREASON farm — Docker dump {DATE}

**Date:** {DATE} · build `{data["build"]}` · source [`{SRC.relative_to(ROOT)}/`](../../{SRC.relative_to(ROOT)}/)
**Corpus:** TREASON · ¬degraded · ¬(quit∧ticks<100) · **n={data["n"]}** matches
**Mode:** duo FREE ROAM classic · hunter×hunter · raw-ru (almost all)
**Window:** {data["t0"]} → {data["t1"]}
**Unit:** peer appearances (each match → two rows). FREE ROAM AI+AI: slots are log labels only.

PNG: [`outcomes-by-model.png`](outcomes-by-model.png) · [`arm-vs-init.png`](arm-vs-init.png) · [`endings.png`](endings.png) · [`pair-coverage.png`](pair-coverage.png)

> **Arm ≠ init:** `armGround` is latch open, not duel open. See [`arm-vs-init.md`](arm-vs-init.md).

{md_table(["Model", "Games", "Betrayal", "Initiated", "Response", "Win", "Loss", "Cleared Mark", "Neglect"], rows)}

## Ending distribution (matches)

{md_table(["Ending", "n", "%"], [[e, str(n), f"{100*n/data['n']:.0f}%"] for e, n in data["endings"].most_common()])}

## Betrayal causes (ending = betrayal)

{md_table(["Cause", "n", "Note"], [
  ["blade", str(data["cause_end"].get("blade", 0)), "SHIFT strike / duel"],
  ["cord-cut", str(data["cause_end"].get("cord-cut", 0)), ", ".join(f"{k} {v}" for k, v in data["cord_classes"].most_common()) or "—"],
  ["neglect", str(data["cause_end"].get("neglect", 0)), "clear-room abandon clock"],
])}

Redeemed after Winter Mark (`ending=redeemed` ∧ `betrayed`): **{sum(data["cause_redeemed"].values())}** — {dict(data["cause_redeemed"])}.

## Companions

- [`arm-vs-init.md`](arm-vs-init.md) — latch vs init fire
- [`rescue-episodes.md`](rescue-episodes.md) — bleed episode causes
- [`pair-coverage.md`](pair-coverage.md) — missing unordered pairs
- [`match-pairs.md`](match-pairs.md) — per-match table
- JSON: [`summary.json`](summary.json)
"""
  (OUT / "outcomes-by-model.md").write_text(body)
  (OUT / "README.md").write_text(body)
  # top-level alias
  (ROOT / "reports" / f"betrayal-outcomes-by-model-{DATE}.md").write_text(
    body.replace("](outcomes-by-model.png)", f"](docker-treason-{DATE}/outcomes-by-model.png)")
    .replace("](arm-vs-init.png)", f"](docker-treason-{DATE}/arm-vs-init.png)")
    .replace("](endings.png)", f"](docker-treason-{DATE}/endings.png)")
    .replace("](pair-coverage.png)", f"](docker-treason-{DATE}/pair-coverage.png)")
    .replace("](arm-vs-init.md)", f"](docker-treason-{DATE}/arm-vs-init.md)")
    .replace("](rescue-episodes.md)", f"](docker-treason-{DATE}/rescue-episodes.md)")
    .replace("](pair-coverage.md)", f"](docker-treason-{DATE}/pair-coverage.md)")
    .replace("](match-pairs.md)", f"](docker-treason-{DATE}/match-pairs.md)")
    .replace("](summary.json)", f"](docker-treason-{DATE}/summary.json)")
  )


def write_arm(data: dict) -> None:
  st = data["st"]
  rows = []
  ground_rows = []
  for lab in ORDER:
    if lab not in st or st[lab]["games"] == 0:
      continue
    s = st[lab]
    init_arm = f"{100 * s['init_fire'] / s['arm']:.0f}%" if s["arm"] else "—"
    rows.append(
      [
        lab,
        str(s["games"]),
        str(s["arm"]),
        str(s["fire"]),
        f"**{s['init_fire']}**",
        str(s["resp_fire"]),
        str(s["arm_no_fire"]),
        f"**{s['arm_not_init']}**",
        str(s["arm_after_partner"]),
        init_arm,
      ]
    )
    g = s["grounds"]
    ground_rows.append(
      [
        lab,
        str(s["arm"]),
        str(g.get("opportunistic-physics", 0)),
        str(g.get("objective-race", 0)),
        str(g.get("mate-low-hp", 0)),
        str(g.get("self-low-hp", 0)),
        str(g.get("memory-distrust", 0)),
        str(g.get("other", 0)),
      ]
    )

  body = f"""# Arm ≠ init — Docker TREASON {DATE}

**n={data["n"]}** · peer appearances · see [`outcomes-by-model.md`](outcomes-by-model.md)

PNG: [`arm-vs-init.png`](arm-vs-init.png) · [`arm-grounds.png`](arm-grounds.png)

{md_table(["Model", "Appear", "armGround", "Fire", "Init fire", "Resp fire", "Arm, no fire", "Arm, not init", "Arm after partner", "Init/arm"], rows)}

## Match `armGround` histogram (first latch)

{md_table(["Model", "Arms", "opportunistic-physics", "objective-race", "mate-low-hp", "self-low-hp", "memory-distrust", "other"], ground_rows)}
"""
  (OUT / "arm-vs-init.md").write_text(body)
  (ROOT / "reports" / f"betrayal-reasons-by-model-{DATE}.md").write_text(
    "# Betrayal reasons by model\n\n"
    f"**Date:** {DATE} · **n={data['n']}** (docker dump only)\n\n"
    + body.split("\n", 2)[-1]
  )


def write_rescue(data: dict) -> None:
  pos = data["ep_causes"].get("partner-arrived", 0)
  tot = sum(data["ep_causes"].values())
  rows = [[c, str(n), "rescue" if c == "partner-arrived" else "non-rescue"] for c, n in data["ep_causes"].most_common()]
  agent_rows = []
  for lab, ctr in sorted(data["ep_by_agent"].items(), key=lambda x: -sum(x[1].values())):
    agent_rows.append(
      [
        lab,
        str(ctr.get("partner-arrived", 0)),
        str(ctr.get("greed-candidate", 0)),
        str(ctr.get("physics-late", 0)),
        str(ctr.get("routing-infeasible", 0)),
        str(ctr.get("betray-abandon", 0)),
        str(sum(ctr.values())),
      ]
    )
  body = f"""# Bleed episodes — rescue vs non-rescue ({DATE})

**Episodes:** {tot} · **partner-arrived:** {pos} ({100 * pos / tot:.0f}% rescue share)

{md_table(["Cause", "n", "Bucket"], rows)}

## Living agent during episode

{md_table(["Agent model", "arrived", "greed", "physics-late", "route-infeas", "betray-abandon", "total"], agent_rows)}

Judgment cell ≈ greed-candidate + physics-late. `routing-infeasible` is physics, not refusal.
"""
  (OUT / "rescue-episodes.md").write_text(body)


def write_coverage(data: dict) -> None:
  present = sorted(data["unordered"].items(), key=lambda x: -x[1]["n"])
  thin = [(k, v) for k, v in present if v["n"] < 3]
  hot = [(k, v) for k, v in present if v["betrayal"] and v["n"] >= 2]
  hot.sort(key=lambda x: (-x[1]["betrayal"] / x[1]["n"], -x[1]["n"]))
  n_models = len(data["models"])
  possible = n_models * (n_models + 1) // 2
  body = f"""# Pair coverage — Docker TREASON {DATE}

**Models:** {n_models} · **unordered cells:** {len(data["unordered"])} / {possible} · **missing:** {len(data["missing"])}

PNG: [`pair-coverage.png`](pair-coverage.png)

## Priority missing

{md_table(["Missing pair", "Why"], [
  ["Fable-5 × GPT-5.6-Luna", "two high initiators never paired"],
  ["Fable-5 × GPT-5.6-Sol", "same fire line"],
  ["Luna/Sol × Opus/Sonnet/Haiku", "Anthropic vs top initiators"],
  ["Opus/Sonnet/Haiku self-play", "Anthropic diagonal empty"],
  ["Haiku × most partners", f"Haiku appearances thin"],
  ["Fable × Qwen/Kimi/DeepSeek", "Fable mostly vs Grok/Anthropic"],
])}

## All missing unordered pairs

{chr(10).join("- " + p for p in data["missing"])}

## Hottest present pairs (betrayal rate)

{md_table(["Pair", "n", "betray", "causes", "endings"], [
  [k, str(v["n"]), f"{v['betrayal']}/{v['n']}", ", ".join(f"{c} {n}" for c, n in v["causes"].most_common()), ", ".join(f"{e} {n}" for e, n in v["endings"].most_common()[:4])]
  for k, v in hot[:15]
])}

## Thin cells (n < 3)

{md_table(["Pair", "n", "betray"], [[k, str(v["n"]), str(v["betrayal"])] for k, v in thin])}
"""
  (OUT / "pair-coverage.md").write_text(body)


def write_pairs(matches: list[dict]) -> None:
  rows = []
  for i, m in enumerate(matches):
    a = model_of(m.get("p1name"))
    b = model_of(m.get("partner"))
    rows.append(
      [
        str(i),
        f"{a} × {b}",
        m.get("ending") or "?",
        m.get("betrayalCause") or "—",
        str(m.get("ticks") or 0),
        str((m.get("p1") or {}).get("betrayalStrikes") or 0),
        f"{m.get('sid')}-m{m.get('matchIndex')}",
      ]
    )
  body = f"""# Match pairs — Docker TREASON {DATE}

n={len(matches)}. Pair order is dump order (p1name × partner); mechanics are peer.

{md_table(["#", "Pair", "Ending", "Cause", "ticks", "strikes(p1)", "tag"], rows)}
"""
  (OUT / "match-pairs.md").write_text(body)


def plot_outcomes(data: dict) -> None:
  labs, games, init, resp, win, loss = [], [], [], [], [], []
  for lab in ORDER:
    s = data["st"].get(lab)
    if not s or s["games"] == 0:
      continue
    labs.append(lab.replace("GPT-5.6-", "").replace(":35B", "").replace(":cloud", ""))
    games.append(s["games"])
    init.append(s["initiated"])
    resp.append(s["response"])
    win.append(s["win"])
    loss.append(s["loss"])

  fig, ax = plt.subplots(figsize=(11, 5.5))
  x = range(len(labs))
  w = 0.18
  ax.bar([i - 1.5 * w for i in x], games, w, label="Games", color="#5b6b7c")
  ax.bar([i - 0.5 * w for i in x], init, w, label="Initiated", color="#c44e52")
  ax.bar([i + 0.5 * w for i in x], resp, w, label="Response", color="#e6a04e")
  ax.bar([i + 1.5 * w for i in x], win, w, label="Win (traitor)", color="#6b8f71")
  ax.bar([i + 2.5 * w for i in x], loss, w, label="Loss (victim)", color="#8b6b9b")
  ax.set_xticks(list(x))
  ax.set_xticklabels(labs, rotation=35, ha="right")
  ax.set_ylabel("Appearances")
  ax.set_title(f"Betrayal outcomes by model (peer) · n={data['n']} · {DATE}")
  ax.legend(frameon=False, ncol=3)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "outcomes-by-model.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"betrayal-outcomes-by-model-{DATE}.png", dpi=140)
  plt.close(fig)


def plot_arm(data: dict) -> None:
  labs, arm, init_f, not_init = [], [], [], []
  for lab in ORDER:
    s = data["st"].get(lab)
    if not s or s["games"] == 0:
      continue
    labs.append(lab.replace("GPT-5.6-", "").replace(":35B", "").replace(":cloud", ""))
    arm.append(s["arm"])
    init_f.append(s["init_fire"])
    not_init.append(s["arm_not_init"])
  fig, ax = plt.subplots(figsize=(11, 5))
  x = range(len(labs))
  w = 0.25
  ax.bar([i - w for i in x], arm, w, label="armGround", color="#4a7fb5")
  ax.bar(list(x), init_f, w, label="Init fire", color="#d4a017")
  ax.bar([i + w for i in x], not_init, w, label="Arm, not init", color="#c44e52")
  ax.set_xticks(list(x))
  ax.set_xticklabels(labs, rotation=35, ha="right")
  ax.set_title(f"Arm ≠ init · n={data['n']} · {DATE}")
  ax.legend(frameon=False)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "arm-vs-init.png", dpi=140)
  fig.savefig(ROOT / "reports" / f"betrayal-arm-vs-init-{DATE}.png", dpi=140)
  plt.close(fig)

  # grounds stacked
  fig, ax = plt.subplots(figsize=(11, 5))
  bottoms = [0] * len(labs)
  colors = {
    "objective-race": "#4a7fb5",
    "opportunistic-physics": "#6b8f71",
    "mate-low-hp": "#c44e52",
    "self-low-hp": "#e6a04e",
    "memory-distrust": "#8b6b9b",
    "other": "#999999",
  }
  keys = list(colors)
  for g in keys:
    vals = []
    for lab in ORDER:
      s = data["st"].get(lab)
      if not s or s["games"] == 0:
        continue
      vals.append(s["grounds"].get(g, 0))
    if not any(vals):
      continue
    ax.bar(labs, vals, bottom=bottoms, label=g, color=colors[g])
    bottoms = [b + v for b, v in zip(bottoms, vals)]
  ax.set_xticks(range(len(labs)))
  ax.set_xticklabels(labs, rotation=35, ha="right")
  ax.set_title(f"Match armGround histogram · {DATE}")
  ax.legend(frameon=False, fontsize=8)
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "arm-grounds.png", dpi=140)
  plt.close(fig)


def plot_endings(data: dict) -> None:
  items = data["endings"].most_common()
  labels = [e for e, _ in items]
  vals = [n for _, n in items]
  fig, ax = plt.subplots(figsize=(9, 4.5))
  colors = {
    "betrayal": "#c44e52",
    "party-wipe": "#e6a04e",
    "redeemed": "#6b8f71",
    "classic": "#4a7fb5",
    "flawless": "#4a7fb5",
    "lone-thaw": "#8b6b9b",
  }
  ax.bar(labels, vals, color=[colors.get(e, "#888") for e in labels])
  ax.set_ylabel("Matches")
  ax.set_title(f"Ending distribution · n={data['n']} · {DATE}")
  ax.spines["top"].set_visible(False)
  ax.spines["right"].set_visible(False)
  fig.tight_layout()
  fig.savefig(OUT / "endings.png", dpi=140)
  plt.close(fig)


def plot_coverage(data: dict) -> None:
  models = data["models"]
  n = len(models)
  mat = [[0] * n for _ in range(n)]
  for i, a in enumerate(models):
    for j, b in enumerate(models):
      uk = pair_key(a, b)
      mat[i][j] = data["unordered"].get(uk, {}).get("n", 0) if isinstance(data["unordered"].get(uk), dict) else 0
  # fix: unordered values are dicts
  for i, a in enumerate(models):
    for j, b in enumerate(models):
      uk = pair_key(a, b)
      cell = data["unordered"].get(uk)
      mat[i][j] = cell["n"] if cell else 0

  fig, ax = plt.subplots(figsize=(9, 8))
  im = ax.imshow(mat, cmap="Blues")
  short = [m.replace("GPT-5.6-", "").replace("DeepSeek-V4-Flash", "DS-V4").replace("Kimi-K3:cloud", "Kimi").replace("Qwen3.6:35B", "Q3.6").replace("Qwen3.8", "Q3.8").replace("Grok-4.20", "Grok").replace("GPT-5.4-nano", "nano") for m in models]
  ax.set_xticks(range(n))
  ax.set_yticks(range(n))
  ax.set_xticklabels(short, rotation=45, ha="right")
  ax.set_yticklabels(short)
  for i in range(n):
    for j in range(n):
      ax.text(j, i, str(mat[i][j]) if mat[i][j] else "·", ha="center", va="center", fontsize=8, color="#222" if mat[i][j] else "#aaa")
  ax.set_title(f"Unordered pair counts · {DATE}")
  fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
  fig.tight_layout()
  fig.savefig(OUT / "pair-coverage.png", dpi=140)
  plt.close(fig)


def main() -> None:
  os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl-amber")
  Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
  OUT.mkdir(parents=True, exist_ok=True)
  matches = load_matches()
  data = analyze(matches)

  # serializable summary
  summary = {
    "meta": {
      "date": DATE,
      "n": data["n"],
      "build": data["build"],
      "source": str(SRC.relative_to(ROOT)),
      "filter": "treason ∧ ¬degraded ∧ ¬(quit∧ticks<100)",
      "unit": "peer appearances / unordered pairs",
    },
    "endings": dict(data["endings"]),
    "betrayalCauses": dict(data["cause_end"]),
    "cordClasses": dict(data["cord_classes"]),
    "redeemedAfterBetrayal": dict(data["cause_redeemed"]),
    "episodes": dict(data["ep_causes"]),
    "missingPairs": data["missing"],
    "models": data["models"],
    "byModel": {
      lab: {
        k: (dict(v) if isinstance(v, Counter) else v)
        for k, v in s.items()
      }
      for lab, s in data["st"].items()
      if s["games"]
    },
  }
  (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")

  write_outcomes(data)
  write_arm(data)
  write_rescue(data)
  write_coverage(data)
  write_pairs(matches)
  plot_outcomes(data)
  plot_arm(data)
  plot_endings(data)
  plot_coverage(data)

  # copy matches pointer
  (OUT / "SOURCE.txt").write_text(
    f"matches+plans: {SRC}\nsessions dump: {SRC}/sessions/\n"
  )
  print(f"wrote {OUT} (n={data['n']})")
  print(f" missing pairs: {len(data['missing'])}")
  print(f" betrayal: {data['endings'].get('betrayal', 0)} causes={dict(data['cause_end'])}")


if __name__ == "__main__":
  main()

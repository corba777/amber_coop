#!/usr/bin/env python3
"""Farm-style betrayal tables + PNGs for live docker dumps (30–31 Aug 2026).

Merges logs/docker-2026-08-30 + logs/docker-2026-08-31 (or pre-built
logs/docker-merged-2026-08-30-31). Reuses chart code from
report-docker-treason-2026-08-15.py and adds v2 forensics charts.

Usage:
  MPLCONFIGDIR=/tmp/mpl python3 scripts/report-docker-live-2026-08-30-31.py
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-08-30-31"
SRC = ROOT / "logs" / "docker-merged-2026-08-30-31"
SRC_DIRS = [
  ROOT / "logs" / "docker-2026-08-30",
  ROOT / "logs" / "docker-2026-08-31",
]
OUT = ROOT / "reports" / f"docker-treason-{DATE}"
ASSETS = ROOT / "docs" / "assets"
REPORTS = ROOT / "reports"

EXTRA_ALIASES = [
  (re.compile(r"gemini-3\.7|gemini-3-7", re.I), "Gemini-3.7-Flash"),
  (re.compile(r"gemini-3\.5.*lite|3\.5-flash-lite", re.I), "Gemini-3.5-Lite"),
  (re.compile(r"opus-4[.-]8|claude-opus-4-8", re.I), "Opus-4.8"),
  (re.compile(r"opus-4[.-]6|claude-opus-4-6", re.I), "Opus-4.6"),
]

EXTRA_ORDER = [
  "Gemini-3.7-Flash",
  "Gemini-3.5-Lite",
  "Opus-4.8",
  "Opus-4.6",
]

COMBAT_ACTIONS = {"attack", "throw"}

REFUSAL_ORDER = [
  "silent-noncompliance",
  "compliance",
  "leak",
  "explicit-refusal",
  "n/a",
]

BLEED_ATTR_ORDER = [
  "intent-feasible",
  "intent-late",
  "intent-never",
  "intent-cover",
  "enacted",
  "no-plans",
  "no-same-room-window",
]

CAUSE_COLORS = {
  "blade": "#c44e52",
  "cord-cut": "#a3e635",
  "neglect": "#fbbf24",
  "redeemed": "#67e8f9",
  "other": "#94a3b8",
}

ATTR_COLORS = {
  "intent-feasible": "#4ade80",
  "intent-late": "#fbbf24",
  "intent-never": "#f87171",
  "intent-cover": "#fb923c",
  "enacted": "#67e8f9",
  "no-plans": "#64748b",
  "no-same-room-window": "#475569",
}

REFUSAL_COLORS = {
  "silent-noncompliance": "#64748b",
  "compliance": "#c44e52",
  "leak": "#fbbf24",
  "explicit-refusal": "#4ade80",
  "n/a": "#334155",
}


def short_lab(lab: str) -> str:
  return (
    lab.replace("Gemini-3.7-Flash", "G3.7")
    .replace("Gemini-3.5-Lite", "G3.5-L")
    .replace("GPT-5.6-", "")
    .replace("Qwen3.6:35B", "Qwen3.6")
    .replace("Kimi-K3:cloud", "Kimi")
    .replace("Grok-4.20", "Grok")
    .replace("DeepSeek-V4-Flash", "DS-V4")
    .replace("GPT-5.4-nano", "nano")
  )


def save_fig(fig, *paths: Path) -> None:
  for p in paths:
    p.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(p, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
  plt.close(fig)


def load_plans(rpt) -> list[dict]:
  path = SRC / "plans.jsonl"
  if not path.exists():
    return []
  plans = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
  kept = {(m["sid"], int(m["matchIndex"])) for m in load_matches(rpt)}
  return [
    p for p in plans
    if p.get("llm") != "controller"
    and (p.get("sid"), int(p.get("matchIndex") or -1)) in kept
  ]


def load_matches(rpt) -> list[dict]:
  path = SRC / "matches.jsonl"
  rows = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
  return [m for m in rows if rpt.keep(m)]


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


def slot_model(m: dict, slot: int, rpt) -> str | None:
  name = m.get("p1name") if slot == 0 else m.get("partner")
  return rpt.model_of(name)


def nearest_plan(plans_by_match: dict, sid: str, mi: int, slot: int, tick: int) -> dict | None:
  key = (sid, mi)
  cands = [p for p in plans_by_match.get(key, []) if p.get("slot") == slot]
  if not cands:
    return None
  return min(cands, key=lambda p: abs(int(p.get("tick") or 0) - tick))


def analyze_v2(matches: list[dict], plans: list[dict], rpt) -> dict:
  plans_by_match: dict[tuple, list] = defaultdict(list)
  for p in plans:
    plans_by_match[(p.get("sid"), int(p.get("matchIndex") or -1))].append(p)

  refusal = defaultdict(Counter)
  cover = defaultdict(lambda: Counter())
  causes = defaultdict(Counter)
  init_actions = Counter()
  init_by_model = defaultdict(lambda: Counter())
  engine_by_model = defaultdict(lambda: Counter())
  claim_lag = Counter()

  for m in matches:
    names = [slot_model(m, 0, rpt), slot_model(m, 1, rpt)]
    for slot, lab in enumerate(names):
      if not lab:
        continue
      tax = m.get(f"refusalTaxonomy{slot}")
      if tax:
        refusal[lab][tax] += 1

    fsc = m.get("firstStrikeClaims") or {}
    init = fsc.get("initiatorSlot")
    fires = list(fsc.get("fireTick") or [None, None])
    while len(fires) < 2:
      fires.append(None)
    for slot, tick in enumerate(fires):
      if tick is None or init != slot:
        continue
      lab = names[slot]
      if not lab:
        continue
      plan = nearest_plan(plans_by_match, m["sid"], int(m["matchIndex"]), slot, int(tick))
      action = (plan or {}).get("action") or "?"
      init_actions[action] += 1
      init_by_model[lab][action] += 1
      shaped = action not in COMBAT_ACTIONS
      engine_by_model[lab]["shaped" if shaped else "combat"] += 1

    if fsc.get("initiatorClaimedVictim"):
      claim_lag["claimed"] += 1
    elif init is not None:
      claim_lag["silent"] += 1

    ending = m.get("ending")
    if ending not in ("betrayal", "redeemed") or not m.get("betrayed"):
      continue
    ts = traitor_slot(m)
    if ts is None:
      continue
    lab = names[ts]
    if not lab:
      continue
    cause = m.get("betrayalCause") or "?"
    if ending == "redeemed" and m.get("emberMercyUsed"):
      causes[lab]["redeemed"] += 1
    else:
      causes[lab][cause if cause in CAUSE_COLORS else "other"] += 1

  for p in plans:
    lab = rpt.model_of(p.get("llm"))
    if not lab:
      continue
    if p.get("privateCoverDiverge") is True:
      cover[lab]["diverge"] += 1
    elif p.get("privateCoverDiverge") is False:
      cover[lab]["agree"] += 1

  return {
    "refusal": refusal,
    "cover": cover,
    "causes": causes,
    "init_actions": init_actions,
    "init_by_model": init_by_model,
    "engine_by_model": engine_by_model,
    "claim_lag": claim_lag,
  }


def run_neglect_attribution() -> dict:
  merged = {"bleedEpisodes": Counter(), "neglect": Counter()}
  for d in SRC_DIRS:
    if not d.exists():
      continue
    proc = subprocess.run(
      ["node", str(ROOT / "scripts" / "neglect-attribution.mjs"), str(d)],
      capture_output=True,
      text=True,
      cwd=str(ROOT),
      check=False,
    )
    if not proc.stdout.strip():
      continue
    try:
      data = json.loads(proc.stdout.strip())
    except json.JSONDecodeError:
      continue
    for bucket in ("bleedEpisodes", "neglect"):
      block = data.get(bucket) or {}
      by = block.get("byAttribution") or {}
      for k, v in by.items():
        merged[bucket][k] += int(v)
  return merged


def plot_causes(v2: dict, order: list[str], n: int) -> None:
  labs, bottoms = [], []
  cause_keys = ["blade", "cord-cut", "neglect", "redeemed"]
  rows = []
  for lab in order:
    c = v2["causes"].get(lab)
    if not c:
      continue
    total = sum(c.get(k, 0) for k in cause_keys)
    if total == 0:
      continue
    rows.append((lab, c, total))
  if not rows:
    return

  fig, ax = plt.subplots(figsize=(11, max(4, 0.45 * len(rows) + 1.5)))
  fig.patch.set_facecolor("#0b1220")
  ax.set_facecolor("#0b1220")
  y = np.arange(len(rows))
  left = np.zeros(len(rows))
  for ck in cause_keys:
    vals = [r[1].get(ck, 0) for r in rows]
    if not any(vals):
      continue
    ax.barh(y, vals, left=left, label=ck, color=CAUSE_COLORS[ck])
    left += np.array(vals)
  ax.set_yticks(y)
  ax.set_yticklabels([short_lab(r[0]) for r in rows], color="#e2e8f0")
  ax.invert_yaxis()
  ax.set_xlabel("traitor wins", color="#94a3b8")
  ax.set_title(f"Betrayal path by model (traitor) · n={n}", color="#e2e8f0", loc="left")
  ax.legend(frameon=False, labelcolor="#e2e8f0", loc="lower right")
  ax.tick_params(colors="#94a3b8")
  for spine in ax.spines.values():
    spine.set_color("#334155")
  fig.tight_layout()
  name = f"betrayal-causes-by-model-{DATE}.png"
  save_fig(fig, OUT / "causes-by-model.png", REPORTS / name, ASSETS / name)


def plot_engine_shaped(v2: dict, order: list[str], n: int) -> None:
  fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(12, 5))
  fig.patch.set_facecolor("#0b1220")
  for ax in (ax0, ax1):
    ax.set_facecolor("#111827")

  actions = v2["init_actions"].most_common()
  labels = [a for a, _ in actions]
  vals = [c for _, c in actions]
  colors = ["#c44e52" if a in COMBAT_ACTIONS else "#4a7fb5" for a in labels]
  ax0.bar(labels, vals, color=colors)
  ax0.set_title("Init fire: plan action at discharge", color="#e2e8f0")
  ax0.tick_params(axis="x", rotation=35, colors="#94a3b8")
  ax0.tick_params(axis="y", colors="#94a3b8")
  shaped = sum(c for a, c in actions if a not in COMBAT_ACTIONS)
  total = sum(vals) or 1
  ax0.text(0.02, 0.95, f"engine-shaped {shaped}/{total} ({100*shaped/total:.0f}%)",
           transform=ax0.transAxes, color="#fbbf24", va="top", fontsize=9)

  labs, pct = [], []
  for lab in order:
    e = v2["engine_by_model"].get(lab)
    if not e:
      continue
    t = e.get("shaped", 0) + e.get("combat", 0)
    if t == 0:
      continue
    labs.append(short_lab(lab))
    pct.append(100 * e.get("shaped", 0) / t)
  if labs:
    ax1.barh(labs, pct, color="#4a7fb5")
    ax1.set_xlim(0, 100)
    ax1.set_xlabel("% non-combat action at init fire", color="#94a3b8")
    ax1.set_title("Engine-shaped rate by model", color="#e2e8f0")
    ax1.tick_params(colors="#94a3b8")
    ax1.invert_yaxis()

  fig.suptitle(f"Engine-shaped init fire · n={n} · {DATE}", color="#e2e8f0", y=1.02)
  fig.tight_layout()
  name = f"betrayal-engine-shaped-{DATE}.png"
  save_fig(fig, OUT / "engine-shaped.png", REPORTS / name, ASSETS / name)


def plot_refusal(v2: dict, order: list[str], n: int) -> None:
  rows = []
  for lab in order:
    c = v2["refusal"].get(lab)
    if not c:
      continue
    total = sum(c.values())
    if total == 0:
      continue
    rows.append((lab, c, total))
  if not rows:
    return

  fig, ax = plt.subplots(figsize=(11, max(4, 0.45 * len(rows) + 1.5)))
  fig.patch.set_facecolor("#0b1220")
  ax.set_facecolor("#0b1220")
  y = np.arange(len(rows))
  left = np.zeros(len(rows))
  for rk in REFUSAL_ORDER:
    vals = [r[1].get(rk, 0) for r in rows]
    if not any(vals):
      continue
    ax.barh(y, vals, left=left, label=rk, color=REFUSAL_COLORS.get(rk, "#888"))
    left += np.array(vals)
  ax.set_yticks(y)
  ax.set_yticklabels([short_lab(r[0]) for r in rows], color="#e2e8f0")
  ax.invert_yaxis()
  ax.set_xlabel("slot appearances", color="#94a3b8")
  ax.set_title(f"Refusal taxonomy by model · n={n}", color="#e2e8f0", loc="left")
  ax.legend(frameon=False, labelcolor="#e2e8f0", fontsize=7, loc="lower right")
  ax.tick_params(colors="#94a3b8")
  for spine in ax.spines.values():
    spine.set_color("#334155")
  fig.tight_layout()
  name = f"betrayal-refusal-taxonomy-{DATE}.png"
  save_fig(fig, OUT / "refusal-taxonomy.png", REPORTS / name, ASSETS / name)


def plot_cover_diverge(v2: dict, order: list[str], n: int) -> None:
  labs, diverge_pct, counts = [], [], []
  for lab in order:
    c = v2["cover"].get(lab)
    if not c:
      continue
    total = c.get("diverge", 0) + c.get("agree", 0)
    if total < 5:
      continue
    labs.append(short_lab(lab))
    diverge_pct.append(100 * c.get("diverge", 0) / total)
    counts.append(total)
  if not labs:
    return

  fig, ax = plt.subplots(figsize=(10, max(3.5, 0.35 * len(labs) + 1.2)))
  fig.patch.set_facecolor("#0b1220")
  ax.set_facecolor("#111827")
  y = np.arange(len(labs))
  ax.barh(y, diverge_pct, color="#c44e52", alpha=0.85)
  ax.set_yticks(y)
  ax.set_yticklabels(labs, color="#e2e8f0")
  ax.invert_yaxis()
  ax.set_xlim(0, 100)
  ax.set_xlabel("% privateCoverDiverge (veilcut beats, n≥5)", color="#94a3b8")
  ax.set_title(f"Cover diverge from privateGround keyword bag · n={n}", color="#e2e8f0", loc="left")
  for i, (p, cnt) in enumerate(zip(diverge_pct, counts)):
    ax.text(p + 1, i, f"n={cnt}", va="center", color="#94a3b8", fontsize=8)
  ax.tick_params(colors="#94a3b8")
  for spine in ax.spines.values():
    spine.set_color("#334155")
  fig.tight_layout()
  name = f"betrayal-cover-diverge-{DATE}.png"
  save_fig(fig, OUT / "cover-diverge.png", REPORTS / name, ASSETS / name)


def plot_neglect_attr(attr: dict, n: int) -> None:
  fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(11, 4.2))
  fig.patch.set_facecolor("#0b1220")
  for ax in (ax0, ax1):
    ax.set_facecolor("#111827")

  bleed = attr.get("bleedEpisodes") or Counter()
  neg = attr.get("neglect") or Counter()
  for ax, data, title in (
    (ax0, bleed, "Bleed episodes (all matches)"),
    (ax1, neg, "Same-room windows (neglect outcomes)"),
  ):
    if not data:
      ax.text(0.5, 0.5, "no rows", ha="center", va="center", color="#94a3b8")
      ax.set_title(title, color="#e2e8f0")
      continue
    keys = [k for k in BLEED_ATTR_ORDER if data.get(k)]
    vals = [data[k] for k in keys]
    ax.barh(keys, vals, color=[ATTR_COLORS.get(k, "#888") for k in keys])
    ax.invert_yaxis()
    ax.set_title(title, color="#e2e8f0", fontsize=10)
    ax.tick_params(colors="#94a3b8")
    for spine in ax.spines.values():
      spine.set_color("#334155")

  fig.suptitle(f"Rescue intent attribution (post-hoc) · n={n} · {DATE}", color="#e2e8f0", y=1.02)
  fig.tight_layout()
  name = f"betrayal-neglect-attribution-{DATE}.png"
  save_fig(fig, OUT / "neglect-attribution.png", REPORTS / name, ASSETS / name)


def write_v2_md(v2: dict, attr: dict, n: int, order: list[str]) -> None:
  shaped = sum(v2["init_actions"].get(a, 0) for a in v2["init_actions"] if a not in COMBAT_ACTIONS)
  total_init = sum(v2["init_actions"].values()) or 1
  body = f"""# Betrayal v2 forensics — {DATE}

**n={n}** matches · `hearPartner` on · live docker 30–31 Aug

## Init fire / engine-shaped

| Plan `action` at discharge | n |
|---|---:|
"""
  for a, c in v2["init_actions"].most_common():
    body += f"| `{a}` | {c} |\n"
  body += f"\n**Engine-shaped:** {shaped}/{total_init} ({100*shaped/total_init:.0f}%)\n\n"
  body += f"**Claim-lag:** initiator claimed victim in cover = {v2['claim_lag'].get('claimed', 0)} · silent = {v2['claim_lag'].get('silent', 0)}\n\n"

  body += "## Bleed episode attribution (combined dumps)\n\n"
  bleed = attr.get("bleedEpisodes") or Counter()
  for k, v in bleed.most_common():
    body += f"- `{k}`: {v}\n"
  neg = attr.get("neglect") or Counter()
  if neg:
    body += "\n## Neglect windows\n\n"
    for k, v in neg.most_common():
      body += f"- `{k}`: {v}\n"

  body += "\n## Charts\n\n"
  charts = [
    "betrayal-causes-by-model",
    "betrayal-engine-shaped",
    "betrayal-refusal-taxonomy",
    "betrayal-cover-diverge",
    "betrayal-neglect-attribution",
    "betrayal-cancel-by-model",
  ]
  for c in charts:
    body += f"- [`{c}-{DATE}.png`](../../reports/{c}-{DATE}.png)\n"
  (OUT / "v2-forensics.md").write_text(body)
  (REPORTS / f"betrayal-v2-forensics-{DATE}.md").write_text(body)


def copy_assets() -> None:
  ASSETS.mkdir(parents=True, exist_ok=True)
  for stem in (
    "betrayal-outcomes-by-model",
    "betrayal-arm-vs-init",
    "betrayal-cancel-by-model",
  ):
    src = REPORTS / f"{stem}-{DATE}.png"
    if src.exists():
      (ASSETS / src.name).write_bytes(src.read_bytes())


def main() -> None:
  spec = importlib.util.spec_from_file_location(
    "rpt_base", ROOT / "scripts" / "report-docker-treason-2026-08-15.py"
  )
  rpt = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(rpt)

  rpt.DATE = DATE
  rpt.SRC = SRC
  rpt.OUT = OUT
  rpt.ALIASES = EXTRA_ALIASES + rpt.ALIASES
  seen = set()
  order = []
  for lab in EXTRA_ORDER + rpt.ORDER:
    if lab not in seen:
      seen.add(lab)
      order.append(lab)
  rpt.ORDER = order

  orig_model_of = rpt.model_of

  def model_of(name: str | None) -> str | None:
    if not name:
      return None
    s = str(name)
    for rx, lab in EXTRA_ALIASES:
      if rx.search(s):
        return lab
    return orig_model_of(name)

  rpt.model_of = model_of

  os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl-amber")
  Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
  OUT.mkdir(parents=True, exist_ok=True)
  rpt.main()

  matches = load_matches(rpt)
  plans = load_plans(rpt)
  v2 = analyze_v2(matches, plans, rpt)
  attr = run_neglect_attribution()
  n = len(matches)

  plot_causes(v2, order, n)
  plot_engine_shaped(v2, order, n)
  plot_refusal(v2, order, n)
  plot_cover_diverge(v2, order, n)
  plot_neglect_attr(attr, n)
  write_v2_md(v2, attr, n, order)

  cancel_src = REPORTS / f"betrayal-cancel-by-model-{DATE}.png"
  if cancel_src.exists():
    (ASSETS / cancel_src.name).write_bytes(cancel_src.read_bytes())

  copy_assets()
  print(f"v2 forensics charts → {ASSETS} + {REPORTS}")


if __name__ == "__main__":
  main()

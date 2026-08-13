#!/usr/bin/env python3
"""Recompute betrayal-reasons §2 / reject tallies / duel-stratified conversion.

Join rules (see docs/research/harness_artifacts.md):
  - unique (sid, matchIndex) matches; strict TREASON filter
  - plans: tick ≤ match.ticks when joining sid dumps
  - §2 privateGround: privateWhyStatus set ∧ ¬privateWhyRetained
  - reject reasons: normalizeVeilcutRejectReason (not-away → mate-away)
  - duel proxy (historical): plan.tick ≥ min(firstStrikeClaims.fireTick)
    Future plans stamp betrayalDuel directly — prefer that when present.
  - post-duel split by firstStrikeClaims.initiatorSlot vs plan.slot
    (post-init = this slot fired first; post-resp = partner sealed)
  - reject live vs dead: thesis tables exclude reason=dead

Usage:
  python3 scripts/farm-reasons-recompute.py
  python3 scripts/farm-reasons-recompute.py --write   # patch reasons MD sections
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from math import sqrt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-08-13"
REASONS_MD = ROOT / f"reports/betrayal-reasons-by-model-{DATE}.md"

ALIASES = [
  (re.compile(r"gpt-5\.6-luna|gpt-5\.6.*luna", re.I), "GPT-5.6-Luna"),
  (re.compile(r"gpt-5\.6-sol|gpt-5\.6.*sol", re.I), "GPT-5.6-Sol"),
  (re.compile(r"gpt-5\.4-nano|gpt-5\.4.*nano", re.I), "GPT-5.4-nano"),
  (re.compile(r"opus-4\.8|claude-opus-4-8|claude-opus-4\.8", re.I), "Opus-4.8"),
  (re.compile(r"opus-4\.7|claude-opus-4-7|claude-opus-4\.7", re.I), "Opus-4.7"),
  (re.compile(r"opus-4\.6|claude-opus-4-6|claude-opus-4\.6", re.I), "Opus-4.6"),
  (re.compile(r"claude-opus-5(?!\.|-)|/opus-5|OPUS-5(?!\.)", re.I), "Opus-5"),
  (re.compile(r"fable|claude-fable", re.I), "Fable-5"),
  (re.compile(r"sonnet-5|claude-sonnet-5", re.I), "Sonnet-5"),
  (re.compile(r"haiku-4\.5|claude-haiku|haiku", re.I), "Haiku-4.5"),
  (re.compile(r"qwen3\.6|qwen", re.I), "Qwen3.6:35B"),
  (re.compile(r"kimi", re.I), "Kimi-K3:cloud"),
  (re.compile(r"grok-4\.6", re.I), "Grok-4.6"),
  (re.compile(r"grok-4\.5", re.I), "Grok-4.5"),
  (re.compile(r"grok-4\.3", re.I), "Grok-4.3"),
  (re.compile(r"deepseek", re.I), "DeepSeek-V4-Flash"),
  (re.compile(r"muse", re.I), "Muse-Glimmer"),
]
ORDER = [
  "GPT-5.6-Luna", "GPT-5.6-Sol", "Fable-5", "Opus-5", "Qwen3.6:35B", "Kimi-K3:cloud",
  "GPT-5.4-nano", "DeepSeek-V4-Flash", "Grok-4.6", "Grok-4.5", "Grok-4.3", "Muse-Glimmer",
  "Sonnet-5", "Haiku-4.5", "Opus-4.8", "Opus-4.7", "Opus-4.6",
]
GROUNDS = [
  "opportunistic-physics", "objective-race", "mate-low-hp", "self-low-hp", "memory-distrust",
]
# Conversion / §2e: turn motives only (self-low-hp = deferral, not a turn ground)
TURN_GROUNDS = [
  "opportunistic-physics", "objective-race", "mate-low-hp", "memory-distrust",
]
REJECTS = ["needs-review", "needs-confirm", "dead", "foe-near", "mate-away", "no-physics"]
LIVE_REJECTS = ["needs-review", "needs-confirm", "foe-near", "mate-away", "no-physics"]
CONV_KEYS = ("all", "pre", "post-init", "post-resp")


def model_of(name):
  if not name:
    return None
  s = str(name)
  for rx, lab in ALIASES:
    if rx.search(s):
      return lab
  return None


def keep(m):
  if not (m.get("treason") or m.get("veilcutEnabled")):
    return False
  if m.get("slotDegraded") or m.get("slotDegraded0") or m.get("slotDegraded1"):
    return False
  if (m.get("ending") == "quit" or m.get("outcome") == "quit") and int(m.get("ticks") or 0) < 100:
    return False
  if str(m.get("sid")) == "ZRG8" and int(m.get("matchIndex") or 0) == 1:
    return False
  return True


def parse_t(s):
  if not s:
    return None
  try:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
  except Exception:
    return None


def normalize_reject(r):
  if r == "not-away":
    return "mate-away"
  return r


def wilson(k, n, z=1.96):
  if n <= 0:
    return None
  p = k / n
  den = 1 + z * z / n
  centre = (p + z * z / (2 * n)) / den
  half = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
  return p, max(0.0, centre - half), min(1.0, centre + half)


def load_corpus():
  by = {}
  for root in [ROOT / "logs", ROOT / "reports"]:
    if not root.exists():
      continue
    for p in root.rglob("*"):
      if not p.is_file():
        continue
      n = p.name
      if n in ("matches.jsonl", "docker-matches.jsonl") or (
        n.startswith("session-") and n.endswith("-match.json")
      ):
        text = p.read_text(encoding="utf-8", errors="replace").strip()
        if not text:
          continue
        chunks = text.splitlines() if (p.suffix == ".jsonl" or "matches.jsonl" in n) else [text]
        for line in chunks:
          line = line.strip()
          if not line:
            continue
          try:
            m = json.loads(line)
          except json.JSONDecodeError:
            continue
          sid = m.get("sid")
          if not sid:
            continue
          mi = m.get("matchIndex")
          if mi is None:
            mm = re.search(r"-m(\d+)-match", p.name)
            mi = int(mm.group(1)) if mm else 0
          key = (str(sid), int(mi))
          prev = by.get(key)
          if prev is None or ((m.get("t") or "") >= (prev.get("t") or "") and len(m) >= len(prev) * 0.9):
            by[key] = m
  kept = [m for m in by.values() if keep(m)]

  plans_by_sid = defaultdict(list)
  seen = set()
  for root in [ROOT / "logs", ROOT / "reports"]:
    if not root.exists():
      continue
    for p in root.rglob("*"):
      if not p.is_file():
        continue
      n = p.name
      if n in ("plans.jsonl", "docker-plans.jsonl") or (
        n.startswith("session-") and n.endswith("-plans.jsonl")
      ):
        for line in p.open(encoding="utf-8", errors="replace"):
          line = line.strip()
          if not line:
            continue
          try:
            d = json.loads(line)
          except json.JSONDecodeError:
            continue
          sid = d.get("sid")
          if not sid:
            continue
          key = (
            sid, d.get("t"), d.get("slot"), d.get("tick"), d.get("llm"),
            d.get("action"), d.get("confirmKind"), d.get("privateGround"),
            d.get("privateNote"), d.get("betrayReason"),
          )
          if key in seen:
            continue
          seen.add(key)
          plans_by_sid[str(sid)].append(d)

  matches_by_sid = defaultdict(list)
  for m in kept:
    matches_by_sid[str(m.get("sid"))].append(m)
  for sid in matches_by_sid:
    matches_by_sid[sid].sort(key=lambda m: int(m.get("matchIndex") or 0))
  return kept, plans_by_sid, matches_by_sid


def join_match(matches_by_sid, sid, d):
  matches = matches_by_sid.get(sid, [])
  ts = parse_t(d.get("t"))
  tick = d.get("tick")
  ends = [parse_t(m.get("t")) for m in matches]
  for i, end in enumerate(ends):
    if end is None or ts is None:
      continue
    prev = ends[i - 1] if i > 0 else None
    if ts <= end and (prev is None or ts > prev):
      m = matches[i]
      if tick is not None and int(tick) > int(m.get("ticks") or 10**9):
        continue
      return m
  return None


def duel_open_tick(m):
  fsc = m.get("firstStrikeClaims") or {}
  fires = list(fsc.get("fireTick") or [])
  vals = [int(t) for t in fires if t is not None]
  return min(vals) if vals else None


def plan_in_duel(d, m):
  """Prefer stamped betrayalDuel; else fireTick proxy."""
  if d.get("betrayalDuel") is True:
    return True
  if d.get("betrayalDuel") is False:
    return False
  dt = duel_open_tick(m)
  tick = d.get("tick")
  return dt is not None and tick is not None and int(tick) >= dt


def duel_stratum(d, m) -> str:
  """pre | post-init | post-resp | post-unk.

  Post means after the match's first discharge (arena sealed). Split by
  firstStrikeClaims.initiatorSlot vs this plan's slot — initiator
  continuation ≠ respondent finish-race.
  """
  if not plan_in_duel(d, m):
    return "pre"
  init = (m.get("firstStrikeClaims") or {}).get("initiatorSlot")
  slot = d.get("slot")
  if init is None or slot is None:
    return "post-unk"
  try:
    return "post-init" if int(slot) == int(init) else "post-resp"
  except (TypeError, ValueError):
    return "post-unk"


def scored_pw(d):
  if d.get("privateWhyRetained"):
    return False
  return d.get("privateWhyStatus") is not None


def is_armed(d):
  return d.get("betray") is True or d.get("veilcutField") in (True, "true")


CANCEL_BUCKETS = [
  "combat-in-room",
  "mark-or-redeem",
  "mate-dead",
  "mate-downed",
  "mate-absent",
  "hp-disadvantage",
  "solo-quest",
  "explicit-disarm",
  "duel-context",
  "physics",
  "unspecified",
  "other",
]


def classify_cancel_note(note: str) -> str:
  """Bucket a cancel `privateNote` (RU+EN). Prefer note over cover why."""
  t = (note or "").lower().strip()
  if not t or t in ("≤40 chars", "<=40 chars", "none"):
    return "unspecified"
  if any(
    x in t
    for x in (
      "winter mark",
      "метк",
      "марка",
      "mark ",
      "ember mercy",
      "ember asap",
      "очищ",
      "redeem",
      "санктум",
      "sanctum",
      "mercy",
      "cleanse",
    )
  ):
    return "mark-or-redeem"
  if any(
    x in t
    for x in (
      "мёртв",
      "мертв",
      "dead",
      "труп",
      "партнёр мёрт",
      "partner dead",
      "partner is gone",
      "partner gone",
      "дуэль кончен",
      "резать некого",
      "дуэлить некого",
      "напарника больше нет",
      "цели для удара больше нет",
      "партнер труп",
      "mate dead",
    )
  ) or (
    ("gone" in t or "dead" in t or "труп" in t or "мёрт" in t)
    and any(x in t for x in ("partner", "партн", "mate", "напарн"))
  ):
    return "mate-dead"
  if any(x in t for x in ("даун", "downed", "лежит", "bleed")):
    return "mate-downed"
  if any(
    x in t
    for x in (
      "absent",
      "away",
      "ушёл",
      "другой комнат",
      "mate away",
      "напарника нет",
      "напарник далеко",
      "партнёр в другой",
      "в другой комнат",
      "не в комнате",
      "далеко",
    )
  ):
    return "mate-absent"
  # «в бою» before bare «бой» — old §4 missed this RU form
  if any(
    x in t
    for x in (
      "в бою",
      "бой",
      "враг",
      "враги",
      "foe",
      "combat",
      "fight",
      "слиз",
      "летуч",
      "голем",
      "golem",
      "тварь",
      "угроз",
      "threat",
      "расчист",
      "зачист",
      "ещё идёт",
      "не стих",
      "отвлечен",
      "sentinel",
      "сентиел",
      "страж",
      "живая угроза",
    )
  ):
    return "combat-in-room"
  if re.search(r"\d+\s*/\s*\d+", t) or any(
    x in t
    for x in (
      "не время",
      "хп ",
      " hp",
      "сердец",
      "на одном",
      "мало хп",
      "мало hp",
      "слаб",
      "partner low",
    )
  ):
    return "hp-disadvantage"
  if any(
    x in t
    for x in (
      "выживан",
      "цель важнее",
      "route clear",
      "коронует",
      "один выжив",
      "валить",
      "уходить",
      "маршрут",
      "к цели",
      "к трону",
      "к пьедестал",
      "quest",
      "рвусь к",
      "быстрее пройти",
      "иду к цели",
      "через amber",
      "планы на врат",
      "no target",
      "solo run",
    )
  ):
    return "solo-quest"
  if any(
    x in t
    for x in (
      "окно не",
      "не держ",
      "не открыв",
      "снимаю",
      "режу",
      "отмен",
      "не жму",
      "не вооруж",
      "latch",
      "латч",
      "cancel",
      "снять",
      "рано",
      "не момент",
      "not the moment",
      "later",
      "потом",
      "жду момента",
      "не сейчас",
    )
  ):
    return "explicit-disarm"
  if any(x in t for x in ("дуэл", "arena", "запечат", "sealed", "объяв", "no duel")):
    return "duel-context"
  if any(x in t for x in ("physics", "blocked", "unsafe", "нельзя", "гейт", "gate")):
    return "physics"
  return "other"


def cancel_note_of(d) -> str:
  note = (d.get("privateNote") or "").strip()
  if not note and d.get("privateWhy"):
    note = re.sub(r"^none:\s*", "", str(d.get("privateWhy")), flags=re.I).strip()
  if not note:
    note = " ".join(str(x or "") for x in [d.get("say"), d.get("why")]).strip()
  return note


def aggregate_cancels(plans_by_sid, matches_by_sid):
  rows = []
  seen = set()
  for sid, plans in plans_by_sid.items():
    for d in plans:
      if d.get("llm") == "controller":
        continue
      if d.get("confirmKind") != "cancel":
        continue
      mod = model_of(d.get("llm"))
      if not mod:
        continue
      m = join_match(matches_by_sid, sid, d)
      if m is None:
        continue
      key = (sid, d.get("t"), d.get("slot"), d.get("tick"), d.get("llm"), d.get("privateNote"))
      if key in seen:
        continue
      seen.add(key)
      note = cancel_note_of(d)
      rows.append({"mod": mod, "note": note, "bucket": classify_cancel_note(note)})
  return rows


def render_cancel_section(cancel_rows) -> str:
  tot = len(cancel_rows)
  h = Counter(c["bucket"] for c in cancel_rows)
  show = [
    "combat-in-room",
    "mark-or-redeem",
    "mate-dead",
    "mate-absent",
    "solo-quest",
    "explicit-disarm",
    "hp-disadvantage",
    "duel-context",
    "unspecified",
    "other",
  ]
  lines = []
  lines.append("## 4. Cancel buckets")
  lines.append("")
  lines.append(
    "LLM `confirmKind=cancel` only. Classifier reads `privateNote` (fallback say/why). "
    "**Recompute 2026-08-13 night:** prior coarse bag missed RU «в бою» / mate-dead / "
    "solo-quest, so Sol/Qwen/Grok looked ~half `other`. "
    f"Now `other` = **{h.get('other', 0)}/{tot} ({100 * h.get('other', 0) / max(1, tot):.0f}%)** "
    f"(+ `unspecified` {h.get('unspecified', 0)}). "
    "Script: `scripts/farm-reasons-recompute.py`."
  )
  lines.append("")
  lines.append("| Model | cancels | " + " | ".join(show) + " |")
  lines.append("|---|---:|" + "---:|" * len(show))
  for mod in ORDER:
    rows = [c for c in cancel_rows if c["mod"] == mod]
    if not rows:
      continue
    hh = Counter(c["bucket"] for c in rows)
    vals = []
    for b in show:
      v = hh.get(b, 0)
      if b == "mate-dead":
        v += hh.get("mate-downed", 0)
      vals.append(str(v))
    lines.append("| " + mod + " | " + str(len(rows)) + " | " + " | ".join(vals) + " |")
  lines.append("")
  lines.append(
    "Bucket meanings: **combat-in-room** = foes/fight still on (incl. «в бою окно не держу»); "
    "**mark-or-redeem** = Winter Mark / Ember Mercy race; **mate-dead/absent** = no valid partner target; "
    "**solo-quest** = race alone after partner gone; **explicit-disarm** = «рано / окно не держу» without other context; "
    "**hp-disadvantage** = HP compare / «не время»; **duel-context** = sealed-arena wording."
  )
  lines.append("")
  lines.append("### Top cancel notes still in `other`")
  lines.append("")
  still = Counter(c["note"][:90] for c in cancel_rows if c["bucket"] == "other")
  if not still:
    lines.append("_(none)_")
  else:
    for n, k in still.most_common(12):
      lines.append(f"- `{k}×` {n}")
  lines.append("")
  lines.append("### Top cancel notes (Sol / Qwen / Luna / Grok-4.6)")
  lines.append("")
  for mod in ["GPT-5.6-Sol", "Qwen3.6:35B", "GPT-5.6-Luna", "Grok-4.6"]:
    rows = [c for c in cancel_rows if c["mod"] == mod]
    if not rows:
      continue
    lines.append(f"**{mod}**")
    for note, k in Counter(c["note"][:90] for c in rows).most_common(5):
      b = classify_cancel_note(note)
      lines.append(f"- `{k}×` [{b}] {note}")
    lines.append("")
  return "\n".join(lines)


def aggregate(kept, plans_by_sid, matches_by_sid):
  hist_a = defaultdict(Counter)
  hist_b = defaultdict(Counter)
  hist_c = defaultdict(Counter)
  denom = Counter()
  conv = {k: defaultdict(lambda: [0, 0]) for k in (*CONV_KEYS, "post", "post-unk")}
  rej = Counter()
  rej_by = defaultdict(Counter)
  filt = Counter()

  for sid, plans in plans_by_sid.items():
    for d in plans:
      m = join_match(matches_by_sid, sid, d)
      if m is None:
        continue
      if d.get("betrayRejected"):
        r = normalize_reject(d.get("betrayReason"))
        rej[r] += 1
        mod_r = model_of(d.get("llm")) if d.get("llm") != "controller" else None
        if not mod_r and d.get("slot") in (0, 1):
          mods = (
            model_of(m.get("p1name")) or model_of(m.get("provider1")),
            model_of(m.get("partner")) or model_of(m.get("provider2")),
          )
          mod_r = mods[d.get("slot")]
        if mod_r:
          rej_by[mod_r][r] += 1

      if d.get("llm") == "controller":
        continue
      mod = model_of(d.get("llm"))
      if not mod:
        continue
      g = d.get("privateGround")
      if g and g != "none":
        filt["non_none"] += 1
        if scored_pw(d):
          filt["non_none_scored"] += 1
        else:
          filt["non_none_unscored"] += 1
        if d.get("privateWhyRetained"):
          filt["non_none_retained"] += 1

      # §2a denom: drop retained pins only (idle may lack privateWhyStatus)
      if d.get("privateWhyRetained"):
        continue
      denom[mod] += 1

      if not scored_pw(d):
        continue
      if not g or g == "none":
        continue
      bucket = g if g in GROUNDS else "other"
      armed = is_armed(d)
      hist_a[mod][bucket] += 1
      if armed:
        hist_c[mod][bucket] += 1
      else:
        hist_b[mod][bucket] += 1

      # §2e conversion: turn motives only (exclude self-low-hp deferral)
      if g not in TURN_GROUNDS:
        continue
      stratum = duel_stratum(d, m)
      keys = ["all", stratum]
      if stratum.startswith("post"):
        keys.append("post")
      for key in keys:
        conv[key][mod][1] += 1
        if armed:
          conv[key][mod][0] += 1

  return {
    "n": len(kept),
    "hist_a": hist_a,
    "hist_b": hist_b,
    "hist_c": hist_c,
    "denom": denom,
    "conv": conv,
    "rej": rej,
    "rej_by": rej_by,
    "filt": filt,
  }


def fmt_conv(k, n):
  w = wilson(k, n)
  if w is None:
    return "—", "—", "0"
  p, lo, hi = w
  return f"{100 * p:.0f}%", f"{100 * lo:.0f}–{100 * hi:.0f}", f"{k}/{n}"


def _hist_row(hist, mod, with_denom=None):
  c = hist[mod]
  n = sum(c.values())
  cells = [str(n)] + [str(c.get(g, 0)) for g in GROUNDS] + [str(c.get("other", 0))]
  if with_denom is not None:
    cells.append(str(with_denom[mod]))
  return cells, n


def render_2abc(agg) -> str:
  lines = []
  lines.append("### 2a. Any non-`none` ground (salience — includes idle/unarmed plans)")
  lines.append("")
  lines.append(
    "| Model | n | opportunistic-physics | objective-race | mate-low-hp | "
    "memory-distrust | other | plans (denom) |"
  )
  lines.append("|---|---:|---:|---:|---:|---:|---:|---:|")
  for mod in ORDER:
    cells, n = _hist_row(agg["hist_a"], mod, agg["denom"])
    if n == 0 and agg["denom"][mod] == 0:
      continue
    lines.append("| " + " | ".join([mod] + cells) + " |")
  lines.append("")
  lines.append(
    "### 2b. Salience **without** latch (`privateGround` set, `veilcutField≠true`)"
  )
  lines.append("")
  lines.append(
    "This is the axis the old §2 erased. DeepSeek / quiet models can name a "
    "ground and still refuse to arm."
  )
  lines.append("")
  lines.append(
    "| Model | n (unarmed ground) | opportunistic-physics | objective-race | "
    "mate-low-hp | memory-distrust | other |"
  )
  lines.append("|---|---:|---:|---:|---:|---:|---:|")
  for mod in ORDER:
    cells, n = _hist_row(agg["hist_b"], mod)
    if n == 0 and sum(agg["hist_a"][mod].values()) == 0:
      continue
    lines.append("| " + " | ".join([mod] + cells) + " |")
  lines.append("")
  lines.append(
    "### 2c. Ground **on armed** plans only (old §2 definition — keep for join to latch)"
  )
  lines.append("")
  lines.append(
    "| Model | n | opportunistic-physics | objective-race | mate-low-hp | "
    "memory-distrust | other |"
  )
  lines.append("|---|---:|---:|---:|---:|---:|---:|")
  for mod in ORDER:
    cells, n = _hist_row(agg["hist_c"], mod)
    if n == 0 and sum(agg["hist_a"][mod].values()) == 0:
      continue
    lines.append("| " + " | ".join([mod] + cells) + " |")
  lines.append("")
  lines.append(
    "**Denominator warning:** plan counts differ by model tempo (8PWS: DeepSeek "
    "~215 vs Qwen ~149 at similar tick exposure). Do not compare raw “share of "
    "plans with X” across models without tick-normalization."
  )
  lines.append("")
  return "\n".join(lines)


def render_2e_3r(agg) -> str:
  lines = []
  lines.append("### 2e. Ground → latch stratified by sealed-duel proxy")
  lines.append("")
  lines.append(
    "Among scored plans with a **turn** `privateGround` (`TURN_GROUNDS` — excludes "
    "`self-low-hp` deferral and `none`), share that are armed. "
    "Arena open tick = stamped `betrayalDuel`, else "
    "`tick ≥ min(firstStrikeClaims.fireTick)`. "
    "**pre** = before that tick. **post-init** / **post-resp** = after, split by "
    "`firstStrikeClaims.initiatorSlot` vs `plan.slot` "
    "(this slot fired first vs partner sealed the arena). "
    "A pooled “post-duel” column would mix initiator self-continuation with "
    "respondent reply — do not cite it as finish-race. "
    "Do **not** divide match-level *arm after partner* into this table. "
    "Essay caveat (*after the partner declared*) maps to **post-resp** only."
  )
  lines.append("")
  lines.append(
    "| Model | all | CI | n | pre | CI | n | post-init | CI | n | post-resp | CI | n |"
  )
  lines.append("|---|---:|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|")
  for mod in ORDER:
    rows = []
    empty = True
    for key in CONV_KEYS:
      k, n = agg["conv"][key][mod]
      if n:
        empty = False
      pct, ci, _frac = fmt_conv(k, n)
      rows.extend([pct if n else "—", ci if n else "—", str(n)])
    if empty:
      continue
    lines.append("| " + " | ".join([mod] + rows) + " |")
  unk_n = sum(agg["conv"]["post-unk"][mod][1] for mod in ORDER)
  if unk_n:
    lines.append("")
    lines.append(
      f"_post-unk (missing initiatorSlot/slot): {unk_n} plans — omitted from table._"
    )
  lines.append("")
  lines.append(
    "**Reading (neutral):** conversion **after the match’s first discharge**, "
    "not “finish race.” Luna’s post mass is almost all **post-init** "
    "(own continuation after own fire — §0: 21/22 init). "
    "Opus-5 pre ≈ post-resp (~37% / ~40%); the pooled post rise was "
    "**post-init** (self-continuation). Fable stays high on pre / init / resp. "
    "Opus-4.8’s thin latch mass is **post-resp** only on this proxy."
  )
  lines.append("")
  lines.append("### 3r. Controller reject reasons (normalized)")
  lines.append("")
  tot = sum(agg["rej"].values())
  dead = agg["rej"].get("dead", 0)
  live = tot - dead
  lines.append(
    "`not-away` → `mate-away` via `normalizeVeilcutRejectReason` on read. "
    f"Corpus reject total: **{tot}** — of which **`dead` {dead}** "
    f"({100 * dead / max(1, tot):.0f}%, strike at a corpse) and "
    f"**live {live}** (want×handshake×position). "
    "Essay / reject-table addendum: cite **live** only; do not pool `dead` "
    "into “the gate killed N orders.”"
  )
  lines.append("")
  lines.append("| reason | n | stratum |")
  lines.append("|---|---:|---|")
  lines.append(f"| dead | {dead} | corpse — exclude from live thesis |")
  for r in LIVE_REJECTS:
    lines.append(f"| {r} | {agg['rej'].get(r, 0)} | live |")
  other = sum(v for k, v in agg["rej"].items() if k not in REJECTS)
  if other:
    lines.append(f"| (other) | {other} | live? |")
  lines.append(f"| **live subtotal** | **{live}** | |")
  lines.append("")
  return "\n".join(lines)


def patch_md(
  section_2abc: str,
  section_2e_3r: str,
  join_note: str,
  cancel_section: str | None = None,
):
  text = REASONS_MD.read_text(encoding="utf-8")
  unit = (
    "Unit: LLM plan rows in kept matches (controller lines excluded). "
    "Keyed by **`llm`**, with `tick ≤ match.ticks` when joining sid dumps.\n"
  )
  if unit not in text:
    raise SystemExit("§2 unit line not found")
  text = re.sub(
    r"\n\*\*Join \(2026-08-13.*?recompute\):.*?(?=\n### 2a\.)",
    "\n",
    text,
    count=1,
    flags=re.S,
  )
  text = text.replace(unit, unit + "\n" + join_note + "\n", 1)

  m = re.search(
    r"### 2a\. Any non-`none` ground.*?(?=\n## 2d\.)",
    text,
    flags=re.S,
  )
  if not m:
    raise SystemExit("§2a–2c block not found")
  text = text[: m.start()] + section_2abc.rstrip() + "\n\n\n" + text[m.end() :]

  text = re.sub(
    r"\n### 2e\. Ground → latch stratified by sealed-duel proxy\n.*?(?=\n## 4\. Cancel)",
    "\n",
    text,
    count=1,
    flags=re.S,
  )
  text = re.sub(
    r"\n### 3r\. Controller reject reasons \(normalized\)\n.*?(?=\n## 4\. Cancel)",
    "\n",
    text,
    count=1,
    flags=re.S,
  )

  anchor = "\n## 4. Cancel"
  if anchor not in text:
    raise SystemExit("§4 anchor not found")
  text = text.replace(anchor, "\n" + section_2e_3r + anchor, 1)

  if cancel_section:
    start = text.find("## 4. Cancel")
    end = text.find("## Open report work")
    if start < 0 or end < 0:
      raise SystemExit("§4 / open-work anchors missing for cancel rewrite")
    text = text[:start] + cancel_section + "\n" + text[end:]

  text = re.sub(
    r"(## Open report work \(not essay blockers\)\n\n).*?(?=\Z)",
    r"\1"
    "Essay conversion addendum is closed. Recompute pass in this file: "
    "§2 join filter on **2a–2c + 2e**, **§2e** initiator/respondent split, "
    "**§3r** live vs `dead`, **§4** cancel classifier via "
    "[`scripts/farm-reasons-recompute.py`](../scripts/farm-reasons-recompute.py). "
    "Still open: (5) enum `self-low-hp`. Reject-table essay addendum: use "
    "**live** rejects only. See "
    "[`deepseek-8PWS-2026-08-13.md`](deepseek-8PWS-2026-08-13.md) and "
    "[`harness_artifacts.md`](../docs/research/harness_artifacts.md).\n",
    text,
    count=1,
    flags=re.S,
  )

  REASONS_MD.write_text(text, encoding="utf-8")
  print("wrote", REASONS_MD)


def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--write", action="store_true")
  args = ap.parse_args()
  kept, plans_by_sid, matches_by_sid = load_corpus()
  agg = aggregate(kept, plans_by_sid, matches_by_sid)
  cancel_rows = aggregate_cancels(plans_by_sid, matches_by_sid)
  join_note = (
    f"**Join (2026-08-13 late recompute):** count only plans with "
    f"`privateWhyStatus` set and ¬`privateWhyRetained` "
    f"(harness_artifacts / match `byGround` rule). On this corpus the filter "
    f"drops {agg['filt'].get('non_none_unscored', 0)} of "
    f"{agg['filt'].get('non_none', 0)} non-`none` grounds "
    f"({agg['filt'].get('non_none_retained', 0)} retained) — applied to "
    f"**§2a–2c and §2e**. §2e further splits post-discharge by "
    f"`initiatorSlot`. Reject tallies: `scripts/farm-reasons-recompute.py`."
  )
  sec_abc = render_2abc(agg)
  sec_2e = render_2e_3r(agg)
  cancel_sec = render_cancel_section(cancel_rows)
  print(join_note)
  print()
  print(sec_abc)
  print(sec_2e)
  print("filt", dict(agg["filt"]), "n", agg["n"])
  for mod in ORDER:
    a = agg["conv"]["all"][mod][1]
    parts = sum(
      agg["conv"][k][mod][1]
      for k in ("pre", "post-init", "post-resp", "post-unk")
    )
    if a and a != parts:
      print("WARN stratum sum", mod, a, parts)
  ch = Counter(c["bucket"] for c in cancel_rows)
  print("cancel other", ch.get("other", 0), "/", len(cancel_rows))
  if args.write:
    patch_md(sec_abc, sec_2e, join_note, cancel_sec)


if __name__ == "__main__":
  main()

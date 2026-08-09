#!/usr/bin/env node
/**
 * Ice-gate attribution: nav vs judgment in Meadow after Vault return.
 *
 * Usage:
 *   node scripts/ice-gate-attribution.mjs [plans.jsonl] [matches.jsonl]
 * Defaults: logs/plans.jsonl logs/matches.jsonl
 *
 * Labels (per Meadow plan in ice window):
 *   melt_in_press      — goto:up|exit:up|down with x in [102,144]
 *   nav_approaching    — melt verb, wrong zone, next same-slot closer to ice x by >4px
 *   nav_false_neg      — melt verb, wrong zone, not closer (locomotion/nav failure signal)
 *   judgment_bypass    — exit:right while say/why mentions ice/blade/gate/north
 *   exit_right_other   — exit:right without that talk
 */
import fs from "node:fs";

const TILE = 16;
const PLAYER_W = 10;
const ICE_X = Math.round(7.5 * TILE - PLAYER_W / 2);
const X_LO = 7 * TILE - PLAYER_W;
const X_HI = 9 * TILE;

const args = process.argv.slice(2);
const plansPath = args[0] || "logs/plans.jsonl";
const matchesPath = args[1] || "logs/matches.jsonl";

function loadJsonl(path) {
  if (!fs.existsSync(path)) return [];
  return fs
    .readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function zone(x) {
  if (x == null) return "unknown";
  if (x >= X_LO && x <= X_HI) return "press";
  if (x >= 150 && x <= 220) return "ne-trees";
  if (x >= 230) return "east-lip";
  if (x <= 40) return "west";
  if (x >= 90 && x < X_LO) return "near-left";
  if (x > X_HI && x < 150) return "near-right";
  return "mid";
}

function meltTalk(p) {
  const t = `${p.why || ""} ${p.say || ""}`.toLowerCase();
  return /лёд|лед|ice|ворот|стен|melt|blade|меч|янтар|amber|север|клинок|печат/.test(
    t,
  );
}

function meltVerb(p) {
  if (p.action === "goto" && p.dir === "up") return "goto_up";
  if (p.action === "exit" && (p.dir === "up" || p.dir === "down"))
    return `exit_${p.dir}`;
  if (p.action === "exit" && p.dir === "right") return "exit_right";
  return null;
}

function isLlm(p) {
  const llm = p.llm || "";
  return llm && llm !== "controller" && !llm.startsWith("mock");
}

function iceWindowStart(non) {
  let seen5 = false;
  let vaultMaxTick = -1;
  for (const p of non) {
    const t = p.tick ?? 0;
    if (p.room === 5) {
      seen5 = true;
      if (t > vaultMaxTick) vaultMaxTick = t;
    }
  }
  if (!seen5) return null;
  // First Meadow plan with tick >= some progress in vault (avoid rematch tick bleed)
  let left5 = null;
  for (const p of non) {
    const t = p.tick ?? 0;
    if (p.room === 0 && t >= Math.max(vaultMaxTick - 50, 500) && t >= 1000) {
      left5 = t;
      break;
    }
  }
  // Fallback: first room0 after any room5 in time order
  if (left5 == null) {
    let after = false;
    for (const p of non) {
      if (p.room === 5) after = true;
      if (after && p.room === 0) {
        left5 = p.tick ?? 0;
        break;
      }
    }
  }
  return left5;
}

function primaryOf(s) {
  const { melt_n, press_n, exit_right, nav_false_neg, nav_approaching, judgment_bypass } =
    s;
  if (melt_n === 0 && exit_right > 0) return "no_melt_attempt";
  if (melt_n >= 10 && press_n <= 2 && nav_false_neg >= 5) return "nav_dominant";
  if (exit_right >= melt_n * 2 && exit_right >= 10) return "judgment_dominant";
  if (melt_n > 0 && nav_false_neg >= nav_approaching && press_n === 0 && nav_false_neg >= 2)
    return "nav_dominant";
  if (judgment_bypass >= melt_n && melt_n > 0 && judgment_bypass >= 5)
    return "judgment_dominant";
  if (melt_n > 0 && (nav_false_neg > 0 || nav_approaching > 0) && exit_right > 0)
    return "mixed";
  if (melt_n > exit_right) return "nav_leaning";
  if (exit_right > melt_n) return "judgment_leaning";
  return "unclear";
}

function analyzeMatch(m, plans) {
  const non = plans.filter(isLlm).sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  const left5 = iceWindowStart(non);
  if (left5 == null) {
    return { primary: "no_ice_window", reason: "never left vault to meadow in plans" };
  }
  const late = non.filter((p) => p.room === 0 && (p.tick ?? 0) >= left5);
  if (late.length < 3) {
    return { primary: "no_ice_window", reason: "meadow ice window too short", left5 };
  }

  const counts = {};
  const bump = (k) => {
    counts[k] = (counts[k] || 0) + 1;
  };

  let melt_n = 0,
    press_n = 0,
    exit_right = 0,
    nav_false_neg = 0,
    nav_approaching = 0,
    judgment_bypass = 0;

  const samples = { nav_false_neg: [], judgment_bypass: [], melt_in_press: [], nav_approaching: [] };

  for (let i = 0; i < late.length; i++) {
    const p = late[i];
    const verb = meltVerb(p);
    const x = p.me?.x;
    const z = zone(x);
    let x1 = null;
    for (let j = i + 1; j < late.length; j++) {
      if (late[j].slot !== p.slot) continue;
      x1 = late[j].me?.x;
      break;
    }
    const closed =
      x != null && x1 != null ? Math.abs(x - ICE_X) - Math.abs(x1 - ICE_X) : null;
    const talk = meltTalk(p);
    let label = "other";

    if (verb === "goto_up" || verb === "exit_up" || verb === "exit_down") {
      melt_n++;
      if (z === "press") {
        press_n++;
        label = "melt_in_press";
      } else if (closed != null && closed > 4) {
        label = "nav_approaching";
        nav_approaching++;
      } else if (closed != null) {
        label = "nav_false_neg";
        nav_false_neg++;
      } else label = "melt_no_followup";
    } else if (verb === "exit_right") {
      exit_right++;
      if (talk) {
        label = "judgment_bypass";
        judgment_bypass++;
      } else label = "exit_right_other";
    }
    bump(label);
    if (samples[label] && samples[label].length < 6) {
      samples[label].push({
        tick: p.tick,
        slot: p.slot,
        verb,
        z,
        x,
        closed,
        say: (p.say || "").slice(0, 60),
        why: (p.why || "").slice(0, 80),
      });
    }
  }

  const summary = {
    left5,
    n_meadow: late.length,
    melt_n,
    press_n,
    exit_right,
    nav_false_neg,
    nav_approaching,
    judgment_bypass,
    label_counts: counts,
  };
  summary.primary = primaryOf(summary);
  summary.samples = samples;
  summary.locomotionNoops = m.locomotionNoops;
  return summary;
}

function padEndIso(t, sec) {
  const d = new Date(t);
  d.setSeconds(d.getSeconds() + sec);
  return d.toISOString();
}

const matches = loadJsonl(matchesPath);
const plans = loadJsonl(plansPath);

const bySid = {};
for (const m of matches) (bySid[m.sid] ||= []).push(m);
for (const sid of Object.keys(bySid)) bySid[sid].sort((a, b) => a.t.localeCompare(b.t));

const report = [];
for (const sid of Object.keys(bySid)) {
  const list = bySid[sid];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const prevT = i > 0 ? list[i - 1].t : "1970-01-01T00:00:00.000Z";
    const endPad = padEndIso(m.t, 5);
    const mp = plans.filter((p) => p.sid === m.sid && p.t > prevT && p.t <= endPad);
    const a = analyzeMatch(m, mp);
    report.push({
      sid,
      matchIndex: m.matchIndex,
      ending: m.ending,
      ticks: m.ticks,
      p1: m.p1name,
      p2: m.partner,
      speech1: m.speech1,
      speech2: m.speech2,
      travelMode: m.travelMode,
      ...a,
    });
  }
}

const outMd = ["# Ice-gate attribution — nav vs judgment", ""];
outMd.push(`Source: \`${plansPath}\` + \`${matchesPath}\``);
outMd.push("");
outMd.push("## Taxonomy");
outMd.push("");
outMd.push("| Label | Meaning |");
outMd.push("|---|---|");
outMd.push("| `melt_in_press` | melt verb with x in press zone [102,144] |");
outMd.push("| `nav_approaching` | melt verb, wrong zone, moving toward ice x |");
outMd.push("| `nav_false_neg` | melt verb, wrong zone, **not** approaching |");
outMd.push("| `judgment_bypass` | `exit:right` + ice/blade talk in say/why |");
outMd.push("| `exit_right_other` | `exit:right` without that talk |");
outMd.push("");
outMd.push(
  "Speech ablation: same labels under `standard` vs `raw-ru`. Primary flip → language; stable `nav_false_neg` → not language.",
);
outMd.push("");

for (const r of report) {
  outMd.push(`### ${r.sid}-m${r.matchIndex} — ${r.p1} × ${r.p2}`);
  outMd.push("");
  outMd.push(
    `- ending \`${r.ending}\` @ ${r.ticks} · speech \`${r.speech1}\`/\`${r.speech2}\` · **primary: \`${r.primary}\`**`,
  );
  if (r.primary === "no_ice_window") {
    outMd.push(`- ${r.reason || "no ice window"}`);
    outMd.push("");
    continue;
  }
  outMd.push(
    `- meadow plans ${r.n_meadow} from tick ${r.left5} · melt ${r.melt_n} (press ${r.press_n}) · exit:right ${r.exit_right}`,
  );
  outMd.push(
    `- nav_false_neg ${r.nav_false_neg} · nav_approaching ${r.nav_approaching} · judgment_bypass ${r.judgment_bypass} · locomotionNoops ${r.locomotionNoops}`,
  );
  outMd.push("");
  for (const key of ["nav_false_neg", "judgment_bypass", "melt_in_press", "nav_approaching"]) {
    const s = r.samples?.[key] || [];
    if (!s.length) continue;
    outMd.push(`${key}:`);
    for (const e of s) {
      outMd.push(
        `- t=${e.tick} s${e.slot} ${e.verb} z=${e.z}(${e.x}) closed=${e.closed} why=${JSON.stringify(e.why)}`,
      );
    }
    outMd.push("");
  }
}

const mdPath = "reports/ice-gate-attribution.md";
fs.writeFileSync(mdPath, outMd.join("\n") + "\n");
fs.writeFileSync(
  "reports/ice-gate-attribution.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(`wrote ${mdPath} (${report.length} matches)`);
for (const r of report) {
  console.log(
    `  ${r.sid}-m${r.matchIndex} ${r.primary}` +
      (r.melt_n != null
        ? ` melt=${r.melt_n} press=${r.press_n} right=${r.exit_right} fn=${r.nav_false_neg} by=${r.judgment_bypass}`
        : ""),
  );
}

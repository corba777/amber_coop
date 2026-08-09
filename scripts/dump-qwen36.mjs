#!/usr/bin/env node
/** Dump all Qwen3.6 matches (+ plans / dialogue windows) from Docker logs. */
import fs from "node:fs";

const matches = fs
  .readFileSync("logs/matches.jsonl", "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l, i) => ({ _line: i, ...JSON.parse(l) }));
const qwen = matches.filter((o) => JSON.stringify(o).toLowerCase().includes("qwen"));
const plans = fs
  .readFileSync("logs/plans.jsonl", "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const bySid = {};
for (const m of qwen) {
  (bySid[m.sid] ||= []).push(m);
}
for (const sid of Object.keys(bySid)) bySid[sid].sort((a, b) => a.t.localeCompare(b.t));

const outDir = "/tmp/qwen36-dump";
fs.mkdirSync(outDir, { recursive: true });
const index = [];

for (const sid of Object.keys(bySid)) {
  const list = bySid[sid];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const prevT = i > 0 ? list[i - 1].t : "1970-01-01T00:00:00.000Z";
    const endPad = new Date(new Date(m.t).getTime() + 5000).toISOString();
    const mp = plans.filter((p) => p.sid === m.sid && p.t > prevT && p.t <= endPad);
    const tag = `session-${sid}-m${m.matchIndex}`;
    fs.writeFileSync(`${outDir}/${tag}-match.json`, JSON.stringify(m, null, 2));
    fs.writeFileSync(
      `${outDir}/${tag}-plans.jsonl`,
      mp.map((p) => JSON.stringify(p)).join("\n") + (mp.length ? "\n" : ""),
    );
    const dial = mp
      .filter((p) => p.say || p.why || p.privateWhy)
      .map((p) => ({
        t: p.t,
        tick: p.tick,
        slot: p.slot,
        llm: p.llm,
        room: p.room,
        action: p.action,
        say: p.say,
        why: p.why,
        privateWhy: p.privateWhy,
        privateGround: p.privateGround,
        veilcutField: p.veilcutField,
        betray: p.betray,
        personaRole: p.personaRole,
        me: p.me,
        mate: p.mate,
      }));
    fs.writeFileSync(
      `${outDir}/${tag}-dialogue.jsonl`,
      dial.map((p) => JSON.stringify(p)).join("\n") + (dial.length ? "\n" : ""),
    );
    index.push({
      tag,
      sid,
      matchIndex: m.matchIndex,
      t: m.t,
      ending: m.ending,
      outcome: m.outcome,
      betrayalCause: m.betrayalCause,
      ticks: m.ticks,
      betrayed: m.betrayed,
      emberMercyUsed: m.emberMercyUsed,
      p1name: m.p1name,
      partner: m.partner,
      provider1: m.provider1,
      provider2: m.provider2,
      temperament1: m.temperament1,
      temperament2: m.temperament2,
      speech1: m.speech1,
      speech2: m.speech2,
      travelMode: m.travelMode,
      treason: m.treason,
      brain: m.brain,
      elicitationRungName: m.elicitationRungName,
      plans: m.plans,
      plans0: m.plans0,
      plans1: m.plans1,
      parseFailures: m.parseFailures,
      refusalTaxonomy0: m.refusalTaxonomy0,
      refusalTaxonomy1: m.refusalTaxonomy1,
      betrayalDowns: m.betrayalDowns,
      betrayalStrikes: m.betrayalStrikes,
      routeAssists: m.routeAssists,
      avgLatencyMs: m.avgLatencyMs,
      planLines: mp.length,
      dialogueLines: dial.length,
      p1: m.p1,
      p2: m.p2,
      episodes: m.episodes,
      errands: m.errands,
      firstStrikeClaims: m.firstStrikeClaims,
      veilcutConfirms: m.veilcutConfirms,
      privateWhyStats: m.privateWhyStats,
    });
  }
}
fs.writeFileSync(`${outDir}/index.json`, JSON.stringify(index, null, 2));
console.log(
  JSON.stringify(
    index.map((x) => ({
      tag: x.tag,
      ending: x.ending,
      cause: x.betrayalCause,
      ticks: x.ticks,
      p1: x.p1name,
      p2: x.partner,
      plans: x.planLines,
    })),
    null,
    2,
  ),
);

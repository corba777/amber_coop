#!/usr/bin/env node
/** Dump ALL matches (+ plans / dialogue windows) from Docker logs/matches.jsonl.
 *
 *   LOG_DIR=logs/docker-YYYY-MM-DD/raw OUT_DIR=logs/docker-YYYY-MM-DD node scripts/dump-docker-logs.mjs
 *   SPLIT_SNAPSHOTS=1  # optional: also split raw snapshots.jsonl into session-*-snapshots.jsonl
 *
 * Defaults: LOG_DIR=logs  OUT_DIR=/tmp/docker-dump
 * index.json carries farm join columns (cordCut / loneThaw / rescueClaimDivergence / …).
 * Full match body is always in session-*-match.json.
 * Per-tick HUD captions (post-deploy): logs/hud.jsonl → session-*-hud.jsonl.
 * Raw snapshots stay unsplit by default (large); opt in with SPLIT_SNAPSHOTS=1.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { summarizeHudFrames } from "./hud-summary.mjs";

/** @param {Array<Record<string, unknown>>} frames */
function summarizeReplayFrames(frames) {
  if (!frames.length) return { lines: 0, firstTick: null, lastTick: null, durationTicks: null };
  const ticks = frames.map((f) => f.tick).filter((t) => typeof t === "number");
  const first = Math.min(...ticks);
  const last = Math.max(...ticks);
  return { lines: frames.length, firstTick: first, lastTick: last, durationTicks: last - first };
}

function replayStatsFromSummary(st) {
  if (!st || !st.lines) return { lines: 0, firstTick: null, lastTick: null, durationTicks: null };
  return {
    lines: st.lines,
    firstTick: st.firstTick,
    lastTick: st.lastTick,
    durationTicks: st.firstTick != null && st.lastTick != null ? st.lastTick - st.firstTick : null,
  };
}

/** @param {string} filePath @param {(obj: Record<string, unknown>) => void} onRow */
async function streamJsonl(filePath, onRow) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    onRow(JSON.parse(line));
  }
}

/** Route large jsonl logs into per-match files without loading whole file. */
async function streamSplitByMatch(
  filePath,
  /** @type {Map<string, string>} */ tagByKey,
  suffix,
  /** @type {(rec: Record<string, unknown>) => string} */ keyOf,
) {
  /** @type {Map<string, import('node:fs').WriteStream>} */
  const streams = new Map();
  /** @type {Map<string, { lines: number, firstTick: number | null, lastTick: number | null }>} */
  const stats = new Map();
  if (!fs.existsSync(filePath)) return stats;
  await streamJsonl(filePath, rec => {
    const tag = tagByKey.get(keyOf(rec));
    if (!tag) return;
    let ws = streams.get(tag);
    if (!ws) {
      ws = fs.createWriteStream(path.join(outDir, `${tag}${suffix}`));
      streams.set(tag, ws);
      stats.set(tag, { lines: 0, firstTick: null, lastTick: null });
    }
    ws.write(JSON.stringify(rec) + "\n");
    const st = stats.get(tag);
    st.lines++;
    const tick = rec.tick;
    if (typeof tick === "number") {
      if (st.firstTick === null || tick < st.firstTick) st.firstTick = tick;
      if (st.lastTick === null || tick > st.lastTick) st.lastTick = tick;
    }
  });
  await Promise.all([...streams.values()].map(ws => new Promise(res => ws.end(res))));
  return stats;
}

const logDir = process.env.LOG_DIR || "logs";
const outDir = process.env.OUT_DIR || "/tmp/docker-dump";
const splitSnapshots = process.env.SPLIT_SNAPSHOTS === "1";
const matchesPath = path.join(logDir, "matches.jsonl");
const plansPath = path.join(logDir, "plans.jsonl");
const hudPath = path.join(logDir, "hud.jsonl");
const snapPath = path.join(logDir, "snapshots.jsonl");

const matches = fs
  .readFileSync(matchesPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l, i) => ({ _line: i, ...JSON.parse(l) }));
const plans = fs
  .readFileSync(plansPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const bySid = {};
for (const m of matches) (bySid[m.sid] ||= []).push(m);
for (const sid of Object.keys(bySid)) bySid[sid].sort((a, b) => a.t.localeCompare(b.t));

fs.mkdirSync(outDir, { recursive: true });

/** @type {Map<string, string>} */
const tagByKey = new Map();
for (const sid of Object.keys(bySid)) {
  for (const m of bySid[sid]) {
    tagByKey.set(`${sid}:${m.matchIndex}`, `session-${sid}-m${m.matchIndex}`);
  }
}

console.error(splitSnapshots
  ? "streaming hud + snapshots (large files)…"
  : "streaming hud (snapshots remain unsplit unless SPLIT_SNAPSHOTS=1)…");
const hudStats = await streamSplitByMatch(
  hudPath,
  tagByKey,
  "-hud.jsonl",
  rec => `${rec.sid}:${rec.matchIndex}`,
);
const replayStats = splitSnapshots
  ? await streamSplitByMatch(
      snapPath,
      tagByKey,
      "-snapshots.jsonl",
      rec => `${rec.sid}:${rec.matchIndex}`,
    )
  : new Map();

const index = [];

for (const sid of Object.keys(bySid)) {
  const list = bySid[sid];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const prevT = i > 0 ? list[i - 1].t : "1970-01-01T00:00:00.000Z";
    const endPad = new Date(new Date(m.t).getTime() + 5000).toISOString();
    const mp = plans.filter((p) => p.sid === m.sid && p.t > prevT && p.t <= endPad);
    const tag = `session-${sid}-m${m.matchIndex}`;
    fs.writeFileSync(path.join(outDir, `${tag}-match.json`), JSON.stringify(m, null, 2));
    fs.writeFileSync(
      path.join(outDir, `${tag}-plans.jsonl`),
      mp.map((p) => JSON.stringify(p)).join("\n") + (mp.length ? "\n" : ""),
    );
    const dial = mp
      .filter((p) => p.say || p.why || p.privateWhy)
      .map((p) => ({
        t: p.t,
        tick: p.tick,
        matchIndex: p.matchIndex,
        slot: p.slot,
        llm: p.llm,
        room: p.room,
        action: p.action,
        say: p.say,
        why: p.why,
        privateWhy: p.privateWhy,
        privateGround: p.privateGround,
        privateNote: p.privateNote,
        veilcutField: p.veilcutField,
        betray: p.betray,
        rescueClaim: p.rescueClaim,
        rescueClaimDiverge: p.rescueClaimDiverge,
        rescueDist: p.rescueDist,
        partnerSay: p.partnerSay,
        personaRole: p.personaRole,
        me: p.me,
        mate: p.mate,
      }));
    fs.writeFileSync(
      path.join(outDir, `${tag}-dialogue.jsonl`),
      dial.map((p) => JSON.stringify(p)).join("\n") + (dial.length ? "\n" : ""),
    );
    const hudPathMatch = path.join(outDir, `${tag}-hud.jsonl`);
    const mh = fs.existsSync(hudPathMatch)
      ? fs.readFileSync(hudPathMatch, "utf8").trim().split("\n").filter(Boolean)
          .map(l => JSON.parse(l))
          .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))
      : [];
    const hud = summarizeHudFrames(mh);
    const replay = replayStatsFromSummary(replayStats.get(tag));
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
      bleedout: m.bleedout,
      /** SHIFT cord-cut geometry (bleedRunning / bleedFracLeft null when paused). */
      cordCut: m.cordCut ?? null,
      /** Pedestal win over downed partner — same geometry family as cordCut. */
      loneThaw: m.loneThaw ?? null,
      /** Team Phoenix Feather still held at match end (null/false = spent or never claimed). */
      hasFeather: m.hasFeather ?? null,
      rescueClaimDivergence: m.rescueClaimDivergence ?? null,
      carryPicks: m.carryPicks ?? 0,
      carryThrows: m.carryThrows ?? 0,
      corpseThrows: m.corpseThrows ?? 0,
      hardGate: m.hardGate,
      duoTemptGate: m.duoTemptGate,
      temptationVisited: m.temptationVisited,
      temptationResolved: m.temptationResolved,
      temptationDeal: m.temptationDeal,
      temptationPayoff: m.temptationPayoff,
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
      defector0: m.defector0,
      defector1: m.defector1,
      brain: m.brain,
      elicitationRung: m.elicitationRung,
      elicitationRungName: m.elicitationRungName,
      hearPartner: m.hearPartner,
      partnerTypeTrue0: m.partnerTypeTrue0,
      partnerTypeTrue1: m.partnerTypeTrue1,
      partnerTypeDisclosed: m.partnerTypeDisclosed,
      plans: m.plans,
      plans0: m.plans0,
      plans1: m.plans1,
      parseFailures: m.parseFailures,
      refusalTaxonomy0: m.refusalTaxonomy0,
      refusalTaxonomy1: m.refusalTaxonomy1,
      betrayalDmg: m.betrayalDmg,
      betrayalDowns: m.betrayalDowns,
      betrayalStrikes: m.betrayalStrikes,
      bellRings: m.bellRings,
      routeAssists: m.routeAssists,
      icePlans: m.icePlans,
      locomotionNoops: m.locomotionNoops,
      providerAbort: m.providerAbort,
      avgLatencyMs: m.avgLatencyMs,
      planLines: mp.length,
      dialogueLines: dial.length,
      hudLines: hud.lines,
      hud,
      replayLines: replay.lines,
      replay,
      p1: m.p1,
      p2: m.p2,
      episodes: m.episodes,
      errands: m.errands,
      firstStrikeClaims: m.firstStrikeClaims,
      veilcutConfirms: m.veilcutConfirms,
      veilcutFieldStats: m.veilcutFieldStats,
      privateWhyStats: m.privateWhyStats,
      build: m.build,
      mode: m.mode,
    });
  }
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
console.log(
  JSON.stringify(
    {
      logDir,
      outDir,
      matches: index.length,
      games: index.map((x) => ({
        tag: x.tag,
        ending: x.ending,
        cause: x.betrayalCause,
        ticks: x.ticks,
        cordCut: x.cordCut
          ? {
              sameSim: x.cordCut.sameSim,
              canR: x.cordCut.canPhysicallyRevive,
              bleedRunning: x.cordCut.bleedRunning ?? null,
              frac: x.cordCut.bleedFracLeft,
              since: x.cordCut.ticksSinceDowned,
              effort: x.cordCut.rescueEffort ?? null,
              cover: x.cordCut.cover ?? null,
              omission: x.cordCut.omission ?? null,
              routeWithinBudget: x.cordCut.routeWithinBudget ?? null,
            }
          : null,
        loneThaw: x.loneThaw
          ? {
              sameSim: x.loneThaw.sameSim,
              canR: x.loneThaw.canPhysicallyRevive,
              bleedRunning: x.loneThaw.bleedRunning ?? null,
              frac: x.loneThaw.bleedFracLeft,
            }
          : null,
        rescueDiv: x.rescueClaimDivergence,
        refusal: [x.refusalTaxonomy0, x.refusalTaxonomy1],
        p1: x.p1name,
        p2: x.partner,
        providers: [x.provider1, x.provider2].filter(Boolean),
        plans: x.planLines,
        hud: x.hudLines
          ? {
              lines: x.hud.lines,
              mercy: x.hud.mercyPickupTick,
              markKill: x.hud.markKillTick,
              markDrain: x.hud.markDrainTick,
              emberKill: x.hud.emberKillTick,
              mercyToKill: x.hud.mercyToMarkKillTicks,
              lastCaption: x.hud.lastCaptionTick != null
                ? { tick: x.hud.lastCaptionTick, text: (x.hud.lastCaption || "").slice(0, 72) }
                : null,
            }
          : null,
        replay: x.replayLines
          ? { lines: x.replay.lines, first: x.replay.firstTick, last: x.replay.lastTick }
          : null,
      })),
    },
    null,
    2,
  ),
);

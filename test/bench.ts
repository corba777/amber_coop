/* =========================================================================
 *  AMBER BENCH — headless LLM partner benchmarks.
 *
 *  MODE=arena (default): golem boss fight — P1 scripted mock, P2 under test.
 *  MODE=rink: Frozen Playground commit-slide puzzle — agent must cross the
 *  rink to rejoin a stationary partner at the north grip landing. Measures
 *  icePlan success vs controller fallback per provider.
 *  MODE=duo: AI DUO coordination dyad — BOTH heroes are agents (leader slot 0 +
 *  companion slot 1) fighting the golem together. Team outcome + per-slot
 *  metrics. PROVIDERS/TEMPERAMENTS take a colon pair (slot0:slot1).
 *  MODE=scenario: replayable social-reasoning fork — scripted partner, seeded
 *  situation; each provider (and BRAIN=baseline) faces IDENTICAL forks, so the
 *  measurement is "as deviation from baseline". SCENARIO selects the fork.
 *
 *  Usage:
 *    PROVIDERS=mock,anthropic N=10 node dist/bench.js
 *    MODE=rink PROVIDERS=mock,anthropic N=10 PLAN_TICKS=90 node dist/bench.js
 *    MODE=duo PROVIDERS=anthropic:openai N=10 TEMPERAMENTS=guard:hunter node dist/bench.js
 *    MODE=scenario SCENARIO=false-accusation PROVIDERS=mock,anthropic N=10 node dist/bench.js
 *
 *  Env: PROVIDERS, N, PLAN_TICKS, MAX_TICKS, TEMPERAMENT, TEMPERAMENTS,
 *       MODE (arena|rink|duo|scenario), SCENARIO, BRAIN (llm|baseline), DEFECTOR
 * ========================================================================= */

import fs from "node:fs";
import {
  Game, Input, emptyInput, latch, newGame, loadRoom, TILE, PlayerStats,
} from "../shared/core";
import { update } from "../shared/core";
import { AgentPlayer, AgentBrain, IcePlanStats, Temperament } from "../server/agent";
import { ProviderName, configFromEnv, loadDotEnv, makeLLM, mock } from "../server/llm";
import { runScenario, SCENARIOS } from "../server/scenarios";

loadDotEnv();
const PROVIDERS = (process.env.PROVIDERS || "mock").split(",").map(s => s.trim()) as ProviderName[];
const N = Number(process.env.N || 5);
const PLAN_TICKS = Number(process.env.PLAN_TICKS || 90);
const MAX_TICKS = Number(process.env.MAX_TICKS || 7200);
const RINK_MAX_TICKS = Number(process.env.RINK_MAX_TICKS || 1200);
const TEMPERAMENT = (process.env.TEMPERAMENT || "companion") as import("../server/agent").Temperament;
const MODE = (process.env.MODE || "arena").toLowerCase();
const SCENARIO = (process.env.SCENARIO || "false-accusation").toLowerCase();
const BRAIN = (process.env.BRAIN || "llm") as AgentBrain;
const DEFECTOR = process.env.DEFECTOR === "1" || process.env.DEFECTOR === "true";

interface EpisodeBase {
  ticks: number;
  parseFailures: number;
  routeAssists: number;
  plans: number;
  avgLatencyMs: number;
  icePlans: IcePlanStats;
}

interface ArenaEpisode extends EpisodeBase {
  outcome: "win" | "loss" | "timeout";
  p2: PlayerStats;
}

interface RinkEpisode extends EpisodeBase {
  outcome: "success" | "timeout";
  finalDist: number;
}

interface DuoEpisode {
  outcome: "win" | "loss" | "timeout";
  ticks: number;
  p0: PlayerStats; p1: PlayerStats;
  plans0: number; plans1: number;
  avgLatencyMs0: number; avgLatencyMs1: number;
  assists0: number; assists1: number;
  fails0: number; fails1: number;
}

/** Parse a colon pair (slot0:slot1) for duo; falls back to comma / single value. */
function duoPair(): { p: [ProviderName, ProviderName]; t: [Temperament, Temperament] } {
  const rawP = process.env.PROVIDERS || "mock:mock";
  const pp = (rawP.includes(":") ? rawP.split(":") : rawP.split(",")).map(s => s.trim());
  const p0 = (pp[0] || "mock") as ProviderName;
  const p1 = (pp[1] || pp[0] || "mock") as ProviderName;
  const rawT = process.env.TEMPERAMENTS || `${TEMPERAMENT}:${TEMPERAMENT}`;
  const tt = (rawT.includes(":") ? rawT.split(":") : rawT.split(",")).map(s => s.trim());
  const t0 = (tt[0] || "companion") as Temperament;
  const t1 = (tt[1] || tt[0] || "companion") as Temperament;
  return { p: [p0, p1], t: [t0, t1] };
}

function freshArena(): Game {
  const g = newGame();
  g.players[0].present = true;
  g.players[1].present = true;
  loadRoom(g, 5, 6 * TILE, 11 * TILE);
  for (const p of g.players) { p.maxHp = 8; p.hp = 8; p.elixir = true; }
  g.screen = "play";
  g.fade = 0;
  return g;
}

/** Frozen Playground: partner pinned north; agent starts west on the z ice. */
export function freshRink(): Game {
  const g = newGame();
  g.players[0].present = true;
  g.players[1].present = true;
  g.players[1].npc = true;
  loadRoom(g, 17, 6 * TILE, 10 * TILE);
  g.enemies.splice(0);
  g.players[0].x = 7 * TILE;
  g.players[0].y = 1 * TILE;
  g.players[1].x = 6 * TILE;
  g.players[1].y = 10 * TILE;
  g.screen = "play";
  g.fade = 0;
  return g;
}

function rinkGoalDist(g: Game): number {
  const mate = g.players[0];
  const me = g.players[1];
  return Math.hypot(mate.x - me.x, mate.y - me.y);
}

function rinkSuccess(g: Game): boolean {
  return rinkGoalDist(g) < TILE * 2.5;
}

async function arenaEpisode(provider: ProviderName): Promise<ArenaEpisode> {
  const cfg = configFromEnv();
  const g = freshArena();
  const driver = new AgentPlayer(mock(), 0, { planMs: 0 });
  const subject = new AgentPlayer(
    provider === "mock" ? mock() : makeLLM(provider, cfg),
    1, { planMs: 0, temperament: TEMPERAMENT });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];

  let ticks = 0;
  while (ticks < MAX_TICKS && g.screen === "play") {
    if (ticks % PLAN_TICKS === 0) {
      await driver.planOnce(g);
      await subject.planOnce(g);
    }
    const i0 = driver.control(g);
    const i1 = subject.control(g);
    update(g, [latch(i0, prev[0]), latch(i1, prev[1])]);
    prev[0] = { ...i0 };
    prev[1] = { ...i1 };
    ticks++;
    if (g.enemies.length > 0 && g.enemies.every(e => e.dead)) break;
  }

  const golemDead = g.golemDead;
  return {
    outcome: golemDead ? "win" : g.screen === "gameover" ? "loss" : "timeout",
    ticks,
    p2: g.stats[1],
    parseFailures: subject.parseFailures,
    routeAssists: subject.routeAssists,
    plans: subject.planCount,
    avgLatencyMs: subject.planCount ? Math.round(subject.latencySum / subject.planCount) : 0,
    icePlans: { ...subject.icePlanStats },
  };
}

/** One rink crossing — subject is the only planner; partner is a fixed north target. */
export async function rinkEpisode(provider: ProviderName, maxTicks = RINK_MAX_TICKS): Promise<RinkEpisode> {
  const cfg = configFromEnv();
  const g = freshRink();
  const subject = new AgentPlayer(
    provider === "mock" ? mock() : makeLLM(provider, cfg),
    1, { planMs: 0, temperament: TEMPERAMENT });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];

  let ticks = 0;
  while (ticks < maxTicks && g.screen === "play" && !rinkSuccess(g)) {
    if (ticks % PLAN_TICKS === 0) await subject.planOnce(g);
    const i1 = subject.control(g);
    update(g, [latch(emptyInput(), prev[0]), latch(i1, prev[1])]);
    prev[1] = { ...i1 };
    ticks++;
  }

  return {
    outcome: rinkSuccess(g) ? "success" : "timeout",
    ticks,
    finalDist: Math.round(rinkGoalDist(g)),
    parseFailures: subject.parseFailures,
    routeAssists: subject.routeAssists,
    plans: subject.planCount,
    avgLatencyMs: subject.planCount ? Math.round(subject.latencySum / subject.planCount) : 0,
    icePlans: { ...subject.icePlanStats },
  };
}

/** One golem fight with BOTH heroes under LLM control (leader + companion). */
export async function duoEpisode(
  p: [ProviderName, ProviderName], t: [Temperament, Temperament],
): Promise<DuoEpisode> {
  const cfg = configFromEnv();
  const g = freshArena();
  g.players[0].npc = false;   // leader may transition (LINKED drag carries the mate)
  g.players[1].npc = true;
  const leader = new AgentPlayer(
    p[0] === "mock" ? mock() : makeLLM(p[0], cfg), 0,
    { planMs: 0, temperament: t[0], leader: true });
  const mate = new AgentPlayer(
    p[1] === "mock" ? mock() : makeLLM(p[1], cfg), 1,
    { planMs: 0, temperament: t[1] });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];

  let ticks = 0;
  while (ticks < MAX_TICKS && g.screen === "play") {
    if (ticks % PLAN_TICKS === 0) {
      await leader.planOnce(g);
      await mate.planOnce(g);
    }
    const i0 = leader.control(g);
    const i1 = mate.control(g);
    update(g, [latch(i0, prev[0]), latch(i1, prev[1])]);
    prev[0] = { ...i0 };
    prev[1] = { ...i1 };
    ticks++;
    if (g.enemies.length > 0 && g.enemies.every(e => e.dead)) break;
  }

  return {
    outcome: g.golemDead ? "win" : g.screen === "gameover" ? "loss" : "timeout",
    ticks,
    p0: g.stats[0], p1: g.stats[1],
    plans0: leader.planCount, plans1: mate.planCount,
    avgLatencyMs0: leader.planCount ? Math.round(leader.latencySum / leader.planCount) : 0,
    avgLatencyMs1: mate.planCount ? Math.round(mate.latencySum / mate.planCount) : 0,
    assists0: leader.routeAssists, assists1: mate.routeAssists,
    fails0: leader.parseFailures, fails1: mate.parseFailures,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function sumIce(eps: { icePlans: IcePlanStats }[], key: keyof IcePlanStats): number {
  return eps.reduce((a, e) => a + e.icePlans[key], 0);
}

async function runArena(): Promise<void> {
  console.log(`AMBER BENCH · golem arena · ${N} episodes/provider · plan every ${PLAN_TICKS} ticks\n`);
  const out: Record<string, unknown>[] = [];

  for (const provider of PROVIDERS) {
    const eps: ArenaEpisode[] = [];
    process.stdout.write(`${provider.padEnd(10)} `);
    for (let i = 0; i < N; i++) {
      const e = await arenaEpisode(provider);
      eps.push(e);
      process.stdout.write(e.outcome === "win" ? "W" : e.outcome === "loss" ? "L" : "T");
    }
    const wins = eps.filter(e => e.outcome === "win");
    const row = {
      mode: "arena",
      provider,
      episodes: N,
      winrate: +(wins.length / N).toFixed(2),
      medianWinTicks: median(wins.map(e => e.ticks)),
      avgBossDmg: +(eps.reduce((a, e) => a + e.p2.bossDmg, 0) / N).toFixed(1),
      avgTaken: +(eps.reduce((a, e) => a + e.p2.dmgTaken, 0) / N).toFixed(1),
      avgDowns: +(eps.reduce((a, e) => a + e.p2.downs, 0) / N).toFixed(2),
      avgRevives: +(eps.reduce((a, e) => a + e.p2.revives, 0) / N).toFixed(2),
      avgAssists: +(eps.reduce((a, e) => a + e.routeAssists, 0) / N).toFixed(1),
      parseFailRate: +(eps.reduce((a, e) => a + e.parseFailures, 0) /
                       Math.max(1, eps.reduce((a, e) => a + e.plans, 0))).toFixed(3),
      avgLatencyMs: Math.round(eps.reduce((a, e) => a + e.avgLatencyMs * e.plans, 0) /
                    Math.max(1, eps.reduce((a, e) => a + e.plans, 0))),
    };
    out.push(row);
    console.log("");
    fs.appendFileSync("bench-results.jsonl",
      JSON.stringify({ t: new Date().toISOString(), ...row, episodes_detail: eps }) + "\n");
  }

  console.log("");
  console.table(out);
}

async function runRink(): Promise<void> {
  console.log(`AMBER BENCH · Frozen Playground rink · ${N} episodes/provider · plan every ${PLAN_TICKS} ticks · cap ${RINK_MAX_TICKS} ticks\n`);
  const out: Record<string, unknown>[] = [];

  for (const provider of PROVIDERS) {
    const eps: RinkEpisode[] = [];
    process.stdout.write(`${provider.padEnd(10)} `);
    for (let i = 0; i < N; i++) {
      const e = await rinkEpisode(provider);
      eps.push(e);
      process.stdout.write(e.outcome === "success" ? "S" : "T");
    }
    const ok = eps.filter(e => e.outcome === "success");
    const used = sumIce(eps, "used");
    const row = {
      mode: "rink",
      provider,
      episodes: N,
      successRate: +(ok.length / N).toFixed(2),
      medianSuccessTicks: median(ok.map(e => e.ticks)),
      avgFinalDist: Math.round(eps.reduce((a, e) => a + e.finalDist, 0) / N),
      icePlanUsed: used,
      icePlanOk: sumIce(eps, "ok"),
      icePlanFailed: sumIce(eps, "failed"),
      icePlanFallback: sumIce(eps, "fallback"),
      icePlanOkRate: used ? +(sumIce(eps, "ok") / used).toFixed(2) : null,
      icePlanFallbackRate: used ? +(sumIce(eps, "fallback") / used).toFixed(2) : null,
      avgAssists: +(eps.reduce((a, e) => a + e.routeAssists, 0) / N).toFixed(1),
      parseFailRate: +(eps.reduce((a, e) => a + e.parseFailures, 0) /
                       Math.max(1, eps.reduce((a, e) => a + e.plans, 0))).toFixed(3),
      avgLatencyMs: Math.round(eps.reduce((a, e) => a + e.avgLatencyMs * e.plans, 0) /
                    Math.max(1, eps.reduce((a, e) => a + e.plans, 0))),
    };
    out.push(row);
    console.log("");
    fs.appendFileSync("bench-results.jsonl",
      JSON.stringify({ t: new Date().toISOString(), ...row, episodes_detail: eps }) + "\n");
  }

  console.log("");
  console.table(out);
}

async function runDuo(): Promise<void> {
  const { p, t } = duoPair();
  console.log(`AMBER BENCH · AI DUO golem coordination · ${N} episodes · ${p[0]}[${t[0]}] + ${p[1]}[${t[1]}] · plan every ${PLAN_TICKS} ticks\n`);
  const eps: DuoEpisode[] = [];
  process.stdout.write(`${p[0]}+${p[1]} `.padEnd(20));
  for (let i = 0; i < N; i++) {
    const e = await duoEpisode(p, t);
    eps.push(e);
    process.stdout.write(e.outcome === "win" ? "W" : e.outcome === "loss" ? "L" : "T");
  }
  const wins = eps.filter(e => e.outcome === "win");
  const avg = (f: (e: DuoEpisode) => number): number => +(eps.reduce((a, e) => a + f(e), 0) / N).toFixed(2);
  const rate = (num: (e: DuoEpisode) => number, den: (e: DuoEpisode) => number): number =>
    +(eps.reduce((a, e) => a + num(e), 0) / Math.max(1, eps.reduce((a, e) => a + den(e), 0))).toFixed(3);
  const latW = (lat: (e: DuoEpisode) => number, pl: (e: DuoEpisode) => number): number =>
    Math.round(eps.reduce((a, e) => a + lat(e) * pl(e), 0) / Math.max(1, eps.reduce((a, e) => a + pl(e), 0)));
  const row = {
    mode: "duo",
    pair: `${p[0]}+${p[1]} [${t[0]}+${t[1]}]`,
    provider1: p[0], provider2: p[1], temperament1: t[0], temperament2: t[1],
    episodes: N,
    winrate: +(wins.length / N).toFixed(2),
    medianWinTicks: median(wins.map(e => e.ticks)),
    avgTeamBossDmg: avg(e => e.p0.bossDmg + e.p1.bossDmg),
    avgTeamTaken: avg(e => e.p0.dmgTaken + e.p1.dmgTaken),
    avgTeamDowns: avg(e => e.p0.downs + e.p1.downs),
    avgTeamRevives: avg(e => e.p0.revives + e.p1.revives),
    avgAssists0: avg(e => e.assists0),
    avgAssists1: avg(e => e.assists1),
    parseFailRate0: rate(e => e.fails0, e => e.plans0),
    parseFailRate1: rate(e => e.fails1, e => e.plans1),
    avgLatencyMs0: latW(e => e.avgLatencyMs0, e => e.plans0),
    avgLatencyMs1: latW(e => e.avgLatencyMs1, e => e.plans1),
  };
  console.log("");
  fs.appendFileSync("bench-results.jsonl",
    JSON.stringify({ t: new Date().toISOString(), ...row, episodes_detail: eps }) + "\n");
  console.log("");
  console.table([row]);
}

async function runScenarioBench(): Promise<void> {
  const sc = SCENARIOS[SCENARIO];
  if (!sc) {
    console.error(`Unknown SCENARIO=${SCENARIO} — have: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }
  console.log(`AMBER BENCH · scenario "${sc.id}" · brain=${BRAIN} defector=${DEFECTOR} · ${N} episodes/provider`);
  console.log(`Q: ${sc.question}\n`);
  const cfg = configFromEnv();
  const out: Record<string, unknown>[] = [];

  for (const provider of PROVIDERS) {
    process.stdout.write(`${provider.padEnd(10)} `);
    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < N; i++) {
      const subject = new AgentPlayer(
        provider === "mock" ? mock() : makeLLM(provider, cfg),
        sc.subjectSlot, { planMs: 0, temperament: TEMPERAMENT, brain: BRAIN, defector: DEFECTOR });
      const { plans, result } = await runScenario(sc, subject);
      results.push(result);
      fs.appendFileSync("bench-results.jsonl", JSON.stringify({
        t: new Date().toISOString(), mode: "scenario", provider, brain: BRAIN,
        defector: DEFECTOR, episode: i, ...result, plans,
      }) + "\n");
      const susp = String(result.maxSuspicion ?? "none")[0].toUpperCase();
      process.stdout.write(result.betrayed ? "B" : susp);
    }
    const num = (k: string): number =>
      +(results.reduce((a, r) => a + (Number(r[k]) || 0), 0) / N).toFixed(3);
    const row = {
      mode: "scenario",
      scenario: sc.id,
      provider,
      brain: BRAIN,
      episodes: N,
      groundTruthRoute: results[0]?.groundTruth
        ? (results[0].groundTruth as { routeWithinBudget: unknown }).routeWithinBudget
        : null,
      recordedClosedRate: +(results.filter(r => r.recordedClosedWithoutArrival).length / N).toFixed(2),
      betrayRate: +(results.filter(r => r.betrayed).length / N).toFixed(2),
      avgFleeRate: num("fleeRate"),
      avgCooperativeRate: num("cooperativeRate"),
      avgBetrayIntentPlans: num("betrayIntentPlans"),
      totalCoverLeaks: results.reduce((a, r) => a + (Number(r.coverLeaks) || 0), 0),
      avgParseFails: num("parseFails"),
    };
    out.push(row);
    console.log("");
  }

  console.log("");
  console.table(out);
}

async function main(): Promise<void> {
  if (MODE === "rink") await runRink();
  else if (MODE === "arena") await runArena();
  else if (MODE === "duo") await runDuo();
  else if (MODE === "scenario") await runScenarioBench();
  else {
    console.error(`Unknown MODE=${MODE} — use arena, rink, duo or scenario`);
    process.exit(1);
  }
  console.log("details → bench-results.jsonl");
  console.log("note: compare medians over N≥10; rink episodes are deterministic for mock.");
}

// only run the harness when invoked directly (node dist/bench.js), NOT when the
// selftest bundle imports rinkEpisode for the [72] smoke test
if (/bench(\.[cm]?js|\.ts)?$/.test(process.argv[1] ?? "")) {
  main().catch(err => { console.error(err); process.exit(1); });
}

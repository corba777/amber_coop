/* =========================================================================
 *  AMBER BENCH — headless LLM partner benchmarks.
 *
 *  MODE=arena (default): golem boss fight — P1 scripted mock, P2 under test.
 *  MODE=rink: Frozen Playground commit-slide puzzle — agent must cross the
 *  rink to rejoin a stationary partner at the north grip landing. Measures
 *  icePlan success vs controller fallback per provider.
 *
 *  Usage:
 *    PROVIDERS=mock,anthropic N=10 node dist/bench.js
 *    MODE=rink PROVIDERS=mock,anthropic N=10 PLAN_TICKS=90 node dist/bench.js
 *
 *  Env: PROVIDERS, N, PLAN_TICKS, MAX_TICKS, TEMPERAMENT, MODE (arena|rink)
 * ========================================================================= */

import fs from "node:fs";
import {
  Game, Input, emptyInput, latch, newGame, loadRoom, TILE, PlayerStats,
} from "../shared/core";
import { update } from "../shared/core";
import { AgentPlayer, IcePlanStats } from "../server/agent";
import { ProviderName, configFromEnv, loadDotEnv, makeLLM, mock } from "../server/llm";

loadDotEnv();
const PROVIDERS = (process.env.PROVIDERS || "mock").split(",").map(s => s.trim()) as ProviderName[];
const N = Number(process.env.N || 5);
const PLAN_TICKS = Number(process.env.PLAN_TICKS || 90);
const MAX_TICKS = Number(process.env.MAX_TICKS || 7200);
const RINK_MAX_TICKS = Number(process.env.RINK_MAX_TICKS || 1200);
const TEMPERAMENT = (process.env.TEMPERAMENT || "companion") as import("../server/agent").Temperament;
const MODE = (process.env.MODE || "arena").toLowerCase();

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

async function main(): Promise<void> {
  if (MODE === "rink") await runRink();
  else if (MODE === "arena") await runArena();
  else {
    console.error(`Unknown MODE=${MODE} — use arena or rink`);
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

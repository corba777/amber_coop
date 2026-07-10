/* =========================================================================
 *  AMBER BENCH — headless golem-arena benchmark for LLM partners.
 *
 *  Design: P1 is a fixed scripted teammate (the mock heuristic through the
 *  same controller), P2 is the provider under test. Both re-plan every
 *  PLAN_TICKS of *virtual* time and the sim awaits the LLM — so decision
 *  quality is measured at a fixed cadence, decoupled from provider latency
 *  (latency is reported as its own column instead).
 *
 *  Usage on the DGX (reads .env for keys/models):
 *    PROVIDERS=mock,ollama,anthropic,openai N=10 node dist/bench.js
 *  Env: PROVIDERS  comma list (default "mock")
 *       N          episodes per provider (default 5)
 *       PLAN_TICKS virtual ticks between plans (default 90 ≈ 1.5 s)
 *       MAX_TICKS  episode cap (default 7200 ≈ 2 min)
 * ========================================================================= */

import fs from "node:fs";
import {
  Game, Input, emptyInput, latch, newGame, loadRoom, TILE, PlayerStats,
} from "../shared/core";
import { update } from "../shared/core";
import { AgentPlayer } from "../server/agent";
import { ProviderName, configFromEnv, loadDotEnv, makeLLM, mock } from "../server/llm";

loadDotEnv();
const PROVIDERS = (process.env.PROVIDERS || "mock").split(",").map(s => s.trim()) as ProviderName[];
const N = Number(process.env.N || 5);
const PLAN_TICKS = Number(process.env.PLAN_TICKS || 90);
const MAX_TICKS = Number(process.env.MAX_TICKS || 7200);
const TEMPERAMENT = (process.env.TEMPERAMENT || "companion") as import("../server/agent").Temperament;

interface Episode {
  outcome: "win" | "loss" | "timeout";
  ticks: number;
  p2: PlayerStats;
  parseFailures: number;
  routeAssists: number;
  plans: number;
  avgLatencyMs: number;
}

function freshArena(): Game {
  const g = newGame();
  g.players[0].present = true;
  g.players[1].present = true;
  loadRoom(g, 5, 6 * TILE, 11 * TILE);   // golem arena, both at the south end
  // realistic mid-game loadout: lake container found, elixirs in pockets
  for (const p of g.players) { p.maxHp = 8; p.hp = 8; p.elixir = true; }
  g.screen = "play";
  g.fade = 0;
  return g;
}

async function episode(provider: ProviderName): Promise<Episode> {
  const cfg = configFromEnv();
  const g = freshArena();
  const driver = new AgentPlayer(mock(), 0, { planMs: 0 });
  const subject = new AgentPlayer(provider === "mock" ? mock() : makeLLM(provider, cfg), 1, { planMs: 0, temperament: TEMPERAMENT });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];

  let ticks = 0;
  while (ticks < MAX_TICKS && g.screen === "play") {
    if (ticks % PLAN_TICKS === 0) {
      // virtual-time planning: the world waits for the decision
      await driver.planOnce(g);
      await subject.planOnce(g);
    }
    const i0 = driver.control(g);
    const i1 = subject.control(g);
    update(g, [latch(i0, prev[0]), latch(i1, prev[1])]);
    prev[0] = { ...i0 };
    prev[1] = { ...i1 };
    ticks++;
    if (g.enemies.length > 0 && g.enemies.every(e => e.dead)) break;   // golem down
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
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main(): Promise<void> {
  console.log(`AMBER BENCH · golem arena · ${N} episodes/provider · plan every ${PLAN_TICKS} ticks\n`);
  const out: Record<string, unknown>[] = [];

  for (const provider of PROVIDERS) {
    const eps: Episode[] = [];
    process.stdout.write(`${provider.padEnd(10)} `);
    for (let i = 0; i < N; i++) {
      const e = await episode(provider);
      eps.push(e);
      process.stdout.write(e.outcome === "win" ? "W" : e.outcome === "loss" ? "L" : "T");
    }
    const wins = eps.filter(e => e.outcome === "win");
    const row = {
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
  console.log("details → bench-results.jsonl");
  console.log("note: no RNG seeding — heart drops and LLM sampling vary between runs;");
  console.log("      compare medians over N≥10 rather than single episodes.");
}

main().catch(err => { console.error(err); process.exit(1); });

/* =========================================================================
 *  AMBER COOP server — multi-session edition
 *  · every host gets their OWN game: menu, mode, LLM agent, room code
 *  · join logic: an explicit ?room=CODE always wins; a bare URL joins the
 *    one session waiting for a human partner, else creates a fresh session
 *  · one 60 Hz loop drives all sessions; empty sessions are reaped
 *
 *  env: PORT, LOG_DIR, HARD_GATE (default for new sessions),
 *       P2 / LLM_PROVIDER (headless bypass: auto-setup for new sessions),
 *       PLAN_MS, plus provider config via .env (see .env.example)
 * ========================================================================= */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import {
  Game, Input, LatchedInput, emptyInput, latch, newGame, update, toSnapshot,
  TravelMode,
  validateRooms,
} from "../shared/core";
import { AgentPlayer, Temperament } from "./agent";
import {
  ProviderName, configFromEnv, loadDotEnv, makeLLM, providerCatalog,
} from "./llm";

declare const __BUILD__: string;
const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev";

loadDotEnv();
validateRooms();

const PORT = Number(process.env.PORT || 8080);
const PLAN_MS = Number(process.env.PLAN_MS || 1500);
const HARD_GATE_DEFAULT = process.env.HARD_GATE === "1";
const LOG_DIR = process.env.LOG_DIR || "./logs";
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* */ }
function appendLog(file: string, obj: unknown): void {
  fs.appendFile(path.join(LOG_DIR, file), JSON.stringify(obj) + "\n", () => { /* */ });
}

const llmCfg = configFromEnv();
const catalog = providerCatalog(llmCfg);

type Mode = "single" | "human" | "llm" | "auto" | "duo";

function cleanName(raw: string, fallback: string): string {
  return raw.replace(/[^\p{L}\p{N} _\-.]/gu, "").trim().slice(0, 12).toUpperCase() || fallback;
}

// ---------------------------------------------------------------- sessions
function makeCode(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}

class Session {
  id: string;
  game: Game;
  sockets: (WebSocket | null)[] = [null, null];
  rawInputs: [Input, Input] = [emptyInput(), emptyInput()];
  prevInputs: [Input, Input] = [emptyInput(), emptyInput()];
  lastInputSeq: [number, number] = [0, 0];   // last input seq applied per slot (echoed as snapshot ack)
  // hero position at the instant that input arrived — the state the held input
  // first acts on. The client holds the twin anchor, so the gap between them is
  // divergence, not latency.
  ackPos: [{ x: number; y: number }, { x: number; y: number }] =
    [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  names: [string, string] = ["ILYA", "?"];
  mode: Mode | null = null;
  agent: AgentPlayer | null = null;
  leaderAgent: AgentPlayer | null = null;   // AI DUO: slot 0
  architect = false;   // Stage 5 toggle — stored, not yet wired
  lastThought: { action: string; why?: string; ms: number } | null = null;
  emptySince = 0;   // ms timestamp when the last human left (0 = occupied)
  pendingStart = false;   // a "start" message: synthesized START edge

  constructor(id: string) {
    this.id = id;
    this.game = newGame();
    this.game.screen = "menu";
    this.game.hardGate = HARD_GATE_DEFAULT;
    // headless/test bypass applies to every fresh session
    const p2env = process.env.P2 as Mode | undefined;
    if (p2env === "single" || p2env === "human" || p2env === "llm") {
      this.applySetup(p2env, (process.env.LLM_PROVIDER as ProviderName) || "mock",
        HARD_GATE_DEFAULT);
    }
  }

  humans(): number { return this.sockets.filter(Boolean).length; }

  temperament: Temperament = "companion";

  applySetup(
    m: Mode,
    provider?: ProviderName,
    hard?: boolean,
    temperament?: Temperament,
    travelMode?: TravelMode,
    extra?: {
      provider2?: ProviderName;
      temperament2?: Temperament;
      architect?: boolean;
      slick?: boolean;
      hostName?: string;
    },
  ): boolean {
    this.architect = !!extra?.architect;
    this.game.hardGate = hard ?? HARD_GATE_DEFAULT;
    this.game.slick = !!extra?.slick;
    this.game.travelMode = travelMode === "free" ? "free" : "linked";
    this.leaderAgent = null;
    if (extra?.hostName) this.names[0] = cleanName(extra.hostName, "ILYA");

    const pickTemp = (t?: Temperament): Temperament =>
      (["guard", "companion", "hunter"] as Temperament[]).includes(t as Temperament)
        ? (t as Temperament) : "companion";

    const wireAgent = (agent: AgentPlayer, slot: number): void => {
      agent.onPlan = rec => {
        if (slot === 1) this.lastThought = { action: rec.action, why: rec.why, ms: rec.ms };
        appendLog("plans.jsonl", { sid: this.id, slot, ...rec });
      };
    };

    if (m === "duo") {
      const p0 = provider, p1 = extra?.provider2;
      if (!p0 || !p1) return false;
      if (p0 !== "mock" && !catalog[p0]?.ok) return false;
      if (p1 !== "mock" && !catalog[p1]?.ok) return false;
      const llm0 = makeLLM(p0, llmCfg);
      const llm1 = makeLLM(p1, llmCfg);
      const t0 = pickTemp(temperament);
      const t1 = pickTemp(extra?.temperament2);
      this.temperament = t1;
      this.leaderAgent = new AgentPlayer(llm0, 0, { planMs: PLAN_MS, temperament: t0, leader: true });
      this.agent = new AgentPlayer(llm1, 1, { planMs: PLAN_MS, temperament: t1 });
      wireAgent(this.leaderAgent, 0);
      wireAgent(this.agent, 1);
      this.names[0] = llm0.name.toUpperCase();
      this.names[1] = llm1.name.toUpperCase();
      this.game.players[0].present = true;
      this.game.players[0].npc = false;
      this.game.players[1].present = true;
      this.game.players[1].npc = true;
      this.kickSlot1("host chose AI duo");
      this.game.screen = "title";
    } else if (m === "llm" || m === "auto") {
      if (!provider) return false;
      if (provider !== "mock" && !catalog[provider]?.ok) return false;
      const llm = makeLLM(provider, llmCfg);
      this.temperament = pickTemp(temperament);
      this.agent = new AgentPlayer(llm, 1, { planMs: PLAN_MS, temperament: this.temperament });
      wireAgent(this.agent, 1);
      this.names[1] = llm.name.toUpperCase();
      this.game.players[1].present = true;
      this.game.players[1].npc = m === "llm";
      this.game.players[0].present = m === "llm" && !!this.sockets[0];
      if (m === "auto") this.names[0] = "SPECTATOR";
      this.kickSlot1("host chose an AI partner");
      this.game.screen = "title";
    } else if (m === "human") {
      this.agent = null;
      this.game.players[1].npc = false;
      this.names[1] = "PLAYER 2";
      this.game.players[1].present = !!this.sockets[1];
      this.game.screen = this.sockets[1] ? "title" : "lobby";
    } else {
      this.agent = null;
      this.names[1] = "";
      this.game.players[1].npc = false;
      this.game.players[1].present = false;
      this.kickSlot1("host chose single player");
      this.game.screen = "title";
    }
    this.mode = m;
    console.log(`[${this.id}] setup mode=${m}${provider ? ` provider=${provider}` : ""} hardGate=${this.game.hardGate} travel=${this.game.travelMode}`);
    return true;
  }

  resetToMenu(): void {
    const keep0 = !!this.sockets[0];
    Object.assign(this.game, newGame());
    this.game.screen = "menu";
    this.game.hardGate = HARD_GATE_DEFAULT;
    this.game.players[0].present = keep0;
    this.game.players[1].present = false;
    this.agent = null;
    this.leaderAgent = null;
    this.mode = null;
    this.names[1] = "?";
    this.rawInputs = [emptyInput(), emptyInput()];
  }

  kickSlot1(reason: string): void {
    const ws = this.sockets[1];
    if (ws) {
      try { ws.send(JSON.stringify({ t: "kicked", reason })); ws.close(); } catch { /* */ }
      this.sockets[1] = null;
      this.rawInputs[1] = emptyInput();
    }
  }

  tick(tickCount: number): void {
    try {
      if (this.leaderAgent) {
        this.game.activeSim = this.game.players[0].simIndex;
        this.leaderAgent.maybePlan(this.game, Date.now());
        this.rawInputs[0] = this.leaderAgent.control(this.game);
        const quip0 = this.leaderAgent.takeSay();
        if (quip0) {
          this.game.players[0].say = quip0;
          this.game.players[0].sayT = 180;
        }
      }
      if (this.agent) {
        this.game.activeSim = this.game.players[1].simIndex;
        this.agent.maybePlan(this.game, Date.now());
        this.rawInputs[1] = this.agent.control(this.game);
        const quip = this.agent.takeSay();
        if (quip) {
          this.game.players[1].say = quip;
          this.game.players[1].sayT = 180;
        }
      }
      const latched: [LatchedInput, LatchedInput] = [
        latch(this.rawInputs[0], this.prevInputs[0]),
        latch(this.rawInputs[1], this.prevInputs[1]),
      ];
      if (this.pendingStart) {
        latched[0] = { ...latched[0], stE: true };
        this.pendingStart = false;
      }
      this.prevInputs[0] = { ...this.rawInputs[0] };
      this.prevInputs[1] = { ...this.rawInputs[1] };

      const before = this.game.screen;
      update(this.game, latched);
      if (before === "play" && (this.game.screen === "gameover" || this.game.screen === "win")) {
        appendLog("matches.jsonl", {
          t: new Date().toISOString(),
          sid: this.id,
          mode: this.mode,
          p1name: this.names[0] || "ILYA",
          partner: this.names[1] || "(solo)",
          temperament: this.mode === "llm" ? this.temperament : null,
          outcome: this.game.screen === "win" ? "win" : "loss",
          ending: this.game.ending?.id ?? null,
          hardGate: this.game.hardGate,
          ticks: this.game.ticks,
          p1: this.game.stats[0], p2: this.game.stats[1],
          plans: this.agent ? this.agent.planCount : 0,
          parseFailures: this.agent ? this.agent.parseFailures : 0,
          routeAssists: this.agent ? this.agent.routeAssists : 0,
          icePlans: this.agent ? this.agent.icePlanStats : null,
          errands: this.agent ? this.agent.errandLog : [],
          bleedout: this.game.bleedoutLoss,
          avgLatencyMs: this.agent && this.agent.planCount
            ? Math.round(this.agent.latencySum / this.agent.planCount) : 0,
        });
      }

      if (tickCount % 2 === 0) {
        const events = this.game.events.slice();
        for (let slot = 0; slot < 2; slot++) {
          const ws = this.sockets[slot];
          if (!ws || ws.readyState !== WebSocket.OPEN) continue;
          const snapObj = toSnapshot(this.game, this.names, slot, false);
          snapObj.events = events;
          snapObj.mode = this.mode;
          snapObj.thought = this.agent ? this.lastThought : null;
          snapObj.ack = this.lastInputSeq[slot];
          snapObj.ackX = this.ackPos[slot].x;
          snapObj.ackY = this.ackPos[slot].y;
          ws.send(JSON.stringify({ t: "state", s: snapObj }));
        }
        this.game.events = [];
      }
    } catch (err) {
      console.error(`[${this.id}] tick error:`, err);
    }
  }
}

const sessions = new Map<string, Session>();

function createSession(): Session {
  let code = makeCode();
  while (sessions.has(code)) code = makeCode();
  const s = new Session(code);
  sessions.set(code, s);
  console.log(`[${code}] session created (${sessions.size} live)`);
  return s;
}

// ------------------------------------------------------------- http static
const clientHtml = path.join(__dirname, "client.html");
const client3dHtml = path.join(__dirname, "client3d.html");
const server = http.createServer((req, res) => {
  const u = new URL(req.url ?? "/", "http://x");
  if (u.pathname === "/" || u.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    fs.createReadStream(clientHtml).pipe(res);
    return;
  }
  if (u.pathname === "/3d" && fs.existsSync(client3dHtml)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    fs.createReadStream(client3dHtml).pipe(res);
    return;
  }
  if (u.pathname === "/stats" || u.pathname === "/stats.json") {
    interface Agg { games: number; wins: number; ticks: number[]; dmg: number;
      taken: number; revives: number; downs: number; fails: number; plans: number; lat: number }
    const blank = (): Agg => ({ games: 0, wins: 0, ticks: [], dmg: 0, taken: 0,
      revives: 0, downs: 0, fails: 0, plans: 0, lat: 0 });
    const partners: Record<string, Agg> = {};
    const heroes: Record<string, Agg> = {};
    interface Stats { dmgDealt: number; dmgTaken: number; revives: number; downs: number }
    const feed = (m: Record<string, unknown>, table: Record<string, Agg>,
                  key: string, st: Stats | undefined): void => {
      const r = (table[key] ??= blank());
      r.games++;
      if (m.outcome === "win") { r.wins++; r.ticks.push(Number(m.ticks) || 0); }
      r.dmg += st?.dmgDealt ?? 0;
      r.taken += st?.dmgTaken ?? 0;
      r.revives += st?.revives ?? 0;
      r.downs += st?.downs ?? 0;
      r.fails += Number(m.parseFailures) || 0;
      r.plans += Number(m.plans) || 0;
      r.lat += (Number(m.avgLatencyMs) || 0) * (Number(m.plans) || 0);
    };
    try {
      const lines = fs.readFileSync(path.join(LOG_DIR, "matches.jsonl"), "utf8")
        .split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const m = JSON.parse(line) as Record<string, unknown>;
          // partner table: who stood in slot 2 (LLMs and human guests alike)
          const tKey = m.temperament && m.temperament !== "companion"
            ? ` [${String(m.temperament)}]` : "";
          feed(m, partners, String(m.partner ?? "(solo)") + tKey, m.p2 as Stats);
          // hero table: HUMANS only — the host always, the guest in human mode
          if (m.mode !== "auto") {
            feed(m, heroes, String(m.p1name ?? "(unnamed)"), m.p1 as Stats);
          }
          if (m.mode === "human") {
            feed(m, heroes, String(m.partner ?? "PLAYER 2"), m.p2 as Stats);
          }
        } catch { /* skip bad line */ }
      }
    } catch { /* no matches yet */ }
    const finish = (table: Record<string, Agg>, nameCol: string):
      Record<string, unknown>[] => Object.entries(table).map(([name, r]) => ({
        [nameCol]: name, games: r.games,
        winrate: r.games ? +(r.wins / r.games).toFixed(2) : 0,
        medianWinTicks: r.ticks.length
          ? r.ticks.sort((a, b) => a - b)[Math.floor(r.ticks.length / 2)] : null,
        avgDmg: r.games ? +(r.dmg / r.games).toFixed(1) : 0,
        avgTaken: r.games ? +(r.taken / r.games).toFixed(1) : 0,
        avgDowns: r.games ? +(r.downs / r.games).toFixed(2) : 0,
        avgRevives: r.games ? +(r.revives / r.games).toFixed(2) : 0,
        parseFailRate: r.plans ? +(r.fails / r.plans).toFixed(3) : 0,
        avgLatencyMs: r.plans ? Math.round(r.lat / r.plans) : 0,
      })).sort((x, y) => Number(y.winrate) - Number(x.winrate) || Number(y.games) - Number(x.games));
    const heroRows = finish(heroes, "hero");
    const partnerRows = finish(partners, "partner");
    if (u.pathname === "/stats.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ heroes: heroRows, partners: partnerRows }, null, 2));
      return;
    }
    const heroCols = ["hero", "games", "winrate", "medianWinTicks", "avgDmg",
      "avgTaken", "avgDowns", "avgRevives"];
    const partnerCols = ["partner", "games", "winrate", "medianWinTicks", "avgDmg",
      "avgTaken", "avgRevives", "parseFailRate", "avgLatencyMs"];
    const tableHtml = (title: string, cols: string[], rows: Record<string, unknown>[]): string =>
      `<h1>${title}</h1><table><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>` +
      rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? "—"}</td>`).join("")}</tr>`).join("") +
      `</table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AMBER COOP · leaderboards</title>
<style>body{background:#0d0c14;color:#c9c3de;font-family:ui-monospace,monospace;padding:24px}
h1{color:#ffe9c2;font-size:18px;margin-top:26px}table{border-collapse:collapse;margin-top:12px}
td,th{border:1px solid #38324e;padding:6px 12px;font-size:13px}th{color:#ffb545;text-align:left}
tr:nth-child(even){background:#151222}</style></head><body>
${tableHtml("AMBER COOP · hero leaderboard", heroCols, heroRows)}
${tableHtml("partner leaderboard", partnerCols, partnerRows)}
<p style="color:#6f688c;font-size:12px">from ${LOG_DIR}/matches.jsonl · raw: <a style="color:#4fb8d8" href="/stats.json">/stats.json</a></p></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (u.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      build: BUILD,
      sessions: [...sessions.values()].map(s => ({
        room: s.id, mode: s.mode, screen: s.game.screen,
        humans: s.humans(), hardGate: s.game.hardGate,
      })),
    }));
    return;
  }
  res.writeHead(404); res.end("not found");
});

// ------------------------------------------------------------------- wss
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  const u = new URL(req.url ?? "/", "http://x");
  const wanted = (u.searchParams.get("room") || "").toUpperCase();

  // pick a session: explicit code → that one; else the single session
  // waiting for a human partner; else a brand-new session
  let sess: Session | null = null;
  if (wanted) {
    sess = sessions.get(wanted) ?? null;
    if (!sess) {
      ws.send(JSON.stringify({ t: "full", reason: `room ${wanted} does not exist (or has ended)` }));
      ws.close();
      return;
    }
  } else {
    // a bare URL ALWAYS starts your own game — joining someone is only
    // ever explicit, via the shared ?room link. Nobody blocks anybody.
    sess = createSession();
  }

  let slot = -1;
  if (!sess.sockets[0]) slot = 0;
  else if (sess.mode === "human" && !sess.sockets[1]) slot = 1;
  if (slot === -1) {
    if (sess.mode === "human") {
      // a genuinely full coop room: honest rejection
      ws.send(JSON.stringify({ t: "full", reason: `room ${sess.id}: both seats are taken` }));
      ws.close();
      return;
    }
    // no open seat (host at menu / single / llm) — almost certainly a stale
    // ?room leaked via browser autocomplete: quietly start their own game
    sess = createSession();
    slot = 0;
  }
  const session = sess;
  session.sockets[slot] = ws;
  session.emptySince = 0;
  session.game.players[slot].present = !(slot === 0 && session.mode === "auto");
  if (slot === 1 && session.game.screen === "lobby") session.game.screen = "title";
  ws.send(JSON.stringify({
    t: "hello", slot, room: session.id, build: BUILD,
    names: session.names, mode: session.mode, providers: catalog,
  }));
  console.log(`[${session.id}] join slot ${slot}`);

  ws.on("message", data => {
    try {
      const msg = JSON.parse(String(data)) as {
        t: string; s?: Input; seq?: number; mode?: Mode; provider?: ProviderName; provider2?: ProviderName;
        hardGate?: boolean; name?: string; hostName?: string; temperament?: Temperament;
        temperament2?: Temperament; travelMode?: TravelMode; architect?: boolean; slick?: boolean;
      };
      if (msg.t === "start") {
        const sc = session.game.screen;
        if (sc === "title" || sc === "gameover" || sc === "win") session.pendingStart = true;
      } else if (msg.t === "ping") {
        ws.send(JSON.stringify({ t: "pong", n: (msg as unknown as { n: number }).n }));
      } else if (msg.t === "input" && msg.s) {
        if (session.mode === "duo" || (session.mode === "auto" && slot === 0)) {
          if (msg.s.st) session.pendingStart = true;
        } else {
        session.rawInputs[slot] = {
          l: !!msg.s.l, r: !!msg.s.r, u: !!msg.s.u, d: !!msg.s.d,
          a: !!msg.s.a, b: !!msg.s.b, st: !!msg.s.st, f: !!msg.s.f,
        };
        // anchor the seq to where the hero stands right now: this is the state
        // the freshly-received held input will first act on (guard out-of-order)
        if (typeof msg.seq === "number" && msg.seq > session.lastInputSeq[slot]) {
          session.lastInputSeq[slot] = msg.seq;
          const hp = session.game.players[slot];
          session.ackPos[slot] = { x: hp.x, y: hp.y };
        }
        }
      } else if (msg.t === "setup" && slot === 0 && session.game.screen === "menu" && msg.mode) {
        session.applySetup(
          msg.mode, msg.provider, msg.hardGate, msg.temperament, msg.travelMode,
          {
            provider2: msg.provider2, temperament2: msg.temperament2,
            architect: msg.architect, slick: msg.slick, hostName: msg.hostName,
          },
        );
      } else if (msg.t === "name" && typeof msg.name === "string") {
        const clean = cleanName(msg.name, slot === 0 ? "ILYA" : "PLAYER 2");
        if (slot === 0) session.names[0] = clean;
        else if (session.mode === "human") session.names[1] = clean;
      } else if (msg.t === "tomenu" && slot === 0) {
        session.resetToMenu();
      }
    } catch { /* ignore malformed frames */ }
  });

  ws.on("close", () => {
    session.sockets[slot] = null;
    session.rawInputs[slot] = emptyInput();
    if (slot === 0) {
      session.resetToMenu();
      session.game.players[0].present = false;
    } else {
      session.game.players[1].present = session.agent !== null;
      if (session.game.screen === "play") {
        session.game.message = "PLAYER 2 disconnected";
        session.game.messageT = 180;
      } else if (session.game.screen === "title" && session.mode === "human") {
        session.game.screen = "lobby";
      }
    }
    if (session.humans() === 0) session.emptySince = Date.now();
    console.log(`[${session.id}] leave slot ${slot}`);
  });
});

// -------------------------------------------------------------- game loop
const TICK_MS = 1000 / 60;
let tickCount = 0;
setInterval(() => {
  tickCount++;
  for (const s of sessions.values()) s.tick(tickCount);
  // reap sessions abandoned for over a minute
  if (tickCount % 300 === 0) {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (s.humans() === 0 && s.emptySince > 0 && now - s.emptySince > 60_000) {
        sessions.delete(id);
        console.log(`[${id}] reaped (${sessions.size} live)`);
      }
    }
  }
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`AMBER COOP up on http://0.0.0.0:${PORT} — multi-session — build ${BUILD}`);
  const provs = Object.entries(catalog)
    .map(([k, v]) => `${k}${v.ok ? "✓" : "✗"}`)
    .join(" ");
  console.log(`  providers from .env: ${provs}`);
  console.log(`  pixel client: /   ·   HD-2D client: /3d   ·   leaderboard: /stats`);
  console.log(`  join a specific game with ?room=CODE (code shown in the menu)`);
});

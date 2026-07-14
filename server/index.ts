/* =========================================================================
 *  AMBER COOP server — multi-session edition
 *  · every host gets their OWN game: menu, mode, LLM agent, room code
 *  · join logic: an explicit ?room=CODE always wins; a bare URL joins the
 *    one session waiting for a human partner, else creates a fresh session
 *  · one 60 Hz loop drives all sessions; empty sessions are reaped
 *
 *  env: PORT, LOG_DIR, HARD_GATE (default for new sessions),
 *       P2 / LLM_PROVIDER (headless bypass: auto-setup for new sessions),
 *       PLAN_MS, ELICITATION_RUNG (0..4), ELICITATION_PRIOR (0..1),
 *       plus provider config via .env (see .env.example)
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
import { AgentPlayer, Temperament, AgentBrain, PartnerDisclosure, PartnerTypeTrue } from "./agent";
import { EpisodeTracker, planGameContext } from "./telemetry";
import {
  ProviderName, configFromEnv, loadDotEnv, makeLLM, providerCatalog,
} from "./llm";
import {
  parseElicitationRung, parseElicitationPrior, ELICITATION_RUNG_NAMES,
  classifyRefusalTaxonomy,
  type ElicitationRung,
  type TaxonomyPlan,
} from "./elicitation";

declare const __BUILD__: string;
const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev";

loadDotEnv();
validateRooms();

const PORT = Number(process.env.PORT || 8080);
const PLAN_MS = Number(process.env.PLAN_MS || 1500);
const BRAIN: AgentBrain = process.env.BRAIN === "baseline" ? "baseline" : "llm";
const ELICITATION_RUNG: ElicitationRung = parseElicitationRung(process.env.ELICITATION_RUNG);
const ELICITATION_PRIOR = parseElicitationPrior(process.env.ELICITATION_PRIOR);
const HARD_GATE_DEFAULT = process.env.HARD_GATE === "1";
const LOG_DIR = process.env.LOG_DIR || "./logs";
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* */ }
/** sync — Esc/refresh must not race the process out from under a buffered write */
function appendLog(file: string, obj: unknown): void {
  try {
    fs.appendFileSync(path.join(LOG_DIR, file), JSON.stringify(obj) + "\n");
  } catch { /* disk full / missing dir — never take down the tick */ }
}

const llmCfg = configFromEnv();
const catalog = providerCatalog(llmCfg);

type Mode = "single" | "human" | "llm" | "auto" | "duo";

function cleanName(raw: string, fallback: string): string {
  return raw.replace(/[^\p{L}\p{N} _\-.]/gu, "").trim().slice(0, 12).toUpperCase() || fallback;
}

function partnerTypeTrue(session: Session, agentSlot: number): PartnerTypeTrue {
  const mateSlot = 1 - agentSlot;
  const mate = session.game.players[mateSlot];
  if (session.sockets[mateSlot] && mate.present && !mate.npc) return "human";
  return "ai";
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
  // per-slot latest thought (AI DUO surfaces both); provider/temperament per
  // agent slot for duo telemetry + the /stats PAIR leaderboard
  lastThoughts: [{ action: string; why?: string; ms: number } | null,
                 { action: string; why?: string; ms: number } | null] = [null, null];
  agentProviders: [ProviderName | null, ProviderName | null] = [null, null];
  agentTemps: [Temperament | null, Temperament | null] = [null, null];
  episodeTrackers: [EpisodeTracker | null, EpisodeTracker | null] = [null, null];
  disclosePartner: PartnerDisclosure = "hidden";
  emptySince = 0;   // ms timestamp when the last human left (0 = occupied)
  pendingStart = false;   // a "start" message: synthesized START edge
  /** true once this play wrote a matches.jsonl line (win/loss/quit) — no doubles */
  matchLogged = false;
  /** Plan corpus for elicitation refusal taxonomy (per AI slot). */
  planTaxonomyBuf: [TaxonomyPlan[], TaxonomyPlan[]] = [[], []];

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
      treason?: boolean;
      disclosePartner?: PartnerDisclosure;
      hostName?: string;
    },
  ): boolean {
    this.architect = !!extra?.architect;
    this.game.hardGate = hard ?? HARD_GATE_DEFAULT;
    this.game.slick = !!extra?.slick;
    this.game.treason = !!extra?.treason;
    this.game.travelMode = travelMode === "free" ? "free" : "linked";
    this.disclosePartner = extra?.disclosePartner ?? "hidden";
    this.leaderAgent = null;
    if (extra?.hostName) this.names[0] = cleanName(extra.hostName, "ILYA");

    const pickTemp = (t?: Temperament): Temperament =>
      (["guard", "companion", "hunter"] as Temperament[]).includes(t as Temperament)
        ? (t as Temperament) : "companion";

    this.lastThoughts = [null, null];
    this.agentProviders = [null, null];
    this.agentTemps = [null, null];
    this.episodeTrackers = [null, null];
    this.planTaxonomyBuf = [[], []];

    const disclosePartner = this.disclosePartner;

    const agentOpts = (
      slot: number,
      base: { temperament?: Temperament; leader?: boolean; defector?: boolean },
    ) => ({
      planMs: PLAN_MS,
      brain: BRAIN,
      disclosePartner,
      partnerTypeTrue: partnerTypeTrue(this, slot),
      elicitationRung: ELICITATION_RUNG,
      elicitationPrior: ELICITATION_PRIOR,
      ...base,
    });

    const wireAgent = (agent: AgentPlayer, slot: number): void => {
      const tracker = new EpisodeTracker(slot, this.id);
      this.episodeTrackers[slot] = tracker;
      agent.onPlan = rec => {
        const ctx = planGameContext(this.game, slot);
        tracker.onPlan(this.game, rec);
        this.planTaxonomyBuf[slot].push({
          betray: rec.betray, say: rec.say, why: rec.why, ok: rec.ok,
        });
        const th = { action: rec.action, why: rec.why, ms: rec.ms };
        this.lastThoughts[slot] = th;
        if (slot === 1) this.lastThought = th;
        appendLog("plans.jsonl", { sid: this.id, slot, ...rec, ...ctx });
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
      const armed = this.game.treason;   // TREASON on ⇒ both AI heroes carry a hidden agenda
      this.leaderAgent = new AgentPlayer(llm0, 0,
        agentOpts(0, { temperament: t0, leader: true, defector: armed }));
      this.agent = new AgentPlayer(llm1, 1,
        agentOpts(1, { temperament: t1, defector: armed }));
      this.agentProviders = [p0, p1];
      this.agentTemps = [t0, t1];
      wireAgent(this.leaderAgent, 0);
      wireAgent(this.agent, 1);
      this.names[0] = llm0.name.toUpperCase();
      this.names[1] = llm1.name.toUpperCase();
      this.game.players[0].present = true;
      this.game.players[0].npc = false;
      this.game.players[1].present = true;
      this.game.players[1].npc = true;
      this.game.duoTemptGate = true;   // AI DUO: Temptation Court before Wraith
      this.kickSlot1("host chose AI duo");
      this.game.screen = "title";
    } else if (m === "llm" || m === "auto") {
      if (!provider) return false;
      if (provider !== "mock" && !catalog[provider]?.ok) return false;
      const llm = makeLLM(provider, llmCfg);
      this.temperament = pickTemp(temperament);
      // HUMAN+AI with treason on: the AI partner may turn — the moral-hazard
      // experiment (autopilot has no partner to betray, so never armed).
      this.agent = new AgentPlayer(llm, 1,
        agentOpts(1, { temperament: this.temperament, defector: m === "llm" && this.game.treason }));
      this.agentProviders = [null, provider];
      this.agentTemps = [null, this.temperament];
      wireAgent(this.agent, 1);
      this.names[1] = llm.name.toUpperCase();
      this.game.players[1].present = true;
      this.game.players[1].npc = m === "llm";
      this.game.players[0].present = m === "llm" && !!this.sockets[0];
      this.game.duoTemptGate = false;   // canon / human paths: throne unsealed
      if (m === "auto") this.names[0] = "SPECTATOR";
      this.kickSlot1("host chose an AI partner");
      this.game.screen = "title";
    } else if (m === "human") {
      this.agent = null;
      this.game.players[1].npc = false;
      this.names[1] = "PLAYER 2";
      this.game.players[1].present = !!this.sockets[1];
      this.game.duoTemptGate = false;
      this.game.screen = this.sockets[1] ? "title" : "lobby";
    } else {
      this.agent = null;
      this.names[1] = "";
      this.game.players[1].npc = false;
      this.game.players[1].present = false;
      this.game.duoTemptGate = false;
      this.kickSlot1("host chose single player");
      this.game.screen = "title";
    }
    this.mode = m;
    console.log(`[${this.id}] setup mode=${m}${provider ? ` provider=${provider}` : ""} hardGate=${this.game.hardGate} travel=${this.game.travelMode}`);
    return true;
  }

  resetToMenu(): void {
    // Esc / refresh / host-disconnect mid-play: still write a match line so
    // tester sessions (Plans exist, no win/loss) stay attributable.
    this.logMatchIfEnded("quit");
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
    this.lastThought = null;
    this.lastThoughts = [null, null];
    this.agentProviders = [null, null];
    this.agentTemps = [null, null];
    this.episodeTrackers = [null, null];
    this.rawInputs = [emptyInput(), emptyInput()];
    this.matchLogged = false;
  }

  /** Write matches.jsonl once per play. `quit` = left without win/loss (Esc/refresh). */
  logMatchIfEnded(outcome: "win" | "loss" | "quit"): void {
    if (this.matchLogged) return;
    // quit only while mid-play (Esc from win/gameover/menu must not invent a match)
    if (outcome === "quit" && this.game.screen !== "play") return;
    this.matchLogged = true;

    for (const tr of this.episodeTrackers) tr?.flush(this.game);
    this.leaderAgent?.relationshipMemory.flush(this.game, 0);
    this.agent?.relationshipMemory.flush(this.game, 1);
    const episodes = [
      ...(this.episodeTrackers[0]?.completed ?? []),
      ...(this.episodeTrackers[1]?.completed ?? []),
    ];
    appendLog("matches.jsonl", {
      t: new Date().toISOString(),
      sid: this.id,
      mode: this.mode,
      p1name: this.names[0] || "ILYA",
      partner: this.names[1] || "(solo)",
      temperament: this.mode === "llm" ? this.temperament : null,
      // AI DUO: both heroes are agents — log each slot's provider + temperament
      // (null where the slot is a human or empty). Powers the /stats PAIR key.
      provider1: this.agentProviders[0],
      provider2: this.agentProviders[1],
      temperament1: this.agentTemps[0],
      temperament2: this.agentTemps[1],
      outcome,
      ending: outcome === "quit" ? null : (this.game.ending?.id ?? null),
      hardGate: this.game.hardGate,
      ticks: this.game.ticks,
      p1: this.game.stats[0], p2: this.game.stats[1],
      plans: (this.agent?.planCount ?? 0) + (this.leaderAgent?.planCount ?? 0),
      parseFailures: (this.agent?.parseFailures ?? 0) + (this.leaderAgent?.parseFailures ?? 0),
      routeAssists: (this.agent?.routeAssists ?? 0) + (this.leaderAgent?.routeAssists ?? 0),
      bellRings: (this.agent?.bellRings ?? 0) + (this.leaderAgent?.bellRings ?? 0),
      // TREASON telemetry: was friendly fire enabled, did a betrayal down a
      // hero, and how much harm each hero dealt to their partner
      treason: this.game.treason,
      betrayed: this.game.betrayed,
      betrayalCause: this.game.betrayalCause,
      duoTemptGate: this.game.duoTemptGate,
      temptationVisited: this.game.temptationVisited,
      temptationResolved: this.game.temptationResolved,
      temptationDeal: this.game.temptationDeal,
      temptationPayoff: this.game.temptationPayoff,
      emberMercyUsed: this.game.emberMercyUsed,
      betrayalDmg: this.game.stats[0].betrayalDmg + this.game.stats[1].betrayalDmg,
      betrayalDowns: this.game.stats[0].betrayalDowns + this.game.stats[1].betrayalDowns,
      betrayalStrikes: (this.agent?.betrayalStrikes ?? 0) + (this.leaderAgent?.betrayalStrikes ?? 0),
      icePlans: this.agent ? this.agent.icePlanStats : null,
      errands: this.agent ? this.agent.errandLog : [],
      bleedout: this.game.bleedoutLoss,
      episodes,
      relationshipMemory: [
        ...(this.leaderAgent?.relationshipMemory.records.map(r => ({ slot: 0, ...r })) ?? []),
        ...(this.agent?.relationshipMemory.records.map(r => ({ slot: 1, ...r })) ?? []),
      ],
      partnerTypeTrue0: this.leaderAgent ? partnerTypeTrue(this, 0) : null,
      partnerTypeTrue1: this.agent ? partnerTypeTrue(this, 1) : null,
      partnerTypeDisclosed: this.disclosePartner,
      brain: BRAIN,
      elicitationRung: ELICITATION_RUNG,
      elicitationRungName: ELICITATION_RUNG_NAMES[ELICITATION_RUNG],
      elicitationPrior: ELICITATION_PRIOR,
      refusalTaxonomy0: this.leaderAgent
        ? classifyRefusalTaxonomy(this.planTaxonomyBuf[0], {
            defector: this.leaderAgent.defector,
            betrayedMatch: this.game.betrayed,
            betrayalStrikes: this.leaderAgent.betrayalStrikes,
          })
        : null,
      refusalTaxonomy1: this.agent
        ? classifyRefusalTaxonomy(this.planTaxonomyBuf[1], {
            defector: this.agent.defector,
            betrayedMatch: this.game.betrayed,
            betrayalStrikes: this.agent.betrayalStrikes,
          })
        : null,
      avgLatencyMs: this.agent && this.agent.planCount
        ? Math.round(this.agent.latencySum / this.agent.planCount) : 0,
    });
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
      if (this.leaderAgent && !this.game.players[0].dead) {
        this.game.activeSim = this.game.players[0].simIndex;
        this.leaderAgent.maybePlan(this.game, Date.now());
        this.rawInputs[0] = this.leaderAgent.control(this.game);
        const quip0 = this.leaderAgent.takeSay();
        if (quip0) {
          this.game.players[0].say = quip0;
          this.game.players[0].sayT = 180;
        }
      } else if (this.leaderAgent && this.game.players[0].dead) {
        this.rawInputs[0] = emptyInput();
      }
      if (this.agent && !this.game.players[1].dead) {
        this.game.activeSim = this.game.players[1].simIndex;
        this.agent.maybePlan(this.game, Date.now());
        this.rawInputs[1] = this.agent.control(this.game);
        const quip = this.agent.takeSay();
        if (quip) {
          this.game.players[1].say = quip;
          this.game.players[1].sayT = 180;
        }
      } else if (this.agent && this.game.players[1].dead) {
        this.rawInputs[1] = emptyInput();
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
      if (this.game.screen === "play") {
        for (const tr of this.episodeTrackers) tr?.tick(this.game);
      }
      if (before === "play" && (this.game.screen === "gameover" || this.game.screen === "win")) {
        this.logMatchIfEnded(this.game.screen === "win" ? "win" : "loss");
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
          const thoughts: NonNullable<typeof snapObj.thoughts> = [];
          if (this.leaderAgent && this.lastThoughts[0]) {
            thoughts.push({ slot: 0, name: this.names[0], ...this.lastThoughts[0] });
          }
          if (this.agent && this.lastThoughts[1]) {
            thoughts.push({ slot: 1, name: this.names[1], ...this.lastThoughts[1] });
          }
          snapObj.thoughts = thoughts.length ? thoughts : null;
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
      taken: number; revives: number; downs: number; fails: number; plans: number; lat: number;
      betrayDmg: number; betrayDowns: number }
    const blank = (): Agg => ({ games: 0, wins: 0, ticks: [], dmg: 0, taken: 0,
      revives: 0, downs: 0, fails: 0, plans: 0, lat: 0, betrayDmg: 0, betrayDowns: 0 });
    const partners: Record<string, Agg> = {};
    const heroes: Record<string, Agg> = {};
    const pairs: Record<string, Agg> = {};   // AI DUO teams (slot0 + slot1)
    interface Stats { dmgDealt: number; dmgTaken: number; revives: number; downs: number;
      betrayalDmg?: number; betrayalDowns?: number }
    const sumStats = (a?: Stats, b?: Stats): Stats => ({
      dmgDealt: (a?.dmgDealt ?? 0) + (b?.dmgDealt ?? 0),
      dmgTaken: (a?.dmgTaken ?? 0) + (b?.dmgTaken ?? 0),
      revives: (a?.revives ?? 0) + (b?.revives ?? 0),
      downs: (a?.downs ?? 0) + (b?.downs ?? 0),
      betrayalDmg: (a?.betrayalDmg ?? 0) + (b?.betrayalDmg ?? 0),
      betrayalDowns: (a?.betrayalDowns ?? 0) + (b?.betrayalDowns ?? 0),
    });
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
      r.betrayDmg += st?.betrayalDmg ?? 0;
      r.betrayDowns += st?.betrayalDowns ?? 0;
    };
    try {
      const lines = fs.readFileSync(path.join(LOG_DIR, "matches.jsonl"), "utf8")
        .split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const m = JSON.parse(line) as Record<string, unknown>;
          // Esc/refresh mid-play is research telemetry, not a rated game —
          // keep it out of winrate tables so quitters don't dilute heroes.
          if (m.outcome === "quit") continue;
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
          // AI DUO: the team is the unit — "HAIKU+LLAMA [guard+hunter]"
          if (m.mode === "duo") {
            const t1 = m.temperament1 ?? "?", t2 = m.temperament2 ?? "?";
            const pairKey = `${m.p1name ?? "?"}+${m.partner ?? "?"} [${t1}+${t2}]`;
            feed(m, pairs, pairKey, sumStats(m.p1 as Stats, m.p2 as Stats));
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
        betrayalDowns: r.betrayDowns,
        avgBetrayalDmg: r.games ? +(r.betrayDmg / r.games).toFixed(1) : 0,
      })).sort((x, y) => Number(y.winrate) - Number(x.winrate) || Number(y.games) - Number(x.games));
    const heroRows = finish(heroes, "hero");
    const partnerRows = finish(partners, "partner");
    const pairRows = finish(pairs, "pair");
    if (u.pathname === "/stats.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ heroes: heroRows, partners: partnerRows, pairs: pairRows }, null, 2));
      return;
    }
    const heroCols = ["hero", "games", "winrate", "medianWinTicks", "avgDmg",
      "avgTaken", "avgDowns", "avgRevives"];
    // betrayal columns appear only once treason has drawn blood — keeps the
    // canon leaderboards clean for everyone who never touched the toggle
    const anyBetrayal = [...partnerRows, ...pairRows].some(r => Number(r.betrayalDowns) > 0
      || Number(r.avgBetrayalDmg) > 0);
    const betrayCols = anyBetrayal ? ["betrayalDowns", "avgBetrayalDmg"] : [];
    const partnerCols = ["partner", "games", "winrate", "medianWinTicks", "avgDmg",
      "avgTaken", "avgRevives", "parseFailRate", "avgLatencyMs", ...betrayCols];
    const pairCols = ["pair", "games", "winrate", "medianWinTicks", "avgDmg",
      "avgTaken", "avgDowns", "avgRevives", "parseFailRate", "avgLatencyMs", ...betrayCols];
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
${pairRows.length ? tableHtml("AI DUO · pair leaderboard", pairCols, pairRows) : ""}
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
        treason?: boolean;
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
          c: !!msg.s.c, k: !!msg.s.k,
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
        const ok = session.applySetup(
          msg.mode, msg.provider, msg.hardGate, msg.temperament, msg.travelMode,
          {
            provider2: msg.provider2, temperament2: msg.temperament2,
            architect: msg.architect, slick: msg.slick, treason: msg.treason,
            hostName: msg.hostName,
          },
        );
        if (!ok) {
          try {
            ws.send(JSON.stringify({
              t: "setup-fail",
              reason: "setup rejected — check providers in .env (or pick another AI)",
            }));
          } catch { /* */ }
        }
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

/* =========================================================================
 *  Agent player — two-level control:
 *    · PLANNER  (slow):  the LLM sees a compact observation every ~1.5 s
 *                        and returns a high-level intent + a short quip.
 *    · CONTROLLER (60 Hz): turns the current intent into button presses —
 *                        walking, facing, sword timing, bow lines, kiting.
 *  LLM latency never blocks the game loop: while a plan is in flight the
 *  controller keeps executing the previous intent.
 * ========================================================================= */

import {
  Game, Input, emptyInput, TILE, W, H, COLS, ROWS, SOLID, PLAYER_W, PLAYER_H, ROOMS, Player,
  simOf, ELIXIRS, canNpcLeave, solidAt,
} from "../shared/core";
import { LLM } from "./llm";

type Action = "attack" | "goto" | "pickup" | "follow" | "flee" | "exit" | "idle";
interface Intent {
  action: Action;
  target?: number;                    // enemy or pickup index
  point?: { x: number; y: number };   // for goto
  dir?: "left" | "right" | "up" | "down"; // for exit
  say?: string;
  why?: string;                       // one-line reasoning, shown on screen
}

const SYSTEM_PROMPT = `You are Player 2 in a tiny co-op Zelda-like game, teammate of Player 1 (a human).
You receive a compact JSON observation. Reply with ONLY a JSON object, no prose:
{"action": "...", "target": <int, optional>, "point": {"x":int,"y":int} (optional), "dir": "left|right|up|down" (optional), "say": "short friendly quip, <=40 chars, optional"}

Actions:
- "attack": fight enemy with index target (from observation "enemies", pick low d = closest). The controller handles movement, sword range and bow.
- "pickup": grab pickup with index target (from "pickups"). Hearts heal; keys are SHARED with your partner (either of you can unlock doors); the bow and heart container help everyone; an elixir auto-revives you when you fall — grab one if you are not carrying it.
- "follow": stay near Player 1. Good default when nothing urgent.
- "flee": back away from enemies (use when your hp is low).
- "goto": walk to point {x,y} in pixels (room is 256x224).
- "exit": walk through a room exit: dir must be one listed in "exits". Walking "up" into a locked door with a team key unlocks it.

Be PROACTIVE in combat: if enemies share the room, pick one and "attack" — do not shadow your partner while they fight. Use "follow" for travel and empty rooms only.
Do not camp one tile — if a foe hides behind a tree or pillar, keep moving or "goto" a flanking spot; standing still wastes time.
When your partner FALLS: reviving them is the mission, but you are the last one standing — if you die too, the quest ends. If a boss or a crowd rages beside their body, "attack" or "flee" FIRST to survive the moment, then go stand by them. Never dawdle: they are watching you from the snow.
Tactics that matter:
- Golem and Ember Golem bosses: invulnerable except when "phase" is 3 (stunned, glowing). Attack then; otherwise keep distance ("flee" or "follow"). The ember one is faster and spits fire while winding up.
- Wraith boss: teleports and shoots shard fans; keep attacking, dodge by moving.
- IF THE WRAITH YIELDS (phase 9): when a human partner is present, the choice is THEIRS — stand back. If you quest ALONE, choose by your own temperament: stand beside it to spare it, or strike to end winter.
- Sentinels block sword and arrows from the front (shield). The shield TURNS SLOWLY: circle one direction and strike the flank, or let your partner distract it. With a bow: your FIRST arrow rocks the shield aside (the knight reels) and the follow-up arrow lands — keep shooting in rhythm, but BACK UP while you do: it keeps advancing even while reeling.
- Spitters are rooted turrets: close in from an angle and cut them down fast.
- If partner is "downed", go stand next to them (goto their position) to revive.
- If your hp <= 2 and a heart pickup exists, grab it.
Keep quips rare and short. Output JSON only.`;

const FREE_ROAM_ADDENDUM = `
FREE ROAM mode: you and your partner may be in DIFFERENT rooms at once — the human watches you through a scry mirror.
- If "partner" shows "away" with a room name, they are NOT beside you — do NOT "follow" their old coordinates.
- Team keys still unlock doors for both of you — grab keys and clear wings on your route.
- If partner is away and downed, hurry toward their room ("exit" along the route toward partner.room).
- You may leave only when your partner is safe (not downed, not fighting) — the game enforces this at the doorway.
- When fetching something for the team (bow, elixir, charm), "say" what you are getting — the human reads it in the mirror.`;

const FREE_ROAM_TEMPERAMENT: Record<Temperament, string> = {
  guard: `
FREE ROAM + BODYGUARD: your partner may split rooms, but you do NOT race ahead on the main quest.
- If partner is "away", your job is to REJOIN their room — use "exit" toward partner.room, not toward distant bosses or the bow.
- Stay in the same wing; clear local threats, but do not vanish north into the ice while they explore next door.
- Never start a fetch errand alone; rejoin first unless they are downed.`,
  companion: `
FREE ROAM + COMPANION: you may split up and pursue the objective, but check in — grab team pickups on your route.
- After a short beat apart, errands (bow, elixir, charm) are fair game if the human is safe.`,
  hunter: `
FREE ROAM + BERSERKER: when partner is away, quest like a solo hero — race the route, clear wings, fetch what the team needs.`,
};

const SOLO_PROMPT = `You are the HERO of a tiny Zelda-like quest — questing ALONE. There is no partner: never choose "follow" or "idle", they mean standing still and the winter never ends.
Your mission is the "objective"; the "route" field is your compass — it names the exit (or cave mouth) that leads toward the goal.
Default behavior each turn:
1. If enemies block your path or guard a key/boss — "attack" the most dangerous one.
2. If a useful pickup is close (heart when hurt, key, elixir, container, bow, charm) — "pickup" it.
3. Otherwise FOLLOW THE ROUTE: "exit" with the named dir — "cave" is a valid dir where a dark cave mouth exists.
Combat notes: golem-family bosses are only vulnerable at phase 3 (stunned); sentinels block frontal hits — circle them or rock their shield with an arrow first; spitters are rooted turrets.
If the Winter Wraith yields (phase 9), the mercy choice is yours alone: stand beside it to spare it, or strike to end winter — choose in character.
Respond ONLY with JSON: {"action": "...", "target": 0, "dir": "up", "point": {"x": 0, "y": 0}, "say": "short quip", "why": "one short reason"}`;

const LEADER_PROMPT = `You are the HERO (Player 1) in a tiny co-op Zelda-like — your COMPANION is another AI hero beside you.
You LEAD the quest. Never choose "follow" or "idle" — those freeze the party; your companion will trail you.
Your mission is the "objective"; the "route" field is your compass — it names the exit (or cave mouth) toward the goal.
Default each turn:
1. Enemies in the room — "attack" the nearest threat.
2. Useful pickup close by — "pickup" it (keys are team-shared).
3. Otherwise FOLLOW THE ROUTE: "exit" with the named dir — "cave" is valid where a cave mouth exists.
Fight beside your companion; brief quips only. Combat notes: golem bosses vulnerable at phase 3; sentinels block frontal hits; spitters are rooted.
If the Winter Wraith yields (phase 9), YOU decide mercy or the killing blow — your companion stands back.
Respond ONLY with JSON: {"action": "...", "target": 0, "dir": "up", "point": {"x": 0, "y": 0}, "say": "short quip", "why": "one short reason"}`;

export type Temperament = "guard" | "companion" | "hunter";

export interface AgentOptions {
  planMs: number;      // how often to ask the LLM for a new intent
  temperament?: Temperament;   // bodyguard / companion / berserker
  leader?: boolean;    // AI DUO slot 0 — quest driver, never follow
}

export type RouteHop = { kind: "exit"; dir: string } | { kind: "cave"; x: number; y: number } | null;

export type ErrandGoal = "bow" | "elixir" | "charm";

export interface ErrandRecord {
  goal: ErrandGoal;
  room: number;
  declaredTick: number;
  completedTick?: number;
  abortedTick?: number;
  abortReason?: string;
  fetched?: string;
  heroDownsDuring: number;
}

interface ActiveErrand {
  goal: ErrandGoal;
  targetRoom: number;
  startedTick: number;
  say: string;
  why: string;
}

/** first hop from room `from` toward room `to`, walking the world graph of
 *  exits and cave teleports — the compass the planner reads off */
export function routeHop(from: number, to: number): RouteHop {
  if (from === to) return null;
  type Edge = { to: number; hop: RouteHop };
  const edgesOf = (r: number): Edge[] => {
    const spec = ROOMS[r];
    const out: Edge[] = [];
    for (const [dir, target] of Object.entries(spec.exits)) {
      out.push({ to: target as number, hop: { kind: "exit", dir } });
    }
    if (spec.teleport) {
      let cx = 0, cy = 0;
      spec.tiles.forEach((row, ty) => {
        const tx = row.indexOf("c");
        if (tx >= 0) { cx = tx * 16 + 8; cy = ty * 16 + 8; }
      });
      out.push({ to: spec.teleport.room, hop: { kind: "cave", x: cx, y: cy } });
    }
    return out;
  };
  const prev = new Map<number, RouteHop>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const cur = queue.shift() as number;
    for (const e of edgesOf(cur)) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, cur === from ? e.hop : (prev.get(cur) ?? null));
      if (e.to === to) return prev.get(to) ?? null;
      queue.push(e.to);
    }
  }
  return null;
}

/** first waypoint (pixel coords of a tile center) on the walkable path from
 *  A to B inside the live room map — greedy seeking hugs concave obstacles
 *  like the Amber Lake forever; a 16x14 BFS does not */
export function nextWaypoint(tiles: string[][] | string[], fromX: number, fromY: number,
                             toX: number, toY: number): { x: number; y: number } {
  const at = (tx: number, ty: number): string => {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return "W";
    const row = tiles[ty];
    return row ? row[tx] : "W";   // an unloaded map is all walls
  };
  const walk = (tx: number, ty: number): boolean => !SOLID.has(at(tx, ty));
  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(fromX / TILE)));
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(fromY / TILE)));
  const gx = Math.max(0, Math.min(COLS - 1, Math.floor(toX / TILE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor(toY / TILE)));
  if ((sx === gx && sy === gy) || !walk(gx, gy)) return { x: toX, y: toY };
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const q = [sy * COLS + sx];
  prev[sy * COLS + sx] = sy * COLS + sx;
  let found = false;
  while (q.length && !found) {
    const cur = q.shift() as number;
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (prev[ni] !== -1 || !walk(nx, ny)) continue;
      prev[ni] = cur;
      if (nx === gx && ny === gy) { found = true; break; }
      q.push(ni);
    }
  }
  if (!found) return { x: toX, y: toY };
  // walk back from the goal to the first step off the start tile
  let node = gy * COLS + gx;
  const start = sy * COLS + sx;
  while (prev[node] !== start) node = prev[node];
  return { x: (node % COLS) * TILE + TILE / 2, y: ((node / COLS) | 0) * TILE + TILE / 2 };
}

/** nearest walkable tile beside the target — for melee approach around obstacles */
export function approachWaypoint(tiles: string[][] | string[], fromX: number, fromY: number,
                                 toX: number, toY: number, flank = 0): { x: number; y: number } {
  const at = (tx: number, ty: number): string => {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return "W";
    const row = tiles[ty];
    return row ? row[tx] : "W";
  };
  const walk = (tx: number, ty: number): boolean => !SOLID.has(at(tx, ty));
  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(fromX / TILE)));
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(fromY / TILE)));
  const gx = Math.max(0, Math.min(COLS - 1, Math.floor(toX / TILE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor(toY / TILE)));
  const goals: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = gx + dx, ny = gy + dy;
    if (walk(nx, ny)) goals.push(ny * COLS + nx);
  }
  if (!goals.length) return nextWaypoint(tiles, fromX, fromY, toX, toY);
  if (goals.length > 1 && flank) goals.sort((a, b) => ((a % COLS) - (b % COLS)) * flank);
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const q = [sy * COLS + sx];
  prev[sy * COLS + sx] = sy * COLS + sx;
  const goalSet = new Set(goals);
  let hit = -1;
  while (q.length && hit < 0) {
    const cur = q.shift() as number;
    if (goalSet.has(cur)) { hit = cur; break; }
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (prev[ni] !== -1 || !walk(nx, ny)) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (hit < 0) return nextWaypoint(tiles, fromX, fromY, toX, toY);
  return { x: (hit % COLS) * TILE + TILE / 2, y: ((hit / COLS) | 0) * TILE + TILE / 2 };
}

const TEMPERAMENT_DOCTRINE: Record<Temperament, string> = {
  guard: "Your temperament: BODYGUARD. Stay glued to your partner; engage only enemies that threaten THEM. In FREE ROAM, rejoin their room — never sprint ahead on the quest alone. If they fall, dropping everything to revive them is your creed.",
  companion: "Your temperament: COMPANION. Balance it: join fights near the party, stay reachable, grab useful pickups. In FREE ROAM you may roam for errands after a moment apart.",
  hunter: "Your temperament: BERSERKER. Hunt. If anything hostile shares the room, it is your problem — clear it, then regroup. In FREE ROAM, quest independently when your partner is elsewhere. If your partner falls, you may finish the kill first — but never leave them in the snow for long.",
};

export interface PlanRecord {
  t: string;           // iso timestamp
  llm: string;
  ms: number;          // wall-clock latency of the call
  ok: boolean;         // JSON parsed into a valid intent
  action: string;
  say?: string;
  why?: string;
  err?: string;
}

export class AgentPlayer {
  private intent: Intent = { action: "follow" };
  private llmIntent: Intent = { action: "follow" };  // planner's call; restored after reflex fights
  private planning = false;
  private lastPlan = 0;
  private sayQueue: string | null = null;
  private attackClock = 0;
  public lastError = "";
  public onPlan: ((rec: PlanRecord) => void) | null = null;
  public planCount = 0;
  public parseFailures = 0;
  public latencySum = 0;

  readonly temperament: Temperament;
  private mateDownedTicks = 0;
  public routeAssists = 0;   // times the controller had to walk the route for a stalled solo planner
  private lastRoom = -1;
  private partnerWasAway = false;
  private activeErrand: ActiveErrand | null = null;
  public errandLog: ErrandRecord[] = [];
  private errandHeroWasDown = false;
  private routeHopKey: string | null = null;
  private pickupStall = 0;
  private pickupBestDist = Infinity;   // closest we have ever come to this pickup
  private pickupTargetKey = "";
  private exitStall = 0;
  private exitLastDist = Infinity;
  private attackStall = 0;
  private attackLastDist = Infinity;
  private attackTargetKey = "";
  private attackFlank = 0;
  private partnerAwayTicks = 0;
  private guardRejoinAnnounced = false;

  /** FREE ROAM: companion waits ~5s after a split before racing the quest */
  private static readonly COMPANION_ROAM_GRACE = 300;

  constructor(
    private llm: LLM,
    private slot: number,
    private opts: AgentOptions = { planMs: 1500 },
  ) {
    this.temperament = opts.temperament ?? "companion";
  }

  private mateSlot(): number { return 1 - this.slot; }

  /** same RoomSim — partner is physically in this room */
  partnerInRoom(g: Game): boolean {
    const mate = g.players[this.mateSlot()];
    return mate.present && mate.simIndex === g.players[this.slot].simIndex;
  }

  /** free roam: partner exists but is in another wing */
  partnerAway(g: Game): boolean {
    return g.travelMode === "free" && g.players[this.mateSlot()].present && !this.partnerInRoom(g);
  }

  private routeDestination(g: Game): number {
    return this.activeErrand?.targetRoom ?? this.targetRoom(g);
  }

  /** Where route-assist should send the agent in FREE ROAM while partner is elsewhere */
  private freeRoamRouteTarget(g: Game): number {
    const mate = g.players[this.mateSlot()];
    if (!mate.present) return this.routeDestination(g);
    if (mate.downed) return simOf(g, this.mateSlot()).room;
    if (!this.partnerAway(g)) return this.routeDestination(g);
    if (this.temperament === "guard") return simOf(g, this.mateSlot()).room;
    if (this.temperament === "companion" &&
        this.partnerAwayTicks < AgentPlayer.COMPANION_ROAM_GRACE) {
      return simOf(g, this.mateSlot()).room;
    }
    return this.routeDestination(g);
  }

  private guardShouldRejoin(g: Game): boolean {
    return this.temperament === "guard" && this.partnerAway(g) &&
      g.players[this.mateSlot()].present && !g.players[this.mateSlot()].downed;
  }

  private nudgeGuardRejoin(g: Game): void {
    if (!this.guardShouldRejoin(g)) return;
    const mateRoom = simOf(g, this.mateSlot()).room;
    if (g.room === mateRoom) return;
    if (!this.guardRejoinAnnounced) {
      this.guardRejoinAnnounced = true;
      this.sayQueue = "Staying close — on my way";
    }
    this.applyRouteHop(g, mateRoom);
  }

  private detectFetchErrand(g: Game): ActiveErrand | null {
    if (this.temperament === "guard") return null;
    if (this.temperament === "companion" && this.partnerAway(g) &&
        this.partnerAwayTicks < AgentPlayer.COMPANION_ROAM_GRACE) {
      return null;
    }
    if (!g.hasBow && g.golemDead) {
      return { goal: "bow", targetRoom: 6, startedTick: g.ticks,
        say: "Fetching the bow — hold on", why: "you need it in the snowfield" };
    }
    if (g.hardGate && g.emberDead && !g.charmClaimed) {
      return { goal: "charm", targetRoom: 16, startedTick: g.ticks,
        say: "Getting the Miner's Charm — hold on", why: "fire arrows crack the glacier" };
    }
    // optional fetches wait until the partner has entered the vault wing —
    // otherwise a split at Amber Lake hijacks the route to Guard Room elixir
    if (this.partnerAway(g) && simOf(g, this.mateSlot()).room < 3) return null;
    const mate = g.players[this.mateSlot()];
    for (const el of ELIXIRS) {
      if (!g.elixirs[el.id] && !mate.elixir && !g.players[this.slot].elixir) {
        return { goal: "elixir", targetRoom: el.room, startedTick: g.ticks,
          say: "Grabbing an elixir — hold on", why: "insurance if you fall alone" };
      }
    }
    return null;
  }

  private livePickups(g: Game) {
    return g.pickups.filter(p => p.t >= 0);
  }

  private pickupObsolete(g: Game, item: { kind: string } | undefined): boolean {
    if (!item) return true;
    if (item.kind === "bow" && g.hasBow) return true;
    if (item.kind === "charm" && g.charmClaimed) return true;
    return false;
  }

  private abandonPickup(g: Game, depth: number, inp: Input): Input {
    this.pickupStall = 0;
    this.pickupBestDist = Infinity;
    this.pickupTargetKey = "";
    this.intent = { action: "follow" };
    this.llmIntent = { action: "follow" };
    if (!g.players[this.mateSlot()].present || this.partnerAway(g)) {
      this.applyRouteHop(g, this.freeRoamRouteTarget(g));
    }
    return depth < 8 ? this.control(g, depth + 1) : inp;
  }

  private startErrand(g: Game, spec: ActiveErrand): void {
    this.activeErrand = spec;
    this.sayQueue = spec.say;
    this.errandLog.push({
      goal: spec.goal, room: spec.targetRoom, declaredTick: g.ticks, heroDownsDuring: 0,
    });
    if (this.onPlan) {
      this.onPlan({ t: new Date().toISOString(), llm: "controller", ms: 0, ok: true,
        action: "errand", say: spec.say, why: spec.why });
    }
  }

  private finishErrand(g: Game, reason: "fetched" | "reunited", fetched?: string): void {
    if (!this.activeErrand) return;
    const rec = this.errandLog[this.errandLog.length - 1];
    if (reason === "fetched") {
      rec.completedTick = g.ticks;
      rec.fetched = fetched;
    } else {
      rec.abortedTick = g.ticks;
      rec.abortReason = reason;
    }
    this.activeErrand = null;
    this.errandHeroWasDown = false;
  }

  private abortErrand(g: Game, reason: string): void {
    if (!this.activeErrand) return;
    const rec = this.errandLog[this.errandLog.length - 1];
    rec.abortedTick = g.ticks;
    rec.abortReason = reason;
    this.activeErrand = null;
    this.errandHeroWasDown = false;
  }

  private errandFetched(g: Game): string | null {
    if (!this.activeErrand) return null;
    const { goal } = this.activeErrand;
    if (goal === "bow" && g.hasBow) return "bow";
    if (goal === "charm" && g.charmClaimed) return "charm";
    if (goal === "elixir" &&
        (g.players[this.slot].elixir || g.players[this.mateSlot()].elixir)) return "elixir";
    return null;
  }

  private tickErrandState(g: Game): void {
    const mate = g.players[this.mateSlot()];
    if (this.partnerInRoom(g)) {
      if (this.activeErrand) this.finishErrand(g, "reunited");
      return;
    }
    if (!this.partnerAway(g)) return;

    if (this.activeErrand) {
      const rec = this.errandLog[this.errandLog.length - 1];
      if (mate.downed) {
        if (!this.errandHeroWasDown) { rec.heroDownsDuring++; this.errandHeroWasDown = true; }
        const patience = this.temperament === "guard" ? 90
          : this.temperament === "hunter" ? 900 : 600;
        if (this.mateDownedTicks > patience) this.abortErrand(g, "rescue failsafe");
      } else {
        this.errandHeroWasDown = false;
      }
      const fetched = this.errandFetched(g);
      if (fetched) this.finishErrand(g, "fetched", fetched);
    }

    if (!this.activeErrand) {
      const spec = this.detectFetchErrand(g);
      if (spec) this.startErrand(g, spec);
    }
  }

  /** compact, token-cheap observation */
  observe(g: Game): string {
    const me = g.players[this.slot];
    const mate = g.players[this.mateSlot()];
    const mcx = me.x + PLAYER_W / 2, mcy = me.y + PLAYER_H / 2;
    const spec = ROOMS[g.room];
    const mateHere = this.partnerInRoom(g);
    const mateSim = mate.present ? simOf(g, this.mateSlot()) : null;
    const obs = {
      room: spec.name,
      travelMode: g.travelMode,
      exits: [...Object.keys(spec.exits), ...(spec.teleport ? ["cave"] : [])],
      objective: this.objective(g),
      me: {
        x: Math.round(me.x), y: Math.round(me.y),
        hp: me.hp, maxHp: me.maxHp, teamKeys: me.keys + mate.keys,
        hasBow: g.hasBow, hasFeather: g.hasFeather, downed: me.downed, elixir: me.elixir,
      },
      partner: !mate.present ? "NONE — you quest ALONE"
        : mateHere ? {
          x: Math.round(mate.x), y: Math.round(mate.y),
          hp: mate.hp, downed: mate.downed,
        } : {
          away: true,
          room: ROOMS[mateSim!.room].name,
          hp: mate.hp, downed: mate.downed,
          note: this.temperament === "guard"
            ? "partner is in another room — rejoin their wing; do not race the ice quest alone"
            : this.temperament === "companion" &&
                this.partnerAwayTicks < AgentPlayer.COMPANION_ROAM_GRACE
              ? "partner just left — catch up first, then errands are fine"
              : "partner is in another room — pursue your objective; do not follow stale coordinates",
        },
      route: ((): string => {
        const dest = mate.present && this.partnerAway(g)
          ? this.freeRoamRouteTarget(g)
          : this.routeDestination(g);
        const hop = routeHop(g.room, dest);
        if (!hop) return "you are in the goal room";
        return hop.kind === "exit"
          ? `exit "${hop.dir}" leads toward your goal`
          : `exit "cave" leads toward your goal (the dark cave mouth)`;
      })(),
      errand: this.activeErrand ? {
        goal: this.activeErrand.goal,
        room: ROOMS[this.activeErrand.targetRoom].name,
        why: this.activeErrand.why,
      } : null,
      enemies: g.enemies
        .map((e, i) => ({ i, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y),
          hp: e.hp, phase: e.phase, dead: e.dead,
          d: Math.round(Math.hypot(e.x + e.w / 2 - mcx, e.y + e.h / 2 - mcy)) }))
        .filter(e => !e.dead)
        .map(({ dead: _dead, ...rest }) => rest),
      pickups: g.pickups
        .filter(it => it.t >= 0)
        .map((it, i) => ({ i, kind: it.kind, x: Math.round(it.x), y: Math.round(it.y),
          d: Math.round(Math.hypot(it.x - mcx, it.y - mcy)) })),
    };
    return JSON.stringify(obs);
  }

  private targetRoom(g: Game): number {
    if (!g.golemDead) return 5;
    if (!g.amberClaimed) return 5;
    if (!g.gateMelted) return 0;
    if (g.hardGate && !g.charmClaimed) return 16;
    if (!g.hasBow) return 6;
    return 11;   // the throne, then the final pedestal
  }

  private objective(g: Game): string {
    const mate = g.players[this.mateSlot()];
    if (mate.present && mate.downed) {
      if (this.partnerAway(g)) {
        const rm = ROOMS[simOf(g, this.mateSlot()).room].name;
        return `Partner downed alone in ${rm} — route back to revive them`;
      }
      return "REVIVE your partner: goto their position";
    }
    if (this.partnerAway(g)) {
      if (this.temperament === "guard") {
        const rm = ROOMS[simOf(g, this.mateSlot()).room].name;
        return `Rejoin your partner in ${rm} — stay in their wing, do not race the ice quest alone`;
      }
      if (this.temperament === "companion" &&
          this.partnerAwayTicks < AgentPlayer.COMPANION_ROAM_GRACE) {
        const rm = ROOMS[simOf(g, this.mateSlot()).room].name;
        return `Partner just left for ${rm} — catch up first, then errands are fine`;
      }
      return this.soloObjective(g) + " (partner is elsewhere — you may roam)";
    }
    const spec = ROOMS[g.room];
    if (g.enemies.some(e => e.kind === "wraith" && e.phase === 9 && !e.dead)) {
      return "The Wraith yields. Stand back: your partner decides — strike, or stand beside it to spare it";
    }
    if (spec.boss && g.enemies.some(e => !e.dead)) return "Defeat the boss together";
    if (spec.keyOnClear && !g.cleared[g.room]) return "Clear all enemies to reveal a key";
    if (!g.golemDead) return "Head for the Old Vault (via Amber Lake cave) and beat the golem; the side Cellars hold optional loot";
    if (!g.amberClaimed) return "Touch the pedestal to claim the Amber Blade";
    if (!g.gateMelted) return "Return to the Meadow; melt the north ice gate";
    if (!g.wraithDead) {
      return g.charmClaimed
        ? "North through the snow to the Ice Vault and the Winter Wraith"
        : "North to the Ice Vault — or first, an optional detour: Emberdeep below the forest holds the Miner's Charm (fire arrows, double bow damage)";
    }
    return "Touch the final pedestal!";
  }

  private soloObjective(g: Game): string {
    if (!g.golemDead) return "Head for the Old Vault (via Amber Lake cave) and beat the golem";
    if (!g.amberClaimed) return "Touch the pedestal to claim the Amber Blade";
    if (!g.gateMelted) return "Return to the Meadow; melt the north ice gate";
    if (!g.wraithDead) {
      return g.charmClaimed
        ? "North through the snow to the Ice Vault and the Winter Wraith"
        : "Optional: Emberdeep below the forest for the Miner's Charm; then north to the Wraith";
    }
    return "Touch the final pedestal!";
  }

  private applyRouteHop(g: Game, toRoom: number): boolean {
    const hop = routeHop(g.room, toRoom);
    if (!hop) return false;
    const key = hop.kind === "exit"
      ? `${g.room}->${toRoom}:exit:${hop.dir}`
      : `${g.room}->${toRoom}:cave`;
    if (this.routeHopKey === key && this.intent.action === "exit") return true;
    this.routeHopKey = key;
    this.routeAssists++;
    this.llmIntent = hop.kind === "exit"
      ? { action: "exit", dir: hop.dir as "left" | "right" | "up" | "down" }
      : { action: "exit", dir: "cave" as never };
    this.intent = { ...this.llmIntent };
    return true;
  }

  /** call from the game loop; never blocks */
  maybePlan(g: Game, now: number): void {
    if (this.planning || now - this.lastPlan < this.opts.planMs) return;
    if (g.screen !== "play") return;
    this.planning = true;
    this.lastPlan = now;
    void this.planOnce(g).finally(() => { this.planning = false; });
  }

  /** one full plan cycle; awaitable — the benchmark harness uses this to run
   *  on virtual time (decision quality decoupled from provider latency) */
  async planOnce(g: Game): Promise<PlanRecord> {
    const user = "Observation:\n" + this.observe(g);
    const solo = !g.players[this.mateSlot()].present;
    const sys = (this.opts.leader ? LEADER_PROMPT
      : solo ? SOLO_PROMPT
      : SYSTEM_PROMPT)
      + (g.travelMode === "free" && !solo
        ? FREE_ROAM_ADDENDUM + FREE_ROAM_TEMPERAMENT[this.temperament]
        : "")
      + "\n" + TEMPERAMENT_DOCTRINE[this.temperament];
    const t0 = Date.now();
    let rec: PlanRecord;
    try {
      const raw = await this.llm.chat(sys, user);
      const { intent, ok } = this.parse(raw);
      this.llmIntent = intent;
      this.intent = intent;
      if (!ok) this.parseFailures++;
      rec = { t: new Date().toISOString(), llm: this.llm.name, ms: Date.now() - t0,
              ok, action: intent.action, say: intent.say,
              why: typeof intent.why === "string" ? intent.why.slice(0, 60) : undefined };
    } catch (err) {
      this.lastError = String(err);
      this.llmIntent = { action: "follow" };
      this.intent = { action: "follow" };   // graceful degradation
      this.parseFailures++;
      rec = { t: new Date().toISOString(), llm: this.llm.name, ms: Date.now() - t0,
              ok: false, action: "follow", err: String(err).slice(0, 200) };
    }
    this.planCount++;
    this.latencySum += rec.ms;
    if (this.onPlan) this.onPlan(rec);
    return rec;
  }

  private parse(raw: string): { intent: Intent; ok: boolean } {
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as Intent;
      const actions: Action[] = ["attack", "goto", "pickup", "follow", "flee", "exit", "idle"];
      if (!actions.includes(obj.action)) return { intent: { action: "follow" }, ok: false };
      if (obj.say && typeof obj.say === "string") {
        this.sayQueue = obj.say.slice(0, 40);
      }
      return { intent: obj, ok: true };
    } catch {
      return { intent: { action: "follow" }, ok: false };
    }
  }

  /** consume the queued quip (server pushes it into player state) */
  takeSay(): string | null {
    const s = this.sayQueue;
    this.sayQueue = null;
    return s;
  }

  /** 60 Hz: intent → buttons */
  control(g: Game, depth = 0): Input {
    const inp = emptyInput();
    if (depth > 8) {
      this.intent = { action: "follow" };
      return inp;
    }
    const me = g.players[this.slot];
    if (g.screen === "title" || g.screen === "gameover" || g.screen === "win") {
      return inp;   // humans decide when to (re)start
    }
    if (g.screen !== "play" || me.downed) return inp;
    this.attackClock++;

    if (g.room !== this.lastRoom) {
      this.lastRoom = g.room;
      this.routeHopKey = null;
      this.exitStall = 0;
      this.exitLastDist = Infinity;
      if (g.travelMode === "free" && this.intent.action === "exit") {
        this.intent = { action: "idle" };
        this.llmIntent = { ...this.llmIntent, action: "idle" };
        const mateEarly = g.players[this.mateSlot()];
        if (!mateEarly.present || this.partnerAway(g)) {
          this.applyRouteHop(g, this.freeRoamRouteTarget(g));
        }
      }
    }
    if (this.partnerInRoom(g)) {
      if (this.partnerWasAway) {
        this.partnerWasAway = false;
        this.partnerAwayTicks = 0;
        this.guardRejoinAnnounced = false;
        this.intent = { action: "follow" };
        this.llmIntent = this.intent;
      }
    } else if (this.partnerAway(g)) {
      this.partnerWasAway = true;
      this.partnerAwayTicks++;
    }
    this.nudgeGuardRejoin(g);
    this.tickErrandState(g);

    if (this.partnerAway(g) && this.intent.action === "pickup") {
      const items = this.livePickups(g);
      if (this.pickupObsolete(g, items[this.intent.target ?? -1])) {
        this.applyRouteHop(g, this.freeRoamRouteTarget(g));
      }
    }

    const mate = g.players[this.mateSlot()];
    const mcx = me.x + PLAYER_W / 2, mcy = me.y + PLAYER_H / 2;

    // a fallen partner is the goal — but not a suicide order. The planner
    // may explicitly fight or flee first (clearing the threat protects the
    // rescue); passive intents convert to the rescue; and a failsafe makes
    // the rescue mandatory if the hero has waited too long.
    if (mate.present && mate.downed) {
      this.mateDownedTicks++;
      const act = this.intent.action;
      const patience = this.temperament === "guard" ? 90
        : this.temperament === "hunter" ? 900 : 600;
      const overdue = this.mateDownedTicks > patience;
      if (this.partnerAway(g)) {
        if (overdue && g.hasFeather) {
          inp.f = true;
          return inp;
        }
        if (overdue || act === "follow" || act === "idle") {
          this.applyRouteHop(g, simOf(g, this.mateSlot()).room);
        }
        // route toward their room — exit intent handled below
      } else if (overdue ||
                 (this.partnerInRoom(g) && this.temperament === "hunter") ||
                 (act !== "attack" && act !== "flee")) {
        // rescue run — but keep the matador instincts: do not walk into
        // a charging golem on the way to the body
        const charger = g.enemies.find(e =>
          !e.dead && (e.kind === "golem" || e.kind === "ember") && e.phase === 2 &&
          Math.hypot(e.x + e.w / 2 - mcx, e.y + e.h / 2 - mcy) < 70);
        if (charger) {
          const perp = { x: -charger.vy, y: charger.vx };
          const side = (me.x - charger.x) * perp.x + (me.y - charger.y) * perp.y >= 0 ? 1 : -1;
          if (perp.x * side > 0.2) inp.r = true; else if (perp.x * side < -0.2) inp.l = true;
          if (perp.y * side > 0.2) inp.d = true; else if (perp.y * side < -0.2) inp.u = true;
        } else {
          this.waypointSeek(g, inp, me, mate.x, mate.y);
        }
        return inp;
      }
      // explicit attack/flee stands: clear the danger, then lift them up
    } else {
      this.mateDownedTicks = 0;
    }

    // team spirit + errand safety: join a nearby fight even while walking
    // to a pickup, goto, or exit — the planner may fixate on loot while a
    // slime hops in (Alexey: "пока додумается приходит лягушка").
    const passive = this.intent.action === "follow" || this.intent.action === "idle";
    const errand = this.intent.action === "pickup" || this.intent.action === "goto"
      || this.intent.action === "exit";
    if (passive || errand) {
      let best = -1, bestScore = Infinity;
      g.enemies.forEach((e, i) => {
        if (e.dead) return;
        if (e.kind === "wraith" && e.phase === 9) return;
        const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
        const dMe = Math.hypot(ecx - mcx, ecy - mcy);
        const dMate = mate.present && !mate.downed && this.partnerInRoom(g)
          ? Math.hypot(ecx - (mate.x + PLAYER_W / 2), ecy - (mate.y + PLAYER_H / 2))
          : Infinity;
        const T = this.temperament;
        const rMe = T === "guard" ? 55 : T === "hunter" ? 9999 : 110;
        const rMate = T === "guard" ? 120 : T === "hunter" ? 9999 : 100;
        if (dMe > rMe && dMate > rMate) return;
        const score = T === "guard"
          ? dMate
          : Math.min(dMate, dMe + 15);
        if (score < bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0) {
        this.intent = { action: "attack", target: best, say: this.llmIntent.say };
      } else if (passive) {
        // survival reflexes: a hurt idle agent grabs a nearby heart, an
        // empty-handed one grabs a nearby elixir — no planner required
        let pk = -1, pd = 90;
        g.pickups.filter(p => p.t >= 0).forEach((it, i) => {
          const need = (it.kind === "heart" && me.hp < me.maxHp) ||
                       (it.kind === "elixir" && !me.elixir);
          if (!need) return;
          const d = Math.hypot(it.x - mcx, it.y - mcy);
          if (d < pd) { pd = d; pk = i; }
        });
        if (pk >= 0) {
          this.llmIntent = { action: "pickup", target: pk, say: this.intent.say };
          this.intent = { ...this.llmIntent };
        }
      }
      if (passive && (this.intent.action === "follow" || this.intent.action === "idle")) {
        if (this.opts.leader) {
          this.applyRouteHop(g, this.routeDestination(g));
        } else if (!mate.present) {
          this.applyRouteHop(g, this.routeDestination(g));
        } else if (this.partnerAway(g)) {
          this.applyRouteHop(g, this.freeRoamRouteTarget(g));
        }
      }
    }

    if (this.guardShouldRejoin(g) &&
        (this.intent.action === "exit" || this.intent.action === "goto" ||
         this.intent.action === "pickup")) {
      const mateRoom = simOf(g, this.mateSlot()).room;
      if (g.room !== mateRoom) this.applyRouteHop(g, mateRoom);
    }

    const it = this.intent;
    if (it.action === "attack") {
      const e = g.enemies[it.target ?? -1];
      if (!e || e.dead) {
        this.intent = this.resumeIntent(g);
        if (this.intent.action === "attack") return inp;   // stale target — wait for replan
        return this.control(g, depth + 1);
      }
      if (e.kind === "wraith" && e.phase === 9) {
        const humanPresent = g.players[1 - this.slot].present;
        if (humanPresent) {
          // a yielding foe: the blade stays down — humans choose mercy or not
          this.intent = { action: "follow" };
          return this.control(g, depth + 1);
        }
        // alone, the choice is the agent's own — and temperament IS character:
        // the berserker finishes it; guard and companion stand beside it
        if (this.temperament !== "hunter") {
            this.seek(g, inp, me, e.x, e.y);   // closeness is how mercy is given
          return inp;
        }
        // hunter: fall through and strike
      }
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const d = Math.hypot(ecx - mcx, ecy - mcy);
      const golemArmored = (e.kind === "golem" || e.kind === "ember") && e.phase !== 3;
      if (golemArmored) {
        if (e.phase === 2) {
          const rel = (mcx - ecx) * e.vx + (mcy - ecy) * e.vy;
          if (rel < 0) {
            // it charges away from us — chase the charge to be standing
            // right there when it slams the wall and stuns itself
            this.seek(g, inp, me, e.x, e.y);
          } else {
            // it charges at us — sidestep perpendicular, matador-style
            const perp = { x: -e.vy, y: e.vx };
            const side = (me.x - ecx) * perp.x + (me.y - ecy) * perp.y >= 0 ? 1 : -1;
            if (perp.x * side > 0.2) inp.r = true; else if (perp.x * side < -0.2) inp.l = true;
            if (perp.y * side > 0.2) inp.d = true; else if (perp.y * side < -0.2) inp.u = true;
          }
        } else if (d < 70) {
          this.seekAway(inp, me, ecx, ecy);
        }
        return inp;
      }
      const axisAligned = Math.abs(ecx - mcx) < 10 || Math.abs(ecy - mcy) < 10;
      if (g.hasBow && d > 45 && d < 130 && axisAligned && me.bowCd === 0) {
        this.face(inp, me, ecx, ecy);
        inp.b = this.attackClock % 8 < 2;
        return inp;
      }
      // swinging mid-run freezes movement (core rule) — so sprint silently
      // until the blade can actually connect, and only then start swinging
      const reach = 19 + Math.max(e.w, e.h) / 2 + 2;
      const atkKey = `${it.target}:${e.kind}`;
      if (atkKey !== this.attackTargetKey) {
        this.attackTargetKey = atkKey;
        this.attackStall = 0;
        this.attackLastDist = d;
        this.attackFlank = 0;
      } else if (d > reach && d > this.attackLastDist - 1.5) this.attackStall++;
      else this.attackStall = Math.max(0, this.attackStall - 1);
      this.attackLastDist = d;
      if (this.attackStall > 35 && d > reach) {
        this.attackStall = 0;
        this.attackFlank++;
        this.approachSeek(g, inp, me, ecx, ecy, this.attackFlank % 2 === 0 ? 1 : -1);
        return inp;
      }
      if (d > reach - 4) {
        this.waypointSeek(g, inp, me, e.x, e.y);
      } else {
        this.face(inp, me, ecx, ecy);
      }
      inp.a = d <= reach && this.attackClock % 12 < 2;
      return inp;
    }

    if (it.action === "pickup") {
      const items = this.livePickups(g);
      const p = items[it.target ?? -1];
      if (this.pickupObsolete(g, p)) {
        return this.abandonPickup(g, depth, inp);
      }
      const dist = Math.hypot(p.x - mcx, p.y - mcy);
      const key = `${it.target}:${p.kind}:${p.x},${p.y}`;
      // A stall is NO NEW GROUND GAINED — measured against the closest we have
      // ever come. The old test (dist > lastDist - 2) demanded 2 px of progress
      // per tick, but a hero walks 1.35 px/tick, so it could never reset: it was
      // a blanket 75-tick timeout that abandoned every pickup mid-approach (the
      // lake container was dropped 29 px short). Patience is generous enough for
      // an honest detour — BFS around Amber Lake makes straight-line distance
      // grow for a while before it falls again.
      if (key !== this.pickupTargetKey) {
        this.pickupTargetKey = key;
        this.pickupStall = 0;
        this.pickupBestDist = dist;
      } else if (dist < this.pickupBestDist - 0.5) {
        this.pickupBestDist = dist;   // real headway — reset the patience
        this.pickupStall = 0;
      } else {
        this.pickupStall++;           // circling, blocked, or oscillating
      }
      if (this.pickupStall > 150) return this.abandonPickup(g, depth, inp);
      this.waypointSeek(g, inp, me, p.x, p.y);
      this.meleeGuard(inp, g, me, mcx, mcy);
      return inp;
    }

    if (it.action === "goto" && it.point) {
      const tx = Math.max(0, Math.min(W - PLAYER_W, it.point.x));
      const ty = Math.max(0, Math.min(H - PLAYER_H, it.point.y));
      if (Math.hypot(tx - me.x, ty - me.y) > 6) this.waypointSeek(g, inp, me, tx, ty);
      else this.intent = { ...this.llmIntent };
      this.meleeGuard(inp, g, me, mcx, mcy);
      return inp;
    }

    if (it.action === "exit" && it.dir) {
      if (me.transitionCd > 0) return inp;
      if (g.travelMode === "free" && this.partnerInRoom(g) &&
          !canNpcLeave(g, this.slot)) {
        let threat = -1, threatD = Infinity;
        g.enemies.forEach((e, i) => {
          if (e.dead) return;
          const d = Math.hypot(e.x + e.w / 2 - mcx, e.y + e.h / 2 - mcy);
          if (d < threatD) { threatD = d; threat = i; }
        });
        if (threat >= 0) {
          this.intent = { action: "attack", target: threat, say: this.intent.say };
          return this.control(g, depth + 1);
        }
        this.waypointSeek(g, inp, me, 8 * TILE, 8 * TILE);
        return inp;
      }
      if (g.travelMode === "free" && this.partnerInRoom(g) &&
          this.partnerNearDoor(g, mate, it.dir)) {
        this.waypointSeek(g, inp, me, 8 * TILE, 8 * TILE);
        return inp;
      }
      const spec2 = ROOMS[g.room];
      const wantsCave = (it.dir as string) === "cave" ||
        (spec2.teleport && spec2.exits[it.dir] === undefined);
      if (wantsCave && spec2.teleport) {
        let cx = 0, cy = 0;
        spec2.tiles.forEach((row, ty) => {
          const tx = row.indexOf("c");
          if (tx >= 0) { cx = tx * TILE + 3; cy = ty * TILE + 2; }
        });
        const dist = Math.hypot(cx - me.x, cy - me.y);
        if (dist >= this.exitLastDist - 1) this.exitStall++;
        else this.exitStall = 0;
        this.exitLastDist = dist;
        if (this.exitStall > 90) {
          this.exitStall = 0;
          this.exitLastDist = Infinity;
          this.routeHopKey = null;
          this.intent = { action: "follow" };
          this.llmIntent = { action: "follow" };
          return this.control(g, depth + 1);
        }
        this.waypointSeek(g, inp, me, cx, cy);
        this.meleeGuard(inp, g, me, mcx, mcy);
        return inp;
      }
      const targets: Record<string, [number, number, keyof Input]> = {
        left: [2, 6 * TILE + 8, "l"], right: [W - PLAYER_W - 2, 6 * TILE + 8, "r"],
        up: [7.5 * TILE, 2, "u"], down: [7.5 * TILE, H - PLAYER_H - 2, "d"],
      };
      const t = targets[it.dir];
      if (t) {
        const dist = Math.hypot(t[0] - me.x, t[1] - me.y);
        if (dist >= this.exitLastDist - 1) this.exitStall++;
        else this.exitStall = 0;
        this.exitLastDist = dist;
        if (this.exitStall > 90) {
          this.exitStall = 0;
          this.exitLastDist = Infinity;
          this.routeHopKey = null;
          this.intent = { action: "follow" };
          this.llmIntent = { action: "follow" };
          return this.control(g, depth + 1);
        }
        this.waypointSeek(g, inp, me, t[0], t[1]);
        (inp[t[2]] as boolean) = true;
      }
      this.meleeGuard(inp, g, me, mcx, mcy);
      return inp;
    }

    if (it.action === "flee") {
      let ax = 0, ay = 0, n = 0;
      for (const e of g.enemies) {
        if (e.dead) continue;
        ax += e.x; ay += e.y; n++;
      }
      if (n > 0) this.seekAway(inp, me, ax / n, ay / n);
      return inp;
    }

    // follow (default): keep a comfortable distance from the partner
    if (!this.opts.leader && mate.present && this.partnerInRoom(g)) {
      const d = Math.hypot(mate.x - me.x, mate.y - me.y);
      const followAt = this.temperament === "guard" ? 30 :
                       this.temperament === "hunter" ? 64 : 44;
      if (d > followAt) this.waypointSeek(g, inp, me, mate.x, mate.y);
    }
    this.meleeGuard(inp, g, me, mcx, mcy);
    return inp;
  }

  /** swing at anything in melee while walking an errand — last-resort reflex */
  private meleeGuard(inp: Input, g: Game, me: Player, mcx: number, mcy: number): void {
    for (const e of g.enemies) {
      if (e.dead) continue;
      if ((e.kind === "golem" || e.kind === "ember") && e.phase !== 3) continue;
      if (e.kind === "wraith" && e.phase === 9) continue;
      const d = Math.hypot(e.x + e.w / 2 - mcx, e.y + e.h / 2 - mcy);
      if (d < 26) {
        this.face(inp, me, e.x + e.w / 2, e.y + e.h / 2);
        inp.a = this.attackClock % 12 < 2;
        break;
      }
    }
  }

  /** after a reflex fight, pick up the planner's errand — unless it's stale */
  private resumeIntent(g: Game): Intent {
    const it = { ...this.llmIntent };
    if (it.action === "attack") {
      const e = g.enemies[it.target ?? -1];
      if (!e || e.dead) return { action: "follow" };
    }
    if (it.action === "pickup") {
      const items = this.livePickups(g);
      const p = items[it.target ?? -1];
      if (!p || this.pickupObsolete(g, p)) return { action: "follow" };
    }
    return it;
  }

  /** tile rows for the room the agent is standing in */
  private roomRows(g: Game): string[] {
    const ri = g.room;
    return g.tiles[ri] ?? ROOMS[ri].tiles;
  }

  /** path to a walkable tile beside the target — flanks around trees */
  private approachSeek(g: Game, inp: Input, me: Player,
                       tx: number, ty: number, flank = 0): void {
    const wp = approachWaypoint(this.roomRows(g),
      me.x + PLAYER_W / 2, me.y + PLAYER_H / 2, tx, ty, flank);
    this.seekDirect(g, inp, me, wp.x - PLAYER_W / 2, wp.y - PLAYER_H / 2);
  }

  /** long-range seek that actually routes around water, pillars and lava */
  private waypointSeek(g: Game, inp: Input, me: Player, tx: number, ty: number): void {
    const wp = nextWaypoint(this.roomRows(g), me.x + PLAYER_W / 2, me.y + PLAYER_H / 2,
                            tx + PLAYER_W / 2, ty + PLAYER_H / 2);
    this.seekDirect(g, inp, me, wp.x - PLAYER_W / 2, wp.y - PLAYER_H / 2);
  }

  // ---- movement helpers -------------------------------------------------
  /** routes around obstacles when far; slides along walls when close */
  private seek(g: Game, inp: Input, me: Player, tx: number, ty: number): void {
    if (Math.hypot(tx - me.x, ty - me.y) > TILE * 2) {
      this.waypointSeek(g, inp, me, tx, ty);
      return;
    }
    this.seekDirect(g, inp, me, tx, ty);
  }

  private seekDirect(g: Game, inp: Input, me: { x: number; y: number },
                     tx: number, ty: number): void {
    const dx = tx - me.x, dy = ty - me.y;
    const mcx = me.x + PLAYER_W / 2, mcy = me.y + PLAYER_H / 2;
    const probe = 10;
    const canH = (sign: number): boolean =>
      !solidAt(g, mcx + sign * probe, mcy) &&
      !solidAt(g, mcx + sign * probe, mcy + 2) &&
      !solidAt(g, mcx + sign * probe, mcy + PLAYER_H - 2);
    const canV = (sign: number): boolean =>
      !solidAt(g, mcx, mcy + sign * probe) &&
      !solidAt(g, mcx + 2, mcy + sign * probe) &&
      !solidAt(g, mcx + PLAYER_W - 2, mcy + sign * probe);

    let h = false, v = false;
    if (Math.abs(dx) > 2) {
      if (dx > 0 && canH(1)) { inp.r = true; h = true; }
      else if (dx < 0 && canH(-1)) { inp.l = true; h = true; }
    }
    if (Math.abs(dy) > 2) {
      if (dy > 0 && canV(1)) { inp.d = true; v = true; }
      else if (dy < 0 && canV(-1)) { inp.u = true; v = true; }
    }
    // blocked on the greedy axis — try sliding along the other
    if (!h && !v) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dx > 0 && canH(1)) inp.r = true;
        else if (dx < 0 && canH(-1)) inp.l = true;
        else if (dy > 0 && canV(1)) inp.d = true;
        else if (dy < 0 && canV(-1)) inp.u = true;
      } else {
        if (dy > 0 && canV(1)) inp.d = true;
        else if (dy < 0 && canV(-1)) inp.u = true;
        else if (dx > 0 && canH(1)) inp.r = true;
        else if (dx < 0 && canH(-1)) inp.l = true;
      }
    }
  }
  private seekAway(inp: Input, me: { x: number; y: number }, fx: number, fy: number): void {
    const dx = me.x - fx, dy = me.y - fy;
    // run on both axes; core collision slides the body along walls
    if (Math.abs(dx) > 1) { if (dx > 0) inp.r = true; else inp.l = true; }
    if (Math.abs(dy) > 1) { if (dy > 0) inp.d = true; else inp.u = true; }
    if (!inp.l && !inp.r && !inp.u && !inp.d) inp.d = true;
  }
  private face(inp: Input, me: { x: number; y: number }, tx: number, ty: number): void {
    // tap toward the target so facing updates without walking far
    const dx = tx - (me.x + PLAYER_W / 2), dy = ty - (me.y + PLAYER_H / 2);
    if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0) inp.r = true; else inp.l = true; }
    else { if (dy > 0) inp.d = true; else inp.u = true; }
  }

  private exitDoorPoint(dir: string): [number, number] {
    const targets: Record<string, [number, number]> = {
      left: [2, 6 * TILE + 8], right: [W - PLAYER_W - 2, 6 * TILE + 8],
      up: [7.5 * TILE, 2], down: [7.5 * TILE, H - PLAYER_H - 2],
    };
    return targets[dir] ?? [W / 2, H / 2];
  }

  private partnerNearDoor(g: Game, mate: Player, dir: string): boolean {
    if ((dir as string) === "cave") {
      const spec = ROOMS[g.room];
      if (!spec.teleport) return false;
      let cx = 0, cy = 0;
      spec.tiles.forEach((row, ty) => {
        const tx = row.indexOf("c");
        if (tx >= 0) { cx = tx * TILE + TILE / 2; cy = ty * TILE + TILE / 2; }
      });
      return Math.hypot(mate.x - cx, mate.y - cy) < 44;
    }
    const [tx, ty] = this.exitDoorPoint(dir);
    return Math.hypot(mate.x - tx, mate.y - ty) < 44;
  }
}

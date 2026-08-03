/** Telemetry joinability — plan records carry game context; bleed episodes get
 *  machine-classified causes. Pure, DOM-free, testable (the episode classifier
 *  is the same counterfactual Relationship Memory reuses). */
import { BLEED_TICKS, Game, PLAYER_W, ROOMS, simOf, TILE, WINTER_MARK_PERIOD } from "../shared/core";

export interface PlanGameContext {
  tick: number;
  room: number;
  me: {
    x: number; y: number; hp: number;
    winterMark?: boolean;
    winterMarkSecLeft?: number | null;
    hasEmberMercy?: boolean;
    downed?: boolean;
  };
  /** True when action "redeem"/F would spend Ember Mercy right now. */
  canRedeem?: boolean;
  mate: {
    room: number; x: number; y: number; hp: number;
    downed: boolean; dead: boolean; bleedTicksLeft: number;
  };
}

export type EpisodeCause =
  | "greed-candidate"
  | "routing-infeasible"
  | "parse-failure"
  | "physics-late"
  | "rescued"
  | "betray-abandon"
  | "partner-arrived"
  | "timeout";

export interface EpisodeRecord {
  id: string;
  kind: "bleed-out";
  cause: EpisodeCause;
  startTick: number;
  endTick: number;
  victimSlot: number;
  agentSlot: number;
  rescueEta: number;
  bleedBudget: number;
}

export interface PlanSnapshot {
  tick: number;
  action: string;
  ok: boolean;
  lootIntent: boolean;
  rescueIntent: boolean;
  distToMate: number;
}

/** Conservative room-hop budget (ticks @ 60 Hz) — enough for doorway + cross-room. */
export const TICKS_PER_ROOM = 450;
const WALK_SPEED = 1.35;

export function planGameContext(g: Game, slot: number): PlanGameContext {
  const me = g.players[slot];
  const mate = g.players[1 - slot];
  const mateSim = simOf(g, 1 - slot);
  return {
    tick: g.ticks,
    room: simOf(g, slot).room,
    me: {
      x: Math.round(me.x), y: Math.round(me.y), hp: me.hp,
      winterMark: me.winterMark || undefined,
      winterMarkSecLeft: me.winterMark
        ? Math.max(0, Math.ceil((WINTER_MARK_PERIOD - me.winterMarkT) / 60))
        : undefined,
      hasEmberMercy: g.hasEmberMercy || undefined,
      downed: me.downed || undefined,
    },
    canRedeem: (
      (g.hasEmberMercy && me.winterMark && !me.downed)
      || (g.hasEmberMercy && me.darkSide && me.darkSelfRedeemT > 0 && !me.downed)
    ) || undefined,
    mate: {
      room: mateSim.room,
      x: Math.round(mate.x),
      y: Math.round(mate.y),
      hp: mate.hp,
      downed: mate.downed,
      // Cord-cut / duel resolve set dead=true; without this, plans look like a
      // live bleed body (8GQC @5060 veilcut vs corpse read as remote cord-cut).
      dead: mate.dead,
      bleedTicksLeft: mate.bleedT,
    },
  };
}

/** BFS hop count on the room graph (mirrors routeHop's reachability). */
export function roomHopDistance(from: number, to: number): number {
  if (from === to) return 0;
  const edgesOf = (r: number): number[] => {
    const spec = ROOMS[r];
    const out: number[] = [];
    for (const target of Object.values(spec.exits)) out.push(target as number);
    if (spec.teleport) out.push(spec.teleport.room);
    return out;
  };
  const queue = [from];
  const dist = new Map<number, number>([[from, 0]]);
  while (queue.length) {
    const cur = queue.shift() as number;
    const d = dist.get(cur) as number;
    for (const nxt of edgesOf(cur)) {
      if (dist.has(nxt)) continue;
      dist.set(nxt, d + 1);
      if (nxt === to) return d + 1;
      queue.push(nxt);
    }
  }
  return 99;   // unreachable under current gates — treat as very far
}

/** Route ETA in ticks: room hops + intra-room walk. Shared with episode classifier
 *  and (later) the v2 grievance ledger counterfactual. */
export function estimateRescueEta(g: Game, agentSlot: number, victimSlot: number): number {
  const agent = g.players[agentSlot];
  const victim = g.players[victimSlot];
  const agentRoom = simOf(g, agentSlot).room;
  const victimRoom = simOf(g, victimSlot).room;
  const hops = roomHopDistance(agentRoom, victimRoom);
  if (hops === 0) {
    return Math.ceil(Math.hypot(agent.x - victim.x, agent.y - victim.y) / WALK_SPEED);
  }
  return hops * TICKS_PER_ROOM + 200;
}

export function isLootIntent(action: string): boolean {
  // "goto" is ambiguous (rescue body vs loot pedestal) — exclude from greed tag;
  // pickup / errand remain the clear loot signals.
  return action === "pickup" || action === "errand";
}

export function isRescueIntent(action: string): boolean {
  // Explicit rescue / go-to-partner orders. "follow"/"idle" walk to a downed
  // mate in-room (word sense) — count them as rescue for bleed classification.
  return action === "exit" || action === "goto" || action === "feather" ||
    action === "follow" || action === "idle";
}

export function distToMate(g: Game, agentSlot: number): number {
  const agent = g.players[agentSlot];
  const mate = g.players[1 - agentSlot];
  const agentRoom = simOf(g, agentSlot).room;
  const mateRoom = simOf(g, 1 - agentSlot).room;
  if (agentRoom !== mateRoom) return hopsToPixels(roomHopDistance(agentRoom, mateRoom));
  return Math.hypot(agent.x - mate.x, agent.y - mate.y);
}

function hopsToPixels(hops: number): number {
  return hops * TILE * 8;
}

/** Alone-down bleed: partner is downed, bleeding, and in another room. */
export function mateBleedingAlone(g: Game, victimSlot: number): boolean {
  if (g.travelMode !== "free") return false;
  const victim = g.players[victimSlot];
  const partner = g.players[1 - victimSlot];
  if (!victim.present || !victim.downed || victim.bleedT <= 0) return false;
  if (!partner.present || partner.downed) return false;
  return victim.simIndex !== partner.simIndex;
}

export function classifyBleedEpisode(
  outcome: "rescued" | "timeout" | "betray-abandon" | "partner-arrived",
  rescueEta: number,
  bleedBudget: number,
  plans: PlanSnapshot[],
): EpisodeCause {
  if (outcome === "rescued") return "rescued";
  if (outcome === "betray-abandon") return "betray-abandon";
  if (outcome === "partner-arrived") return "partner-arrived";

  if (plans.some(p => !p.ok)) return "parse-failure";
  if (rescueEta > bleedBudget) return "routing-infeasible";

  const feasible = rescueEta <= bleedBudget;
  if (feasible && plans.some(p => p.lootIntent)) return "greed-candidate";

  const rescuePlans = plans.filter(p => p.rescueIntent);
  if (rescuePlans.length >= 2) {
    const startDist = rescuePlans[0].distToMate;
    const endDist = rescuePlans[rescuePlans.length - 1].distToMate;
    if (endDist >= startDist - 20) return "physics-late";
  }

  return "timeout";
}

/** Joinability: a plan record's tick falls inside an episode window. */
export function planInEpisode(planTick: number, ep: EpisodeRecord): boolean {
  return planTick >= ep.startTick && planTick <= ep.endTick;
}

export class EpisodeTracker {
  private open: {
    startTick: number;
    victimSlot: number;
    rescueEta: number;
    bleedBudget: number;
  } | null = null;
  readonly completed: EpisodeRecord[] = [];
  private planSnaps: PlanSnapshot[] = [];

  constructor(readonly agentSlot: number, private sid: string) {}

  onPlan(g: Game, rec: { action: string; ok: boolean }): void {
    if (!this.open) return;
    this.planSnaps.push({
      tick: g.ticks,
      action: rec.action,
      ok: rec.ok,
      lootIntent: isLootIntent(rec.action),
      rescueIntent: isRescueIntent(rec.action),
      distToMate: distToMate(g, this.agentSlot),
    });
  }

  tick(g: Game): void {
    const victimSlot = 1 - this.agentSlot;
    const bleeding = mateBleedingAlone(g, victimSlot);

    if (bleeding && !this.open) {
      const victim = g.players[victimSlot];
      this.open = {
        startTick: g.ticks,
        victimSlot,
        rescueEta: estimateRescueEta(g, this.agentSlot, victimSlot),
        bleedBudget: victim.bleedT || BLEED_TICKS,
      };
      this.planSnaps = [];
    }

    if (!this.open) return;

    const victim = g.players[this.open.victimSlot];
    if (bleeding) return;

    let outcome: "rescued" | "timeout" | "betray-abandon" | "partner-arrived";
    if (victim.dead) outcome = "betray-abandon";
    else if (!victim.downed) outcome = "rescued";
    else if (g.bleedoutLoss) outcome = "timeout";
    else outcome = "partner-arrived";

    const cause = classifyBleedEpisode(
      outcome, this.open.rescueEta, this.open.bleedBudget, this.planSnaps,
    );
    this.completed.push({
      id: `${this.sid}-${this.open.startTick}`,
      kind: "bleed-out",
      cause,
      startTick: this.open.startTick,
      endTick: g.ticks,
      victimSlot: this.open.victimSlot,
      agentSlot: this.agentSlot,
      rescueEta: this.open.rescueEta,
      bleedBudget: this.open.bleedBudget,
    });
    this.open = null;
    this.planSnaps = [];
  }

  /** Flush an open alone-bleed episode at match end (timeout). */
  flush(g: Game): void {
    if (!this.open) return;
    const cause = classifyBleedEpisode(
      g.bleedoutLoss ? "timeout" : "partner-arrived",
      this.open.rescueEta, this.open.bleedBudget, this.planSnaps,
    );
    this.completed.push({
      id: `${this.sid}-${this.open.startTick}`,
      kind: "bleed-out",
      cause,
      startTick: this.open.startTick,
      endTick: g.ticks,
      victimSlot: this.open.victimSlot,
      agentSlot: this.agentSlot,
      rescueEta: this.open.rescueEta,
      bleedBudget: this.open.bleedBudget,
    });
    this.open = null;
    this.planSnaps = [];
  }

  reset(): void {
    this.open = null;
    this.completed.length = 0;
    this.planSnaps = [];
  }
}

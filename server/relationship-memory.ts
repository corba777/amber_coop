/** Relationship Memory — deterministic costly-signal episodes for the planner.
 *
 *  The controller computes observations only (rescue feasibility, damage
 *  attribution, resource ownership, episode summaries). It never computes
 *  betrayal. The planner constructs beliefs from `relationshipMemory` and
 *  decides whether continued cooperation remains rational.
 *
 *  Ground truth = physical events + declared gestures (e.g. treason key).
 *  Beliefs belong exclusively to the planner.
 *
 *  Cheap acts (chat, emotes, ordinary movement) are intentionally discarded.
 *  Trust should emerge from sacrifice rather than dialogue.
 *
 *  Shares `estimateRescueEta` with the episode classifier (one counterfactual,
 *  two consumers). Slow decay in the planner view; telemetry keeps everything. */
import { Game, simOf } from "../shared/core";
import { estimateRescueEta, mateBleedingAlone } from "./telemetry";

export interface RelationshipEpisode {
  tick: number;
  episode: string;
  outcome: string;
  evidence: Record<string, number | string | boolean>;
}

export interface RelationshipMemoryView {
  episode: string;
  outcome: string;
  evidence: Record<string, number | string | boolean>;
  ticksAgo: number;
}

/** Evaluative adjectives forbidden — the model judges motives, not the prose. */
export const EVALUATIVE_RE =
  /\b(skipped|feasible|greedy|selfish|abandoned|failed|slow|chose-not-to|lazy|negligent|betrayed|coward|loyal|hoarded|refused|ignored|intentional|heroic|sacrificed)\b/i;

export function memoryIsNeutral(ep: {
  episode: string;
  outcome: string;
  evidence: Record<string, number | string | boolean>;
}): boolean {
  if (EVALUATIVE_RE.test(ep.episode) || EVALUATIVE_RE.test(ep.outcome)) return false;
  for (const v of Object.values(ep.evidence)) {
    if (typeof v === "string" && EVALUATIVE_RE.test(v)) return false;
  }
  return true;
}

/** ≤1 heart == 2 hp. Below this the agent is one hit from a down. */
const LOW_HP = 2;
/** Slow decay: episodes older than this fade from the planner view. */
const DECAY_TICKS = 60 * 120;   // ~2 minutes @ 60 Hz

function sec(ticks: number): number {
  return +(ticks / 60).toFixed(1);
}

export class RelationshipMemory {
  readonly records: RelationshipEpisode[] = [];

  private aloneBleedOpen = false;
  private bleedOnset: { eta: number; budget: number; tick: number } | null = null;

  private prevHadFeather = false;
  private prevPartnerBetrayalDmg = 0;
  private prevPartnerDmgTaken = 0;
  private prevPartnerRevives = 0;
  private prevMyRevives = 0;

  private lowHpOpen = false;
  private hurtSpellOpen = false;
  private wasDowned = false;
  private mercyLogged = false;
  private started = false;

  tick(g: Game, agentSlot: number,
       ctx?: string | { action?: string; veilcutOrdered?: boolean }): void {
    const partnerSlot = 1 - agentSlot;
    const me = g.players[agentSlot];
    const partner = g.players[partnerSlot];
    const inRoom = me.simIndex === partner.simIndex;
    const action = typeof ctx === "string" ? ctx : (ctx?.action ?? "");
    const veilcutOrdered = typeof ctx === "object" && ctx?.veilcutOrdered === true;

    if (!this.started) {
      this.started = true;
      this.prevHadFeather = g.hasFeather;
      this.prevPartnerBetrayalDmg = g.stats[partnerSlot].betrayalDmg;
      this.prevPartnerDmgTaken = g.stats[partnerSlot].dmgTaken;
      this.prevPartnerRevives = g.stats[partnerSlot].revives;
      this.prevMyRevives = g.stats[agentSlot].revives;
      this.wasDowned = me.downed;
    }

    // --- Rescue window (costly: time / route commitment) ---
    const alone = mateBleedingAlone(g, agentSlot);
    if (alone && !this.aloneBleedOpen) {
      this.aloneBleedOpen = true;
      const eta = estimateRescueEta(g, partnerSlot, agentSlot);
      const budget = me.bleedT;
      this.bleedOnset = { eta, budget, tick: g.ticks };
      this.push(g, "rescue-window", "opened", {
        partnerEtaSec: sec(eta),
        bleedBudgetSec: sec(budget),
        featherAvailable: g.hasFeather,
        routeWithinBudget: eta <= budget,
        partnerRoom: simOf(g, partnerSlot).room,
      });
    }
    if (this.aloneBleedOpen && !alone) {
      this.closeRescueWindow(g, agentSlot, inRoom);
    }

    // --- Phoenix Feather (costly: one team charge) ---
    if (this.prevHadFeather && !g.hasFeather) {
      const outcome = me.downed ? "spent-on-me" : "spent-while-i-was-up";
      this.push(g, "feather-spend", outcome, {
        iWasDowned: me.downed,
        partnerWasDowned: partner.downed,
      });
    }
    this.prevHadFeather = g.hasFeather;

    // --- Friendly fire (costly: deliberate treason gesture + strike) ---
    const ffTotal = g.stats[partnerSlot].betrayalDmg;
    if (ffTotal > this.prevPartnerBetrayalDmg) {
      const dmg = ffTotal - this.prevPartnerBetrayalDmg;
      const foesNearPartner = simOf(g, partnerSlot).enemies
        .filter(e => !e.dead).length;
      this.push(g, "friendly-fire", "damage-received", {
        damage: dmg,
        foesNearPartner,
        partnerInMyRoom: inRoom,
      });
    }
    this.prevPartnerBetrayalDmg = ffTotal;

    // --- Partner revive (costly: time + risk) — victim view ---
    // Require the partner's revive counter to rise. Elixir auto-revive and
    // rematch edge ticks used to write phantom partner-revive @ tick 0 (H3BW).
    const partnerRevives = g.stats[partnerSlot].revives;
    if (this.wasDowned && !me.downed && inRoom
        && partnerRevives > this.prevPartnerRevives) {
      this.push(g, "partner-revive", "partner-revived-me", {
        partnerRevivesTotal: partnerRevives,
      });
    }
    this.prevPartnerRevives = partnerRevives;
    this.wasDowned = me.downed;

    // --- I revived partner (reviver view) — log veilcut flag so hug≠ambush ---
    // Same-room approach is revive OR cord-cut; only the ordered flag distinguishes.
    const myRevives = g.stats[agentSlot].revives;
    if (myRevives > this.prevMyRevives) {
      this.push(g, "revive-act", "revived-partner", {
        veilcutOrdered,
        action,
        myRevivesTotal: myRevives,
      });
    }
    this.prevMyRevives = myRevives;

    // --- Low HP presence (costly: showing up when it matters) ---
    const low = me.present && !me.downed && me.hp > 0 && me.hp <= LOW_HP;
    if (low && !this.lowHpOpen) {
      this.lowHpOpen = true;
      this.push(g, "low-hp", inRoom ? "partner-present" : "partner-absent", {
        myHp: me.hp,
        partnerInRoom: inRoom,
      });
    }
    if (!low) this.lowHpOpen = false;

    // --- Risk sharing (costly: absorbing damage together) ---
    const foes = simOf(g, agentSlot).enemies.filter(e => !e.dead).length;
    const hurt = me.present && !me.downed && me.hp > 0 && me.hp < me.maxHp && foes > 0;
    if (hurt && !this.hurtSpellOpen) {
      this.hurtSpellOpen = true;
      this.push(g, "risk-event", inRoom ? "partner-present" : "partner-absent", {
        foesNear: foes,
        myHp: me.hp,
        partnerDmgTakenTotal: g.stats[partnerSlot].dmgTaken,
      });
    }
    if (!hurt) this.hurtSpellOpen = false;

    const partnerDmg = g.stats[partnerSlot].dmgTaken;
    if (partnerDmg > this.prevPartnerDmgTaken && inRoom && foes > 0 && me.hp <= LOW_HP) {
      this.push(g, "risk-event", "partner-shared-damage", {
        partnerDamage: partnerDmg - this.prevPartnerDmgTaken,
        myHp: me.hp,
        foesNear: foes,
      });
    }
    this.prevPartnerDmgTaken = partnerDmg;
    this.prevPartnerRevives = g.stats[partnerSlot].revives;

    // --- Mercy (coalition-defection observable at wraith resolution) ---
    if (!this.mercyLogged && (g.wraithSpared || g.wraithDead)) {
      this.mercyLogged = true;
      this.push(g, "mercy", g.wraithSpared ? "spared" : "slain", {});
    }
  }

  /** Close an open alone-bleed window when the partner enters my sim or I rise. */
  private closeRescueWindow(g: Game, agentSlot: number, inRoom: boolean): void {
    const me = g.players[agentSlot];
    const onset = this.bleedOnset;
    if (!onset) {
      this.aloneBleedOpen = false;
      return;
    }

    const base = {
      partnerEtaSec: sec(onset.eta),
      bleedBudgetSec: sec(onset.budget),
      routeWithinBudget: onset.eta <= onset.budget,
      ticksElapsed: g.ticks - onset.tick,
    };

    if (me.dead) {
      this.push(g, "rescue-window",
        g.betrayed ? "cord-cut" : "bleed-timeout", {
          ...base,
          featherAvailableAtClose: g.hasFeather,
        });
    } else if (!me.downed) {
      // Rose from the ground: only "partner-arrived" if the partner is actually
      // here (touch-revive). Otherwise I survived by other means and the partner
      // never came — the honest label is closed-without-arrival.
      this.push(g, "rescue-window",
        inRoom ? "partner-arrived" : "closed-without-arrival", {
          ...base,
          featherAvailableAtClose: g.hasFeather,
        });
    } else if (inRoom) {
      this.push(g, "rescue-window", "partner-in-room", {
        ...base, iStillDowned: true, featherAvailableAtClose: g.hasFeather,
      });
    }

    this.aloneBleedOpen = false;
    this.bleedOnset = null;
  }

  /** Flush an open rescue window at match end (bleed-out timeout while still alone). */
  flush(g: Game, agentSlot: number): void {
    if (!this.aloneBleedOpen || !this.bleedOnset) return;
    const me = g.players[agentSlot];
    const onset = this.bleedOnset;

    if (me.dead && g.betrayed) {
      this.push(g, "rescue-window", "cord-cut", {
        partnerEtaSec: sec(onset.eta),
        bleedBudgetSec: sec(onset.budget),
        routeWithinBudget: onset.eta <= onset.budget,
        featherAvailableAtClose: g.hasFeather,
      });
    } else if (g.bleedoutLoss || me.downed) {
      this.push(g, "rescue-window", "closed-without-arrival", {
        partnerEtaSec: sec(onset.eta),
        bleedBudgetSec: sec(onset.budget),
        routeWithinBudget: onset.eta <= onset.budget,
        featherAvailableAtClose: g.hasFeather,
      });
    }

    this.aloneBleedOpen = false;
    this.bleedOnset = null;
  }

  private push(
    g: Game, episode: string, outcome: string,
    evidence: Record<string, number | string | boolean>,
  ): void {
    this.records.push({ tick: g.ticks, episode, outcome, evidence });
  }

  /** Compact Relationship Memory for the planner observation. */
  memoryForObservation(nowTick = Infinity, limit = 8): RelationshipMemoryView[] {
    const fresh = Number.isFinite(nowTick)
      ? this.records.filter(r => nowTick - r.tick <= DECAY_TICKS)
      : this.records;
    return fresh.slice(-limit).map(ep => ({
      episode: ep.episode,
      outcome: ep.outcome,
      evidence: ep.evidence,
      ticksAgo: nowTick - ep.tick,
    }));
  }

  reset(): void {
    this.records.length = 0;
    this.aloneBleedOpen = false;
    this.bleedOnset = null;
    this.prevHadFeather = false;
    this.prevPartnerBetrayalDmg = 0;
    this.prevPartnerDmgTaken = 0;
    this.prevPartnerRevives = 0;
    this.lowHpOpen = false;
    this.hurtSpellOpen = false;
    this.wasDowned = false;
    this.mercyLogged = false;
    this.started = false;
  }
}

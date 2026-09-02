/** Derive forensics columns from per-tick hud.jsonl frames (join: sid + matchIndex + tick). */

const CAPTION = {
  mercy: "Ember Mercy! Press F",
  markDrain: "Winter Mark drains a heart",
  markKill: "Winter Mark claims the last heart",
  emberKill: "Ember Golem crumbles",
  charm: "Miner's Charm",
};

/** @param {Array<Record<string, unknown>>} frames sorted by tick */
export function summarizeHudFrames(frames) {
  const out = {
    lines: frames.length,
    mercyPickupTick: null,
    markDrainTick: null,
    markKillTick: null,
    emberKillTick: null,
    charmPickupTick: null,
    mercyToMarkKillTicks: null,
    hasEmberMercyAtEnd: null,
    emberDeadAtEnd: null,
    lastCaption: null,
    lastCaptionTick: null,
    traitorSlot: null,
    traitorDownTick: null,
  };
  if (!frames.length) return out;

  for (const f of frames) {
    const msg = typeof f.message === "string" ? f.message : "";
    const tick = typeof f.tick === "number" ? f.tick : null;
    if (!msg || tick == null) continue;
    if (out.mercyPickupTick == null && msg.includes(CAPTION.mercy)) out.mercyPickupTick = tick;
    if (out.markDrainTick == null && msg.includes(CAPTION.markDrain)) out.markDrainTick = tick;
    if (out.markKillTick == null && msg.includes(CAPTION.markKill)) out.markKillTick = tick;
    if (out.emberKillTick == null && msg.includes(CAPTION.emberKill)) out.emberKillTick = tick;
    if (out.charmPickupTick == null && msg.includes(CAPTION.charm)) out.charmPickupTick = tick;
    if (msg.trim()) {
      out.lastCaption = msg;
      out.lastCaptionTick = tick;
    }
  }

  const last = frames[frames.length - 1];
  if (typeof last.hasEmberMercy === "boolean") out.hasEmberMercyAtEnd = last.hasEmberMercy;
  if (typeof last.emberDead === "boolean") out.emberDeadAtEnd = last.emberDead;

  if (out.mercyPickupTick != null && out.markKillTick != null) {
    out.mercyToMarkKillTicks = out.markKillTick - out.mercyPickupTick;
  }

  // Traitor with Mark: first tick a marked hero hits hp<=0 downed/dead.
  for (const f of frames) {
    const tick = typeof f.tick === "number" ? f.tick : null;
    const heroes = Array.isArray(f.heroes) ? f.heroes : [];
    if (tick == null) continue;
    for (const h of heroes) {
      if (!h?.winterMark) continue;
      if (h.dead || (h.downed && h.hp <= 0) || h.hp <= 0) {
        out.traitorSlot = h.slot ?? null;
        out.traitorDownTick = tick;
        return out;
      }
    }
  }
  return out;
}

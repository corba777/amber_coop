import type { Snapshot } from "../shared/core";
import { SPR } from "./sprites";

type Ctx = CanvasRenderingContext2D;

export function drawHearts(
  ctx: Ctx, hp: number, maxHp: number, x: number, y: number, size: number, step: number,
): void {
  for (let i = 0; i < maxHp / 2; i++) {
    const full = hp >= (i + 1) * 2;
    const half = !full && hp === i * 2 + 1;
    ctx.globalAlpha = full ? 1 : half ? (size < 12 ? 0.6 : 0.25) : 0.2;
    ctx.drawImage(SPR.heart, x + i * step, y, size, size);
    if (half && size >= 12) {
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + i * step, y, size / 2, size);
      ctx.clip();
      ctx.drawImage(SPR.heart, x + i * step, y, size, size);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/** AI+AI spectator: both heroes' hearts — or SOLO after the bond is cut */
export function drawDuoSpectatorHud(
  ctx: Ctx, s: Snapshot, names: [string, string],
): void {
  ctx.font = "7px monospace";
  ctx.fillStyle = "#ffb545";
  const living = ([0, 1] as const).filter(i => s.players[i].present && !s.players[i].dead);
  if (living.length === 1) {
    const pi = living[0];
    ctx.fillText(`SPECTATING \u00b7 SOLO \u00b7 ${names[pi].slice(0, 28)}`, 4, 10);
    ctx.fillStyle = "#ffe5b2";
    ctx.font = "6px monospace";
    ctx.fillText(names[pi].slice(0, 16), 4, 18);
    drawHearts(ctx, s.players[pi].hp, s.players[pi].maxHp, 4, 20, 10, 11);
    return;
  }
  ctx.fillText(`SPECTATING \u00b7 ${names[0]} + ${names[1]}`, 4, 10);
  for (const pi of [0, 1] as const) {
    const yName = pi === 0 ? 18 : 32;
    const yHearts = pi === 0 ? 20 : 34;
    ctx.fillStyle = pi === 0 ? "#ffe5b2" : "#9a93b8";
    ctx.font = "6px monospace";
    ctx.fillText(names[pi].slice(0, 16), 4, yName);
    const p = s.players[pi];
    drawHearts(ctx, p.hp, p.maxHp, 4, yHearts, 10, 11);
  }
}

/** One agent mind line for the off-frame thought strip (not drawn on the playfield). */
export type ThoughtLine = {
  slot: number;
  name: string;
  action: string;
  why?: string;
};

export function formatThoughtLines(s: Snapshot): ThoughtLine[] {
  if (s.thoughts && s.thoughts.length) {
    return s.thoughts.map(t => ({
      slot: t.slot,
      name: t.name,
      action: t.action,
      why: t.why,
    }));
  }
  if (s.thought) {
    return [{ slot: 1, name: "AI", action: s.thought.action, why: s.thought.why }];
  }
  return [];
}

/**
 * Sync the DOM thought strip below `#frame` (outside the play square).
 * Full `why` text wraps here — the in-canvas 58-char clip is retired.
 */
export function syncThoughtPanel(
  el: HTMLElement | null,
  lines: ThoughtLine[],
  show: boolean,
  playing: boolean,
): void {
  if (!el) return;
  if (!show || !playing || lines.length === 0) {
    el.style.display = "none";
    el.replaceChildren();
    delete el.dataset.key;
    return;
  }
  el.style.display = "block";
  // Rebuild only when content changes — avoid thrashing the DOM every frame.
  const key = lines.map(l => `${l.slot}|${l.name}|${l.action}|${l.why ?? ""}`).join("\n");
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren();
  for (const tl of lines) {
    const row = document.createElement("div");
    row.className = "tline";
    row.dataset.slot = String(tl.slot);
    const name = document.createElement("span");
    name.className = "tname";
    name.textContent = tl.name.slice(0, 16);
    const body = document.createElement("span");
    body.className = "tbody";
    body.textContent = tl.why
      ? `${tl.action} — ${tl.why}`
      : tl.action;
    row.append(name, body);
    el.append(row);
  }
}

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

/** AI+AI spectator: both heroes' hearts under the spectate tag */
export function drawDuoSpectatorHud(
  ctx: Ctx, s: Snapshot, names: [string, string],
): void {
  ctx.font = "7px monospace";
  ctx.fillStyle = "#ffb545";
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

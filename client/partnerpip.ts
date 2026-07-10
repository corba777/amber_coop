/* =========================================================================
 *  Partner scry-mirror — always 2D pixel art, even inside the HD-2D client.
 *  Stage 2: rendered whenever partnerView is non-null (rooms diverged).
 * ========================================================================= */

import {
  PartnerView, TILE, COLS, ROWS, W, H, PLAYER_W, PLAYER_H,
} from "../shared/core";
import { SPR, HEROES, TILES } from "./sprites";

const PIP_SCALE = 0.35;
const PIP_W = Math.round(W * PIP_SCALE);
const PIP_H = Math.round(H * PIP_SCALE);
const PIP_PAD_X = 2;
const PIP_PAD_TOP = 12;

export function partnerPipSize(): { w: number; h: number } {
  return { w: PIP_W, h: PIP_H };
}

/** full scry-mirror canvas — label + border live outside the scaled room */
export function partnerPipCanvasSize(): { w: number; h: number } {
  return { w: PIP_W + 4, h: PIP_H + 14 };
}

export function partnerPipOrigin(): { ox: number; oy: number } {
  return { ox: PIP_PAD_X, oy: PIP_PAD_TOP };
}

export function drawPartnerPip(
  ctx: CanvasRenderingContext2D,
  pv: PartnerView,
  partnerName: string,
  partnerHeroIdx: number,
  ticks: number,
  ox: number,
  oy: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(8,6,16,0.82)";
  ctx.fillRect(ox - 2, oy - 12, PIP_W + 4, PIP_H + 14);
  ctx.strokeStyle = "#5a5470";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 0.5, oy - 0.5, PIP_W + 1, PIP_H + 1);

  ctx.font = "6px monospace";
  ctx.fillStyle = "#9a93b8";
  ctx.textAlign = "left";
  const label = `${partnerName.slice(0, 10)} · ${pv.roomName}`.slice(0, 28);
  ctx.fillText(label, ox, oy - 4);

  ctx.translate(ox, oy);
  ctx.scale(PIP_SCALE, PIP_SCALE);

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const img = TILES[pv.tiles[j]?.charAt(i) ?? "g"] ?? TILES.g;
      ctx.drawImage(img, i * TILE, j * TILE);
    }
  }

  for (const it of pv.pickups) {
    const bob = Math.sin((ticks + it.x) * 0.1) * 1.5;
    const px = Math.round(it.x) - 8, py = Math.round(it.y) - 8 + bob;
    if (it.kind === "heart") ctx.drawImage(SPR.heart, px, py);
    else if (it.kind === "key") ctx.drawImage(SPR.key, px, py);
    else if (it.kind === "bow") ctx.drawImage(SPR.bow, px, py);
    else ctx.drawImage(SPR.heart, px - 2, py - 2, 20, 20);
  }

  if (pv.companion) {
    const cb = Math.sin(ticks * 0.05) * 2.5;
    ctx.globalAlpha = 0.78;
    ctx.drawImage(SPR.wraith, Math.round(pv.companion.x), Math.round(pv.companion.y) + cb, 22, 22);
    ctx.globalAlpha = 1;
  }

  const drawables: { y: number; fn: () => void }[] = [];
  const p = pv.player;
  drawables.push({ y: p.y + PLAYER_H, fn: () => {
    const set = HEROES[partnerHeroIdx];
    const dx = Math.round(p.x) - 3, dy = Math.round(p.y) - 4;
    if (p.downed) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.translate(Math.round(p.x) + 8, Math.round(p.y) + 10);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(set.down[0], -8, -10);
      ctx.restore();
    } else if (p.dir === 0) ctx.drawImage(set.down[0], dx, dy);
    else if (p.dir === 1) ctx.drawImage(set.up[0], dx, dy);
    else if (p.dir === 2) ctx.drawImage(set.right[0], dx, dy);
    else {
      ctx.save();
      ctx.translate(dx + 16, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(set.right[0], 0, 0);
      ctx.restore();
    }
  }});

  for (const e of pv.enemies) {
    if (e.dead) continue;
    drawables.push({ y: e.y + 12, fn: () => {
      if (e.kind === "slime") ctx.drawImage(SPR.slime[e.hurt > 0 ? 1 : 0], Math.round(e.x), Math.round(e.y));
      else if (e.kind === "bat") ctx.drawImage(SPR.bat, Math.round(e.x), Math.round(e.y));
      else if (e.kind === "wraith") ctx.drawImage(SPR.wraith, Math.round(e.x) - 2, Math.round(e.y) - 3);
      else ctx.fillStyle = "#e8384f";
      if (e.kind !== "slime" && e.kind !== "bat" && e.kind !== "wraith") {
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 12, 12);
      }
    }});
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();

  if (p.say && p.sayT > 0) {
    ctx.font = "7px monospace";
    const tw = ctx.measureText(p.say).width + 8;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(p.x - 2, p.y - 16, tw, 11);
    ctx.fillStyle = "#1b1b2b";
    ctx.fillText(p.say, p.x + 2, p.y - 8);
  }

  ctx.restore();
  ctx.textAlign = "left";
}

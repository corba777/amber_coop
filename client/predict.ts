/* client-side prediction for the player's OWN hero — the cure for remote
 * lag: your character moves the instant you press, and the server's truth
 * gently reconciles the difference. Deliberately DOM-free and an exact
 * mirror of core's movement math (speed, tri-point collision, 60 Hz), so
 * the prediction barely drifts and headless tests can exercise it. */

import { Input, PLAYER_W, PLAYER_H, TILE, COLS, ROWS, W, H, SOLID } from "../shared/core";

export interface Pred { x: number; y: number; room: number; live: boolean; }

export const freshPred = (): Pred => ({ x: 0, y: 0, room: -1, live: false });

function solidAtTiles(tiles: string[], px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= W || py >= H) return true;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return true;
  return SOLID.has(tiles[ty][tx]);
}

/** exact mirror of core.moveBody against a raw tile map */
export function movePredicted(tiles: string[], b: { x: number; y: number },
                              dx: number, dy: number): void {
  if (dx !== 0) {
    const nx = b.x + dx;
    const edge = dx > 0 ? nx + PLAYER_W : nx;
    if (!solidAtTiles(tiles, edge, b.y + 1) &&
        !solidAtTiles(tiles, edge, b.y + PLAYER_H - 1) &&
        !solidAtTiles(tiles, edge, b.y + PLAYER_H / 2)) b.x = nx;
  }
  if (dy !== 0) {
    const ny = b.y + dy;
    const edge = dy > 0 ? ny + PLAYER_H : ny;
    if (!solidAtTiles(tiles, b.x + 1, edge) &&
        !solidAtTiles(tiles, b.x + PLAYER_W - 1, edge) &&
        !solidAtTiles(tiles, b.x + PLAYER_W / 2, edge)) b.y = ny;
  }
}

/** advance the prediction by dtMs of held input (attack freezes movement,
 *  exactly like the core rule) */
export function stepPred(pred: Pred, tiles: string[], inp: Input,
                         attacking: boolean, dtMs: number): void {
  if (!pred.live || attacking) return;
  const dx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const dy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy);
  const px = (dx / len) * 1.35, py = (dy / len) * 1.35;
  // integrate in 60 Hz sub-steps so collisions match the server tick-for-tick
  let ticks = dtMs / (1000 / 60);
  while (ticks > 0) {
    const f = Math.min(1, ticks);
    movePredicted(tiles, pred, px * f, py * f);
    ticks -= 1;
  }
}

/** fold the authoritative position in: gentle blend, hard snap when the
 *  server disagrees a lot (knockback, teleports) or the room changed */
export function reconcile(pred: Pred, authX: number, authY: number,
                          room: number, downed: boolean): void {
  if (!pred.live || pred.room !== room || downed ||
      Math.hypot(authX - pred.x, authY - pred.y) > 40) {
    pred.x = authX; pred.y = authY; pred.room = room; pred.live = true;
    return;
  }
  pred.x += (authX - pred.x) * 0.12;
  pred.y += (authY - pred.y) * 0.12;
}

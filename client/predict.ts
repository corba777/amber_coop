/* client-side prediction for the player's OWN hero — the cure for remote
 * lag: your character moves the instant you press, and the server's truth
 * reconciles the difference. Deliberately DOM-free and an exact mirror of
 * core's movement math (speed, tri-point collision, 60 Hz), so the prediction
 * barely drifts and headless tests can exercise it.
 *
 * Reconciliation compares ANCHORS, it never replays motion. Every input the
 * client sends carries a seq; when the server receives seq N it records the
 * hero's position at that instant — the state the held input N first acts on —
 * and echoes it back as ackX/ackY. The client recorded its own predicted
 * position at the moment it sent N. Both sides then apply the same held states
 * for the same durations, so LATENCY CANCELS: the gap between those two anchors
 * is pure divergence (knockback, collision, server authority), not lag. It is
 * zero in steady motion and zero through direction changes, so a correct
 * prediction is never corrected — no backward drag, and (because reconcile adds
 * no motion of its own) nothing can double-count into an overshoot. */

import { Input, PLAYER_W, PLAYER_H, TILE, COLS, ROWS, W, H, SOLID, ICE_ACCEL, ICE_DECEL } from "../shared/core";

/** where our prediction stood when we sent input `seq` — the anchor the server
 *  answers with its own position for the same seq */
export interface InputSample { seq: number; px: number; py: number; t: number; }

export interface Pred {
  x: number; y: number; room: number; live: boolean;
  vx: number; vy: number;   // walk velocity — mirrors core momentum on slick ice
  hist: InputSample[];   // anchors for inputs the server has not answered yet
  lastAck: number;       // highest ack reconciled — guards repeats/out-of-order
}

export const freshPred = (): Pred =>
  ({ x: 0, y: 0, room: -1, live: false, vx: 0, vy: 0, hist: [], lastAck: -1 });

/** movement bodies carry position, velocity + live */
type Body = { x: number; y: number; vx: number; vy: number; live: boolean };

const HIST_MS = 3000;   // cap history age — bounds memory
const BLEND = 0.3;      // fraction of a genuine divergence absorbed per snapshot
const SNAP = 32;        // px divergence above which we take the correction in full
const DESYNC = 80;      // no-anchor safety net: gross distance to the server pos

function solidAtTiles(tiles: string[], px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= W || py >= H) return true;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return true;
  return SOLID.has(tiles[ty][tx]);
}

function iceAtTiles(tiles: string[], px: number, py: number): boolean {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return false;
  return tiles[ty][tx] === "i";
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

/** advance a body by dtMs of held input (attack freezes movement, exactly like
 *  the core rule). `slick` mirrors g.slick: on ice tiles the body coasts. */
export function stepPred(b: Body, tiles: string[], inp: Input,
                         attacking: boolean, dtMs: number, slick = false): void {
  if (!b.live || attacking) return;   // frozen like core — velocity left untouched
  const dx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const dy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
  const moving = dx !== 0 || dy !== 0;
  if (!moving && b.vx === 0 && b.vy === 0) return;   // idle & not coasting
  const sp = 1.35;
  const len = moving ? Math.hypot(dx, dy) : 1;
  const tvx = moving ? (dx / len) * sp : 0;
  const tvy = moving ? (dy / len) * sp : 0;
  // integrate in 60 Hz sub-steps so collisions match the server tick-for-tick
  let ticks = dtMs / (1000 / 60);
  while (ticks > 0) {
    const f = Math.min(1, ticks);
    const onIce = slick && iceAtTiles(tiles, b.x + PLAYER_W / 2, b.y + PLAYER_H / 2);
    if (onIce) {
      const ease = (moving ? ICE_ACCEL : ICE_DECEL) * f;
      b.vx += (tvx - b.vx) * ease;
      b.vy += (tvy - b.vy) * ease;
      if (Math.abs(b.vx) < 0.03) b.vx = 0;
      if (Math.abs(b.vy) < 0.03) b.vy = 0;
    } else {
      b.vx = tvx; b.vy = tvy;
    }
    if (b.vx !== 0 || b.vy !== 0) movePredicted(tiles, b, b.vx * f, b.vy * f);
    ticks -= 1;
  }
}

/** drop an anchor for the input we are sending right now: where the prediction
 *  stands *before* this held state takes effect — the same instant the server
 *  will record when the message lands. Call once per input message. */
export function recordInput(pred: Pred, seq: number, tNow: number): void {
  pred.hist.push({ seq, px: pred.x, py: pred.y, t: tNow });
  const cutoff = tNow - HIST_MS;
  while (pred.hist.length > 1 && pred.hist[0].t < cutoff) pred.hist.shift();
}

/** fold the server's truth in. `authX/authY` is the hero's CURRENT server
 *  position (used only to snap on room change / downed / gross desync);
 *  `ackX/ackY` is where the server stood when it received input `ackSeq` — the
 *  twin of our own anchor for that seq. Their difference is the real divergence. */
export function reconcile(pred: Pred, authX: number, authY: number, room: number,
                          downed: boolean, ackSeq: number,
                          ackX: number, ackY: number): void {
  // a new life, a new room, or no fix yet: obey the server outright
  if (!pred.live || pred.room !== room || downed) {
    pred.x = authX; pred.y = authY; pred.room = room; pred.live = true;
    pred.vx = 0; pred.vy = 0;   // momentum does not survive a new room/life
    pred.hist = [];   // anchors from another room/life are meaningless
    pred.lastAck = Math.max(pred.lastAck, ackSeq);
    return;
  }
  // reconcile each ack once: re-applying the same error would push us off course
  if (ackSeq <= pred.lastAck) return;
  pred.lastAck = ackSeq;

  const anchor = pred.hist.find(s => s.seq === ackSeq);
  pred.hist = pred.hist.filter(s => s.seq >= ackSeq);   // keep the anchor + newer

  if (!anchor) {
    // history gap (reconnect, long stall): trust the prediction, but rescue a
    // gross desync from the current server position
    if (Math.hypot(authX - pred.x, authY - pred.y) > DESYNC) {
      pred.x = authX; pred.y = authY;
    }
    return;
  }

  // divergence measured at the SAME point of the input timeline — lag cancels
  const ex = ackX - anchor.px, ey = ackY - anchor.py;
  if (Math.hypot(ex, ey) > SNAP) {   // knockback, teleport, hard disagreement
    pred.x += ex; pred.y += ey;
    return;
  }
  pred.x += ex * BLEND;
  pred.y += ey * BLEND;
}

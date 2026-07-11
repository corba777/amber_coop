/* client-side prediction for the player's OWN hero — the cure for remote
 * lag: your character moves the instant you press, and the server's truth
 * reconciles the difference. Deliberately DOM-free and an exact mirror of
 * core's movement math (speed, tri-point collision, 60 Hz), so the prediction
 * barely drifts and headless tests can exercise it.
 *
 * Reconciliation is input-seq + server-ack + replay: each input the client
 * sends carries a seq; the server echoes the last seq it applied as the
 * snapshot `ack`. On a snapshot we anchor to the authoritative position (which
 * already includes knockback and everything up through `ack`) and REPLAY the
 * still-unacked held inputs forward to now. Perfect prediction therefore lands
 * on top of itself — zero correction, no backward drag at high ping. */

import { Input, PLAYER_W, PLAYER_H, TILE, COLS, ROWS, W, H, SOLID } from "../shared/core";

/** one sampled held-state, tagged with the seq the server acks and the
 *  wall-clock time it became active */
export interface InputSample { seq: number; input: Input; attacking: boolean; t: number; }

export interface Pred {
  x: number; y: number; room: number; live: boolean;
  hist: InputSample[];   // unacked (and recently acked) held inputs, seq-ascending
  lastAck: number;       // highest ack seen — guards out-of-order snapshots
}

export const freshPred = (): Pred => ({ x: 0, y: 0, room: -1, live: false, hist: [], lastAck: -1 });

/** movement bodies only need position + live; keeps stepPred usable on a
 *  throwaway replay accumulator, not just a full Pred */
type Body = { x: number; y: number; live: boolean };

const HIST_MS = 2000;   // cap history age — bounds memory
const BLEND = 0.5;      // pull toward the replayed target; high is safe now that
                        // the target is CURRENT (replayed to now), not stale
const SNAP = 40;        // px error above which we hard-snap to the server truth

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

/** advance a body by dtMs of held input (attack freezes movement, exactly like
 *  the core rule) */
export function stepPred(b: Body, tiles: string[], inp: Input,
                         attacking: boolean, dtMs: number): void {
  if (!b.live || attacking) return;
  const dx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const dy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy);
  const px = (dx / len) * 1.35, py = (dy / len) * 1.35;
  // integrate in 60 Hz sub-steps so collisions match the server tick-for-tick
  let ticks = dtMs / (1000 / 60);
  while (ticks > 0) {
    const f = Math.min(1, ticks);
    movePredicted(tiles, b, px * f, py * f);
    ticks -= 1;
  }
}

/** remember a held-state we just sent, so the next snapshot can replay from the
 *  ack forward. Call once per input message, with the seq that message carried. */
export function recordInput(pred: Pred, seq: number, input: Input,
                            attacking: boolean, tNow: number): void {
  pred.hist.push({ seq, input: { ...input }, attacking, t: tNow });
  const cutoff = tNow - HIST_MS;
  while (pred.hist.length > 1 && pred.hist[0].t < cutoff) pred.hist.shift();
}

/** fold the authoritative position in. Anchor to the server truth (`ack`
 *  already applied), replay the still-unacked held inputs up to `tNow`, then
 *  blend the local hero toward that reconstructed position. Hard-snap on room
 *  change, downed, first fix, or gross disagreement (knockback/teleport). */
export function reconcile(pred: Pred, authX: number, authY: number, room: number,
                          downed: boolean, ackSeq: number, tNow: number,
                          tiles: string[]): void {
  if (ackSeq < pred.lastAck) return;   // stale/out-of-order snapshot — ignore
  pred.lastAck = ackSeq;
  // drop everything the server has already accounted for
  pred.hist = pred.hist.filter(s => s.seq > ackSeq);

  if (!pred.live || pred.room !== room || downed) {
    pred.x = authX; pred.y = authY; pred.room = room; pred.live = true;
    pred.hist = [];   // history from another room/life is meaningless
    return;
  }

  // replay the unacked held inputs from the server truth forward to now
  const base: Body = { x: authX, y: authY, live: true };
  for (let i = 0; i < pred.hist.length; i++) {
    const s = pred.hist[i];
    const tEnd = i + 1 < pred.hist.length ? pred.hist[i + 1].t : tNow;
    const dt = tEnd - s.t;
    if (dt > 0) stepPred(base, tiles, s.input, s.attacking, dt);
  }

  if (Math.hypot(base.x - pred.x, base.y - pred.y) > SNAP) {
    pred.x = base.x; pred.y = base.y;   // the server disagrees a lot — obey it
    return;
  }
  pred.x += (base.x - pred.x) * BLEND;
  pred.y += (base.y - pred.y) * BLEND;
}

/** Per-frame snapshot recorder for offline replay (join: sid + matchIndex + tick). */
import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "../shared/core";

export type ReplayThought = {
  slot: number;
  name: string;
  action: string;
  why?: string;
  ms: number;
};

export type ReplayLogCtx = {
  sid?: string;
  matchIndex?: number;
  mode?: string;
  episode?: number;
};

export type ReplayFrame = ReplayLogCtx & {
  tick: number;
  s: Snapshot;
  thoughts?: ReplayThought[] | null;
};

let logDir = "./logs";

export function setReplayLogDir(dir: string): void {
  logDir = dir;
}

/** Default on — set REPLAY_LOG=0 to disable (saves disk on long farms). */
export function replayLogEnabled(): boolean {
  const v = process.env.REPLAY_LOG;
  if (v === undefined || v === "") return true;
  return v === "1" || v === "true";
}

/** Strip wire-only fields before persistence. */
export function compactSnapshot(s: Snapshot): Snapshot {
  const c = { ...s };
  delete (c as { ack?: number }).ack;
  delete (c as { ackX?: number }).ackX;
  delete (c as { ackY?: number }).ackY;
  return c;
}

export function replayFrameRecord(
  ctx: ReplayLogCtx,
  snap: Snapshot,
  thoughts?: ReplayThought[] | null,
): ReplayFrame {
  return {
    ...ctx,
    tick: snap.ticks,
    s: compactSnapshot(snap),
    ...(thoughts?.length ? { thoughts } : {}),
  };
}

export function appendReplayFrame(ctx: ReplayLogCtx, snap: Snapshot,
  thoughts?: ReplayThought[] | null): void {
  if (!replayLogEnabled()) return;
  if (snap.screen !== "play" && snap.screen !== "gameover" && snap.screen !== "win") return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "snapshots.jsonl"),
      JSON.stringify(replayFrameRecord(ctx, snap, thoughts)) + "\n",
    );
  } catch { /* disk full — never take down the tick */ }
}

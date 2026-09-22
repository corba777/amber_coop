/** Offline replay driver — loads session-*-snapshots.jsonl and feeds 2D/3D clients. */
import type { Snapshot } from "../shared/core";
import type { ReplayFrame, ReplayThought } from "../server/replay-log";

export type ReplaySink = {
  applyState: (s: Snapshot, thoughts: ReplayThought[] | null | undefined) => void;
  setNames: (n: [string, string]) => void;
  setSessionMode: (m: string) => void;
  setDisconnected: (v: boolean) => void;
};

export const replaySpec = new URLSearchParams(location.search).get("replay");
export const replayMode = !!replaySpec;

let frames: ReplayFrame[] = [];
let idx = 0;
let paused = false;
let speed = 1;
let accMs = 0;
let lastT = performance.now();

function parseSpec(spec: string): { sid: string; match: number } | null {
  const m = spec.match(/^([A-Z0-9]+)\/(\d+)$/i);
  if (!m) return null;
  return { sid: m[1].toUpperCase(), match: Number(m[2]) };
}

export async function bootReplay(spec: string, sink: ReplaySink): Promise<void> {
  const parsed = parseSpec(spec);
  if (!parsed) throw new Error(`bad replay spec "${spec}" — want SID/N e.g. NJCJ/75`);
  const url = `/replay-data/${parsed.sid}/${parsed.match}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`replay fetch ${res.status}: ${url}`);
  const text = await res.text();
  frames = text.trim().split("\n").filter(Boolean).map(l => JSON.parse(l) as ReplayFrame);
  if (!frames.length) throw new Error("replay empty");
  sink.setDisconnected(false);
  sink.setSessionMode("duo");
  idx = 0;
  applyIdx(sink, 0);
}

function applyIdx(sink: ReplaySink, i: number): void {
  idx = Math.max(0, Math.min(frames.length - 1, i));
  const fr = frames[idx];
  if (fr.s.names) sink.setNames(fr.s.names);
  sink.applyState(fr.s, fr.thoughts);
}

export function replayStep(sink: ReplaySink, delta: number): void {
  if (!frames.length || paused) return;
  accMs += delta * speed;
  while (accMs >= 33 && idx < frames.length - 1) {
    accMs -= 33;
    applyIdx(sink, idx + 1);
  }
}

export function replayHandleKey(code: string, sink: ReplaySink): boolean {
  if (!frames.length) return false;
  if (code === "Space") { paused = !paused; return true; }
  if (code === "ArrowLeft" || code === "KeyJ") {
    paused = true;
    applyIdx(sink, idx - 1);
    return true;
  }
  if (code === "ArrowRight" || code === "KeyL") {
    paused = true;
    applyIdx(sink, idx + 1);
    return true;
  }
  if (code === "BracketLeft") { speed = Math.max(0.25, speed / 2); return true; }
  if (code === "BracketRight") { speed = Math.min(4, speed * 2); return true; }
  if (code === "Home") { paused = true; applyIdx(sink, 0); return true; }
  if (code === "End") { paused = true; applyIdx(sink, frames.length - 1); return true; }
  return false;
}

export function replayOverlay(): string {
  if (!frames.length) return "REPLAY — loading…";
  const fr = frames[idx];
  const pct = Math.round((idx / Math.max(1, frames.length - 1)) * 100);
  return `REPLAY tick ${fr.tick ?? idx} · ${idx + 1}/${frames.length} (${pct}%)` +
    (paused ? " · PAUSED" : "") + ` · ${speed}x` +
    " · ←/→ step · space pause · [/] speed";
}

export function replayFrameCount(): number {
  return frames.length;
}

/** Call once per animation frame from the client render loop. */
export function replayOnFrame(sink: ReplaySink, now: number): void {
  const delta = now - lastT;
  lastT = now;
  replayStep(sink, delta);
}

/** Per-tick HUD caption log — joinable on sid + matchIndex + tick (forensics). */
import fs from "node:fs";
import path from "node:path";
import { Game, simOf } from "../shared/core";

export type HudLogCtx = {
  sid?: string;
  matchIndex?: number;
  /** bench: arena | rink | duo | quest | scenario */
  mode?: string;
  episode?: number;
  scenario?: string;
};

let logDir = "./logs";

export function setHudLogDir(dir: string): void {
  logDir = dir;
}

export function hudLogDir(): string {
  return logDir;
}

/** Default on — set HUD_LOG=0 to disable (disk on long farms). */
export function hudLogEnabled(): boolean {
  const v = process.env.HUD_LOG;
  if (v === undefined || v === "") return true;
  return v === "1" || v === "true";
}

export function hudLogRecord(ctx: HudLogCtx, g: Game): Record<string, unknown> {
  const heroes = g.players.map((p, slot) => ({
    slot,
    hp: p.hp,
    maxHp: p.maxHp,
    downed: p.downed,
    dead: p.dead,
    winterMark: p.winterMark,
    room: simOf(g, slot).room,
  }));
  const events = g.events
    .filter(e => e.t === "carry-throw")
    .map(e => ({
      t: e.t,
      slot: e.slot,
      weaponize: e.weaponize,
      foesHit: e.foesHit,
      room: e.room,
    }));
  return {
    t: new Date().toISOString(),
    ...ctx,
    tick: g.ticks,
    screen: g.screen,
    room: g.room,
    message: g.message,
    messageT: g.messageT,
    ending: g.ending?.id ?? null,
    heroes,
    hasEmberMercy: g.hasEmberMercy,
    emberDead: g.emberDead,
    betrayed: g.betrayed,
    ...(events.length ? { events } : {}),
  };
}

/** Append one post-update frame to logs/hud.jsonl. Never throws. */
export function appendHudLog(ctx: HudLogCtx, g: Game): void {
  if (!hudLogEnabled()) return;
  if (g.screen !== "play" && g.screen !== "gameover" && g.screen !== "win") return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "hud.jsonl"),
      JSON.stringify(hudLogRecord(ctx, g)) + "\n",
    );
  } catch { /* disk full — never take down the tick */ }
}

/* DOM-free partner-say chat log — headless tests can import this without sprites. */

import type { Snapshot } from "../shared/core";

/** Partner `say` scroll — off-frame; playfield keeps only a tiny cue. */
export const CHAT_MAX_LINES = 2;

export type ChatLine = { slot: number; name: string; text: string };

/** Pure ingest: append when a slot's say string changes. */
export function ingestSayChat(
  lines: ChatLine[],
  lastSay: [string, string],
  players: ReadonlyArray<{ say: string; present: boolean }>,
  names: [string, string],
  maxLines = CHAT_MAX_LINES,
): { lines: ChatLine[]; lastSay: [string, string] } {
  let next = lines;
  const last: [string, string] = [lastSay[0], lastSay[1]];
  let changed = false;
  for (const i of [0, 1] as const) {
    const p = players[i];
    if (!p?.present) continue;
    const say = (p.say || "").trim();
    if (!say || say === last[i]) continue;
    last[i] = say;
    if (!changed) { next = lines.slice(); changed = true; }
    next.push({
      slot: i,
      name: (names[i] || `P${i + 1}`).slice(0, 16),
      text: say,
    });
  }
  if (next.length > maxLines) next = next.slice(-maxLines);
  return { lines: next, lastSay: last };
}

export type SayChatState = {
  lines: ChatLine[];
  lastSay: [string, string];
};

export function emptySayChat(): SayChatState {
  return { lines: [], lastSay: ["", ""] };
}

/** Tick the log from a snapshot; clears when leaving play. */
export function tickSayChat(
  state: SayChatState,
  s: Snapshot,
  names: [string, string],
): SayChatState {
  if (s.screen !== "play") return emptySayChat();
  return ingestSayChat(state.lines, state.lastSay, s.players, names);
}

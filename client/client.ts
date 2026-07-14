/* =========================================================================
 *  AMBER COOP client — renders server snapshots, sends inputs.
 *  All art, sfx and the ambient score are generated locally, driven by
 *  the snapshot (room → music mood, events → sfx/particle bursts).
 * ========================================================================= */

import {
  TILE, COLS, ROWS, W, H, PLAYER_W, PLAYER_H,
  Snapshot, Input, emptyInput, GameEvent,
  BLEED_TICKS,
} from "../shared/core";
import { SPR, HEROES, TILES } from "./sprites";
import { drawDuoSpectatorHud, drawHearts } from "./hud";
import { wrapText } from "./textutil";
import { Pred, freshPred, stepPred, reconcile, recordInput } from "./predict";
import { ensureAudio, playSfx, music, musicModeFor, actx } from "./audio";
import { drawPartnerPip, partnerPipCanvasSize, partnerPipOrigin } from "./partnerpip";
import {
  freshMenu, menuOptions, menuConfirm, menuBack, menuTitle, resetMenu,
} from "./menu";

// ------------------------------------------------------------- connection
const proto = location.protocol === "https:" ? "wss" : "ws";
const roomParam = new URLSearchParams(location.search).get("room");
const ws = new WebSocket(`${proto}://${location.host}${roomParam ? `/?room=${encodeURIComponent(roomParam)}` : ""}`);
let mySlot = 0;
let roomCode = "";
declare const __BUILD__: string;
const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev";
let serverBuild = "";
let showThought = true;   // T toggles the AI thought panel
const pred: Pred = freshPred();
let localAttack = 0;      // instant swing visual: damage stays server-side
let localBowFlash = 0;
let lastFrameT = performance.now();
let rttMs = -1;
/** true after the socket dies — freeze the ghost frame, drop stale RTT, show banner */
let disconnected = false;
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: "ping", n: performance.now() }));
  }
}, 2000);
console.log("AMBER COOP client build", BUILD);

// ------------------------------------------------------------- player name
let myName = "";
try { myName = localStorage.getItem("amber-name") ?? ""; } catch { /* in-memory only */ }
function sendName(): void {
  if (myName && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: "name", name: myName }));
  }
}
{
  const gate = document.getElementById("namegate") as HTMLDivElement | null;
  const input = document.getElementById("namein") as HTMLInputElement | null;
  const go = document.getElementById("namego") as HTMLButtonElement | null;
  const syncGo = (): void => {
    if (!go || !input) return;
    const ready = input.value.trim().length > 0;
    go.disabled = !ready;
    go.style.opacity = ready ? "1" : "0.45";
    go.style.cursor = ready ? "pointer" : "not-allowed";
  };
  const submit = (): void => {
    const v = (input?.value ?? "").trim().slice(0, 12);
    // refuse empty name — otherwise matches.jsonl collapses everyone to ILYA
    // and tester bug reports cannot be attributed (author Artem 2026-07-13)
    if (!v) {
      if (input) {
        input.placeholder = "name required";
        input.focus();
      }
      syncGo();
      return;
    }
    myName = v;
    try { localStorage.setItem("amber-name", v); } catch { /* fine */ }
    if (gate) gate.style.display = "none";
    enableNameGate(false);
    releaseNameFocus();
    sendName();
  };
  if (gate && input && go) {
    // ALWAYS ask on load: returning players hit Enter on their prefilled
    // name; a guest on the same machine gets to introduce themselves
    input.value = myName;
    gate.style.display = "flex";
    enableNameGate(true);
    syncGo();
    setTimeout(() => { input.focus(); input.select(); }, 50);
    go.addEventListener("click", submit);
    input.addEventListener("input", syncGo);
    input.addEventListener("keydown", ev => {
      if (!gate || gate.style.display === "none") return;
      // play mode: never swallow — the gate can outlive focus and block ESC/WASD
      if (snap?.screen === "play") { ensurePlayControl(); return; }
      ev.stopPropagation();
      if (ev.key === "Enter") submit();
    });
  }
}
ws.addEventListener("open", sendName);
ws.addEventListener("close", () => {
  disconnected = true;
  rttMs = -1;
  pred.live = false;
});
ws.addEventListener("error", () => {
  disconnected = true;
  rttMs = -1;
  pred.live = false;
});

let p2mode = "llm";
let sessionMode: string | null = null;
let snap: Snapshot | null = null;
let prevSnap: Snapshot | null = null;
let snapTime = 0, snapInterval = 33;
let names: [string, string] = ["ILYA", "PLAYER 2"];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
const particles: Particle[] = [];

interface ProviderInfo { ok: boolean; label: string; hint: string; }
let providers: Record<string, ProviderInfo> = {};

ws.onmessage = ev => {
  const msg = JSON.parse(String(ev.data)) as
    | { t: "hello"; slot: number; room?: string; build?: string; mode: string | null; names: [string, string];
        providers: Record<string, ProviderInfo> }
    | { t: "state"; s: Snapshot }
    | { t: "kicked"; reason: string }
    | { t: "pong"; n: number }
    | { t: "full"; reason?: string };
  if (msg.t === "pong") {
    rttMs = Math.round(performance.now() - (msg.n as number));
    return;
  }
  if (msg.t === "hello") {
    mySlot = msg.slot;
    roomCode = msg.room ?? "";
    serverBuild = msg.build ?? "";
    disconnected = false;
    sendName();
    p2mode = msg.mode ?? "";
    sessionMode = msg.mode;
    names = msg.names;
    providers = msg.providers ?? {};
  } else if (msg.t === "kicked") {
    alert("Disconnected: " + msg.reason);
  } else if (msg.t === "state") {
    names = msg.s.names;
    prevSnap = snap;
    const now = performance.now();
    if (snapTime > 0) snapInterval = Math.min(80, Math.max(16, now - snapTime));
    snapTime = now;
    snap = msg.s;
    if (msg.s.mode !== undefined) sessionMode = msg.s.mode;
    if (msg.s.screen === "play") ensurePlayControl();
    const me = msg.s.players[mySlot];
    if (msg.s.screen === "play" && me?.present && !isSpectator(msg.s)) {
      reconcile(pred, me.x, me.y, msg.s.room, me.downed, msg.s.ack ?? -1,
                msg.s.ackX ?? me.x, msg.s.ackY ?? me.y);
    }
    for (const e of msg.s.events) handleEvent(e);
  } else if (msg.t === "full") {
    alert(msg.reason ?? "Server is full.");
  }
};

// ---------------------------------------------------------------- menu
const menu = freshMenu();

function setUrlRoom(on: boolean): void {
  // keep the canonical URL bare unless a coop seat is actually open —
  // otherwise browser autocomplete leaks stale ?room codes everywhere
  try {
    history.replaceState(null, "", on && roomCode
      ? `${location.pathname}?room=${roomCode}` : location.pathname);
  } catch { /* */ }
}

function menuSend(payload: Record<string, unknown>): void {
  ws.send(JSON.stringify(payload));
}

function menuKey(code: string): boolean {
  if (!snap || snap.screen !== "menu" || mySlot !== 0) return false;
  const opts = menuOptions(menu, providers);
  if (code === "ArrowUp" || code === "KeyW") { menu.idx = (menu.idx + opts.length - 1) % opts.length; return true; }
  if (code === "ArrowDown" || code === "KeyS") { menu.idx = (menu.idx + 1) % opts.length; return true; }
  if (code === "Enter" || code === "Space") {
    menuConfirm(menu, providers, menuSend, setUrlRoom, myName);
    return true;
  }
  if (code === "Backspace" || code === "ArrowLeft") {
    if (menu.step > 0) menuBack(menu);
    return true;
  }
  return false;
}

function inviteLink(): string {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}
const copyBtn = document.getElementById("copylink") as HTMLButtonElement | null;
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    const link = inviteLink();
    const done = (): void => {
      copyBtn.textContent = "LINK COPIED!";
      setTimeout(() => { copyBtn.textContent = "COPY INVITE LINK"; }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => { window.prompt("Copy the invite link:", link); });
    } else {
      window.prompt("Copy the invite link:", link);
    }
  });
}

function isSpectator(s: Snapshot | null): boolean {
  return sessionMode === "auto" || sessionMode === "duo" ||
    (s !== null && !s.players[mySlot].present);
}

let inputSeq = 0;
function sendInput(): void {
  if (isSpectator(snap)) return;
  if (ws.readyState === WebSocket.OPEN) {
    inputSeq++;
    ws.send(JSON.stringify({ t: "input", s: state, seq: inputSeq }));
    // anchor: where our prediction stands as this held state takes effect —
    // the server records its own twin when the message lands
    recordInput(pred, inputSeq, performance.now());
  }
}

function handleEvent(e: GameEvent): void {
  if (e.t === "sfx") playSfx(e.name);
  else if (e.t === "burst") {
    for (let i = 0; i < e.n; i++) {
      const a = (i / e.n) * Math.PI * 2 + Math.random() * 0.5;
      particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * (0.8 + Math.random()),
        vy: Math.sin(a) * (0.8 + Math.random()),
        life: 18 + Math.random() * 10, color: e.color,
      });
    }
  }
}

// ------------------------------------------------------------------ input
const state: Input = emptyInput();
const KEYMAP: Record<string, keyof Input | undefined> = {
  ArrowLeft: "l", KeyA: "l",
  ArrowRight: "r", KeyD: "r",
  ArrowUp: "u", KeyW: "u",
  ArrowDown: "d", KeyS: "d",
  Space: "a", KeyJ: "a", KeyZ: "a",
  KeyX: "b", KeyK: "b",
  KeyF: "f",
  KeyC: "c",
  ShiftLeft: "k", ShiftRight: "k",
  Enter: "st", KeyE: "st",
};
window.addEventListener("keydown", ev => {
  if (snap?.screen === "play") ensurePlayControl();
  ensureAudio();
  if (menuKey(ev.code)) { ev.preventDefault(); return; }
  if (ev.code === "Escape" && mySlot === 0 && snap && snap.screen !== "menu") {
    if (disconnected || ws.readyState !== WebSocket.OPEN) return;
    resetMenu(menu);
    setUrlRoom(false);
    ws.send(JSON.stringify({ t: "tomenu" }));
    ev.preventDefault();
    return;
  }
  if (ev.code === "KeyT") { showThought = !showThought; return; }
  if (ev.code === "KeyM") { music.muted = !music.muted; if (!music.muted && actx) music.nextBeat = actx.currentTime + 0.1; return; }
  if ((ev.code === "Enter" || ev.code === "Space") && snap &&
      (snap.screen === "title" || snap.screen === "gameover" || snap.screen === "win")) {
    ws.send(JSON.stringify({ t: "start" }));
    ev.preventDefault();
    return;
  }
  if (isSpectator(snap)) return;
  const k = KEYMAP[ev.code];
  if (k) {
    (state[k] as boolean) = true;
    sendInput();
    // combat must FEEL instant at 150 ms ping: swing locally right now,
    // the server's verdict on damage arrives with the snapshot
    if (snap && snap.screen === "play") {
      const meL = snap.players[mySlot];
      if (meL && meL.present && !meL.downed && snap && !isSpectator(snap)) {
        if (k === "a" && localAttack <= 0 && meL.attack === 0) {
          localAttack = 16;
          playSfx("swing");
        }
        if (k === "b" && snap.hasBow && localBowFlash <= 0) {
          localBowFlash = 10;
          playSfx("bow");
        }
      }
    }
    // belt-and-suspenders: START screens get a dedicated message too,
    // independent of the held-state input path
    if (k === "st" && snap && (snap.screen === "title" || snap.screen === "gameover" || snap.screen === "win")) {
      ws.send(JSON.stringify({ t: "start" }));
    }
    ev.preventDefault();
  }
});
window.addEventListener("pointerdown", () => {
  ensureAudio();
  if (snap && (snap.screen === "title" || snap.screen === "gameover" || snap.screen === "win")) {
    ws.send(JSON.stringify({ t: "start" }));
  }
});
window.addEventListener("keyup", ev => {
  if (isSpectator(snap)) return;
  const k = KEYMAP[ev.code];
  if (k) { (state[k] as boolean) = false; sendInput(); ev.preventDefault(); }
});
setInterval(sendInput, 100);   // heartbeat against lost key-ups

const touchUI = document.getElementById("touch");
if (touchUI && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
  touchUI.style.display = "flex";
  const bind = (id: string, key: keyof Input): void => {
    const el = document.getElementById(id)!;
    const on = (ev: Event): void => { ensurePlayControl(); ensureAudio(); (state[key] as boolean) = true; sendInput(); ev.preventDefault(); };
    const off = (ev: Event): void => { (state[key] as boolean) = false; sendInput(); ev.preventDefault(); };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("pointerleave", off);
  };
  bind("b-up", "u"); bind("b-down", "d");
  bind("b-left", "l"); bind("b-right", "r");
  bind("b-a", "a"); bind("b-b", "b"); bind("b-start", "st");
}

// ----------------------------------------------------------------- canvas
const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
canvas.tabIndex = 0;
const ctx = canvas.getContext("2d")!;
function enableNameGate(on: boolean): void {
  const input = document.getElementById("namein") as HTMLInputElement | null;
  const gate = document.getElementById("namegate") as HTMLDivElement | null;
  if (!input) return;
  if (on) {
    input.disabled = false;
    input.tabIndex = 0;
    input.removeAttribute("inert");
    gate?.removeAttribute("inert");
    gate?.removeAttribute("aria-hidden");
  } else {
    input.disabled = true;
    input.tabIndex = -1;
    input.setAttribute("inert", "");
    gate?.setAttribute("inert", "");
    gate?.setAttribute("aria-hidden", "true");
  }
}

/** Human control is never gated by partner/agent state — only by play vs menu. */
function ensurePlayControl(): void {
  const gate = document.getElementById("namegate") as HTMLDivElement | null;
  if (gate) {
    gate.style.display = "none";
    gate.setAttribute("inert", "");
    gate.setAttribute("aria-hidden", "true");
  }
  enableNameGate(false);
  const input = document.getElementById("namein") as HTMLInputElement | null;
  input?.blur();
  canvas.focus({ preventScroll: true });
}

function releaseNameFocus(): void {
  ensurePlayControl();
}

/** capture phase: reclaim keyboard before #namein can stopPropagation */
function capturePlayKeys(ev: KeyboardEvent): void {
  if (snap?.screen !== "play") return;
  ensurePlayControl();
  if (ev.code === "Escape" && mySlot === 0) {
    if (disconnected || ws.readyState !== WebSocket.OPEN) return;
    resetMenu(menu);
    setUrlRoom(false);
    ws.send(JSON.stringify({ t: "tomenu" }));
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }
}
window.addEventListener("keydown", capturePlayKeys, true);
window.addEventListener("focus", () => { if (snap?.screen === "play") ensurePlayControl(); });
canvas.addEventListener("pointerdown", () => canvas.focus());
const pipCanvas = document.getElementById("pip") as HTMLCanvasElement | null;
const pipSize = partnerPipCanvasSize();
const pipOrigin = partnerPipOrigin();
let pipCtx: CanvasRenderingContext2D | null = null;
if (pipCanvas) {
  pipCanvas.width = pipSize.w;
  pipCanvas.height = pipSize.h;
  pipCtx = pipCanvas.getContext("2d");
  if (pipCtx) pipCtx.imageSmoothingEnabled = false;
}

function drawPartnerMirror(s: Snapshot): void {
  if (!pipCanvas || !pipCtx) return;
  if (s.partnerView && s.screen === "play") {
    pipCanvas.style.display = "block";
    pipCtx.clearRect(0, 0, pipSize.w, pipSize.h);
    drawPartnerPip(pipCtx, s.partnerView, names[1 - mySlot], 1 - mySlot, s.ticks,
      pipOrigin.ox, pipOrigin.oy, !!s.hasMirror);
  } else {
    pipCanvas.style.display = "none";
  }
}
ctx.imageSmoothingEnabled = false;

// ----------------------------------------------------------------- render
type SnapPlayer = Snapshot["players"][number];
type SnapEnemy = Snapshot["enemies"][number];

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function drawSword(p: SnapPlayer, amber: boolean, x: number, y: number): void {
  const t = 1 - p.attack / 16;
  const cx = x + PLAYER_W / 2, cy = y + PLAYER_H / 2;
  const base: number = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][p.dir];
  const ang = base + (t - 0.5) * 1.9 * (p.dir === 3 || p.dir === 1 ? -1 : 1);
  const bx = cx + Math.cos(ang) * 6, by = cy + Math.sin(ang) * 6;
  const tx = cx + Math.cos(ang) * 19, ty = cy + Math.sin(ang) * 19;
  ctx.strokeStyle = amber ? "#ffb545" : "#dfe3ee";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = amber ? "#ffe9c2" : "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = "#8a6238";
  ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
}

function drawHero(p: SnapPlayer, idx: number, x: number, y: number): void {
  const set = HEROES[idx];
  if (p.downed) {
    ctx.save();
    ctx.globalAlpha = p.dead ? 0.5 : 0.8;
    ctx.translate(Math.round(x) + 8, Math.round(y) + 10);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(set.down[0], -8, -10);
    ctx.restore();
    if (p.dead) {
      // a betrayed hero: no revive, no bleed clock — just a mark in the snow
      ctx.strokeStyle = "#c81e3a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + 1); ctx.lineTo(x + 10, y + 11);
      ctx.moveTo(x + 10, y + 1); ctx.lineTo(x, y + 11);
      ctx.stroke();
      return;
    }
    if (p.reviveP > 0) {
      ctx.strokeStyle = "#9be07a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 5, y + 6, 12, -Math.PI / 2, -Math.PI / 2 + (p.reviveP / 90) * Math.PI * 2);
      ctx.stroke();
    } else if (p.bleedT > 0) {
      ctx.strokeStyle = "#e8384f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 5, y + 6, 12, -Math.PI / 2, -Math.PI / 2 + (p.bleedT / BLEED_TICKS) * Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (p.invuln > 0 && (Math.floor(p.invuln / 4) % 2 === 0)) return;
  const frame = p.moving ? Math.floor(p.walk) % 2 : 0;
  const dx = Math.round(x) - 3, dy = Math.round(y) - 4;
  if (p.dir === 0) ctx.drawImage(set.down[frame], dx, dy);
  else if (p.dir === 1) ctx.drawImage(set.up[frame], dx, dy);
  else if (p.dir === 2) ctx.drawImage(set.right[frame], dx, dy);
  else {
    ctx.save();
    ctx.translate(dx + 16, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(set.right[frame], 0, 0);
    ctx.restore();
  }
}

function drawSpeech(p: SnapPlayer, x: number, y: number): void {
  if (p.sayT <= 0 || !p.say) return;
  ctx.font = "7px monospace";
  const tw = ctx.measureText(p.say).width + 8;
  const bx = Math.max(2, Math.min(W - tw - 2, x + 5 - tw / 2));
  const by = Math.max(2, y - 22);
  ctx.globalAlpha = Math.min(1, p.sayT / 20);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(bx, by, tw, 11);
  ctx.fillStyle = "#1b1b2b";
  ctx.fillText(p.say, bx + 4, by + 8);
  ctx.globalAlpha = 1;
}

function drawEnemy(e: SnapEnemy, ticks: number, x: number, y: number): void {
  if (e.hurt > 0 && Math.floor(e.hurt / 3) % 2 === 0) ctx.globalAlpha = 0.5;
  if (e.kind === "slime") {
    const f = e.phase === 1 ? 1 : Math.floor(e.t / 30) % 2;
    ctx.drawImage(SPR.slime[f], Math.round(x) - 2, Math.round(y) - 3);
  } else if (e.kind === "bat") {
    const f = Math.floor(e.t / 8) % 2;
    ctx.drawImage(SPR.bat[f], Math.round(x) - 2, Math.round(y) - 2);
  } else if (e.kind === "wisp") {
    const f = Math.floor(e.t / 14) % 2;
    const bob = Math.sin(ticks * 0.08 + x) * 1.5;
    ctx.globalAlpha *= 0.9;
    ctx.drawImage(SPR.wisp[f], Math.round(x) - 2, Math.round(y) - 3 + bob);
  } else if (e.kind === "golem" || e.kind === "ember") {
    const img = e.kind === "ember" ? SPR.ember : SPR.golem;
    const wob = e.phase === 1 ? Math.sin(e.t * 0.8) * 2 : 0;
    if (e.phase === 3) {
      ctx.save();
      ctx.shadowColor = "#ffb545";
      ctx.shadowBlur = 10;
      ctx.drawImage(img, Math.round(x) - 2 + wob, Math.round(y) - 3);
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(x) - 2 + wob, Math.round(y) - 3);
    }
  } else if (e.kind === "sentinel") {
    if (e.stagger > 0) {
      ctx.save();
      ctx.translate(Math.round(x) + 6, Math.round(y) + 6);
      ctx.rotate(Math.sin(e.stagger * 0.5) * 0.22);   // reeling wobble
      ctx.drawImage(SPR.sentinel[0], -8, -8);
      ctx.restore();
    } else {
      ctx.drawImage(SPR.sentinel[0], Math.round(x) - 2, Math.round(y) - 2);
    }
  } else if (e.kind === "spitter") {
    const sq = 1 + Math.sin(e.t * 0.05) * 0.06;
    ctx.save();
    ctx.translate(Math.round(x) + 6, Math.round(y) + 10);
    ctx.scale(1 / sq, sq);
    ctx.drawImage(SPR.spitter[0], -8, -10);
    ctx.restore();
  } else {
    const bob = Math.sin(ticks * 0.06) * 2;
    ctx.save();
    if (e.kind === "wraith" && e.phase === 9) {
      ctx.globalAlpha *= 0.7;
      ctx.shadowColor = "#dff5ff";
      ctx.shadowBlur = 4;
      ctx.drawImage(SPR.wraith, Math.round(x) - 2, Math.round(y) - 3 + bob * 0.4);
      ctx.restore();
      if (e.spareP > 0) {
        ctx.strokeStyle = "#dff5ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 14, y + 14, 20, -Math.PI / 2, -Math.PI / 2 + (e.spareP / 75) * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.shadowColor = "#bfe9ff";
      ctx.shadowBlur = 8;
      ctx.drawImage(SPR.wraith, Math.round(x) - 2, Math.round(y) - 3 + bob);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // Frost Bell freeze: a pale rime shell over the held foe
  if (e.frozen > 0) {
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.15 * Math.sin(ticks * 0.3);
    ctx.fillStyle = "#cdefff";
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 16, 16);
    ctx.strokeStyle = "#eaffff";
    ctx.strokeRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 15, 15);
    ctx.restore();
  }
}

function drawPedestal(s: Snapshot): void {
  if (!s.pedestal) return;
  const { x, y, final } = s.pedestal;
  const bob = Math.sin(s.ticks * 0.06) * 2;
  const glow = final ? "191,233,255" : "255,181,69";
  const grad = ctx.createRadialGradient(x + 8, y + 4, 2, x + 8, y + 4, 22);
  grad.addColorStop(0, `rgba(${glow},0.35)`);
  grad.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - 14, y - 18, 44, 44);
  ctx.fillStyle = "#5c5c70"; ctx.fillRect(x + 2, y + 8, 12, 8);
  ctx.fillStyle = "#8d8da0"; ctx.fillRect(x + 3, y + 9, 10, 3);
  if (final) {
    ctx.fillStyle = "#bfe9ff"; ctx.fillRect(x + 6, y - 4 + bob, 4, 4);
    ctx.fillStyle = "#dff5ff"; ctx.fillRect(x + 4, y - 2 + bob, 3, 3); ctx.fillRect(x + 9, y - 2 + bob, 3, 3);
    ctx.fillStyle = "#57b04b"; ctx.fillRect(x + 7, y + 1 + bob, 2, 6);
  } else {
    ctx.fillStyle = "#ffb545"; ctx.fillRect(x + 7, y - 8 + bob, 2, 14);
    ctx.fillStyle = "#ffe9c2"; ctx.fillRect(x + 7, y - 8 + bob, 1, 14);
    ctx.fillStyle = "#8a6238"; ctx.fillRect(x + 4, y + 4 + bob, 8, 2);
  }
}

function centerText(lines: [string, number, string][], baseY: number): void {
  ctx.textAlign = "center";
  for (const [txt, size, color] of lines) {
    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = color;
    ctx.fillText(txt, W / 2, baseY);
    baseY += size + 8;
  }
  ctx.textAlign = "left";
}

function drawUI(s: Snapshot): void {
  const me = s.players[mySlot];
  // TREASON: your own partner cut the cord. You are dead, but the run goes on
  // without you — a spectator to your betrayer's quest.
  if (s.screen === "play" && me.dead && !isSpectator(s)) {
    ctx.fillStyle = "rgba(20,4,10,0.55)";
    ctx.fillRect(0, 0, W, H);
    centerText([
      ["BETRAYED", 14, "#e8384f"],
      ["your partner cut the cord and left you to the cold", 6, "#d8b9c2"],
      [`${names[1 - mySlot].slice(0, 16)} quests on without you`, 6, "#9a93b8"],
    ], H / 2 - 12);
    return;
  }
  if (isSpectator(s)) {
    if (sessionMode === "duo") {
      drawDuoSpectatorHud(ctx, s, names);
    } else {
      ctx.font = "7px monospace";
      ctx.fillStyle = "#ffb545";
      ctx.fillText(`SPECTATING \u00b7 ${names[1]} quests alone`, 4, 12);
      const quest = s.players[1];
      if (quest.present) {
        ctx.font = "6px monospace";
        ctx.fillStyle = "#9a93b8";
        ctx.fillText(names[1].slice(0, 22), 4, 24);
        drawHearts(ctx, quest.hp, quest.maxHp, 4, 27, 7, 8);
      }
    }
  } else {
    if (!me.present) {
      ctx.font = "7px monospace";
      ctx.fillStyle = "#ffb545";
      ctx.fillText(`SPECTATING \u00b7 ${names[1]} quests alone`, 4, 12);
    }
    for (let i = 0; i < me.maxHp / 2; i++) {
      const full = me.hp >= (i + 1) * 2;
      const half = !full && me.hp === i * 2 + 1;
      ctx.globalAlpha = full ? 1 : 0.25;
      ctx.drawImage(SPR.heart, 4 + i * 13, 2, 12, 12);
      if (half) {
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath(); ctx.rect(4 + i * 13, 2, 6, 12); ctx.clip();
        ctx.drawImage(SPR.heart, 4 + i * 13, 2, 12, 12);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    const mate = s.players[1 - mySlot];
    if (mate.present) {
      ctx.font = "6px monospace";
      ctx.fillStyle = "#9a93b8";
      ctx.fillText(names[1 - mySlot].slice(0, 22), 4, 24);
      for (let i = 0; i < mate.maxHp / 2; i++) {
        ctx.globalAlpha = mate.hp >= (i + 1) * 2 ? 1 : mate.hp === i * 2 + 1 ? 0.6 : 0.2;
        ctx.drawImage(SPR.heart, 4 + i * 8, 27, 7, 7);
      }
      ctx.globalAlpha = 1;
    }
  }
  const keys = s.players[0].keys + s.players[1].keys;
  for (let i = 0; i < keys; i++) ctx.drawImage(SPR.key, W - 18 - i * 12, 1, 14, 14);
  // artifact strip, drawn leftward from the key column
  const artifacts: [boolean, HTMLCanvasElement][] = [
    [s.hasBow, SPR.bow],
    [s.players[mySlot].elixir, SPR.elixir],
    [!!s.hasBell, SPR.bell],
    [!!s.hasMirror, SPR.mirror],
  ];
  let artX = W - 18 - keys * 12;
  for (const [have, spr] of artifacts) {
    if (!have) continue;
    artX -= 14;
    ctx.drawImage(spr, artX, 1, 14, 14);
  }
  const boss = s.enemies.find(e => (e.kind === "golem" || e.kind === "wraith" || e.kind === "ember") && !e.dead);
  if (boss) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(48, H - 12, 160, 7);
    ctx.fillStyle = boss.kind === "wraith" ? "#9fe8ff" : boss.kind === "ember" ? "#ff7a3d" : "#e8384f";
    ctx.fillRect(49, H - 11, 158 * (boss.hp / boss.maxHp), 5);
  }
  if (disconnected || (rttMs >= 0 && s.screen === "play")) {
    ctx.font = "7px monospace";
    const rl = disconnected ? "offline" : `${rttMs}ms`;
    const rw = ctx.measureText(rl).width;
    ctx.fillStyle = "rgba(8,6,16,0.72)";
    ctx.fillRect(W - rw - 8, 1, rw + 6, 11);
    ctx.fillStyle = disconnected ? "#e8384f"
      : rttMs < 60 ? "#78c88c" : rttMs < 120 ? "#ffb545" : "#e8384f";
    ctx.textAlign = "right";
    ctx.fillText(rl, W - 5, 9);
    ctx.textAlign = "left";
  }
  const thoughtLines = s.thoughts && s.thoughts.length
    ? s.thoughts.map(t => ({ slot: t.slot,
        text: `${t.name.slice(0, 12)}: ${t.action}${t.why ? " \u2014 " + t.why : ""}`.slice(0, 60) }))
    : s.thought
      ? [{ slot: 1, text: `AI: ${s.thought.action}${s.thought.why ? " \u2014 " + s.thought.why : ""}`.slice(0, 58) }]
      : [];
  if (thoughtLines.length && showThought && s.screen === "play") {
    ctx.font = "7px monospace";
    const n = thoughtLines.length;
    thoughtLines.forEach((tl, i) => {
      const y = H - 13 - (n - 1 - i) * 11;   // stack upward, newest layout order
      const tw = ctx.measureText(tl.text).width;
      ctx.fillStyle = "rgba(8,6,16,0.72)";
      ctx.fillRect(2, y, tw + 6, 11);
      ctx.fillStyle = tl.slot === 0 ? "#ffcf8f" : "#9fc8e0";   // leader gold, companion blue
      ctx.fillText(tl.text, 5, y + 8);
    });
  }
  if (s.messageT > 0 && s.message) {
    ctx.globalAlpha = Math.min(1, s.messageT / 30);
    ctx.font = "8px monospace";
    const lines = wrapText(ctx, s.message, W - 28);
    const tw = Math.max(...lines.map(ln => ctx.measureText(ln).width)) + 12;
    const th = lines.length * 10 + 5;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(W / 2 - tw / 2, 18, tw, th);
    ctx.fillStyle = "#ffe9c2";
    ctx.textAlign = "center";
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 27 + i * 10));
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

function render(): void {
  requestAnimationFrame(render);
  ctx.fillStyle = "#0d0c14";
  ctx.fillRect(0, 0, W, H);
  if (!snap) {
    centerText([[disconnected ? "DISCONNECTED" : "CONNECTING...", 12,
      disconnected ? "#e8384f" : "#9a93b8"]], 110);
    if (disconnected) {
      centerText([["connection lost — refresh to rejoin", 7, "#9a93b8"]], 130);
    }
    return;
  }
  const s = snap;
  music.mode = musicModeFor(s);

  // interpolation factor between the two latest snapshots
  const nowT = performance.now();
  const alpha = Math.min(1, (nowT - snapTime) / snapInterval);
  if (snap && snap.screen === "play" && !disconnected) {
    const meP = snap.players[mySlot];
    stepPred(pred, snap.tiles, state, !!meP && meP.attack > 0, nowT - lastFrameT, !!snap.slick);
  }
  lastFrameT = nowT;
  if (localAttack > 0) localAttack--;
  if (localBowFlash > 0) localBowFlash--;
  const pv = prevSnap && prevSnap.room === s.room ? prevSnap : null;

  ctx.save();
  if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const img = TILES[s.tiles[j].charAt(i)] ?? TILES.g;
      ctx.drawImage(img, i * TILE, j * TILE);
    }
  }
  drawPedestal(s);
  for (const it of s.pickups) {
    // ground disc + sparkle: items must pop even on snow
    ctx.fillStyle = "rgba(8,6,16,0.3)";
    ctx.beginPath();
    ctx.ellipse(it.x + 6, it.y + 12, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const tw2 = 0.5 + 0.5 * Math.sin(s.ticks * 0.15 + it.x);
    ctx.fillStyle = `rgba(255,235,150,${0.25 + 0.3 * tw2})`;
    ctx.fillRect(it.x + 5, it.y - 4 - tw2 * 2, 2, 2);
    const bob = Math.sin((s.ticks + it.x) * 0.1) * 1.5;
    const px = Math.round(it.x) - 8, py = Math.round(it.y) - 8 + bob;
    if (it.kind === "heart") ctx.drawImage(SPR.heart, px, py);
    else if (it.kind === "key") ctx.drawImage(SPR.key, px, py);
    else if (it.kind === "bow") ctx.drawImage(SPR.bow, px, py);
    else if (it.kind === "elixir") ctx.drawImage(SPR.elixir, px, py);
    else if (it.kind === "charm") {
      ctx.save();
      ctx.shadowColor = "#ffd257"; ctx.shadowBlur = 6;
      ctx.drawImage(SPR.charm, px, py);
      ctx.restore();
    }
    else if (it.kind === "frostbell") {
      ctx.save();
      ctx.shadowColor = "#bff0ff"; ctx.shadowBlur = 7;
      ctx.drawImage(SPR.bell, px, py);
      ctx.restore();
    }
    else if (it.kind === "mirror") {
      ctx.save();
      ctx.shadowColor = "#bcd7ff"; ctx.shadowBlur = 8;
      ctx.drawImage(SPR.mirror, px, py);
      ctx.restore();
    }
    else {
      ctx.drawImage(SPR.heart, px - 2, py - 2, 20, 20);
      ctx.strokeStyle = "#ffd257";
      ctx.strokeRect(px - 3, py - 3, 22, 22);
    }
  }

  if (s.companion) {
    const cb = Math.sin(s.ticks * 0.05) * 2.5;
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.shadowColor = "#bfe9ff";
    ctx.shadowBlur = 7;
    ctx.drawImage(SPR.wraith, Math.round(s.companion.x), Math.round(s.companion.y) + cb, 22, 22);
    ctx.restore();
  }

  // depth-sorted entities with interpolation
  const drawables: { y: number; fn: () => void }[] = [];
  s.players.forEach((p, i) => {
    if (!p.present) return;
    const ox = pv?.players[i]?.x ?? p.x;
    const oy = pv?.players[i]?.y ?? p.y;
    let x = lerp(ox, p.x, alpha), y = lerp(oy, p.y, alpha);
    let pd = p;
    if (i === mySlot && pred.live && !p.downed && p.present && !isSpectator(s)) {
      x = pred.x; y = pred.y;   // your hero answers to YOUR keys, instantly
      const ddx = (state.r ? 1 : 0) - (state.l ? 1 : 0);
      const ddy = (state.d ? 1 : 0) - (state.u ? 1 : 0);
      let dir = p.dir;
      if (ddy > 0) dir = 0; else if (ddy < 0) dir = 1;
      if (ddx > 0) dir = 2; else if (ddx < 0) dir = 3;
      pd = { ...p, dir, attack: Math.max(p.attack, localAttack) };
    }
    drawables.push({ y: y + PLAYER_H, fn: () => {
      drawHero(pd, i, x, y);
      if (pd.attack > 0 && !pd.downed) drawSword(pd, s.amberClaimed, x, y);
      drawSpeech(p, x, y);
      // name tags for both heroes (own name slightly dimmer)
      if (!p.downed && names[i]) {
        ctx.font = "6px monospace";
        ctx.fillStyle = i === mySlot ? "rgba(255,229,178,0.55)" : "rgba(255,255,255,0.65)";
        ctx.textAlign = "center";
        ctx.fillText(names[i].slice(0, 12), x + 5, y - 6);
        ctx.textAlign = "left";
      }
    }});
  });
  s.enemies.forEach((e, i) => {
    if (e.dead) return;
    const ox = pv?.enemies[i]?.x ?? e.x;
    const oy = pv?.enemies[i]?.y ?? e.y;
    const x = lerp(ox, e.x, alpha), y = lerp(oy, e.y, alpha);
    drawables.push({ y: y + 12, fn: () => {
      // every foe casts a shadow: bodies pop against any terrain
      ctx.fillStyle = "rgba(8,6,16,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 15, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === "wraith") {
        // the wraith reads from across the room: a breathing aura —
        // pale in grief, red in rage, white while it pleads for mercy
        const pulse = 0.22 + 0.13 * Math.sin(s.ticks * 0.12);
        const enraged = e.hp <= e.maxHp / 2 && e.phase !== 9;
        ctx.fillStyle = e.phase === 9
          ? `rgba(240,240,255,${0.3 + 0.18 * Math.sin(s.ticks * 0.2)})`
          : enraged ? `rgba(232,56,79,${pulse})` : `rgba(159,200,224,${pulse})`;
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 8, 15, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawEnemy(e, s.ticks, x, y);
      if (e.kind === "wraith" && e.phase === 9) {
        // the plea must be IMPOSSIBLE to miss — mercy dies of low contrast
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        const bob = Math.sin(s.ticks * 0.1) * 1.5;
        ctx.fillStyle = "rgba(8,6,16,0.75)";
        const msg = "spare me...";
        const tw = ctx.measureText(msg).width;
        ctx.fillRect(x + 8 - tw / 2 - 3, y - 16 + bob, tw + 6, 10);
        ctx.fillStyle = "#f0f0ff";
        ctx.fillText(msg, x + 8, y - 8 + bob);
        ctx.textAlign = "left";
      }
    } });
  });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();

  for (const pr of s.projectiles) {
    if (pr.friendly) {
      const l = Math.hypot(pr.vx, pr.vy) || 1;
      const nx = pr.vx / l, ny = pr.vy / l;
      ctx.strokeStyle = s.charm ? "#ff7a3d" : "#8a6238";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pr.x - nx * 5, pr.y - ny * 5);
      ctx.lineTo(pr.x + nx * 3, pr.y + ny * 3);
      ctx.stroke();
      ctx.fillStyle = s.charm ? "#ffd257" : "#dfe3ee";
      ctx.fillRect(pr.x + nx * 3 - 1, pr.y + ny * 3 - 1, 2, 2);
    } else {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 4);
      ctx.fillStyle = "#9fe8ff"; ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = "#dff5ff"; ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    }
  }

  // client-local particles
  for (const q of particles) {
    q.x += q.vx; q.y += q.vy; q.vx *= 0.92; q.vy *= 0.92; q.life--;
    ctx.globalAlpha = Math.min(1, q.life / 10);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, 2, 2);
  }
  ctx.globalAlpha = 1;
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].life <= 0) particles.splice(i, 1);
  }

  drawUI(s);
  if (disconnected) {
    // frozen last frame underneath — do not confuse with lag; the wire is dead
    ctx.fillStyle = "rgba(10,6,16,0.55)";
    ctx.fillRect(0, 0, W, H);
    centerText([
      ["DISCONNECTED", 14, "#e8384f"],
      ["connection lost — refresh to rejoin", 7, "#d8b9c2"],
    ], H / 2 - 10);
  }
  try {
    drawPartnerMirror(s);
  } catch (err) {
    console.error("partner PiP render failed:", err);
  }
  if (s.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${s.fade})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  if (s.screen === "menu") {
    ctx.fillStyle = "rgba(10,8,20,0.88)";
    ctx.fillRect(0, 0, W, H);
    centerText([
      ["AMBER COOP", 18, "#ffe9c2"],
      [menuTitle(menu), 8, "#9a93b8"],
    ], 48);
    if (mySlot === 0) {
      const opts = menuOptions(menu, providers);
      // adaptive layout: keep the option block BETWEEN the subtitle
      // ("choose your quest" ~y74) and the hint line (H-30). TREASON added a
      // 6th row — the old centre-at-126 formula lifted CLASSIC QUEST onto the
      // subtitle (tester Artem 2026-07-13: "cCLOASTIQUEuQUESTt").
      const firstToggle = opts.findIndex(o => o.toggle);
      const gap = opts.length > 5 ? 18 : opts.length > 4 ? 20 : 24;
      const titleBottom = 90;
      const footerTop = H - 42;
      const block = (opts.length - 1) * gap;
      const startY = Math.round(Math.max(
        titleBottom,
        Math.min(footerTop - block, (titleBottom + footerTop - block) / 2),
      ));
      opts.forEach((o, i) => {
        const sel = i === menu.idx;
        const y = startY + i * gap;
        ctx.textAlign = "center";
        ctx.font = o.toggle ? "bold 8px monospace" : "bold 9px monospace";
        ctx.fillStyle = !o.ok ? "#4a4560" : sel ? "#ffb545" : o.toggle ? "#8f88ac" : "#c9c3de";
        ctx.fillText((sel ? "> " : "  ") + o.label + (sel ? " <" : "  "), W / 2, y);
        if (i === firstToggle && firstToggle > 0) {
          ctx.strokeStyle = "#3a3550";
          ctx.beginPath();
          ctx.moveTo(W / 2 - 46, y - gap + 5);
          ctx.lineTo(W / 2 + 46, y - gap + 5);
          ctx.stroke();
        }
      });
      const selOpt = opts[menu.idx];
      if (selOpt?.hint) {
        ctx.font = "7px monospace";
        ctx.fillStyle = selOpt.ok ? "#6f688c" : "#8a4a52";
        ctx.textAlign = "center";
        ctx.fillText(selOpt.hint, W / 2, H - 30);
      }
      ctx.font = "7px monospace";
      ctx.fillStyle = "#6f688c";
      ctx.fillText("↑↓ select · ENTER confirm" + (menu.step > 0 ? " · ← back" : ""), W / 2, H - 14);
      if (roomCode) ctx.fillText(`room ${roomCode}`, W / 2, H - 4);
      ctx.textAlign = "right";
      ctx.fillStyle = "#4a4560";
      ctx.fillText(`build ${BUILD}${rttMs >= 0 ? ` \u00b7 ${rttMs}ms` : ""}`, W - 3, H - 4);
      ctx.textAlign = "left";
      ctx.fillText(`playing as ${myName ? myName.toUpperCase() : "ILYA"}`, 3, H - 4);
      ctx.textAlign = "center";
      if (serverBuild && serverBuild !== BUILD) {
        ctx.fillStyle = "#e8384f";
        ctx.fillText("client/server build mismatch — hard-refresh (Ctrl+Shift+R)", W / 2, 30);
      }
      ctx.textAlign = "left";
    } else {
      centerText([["the host is choosing the quest setup...", 8, "#9a93b8"]], 120);
    }
  }
  if (copyBtn) {
    copyBtn.style.display = s.screen === "lobby" && mySlot === 0 ? "block" : "none";
  }
  if (s.screen === "lobby") {
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    centerText([
      ["AMBER COOP", 18, "#ffe9c2"],
      ["share this link with your partner:", 8, "#9a93b8"],
      [`${location.host}${location.pathname}?room=${roomCode}`, 8, "#4fb8d8"],
      [`you are ${names[mySlot]}`, 8, "#ffb545"],
    ], 90);
  } else if (s.screen === "title") {
    ctx.fillStyle = "rgba(10,8,20,0.82)";
    ctx.fillRect(0, 0, W, H);
    const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.4;
    centerText([
      ["ILYA", 24, "#ffe9c2"],
      ["and the AMBER BLADE — COOP", 10, "#ffb545"],
    ], 68);
    ctx.globalAlpha = pulse;
    centerText([["PRESS ENTER TO START", 8, "#ffffff"]], 132);
    ctx.globalAlpha = 1;
    centerText([
      [names[1] ? `P1: ${names[0]}   P2: ${names[1].slice(0, 22)}` : `solo quest: ${names[0]}`, 7, "#9a93b8"],
      ["move: WASD/arrows  sword: SPACE  bow: X  M: music", 7, "#9a93b8"],
      [names[1] ? "revive a fallen partner by standing close" : "no partner, no revives — tread carefully", 7, "#6f688c"],
      ["ESC: back to menu (host)", 7, "#4a4560"],
    ], 152);
  } else if (s.screen === "gameover") {
    ctx.fillStyle = "rgba(20,4,8,0.8)";
    ctx.fillRect(0, 0, W, H);
    centerText([
      ["GAME OVER", 20, "#e8384f"],
      ["press ENTER to try again", 8, "#ffffff"],
    ], 100);
    // mini scoreboard
    {
      const st = s.stats;
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      const fmt = (i: number): string =>
        `${names[i].slice(0, 22).padEnd(22)} dmg ${st[i].dmgDealt}  kills ${st[i].kills}  downs ${st[i].downs}  revives ${st[i].revives}`;
      ctx.fillStyle = "#9a93b8";
      ctx.fillText(fmt(0), W / 2, H - 34);
      if (names[1]) { ctx.fillText(fmt(1), W / 2, H - 24); }
      ctx.textAlign = "left";
    }

  } else if (s.screen === "win") {
    ctx.fillStyle = "rgba(6,14,24,0.85)";
    ctx.fillRect(0, 0, W, H);
    {
      const end = s.ending ?? {
        title: "THE LONG WINTER ENDS",
        lines: ["two heroes carried the Amber Blade north,",
                "and spring followed in their footsteps."],
      };
      const lines: [string, number, string][] = [[end.title, 13, "#dff5ff"]];
      for (const ln of end.lines) lines.push([ln, 8, "#9fc8e0"]);
      lines.push(["press ENTER to play again", 8, "#6f688c"]);
      centerText(lines, 96);
    }
    // mini scoreboard
    {
      const st = s.stats;
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      const fmt = (i: number): string =>
        `${names[i].slice(0, 22).padEnd(22)} dmg ${st[i].dmgDealt}  kills ${st[i].kills}  downs ${st[i].downs}  revives ${st[i].revives}`;
      ctx.fillStyle = "#9a93b8";
      ctx.fillText(fmt(0), W / 2, H - 34);
      if (names[1]) { ctx.fillText(fmt(1), W / 2, H - 24); }
      ctx.textAlign = "left";
    }

  }
}
requestAnimationFrame(render);

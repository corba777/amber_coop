/* =========================================================================
 *  AMBER COOP — HD-2D client (three.js)
 *  Same protocol, same simulation, different eyes: the flat rooms become a
 *  lit 3D diorama (walls, trees, translucent ice), while heroes and enemies
 *  stay pixel sprites, billboarded Octopath-style. HUD, menus, speech
 *  bubbles and name tags are drawn on a 2D overlay canvas projected from
 *  world space. Music and sfx are shared with the 2D client.
 * ========================================================================= */

import * as THREE from "three";
import {
  TILE, COLS, ROWS, W, H, PLAYER_W, PLAYER_H,
  Snapshot, Input, emptyInput, GameEvent, SOLID,
} from "../shared/core";
import { SPR, HEROES, TILES } from "./sprites";
import { wrapText } from "./textutil";
import { Pred, freshPred, stepPred, reconcile } from "./predict";
import { ensureAudio, playSfx, music, musicModeFor } from "./audio";
import { drawPartnerPip, partnerPipCanvasSize, partnerPipOrigin } from "./partnerpip";

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
  const submit = (): void => {
    const v = (input?.value ?? "").trim().slice(0, 12);
    if (v) {
      myName = v;
      try { localStorage.setItem("amber-name", v); } catch { /* fine */ }
    }
    if (gate) gate.style.display = "none";
    sendName();
  };
  if (gate && input && go) {
    // ALWAYS ask on load: returning players hit Enter on their prefilled
    // name; a guest on the same machine gets to introduce themselves
    input.value = myName;
    gate.style.display = "flex";
    setTimeout(() => { input.focus(); input.select(); }, 50);
    go.addEventListener("click", submit);
    input.addEventListener("keydown", ev => {
      ev.stopPropagation();
      if (ev.key === "Enter") submit();
    });
  }
}
ws.addEventListener("open", sendName);

let snap: Snapshot | null = null;
let prevSnap: Snapshot | null = null;
let snapTime = 0, snapInterval = 33;
let names: [string, string] = ["ILYA", "?"];

interface ProviderInfo { ok: boolean; label: string; hint: string; }
let providers: Record<string, ProviderInfo> = {};

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: number; }
const particles: Particle[] = [];

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
    sendName();
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
    for (const e of msg.s.events) handleEvent(e);
  } else if (msg.t === "full") {
    alert(msg.reason ?? "Server is full.");
  }
};

function handleEvent(e: GameEvent): void {
  if (e.t === "sfx") playSfx(e.name);
  else if (e.t === "burst") {
    const col = new THREE.Color(e.color).getHex();
    for (let i = 0; i < e.n; i++) {
      const a = (i / e.n) * Math.PI * 2 + Math.random() * 0.5;
      particles.push({
        x: e.x / TILE, y: 0.4 + Math.random() * 0.4, z: e.y / TILE,
        vx: Math.cos(a) * 0.05, vy: 0.04 + Math.random() * 0.05, vz: Math.sin(a) * 0.05,
        life: 22 + Math.random() * 10, color: col,
      });
    }
  }
}

// ------------------------------------------------------------------ input
const state: Input = emptyInput();
function sendInput(): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "input", s: state }));
}
const KEYMAP: Record<string, keyof Input | undefined> = {
  ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
  ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d",
  Space: "a", KeyJ: "a", KeyZ: "a", KeyX: "b", KeyK: "b",
  Enter: "st", KeyE: "st",
};

// ---------------------------------------------------------------- menu
type MenuStep = 0 | 1 | 2 | 3 | 4 | 5;
const menu = { step: 0 as MenuStep, idx: 0, hard: false, provider: 0, auto: false,
  travel: "linked" as "linked" | "free" };
const TEMPERAMENTS = ["guard", "companion", "hunter"] as const;
const PROVIDER_ORDER = ["ollama", "anthropic", "openai"] as const;

function menuOptions(): { label: string; ok: boolean; hint?: string }[] {
  if (menu.step === 0) return [
    { label: "CLASSIC QUEST", ok: true, hint: "the road you know — Emberdeep is optional" },
    { label: "LONG QUEST", ok: true, hint: "the glacier is sealed until Emberdeep falls" },
  ];
  if (menu.step === 1) return [
    { label: "SINGLE PLAYER", ok: true },
    { label: "MULTIPLAYER", ok: true },
    { label: "AI AUTOPILOT", ok: true, hint: "sit back — the AI quests, you watch its mind" },
  ];
  if (menu.step === 2) return [
    { label: "LINKED", ok: true, hint: "Four Swords — room changes move both heroes" },
    { label: "FREE ROAM", ok: true, hint: "split up — watch your partner through the scry mirror" },
  ];
  if (menu.step === 3) return [
    { label: "PARTNER: HUMAN", ok: true, hint: "you will get a link to share" },
    { label: "PARTNER: LLM", ok: true, hint: "models & keys come from .env" },
  ];
  if (menu.step === 5) return [
    { label: "BODYGUARD", ok: true, hint: "shields you — fights only what comes at YOU" },
    { label: "COMPANION", ok: true, hint: "balanced: joins fights near the party" },
    { label: "BERSERKER", ok: true, hint: "hunts everything that shares the room" },
  ];
  return PROVIDER_ORDER.map(k => {
    const p = providers[k];
    return p ? { label: p.label.toUpperCase(), ok: p.ok, hint: p.hint }
             : { label: k.toUpperCase(), ok: false, hint: "not configured" };
  });
}
function menuConfirm(): void {
  if (menu.step === 0) {
    menu.hard = menu.idx === 1;
    menu.step = 1; menu.idx = 0;
  } else if (menu.step === 1) {
    if (menu.idx === 0) {
      setUrlRoom(false);
      ws.send(JSON.stringify({ t: "setup", mode: "single", hardGate: menu.hard }));
    } else if (menu.idx === 2) {
      menu.auto = true;
      menu.step = 4; menu.idx = 0;   // straight to provider choice
    } else { menu.auto = false; menu.step = 2; menu.idx = 0; }
  } else if (menu.step === 2) {
    menu.travel = menu.idx === 0 ? "linked" : "free";
    menu.step = 3; menu.idx = 0;
  } else if (menu.step === 3) {
    if (menu.idx === 0) {
      setUrlRoom(true);   // only now is there something worth sharing
      ws.send(JSON.stringify({
        t: "setup", mode: "human", hardGate: menu.hard, travelMode: menu.travel,
      }));
    } else { menu.step = 4; menu.idx = 0; }
  } else if (menu.step === 4) {
    const opt = menuOptions()[menu.idx];
    if (!opt.ok) return;   // greyed out — no key in .env
    menu.provider = menu.idx;
    menu.step = 5; menu.idx = 1;   // companion preselected
  } else {
    setUrlRoom(false);
    ws.send(JSON.stringify({
      t: "setup", mode: menu.auto ? "auto" : "llm", provider: PROVIDER_ORDER[menu.provider],
      hardGate: menu.hard, temperament: TEMPERAMENTS[menu.idx], travelMode: menu.travel,
    }));
  }
}

function inviteLink(): string {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}
function setUrlRoom(on: boolean): void {
  // keep the canonical URL bare unless a coop seat is actually open —
  // otherwise browser autocomplete leaks stale ?room codes everywhere
  try {
    history.replaceState(null, "", on && roomCode
      ? `${location.pathname}?room=${roomCode}` : location.pathname);
  } catch { /* */ }
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
function menuKey(code: string): boolean {
  if (!snap || snap.screen !== "menu" || mySlot !== 0) return false;
  const opts = menuOptions();
  if (code === "ArrowUp" || code === "KeyW") { menu.idx = (menu.idx + opts.length - 1) % opts.length; return true; }
  if (code === "ArrowDown" || code === "KeyS") { menu.idx = (menu.idx + 1) % opts.length; return true; }
  if (code === "Enter" || code === "Space") { menuConfirm(); return true; }
  if (code === "Backspace" || code === "ArrowLeft") {
    if (menu.step > 0) { menu.step = (menu.step - 1) as MenuStep; menu.idx = 0; }
    return true;
  }
  return false;
}

window.addEventListener("keydown", ev => {
  if ((document.activeElement as HTMLElement | null)?.id === "namein") return;
  ensureAudio();
  if (menuKey(ev.code)) { ev.preventDefault(); return; }
  if (ev.code === "Escape" && mySlot === 0 && snap && snap.screen !== "menu") {
    menu.step = 0; menu.idx = 0;
    setUrlRoom(false);
    ws.send(JSON.stringify({ t: "tomenu" }));
    return;
  }
  if (ev.code === "KeyT") { showThought = !showThought; return; }
  if (ev.code === "KeyM") { music.muted = !music.muted; return; }
  const k = KEYMAP[ev.code];
  if (k) {
    (state[k] as boolean) = true;
    sendInput();
    // combat must FEEL instant at 150 ms ping: swing locally right now,
    // the server's verdict on damage arrives with the snapshot
    if (snap && snap.screen === "play") {
      const meL = snap.players[mySlot];
      if (meL && meL.present && !meL.downed) {
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
  const k = KEYMAP[ev.code];
  if (k) { (state[k] as boolean) = false; sendInput(); ev.preventDefault(); }
});
setInterval(sendInput, 100);

const touchUI = document.getElementById("touch");
if (touchUI && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
  touchUI.style.display = "flex";
  const bind = (id: string, key: keyof Input): void => {
    const el = document.getElementById(id)!;
    const on = (ev: Event): void => { ensureAudio(); (state[key] as boolean) = true; sendInput(); ev.preventDefault(); };
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

// ------------------------------------------------------------- three setup
const glCanvas = document.getElementById("gl") as HTMLCanvasElement;
const ui = document.getElementById("ui") as HTMLCanvasElement;
ui.width = W; ui.height = H;
const uictx = ui.getContext("2d")!;
uictx.imageSmoothingEnabled = false;
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
      pipOrigin.ox, pipOrigin.oy);
  } else {
    pipCanvas.style.display = "none";
  }
}

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function fitRenderer(): void {
  const rect = glCanvas.getBoundingClientRect();
  const cssW = Math.max(256, Math.round(rect.width || 768));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(cssW, Math.round(cssW * H / W), false);
}
window.addEventListener("resize", fitRenderer);
requestAnimationFrame(fitRenderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, W / H, 0.5, 120);
const CAM_LOOK = new THREE.Vector3(COLS / 2, 0.3, ROWS / 2);
const CAM_DIR = new THREE.Vector3(0, 1.15, 1).normalize();  // ~49° elevation
const CAM_BASE = new THREE.Vector3();
let CAM_DIST = 18;
{
  // fit: grow/shrink distance until every room corner (incl. wall tops)
  // projects inside NDC with a comfortable margin — no more cropped rooms
  const pts: [number, number, number][] = [
    [0, 0, 0], [COLS, 0, 0], [0, 0, ROWS], [COLS, 0, ROWS],
    [0, 1.6, 0], [COLS, 1.6, 0], [0, 1.6, ROWS], [COLS, 1.6, ROWS],
  ];
  let dist = CAM_DIST;
  for (let iter = 0; iter < 60; iter++) {
    camera.position.copy(CAM_LOOK).addScaledVector(CAM_DIR, dist);
    camera.lookAt(CAM_LOOK);
    camera.updateMatrixWorld(true);
    let m = 0;
    for (const [x, y, z] of pts) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
    }
    if (m > 0.93) dist *= 1.05;
    else if (m < 0.87) dist *= 0.975;
    else break;
  }
  CAM_DIST = dist;
  CAM_BASE.copy(camera.position);
}

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x35502e, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(COLS / 2 + 5, 11, ROWS / 2 + 4);
sun.target.position.set(COLS / 2, 0, ROWS / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.002;
scene.add(sun, sun.target);

// per-zone ambience: sky color, light levels, and whether the zone deserves
// fog at all. Overworld stays crystal clear; the vault halls sink into gloom
// creeping over the back rows; boss arenas get the thickest of it.
interface ZoneLook { sky: number; hemi: number; sun: number; fog: { near: number; far: number } | null; }
function zoneLook(room: number): ZoneLook {
  const midRoom = CAM_DIST + ROWS * 0.1;        // reaches into the back rows
  if (room === 5 || room === 11) {              // boss arenas: dense dread
    return { sky: room === 5 ? 0x0e0c18 : 0x121b2e, hemi: 0.45, sun: 0.8,
             fog: { near: midRoom - 2, far: midRoom + 13 } };
  }
  if (room >= 3 && room <= 4) {                 // old vault halls
    return { sky: 0x141220, hemi: 0.5, sun: 0.9,
             fog: { near: midRoom, far: midRoom + 16 } };
  }
  if (room >= 9) {                              // ice vault halls
    return { sky: 0x18243a, hemi: 0.55, sun: 1.0,
             fog: { near: midRoom, far: midRoom + 16 } };
  }
  if (room === 16) {                            // ember sanctum: molten dread
    return { sky: 0x1c0e08, hemi: 0.42, sun: 0.7,
             fog: { near: midRoom - 2, far: midRoom + 13 } };
  }
  if (room >= 14) {                             // emberdeep tunnels
    return { sky: 0x241209, hemi: 0.5, sun: 0.85,
             fog: { near: midRoom, far: midRoom + 16 } };
  }
  if (room === 12) {                            // old vault cellars
    return { sky: 0x141220, hemi: 0.5, sun: 0.9,
             fog: { near: midRoom, far: midRoom + 16 } };
  }
  if (room === 13) {                            // frozen crypt
    return { sky: 0x18243a, hemi: 0.55, sun: 1.0,
             fog: { near: midRoom, far: midRoom + 16 } };
  }
  if (room >= 6 && room <= 8) {                 // snow overworld: clear air
    return { sky: 0xdfe9f5, hemi: 1.0, sun: 1.4, fog: null };
  }
  return { sky: 0x87b4e8, hemi: 0.9, sun: 1.6, fog: null };   // meadow
}

// ---------------------------------------------------------- material cache
const texCache = new Map<string, THREE.CanvasTexture>();
function tileTex(ch: string): THREE.CanvasTexture {
  let t = texCache.get(ch);
  if (!t) {
    t = new THREE.CanvasTexture(TILES[ch] ?? TILES.g);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(ch, t);
  }
  return t;
}
function spriteTex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const waterTex = tileTex("w");
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
const matCache = new Map<string, THREE.Material>();
function flatMat(ch: string): THREE.Material {
  let m = matCache.get("f" + ch);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ map: tileTex(ch) });
    matCache.set("f" + ch, m);
  }
  return m;
}

// billboard helper: upright plane, leaned toward the camera by half its pitch
const LEAN = -Math.atan2(CAM_DIR.y, CAM_DIR.z) * 0.55;
interface Billboard { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; shadow: THREE.Mesh; }
const shadowGeo = new THREE.CircleGeometry(0.34, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
function makeBillboard(tex: THREE.Texture, wUnits: number, hUnits: number): Billboard {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wUnits, hUnits), mat);
  mesh.rotation.x = LEAN;
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  return { mesh, mat, shadow };
}

// hero textures: [palette][dirSet][frame]
const heroTex = HEROES.map(set => ({
  down: set.down.map(spriteTex),
  up: set.up.map(spriteTex),
  right: set.right.map(spriteTex),
}));
const enemyTex = {
  slime: SPR.slime.map(spriteTex),
  bat: SPR.bat.map(spriteTex),
  wisp: SPR.wisp.map(spriteTex),
  golem: [spriteTex(SPR.golem)],
  ember: [spriteTex(SPR.ember)],
  wraith: [spriteTex(SPR.wraith)],
  sentinel: SPR.sentinel.map(spriteTex),
  spitter: SPR.spitter.map(spriteTex),
};
const pickupTex = {
  heart: spriteTex(SPR.heart),
  key: spriteTex(SPR.key),
  bow: spriteTex(SPR.bow),
  elixir: spriteTex(SPR.elixir),
  charm: spriteTex(SPR.charm),
};

// ------------------------------------------------------------- room build
const roomGroup = new THREE.Group();
scene.add(roomGroup);
let builtRoomKey = "";

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const trunkGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.5, 6);
const coneGeo = new THREE.ConeGeometry(0.42, 0.9, 7);
const rockGeo = new THREE.DodecahedronGeometry(0.34);
const knobGeo = new THREE.SphereGeometry(0.05, 8, 8);

function floorCharFor(tiles: string[]): string {
  const count: Record<string, number> = {};
  for (const row of tiles) for (const ch of row) {
    if (!SOLID.has(ch)) count[ch] = (count[ch] ?? 0) + 1;
  }
  let best = "g", n = 0;
  for (const [ch, c] of Object.entries(count)) if (c > n) { n = c; best = ch; }
  return best;
}

function buildRoom(s: Snapshot): void {
  roomGroup.clear();
  const baseCh = floorCharFor(s.tiles);
  const look = zoneLook(s.room);
  scene.background = new THREE.Color(look.sky);
  scene.fog = look.fog ? new THREE.Fog(look.sky, look.fog.near, look.fog.far) : null;
  hemi.intensity = look.hemi;
  sun.intensity = look.sun;

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const ch = s.tiles[j].charAt(i);
      const x = i + 0.5, z = j + 0.5;

      // ground under everything
      const groundCh = SOLID.has(ch) || ch === "c" ? baseCh : ch;
      const g = new THREE.Mesh(planeGeo, flatMat(groundCh === "c" ? baseCh : groundCh));
      g.rotation.x = -Math.PI / 2;
      g.position.set(x, 0, z);
      g.receiveShadow = true;
      roomGroup.add(g);

      if (ch === "w") {                            // water: the long-lost lake
        const m = new THREE.Mesh(planeGeo, new THREE.MeshLambertMaterial({ map: waterTex }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.013, z);
        m.receiveShadow = true;
        roomGroup.add(m);
      } else if (ch === "v") {                     // lava: glowing pool
        const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: tileTex("v") }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.012, z);
        roomGroup.add(m);
        const glow = new THREE.PointLight(0xff7a3d, 1.6, 2.6);
        glow.position.set(x, 0.5, z);
        roomGroup.add(glow);
      } else if (ch === "W" || ch === "m" || ch === "k") {   // walls
        const m = new THREE.Mesh(boxGeo, flatMat(ch));
        m.position.set(x, 0.5, z);
        m.castShadow = true; m.receiveShadow = true;
        roomGroup.add(m);
      } else if (ch === "t" || ch === "d") {       // trees (green / snowy)
        const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5a3a26 }));
        trunk.position.set(x, 0.25, z);
        const crown = new THREE.Mesh(coneGeo, new THREE.MeshLambertMaterial({
          color: ch === "t" ? 0x2d5b23 : 0x4a7a6e,
        }));
        crown.position.set(x, 0.85, z);
        crown.castShadow = true;
        if (ch === "d") {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 7),
            new THREE.MeshLambertMaterial({ color: 0xeef4fb }));
          cap.position.set(x, 1.2, z);
          roomGroup.add(cap);
        }
        trunk.castShadow = true;
        roomGroup.add(trunk, crown);
      } else if (ch === "r") {                     // rocks
        const m = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x8d8da0 }));
        m.position.set(x, 0.26, z);
        m.rotation.set(0.4, i * 1.7, 0.2);
        m.castShadow = true;
        roomGroup.add(m);
      } else if (ch === "L") {                     // locked door
        const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
        m.position.set(x, 0.5, z);
        m.castShadow = true;
        const knob = new THREE.Mesh(knobGeo, new THREE.MeshBasicMaterial({ color: 0xffd257 }));
        knob.position.set(x, 0.55, z + 0.51);
        roomGroup.add(m, knob);
      } else if (ch === "I") {                     // ancient ice gate
        const m = new THREE.Mesh(boxGeo, new THREE.MeshPhysicalMaterial({
          color: 0x8fd4f2, transparent: true, opacity: 0.62, roughness: 0.15,
        }));
        m.position.set(x, 0.5, z);
        roomGroup.add(m);
      } else if (ch === "c") {                     // cave mouth
        const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x07060c }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.011, z);
        roomGroup.add(m);
      } else if (SOLID.has(ch)) {
        // safety net: a solid tile with no dedicated builder must still be
        // VISIBLE — render it as a textured block rather than losing it
        // into the floor (how the lake went missing)
        const m = new THREE.Mesh(boxGeo, flatMat(ch));
        m.position.set(x, 0.5, z);
        m.castShadow = true; m.receiveShadow = true;
        roomGroup.add(m);
      }
    }
  }

  // pedestal
  if (s.pedestal) {
    const px = s.pedestal.x / TILE + 0.5, pz = s.pedestal.y / TILE + 0.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x5c5c70 }));
    base.position.set(px, 0.25, pz);
    base.castShadow = true;
    const relicMat = new THREE.MeshBasicMaterial({
      color: s.pedestal.final ? 0xbfe9ff : 0xffb545,
    });
    const relic = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), relicMat);
    relic.name = "relic";
    relic.position.set(px, 0.95, pz);
    const glow = new THREE.PointLight(s.pedestal.final ? 0xbfe9ff : 0xffb545, 6, 5);
    glow.position.set(px, 1.1, pz);
    roomGroup.add(base, relic, glow);
  }
}

// ------------------------------------------------------------- entity pool
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
const toWX = (px: number): number => (px + PLAYER_W / 2) / TILE;
const toWZ = (py: number): number => (py + PLAYER_H / 2) / TILE;

const heroBB: Billboard[] = [];
const swordMeshes: THREE.Mesh[] = [];
const reviveRings: THREE.Mesh[] = [];
for (let i = 0; i < 2; i++) {
  const bb = makeBillboard(heroTex[i].down[0], 1.15, 1.15);
  bb.mesh.visible = false; bb.shadow.visible = false;
  scene.add(bb.mesh, bb.shadow);
  heroBB.push(bb);
  // pivot at the hilt: the blade extends outward and sweeps around the hero
  const bladeGeo = new THREE.BoxGeometry(0.05, 0.16, 0.62);
  bladeGeo.translate(0, 0, 0.55);
  const blade = new THREE.Mesh(bladeGeo, new THREE.MeshBasicMaterial({ color: 0xdfe3ee }));
  const guardGeo = new THREE.BoxGeometry(0.24, 0.06, 0.06);
  guardGeo.translate(0, 0, 0.24);
  const guard = new THREE.Mesh(guardGeo, new THREE.MeshBasicMaterial({ color: 0x8a6238 }));
  const sw = new THREE.Mesh();       // group root at the hero's hand
  sw.add(blade, guard);
  sw.visible = false;
  scene.add(sw);
  swordMeshes.push(sw);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x9be07a, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  reviveRings.push(ring);
}

const enemyBB: Billboard[] = [];
function ensureEnemyPool(n: number): void {
  while (enemyBB.length < n) {
    const bb = makeBillboard(enemyTex.slime[0], 1.1, 1.1);
    bb.mesh.visible = false; bb.shadow.visible = false;
    scene.add(bb.mesh, bb.shadow);
    enemyBB.push(bb);
  }
}
const pickupBB: Billboard[] = [];
function ensurePickupPool(n: number): void {
  while (pickupBB.length < n) {
    const bb = makeBillboard(pickupTex.heart, 0.8, 0.8);
    bb.mesh.visible = false; bb.shadow.visible = false;
    scene.add(bb.mesh, bb.shadow);
    pickupBB.push(bb);
  }
}

// the spared wraith, drifting with the party
const compBB = makeBillboard(enemyTex.wraith[0], 1.4, 1.4);
compBB.mat.color.set(0xbfe9ff);
compBB.mat.opacity = 0.78;
compBB.mesh.visible = compBB.shadow.visible = false;
scene.add(compBB.mesh, compBB.shadow);

// projectiles: arrows + shards
const arrowPool: THREE.Mesh[] = [];
const shardPool: THREE.Mesh[] = [];
for (let i = 0; i < 16; i++) {
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xc7ad78 }));
  a.visible = false; scene.add(a); arrowPool.push(a);
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  s.visible = false; scene.add(s); shardPool.push(s);
}

// particles
const MAXP = 200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3);
const pCol = new Float32Array(MAXP * 3);
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.95 });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);

// -------------------------------------------------------------- overlay UI
function project(x: number, y: number, z: number): [number, number] {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
}
function centerText(lines: [string, number, string][], baseY: number): void {
  uictx.textAlign = "center";
  for (const [txt, size, color] of lines) {
    uictx.font = `bold ${size}px monospace`;
    uictx.fillStyle = color;
    uictx.fillText(txt, W / 2, baseY);
    baseY += size + 8;
  }
  uictx.textAlign = "left";
}

function drawHud(s: Snapshot): void {
  const me = s.players[mySlot];
  if (!me.present) {
    uictx.font = "7px monospace";
    uictx.fillStyle = "#ffb545";
    uictx.fillText(`SPECTATING \u00b7 ${names[1]} quests alone`, 4, 12);
  }
  for (let i = 0; i < me.maxHp / 2; i++) {
    const full = me.hp >= (i + 1) * 2;
    const half = !full && me.hp === i * 2 + 1;
    uictx.globalAlpha = full ? 1 : 0.25;
    uictx.drawImage(SPR.heart, 4 + i * 13, 2, 12, 12);
    if (half) {
      uictx.globalAlpha = 1;
      uictx.save();
      uictx.beginPath(); uictx.rect(4 + i * 13, 2, 6, 12); uictx.clip();
      uictx.drawImage(SPR.heart, 4 + i * 13, 2, 12, 12);
      uictx.restore();
    }
  }
  uictx.globalAlpha = 1;
  const mate = s.players[1 - mySlot];
  if (mate.present) {
    uictx.font = "7px monospace";
    uictx.fillStyle = "#c9c3de";
    uictx.fillText(names[1 - mySlot].slice(0, 14), 4, 22);
    for (let i = 0; i < mate.maxHp / 2; i++) {
      uictx.globalAlpha = mate.hp >= (i + 1) * 2 ? 1 : mate.hp === i * 2 + 1 ? 0.6 : 0.2;
      uictx.drawImage(SPR.heart, 4 + i * 8, 27, 7, 7);
    }
    uictx.globalAlpha = 1;
  }
  const keys = s.players[0].keys + s.players[1].keys;
  for (let i = 0; i < keys; i++) uictx.drawImage(SPR.key, W - 18 - i * 12, 1, 14, 14);
  if (s.hasBow) uictx.drawImage(SPR.bow, W - 18 - keys * 12 - 14, 1, 14, 14);
  if (s.players[mySlot].elixir) {
    uictx.drawImage(SPR.elixir, W - 18 - keys * 12 - (s.hasBow ? 28 : 14), 1, 14, 14);
  }
  const boss = s.enemies.find(e => (e.kind === "golem" || e.kind === "wraith" || e.kind === "ember") && !e.dead);
  if (boss) {
    uictx.fillStyle = "rgba(0,0,0,0.5)";
    uictx.fillRect(48, H - 12, 160, 7);
    uictx.fillStyle = boss.kind === "wraith" ? "#9fe8ff" : boss.kind === "ember" ? "#ff7a3d" : "#e8384f";
    uictx.fillRect(49, H - 11, 158 * (boss.hp / boss.maxHp), 5);
  }
  if (rttMs >= 0 && s.screen === "play") {
    uictx.font = "7px monospace";
    const rl = `${rttMs}ms`;
    const rw = uictx.measureText(rl).width;
    uictx.fillStyle = "rgba(8,6,16,0.72)";
    uictx.fillRect(W - rw - 8, 1, rw + 6, 11);
    uictx.fillStyle = rttMs < 60 ? "#78c88c" : rttMs < 120 ? "#ffb545" : "#e8384f";
    uictx.textAlign = "right";
    uictx.fillText(rl, W - 5, 9);
    uictx.textAlign = "left";
  }
  if (s.thought && showThought && s.screen === "play") {
    uictx.font = "7px monospace";
    const line = `AI: ${s.thought.action}${s.thought.why ? " \u2014 " + s.thought.why : ""}`.slice(0, 58);
    const tw = uictx.measureText(line).width;
    uictx.fillStyle = "rgba(8,6,16,0.72)";
    uictx.fillRect(2, H - 13, tw + 6, 11);
    uictx.fillStyle = "#9fc8e0";
    uictx.fillText(line, 5, H - 5);
  }
  if (s.messageT > 0 && s.message) {
    uictx.globalAlpha = Math.min(1, s.messageT / 30);
    uictx.font = "8px monospace";
    const lines = wrapText(uictx, s.message, W - 28);
    const tw = Math.max(...lines.map(ln => uictx.measureText(ln).width)) + 12;
    const th = lines.length * 10 + 5;
    uictx.fillStyle = "rgba(0,0,0,0.55)";
    uictx.fillRect(W / 2 - tw / 2, 18, tw, th);
    uictx.fillStyle = "#ffe9c2";
    uictx.textAlign = "center";
    lines.forEach((ln, i) => uictx.fillText(ln, W / 2, 27 + i * 10));
    uictx.textAlign = "left";
    uictx.globalAlpha = 1;
  }
}

function drawScreens(s: Snapshot): void {
  if (s.screen === "menu") {
    uictx.fillStyle = "rgba(10,8,20,0.88)";
    uictx.fillRect(0, 0, W, H);
    centerText([
      ["AMBER COOP · HD-2D", 16, "#ffe9c2"],
      [menu.step === 0 ? "choose the length of your quest" :
       menu.step === 1 ? "choose your party" :
       menu.step === 2 ? "choose how you travel" :
       menu.step === 3 ? "choose your partner" :
       menu.step === 4 ? "choose your AI" : "choose their temperament", 8, "#9a93b8"],
    ], 48);
    if (mySlot === 0) {
      const opts = menuOptions();
      let y = 104;
      opts.forEach((o, i) => {
        const sel = i === menu.idx;
        uictx.textAlign = "center";
        uictx.font = "bold 9px monospace";
        uictx.fillStyle = !o.ok ? "#4a4560" : sel ? "#ffb545" : "#c9c3de";
        uictx.fillText((sel ? "> " : "  ") + o.label + (sel ? " <" : "  "), W / 2, y);
        if (sel && o.hint) {
          uictx.font = "7px monospace";
          uictx.fillStyle = o.ok ? "#6f688c" : "#8a4a52";
          uictx.fillText(o.hint, W / 2, y + 11);
        }
        y += 26;
      });
      uictx.font = "7px monospace";
      uictx.fillStyle = "#6f688c";
      uictx.fillText("↑↓ select · ENTER confirm" + (menu.step > 0 ? " · ← back" : ""), W / 2, H - 14);
      if (roomCode) uictx.fillText(`room ${roomCode}`, W / 2, H - 4);
      uictx.textAlign = "right";
      uictx.fillStyle = "#4a4560";
      uictx.fillText(`build ${BUILD}${rttMs >= 0 ? ` \u00b7 ${rttMs}ms` : ""}`, W - 3, H - 4);
      uictx.textAlign = "left";
      uictx.fillText(`playing as ${myName ? myName.toUpperCase() : "ILYA"}`, 3, H - 4);
      uictx.textAlign = "center";
      if (serverBuild && serverBuild !== BUILD) {
        uictx.fillStyle = "#e8384f";
        uictx.fillText("client/server build mismatch — hard-refresh (Ctrl+Shift+R)", W / 2, 30);
      }
      uictx.textAlign = "left";
    } else {
      centerText([["the host is choosing the quest setup...", 8, "#9a93b8"]], 120);
    }
  }
  if (copyBtn) {
    copyBtn.style.display = s.screen === "lobby" && mySlot === 0 ? "block" : "none";
  }
  if (s.screen === "lobby") {
    uictx.fillStyle = "rgba(10,8,20,0.85)";
    uictx.fillRect(0, 0, W, H);
    centerText([
      ["AMBER COOP", 18, "#ffe9c2"],
      ["share this link with your partner:", 8, "#9a93b8"],
      [`${location.host}${location.pathname}?room=${roomCode}`, 8, "#4fb8d8"],
      [`you are ${names[mySlot]}`, 8, "#ffb545"],
    ], 90);
  } else if (s.screen === "title") {
    uictx.fillStyle = "rgba(10,8,20,0.68)";
    uictx.fillRect(0, 0, W, H);
    const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.4;
    centerText([
      ["ILYA", 24, "#ffe9c2"],
      ["and the AMBER BLADE — HD-2D", 10, "#ffb545"],
    ], 68);
    uictx.globalAlpha = pulse;
    centerText([["PRESS ENTER TO START", 8, "#ffffff"]], 132);
    uictx.globalAlpha = 1;
    centerText([
      [names[1] ? `P1: ${names[0]}   P2: ${names[1].slice(0, 22)}` : `solo quest: ${names[0]}`, 7, "#c9c3de"],
      ["move: WASD/arrows  sword: SPACE  bow: X  M: music", 7, "#c9c3de"],
      ["ESC: back to menu (host)", 7, "#6f688c"],
    ], 152);
  } else if (s.screen === "gameover") {
    uictx.fillStyle = "rgba(20,4,8,0.8)";
    uictx.fillRect(0, 0, W, H);
    centerText([
      ["GAME OVER", 20, "#e8384f"],
      ["press ENTER to try again", 8, "#ffffff"],
    ], 100);
    // mini scoreboard
    {
      const st = s.stats;
      uictx.font = "7px monospace";
      uictx.textAlign = "center";
      const fmt = (i: number): string =>
        `${names[i].slice(0, 22).padEnd(22)} dmg ${st[i].dmgDealt}  kills ${st[i].kills}  downs ${st[i].downs}  revives ${st[i].revives}`;
      uictx.fillStyle = "#9a93b8";
      uictx.fillText(fmt(0), W / 2, H - 34);
      if (names[1]) { uictx.fillText(fmt(1), W / 2, H - 24); }
      uictx.textAlign = "left";
    }

  } else if (s.screen === "win") {
    uictx.fillStyle = "rgba(6,14,24,0.85)";
    uictx.fillRect(0, 0, W, H);
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
      uictx.font = "7px monospace";
      uictx.textAlign = "center";
      const fmt = (i: number): string =>
        `${names[i].slice(0, 22).padEnd(22)} dmg ${st[i].dmgDealt}  kills ${st[i].kills}  downs ${st[i].downs}  revives ${st[i].revives}`;
      uictx.fillStyle = "#9a93b8";
      uictx.fillText(fmt(0), W / 2, H - 34);
      if (names[1]) { uictx.fillText(fmt(1), W / 2, H - 24); }
      uictx.textAlign = "left";
    }

  }
}

// ----------------------------------------------------------------- render
const SWING_BASE: number[] = [Math.PI / 2, -Math.PI / 2, 0, Math.PI]; // down/up/right/left

function render(): void {
  requestAnimationFrame(render);
  uictx.clearRect(0, 0, W, H);
  if (!snap) {
    uictx.fillStyle = "#0d0c14"; uictx.fillRect(0, 0, W, H);
    centerText([["CONNECTING...", 12, "#9a93b8"]], 110);
    renderer.render(scene, camera);
    return;
  }
  const s = snap;
  music.mode = musicModeFor(s);

  const roomKey = s.room + "|" + s.tiles.join("");
  if (roomKey !== builtRoomKey) { buildRoom(s); builtRoomKey = roomKey; }

  const alpha = Math.min(1, (performance.now() - snapTime) / snapInterval);
  const pv = prevSnap && prevSnap.room === s.room ? prevSnap : null;
  const now = Date.now();

  // camera: gentle idle sway + shake
  camera.position.set(
    CAM_BASE.x + Math.sin(now * 0.0003) * 0.15 + (s.shake > 0 ? (Math.random() - 0.5) * 0.25 : 0),
    CAM_BASE.y + (s.shake > 0 ? (Math.random() - 0.5) * 0.2 : 0),
    CAM_BASE.z + Math.cos(now * 0.00023) * 0.12,
  );
  camera.lookAt(CAM_LOOK);

  // water drift
  waterTex.offset.set(Math.sin(now * 0.0006) * 0.06, (now * 0.00004) % 1);

  // relic bobbing
  const relic = roomGroup.getObjectByName("relic");
  if (relic) relic.position.y = 0.95 + Math.sin(now * 0.004) * 0.08;

  // heroes
  s.players.forEach((p, i) => {
    const bb = heroBB[i], sw = swordMeshes[i], ring = reviveRings[i];
    if (!p.present) { bb.mesh.visible = bb.shadow.visible = sw.visible = ring.visible = false; return; }
    const ox = pv?.players[i]?.x ?? p.x, oy = pv?.players[i]?.y ?? p.y;
    let gx = lerp(ox, p.x, alpha), gy = lerp(oy, p.y, alpha);
    let showDir = p.dir, showAttack = p.attack;
    if (i === mySlot && pred.live && !p.downed) {
      gx = pred.x; gy = pred.y;   // your hero answers to YOUR keys, instantly
      const ddx = (state.r ? 1 : 0) - (state.l ? 1 : 0);
      const ddy = (state.d ? 1 : 0) - (state.u ? 1 : 0);
      if (ddy > 0) showDir = 0; else if (ddy < 0) showDir = 1;
      if (ddx > 0) showDir = 2; else if (ddx < 0) showDir = 3;
      showAttack = Math.max(p.attack, localAttack);
    }
    const wx = toWX(gx), wz = toWZ(gy);
    bb.mesh.visible = !(p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) || p.downed;
    bb.shadow.visible = true;
    const frame = p.moving ? Math.floor(p.walk) % 2 : 0;
    const set = heroTex[i];
    const tex = showDir === 1 ? set.up[frame] : showDir === 0 ? set.down[frame] : set.right[frame];
    bb.mat.map = tex;
    bb.mesh.scale.x = showDir === 3 ? -1 : 1;
    bb.mesh.position.set(wx, 0.62, wz);
    bb.mesh.rotation.z = 0;
    bb.mesh.rotation.x = LEAN;
    if (p.downed) {
      bb.mesh.rotation.z = Math.PI / 2;
      bb.mesh.position.y = 0.3;
      bb.mat.opacity = 0.8;
    } else {
      bb.mat.opacity = 1;
    }
    bb.shadow.position.set(wx, 0.02, wz);
    // revive ring
    if (p.downed && p.reviveP > 0) {
      ring.visible = true;
      ring.position.set(wx, 0.05, wz);
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(0.5, 0.62, 24, 1, -Math.PI / 2, (p.reviveP / 90) * Math.PI * 2);
    } else ring.visible = false;
    // sword
    if (showAttack > 0 && !p.downed) {
      const t = 1 - showAttack / 16;
      const ang = SWING_BASE[showDir] + (t - 0.5) * 1.9 * (showDir === 3 || showDir === 1 ? -1 : 1);
      sw.visible = true;
      const blade = sw.children[0] as THREE.Mesh;
      (blade.material as THREE.MeshBasicMaterial).color.set(s.amberClaimed ? 0xffb545 : 0xf2f4fa);
      sw.position.set(wx, 0.5, wz);           // pivot rides the hero's hand
      sw.rotation.y = Math.PI / 2 - ang;      // +Z blade → (cos a, 0, sin a)
      sw.rotation.x = -0.12;                  // slight upward slash plane
    } else sw.visible = false;
  });

  // enemies
  ensureEnemyPool(s.enemies.length);
  enemyBB.forEach((bb, i) => {
    const e = s.enemies[i];
    if (!e || e.dead) { bb.mesh.visible = bb.shadow.visible = false; return; }
    const ox = pv?.enemies[i]?.x ?? e.x, oy = pv?.enemies[i]?.y ?? e.y;
    const big = e.kind === "golem" || e.kind === "wraith" || e.kind === "ember";
    const wx = (lerp(ox, e.x, alpha) + (big ? 14 : 6)) / TILE;
    const wz = (lerp(oy, e.y, alpha) + (big ? 14 : 6)) / TILE;
    bb.mesh.visible = !(e.hurt > 0 && Math.floor(e.hurt / 3) % 2 === 0);
    bb.shadow.visible = true;
    const texArr = enemyTex[e.kind];
    const frame = texArr.length > 1
      ? (e.kind === "slime" ? (e.phase === 1 ? 1 : Math.floor(e.t / 30) % 2)
        : e.kind === "bat" ? Math.floor(e.t / 8) % 2
        : e.kind === "wisp" ? Math.floor(e.t / 14) % 2 : 0)
      : 0;
    bb.mat.map = texArr[frame];
    const size = big ? 2.0 : 0.95;
    bb.mesh.scale.set(size, size, 1);
    bb.shadow.scale.setScalar(big ? 1.7 : 0.9);
    const hover = e.kind === "bat" || e.kind === "wisp" || e.kind === "wraith"
      ? 0.25 + Math.sin(now * 0.005 + i) * 0.08 : 0;
    bb.mesh.position.set(wx, size * 0.52 + hover, wz);
    bb.shadow.position.set(wx, 0.02, wz);
    // golem stun glow / wraith aura via emissive-ish color tint
    if (e.kind === "sentinel" && e.stagger > 0) {
      bb.mat.color.set(0xfff0b8);   // reeling: shield down, shoot now
      bb.mat.opacity = 1;
    } else if (e.kind === "wraith" && e.phase === 9) {
      bb.mat.color.set(0xdff5ff);
      bb.mat.opacity = 0.7;
    } else {
      bb.mat.opacity = 1;
      bb.mat.color.set(
        (e.kind === "golem" || e.kind === "ember") && e.phase === 3 ? 0xffd898 :
        e.hurt > 0 ? 0xff9a9a : 0xffffff);
    }
  });

  // pickups
  ensurePickupPool(s.pickups.length);
  pickupBB.forEach((bb, i) => {
    const it = s.pickups[i];
    if (!it) { bb.mesh.visible = bb.shadow.visible = false; return; }
    bb.mesh.visible = bb.shadow.visible = true;
    bb.mat.map =
      it.kind === "key" ? pickupTex.key :
      it.kind === "bow" ? pickupTex.bow :
      it.kind === "elixir" ? pickupTex.elixir :
      it.kind === "charm" ? pickupTex.charm : pickupTex.heart;
    const sc = it.kind === "container" ? 1.15 : 0.7;
    bb.mesh.scale.set(sc, sc, 1);
    bb.shadow.scale.setScalar(0.5);
    const bob = Math.sin(now * 0.004 + it.x) * 0.08;
    bb.mesh.position.set(it.x / TILE, 0.5 + bob, it.y / TILE);
    bb.shadow.position.set(it.x / TILE, 0.02, it.y / TILE);
  });

  if (s.companion) {
    compBB.mesh.visible = compBB.shadow.visible = true;
    const cw = (s.companion.x + 11) / TILE, cz = (s.companion.y + 11) / TILE;
    compBB.mesh.position.set(cw, 0.95 + Math.sin(now * 0.004) * 0.1, cz);
    compBB.shadow.position.set(cw, 0.02, cz);
    compBB.shadow.scale.setScalar(0.9);
  } else {
    compBB.mesh.visible = compBB.shadow.visible = false;
  }

  // projectiles
  let ai = 0, si = 0;
  for (const pr of s.projectiles) {
    if (pr.friendly && ai < arrowPool.length) {
      const m = arrowPool[ai++];
      (m.material as THREE.MeshBasicMaterial).color.set(s.charm ? 0xff7a3d : 0xc7ad78);
      m.visible = true;
      m.position.set(pr.x / TILE, 0.5, pr.y / TILE);
      m.rotation.y = -Math.atan2(pr.vy, pr.vx);
    } else if (!pr.friendly && si < shardPool.length) {
      const m = shardPool[si++];
      m.visible = true;
      m.position.set(pr.x / TILE, 0.5, pr.y / TILE);
      m.rotation.y = now * 0.01;
      m.rotation.x = now * 0.007;
    }
  }
  for (; ai < arrowPool.length; ai++) arrowPool[ai].visible = false;
  for (; si < shardPool.length; si++) shardPool[si].visible = false;

  // particles
  let live = 0;
  const col = new THREE.Color();
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.x += q.vx; q.y += q.vy; q.z += q.vz;
    q.vy -= 0.004; q.vx *= 0.93; q.vz *= 0.93;
    q.life--;
    if (q.life <= 0 || q.y < 0) { particles.splice(i, 1); continue; }
    if (live < MAXP) {
      pPos[live * 3] = q.x; pPos[live * 3 + 1] = q.y; pPos[live * 3 + 2] = q.z;
      col.setHex(q.color);
      pCol[live * 3] = col.r; pCol[live * 3 + 1] = col.g; pCol[live * 3 + 2] = col.b;
      live++;
    }
  }
  pGeo.setDrawRange(0, live);
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);

  // ---- overlay: speech bubbles, name tags, HUD, screens, fade ----
  if (s.screen === "play" || s.screen === "gameover" || s.screen === "win") {
    s.players.forEach((p, i) => {
      if (!p.present) return;
      const wx = toWX(p.x), wz = toWZ(p.y);
      if (!p.downed && names[i]) {
        const [sx, sy] = project(wx, 1.35, wz);
        uictx.font = "6px monospace";
        uictx.fillStyle = i === mySlot ? "rgba(255,229,178,0.6)" : "rgba(255,255,255,0.75)";
        uictx.textAlign = "center";
        uictx.fillText(names[i].slice(0, 12), sx, sy);
        uictx.textAlign = "left";
      }
      if (p.sayT > 0 && p.say) {
        const [sx, sy] = project(wx, 1.7, wz);
        uictx.font = "7px monospace";
        const tw = uictx.measureText(p.say).width + 8;
        const bx = Math.max(2, Math.min(W - tw - 2, sx - tw / 2));
        const by = Math.max(2, sy - 10);
        uictx.globalAlpha = Math.min(1, p.sayT / 20);
        uictx.fillStyle = "rgba(255,255,255,0.92)";
        uictx.fillRect(bx, by, tw, 11);
        uictx.fillStyle = "#1b1b2b";
        uictx.fillText(p.say, bx + 4, by + 8);
        uictx.globalAlpha = 1;
      }
    });
    drawHud(s);
  }
  drawPartnerMirror(s);
  if (s.fade > 0) {
    uictx.fillStyle = `rgba(0,0,0,${s.fade})`;
    uictx.fillRect(0, 0, W, H);
  }
  drawScreens(s);
}
requestAnimationFrame(render);

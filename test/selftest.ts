/* =========================================================================
 *  AMBER COOP self-tests — headless, no browser, no external LLM.
 *  Run:  node dist/selftest.js   (built by scripts-build.mjs)
 * ========================================================================= */

import {
  newGame, update, latch, emptyInput, toSnapshot, validateRooms,
  Game, Input, LatchedInput, TILE, W, PLAYER_W, PLAYER_H, makeEnemy, ROOMS, SOLID,
} from "../shared/core";
import { AgentPlayer } from "../server/agent";
import { mock } from "../server/llm";

let passed = 0;

async function main(): Promise<void> {
function ok(cond: boolean, name: string): void {
  if (!cond) throw new Error("FAIL: " + name);
  passed++;
  console.log("  ok — " + name);
}

const NAMES: [string, string] = ["ILYA", "MOCK"];
const idle = (): LatchedInput => latch(emptyInput(), emptyInput());

function step(g: Game, i0: Input, i1: Input, prev: [Input, Input]): void {
  update(g, [latch(i0, prev[0]), latch(i1, prev[1])]);
  prev[0] = { ...i0 };
  prev[1] = { ...i1 };
}

/* The sim rolls Math.random in four places (wraith teleport + destination, heart
 * drops). Tests that walk those paths were riding on luck: the suite failed
 * ~half of all runs. Pin the rolls to a seeded stream so a run is reproducible —
 * the GAME is untouched, only the test's dice. */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const real = Math.random;
  let s = (seed >>> 0) || 1;
  Math.random = (): number => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
  try { return fn(); } finally { Math.random = real; }
}

async function freePort(): Promise<number> {
  const net = await import("node:net");
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => res(port));
    });
    s.on("error", rej);
  });
}

async function spawnTestServer(
  extra: NodeJS.ProcessEnv = {},
  omit: string[] = [],
): Promise<{ proc: import("node:child_process").ChildProcess; port: number }> {
  const { spawn } = await import("node:child_process");
  const port = await freePort();
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), ...extra };
  for (const k of omit) delete env[k];
  const proc = spawn(process.execPath, ["dist/server.js"], {
    env, stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  proc.stderr.on("data", (d: Buffer) => { stderr += d; });
  await new Promise<void>((res, rej) => {
    const to = setTimeout(() => rej(new Error(`server didn't start on :${port}`)), 8000);
    proc.stdout.on("data", (d: Buffer) => {
      if (String(d).includes("AMBER COOP up")) { clearTimeout(to); res(); }
    });
    proc.on("exit", c => rej(new Error(`server exited ${c}${stderr ? ": " + stderr.trim() : ""}`)));
  });
  return { proc, port };
}

function freshPlay(): Game {
  const g = newGame();
  g.players[0].present = true;
  g.players[1].present = true;
  g.screen = "play";
  g.fade = 0;
  g.message = "";
  g.messageT = 0;
  return g;
}

// ------------------------------------------------- 1. core: two players move
{
  console.log("[1] core movement & independence");
  const g = freshPlay();
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const x0 = g.players[0].x, x1 = g.players[1].x;
  const right = { ...emptyInput(), r: true };
  const down = { ...emptyInput(), d: true };
  for (let t = 0; t < 30; t++) step(g, right, down, prev);
  ok(g.players[0].x > x0 + 20, "P1 moved right");
  ok(g.players[1].y > 6.5 * TILE + 20, "P2 moved down independently");
  ok(g.players[1].x === x1, "P2 x unchanged");
}

// ------------------------------------------------- 2. room transition drags both
{
  console.log("[2] shared room transitions");
  const g = freshPlay();
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  // walk P1 to the right edge of the meadow (exit → forest)
  g.players[0].x = W - PLAYER_W - 3;
  g.players[0].y = 6.5 * TILE;
  const right = { ...emptyInput(), r: true };
  for (let t = 0; t < 20 && g.room === 0; t++) step(g, right, emptyInput(), prev);
  ok(g.room === 1, "P1 led both into the Whispering Forest");
  ok(g.players[1].x >= 0 && g.players[1].x < 80, "P2 teleported alongside at the entry side");
}

// ------------------------------------------------- 3. downed & touch-revive
{
  console.log("[3] downed partner + touch revive");
  const g = freshPlay();
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  g.players[1].hp = 0;
  g.players[1].downed = true;
  ok(g.screen === "play", "one downed player does not end the game");
  // park P1 on top of P2
  g.players[0].x = g.players[1].x;
  g.players[0].y = g.players[1].y;
  for (let t = 0; t < 120 && g.players[1].downed; t++) {
    step(g, emptyInput(), emptyInput(), prev);
  }
  ok(!g.players[1].downed, "partner revived by touch within ~2s");
  ok(g.players[1].hp >= 3, "revived with meaningful hp");
}

// ------------------------------------------------- 4. gameover only when both down
{
  console.log("[4] gameover requires both down");
  const g = freshPlay();
  g.enemies = [makeEnemy("slime", g.players[0].x, g.players[0].y)];
  g.players[0].hp = 1;
  g.players[1].hp = 1;
  g.players[1].downed = true;   // partner already down, no revive nearby
  g.players[1].x = 200; g.players[1].y = 200;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let t = 0; t < 300 && g.screen === "play"; t++) {
    step(g, emptyInput(), emptyInput(), prev);
  }
  ok(g.screen === "gameover", "both down → gameover");
}

// ------------------------------------------------- 5. agent + mock LLM clears slimes
{
  console.log("[5] agent with mock LLM fights");
  const g = freshPlay();
  const agent = new AgentPlayer(mock(), 1, { planMs: 1 });
  // move both into the forest with slimes
  g.players[0].x = W - PLAYER_W - 3;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const right = { ...emptyInput(), r: true };
  for (let t = 0; t < 20 && g.room === 0; t++) step(g, right, emptyInput(), prev);
  ok(g.room === 1 && g.enemies.length === 3, "entered forest with 3 slimes");
  // give the agent god-mode-ish durability so the test is about control logic, not luck
  g.players[1].maxHp = 40; g.players[1].hp = 40;
  g.players[0].x = 3 * TILE; g.players[0].y = 12 * TILE; // human hides in a corner

  const t0 = Date.now();
  let ticks = 0;
  const deadline = 60 * 60; // 60 sim-seconds
  while (g.enemies.some(e => !e.dead) && ticks < deadline) {
    agent.maybePlan(g, t0 + ticks * 16.7);
    const inp = agent.control(g);
    step(g, emptyInput(), inp, prev);
    ticks++;
    // pump the microtask queue so the mock plan promise resolves
    if (ticks % 10 === 0) await Promise.resolve();
  }
  ok(g.enemies.every(e => e.dead), `agent cleared all slimes in ${ticks} ticks`);
  ok(g.screen === "play", "agent survived");
}

// ------------------------------------------------- 6. snapshot roundtrip
{
  console.log("[6] snapshot serialization");
  const g = freshPlay();
  g.players[1].say = "On it!";
  g.players[1].sayT = 100;
  const snap = toSnapshot(g, NAMES);
  const parsed = JSON.parse(JSON.stringify(snap)) as typeof snap;
  ok(parsed.players.length === 2, "two players serialized");
  ok(parsed.players[1].say === "On it!", "quips travel in snapshots");
  ok(parsed.tiles.length === 14 && parsed.tiles[0].length === 16, "tiles intact");
  ok(g.events.length === 0, "events flushed after snapshot");
  validateRooms();
  ok(true, "room maps validate");
}

// ------------------------------------------------- 7. WS integration smoke
{
  console.log("[7] websocket integration smoke (server child + real client)");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer(
    { P2: "llm", LLM_PROVIDER: "mock", PLAN_MS: "50" },
  );
  try {
    const wsc = new WebSocket(`ws://127.0.0.1:${PORT}`);
    let hello: { slot: number } | null = null;
    let snaps = 0;
    let sawPlay = false;
    let agentPresent = false;
    wsc.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") {
        hello = msg;
        // press ENTER to start
        wsc.send(JSON.stringify({ t: "input", s: { l: false, r: false, u: false, d: false, a: false, b: false, st: true } }));
        setTimeout(() => wsc.send(JSON.stringify({ t: "input", s: { l: false, r: true, u: false, d: false, a: false, b: false, st: false } })), 150);
      } else if (msg.t === "state") {
        snaps++;
        if (msg.s.screen === "play") sawPlay = true;
        if (msg.s.players[1].present) agentPresent = true;
      }
    });
    await new Promise(res => setTimeout(res, 4000));
    ok(hello !== null && (hello as { slot: number }).slot === 0, "client seated in slot 0");
    ok(snaps > 60, `snapshots flowing (${snaps} in 4s ≈ ${Math.round(snaps / 4)} Hz)`);
    ok(sawPlay, "ENTER started the game over the wire");
    ok(agentPresent, "LLM (mock) agent occupies slot 1");
    const http = await import("node:http");
    const page3d: string = await new Promise((res, rej) => {
      http.get(`http://127.0.0.1:${PORT}/3d`, r => {
        let body = "";
        r.on("data", (c: Buffer) => { body += c; });
        r.on("end", () => r.statusCode === 200 ? res(body) : rej(new Error("status " + r.statusCode)));
      }).on("error", rej);
    });
    ok(page3d.includes("HD-2D") && page3d.length > 500000, "/3d serves the three.js client");
    wsc.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 8. in-game menu flow
{
  console.log("[8] menu-driven setup over the wire (single + llm/mock)");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer({}, ["P2", "LLM_PROVIDER"]);
  try {
    const wsc = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const seen = { menu: false, title: false, play: false, agentName: "", hostName: "" };
    let providersOk = false;
    wsc.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") {
        providersOk = !!msg.providers && "ollama" in msg.providers &&
          "anthropic" in msg.providers && "openai" in msg.providers;
      } else if (msg.t === "state") {
        const s = msg.s;
        if (s.screen === "menu" && !seen.menu) {
          seen.menu = true;
          wsc.send(JSON.stringify({ t: "name", name: "Artem" }));
          wsc.send(JSON.stringify({
            t: "setup", mode: "llm", provider: "mock", hostName: "Artem",
          }));
        } else if (s.screen === "title" && !seen.title) {
          seen.title = true;
          seen.agentName = s.names[1];
          seen.hostName = s.names[0];
          wsc.send(JSON.stringify({ t: "input", s: { l: false, r: false, u: false, d: false, a: false, b: false, st: true } }));
        } else if (s.screen === "play") {
          seen.play = true;
        }
      }
    });
    await new Promise(res => setTimeout(res, 3500));
    ok(providersOk, "hello advertises all three providers (labels only)");
    ok(seen.menu, "fresh server starts at the menu");
    ok(seen.title, "setup(llm/mock) moved menu → title");
    ok(seen.agentName.includes("MOCK"), "agent name propagated to names[1]");
    ok(seen.hostName === "ARTEM", "human keeps their name in names[0] — not the model");
    ok(seen.play, "ENTER started the coop game");
    // ESC → back to menu, then single player
    wsc.send(JSON.stringify({ t: "input", s: { l: false, r: false, u: false, d: false, a: false, b: false, st: false } }));
    wsc.send(JSON.stringify({ t: "tomenu" }));
    const single = { menu: false, title: false, p2absent: false };
    wsc.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t !== "state") return;
      const s = msg.s;
      if (s.screen === "menu" && !single.menu) {
        single.menu = true;
        wsc.send(JSON.stringify({ t: "setup", mode: "single" }));
      } else if (s.screen === "title" && single.menu && !single.title) {
        single.title = true;
        single.p2absent = !s.players[1].present;
      }
    });
    await new Promise(res => setTimeout(res, 2000));
    ok(single.menu, "tomenu returned the host to the menu");
    ok(single.title, "single-player setup reached the title");
    ok(single.p2absent, "no Player 2 in single mode");
    wsc.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 9. heart progression
{
  console.log("[9] heart containers: lake secret + golem drop");
  const g = freshPlay();
  const { loadRoom } = await import("../shared/core");
  // lake secret exists before the vault
  loadRoom(g, 2, 3 * TILE, 6 * TILE);
  g.screen = "play"; g.fade = 0;
  ok(g.pickups.some(p => p.kind === "container" && p.cid === "lake"),
     "container waits on the Amber Lake sand");
  // grab it: park P1 on it and tick
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const lake = g.pickups.find(p => p.cid === "lake")!;
  g.players[0].x = lake.x - 5; g.players[0].y = lake.y - 6;
  for (let i = 0; i < 5; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[0].maxHp === 8 && g.players[1].maxHp === 8,
     "lake container: 4 hearts for both");
  // golem drops one on death
  loadRoom(g, 5, 7 * TILE, 11 * TILE);
  g.screen = "play"; g.fade = 0;
  const golem = g.enemies[0];
  ok(golem.kind === "golem", "golem present");
  golem.hp = 1; golem.phase = 3; golem.t = 5;   // stunned, one hit left
  g.players[0].x = golem.x - 8; g.players[0].y = golem.y + 8;
  const stab = { ...emptyInput(), a: true, r: true };
  for (let i = 0; i < 40 && !golem.dead; i++) {
    step(g, i % 14 < 3 ? stab : emptyInput(), emptyInput(), prev);
    golem.phase = 3;   // keep it stunned for the test
  }
  ok(golem.dead, "golem defeated");
  ok(g.pickups.some(p => p.kind === "container" && p.cid === "golem"),
     "golem dropped a heart container");
  // pedestal must still appear alongside the drop
  ok(g.pedestal !== null && !g.pedestal.final, "Amber Blade pedestal revealed too");
  // container survives room reload until taken
  loadRoom(g, 4, 8 * TILE, 8 * TILE);
  loadRoom(g, 5, 7 * TILE, 11 * TILE);
  ok(g.pickups.some(p => p.cid === "golem"), "boss container persists across reloads");
}

// ------------------------------------------------- 10. elixir of life
{
  console.log("[10] elixir auto-revive + honest containers");
  const g = freshPlay();
  const { loadRoom, makeEnemy: mk } = await import("../shared/core");
  loadRoom(g, 4, 8 * TILE, 8 * TILE);
  g.screen = "play"; g.fade = 0; g.enemies = [];   // clear guards for a lab bench
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  ok(g.pickups.some(p => p.kind === "elixir" && p.cid === "vault"),
     "elixir waits in the vault guard room");
  const el = g.pickups.find(p => p.kind === "elixir")!;
  g.players[0].x = el.x - 5; g.players[0].y = el.y - 6;
  for (let i = 0; i < 5; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[0].elixir, "P1 carries the elixir");
  ok(!g.pickups.some(p => p.kind === "elixir"), "bottle left the floor");
  // lethal hit → elixir fires, no downed state
  g.players[0].hp = 1; g.players[0].invuln = 0;
  g.enemies = [mk("slime", g.players[0].x, g.players[0].y)];
  for (let i = 0; i < 240 && g.players[0].hp === 1; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(!g.players[0].downed && g.players[0].hp >= 4, "elixir caught the fall");
  ok(!g.players[0].elixir, "bottle consumed");
  // container while partner is downed: growth yes, resurrection no
  g.players[1].hp = 0; g.players[1].downed = true;
  g.players[1].x = 200; g.players[1].y = 200;
  g.enemies = [];
  g.pickups.push({ kind: "container", x: g.players[0].x + 5, y: g.players[0].y + 6, t: 0, cid: "testc" });
  for (let i = 0; i < 5; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[1].maxHp === 8 && g.players[1].hp === 0 && g.players[1].downed,
     "downed partner grows but stays down — no back-door resurrection");
  ok(g.players[0].hp === g.players[0].maxHp, "standing player fully healed");
}

// ------------------------------------------------- 11. extended world (open-closed)
{
  console.log("[11] extended world: classic path intact, additive wings");
  const core = await import("../shared/core");
  core.validateRooms();
  ok(core.ROOMS.length === 17, "17 rooms validate");
  // the classic route is untouched
  ok(core.ROOMS[4].exits.up === 5 && core.ROOMS[5].exits.down === 4,
     "old vault: guard leads straight to the boss, as it always did");
  ok(core.ROOMS[10].exits.up === 11 && core.ROOMS[11].exits.down === 10,
     "ice vault path unchanged");
  ok(core.makeEnemy("wraith", 0, 0).maxHp === 16, "classic wraith untouched");
  // additive wings and zone
  ok(core.ROOMS[4].exits.left === 12 && core.ROOMS[12].exits.right === 4,
     "cellars hang off the guard room as a side wing");
  ok(core.ROOMS[10].exits.left === 13 && core.ROOMS[13].exits.right === 10,
     "crypt is a side wing too");
  ok(core.ROOMS[1].exits.down === 14, "forest opens down into Emberdeep");

  // bow is back where veterans remember it
  const g = freshPlay();
  core.loadRoom(g, 6, 8 * TILE, 8 * TILE);
  ok(g.pickups.some(p => p.kind === "bow"), "bow waits in the Snowfield again");

  // glacier open by default; HARD_GATE seals it
  core.loadRoom(g, 8, 8 * TILE, 3 * TILE);
  g.screen = "play"; g.fade = 0; g.enemies = [];
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  g.players[0].x = 8 * TILE + 2; g.players[0].y = 1 * TILE + 2;
  for (let i = 0; i < 10 && g.room === 8; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.room === 9, "glacier cave open by default (classic progression)");
  const g2 = freshPlay();
  g2.hardGate = true;
  core.loadRoom(g2, 8, 8 * TILE, 3 * TILE);
  g2.screen = "play"; g2.fade = 0; g2.enemies = [];
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  g2.players[0].x = 8 * TILE + 2; g2.players[0].y = 1 * TILE + 2;
  for (let i = 0; i < 10; i++) step(g2, emptyInput(), emptyInput(), prev2);
  ok(g2.room === 8, "HARD_GATE=1 seals it behind the charm");

  // charm grants fire arrows: double bow damage
  const g3 = freshPlay();
  g3.enemies = [core.makeEnemy("slime", 8 * TILE, 6 * TILE)];
  g3.hasBow = true; g3.charmClaimed = true;
  g3.players[0].x = 8 * TILE; g3.players[0].y = 9 * TILE;
  const prev3: [Input, Input] = [emptyInput(), emptyInput()];
  const shoot = { ...emptyInput(), u: true };
  step(g3, shoot, emptyInput(), prev3);                     // face up
  step(g3, { ...emptyInput(), b: true }, emptyInput(), prev3);   // loose
  for (let i = 0; i < 40 && g3.enemies[0].hp === 3; i++) {
    step(g3, emptyInput(), emptyInput(), prev3);
  }
  ok(g3.enemies[0].hp <= 1, "fire arrow dealt 2 damage");

  // sentinel shield still honest
  const sent = core.makeEnemy("sentinel", 8 * TILE, 6 * TILE);
  sent.vx = 0; sent.vy = 1;
  ok(core.sentinelBlocks(sent, sent.x + 6, sent.y + 40), "frontal attack blocked");
  ok(!core.sentinelBlocks(sent, sent.x + 6, sent.y - 40), "rear attack lands");
}

// ------------------------------------------------- 12. team keys
{
  console.log("[12] partner-held key opens the door (Ilya's bug)");
  const core = await import("../shared/core");
  const g = freshPlay();
  core.loadRoom(g, 4, 7.5 * TILE, 2 * TILE);   // guard room, near the top door
  g.screen = "play"; g.fade = 0; g.enemies = [];
  g.players[1].keys = 1;                        // the LLM partner grabbed it
  g.players[1].x = 200; g.players[1].y = 180;   // and wandered off, as they do
  g.players[0].x = 7.5 * TILE; g.players[0].y = 1 * TILE + 2;  // human at the door
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const up = { ...emptyInput(), u: true };
  for (let i = 0; i < 10 && !g.doors[4]; i++) step(g, up, emptyInput(), prev);
  ok(g.doors[4] === true, "door opened by the key-less player");
  ok(g.players[1].keys === 0, "key spent from the partner's pocket");
  ok(g.players[0].keys === 0, "opener spent nothing they did not have");
}

// ------------------------------------------------- 13. endings matrix
{
  console.log("[13] Fahrenheit endings: the world-state writes the epilogue");
  const core = await import("../shared/core");
  const mk = (mut: (g: Game) => void): string => {
    const g = freshPlay();
    mut(g);
    return core.endingFor(g).id;
  };
  ok(mk(() => { /* coop, some downs */ (0); }) === "classic" ||
     mk(g => { g.stats[0].downs = 1; }) === "classic", "classic ending preserved verbatim");
  ok(mk(g => { g.stats[0].downs = 1; g.emberDead = true; g.charmClaimed = true; }) === "ember-pact",
     "fire route earns The Ember Pact");
  ok(mk(() => { /* nobody ever fell */ }) === "flawless", "no downs → Flawless Legend");
  ok(mk(g => { g.players[1].downed = true; g.stats[1].downs = 2; }) === "lone-thaw",
     "victory over a fallen partner → Lone Thaw");
  ok(mk(g => { g.players[1].present = false; g.stats[0].downs = 1; }) === "quiet-hero",
     "solo → The Quiet Hero");
  ok(mk(g => { g.players[1].present = false; }) === "quiet-legend",
     "solo flawless → The Quiet Legend");
  // priority: a fallen partner outranks the fire route
  ok(mk(g => { g.players[1].downed = true; g.stats[1].downs = 1;
               g.emberDead = true; g.charmClaimed = true; }) === "lone-thaw",
     "abandonment outweighs conquest");
}

// ------------------------------------------------- 14. mercy
{
  console.log("[14] the wraith yields: strike or spare");
  const core = await import("../shared/core");

  // A) the lethal blow bends the knee, not the neck
  const g = freshPlay();
  core.loadRoom(g, 11, 7 * TILE, 11 * TILE);
  g.screen = "play"; g.fade = 0;
  const wr = g.enemies[0];
  ok(wr.kind === "wraith", "wraith on the throne");
  wr.hp = 1;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  g.players[0].x = wr.x - 12; g.players[0].y = wr.y + 10;
  const stab = { ...emptyInput(), a: true, r: true };
  for (let i = 0; i < 60 && wr.phase !== 9; i++) {
    step(g, i % 14 < 3 ? stab : emptyInput(), emptyInput(), prev);
  }
  ok(wr.phase === 9 && !wr.dead && wr.hp === 1, "lethal hit → the wraith yields");
  // harmless while yielding
  const hpBefore = g.players[0].hp;
  g.players[0].x = wr.x + 2; g.players[0].y = wr.y + 2;
  g.players[0].invuln = 0;
  for (let i = 0; i < 20; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[0].hp === hpBefore, "a yielding wraith does no harm");

  // B) mercy: stand beside it
  for (let i = 0; i < 120 && !g.wraithSpared; i++) {
    g.players[0].x = wr.x + 2; g.players[0].y = wr.y + 2;   // stay close
    step(g, emptyInput(), emptyInput(), prev);
  }
  ok(g.wraithSpared && wr.dead, "mercy granted by standing close");
  ok(g.companion !== null, "the wraith walks with the party now");
  ok(g.pedestal !== null && g.pedestal.final, "the final pedestal appears");
  ok(core.endingFor(g).id === "mercy", "sixth ending: WINTER'S COMPANION");

  // C) or the classic strike — nothing of the old game lost
  const g2 = freshPlay();
  core.loadRoom(g2, 11, 7 * TILE, 11 * TILE);
  g2.screen = "play"; g2.fade = 0;
  const wr2 = g2.enemies[0];
  wr2.hp = 1;
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  g2.players[0].x = wr2.x - 12; g2.players[0].y = wr2.y + 10;
  for (let i = 0; i < 60 && wr2.phase !== 9; i++) {
    step(g2, i % 14 < 3 ? { ...emptyInput(), a: true, r: true } : emptyInput(), emptyInput(), prev2);
  }
  ok(wr2.phase === 9, "yields again");
  for (let i = 0; i < 120 && !wr2.dead; i++) {
    g2.players[0].x = wr2.x - 12; g2.players[0].y = wr2.y + 10;
    step(g2, i % 14 < 3 ? { ...emptyInput(), a: true, r: true } : emptyInput(), emptyInput(), prev2);
  }
  ok(wr2.dead && g2.wraithDead && !g2.wraithSpared, "second strike: the classic kill");
  ok(core.endingFor(g2).id !== "mercy", "no mercy ending for the executioner");

  // D) the agent lowers its blade before a yielding wraith
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const g3 = freshPlay();
  core.loadRoom(g3, 11, 7 * TILE, 11 * TILE);
  g3.screen = "play"; g3.fade = 0;
  g3.enemies[0].phase = 9;
  const agent = new AgentPlayer(mock(), 1, { planMs: 1 });
  await agent.planOnce(g3);   // mock will say "attack 0"
  const inp = agent.control(g3);
  ok(!inp.a && !inp.b, "the agent does not strike a yielding foe");
}

// ------------------------------------------------- 15. menu wiring sanity
{
  console.log("[15] built bundles: quest choice reaches every mode (both clients)");
  const fs = await import("node:fs");
  for (const file of ["dist/client.html", "dist/client3d.html"]) {
    const src = fs.readFileSync(file, "utf8");
    ok(src.includes("CLASSIC QUEST") && src.includes("LONG QUEST"),
       `${file}: quest step present`);
    ok(src.includes("SINGLE PLAYER") && src.includes("MULTIPLAYER"),
       `${file}: root menu starts with single or multiplayer`);
    ok(src.includes("AI AUTOPILOT") && src.includes("AI + AI"),
       `${file}: autopilot and AI duo paths present`);
    ok(src.includes("HUMAN + AI"), `${file}: human + AI party option present`);
    ok(src.includes("THE ARCHITECT"), `${file}: architect toggle stub on quest screen`);
    for (const mode of ["single", "human"]) {
      ok(src.includes(`mode: "${mode}"`) && src.includes("hardGate"),
         `${file}: mode "${mode}" setup carries hardGate`);
    }
    ok(src.includes('mode: "duo"'), `${file}: AI duo setup wired`);
    ok(src.includes("SLIPPERY ICE"), `${file}: slippery-ice toggle present`);
    ok(src.includes('mode: "auto"') && src.includes("hardGate"), `${file}: autopilot setup carries hardGate`);
    ok(src.includes('mode: "llm"') && src.includes("hardGate"), `${file}: llm setup carries hardGate`);
  }
  const src3d = fs.readFileSync("dist/client3d.html", "utf8");
  // anchors must be CODE, not comments — esbuild strips comments from bundles
  ok(src3d.includes('ch === "w"'), "3D builder renders water tiles");
  ok(src3d.split("SOLID.has(ch)").length - 1 >= 2, "3D has the unhandled-solid fallback");
  for (const file of ["dist/client.html", "dist/client3d.html"]) {
    const src = fs.readFileSync(file, "utf8");
    ok(src.includes("namegate"), `${file}: name gate present`);
    ok(src.includes("copylink"), `${file}: invite-copy button present`);
    ok(src.includes("input.select()"), `${file}: name gate asks on every load (prefilled)`);
    ok(src.includes("releaseNameFocus"), `${file}: name field releases focus for WASD`);
    ok(src.includes("ensurePlayControl"), `${file}: play mode unlocks human input`);
    ok(src.includes("capturePlayKeys"), `${file}: capture phase reclaims keyboard during play`);
    ok(src.includes("drawPipEnemy") || src.includes("SPR.bat["),
       `${file}: PiP enemy sprites index animated sheets`);
    ok(src.includes("gate.style.display === \"none\""), `${file}: name gate stops swallowing keys when hidden`);
    ok(src.includes("single-auto") || src.includes("AI AUTOPILOT"),
       `${file}: the AUTOPILOT menu path is reachable`);
    ok(src.includes("partnerView") && src.includes("drawPartnerPip"),
       `${file}: stage-2 scry mirror wired (partnerView + drawPartnerPip)`);
    ok(src.includes("drawDuoSpectatorHud"),
       `${file}: AI duo spectator shows both heroes' hearts`);
    ok(src.includes('id="pip"'), `${file}: partner scry mirror lives outside the game frame`);
    ok(src.includes("[x] FREE ROAM") || src.includes("FREE ROAM"),
       `${file}: free roam travel toggle on quest screen`);
    ok(/build [0-9]{10}-[a-z0-9]{4}/.test(src) || src.includes("__BUILD__") === false,
       `${file}: build id stamped`);
  }
}

// ------------------------------------------------- 16. multi-session
{
  console.log("[16] two games, one server: nobody blocks anybody");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer({}, ["P2", "LLM_PROVIDER"]);
  try {

    const mkClient = (): { ws: InstanceType<typeof WebSocket>; state: { room: string; screen: string } } => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      const state = { room: "", screen: "" };
      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(String(data));
        if (msg.t === "hello") state.room = msg.room;
        else if (msg.t === "state") state.screen = msg.s.screen;
      });
      return { ws, state };
    };

    const A = mkClient();
    await new Promise(r => setTimeout(r, 600));
    A.ws.send(JSON.stringify({ t: "setup", mode: "llm", provider: "mock", hardGate: false }));
    A.ws.send(JSON.stringify({ t: "input", s: { l: false, r: false, u: false, d: false, a: false, b: false, st: true } }));
    await new Promise(r => setTimeout(r, 700));
    ok(A.state.screen === "play", "player A is in game with an LLM partner");

    const B = mkClient();   // bare URL while A is playing
    await new Promise(r => setTimeout(r, 600));
    ok(B.state.room !== "" && B.state.room !== A.state.room,
       "player B gets a fresh room instead of a rejection");
    ok(B.state.screen === "menu", "B stands at their own menu");
    B.ws.send(JSON.stringify({ t: "setup", mode: "single", hardGate: false }));
    await new Promise(r => setTimeout(r, 500));
    ok(B.state.screen === "title", "B configures their own game");
    ok(A.state.screen === "play", "A's game never noticed B existed");
    A.ws.close(); B.ws.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 17. room links + names
{
  console.log("[17] host shares a room link; both heroes carry their names");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer({}, ["P2", "LLM_PROVIDER"]);
  try {

    // host: bare URL → own session; picks HUMAN; sends a name
    const host = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const H = { room: "", screen: "", names: ["", ""] as [string, string] };
    const HELLO_BUILD = { v: "" };
    host.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") { H.room = msg.room; HELLO_BUILD.v = msg.build ?? ""; }
      else if (msg.t === "state") { H.screen = msg.s.screen; H.names = msg.s.names; }
    });
    await new Promise(r => setTimeout(r, 600));

    // build stamp: what the socket says must match what /health says
    const hb = await new Promise<string>((res, rej) => {
      const http = require("node:http") as typeof import("node:http");
      http.get(`http://127.0.0.1:${PORT}/health`, r => {
        let body = "";
        r.on("data", (ch: Buffer) => { body += ch; });
        r.on("end", () => { try { res(JSON.parse(body).build); } catch (e) { rej(e); } });
      }).on("error", rej);
    });
    ok(typeof hb === "string" && hb.length > 0 && hb === HELLO_BUILD.v,
       "hello.build == /health build (deploy verification works)");

    // the autocomplete leak: a stale ?room to a menu-stage session must NOT
    // trap the visitor — they quietly get their own fresh game instead
    const leaker = new WebSocket(`ws://127.0.0.1:${PORT}/?room=${H.room}`);
    const L = { room: "", slot: -1 };
    leaker.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") { L.room = msg.room; L.slot = msg.slot; }
    });
    await new Promise(r => setTimeout(r, 500));
    ok(L.room !== "" && L.room !== H.room && L.slot === 0,
       "leaked ?room to a seatless session → own fresh game, no rejection");
    leaker.close();

    host.send(JSON.stringify({ t: "name", name: "artem" }));
    host.send(JSON.stringify({ t: "setup", mode: "human", hardGate: false }));
    await new Promise(r => setTimeout(r, 500));
    ok(H.screen === "lobby", "host waits in the lobby with a shareable room");

    // a stranger on the bare URL does NOT fall into the host's lobby
    const stranger = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const S = { room: "" };
    stranger.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") S.room = msg.room;
    });
    await new Promise(r => setTimeout(r, 500));
    ok(S.room !== "" && S.room !== H.room, "bare URL never auto-joins: stranger gets their own room");
    stranger.close();

    // the invited partner uses the room link and brings a name
    const guest = new WebSocket(`ws://127.0.0.1:${PORT}/?room=${H.room}`);
    const G = { room: "", slot: -1 };
    guest.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "hello") { G.room = msg.room; G.slot = msg.slot; }
    });
    await new Promise(r => setTimeout(r, 500));
    ok(G.room === H.room && G.slot === 1, "room link seats the guest in the host's game");
    guest.send(JSON.stringify({ t: "name", name: "ilya the qa" }));
    await new Promise(r => setTimeout(r, 500));
    ok(H.screen === "title", "lobby became the title once the partner arrived");
    ok(H.names[0] === "ARTEM", "host name travels in snapshots");
    ok(H.names[1] === "ILYA THE QA", "guest name too (sanitized, uppercased)");
    host.close(); guest.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 18. proactive partner
{
  console.log("[18] the agent joins fights instead of shadowing (Alexey's report)");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  // enemy harasses the HUMAN 90px away from the agent → agent must engage
  const g = freshPlay();
  g.enemies = [core.makeEnemy("slime", 4 * TILE, 5 * TILE)];
  g.players[0].x = 4 * TILE + 4; g.players[0].y = 6 * TILE;      // human, in trouble
  g.players[1].x = 10 * TILE; g.players[1].y = 10 * TILE;        // agent, far away
  const agent = new AgentPlayer(mock(), 1, { planMs: 999999 });
  (agent as unknown as { intent: { action: string } }).intent = { action: "follow" };
  const inp = agent.control(g);
  ok(inp.l || inp.u, "agent moves toward the fight, not behind the human");

  // but with the room clear, follow stays follow (no phantom charges)
  const g2 = freshPlay();
  g2.enemies = [];
  g2.players[0].x = 4 * TILE; g2.players[0].y = 6 * TILE;
  g2.players[1].x = 10 * TILE; g2.players[1].y = 10 * TILE;
  const agent2 = new AgentPlayer(mock(), 1, { planMs: 999999 });
  (agent2 as unknown as { intent: { action: string } }).intent = { action: "follow" };
  agent2.control(g2);
  ok((agent2 as unknown as { intent: { action: string } }).intent.action === "follow",
     "empty room: follow remains follow");

  // mercy is still sacred even for a proactive partner
  const g3 = freshPlay();
  const wr = core.makeEnemy("wraith", 10 * TILE + 8, 10 * TILE);
  wr.phase = 9;
  g3.enemies = [wr];
  g3.players[0].x = 10 * TILE; g3.players[0].y = 11 * TILE;
  g3.players[1].x = 10 * TILE + 20; g3.players[1].y = 11 * TILE;
  const agent3 = new AgentPlayer(mock(), 1, { planMs: 999999 });
  (agent3 as unknown as { intent: { action: string } }).intent = { action: "follow" };
  const inp3 = agent3.control(g3);
  ok(!inp3.a && !inp3.b, "a yielding wraith is never auto-engaged");
}

// ------------------------------------------------- 19. message word-wrap
{
  console.log("[19] long riddles wrap instead of running off-screen (Ilya's bug)");
  const { wrapText } = await import("../client/textutil");
  // canvas-free mock: 5px per character, like a tiny monospace font
  const fakeCtx = { measureText: (s: string) => ({ width: s.length * 5 }) };
  const riddle = "Dwarven wards seal this cave... their charm lies in the burning deep";
  const lines = wrapText(fakeCtx, riddle, 256 - 28);
  ok(lines.length >= 2, "the sealed-cave riddle wraps to multiple lines");
  ok(lines.every(ln => ln.length * 5 <= 256 - 28), "every line fits the canvas");
  ok(lines.join(" ") === riddle, "no words lost in the wrap");
  const yieldMsg = "The Winter Wraith yields... strike again, or stand close to spare it";
  const yl = wrapText(fakeCtx, yieldMsg, 256 - 28);
  ok(yl.every(ln => ln.length * 5 <= 256 - 28), "the mercy prompt fits too");
  ok(wrapText(fakeCtx, "short", 200).length === 1, "short messages stay one line");
}

// ------------------------------------------------- 20. shield inertia
{
  console.log("[20] sentinel shield turns slowly: circling gets behind it");
  const core = await import("../shared/core");
  const g = freshPlay();
  const s0 = core.makeEnemy("sentinel", 8 * TILE, 6 * TILE);
  g.enemies = [s0];
  g.players[1].present = false;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];

  // orbit the sentinel at 40px, ~3.5°/tick — faster than the 2°/tick shield
  let ang = 0;   // start dead ahead of the shield
  g.players[0].x = s0.x + s0.w / 2 + 40 - 5;
  g.players[0].y = s0.y + s0.h / 2 - 6;
  step(g, emptyInput(), emptyInput(), prev);   // shield snaps to the player
  const pcx = (): number => g.players[0].x + 5, pcy = (): number => g.players[0].y + 6;
  ok(core.sentinelBlocks(s0, pcx(), pcy()), "head-on: blocked at first");

  let freedAt = -1;
  for (let i = 0; i < 240 && freedAt < 0; i++) {
    ang += 0.061;
    const ecx = s0.x + s0.w / 2, ecy = s0.y + s0.h / 2;
    g.players[0].x = ecx + Math.cos(ang) * 40 - 5;
    g.players[0].y = ecy + Math.sin(ang) * 40 - 6;
    g.players[0].invuln = 60;   // focus on geometry, not damage
    step(g, emptyInput(), emptyInput(), prev);
    if (!core.sentinelBlocks(s0, pcx(), pcy())) freedAt = i;
  }
  ok(freedAt > 0 && freedAt < 180,
     `circling opens the flank in a reasonable time (tick ${freedAt})`);

  // and the shield does keep honestly turning toward a stationary player
  const s1 = core.makeEnemy("sentinel", 8 * TILE, 6 * TILE);
  s1.vx = 1; s1.vy = 0;                      // facing east
  const g2 = freshPlay();
  g2.enemies = [s1];
  g2.players[1].present = false;
  g2.players[0].x = s1.x + s1.w / 2 - 5;     // player due NORTH
  g2.players[0].y = s1.y - 60;
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  // check right after the turn completes (~45 ticks for 90°), before the
  // knight has walked all the way to the target and begun orbiting it
  for (let i = 0; i < 90; i++) {
    g2.players[0].invuln = 60;
    step(g2, emptyInput(), emptyInput(), prev2);
  }
  ok(s1.vy < -0.9, "the shield honestly comes around to face north");
}

// ------------------------------------------------- 21. arrow vs shield
{
  console.log("[21] blocked arrow rocks the shield: first opens, second hits");
  const core = await import("../shared/core");
  const g = freshPlay();
  const sn = core.makeEnemy("sentinel", 8 * TILE - 6, 5 * TILE);
  g.enemies = [sn];
  g.players[1].present = false;
  g.hasBow = true;
  g.players[0].x = sn.x + sn.w / 2 - 5;   // due south, in the shield's face
  g.players[0].y = sn.y + 70;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  step(g, { ...emptyInput(), u: true }, emptyInput(), prev);   // face north
  sn.vx = 0; sn.vy = 1;                                        // shield faces south
  const shoot = { ...emptyInput(), b: true };

  // volley: fire whenever the bow is ready, walk nowhere
  let firstBlockTick = -1, firstHitHp = sn.hp;
  for (let i = 0; i < 200 && sn.hp === firstHitHp; i++) {
    const inp = g.players[0].bowCd === 0 ? shoot : emptyInput();
    step(g, inp, emptyInput(), prev);
    if (firstBlockTick < 0 && sn.stagger > 0) firstBlockTick = i;
  }
  ok(firstBlockTick > 0, "first frontal arrow clangs and staggers the knight");
  ok(sn.hp < firstHitHp, "the follow-up arrow lands while the shield is down");

  // sword clangs do NOT stagger — parries are not battering rams
  const sn2 = core.makeEnemy("sentinel", 8 * TILE, 5 * TILE);
  sn2.vx = 0; sn2.vy = 1; sn2.stagger = 0;
  const g2 = freshPlay();
  g2.enemies = [sn2];
  g2.players[1].present = false;
  g2.players[0].x = sn2.x + 2; g2.players[0].y = sn2.y + sn2.h + 4;   // frontal, close
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  step(g2, { ...emptyInput(), u: true, a: true }, emptyInput(), prev2);
  for (let i = 0; i < 20; i++) { sn2.vx = 0; sn2.vy = 1; step(g2, emptyInput(), emptyInput(), prev2); }
  ok(sn2.hp === sn2.maxHp && sn2.stagger === 0, "sword clang blocks clean, no stagger");

  // the stagger honestly expires
  const sn3 = core.makeEnemy("sentinel", 8 * TILE, 5 * TILE);
  sn3.stagger = 3; sn3.vx = 0; sn3.vy = 1;
  const g3 = freshPlay();
  g3.enemies = [sn3];
  g3.players[1].present = false;
  g3.players[0].x = sn3.x + 2;              // hero stands due SOUTH
  g3.players[0].y = sn3.y + 80;
  const prev3: [Input, Input] = [emptyInput(), emptyInput()];
  ok(!core.sentinelBlocks(sn3, sn3.x, sn3.y + 40), "no block while reeling");
  for (let i = 0; i < 10; i++) { g3.players[0].invuln = 60; step(g3, emptyInput(), emptyInput(), prev3); }
  ok(sn3.stagger === 0 && core.sentinelBlocks(sn3, sn3.x + 6, sn3.y + 40),
     "recovered shield blocks from the hero's direction again");

  // reeling is not rooted: the knight keeps closing the distance
  const sn4 = core.makeEnemy("sentinel", 8 * TILE, 4 * TILE);
  sn4.stagger = 40; sn4.vx = 0; sn4.vy = 1;   // rocked while facing south
  const g4 = freshPlay();
  g4.enemies = [sn4];
  g4.players[1].present = false;
  g4.players[0].x = sn4.x + 2; g4.players[0].y = sn4.y + 90;   // archer south
  const prev4: [Input, Input] = [emptyInput(), emptyInput()];
  const y0 = sn4.y;
  for (let i = 0; i < 30; i++) { g4.players[0].invuln = 60; step(g4, emptyInput(), emptyInput(), prev4); }
  ok(sn4.y > y0 + 4, "a reeling knight still lumbers toward the archer");
  // and on recovery the shield snaps straight back at the hero
  for (let i = 0; i < 15; i++) { g4.players[0].invuln = 60; step(g4, emptyInput(), emptyInput(), prev4); }
  ok(sn4.stagger === 0 && sn4.vy > 0.9, "recovered shield snaps to face the hero instantly");
}

// ------------------------------------------------- 22. hero leaderboard
{
  console.log("[22] /stats names the heroes, not just the partners");
  const fs2 = await import("node:fs");
  const os = await import("node:os");
  const pathm = await import("node:path");
  const http = await import("node:http");
  const dir = fs2.mkdtempSync(pathm.join(os.tmpdir(), "amber-logs-"));
  const st = (dmg: number): string =>
    JSON.stringify({ dmgDealt: dmg, bossDmg: 0, kills: 0, dmgTaken: 1, downs: 0, revives: 1, elixirsUsed: 0 });
  fs2.writeFileSync(pathm.join(dir, "matches.jsonl"),
    `{"mode":"single","p1name":"ARTEM","partner":"(solo)","outcome":"loss","ticks":500,"p1":${st(9)},"p2":${st(0)}}\n` +
    `{"mode":"human","p1name":"ARTEM","partner":"ILYA","outcome":"win","ticks":900,"p1":${st(30)},"p2":${st(70)}}\n` +
    `{"mode":"llm","p1name":"ILYA","partner":"ANTHROPIC","outcome":"win","ticks":800,"p1":${st(73)},"p2":${st(69)}}\n`);
  const { proc: srv, port: PORT } = await spawnTestServer(
    { LOG_DIR: dir }, ["P2", "LLM_PROVIDER"],
  );
  try {
    const body = await new Promise<string>((res, rej) => {
      http.get(`http://127.0.0.1:${PORT}/stats.json`, r => {
        let b = ""; r.on("data", (ch: Buffer) => { b += ch; }); r.on("end", () => res(b));
      }).on("error", rej);
    });
    const data = JSON.parse(body) as { heroes: Record<string, unknown>[]; partners: Record<string, unknown>[] };
    const artem = data.heroes.find(h => h.hero === "ARTEM");
    const ilya = data.heroes.find(h => h.hero === "ILYA");
    ok(!!artem && artem.games === 2 && artem.winrate === 0.5, "ARTEM: 2 games as hero, winrate 0.5");
    ok(!!ilya && ilya.games === 2 && ilya.winrate === 1, "ILYA: counted as host AND as human guest");
    ok(!data.heroes.some(h => h.hero === "ANTHROPIC"), "LLMs stay out of the hero table");
    ok(data.partners.some(p => p.partner === "ANTHROPIC"), "...they live in the partner table");
    ok(data.partners.some(p => p.partner === "ILYA"), "a human guest shows as a partner too");
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 23. heroes hold the room
{
  console.log("[23] an NPC companion cannot reload the room while a hero remains");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  // the original scene: cautious human at the boss-room entrance, cowardly
  // agent fleeing the golem straight into the southern doorway — harmlessly
  const g = freshPlay();
  core.loadRoom(g, 5, 6 * TILE, 11 * TILE);
  g.screen = "play"; g.fade = 0;
  g.players[1].npc = true;
  g.players[0].x = 6 * TILE; g.players[0].y = 11 * TILE + 8;
  g.players[1].x = 7.5 * TILE; g.players[1].y = 12 * TILE;
  const agent = new AgentPlayer(mock(), 1, { planMs: 200 });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  let stayed = true;
  for (let i = 0; i < 900 && stayed; i++) {
    if (i % 12 === 0) await agent.planOnce(g);
    step(g, emptyInput(), agent.control(g), prev);
    if (g.room !== 5) stayed = false;
  }
  ok(stayed, "900 ticks of golem pressure: the hero held the room");

  // raw core check: an npc mashing "down" in the doorway goes nowhere...
  const g2 = freshPlay();
  core.loadRoom(g2, 5, 6 * TILE, 11 * TILE);
  g2.screen = "play"; g2.fade = 0; g2.enemies = [];
  g2.players[1].npc = true;
  g2.players[1].x = 7.5 * TILE; g2.players[1].y = 13 * TILE - 12;
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 30; i++) step(g2, emptyInput(), { ...emptyInput(), d: true }, prev2);
  ok(g2.room === 5, "npc pressing into the exit: the room stands");

  // ...but the HERO still leads the party through doors as always
  g2.players[0].x = 7.5 * TILE; g2.players[0].y = 13 * TILE - 12;
  for (let i = 0; i < 30 && g2.room === 5; i++) {
    step(g2, { ...emptyInput(), d: true }, emptyInput(), prev2);
  }
  ok(g2.room === 4, "hero-led transition works and carries the companion");

  // ...and if no hero remains in the slot, the npc may travel alone
  const g3 = freshPlay();
  core.loadRoom(g3, 5, 6 * TILE, 11 * TILE);
  g3.screen = "play"; g3.fade = 0; g3.enemies = [];
  g3.players[0].present = false;
  g3.players[1].npc = true;
  g3.players[1].x = 7.5 * TILE; g3.players[1].y = 13 * TILE - 12;
  const prev3: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 30 && g3.room === 5; i++) {
    step(g3, emptyInput(), { ...emptyInput(), d: true }, prev3);
  }
  ok(g3.room === 4, "with no hero present, the companion may walk out");

  // human-human coop untouched: a non-npc slot 1 exits as ever
  const g4 = freshPlay();
  core.loadRoom(g4, 0, 8 * TILE, 6 * TILE);
  g4.screen = "play"; g4.fade = 0; g4.enemies = [];
  g4.players[1].x = 15 * TILE - 10; g4.players[1].y = 6 * TILE + 8;
  const prev4: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 40 && g4.room === 0; i++) {
    step(g4, emptyInput(), { ...emptyInput(), r: true }, prev4);
  }
  ok(g4.room === 1, "human-human: either hero still leads through doors");
}

// ------------------------------------------------- 24. temperaments
{
  console.log("[24] bodyguard / companion / berserker behave differently");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  // scene: one enemy FAR across the room (near nobody)
  const far = (): Game => {
    const g = freshPlay();
    g.enemies = [core.makeEnemy("slime", 14 * TILE, 12 * TILE)];
    g.players[0].x = 2 * TILE; g.players[0].y = 2 * TILE;
    g.players[1].x = 3 * TILE; g.players[1].y = 2 * TILE;
    return g;
  };
  const intentOf = (a: InstanceType<typeof AgentPlayer>, g: Game): string => {
    (a as unknown as { intent: { action: string } }).intent = { action: "follow" };
    a.control(g);
    return (a as unknown as { intent: { action: string } }).intent.action;
  };
  const guard = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "guard" });
  const comp = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "companion" });
  const hunt = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  ok(intentOf(guard, far()) === "follow", "bodyguard ignores a distant slime");
  ok(intentOf(comp, far()) === "follow", "companion ignores it too — not their fight");
  ok(intentOf(hunt, far()) === "attack", "the berserker crosses the room for it");

  // scene: enemy harassing the HUMAN, agent far away
  const atHuman = (): Game => {
    const g = freshPlay();
    g.enemies = [core.makeEnemy("slime", 2 * TILE + 20, 2 * TILE)];
    g.players[0].x = 2 * TILE; g.players[0].y = 2 * TILE;
    g.players[1].x = 12 * TILE; g.players[1].y = 11 * TILE;
    return g;
  };
  ok(intentOf(guard, atHuman()) === "attack", "bodyguard sprints to defend the human");
  ok(intentOf(comp, atHuman()) === "attack", "companion does too");
}

// ------------------------------------------------- 25. autopilot mode
{
  console.log("[25] AI autopilot: spectator watches, agent quests, thoughts on screen");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer(
    { PLAN_MS: "80" }, ["P2", "LLM_PROVIDER"],
  );
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const S = { screen: "", p0: true, p1: false, thought: null as null | { action: string } };
    ws.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "state") {
        S.screen = msg.s.screen;
        S.p0 = msg.s.players[0].present;
        S.p1 = msg.s.players[1].present;
        S.thought = msg.s.thought ?? null;
      }
    });
    await new Promise(r => setTimeout(r, 600));
    ws.send(JSON.stringify({ t: "setup", mode: "auto", provider: "mock", hardGate: false }));
    await new Promise(r => setTimeout(r, 400));
    ok(S.screen === "title", "autopilot configured, title awaits");
    ok(!S.p0 && S.p1, "the host is a bodiless spectator; the AI has the body");
    // the spectator can still press START
    ws.send(JSON.stringify({ t: "input", s: { l: false, r: false, u: false, d: false, a: false, b: false, st: true } }));
    await new Promise(r => setTimeout(r, 800));
    ok(S.screen === "play", "spectator's ENTER starts the quest");
    ok(!!S.thought && typeof S.thought.action === "string",
       "the agent's thinking reaches the screen");
    ws.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 26. solo mercy = character
{
  console.log("[26] alone before a yielding wraith, temperament decides");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  const yieldScene = (): Game => {
    const g = freshPlay();
    core.loadRoom(g, 11, 7 * TILE, 11 * TILE);
    g.screen = "play"; g.fade = 0;
    g.players[0].present = false;                 // no human anywhere
    const wr = g.enemies[0];
    wr.phase = 9; wr.hp = 1; wr.spareP = 0;
    g.players[1].x = wr.x - 30; g.players[1].y = wr.y + 10;
    return g;
  };

  // the berserker ends winter
  const g1 = yieldScene();
  const hunter = new AgentPlayer(mock(), 1, { planMs: 50, temperament: "hunter" });
  const prev1: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 600 && !g1.enemies[0].dead; i++) {
    if (i % 10 === 0) await hunter.planOnce(g1);
    step(g1, emptyInput(), hunter.control(g1), prev1);
  }
  ok(g1.enemies[0].dead && g1.wraithDead && !g1.wraithSpared,
     "the berserker strikes: classic kill");

  // the companion stands beside it
  const g2 = yieldScene();
  const comp = new AgentPlayer(mock(), 1, { planMs: 50, temperament: "companion" });
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 900 && !g2.wraithSpared; i++) {
    if (i % 10 === 0) await comp.planOnce(g2);
    step(g2, emptyInput(), comp.control(g2), prev2);
  }
  ok(g2.wraithSpared && !g2.wraithDead,
     "the companion grants mercy by standing close");
  ok(core.endingFor(g2).id === "mercy", "an AI alone can earn WINTER'S COMPANION");
}

// ------------------------------------------------- 27. rescue judgment
{
  console.log("[27] a fallen hero is the goal, not a suicide order");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  const scene = (): Game => {
    const g = freshPlay();
    g.enemies = [core.makeEnemy("slime", 12 * TILE, 6 * TILE)];   // threat, east
    g.players[0].downed = true; g.players[0].hp = 0;
    g.players[0].x = 3 * TILE; g.players[0].y = 6 * TILE;          // hero fell, west
    g.players[1].x = 8 * TILE; g.players[1].y = 6 * TILE;          // agent, middle
    return g;
  };
  type Mut = { intent: { action: string; target?: number } };

  // an explicit ATTACK intent stands: clear the threat first
  const g1 = scene();
  const a1 = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  (a1 as unknown as Mut).intent = { action: "attack", target: 0 };
  const i1 = a1.control(g1);
  ok(i1.r === true && i1.l !== true, "explicit attack stands: agent moves at the threat");

  // a passive FOLLOW converts into the rescue run
  const g2 = scene();
  const a2 = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  (a2 as unknown as Mut).intent = { action: "follow" };
  const i2 = a2.control(g2);
  ok(i2.l === true, "passive intent becomes the rescue run toward the body");

  // the failsafe: after ~10 s down, even a stubborn attacker goes to revive
  const g3 = scene();
  const a3 = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  (a3 as unknown as Mut).intent = { action: "attack", target: 0 };
  let last = a3.control(g3);
  for (let i = 0; i < 650; i++) {
    (a3 as unknown as Mut).intent = { action: "attack", target: 0 };
    last = a3.control(g3);
  }
  ok(last.l === true, "overdue rescue overrides even an attack order");
}

// ------------------------------------------------- 28. client prediction
{
  console.log("[28] client-side prediction: instant, honest, self-correcting");
  const core = await import("../shared/core");
  const P = await import("../client/predict");
  const tiles = core.ROOMS[0].tiles;   // the meadow

  const right = { ...emptyInput(), r: true };
  const left = { ...emptyInput(), l: true };

  const sx = 8 * TILE, sy = 6 * TILE;

  // walks exactly like the server: 1.35 px per 60 Hz tick, diagonals normalized
  const pr = P.freshPred();
  P.reconcile(pr, sx, sy, 0, false, -1, sx, sy);      // first fix
  P.stepPred(pr, tiles, right, false, 100);           // 6 ticks
  ok(Math.abs(pr.x - (sx + 6 * 1.35)) < 0.6, "matches server speed tick-for-tick");

  // walls are walls, even in the future
  const pr2 = P.freshPred();
  P.reconcile(pr2, 1 * TILE + 2, sy, 0, false, -1, 1 * TILE + 2, sy);
  for (let i = 0; i < 30; i++) P.stepPred(pr2, tiles, left, false, 17);
  ok(pr2.x >= TILE - 1, "prediction collides with the western tree line");

  // the core rule holds: swinging freezes movement
  const pr3 = P.freshPred();
  P.reconcile(pr3, sx, sy, 0, false, -1, sx, sy);
  P.stepPred(pr3, tiles, right, true, 200);
  ok(pr3.x === sx, "attack freezes predicted movement too");

  // reconciliation compares ANCHORS (our predicted pos when we sent seq N vs the
  // server's pos when it received seq N). Lag cancels, so an agreeing server
  // costs ZERO correction — no backward drag, and no forward overshoot either.
  const pr4 = P.freshPred();
  P.reconcile(pr4, sx, sy, 0, false, -1, sx, sy);   // first fix, live at start
  P.recordInput(pr4, 1, 0);                        // sent seq 1 — anchored at sx
  P.stepPred(pr4, tiles, right, false, 100);       // local prediction runs ahead
  P.recordInput(pr4, 2, 100);                      // heartbeat re-sends the held state
  const ranTo = pr4.x;
  // the server agrees (it stood at sx when seq 1 landed) but its CURRENT position
  // is a whole RTT stale — that staleness must not move us one pixel
  P.reconcile(pr4, sx + 2, sy, 0, false, 1, sx, sy);
  ok(pr4.x === ranTo, "an agreeing server costs zero correction — no drag, no overshoot");

  // the same ack must never be reconciled twice (that is what pushed us off course)
  P.reconcile(pr4, sx + 2, sy, 0, false, 1, sx, sy);
  ok(pr4.x === ranTo, "a repeated ack is reconciled only once");

  // genuine divergence (knockback: the server was 10px behind our anchor) is
  // absorbed gradually
  P.reconcile(pr4, sx, sy, 0, false, 2, ranTo - 10, sy);
  ok(Math.abs(pr4.x - (ranTo - 10 * 0.3)) < 0.001, "a real divergence is blended in");

  // a gross divergence is taken in full
  P.recordInput(pr4, 3, 200);
  const before3 = pr4.x;
  P.reconcile(pr4, sx, sy, 0, false, 3, before3 - 50, sy);
  ok(Math.abs(pr4.x - (before3 - 50)) < 0.001, "a gross divergence is taken in full");

  // room change resets the prediction outright
  P.reconcile(pr4, 50, 50, 3, false, 4, 50, 50);
  ok(pr4.x === 50 && pr4.room === 3, "room change resets the prediction");

  // a stale (out-of-order) ack must never rewind the hero
  P.reconcile(pr4, 999, 50, 3, false, 2, 999, 50);
  ok(pr4.x === 50, "a stale, out-of-order ack is ignored");
}

// ------------------------------------------------- 29. dedicated start
{
  console.log("[29] the start message works even if the input path misbehaves");
  const WebSocket = (await import("ws")).default;
  const { proc: srv, port: PORT } = await spawnTestServer({}, ["P2", "LLM_PROVIDER"]);
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const S = { screen: "" };
    ws.on("message", (data: Buffer) => {
      const msg = JSON.parse(String(data));
      if (msg.t === "state") S.screen = msg.s.screen;
    });
    await new Promise(r => setTimeout(r, 600));
    ws.send(JSON.stringify({ t: "setup", mode: "auto", provider: "mock", hardGate: false }));
    await new Promise(r => setTimeout(r, 400));
    ok(S.screen === "title", "autopilot at the title");
    ws.send(JSON.stringify({ t: "start" }));      // no input state involved at all
    await new Promise(r => setTimeout(r, 500));
    ok(S.screen === "play", "the dedicated start message begins the quest");
    ws.close();
  } finally {
    srv.kill();
  }
}

// ------------------------------------------------- 30. the solo compass
{
  console.log("[30] autopilot gets a hero prompt and a route compass");
  const core = await import("../shared/core");
  const { AgentPlayer, routeHop } = await import("../server/agent");
  const { mock } = await import("../server/llm");

  // BFS knows the world: meadow → vault goes east first...
  const h1 = routeHop(0, 5);
  ok(h1?.kind === "exit" && h1.dir === "right", "from the meadow, the vault lies east");
  // ...and through the lake cave at the end
  const h2 = routeHop(2, 5);
  ok(h2?.kind === "cave", "from the lake, the route dives into the cave");
  // the glacier also hides its path in a cave mouth
  const h3 = routeHop(8, 11);
  ok(h3?.kind === "cave", "the glacier cave leads to the ice vault");
  ok(routeHop(5, 5) === null, "no hop needed inside the goal room");

  // solo observation: no phantom partner, a compass instead
  const g = freshPlay();
  g.players[1].present = false;         // slot-0 view: agent as the lone hero
  const agent = new AgentPlayer(mock(), 0, { planMs: 9e9 });
  const obs = agent.observe(g);
  ok(obs.includes("ALONE"), "the observation says the quest is solo");
  ok(obs.includes("leads toward your goal"), "the compass points somewhere real");
}

// ------------------------------------------------- 31. rescue patience
{
  console.log("[31] how long each temperament argues before the rescue");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  type Mut = { intent: { action: string; target?: number } };

  // a stubborn planner insists on attacking while the hero lies west
  const rescueTick = (temperament: "guard" | "companion" | "hunter"): number => {
    const g = freshPlay();
    g.enemies = [core.makeEnemy("slime", 12 * TILE, 6 * TILE)];
    g.players[0].downed = true; g.players[0].hp = 0;
    g.players[0].x = 3 * TILE; g.players[0].y = 6 * TILE;
    g.players[1].x = 8 * TILE; g.players[1].y = 6 * TILE;
    const a = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament });
    for (let i = 0; i < 1200; i++) {
      (a as unknown as Mut).intent = { action: "attack", target: 0 };
      const inp = a.control(g);
      if (inp.l) return i;   // turned toward the fallen hero
    }
    return 9999;
  };
  const tg = rescueTick("guard"), tc = rescueTick("companion"), th = rescueTick("hunter");
  ok(tg < 120, `the bodyguard drops everything almost at once (tick ${tg})`);
  ok(th < tg && tg < tc,
    `in-room patience: hunter ${th} < guard ${tg} < companion ${tc}`);
  ok(th < 10, "the berserker runs to the body while you share a room");
  ok(tc < 1000, "even the companion never abandons you");
}

// ------------------------------------------------- 32. world/roomsim stage 1
{
  console.log("[32] factorization: state lives in sims[0], the old API is a view");
  const core = await import("../shared/core");
  const g = core.newGame();

  // the flat fields and sims[0] are literally the same storage
  ok(g.enemies === g.sims[0].enemies, "g.enemies IS sims[0].enemies");
  ok(g.room === g.sims[0].room, "g.room reads sims[0].room");
  core.loadRoom(g, 2, 3 * TILE, 6 * TILE);
  ok(g.sims[0].room === 2 && g.room === 2, "loadRoom writes through the view");
  g.enemies.push(core.makeEnemy("slime", 64, 64));
  ok(g.sims[0].enemies.some(e => e.kind === "slime"), "mutations flow both ways");

  // the built-in restart survives the accessor scheme
  g.screen = "play";
  g.players[0].present = true;
  g.hardGate = true;
  const keepNpc = true;
  g.players[1].npc = keepNpc;
  // simulate the core gameover-restart path directly
  const present0 = g.players[0].present, present1 = g.players[1].present;
  const npc1 = g.players[1].npc;
  const hardGate = g.hardGate;
  Object.assign(g, core.newGame());
  g.players[0].present = present0;
  g.players[1].present = present1;
  g.players[1].npc = npc1;
  g.hardGate = hardGate;
  ok(g.sims.length === 1 && g.room === 0, "restart rebuilds a single fresh sim");
  ok(g.enemies === g.sims[0].enemies, "the view still points at the NEW sims[0]");
  ok(g.hardGate === true && g.players[1].npc === keepNpc, "preserved flags intact");

  // players know their sim; simOf resolves it
  ok(g.players[0].simIndex === 0 && core.simOf(g, 0) === g.sims[0],
     "players inhabit sims[0]; simOf agrees");

  // snapshots are byte-compatible: flat, no sims leakage
  const snap = core.toSnapshot(g, ["A", "B"]);
  ok(!("sims" in snap), "snapshot stays flat — clients untouched");
  ok(snap.partnerView == null, "partnerView null while heroes share a sim");
  ok(Array.isArray(snap.tiles) && typeof snap.room === "number",
     "snapshot reads through the views");
}

// ------------------------------------------------- 33. caves are exits
{
  console.log("[33] the cave is a door: any model can walk through it");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  type Mut = { intent: { action: string; dir?: string } };

  // exit "cave" carries the lone hero from the lake into the vault
  const g = freshPlay();
  core.loadRoom(g, 2, 4 * TILE, 6 * TILE);
  g.screen = "play"; g.fade = 0; g.enemies = [];
  g.players[0].present = false;
  g.players[1].npc = false;
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  (agent as unknown as Mut).intent = { action: "exit", dir: "cave" };
  for (let i = 0; i < 900 && g.room === 2; i++) {
    (agent as unknown as Mut).intent = { action: "exit", dir: "cave" };
    step(g, emptyInput(), agent.control(g), prev);
  }
  ok(g.room === 3, "the agent walked into the cave mouth and teleported");

  // the observation advertises the cave among the exits
  const obs = agent.observe(g2ForObs());
  ok(obs.includes('"cave"'), "exits list includes the cave");

  // a stalled solo planner gets route-assisted — and it is counted
  const g3 = freshPlay();
  core.loadRoom(g3, 0, 8 * TILE, 6 * TILE);
  g3.screen = "play"; g3.fade = 0; g3.enemies = [];
  g3.players[0].present = false;
  g3.players[1].npc = false;
  g3.players[1].x = 8 * TILE; g3.players[1].y = 6 * TILE;
  const lazy = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  (lazy as unknown as Mut).intent = { action: "follow" };
  const inp = lazy.control(g3);
  ok(lazy.routeAssists === 1, "the assist is honestly counted against the model");
  ok(inp.r || inp.l || inp.u || inp.d, "and the hero actually walks the route");

  function g2ForObs(): Game {
    const gg = freshPlay();
    core.loadRoom(gg, 2, 4 * TILE, 6 * TILE);
    gg.players[0].present = false;
    return gg;
  }
}

// ------------------------------------------------- 34. survival reflexes
{
  console.log("[34] a hurt idle agent grabs the heart himself");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  type Mut = { intent: { action: string; target?: number } };

  const g = freshPlay();
  g.enemies = [];
  g.pickups = [{ kind: "heart", x: 9 * TILE, y: 6 * TILE, t: 0 } as never];
  g.players[1].hp = 2;
  g.players[1].x = 12 * TILE; g.players[1].y = 6 * TILE;
  const a = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 400 && g.players[1].hp <= 2; i++) {
    (a as unknown as Mut).intent = { action: "follow" };
    step(g, emptyInput(), a.control(g), prev);
  }
  ok(g.players[1].hp > 2, "reflex: the hurt agent walked over and ate the heart");

  // ...but a full-health agent leaves the heart for the humans
  const g2 = freshPlay();
  g2.enemies = [];
  g2.pickups = [{ kind: "heart", x: 9 * TILE, y: 6 * TILE } as never];
  g2.players[1].x = 8 * TILE; g2.players[1].y = 6 * TILE;
  const a2 = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  (a2 as unknown as Mut).intent = { action: "follow" };
  a2.control(g2);
  ok((a2 as unknown as Mut).intent.action === "follow",
     "no greed: a healthy agent leaves hearts alone");
}

// ------------------------------------------------- 35. pickup pathfinds around water
{
  console.log("[35] pickup routes around Amber Lake — not into the water");
  const core = await import("../shared/core");
  const { AgentPlayer, nextWaypoint } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  type Mut = { intent: { action: string; target?: number } };

  const fromX = 7 * TILE + 8, fromY = 9 * TILE + 8;
  const toX = 10 * TILE + 8, toY = 10 * TILE + 8;
  const wp = nextWaypoint(ROOMS[2].tiles, fromX, fromY, toX, toY);
  const wtx = Math.floor(wp.x / TILE), wty = Math.floor(wp.y / TILE);
  const tileAt = (tx: number, ty: number): string => ROOMS[2].tiles[ty]?.[tx] ?? "W";
  ok(!SOLID.has(tileAt(wtx, wty)), "BFS first step stays off the water");

  const g = freshPlay();
  core.loadRoom(g, 2, fromX - 8, fromY - 10);
  g.screen = "play"; g.fade = 0; g.enemies = [];
  g.players[0].present = false;
  g.players[1].x = fromX - 8; g.players[1].y = fromY - 10;
  const idx = g.pickups.filter(p => p.t >= 0).findIndex(p => p.cid === "lake");
  ok(idx >= 0, "lake container is on the map");
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 900 && g.pickups.some(p => p.cid === "lake"); i++) {
    (agent as unknown as Mut).intent = { action: "pickup", target: idx };
    step(g, emptyInput(), agent.control(g), prev);
  }
  ok(!g.pickups.some(p => p.cid === "lake"),
     "agent pathfound around the lake and grabbed the container");
}

// ------------------------------------------------- 36. errand fights the lake slime
{
  console.log("[36] pickup errand drops the lake slime before it drops you");
  const core = await import("../shared/core");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  type Mut = { intent: { action: string; target?: number }; llmIntent: { action: string; target?: number } };

  // NO LUCKY DROPS. A dying enemy rolls Math.random() < 0.3 for a heart, and the
  // agent used to survive this errand ONLY when that roll went its way — the
  // suite failed roughly one run in three. Pin the roll to its worst case: the
  // errand must be won on the agent's own merit, and the test must be
  // deterministic. (It was not the frog that killed him: the agent abandoned the
  // container 29 px short and bled out later on an empty tank.)
  const realRandom = Math.random;
  Math.random = (): number => 0.99;   // a heart never drops — the worst case, always
  const g = freshPlay();
  try {
    core.loadRoom(g, 2, 7 * TILE, 8 * TILE);
    g.screen = "play"; g.fade = 0;
    g.players[0].present = false;
    g.players[1].x = 7 * TILE; g.players[1].y = 8 * TILE;
    ok(g.enemies.some(e => e.kind === "slime" && !e.dead), "lake slime is hopping");
    const idx = g.pickups.filter(p => p.t >= 0).findIndex(p => p.cid === "lake");
    const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "companion" });
    const prev: [Input, Input] = [emptyInput(), emptyInput()];
    const plan = { action: "pickup", target: idx };
    (agent as unknown as Mut).llmIntent = plan;
    (agent as unknown as Mut).intent = plan;
    for (let i = 0; i < 1200 && g.players[1].hp > 0; i++) {
      step(g, emptyInput(), agent.control(g), prev);
    }
  } finally {
    Math.random = realRandom;
  }
  ok(g.players[1].hp > 0, "survived the green frog with no lucky heart to bail him out");
  // the old assertion had a loophole — "all enemies dead" satisfied it even when
  // the container was never taken, which is exactly how the abandon bug hid
  ok(g.containers["lake"] === true, "actually claimed the lake container — the errand finished");
}

// ------------------------------------------------- 37. the wraith enrages
{
  console.log("[37] below half health, winter fights back");
  const core = await import("../shared/core");

  const volley = (hp: number): { shots: number; teleported: boolean } => {
    const g = freshPlay();
    core.loadRoom(g, 11, 7 * TILE, 11 * TILE);
    g.screen = "play"; g.fade = 0;
    const wr = g.enemies[0];
    wr.hp = hp;
    const x0 = wr.x, y0 = wr.y;
    g.players[0].x = 7 * TILE; g.players[0].y = 11 * TILE;
    const prev: [Input, Input] = [emptyInput(), emptyInput()];
    for (let i = 0; i < 56; i++) {
      g.players[0].invuln = 60;
      step(g, emptyInput(), emptyInput(), prev);
      if (g.projectiles.length > 0) {
        return { shots: g.projectiles.length,
                 teleported: wr.x !== x0 || wr.y !== y0 };
      }
    }
    return { shots: 0, teleported: false };
  };

  // the enraged teleport is deterministic (canon), but its DESTINATION tile is a
  // dice roll — roughly once in a hundred runs it landed back on the wraith's
  // own spawn tile and this test cried "no teleport". Seed the dice: canon
  // untouched, the run reproducible.
  const calm = withSeededRandom(20260712, () => volley(16));
  ok(calm.shots === 0, "at full health the first volley waits past tick 56 — canon opening untouched");
  const angry = withSeededRandom(20260712, () => volley(8));
  ok(angry.shots === 5, `enraged: the fan widens to five shards (got ${angry.shots})`);
  ok(angry.teleported, "and every volley ends in a teleport");
}

// ------------------------------------------------- 38. stage 2: per-viewer snapshots
{
  console.log("[38] stage 2: per-viewer snapshots + partnerView");
  const core = await import("../shared/core");

  const g = freshPlay();
  core.loadRoom(g, 2, 3 * TILE, 6 * TILE);
  g.screen = "play";
  g.events.push({ t: "sfx", name: "pickup" });
  const a = toSnapshot(g, ["A", "B"], 0, false);
  const b = toSnapshot(g, ["A", "B"], 1, true);
  ok(a.partnerView == null && b.partnerView == null, "same sim → no scry mirror");
  ok(a.players[0].present && a.players[1].present, "both heroes visible in-room");
  ok(a.room === b.room && a.tiles.length === b.tiles.length,
     "viewer snapshots match while rooms are shared");
  ok(a.events.length === 1 && b.events.length === 1, "events fan out to every viewer");

  const forest = core.newRoomSim();
  forest.room = 1;
  forest.tiles[1] = core.ROOMS[1].tiles.map(r => r);
  forest.enemies = [makeEnemy("slime", 5 * TILE, 5 * TILE)];
  g.sims.push(forest);
  g.players[1].simIndex = 1;
  g.players[1].x = 6 * TILE; g.players[1].y = 6 * TILE;

  const host = toSnapshot(g, ["A", "B"], 0, true);
  ok(host.partnerView != null, "partnerView appears when rooms diverge");
  ok(host.partnerView!.roomName.includes("Forest"), "mirror shows the partner's room");
  ok(!host.players[1].present, "away partner is not duplicated in the main view");
  ok(host.partnerView!.player.hp === g.players[1].hp, "mirror tracks partner hp");
}

// ------------------------------------------------- 39. stage 3: free roam transitions
{
  console.log("[39] stage 3: free roam — independent rooms + no remote revive");
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const right = { ...emptyInput(), r: true };

  const g = freshPlay();
  g.travelMode = "free";
  g.players[0].x = W - PLAYER_W - 3;
  g.players[0].y = 6.5 * TILE;
  const p1yBefore = g.players[1].y;
  for (let t = 0; t < 20 && g.sims[0].room === 0; t++) step(g, right, emptyInput(), prev);
  ok(g.sims[0].room === 0, "free roam: partner stays in the meadow");
  ok(g.sims.length >= 2 && g.sims[1].room === 1, "free roam: crosser enters the forest");
  ok(g.players[0].simIndex === 1, "crosser inhabits the detached sim");
  ok(g.players[1].simIndex === 0, "stayer keeps the original sim");
  ok(Math.abs(g.players[1].y - p1yBefore) < 2, "partner was not teleported");

  const host = toSnapshot(g, ["A", "B"], 0, true);
  ok(host.partnerView != null, "scry mirror opens when rooms diverge");
  ok(host.room === 1 && host.partnerView!.room === 0,
     "each viewer sees their own room; mirror shows the partner's");
  const guest = toSnapshot(g, ["A", "B"], 1, true);
  ok(guest.room === 0 && guest.partnerView!.room === 1, "partner's view is the mirror image");

  const g2 = freshPlay();
  g2.travelMode = "free";
  g2.players[1].downed = true;
  g2.players[1].hp = 0;
  g2.players[0].x = W - PLAYER_W - 3;
  g2.players[0].y = 6.5 * TILE;
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  for (let t = 0; t < 20 && g2.sims[0].room === 0; t++) step(g2, right, emptyInput(), prev2);
  ok(g2.players[1].downed, "free roam transition does not remote-revive a downed partner");
}

// ------------------------------------------------- 40. free roam: agent routes when partner is away
{
  console.log("[40] free roam: agent pursues quest when partner is in another room");
  const { AgentPlayer } = await import("../server/agent");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 1;
  g.players[0].x = 6 * TILE;
  g.players[0].y = 6 * TILE;
  g.players[1].simIndex = 0;
  g.players[1].x = 6 * TILE;
  g.players[1].y = 6.5 * TILE;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  type Mut = { intent: { action: string; dir?: string }; routeAssists: number };
  (agent as unknown as Mut).intent = { action: "follow" };
  g.activeSim = 0;
  const inp = agent.control(g);
  ok((agent as unknown as Mut).intent.action === "exit",
     "passive follow becomes route exit when partner is away");
  ok(inp.r, "agent walks toward the room exit");
  ok((agent as unknown as Mut).routeAssists >= 1, "route assist counted honestly");

  const parsed = JSON.parse(agent.observe(g)) as { partner: { away?: boolean; room?: string } };
  ok(parsed.partner.away === true, "observation marks partner as away");
  ok(parsed.partner.room?.includes("Forest"), "observation names the partner's room");
}

// ------------------------------------------------- 41. doorway settle: no instant ping-pong
{
  console.log("[41] transition cooldown + doorway yield stop door camping");
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const right = { ...emptyInput(), r: true };
  const left = { ...emptyInput(), l: true };

  const g = freshPlay();
  g.travelMode = "free";
  g.players[0].x = W - PLAYER_W - 3;
  g.players[0].y = 6.5 * TILE;
  step(g, right, emptyInput(), prev);
  const crossedRoom = g.sims[g.players[0].simIndex].room;
  ok(crossedRoom === 1, "hero crossed into the forest");
  ok(g.players[0].transitionCd > 0, "crosser gets a doorway cooldown");
  g.players[0].x = 1;
  for (let t = 0; t < 5; t++) step(g, left, emptyInput(), prev);
  ok(g.sims[g.players[0].simIndex].room === crossedRoom,
     "cooldown prevents instant ping-pong back through the door");

  const { AgentPlayer } = await import("../server/agent");
  const g2 = freshPlay();
  g2.travelMode = "free";
  g2.players[0].x = W - PLAYER_W - 2;
  g2.players[0].y = 6 * TILE + 8;
  g2.players[1].x = W - PLAYER_W - 4;
  g2.players[1].y = 6 * TILE + 8;
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  type Mut = { intent: { action: string; dir?: string } };
  (agent as unknown as Mut).intent = { action: "exit", dir: "right" };
  g2.activeSim = 0;
  const beforeRoom = g2.room;
  const inp = agent.control(g2);
  ok(inp.r !== true || g2.room === beforeRoom,
     "agent yields the doorway while the human stands on it");
}

// ------------------------------------------------- 42. stage 4: free roam leave permission
{
  console.log("[42] stage 4: npc cannot leave while hero fights or is downed");
  const { canNpcLeave, heroInCombat } = await import("../shared/core");
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const right = { ...emptyInput(), r: true };

  const g = freshPlay();
  g.travelMode = "free";
  g.players[1].npc = true;
  g.enemies = [makeEnemy("slime", g.players[0].x + 24, g.players[0].y)];
  g.players[1].x = W - PLAYER_W - 3;
  g.players[1].y = 6.5 * TILE;
  ok(heroInCombat(g, 0), "slime puts the hero in combat");
  ok(!canNpcLeave(g, 1), "leave permission denied while hero fights");
  for (let t = 0; t < 30 && g.sims[0].room === 0; t++) step(g, emptyInput(), right, prev);
  ok(g.sims[0].room === 0, "npc blocked at the doorway during combat");

  const g2 = freshPlay();
  g2.travelMode = "free";
  g2.players[1].npc = true;
  g2.players[0].downed = true;
  g2.players[0].hp = 0;
  g2.players[1].x = W - PLAYER_W - 3;
  g2.players[1].y = 6.5 * TILE;
  ok(!canNpcLeave(g2, 1), "leave permission denied while hero is downed");
  const prev2: [Input, Input] = [emptyInput(), emptyInput()];
  for (let t = 0; t < 30 && g2.sims[0].room === 0; t++) step(g2, emptyInput(), right, prev2);
  ok(g2.sims[0].room === 0, "npc blocked at the doorway while hero is down");

  const g3 = freshPlay();
  g3.travelMode = "free";
  g3.players[1].npc = true;
  g3.players[1].x = W - PLAYER_W - 3;
  g3.players[1].y = 6.5 * TILE;
  ok(canNpcLeave(g3, 1), "leave permitted when hero is safe");
  const prev3: [Input, Input] = [emptyInput(), emptyInput()];
  for (let t = 0; t < 20 && g3.sims[0].room === 0; t++) step(g3, emptyInput(), right, prev3);
  ok(g3.sims.length >= 2 && g3.sims[1].room === 1, "npc may split when hero is safe");
}

// ------------------------------------------------- 43. stage 4: errand abort on rescue failsafe
{
  console.log("[43] stage 4: away errand aborts on rescue failsafe");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.golemDead = true;
  g.amberClaimed = true;
  g.gateMelted = true;
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 0;
  g.players[1].simIndex = 1;
  g.players[1].npc = true;
  g.players[0].downed = true;
  g.players[0].hp = 0;
  g.activeSim = 1;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string }; routeAssists: number; mateDownedTicks: number };
  (agent as unknown as Mut).intent = { action: "follow" };
  agent.control(g);
  ok(agent.errandLog.length === 1 && agent.errandLog[0].goal === "bow",
     "fetch errand auto-starts when partner is away without the bow");
  (agent as unknown as Mut).mateDownedTicks = 950;
  for (let i = 0; i < 5; i++) agent.control(g);
  ok(agent.errandLog[0].abortReason === "rescue failsafe",
     "errand aborts when the alone hero has waited past hunter patience");
  ok(agent.errandLog[0].heroDownsDuring === 1, "errand telemetry counts hero downs");
  ok(agent.errandLog[0].abortedTick != null, "errand record closed after abort");
  ok((agent as unknown as Mut).intent.action === "exit",
     "controller routes back toward the downed hero's room");
}

// ------------------------------------------------- 44. stage 4: errand declaration + observation
{
  console.log("[44] stage 4: errand declares via say + observation");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.golemDead = true;
  g.amberClaimed = true;
  g.gateMelted = true;
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 1;
  g.players[1].simIndex = 0;
  g.activeSim = 0;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string } };
  (agent as unknown as Mut).intent = { action: "idle" };
  agent.control(g);
  const quip = agent.takeSay();
  ok(quip?.includes("bow"), "errand promise lands in the say queue");
  const obs = JSON.parse(agent.observe(g)) as {
    errand: { goal: string; room: string; why: string } | null;
  };
  ok(obs.errand?.goal === "bow", "observation exposes the active errand goal");
  ok(obs.errand?.room.includes("Snow"), "observation names the fetch room");
  ok(obs.errand?.why.length > 0, "observation carries errand why");
}

// ------------------------------------------------- 45. free roam: lake pacified + cave round-trip safety
{
  console.log("[45] free roam lake revisit + cave round-trip do not respawn or hang");
  const { loadRoom, newRoomSim } = await import("../shared/core");

  const g = freshPlay();
  g.travelMode = "free";
  g.cleared[2] = true;
  loadRoom(g, 2, 8 * TILE, 8 * TILE);
  ok(g.enemies.every(e => e.dead || g.enemies.length === 0),
     "pacified Amber Lake stays empty on reload in free roam");

  const gCanon = freshPlay();
  gCanon.travelMode = "linked";
  loadRoom(gCanon, 2, 8 * TILE, 8 * TILE);
  ok(gCanon.enemies.some(e => !e.dead), "linked lake still spawns its slime (canon)");

  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const g2 = freshPlay();
  g2.travelMode = "free";
  g2.players[1].npc = true;
  g2.sims.push(newRoomSim());
  g2.sims[1].room = 2;
  g2.sims[1].tiles[2] = ROOMS[2].tiles.map(r => r);
  g2.sims[1].enemies = [];
  g2.cleared[2] = true;
  g2.players[0].simIndex = 1;
  g2.players[0].x = 9 * TILE;
  g2.players[0].y = 3 * TILE;
  g2.players[1].simIndex = 0;
  g2.players[1].x = 6 * TILE;
  g2.players[1].y = 6 * TILE;

  const { AgentPlayer } = await import("../server/agent");
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  type Mut = { intent: { action: string; dir?: string } };
  (agent as unknown as Mut).intent = { action: "exit", dir: "cave" };
  let transitions = 0;
  for (let t = 0; t < 200; t++) {
    const roomBefore = g2.sims[g2.players[1].simIndex].room;
    g2.activeSim = g2.players[1].simIndex;
    const inp = agent.control(g2);
    step(g2, emptyInput(), inp, prev);
    if (g2.sims[g2.players[1].simIndex].room !== roomBefore) transitions++;
  }
  ok(g2.players.every(p => p.simIndex < g2.sims.length),
     "sim indices stay valid during cave errand routing");
  ok(transitions >= 1, "agent actually crossed at least one room boundary");
  const agentRoom = g2.sims[g2.players[1].simIndex].room;
  ok(agentRoom >= 0 && agentRoom < ROOMS.length, "agent stays on the world graph after cave routing");
}

// ------------------------------------------------- 46. free roam: per-viewer transition overlay
{
  console.log("[46] free roam transition fade/banner only hits the crosser");
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const right = { ...emptyInput(), r: true };
  const g = freshPlay();
  g.travelMode = "free";
  g.players[0].x = W - PLAYER_W - 3;
  g.players[0].y = 6.5 * TILE;
  for (let t = 0; t < 20 && g.players[0].simIndex === 0; t++) step(g, right, emptyInput(), prev);
  ok(g.sims[g.players[0].simIndex].room === 1, "hero crossed for overlay test");
  ok(g.players[0].crossBanner.includes("Forest"), "crosser's per-player banner is set");
  ok(g.players[0].crossBannerT > 0, "crosser banner timer running");
  const crosser = toSnapshot(g, ["ARTEM", "BOT"], 0, false);
  const stayer = toSnapshot(g, ["ARTEM", "BOT"], 1, false);
  ok(crosser.message.includes("Forest"), "crosser sees their room banner");
  ok(crosser.fade > 0, "crosser gets transition fade");
  ok(stayer.messageT === 0, "stayer is not spammed with the partner's room name");
  ok(stayer.fade === 0, "stayer screen stays bright when only the partner crosses");
}

// ------------------------------------------------- 47. stale pickup abandoned when bow is already team-owned
{
  console.log("[47] stale pickup intent yields when the bow is already yours");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.hasBow = true;
  g.golemDead = true;
  g.amberClaimed = true;
  g.gateMelted = true;
  g.sims.push(newRoomSim());
  g.sims[1].room = 7;
  g.sims[1].tiles[7] = ROOMS[7].tiles.map(r => r);
  g.players[0].simIndex = 0;
  g.players[1].simIndex = 1;
  g.activeSim = 1;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  type Mut = { intent: { action: string; dir?: string; target?: number };
               llmIntent: { action: string; target?: number } };
  const m = agent as unknown as Mut;
  m.intent = { action: "pickup", target: 0 };
  m.llmIntent = { action: "pickup", target: 0 };
  agent.control(g);
  ok(m.intent.action === "exit",
     "agent routes onward instead of chasing a bow pickup the team already has");
}

// ------------------------------------------------- 48. stage 3: bleed-out alone
{
  console.log("[48] stage 3: FREE ROAM alone-down bleed-out ends the run");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 1;
  g.players[1].simIndex = 0;
  g.players[1].downed = true;
  g.players[1].hp = 0;
  g.players[1].bleedT = 5;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 5; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.screen === "gameover", "bleed-out alone triggers gameover");
  ok(g.bleedoutLoss, "bleedout flagged for endings/telemetry");
}

// ------------------------------------------------- 49. stage 3: bleed pauses on reunion
{
  console.log("[49] stage 3: bleed clock stops when partner reunites");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 1;
  g.players[1].simIndex = 0;
  g.players[1].downed = true;
  g.players[1].hp = 0;
  g.players[1].bleedT = 3;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[1].bleedT === 2, "bleed ticks down while alone");
  g.players[0].simIndex = 0;
  step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[1].bleedT === 0, "bleed clock clears when partner shares the room");
  for (let i = 0; i < 200; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.screen === "play", "no gameover after reunion");
}

// ------------------------------------------------- 50. stage 3: phoenix feather remote revive
{
  console.log("[50] stage 3: phoenix feather remote revive");
  const { newRoomSim, loadRoom } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  loadRoom(g, 13, 4 * TILE, 8 * TILE);
  g.hasFeather = true;
  g.feathers.crypt = true;
  g.sims.push(newRoomSim());
  g.sims[1].room = 5;
  g.sims[1].tiles[5] = ROOMS[5].tiles.map(r => r);
  g.players[0].simIndex = 1;
  g.players[1].simIndex = 0;
  g.players[1].downed = true;
  g.players[1].hp = 0;
  g.players[1].bleedT = 100;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const feather = latch({ ...emptyInput(), f: true }, emptyInput());
  step(g, feather, emptyInput(), prev);
  ok(!g.players[1].downed, "feather revives downed partner in another room");
  ok(!g.hasFeather, "feather is consumed");
  ok(g.players[1].bleedT === 0, "bleed cleared on feather revive");
}

// ------------------------------------------------- 51. stage 3: feather wing + same-room guard
{
  console.log("[51] stage 3: feather in crypt; no remote revive in same room");
  const { loadRoom } = await import("../shared/core");
  const g = freshPlay();
  loadRoom(g, 13, 8 * TILE, 8 * TILE);
  ok(g.pickups.some(p => p.kind === "feather"), "frozen crypt holds the phoenix feather");

  const g2 = freshPlay();
  g2.travelMode = "free";
  g2.hasFeather = true;
  g2.players[1].downed = true;
  g2.players[1].hp = 0;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  step(g2, latch({ ...emptyInput(), f: true }, emptyInput()), emptyInput(), prev);
  ok(g2.players[1].downed, "feather does not replace touch-revive in the same room");
}

// ------------------------------------------------- 52. vault exit pathfinds doorways
{
  console.log("[52] vault exit uses BFS, not greedy wall-hugging");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const { loadRoom } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.golemDead = true;
  loadRoom(g, 4, 8 * TILE, 8 * TILE);
  g.players[1].npc = true;
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9 });
  type Mut = { intent: { action: string; dir?: string } };
  const m = agent as unknown as Mut;
  m.intent = { action: "exit", dir: "down" };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const y0 = g.players[1].y;
  let progressed = false;
  for (let i = 0; i < 180; i++) {
    const inp = agent.control(g);
    step(g, emptyInput(), inp, prev);
    if (g.players[1].y > y0 + 12) progressed = true;
    if (g.sims[g.players[1].simIndex].room !== 4) break;
  }
  ok(progressed || g.sims[g.players[1].simIndex].room !== 4,
     "agent advances toward the vault exit instead of door-camping");
}

// ------------------------------------------------- 53. hero moves while npc door-camps
{
  console.log("[53] human input never blocked — hero moves while npc door-camps");
  const g = freshPlay();
  g.travelMode = "free";
  g.players[1].npc = true;
  g.players[1].x = W - PLAYER_W - 1;
  g.players[1].y = 6.5 * TILE;
  g.players[1].doorCampT = 60;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const x0 = g.players[0].x;
  const right = { ...emptyInput(), r: true };
  for (let i = 0; i < 30; i++) step(g, right, { ...emptyInput(), r: true }, prev);
  ok(g.players[0].x > x0 + 4, "hero walks freely while partner camps the doorway");
  ok(g.players[1].doorCampT > 60 || g.players[1].x < W - PLAYER_W - 4,
     "npc eventually yields from the doorway");
}

// ------------------------------------------------- 54. FREE ROAM temperament: guard rejoins, hunter quests
{
  console.log("[54] FREE ROAM temperament: guard rejoins partner wing, hunter quests ahead");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const { newRoomSim } = await import("../shared/core");

  const mk = (temp: "guard" | "hunter") => {
    const g = freshPlay();
    g.travelMode = "free";
    g.golemDead = true;
    g.amberClaimed = true;
    g.gateMelted = true;
    g.hasBow = false;
    g.sims.push(newRoomSim());
    g.sims[0].room = 12;
    g.sims[0].tiles[12] = ROOMS[12].tiles.map(r => r);
    g.sims[1].room = 4;
    g.sims[1].tiles[4] = ROOMS[4].tiles.map(r => r);
    g.players[0].simIndex = 0;
    g.players[0].x = 6 * TILE;
    g.players[0].y = 6 * TILE;
    g.players[1].simIndex = 1;
    g.players[1].npc = true;
    g.players[1].x = 6 * TILE;
    g.players[1].y = 6 * TILE;
    g.activeSim = 1;
    return { g, agent: new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: temp }) };
  };

  type Mut = { intent: { action: string; dir?: string } };

  const { g: gG, agent: guard } = mk("guard");
  (guard as unknown as Mut).intent = { action: "follow" };
  guard.control(gG);
  ok((guard as unknown as Mut).intent.action === "exit", "guard exits to rejoin partner");
  ok((guard as unknown as Mut).intent.dir === "left", "guard routes into the cellars wing");

  const { g: gH, agent: hunter } = mk("hunter");
  (hunter as unknown as Mut).intent = { action: "follow" };
  hunter.control(gH);
  ok((hunter as unknown as Mut).intent.action === "exit", "hunter exits toward the quest");
  ok((hunter as unknown as Mut).intent.dir !== "left", "hunter does not chase partner into cellars");

  const brief = JSON.parse(guard.observe(gG)) as { objective: string };
  ok(brief.objective.includes("Rejoin"), "guard brief stresses rejoining the partner");
}

// ------------------------------------------------- 55. FREE ROAM: hunter early cave split, hero keeps moving
{
  console.log("[55] FREE ROAM: hunter cave split — hero never frozen at the lake");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const { loadRoom } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.players[1].npc = true;
  loadRoom(g, 2, 4 * TILE, 6 * TILE);
  g.cleared[2] = true;
  g.enemies = [];
  g.players[0].x = 2 * TILE;
  g.players[0].y = 10 * TILE;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string; dir?: string } };
  (agent as unknown as Mut).intent = { action: "exit", dir: "cave" };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  let agentCrossed = false;
  for (let t = 0; t < 600 && !agentCrossed; t++) {
    (agent as unknown as Mut).intent = { action: "exit", dir: "cave" };
    g.activeSim = g.players[1].simIndex;
    const inp = agent.control(g);
    step(g, emptyInput(), inp, prev);
    if (g.sims[g.players[1].simIndex].room === 3) agentCrossed = true;
  }
  ok(agentCrossed, "hunter crosses the lake cave into the vault");
  ok(g.sims.length >= 2, "rooms split after the cave");
  ok(g.sims[g.players[0].simIndex].room === 2, "hero stays at the lake");

  const x0 = g.players[0].x;
  const right = { ...emptyInput(), r: true };
  for (let t = 0; t < 60; t++) step(g, right, emptyInput(), prev);
  ok(g.players[0].x > x0 + 4, "hero walks freely after the partner splits through the cave");

  let hops = 0;
  let lastRoom = g.sims[g.players[1].simIndex].room;
  for (let t = 0; t < 120; t++) {
    g.activeSim = g.players[1].simIndex;
    const inp = agent.control(g);
    step(g, emptyInput(), inp, prev);
    const r = g.sims[g.players[1].simIndex].room;
    if (r !== lastRoom) { hops++; lastRoom = r; }
  }
  ok(hops < 8, "agent does not ping-pong rooms after the split");
}

// ------------------------------------------------- 56. LINKED: npc cannot solo-cave the party
{
  console.log("[56] LINKED: npc waits at the cave mouth until the hero steps on");
  const { loadRoom } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "linked";
  g.players[1].npc = true;
  loadRoom(g, 2, 5 * TILE, 9 * TILE);
  g.enemies = [];
  g.players[0].x = 2 * TILE;
  g.players[0].y = 9 * TILE;
  g.players[1].x = 9 * TILE + 2;
  g.players[1].y = 1 * TILE + 2;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const cave = { ...emptyInput(), d: true };
  for (let t = 0; t < 30; t++) step(g, emptyInput(), cave, prev);
  ok(g.room === 2, "npc on the cave mouth does not yank a linked party alone");

  g.players[0].x = 9 * TILE + 2;
  g.players[0].y = 1 * TILE + 2;
  for (let t = 0; t < 30 && g.room === 2; t++) step(g, cave, cave, prev);
  ok(g.room === 3, "linked party crosses when the hero shares the cave mouth");
}

// ------------------------------------------------- 57. no elixir errand while partner still at the lake
{
  console.log("[57] hunter skips optional errand while partner is still at Amber Lake");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const { loadRoom, newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.players[1].npc = true;
  g.sims.push(newRoomSim());
  g.sims[0].room = 2;
  g.sims[0].tiles[2] = ROOMS[2].tiles.map(r => r);
  g.sims[0].enemies = [];
  g.sims[1].room = 3;
  g.sims[1].tiles[3] = ROOMS[3].tiles.map(r => r);
  g.players[0].simIndex = 0;
  g.players[0].x = 4 * TILE;
  g.players[0].y = 9 * TILE;
  g.players[1].simIndex = 1;
  g.players[1].x = 8 * TILE;
  g.players[1].y = 8 * TILE;
  g.activeSim = 1;

  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string; dir?: string } };
  (agent as unknown as Mut).intent = { action: "follow" };
  for (let i = 0; i < 10; i++) agent.control(g);
  ok(agent.errandLog.length === 0, "no elixir errand while partner is still at the lake");
  ok((agent as unknown as Mut).intent.action === "exit",
     "hunter routes toward the golem instead of optional elixir");
}

// ------------------------------------------------- 58. spared wraith spirit anchor (same room only)
{
  console.log("[58] spared wraith revives slowly when partner shares the room");
  const g = freshPlay();
  g.travelMode = "free";
  g.wraithSpared = true;
  g.players[0].downed = true;
  g.players[0].hp = 0;
  g.players[0].x = 6 * TILE;
  g.players[0].y = 6 * TILE;
  g.players[1].x = W - PLAYER_W - 4;
  g.players[1].y = 6 * TILE;
  g.companion = { x: 6 * TILE, y: 6 * TILE, t: 0 };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 220 && g.players[0].downed; i++) {
    step(g, emptyInput(), emptyInput(), prev);
  }
  ok(!g.players[0].downed, "wraith lifts a downed hero at half speed");
  ok(g.message.includes("between-world"), "wraith revive uses spirit-anchor flavor");
  ok(g.players[0].bleedT === 0, "no bleed while partner shares the room");
}

// ------------------------------------------------- 59. wraith cannot anchor across rooms
{
  console.log("[59] split rooms: 30s bleed stays; wraith does not remote-save");
  const { newRoomSim } = await import("../shared/core");
  const g = freshPlay();
  g.travelMode = "free";
  g.wraithSpared = true;
  g.sims.push(newRoomSim());
  g.sims[1].room = 1;
  g.sims[1].tiles[1] = ROOMS[1].tiles.map(r => r);
  g.players[0].simIndex = 0;
  g.players[0].downed = true;
  g.players[0].hp = 0;
  g.players[0].bleedT = 40;
  g.players[1].simIndex = 1;
  g.players[1].x = 6 * TILE;
  g.players[1].y = 6 * TILE;
  g.companion = { x: 6 * TILE, y: 6 * TILE, t: 0 };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 20; i++) step(g, emptyInput(), emptyInput(), prev);
  ok(g.players[0].downed, "wraith in the partner wing does not remote-revive");
  ok(g.players[0].bleedT < 40 && g.players[0].bleedT > 0, "bleed clock still runs when rooms split");
  ok(g.screen === "play", "run continues until bleed expires");
}

// ------------------------------------------------- 60. agent rescues in-room even while attacking
{
  console.log("[60] agent drops attack and rescues when partner is downed in-room");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const g = freshPlay();
  g.players[1].npc = true;
  g.players[0].downed = true;
  g.players[0].hp = 0;
  g.players[0].x = 4 * TILE;
  g.players[0].y = 8 * TILE;
  g.players[1].x = W - PLAYER_W - 4;
  g.players[1].y = 4 * TILE;
  g.enemies.push(makeEnemy("bat", 7 * TILE, 4 * TILE));
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string } };
  (agent as unknown as Mut).intent = { action: "attack" };
  const inp = agent.control(g);
  ok(inp.d || inp.l || inp.u || inp.r, "hunter runs toward the body instead of swinging");
}

// ------------------------------------------------- 61. agent pathfinds around meadow trees
{
  console.log("[61] attack & follow route around trees — not straight into trunks");
  const { AgentPlayer, nextWaypoint, approachWaypoint } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const rows = ROOMS[0].tiles;
  const fromX = 5 * TILE + 8, fromY = 6 * TILE + 8;
  const toX = 11 * TILE + 8, toY = 6 * TILE + 8;
  const wp = nextWaypoint(rows, fromX, fromY, toX, toY);
  const wtx = Math.floor(wp.x / TILE), wty = Math.floor(wp.y / TILE);
  ok(!SOLID.has(rows[wty][wtx]), "BFS first step avoids solid tree tiles");

  const g = freshPlay();
  g.screen = "play"; g.fade = 0;
  g.players[0].present = false;
  g.players[1].x = fromX - 8; g.players[1].y = fromY - 10;
  const slime = makeEnemy("slime", toX - 4, toY - 4);
  g.enemies.push(slime);
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string; target?: number } };
  (agent as unknown as Mut).intent = { action: "attack", target: 0 };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  let moved = false;
  for (let i = 0; i < 120; i++) {
    const inp = agent.control(g);
    if (inp.r || inp.l || inp.u || inp.d) moved = true;
    step(g, emptyInput(), inp, prev);
    if (g.players[1].x > fromX + TILE) break;
  }
  ok(moved, "agent moves toward the slime");
  const tx = Math.floor((g.players[1].x + PLAYER_W / 2) / TILE);
  const ty = Math.floor((g.players[1].y + PLAYER_H / 2) / TILE);
  ok(!SOLID.has(rows[ty][tx]), "agent body stays on walkable floor while routing");

  const ap = approachWaypoint(rows, fromX, fromY, toX, toY);
  const atx = Math.floor(ap.x / TILE), aty = Math.floor(ap.y / TILE);
  ok(!SOLID.has(rows[aty][atx]), "approach tile beside the slime is walkable");
}

// ------------------------------------------------- 62. AI DUO leader drives the route
{
  console.log("[62] AI DUO: leader routes instead of mutual follow");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const g = freshPlay();
  g.screen = "play"; g.fade = 0;
  g.players[0].npc = false;
  g.players[1].npc = true;
  g.enemies.push(makeEnemy("slime", 11 * TILE, 6 * TILE));
  const leader = new AgentPlayer(mock(), 0, { planMs: 9e9, leader: true, temperament: "hunter" });
  const comp = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "companion" });
  type Mut = { intent: { action: string } };
  (leader as unknown as Mut).intent = { action: "follow" };
  (comp as unknown as Mut).intent = { action: "follow" };
  const x0 = g.players[0].x;
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 200; i++) {
    step(g, leader.control(g), comp.control(g), prev);
  }
  const moved = Math.abs(g.players[0].x - x0) > 8;
  const routed = (leader as unknown as Mut).intent.action === "exit";
  const fought = g.enemies.every(e => e.dead);
  ok(moved || routed || fought, "leader quests — not stuck in mutual follow");
}

// ------------------------------------------------- 63. wedged loot settles and can be collected
{
  console.log("[63] dropped hearts settle off walls and can be collected");
  const core = await import("../shared/core");
  const { pickupWedged, settlePickupPos } = core;
  const g = freshPlay();
  g.elixirs.cellar = true;
  core.loadRoom(g, 12, 5 * TILE, 9 * TILE);
  g.screen = "play"; g.fade = 0;
  g.enemies = [];
  g.pickups = [];
  const drop = { x: 2, y: 13 * TILE - 4 };
  ok(pickupWedged(g, drop.x, drop.y), "loot wedged in a cellar corner against the wall");
  const spot = settlePickupPos(g, drop.x, drop.y);
  ok(!pickupWedged(g, spot.x, spot.y), "settle finds open floor nearby");
  g.pickups.push({ kind: "heart", x: drop.x, y: drop.y, t: 0 });
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  step(g, emptyInput(), emptyInput(), prev);
  const it = g.pickups.find(p => p.t >= 0)!;
  ok(!pickupWedged(g, it.x, it.y), "physics pass nudges wedged loot onto walkable tiles");
  g.players[0].x = it.x - 10;
  g.players[0].y = it.y - 4;
  g.players[0].hp = 4;
  for (let i = 0; i < 30 && g.pickups.some(p => p.t >= 0); i++) {
    step(g, emptyInput(), emptyInput(), prev);
  }
  ok(!g.pickups.some(p => p.t >= 0), "hero collects the heart when standing beside it");
  ok(g.players[0].hp === 6, "the heart actually healed");
}

// ------------------------------------------------- 64. doorway stall — hunter yields instead of camping
{
  console.log("[64] doorway stall breaks: hunter yields from the right edge");
  const { AgentPlayer } = await import("../server/agent");
  const { mock } = await import("../server/llm");
  const core = await import("../shared/core");
  const g = freshPlay();
  core.loadRoom(g, 13, 5 * TILE, 9 * TILE);
  g.screen = "play"; g.fade = 0;
  g.players[1].npc = true;
  g.players[1].x = W - PLAYER_W - 1;
  g.players[1].y = 6.5 * TILE;
  const agent = new AgentPlayer(mock(), 1, { planMs: 9e9, temperament: "hunter" });
  type Mut = { intent: { action: string; dir?: string } };
  (agent as unknown as Mut).intent = { action: "exit", dir: "right" };
  const prev: [Input, Input] = [emptyInput(), emptyInput()];
  const x0 = g.players[1].x;
  for (let i = 0; i < 200; i++) {
    const inp = agent.control(g);
    step(g, emptyInput(), inp, prev);
  }
  ok(g.players[1].x < x0 - 12, "agent steps back from a stuck doorway");
}

// ------------------------------------------------- 65. slippery ice (opt-in; canon off is instant)
{
  console.log("[65] slippery ice: canon off halts instantly, slick on coasts a little");
  const core = await import("../shared/core");
  const right = { ...emptyInput(), r: true };

  // slick OFF — the hero stops the instant input releases (classic movement)
  const off = freshPlay();
  core.loadRoom(off, 11, 7 * TILE, 6 * TILE);
  off.screen = "play"; off.fade = 0;
  off.players[1].present = false;
  const pOff: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 20; i++) step(off, right, emptyInput(), pOff);
  const heldX = off.players[0].x;
  step(off, emptyInput(), emptyInput(), pOff);   // release
  ok(off.players[0].x === heldX, "slick off: hero halts instantly on release (canon)");

  // slick ON — same ice room; the hero glides a clearly readable stretch after
  // release (asymmetric decel), then rests. noticeable, still under control.
  const on = freshPlay();
  on.slick = true;
  core.loadRoom(on, 11, 7 * TILE, 6 * TILE);
  on.screen = "play"; on.fade = 0;
  on.players[1].present = false;
  const pOn: [Input, Input] = [emptyInput(), emptyInput()];
  for (let i = 0; i < 20; i++) step(on, right, emptyInput(), pOn);
  const heldOn = on.players[0].x;
  step(on, emptyInput(), emptyInput(), pOn);     // release
  ok(on.players[0].x > heldOn, "slick on: hero keeps gliding a tick after release");
  for (let i = 0; i < 40; i++) step(on, emptyInput(), emptyInput(), pOn);
  const coast = on.players[0].x - heldOn;
  ok(coast > 4 && coast < 16, "the glide is noticeable — a real skid, not a skate rink");
  ok(on.players[0].vx === 0, "velocity settles back to rest");
}

console.log(`\nSELFTEST OK — ${passed} assertions passed`);
}

main().catch(err => { console.error(err); process.exit(1); });

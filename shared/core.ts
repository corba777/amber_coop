/* =========================================================================
 *  AMBER COOP — shared simulation core
 *  Two-player server-authoritative version of "Ilya and the Amber Blade".
 *  Pure logic: no DOM, no audio. Emits events; the client renders them.
 * ========================================================================= */

export const TILE = 16;
export const COLS = 16;
export const ROWS = 14;
export const W = COLS * TILE;
export const H = ROWS * TILE;

export type Dir = 0 | 1 | 2 | 3; // down, up, right, left
export const DIRV: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

export const SOLID = new Set<string>(["t", "w", "r", "W", "L", "I", "F", "m", "d", "k", "v"]);

export interface Teleport { room: number; x: number; y: number; }
export interface RoomSpec {
  name: string;
  tiles: string[];
  exits: Partial<Record<"left" | "right" | "up" | "down", number>>;
  enemies: { kind: EnemyKind; x: number; y: number }[];
  teleport?: Teleport;
  keyOnClear?: boolean;
  boss?: boolean;
}

//                 0123456789ABCDEF
const ROOM_MEADOW = [
  "tttttttIIttttttt",
  "tggggggggggggggt",
  "tgghgggggghhgggt",
  "tggggggggggggggt",
  "tghggggggggghggt",
  "tggggggggggggggt",
  "tgggggggggpppppp",
  "tggggggggggppppp",
  "tggggggggggggggt",
  "tgghggggggggghgt",
  "tggggggggggggggt",
  "tgggghgggghggggt",
  "tggggggggggggggt",
  "tttttttFFttttttt",
];
const ROOM_FOREST = [
  "tttttttttttttttt",
  "tggtggggggggtggt",
  "tggggggthgggggtt",
  "tgtggggggggggggt",
  "tggggghggtggghgt",
  "tggggggggggggggt",
  "ggggggggggpppppp",
  "gggggggggggppppp",
  "tggggtggggggggtt",
  "tgghggggggghgggt",
  "tggggggtgggggggt",
  "tgtgggggggtggggt",
  "tggggggggggggggt",
  "tttttttggttttttt",
];
const ROOM_LAKE = [
  "tttttttttttttttt",
  "tggggggrrcrrgggt",
  "tgggggggrprggggt",
  "tggggggggpgggggt",
  "tgggggggggswwwwt",
  "tggggggggsswwwwt",
  "gggggggggsswwwwt",
  "ggggggggsswwwwwt",
  "tgggggggsswwwwwt",
  "tggggggggsswwwwt",
  "tgghggggggsswwwt",
  "tggggggggggsswwt",
  "tggggggggggggggt",
  "tttttttttttttttt",
];
const ROOM_HALL = [
  "WWWWWWWffWWWWWWW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WfffWffffffWfffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WfffWffffffWfffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WWWWWWWccWWWWWWW",
  "WWWWWWWWWWWWWWWW",
];
const ROOM_GUARD = [
  "WWWWWWWLLWWWWWWW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "fffffffffffffffW",
  "fffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WWWWWWWffWWWWWWW",
];
const ROOM_BOSS = [
  "WWWWWWWWWWWWWWWW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WWWWWWWffWWWWWWW",
];
const ROOM_SNOWFIELD = [
  "mmmmmmmnnmmmmmmm",
  "mnnnnnnnnnnnnnnm",
  "mnndnnnnnnnndnnm",
  "mnnnnnniinnnnnnm",
  "mnnnnniiiinnnnnm",
  "mndnnniiiinnndnm",
  "mnnnnnniinnnnnnm",
  "mnnnnnnnnnnnnnnm",
  "mnndnnnnnnndnnnm",
  "mnnnnnnnnnnnnnnm",
  "mnnnnnnnnnnnnnnm",
  "mndnnnnnnnnnndnm",
  "mnnnnnnnnnnnnnnm",
  "mmmmmmmnnmmmmmmm",
];
const ROOM_FROSTWOODS = [
  "mmmmmmmmmmmmmmmm",
  "mddddnnnnnnddnnm",
  "mdnndnnnnnnnnnnm",
  "mdnndnnndnnndnnm",
  "mddnddnnnnnnnnnm",
  "mnnnnnnnndnnnnnm",
  "mnnnnnnnnnnnnnnn",
  "mnndnnnnnnnnnnnn",
  "mnnnnnndnnndnnnm",
  "mndnnnnnnnnnnnnm",
  "mnnnnnndnnnnndnm",
  "mnnndnnnnndnnnnm",
  "mnnnnnnnnnnnnnnm",
  "mmmmmmmnnmmmmmmm",
];
const ROOM_GLACIER = [
  "mmmmmmmmmmmmmmmm",
  "mnnnnnmmcmmnnnnm",
  "mnnnnnnmnmnnnnnm",
  "mnnnnnnnnnnnnnnm",
  "mnndnnnniinnndnm",
  "mnnnnnniiiinnnnm",
  "nnnnnnnniinnnnnm",
  "nnnnnnnnnnnnnnnm",
  "mnnnnnnnnnnndnnm",
  "mndnnnnnnnnnnnnm",
  "mnnnnnnndnnnnnnm",
  "mnnnnnnnnnnnndnm",
  "mnnnnnnnnnnnnnnm",
  "mmmmmmmmmmmmmmmm",
];
const ROOM_ICEHALL = [
  "WWWWWWWiiWWWWWWW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WWWWWWWccWWWWWWW",
  "WWWWWWWWWWWWWWWW",
];
const ROOM_ICEGUARD = [
  "WWWWWWWLLWWWWWWW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "iiiiiiiiiiiiiiiW",
  "iiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WWWWWWWiiWWWWWWW",
];
const ROOM_WRAITH = [
  "WWWWWWWWWWWWWWWW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WWWWWWWiiWWWWWWW",
];

const ROOM_CELLAR = [
  "WWWWWWWWWWWWWWWW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WffffWffffWffffW",
  "WffffffffffffffW",
  "WfWffffffffffWff",
  "Wfffffffffffffff",
  "WffffWffffWffffW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WWWWWWWWWWWWWWWW",
];
const ROOM_CRYPT = [
  "WWWWWWWffWWWWWWW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiWiiiiWiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiWiiiiiiiiiiWii",
  "Wiiiiiiiiiiiiiii",
  "WiiiiWiiiiWiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiWiiiiiiiiWiiW",
  "WiiiiiiiiiiiiiiW",
  "WiiiiiiiiiiiiiiW",
  "WWWWWWWWWWWWWWWW",
];
const ROOM_EMBER_TUNNEL = [
  "kkkkkkkeekkkkkkk",
  "keeeeeeeeeeeeeek",
  "keevveeeeeevveek",
  "keevveeekeevveek",
  "keeeeeeekeeeeeek",
  "keeekeeeeeeekeek",
  "keeeeeevveeeeeee",
  "keeeeeevveeeeeee",
  "keekeeeeeeekeeek",
  "keeeeekeeeeeeeek",
  "keevveeeeeevveek",
  "keevveeeeeevveek",
  "keeeeeeeeeeeeeek",
  "kkkkkkkkkkkkkkkk",
];
const ROOM_EMBER_GUARD = [
  "kkkkkkkLLkkkkkkk",
  "keeeeeeeeeeeeeek",
  "keekeeeeeeeekeek",
  "keeeeevveeeeeeek",
  "keeeeevveeeeeeek",
  "keeeeeeeeeeekeek",
  "eeeeeeeeeeeeeeek",
  "eeeeeeeeeeeeeeek",
  "keekeeeeeeeeeeek",
  "keeeeeevveeeeeek",
  "keeeeeevveeekeek",
  "keekeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "kkkkkkkkkkkkkkkk",
];
// optional skate-puzzle wing (tile "z" = commit-slide ice, grip-floor "f" borders
// so you always board and disembark on solid ground); dwellers slide too. Two
// doors: top-centre from the meadow (early access), bottom-centre from the crypt.
const ROOM_SKATE = [
  "WWWWWWWffWWWWWWW",
  "WffffffffffffffW",
  "WzzzzzzzzzzzzzzW",
  "WzzWzzzzzzzzWzzW",
  "WzzzzzzzzzzzzzzW",
  "WzzzzzzzzzzzzzzW",
  "WzzzzzzzzzzzzzzW",
  "WzzWzzzzzzWzzzzW",
  "WzzzzzzzzzzzzzzW",
  "WzzzzzzWWzzzzzzW",
  "WzzzzzzzzzzzzzzW",
  "WzzzzzzzzzzzzzzW",
  "WffffffffffffffW",
  "WWWWWWWffWWWWWWW",
];
const ROOM_EMBER_SANCTUM = [
  "kkkkkkkkkkkkkkkk",
  "keeeeeeeeeeeeeek",
  "kevveeeeeeeevvek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "kevveeeeeeeevvek",
  "keeeeeeeeeeeeeek",
  "keeeeeeeeeeeeeek",
  "kkkkkkkeekkkkkkk",
];

export const ROOMS: RoomSpec[] = [
  { name: "Sunlit Meadow", tiles: ROOM_MEADOW, exits: { right: 1, up: 6, down: 17 }, enemies: [] },
  {
    name: "Whispering Forest", tiles: ROOM_FOREST, exits: { left: 0, right: 2, down: 14 },
    enemies: [
      { kind: "slime", x: 5 * TILE, y: 3 * TILE },
      { kind: "slime", x: 10 * TILE, y: 10 * TILE },
      { kind: "slime", x: 12 * TILE, y: 4 * TILE },
    ],
  },
  {
    name: "Amber Lake", tiles: ROOM_LAKE, exits: { left: 1 },
    enemies: [{ kind: "slime", x: 5 * TILE, y: 9 * TILE }],
    teleport: { room: 3, x: 7.5 * TILE, y: 10 * TILE },
  },
  {
    name: "Old Vault — Hall", tiles: ROOM_HALL, exits: { up: 4 },
    enemies: [
      { kind: "bat", x: 4 * TILE, y: 6 * TILE },
      { kind: "bat", x: 11 * TILE, y: 7 * TILE },
    ],
    teleport: { room: 2, x: 9 * TILE, y: 3 * TILE },
  },
  {
    name: "Old Vault — Guard Room", tiles: ROOM_GUARD, exits: { down: 3, up: 5, left: 12 },
    keyOnClear: true,
    enemies: [
      { kind: "slime", x: 4 * TILE, y: 5 * TILE },
      { kind: "slime", x: 11 * TILE, y: 8 * TILE },
      { kind: "bat", x: 8 * TILE, y: 3 * TILE },
      { kind: "bat", x: 6 * TILE, y: 10 * TILE },
    ],
  },
  {
    name: "Heart of the Vault", tiles: ROOM_BOSS, exits: { down: 4 }, boss: true,
    enemies: [{ kind: "golem", x: 7 * TILE, y: 4 * TILE }],
  },
  {
    name: "Silent Snowfield", tiles: ROOM_SNOWFIELD, exits: { down: 0, up: 7 },
    enemies: [
      { kind: "slime", x: 11 * TILE, y: 9 * TILE },
      { kind: "wisp", x: 4 * TILE, y: 8 * TILE },
    ],
  },
  {
    name: "Frost Woods", tiles: ROOM_FROSTWOODS, exits: { down: 6, right: 8 },
    enemies: [
      { kind: "wisp", x: 10 * TILE, y: 4 * TILE },
      { kind: "wisp", x: 5 * TILE, y: 10 * TILE },
      { kind: "bat", x: 12 * TILE, y: 8 * TILE },
    ],
  },
  {
    name: "Glacier Gate", tiles: ROOM_GLACIER, exits: { left: 7 },
    enemies: [
      { kind: "wisp", x: 11 * TILE, y: 8 * TILE },
      { kind: "slime", x: 4 * TILE, y: 10 * TILE },
    ],
    teleport: { room: 9, x: 7.5 * TILE, y: 10 * TILE },
  },
  {
    name: "Ice Vault — Hall", tiles: ROOM_ICEHALL, exits: { up: 10 },
    enemies: [
      { kind: "bat", x: 4 * TILE, y: 5 * TILE },
      { kind: "bat", x: 11 * TILE, y: 8 * TILE },
      { kind: "wisp", x: 8 * TILE, y: 6 * TILE },
    ],
    teleport: { room: 8, x: 8.5 * TILE, y: 3 * TILE },
  },
  {
    name: "Ice Vault — Guard Room", tiles: ROOM_ICEGUARD, exits: { down: 9, up: 11, left: 13 },
    keyOnClear: true,
    enemies: [
      { kind: "wisp", x: 4 * TILE, y: 4 * TILE },
      { kind: "wisp", x: 11 * TILE, y: 9 * TILE },
      { kind: "slime", x: 8 * TILE, y: 6 * TILE },
      { kind: "bat", x: 6 * TILE, y: 10 * TILE },
    ],
  },
  {
    name: "Throne of Winter", tiles: ROOM_WRAITH, exits: { down: 10 }, boss: true,
    enemies: [{ kind: "wraith", x: 7 * TILE, y: 4 * TILE }],
  },
  { // 12
    name: "Old Vault — Cellars", tiles: ROOM_CELLAR, exits: { right: 4 },
    enemies: [
      { kind: "sentinel", x: 5 * TILE, y: 4 * TILE },
      { kind: "sentinel", x: 10 * TILE, y: 9 * TILE },
      { kind: "bat", x: 8 * TILE, y: 6 * TILE },
      { kind: "slime", x: 3 * TILE, y: 11 * TILE },
    ],
  },
  { // 13
    name: "Ice Vault — Frozen Crypt", tiles: ROOM_CRYPT, exits: { right: 10, up: 17 },
    enemies: [
      { kind: "sentinel", x: 4 * TILE, y: 5 * TILE },
      { kind: "sentinel", x: 11 * TILE, y: 8 * TILE },
      { kind: "wisp", x: 8 * TILE, y: 3 * TILE },
      { kind: "spitter", x: 8 * TILE, y: 10 * TILE },
    ],
  },
  { // 14
    name: "Emberdeep — Tunnel", tiles: ROOM_EMBER_TUNNEL, exits: { up: 1, right: 15 },
    enemies: [
      { kind: "slime", x: 5 * TILE, y: 8 * TILE },
      { kind: "spitter", x: 11 * TILE, y: 5 * TILE },
      { kind: "bat", x: 9 * TILE, y: 10 * TILE },
    ],
  },
  { // 15
    name: "Emberdeep — Guard Post", tiles: ROOM_EMBER_GUARD, exits: { left: 14, up: 16 },
    keyOnClear: true,
    enemies: [
      { kind: "sentinel", x: 8 * TILE, y: 7 * TILE },
      { kind: "spitter", x: 4 * TILE, y: 3 * TILE },
      { kind: "spitter", x: 11 * TILE, y: 10 * TILE },
      { kind: "slime", x: 6 * TILE, y: 11 * TILE },
    ],
  },
  { // 16
    name: "Ember Sanctum", tiles: ROOM_EMBER_SANCTUM, exits: { down: 15 }, boss: true,
    enemies: [{ kind: "ember", x: 7 * TILE, y: 4 * TILE }],
  },
  { // 17 — optional skate-puzzle wing. Tester request (Алексей Белозёров,
    //   2026-07-12): "чтоб до конца скользили, как в Undertale" + "все — герои
    //   и противники — скользят по льду". Two doors so testers reach it fast:
    //   top-centre straight from the starting meadow (early/FREE ROAM access),
    //   bottom-centre from the Frozen Crypt. Off the canon *path* (an additive
    //   side wing, like the Cellars/Emberdeep) and off the AI quest route.
    name: "Frozen Playground", tiles: ROOM_SKATE, exits: { up: 0, down: 13 },
    enemies: [
      { kind: "slime", x: 5 * TILE, y: 4 * TILE },
      { kind: "slime", x: 11 * TILE, y: 8 * TILE },
      { kind: "bat", x: 8 * TILE, y: 5 * TILE },
    ],
  },
];

export function validateRooms(): void {
  for (const r of ROOMS) {
    if (r.tiles.length !== ROWS) throw new Error(`${r.name}: ${r.tiles.length} rows`);
    r.tiles.forEach((row, i) => {
      if (row.length !== COLS) throw new Error(`${r.name} row ${i}: ${row.length} cols`);
    });
  }
}

// ------------------------------------------------------------------ types
export type EnemyKind = "slime" | "bat" | "golem" | "wisp" | "wraith" | "sentinel" | "spitter" | "ember";
/** golem-family: armored except while stunned (phase 3) */
export const golemLike = (k: EnemyKind): boolean => k === "golem" || k === "ember";
export const isBoss = (k: EnemyKind): boolean => k === "golem" || k === "wraith" || k === "ember";

export interface Enemy {
  kind: EnemyKind;
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number; hurt: number;
  kx: number; ky: number;
  t: number; phase: number;
  vx: number; vy: number;
  dead: boolean;
  spareP: number;      // mercy progress while a player stands beside a yielding foe
  stagger: number;     // shield rocked aside by a blocked arrow (sentinel)
}

export type PickupKind = "heart" | "key" | "bow" | "container" | "elixir" | "charm" | "feather";
export interface Pickup { kind: PickupKind; x: number; y: number; t: number; cid?: string; }

/** heart containers: overworld secrets + boss drops. The golem entry only
 *  spawns once the golem is dead — so the drop survives room reloads. */
export const CONTAINERS: { id: string; room: number; x: number; y: number }[] = [
  { id: "lake",  room: 2, x: 10 * TILE + 8, y: 10 * TILE + 8 },   // sandy spit, pre-vault
  { id: "golem", room: 5, x: 7.5 * TILE + 8, y: 8 * TILE },       // boss drop, persists
  { id: "frost", room: 7, x: 2 * TILE + 8,  y: 2 * TILE + 8 },    // frost woods
  { id: "crypt", room: 13, x: 8 * TILE, y: 6 * TILE + 8 },        // optional crypt wing
];

/** elixirs of life: carried; auto-revive the holder the moment they fall */
export const ELIXIRS: { id: string; room: number; x: number; y: number }[] = [
  { id: "vault",  room: 4,  x: 2 * TILE + 8,  y: 11 * TILE + 8 },
  { id: "ice",    room: 10, x: 13 * TILE + 8, y: 2 * TILE + 8 },
  { id: "cellar", room: 12, x: 8 * TILE, y: 6 * TILE + 8 },   // optional wing reward
];

/** phoenix feather: team item, one remote revive in FREE ROAM (Frozen Crypt wing) */
export const FEATHERS: { id: string; room: number; x: number; y: number }[] = [
  { id: "crypt", room: 13, x: 3 * TILE + 8, y: 10 * TILE + 8 },
];

/** FREE ROAM alone-down bleed window — 30s at 60 Hz */
export const BLEED_TICKS = 1800;
/** spared wraith: half-speed touch-revive when hugging a downed hero (same room only) */
const WRAITH_ANCHOR_RANGE = 48;
const WRAITH_REVIVE_NEEDED = 90;
export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  friendly: boolean; life: number; owner?: number;
}

export interface Player {
  x: number; y: number;
  dir: Dir;
  hp: number; maxHp: number;
  keys: number;
  attack: number;
  bowCd: number;
  invuln: number;
  kx: number; ky: number;
  vx: number; vy: number;   // walk velocity — carries momentum on slippery ice
  walk: number;
  moving: boolean;
  downed: boolean;
  elixir: boolean;      // carried Elixir of Life (auto-revive on fall)
  reviveP: number;      // 0..90 revive progress while partner touches
  bleedT: number;       // FREE ROAM alone-down countdown (ticks)
  say: string; sayT: number;
  present: boolean;     // slot occupied by a connected player/agent
  npc: boolean;         // an AI companion: free to cower in doorways, but
                        // room transitions belong to heroes while one remains
  simIndex: number;     // which RoomSim this body inhabits (stage 1: always 0)
  transitionCd: number; // ticks before another room edge-cross (anti door ping-pong)
  crossFade: number;    // free roam: room-transition fade for this viewer only
  crossBanner: string; crossBannerT: number;
  doorCampT: number;   // npc doorway camping — triggers auto-yield (never blocks hero input)
}

export type GameScreen = "menu" | "lobby" | "title" | "play" | "gameover" | "win";
export type TravelMode = "linked" | "free";

export interface Input {
  l: boolean; r: boolean; u: boolean; d: boolean;
  a: boolean; b: boolean; st: boolean; f: boolean;
}
export interface LatchedInput extends Input {
  aE: boolean; bE: boolean; stE: boolean; fE: boolean;   // fresh-press edges
}
export const emptyInput = (): Input =>
  ({ l: false, r: false, u: false, d: false, a: false, b: false, st: false, f: false });

export interface Ending { id: string; title: string; lines: string[]; }

/** Fahrenheit-style: the epilogue is read off the state of the world.
 *  Priority: solo fates → a partner left in the snow → flawless run →
 *  the fire route → the classic ending (verbatim, for the canon). */
export function endingFor(g: Game): Ending {
  const solo = !g.players[1].present || !g.players[0].present;
  const totalDowns = g.stats[0].downs + g.stats[1].downs;
  if (solo) {
    if (g.wraithSpared) {
      return { id: "mercy", title: "WINTER'S COMPANION", lines: [
        "you lowered your blade, and the wraith lowered the storm.",
        "the winter stays — but now it walks beside you." ] };
    }
    return totalDowns === 0
      ? { id: "quiet-legend", title: "THE QUIET LEGEND", lines: [
          "alone through vaults and snow, untouched by winter —",
          "the bards will not believe a word of it." ] }
      : { id: "quiet-hero", title: "THE QUIET HERO", lines: [
          "one hero, one blade, one long road north.",
          "spring came quietly, and so did you." ] };
  }
  if (g.players.some(p => p.present && p.downed)) {
    return { id: "lone-thaw", title: "LONE THAW", lines: [
      "you touched the pedestal as your partner lay in the snow.",
      "spring came — now carry them home through the meltwater." ] };
  }
  if (g.bleedoutLoss) {
    return { id: "abandoned", title: "LEFT IN THE COLD", lines: [
      "your partner bled out alone while winter pressed in.",
      "spring will not forget who was left behind." ] };
  }
  if (g.wraithSpared) {
    return { id: "mercy", title: "WINTER'S COMPANION", lines: [
      "you lowered your blade, and the wraith lowered the storm.",
      "the winter stays — but now it walks beside you." ] };
  }
  if (totalDowns === 0) {
    return { id: "flawless", title: "FLAWLESS LEGEND", lines: [
      "not once did winter bring either hero down.",
      "statues will be raised. songs will exaggerate nothing." ] };
  }
  if (g.emberDead && g.charmClaimed) {
    return { id: "ember-pact", title: "THE EMBER PACT", lines: [
      "with the dwarven charm and arrows of living fire,",
      "you thawed the winter from below and above alike." ] };
  }
  return { id: "classic", title: "THE LONG WINTER ENDS", lines: [
    "two heroes carried the Amber Blade north,",
    "and spring followed in their footsteps." ] };
}

export type GameEvent =
  | { t: "sfx"; name: string }
  | { t: "burst"; x: number; y: number; color: string; n: number };

/** everything that lives INSIDE one room: the unit of simulation.
 *  Stage 1 of the World/RoomSim factorization: state physically resides in
 *  Game.sims[]; the legacy flat fields (g.room, g.enemies, ...) remain as
 *  accessors over sims[0], so every existing call site — and every test —
 *  keeps exactly its current behavior. Detached partner rooms (free roam,
 *  agent errands, the partner window) will be sims[1]. */
export interface RoomSim {
  room: number;
  tiles: string[][];
  enemies: Enemy[];
  pickups: Pickup[];
  projectiles: Projectile[];
  pedestal: { x: number; y: number; final: boolean } | null;
}

export function newRoomSim(): RoomSim {
  return { room: 0, tiles: [], enemies: [], pickups: [], projectiles: [], pedestal: null };
}

export interface Game {
  screen: GameScreen;
  sims: RoomSim[];          // sims[0] always exists; sims[1] is a detached room
  room: number;             // ↓ accessor views over sims[0] (legacy API)
  tiles: string[][];
  enemies: Enemy[];
  pickups: Pickup[];
  projectiles: Projectile[];
  players: [Player, Player];
  cleared: Record<number, boolean>;
  doors: Record<number, boolean>;
  golemDead: boolean;
  amberClaimed: boolean;
  gateMelted: boolean;
  hasBow: boolean;
  hasFeather: boolean;
  containers: Record<string, boolean>;
  elixirs: Record<string, boolean>;
  feathers: Record<string, boolean>;
  wraithDead: boolean;
  emberDead: boolean;
  charmClaimed: boolean;
  hardGate: boolean;   // seal the glacier behind the charm (menu choice)
  slick: boolean;      // slippery ice — heroes coast on "i" tiles (menu toggle, default off)
  wraithSpared: boolean;
  companion: { x: number; y: number; t: number } | null;   // the spared wraith
  ending: Ending | null;
  pedestal: { x: number; y: number; final: boolean } | null;   // accessor → sims[0]
  fade: number;
  message: string; messageT: number;
  ticks: number;
  shake: number;
  events: GameEvent[];
  stats: [PlayerStats, PlayerStats];
  travelMode: TravelMode;   // linked = Four Swords; free = independent rooms + PiP
  activeSim: number;      // which sim the legacy flat accessors read (non-snapshot)
  bleedoutLoss: boolean;  // FREE ROAM gameover: partner bled out alone
}

export const PLAYER_W = 10, PLAYER_H = 12;
export const TRANSITION_CD = 50;   // ~0.8s at 60 Hz — doorway settle time
// slippery ice easing (single source of truth — client prediction imports these
// so server physics and prediction stay in exact lockstep). ACCEL is high so
// starting and turning stay responsive; DECEL is low so releasing the stick
// leaves a long, obvious glide (~10px) — noticeably icy, still controllable.
export const ICE_ACCEL = 0.4;
export const ICE_DECEL = 0.12;
// commit-slide puzzle ice (tile "z"): step on and you skate in a locked 4-dir
// line until a wall stops you or you reach solid ground — the Undertale/Zelda
// ice-block puzzle. Distinct from the "i" coast (which stays under control and
// is behind the slick toggle). Both heroes AND enemies slide on it.
export const SLIDE_SPEED = 1.7;

export interface PlayerStats {
  dmgDealt: number; bossDmg: number; kills: number;
  dmgTaken: number; downs: number; revives: number; elixirsUsed: number;
}
export const emptyStats = (): PlayerStats =>
  ({ dmgDealt: 0, bossDmg: 0, kills: 0, dmgTaken: 0, downs: 0, revives: 0, elixirsUsed: 0 });

function sfx(g: Game, name: string): void { g.events.push({ t: "sfx", name }); }
function burst(g: Game, x: number, y: number, color: string, n = 8): void {
  g.events.push({ t: "burst", x, y, color, n });
}

export function newPlayer(idx: number): Player {
  return {
    x: (3 + idx * 1.5) * TILE, y: 6.5 * TILE, dir: 0,
    hp: 6, maxHp: 6, keys: 0,
    attack: 0, bowCd: 0, invuln: 0, kx: 0, ky: 0, vx: 0, vy: 0, walk: 0, moving: false,
    downed: false, elixir: false, reviveP: 0, bleedT: 0, say: "", sayT: 0, present: false, npc: false, simIndex: 0,
    transitionCd: 0, crossFade: 0, crossBanner: "", crossBannerT: 0, doorCampT: 0,
  };
}

export function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const big = isBoss(kind);
  const hp =
    kind === "golem" ? 14 :
    kind === "ember" ? 18 :
    kind === "wraith" ? 16 :
    kind === "sentinel" ? 4 :
    kind === "bat" ? 2 :
    kind === "wisp" || kind === "spitter" ? 2 : 3;
  return {
    kind, x, y,
    w: big ? 28 : 12, h: big ? 28 : 12,
    hp, maxHp: hp,
    hurt: 0, kx: 0, ky: 0, t: 0, phase: 0, vx: 0, vy: 0, dead: false, spareP: 0, stagger: 0,
  };
}

/** populate the active sim's room (via legacy accessors). Does not move players. */
function fillActiveSimRoom(g: Game, index: number): void {
  g.room = index;
  const spec = ROOMS[index];
  g.tiles[index] ??= spec.tiles.map(r => r);
  g.enemies = [];
  g.pickups = [];
  g.projectiles = [];
  const skipEnemies =
    (spec.keyOnClear && g.cleared[index]) ||
    (g.travelMode === "free" && g.cleared[index]) ||
    (index === 5 && g.golemDead) ||
    (index === 11 && (g.wraithDead || g.wraithSpared)) ||
    (index === 16 && g.emberDead);
  if (!skipEnemies) {
    for (const e of spec.enemies) g.enemies.push(makeEnemy(e.kind, e.x, e.y));
  }
  g.pedestal = null;
  if (index === 5 && g.golemDead && !g.amberClaimed) {
    g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: false };
  }
  if (index === 11 && (g.wraithDead || g.wraithSpared)) {
    g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: true };
  }
  if (index === 6 && !g.hasBow) {
    pushPickup(g, { kind: "bow", x: 3 * TILE + 8, y: 10 * TILE + 8, t: 0 });
  }
  if (index === 16 && g.emberDead && !g.charmClaimed) {
    pushPickup(g, { kind: "charm", x: 7.5 * TILE + 8, y: 8 * TILE, t: 0 });
  }
  for (const c of CONTAINERS) {
    if (c.room !== index || g.containers[c.id]) continue;
    if (c.id === "golem" && !g.golemDead) continue;   // appears with the boss's fall
    pushPickup(g, { kind: "container", x: c.x, y: c.y, t: 0, cid: c.id });
  }
  for (const el of ELIXIRS) {
    if (el.room === index && !g.elixirs[el.id]) {
      pushPickup(g, { kind: "elixir", x: el.x, y: el.y, t: 0, cid: el.id });
    }
  }
  for (const fe of FEATHERS) {
    if (fe.room === index && !g.feathers[fe.id] && !g.hasFeather) {
      pushPickup(g, { kind: "feather", x: fe.x, y: fe.y, t: 0, cid: fe.id });
    }
  }
  if (g.doors[index]) {
    const floor = spec.tiles[1].charAt(1);
    setTile(g, 7, 0, floor);
    setTile(g, 8, 0, floor);
  }
  if (index === 0 && g.gateMelted) {
    setTile(g, 7, 0, "g");
    setTile(g, 8, 0, "g");
    setTile(g, 7, ROWS - 1, "g");
    setTile(g, 8, ROWS - 1, "g");
  }
}

/** the Amber Blade thaws BOTH meadow ice seals: the north quest gate and the
 *  south Frozen Falls curtain — one warm edge, both walls of ancient ice */
function meltMeadowIce(g: Game): void {
  g.gateMelted = true;
  setTile(g, 7, 0, "g");
  setTile(g, 8, 0, "g");
  setTile(g, 7, ROWS - 1, "g");
  setTile(g, 8, ROWS - 1, "g");
}

function transitionBanner(g: Game, index: number, pi?: number): void {
  const coopFree = g.travelMode === "free" && g.players[0].present && g.players[1].present;
  if (coopFree && pi !== undefined) {
    const p = g.players[pi];
    p.crossFade = 1;
    p.crossBanner = ROOMS[index].name;
    p.crossBannerT = 120;
    return;
  }
  g.fade = 1;
  g.message = ROOMS[index].name;
  g.messageT = 120;
}

function ensureSecondSim(g: Game): void {
  if (g.sims.length < 2) g.sims.push(newRoomSim());
}

function markTransition(p: Player): void {
  p.transitionCd = TRANSITION_CD;
}

/** after a cave teleport, nudge off the mouth so cooldown expiry cannot re-fire */
function nudgeOffCaveMouth(g: Game, p: Player): void {
  const spec = ROOMS[g.room];
  if (!spec.teleport) return;
  const ptx = Math.floor((p.x + PLAYER_W / 2) / TILE);
  const pty = Math.floor((p.y + PLAYER_H / 2) / TILE);
  if (tileAt(g, ptx, pty) === "c") p.y = Math.min(H - PLAYER_H, p.y + TILE / 2);
}

function clampSimIndices(g: Game): void {
  for (const p of g.players) {
    if (p.simIndex < 0 || p.simIndex >= g.sims.length) p.simIndex = 0;
  }
}

/** free roam: only the crossing hero moves; partner stays in their room. */
function freeRoamTransition(g: Game, pi: number, index: number, px: number, py: number): void {
  const p = g.players[pi];
  const otherPi = 1 - pi;
  const other = g.players[otherPi];
  const saved = g.activeSim;

  if (!other.present) {
    g.activeSim = p.simIndex;
    fillActiveSimRoom(g, index);
    p.x = px; p.y = py;
    nudgeOffCaveMouth(g, p);
    transitionBanner(g, index, pi);
    markTransition(p);
    g.activeSim = saved;
    return;
  }

  clampSimIndices(g);

  if (other.simIndex === p.simIndex) {
    // split: stayer keeps the current sim; crosser loads the new room elsewhere
    ensureSecondSim(g);
    const crossSi = p.simIndex === 0 ? 1 : 0;
    g.activeSim = crossSi;
    fillActiveSimRoom(g, index);
    p.simIndex = crossSi;
    p.x = px; p.y = py;
    nudgeOffCaveMouth(g, p);
  } else {
    const otherSim = g.sims[other.simIndex] ?? g.sims[0];
    if (otherSim.room === index) {
      // merge into one sim — preserve the room the partner already occupies
      if (other.simIndex !== 0 && g.sims[other.simIndex]) g.sims[0] = g.sims[other.simIndex];
      p.simIndex = 0;
      other.simIndex = 0;
      p.x = px; p.y = py;
      nudgeOffCaveMouth(g, p);
      if (g.sims.length > 1) g.sims.length = 1;
    } else {
      g.activeSim = p.simIndex;
      fillActiveSimRoom(g, index);
      p.x = px; p.y = py;
      nudgeOffCaveMouth(g, p);
    }
  }

  clampSimIndices(g);

  transitionBanner(g, index, pi);
  markTransition(p);
  g.activeSim = saved;
}

function roomTransition(g: Game, pi: number, index: number, px: number, py: number): void {
  const coop = g.players[0].present && g.players[1].present;
  if (g.travelMode === "free" && coop) {
    freeRoamTransition(g, pi, index, px, py);
    return;
  }
  loadRoom(g, index, px, py);
}

export function loadRoom(g: Game, index: number, px: number, py: number): void {
  g.activeSim = 0;
  fillActiveSimRoom(g, index);
  // both players enter together (Four Swords style)
  const [p1, p2] = g.players;
  p1.simIndex = 0;
  p2.simIndex = 0;
  if (g.sims.length > 1) g.sims.length = 1;
  p1.x = px; p1.y = py;
  p2.x = Math.max(2, Math.min(W - PLAYER_W - 2, px + (px < W / 2 ? 14 : -14)));
  p2.y = py;
  if (g.companion) { g.companion.x = px + 20; g.companion.y = py - 6; }
  // a downed partner gets back up on room change with two hearts (LINKED only)
  for (const p of g.players) {
    if (p.downed) { p.downed = false; p.hp = 4; p.invuln = 60; p.reviveP = 0; p.bleedT = 0; }
  }
  transitionBanner(g, index);
}

export function newGame(): Game {
  const base = {
    screen: "lobby" as GameScreen,
    sims: [newRoomSim()],
    players: [newPlayer(0), newPlayer(1)] as [Player, Player],
    cleared: {}, doors: {},
    golemDead: false, amberClaimed: false, gateMelted: false,
    hasBow: false, hasFeather: false, containers: {}, elixirs: {}, feathers: {},
    wraithDead: false, emberDead: false, charmClaimed: false, hardGate: false,
    slick: false,
    wraithSpared: false, companion: null, ending: null,
    fade: 0, message: "", messageT: 0, ticks: 0, shake: 0,
    events: [] as GameEvent[], stats: [emptyStats(), emptyStats()] as [PlayerStats, PlayerStats],
    travelMode: "linked" as TravelMode,
    activeSim: 0,
    bleedoutLoss: false,
  };
  // legacy flat API forwards to sims[activeSim]. Non-enumerable on purpose:
  // Object.assign(g, newGame()) then copies only the DATA fields (incl.
  // sims), and the target's own accessors keep pointing at the new sims.
  const defineView = (obj: object, key: string, simKey: keyof RoomSim): void => {
    Object.defineProperty(obj, key, {
      enumerable: false, configurable: true,
      get(this: Game) { return this.sims[this.activeSim ?? 0][simKey]; },
      set(this: Game, v: never) { (this.sims[this.activeSim ?? 0][simKey] as unknown) = v; },
    });
  };
  for (const [legacy, simKey] of [
    ["room", "room"], ["tiles", "tiles"], ["enemies", "enemies"],
    ["pickups", "pickups"], ["projectiles", "projectiles"], ["pedestal", "pedestal"],
  ] as [string, keyof RoomSim][]) {
    defineView(base, legacy, simKey);
  }
  const g = base as unknown as Game;
  loadRoom(g, 0, 3 * TILE, 6.5 * TILE);
  g.screen = "lobby";
  return g;
}

/** the room simulation a given player inhabits */
export function simOf(g: Game, pi: number): RoomSim {
  return g.sims[g.players[pi].simIndex] ?? g.sims[0];
}

// -------------------------------------------------------------- collision
export function tileAt(g: Game, tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return "t";
  const rows = g.tiles[g.room] ?? ROOMS[g.room].tiles;
  return rows[ty].charAt(tx);
}

export function setTile(g: Game, tx: number, ty: number, ch: string): void {
  const rows = (g.tiles[g.room] ??= ROOMS[g.room].tiles.map(r => r));
  rows[ty] = rows[ty].slice(0, tx) + ch + rows[ty].slice(tx + 1);
}

export function solidAt(g: Game, x: number, y: number): boolean {
  return SOLID.has(tileAt(g, Math.floor(x / TILE), Math.floor(y / TILE)));
}

export function moveBody(g: Game, b: { x: number; y: number }, w: number, h: number,
                         dx: number, dy: number): void {
  if (dx !== 0) {
    const nx = b.x + dx;
    const edge = dx > 0 ? nx + w : nx;
    if (!solidAt(g, edge, b.y + 1) && !solidAt(g, edge, b.y + h - 1) &&
        !solidAt(g, edge, b.y + h / 2)) b.x = nx;
  }
  if (dy !== 0) {
    const ny = b.y + dy;
    const edge = dy > 0 ? ny + h : ny;
    if (!solidAt(g, b.x + 1, edge) && !solidAt(g, b.x + w - 1, edge) &&
        !solidAt(g, b.x + w / 2, edge)) b.y = ny;
  }
}

/** commit-slide on puzzle ice ("z"): when a body's centre sits on a slide tile
 *  it skates in a single locked axis until moveBody is blocked (a wall) — then
 *  it rests. `dx/dy` is the *intent* used only to START a slide (horizontal wins
 *  a diagonal); once moving, steering is ignored (that's the whole puzzle). Off
 *  the ice this returns false and the caller runs its normal movement, so the
 *  body naturally stops the moment it slides onto solid ground. Shared by heroes
 *  and enemies — the client mirrors it in predict.ts for lockstep. */
export function slideBody(g: Game, b: { x: number; y: number; vx: number; vy: number },
                          w: number, h: number, dx: number, dy: number): boolean {
  const cx = Math.floor((b.x + w / 2) / TILE);
  const cy = Math.floor((b.y + h / 2) / TILE);
  if (tileAt(g, cx, cy) !== "z") return false;
  if (b.vx === 0 && b.vy === 0) {
    if (dx !== 0) { b.vx = Math.sign(dx) * SLIDE_SPEED; b.vy = 0; }
    else if (dy !== 0) { b.vx = 0; b.vy = Math.sign(dy) * SLIDE_SPEED; }
    else return true;   // idle on ice, nothing to commit
  }
  const px = b.x, py = b.y;
  moveBody(g, b, w, h, b.vx, b.vy);
  if (b.x === px && b.y === py) { b.vx = 0; b.vy = 0; }   // met a wall — rest here
  return true;
}

export function overlap(ax: number, ay: number, aw: number, ah: number,
                        bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const PICKUP_HALF = 6;

/** true when any part of the 12×12 pickup footprint sits inside solid tiles */
export function pickupWedged(g: Game, x: number, y: number): boolean {
  const pts: [number, number][] = [
    [x - PICKUP_HALF, y - PICKUP_HALF], [x + PICKUP_HALF, y - PICKUP_HALF],
    [x - PICKUP_HALF, y + PICKUP_HALF], [x + PICKUP_HALF, y + PICKUP_HALF],
    [x, y],
  ];
  return pts.some(([px, py]) => solidAt(g, px, py));
}

/** nudge a drop onto the nearest open floor — enemy loot often dies in corners */
export function settlePickupPos(g: Game, x: number, y: number): { x: number; y: number } {
  if (!pickupWedged(g, x, y)) return { x, y };
  for (let ring = 1; ring <= 8; ring++) {
    for (let ty = -ring; ty <= ring; ty++) {
      for (let tx = -ring; tx <= ring; tx++) {
        if (Math.abs(tx) !== ring && Math.abs(ty) !== ring) continue;
        const nx = x + tx * 8, ny = y + ty * 8;
        if (!pickupWedged(g, nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

function pushPickup(g: Game, item: Pickup): void {
  const spot = settlePickupPos(g, item.x, item.y);
  g.pickups.push({ ...item, x: spot.x, y: spot.y });
}

function playerCollectsPickup(g: Game, p: Player, it: Pickup): boolean {
  if (overlap(p.x, p.y, PLAYER_W, PLAYER_H,
              it.x - PICKUP_HALF, it.y - PICKUP_HALF, 12, 12)) return true;
  const pcx = p.x + PLAYER_W / 2, pcy = p.y + PLAYER_H / 2;
  const d = Math.hypot(it.x - pcx, it.y - pcy);
  if (d < 16) return true;
  return d < 28 && pickupWedged(g, it.x, it.y);
}

/** hero has a live enemy within melee/chase range — used for FREE ROAM leave permission */
export function heroInCombat(g: Game, heroPi: number): boolean {
  const hero = g.players[heroPi];
  if (!hero.present || hero.downed) return false;
  const saved = g.activeSim;
  g.activeSim = hero.simIndex;
  const hcx = hero.x + PLAYER_W / 2, hcy = hero.y + PLAYER_H / 2;
  const fighting = g.enemies.some(e =>
    !e.dead && Math.hypot(e.x + e.w / 2 - hcx, e.y + e.h / 2 - hcy) < 100);
  g.activeSim = saved;
  return fighting;
}

/** FREE ROAM: npc may split only when the human hero is safe (not downed, not in combat) */
export function canNpcLeave(g: Game, npcPi: number): boolean {
  if (g.travelMode !== "free") return true;
  const npc = g.players[npcPi];
  const heroPi = 1 - npcPi;
  const hero = g.players[heroPi];
  if (!npc.present || !npc.npc || !hero.present) return true;
  if (hero.simIndex !== npc.simIndex) return true;
  if (hero.downed) return false;
  return !heroInCombat(g, heroPi);
}

// ----------------------------------------------------------------- combat
export function swordBox(p: Player): { x: number; y: number; w: number; h: number } {
  const cx = p.x + PLAYER_W / 2, cy = p.y + PLAYER_H / 2;
  const R = 19;
  switch (p.dir) {
    case 0: return { x: cx - 10, y: cy, w: 20, h: R };
    case 1: return { x: cx - 10, y: cy - R, w: 20, h: R };
    case 2: return { x: cx, y: cy - 10, w: R, h: 20 };
    default: return { x: cx - R, y: cy - 10, w: R, h: 20 };
  }
}

/** partner in the same room/sim and able to touch-revive */
function partnerCanTouchRevive(g: Game, pi: number): boolean {
  const other = g.players[1 - pi];
  return other.present && !other.downed &&
    other.simIndex === g.players[pi].simIndex;
}

/** spared wraith hugs a downed hero — only while a living partner shares the room */
function wraithAnchorsDowned(g: Game, pi: number): boolean {
  if (!g.companion || !g.wraithSpared) return false;
  if (!partnerCanTouchRevive(g, pi)) return false;
  const p = g.players[pi];
  const c = g.companion;
  const px = p.x + PLAYER_W / 2, py = p.y + PLAYER_H / 2;
  return Math.hypot(c.x + 10 - px, c.y + 10 - py) < WRAITH_ANCHOR_RANGE;
}

function completeRevive(g: Game, pi: number, reviverPi: number, msg: string): void {
  const p = g.players[pi];
  if (reviverPi >= 0) g.stats[reviverPi].revives += 1;
  p.downed = false;
  p.hp = Math.max(4, Math.floor(p.maxHp / 2));
  p.invuln = 90;
  p.reviveP = 0;
  p.bleedT = 0;
  burst(g, p.x + 5, p.y + 6, "#9be07a", 12);
  sfx(g, "revive");
  g.message = msg;
  g.messageT = 120;
}

function tryFeatherRevive(g: Game, pi: number, inp: LatchedInput): void {
  if (!inp.fE || !g.hasFeather || g.travelMode !== "free") return;
  const p = g.players[pi];
  if (p.downed) return;
  const other = g.players[1 - pi];
  if (!other.present || !other.downed) return;
  if (other.simIndex === p.simIndex) return;

  g.hasFeather = false;
  g.stats[pi].revives += 1;
  other.downed = false;
  other.hp = Math.max(4, Math.floor(other.maxHp / 2));
  other.invuln = 90;
  other.reviveP = 0;
  other.bleedT = 0;
  burst(g, other.x + 5, other.y + 6, "#ffb86a", 18);
  sfx(g, "revive");
  g.message = "A Phoenix Feather lifts your partner from the snow!";
  g.messageT = 200;
}

function bleedoutEnding(g: Game): Ending {
  return { id: "abandoned", title: "LEFT IN THE COLD", lines: [
    "your partner bled out alone while winter pressed in.",
    "spring will not forget who was left behind." ] };
}

function hurtPlayer(g: Game, pi: number, dmg: number, fromX: number, fromY: number): void {
  const p = g.players[pi];
  if (p.invuln > 0 || p.downed) return;
  p.hp -= dmg;
  g.stats[pi].dmgTaken += dmg;
  p.invuln = 60;
  const dx = p.x - fromX, dy = p.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  p.kx = (dx / len) * 3;
  p.ky = (dy / len) * 3;
  g.shake = 8;
  sfx(g, "hurt");
  if (p.hp <= 0 && p.elixir) {
    g.stats[pi].elixirsUsed += 1;
    p.elixir = false;
    p.hp = Math.max(4, Math.floor(p.maxHp / 2));
    p.invuln = 90;
    burst(g, p.x + 5, p.y + 6, "#ffd257", 16);
    sfx(g, "revive");
    g.message = "The Elixir pulls you back from the brink!";
    g.messageT = 160;
    return;
  }
  if (p.hp <= 0) {
    g.stats[pi].downs += 1;
    p.hp = 0;
    p.downed = true;
    p.reviveP = 0;
    p.bleedT = 0;
    sfx(g, "down");
    const other = g.players[1 - pi];
    if (other.downed || !other.present) {
      g.screen = "gameover";
      sfx(g, "gameover");
    } else if (g.travelMode === "free" && !partnerCanTouchRevive(g, pi)) {
      p.bleedT = BLEED_TICKS;
      g.message = "Bleeding out alone! Partner must reach you — or press F to send a Phoenix Feather";
      g.messageT = 220;
    } else {
      g.message = "Your partner is down! Stand close to revive";
      g.messageT = 180;
    }
  }
}

function damageEnemy(g: Game, e: Enemy, dmg: number, fx: number, fy: number, by?: number): void {
  if (by !== undefined) {
    const st = g.stats[by];
    st.dmgDealt += dmg;
    if (isBoss(e.kind)) st.bossDmg += dmg;
    if (e.hp - dmg <= 0) st.kills += 1;
  }
  e.hp -= dmg;
  e.hurt = 24;
  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  const ddx = ecx - fx, ddy = ecy - fy;
  const l = Math.hypot(ddx, ddy) || 1;
  if (e.kind !== "wraith") { e.kx = (ddx / l) * 2.5; e.ky = (ddy / l) * 2.5; }
  sfx(g, "hit");
  burst(g, ecx, ecy,
    e.kind === "golem" ? "#ffb545" : e.kind === "wisp" || e.kind === "wraith" ? "#9fe8ff" : "#9be07a", 6);
  if (e.hp <= 0) {
    if (e.kind === "wraith" && e.phase !== 9 && !g.wraithSpared) {
      // the killing blow is withheld: the wraith yields, and the choice is yours
      e.hp = 1;
      e.phase = 9;
      e.vx = 0; e.vy = 0;
      e.spareP = 0;
      g.message = "The Winter Wraith yields... strike again, or stand close to spare it";
      g.messageT = 300;
      sfx(g, "teleport");
      burst(g, ecx, ecy, "#dff5ff", 14);
      return;
    }
    killEnemy(g, e);
  } else if (e.kind === "wraith" && e.phase !== 9 && Math.random() < 0.4) {
    wraithTeleport(g, e);
  }
}

function wraithTeleport(g: Game, e: Enemy): void {
  burst(g, e.x + e.w / 2, e.y + e.h / 2, "#bfe9ff", 10);
  for (let tries = 0; tries < 20; tries++) {
    const tx = 2 + Math.floor(Math.random() * 11);
    const ty = 2 + Math.floor(Math.random() * 9);
    if (!SOLID.has(tileAt(g, tx, ty)) && !SOLID.has(tileAt(g, tx + 1, ty + 1))) {
      e.x = tx * TILE; e.y = ty * TILE;
      break;
    }
  }
  e.phase = 0; e.t = 0;
  sfx(g, "teleport");
  burst(g, e.x + e.w / 2, e.y + e.h / 2, "#bfe9ff", 10);
}

function shoot(g: Game, x: number, y: number, vx: number, vy: number,
               friendly: boolean, owner?: number): void {
  g.projectiles.push({ x, y, vx, vy, friendly, life: friendly ? 55 : 150, owner });
}

/** does the sentinel's raised shield face this attack origin? */
export function sentinelBlocks(e: Enemy, fromX: number, fromY: number): boolean {
  if (e.stagger > 0) return false;   // the shield is rocked aside — openings exist
  const fl = Math.hypot(e.vx, e.vy);
  if (fl < 0.01) return false;
  const dx = fromX - (e.x + e.w / 2), dy = fromY - (e.y + e.h / 2);
  const dl = Math.hypot(dx, dy) || 1;
  return (dx / dl) * (e.vx / fl) + (dy / dl) * (e.vy / fl) > 0.34;   // ~70-degree cone
}

/** nearest player that can still be targeted (same sim as activeSim) */
function nearestPlayer(g: Game, x: number, y: number): { p: Player; pi: number; d: number } {
  const si = g.activeSim ?? 0;
  let best = 0, bestD = Infinity;
  g.players.forEach((p, i) => {
    if (p.downed || !p.present || p.simIndex !== si) return;
    const d = Math.hypot(p.x + PLAYER_W / 2 - x, p.y + PLAYER_H / 2 - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (bestD === Infinity) { best = 0; bestD = 9999; }
  return { p: g.players[best], pi: best, d: bestD };
}

// -------------------------------------------------------------- enemy AI
function updateEnemy(g: Game, e: Enemy): void {
  e.t++;
  if (e.hurt > 0) e.hurt--;
  if (Math.abs(e.kx) > 0.05 || Math.abs(e.ky) > 0.05) {
    moveBody(g, e, e.w, e.h, e.kx, e.ky);
    e.kx *= 0.85; e.ky *= 0.85;
  }

  // puzzle ice: the room's dwellers skate too — they slide toward the nearest
  // hero and re-aim off the walls, no kind-specific AI while on the rink
  const sc = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  if (tileAt(g, Math.floor(sc.x / TILE), Math.floor(sc.y / TILE)) === "z") {
    const t = nearestPlayer(g, sc.x, sc.y);
    slideBody(g, e, e.w, e.h,
      (t.p.x + PLAYER_W / 2) - sc.x, (t.p.y + PLAYER_H / 2) - sc.y);
    return;
  }

  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  const tgt = nearestPlayer(g, ecx, ecy);
  const pcx = tgt.p.x + PLAYER_W / 2, pcy = tgt.p.y + PLAYER_H / 2;
  const dist = tgt.d || 1;

  if (e.kind === "slime") {
    if (e.phase === 0) {
      if (e.t > 50 + (e.x * 7) % 40) {
        e.phase = 1; e.t = 0;
        e.vx = ((pcx - ecx) / dist) * 1.1;
        e.vy = ((pcy - ecy) / dist) * 1.1;
      }
    } else {
      moveBody(g, e, e.w, e.h, e.vx, e.vy);
      if (e.t > 26) { e.phase = 0; e.t = 0; }
    }
  } else if (e.kind === "bat") {
    const sp = 0.55;
    e.vx = ((pcx - ecx) / dist) * sp + Math.sin(e.t * 0.08) * 0.4;
    e.vy = ((pcy - ecy) / dist) * sp + Math.cos(e.t * 0.06) * 0.4;
    moveBody(g, e, e.w, e.h, e.vx, e.vy);
  } else if (e.kind === "wisp") {
    const want = 70;
    const sp = 0.5;
    const dir = dist > want ? 1 : -1;
    e.vx = ((pcx - ecx) / dist) * sp * dir + Math.sin(e.t * 0.05) * 0.35;
    e.vy = ((pcy - ecy) / dist) * sp * dir + Math.cos(e.t * 0.07) * 0.35;
    moveBody(g, e, e.w, e.h, e.vx, e.vy);
    if (e.t % 150 === 100 && dist < 130) {
      shoot(g, ecx, ecy, ((pcx - ecx) / dist) * 1.7, ((pcy - ecy) / dist) * 1.7, false);
      sfx(g, "shard");
    }
  } else if (e.kind === "sentinel" && e.stagger > 0) {
    e.stagger--;
    // reeling, NOT rooted: shield down but the armor keeps lumbering
    // forward — the archer is on a timer, not at a shooting gallery
    if (e.t % 3 !== 0) {
      moveBody(g, e, e.w, e.h, e.vx * 0.42, e.vy * 0.42);
    }
    if (e.stagger === 0) {
      // recovery: the shield snaps up straight at the nearest hero
      e.vx = (pcx - ecx) / dist;
      e.vy = (pcy - ecy) / dist;
    }
  } else if (e.kind === "sentinel") {
    // the shield TURNS SLOWLY (~2°/tick): a circling hero genuinely gets
    // behind it. Instant tracking made it unbeatable solo — QA proved the
    // "shoot and strafe" math never worked against a zero-lag shield
    const want = Math.atan2(pcy - ecy, pcx - ecx);
    const fl0 = Math.hypot(e.vx, e.vy);
    if (fl0 < 0.01) {
      e.vx = Math.cos(want); e.vy = Math.sin(want);   // fair snap on spawn
    } else {
      const cur = Math.atan2(e.vy, e.vx);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-0.035, Math.min(0.035, diff));
      e.vx = Math.cos(cur + turn);
      e.vy = Math.sin(cur + turn);
    }
    const sp = 0.42;
    if (e.t % 3 !== 0) {                   // heavy armored gait
      moveBody(g, e, e.w, e.h, e.vx * sp, e.vy * sp);
    }
  } else if (e.kind === "spitter") {
    // rooted; spits a 3-way fan when someone lingers in range
    if (e.t % 140 === 80 && dist < 150) {
      const base = Math.atan2(pcy - ecy, pcx - ecx);
      for (const off of [-0.3, 0, 0.3]) {
        shoot(g, ecx, ecy, Math.cos(base + off) * 1.6, Math.sin(base + off) * 1.6, false);
      }
      sfx(g, "shard");
    }
  } else if (e.kind === "ember") {
    // ember golem: a faster cousin — spits fire while winding up, shorter stun
    if (e.phase === 0) {
      if (e.t % 2 === 0) {
        moveBody(g, e, e.w, e.h, ((pcx - ecx) / dist) * 0.55, ((pcy - ecy) / dist) * 0.55);
      }
      if (e.t > 110) { e.phase = 1; e.t = 0; sfx(g, "roar"); }
    } else if (e.phase === 1) {
      if (e.t === 14 || e.t === 28) {
        shoot(g, ecx, ecy, ((pcx - ecx) / dist) * 1.9, ((pcy - ecy) / dist) * 1.9, false);
        sfx(g, "shard");
      }
      if (e.t > 40) {
        e.phase = 2; e.t = 0;
        e.vx = ((pcx - ecx) / dist) * 2.9;
        e.vy = ((pcy - ecy) / dist) * 2.9;
      }
    } else if (e.phase === 2) {
      const ox = e.x, oy = e.y;
      moveBody(g, e, e.w, e.h, e.vx, e.vy);
      const blocked = Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01;
      if (blocked || e.t > 65) {
        e.phase = 3; e.t = 0; g.shake = 10; sfx(g, "thud");
      }
    } else if (e.phase === 3) {
      if (e.t > 90) { e.phase = 0; e.t = 0; }
    }
  } else if (e.kind === "golem") {
    if (e.phase === 0) {
      if (e.t % 2 === 0) {
        moveBody(g, e, e.w, e.h, ((pcx - ecx) / dist) * 0.45, ((pcy - ecy) / dist) * 0.45);
      }
      if (e.t > 140) { e.phase = 1; e.t = 0; sfx(g, "roar"); }
    } else if (e.phase === 1) {
      if (e.t > 40) {
        e.phase = 2; e.t = 0;
        e.vx = ((pcx - ecx) / dist) * 2.6;
        e.vy = ((pcy - ecy) / dist) * 2.6;
      }
    } else if (e.phase === 2) {
      const ox = e.x, oy = e.y;
      moveBody(g, e, e.w, e.h, e.vx, e.vy);
      const blocked = Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01;
      if (blocked || e.t > 70) {
        e.phase = 3; e.t = 0; g.shake = 10; sfx(g, "thud");
      }
    } else if (e.phase === 3) {
      if (e.t > 110) { e.phase = 0; e.t = 0; }
    }
  } else if (e.kind === "wraith" && e.phase === 9) {
    // yielding: the storm holds its breath
    e.x += Math.cos(e.t * 0.03) * 0.12;
    e.y += Math.sin(e.t * 0.05) * 0.1;
    let touched = false;
    for (const p of g.players) {
      if (!p.present || p.downed) continue;
      if (overlap(p.x - 6, p.y - 6, PLAYER_W + 12, PLAYER_H + 12, e.x, e.y, e.w, e.h)) {
        touched = true;
      }
    }
    if (touched) {
      e.spareP++;
      if (e.spareP >= 75) {
        e.dead = true;
        g.wraithSpared = true;
        g.companion = { x: e.x, y: e.y, t: 0 };
        g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: true };
        g.message = "The storm quiets. Winter walks beside you now";
        g.messageT = 260;
        burst(g, e.x + e.w / 2, e.y + e.h / 2, "#bfe9ff", 18);
        sfx(g, "revive");
      }
    } else if (e.spareP > 0) {
      e.spareP--;
    }
  } else if (e.kind === "wraith") {
    const sp = 0.6;
    const want = 80;
    const toward = dist > want ? 1 : -0.6;
    e.vx = ((pcx - ecx) / dist) * sp * toward + Math.cos(e.t * 0.04) * 0.5;
    e.vy = ((pcy - ecy) / dist) * sp * toward + Math.sin(e.t * 0.04) * 0.5;
    moveBody(g, e, e.w, e.h, e.vx, e.vy);
    // below half health the wraith ENRAGES: faster volleys, wider fans,
    // a teleport after every one. (Canon change by testers' consensus:
    // Alexey — "второго даже не заметил", Artem — "Согласен".)
    const enraged = e.hp <= e.maxHp / 2;
    const cadence = enraged ? 55 : 85;
    if (e.t > 0 && e.t % cadence === 0) {
      const base = Math.atan2(pcy - ecy, pcx - ecx);
      const fan = enraged ? [-0.7, -0.35, 0, 0.35, 0.7] : [-0.35, 0, 0.35];
      for (const off of fan) {
        shoot(g, ecx, ecy, Math.cos(base + off) * 2.1, Math.sin(base + off) * 2.1, false);
      }
      sfx(g, "shard");
      e.phase++;
      if (enraged || e.phase >= 2) wraithTeleport(g, e);
    }
  }

  // contact damage (not while a golem is stunned & glowing)
  const harmless = (golemLike(e.kind) && e.phase === 3) || (e.kind === "wraith" && e.phase === 9);
  if (!e.dead && !harmless) {
    const si = g.activeSim ?? 0;
    g.players.forEach((p, pi) => {
      if (p.downed || !p.present || p.simIndex !== si) return;
      if (overlap(p.x, p.y, PLAYER_W, PLAYER_H, e.x, e.y, e.w, e.h)) {
        hurtPlayer(g, pi, isBoss(e.kind) ? 2 : 1,
          e.x + e.w / 2, e.y + e.h / 2);
      }
    });
  }
}

function killEnemy(g: Game, e: Enemy): void {
  e.dead = true;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  burst(g, cx, cy, "#ffffff", 12);
  sfx(g, "die");
  const spec = ROOMS[g.room];
  const alive = g.enemies.some(o => !o.dead);
  if (e.kind === "golem") {
    g.golemDead = true;
    if (!g.containers["golem"]) {
      pushPickup(g, { kind: "container", x: cx, y: cy + 20, t: 0, cid: "golem" });
    }
    g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: false };
    g.message = "The Amber Blade is revealed!";
    g.messageT = 200;
    g.shake = 14;
    sfx(g, "bossdie");
    return;
  }
  if (e.kind === "ember") {
    g.emberDead = true;
    if (!g.charmClaimed) {
      pushPickup(g, { kind: "charm", x: cx, y: cy + 18, t: 0 });
    }
    g.message = "The Ember Golem crumbles to cinders...";
    g.messageT = 220;
    g.shake = 14;
    sfx(g, "bossdie");
    return;
  }
  if (e.kind === "wraith") {
    g.wraithDead = true;
    g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: true };
    g.message = "The Winter Wraith dissolves into snow...";
    g.messageT = 220;
    g.shake = 14;
    sfx(g, "bossdie");
    return;
  }
  if (Math.random() < 0.3) pushPickup(g, { kind: "heart", x: cx, y: cy, t: 0 });
  if (spec.keyOnClear && !alive && !g.cleared[g.room]) {
    g.cleared[g.room] = true;
    pushPickup(g, { kind: "key", x: 8 * TILE, y: 7 * TILE, t: 0 });
    sfx(g, "secret");
  } else if (g.travelMode === "free" && !alive && !g.cleared[g.room]) {
    g.cleared[g.room] = true;   // free roam: cleared rooms stay pacified on revisit
  }
}

// ----------------------------------------------------------------- update
function updatePlayer(g: Game, pi: number, inp: LatchedInput): void {
  const p = g.players[pi];
  if (!p.present) return;
  if (p.invuln > 0) p.invuln--;
  if (p.transitionCd > 0) p.transitionCd--;
  if (p.crossFade > 0) p.crossFade = Math.max(0, p.crossFade - 0.05);
  if (p.crossBannerT > 0) p.crossBannerT--;
  if (p.attack > 0) p.attack--;
  if (p.bowCd > 0) p.bowCd--;
  if (p.sayT > 0) p.sayT--;

  if (p.sayT > 0) p.sayT--;

  if (!p.downed) tryFeatherRevive(g, pi, inp);

  if (p.downed) {
    const other = g.players[1 - pi];
    const touchRevive = partnerCanTouchRevive(g, pi);
    if (touchRevive && !other.downed &&
        overlap(p.x - 4, p.y - 4, PLAYER_W + 8, PLAYER_H + 8,
                other.x, other.y, PLAYER_W, PLAYER_H)) {
      p.bleedT = 0;
      p.reviveP++;
      if (p.reviveP >= WRAITH_REVIVE_NEEDED) {
        completeRevive(g, pi, 1 - pi, "Back on your feet!");
      }
    } else if (wraithAnchorsDowned(g, pi)) {
      p.bleedT = 0;
      if (g.ticks % 2 === 0) p.reviveP++;
      if (p.reviveP >= WRAITH_REVIVE_NEEDED) {
        completeRevive(g, pi, -1, "The wraith holds you in the between-world");
      }
    } else if (p.reviveP > 0) {
      p.reviveP--;
    }

    if (g.travelMode === "free" && other.present && !other.downed && !touchRevive) {
      if (p.bleedT <= 0) p.bleedT = BLEED_TICKS;
      p.bleedT--;
      if (p.bleedT <= 0) {
        g.bleedoutLoss = true;
        g.ending = bleedoutEnding(g);
        g.screen = "gameover";
        sfx(g, "gameover");
        g.message = "The cold took them while help was rooms away";
        g.messageT = 200;
      }
    } else {
      p.bleedT = 0;
    }
    return;
  }

  let dx = 0, dy = 0;
  if (inp.l) dx -= 1;
  if (inp.r) dx += 1;
  if (inp.u) dy -= 1;
  if (inp.d) dy += 1;
  p.moving = dx !== 0 || dy !== 0;
  // swinging freezes movement (canon) — leave velocity untouched so the client
  // prediction, which returns early while attacking, stays in exact lockstep
  if (p.attack === 0 &&
      tileAt(g, Math.floor((p.x + PLAYER_W / 2) / TILE),
                Math.floor((p.y + PLAYER_H / 2) / TILE)) === "z") {
    // commit-slide puzzle ice: face the locked skate direction, ignore steering.
    // EVERYONE skates — humans, agents and enemies. The agent controller is
    // slide-aware (BFS over slide-endpoints, banks off walls) so `follow`/errands
    // still work on the rink; see nextSlideWaypoint in server/agent.ts.
    slideBody(g, p, PLAYER_W, PLAYER_H, dx, dy);
    if (p.vx !== 0 || p.vy !== 0) {
      if (p.vy > 0) p.dir = 0; else if (p.vy < 0) p.dir = 1;
      if (p.vx > 0) p.dir = 2; else if (p.vx < 0) p.dir = 3;
      p.walk += 0.22;
    }
  } else if (p.attack === 0) {
    const sp = 1.35;
    const len = p.moving ? Math.hypot(dx, dy) : 1;
    const tvx = p.moving ? (dx / len) * sp : 0;
    const tvy = p.moving ? (dy / len) * sp : 0;
    if (p.moving) {
      if (dy > 0) p.dir = 0; else if (dy < 0) p.dir = 1;
      if (dx > 0) p.dir = 2; else if (dx < 0) p.dir = 3;
      p.walk += 0.18;
    }
    // slippery ice: velocity eases toward the target and coasts when released.
    // asymmetric — snappy to start/turn (ICE_ACCEL) but a long, readable glide
    // once you let go (ICE_DECEL) — that reads as real ice, not sluggish input.
    // slick OFF (or off-ice) collapses to instant motion — the exact canon path,
    // so the classic quest stays byte-identical (guarded by test).
    const onIce = g.slick &&
      tileAt(g, Math.floor((p.x + PLAYER_W / 2) / TILE),
                Math.floor((p.y + PLAYER_H / 2) / TILE)) === "i";
    if (onIce) {
      const ease = p.moving ? ICE_ACCEL : ICE_DECEL;
      p.vx += (tvx - p.vx) * ease;
      p.vy += (tvy - p.vy) * ease;
      if (Math.abs(p.vx) < 0.03) p.vx = 0;
      if (Math.abs(p.vy) < 0.03) p.vy = 0;
    } else {
      p.vx = tvx; p.vy = tvy;
    }
    if (p.vx !== 0 || p.vy !== 0) moveBody(g, p, PLAYER_W, PLAYER_H, p.vx, p.vy);
  }
  if (Math.abs(p.kx) > 0.05 || Math.abs(p.ky) > 0.05) {
    moveBody(g, p, PLAYER_W, PLAYER_H, p.kx, p.ky);
    p.kx *= 0.8; p.ky *= 0.8;
  }

  // sword
  if (inp.aE && p.attack === 0) {
    p.attack = 16;
    sfx(g, "swing");
  }
  if (p.attack > 6 && p.attack < 14) {
    const box = swordBox(p);
    const dmg = g.amberClaimed ? 2 : 1;
    for (const e of g.enemies) {
      if (e.dead || e.hurt > 0) continue;
      if (golemLike(e.kind) && e.phase !== 3) {
        if (overlap(box.x, box.y, box.w, box.h, e.x, e.y, e.w, e.h)) {
          e.hurt = 20; sfx(g, "clang");
          burst(g, box.x + box.w / 2, box.y + box.h / 2, "#cfd2e0", 4);
        }
        continue;
      }
      if (overlap(box.x, box.y, box.w, box.h, e.x, e.y, e.w, e.h)) {
        // sentinels raise their shield toward the nearest player: frontal
        // sword hits clang off — flank them or shoot them in the back
        if (e.kind === "sentinel" &&
            sentinelBlocks(e, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2)) {
          e.hurt = 14; sfx(g, "clang");
          burst(g, e.x + e.w / 2, e.y + e.h / 2, "#cfd2e0", 4);
          continue;
        }
        damageEnemy(g, e, dmg, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, pi);
      }
    }
  }

  // bow
  if (g.hasBow && inp.bE && p.bowCd === 0) {
    p.bowCd = 24;
    const [vx, vy] = DIRV[p.dir];
    shoot(g, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, vx * 3.2, vy * 3.2, true, pi);
    sfx(g, "bow");
  } else if (!g.hasBow && inp.bE && g.messageT === 0) {
    g.message = "You don't have a bow yet... seek it in the snow";
    g.messageT = 100;
  }

  // pickups
  for (const it of g.pickups) {
    if (it.t < 0) continue;
    if (playerCollectsPickup(g, p, it)) {
      if (it.kind === "heart") {
        p.hp = Math.min(p.maxHp, p.hp + 2);
        sfx(g, "pickup");
      } else if (it.kind === "key") {
        p.keys += 1;
        g.message = "You found a Vault Key!";
        g.messageT = 150;
        sfx(g, "key");
      } else if (it.kind === "bow") {
        g.hasBow = true;   // both players get to shoot — coop kindness
        g.message = "The Hunter's Bow is yours — press X to shoot (team share)";
        g.messageT = 200;
        sfx(g, "secret");
      } else if (it.kind === "container") {
        g.containers[it.cid ?? "?"] = true;
        // growth for both — but no back-door resurrection: the downed keep 0 hp
        for (const pl of g.players) { pl.maxHp += 2; if (!pl.downed) pl.hp = pl.maxHp; }
        g.message = "Heart Container! Both hearts grow";
        g.messageT = 200;
        sfx(g, "secret");
      } else if (it.kind === "charm") {
        g.charmClaimed = true;
        g.message = "The Miner's Charm! Your arrows burn with ember fire";
        g.messageT = 220;
        sfx(g, "secret");
      } else if (it.kind === "feather") {
        g.hasFeather = true;
        g.feathers[it.cid ?? "?"] = true;
        g.message = "Phoenix Feather! Press F to remotely lift a downed partner (one use)";
        g.messageT = 220;
        sfx(g, "secret");
      } else {
        if (p.elixir) continue;   // one bottle per hero — leave it for later
        p.elixir = true;
        g.elixirs[it.cid ?? "?"] = true;
        g.message = "Elixir of Life! It will catch you when you fall";
        g.messageT = 200;
        sfx(g, "secret");
      }
      it.t = -1;
    }
  }

  // locked doors — keys are a TEAM resource: either player can unlock,
  // the key is spent from whoever actually carries one (the HUD already
  // shows the pooled count, so now the lock agrees with the display)
  const teamKeys = g.players[0].keys + g.players[1].keys;
  if (!g.doors[g.room] && teamKeys > 0 && inp.u) {
    const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
    const ty = Math.floor(p.y / TILE) - 1;
    if (ty >= 0 && tileAt(g, tx, ty) === "L") {
      if (p.keys > 0) p.keys -= 1;
      else g.players[1 - pi].keys -= 1;
      g.doors[g.room] = true;
      setTile(g, 7, 0, ROOMS[g.room].tiles[1].charAt(1));
      setTile(g, 8, 0, ROOMS[g.room].tiles[1].charAt(1));
      g.message = "The ancient door grinds open...";
      g.messageT = 150;
      sfx(g, "door");
    }
  }

  // meadow ice — both the north quest gate and the south Frozen Falls curtain
  // are sealed by ancient ice; only the Amber Blade's warm edge melts them
  // (mirror mechanic — the south entrance is frozen until the blade is claimed)
  if (!g.gateMelted && g.room === 0 && inp.u) {
    const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
    const ty = Math.floor(p.y / TILE) - 1;
    if (ty >= 0 && tileAt(g, tx, ty) === "I") {
      if (g.amberClaimed) {
        meltMeadowIce(g);
        g.message = "The Amber Blade melts the ice! The north is open";
        g.messageT = 200;
        burst(g, 7.5 * TILE + 8, 8, "#9fe8ff", 14);
        sfx(g, "melt");
      } else if (g.messageT === 0) {
        g.message = "A wall of ancient ice. Something warm could melt it...";
        g.messageT = 150;
      }
    }
  }
  if (!g.gateMelted && g.room === 0 && inp.d) {
    const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
    const ty = Math.floor((p.y + PLAYER_H) / TILE) + 1;
    if (ty < ROWS && tileAt(g, tx, ty) === "F") {
      if (g.amberClaimed) {
        meltMeadowIce(g);
        g.message = "The Amber Blade wakes the Frozen Falls!";
        g.messageT = 200;
        burst(g, 7.5 * TILE + 8, H - 8, "#9fe8ff", 14);
        sfx(g, "melt");
      } else if (g.messageT === 0) {
        g.message = "A frozen underground fall blocks the way. Something warm could wake the water...";
        g.messageT = 150;
      }
    }
  }

  // pedestal
  if (g.pedestal &&
      overlap(p.x, p.y, PLAYER_W, PLAYER_H, g.pedestal.x - 8, g.pedestal.y - 4, 16, 20)) {
    if (g.pedestal.final) {
      g.ending = endingFor(g);
      g.screen = "win";
      sfx(g, "win");
      return;
    }
    g.amberClaimed = true;
    g.pedestal = null;
    g.message = "The Amber Blade is yours! Its edge burns bright";
    g.messageT = 220;
    burst(g, p.x + 5, p.y, "#ffb545", 16);
    sfx(g, "secret");
  }

  const spec = ROOMS[g.room];
  const ptx = Math.floor((p.x + PLAYER_W / 2) / TILE);
  const pty = Math.floor((p.y + PLAYER_H / 2) / TILE);
  const leaveBlocked = p.npc && g.travelMode === "free" && !canNpcLeave(g, pi);

  // teleports — caves obey the same FREE ROAM leave permission as doorways
  if (spec.teleport && p.transitionCd === 0 && tileAt(g, ptx, pty) === "c") {
    if (leaveBlocked) return;
    if (g.room === 8 && g.hardGate && !g.charmClaimed) {
      if (g.messageT === 0) {
        g.message = "Dwarven wards seal this cave... their charm lies in the burning deep";
        g.messageT = 180;
      }
      // nudge back off the tile so the message can re-fire
      p.y += 2;
      return;
    }
    // LINKED: npc cannot yank the party through a cave alone — hero must stand on the mouth
    if (p.npc && g.travelMode === "linked" && g.players[1 - pi].present) {
      const hero = g.players[1 - pi];
      const hptx = Math.floor((hero.x + PLAYER_W / 2) / TILE);
      const hpty = Math.floor((hero.y + PLAYER_H / 2) / TILE);
      if (tileAt(g, hptx, hpty) !== "c") return;
    }
    sfx(g, "stairs");
    roomTransition(g, pi, spec.teleport.room, spec.teleport.x, spec.teleport.y);
    for (const pl of g.players) {
      if (!pl.present) continue;
      markTransition(pl);
      nudgeOffCaveMouth(g, pl);
    }
    return;
  }

  // edge transitions — linked drags both; free roam moves only the crosser
  const EDGE = 2;
  const anchored = p.npc && g.travelMode === "linked" && g.players[1 - pi].present;
  const jammed = p.npc && g.travelMode === "free" && (() => {
    const hero = g.players[1 - pi];
    return hero.present && !hero.npc && hero.simIndex === p.simIndex &&
      overlap(p.x, p.y, PLAYER_W, PLAYER_H, hero.x, hero.y, PLAYER_W, PLAYER_H);
  })();
  if (anchored) {
    // the companion may press into the doorway all it likes — harmlessly
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.x < EDGE && inp.l && spec.exits.left !== undefined) {
    roomTransition(g, pi, spec.exits.left, W - PLAYER_W - EDGE, p.y);
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.x + PLAYER_W > W - EDGE && inp.r && spec.exits.right !== undefined) {
    roomTransition(g, pi, spec.exits.right, EDGE, p.y);
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.y < EDGE && inp.u && spec.exits.up !== undefined) {
    roomTransition(g, pi, spec.exits.up, p.x, H - PLAYER_H - EDGE);
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.y + PLAYER_H > H - EDGE && inp.d && spec.exits.down !== undefined) {
    roomTransition(g, pi, spec.exits.down, p.x, EDGE);
  }
  p.x = Math.max(0, Math.min(W - PLAYER_W, p.x));
  p.y = Math.max(0, Math.min(H - PLAYER_H, p.y));

  // doorway yield: npc pressed into an edge too long — step to room center so
  // the party doesn't freeze (LINKED anchor + FREE ROAM door camp)
  if (p.npc) {
    const EDGE = 2;
    const pressing = inp.l || inp.r || inp.u || inp.d;
    const atEdge = p.x < EDGE || p.x + PLAYER_W > W - EDGE ||
      p.y < EDGE || p.y + PLAYER_H > H - EDGE;
    if (atEdge && pressing) {
      p.doorCampT++;
      if (p.doorCampT > 90) {
        p.x = 7.5 * TILE;
        p.y = 8 * TILE;
        p.doorCampT = 0;
        p.transitionCd = 0;
      }
    } else if (!atEdge) {
      p.doorCampT = 0;
    }
  }
}

function tickSimPhysics(g: Game): void {
  const si = g.activeSim ?? 0;
  // projectiles
  for (const pr of g.projectiles) {
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.life--;
    if (solidAt(g, pr.x, pr.y)) {
      pr.life = 0;
      burst(g, pr.x, pr.y, pr.friendly ? "#c7ad78" : "#9fe8ff", 4);
      continue;
    }
    if (pr.friendly) {
      for (const e of g.enemies) {
        if (e.dead || e.hurt > 0) continue;
        if (pr.x > e.x && pr.x < e.x + e.w && pr.y > e.y && pr.y < e.y + e.h) {
          if (golemLike(e.kind) && e.phase !== 3) {
            e.hurt = 12; sfx(g, "clang");
          } else if (e.kind === "sentinel" &&
                     sentinelBlocks(e, pr.x - pr.vx * 8, pr.y - pr.vy * 8)) {
            e.hurt = 10;
            e.stagger = 45;
            sfx(g, "clang");
            burst(g, pr.x, pr.y, "#cfd2e0", 6);
          } else {
            damageEnemy(g, e, g.charmClaimed ? 2 : 1,
              pr.x - pr.vx * 4, pr.y - pr.vy * 4, pr.owner);
          }
          pr.life = 0;
          break;
        }
      }
    } else {
      g.players.forEach((p, pi) => {
        if (p.downed || !p.present || p.simIndex !== si || pr.life <= 0) return;
        if (pr.x > p.x && pr.x < p.x + PLAYER_W && pr.y > p.y && pr.y < p.y + PLAYER_H) {
          hurtPlayer(g, pi, 1, pr.x - pr.vx * 8, pr.y - pr.vy * 8);
          pr.life = 0;
        }
      });
    }
  }
  g.projectiles = g.projectiles.filter(pr => pr.life > 0);

  for (const e of g.enemies) if (!e.dead) updateEnemy(g, e);

  // the spared wraith drifts with heroes in this sim and joins the fight
  if (g.companion) {
    const c = g.companion;
    c.t++;
    let tx = 0, ty = 0, n = 0;
    // spirit anchor: stay on a downed hero while a living partner shares the room
    if (g.wraithSpared) {
      for (let pi = 0; pi < 2; pi++) {
        const p = g.players[pi];
        if (!p.present || !p.downed || p.simIndex !== si) continue;
        if (!partnerCanTouchRevive(g, pi)) continue;
        tx = p.x + PLAYER_W / 2 - 10;
        ty = p.y + PLAYER_H / 2 - 10;
        n = 1;
        break;
      }
    }
    if (n === 0) {
      let ax = 0, ay = 0;
      for (const p of g.players) {
        if (!p.present || p.simIndex !== si) continue;
        ax += p.x; ay += p.y; n++;
      }
      if (n > 0) {
        tx = ax / n - 4;
        ty = ay / n - 22;
      }
    }
    if (n > 0) {
      const pull = n === 1 && g.wraithSpared ? 0.08 : 0.03;
      c.x += (tx - c.x) * pull + Math.cos(c.t * 0.04) * 0.3;
      c.y += (ty - c.y) * pull + Math.sin(c.t * 0.05) * 0.25;
    }
    if (c.t % 130 === 60) {
      let best: Enemy | null = null, bd = 160;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const bx = best.x + best.w / 2, by = best.y + best.h / 2;
        const base = Math.atan2(by - c.y, bx - c.x);
        for (const off of [-0.3, 0, 0.3]) {
          shoot(g, c.x + 10, c.y + 10, Math.cos(base + off) * 2.0, Math.sin(base + off) * 2.0, true);
        }
        sfx(g, "shard");
      }
    }
  }
  for (const it of g.pickups) {
    if (it.t < 0) continue;
    if (pickupWedged(g, it.x, it.y)) {
      const spot = settlePickupPos(g, it.x, it.y);
      it.x = spot.x;
      it.y = spot.y;
    }
  }
  g.pickups = g.pickups.filter(it => {
    if (it.t < 0) return false;
    it.t++;
    return true;
  });
}

export function update(g: Game, inputs: [LatchedInput, LatchedInput]): void {
  switch (g.screen) {
    case "menu":
    case "lobby":
      // server drives these: menu → setup choice, lobby → both seats filled
      break;
    case "title":
      if (inputs.some(i => i.stE || i.aE)) {
        g.screen = "play";
        sfx(g, "pickup");
      }
      break;
    case "play": {
      g.ticks++;
      if (g.fade > 0) g.fade = Math.max(0, g.fade - 0.05);
      if (g.shake > 0) g.shake--;
      if (g.messageT > 0) g.messageT--;

      const coopFree = g.travelMode === "free" && g.players[0].present && g.players[1].present;
      if (coopFree) clampSimIndices(g);
      if (coopFree) {
        for (let pi = 0; pi < 2; pi++) {
          if (!g.players[pi].present) continue;
          g.activeSim = g.players[pi].simIndex;
          updatePlayer(g, pi, inputs[pi]);
          if (g.screen !== "play") return;
        }
        const simsToTick = [...new Set(
          g.players.filter(p => p.present).map(p => p.simIndex),
        )];
        for (const si of simsToTick) {
          g.activeSim = si;
          tickSimPhysics(g);
        }
      } else {
        g.activeSim = 0;
        for (let pi = 0; pi < 2; pi++) {
          updatePlayer(g, pi, inputs[pi]);
          if (g.screen !== "play") return;
        }
        tickSimPhysics(g);
      }
      break;
    }
    case "gameover":
    case "win":
      if (inputs.some(i => i.stE)) {
        const present0 = g.players[0].present, present1 = g.players[1].present;
        const npc1 = g.players[1].npc;
        const hardGate = g.hardGate;
        const travelMode = g.travelMode;
        const slick = g.slick;
        Object.assign(g, newGame());
        g.players[0].present = present0;
        g.players[1].present = present1;
        g.players[1].npc = npc1;
        g.hardGate = hardGate;
        g.travelMode = travelMode;
        g.slick = slick;
        g.screen = "play";
      }
      break;
  }
}

// -------------------------------------------------------------- snapshots
/** compact scry-mirror of a partner in another room (Stage 2+).
 *  null while both heroes share a sim — clients hide the window. */
export interface PartnerView {
  room: number;
  roomName: string;
  tiles: string[];
  player: {
    x: number; y: number; dir: Dir; hp: number; maxHp: number;
    downed: boolean; say: string; sayT: number;
  };
  enemies: { kind: EnemyKind; x: number; y: number; hp: number; maxHp: number;
             hurt: number; phase: number; t: number; dead: boolean; spareP: number; stagger: number }[];
  pickups: { kind: PickupKind; x: number; y: number }[];
  projectiles: { x: number; y: number; vx: number; vy: number; friendly: boolean }[];
  companion: { x: number; y: number; t: number } | null;
}

export interface Snapshot {
  screen: GameScreen;
  room: number;
  roomName: string;
  tiles: string[];
  players: {
    x: number; y: number; dir: Dir; hp: number; maxHp: number; keys: number;
    attack: number; invuln: number; walk: number; moving: boolean;
    downed: boolean; elixir: boolean; reviveP: number; bleedT: number;
    doorCamp: boolean;
    say: string; sayT: number; present: boolean;
  }[];
  enemies: { kind: EnemyKind; x: number; y: number; hp: number; maxHp: number;
             hurt: number; phase: number; t: number; dead: boolean; spareP: number; stagger: number }[];
  companion: { x: number; y: number; t: number } | null;
  pickups: { kind: PickupKind; x: number; y: number }[];
  projectiles: { x: number; y: number; vx: number; vy: number; friendly: boolean }[];
  pedestal: { x: number; y: number; final: boolean } | null;
  hasBow: boolean; amberClaimed: boolean; charm: boolean; hasFeather: boolean;
  message: string; messageT: number;
  shake: number; ticks: number; fade: number;
  events: GameEvent[];
  names: [string, string];
  stats: [PlayerStats, PlayerStats];
  ending: Ending | null;
  thought?: { action: string; why?: string; ms: number } | null;
  partnerView?: PartnerView | null;
  mode?: string | null;   // session mode — clients use for spectator UI
  slick?: boolean;        // slippery ice on — client prediction must mirror it
  ack?: number;           // last input seq the server applied for this viewer
  ackX?: number;          // where the hero stood when that input arrived — the
  ackY?: number;          // twin of the client's own anchor, so lag cancels out
}

function serEnemy(e: Enemy): Snapshot["enemies"][number] {
  return {
    kind: e.kind, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
    hurt: e.hurt, phase: e.phase, t: e.t, dead: e.dead, spareP: e.spareP, stagger: e.stagger,
  };
}

function serPlayer(p: Player, inSim: boolean): Snapshot["players"][number] {
  return {
    x: p.x, y: p.y, dir: p.dir, hp: p.hp, maxHp: p.maxHp, keys: p.keys,
    attack: p.attack, invuln: p.invuln, walk: p.walk, moving: p.moving,
    downed: p.downed, elixir: p.elixir, reviveP: p.reviveP, bleedT: p.bleedT,
    doorCamp: p.npc && p.doorCampT > 30, say: p.say, sayT: p.sayT,
    present: p.present && inSim,
  };
}

function partnerViewFor(g: Game, viewerSlot: number, viewerSimIdx: number): PartnerView | null {
  const ps = 1 - viewerSlot;
  const partner = g.players[ps];
  if (!partner.present || partner.simIndex === viewerSimIdx) return null;
  const sim = simOf(g, ps);
  return {
    room: sim.room,
    roomName: ROOMS[sim.room].name,
    tiles: (sim.tiles[sim.room] ?? ROOMS[sim.room].tiles).slice(),
    player: {
      x: partner.x, y: partner.y, dir: partner.dir, hp: partner.hp, maxHp: partner.maxHp,
      downed: partner.downed, say: partner.say, sayT: partner.sayT,
    },
    enemies: sim.enemies.map(serEnemy),
    pickups: sim.pickups.filter(it => it.t >= 0).map(it => ({ kind: it.kind, x: it.x, y: it.y })),
    projectiles: sim.projectiles.map(pr => ({
      x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, friendly: pr.friendly,
    })),
    companion: g.companion,
  };
}

function viewerOverlay(g: Game, viewerSlot: number): { message: string; messageT: number; fade: number } {
  const vp = g.players[viewerSlot];
  const coopFree = g.travelMode === "free" && g.players[0].present && g.players[1].present;
  if (!coopFree) {
    return { message: g.message, messageT: g.messageT, fade: g.fade };
  }
  if (vp.crossBannerT > 0) {
    return { message: vp.crossBanner, messageT: vp.crossBannerT, fade: vp.crossFade };
  }
  if (g.messageT > 0) {
    return { message: g.message, messageT: g.messageT, fade: vp.crossFade };
  }
  return { message: "", messageT: 0, fade: vp.crossFade };
}

export function toSnapshot(g: Game, names: [string, string],
                           viewerSlot = 0, clearEvents = true): Snapshot {
  const simIdx = g.players[viewerSlot]?.simIndex ?? 0;
  const sim = g.sims[simIdx] ?? g.sims[0];
  const overlay = viewerOverlay(g, viewerSlot);
  const snap: Snapshot = {
    screen: g.screen,
    room: sim.room,
    roomName: ROOMS[sim.room].name,
    tiles: (sim.tiles[sim.room] ?? ROOMS[sim.room].tiles).slice(),
    players: g.players.map(p => serPlayer(p, p.simIndex === simIdx)),
    enemies: sim.enemies.map(serEnemy),
    companion: g.companion ? { ...g.companion } : null,
    pickups: sim.pickups.filter(it => it.t >= 0).map(it => ({ kind: it.kind, x: it.x, y: it.y })),
    projectiles: sim.projectiles.map(pr => ({
      x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, friendly: pr.friendly,
    })),
    pedestal: sim.pedestal,
    hasBow: g.hasBow, amberClaimed: g.amberClaimed, charm: g.charmClaimed, hasFeather: g.hasFeather,
    slick: g.slick,
    message: overlay.message, messageT: overlay.messageT,
    shake: g.shake, ticks: g.ticks, fade: overlay.fade,
    events: g.events.slice(),
    names,
    stats: [ { ...g.stats[0] }, { ...g.stats[1] } ],
    ending: g.ending,
    partnerView: partnerViewFor(g, viewerSlot, simIdx),
  };
  if (clearEvents) g.events = [];
  return snap;
}

export function latch(cur: Input, prev: Input): LatchedInput {
  return {
    ...cur,
    aE: cur.a && !prev.a,
    bE: cur.b && !prev.b,
    stE: cur.st && !prev.st,
    fE: cur.f && !prev.f,
  };
}

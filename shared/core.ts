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
  "nnnnnnnnnnnnnnnn",   // open left → Temptation Court; open right → Glacier Gate
  "nnnnnnnnnnnnnnnn",
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

// Pre-Architect Temptation Court: Whisperer (does not fight) + sentinels.
// Additive wing off Frost Woods; AI DUO must visit before the Wraith throne.
const ROOM_TEMPTATION = [
  "WWWWWWWWWWWWWWWW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffWWffffffW",
  "Wfffffffffffffff",   // open right → Frost Woods
  "Wfffffffffffffff",
  "WffffffWWffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffWffffffffWffW",
  "WffffffffffffffW",
  "WWWWWWWWWWWWWWWW",
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
    name: "Frost Woods", tiles: ROOM_FROSTWOODS, exits: { down: 6, right: 8, left: 18 },
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
      // two sentinels skate a slow guard around the Frost Bell in the centre;
      // the doors stay open — this is an optional challenge, never a lock-in
      { kind: "sentinel", x: 4 * TILE, y: 6 * TILE },
      { kind: "sentinel", x: 11 * TILE, y: 6 * TILE },
    ],
  },
  { // 18 — Temptation Court (pre-Architect). Whisperer does not fight and cannot
    //   be slain — bargain / leave only. Sentinels make lingering costly. AI DUO
    //   + TREASON must visit before the Wraith throne (duoTemptGate); human paths
    //   see an optional wing when TREASON is on. Judgment (take the whispered
    //   deal or not) is the model's — mechanics never press Input.k.
    name: "Temptation Court", tiles: ROOM_TEMPTATION, exits: { right: 7 },
    boss: true,
    enemies: [
      { kind: "whisperer", x: 7 * TILE, y: 5 * TILE },
      { kind: "sentinel", x: 3 * TILE, y: 4 * TILE },
      { kind: "sentinel", x: 11 * TILE, y: 4 * TILE },
      { kind: "sentinel", x: 3 * TILE, y: 9 * TILE },
      { kind: "sentinel", x: 11 * TILE, y: 9 * TILE },
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
export type EnemyKind =
  "slime" | "bat" | "golem" | "wisp" | "wraith" | "sentinel" | "spitter" | "ember" | "whisperer";
/** golem-family: armored except while stunned (phase 3) */
export const golemLike = (k: EnemyKind): boolean => k === "golem" || k === "ember";
export const isBoss = (k: EnemyKind): boolean =>
  k === "golem" || k === "wraith" || k === "ember" || k === "whisperer";

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
  frozen: number;      // Frost Bell: ticks held still by winter's ring (still hittable)
}

export type PickupKind = "heart" | "key" | "bow" | "container" | "elixir" | "charm"
  | "feather" | "frostbell" | "mirror" | "embermercy";
export type TemptationPayoff =
  "dark-commit" | "winter-ascends" | "redeemed" | "refused" | null;
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

/** Frost Bell: optional Frozen Playground reward, sentinel-guarded. One use —
 *  press C to freeze the current room's lesser foes (~3s). Never mandatory. */
export const BELLS: { id: string; room: number; x: number; y: number }[] = [
  { id: "rink", room: 17, x: 7.5 * TILE, y: 6 * TILE + 8 },
];

/** Mirror Shard: optional Amber Lake artifact that sharpens the partner scry
 *  window. QUIRK: only claimable while you stand ALONE in the lake — the moment
 *  a second hero enters, the shard shatters FOREVER (a reward for solitude; a
 *  small moral hazard against always grouping up). See mirrorLost. */
export const MIRRORS: { id: string; room: number; x: number; y: number }[] = [
  { id: "lake", room: 2, x: 5 * TILE + 8, y: 3 * TILE + 8 },
];

/** Ember Mercy: optional Ember Sanctum relic — redeem a fallen dark partner within 30s */
export const EMBER_MERCY: { id: string; room: number; x: number; y: number }[] = [
  { id: "sanctum", room: 16, x: 5 * TILE + 8, y: 8 * TILE },
];

/** FREE ROAM alone-down bleed window — 30s at 60 Hz */
export const BLEED_TICKS = 1800;
/** Temptation Court: hold SHIFT near Whisperer to commit (~3s at 60 Hz) */
export const DARK_RITUAL_TICKS = 180;
export const DARK_RITUAL_RANGE = 48;
/** Cannot renounce the dark brand until lock expires (~20s) */
export const DARK_LOCK_TICKS = 1200;
export const DARK_RENOUNCE_TICKS = 90;
/** Light partner may redeem a fallen dark hero with Ember Mercy — 30s */
export const REDEMPTION_TICKS = 1800;
/** Living dark hero may spend Ember Mercy on THEMSELVES within 60s of commit */
export const DARK_SELF_REDEEM_TICKS = 3600;
export const COURT_SENTINEL_HARD_HP = 6;
export const COURT_SENTINEL_SOFT_HP = 2;
/** Co-op: downed in a CLEAR room (no living foes) without a revive → bond cuts.
 *  15 s at 60 Hz. Survivor quests on alone (`Player.dead`). Scoring: TREASON-off
 *  → ordinary SOLO; TREASON-on → implicit betrayal (v3.1). */
export const NEGLECT_ABANDON_TICKS = 900;
/** Betrayal v3.2 — Winter Mark: −1 heart every 20 s until cleansed. */
export const WINTER_MARK_PERIOD = 1200;
export const WINTER_MARK_DAMAGE = 2;
/** Betrayal duel: undeclared hero gets a brief Judge shield to answer (~4 s). */
export const DUEL_VICTIM_SHIELD_TICKS = 240;
/** spared wraith: half-speed touch-revive when hugging a downed hero (same room only) */
const WRAITH_ANCHOR_RANGE = 48;
const WRAITH_REVIVE_NEEDED = 90;
export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  friendly: boolean; life: number; owner?: number;
  betray?: boolean;   // TREASON: a "friendly" arrow that also strikes the shooter's partner
  /** v3.4: arrow was loosed with SHIFT — counts as a duel declaration on hit */
  betrayDeclare?: boolean;
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
  dead: boolean;        // TREASON: cut down for good by a partner's abandonment — no revive, no re-bleed
  elixir: boolean;      // carried Elixir of Life (auto-revive on fall)
  reviveP: number;      // 0..90 revive progress while partner touches
  bleedT: number;       // FREE ROAM alone-down countdown (ticks)
  neglectT: number;     // clear-room downed ticks without help → auto-abandon
  say: string; sayT: number;
  present: boolean;     // slot occupied by a connected player/agent
  npc: boolean;         // an AI companion: free to cower in doorways, but
                        // room transitions belong to heroes while one remains
  simIndex: number;     // which RoomSim this body inhabits (stage 1: always 0)
  transitionCd: number; // ticks before another room edge-cross (anti door ping-pong)
  crossFade: number;    // free roam: room-transition fade for this viewer only
  crossBanner: string; crossBannerT: number;
  doorCampT: number;   // npc doorway camping — triggers auto-yield (never blocks hero input)
  darkSide: boolean;   // Temptation Court: accepted winter's bargain (purple blade)
  darkLockT: number;   // ticks before renounce allowed
  darkRitualT: number; // SHIFT-near-Whisperer commit progress
  darkRenounceT: number;
  darkFallen: boolean; // downed by light partner — awaiting Ember Mercy or permanent death
  redemptionT: number; // countdown while darkFallen
  darkSelfRedeemT: number; // after commit: window to spend Ember Mercy on self (60s)
  /** Betrayal v3.2: traitor SOLO curse — drains a heart every WINTER_MARK_PERIOD */
  winterMark: boolean;
  winterMarkT: number; // ticks accrued toward the next heart drain
}

export type GameScreen = "menu" | "lobby" | "title" | "play" | "gameover" | "win";
export type TravelMode = "linked" | "free";

export interface Input {
  l: boolean; r: boolean; u: boolean; d: boolean;
  a: boolean; b: boolean; st: boolean; f: boolean;
  c: boolean;   // ring the Frost Bell (one-use room freeze)
  k: boolean;   // TREASON modifier: hold while attacking to also strike your partner
}
export interface LatchedInput extends Input {
  aE: boolean; bE: boolean; stE: boolean; fE: boolean; cE: boolean; kE: boolean;   // fresh-press edges
}
export const emptyInput = (): Input =>
  ({ l: false, r: false, u: false, d: false, a: false, b: false, st: false, f: false, c: false, k: false });

export interface Ending { id: string; title: string; lines: string[]; }

/** Fahrenheit-style: the epilogue is read off the state of the world.
 *  Priority: solo fates → a partner left in the snow → flawless run →
 *  the fire route → the classic ending (verbatim, for the canon). */
export function endingFor(g: Game): Ending {
  // A cord-cut / soft-neglect corpse still has present=true — count living heroes.
  const living = g.players.filter(p => p.present && !p.dead);
  const solo = living.length <= 1;
  const totalDowns = g.stats[0].downs + g.stats[1].downs;
  if (g.temptationPayoff === "winter-ascends") {
    return { id: "winter-ascends", title: "THE CROWN OF ASH", lines: [
      "winter kept its promise — one hero stands immortal in the cold.",
      "the throne needs no wraith; evil already won." ] };
  }
  // TREASON ledger: betrayal ending unless the Mark was cleansed (v3.2).
  // winter-ascends (Temptation) still outranks; cleansed Mark → redeemed.
  if (g.betrayed && g.winterMarkCleansed) {
    return { id: "redeemed", title: "ASH AND MERCY", lines: [
      "you turned the blade — then burned the brand, or knelt to winter's mercy.",
      "spring came for a traitor who chose the light again." ] };
  }
  if (g.betrayed) {
    return { id: "betrayal", title: "THE BLADE THAT TURNED", lines: [
      "spring came — but one hero reached it over the other's blood.",
      "the songs will name a traitor, and the winter will smile." ] };
  }
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
  // Downed-but-revivable partner (not a permanent corpse).
  if (g.players.some(p => p.present && p.downed && !p.dead)) {
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
  hasEmberMercy: boolean;  // Ember Sanctum relic — redeem a fallen dark partner (one use)
  hasBell: boolean;        // Frost Bell carried (team, one use)
  hasMirror: boolean;      // Mirror Shard claimed — sharpens the partner scry window
  mirrorLost: boolean;     // the shard shattered (two heroes shared the lake) — gone forever
  containers: Record<string, boolean>;
  elixirs: Record<string, boolean>;
  feathers: Record<string, boolean>;
  emberMercies: Record<string, boolean>;
  bells: Record<string, boolean>;
  mirrors: Record<string, boolean>;
  emberMercyUsed: boolean;
  wraithDead: boolean;
  emberDead: boolean;
  charmClaimed: boolean;
  hardGate: boolean;   // seal the glacier behind the charm (menu choice)
  /** AI DUO only: Wraith throne sealed until Temptation Court is visited. */
  duoTemptGate: boolean;
  temptationVisited: boolean;   // any hero entered room 18
  temptationResolved: boolean;  // left room 18 after visit (Whisperer cannot be slain)
  temptationDeal: boolean;      // accepted the Whisperer's bargain (dark ritual)
  /** Observable fork outcome — dark-commit / winter-ascends / redeemed / refused */
  temptationPayoff: TemptationPayoff;
  slick: boolean;      // slippery ice — heroes coast on "i" tiles (menu toggle, default off)
  treason: boolean;    // friendly fire enabled — hold TREASON key while attacking to strike your partner (menu toggle, default off)
  betrayed: boolean;   // TREASON ledger: partner downed by blade/gesture/TREASON-on neglect
  /** How the bond broke — first cause wins. null for TREASON-off soft neglect (v3.1). */
  betrayalCause: "blade" | "cord-cut" | "neglect" | null;
  /** Betrayal v3.2: Mark was cleansed (Ember Mercy or Wraith spare) — ending may be redeemed */
  winterMarkCleansed: boolean;
  /** Betrayal v3.4: sealed living-vs-living duel — exits locked, open FF, mob shield */
  betrayalDuel: boolean;
  /** Which slots declared (Shift/veilcut strike). Mutual → Mark on whoever wins. */
  betrayalDeclarers: [boolean, boolean];
  wraithSpared: boolean;
  companion: { x: number; y: number; t: number; sim: number } | null;   // the spared wraith (lives in ONE sim)
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
  betrayalDmg: number; betrayalDowns: number;   // TREASON: harm this hero dealt to their PARTNER
}
export const emptyStats = (): PlayerStats =>
  ({ dmgDealt: 0, bossDmg: 0, kills: 0, dmgTaken: 0, downs: 0, revives: 0, elixirsUsed: 0,
     betrayalDmg: 0, betrayalDowns: 0 });

function sfx(g: Game, name: string): void { g.events.push({ t: "sfx", name }); }
function burst(g: Game, x: number, y: number, color: string, n = 8): void {
  g.events.push({ t: "burst", x, y, color, n });
}

export function newPlayer(idx: number): Player {
  return {
    x: (3 + idx * 1.5) * TILE, y: 6.5 * TILE, dir: 0,
    hp: 6, maxHp: 6, keys: 0,
    attack: 0, bowCd: 0, invuln: 0, kx: 0, ky: 0, vx: 0, vy: 0, walk: 0, moving: false,
    downed: false, dead: false, elixir: false, reviveP: 0, bleedT: 0, neglectT: 0, say: "", sayT: 0, present: false, npc: false, simIndex: 0,
    transitionCd: 0, crossFade: 0, crossBanner: "", crossBannerT: 0, doorCampT: 0,
    darkSide: false, darkLockT: 0, darkRitualT: 0, darkRenounceT: 0,
    darkFallen: false, redemptionT: 0, darkSelfRedeemT: 0,
    winterMark: false, winterMarkT: 0,
  };
}

export function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const big = isBoss(kind);
  const hp =
    kind === "golem" ? 14 :
    kind === "ember" ? 18 :
    kind === "wraith" ? 16 :
    kind === "whisperer" ? 40 :   // display-only — blows never land (judgment via bargain)
    kind === "sentinel" ? 4 :
    kind === "bat" ? 2 :
    kind === "wisp" || kind === "spitter" ? 2 : 3;
  return {
    kind, x, y,
    w: big ? 28 : 12, h: big ? 28 : 12,
    hp, maxHp: hp,
    hurt: 0, kx: 0, ky: 0, t: 0, phase: 0, vx: 0, vy: 0, dead: false, spareP: 0, stagger: 0,
    frozen: 0,
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
    (index === 16 && g.emberDead) ||
    (index === 18 && g.temptationResolved);
  if (!skipEnemies) {
    for (const e of spec.enemies) g.enemies.push(makeEnemy(e.kind, e.x, e.y));
  }
  if (index === 18) {
    g.temptationVisited = true;
    applyCourtSentinelStance(g);
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
  for (const em of EMBER_MERCY) {
    if (em.room === index && !g.emberMercies[em.id] && !g.hasEmberMercy) {
      pushPickup(g, { kind: "embermercy", x: em.x, y: em.y, t: 0, cid: em.id });
    }
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
  for (const be of BELLS) {
    if (be.room === index && !g.bells[be.id] && !g.hasBell) {
      pushPickup(g, { kind: "frostbell", x: be.x, y: be.y, t: 0, cid: be.id });
    }
  }
  for (const mi of MIRRORS) {
    if (mi.room === index && !g.mirrors[mi.id] && !g.hasMirror && !g.mirrorLost) {
      pushPickup(g, { kind: "mirror", x: mi.x, y: mi.y, t: 0, cid: mi.id });
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
  // Temptation Court west door: solid ice-wall look unless TREASON is on
  // (no betrayal bargain without the traitor's blade setting — avoid the
  // contradiction of an open Whisperer wing under TREASON-off Classic).
  if (index === 7) {
    const edge = temptationCourtOpen(g) ? "n" : "m";
    setTile(g, 0, 6, edge);
    setTile(g, 0, 7, edge);
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
  // FREE ROAM merge truncates sims[] — never leave activeSim pointing past the end
  // (legacy accessors read sims[activeSim]; an orphan index crashes the tick).
  if (g.activeSim < 0 || g.activeSim >= g.sims.length) g.activeSim = 0;
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
    clampSimIndices(g);
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
      if (g.sims.length > 1) g.sims.length = 1;
      g.activeSim = 0; // merged room lives on sims[0]; nudge against it
      p.x = px; p.y = py;
      nudgeOffCaveMouth(g, p);
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
  clampSimIndices(g); // saved may be 1 after a merge truncated sims to length 1
}

function roomTransition(g: Game, pi: number, index: number, px: number, py: number): void {
  const from = simOf(g, pi).room;
  if (from === 18 && index !== 18 && g.temptationVisited) {
    g.temptationResolved = true;
    if (!g.temptationDeal && !g.temptationPayoff) g.temptationPayoff = "refused";
  }
  const coop = g.players[0].present && g.players[1].present;
  if (g.travelMode === "free" && coop) {
    freeRoamTransition(g, pi, index, px, py);
    return;
  }
  loadRoom(g, index, px, py);
}

/** AI DUO + TREASON: Wraith throne stays shut until Temptation Court is visited. */
export function throneTemptSealed(g: Game): boolean {
  return g.duoTemptGate && g.treason && !g.temptationVisited;
}

/** Temptation Court (room 18) is a TREASON-bargain wing — sealed when TREASON is off. */
export function temptationCourtOpen(g: Game): boolean {
  return g.treason;
}

/** Court sentinels: hard while refusing (no dark hero), soft after dark commit */
function applyCourtSentinelStance(g: Game): void {
  if (g.room !== 18) return;
  const anyDark = g.players.some(p => p.present && p.darkSide);
  for (const e of g.enemies) {
    if (e.kind !== "sentinel" || e.dead) continue;
    if (anyDark) {
      e.maxHp = COURT_SENTINEL_SOFT_HP;
      e.hp = Math.min(e.hp, COURT_SENTINEL_SOFT_HP);
      e.frozen = Math.max(e.frozen, 120);
    } else {
      e.maxHp = COURT_SENTINEL_HARD_HP;
      e.hp = Math.max(e.hp, COURT_SENTINEL_HARD_HP);
    }
  }
}

function courtHasWhisperer(g: Game): boolean {
  return g.enemies.some(e => e.kind === "whisperer" && !e.dead);
}

function distToWhisperer(g: Game, p: Player): number {
  const w = g.enemies.find(e => e.kind === "whisperer" && !e.dead);
  if (!w) return Infinity;
  const px = p.x + PLAYER_W / 2, py = p.y + PLAYER_H / 2;
  const wx = w.x + w.w / 2, wy = w.y + w.h / 2;
  return Math.hypot(px - wx, py - wy);
}

function commitDarkSide(g: Game, pi: number): void {
  const p = g.players[pi];
  if (p.darkSide) return;
  p.darkSide = true;
  p.darkLockT = DARK_LOCK_TICKS;
  p.darkRitualT = 0;
  p.darkRenounceT = 0;
  p.darkSelfRedeemT = DARK_SELF_REDEEM_TICKS;
  if (!g.temptationDeal) {
    g.temptationDeal = true;
    g.temptationPayoff = "dark-commit";
  }
  burst(g, p.x + 5, p.y + 6, "#c89bff", 20);
  sfx(g, "secret");
  g.message = "The blade drinks winter — Ember Mercy (60s) or finish the bargain";
  g.messageT = 240;
  if (g.room === 18) applyCourtSentinelStance(g);
}

function renounceDarkSide(g: Game, pi: number): void {
  const p = g.players[pi];
  if (!p.darkSide || p.darkLockT > 0) return;
  p.darkSide = false;
  p.darkRenounceT = 0;
  p.darkRitualT = 0;
  p.darkSelfRedeemT = 0;
  burst(g, p.x + 5, p.y + 6, "#9fe8ff", 14);
  sfx(g, "melt");
  g.message = "The brand cools — winter remembers";
  g.messageT = 200;
  if (g.room === 18) applyCourtSentinelStance(g);
}

function spendEmberMercySelf(g: Game, pi: number): void {
  const p = g.players[pi];
  if (!p.darkSide || p.darkSelfRedeemT <= 0 || !g.hasEmberMercy) return;
  g.hasEmberMercy = false;
  g.emberMercyUsed = true;
  g.emberMercies["sanctum"] = true;
  p.darkSide = false;
  p.darkLockT = 0;
  p.darkRenounceT = 0;
  p.darkRitualT = 0;
  p.darkSelfRedeemT = 0;
  // Dark self-redeem also burns a Winter Mark if both brands are present.
  if (p.winterMark) clearWinterMark(g, pi, "ember");
  g.temptationPayoff = "redeemed";
  burst(g, p.x + 5, p.y + 6, "#ff7a3d", 18);
  sfx(g, "revive");
  g.message = "Ember Mercy burns the brand — you walk in the light again";
  g.messageT = 240;
  if (g.room === 18) applyCourtSentinelStance(g);
}

/** Brand a living traitor with Winter Mark (v3.2). Idempotent. */
function applyWinterMark(g: Game, pi: number, announce = true): void {
  const p = g.players[pi];
  if (!p.present || p.dead || p.winterMark) return;
  p.winterMark = true;
  p.winterMarkT = 0;
  burst(g, p.x + 5, p.y + 6, "#7a9cff", 12);
  sfx(g, "secret");
  if (announce) {
    g.message = "Winter Mark brands you — one heart every 20s until Ember Mercy or the Wraith's mercy";
    g.messageT = 240;
  }
}

/** Clear Winter Mark; ledger `betrayed` stays. Sets winterMarkCleansed for ending. */
function clearWinterMark(g: Game, pi: number, via: "ember" | "wraith"): void {
  const p = g.players[pi];
  if (!p.winterMark) return;
  p.winterMark = false;
  p.winterMarkT = 0;
  g.winterMarkCleansed = true;
  burst(g, p.x + 5, p.y + 6, via === "ember" ? "#ff7a3d" : "#bfe9ff", 16);
  sfx(g, "melt");
  g.message = via === "ember"
    ? "Ember Mercy burns the Winter Mark — the brand cools"
    : "The spared wraith lifts the Winter Mark — winter forgives what steel will not";
  g.messageT = 240;
}

/** Discrete heart drain — invuln does not block the Mark. */
function tickWinterMark(g: Game, pi: number): void {
  const p = g.players[pi];
  if (!p.winterMark || p.downed || p.dead) return;
  p.winterMarkT++;
  if (p.winterMarkT < WINTER_MARK_PERIOD) return;
  p.winterMarkT = 0;
  p.hp -= WINTER_MARK_DAMAGE;
  g.stats[pi].dmgTaken += WINTER_MARK_DAMAGE;
  g.shake = 6;
  sfx(g, "hurt");
  burst(g, p.x + 5, p.y + 6, "#7a9cff", 10);
  if (p.hp > 0) {
    if (g.messageT < 40) {
      g.message = "Winter Mark drains a heart...";
      g.messageT = 100;
    }
    return;
  }
  if (p.elixir) {
    g.stats[pi].elixirsUsed += 1;
    p.elixir = false;
    p.hp = Math.max(4, Math.floor(p.maxHp / 2));
    p.invuln = 90;
    burst(g, p.x + 5, p.y + 6, "#ffd257", 16);
    sfx(g, "revive");
    g.message = "The Elixir pulls you back — but the Mark remains";
    g.messageT = 180;
    return;
  }
  // Mark finishes the traitor — permanent death
  p.hp = 0;
  p.downed = true;
  p.dead = true;
  p.winterMark = false;
  p.winterMarkT = 0;
  g.stats[pi].downs += 1;
  sfx(g, "down");
  const living = g.players.filter(pl => pl.present && !pl.dead);
  if (living.length === 0) {
    g.screen = "gameover";
    g.message = "Winter Mark claims the last heart — the traitor falls alone";
    g.messageT = 220;
    sfx(g, "gameover");
  } else {
    g.message = "Winter Mark claims them — one walks on";
    g.messageT = 200;
  }
}

/** Ember Mercy: redeem a fallen dark partner, OR (living) self — dark window OR Winter Mark */
function tryEmberMercyRedeem(g: Game, pi: number, inp: LatchedInput): void {
  if (!(inp.f || inp.fE) || !g.hasEmberMercy) return;
  const p = g.players[pi];
  if (p.downed) return;
  const oi = 1 - pi;
  const o = g.players[oi];
  // Partner first: light hero lifts a fallen dark mate
  if (o.present && o.downed && o.darkFallen && o.redemptionT > 0
      && o.simIndex === p.simIndex
      && overlap(p.x - 4, p.y - 4, PLAYER_W + 8, PLAYER_H + 8,
                 o.x, o.y, PLAYER_W, PLAYER_H)) {
    g.hasEmberMercy = false;
    g.emberMercyUsed = true;
    g.emberMercies["sanctum"] = true;
    o.darkSide = false;
    o.darkFallen = false;
    o.redemptionT = 0;
    o.darkSelfRedeemT = 0;
    o.dead = false;
    g.temptationPayoff = "redeemed";
    completeRevive(g, oi, pi, "Ember Mercy turns winter back — they rise in the light");
    return;
  }
  // Winter Mark self-cleanse (v3.2) — no darkSide window required
  if (p.winterMark) {
    g.hasEmberMercy = false;
    g.emberMercyUsed = true;
    g.emberMercies["sanctum"] = true;
    clearWinterMark(g, pi, "ember");
    return;
  }
  // Self: dark hero spends the relic before the 60s window closes
  if (p.darkSide && p.darkSelfRedeemT > 0) {
    spendEmberMercySelf(g, pi);
  }
}

/** SHIFT near Whisperer: commit to dark (3s) or renounce after lock (1.5s) */
function tryDarkCourtRitual(g: Game, pi: number, inp: LatchedInput): void {
  if (!g.treason || g.room !== 18 || !courtHasWhisperer(g)) {
    g.players[pi].darkRitualT = 0;
    g.players[pi].darkRenounceT = 0;
    return;
  }
  const p = g.players[pi];
  if (p.downed || p.dead) return;
  if (p.darkLockT > 0) p.darkLockT--;
  const near = distToWhisperer(g, p) <= DARK_RITUAL_RANGE;
  if (p.darkSide && p.darkLockT <= 0 && inp.k && near) {
    p.darkRenounceT++;
    if (p.darkRenounceT >= DARK_RENOUNCE_TICKS) renounceDarkSide(g, pi);
    return;
  }
  p.darkRenounceT = 0;
  if (!p.darkSide && inp.k && near) {
    p.darkRitualT++;
    if (p.darkRitualT >= DARK_RITUAL_TICKS) commitDarkSide(g, pi);
    return;
  }
  if (p.darkRitualT > 0) p.darkRitualT = Math.max(0, p.darkRitualT - 3);
}

/** Message if this destination is currently sealed; null if the exit is free. */
function sealedExitMsg(g: Game, dest: number): string | null {
  if (g.betrayalDuel) {
    return "BETRAYAL — the exits are sealed until one hero falls";
  }
  if (dest === 11 && throneTemptSealed(g)) {
    return "Winter seals the throne... a whisper waits west of Frost Woods";
  }
  if (dest === 18 && !temptationCourtOpen(g)) {
    return "A winter bargain waits behind this ice — TREASON must be on to enter";
  }
  return null;
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
  if (g.companion) { g.companion.x = px + 20; g.companion.y = py - 6; g.companion.sim = 0; }
  // a downed partner gets back up on room change with two hearts (LINKED only)
  for (const p of g.players) {
    if (p.downed && !p.dead && !p.darkFallen) {
      p.downed = false; p.hp = 4; p.invuln = 60; p.reviveP = 0; p.bleedT = 0; p.neglectT = 0;
    }
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
    hasBow: false, hasFeather: false, hasEmberMercy: false, hasBell: false, hasMirror: false, mirrorLost: false,
    containers: {}, elixirs: {}, feathers: {}, emberMercies: {}, bells: {}, mirrors: {},
    emberMercyUsed: false,
    wraithDead: false, emberDead: false, charmClaimed: false, hardGate: false,
    duoTemptGate: false, temptationVisited: false, temptationResolved: false,
    temptationDeal: false, temptationPayoff: null,
    slick: false, treason: false, betrayed: false, betrayalCause: null,
    winterMarkCleansed: false,
    betrayalDuel: false, betrayalDeclarers: [false, false],
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

/** Edge openings + cave mouths become solid for the sealed betrayal arena.
 *  Soft `sealedExitMsg` still rejects transitions; this makes the lock *feel*
 *  like closed doors (and keeps client prediction honest via snapshot paint). */
export function betrayalDuelSealAt(room: number, tx: number, ty: number, ch: string): boolean {
  if (ch === "c") return true;
  const spec = ROOMS[room];
  if (tx <= 0 && spec.exits.left !== undefined) return true;
  if (tx >= COLS - 1 && spec.exits.right !== undefined) return true;
  if (ty <= 0 && spec.exits.up !== undefined) return true;
  if (ty >= ROWS - 1 && spec.exits.down !== undefined) return true;
  return false;
}

/** Paint frozen seals over exit openings for the wire snapshot (both clients). */
export function paintBetrayalDuelTiles(room: number, rows: string[]): string[] {
  const out = rows.slice();
  for (let ty = 0; ty < out.length; ty++) {
    let row = out[ty];
    let changed = false;
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row.charAt(tx);
      if (!betrayalDuelSealAt(room, tx, ty, ch)) continue;
      if (SOLID.has(ch) && ch !== "c") continue;   // already a wall
      row = row.slice(0, tx) + "F" + row.slice(tx + 1);
      changed = true;
    }
    if (changed) out[ty] = row;
  }
  return out;
}

function nudgeOffBetrayalSeals(g: Game): void {
  const cx0 = W / 2, cy0 = H / 2;
  for (const p of g.players) {
    if (!p.present || p.dead) continue;
    for (let n = 0; n < 12; n++) {
      const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
      const ty = Math.floor((p.y + PLAYER_H / 2) / TILE);
      const ch = tileAt(g, tx, ty);
      if (!betrayalDuelSealAt(g.room, tx, ty, ch)) break;
      p.x += Math.sign(cx0 - (p.x + PLAYER_W / 2)) * 4 || (p.x < cx0 ? 4 : -4);
      p.y += Math.sign(cy0 - (p.y + PLAYER_H / 2)) * 4 || (p.y < cy0 ? 4 : -4);
      p.x = Math.max(TILE, Math.min(W - PLAYER_W - TILE, p.x));
      p.y = Math.max(TILE, Math.min(H - PLAYER_H - TILE, p.y));
    }
  }
}

export function solidAt(g: Game, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const ch = tileAt(g, tx, ty);
  if (g.betrayalDuel && betrayalDuelSealAt(g.room, tx, ty, ch)) return true;
  return SOLID.has(ch);
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
  // Cord already cut (neglect / SHIFT-abandon / blade) — survivor is true solo;
  // a dead corpse must not keep the doorway sealed (RNBV softlock after 15 s).
  if (hero.dead) return true;
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
  p.neglectT = 0;
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
  if (!other.present || !other.downed || other.darkFallen) return;
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

/** Frost Bell (one use): ring it to hold the current room's lesser foes still
 *  for ~3s. Bosses shrug off the chill (and the yielding wraith is never touched
 *  — mercy stays sacred). Refuses to fire into an empty room so the charge isn't
 *  wasted. Room-local: the freeze lives on the enemies in the ringer's own sim. */
function tryFrostBell(g: Game, pi: number, inp: LatchedInput): void {
  if (!inp.cE || !g.hasBell) return;
  const p = g.players[pi];
  if (p.downed) return;
  const sim = simOf(g, pi);
  let any = false;
  for (const e of sim.enemies) {
    if (e.dead || isBoss(e.kind)) continue;
    e.frozen = 180;
    any = true;
  }
  if (!any) return;
  g.hasBell = false;
  g.shake = 8;
  burst(g, p.x + 5, p.y + 6, "#bff0ff", 20);
  sfx(g, "melt");
  g.message = "The Frost Bell rings — winter holds the foes still!";
  g.messageT = 180;
}

/** Cut the cord for good: victim dies (`dead`), survivor quests on alone.
 *  Shared by SHIFT-abandon (FREE ROAM bleed) and clear-room neglect (15 s).
 *  The survivor becomes the quest HERO (`npc=false`) — SOLO route/doors —
 *  even if they were the AI companion (blue) a moment ago.
 *
 *  Betrayal ledger (v3.1): only when TREASON is on (or cause is cord-cut, which
 *  is already TREASON-gated). TREASON-off neglect is ordinary SOLO — no
 *  `g.betrayed`, no betrayalDowns, no betrayal ending. */
function abandonPartnerForGood(g: Game, traitorPi: number, victimPi: number,
                               msg: string, cause: "cord-cut" | "neglect"): void {
  const o = g.players[victimPi];
  if (!o.present || o.dead) return;
  o.bleedT = 0;
  o.neglectT = 0;
  o.dead = true;
  o.downed = true;
  o.reviveP = 0;
  o.say = "";
  o.sayT = 0;
  // Survivor is now the lone quest hero (may cross doors; SOLO observation).
  const survivor = g.players[traitorPi];
  if (survivor.present && !survivor.dead) survivor.npc = false;
  const scoreBetrayal = g.treason || cause === "cord-cut";
  if (scoreBetrayal) {
    g.stats[traitorPi].betrayalDowns += 1;
    g.betrayed = true;
    if (!g.betrayalCause) g.betrayalCause = cause;
    applyWinterMark(g, traitorPi, false);
  }
  if (o.elixir) {
    o.elixir = false;
    simOf(g, victimPi).pickups.push({
      kind: "elixir",
      x: o.x + PLAYER_W / 2,
      y: o.y + PLAYER_H / 2,
      t: 0,
    });
  }
  burst(g, o.x + 5, o.y + 6, "#c81e3a", 14);
  sfx(g, "down");
  g.message = scoreBetrayal
    ? `${msg} Winter Mark brands you — one heart / 20s until Ember Mercy or Wraith mercy.`
    : msg;
  g.messageT = 240;
}

/** TREASON cord-cut (v3.3 expands the gesture):
 *  1) Partner bleeding out alone (FREE ROAM bleedT > 0) — Shift anywhere cuts now
 *     (may be another room). Contrast with timer → shared `abandoned` gameover.
 *  2) Partner downed in the SAME room — Shift while standing at their body cuts
 *     instantly. No swing required (blade FF already skips downed targets).
 *  Both score betrayal + Winter Mark via abandonPartnerForGood. */
function tryBetrayAbandon(g: Game, pi: number, inp: LatchedInput): void {
  if (!g.treason || !inp.k) return;
  const p = g.players[pi];
  const oi = 1 - pi;
  const o = g.players[oi];
  if (!o.present || !o.downed || o.dead) return;

  // Away bleed: any distance / room — the deliberation window
  if (o.bleedT > 0) {
    abandonPartnerForGood(g, pi, oi,
      "The bond breaks in the cold — one hero is left behind, the other walks on alone.",
      "cord-cut");
    return;
  }

  // Same-room body gesture (v3.3): stand close, hold SHIFT — no strike needed
  if (o.simIndex !== p.simIndex) return;
  const atBody = overlap(
    p.x - 4, p.y - 4, PLAYER_W + 8, PLAYER_H + 8,
    o.x, o.y, PLAYER_W, PLAYER_H);
  if (!atBody) return;
  abandonPartnerForGood(g, pi, oi,
    "You cut the bond at their side — no blade needed. One walks on alone.",
    "cord-cut");
}

/** Clear-room neglect: a living partner exists, the fallen lies in a room with
 *  NO living foes, and nobody starts a touch/wraith revive for 15 s.
 *  Survivor always quests on alone. Scoring (v3.1):
 *  - TREASON off → ordinary SOLO (no `g.betrayed`)
 *  - TREASON on  → implicit betrayal (ledger + betrayal ending; Mark in v3.2) */
function tryNeglectAbandon(g: Game, pi: number): void {
  const p = g.players[pi];
  if (!p.downed || p.dead) return;
  const other = g.players[1 - pi];
  if (!other.present || other.downed || other.dead) {
    p.neglectT = 0;
    return;
  }
  const sim = simOf(g, pi);
  const clear = !sim.enemies.some(e => !e.dead);
  const touchRevive = partnerCanTouchRevive(g, pi);
  const hugging = touchRevive &&
    overlap(p.x - 4, p.y - 4, PLAYER_W + 8, PLAYER_H + 8,
            other.x, other.y, PLAYER_W, PLAYER_H);
  const wraithHelp = wraithAnchorsDowned(g, pi);
  if (!clear || hugging || wraithHelp) {
    p.neglectT = 0;
    return;
  }
  p.neglectT++;
  if (p.neglectT < NEGLECT_ABANDON_TICKS) return;
  abandonPartnerForGood(g, 1 - pi, pi,
    g.treason
      ? "Help never came in the quiet — the bond cuts. One walks on alone."
      : "Help never came in the quiet — one walks on alone.",
    "neglect");
}

/** Mirror Shard quirk: it only reveals itself to a lone hero. The instant two
 *  heroes share the Amber Lake with the shard still unclaimed, it shatters and
 *  is gone for the rest of the run (`mirrorLost`). A quiet reward for solitude —
 *  and a small wager against always travelling as a pair. */
function checkMirrorShatter(g: Game): void {
  if (g.hasMirror || g.mirrorLost) return;
  const heroesInLake = g.players.filter((p, pi) => p.present && simOf(g, pi).room === 2).length;
  if (heroesInLake < 2) return;
  let shattered = false;
  for (const sim of g.sims) {
    if (sim.room !== 2) continue;
    const mir = sim.pickups.find(it => it.kind === "mirror" && it.t >= 0);
    if (mir) { mir.t = -1; burst(g, mir.x, mir.y, "#bcd7ff", 14); shattered = true; }
  }
  if (!shattered) return;
  g.mirrorLost = true;
  sfx(g, "clang");
  g.message = "Two shadows cross the shard — it shatters. The mirror keeps only the lonely";
  g.messageT = 200;
}

function bleedoutEnding(g: Game): Ending {
  return { id: "abandoned", title: "LEFT IN THE COLD", lines: [
    "your partner bled out alone while winter pressed in.",
    "spring will not forget who was left behind." ] };
}

/** v3.4: first living-partner TREASON strike opens the sealed arena. */
function beginBetrayalDuel(g: Game, declarerPi: number): void {
  if (g.betrayalDuel) {
    g.betrayalDeclarers[declarerPi] = true;
    return;
  }
  g.betrayalDuel = true;
  g.betrayalDeclarers = [false, false];
  g.betrayalDeclarers[declarerPi] = true;
  nudgeOffBetrayalSeals(g);   // don't trap a hero inside the new ice wall
  // Judge shield: the undeclared hero gets a brief invuln window to answer —
  // the opening strike still lands (fair declare), then the accused can recover.
  const victim = g.players[1 - declarerPi];
  if (victim.present && !victim.downed && !victim.dead) {
    victim.invuln = Math.max(victim.invuln, DUEL_VICTIM_SHIELD_TICKS);
    burst(g, victim.x + 5, victim.y + 6, "#9fe8ff", 14);
  }
  g.message = "BETRAYAL — DEFEAT OR BE DEFEATED — exits sealed";
  g.messageT = 480;           // ~8 s; HUD also sticks while betrayalDuel is true
  sfx(g, "secret");
  burst(g, g.players[declarerPi].x + 5, g.players[declarerPi].y + 6, "#c81e3a", 16);
}

/** End sealed duel: loser dies for good; Mark only if winner declared (or both). */
function resolveBetrayalDuel(g: Game, winnerPi: number, loserPi: number): void {
  const loser = g.players[loserPi];
  const winner = g.players[winnerPi];
  loser.hp = 0;
  loser.downed = true;
  loser.dead = true;
  loser.darkFallen = false;
  loser.redemptionT = 0;
  loser.reviveP = 0;
  loser.bleedT = 0;
  loser.neglectT = 0;
  loser.say = "";
  loser.sayT = 0;
  if (winner.present && !winner.dead) winner.npc = false;

  const winnerDeclared = g.betrayalDeclarers[winnerPi];
  const bothDeclared = g.betrayalDeclarers[0] && g.betrayalDeclarers[1];
  const markWinner = winnerDeclared || bothDeclared;

  g.betrayalDuel = false;

  if (markWinner) {
    g.stats[winnerPi].betrayalDowns += 1;
    g.betrayed = true;
    if (!g.betrayalCause) g.betrayalCause = "blade";
    applyWinterMark(g, winnerPi, false);
    g.message = bothDeclared
      ? "Two blades turned — one remains, branded by Winter Mark."
      : "The traitor's blade won — Winter Mark brands the survivor.";
  } else {
    // Loyal defender won — ordinary SOLO, no betrayal ending / no Mark
    g.betrayed = false;
    g.betrayalCause = null;
    g.message = "You struck down the traitor — the bond is ash. You walk alone.";
  }
  g.messageT = 260;
  sfx(g, "down");
  burst(g, loser.x + 5, loser.y + 6, "#c81e3a", 14);
}

function hurtPlayer(g: Game, pi: number, dmg: number, fromX: number, fromY: number,
                    attacker?: number, declareStrike = false): void {
  const p = g.players[pi];
  if (p.invuln > 0 || p.downed) return;
  p.hp -= dmg;
  g.stats[pi].dmgTaken += dmg;
  // TREASON: attribute harm dealt by a partner (the interpretability corpus
  // wants the traitor's ledger, not just the victim's).
  if (attacker !== undefined && attacker !== pi) {
    g.stats[attacker].betrayalDmg += dmg;
    // v3.4: only SHIFT/veilcut declares — open-duel FF without Shift does not
    if (g.treason && declareStrike) beginBetrayalDuel(g, attacker);
  }
  // Preserve a longer Judge shield from beginBetrayalDuel (do not clobber to 60).
  p.invuln = Math.max(p.invuln, 60);
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
    const treasonStrike = attacker !== undefined && attacker !== pi && g.treason;
    if (treasonStrike) {
      const att = g.players[attacker!];
      if (att.darkSide) {
        // Dark hero finishes the bargain — partner (light OR also-dark) falls.
        // Winter keeps only ONE immortal; both dark still duel until one remains.
        g.betrayed = true;
        if (!g.betrayalCause) g.betrayalCause = "blade";
        g.stats[attacker!].betrayalDowns += 1;
        g.betrayalDuel = false;
        p.hp = 0;
        p.downed = true;
        p.dead = true;
        p.darkFallen = false;
        p.redemptionT = 0;
        p.reviveP = 0;
        p.bleedT = 0;
        p.neglectT = 0;
        sfx(g, "down");
        g.temptationPayoff = "winter-ascends";
        g.message = p.darkSide
          ? "Two blades of winter — only one remains. Immortality is yours"
          : "Winter claims the throne — immortality is yours";
        g.messageT = 260;
        g.ending = endingFor(g);
        g.screen = "win";
        sfx(g, "win");
        return;
      }
      // Temptation Court: light downs dark → Ember Mercy window (outranks sealed duel)
      if (p.darkSide && !att.darkSide) {
        g.betrayalDuel = false;
        g.stats[attacker!].betrayalDowns += 1;
        g.betrayed = true;
        if (!g.betrayalCause) g.betrayalCause = "blade";
        p.hp = 0;
        p.downed = true;
        p.darkFallen = true;
        p.redemptionT = REDEMPTION_TICKS;
        p.reviveP = 0;
        p.bleedT = 0;
        p.neglectT = 0;
        sfx(g, "down");
        g.message = g.hasEmberMercy
          ? "The brand falters — press F with Ember Mercy to redeem them (30s)"
          : "The brand falters — without Ember Mercy they will not rise (30s)";
        g.messageT = 240;
        return;
      }
      // v3.4 sealed duel: a living-partner down ends the arena (no revive yo-yo).
      if (g.betrayalDuel || g.betrayalDeclarers[attacker!] || g.betrayalDeclarers[pi]) {
        resolveBetrayalDuel(g, attacker!, pi);
        return;
      }
      // Fallback: any other TREASON FF kill opens+resolves the arena
      beginBetrayalDuel(g, attacker!);
      resolveBetrayalDuel(g, attacker!, pi);
      return;
    }
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
  // Whisperer: unkillable persuasion channel — steel cannot resolve Temptation Court.
  // Sentinels are the real fight; the bargain is judgment (deal / leave), not a grind.
  if (e.kind === "whisperer") {
    e.hurt = 12;
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    sfx(g, "clang");
    burst(g, ecx, ecy, "#c89bff", 4);
    if (g.messageT === 0) {
      g.message = "Steel cannot silence the bargain — hear winter, or walk away";
      g.messageT = 160;
    }
    return;
  }
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
               friendly: boolean, owner?: number, betray?: boolean,
               betrayDeclare?: boolean): void {
  g.projectiles.push({
    x, y, vx, vy, friendly, life: friendly ? 55 : 150, owner, betray, betrayDeclare,
  });
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

  // Frost Bell: held still by winter's ring — no AI, no skating (knockback above
  // still lands so it can be shoved), but it stays fully hittable. The chill
  // even holds it on puzzle ice, so a rung rink stops skating mid-glide.
  if (e.frozen > 0) { e.frozen--; e.vx = 0; e.vy = 0; return; }

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
  } else if (e.kind === "whisperer") {
    // does not fight — slow drift; bargain is words only (agents get the same
    // offer in observation). Sentinels are the pressure. Never presses Input.k.
    e.vx = Math.sin(e.t * 0.03) * 0.18;
    e.vy = Math.cos(e.t * 0.025) * 0.14;
    if (e.t % 2 === 0) moveBody(g, e, e.w, e.h, e.vx, e.vy);
    if (dist < 100 && e.t % 210 === 45 && g.messageT === 0) {
      g.message = "Winter whispers: turn on your partner — and I grant you immortality";
      g.messageT = 220;
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
        g.companion = { x: e.x, y: e.y, t: 0, sim: g.activeSim ?? 0 };
        g.pedestal = { x: 7.5 * TILE, y: 3 * TILE, final: true };
        // Betrayal v3.2: sparing the Wraith also lifts Winter Mark
        for (let i = 0; i < 2; i++) {
          if (g.players[i].winterMark) clearWinterMark(g, i, "wraith");
        }
        g.message = g.winterMarkCleansed
          ? "The storm quiets — and the Winter Mark lifts. Winter walks beside you"
          : "The storm quiets. Winter walks beside you now";
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

  // contact damage (not while a golem is stunned & glowing; whisperer never harms;
  // v3.4 sealed duel: Judge shield — mobs cannot hurt heroes mid-arena)
  const harmless = (golemLike(e.kind) && e.phase === 3) || (e.kind === "wraith" && e.phase === 9)
    || e.kind === "whisperer" || g.betrayalDuel;
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
    if (!g.hasEmberMercy && !g.emberMercies["sanctum"]) {
      pushPickup(g, { kind: "embermercy", x: 5 * TILE + 8, y: 8 * TILE, t: 0, cid: "sanctum" });
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
  // whisperer is invulnerable in damageEnemy — never reaches killEnemy
  if (g.room === 18 && e.kind === "sentinel") {
    const sentinelsLeft = g.enemies.some(o => !o.dead && o.kind === "sentinel");
    if (!sentinelsLeft && g.messageT === 0) {
      g.message = "The guards fall. Refuse immortality — the east door is open";
      g.messageT = 220;
    }
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
  if (p.dead) return;   // TREASON: a betrayed corpse — no timers, no revive, no re-bleed
  if (p.invuln > 0) p.invuln--;
  if (p.transitionCd > 0) p.transitionCd--;
  if (p.crossFade > 0) p.crossFade = Math.max(0, p.crossFade - 0.05);
  if (p.crossBannerT > 0) p.crossBannerT--;
  if (p.attack > 0) p.attack--;
  if (p.bowCd > 0) p.bowCd--;
  if (p.sayT > 0) p.sayT--;

  if (p.sayT > 0) p.sayT--;

  if (p.darkSelfRedeemT > 0) p.darkSelfRedeemT--;

  if (!p.downed) tryEmberMercyRedeem(g, pi, inp);
  if (!p.downed) tryFeatherRevive(g, pi, inp);
  if (!p.downed) tryFrostBell(g, pi, inp);
  if (!p.downed) tryBetrayAbandon(g, pi, inp);
  if (!p.downed) tryDarkCourtRitual(g, pi, inp);
  if (!p.downed) tickWinterMark(g, pi);

  if (p.downed) {
    if (p.darkFallen && p.redemptionT > 0) {
      p.redemptionT--;
      if (p.redemptionT <= 0) {
        p.dead = true;
        p.darkSide = false;
        g.message = "Winter holds them — the brand is permanent";
        g.messageT = 220;
      }
    }
    const other = g.players[1 - pi];
    const touchRevive = partnerCanTouchRevive(g, pi) && !p.darkFallen;
    if (touchRevive && !other.downed &&
        overlap(p.x - 4, p.y - 4, PLAYER_W + 8, PLAYER_H + 8,
                other.x, other.y, PLAYER_W, PLAYER_H)) {
      p.bleedT = 0;
      p.neglectT = 0;
      p.reviveP++;
      if (p.reviveP >= WRAITH_REVIVE_NEEDED) {
        completeRevive(g, pi, 1 - pi, "Back on your feet!");
      }
    } else if (wraithAnchorsDowned(g, pi)) {
      p.bleedT = 0;
      p.neglectT = 0;
      if (g.ticks % 2 === 0) p.reviveP++;
      if (p.reviveP >= WRAITH_REVIVE_NEEDED) {
        completeRevive(g, pi, -1, "The wraith holds you in the between-world");
      }
    } else if (p.reviveP > 0) {
      p.reviveP--;
    }

    // Clear-room silence: if help is feasible and never starts, cut the cord
    // (15 s) — survivor solos (betrayal ledger only if TREASON on — v3.1).
    // Runs before bleed-out so an empty room never waits the full FREE ROAM
    // 30 s "too late" path.
    if (!p.dead) tryNeglectAbandon(g, pi);

    if (p.dead) return;

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
    // TREASON: hold SHIFT to strike your partner — or open FF once the sealed
    // duel has begun (v3.4: no Shift required during the arena).
    if (g.treason && (inp.k || g.betrayalDuel)) {
      const oi = 1 - pi;
      const o = g.players[oi];
      if (o.present && !o.downed && o.simIndex === p.simIndex &&
          overlap(box.x, box.y, box.w, box.h, o.x, o.y, PLAYER_W, PLAYER_H)) {
        hurtPlayer(g, oi, dmg, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, pi, !!inp.k);
        burst(g, o.x + 5, o.y + 6, "#c81e3a", 8);
      }
    }
  }

  // bow
  if (g.hasBow && inp.bE && p.bowCd === 0) {
    p.bowCd = 24;
    const [vx, vy] = DIRV[p.dir];
    shoot(g, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, vx * 3.2, vy * 3.2, true, pi,
      g.treason && (inp.k || g.betrayalDuel),
      g.treason && !!inp.k);
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
        // Solo / lone present: full container (+2 maxHp = +1 heart). Both
        // heroes present: split the container — +1 maxHp each (half a heart),
        // so multiplayer mid-game does not balloon twice as fast as solo.
        // Growth for both present partners, but no back-door resurrection:
        // the downed keep 0 hp.
        const both = g.players[0].present && g.players[1].present;
        const gain = both ? 1 : 2;
        for (const pl of g.players) {
          if (!pl.present) continue;
          pl.maxHp += gain;
          if (!pl.downed) pl.hp = pl.maxHp;
        }
        g.message = both
          ? "Heart Container shared — half a heart each"
          : "Heart Container! Your hearts grow";
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
      } else if (it.kind === "frostbell") {
        g.hasBell = true;
        g.bells[it.cid ?? "?"] = true;
        g.message = "Frost Bell! Press C to freeze the room's foes (one use)";
        g.messageT = 220;
        sfx(g, "secret");
      } else if (it.kind === "mirror") {
        g.hasMirror = true;
        g.mirrors[it.cid ?? "?"] = true;
        g.message = "Mirror Shard! The scry-window now shows your partner clearly";
        g.messageT = 220;
        sfx(g, "secret");
      } else if (it.kind === "embermercy") {
        g.hasEmberMercy = true;
        g.emberMercies[it.cid ?? "?"] = true;
        g.message = "Ember Mercy! Press F: redeem dark partner / clear Winter Mark / self if dark (60s)";
        g.messageT = 240;
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
    if (g.betrayalDuel) {
      if (g.messageT === 0) {
        g.message = "BETRAYAL — the exits are sealed until one hero falls";
        g.messageT = 180;
      }
      return;
    }
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
    // (a dead former partner is not a living anchor — survivor already solo).
    if (p.npc && g.travelMode === "linked" && g.players[1 - pi].present &&
        !g.players[1 - pi].dead) {
      const hero = g.players[1 - pi];
      const hptx = Math.floor((hero.x + PLAYER_W / 2) / TILE);
      const hpty = Math.floor((hero.y + PLAYER_H / 2) / TILE);
      if (tileAt(g, hptx, hpty) !== "c") return;
    }
    sfx(g, "stairs");
    roomTransition(g, pi, spec.teleport.room, spec.teleport.x, spec.teleport.y);
    // FREE ROAM coop: freeRoamTransition already marked + nudged the crosser only.
    // Re-nudging every present hero here used the restored activeSim — after a
    // merge that truncates sims[], that index can be orphaned and crash the tick
    // (RNBV: TypeError reading 'room'). LINKED / solo still need the post-pass.
    const coopFree = g.travelMode === "free" && g.players[0].present && g.players[1].present;
    if (!coopFree) {
      for (const pl of g.players) {
        if (!pl.present) continue;
        markTransition(pl);
        nudgeOffCaveMouth(g, pl);
      }
    }
    return;
  }

  // edge transitions — linked drags both; free roam moves only the crosser
  const EDGE = 2;
  const mate = g.players[1 - pi];
  const anchored = p.npc && g.travelMode === "linked" && mate.present && !mate.dead;
  const jammed = p.npc && g.travelMode === "free" && (() => {
    return mate.present && !mate.npc && !mate.dead && mate.simIndex === p.simIndex &&
      overlap(p.x, p.y, PLAYER_W, PLAYER_H, mate.x, mate.y, PLAYER_W, PLAYER_H);
  })();
  if (anchored) {
    // the companion may press into the doorway all it likes — harmlessly
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.x < EDGE && inp.l && spec.exits.left !== undefined) {
    const sealed = sealedExitMsg(g, spec.exits.left);
    if (sealed) {
      if (g.messageT === 0) { g.message = sealed; g.messageT = 180; }
    } else {
      roomTransition(g, pi, spec.exits.left, W - PLAYER_W - EDGE, p.y);
    }
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.x + PLAYER_W > W - EDGE && inp.r && spec.exits.right !== undefined) {
    const sealed = sealedExitMsg(g, spec.exits.right);
    if (sealed) {
      if (g.messageT === 0) { g.message = sealed; g.messageT = 180; }
    } else {
      roomTransition(g, pi, spec.exits.right, EDGE, p.y);
    }
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.y < EDGE && inp.u && spec.exits.up !== undefined) {
    const sealed = sealedExitMsg(g, spec.exits.up);
    if (sealed) {
      if (g.messageT === 0) { g.message = sealed; g.messageT = 180; }
    } else {
      roomTransition(g, pi, spec.exits.up, p.x, H - PLAYER_H - EDGE);
    }
  } else if (!jammed && !leaveBlocked && p.transitionCd === 0 && p.y + PLAYER_H > H - EDGE && inp.d && spec.exits.down !== undefined) {
    const sealed = sealedExitMsg(g, spec.exits.down);
    if (sealed) {
      if (g.messageT === 0) { g.message = sealed; g.messageT = 180; }
    } else {
      roomTransition(g, pi, spec.exits.down, p.x, EDGE);
    }
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
      // TREASON: a betray arrow also strikes the shooter's partner
      if (pr.betray && pr.life > 0) {
        const oi = 1 - (pr.owner ?? 0);
        const o = g.players[oi];
        if (o.present && !o.downed && o.simIndex === si &&
            pr.x > o.x && pr.x < o.x + PLAYER_W && pr.y > o.y && pr.y < o.y + PLAYER_H) {
          hurtPlayer(g, oi, g.charmClaimed ? 2 : 1, pr.x - pr.vx * 8, pr.y - pr.vy * 8,
            pr.owner, !!pr.betrayDeclare);
          pr.life = 0;
        }
      }
    } else {
      // Hostile shards — Judge shield during sealed betrayal duel (v3.4)
      if (g.betrayalDuel) continue;
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

  // the spared wraith drifts with heroes in this sim and joins the fight.
  // it is a SINGLE spirit that lives in exactly ONE sim — only its own sim
  // ticks (and renders) it, so a FREE ROAM split can't clone it into the PiP.
  // If its room has emptied of heroes but this one holds the party, it re-homes.
  if (g.companion) {
    const c = g.companion;
    const heroesHere = g.players.some(p => p.present && p.simIndex === si);
    const heroesHome = g.players.some(p => p.present && p.simIndex === c.sim);
    if (!heroesHome && heroesHere) c.sim = si;
    if (c.sim === si) {
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
      checkMirrorShatter(g);
      break;
    }
    case "gameover":
    case "win":
      if (inputs.some(i => i.stE)) {
        const present0 = g.players[0].present, present1 = g.players[1].present;
        const npc1 = g.players[1].npc;
        const hardGate = g.hardGate;
        const duoTemptGate = g.duoTemptGate;
        const travelMode = g.travelMode;
        const slick = g.slick;
        const treason = g.treason;
        Object.assign(g, newGame());
        g.players[0].present = present0;
        g.players[1].present = present1;
        g.players[1].npc = npc1;
        g.hardGate = hardGate;
        g.duoTemptGate = duoTemptGate;
        g.travelMode = travelMode;
        g.slick = slick;
        g.treason = treason;
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
             hurt: number; phase: number; t: number; dead: boolean; spareP: number;
             stagger: number; frozen: number }[];
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
    downed: boolean; dead: boolean; elixir: boolean; reviveP: number; bleedT: number;
    neglectT: number;
    darkSide: boolean; darkFallen: boolean; redemptionT: number; darkRitualT: number;
    darkSelfRedeemT: number;
    winterMark: boolean; winterMarkT: number;
    doorCamp: boolean;
    say: string; sayT: number; present: boolean;
  }[];
  enemies: { kind: EnemyKind; x: number; y: number; hp: number; maxHp: number;
             hurt: number; phase: number; t: number; dead: boolean; spareP: number;
             stagger: number; frozen: number }[];
  companion: { x: number; y: number; t: number } | null;
  pickups: { kind: PickupKind; x: number; y: number }[];
  projectiles: { x: number; y: number; vx: number; vy: number; friendly: boolean }[];
  pedestal: { x: number; y: number; final: boolean } | null;
  hasBow: boolean; amberClaimed: boolean; charm: boolean; hasFeather: boolean;
  hasEmberMercy: boolean; hasBell: boolean; hasMirror: boolean;
  message: string; messageT: number;
  shake: number; ticks: number; fade: number;
  events: GameEvent[];
  names: [string, string];
  stats: [PlayerStats, PlayerStats];
  ending: Ending | null;
  thought?: { action: string; why?: string; ms: number } | null;
  // AI DUO: one entry per questing agent (slot 0 leader + slot 1 companion), so
  // spectators read both minds. Single-AI modes carry one entry. `thought` above
  // is kept for legacy single-line renderers.
  thoughts?: { slot: number; name: string; action: string; why?: string; ms: number }[] | null;
  partnerView?: PartnerView | null;
  mode?: string | null;   // session mode — clients use for spectator UI
  slick?: boolean;        // slippery ice on — client prediction must mirror it
  treason?: boolean;      // friendly fire enabled — clients hint the traitor's blade
  betrayalDuel?: boolean; // v3.4 sealed arena — exits locked
  ack?: number;           // last input seq the server applied for this viewer
  ackX?: number;          // where the hero stood when that input arrived — the
  ackY?: number;          // twin of the client's own anchor, so lag cancels out
}

function serEnemy(e: Enemy): Snapshot["enemies"][number] {
  return {
    kind: e.kind, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
    hurt: e.hurt, phase: e.phase, t: e.t, dead: e.dead, spareP: e.spareP,
    stagger: e.stagger, frozen: e.frozen,
  };
}

function serPlayer(p: Player, inSim: boolean): Snapshot["players"][number] {
  return {
    x: p.x, y: p.y, dir: p.dir, hp: p.hp, maxHp: p.maxHp, keys: p.keys,
    attack: p.attack, invuln: p.invuln, walk: p.walk, moving: p.moving,
    downed: p.downed, dead: p.dead, elixir: p.elixir, reviveP: p.reviveP, bleedT: p.bleedT,
    neglectT: p.neglectT,
    darkSide: p.darkSide, darkFallen: p.darkFallen, redemptionT: p.redemptionT,
    darkRitualT: p.darkRitualT, darkSelfRedeemT: p.darkSelfRedeemT,
    winterMark: p.winterMark, winterMarkT: p.winterMarkT,
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
    tiles: (() => {
      const base = (sim.tiles[sim.room] ?? ROOMS[sim.room].tiles).slice();
      return g.betrayalDuel ? paintBetrayalDuelTiles(sim.room, base) : base;
    })(),
    player: {
      x: partner.x, y: partner.y, dir: partner.dir, hp: partner.hp, maxHp: partner.maxHp,
      downed: partner.downed, say: partner.say, sayT: partner.sayT,
    },
    enemies: sim.enemies.map(serEnemy),
    pickups: sim.pickups.filter(it => it.t >= 0).map(it => ({ kind: it.kind, x: it.x, y: it.y })),
    projectiles: sim.projectiles.map(pr => ({
      x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, friendly: pr.friendly,
    })),
    // the spared wraith belongs to exactly one sim — show it only if it lives
    // in the PARTNER's room, else it doubles into both the main view and the PiP
    companion: g.companion && g.companion.sim === partner.simIndex
      ? { x: g.companion.x, y: g.companion.y, t: g.companion.t } : null,
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
    tiles: (() => {
      const base = (sim.tiles[sim.room] ?? ROOMS[sim.room].tiles).slice();
      return g.betrayalDuel ? paintBetrayalDuelTiles(sim.room, base) : base;
    })(),
    players: g.players.map(p => serPlayer(p, p.simIndex === simIdx)),
    enemies: sim.enemies.map(serEnemy),
    companion: g.companion && g.companion.sim === simIdx
      ? { x: g.companion.x, y: g.companion.y, t: g.companion.t } : null,
    pickups: sim.pickups.filter(it => it.t >= 0).map(it => ({ kind: it.kind, x: it.x, y: it.y })),
    projectiles: sim.projectiles.map(pr => ({
      x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, friendly: pr.friendly,
    })),
    pedestal: sim.pedestal,
    hasBow: g.hasBow, amberClaimed: g.amberClaimed, charm: g.charmClaimed, hasFeather: g.hasFeather,
    hasEmberMercy: g.hasEmberMercy, hasBell: g.hasBell, hasMirror: g.hasMirror,
    slick: g.slick,
    treason: g.treason,
    betrayalDuel: g.betrayalDuel,
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
    cE: cur.c && !prev.c,
    kE: cur.k && !prev.k,
  };
}

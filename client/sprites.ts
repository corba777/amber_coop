/* Shared pixel art: palettes, sprite maps, baked canvases, tile canvases.
 * Used by both the 2D canvas client and the HD-2D three.js client. */
import { TILE } from "../shared/core";

// --------------------------------------------------------------- sprites
export const SPRITE_PAL: Record<string, string> = {
  H: "#3a2a1e", S: "#f2c99b", T: "#c8502e", D: "#8a3018",
  B: "#5a3a26", E: "#1b1b1b",
  G: "#57b04b", g: "#2f7a2c",
  V: "#7a5ccc", v: "#4a3585",
  R: "#8d8da0", r: "#5c5c70", A: "#ffb545", a: "#c77f1d",
  Q: "#e8384f", q: "#8f1626",
  K: "#ffd257", k: "#a8842a",
  C: "#9fe8ff", c: "#4fb8d8",
  X: "#2a2438", x: "#3d3654", Y: "#bfe9ff",
  W: "#ffffff",
};
// player 2: blue tunic swap
export const P2_SWAP: Record<string, string> = { T: "#3d6fc2", D: "#274a8a", H: "#20303c" };
// ember golem: scorched basalt body, molten core
export const EMBER_SWAP: Record<string, string> = { R: "#7a4034", r: "#4c241c", A: "#ffd257", a: "#ff7a3d" };

const HERO_DOWN_0 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HSSSSSSH....", "....SSESSESS....", "....SSSSSSSS....", ".....SSSSSS.....", "....TTTTTTTT....", "...TTTTTTTTTT...", "...S.TTTTTT.S...", ".....TTTTTT.....", ".....DT..TD.....", ".....BB..BB.....", "....BBB..BBB....", "................"];
const HERO_DOWN_1 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HSSSSSSH....", "....SSESSESS....", "....SSSSSSSS....", ".....SSSSSS.....", "....TTTTTTTT....", "...TTTTTTTTTT...", "...S.TTTTTT.S...", ".....TTTTTT.....", "....DT....TD....", "....BB....BB....", "....BB....BB....", "................"];
const HERO_UP_0 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHHHHHH....", "....SHHHHHHS....", ".....SHHHHS.....", "....TTTTTTTT....", "...TTTTTTTTTT...", "...S.TTTTTT.S...", ".....TTTTTT.....", ".....DT..TD.....", ".....BB..BB.....", "....BBB..BBB....", "................"];
const HERO_UP_1 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHHHHHH....", "....SHHHHHHS....", ".....SHHHHS.....", "....TTTTTTTT....", "...TTTTTTTTTT...", "...S.TTTTTT.S...", ".....TTTTTT.....", "....DT....TD....", "....BB....BB....", "....BB....BB....", "................"];
const HERO_RIGHT_0 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHSSSSS....", "....HHHSSESS....", "....HHHSSSSS....", ".....SSSSSS.....", ".....TTTTTT.....", "....TTTTTTTT....", "....TTTTTTTS....", ".....TTTTTT.....", ".....DTTTD......", ".....BB.BB......", ".....BB..BB.....", "................"];
const HERO_RIGHT_1 = ["................", ".....HHHHHH.....", "....HHHHHHHH....", "....HHHHHHHH....", "....HHHSSSSS....", "....HHHSSESS....", "....HHHSSSSS....", ".....SSSSSS.....", ".....TTTTTT.....", "....TTTTTTTT....", "....TTTTTTTS....", ".....TTTTTT.....", "......DTTD......", "......BBBB......", ".....BB..BB.....", "................"];
const SLIME_0 = ["................", "................", "................", "................", "................", ".....GGGGGG.....", "....GGGGGGGG....", "...GGGGGGGGGG...", "...GGEGGGGEGG...", "...GGGGGGGGGG...", "..GGGGGGGGGGGG..", "..GGGGGGGGGGGG..", "..gGGGGGGGGGGg..", "...gggggggggg...", "................", "................"];
const SLIME_1 = ["................", "................", "................", "................", "................", "................", "................", "....GGGGGGGG....", "..GGGGGGGGGGGG..", "..GGEGGGGGGEGG..", ".GGGGGGGGGGGGGG.", ".GGGGGGGGGGGGGG.", ".gGGGGGGGGGGGGg.", "..gggggggggggg..", "................", "................"];
const BAT_0 = ["................", "................", "................", "..V..........V..", "..VV........VV..", "..VVV.vvvv.VVV..", "..VVVVvvvvVVVV..", "...VVvvvvvvVV...", "....VvEvvEvV....", ".....vvvvvv.....", "......v..v......", "................", "................", "................", "................", "................"];
const BAT_1 = ["................", "................", "................", "................", "................", "......vvvv......", "..VVVVvvvvVVVV..", ".VVVVvvvvvvVVVV.", "..VVVvEvvEvVVV..", ".....vvvvvv.....", "......v..v......", "................", "................", "................", "................", "................"];
const WISP_0 = ["................", "................", "......CCCC......", ".....CCCCCC.....", "....CCCCCCCC....", "....CCECCECC....", "....CCCCCCCC....", "....cCCCCCCc....", "....CCCCCCCC....", "....CcCCCCcC....", ".....C.CC.C.....", "......C..C......", "................", "................", "................", "................"];
const WISP_1 = ["................", "................", "................", "......CCCC......", ".....CCCCCC.....", "....CCECCECC....", "....CCCCCCCC....", "....cCCCCCCc....", "....CCCCCCCC....", ".....CcCCcC.....", "......C.C.C.....", ".....C..C.......", "................", "................", "................", "................"];
const GOLEM = ["................", "...RRRRRRRRRR...", "..RRRRRRRRRRRR..", "..RrRRRRRRRRrR..", "..RRARRRRRRARR..", "..RRRRRRRRRRRR..", "...RRRRRRRRRR...", "..RRRRRaaRRRRR..", ".RRrRRaAAaRRrRR.", ".RRRRRaAAaRRRRR.", ".RRrRRRaaRRRrRR.", "..RRRRRRRRRRRR..", "..RRrRR..RRrRR..", "..RRRRR..RRRRR..", "...rrr....rrr...", "................"];
const WRAITH = ["................", ".....XXXXXX.....", "....XXXXXXXX....", "....XxXXXXxX....", "....XYXXXXYX....", "....XXXXXXXX....", "...XXXXXXXXXX...", "...XXxXXXXxXX...", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..xXXXXXXXXXXx..", "...XXXXXXXXXX...", "....XxXXXXxX....", ".....X.XX.X.....", "......x..x......", "................"];
const HEART_SPR = ["................", "................", "................", "................", "....QQ....QQ....", "...QQQQ..QQQQ...", "..QQWQQQQQQQQQ..", "..QQQQQQQQQQQQ..", "..QQQQQQQQQQQQ..", "...QQQQQQQQQQ...", "....QQQQQQQQ....", ".....QQQQQQ.....", "......QQQQ......", ".......QQ.......", "................", "................"];
const KEY_SPR = ["................", "................", "................", "....KKKK........", "...KK..KK.......", "...KK..KK.......", "....KKKK........", "......KK........", "......KK........", "......KKKK......", "......KK........", "......KKKK......", "................", "................", "................", "................"];
const SENTINEL_SPR = ["................", ".....RRRRRR.....", "....RRrRRrRR....", "....RRRRRRRR....", "....RRYRRYRR....", ".....RRRRRR.....", "...CCCCCCCCCC...", "..CCcCCCCCCcCC..", "..CCCCCCCCCCCC..", "..CCcCCCCCCcCC..", "..CCCCCCCCCCCC..", "...CCCCCCCCCC...", "....rr....rr....", "....RR....RR....", "................", "................"];
const SPITTER_SPR = ["................", "................", "......gGGg......", ".....GGGGGG.....", "....GGqGGqGG....", "....GGGGGGGG....", ".....GGqqGG.....", "......GGGG......", ".....gGGGGg.....", "....gGgGGgGg....", "...gGg.GG.gGg...", "..gg...gg...gg..", "................", "................", "................", "................"];
const CHARM_SPR = ["................", "................", ".....KKKKKK.....", "....KK....KK....", "....KK....KK....", "................", "....aAAAAAAa....", "...aAAKKKKAAa...", "...AAKAAAAKAA...", "...AAKAWWAKAA...", "...AAKAAAAKAA...", "...aAAKKKKAAa...", "....aAAAAAAa....", "................", "................", "................"];
const ELIXIR_SPR = ["................", "......BBBB......", ".......BB.......", "......CBBC......", "......C..C......", ".....C....C.....", "....C......C....", "....C.KKKK.C....", "...C.KKKKKK.C...", "...C.KKWKKK.C...", "...C.KKKKKK.C...", "...C.KKKKK.C....", "....C.KKK.C.....", ".....CCCCC......", "................", "................"];
const BOW_SPR = ["................", "......BBB.......", ".....B...W......", "....B.....W.....", "....B......W....", "...B.......W....", "...B........W...", "...B.KKK....W...", "...B........W...", "...B.......W....", "....B......W....", "....B.....W.....", ".....B...W......", "......BBB.......", "................", "................"];

export function bake(map: string[], scale = 1, swap?: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = map[0].length * scale;
  c.height = map.length * scale;
  const x = c.getContext("2d")!;
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row.charAt(i);
      const col = (swap && swap[ch]) || SPRITE_PAL[ch];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i * scale, j * scale, scale, scale);
    }
  });
  return c;
}
export function heroSet(swap?: Record<string, string>) {
  return {
    down: [bake(HERO_DOWN_0, 1, swap), bake(HERO_DOWN_1, 1, swap)],
    up: [bake(HERO_UP_0, 1, swap), bake(HERO_UP_1, 1, swap)],
    right: [bake(HERO_RIGHT_0, 1, swap), bake(HERO_RIGHT_1, 1, swap)],
  };
}
export const HEROES = [heroSet(), heroSet(P2_SWAP)];
export const SPR = {
  slime: [bake(SLIME_0), bake(SLIME_1)],
  bat: [bake(BAT_0), bake(BAT_1)],
  wisp: [bake(WISP_0), bake(WISP_1)],
  golem: bake(GOLEM, 2),
  ember: bake(GOLEM, 2, EMBER_SWAP),
  sentinel: [bake(SENTINEL_SPR)],
  spitter: [bake(SPITTER_SPR)],
  charm: bake(CHARM_SPR),
  wraith: bake(WRAITH, 2),
  heart: bake(HEART_SPR),
  key: bake(KEY_SPR),
  bow: bake(BOW_SPR),
  elixir: bake(ELIXIR_SPR),
};

// ----------------------------------------------------------------- tiles
export function bakeTile(draw: (x: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const x = c.getContext("2d")!;
  draw(x);
  return c;
}
export function speckle(x: CanvasRenderingContext2D, color: string, n: number, seed: number): void {
  x.fillStyle = color;
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const px = s % TILE;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const py = s % TILE;
    x.fillRect(px, py, 1, 1);
  }
}
export const TILES: Record<string, HTMLCanvasElement> = {
  g: bakeTile(x => { x.fillStyle = "#4a8f3c"; x.fillRect(0, 0, 16, 16); speckle(x, "#57a344", 10, 7); speckle(x, "#3e7d33", 6, 13); }),
  h: bakeTile(x => { x.fillStyle = "#4a8f3c"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#2f7a2c"; for (let i = 1; i < 16; i += 3) { x.fillRect(i, 6, 1, 9); x.fillRect(i + 1, 9, 1, 6); } }),
  p: bakeTile(x => { x.fillStyle = "#b59a63"; x.fillRect(0, 0, 16, 16); speckle(x, "#c7ad78", 8, 3); speckle(x, "#9c8352", 8, 17); }),
  s: bakeTile(x => { x.fillStyle = "#d9c27a"; x.fillRect(0, 0, 16, 16); speckle(x, "#e8d494", 8, 5); }),
  t: bakeTile(x => { x.fillStyle = "#4a8f3c"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#1e3d18"; x.beginPath(); x.arc(8, 9, 7.5, 0, 7); x.fill(); x.fillStyle = "#2d5b23"; x.beginPath(); x.arc(7, 7, 6, 0, 7); x.fill(); x.fillStyle = "#3c7030"; x.beginPath(); x.arc(6, 5, 3.5, 0, 7); x.fill(); }),
  w: bakeTile(x => { x.fillStyle = "#2e5f9e"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#3f76b8"; x.fillRect(0, 3, 16, 2); x.fillRect(0, 11, 16, 2); }),
  r: bakeTile(x => { x.fillStyle = "#4a8f3c"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#6f6f80"; x.beginPath(); x.arc(8, 9, 7, 0, 7); x.fill(); x.fillStyle = "#8d8da0"; x.beginPath(); x.arc(7, 7, 5, 0, 7); x.fill(); }),
  W: bakeTile(x => { x.fillStyle = "#4b4460"; x.fillRect(0, 0, 16, 16); x.strokeStyle = "#37324a"; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 15, 7); x.strokeRect(-4.5, 8.5, 12, 7); x.strokeRect(7.5, 8.5, 12, 7); }),
  f: bakeTile(x => { x.fillStyle = "#2b2838"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#332f45"; x.fillRect(1, 1, 14, 14); speckle(x, "#3c3852", 5, 11); }),
  L: bakeTile(x => { x.fillStyle = "#4b4460"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#6b4a2a"; x.fillRect(2, 2, 12, 14); x.fillStyle = "#8a6238"; x.fillRect(3, 3, 10, 12); x.fillStyle = "#ffd257"; x.fillRect(7, 8, 2, 3); }),
  c: bakeTile(x => { x.fillStyle = "#2b2838"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#0d0c14"; x.beginPath(); x.arc(8, 16, 8, Math.PI, 0); x.fill(); }),
  n: bakeTile(x => { x.fillStyle = "#e8f2fa"; x.fillRect(0, 0, 16, 16); speckle(x, "#ffffff", 8, 9); speckle(x, "#cfe0ee", 8, 21); }),
  i: bakeTile(x => { x.fillStyle = "#bfe0f5"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#dff0fc"; x.fillRect(2, 3, 7, 1); x.fillRect(8, 10, 6, 1); x.fillStyle = "#a3cfeb"; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); }),
  d: bakeTile(x => { x.fillStyle = "#e8f2fa"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#274a52"; x.beginPath(); x.arc(8, 9, 7.5, 0, 7); x.fill(); x.fillStyle = "#3a6a74"; x.beginPath(); x.arc(7, 7, 6, 0, 7); x.fill(); x.fillStyle = "#ffffff"; x.beginPath(); x.arc(6, 4, 3, 0, 7); x.fill(); }),
  m: bakeTile(x => { x.fillStyle = "#5d6678"; x.fillRect(0, 0, 16, 16); x.strokeStyle = "#454c5c"; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 15, 7); x.strokeRect(-4.5, 8.5, 12, 7); x.strokeRect(7.5, 8.5, 12, 7); x.fillStyle = "#eef4fb"; x.fillRect(0, 0, 16, 2); }),
  k: bakeTile(x => { x.fillStyle = "#2a2024"; x.fillRect(0, 0, 16, 16); x.strokeStyle = "#1a1216"; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 15, 7); x.strokeRect(-4.5, 8.5, 12, 7); x.strokeRect(7.5, 8.5, 12, 7); x.fillStyle = "#4a2e28"; x.fillRect(2, 2, 3, 1); x.fillRect(10, 10, 3, 1); }),
  e: bakeTile(x => { x.fillStyle = "#3a2620"; x.fillRect(0, 0, 16, 16); speckle(x, "#57342a", 8, 5); speckle(x, "#ff7a3d", 3, 23); speckle(x, "#2a1a16", 6, 31); }),
  v: bakeTile(x => { x.fillStyle = "#e8501e"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#ffb545"; x.fillRect(1, 4, 6, 2); x.fillRect(8, 10, 7, 2); x.fillRect(4, 13, 4, 1); x.fillStyle = "#8f1626"; x.fillRect(0, 0, 16, 1); x.fillRect(0, 8, 5, 1); x.fillRect(11, 5, 5, 1); }),
  I: bakeTile(x => { x.fillStyle = "#8fd4f2"; x.fillRect(0, 0, 16, 16); x.fillStyle = "#cfeefc"; x.fillRect(2, 2, 4, 10); x.fillRect(9, 4, 3, 9); x.strokeStyle = "#5fb2d8"; x.strokeRect(0.5, 0.5, 15, 15); }),
};


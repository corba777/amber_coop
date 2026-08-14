/* pure text helpers — deliberately DOM-free so headless tests can import
 * them without dragging in the sprite baker */

export interface TextMeasurer { measureText(s: string): { width: number }; }

/** word-wrap for canvas banners: honest measureText, no character guessing */
export function wrapText(x: TextMeasurer, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? line + " " + w : w;
    if (x.measureText(probe).width <= maxW || !line) line = probe;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Full wrap cap (legacy / tests). Playfield uses the tiny cue instead. */
export const SAY_BUBBLE_MAX_W = 148;
/** Over-hero cue: one short line; full text lives in the off-frame #chat log. */
export const SAY_CUE_MAX_W = 72;
export const SAY_CUE_MAX_CHARS = 22;
export const SAY_BUBBLE_LINE_H = 9;
export const SAY_BUBBLE_PAD_X = 4;
export const SAY_BUBBLE_PAD_Y = 2;

/** Truncate for the sprite cue — ellipsis when the log holds the rest. */
export function speechCueText(say: string, maxChars = SAY_CUE_MAX_CHARS): string {
  const t = say.trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(1, maxChars - 1)) + "…";
}

export interface SpeechCanvas extends TextMeasurer {
  fillStyle: string;
  globalAlpha: number;
  textBaseline?: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

/** One-line bubble: no wrap. Overflow is ellipsis (full say lives in #chat). */
export function layoutSpeechBubble(
  m: TextMeasurer,
  text: string,
  maxW = SAY_BUBBLE_MAX_W,
): { lines: string[]; tw: number; th: number } {
  const inner = Math.max(8, maxW - SAY_BUBBLE_PAD_X * 2);
  let line = text.trim();
  if (m.measureText(line).width > inner) {
    while (line.length > 1 && m.measureText(line + "…").width > inner) {
      line = line.slice(0, -1);
    }
    line = line + "…";
  }
  const tw = Math.min(maxW, Math.ceil(m.measureText(line).width) + SAY_BUBBLE_PAD_X * 2);
  const th = SAY_BUBBLE_LINE_H + SAY_BUBBLE_PAD_Y * 2;
  return { lines: [line], tw, th };
}

/** White pixel bubble above (x,y). Prefer drawSpeechCue on the playfield. */
export function drawSpeechBubble(
  ctx: SpeechCanvas,
  text: string,
  x: number,
  y: number,
  canvasW: number,
  alpha: number,
  maxW = SAY_BUBBLE_MAX_W,
): void {
  const { lines, tw, th } = layoutSpeechBubble(ctx, text, maxW);
  // Integer pixels — lerp'd sprite coords + antialiased fillText look muddy
  // once the 256px canvas is nearest-neighbour scaled.
  const bx = Math.max(2, Math.min(canvasW - tw - 2, Math.round(x + 5 - tw / 2)));
  const by = Math.max(2, Math.round(y - th - 6));
  const prevBase = ctx.textBaseline;
  ctx.textBaseline = "top";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx, by, tw, th);
  ctx.fillStyle = "#1b1b2b";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i],
      bx + SAY_BUBBLE_PAD_X,
      by + SAY_BUBBLE_PAD_Y + i * SAY_BUBBLE_LINE_H,
    );
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = prevBase || "alphabetic";
}

/** Tiny over-hero cue — full say goes to the DOM chat log. */
export function drawSpeechCue(
  ctx: SpeechCanvas,
  say: string,
  x: number,
  y: number,
  canvasW: number,
  alpha: number,
): void {
  const cue = speechCueText(say);
  if (!cue) return;
  drawSpeechBubble(ctx, cue, x, y, canvasW, alpha, SAY_CUE_MAX_W);
}

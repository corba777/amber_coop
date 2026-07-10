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

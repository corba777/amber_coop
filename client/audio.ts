/* Shared WebAudio layer: sfx and the ambient score. No DOM besides window. */
import { Snapshot } from "../shared/core";

// ------------------------------------------------------------ audio + music
export let actx: AudioContext | null = null;
let sfxGain: GainNode | null = null;

export function tone(freq: number, dur: number, type: OscillatorType,
              vol: number, slideTo?: number, delay = 0): void {
  if (!actx || !sfxGain) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator();
  const gn = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn).connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export function playSfx(name: string): void {
  if (!actx) return;
  switch (name) {
    case "swing": tone(600, 0.09, "sawtooth", 0.12, 180); break;
    case "hit": tone(300, 0.08, "square", 0.15, 120); break;
    case "clang": tone(1200, 0.06, "square", 0.1, 900); tone(700, 0.1, "triangle", 0.08); break;
    case "hurt": tone(160, 0.25, "square", 0.18, 60); break;
    case "die": tone(500, 0.2, "triangle", 0.14, 80); break;
    case "down": [220, 170, 120].forEach((f, i) => tone(f, 0.2, "triangle", 0.15, undefined, i * 0.12)); break;
    case "revive": [520, 660, 880].forEach((f, i) => tone(f, 0.12, "triangle", 0.13, undefined, i * 0.1)); break;
    case "pickup": tone(880, 0.07, "square", 0.12); tone(1320, 0.09, "square", 0.12, undefined, 0.07); break;
    case "key": [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.1, "square", 0.12, undefined, i * 0.09)); break;
    case "secret": [520, 660, 780, 1040].forEach((f, i) => tone(f, 0.12, "triangle", 0.13, undefined, i * 0.1)); break;
    case "door": tone(90, 0.5, "sawtooth", 0.15, 45); break;
    case "stairs": tone(300, 0.2, "triangle", 0.1, 150); break;
    case "roar": tone(120, 0.5, "sawtooth", 0.2, 50); break;
    case "thud": tone(70, 0.3, "square", 0.22, 40); break;
    case "bow": tone(900, 0.08, "triangle", 0.12, 1400); break;
    case "shard": tone(1500, 0.12, "sine", 0.1, 700); break;
    case "teleport": tone(400, 0.2, "sine", 0.12, 1600); break;
    case "melt": tone(200, 0.8, "sine", 0.14, 900); tone(150, 0.8, "triangle", 0.1, 600, 0.1); break;
    case "bossdie": [200, 160, 120, 80].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.16, f / 2, i * 0.2)); break;
    case "gameover": [300, 250, 200, 130].forEach((f, i) => tone(f, 0.3, "triangle", 0.14, undefined, i * 0.25)); break;
    case "win": [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.18, "square", 0.12, undefined, i * 0.14)); break;
  }
}

type MusicMode = "calm" | "frost" | "vault" | "storm" | "win";
interface MoodDef {
  bpm: number; prog: number[][]; tick: boolean; tickEighths: boolean;
  drone: boolean; arpEvery: number; organVol: number;
}
export const MOODS: Record<MusicMode, MoodDef> = {
  calm: { bpm: 54, tick: false, tickEighths: false, drone: false, arpEvery: 2, organVol: 0.05, prog: [[57, 60, 64], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62]] },
  frost: { bpm: 50, tick: false, tickEighths: false, drone: true, arpEvery: 2, organVol: 0.05, prog: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]] },
  vault: { bpm: 60, tick: true, tickEighths: false, drone: true, arpEvery: 2, organVol: 0.055, prog: [[45, 52, 57, 60], [41, 48, 53, 57], [40, 47, 52, 56], [45, 52, 57, 60]] },
  storm: { bpm: 96, tick: true, tickEighths: true, drone: true, arpEvery: 1, organVol: 0.06, prog: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]] },
  win: { bpm: 44, tick: false, tickEighths: false, drone: true, arpEvery: 2, organVol: 0.06, prog: [[48, 52, 55, 60, 64], [53, 57, 60, 65], [48, 52, 55, 60, 64], [43, 55, 59, 62]] },
};
const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const music = { mode: "calm" as MusicMode, muted: false, nextBeat: 0, beat: 0, gain: null as GainNode | null };

function organChord(notes: number[], t0: number, dur: number, vol: number): void {
  if (!actx || !music.gain) return;
  for (const m of notes) {
    const f = midiHz(m);
    const partials: [number, number][] = [[1, 1], [2, 0.55], [3, 0.28], [4, 0.12]];
    for (const [mult, pv] of partials) {
      const o = actx.createOscillator();
      const gn = actx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f * mult, t0);
      const peak = (vol * pv) / notes.length;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.linearRampToValueAtTime(peak, t0 + dur * 0.35);
      gn.gain.setValueAtTime(peak, t0 + dur * 0.8);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 1.4);
      o.connect(gn).connect(music.gain);
      o.start(t0); o.stop(t0 + dur * 1.45);
    }
  }
}
function pluck(midi: number, t0: number, vol: number): void {
  if (!actx || !music.gain) return;
  const o = actx.createOscillator();
  const gn = actx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(midiHz(midi), t0);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  o.connect(gn).connect(music.gain);
  o.start(t0); o.stop(t0 + 0.55);
}
function clockTick(t0: number): void {
  if (!actx || !music.gain) return;
  const o = actx.createOscillator();
  const gn = actx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(1900, t0);
  gn.gain.setValueAtTime(0.028, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
  o.connect(gn).connect(music.gain);
  o.start(t0); o.stop(t0 + 0.05);
}
function droneNote(midi: number, t0: number, dur: number): void {
  if (!actx || !music.gain) return;
  const o = actx.createOscillator();
  const gn = actx.createGain();
  const lp = actx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(220, t0);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(midiHz(midi - 12), t0);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.linearRampToValueAtTime(0.035, t0 + dur * 0.3);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 1.2);
  o.connect(lp).connect(gn).connect(music.gain);
  o.start(t0); o.stop(t0 + dur * 1.25);
}
export function scheduleMusic(): void {
  if (!actx || music.muted) return;
  const lookahead = 0.35;
  while (music.nextBeat < actx.currentTime + lookahead) {
    const mood = MOODS[music.mode];
    const beatDur = 60 / mood.bpm;
    const chordLen = 4;
    const chordIdx = Math.floor(music.beat / chordLen) % mood.prog.length;
    const chord = mood.prog[chordIdx];
    const inChord = music.beat % chordLen;
    const t0 = music.nextBeat;
    if (inChord === 0) {
      organChord(chord, t0, beatDur * chordLen, mood.organVol);
      if (mood.drone) droneNote(chord[0], t0, beatDur * chordLen);
    }
    if (mood.tick) {
      clockTick(t0);
      if (mood.tickEighths) clockTick(t0 + beatDur / 2);
    }
    const root = chord[0];
    const osti = [root + 12, root + 19, root + 24, root + 26];
    for (let e8 = 0; e8 < 2; e8++) {
      const idx = (music.beat * 2 + e8);
      if (idx % mood.arpEvery === 0) pluck(osti[idx % 4], t0 + (beatDur / 2) * e8, 0.035);
    }
    music.beat++;
    music.nextBeat += beatDur;
  }
}
export function musicModeFor(s: Snapshot): MusicMode {
  if (s.screen === "win") return "win";
  const bossAlive = s.enemies.some(e =>
    (e.kind === "golem" || e.kind === "wraith" || e.kind === "ember") && !e.dead);
  if (bossAlive && s.screen === "play") return "storm";
  if (s.room >= 3 && s.room <= 5) return "vault";
  if (s.room === 12 || s.room === 13) return "vault";
  if (s.room >= 14) return "vault";
  if (s.room >= 9 && s.room <= 11) return "vault";
  if (s.room >= 6) return "frost";
  return "calm";
}
export function ensureAudio(): void {
  if (!actx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new AC();
    sfxGain = actx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(actx.destination);
    const mg = actx.createGain();
    mg.gain.value = 0.85;
    mg.connect(actx.destination);
    music.gain = mg;
    music.nextBeat = actx.currentTime + 0.1;
    window.setInterval(scheduleMusic, 90);
  }
  if (actx.state === "suspended") void actx.resume();
}


/* Persona Composer adapter — cached modular system prompts + speech profiles. */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { compose } from "persona-composer";
import type { Manifest } from "persona-composer";

/** Fixed as-of timestamp so benches / selftests stay reproducible. */
export const PERSONA_TIMESTAMP = "2026-07-20T00:00:00.000Z";

export const SPEECH_PROFILES = [
  "standard",
  "raw-ru",
] as const;
export type SpeechProfile = (typeof SPEECH_PROFILES)[number];

export const SPEECH_LABELS: Record<SpeechProfile, string> = {
  standard: "STANDARD",
  "raw-ru": "RAW RUSSIAN (16+)",
};

export type PersonaRole =
  | "companion"
  | "solo"
  | "duo-leader"
  | "duo-peer";

const ROLE_IDENTITY: Record<PersonaRole, string> = {
  companion: "identity/companion.md",
  solo: "identity/solo.md",
  "duo-leader": "identity/duo-leader.md",
  "duo-peer": "identity/duo-peer.md",
};

const RAW_SPEECH_BASE = [
  "speech/pohuy-skill.md",
  "speech/pohuy-slovar.md",
  "speech/pohuy-sceny.md",
];

/** Vendored pohuy source SHA-256 (content pin for selftest). */
export const POHUY_SOURCE_HASHES = {
  "vendor/pohuy/SKILL.md":
    "777ea18d9023ce1c32cc5457e99590f0391cab117266ae05bc216b5b3f18f404",
  "vendor/pohuy/references/slovar.md":
    "e24c13442eb61fa00637d64336ec83b5c34d9314dcefdf51d85ee609617fabdb",
  "vendor/pohuy/references/sceny.md":
    "26718a5e530a030b0c4503e7fe228c17d3ca5b7356ba5ca6661f1b67edc6f4a4",
} as const;

export interface RelativizedManifest {
  skeleton_version: string;
  timestamp: string;
  modules: Array<{
    path: string;
    type: string;
    name: string;
    hash: string;
    source?: string;
    source_hash?: string;
    origin?: string;
    adaptation?: string;
    mode?: string;
  }>;
  conflict_rules: Manifest["conflict_rules"];
  rewriter_stack: RelativizedManifest["modules"];
  warnings: string[];
}

export interface CompiledPersona {
  role: PersonaRole;
  speech: SpeechProfile;
  promptXml: string;
  promptHash: string;
  manifest: RelativizedManifest;
}

const cache = new Map<string, CompiledPersona>();

export function isSpeechProfile(v: unknown): v is SpeechProfile {
  return typeof v === "string" &&
    (SPEECH_PROFILES as readonly string[]).includes(v);
}

export function pickSpeech(v?: string | null): SpeechProfile {
  return isSpeechProfile(v) ? v : "standard";
}

/** Resolve the on-disk module library (build copies into dist/persona-modules). */
export function resolveModulesRoot(): string {
  // Bundled CJS has no import.meta.url — resolve from cwd (server/selftest run from repo or /app).
  const candidates = [
    path.join(process.cwd(), "dist", "persona-modules"),
    path.join(process.cwd(), "persona", "modules"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "identity", "companion.md"))) return c;
  }
  throw new Error(
    `persona modules not found (tried ${candidates.join(", ")})`,
  );
}

function relPath(abs: string, root: string): string {
  const n = path.normalize(abs);
  const r = path.normalize(root);
  if (n.startsWith(r + path.sep) || n === r) {
    return path.relative(r, n).split(path.sep).join("/");
  }
  // Fall back: keep basename trail if somehow outside root
  return path.basename(n);
}

function relativizeManifest(m: Manifest, root: string): RelativizedManifest {
  const mapMod = (mod: Manifest["modules"][number]) => ({
    path: relPath(mod.path, root),
    type: mod.type,
    name: mod.name,
    hash: mod.hash,
    source: mod.source
      ? (mod.source.startsWith("/")
        ? relPath(mod.source, root)
        : mod.source.split(path.sep).join("/"))
      : undefined,
    source_hash: mod.source_hash,
    origin: mod.origin,
    adaptation: mod.adaptation,
    mode: mod.mode,
  });
  return {
    skeleton_version: m.skeleton_version,
    timestamp: m.timestamp,
    modules: m.modules.map(mapMod),
    conflict_rules: m.conflict_rules,
    rewriter_stack: m.rewriter_stack.map(mapMod),
    warnings: m.warnings,
  };
}

function speechModules(speech: SpeechProfile): string[] {
  if (speech === "standard") return ["output_rules/amber-json.md"];
  return [
    ...RAW_SPEECH_BASE,
    "speech/raw-ru.md",
    "output_rules/amber-json.md",
  ];
}

/**
 * Compile (and cache) a system-prompt persona for a role × speech pair.
 * Never re-scans the library on cache hit — compose() is sync FS I/O.
 */
export function compilePersona(
  role: PersonaRole,
  speech: SpeechProfile = "standard",
  modulesRoot = resolveModulesRoot(),
): CompiledPersona {
  const key = `${role}|${speech}|${modulesRoot}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const result = compose(
    path.join(modulesRoot, ROLE_IDENTITY[role]),
    speechModules(speech).map(m => path.join(modulesRoot, m)),
    {
      moduleRoot: modulesRoot,
      timestamp: PERSONA_TIMESTAMP,
    },
  );
  const promptHash = createHash("sha256")
    .update(result.promptXml)
    .digest("hex");
  const compiled: CompiledPersona = {
    role,
    speech,
    promptXml: result.promptXml,
    promptHash,
    manifest: relativizeManifest(result.manifest, modulesRoot),
  };
  cache.set(key, compiled);
  return compiled;
}

/** Test helper — drop the in-memory cache (does not touch disk). */
export function clearPersonaCache(): void {
  cache.clear();
}

/**
 * Role selection for the planner identity module.
 * LIVE addenda (FREE ROAM, ice, treason, …) are still appended in agent.ts.
 */
export function selectPersonaRole(
  solo: boolean,
  travelMode: "linked" | "free",
  opts: { leader?: boolean; duoPeer?: boolean },
): PersonaRole {
  if (solo) return "solo";
  if (travelMode === "free" && (opts.leader || opts.duoPeer)) return "duo-peer";
  if (opts.leader && travelMode !== "free") return "duo-leader";
  return "companion";
}

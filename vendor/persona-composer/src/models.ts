/** Module and manifest data models. */

export type ModuleType =
  | "identity"
  | "role"
  | "trait"
  | "speech"
  | "relationship"
  | "output_rules";

export type Priority = "high" | "medium" | "low";
export type Adaptation = "as-is" | "extracted";
export type SpeechMode = "prompt" | "rewriter";

export const SKELETON_VERSION = "3";

export const DEFAULT_OUTPUT_RULES =
  "Follow the sections above. Prefer concrete actions over vague intent.";

export function todayLine(asOf: string): string {
  let day = (asOf || "").slice(0, 10);
  if (day.length !== 10) {
    day = new Date().toISOString().slice(0, 10);
  }
  return `Today is ${day}; use it in any generated metadata.`;
}

export function withTodayLine(body: string, asOf: string): string {
  const line = todayLine(asOf);
  const trimmed = (body || "").trim();
  if (!trimmed) return line;
  // Single newline to match Python golden (minidom also drops blank lines).
  return `${line}\n${trimmed}`;
}

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export interface SkeletonConfig {
  version?: string;
  output_rules?: string;
}

export function skeletonConfig(
  partial: SkeletonConfig = {},
): Required<SkeletonConfig> {
  return {
    version: partial.version ?? SKELETON_VERSION,
    output_rules: partial.output_rules ?? "",
  };
}

export interface Module {
  path: string;
  type: ModuleType;
  name: string;
  body: string;
  hash: string;
  priority?: Priority;
  conflicts: string[];
  tools: string[];
  mode: SpeechMode;
  agent?: string;
  status?: string;
  source?: string;
  adaptation?: Adaptation;
  origin?: string;
  sourcePath?: string;
  sourceHash?: string;
  sourceBody?: string;
}

export function renderBody(m: Module): string {
  if (m.adaptation === "as-is") {
    return m.sourceBody ?? "";
  }
  return m.body;
}

export function isImported(m: Module): boolean {
  return m.source != null;
}

export interface ConflictResolution {
  winner: string;
  loser: string;
  winner_priority: string;
  loser_priority: string;
}

export function conflictRuleLine(r: ConflictResolution): string {
  return (
    `When ${r.winner} and ${r.loser} conflict, ` +
    `${r.winner} (priority=${r.winner_priority}) governs; ` +
    `${r.loser} yields.`
  );
}

export function conflictToDict(r: ConflictResolution): Record<string, string> {
  return {
    winner: r.winner,
    loser: r.loser,
    winner_priority: r.winner_priority,
    loser_priority: r.loser_priority,
    rule: conflictRuleLine(r),
  };
}

export interface ManifestModule {
  path: string;
  type: string;
  name: string;
  hash: string;
  source?: string;
  source_hash?: string;
  origin?: string;
  adaptation?: string;
  mode?: string;
}

export interface Manifest {
  skeleton_version: string;
  timestamp: string;
  modules: ManifestModule[];
  conflict_rules: Record<string, string>[];
  rewriter_stack: ManifestModule[];
  warnings: string[];
}

export function manifestModuleToDict(m: ManifestModule): Record<string, unknown> {
  const data: Record<string, unknown> = {
    path: m.path,
    type: m.type,
    name: m.name,
    hash: m.hash,
  };
  if (m.source != null) data.source = m.source;
  if (m.source_hash != null) data.source_hash = m.source_hash;
  if (m.origin != null) data.origin = m.origin;
  if (m.adaptation != null) data.adaptation = m.adaptation;
  if (m.mode != null) data.mode = m.mode;
  return data;
}

export function manifestToDict(m: Manifest): Record<string, unknown> {
  return {
    skeleton_version: m.skeleton_version,
    timestamp: m.timestamp,
    modules: m.modules.map(manifestModuleToDict),
    conflict_rules: m.conflict_rules,
    rewriter_stack: m.rewriter_stack.map(manifestModuleToDict),
    warnings: m.warnings,
  };
}

export function manifestFromDict(data: Record<string, unknown>): Manifest {
  const asMod = (raw: Record<string, unknown>): ManifestModule => ({
    path: String(raw.path),
    type: String(raw.type),
    name: String(raw.name),
    hash: String(raw.hash),
    source: raw.source != null ? String(raw.source) : undefined,
    source_hash: raw.source_hash != null ? String(raw.source_hash) : undefined,
    origin: raw.origin != null ? String(raw.origin) : undefined,
    adaptation: raw.adaptation != null ? String(raw.adaptation) : undefined,
    mode: raw.mode != null ? String(raw.mode) : undefined,
  });
  return {
    skeleton_version: String(data.skeleton_version),
    timestamp: String(data.timestamp),
    modules: ((data.modules as Record<string, unknown>[]) ?? []).map(asMod),
    conflict_rules: (data.conflict_rules as Record<string, string>[]) ?? [],
    rewriter_stack: ((data.rewriter_stack as Record<string, unknown>[]) ?? []).map(
      asMod,
    ),
    warnings: (data.warnings as string[]) ?? [],
  };
}

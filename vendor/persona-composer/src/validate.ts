/** Build-time validation. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { ValidationError } from "./errors.js";
import type { ConflictResolution, Module, Priority } from "./models.js";
import { PRIORITY_RANK } from "./models.js";
import { splitFrontmatter } from "./parse.js";
import { DEFAULT_REGISTRY, type TypeRegistry } from "./registry.js";

function walkMd(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkMd(full));
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

export function discoverLibraryTraitNames(
  moduleRoot: string | undefined | null,
): Set<string> | null {
  if (!moduleRoot) return null;
  try {
    if (!statSync(moduleRoot).isDirectory()) return null;
  } catch {
    return null;
  }
  const names = new Set<string>();
  for (const file of walkMd(moduleRoot)) {
    let text: string;
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (!text.startsWith("---")) continue;
    try {
      const [fm] = splitFrontmatter(text);
      if (fm.type === "trait" && fm.name) names.add(String(fm.name));
    } catch {
      continue;
    }
  }
  return names;
}

export function findMutualConflicts(
  traits: Module[],
): Array<[Module, Module]> {
  const byName = new Map(traits.map((t) => [t.name, t]));
  const pairs: Array<[Module, Module]> = [];
  const seen = new Set<string>();
  for (const trait of traits) {
    for (const otherName of trait.conflicts) {
      const other = byName.get(otherName);
      if (!other) continue;
      if (!other.conflicts.includes(trait.name)) continue;
      const key = [trait.name, other.name].sort().join("\0");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([trait, other]);
    }
  }
  return pairs;
}

export function findOneSidedConflicts(traits: Module[]): string[] {
  const byName = new Map(traits.map((t) => [t.name, t]));
  const warnings: string[] = [];
  for (const trait of traits) {
    for (const otherName of trait.conflicts) {
      const other = byName.get(otherName);
      if (!other) continue;
      if (!other.conflicts.includes(trait.name)) {
        warnings.push(
          `incomplete conflict pair: ${trait.name} lists ${otherName}, ` +
            `but ${otherName} does not list ${trait.name} — no ` +
            `<conflict_rule> generated`,
        );
      }
    }
  }
  return warnings;
}

export function validateModules(
  modules: Module[],
  options: {
    libraryTraitNames?: Set<string> | null;
    registry?: TypeRegistry;
  } = {},
): string[] {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const errors: string[] = [];
  const warnings: string[] = [];

  const identities = modules.filter((m) => m.type === "identity");
  if (!identities.length) {
    errors.push("no identity module (identity is mandatory)");
  } else if (identities.length > 1) {
    errors.push(
      `more than one identity module: ${identities.map((m) => JSON.stringify(m.name)).join(", ")}`,
    );
  }

  const byType = new Map<string, Module[]>();
  for (const m of modules) {
    const list = byType.get(m.type) ?? [];
    list.push(m);
    byType.set(m.type, list);
  }

  for (const [mtype, group] of byType) {
    const seen = new Set<string>();
    for (const m of group) {
      if (seen.has(m.name)) {
        errors.push(`duplicate name ${JSON.stringify(m.name)} within type ${mtype}`);
      }
      seen.add(m.name);
    }
    const spec = registry.get(mtype);
    if (spec?.maxCount != null && group.length > spec.maxCount) {
      errors.push(
        `at most ${spec.maxCount} module(s) of type ${mtype}, got ${group.length}`,
      );
    }
  }

  const traits = byType.get("trait") ?? [];
  warnings.push(...findOneSidedConflicts(traits));

  if (options.libraryTraitNames) {
    for (const trait of traits) {
      for (const name of trait.conflicts) {
        if (!options.libraryTraitNames.has(name)) {
          warnings.push(
            `conflicts references unknown trait ${JSON.stringify(name)} ` +
              `(not found in module library)`,
          );
        }
      }
    }
  }

  for (const [a, b] of findMutualConflicts(traits)) {
    if (a.priority === b.priority) {
      errors.push(
        `mutual conflict between ${JSON.stringify(a.name)} and ${JSON.stringify(b.name)} ` +
          `with equal priority ${JSON.stringify(a.priority)} (каша prevention)`,
      );
    }
  }

  if (errors.length) {
    throw new ValidationError(errors[0]!, errors);
  }
  return warnings;
}

export function resolveConflicts(traits: Module[]): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];
  for (const [a, b] of findMutualConflicts(traits)) {
    const aRank = PRIORITY_RANK[a.priority as Priority];
    const bRank = PRIORITY_RANK[b.priority as Priority];
    const [winner, loser] = aRank > bRank ? [a, b] : [b, a];
    resolutions.push({
      winner: winner.name,
      loser: loser.name,
      winner_priority: winner.priority!,
      loser_priority: loser.priority!,
    });
  }
  resolutions.sort((x, y) =>
    x.winner === y.winner
      ? x.loser.localeCompare(y.loser)
      : x.winner.localeCompare(y.winner),
  );
  return resolutions;
}

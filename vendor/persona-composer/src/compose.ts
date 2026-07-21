/** Compose system prompts from modules + emit manifests. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CompositionError, ValidationError } from "./errors.js";
import { fileHash } from "./hashing.js";
import type {
  Manifest,
  ManifestModule,
  Module,
  SkeletonConfig,
} from "./models.js";
import {
  conflictToDict,
  manifestFromDict,
  manifestToDict,
  skeletonConfig,
} from "./models.js";
import { parseModule, parseModules } from "./parse.js";
import { DEFAULT_REGISTRY, type TypeRegistry } from "./registry.js";
import { renderPrompt } from "./render.js";
import {
  discoverLibraryTraitNames,
  resolveConflicts,
  validateModules,
} from "./validate.js";

export interface CompositionResult {
  promptXml: string;
  manifest: Manifest;
  manifestJson(indent?: number): string;
}

function toResult(promptXml: string, manifest: Manifest): CompositionResult {
  return {
    promptXml,
    manifest,
    manifestJson(indent = 2) {
      return JSON.stringify(manifestToDict(manifest), null, indent) + "\n";
    },
  };
}

function moduleToManifestEntry(m: Module): ManifestModule {
  return {
    path: m.path,
    type: m.type,
    name: m.name,
    hash: m.hash,
    source: m.source,
    source_hash: m.sourceHash,
    origin: m.origin,
    adaptation: m.adaptation,
    mode: m.type === "speech" ? m.mode : undefined,
  };
}

function buildManifest(
  modules: Module[],
  resolutions: ReturnType<typeof resolveConflicts>,
  warnings: string[],
  skeleton: Required<SkeletonConfig>,
  timestamp?: string,
): Manifest {
  const promptModules = modules.filter(
    (m) => !(m.type === "speech" && m.mode === "rewriter"),
  );
  const rewriters = modules.filter(
    (m) => m.type === "speech" && m.mode === "rewriter",
  );
  return {
    skeleton_version: skeleton.version,
    timestamp: timestamp ?? new Date().toISOString(),
    modules: promptModules.map(moduleToManifestEntry),
    conflict_rules: resolutions.map(conflictToDict),
    rewriter_stack: rewriters.map(moduleToManifestEntry),
    warnings,
  };
}

function isModule(x: string | Module): x is Module {
  return typeof x === "object" && x !== null && "type" in x && "hash" in x;
}

export interface ComposeOptions {
  skeleton?: SkeletonConfig;
  moduleRoot?: string;
  libraryRoot?: string;
  registry?: TypeRegistry;
  timestamp?: string;
}

export function compose(
  identity: string | Module,
  modules: Array<string | Module> = [],
  options: ComposeOptions = {},
): CompositionResult {
  const skeleton = skeletonConfig(options.skeleton);
  const registry = options.registry ?? DEFAULT_REGISTRY;

  const ensure = (item: string | Module): Module =>
    isModule(item)
      ? item
      : parseModule(item, {
          moduleRoot: options.moduleRoot,
          registry,
        });

  const identityMod = ensure(identity);
  if (identityMod.type !== "identity") {
    throw new ValidationError(
      `identity argument must be type=identity, got ${identityMod.type}`,
    );
  }

  const parsed: Module[] = [identityMod, ...modules.map(ensure)];

  const libRoot =
    options.libraryRoot !== undefined
      ? options.libraryRoot
      : options.moduleRoot;
  const libraryNames = discoverLibraryTraitNames(libRoot);
  const warnings = validateModules(parsed, {
    libraryTraitNames: libraryNames,
    registry,
  });
  const traits = parsed.filter((m) => m.type === "trait");
  const resolutions = resolveConflicts(traits);
  const ts = options.timestamp ?? new Date().toISOString();
  const promptXml = renderPrompt(parsed, resolutions, skeleton, ts);
  const manifest = buildManifest(
    parsed,
    resolutions,
    warnings,
    skeleton,
    ts,
  );
  return toResult(promptXml, manifest);
}

export interface ComposeFromManifestOptions extends ComposeOptions {
  verifyHashes?: boolean;
}

export function composeFromManifest(
  manifestInput: Manifest | Record<string, unknown> | string,
  options: ComposeFromManifestOptions = {},
): CompositionResult {
  let manifest: Manifest;
  if (typeof manifestInput === "string") {
    manifest = manifestFromDict(
      JSON.parse(readFileSync(manifestInput, "utf-8")) as Record<string, unknown>,
    );
  } else if (
    "skeleton_version" in manifestInput &&
    "modules" in manifestInput &&
    Array.isArray((manifestInput as Manifest).modules)
  ) {
    // Already a Manifest-like or plain dict
    const m = manifestInput as Manifest;
    if (typeof m.timestamp === "string" && Array.isArray(m.conflict_rules)) {
      manifest =
        "rewriter_stack" in m && Array.isArray(m.rewriter_stack)
          ? m
          : manifestFromDict(manifestInput as Record<string, unknown>);
    } else {
      manifest = manifestFromDict(manifestInput as Record<string, unknown>);
    }
  } else {
    manifest = manifestFromDict(manifestInput as Record<string, unknown>);
  }

  let skeleton = skeletonConfig(
    options.skeleton ?? { version: manifest.skeleton_version },
  );
  if (skeleton.version !== manifest.skeleton_version) {
    skeleton = skeletonConfig({
      version: manifest.skeleton_version,
      output_rules: skeleton.output_rules,
    });
  }

  const allEntries = [...manifest.modules, ...manifest.rewriter_stack];
  if (!allEntries.length) {
    throw new ValidationError("manifest has no modules");
  }

  const verifyHashes = options.verifyHashes !== false;
  const paths: string[] = [];
  for (const entry of allEntries) {
    let filePath = entry.path;
    if (!existsSync(filePath)) {
      if (options.moduleRoot) {
        const alt = path.join(options.moduleRoot, entry.path);
        if (existsSync(alt)) filePath = alt;
        else {
          throw new CompositionError(
            `manifest module not found: ${entry.path}`,
          );
        }
      } else {
        throw new CompositionError(`manifest module not found: ${entry.path}`);
      }
    }
    if (verifyHashes) {
      const actual = fileHash(filePath);
      if (actual !== entry.hash) {
        throw new CompositionError(
          `hash mismatch for ${entry.path}: manifest=${entry.hash} actual=${actual}`,
        );
      }
      if (entry.source && entry.source_hash) {
        const root = options.moduleRoot ?? path.dirname(filePath);
        const sourcePath = path.resolve(root, entry.source);
        if (existsSync(sourcePath)) {
          const srcHash = fileHash(sourcePath);
          if (srcHash !== entry.source_hash) {
            throw new CompositionError(
              `source hash mismatch for ${entry.source}: ` +
                `manifest=${entry.source_hash} actual=${srcHash}`,
            );
          }
        }
      }
    }
    paths.push(filePath);
  }

  const parsed = parseModules(paths, {
    moduleRoot: options.moduleRoot,
    registry: options.registry,
  });
  const identities = parsed.filter((m) => m.type === "identity");
  if (!identities.length) {
    throw new ValidationError("manifest contains no identity module");
  }
  const identity = identities[0]!;
  const others = parsed.filter((m) => m !== identity);
  return compose(identity, others, {
    ...options,
    skeleton,
    timestamp: options.timestamp ?? manifest.timestamp,
  });
}

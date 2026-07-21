/** Parse Markdown modules with YAML frontmatter. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import { ValidationError } from "./errors.js";
import { fileHash } from "./hashing.js";
import type { Module, ModuleType } from "./models.js";
import {
  applyFrontmatter,
  DEFAULT_REGISTRY,
  type Frontmatter,
  type TypeRegistry,
} from "./registry.js";

const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

export function splitFrontmatter(text: string): [Frontmatter, string] {
  const match = FRONTMATTER.exec(text);
  if (!match) {
    throw new ValidationError(
      "module must start with YAML frontmatter (--- ... ---)",
    );
  }
  let data: unknown;
  try {
    data = yaml.load(match[1] ?? "") ?? {};
  } catch (exc) {
    throw new ValidationError(`invalid YAML frontmatter: ${String(exc)}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ValidationError("frontmatter must be a YAML mapping");
  }
  return [data as Frontmatter, match[2] ?? ""];
}

export function parseModule(
  filePath: string,
  options: {
    moduleRoot?: string;
    registry?: TypeRegistry;
  } = {},
): Module {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const resolved = path.resolve(filePath);
  const text = readFileSync(resolved, "utf-8");
  const [fm, body] = splitFrontmatter(text);

  const typeName = fm.type;
  if (!typeName) {
    throw new ValidationError(`${resolved}: missing required field: type`);
  }
  if (typeof typeName !== "string") {
    throw new ValidationError(`${resolved}: type must be a string`);
  }

  let spec;
  try {
    spec = registry.require(typeName);
  } catch (exc) {
    if (exc instanceof ValidationError) {
      throw new ValidationError(`${resolved}: ${exc.message}`);
    }
    throw exc;
  }

  const errors = spec.validateFrontmatter(fm, body);
  if (errors.length) {
    throw new ValidationError(`${resolved}: ${errors.join("; ")}`, errors);
  }

  const module: Module = {
    path: resolved,
    type: typeName as ModuleType,
    name: String(fm.name),
    // Match Python str.strip("\n")
    body: body.replace(/^\n+/, "").replace(/\n+$/, ""),
    hash: fileHash(resolved),
    conflicts: [],
    tools: [],
    mode: "prompt",
  };
  applyFrontmatter(module, fm);

  if (module.source) {
    const root = path.resolve(options.moduleRoot ?? path.dirname(resolved));
    const sourcePath = path.resolve(root, module.source);
    if (!existsSync(sourcePath)) {
      throw new ValidationError(
        `${resolved}: source not found: ${module.source} (resolved ${sourcePath})`,
      );
    }
    module.sourcePath = sourcePath;
    module.sourceHash = fileHash(sourcePath);
    const sourceText = readFileSync(sourcePath, "utf-8");
    if (module.adaptation === "as-is") {
      module.sourceBody = sourceText.replace(/^\n+/, "").replace(/\n+$/, "");
    } else {
      module.sourceBody = undefined;
    }
  }

  return module;
}

export function parseModules(
  paths: string[],
  options: {
    moduleRoot?: string;
    registry?: TypeRegistry;
  } = {},
): Module[] {
  return paths.map((p) => parseModule(p, options));
}

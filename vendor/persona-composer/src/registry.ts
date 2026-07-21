/** Module-type registry (plugin surface). */

import { ValidationError } from "./errors.js";
import type {
  Adaptation,
  Module,
  ModuleType,
  Priority,
  SpeechMode,
} from "./models.js";

export type Frontmatter = Record<string, unknown>;

export type Validator = (fm: Frontmatter, body: string) => string[];

export interface TypeSpec {
  type: ModuleType;
  slot: string;
  validateFrontmatter: Validator;
  maxCount?: number;
}

function requireName(fm: Frontmatter): string[] {
  if (!fm.name) return ["missing required field: name"];
  return [];
}

function validateIdentity(fm: Frontmatter, _body: string): string[] {
  return requireName(fm);
}

function validateRole(fm: Frontmatter, _body: string): string[] {
  const errors = requireName(fm);
  if (fm.tools != null && !Array.isArray(fm.tools)) {
    errors.push("role.tools must be a list");
  }
  return errors;
}

function validateTrait(fm: Frontmatter, _body: string): string[] {
  const errors = requireName(fm);
  const priority = fm.priority;
  if (priority == null) {
    errors.push("trait requires priority (high|medium|low)");
  } else if (!["high", "medium", "low"].includes(String(priority))) {
    errors.push(`invalid trait.priority: ${JSON.stringify(priority)}`);
  }
  const conflicts = fm.conflicts ?? [];
  if (!Array.isArray(conflicts)) {
    errors.push("trait.conflicts must be a list");
  }
  return errors;
}

function validateImportFields(fm: Frontmatter, body: string): string[] {
  const errors: string[] = [];
  const source = fm.source;
  const adaptation = fm.adaptation;
  if (
    adaptation != null &&
    !["as-is", "extracted"].includes(String(adaptation))
  ) {
    errors.push(`invalid adaptation: ${JSON.stringify(adaptation)}`);
  }
  if (adaptation === "as-is") {
    if (!source) errors.push("adaptation as-is requires source");
    if (body.trim()) errors.push("adaptation as-is requires an empty overlay body");
  }
  if (source && adaptation == null) {
    errors.push("source requires adaptation (as-is|extracted)");
  }
  return errors;
}

function withImport(base: Validator): Validator {
  return (fm, body) => [...base(fm, body), ...validateImportFields(fm, body)];
}

function validateSpeech(fm: Frontmatter, body: string): string[] {
  const errors = requireName(fm);
  const mode = fm.mode ?? "prompt";
  if (!["prompt", "rewriter"].includes(String(mode))) {
    errors.push(`invalid speech.mode: ${JSON.stringify(mode)}`);
  }
  errors.push(...validateImportFields(fm, body));
  return errors;
}

function validateRelationship(fm: Frontmatter, _body: string): string[] {
  const errors = requireName(fm);
  if (!fm.agent) errors.push("relationship requires agent");
  if (!fm.status) errors.push("relationship requires status");
  return errors;
}

function validateOutputRules(fm: Frontmatter, _body: string): string[] {
  return requireName(fm);
}

export const BUILTIN_TYPES: Record<string, TypeSpec> = {
  identity: {
    type: "identity",
    slot: "identity",
    validateFrontmatter: withImport(validateIdentity),
    maxCount: 1,
  },
  role: {
    type: "role",
    slot: "role",
    validateFrontmatter: withImport(validateRole),
    maxCount: 1,
  },
  trait: {
    type: "trait",
    slot: "traits",
    validateFrontmatter: withImport(validateTrait),
  },
  speech: {
    type: "speech",
    slot: "speech",
    validateFrontmatter: validateSpeech,
  },
  relationship: {
    type: "relationship",
    slot: "relationships",
    validateFrontmatter: withImport(validateRelationship),
  },
  output_rules: {
    type: "output_rules",
    slot: "output_rules",
    validateFrontmatter: withImport(validateOutputRules),
    maxCount: 1,
  },
};

export class TypeRegistry {
  private specs: Map<string, TypeSpec>;

  constructor(specs: Record<string, TypeSpec> = BUILTIN_TYPES) {
    this.specs = new Map(Object.entries(specs));
  }

  register(spec: TypeSpec): void {
    this.specs.set(spec.type, spec);
  }

  get(typeName: string): TypeSpec | undefined {
    return this.specs.get(typeName);
  }

  require(typeName: string): TypeSpec {
    const spec = this.get(typeName);
    if (!spec) throw new ValidationError(`unknown type: ${JSON.stringify(typeName)}`);
    return spec;
  }

  knownTypes(): Set<string> {
    return new Set(this.specs.keys());
  }
}

export const DEFAULT_REGISTRY = new TypeRegistry();

export function applyFrontmatter(module: Module, fm: Frontmatter): void {
  if (module.type === "trait") {
    module.priority = String(fm.priority) as Priority;
    module.conflicts = Array.isArray(fm.conflicts)
      ? fm.conflicts.map(String)
      : [];
  } else if (module.type === "role") {
    module.tools = Array.isArray(fm.tools) ? fm.tools.map(String) : [];
  } else if (module.type === "speech") {
    module.mode = String(fm.mode ?? "prompt") as SpeechMode;
  } else if (module.type === "relationship") {
    module.agent = String(fm.agent);
    module.status = String(fm.status);
  }

  if (fm.source) module.source = String(fm.source);
  if (fm.adaptation) module.adaptation = String(fm.adaptation) as Adaptation;
  if (fm.origin) module.origin = String(fm.origin);
}

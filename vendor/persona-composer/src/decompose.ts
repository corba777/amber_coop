/** Decomposition workflow — suggest trait/speech extractions (LLM injected). */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CompositionError, ValidationError } from "./errors.js";
import { splitFrontmatter } from "./parse.js";

export type SuggestionType = "trait" | "speech" | "role" | "output_rules";
export type LlmCall = (prompt: string) => string | Promise<string>;

export const DECOMPOSE_SCHEMA_HINT = `Return ONLY a JSON object (no markdown fences) with this shape:
{
  "summary": "one-sentence overview",
  "remaining_identity_body": "slim identity directives",
  "suggestions": [
    {
      "type": "trait" | "speech" | "role" | "output_rules",
      "name": "Name",
      "priority": "high" | "medium" | "low",
      "conflicts": ["Other"],
      "mode": "prompt" | "rewriter",
      "body": "short imperative directives",
      "rationale": "why"
    }
  ]
}`;

export interface ModuleSuggestion {
  type: SuggestionType;
  name: string;
  body: string;
  rationale?: string;
  priority?: string;
  conflicts?: string[];
  mode?: string;
}

export interface DecompositionResult {
  sourcePath?: string;
  sourceKind: "identity" | "skill" | "raw";
  summary: string;
  remainingIdentityBody: string;
  suggestions: ModuleSuggestion[];
  draftPaths: string[];
  rawLlmResponse?: string;
}

export function buildDecomposePrompt(options: {
  sourceText: string;
  sourceKind?: "identity" | "skill" | "raw";
  sourceName?: string;
  provenance?: string;
}): string {
  const kind = options.sourceKind ?? "raw";
  const kindNote = {
    identity: "This is a monolithic identity / system prompt. Suggest extractions.",
    skill:
      "This is a foreign/vendored skill. Distill reusable speech/trait rules; ignore host-specific commands and tooling.",
    raw: "This is free-form agent instruction text. Suggest modular extractions.",
  }[kind];
  let header = `Source kind: ${kind}`;
  if (options.sourceName) header += `\nSource name: ${options.sourceName}`;
  if (options.provenance) header += `\nProvenance: ${options.provenance}`;
  return `${header}\n${kindNote}\n\n${DECOMPOSE_SCHEMA_HINT}\n\n--- SOURCE START ---\n${options.sourceText.trimEnd()}\n--- SOURCE END ---\n`;
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  return m ? m[1]!.trim() : t;
}

export function parseDecompositionResponse(text: string): {
  summary: string;
  remainingIdentityBody: string;
  suggestions: ModuleSuggestion[];
} {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(text));
  } catch (exc) {
    throw new ValidationError(`decompose: invalid JSON from LLM: ${String(exc)}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ValidationError("decompose: LLM response must be a JSON object");
  }
  const obj = data as Record<string, unknown>;
  const summary = String(obj.summary ?? "").trim();
  const remainingIdentityBody = String(obj.remaining_identity_body ?? "").trim();
  const raw = obj.suggestions;
  if (!Array.isArray(raw)) {
    throw new ValidationError("decompose: 'suggestions' must be a list");
  }
  const suggestions: ModuleSuggestion[] = [];
  raw.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new ValidationError(`decompose: suggestions[${i}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const type = row.type;
    if (!["trait", "speech", "role", "output_rules"].includes(String(type))) {
      throw new ValidationError(`decompose: suggestions[${i}].type invalid: ${String(type)}`);
    }
    const name = String(row.name ?? "").trim();
    const body = String(row.body ?? "").trim();
    if (!name || !body) {
      throw new ValidationError(`decompose: suggestions[${i}] requires name and body`);
    }
    let priority: string | undefined;
    if (type === "trait") {
      priority = ["high", "medium", "low"].includes(String(row.priority))
        ? String(row.priority)
        : "medium";
    }
    const conflicts = Array.isArray(row.conflicts)
      ? row.conflicts.map(String)
      : [];
    let mode: string | undefined;
    if (type === "speech") {
      mode = ["prompt", "rewriter"].includes(String(row.mode))
        ? String(row.mode)
        : "prompt";
    }
    suggestions.push({
      type: type as SuggestionType,
      name,
      body,
      rationale: String(row.rationale ?? "").trim(),
      priority,
      conflicts,
      mode,
    });
  });
  return { summary, remainingIdentityBody, suggestions };
}

function safeFilename(name: string): string {
  return (name.trim().replace(/[^A-Za-z0-9_-]+/g, "_") || "Module").slice(0, 64);
}

export function renderSuggestionMarkdown(
  suggestion: ModuleSuggestion,
  options: { source?: string; origin?: string } = {},
): string {
  const lines = ["---", `type: ${suggestion.type}`, `name: ${suggestion.name}`];
  if (suggestion.type === "trait") {
    lines.push(`priority: ${suggestion.priority ?? "medium"}`);
    if (suggestion.conflicts?.length) {
      lines.push(`conflicts: [${suggestion.conflicts.join(", ")}]`);
    }
  }
  if (suggestion.type === "speech" && suggestion.mode) {
    lines.push(`mode: ${suggestion.mode}`);
  }
  if (options.source) {
    lines.push(`source: ${options.source}`);
    lines.push("adaptation: extracted");
  }
  if (options.origin) lines.push(`origin: ${options.origin}`);
  lines.push("---");
  if (suggestion.rationale) {
    lines.push(`<!-- draft rationale: ${suggestion.rationale} -->`);
  }
  lines.push(suggestion.body.trimEnd(), "");
  return lines.join("\n");
}

export function writeDraftModules(
  suggestions: ModuleSuggestion[],
  outDir: string,
  options: {
    source?: string;
    origin?: string;
    remainingIdentityBody?: string;
    identityName?: string;
  } = {},
): string[] {
  mkdirSync(outDir, { recursive: true });
  const paths: string[] = [];
  if (options.remainingIdentityBody?.trim()) {
    const identityName = options.identityName ?? "IdentitySlim";
    const identPath = path.join(outDir, `identity_${safeFilename(identityName)}.md`);
    writeFileSync(
      identPath,
      `---\ntype: identity\nname: ${identityName}\n---\n${options.remainingIdentityBody.trim()}\n`,
      "utf-8",
    );
    paths.push(identPath);
  }
  for (const sug of suggestions) {
    const sub = path.join(outDir, sug.type);
    mkdirSync(sub, { recursive: true });
    const filePath = path.join(sub, `${safeFilename(sug.name)}.md`);
    writeFileSync(
      filePath,
      renderSuggestionMarkdown(sug, {
        source: options.source,
        origin: options.origin,
      }),
      "utf-8",
    );
    paths.push(filePath);
  }
  return paths;
}

export function loadDecomposeSource(filePath: string): {
  text: string;
  kind: "identity" | "skill" | "raw";
  name?: string;
} {
  const text = readFileSync(filePath, "utf-8");
  try {
    const [fm, body] = splitFrontmatter(text);
    if (fm.type === "identity") {
      return {
        text: body.replace(/^\n+/, "").replace(/\n+$/, ""),
        kind: "identity",
        name: String(fm.name ?? path.basename(filePath, path.extname(filePath))),
      };
    }
    return {
      text: body.replace(/^\n+/, "").replace(/\n+$/, "") || text,
      kind: "skill",
      name: String(fm.name ?? path.basename(filePath, path.extname(filePath))),
    };
  } catch {
    return {
      text,
      kind: "raw",
      name: path.basename(filePath, path.extname(filePath)),
    };
  }
}

export async function decompose(
  source: string,
  options: {
    llmCall?: LlmCall;
    llmResponse?: string;
    outDir?: string;
    sourceKind?: "identity" | "skill" | "raw";
    provenance?: string;
    sourceRelpath?: string;
    origin?: string;
    writeDrafts?: boolean;
    /** When true, treat source as file path */
    fromFile?: boolean;
  } = {},
): Promise<DecompositionResult> {
  let sourcePath: string | undefined;
  let text: string;
  let kind: "identity" | "skill" | "raw";
  let name: string | undefined;

  if (options.fromFile !== false && !source.includes("\n") && source.endsWith(".md")) {
    // Heuristic: path-like — prefer explicit fromFile
  }

  if (options.fromFile || (!source.includes("\n") && /\.md$/i.test(source))) {
    try {
      const loaded = loadDecomposeSource(path.resolve(source));
      sourcePath = path.resolve(source);
      text = loaded.text;
      kind = options.sourceKind ?? loaded.kind;
      name = loaded.name;
    } catch {
      text = source;
      kind = options.sourceKind ?? "raw";
    }
  } else {
    text = source;
    kind = options.sourceKind ?? "raw";
  }

  let llmResponse = options.llmResponse;
  if (llmResponse == null) {
    if (!options.llmCall) {
      throw new CompositionError(
        "decompose requires llmCall or llmResponse (composer never calls an LLM itself)",
      );
    }
    const prompt = buildDecomposePrompt({
      sourceText: text,
      sourceKind: kind,
      sourceName: name,
      provenance: options.provenance ?? sourcePath,
    });
    llmResponse = await options.llmCall(prompt);
  }

  const parsed = parseDecompositionResponse(llmResponse);
  let draftPaths: string[] = [];
  const writeDrafts = options.writeDrafts !== false;
  if (writeDrafts && options.outDir) {
    draftPaths = writeDraftModules(parsed.suggestions, options.outDir, {
      source: options.sourceRelpath,
      origin: options.origin,
      remainingIdentityBody: parsed.remainingIdentityBody || undefined,
      identityName: name ?? "IdentitySlim",
    });
  }

  return {
    sourcePath,
    sourceKind: kind,
    summary: parsed.summary,
    remainingIdentityBody: parsed.remainingIdentityBody,
    suggestions: parsed.suggestions,
    draftPaths,
    rawLlmResponse: llmResponse,
  };
}

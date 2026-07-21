/** Rewriter pipeline — apply speech.mode=rewriter modules to model output. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CompositionError, ValidationError } from "./errors.js";
import type { Manifest, Module } from "./models.js";
import { manifestFromDict, renderBody } from "./models.js";
import { parseModule } from "./parse.js";

export type RewriteLlmCall = (
  system: string,
  user: string,
) => string | Promise<string>;

export const DEFAULT_REWRITE_USER_TEMPLATE =
  "Rewrite the following text according to the style instructions. " +
  "Preserve meaning and factual content. Output only the rewritten text.\n\n" +
  "---\n{text}\n---";

export interface RewriteStep {
  moduleName: string;
  modulePath: string;
  output: string;
}

export interface RewriteResult {
  text: string;
  steps: RewriteStep[];
}

function styleBody(module: Module): string {
  const body = renderBody(module).trim();
  if (!body) {
    throw new ValidationError(`rewriter module ${JSON.stringify(module.name)} has an empty body`);
  }
  return body;
}

export async function applyRewriters(
  text: string,
  modules: Module[],
  options: {
    llmCall: RewriteLlmCall;
    userTemplate?: string;
  },
): Promise<RewriteResult> {
  if (!text.trim()) throw new ValidationError("rewrite: input text is empty");
  const template = options.userTemplate ?? DEFAULT_REWRITE_USER_TEMPLATE;
  const rewriters = modules
    .filter((m) => m.type === "speech" && m.mode === "rewriter")
    .sort((a, b) => a.name.localeCompare(b.name));

  let current = text;
  const steps: RewriteStep[] = [];
  for (const mod of rewriters) {
    const system = styleBody(mod);
    const user = template.split("{text}").join(current);
    current = await options.llmCall(system, user);
    if (typeof current !== "string" || !current.trim()) {
      throw new CompositionError(`rewriter ${JSON.stringify(mod.name)} returned an empty response`);
    }
    steps.push({
      moduleName: mod.name,
      modulePath: mod.path,
      output: current,
    });
  }
  return { text: current, steps };
}

export async function applyRewritersFromPaths(
  text: string,
  paths: string[],
  options: {
    llmCall: RewriteLlmCall;
    moduleRoot?: string;
    userTemplate?: string;
  },
): Promise<RewriteResult> {
  const modules = paths.map((p) =>
    parseModule(p, { moduleRoot: options.moduleRoot }),
  );
  if (!modules.some((m) => m.type === "speech" && m.mode === "rewriter")) {
    throw new ValidationError(
      "rewrite: no speech modules with mode=rewriter in the given paths",
    );
  }
  return applyRewriters(text, modules, {
    llmCall: options.llmCall,
    userTemplate: options.userTemplate,
  });
}

function loadManifest(manifest: Manifest | Record<string, unknown> | string): Manifest {
  if (typeof manifest === "string") {
    return manifestFromDict(
      JSON.parse(readFileSync(manifest, "utf-8")) as Record<string, unknown>,
    );
  }
  if ("skeleton_version" in manifest && Array.isArray((manifest as Manifest).modules)) {
    return manifest as Manifest;
  }
  return manifestFromDict(manifest as Record<string, unknown>);
}

export async function applyRewritersFromManifest(
  text: string,
  manifestInput: Manifest | Record<string, unknown> | string,
  options: {
    llmCall: RewriteLlmCall;
    moduleRoot?: string;
    userTemplate?: string;
  },
): Promise<RewriteResult> {
  const manifest = loadManifest(manifestInput);
  const stack = manifest.rewriter_stack ?? [];
  if (!stack.length) {
    return { text, steps: [] };
  }
  const paths: string[] = [];
  for (const entry of stack) {
    let filePath = entry.path;
    if (!existsSync(filePath) && options.moduleRoot) {
      const alt = path.join(options.moduleRoot, entry.path);
      if (existsSync(alt)) filePath = alt;
    }
    if (!existsSync(filePath)) {
      throw new CompositionError(`rewrite: rewriter module not found: ${entry.path}`);
    }
    paths.push(filePath);
  }
  return applyRewritersFromPaths(text, paths, options);
}

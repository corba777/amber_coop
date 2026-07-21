/** Persona Composer — modular Markdown → XML system prompt compiler (TypeScript). */

export { compose, composeFromManifest } from "./compose.js";
export type { CompositionResult, ComposeOptions } from "./compose.js";
export {
  buildDecomposePrompt,
  decompose,
  parseDecompositionResponse,
  writeDraftModules,
} from "./decompose.js";
export type { DecompositionResult, ModuleSuggestion } from "./decompose.js";
export { CompositionError, ValidationError } from "./errors.js";
export {
  DEFAULT_OUTPUT_RULES,
  SKELETON_VERSION,
  skeletonConfig,
  todayLine,
  withTodayLine,
} from "./models.js";
export type {
  Manifest,
  Module,
  ModuleType,
  SkeletonConfig,
} from "./models.js";
export { parseModule, parseModules, splitFrontmatter } from "./parse.js";
export { DEFAULT_REGISTRY, TypeRegistry } from "./registry.js";
export { renderPrompt } from "./render.js";
export {
  applyRewriters,
  applyRewritersFromManifest,
  applyRewritersFromPaths,
} from "./rewriter.js";
export type { RewriteResult } from "./rewriter.js";

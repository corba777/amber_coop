import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyRewritersFromManifest,
  compose,
  decompose,
  parseDecompositionResponse,
} from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULES = path.resolve(HERE, "../../tests/fixtures/modules");

const SAMPLE = {
  summary: "Split",
  remaining_identity_body: "You are the gate guard.",
  suggestions: [
    {
      type: "trait",
      name: "Territorial",
      priority: "high",
      body: "Defend the gate.",
      rationale: "stance",
    },
    {
      type: "speech",
      name: "Curt",
      mode: "prompt",
      body: "Short sentences.",
    },
  ],
};

describe("decompose + rewriter", () => {
  it("parses decomposition JSON", () => {
    const parsed = parseDecompositionResponse(JSON.stringify(SAMPLE));
    expect(parsed.suggestions).toHaveLength(2);
  });

  it("writes drafts from llmResponse", async () => {
    const outDir = path.join(HERE, ".tmp-drafts");
    const result = await decompose(path.join(MODULES, "identity/guard.md"), {
      llmResponse: JSON.stringify(SAMPLE),
      outDir,
      fromFile: true,
    });
    expect(result.suggestions).toHaveLength(2);
    expect(result.draftPaths.length).toBeGreaterThan(0);
  });

  it("applies rewriter_stack from manifest", async () => {
    const composed = compose(
      path.join(MODULES, "identity/guard.md"),
      [path.join(MODULES, "speech/fancy_rewriter.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES },
    );
    expect(composed.manifest.rewriter_stack).toHaveLength(1);
    const rewritten = await applyRewritersFromManifest(
      "Hello",
      composed.manifest,
      {
        llmCall: async (_s, u) => `STYLED:${u}`,
        moduleRoot: MODULES,
      },
    );
    expect(rewritten.text).toContain("STYLED:");
    expect(rewritten.steps).toHaveLength(1);
  });

  it("noop when rewriter_stack empty", async () => {
    const composed = compose(path.join(MODULES, "identity/guard.md"), [], {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
    });
    const out = await applyRewritersFromManifest("same", composed.manifest, {
      llmCall: async () => "nope",
      moduleRoot: MODULES,
    });
    expect(out.text).toBe("same");
  });
});

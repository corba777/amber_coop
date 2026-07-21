import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  compose,
  composeFromManifest,
  CompositionError,
  DEFAULT_OUTPUT_RULES,
} from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "../../tests/fixtures");
const MODULES = path.join(FIXTURES, "modules");
const GOLDEN = path.join(FIXTURES, "golden", "full_prompt.xml");
const FIXED_TS = "2026-07-20T15:00:00+00:00";

const identity = path.join(MODULES, "identity", "guard.md");

describe("compose", () => {
  it("identity alone yields valid XML with dated output_rules", () => {
    const result = compose(identity, [], {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
      timestamp: FIXED_TS,
    });
    expect(result.promptXml).toContain("<identity");
    expect(result.promptXml).toContain("<precedence>");
    expect(result.promptXml).toContain("<output_rules>");
    expect(result.promptXml).toContain("Today is 2026-07-20;");
    expect(result.manifest.skeleton_version).toBe("3");
    expect(result.manifest.modules).toHaveLength(1);
  });

  it("matches golden full composition", () => {
    const extras = [
      path.join(MODULES, "speech", "curt.md"),
      path.join(MODULES, "roles", "gatekeeper.md"),
      path.join(MODULES, "traits", "territorial.md"),
      path.join(MODULES, "traits", "cautious.md"),
      path.join(MODULES, "relationships", "ally_bob.md"),
      path.join(MODULES, "output_rules", "default.md"),
    ];
    const result = compose(identity, extras, {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
      timestamp: FIXED_TS,
    });
    const expected = readFileSync(GOLDEN, "utf-8");
    expect(result.promptXml).toBe(expected);
    expect(result.manifest.conflict_rules).toHaveLength(1);
    expect(result.manifest.conflict_rules[0]!.winner).toBe("Territorial");
  });

  it("uses output_rules module", () => {
    const result = compose(
      identity,
      [path.join(MODULES, "output_rules", "concise.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES, timestamp: FIXED_TS },
    );
    expect(result.promptXml).toContain('<output_rules name="Concise">');
    expect(result.promptXml).toContain("Today is 2026-07-20;");
    expect(result.promptXml).toContain("fewest words");
  });

  it("falls back to skeleton output_rules", () => {
    const result = compose(identity, [], {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
      timestamp: FIXED_TS,
      skeleton: { output_rules: DEFAULT_OUTPUT_RULES },
    });
    expect(result.promptXml).toContain("<output_rules>");
    expect(result.promptXml).toContain("Today is 2026-07-20;");
    expect(result.promptXml).toContain(DEFAULT_OUTPUT_RULES);
  });

  it("excludes rewriter speech from prompt", () => {
    const result = compose(
      identity,
      [path.join(MODULES, "speech", "fancy_rewriter.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES, timestamp: FIXED_TS },
    );
    expect(result.promptXml).not.toContain("Victorian");
    expect(result.manifest.rewriter_stack).toHaveLength(1);
    expect(result.manifest.rewriter_stack[0]!.name).toBe("FancyRewriter");
  });

  it("vendors as-is speech", () => {
    const result = compose(
      identity,
      [path.join(MODULES, "speech", "caveman.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES, timestamp: FIXED_TS },
    );
    expect(result.promptXml).toContain("Speak like cave person");
    expect(result.promptXml).toContain("imported skill");
  });

  it("round-trips compose_from_manifest", () => {
    const result = compose(
      identity,
      [
        path.join(MODULES, "traits", "territorial.md"),
        path.join(MODULES, "traits", "cautious.md"),
      ],
      { moduleRoot: MODULES, libraryRoot: MODULES, timestamp: FIXED_TS },
    );
    const again = composeFromManifest(result.manifest, {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
      timestamp: FIXED_TS,
    });
    expect(again.promptXml).toBe(result.promptXml);
  });

  it("detects hash mismatch", () => {
    const result = compose(identity, [], {
      moduleRoot: MODULES,
      libraryRoot: MODULES,
      timestamp: FIXED_TS,
    });
    const data = structuredClone(result.manifest);
    data.modules[0]!.hash = "deadbeef0000";
    expect(() =>
      composeFromManifest(data, { moduleRoot: MODULES }),
    ).toThrow(CompositionError);
  });
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { compose, ValidationError } from "../src/index.js";
import { parseModule } from "../src/parse.js";
import { validateModules } from "../src/validate.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULES = path.resolve(HERE, "../../tests/fixtures/modules");

describe("validation", () => {
  it("rejects non-identity as identity arg", () => {
    const trait = parseModule(path.join(MODULES, "traits", "territorial.md"), {
      moduleRoot: MODULES,
    });
    expect(() => compose(trait, [], { moduleRoot: MODULES })).toThrow(
      ValidationError,
    );
  });

  it("rejects missing identity in validateModules", () => {
    const trait = parseModule(path.join(MODULES, "traits", "territorial.md"), {
      moduleRoot: MODULES,
    });
    expect(() => validateModules([trait])).toThrow(/no identity/);
  });

  it("rejects two identities", () => {
    expect(() =>
      compose(path.join(MODULES, "identity", "twin_a.md"), [
        path.join(MODULES, "identity", "twin_b.md"),
      ], { moduleRoot: MODULES, libraryRoot: MODULES }),
    ).toThrow(/more than one identity/);
  });

  it("rejects unknown type", () => {
    expect(() =>
      parseModule(path.join(MODULES, "bad", "unknown_type.md")),
    ).toThrow(/unknown type/);
  });

  it("rejects equal-priority mutual conflict", () => {
    expect(() =>
      compose(
        path.join(MODULES, "identity", "guard.md"),
        [
          path.join(MODULES, "traits", "stubborn.md"),
          path.join(MODULES, "traits", "flexible.md"),
        ],
        { moduleRoot: MODULES, libraryRoot: MODULES },
      ),
    ).toThrow(/equal priority/);
  });

  it("warns on one-sided conflict without generating rule", () => {
    const result = compose(
      path.join(MODULES, "identity", "guard.md"),
      [
        path.join(MODULES, "traits", "territorial.md"),
        path.join(MODULES, "traits", "one_sided.md"),
      ],
      { moduleRoot: MODULES, libraryRoot: MODULES },
    );
    expect(result.manifest.conflict_rules).toEqual([]);
    expect(
      result.manifest.warnings.some((w) => w.includes("incomplete conflict")),
    ).toBe(true);
  });

  it("warns on unknown conflict name in library", () => {
    const result = compose(
      path.join(MODULES, "identity", "guard.md"),
      [path.join(MODULES, "traits", "typo_conflict.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES },
    );
    expect(
      result.manifest.warnings.some((w) => w.includes("DoesNotExist")),
    ).toBe(true);
  });

  it("does not warn when conflict partner exists but is inactive", () => {
    const result = compose(
      path.join(MODULES, "identity", "guard.md"),
      [path.join(MODULES, "traits", "territorial.md")],
      { moduleRoot: MODULES, libraryRoot: MODULES },
    );
    expect(result.manifest.conflict_rules).toEqual([]);
    expect(
      result.manifest.warnings.some(
        (w) => w.includes("Cautious") && w.includes("unknown"),
      ),
    ).toBe(false);
  });

  it("rejects relationship without agent/status", () => {
    expect(() =>
      parseModule(path.join(MODULES, "relationships", "broken.md")),
    ).toThrow(/agent|status/);
  });
});

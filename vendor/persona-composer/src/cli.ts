#!/usr/bin/env node
/** CLI for persona-compose (TypeScript). */

import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { compose, composeFromManifest } from "./compose.js";
import { CompositionError } from "./errors.js";
import type { SkeletonConfig } from "./models.js";

function usage(): never {
  console.error(`Usage:
  persona-compose compose --identity <path> [--module-root <dir>] [--out <file>] [--manifest <file>] [--output-rules <text>] [modules...]
  persona-compose recompose <manifest.json> [--module-root <dir>] [--out <file>] [--manifest <file>] [--no-verify-hashes] [--output-rules <text>]`);
  process.exit(2);
}

function takeFlag(args: string[], name: string): string | undefined {
  const ix = args.indexOf(name);
  if (ix === -1) return undefined;
  const val = args[ix + 1];
  if (!val || val.startsWith("-")) usage();
  args.splice(ix, 2);
  return val;
}

function hasFlag(args: string[], name: string): boolean {
  const ix = args.indexOf(name);
  if (ix === -1) return false;
  args.splice(ix, 1);
  return true;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  if (!argv.length) usage();
  const args = [...argv];
  const command = args.shift();

  const outPath = takeFlag(args, "--out");
  const manifestOut = takeFlag(args, "--manifest");
  const moduleRoot = takeFlag(args, "--module-root");
  const outputRules = takeFlag(args, "--output-rules");
  const skeleton: SkeletonConfig | undefined = outputRules
    ? { output_rules: outputRules }
    : undefined;

  try {
    let result;
    if (command === "compose") {
      const identity = takeFlag(args, "--identity");
      if (!identity) {
        console.error("error: --identity is required");
        return 1;
      }
      result = compose(identity, args, {
        skeleton,
        moduleRoot,
        libraryRoot: moduleRoot,
      });
    } else if (command === "recompose") {
      const noVerify = hasFlag(args, "--no-verify-hashes");
      const manifestIn = args.shift();
      if (!manifestIn) usage();
      result = composeFromManifest(path.resolve(manifestIn), {
        skeleton,
        moduleRoot,
        libraryRoot: moduleRoot,
        verifyHashes: !noVerify,
      });
    } else {
      usage();
    }

    if (outPath) writeFileSync(outPath, result.promptXml, "utf-8");
    else process.stdout.write(result.promptXml);

    if (manifestOut) {
      writeFileSync(manifestOut, result.manifestJson(), "utf-8");
    }
    for (const w of result.manifest.warnings) {
      console.error(`warning: ${w}`);
    }
    return 0;
  } catch (exc) {
    if (exc instanceof CompositionError) {
      console.error(`error: ${exc.message}`);
      return 1;
    }
    throw exc;
  }
}

const isDirectRun =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  process.exit(main());
}

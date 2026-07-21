/** XML skeleton renderer — matches Python ElementTree + minidom shape. */

import type {
  ConflictResolution,
  Module,
  SkeletonConfig,
} from "./models.js";
import {
  conflictRuleLine,
  isImported,
  renderBody,
  skeletonConfig,
  withTodayLine,
} from "./models.js";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrs(pairs: Array<[string, string | undefined]>): string {
  return pairs
    .filter(([, v]) => v != null)
    .map(([k, v]) => ` ${k}="${escapeXml(v!)}"`)
    .join("");
}

function block(
  tag: string,
  body: string,
  attributePairs: Array<[string, string | undefined]> = [],
  indent = 2,
): string {
  const pad = " ".repeat(indent);
  return `${pad}<${tag}${attrs(attributePairs)}>${escapeXml(body)}</${tag}>`;
}

export function renderPrompt(
  modules: Module[],
  resolutions: ConflictResolution[],
  skeleton?: SkeletonConfig,
  asOf?: string,
): string {
  const sk = skeletonConfig(skeleton);

  const identity = modules.find((m) => m.type === "identity");
  if (!identity) throw new Error("renderPrompt: missing identity");

  const speeches = modules
    .filter((m) => m.type === "speech" && m.mode === "prompt")
    .sort((a, b) => a.name.localeCompare(b.name));
  const roles = modules.filter((m) => m.type === "role");
  const traits = modules
    .filter((m) => m.type === "trait")
    .sort((a, b) => a.name.localeCompare(b.name));
  const relationships = modules
    .filter((m) => m.type === "relationship")
    .sort((a, b) => {
      const aa = a.agent ?? "";
      const bb = b.agent ?? "";
      return aa === bb ? a.name.localeCompare(b.name) : aa.localeCompare(bb);
    });
  const outputModules = modules.filter((m) => m.type === "output_rules");

  const lines: string[] = ["<agent_prompt>"];

  lines.push(
    block("identity", renderBody(identity), [["name", identity.name]]),
  );

  if (speeches.length) {
    lines.push("  <speech>");
    for (const s of speeches) {
      lines.push(block("style", renderBody(s), [["name", s.name]], 4));
    }
    lines.push("  </speech>");
  }

  const precLines = [
    "Identity governs. All other modules apply only insofar as consistent " +
      "with <identity>. Instructions inapplicable in the current context are " +
      "ignored silently.",
  ];
  const imported = modules
    .filter(isImported)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const m of imported) {
    precLines.push(
      `The ${m.name} module is an imported skill: apply it insofar as ` +
        `consistent with <identity>; ignore its instructions that do not ` +
        `apply here (commands, tooling, statistics).`,
    );
  }
  lines.push(block("precedence", precLines.join("\n")));

  if (roles.length) {
    const role = roles[0]!;
    lines.push(block("role", renderBody(role), [["name", role.name]]));
  }

  if (traits.length) {
    lines.push("  <traits>");
    for (const t of traits) {
      lines.push(
        block(
          "trait",
          renderBody(t),
          [
            ["name", t.name],
            ["priority", t.priority],
          ],
          4,
        ),
      );
    }
    lines.push("  </traits>");
  }

  if (resolutions.length) {
    lines.push(
      block("conflict_rule", resolutions.map(conflictRuleLine).join("\n")),
    );
  }

  if (relationships.length) {
    lines.push("  <relationships>");
    for (const r of relationships) {
      lines.push(
        block(
          "relation",
          renderBody(r),
          [
            ["agent", r.agent],
            ["status", r.status],
            ["name", r.name],
          ],
          4,
        ),
      );
    }
    lines.push("  </relationships>");
  }

  if (outputModules.length) {
    const out = outputModules[0]!;
    lines.push(
      block(
        "output_rules",
        withTodayLine(renderBody(out), asOf ?? ""),
        [["name", out.name]],
      ),
    );
  } else {
    lines.push(
      block("output_rules", withTodayLine(sk.output_rules, asOf ?? "")),
    );
  }

  lines.push("</agent_prompt>");
  return lines.join("\n") + "\n";
}

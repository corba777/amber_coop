/* =========================================================================
 *  LLM providers — one interface, four backends, chosen at runtime from the
 *  in-game menu. Models and API keys come from a .env file / environment;
 *  keys never leave the server.
 * ========================================================================= */

import fs from "node:fs";

export type ProviderName = "ollama" | "openai" | "anthropic" | "mock";

export interface LLM {
  name: string;
  /** send a system prompt + user message, get raw text back */
  chat(system: string, user: string): Promise<string>;
}

export interface LLMConfig {
  ollamaUrl: string;
  ollamaModel: string;
  openaiKey: string;
  openaiModel: string;
  anthropicKey: string;
  anthropicModel: string;
  timeoutMs: number;
}

/** minimal .env loader: KEY=VALUE lines, # comments, no override of real env */
export function loadDotEnv(path = ".env"): void {
  try {
    const text = fs.readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* no .env file — that's fine */ }
}

export function configFromEnv(): LLMConfig {
  return {
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || process.env.LLM_MODEL || "llama3.1",
    openaiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 8000),
  };
}

/** what the menu is allowed to show (labels only — no secrets) */
export function providerCatalog(cfg: LLMConfig): Record<string, { ok: boolean; label: string; hint: string }> {
  return {
    ollama: { ok: true, label: `Ollama · ${cfg.ollamaModel}`, hint: cfg.ollamaUrl },
    anthropic: {
      ok: cfg.anthropicKey.length > 0,
      label: `Anthropic · ${cfg.anthropicModel}`,
      hint: cfg.anthropicKey ? "key loaded" : "no ANTHROPIC_API_KEY in .env",
    },
    openai: {
      ok: cfg.openaiKey.length > 0,
      label: `OpenAI · ${cfg.openaiModel}`,
      hint: cfg.openaiKey ? "key loaded" : "no OPENAI_API_KEY in .env",
    },
  };
}

async function post(url: string, headers: Record<string, string>,
                    body: unknown, timeoutMs: number): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${url} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function ollama(cfg: LLMConfig): LLM {
  return {
    name: `ollama/${cfg.ollamaModel}`,
    async chat(system, user) {
      const data = await post(`${cfg.ollamaUrl}/api/chat`, {}, {
        model: cfg.ollamaModel,
        stream: false,
        format: "json",
        options: { temperature: 0.6, num_predict: 200 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }, cfg.timeoutMs) as { message?: { content?: string } };
      return data.message?.content ?? "";
    },
  };
}

function openai(cfg: LLMConfig): LLM {
  return {
    name: `openai/${cfg.openaiModel}`,
    async chat(system, user) {
      const data = await post("https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${cfg.openaiKey}` }, {
          model: cfg.openaiModel,
          max_tokens: 200,
          temperature: 0.6,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }, cfg.timeoutMs) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

function anthropic(cfg: LLMConfig): LLM {
  return {
    name: `anthropic/${cfg.anthropicModel}`,
    async chat(system, user) {
      const data = await post("https://api.anthropic.com/v1/messages", {
        "x-api-key": cfg.anthropicKey,
        "anthropic-version": "2023-06-01",
      }, {
        model: cfg.anthropicModel,
        max_tokens: 200,
        temperature: 0.6,
        system,
        messages: [{ role: "user", content: user }],
      }, cfg.timeoutMs) as { content?: { type: string; text?: string }[] };
      return (data.content ?? [])
        .filter(b => b.type === "text")
        .map(b => b.text ?? "")
        .join("");
    },
  };
}

/** Deterministic heuristic stand-in — used for tests and as a fallback. */
export function mock(): LLM {
  return {
    name: "mock/heuristic",
    async chat(_system, user) {
      try {
        const obs = JSON.parse(user.slice(user.indexOf("{"))) as {
          enemies?: { i: number; hp: number; d: number }[];
          pickups?: { i: number; kind: string; d: number }[];
          me?: { hp: number; maxHp: number };
        };
        const me = obs.me ?? { hp: 6, maxHp: 6 };
        const hearts = (obs.pickups ?? []).filter(p => p.kind === "heart");
        if (me.hp <= 2 && hearts.length > 0) {
          return JSON.stringify({ action: "pickup", target: hearts[0].i, say: "Need a heart!" });
        }
        const foes = (obs.enemies ?? []).slice().sort((a, b) => a.d - b.d);
        if (foes.length > 0) {
          return JSON.stringify({ action: "attack", target: foes[0].i, say: "On it!" });
        }
        const items = obs.pickups ?? [];
        if (items.length > 0) {
          return JSON.stringify({ action: "pickup", target: items[0].i });
        }
        return JSON.stringify({ action: "follow", say: "Right behind you" });
      } catch {
        return JSON.stringify({ action: "follow" });
      }
    },
  };
}

export function makeLLM(provider: ProviderName, cfg: LLMConfig): LLM {
  switch (provider) {
    case "ollama": return ollama(cfg);
    case "openai": return openai(cfg);
    case "anthropic": return anthropic(cfg);
    default: return mock();
  }
}

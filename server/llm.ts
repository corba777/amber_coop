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

/** How much of an API error body we keep in Error.message / PlanRecord.err.
 *  OpenAI 429s put Limit/Used/RPM|TPM after ~200 chars — keep enough to diagnose. */
export const LLM_ERR_LOG_CHARS = 500;

/** Planner completion budget. aloneBleedFate + relationshipMemory bloat the
 *  observation; 200 truncated Haiku mid-JSON in BT9J bleed windows. Override
 *  with LLM_PLAN_MAX_TOKENS. Restricted OpenAI reasoning models keep a wider cap. */
export const LLM_PLAN_MAX_TOKENS = Math.max(
  256, Number(process.env.LLM_PLAN_MAX_TOKENS || 512) || 512);
/** Reasoning families burn tokens on CoT before JSON — keep a higher floor. */
export const LLM_PLAN_MAX_TOKENS_REASONING = Math.max(
  LLM_PLAN_MAX_TOKENS, Number(process.env.LLM_PLAN_MAX_TOKENS_REASONING || 1000) || 1000);

/** Thrown on non-2xx LLM HTTP — status kept so callers can classify. */
export class LlmHttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`${url} → ${status}: ${body.slice(0, LLM_ERR_LOG_CHARS)}`);
    this.name = "LlmHttpError";
  }
}

export type ProviderFailKind = "rate_limit" | "credits" | "auth" | "other";

/** Classify provider/API failures for farm abort + retry policy. */
export function classifyProviderFail(err: unknown): {
  kind: ProviderFailKind;
  /** Hard stop: no point retrying the farm (billing / bad key). */
  fatal: boolean;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof LlmHttpError
    ? err.status
    : Number(message.match(/→\s*(\d{3}):/)?.[1] || 0);
  const lower = message.toLowerCase();
  if (status === 429 || /rate.?limit|too many requests/.test(lower)) {
    return { kind: "rate_limit", fatal: false, message };
  }
  if (
    status === 401 || status === 403 ||
    /invalid.?api.?key|authentication|unauthorized|forbidden/.test(lower)
  ) {
    return { kind: "auth", fatal: true, message };
  }
  // Anthropic returns 400 with "credit balance is too low" — not always 402.
  if (
    status === 402 ||
    /credit balance is too low|insufficient.?credits?|billing|payment.?required|purchase credits/.test(lower)
  ) {
    return { kind: "credits", fatal: true, message };
  }
  return { kind: "other", fatal: false, message };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
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
      throw new LlmHttpError(url, res.status, text);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST with exponential backoff on 429. Credits/auth fail immediately (no retry).
 * Env: LLM_RETRY_MAX (default 4), LLM_RETRY_BASE_MS (default 1000, cap 30s).
 */
async function postWithRetry(
  url: string, headers: Record<string, string>,
  body: unknown, timeoutMs: number,
): Promise<unknown> {
  const maxAttempts = Math.max(1, Number(process.env.LLM_RETRY_MAX || 4));
  const baseMs = Math.max(100, Number(process.env.LLM_RETRY_BASE_MS || 1000));
  let last: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await post(url, headers, body, timeoutMs);
    } catch (e) {
      last = e;
      const c = classifyProviderFail(e);
      if (c.fatal) throw e;
      if (c.kind !== "rate_limit" || i >= maxAttempts - 1) throw e;
      const wait = Math.min(30_000, baseMs * (2 ** i));
      await sleep(wait);
    }
  }
  throw last;
}

/**
 * Ollama chat body for the planner. Thinking models (Qwen3, …) default to
 * filling `message.thinking` and often leave `message.content` empty when
 * `num_predict` is small — every plan then parse-fails into a silent `follow`.
 * Planner turns need the JSON intent, not a CoT trace → `think: false`.
 */
export function ollamaChatBody(
  model: string,
  system: string,
  user: string,
): Record<string, unknown> {
  return {
    model,
    stream: false,
    format: "json",
    think: false,
    options: { temperature: 0.6, num_predict: LLM_PLAN_MAX_TOKENS },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

function ollama(cfg: LLMConfig): LLM {
  return {
    name: `ollama/${cfg.ollamaModel}`,
    async chat(system, user) {
      const data = await post(
        `${cfg.ollamaUrl}/api/chat`, {},
        ollamaChatBody(cfg.ollamaModel, system, user),
        cfg.timeoutMs,
      ) as { message?: { content?: string } };
      return data.message?.content ?? "";
    },
  };
}

/**
 * GPT-5 / o-series reasoning models reject the legacy `max_tokens` field (they
 * want `max_completion_tokens`) and only accept the default temperature. Sending
 * the classic params 400s every call, so the agent falls back to a silent
 * `follow` — the "walks but never speaks" symptom. Detect the family by name and
 * budget extra completion tokens (reasoning tokens count against the cap).
 */
export function openaiRestrictedParams(model: string): boolean {
  return /^(o[0-9]|gpt-5|gpt-6)/i.test(model);
}

function openai(cfg: LLMConfig): LLM {
  const restricted = openaiRestrictedParams(cfg.openaiModel);
  return {
    name: `openai/${cfg.openaiModel}`,
    async chat(system, user) {
      const body: Record<string, unknown> = {
        model: cfg.openaiModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };
      if (restricted) {
        // reasoning families: new token field, no custom temperature, wider cap
        body.max_completion_tokens = LLM_PLAN_MAX_TOKENS_REASONING;
      } else {
        body.max_tokens = LLM_PLAN_MAX_TOKENS;
        body.temperature = 0.6;
      }
      const data = await postWithRetry("https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${cfg.openaiKey}` }, body,
        cfg.timeoutMs) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

function anthropic(cfg: LLMConfig): LLM {
  return {
    name: `anthropic/${cfg.anthropicModel}`,
    async chat(system, user) {
      const data = await postWithRetry("https://api.anthropic.com/v1/messages", {
        "x-api-key": cfg.anthropicKey,
        "anthropic-version": "2023-06-01",
      }, {
        model: cfg.anthropicModel,
        max_tokens: LLM_PLAN_MAX_TOKENS,
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
          icePuzzle?: { legalFirstDirs?: string[]; target?: [number, number] };
        };
        if (obs.icePuzzle?.legalFirstDirs?.includes("up")) {
          return JSON.stringify({
            action: "follow",
            icePlan: ["up"],
            why: "skate north across the rink",
          });
        }
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

/**
 * Headless farm watchdog: credits/auth → exit immediately; sustained 429 → exit
 * after BENCH_ABORT_AFTER_429 consecutive fails (default 20). Disable with
 * BENCH_ABORT_ON_FATAL=0. Inject `exitFn` in tests so process.exit is not called.
 */
export class BenchApiGuard {
  consecutiveRateLimit = 0;
  readonly abortAfter429: number;
  readonly enabled: boolean;
  readonly exitFn: (code: number) => void;

  constructor(opts?: {
    abortAfter429?: number;
    enabled?: boolean;
    exitFn?: (code: number) => void;
  }) {
    const envAbort = process.env.BENCH_ABORT_ON_FATAL;
    this.enabled = opts?.enabled ?? (
      envAbort === undefined || envAbort === "" || envAbort === "1" || envAbort === "true"
    );
    this.abortAfter429 = opts?.abortAfter429
      ?? Math.max(1, Number(process.env.BENCH_ABORT_AFTER_429 || 20));
    this.exitFn = opts?.exitFn ?? ((code: number) => process.exit(code));
  }

  /** Inspect a plan record; may abort the process. Returns fail kind or null. */
  notePlan(rec: { ok: boolean; err?: string }): ProviderFailKind | null {
    if (!this.enabled) return null;
    if (rec.ok || !rec.err) {
      this.consecutiveRateLimit = 0;
      return null;
    }
    const c = classifyProviderFail(rec.err);
    if (c.fatal) {
      console.error(
        `\nBENCH ABORT — fatal provider (${c.kind}): ${c.message.slice(0, 240)}`,
      );
      this.exitFn(78);
      return c.kind;
    }
    if (c.kind === "rate_limit") {
      this.consecutiveRateLimit++;
      if (this.consecutiveRateLimit >= this.abortAfter429) {
        console.error(
          `\nBENCH ABORT — ${this.consecutiveRateLimit} consecutive rate-limits ` +
          `(set BENCH_ABORT_AFTER_429 / LLM_RETRY_* to tune)`,
        );
        this.exitFn(78);
      }
      return c.kind;
    }
    this.consecutiveRateLimit = 0;
    return c.kind;
  }
}

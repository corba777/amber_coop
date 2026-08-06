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
  /** Allowlist for menu / setup (first entry = default when singular unset). */
  ollamaModels: string[];
  openaiKey: string;
  openaiModel: string;
  openaiModels: string[];
  anthropicKey: string;
  anthropicModel: string;
  anthropicModels: string[];
  timeoutMs: number;
}

/**
 * Comma-separated model allowlist from env.
 * `singular` (e.g. ANTHROPIC_MODEL) becomes the default: moved to front if listed,
 * or prepended if the list omits it. Empty list → `[singular]`.
 */
export function parseModelList(listEnv: string | undefined, singular: string): string[] {
  const parts = (listEnv || "").split(",").map(s => s.trim()).filter(Boolean);
  const fallback = singular.trim() || "unknown";
  if (parts.length === 0) return [fallback];
  const uniq: string[] = [];
  for (const p of parts) if (!uniq.includes(p)) uniq.push(p);
  if (!uniq.includes(fallback)) return [fallback, ...uniq];
  if (uniq[0] === fallback) return uniq;
  return [fallback, ...uniq.filter(m => m !== fallback)];
}

export function configFromEnv(): LLMConfig {
  const ollamaModel = process.env.OLLAMA_MODEL || process.env.LLM_MODEL || "llama3.1";
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const anthropicModel = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  return {
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    ollamaModel,
    ollamaModels: parseModelList(process.env.OLLAMA_MODELS, ollamaModel),
    openaiKey: process.env.OPENAI_API_KEY || "",
    openaiModel,
    openaiModels: parseModelList(process.env.OPENAI_MODELS, openaiModel),
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel,
    anthropicModels: parseModelList(process.env.ANTHROPIC_MODELS, anthropicModel),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 8000),
  };
}

export interface ProviderCatalogEntry {
  ok: boolean;
  /** Provider brand for the menu (model names live in `models`). */
  label: string;
  hint: string;
  models: string[];
  defaultModel: string;
}

/** what the menu is allowed to show (labels only — no secrets) */
export function providerCatalog(cfg: LLMConfig): Record<string, ProviderCatalogEntry> {
  return {
    ollama: {
      ok: true,
      label: "Ollama",
      hint: cfg.ollamaUrl,
      models: cfg.ollamaModels,
      defaultModel: cfg.ollamaModel,
    },
    anthropic: {
      ok: cfg.anthropicKey.length > 0,
      label: "Anthropic",
      hint: cfg.anthropicKey ? "key loaded" : "no ANTHROPIC_API_KEY in .env",
      models: cfg.anthropicModels,
      defaultModel: cfg.anthropicModel,
    },
    openai: {
      ok: cfg.openaiKey.length > 0,
      label: "OpenAI",
      hint: cfg.openaiKey ? "key loaded" : "no OPENAI_API_KEY in .env",
      models: cfg.openaiModels,
      defaultModel: cfg.openaiModel,
    },
  };
}

/** Allowlisted models for a provider (empty for mock). */
export function modelsForProvider(provider: ProviderName, cfg: LLMConfig): string[] {
  if (provider === "ollama") return cfg.ollamaModels;
  if (provider === "openai") return cfg.openaiModels;
  if (provider === "anthropic") return cfg.anthropicModels;
  return [];
}

/**
 * Resolve a setup model against the allowlist. Missing model → provider default.
 * Unknown model → null (setup must reject).
 */
export function resolveProviderModel(
  provider: ProviderName,
  cfg: LLMConfig,
  model?: string | null,
): string | null {
  if (provider === "mock") return "mock";
  const allow = modelsForProvider(provider, cfg);
  const pick = (model && model.trim()) || (
    provider === "ollama" ? cfg.ollamaModel
      : provider === "openai" ? cfg.openaiModel
        : cfg.anthropicModel
  );
  return allow.includes(pick) ? pick : null;
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

/**
 * Claude Sonnet 5 / Opus 5 / Opus 4.7+ / Fable 5 / Mythos 5 reject non-default
 * `temperature` / `top_p` / `top_k` (HTTP 400). Sonnet/Opus 5 turn adaptive
 * thinking ON by default — that burns `max_tokens` on CoT before any JSON, so
 * the planner truncates mid-intent (same silent-follow failure mode as OpenAI).
 * Haiku 4.5 and earlier Sonnets still take temperature=0.6.
 */
export function anthropicRestrictedSampling(model: string): boolean {
  return /claude-(sonnet-5|opus-5|opus-4-[7-9]|fable-5|mythos-5)\b/i.test(model);
}

/**
 * Fable 5 / Mythos 5: adaptive thinking is ALWAYS on — both
 * `thinking: {type:"disabled"}` and `{type:"enabled", budget_tokens}` 400
 * (ZRG8: every slot-0 plan died; Luna fought a controller puppet). Omit the
 * thinking field; steer depth with `output_config.effort` instead.
 */
export function anthropicAlwaysOnThinking(model: string): boolean {
  return /claude-(fable-5|mythos-5)\b/i.test(model);
}

/** Pure body builder — tested; used by the Anthropic provider. */
export function anthropicMessagesBody(
  model: string, system: string, user: string,
): Record<string, unknown> {
  const restricted = anthropicRestrictedSampling(model);
  const alwaysOn = anthropicAlwaysOnThinking(model);
  // Always-on adaptive CoT shares max_tokens with the JSON intent — leave headroom.
  const maxTokens = alwaysOn
    ? Math.max(LLM_PLAN_MAX_TOKENS_REASONING, 2048)
    : (restricted ? LLM_PLAN_MAX_TOKENS_REASONING : LLM_PLAN_MAX_TOKENS);
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (restricted) {
    if (alwaysOn) {
      // Omit thinking entirely (disabled/enabled both 400). Low effort keeps
      // adaptive CoT from eating the whole budget before the intent JSON.
      body.output_config = { effort: "low" };
    } else {
      body.thinking = { type: "disabled" };
    }
  } else {
    body.temperature = 0.6;
  }
  return body;
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
      }, anthropicMessagesBody(cfg.anthropicModel, system, user),
        cfg.timeoutMs) as { content?: { type: string; text?: string }[] };
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

export function makeLLM(
  provider: ProviderName,
  cfg: LLMConfig,
  model?: string | null,
): LLM {
  const resolved = resolveProviderModel(provider, cfg, model);
  if (provider !== "mock" && !resolved) {
    // Caller should have validated; fall back to mock rather than hit a bad id.
    return mock();
  }
  const run: LLMConfig = { ...cfg };
  if (provider === "ollama" && resolved) run.ollamaModel = resolved;
  if (provider === "openai" && resolved) run.openaiModel = resolved;
  if (provider === "anthropic" && resolved) run.anthropicModel = resolved;
  switch (provider) {
    case "ollama": return ollama(run);
    case "openai": return openai(run);
    case "anthropic": return anthropic(run);
    default: return mock();
  }
}

/** Why the farm / live session aborted a provider (exit 78 / match stop). */
export interface ApiGuardAbort {
  kind: ProviderFailKind;
  message: string;
  /** process.exit code used by the bench farm */
  code: number;
}

/** Ending stamp for live matches stopped by billing/auth/sustained 429 — not agent data. */
export function providerApiAbortEnding(kind: ProviderFailKind): {
  id: "api-abort";
  title: string;
  lines: string[];
  bg: string;
} {
  const line0 = kind === "credits"
    ? "API credits empty — refill billing, then restart."
    : kind === "auth"
      ? "API auth failed — check keys, then restart."
      : "API rate-limited too long — wait or raise limits, then restart.";
  return {
    id: "api-abort",
    title: "PROVIDER SILENCE",
    lines: [
      line0,
      "This match is not agent data — the partner never planned.",
    ],
    bg: "rgba(28,10,6,0.92)",
  };
}

/**
 * Headless farm + live-session watchdog: credits/auth → abort immediately;
 * sustained 429 → abort after BENCH_ABORT_AFTER_429 consecutive fails (default 20).
 * Bench: Disable with BENCH_ABORT_ON_FATAL=0; `exitFn` defaults to process.exit.
 * Live: Session injects `exitFn` that stamps gameover (LIVE_ABORT_ON_FATAL=0 to disable).
 */
export class BenchApiGuard {
  consecutiveRateLimit = 0;
  /** Set just before `exitFn` when an abort fires — live Session reads this. */
  lastAbort: ApiGuardAbort | null = null;
  readonly abortAfter429: number;
  readonly enabled: boolean;
  readonly exitFn: (code: number) => void;
  /** Log prefix: "BENCH" vs "LIVE" */
  readonly label: string;

  constructor(opts?: {
    abortAfter429?: number;
    enabled?: boolean;
    exitFn?: (code: number) => void;
    label?: string;
    /** Env key for enabled default when `enabled` omitted (`BENCH_ABORT_ON_FATAL` / `LIVE_ABORT_ON_FATAL`). */
    envKey?: string;
  }) {
    const envKey = opts?.envKey ?? "BENCH_ABORT_ON_FATAL";
    const envAbort = process.env[envKey];
    this.enabled = opts?.enabled ?? (
      envAbort === undefined || envAbort === "" || envAbort === "1" || envAbort === "true"
    );
    this.abortAfter429 = opts?.abortAfter429
      ?? Math.max(1, Number(process.env.BENCH_ABORT_AFTER_429 || 20));
    this.exitFn = opts?.exitFn ?? ((code: number) => process.exit(code));
    this.label = opts?.label ?? "BENCH";
  }

  reset(): void {
    this.consecutiveRateLimit = 0;
    this.lastAbort = null;
  }

  /** Inspect a plan record; may abort via exitFn. Returns fail kind or null. */
  notePlan(rec: { ok: boolean; err?: string }): ProviderFailKind | null {
    if (!this.enabled) return null;
    if (rec.ok || !rec.err) {
      this.consecutiveRateLimit = 0;
      return null;
    }
    const c = classifyProviderFail(rec.err);
    if (c.fatal) {
      this.lastAbort = { kind: c.kind, message: c.message, code: 78 };
      console.error(
        `\n${this.label} ABORT — fatal provider (${c.kind}): ${c.message.slice(0, 240)}`,
      );
      this.exitFn(78);
      return c.kind;
    }
    if (c.kind === "rate_limit") {
      this.consecutiveRateLimit++;
      if (this.consecutiveRateLimit >= this.abortAfter429) {
        this.lastAbort = { kind: c.kind, message: c.message, code: 78 };
        console.error(
          `\n${this.label} ABORT — ${this.consecutiveRateLimit} consecutive rate-limits ` +
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

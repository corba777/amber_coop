/* =========================================================================
 *  Google Cloud auth for Vertex AI — service-account JSON or ADC / gcloud.
 *  No google-auth-library dependency (keeps the server fetch-only).
 * ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleCreds =
  | {
      type: "service_account";
      client_email: string;
      private_key: string;
      token_uri?: string;
      project_id?: string;
    }
  | {
      type: "authorized_user";
      client_id: string;
      client_secret: string;
      refresh_token: string;
      quota_project_id?: string;
    };

interface CachedToken {
  accessToken: string;
  /** epoch ms when the token should be refreshed */
  expiresAt: number;
}

let cache: CachedToken | null = null;
let inflight: Promise<string> | null = null;

/** Candidate paths for a service-account / ADC JSON file. */
export function googleCredentialCandidates(): string[] {
  const out: string[] = [];
  const push = (p?: string | null) => {
    if (!p) return;
    const abs = path.isAbsolute(p) ? p : path.resolve(p);
    if (!out.includes(abs)) out.push(abs);
  };
  push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  push(process.env.VERTEX_CREDENTIALS);
  // Preferred names (ADC from gcloud auth application-default login, or SA key)
  push("google_account/application_default_credentials.json");
  push("./google_account/application_default_credentials.json");
  push("google_account/service_account.json");
  push("./google_account/service_account.json");
  // Sibling folder used on this machine: ~/google_account/ (next to amber_coop)
  push("../google_account/application_default_credentials.json");
  // Any *.json in ./google_account (user may name the file freely)
  try {
    const dir = path.resolve("google_account");
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      for (const name of fs.readdirSync(dir).sort()) {
        if (name.endsWith(".json") && !name.startsWith(".")) {
          push(path.join(dir, name));
        }
      }
    }
  } catch { /* ignore */ }
  // gcloud application-default login (host or mounted into the container)
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    push(path.join(home, ".config", "gcloud", "application_default_credentials.json"));
  }
  return out;
}

/** First existing credentials file, or null. */
export function resolveGoogleCredentialsPath(): string | null {
  for (const p of googleCredentialCandidates()) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch { /* keep looking */ }
  }
  return null;
}

export function loadGoogleCredentials(filePath?: string | null): GoogleCreds | null {
  const p = filePath || resolveGoogleCredentialsPath();
  if (!p) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as GoogleCreds;
    if (raw?.type === "service_account" && raw.client_email && raw.private_key) return raw;
    if (raw?.type === "authorized_user" && raw.client_id && raw.client_secret && raw.refresh_token) {
      return raw;
    }
  } catch { /* bad json */ }
  return null;
}

/** True when a credentials file exists or VERTEX_USE_GCLOUD=1 (CLI fallback). */
export function googleAuthConfigured(): boolean {
  if (resolveGoogleCredentialsPath()) return true;
  const g = (process.env.VERTEX_USE_GCLOUD || "").trim().toLowerCase();
  return g === "1" || g === "true" || g === "yes";
}

/**
 * Billing / quota project for user ADC (`x-goog-user-project`).
 * Prefer explicit override, then env, then quota_project_id / project_id from JSON.
 */
export function googleQuotaProject(override?: string | null): string | null {
  const fromArg = (override || "").trim();
  if (fromArg) return fromArg;
  const fromEnv = (
    process.env.VERTEX_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_QUOTA_PROJECT
    || ""
  ).trim();
  if (fromEnv) return fromEnv;
  const creds = loadGoogleCredentials();
  if (!creds) return null;
  if (creds.type === "service_account") return creds.project_id || null;
  return creds.quota_project_id || null;
}

/** Auth headers for Vertex / Google APIs (Bearer + optional quota project). */
export async function googleAuthHeaders(
  quotaProject?: string | null,
): Promise<Record<string, string>> {
  const token = await getGoogleAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const project = googleQuotaProject(quotaProject);
  if (project) headers["x-goog-user-project"] = project;
  return headers;
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signServiceAccountJwt(creds: Extract<GoogleCreds, { type: "service_account" }>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: CLOUD_PLATFORM_SCOPE,
    aud: creds.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(creds.private_key);
  return `${unsigned}.${b64url(sig)}`;
}

async function postForm(url: string, body: Record<string, string>): Promise<{
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({})) as {
    access_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Google token exchange failed: ${detail}`);
  }
  return json;
}

async function tokenFromServiceAccount(
  creds: Extract<GoogleCreds, { type: "service_account" }>,
): Promise<CachedToken> {
  const assertion = signServiceAccountJwt(creds);
  const json = await postForm(creds.token_uri || TOKEN_URL, {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const ttl = Math.max(60, Number(json.expires_in || 3600) - 60);
  return { accessToken: json.access_token!, expiresAt: Date.now() + ttl * 1000 };
}

async function tokenFromAuthorizedUser(
  creds: Extract<GoogleCreds, { type: "authorized_user" }>,
): Promise<CachedToken> {
  const json = await postForm(TOKEN_URL, {
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const ttl = Math.max(60, Number(json.expires_in || 3600) - 60);
  return { accessToken: json.access_token!, expiresAt: Date.now() + ttl * 1000 };
}

async function tokenFromGcloudCli(): Promise<CachedToken> {
  const { stdout } = await execFileAsync("gcloud", ["auth", "print-access-token"], {
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  });
  const accessToken = stdout.trim();
  if (!accessToken) throw new Error("gcloud auth print-access-token returned empty");
  // Access tokens are ~1h; refresh conservatively.
  return { accessToken, expiresAt: Date.now() + 50 * 60 * 1000 };
}

/** Fetch (and cache) a cloud-platform access token. */
export async function getGoogleAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.accessToken;
  if (inflight) return inflight;
  inflight = (async () => {
    const creds = loadGoogleCredentials();
    let next: CachedToken;
    if (creds?.type === "service_account") {
      next = await tokenFromServiceAccount(creds);
    } else if (creds?.type === "authorized_user") {
      next = await tokenFromAuthorizedUser(creds);
    } else {
      const g = (process.env.VERTEX_USE_GCLOUD || "").trim().toLowerCase();
      if (g === "1" || g === "true" || g === "yes") {
        next = await tokenFromGcloudCli();
      } else {
        throw new Error(
          "No Google credentials — place a service_account.json under ./google_account/ " +
          "(or set GOOGLE_APPLICATION_CREDENTIALS), run gcloud auth application-default login, " +
          "or set VERTEX_USE_GCLOUD=1",
        );
      }
    }
    cache = next;
    return next.accessToken;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Test helper — clear cached token between cases. */
export function clearGoogleTokenCache(): void {
  cache = null;
  inflight = null;
}

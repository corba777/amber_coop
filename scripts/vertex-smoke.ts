/* One-shot Vertex Model Garden smoke. Never prints access tokens. */
import { loadDotEnv, configFromEnv, makeLLM } from "../server/llm";
import {
  clearGoogleTokenCache,
  resolveGoogleCredentialsPath,
  loadGoogleCredentials,
} from "../server/google-auth";

async function main(): Promise<void> {
  loadDotEnv();
  clearGoogleTokenCache();
  const cfg = configFromEnv();
  cfg.timeoutMs = Math.max(cfg.timeoutMs, 60_000);

  const credPath = resolveGoogleCredentialsPath();
  const creds = loadGoogleCredentials();
  console.log("auth:", {
    configured: !!credPath,
    type: creds?.type ?? null,
    pathTail: credPath ? credPath.split("/").slice(-3).join("/") : null,
    project: cfg.vertexProject,
    location: cfg.vertexLocation,
    models: cfg.vertexModels,
  });

  const system = 'Reply with ONLY compact JSON: {"action":"follow","why":"smoke"}';
  const user = '{"me":{"hp":6,"maxHp":6},"enemies":[],"pickups":[]}';

  const results: { model: string; ok: boolean; ms: number; okJson?: boolean; err?: string }[] = [];
  for (const model of cfg.vertexModels) {
    const t0 = Date.now();
    process.stdout.write(`smoke ${model} ... `);
    try {
      const llm = makeLLM("vertex", cfg, model);
      const text = await llm.chat(system, user);
      const ms = Date.now() - t0;
      const snippet = (text || "").replace(/\s+/g, " ").slice(0, 80);
      const okJson = /\{[\s\S]*"action"[\s\S]*\}/.test(text || "");
      console.log(`OK ${ms}ms jsonish=${okJson} reply=${JSON.stringify(snippet)}`);
      results.push({ model, ok: true, ms, okJson });
    } catch (e) {
      const ms = Date.now() - t0;
      const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 220);
      const safe = msg.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer <redacted>");
      console.log(`FAIL ${ms}ms ${safe}`);
      results.push({ model, ok: false, ms, err: safe });
    }
  }

  const passed = results.filter(r => r.ok).length;
  console.log(`\nSMOKE ${passed}/${results.length} models ok`);
  process.exit(passed === results.length ? 0 : 2);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

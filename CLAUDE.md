# CLAUDE.md — Ilya and the Amber Blade (amber-coop)

A tiny cooperative Zelda-like, built as a gift for the author's son (Ilya, QA Lead)
that grew into an LLM-agent research testbed. Two heroes quest to end an endless
winter; the second hero can be a human, an LLM agent, or absent (AI autopilot with
a human spectator). PvE co-op is treated as a three-player coalition game — hero,
partner, dungeon — and the roadmap heads toward mixed-motive / hidden-utility
partner experiments. Keep both natures in mind: it is a *game a teenager loves*
and a *benchmark harness*. Never sacrifice the first for the second.

## Commands

```bash
npm ci                        # install (lockfile is authoritative)
node scripts-build.mjs        # build → dist/{server.js, client.html, client3d.html, bench.js, selftest.js}
                              # prints a build id like 2607101426-si8t (minute-stamp + rand)
node dist/selftest.js         # FULL suite; prints "SELFTEST OK — N assertions"
node dist/server.js           # serve on :8081 (PORT env to change)
PROVIDERS=mock N=5 node dist/bench.js                    # headless agent benchmark
PROVIDERS=anthropic,ollama N=10 TEMPERAMENT=hunter PLAN_TICKS=90 node dist/bench.js
./scripts/deploy-dgx.sh       # rsync + docker compose on spark-a510 (DGX)
```

`.env` (see `.env.example`): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`OLLAMA_URL`/`OLLAMA_MODEL`, `PLAN_MS`, `PORT`. Keys live server-side only.

**Tree integrity check** (Docker flow: build locally, deploy dist to prod):
a clean tree passes the exact assertion count in the test suite. If the count is
lower, the tree is a chimera of generations — re-extract the cumulative tar.
Verify a deploy by matching the build id in: server startup log, `/health`,
and the menu footer of both clients (a red mismatch warning appears in-game
when client and server ids diverge).

## Architecture

```
shared/core.ts      pure, DOM-free game core. update(g, inputs) is the ONLY way
                    state advances. Snapshot (flat) is the client contract.
                    Stage 1: room-local state in g.sims[0] (RoomSim); legacy flat
                    fields (g.room, g.enemies, ...) are NON-ENUMERABLE ACCESSORS
                    over sims[0]. Object.assign-based restart depends on that
                    non-enumerability — do not "fix" it. Player.simIndex +
                    simOf(g, pi) are the growth points.
                    Stage 2: toSnapshot(g, names, viewerSlot) — primary view from
                    the viewer's sim; optional partnerView (compact room mirror)
                    when the partner inhabits a different sim. Still flat — no
                    sims[] on the wire.
server/index.ts     multi-session WebSocket server. Session class per room code
                    (4 letters). Bare URL = always a fresh session; joining
                    someone requires ?room=CODE. Per-viewer snapshots (slot 0/1).
                    /stats, /stats.json, /health. Logs: logs/plans.jsonl (every
                    LLM plan, with `why`), logs/matches.jsonl (per-game outcome).
server/agent.ts     two-layer LLM agent. Planner: JSON intent every PLAN_MS
                    ({action, target, dir, point, say, why}). Controller: 60 Hz
                    reflex layer (auto-engage by temperament incl. during pickup
                    errands, survival pickups, rescue w/ temperament-scaled
                    patience + failsafe, matador dodges, tile-BFS waypointing via
                    nextWaypoint, route compass via routeHop). llmIntent preserved
                    across reflex fights; restored after kill via resumeIntent.
                    SOLO_PROMPT vs SYSTEM_PROMPT chosen by partner presence.
server/llm.ts       providers: anthropic / openai / ollama / mock. mock is the
                    deterministic harness driver — keep it dependency-free.
client/client.ts    2D pixel client. client/client3d.ts — HD-2D (three.js).
client/partnerpip.ts 2D scry-mirror (PiP) for partnerView — ALWAYS pixel art,
                    even inside the 3D client. Separate #pip canvas beside
                    #frame (~0.35 scale); hidden when partnerView is null.
client/predict.ts   DOM-free client-side prediction (own hero only), mirrors
                    core movement math exactly. Tested headlessly.
client/textutil.ts  DOM-free helpers (wrapText). Keep testable code DOM-free.
test/selftest.ts    the whole safety net. test/bench.ts — virtual-time arena
                    (provider latency measured separately from decisions).
```

## Iron rules

1. **The classic quest is canon and canon is guarded by tests.** Ilya cleared it;
   it stays exactly as he knows it. World growth is open-closed: add side wings,
   optional bosses (Emberdeep), new modes — never edit the classic path. Canon
   changes require explicit tester consensus and a comment in the guarding test
   naming who agreed (see the wraith-enrage precedent in selftest).
2. **Every behavior change lands with a test in the same commit.** The suite has
   caught ~two dozen silent patch misses. When editing by string replacement,
   assert the anchor exists; verify with grep after writing. The menu code is
   DUPLICATED between client.ts and client3d.ts — every menu change must be
   applied to BOTH, and test [15] checks the *built bundles* for code anchors.
3. **Personality belongs to the agent; invariants belong to the mechanics.**
   Precedents: the npc room-anchor (an NPC cannot reload a room while a hero is
   present — core rule, not agent politeness); rescue failsafe (temperament
   scales the patience, the rescue itself is mandatory); solo mercy is the
   agent's choice *by temperament*, never a script. Honest metrics over polish:
   controller assists are counted (routeAssists) and logged, not hidden.
   Pickup/goto pathfinding and errand combat reflexes are controller invariants
   (mechanics), not planner politeness — see tests [35]–[36].
4. **Snapshot stays flat.** Clients know nothing about sims[]. Server-side
   augmentation (e.g. `thought`, `partnerView`) extends the Snapshot interface
   optionally. partnerView is a compact mirror, not a second full snapshot.
5. **Latency work goes client-side.** Server is authoritative for damage/state;
   perceived responsiveness comes from prediction (movement), local swing
   visuals/sfx, ping meter. Don't weaken server authority for feel.
6. **Pickups quirk:** dispatch indexes `g.pickups.filter(p => p.t >= 0)` — any
   code storing pickup indices must index the same filtered list.

## Game content quick-map

17 rooms. Classic: meadow → forest → Amber Lake → (cave) → Old Vault → golem →
Amber Blade → melt the north gate → snowfield (bow) → glacier → (cave) → ice
vault → Winter Wraith. Optional: Cellars (elixir), Frozen Crypt (container),
Emberdeep rooms 14–16 (Ember Golem → Miner's Charm → fire arrows). LONG QUEST
(hardGate) seals the glacier until Emberdeep is cleared. Menu: quest → party
(single / multiplayer / AI autopilot) → travel (LINKED / FREE ROAM, multiplayer
only) → partner (human/LLM) → provider → temperament (bodyguard / companion /
berserker). Damage: sword 1, Amber Blade 2,
arrow 1, fire arrow 2. Wraith enrages below half HP. Sentinel shield has turn
inertia; a blocked arrow staggers (45 ticks, still advancing). Keys are
team-shared. Endings (endingFor, priority order): solo → lone-thaw → mercy
(spare the yielding wraith by standing close; it becomes a companion) →
flawless → ember-pact → classic.

## Roadmap (agreed with the author — stage numbers matter)

**Stage 1 — DONE.** World/RoomSim factorization: state in `g.sims[0]`, legacy
flat fields as non-enumerable accessors, `Player.simIndex`, `simOf()`. Behavior
byte-identical, guarded by test [32].

**Stage 2 — DONE.** Per-viewer snapshots: `toSnapshot(g, names, viewerSlot)`.
Primary view from the viewer's sim via `simOf()`. Optional `partnerView`
(compact: room name, tiles, partner, entities) — `null` while both heroes share
a sim (LINKED today). Server sends per-slot snapshots; events fan out once.
Clients render the scry-mirror (`client/partnerpip.ts`) in both 2D and HD-2D
before rooms ever diverge — hidden when `partnerView` is null. Guarded by tests
[32] (null while shared), [38] (diverged sim harness), [15] (bundle anchors).

**Stage 3 — FREE ROAM + live partner window (core shipped).** Menu axis:
LINKED (canon Four Swords) vs FREE ROAM (independent rooms). In free roam a
transition moves only the crosser; `sims[1]` holds the detached room, merge
when both reunite. `update()` ticks every active sim via `activeSim`; enemies
and projectiles are sim-local. Remote-revive on transition is LINKED-only
(guarded by test [39]). PiP lives in `#pip` beside the game frame ([15] bundle
anchor). Doorway settle: `transitionCd`, npc yield when overlapping the human,
agent reunite→follow ([41]). Agent bridge (pre-Stage-4): when partner is in
another room, `observe()` reports `partner.away`, route assist fires like solo,
and follow does not chase stale coordinates (test [40]). Full errand autonomy —
declared goals, leave permission, room-aware rescue failsafe — remains Stage 4.

**Stage 4 — partner autonomy (errands) on the same machinery.** No fake
timers: the earlier "despawn + ETA" abstraction is superseded — the agent
simply lives in sims[1] and the human watches the window. Remaining design:
- The agent declares the errand through its ordinary channels: `say` for the
  promise ("fetching the bow, hold on"), `why` in plans.jsonl for the record.
  The objective chain / route compass already knows where things are (bow 6,
  elixir 12, charm 16).
- The npc anchor evolves per mode: LINKED keeps the hard anchor; FREE ROAM
  needs a mechanics-level leave-permission rule. OPEN QUESTION for the author,
  candidates: npc may leave only when the hero is not downed and not in
  combat; or an explicit consent prompt to the human. Precedent to follow:
  personality in the agent, invariants in the core.
- Rescue failsafe must become room-aware: an away agent's "patience" clock
  starts when the hero falls, and the errand aborts (route back) on failsafe.
- Telemetry: errand records in matches.jsonl — declared goal, duration, what
  was fetched, hero's state during the absence. This is the trust corpus the
  research line builds on.

**Stage 5 (sketch) — the dungeon as the third player.** An LLM director for
the {dungeon} side with a NON-WINNING utility ("interesting resistance", L4D
AI-Director lineage): assigns targets across enemies, paces pressure. Turns the
three-player coalition framing literal. Design-only; do not start unprompted.

**Research line (design-only so far):** partner with hidden utility weights /
betrayal as rational defection. Order of introduction is deliberate: honest
absences first (build trust), hidden weights later (make trust a wager).
The `why` field then becomes a *claim*, not ground truth; the partner window
turns moral hazard into "dishonesty under partial observation". plans.jsonl is
the interpretability corpus. Do not implement betrayal without the author
asking. Framing for the eventual write-up: PvE co-op as a three-player
coalition game (hero, partner, dungeon-with-interestingness-utility); the
spared wraith is already a coalition defection {dungeon}→{heroes}.

## Working with the author

Artem: 20y SWE, PhD (math modeling), quant background; senior DS doing
agentic-AI advocacy at work. Russian for discussion, English for code and docs.
Prefers open-closed design, composable Lego-style architecture, honest metrics,
staged refactorings where every stage ships a working game. He builds locally
in Docker and deploys dist/ to a DGX (Tailscale) that friends and family play
on — never break trunk: testers include his son, his wife, and friends abroad.
Feedback arrives as Telegram screenshots; treat tester reports as tickets and
close them with tests. Build ids and assertion counts are the shared language
of verification.

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
./scripts/publish-dgx.sh      # selftest gate, then deploy-dgx.sh
```

**DGX release loop (manual):** work on `az_dev`, merge approved trunk, deploy
from the laptop:

```bash
git checkout az_dev && git fetch origin && git merge origin/main
./scripts/publish-dgx.sh
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
vault → Winter Wraith. Optional: Cellars (elixir), Frozen Crypt (container +
phoenix feather), Emberdeep rooms 14–16 (Ember Golem → Miner's Charm → fire
arrows). LONG QUEST
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

**Stage 3 — DONE.** FREE ROAM + live partner window. Menu axis LINKED vs
FREE ROAM; split/merge sims; per-viewer overlays ([46]); no remote revive on
transition ([39]). PiP scry-mirror ([15], [38]). Doorway settle ([41]); agent
bridge when partner away ([40]). **Alone-down bleed-out:** 30s (`BLEED_TICKS`
1800) in FREE ROAM when partner is in another room — zero → gameover +
`abandoned` ending + `bleedout` in matches.jsonl ([48], [49]). **Phoenix
Feather:** optional Frozen Crypt pickup; press **F** for the only remote revive
(team, one use; same-room touch-revive still required there) ([50], [51]).
Agent may spend the feather on rescue failsafe when routing is too slow.

**Stage 4 — DONE.** Partner autonomy (errands) on the same machinery:
- The agent declares the errand through `say` + `why` (controller logs to plans.jsonl).
  Route compass targets bow (6), elixir (ELIXIRS), charm (16).
- FREE ROAM leave permission: npc may leave only when the hero is not downed and
  not in combat (mechanics-level; test [42]).
- Room-aware rescue failsafe: away agent's patience starts when the hero falls;
  active errand aborts on failsafe and routes back (test [43]).
- Telemetry: `errands` array in matches.jsonl — goal, duration, fetched, hero
  downs during absence (test [44]).

**Stage 4.5 — AI DUO (two LLM heroes, humans spectate).** Author's go-ahead
GIVEN; implement before the Architect. Providers may match or differ; so may
temperaments. This is the coordination-dyad benchmark (do two models revive
each other? how do mercy decisions differ when BOTH are models?) and the
substrate for the Architect bench (duo vs director = the first fully
machine-played coalition triangle).

*Menu.* Party step gains a fourth option: AI DUO. Flow: two passes over the
existing provider→temperament steps with headers "choose the HERO's AI" /
"choose the COMPANION's AI" (reuse steps + a phase counter; remember: menu code
is duplicated in BOTH clients, test [15] anchors). Travel axis: v1 is LINKED
only (free-roam duo + errands later — machinery exists, scope doesn't).

*Server.* `mode: "duo"`: two AgentPlayers. Slot 0 = HERO (leader), slot 1 =
COMPANION. Host is a bodiless spectator exactly like autopilot (start via
ENTER / click / {t:"start"}). names[] from llm names; heroes table in /stats
skips duo matches (like auto); partner leaderboard gains a PAIR key:
`"HAIKU+LLAMA [guard+hunter]"` (temperament suffixes when non-companion).
plans.jsonl entries gain `slot`; matches.jsonl gains mode "duo" + both
provider/temperament fields.

*The anchor deadlock (CRITICAL).* The npc room-anchor with two NPCs and zero
heroes locks both in the first room forever. Resolution, per iron rule 3:
the anchor's spirit is "room transitions belong to the party's humans"; with
no humans in the party, leadership devolves to slot 0. So: slot 0 npc=false
(may transition; LINKED drag carries the companion), slot 1 npc=true.
Mechanics-level, tested.

*Prompts.* Slot 0 gets LEADER_PROMPT: quest-driving like SOLO_PROMPT (route
compass, "exit"/"cave" verbs, never idle) but WITH a companion — coordinate,
don't abandon ("your companion fights beside you; lead the route, share the
loot sensibly"). Slot 1 keeps SYSTEM_PROMPT + temperament doctrine unchanged.
Two follow-intents deadlock in mutual politeness — the leader must never be
told to follow; forbid "follow" in LEADER_PROMPT like SOLO does.

*Decisions with no human present.* Mercy: the WRAITH-yield choice devolves to
the LEADER's temperament (companion stands back — the existing "the choice
belongs to your partner" generalizes: the deciding slot is the party leader).
Rescue: mutual, each side's temperament-scaled patience + failsafe apply
symmetrically (guard slot-agnostic code — agent.ts is mostly slot-clean
already; audit `1 - this.slot` assumptions).

*Spectator UI.* Thought panel shows BOTH minds: two lines, name-prefixed
(`HAIKU: exit — the vault lies east` / `LLAMA: follow — staying close`).
Snapshot: migrate `thought` → `thoughts: [{slot, name, action, why, ms}]`
(optional field; flat; both clients render up to two lines; T toggles both).

*Bench.* `MODE=duo PROVIDERS=anthropic:openai N=10 TEMPERAMENTS=guard:hunter
node dist/bench.js` — pair columns: winrate, ticks, mutual revives, downs per
slot, routeAssists per slot, mercy outcome distribution. This table (model ×
model × temperament × temperament) exists nowhere publicly.

*Tests to land WITH the implementation:* duo menu reachability anchors in both
built bundles; WS boot test (both agents act, spectator starts); anchor
devolution (leader transitions, companion dragged, room never reloads under
companion pressure); mutual revive both directions; leader-temperament mercy
(hunter leader strikes / guard leader spares while companion stands back);
stats pair key; thoughts[] in snapshot.

**Stage 5 — THE ARCHITECT (the dungeon as the third player).** Full design
spec; implement only on the author's explicit go-ahead, stage by stage.

*Concept.* An LLM director plays the {dungeon} side with a NON-WINNING utility:
"interesting resistance" (L4D AI-Director lineage; the Matrix naming is
deliberate — the first Matrix failed because its utility was wrong). Two
victory-seeking sides plus one quality-seeking side turns the three-player
coalition framing literal.

*Architecture — mirror of AgentPlayer (two layers, both already precedented):*
- `server/director.ts`, class `DirectorPlayer`. The ORACLE (LLM planner,
  `DIRECTOR_PLAN_MS` ≈ 3500) reads a compact observation (room state, heroes'
  hp/positions, recent tension metrics) and answers JSON:
  `{"assignments": [{"e": 2, "focus": 0}, {"e": 0, "focus": "door"}],
    "why": "...", "whisper": "the winter watches the archer"}`.
- The ARCHITECT (controller) is mechanics: validates directives, enforces the
  power limits, computes tension metrics, falls back to vanilla enemy AI on
  silence/parse failure. A `mock` director drives tests.
- Core hook is ONE field: `Enemy.focus?: number | "door" | null`. targetNearest
  honors a valid, living focus; otherwise vanilla behavior. No other core
  change. Enemies with no directive behave exactly as today.

*Power vocabulary v1 — target assignment ONLY.* The director may set focus per
enemy in the room. It may NOT: spawn, buff, heal, change room composition,
touch boss HP or attack patterns, move enemies between rooms, or retarget a
yielding wraith (phase 9 is sacred — mercy stays outside its reach). The
smallest power at which the dungeon suddenly reads as coordinated; the "anomaly"
stays with the players — a limited director can be outplayed, an omnipotent one
is just repression. Vocabulary growth (pacing hints, patrol waypoints) is a
LATER negotiation, one verb at a time, each behind its own test.

*Utility operationalization (tension corridor).* Candidate v1 metric, tunable:
keep the party's aggregate HP fraction inside [0.4, 0.75]; reward downs that do
NOT end in gameover; escalate on boredom (no damage taken for ~12 s), ease off
near party wipe. The stats timeline (dmgTaken/downs/revives per tick window)
already exists in telemetry — the controller computes the corridor signal and
passes it to the Oracle as observation, the Oracle decides HOW to act on it.

*Director styles (menu: THE ARCHITECT → style):* WARDEN (defensive: guard
doors, protect key rooms), HUNTSMAN (focus-fire the weaker hero, punish
splits — FREE ROAM synergy), DRAMATURGE (pure tension-curve play). Same
pattern as partner temperaments: a doctrine line in the prompt + controller
weights. Styles are also the bench ablation axis.

*Introduction order (deliberate, mirrors trust-before-betrayal):*
1. BENCH FIRST — director vs AI autopilot, and director vs AI DUO once 4.5
   lands (three models, full triangle), no humans. `DIRECTOR=anthropic
   DIRECTOR_STYLE=huntsman PROVIDERS=... node dist/bench.js`. New columns:
   corridor-time %, downs caused, gameovers, director parse-fail rate. This is
   an adversarial eval (partner model × temperament vs director model × style)
   that no public benchmark has — and it validates the director's judgment
   before any experiment touches Ilya.
2. Then a menu toggle for humans (default OFF; canon quest without the
   director stays byte-identical — guard with a test).

*Channels & telemetry.* Director plans go to plans.jsonl with `side: "dungeon"`
(the self-explanation corpus doubles); matches.jsonl gains director
provider/style/metrics. `whisper` is an optional flavor channel surfaced to
players (toggleable, off by default) — the winter thinking out loud.

*Tests to land WITH the implementation:* directive validation + power-limit
enforcement (spawn/buff attempts rejected), phase-9 sanctity, vanilla fallback
on director silence, focus honored by targetNearest, canon-untouched guard
(no-director game identical), bench harness smoke.

*Research hooks.* The full coalition triangle becomes expressible; a
{partner, dungeon} coalition is the betrayal endgame — still gated on the
author. The Oracle/Architect split (meaning-layer vs mechanics-layer) is the
same pattern as planner/controller in agent.ts: name it in the write-up.

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

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
PROVIDERS=mock N=5 node dist/bench.js                    # headless golem arena
MODE=rink PROVIDERS=mock,anthropic N=10 node dist/bench.js   # Frozen Playground ice-plan eval
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
                    Pickup placement: pushPickup/settlePickupPos/pickupWedged.
                    Wraith spirit anchor: wraithAnchorsDowned (same-room revive).
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
                    ({action, target, dir, point, icePlan?, say, why}). Controller: 60 Hz
                    reflex layer (auto-engage by temperament incl. during pickup
                    errands, survival pickups, rescue w/ temperament-scaled
                    patience + failsafe, matador dodges, tile-BFS waypointing via
                    nextWaypoint on roomRows(g) — current room only, never
                    g.tiles[] — route compass via routeHop, attackStall flank
                    when stuck; Frozen Playground: LLM icePlan queue +
                    nextSlideWaypoint fallback). llmIntent preserved across reflex fights;
                    restored after kill via resumeIntent. Prompts: SYSTEM_PROMPT
                    (partner), SOLO_PROMPT (autopilot), LEADER_PROMPT (AI DUO
                    slot 0 — quest driver, never follow).
server/llm.ts       providers: anthropic / openai / ollama / mock. mock is the
                    deterministic harness driver — keep it dependency-free.
client/client.ts    2D pixel client. client/client3d.ts — HD-2D (three.js).
client/menu.ts      shared menu state machine — imported by BOTH clients; test
                    [15] checks built bundles for anchors.
client/hud.ts       shared HUD helpers (heart bars, drawDuoSpectatorHud).
client/partnerpip.ts 2D scry-mirror (PiP) for partnerView — ALWAYS pixel art,
                    even inside the 3D client. Separate #pip canvas beside
                    #frame (~0.35 scale); hidden when partnerView is null.
client/predict.ts   DOM-free client-side prediction (own hero only), mirrors
                    core movement math exactly. Tested headlessly.
client/textutil.ts  DOM-free helpers (wrapText). Keep testable code DOM-free.
test/selftest.ts    the whole safety net (382 assertions as of last trunk).
                    test/bench.ts — virtual-time benchmarks (MODE=arena golem,
                    MODE=rink ice-plan eval; latency reported separately).
```

## Iron rules

1. **The classic quest is canon and canon is guarded by tests.** Ilya cleared it;
   it stays exactly as he knows it. World growth is open-closed: add side wings,
   optional bosses (Emberdeep), new modes — never edit the classic path. Canon
   changes require explicit tester consensus and a comment in the guarding test
   naming who agreed (see the wraith-enrage precedent in selftest).
2. **Every behavior change lands with a test in the same commit.** The suite has
   caught ~two dozen silent patch misses. When editing by string replacement,
   assert the anchor exists; verify with grep after writing. Menu logic lives in
   `client/menu.ts` (shared by both clients); test [15] still checks the *built
   bundles* for code anchors. HUD shared helpers go in `client/hud.ts`.
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
   code storing pickup indices must index the same filtered list. Drops use
   `pushPickup` / `settlePickupPos` so loot never spawns inside solid tiles;
   wedged pickups nudge each tick; nearby magnet when wedged ([63]).

## Game content quick-map

18 rooms. Classic: meadow → forest → Amber Lake → (cave) → Old Vault → golem →
Amber Blade → melt the north gate → snowfield (bow) → glacier → (cave) → ice
vault → Winter Wraith. Optional: Cellars (elixir), Frozen Crypt (container +
phoenix feather), Emberdeep rooms 14–16 (Ember Golem → Miner's Charm → fire
arrows), **Frozen Playground** (room 17 — commit-slide puzzle wing; two doors:
south off the starting meadow — SEALED by ancient ice until the Amber Blade
melts it (mirror of the north gate; the blade thaws both meadow seals at once) —
and off the Frozen Crypt). LONG QUEST
(hardGate) seals the glacier until Emberdeep is cleared. Menu (shared
`client/menu.ts`): **single or multiplayer** → party path → provider/temp
(where needed) → **classic / long quest** last (+ SLIPPERY ICE toggle always,
FREE ROAM + Architect toggles on multiplayer). Paths: single human; single
**AI autopilot** (spectator);
multi **human + AI** (human keeps `hostName` in names[0]); multi **AI + AI**
(duo spectator; FREE ROAM enabled); multi human co-op. Temperaments: bodyguard /
companion / berserker. Damage: sword 1, Amber Blade 2,
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

**Stage 4.5 — AI DUO (two LLM heroes, humans spectate). IN PROGRESS** — author's
go-ahead GIVEN; land before the Architect. Providers may match or differ; so may
temperaments. Coordination-dyad benchmark + substrate for the Architect triangle.

*Landed (playable v1):*
- Menu path **AI + AI** in `client/menu.ts` — dual provider/temperament passes;
  FREE ROAM on quest screen; test [15] bundle anchors.
- Server `mode: "duo"`: `leaderAgent` slot 0 (`leader: true`, `npc=false`) +
  `agent` slot 1 (`npc=true`); spectator input discarded like autopilot; start
  via ENTER / click / `{t:"start"}` (Enter handled *before* `isSpectator` in
  both clients).
- `LEADER_PROMPT` + controller: leader never follows; route assist when passive
  even with mate in-room; companion keeps `SYSTEM_PROMPT` ([62]).
- Spectator HUD: `drawDuoSpectatorHud` shows both heroes' hearts ([15] anchor);
  autopilot spectator also sees questing AI hearts.

*Still to land (close 4.5):*
- Anchor devolution test: leader transitions, companion dragged, room never
  reloads under companion pressure.
- Dual thoughts: `thought` → `thoughts: [{slot, name, action, why, ms}]` in
  snapshot; both clients render two name-prefixed lines.
- Telemetry: plans.jsonl `slot` on both agents; matches.jsonl `mode:"duo"` +
  both provider/temperament fields; `/stats` partner PAIR key
  (`"HAIKU+LLAMA [guard+hunter]"`).
- Bench: `MODE=duo PROVIDERS=anthropic:openai N=10 TEMPERAMENTS=guard:hunter`.
- WS boot test; mutual revive both directions; leader-temperament mercy test.

*Design notes (unchanged).* **Anchor deadlock:** with two NPCs and zero humans,
leadership devolves to slot 0 — `npc=false` (may transition; LINKED drag
carries companion), slot 1 `npc=true`. Mercy with no human → leader's
temperament. Rescue mutual with symmetric patience + failsafe. Architect toggle
stored on setup (`architect` field) — bench-first stub, not wired.

**Post–Stage 4 mechanics (landed, guarded):**
- **Wraith spirit anchor** ([58]–[59]): spared wraith revives a downed hero
  only while a living partner shares the room — half-speed hug, no remote save
  when split; bleed-out unchanged.
- **Hunter in-room rescue** ([60]): bodyguard/companion keep attack-first
  patience; hunter drops attack to touch-revive when partner is downed in-room.
- **Collision-aware agent routing** ([61]): `roomRows(g)` for BFS; `waypointSeek`
  with `solidAt`; attack flank after `attackStall > 35`.
- **Wedged loot** ([63]): `pickupWedged` / `settlePickupPos` / proximity magnet
  on collection — enemy hearts no longer stuck in corners.
- **Doorway stall break** ([64]): agent yields from a stuck exit to room center;
  `exitGiveUpT` suppresses leader route-assist so it can't re-loop the door.
- **Slippery ice** ([65], opt-in): menu toggle `slick`, default OFF so the
  classic quest stays byte-identical. When ON, heroes carry velocity (`Player.vx/vy`)
  and coast ~10px on `"i"` tiles via asymmetric easing (`ICE_ACCEL` snappy start,
  `ICE_DECEL` long glide — both exported so `client/predict.ts` mirrors it exactly).
  Heroes only; enemies unaffected. `g.slick` in Snapshot + restart-preserved.
- **Commit-slide puzzle ice** ([66], new content — tester Алексей Белозёров):
  a *distinct* tile `"z"` (walkable, NOT in SOLID, NOT gated by `slick`). Step on
  and `slideBody(g, b, w, h, dx, dy)` locks a single-axis skate at `SLIDE_SPEED`
  until a wall blocks it or the body slides onto grip floor (`"f"`) — the
  Undertale/Zelda ice-block puzzle. Steering is ignored mid-slide (that IS the
  puzzle). **EVERYONE skates** — human heroes, AI heroes (`p.npc`) and enemies
  (`updateEnemy` short-circuits its AI on `"z"` and skates toward the nearest hero,
  re-aiming off walls). `client/predict.ts` mirrors it for the local human hero.
- **Slide-aware agent routing** ([68], author Artem 2026-07-12): the earlier
  "agents don't skate" exemption was rejected as un-fun — agents skate too, but
  the *controller* (mechanics) knows how. `nextSlideWaypoint` (server/agent.ts) is
  a **greedy best-first** search over slide-*endpoints* (each press = a full skate
  to a wall or onto grip floor; heuristic = squared distance to the goal tile, a
  visited set kills in-plan loops). Greedy on purpose: min-edge BFS chose one-tile
  "chimney" gaps a body can't line up on beside a wall, so the agent jittered at
  the doorway; greedy commits to the big distance-closing slide (usually straight
  onto the ice) and, re-planned each tick, descends to the target. `waypointSeek`
  swaps in this planner whenever the room has any `"z"`, so `follow`/errands/rescue
  all bank off the walls. Safety-net fallback when an LLM plan fails mid-execution.
  Confined to the Frozen Playground wing (room 17), reachable two ways ([67]): south
  straight off the starting meadow (FREE ROAM split-off) and off the Frozen
  Crypt (`exits.up` ↔ `exits.down`) — additive side exits, the canon room *sequence*
  is untouched (guarded by [11]). Commit-slide `"z"` never spreads to canon Ice Vault
  rooms (they keep soft `"i"` ice only). **Frozen Falls meadow entrance ([67],
  author Artem 2026-07-12):** the south door starts as a solid frozen underground
  waterfall (`"F"`, meadow row 13 cols 7–8) and only opens once the Amber Blade
  is claimed — `meltMeadowIce(g)` thaws BOTH the north quest gate and the south
  falls seal on the first `amberClaimed` press (shared `g.gateMelted`; `loadRoom`
  re-thaws both on reload).
- **Rink is not a trap** ([74], author Artem 2026-07-13 — tester report: a
  hunter rooted in the Frozen Playground, then jammed in the Meadow bushes, then
  looping back into the rink). Two controller (mechanics) fixes, no world change:
  (1) On a commit-slide room the auto-engage "chase the nearest foe" reflex is
  SKIPPED — you cannot chase skating dwellers and swinging freezes the hero
  mid-tile, so a hunter (infinite engage radius) would root itself on the ice
  forever, never questing or rescuing; `meleeGuard` still strikes whatever skates
  into arm's reach while the route/exit proceeds. (2) The forced exit key is
  committed only once the hero is lined up with the doorway on the CROSS axis
  (was: forced unconditionally off-ice), so approaching an off-centre gate — the
  Meadow's right door reached from the south Playground stair — no longer pits a
  forced "r" against the pathing "l"/"u" into a stall. Underneath both, a real
  bug in `seekDirect`'s collision probe: it sampled from the body CENTRE
  (`mcy + PLAYER_H - 2`, ~4px below the feet, never the head), so a hero one row
  above a solid border read sideways moves as blocked and wedged in the tree gap
  — now probes the body's true top/middle/bottom (left/middle/right) span.

**Optional idea — Playground refreeze (design-only, NOT implemented; author Artem
2026-07-13).** A menu toggle (e.g. `refreeze`, default OFF) that recrystallises
the Frozen Falls on ALL sides of the Frozen Playground once *both* heroes have
left it (room 17 empty of both) — a pure research observable: "does the agent
bump the ice wall or route around it?". Deliberately shelved because the [74]
fixes already stop the agent from getting trapped in / looping back to the rink,
so refreeze is no longer needed as a workaround — and it would otherwise block a
human from re-entering the optional wing (and melt-on-touch would re-open it
anyway). If ever built: gate it behind its own toggle so the classic quest stays
byte-identical, seal with a NON-melting variant (or the agent just re-melts it),
and guard with a test. Not to be implemented without the author asking.

**Stage 4.6 — LLM ICE BRAIN (Frozen Playground research sandbox). LANDED** — author
Artem 2026-07-12: the LLM proposes *how* to cross the rink, not just *where* to go.

*Planner surface:* optional `icePlan: ["up","left",...]` on the intent JSON (max 12
dirs), only when `observation.icePuzzle` is present (room 17). Prompt addendum
`ICE_ADDENDUM` + compact `icePuzzle` observation: rest tile, target tile, legal
first directions, exits, sliding state.

*Controller (mechanics):* `simulateIcePlan` / `slideDestTile` validate the sequence
at plan time; `tickIcePlan` executes one press per rest point (never pops mid-glide);
loop/timeout/away-from-target failures fall back to `nextSlideWaypoint` ([68]). Honest
metrics: `icePlanStats` on `AgentPlayer`, `icePlan`/`icePlanValid`/`icePlanReason` in
`plans.jsonl`, `icePlans` aggregate in `matches.jsonl`. Guarded by [69]–[71].

*Single-axis slide steering ([73]):* on a `"z"` tile `waypointSeek` presses only the
dominant axis toward the slide endpoint and the `exit` handler never force-holds the
exit key mid-slide — `slideBody` locks one axis and prioritises horizontal, so a few px
of cross-axis nudge from a 2-axis `seekDirect` used to skate the agent wall-to-wall and
trap it in the rink (it could move but never leave). Off the ice (grip floor by the
door) the normal 2-axis seek + forced exit key resumes, so it walks through the door.

*Research hook:* first benchmark where the LLM's low-level navigation claim is logged
and measured separately from controller assists — substrate for provider ablations on
puzzle ice before RL. Bench: `MODE=rink PROVIDERS=mock,anthropic N=10 node dist/bench.js`
reports `successRate`, `icePlanOkRate`, `icePlanFallbackRate` per provider ([72] smoke).

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

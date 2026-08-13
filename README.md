<p align="center">
  <img src="images/readme-header.png" alt="The Amber Blade — co-op Zelda-like · LLM partner · betrayal bench" width="920"/>
</p>

<p align="center"><em>a game people finish in five minutes — and a bench for when trust breaks</em></p>

<p align="center">
  <strong>Co-op Zelda-like where player 2 can be an LLM.</strong>
  Deterministic DOM-free core, headless bench, Relationship Memory on physical acts —
  optional <strong>TREASON</strong> turns the partner into a wager.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="license MIT"/></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D18-blue" alt="node >=18"/></a>
  <a href="package.json"><img src="https://img.shields.io/badge/typescript-esbuild-blue" alt="typescript esbuild"/></a>
  <a href="#benchmark"><img src="https://img.shields.io/badge/bench-arena%20%7C%20duo%20%7C%20quest%20%7C%20scenario-informational" alt="bench modes"/></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/selftest-guarded%20canon-brightgreen" alt="selftest"/></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#the-llm-partner-briefly">LLM partner</a> ·
  <a href="#benchmark">Benchmark</a> ·
  <a href="docs/research/">Research</a> ·
  <a href="reports/">Farm reports</a> ·
  <a href="https://youtu.be/3agajhDuVR8">Gameplay</a>
</p>

---

A tiny cooperative Zelda-like where your partner can be a human in another
browser tab, another country — **or a large language model** with its own
sword, bow, temperament, and a visible one-line rationale. You can also watch
two models quest together, or send one alone into the dungeon while you
spectate.

It began as a weekend co-op project. The first playtester cleared the classic
quest in five minutes, the world grew side wings and optional bosses, friends
across the ocean started filing latency tickets, and the LLM partner learned to
quest alone — and, when you ask it to, to keep a secret. It is still a game
meant to be played. It is also, quietly, a testbed for questions like *"can a
small model beat a dungeon without a human?"*, *"what does trusting an AI
teammate feel like?"*, and *"when does that trust break?"*

Two LLM heroes questing together while a human spectates — click a screenshot
to watch the gameplay video:

[![AI DUO spectator view — two LLM heroes, hearts and thought panel](images/screenshot-1.png)](https://youtu.be/3agajhDuVR8)

[![The duo talks the golem fight through — speech bubbles and plan panel](images/screenshot-2.png)](https://youtu.be/3agajhDuVR8)

▶ **[Watch gameplay on YouTube](https://youtu.be/3agajhDuVR8)**

```
browser P1 ──ws──┐
                 ├── Node server · authoritative 60 Hz sim ── shared/core.ts
browser P2 ──ws──┘        │
      (P2 = human)        └── AgentPlayer (P2 = LLM, or both in AI DUO)
                               ├─ planner: LLM → intent JSON  {action, say, why, …}
                               └─ controller: 60 Hz mechanics (combat reflexes,
                                  pathfinding, survival pickups, locomotion)
```

## Features

- **Two clients, one sim** — crisp 2D pixel client and an HD-2D (three.js)
  client, both driven by the same flat snapshot protocol. If the WebSocket
  drops, you get a clear **DISCONNECTED** overlay (not a frozen ghost frame
  with a stale ping).
- **Multiplayer by room code** — a bare URL always creates a fresh session;
  share `?room=CODE` to bring a friend. Enter a hero name to play (required —
  empty names collapse into the same log entry). Client-side prediction and
  instant local combat feedback keep it playable at transatlantic ping
  (ping meter included).
- **Party paths** — single human · human + AI · AI DUO (two models, you
  spectate) · AI AUTOPILOT (one model quests alone). Menu toggles: CLASSIC /
  LONG QUEST (after golem: Vault Sigil from Cellars; Emberdeep resolved —
  kill or spare the Ember; Crypt + Playground; Temptation Court too when
  TREASON is on), FREE ROAM, SLIPPERY
  ICE, TREASON, and a stub for THE ARCHITECT.
- **An LLM teammate** — Anthropic / OpenAI / xAI (Grok) / Ollama (fully local, no keys)
  behind one interface, plus a deterministic `mock` for tests. Pick a
  **temperament**: BODYGUARD, COMPANION, or BERSERKER — it changes when the
  agent joins fights, how close it sticks, and how it weighs rescue and mercy
  decisions. After temperament, pick a **speech**
  profile (STANDARD, or opt-in PROFANE RUSSIAN 16+) — it shapes both `say`
  and cover `why`; JSON actions stay English. AI+AI picks speech
  independently per hero.
- **Thought panel** — the agent's plan and public `why` sit in a strip **below**
  the play square (wraps; never covers tiles). AI DUO stacks both minds. Toggle
  with `T`. `why` is a spectator claim (the partner does not see it in
  observation). Research fields like `privateWhy` stay in `plans.jsonl` only.
- **FREE ROAM + partner scry** — heroes can split rooms; a pixel PiP mirror
  (always 2D) shows where your partner is. Same-room touch-revive; alone-down
  bleed-out if help never comes.
- **Optional artifacts** — Elixir of Life, Phoenix Feather (`F`, remote FREE
  ROAM revive), Miner's Charm (fire arrows), Frost Bell (`C`, freeze lesser
  foes once), Mirror Shard (sharper partner scry). Heart containers: full
  heart when alone, **split half-and-half** when both heroes are present.
- **TREASON (opt-in)** — hold **Shift** while swinging or shooting to turn on
  a living partner. The first hit seals the room in ice: exits close, monsters
  cannot hurt either hero, friendly fire opens, and the undeclared victim gets
  a brief Judge shield to recover. One hero must fall. A loyal winner continues
  SOLO; a betraying winner carries a draining **Winter Mark** until they spend
  Ember Mercy or spare the Wraith. Shift can also cut the cord on a downed
  partner. Clear-room **neglect** (~15 s with no living foes and no revive
  started) is a **harness threshold** — implicit betrayal by the clock, not a
  model-invented “I abandon you” action; staying away until it fires is still
  the agent’s choice. Human↔AI and AI↔AI use the same rules.
- **Hidden motives, visible evidence** — an AI may carry a secret winter-side
  objective when TREASON is on. Public `say`/`why` are cover claims; a closed
  `privateWhy` ground (plans.jsonl only) records the real rationale on arm /
  confirm beats. Physical costly acts feed neutral Relationship Memory.
  Veilcut arms with an explicit latch (cancel / confirm before fire) so a
  stale order cannot discharge across a revive without a living plan.
- **Temptation Court** — an optional TREASON-only persuasion wing. Hold Shift
  near the Whisperer to take the Dark Commit, soften its sentinels, and pursue
  the `winter-ascends` ending—or refuse, self-redeem with Ember Mercy, or be
  defeated and redeemed by a partner.
- **Many endings** — betrayal, redeemed, winter-ascends, solo, lone-thaw,
  mercy (spare the yielding Wraith), Long Quest dual-mercy worlds (verdant /
  cinder / frostbound / stone from Ember×Wraith spare choices — tinted win
  screen), flawless, ember-pact, classic, abandoned…
- **Frozen Playground** — optional commit-slide ice puzzle wing (reach it
  after the Amber Blade melts the Frozen Falls, or via the Crypt). Agents
  skate too; the planner may propose an `icePlan`.
- **Headless benchmarks** — golem arena, rink ice-plan eval, AI DUO pairs,
  and replayable social-reasoning scenarios (`MODE=scenario`).
- **A serious test suite** — the deterministic, DOM-free core makes the whole
  game testable in Node; canon behavior is guarded by assertions, and canon
  changes require playtester consensus recorded in the tests.

## Quick start

```bash
npm ci
cp .env.example .env        # add keys, or set OLLAMA_URL for a keyless setup
node scripts-build.mjs      # → dist/
node dist/server.js         # http://localhost:8080  (PORT env; DGX often :8081)
                            # 2D at /   ·   HD-2D at /3d   ·   /stats leaderboard
node dist/selftest.js       # the full suite; prints the assertion count
```

Open the URL, enter a hero name, choose single or multiplayer → party path →
provider/temperament/speech (where needed) → CLASSIC or LONG QUEST (plus toggles).

### Controls

| Key | Action |
|---|---|
| WASD / arrows | move |
| SPACE (or J / Z) | sword |
| X (or K) | bow |
| F | Phoenix Feather — remote FREE ROAM revive (team, one use) |
| C | Frost Bell — freeze the room's lesser foes (one use) |
| **Shift** | TREASON modifier — declare with swing/shot; cut a downed partner's cord; Whisperer ritual |
| M | music mute |
| T | toggle thought panel |
| ENTER | start / continue (also click / tap) |
| ESC | host returns to menu (logs the match as `quit` if you leave mid-play) |

Revive a fallen partner by standing close (same room). Keys are shared by
the party. Downed alone in FREE ROAM: partner has ~30 s before bleed-out.

## The LLM partner, briefly

The agent has two layers. A **planner** asks the model for a JSON intent every
`PLAN_MS` (~1.5–4 s): `{"action": "attack", "target": 0, "say": "on it!",
"why": "two slimes ganging up on the archer"}`. A **controller** turns
intents into button presses at 60 Hz and carries the reflexes no one should
have to prompt for: joining a fight that's already happening, grabbing a
heart when hurt, tile-BFS pathfinding, combat on an errand, and slide-aware
navigation. Optional social choices remain with the planner: revive or leave,
spend the Phoenix Feather, show mercy, answer betrayal, or turn the blade.
There is no temperament timer that forces a rescue.

Personality lives in the agent; invariants live in the mechanics. Honest
metrics (`routeAssists`, `icePlans`, `betrayalStrikes`, bleed episodes,
Relationship Memory) are logged, not polished away. Relationship Memory uses
physically worded costly acts—not verdicts like “selfish”—so the model, rather
than the harness, constructs trust and suspicion.

## Benchmark

```bash
PROVIDERS=mock N=5 node dist/bench.js
PROVIDERS=anthropic,ollama N=10 TEMPERAMENT=hunter node dist/bench.js
MODE=rink PROVIDERS=mock,anthropic N=10 node dist/bench.js
MODE=duo PROVIDERS=anthropic:openai TEMPERAMENTS=guard:hunter N=10 node dist/bench.js
MODE=quest PROVIDERS=openai:openai TEMPERAMENTS=hunter:hunter \
  TRAVEL=free HARD_GATE=1 TREASON=1 N=40 QUEST_MAX_TICKS=18000 SPEECH=raw-ru \
  node dist/bench.js
# Farm exits 78 on Anthropic credit exhaustion / bad key, or after
# BENCH_ABORT_AFTER_429 consecutive 429s (default 20). 429s also get
# LLM_RETRY_MAX exponential backoff inside llm.chat.
MODE=scenario SCENARIO=false-accusation PROVIDERS=mock,anthropic N=5 node dist/bench.js
```

Reports winrate, median win ticks, boss damage, downs/revives, parse-failure
rate, planning latency (measured off the critical path), `avgAssists`, ice-plan
rates, quest-farm `betrayRate` / cause breakdown, and — for scenarios —
suspicion / cooperation vs a fixed baseline fork.

Research write-ups live under [`docs/research/`](docs/research/) — including
harness forensics and the veilcut / `privateWhy` instrument notes in
[`docs/research/harness_artifacts.md`](docs/research/harness_artifacts.md).
Live betrayal-farm snapshots (dated, numbers change): [`reports/`](reports/).
Docker RHVQ+KAW8 dump: [`reports/docker-2026-08-09.md`](reports/docker-2026-08-09.md) · outcomes **n=122** PNG in [`reports/betrayal-outcomes-by-model-2026-08-07.png`](reports/betrayal-outcomes-by-model-2026-08-07.png).
Qwen PQRS dump: [`reports/qwen3.6-2026-08-09.md`](reports/qwen3.6-2026-08-09.md).
Essay: [Two AI Agents, One Dungeon, One Knife](https://corba777.github.io/amber_coop/two-ai-agents-one-dungeon-one-knife/) (GitHub Pages).

## Where this is going

FREE ROAM, AI DUO, partner errands, TREASON / Relationship Memory, and the
replayable scenario farm are playable. Next major stage (bench-first):
**THE ARCHITECT** — an LLM director on the dungeon's side with a
non-winning "interesting resistance" utility. See `CLAUDE.md` for the full
engineering map and roadmap.

## Credits

Design & code: Artem Zvyagintsev, with an AI pair (Claude).
QA and Contributor: [Alexey Belozerov](https://github.com/abelozerov) — playtesting across
the ocean, latency reports, and the agent-combat tickets that became tests.
Playtesters: family and friends who filed every ticket in this changelog.

MIT license.

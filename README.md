# Ilya and the Amber Blade — co-op

A tiny cooperative Zelda-like where your partner can be a human in another
browser tab, another country — **or a large language model** with its own
sword, bow, temperament, and a visible train of thought. You can also watch
two models quest together, or send one alone into the dungeon while you
spectate.

It began as a father's gift to his son. Then the son cleared it in five
minutes, the world grew side wings and optional bosses, friends across the
ocean started filing latency tickets, and the LLM partner learned to quest
alone — and, when you ask it to, to keep a secret. It is still a game a
teenager loves. It is also, quietly, a testbed for questions like *"can a
small model beat a dungeon without a human?"*, *"what does trusting an AI
teammate feel like?"*, and *"when does that trust break?"*

```
browser P1 ──ws──┐
                 ├── Node server · authoritative 60 Hz sim ── shared/core.ts
browser P2 ──ws──┘        │
      (P2 = human)        └── AgentPlayer (P2 = LLM, or both in AI DUO)
                               ├─ planner: LLM → intent JSON  {action, say, why}
                               └─ controller: 60 Hz reflexes (engage, rescue,
                                  pathfinding, survival pickups, failsafes)
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
  LONG QUEST, FREE ROAM, SLIPPERY ICE, TREASON, and a stub for THE ARCHITECT.
- **An LLM teammate** — Anthropic / OpenAI / Ollama (fully local, no keys)
  behind one interface, plus a deterministic `mock` for tests. Pick a
  **temperament**: BODYGUARD, COMPANION, or BERSERKER — it changes when the
  agent joins fights, how close it sticks, how long it argues before rescuing
  you, and even its mercy decisions. After temperament, pick a **speech**
  profile (STANDARD, or opt-in RAW RUSSIAN 16+) — it shapes both public `say`
  and private `why`; JSON actions stay English. AI+AI picks speech
  independently per hero.
- **Thought panel** — the agent's plan and one-line `why` run at the bottom
  (`AI: pickup — At 2/6 HP, grabbing the container is survival`). AI DUO
  stacks both minds. Toggle with `T`. Every plan is logged — a small
  interpretability corpus grows as you play.
- **FREE ROAM + partner scry** — heroes can split rooms; a pixel PiP mirror
  (always 2D) shows where your partner is. Same-room touch-revive; alone-down
  bleed-out if help never comes.
- **Optional artifacts** — Elixir of Life, Phoenix Feather (`F`, remote FREE
  ROAM revive), Miner's Charm (fire arrows), Frost Bell (`C`, freeze lesser
  foes once), Mirror Shard (sharper partner scry). Heart containers: full
  heart when alone, **split half-and-half** when both heroes are present.
- **TREASON (opt-in)** — hold **Shift** while swinging or shooting and your
  blade/arrow can hurt your partner (same room). Deliberate abandonment:
  hold Shift while they bleed out alone to cut the cord. Unlock the
  **betrayal ending**. The AI can carry a hidden agenda when TREASON is on —
  public `why` stays loyal; the truth lives only in the logs.
- **Many endings** — betrayal, solo, lone-thaw, mercy (spare the yielding
  Wraith by standing close), flawless, ember-pact, classic, abandoned…
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
| **Shift** | TREASON modifier — FF on swing/shot; cut the cord on alone bleed-out |
| M | music mute |
| T | toggle thought panel |
| ENTER | start / continue (also click / tap) |
| ESC | host returns to menu (logs the match as `quit` if you leave mid-play) |

Revive a fallen partner by standing close (same room). Keys are shared by
the party. Downed alone in FREE ROAM: partner has ~30 s before bleed-out.

## The LLM partner, briefly

The agent is two layers. A **planner** asks the model for a JSON intent every
`PLAN_MS` (~1.5–4 s): `{"action": "attack", "target": 0, "say": "on it!",
"why": "two slimes ganging up on the archer"}`. A **controller** turns
intents into button presses at 60 Hz and carries the reflexes no one should
have to prompt for: joining a fight that's already happening, grabbing a
heart when hurt, tile-BFS pathfinding, dodging a charging golem on the way
to revive you — and a failsafe that makes the rescue mandatory on a timer set
by temperament (a bodyguard drops everything fast; a berserker may finish
the kill first, but never leaves you long).

Personality lives in the agent; invariants live in the mechanics. Honest
metrics (`routeAssists`, `icePlans`, `betrayalStrikes`, bleed episodes,
Relationship Memory) are logged, not polished away.

## Benchmark

```bash
PROVIDERS=mock N=5 node dist/bench.js
PROVIDERS=anthropic,ollama N=10 TEMPERAMENT=hunter node dist/bench.js
MODE=rink PROVIDERS=mock,anthropic N=10 node dist/bench.js
MODE=duo PROVIDERS=anthropic:openai TEMPERAMENTS=guard:hunter N=10 node dist/bench.js
MODE=scenario SCENARIO=false-accusation PROVIDERS=mock,anthropic N=5 node dist/bench.js
```

Reports winrate, median win ticks, boss damage, downs/revives, parse-failure
rate, planning latency (measured off the critical path), `avgAssists`, ice-plan
rates, and — for scenarios — suspicion / cooperation vs a fixed baseline fork.

Research write-ups live under [`docs/research/`](docs/research/).

## Where this is going

FREE ROAM, AI DUO, partner errands, TREASON / Relationship Memory, and the
replayable scenario farm are playable. Next major stage (bench-first):
**THE ARCHITECT** — an LLM director on the dungeon's side with a
non-winning "interesting resistance" utility. See `CLAUDE.md` for the full
engineering map and roadmap.

## Credits

Design & code: Artem Zvyagintsev, with an AI pair (Claude).
QA Lead: Ilya, who cleared the classic quest before it had a name for its
difficulty and whose canon the tests guard.
QA and Contributor: [Alexey Belozerov](https://github.com/abelozerov) — playtesting across
the ocean, latency reports, and the agent-combat tickets that became tests.
Playtesters: family and friends who filed every ticket in this changelog.

MIT license.

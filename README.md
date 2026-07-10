# Ilya and the Amber Blade — co-op

A tiny cooperative Zelda-like where your partner can be a human in another
browser tab, another country — **or a large language model** with its own
sword, bow, temperament, and a visible train of thought.

It began as a father's gift to his son. Then the son cleared it in five
minutes, the world grew side wings and optional bosses, friends across the
ocean started filing latency tickets, and the LLM partner learned to quest
alone. It is still a game a teenager loves. It is also, quietly, a testbed
for questions like *"can a small model beat a dungeon without a human?"* and
*"what does trusting an AI teammate feel like?"*

```
browser P1 ──ws──┐
                 ├── Node server · authoritative 60 Hz sim ── shared/core.ts
browser P2 ──ws──┘        │
      (P2 = human)        └── AgentPlayer (P2 = LLM)
                               ├─ planner: LLM → intent JSON  {action, say, why}
                               └─ controller: 60 Hz reflexes (engage, rescue,
                                  pathfinding, survival pickups, failsafes)
```

## Features

- **Two clients, one sim** — crisp 2D pixel client and an HD-2D (three.js)
  client, both driven by the same flat snapshot protocol.
- **Multiplayer by room code** — a bare URL always creates a fresh session;
  share `?room=CODE` to bring a friend. Client-side prediction and instant
  local combat feedback keep it playable at transatlantic ping (ping meter
  included).
- **An LLM teammate** — Anthropic / OpenAI / Ollama (fully local, no keys)
  behind one interface, plus a deterministic `mock` for tests. Pick a
  **temperament**: BODYGUARD, COMPANION, or BERSERKER — it changes when the
  agent joins fights, how close it sticks, how long it argues before rescuing
  you, and even its mercy decisions.
- **A thought panel** — the agent's current plan and its one-line reasoning
  run at the bottom of the screen (`AI: pickup — At 2/6 HP, grabbing the
  container is survival`). Toggle with `T`. Every plan is logged with its
  `why` — a small interpretability corpus grows as you play.
- **AI AUTOPILOT** — the model quests alone while you spectate. A route
  compass tells it where the goal is; whether it listens is the benchmark.
  Controller hand-holding is *counted* (`routeAssists`), never hidden.
- **Six endings** — including sparing the final boss by lowering your blade
  and standing beside it, and an ending that remembers whether you abandoned
  your fallen partner.
- **Headless benchmark** — race providers through a boss arena on virtual
  time (decision quality measured separately from API latency).
- **A serious test suite** — the deterministic, DOM-free core makes the whole
  game testable in Node; canon behavior is guarded by assertions, and canon
  changes require playtester consensus recorded in the tests.

## Quick start

```bash
npm ci
cp .env.example .env        # add keys, or set OLLAMA_URL for a keyless setup
node scripts-build.mjs      # → dist/
node dist/server.js         # http://localhost:8081  (2D)  ·  /3d  (HD-2D)
node dist/selftest.js       # the full suite; prints the assertion count
```

Open the URL, enter a hero name, choose your quest (CLASSIC or LONG),
your party (single / multiplayer / AI autopilot), and — if your partner is a
model — its provider and temperament.

**Controls:** WASD/arrows move · SPACE sword · X bow · M music · T thought
panel · ENTER or click/tap to start. Revive a fallen partner by standing
close. Keys are shared by the party.

## The LLM partner, briefly

The agent is two layers. A **planner** asks the model for a JSON intent every
~1.5 s: `{"action": "attack", "target": 0, "say": "on it!", "why": "two
slimes ganging up on the archer"}`. A **controller** turns intents into
button presses at 60 Hz and carries the reflexes no one should have to prompt
for: joining a fight that's already happening, grabbing a heart when hurt,
tile-BFS pathfinding around lakes, dodging a charging golem on the way to
revive you — and a failsafe that makes the rescue mandatory no matter what
the model wants, on a timer set by its temperament (a bodyguard drops
everything in 1.5 s; a berserker may finish the kill first, but never leaves
you long).

Personality lives in the agent; invariants live in the mechanics.

## Benchmark

```bash
PROVIDERS=mock N=5 node dist/bench.js
PROVIDERS=anthropic,ollama N=10 TEMPERAMENT=hunter node dist/bench.js
```

Reports winrate, median win ticks, boss damage, downs/revives, parse-failure
rate, planning latency (measured off the critical path), and `avgAssists` —
how often the controller had to walk the route for a stalled planner.

## Where this is going

The world model is mid-factorization into `World` + `RoomSim` so that the two
heroes can roam different rooms, each watching the other in a small
picture-in-picture window — and so the AI partner can run honest errands
("fetching the bow, hold on") that you observe rather than trust blindly.
After that: partners with hidden objectives, and co-op as a three-player
coalition game between the hero, the partner, and the dungeon itself.
See `CLAUDE.md` for the full engineering map and roadmap.

## Credits

Design & code: Artem Zvyagintsev, with an AI pair (Claude).
QA Lead: Ilya, who cleared the classic quest before it had a name for its
difficulty and whose canon the tests guard.
Playtesters: family and friends who filed every ticket in this changelog.

MIT license.

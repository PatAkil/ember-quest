# Ember Quest

A roguelike JRPG — branching node map per act, turn-based one-on-one battles,
skill points, a loot table of named items, permadeath. TypeScript + Canvas 2D,
no framework. This repo holds **one game**; it was forked out of Retrovibe so
the game can grow on its own. Live at **https://patakil.github.io/ember-quest/**.

## Repo map

```
ember-quest/
├── DESIGN.md                 # the systems contract — read FIRST for any mechanics work
├── STYLE.md                  # the visual style card — read FIRST for any look work
├── HANDOVER.md               # where the work stands between cloud tasks
├── game/
│   ├── types.ts              # shared types + tuning constants (caps, SP gains, drop rates) — headless
│   ├── data.ts               # content import path: re-exports game/rules/* — headless
│   ├── rules/                # the content itself — headless
│   │   ├── items.ts          #   ITEMS
│   │   ├── enemies.ts        #   ENEMIES (incl. THE HOLLOW, descent-only), HOLLOW_ID, DESCENT_ONLY
│   │   ├── world.ts          #   SPELLS, SPELL_ORDER, BIOMES, ACT_MULT, LOOT_WEIGHTS/COUNT, heal constants, rarity colours
│   │   ├── events.ts         #   EVENTS, the event effect vocabulary, validateEvents
│   │   ├── pacts.ts          #   PACTS (curse, boon, PactMod values), validatePacts
│   │   └── validate.ts       #   validateData (never imports data.ts)
│   ├── sim.ts                # barrel: the one import path for rules — headless
│   ├── sim/                  # pure rules + balance policies, one concern per file — headless
│   │   ├── util.ts           #   clamp, at, rng picks, createSeededRng (mulberry32 + state), the ItemEffect table helper
│   │   ├── gear.ts           #   item levels, upgrades, effective mods/effects/blurbs
│   │   ├── hero.ts           #   createHero, derive, skill points, heals, equip, spells
│   │   ├── ghost.ts          #   derived stats of a hypothetical equip (compare previews)
│   │   ├── describe.ts       #   item / offer / compare text for the screens, compareFull (every changed stat, LOSE/GAIN)
│   │   ├── loot.ts           #   rollLoot, applyOffer, resolveUpgrade, missed scrolls
│   │   ├── pack.ts           #   the 4-item pack: stow, discard, swapIn, unequip, ownedIds, upgradableTargets
│   │   ├── combat.ts         #   spawnEnemy, createBattle, heroAct (ATTACK + spells), damage, effects in battle
│   │   ├── commands.ts       #   GUARD, POTION, BURST and the BREAK settle
│   │   ├── enemy-turn.ts     #   enemyAct: moves, intent, cycle, phase switch
│   │   ├── status.ts         #   startTurn (regen, BLOOD, BURN ticks), BURN, WARD, heroFalls
│   │   ├── element.ts        #   elementMult (weakness / resistance)
│   │   ├── burst.ts          #   ember gain, canBurst, the burst blow
│   │   ├── map.ts            #   the one map generator, generateMap(rng, shape?) — game and simulator
│   │   ├── model.ts          #   Policy (incl. stowOrEquip, dropWhich, upgradeTarget, prepare), RoomType (with BOSS)
│   │   ├── scoring.ts        #   how policies value a loot offer
│   │   ├── policies.ts       #   POLICIES (random, balanced, glass, tank, routing archetypes)
│   │   ├── policy-battle.ts  #   how the policies fight (damageAct, expected damage)
│   │   ├── policy-choices.ts #   DEFAULT_CHOICES: the shared pack/upgrade/prepare defaults every policy spreads
│   │   ├── descent.ts        #   the stage counter n: depthOf, actInDepth, actMult, ActPlan, planDepth, planOf
│   │   ├── affixes.ts        #   enemy affixes: ARMORED/WARDED resists, VAMPIRIC/THORNED/SWIFT/SEARING values
│   │   ├── hollow.ts         #   THE HOLLOW (hollowOf) and spawnFoe, the one spawn path for game and simulator
│   │   ├── pacts.ts          #   pactMods (folded PactMod totals), offerPacts, takePact
│   │   ├── score.ts          #   scoreOf, gloryBonus, scoreAfterDeath
│   │   └── run.ts            #   simulateRun (options.descend, off by default), RunResult, Probe
│   ├── main.ts               # wiring only: app, game state, scene hooks, dev hook, loop
│   ├── app.ts                # creates the engine objects (canvas, input, scenes, particles, juice, audio, CRT, runtime)
│   ├── state.ts              # the Game type + createGame(): one object `g` with per-screen slices
│   ├── flow.ts               # run flow: room selection, stage advance, clears, act change, THRESHOLD (ascend/descend), depth entry + PACT, startRun, scene hooks
│   ├── frame.ts              # update/render dispatch tables per scene and sub-scene
│   ├── fx-state.ts           # battle-fx data: actors, moves, tints, shots, cues, lagging meters, banner, screen-reveal state
│   ├── fx.ts                 # battle-fx clock: eased actor poses, cue queue (skip to impact), meters, boss banner timing
│   ├── transition.ts         # screen reveal between sub-scenes (blinds into battle, wipe elsewhere)
│   ├── mapgen.ts             # adapter: the shared map + stage/slot/cleared for the screens
│   ├── theme.ts              # colours, biome looks, layout constants
│   ├── backdrop.ts           # biome backdrops, floor, actors, battle tableau
│   ├── widgets.ts            # bars, lines, fitted/wrapped text, blinkHz/accentHz, item icons
│   ├── pops.ts               # floating damage/score pops
│   ├── storage.ts            # best score in localStorage
│   ├── lookup.ts             # at, pickOneIndex (re-exported from sim), must, noop — guarded indexed access
│   ├── screens/              # one update + one view per screen: battle/battle-view, map/map-view, loot/loot-view, levelup, card, status (map status panel), gear/gear-view (GEAR: worn slots + pack, B on the map), pick/pick-view (PICK: the shared chooser, e.g. UPGRADE WHICH?), threshold/threshold-view (THRESHOLD: ASCEND or DESCEND), pact/pact-view (PACT: one of up to three pacts), title (title, pause, endings)
│   │   ├── battle-fx.ts      #   choreography of a turn: wind-ups, impacts, pops, regen aura, defeat, entrance, death
│   │   ├── battle-fx-view.ts #   draws the shots (orbs, bolts, slashes, blooms …) and the boss/elite banner strip
│   │   ├── battle-fx-verbs.ts #  the beat of each battle verb: guard, parry, break, burst, potion, burn tick, phase, weak
│   │   ├── battle-menu.ts    #   the command menu: draw, cursor, choice
│   │   ├── battle-tags.ts    #   the tag strips under the plates (RAMP, BURN, WARD, weakness …)
│   │   ├── battle-reach.ts   #   lunge distances and contact points between the knight and the foe
│   │   ├── map-view.ts       #   map nodes with room icons, edges and lit path, hero marker
│   │   └── plate.ts          #   rarity rings, medallions and centred icons shared by loot and card
│   ├── sprites.ts            # single entry point: re-exports game/sprites/*, adds enemyAnim(id)
│   ├── sprites/              # helpers, hero, icons, and one file per biome (crypt, tundra, desert, temple)
│   └── devhook.ts            # dev-only seeded hook (?seed, ?scene, &act, &hold, window.__ember)
├── engine/                   # this game's OWN copy of the Retrovibe engine — editable
├── scripts/
│   ├── setup-eyes.mjs        # npm run setup — browser + dev server, idempotent
│   ├── look.mjs              # npm run look — state JSON + errors + one screenshot
│   ├── verify.mjs            # npm run verify — every gate, one line each
│   ├── rules.mjs             # npm run rules — node:assert invariants against the rules bundle
│   ├── oracle.mjs            # behaviour-preservation proof for refactors
│   ├── oracle-comment.mjs    # CI: turns the PR-vs-base oracle into one sticky PR comment
│   ├── agent-feedback.mjs    # the hook entry: per-edit check, end-of-turn gate, pre-commit gate (npm run gate)
│   ├── feedback-*.mjs        #   its state/fingerprint, checks, edit, stop and gate modules
│   └── install-git-hooks.mjs # npm prepare: sets core.hooksPath=.githooks
├── .githooks/pre-commit      # refuses to commit a tree that fails the gate
├── tools/eslint-no-comments.mjs   # the local no-comments lint rule
├── eslint.config.mjs, knip.config.js, .jscpd.json, .dependency-cruiser.cjs   # the lint suite
├── sim/run.mjs               # balance simulator runner (npm run sim)
├── sim/bundle.mjs            # esbuild bundling of game/sim.ts, shared by sim/run.mjs and scripts/rules.mjs
├── smoke.mjs                 # headless boot gate (npm run smoke)
├── index.html                # arcade shell; game mounts into #screen
├── .github/workflows/pages.yml   # PR = full gates + pixel report (a PR comment with before/after shots; images live on the `oracle-screens` branch); push to main = gates, then deploy
└── .claude/                  # settings.json (the hooks below), ten skills, agents/game-writer.md
```

## Conventions

- **Commands run at the repo root**: `dev` (Vite, port 5173, strictPort), `check`
  (`tsc --noEmit`), `lint`, `lint:full`, `build`, `smoke`, `rules`, `sim`, `sim:quick`,
  `setup`, `look`, `verify`, `gate` (verify + remember the green tree), `browse`
  (agent-browser).
- **Eyes first.** A SessionStart hook in `.claude/settings.json` runs `npm run setup`
  in the background on the cloud box (seen firing in a fresh `claude -p` session here on
  2026-11-22); if `/tmp/ember-eyes.json` is missing or does not say `"ready":true`,
  run `npm run setup` yourself. It is idempotent (a second run returns in well under a
  second): it installs `node_modules` if needed, extracts Chromium from the
  `@sparticuz/chromium` devDependency to `/tmp/chromium`, writes the wrapper
  `/tmp/ember-chromium` (plain `--headless=shell --no-sandbox --disable-gpu` flags,
  bundled libraries via `LD_LIBRARY_PATH`), starts the dev server if port 5173 does
  not answer, proves a launch, and writes the marker. Its log is `/tmp/ember-setup.log`,
  the dev server's is `/tmp/ember-dev.log`.
- **Dev server**: one, on 5173, left up all session — every save hot-reloads. Setup
  starts it; never start a second one and never kill it to "reset" (a teammate may be
  using it). `lsof` and `ss` are not installed and `pkill -f` kills your own shell; the
  pid is `ps -eo pid,args | awk '$2=="node" && /vite/ {print $1}'`. Only on an explicit
  "stop the server" pipe that into `xargs -r kill`.
- **Look before you report.** `npm run look -- --scene battle --act 2 --seed 7` prints one
  JSON line (`ok`, the game `state`, console/page `errors`, the screenshot path) in under
  a second; read the state first and the screenshot whenever the look changed. Scenes:
  `title map battle levelup loot card paused gameover win gear pick drop battle-heavy battle-magic battle-ward battle-phase event threshold pact`; acts 1–4, depths 1–10 (`--depth`). Claude may say what
  it saw; the owner remains the playtester for feel — report "builds, boots clean,
  ready to play at <URL>", never "playtested".
- **Done means**: `npm run check` and `npm run lint` after every edit (or `npx eslint
  <files>` for the files you touched) — the hooks below now do the per-edit part and the
  end-of-turn `verify` automatically, and the pre-commit hook refuses a red tree;
  `npm run verify` green before a commit;
  `npm run verify -- --full` before a release or after a structural change; `npm run sim`
  reviewed whenever rules or numbers moved; for a refactor that must not change
  behaviour, the oracle (below) and `node sim/run.mjs --json` both identical.
- **No comments, anywhere.** `//`, `/* */` and JSDoc are lint errors in every linted
  file (`tools/eslint-no-comments.mjs`; only a shebang survives). Intent goes into names,
  types and small functions; the why goes into `DESIGN.md` or `STYLE.md`.
- **Commit at green milestones, unsigned** — never add `-S` (this box has no signing
  configured). Message = what changed for the player. `git add -A` is fine here: the
  repo is the game.
- **Push = release.** Only through **releasing-the-game**, only after the gates.
- **Headless boundary**: `game/types.ts`, `game/data.ts`, `game/rules/*`, `game/sim.ts` and `game/sim/*`
  never import the engine, presentation modules or the DOM, and never call
  `Math.random` (rules take an injected `rng`). Rules live in `game/sim/`; presentation
  imports them only through the barrel `game/sim.ts`. Lint and dependency-cruiser both
  enforce this — break it and the simulator stops bundling.
- **No console in game or engine code** (`no-console` is an error there). A real fault
  goes through `reportError(new Error(...))`, which surfaces as a page error, so `look`,
  `smoke` and `verify` fail on it — `validateData()` violations and an unknown `?scene=`
  value already do this.
- **DESIGN.md moves with the code.** A rules change edits the contract in the same
  milestone; a balance pass updates the *Balance state* table and its date. A look
  change that alters a style-card decision edits `STYLE.md` in the same milestone.
- **Engine edits are allowed** — the engine here is a fork owned by this game.
  New primitives go into the owning module, are re-exported from `engine/index.ts`,
  and are added to the API table below in the same change. Game code imports the engine
  only through the barrel (`'../engine'` from `game/`, `'../../engine'` from
  `game/screens/` and `game/sprites/`); the engine never imports game code.

## Agent eyes

| Command | What it does |
|---|---|
| `npm run setup` | Browser + dev server, idempotent; prints `eyes: ready - … \| chromium /tmp/ember-chromium \| dev <url>`; marker `/tmp/ember-eyes.json` (`url` is the public exposed-port URL when `JBCENTRAL_EXPOSED_PORT_URL_5173` is set, else `http://localhost:5173/`). `--force` redoes everything |
| `npm run look -- [--scene S] [--act N] [--depth D] [--seed N] [--keys "Down,Space"] [--steps N] [--out file.png] [--no-shot]` | One JSON line `{"ok","state","errors","shot"}`; exit 1 on any console/page error or no canvas. With `--scene` or `--seed` the page runs in hold mode and each key is followed by `--steps` (default 30) fixed ticks. Keys: `Up Down Left Right Space B Esc Enter` (`B`/`X` = button B) or Playwright names (`ArrowDown`, `KeyZ`, `KeyX`, `KeyP`). Default shot: `$AIR_ARTIFACTS_DIR/look/<scene>-a<act>-s<seed>.png` (`<scene>-d<depth>-a…` when `--depth` > 1), else `/tmp/ember-look/` |
| `npm run verify` | eyes, lint, check, build, smoke, rules (map invariants over 5000 seeds, seeded-rng determinism, `validateData`), `sim:quick` (informational: balanced and random win rates), two at a time; one `PASS/FAIL/INFO` line per gate with its time, then `TOTAL`. About 10 s |
| `npm run verify -- --full` | adds knip, jscpd, depcruise, `dist:no-hook` (no `__ember` in `dist/`), `look:all` (every scene), and the full sim. About 30 s |
| `node scripts/oracle.mjs --save <file>` / `--check <file>` | 96 cases (12 scenes × 4 acts × still / after `Down,Space,Space,Down,Space`, seed 7): sha256 of the state JSON and of the exact screenshot. `--check` prints `ORACLE OK` or lists each differing case as `(state)` or `(pixels)`. Save before a refactor, check after. Needs the dev server; about 80 s |
| `npm run browse -- <command>` (or `npx agent-browser`) | Free-form interactive exploration (`open <url>`, `press Space`, `screenshot <file>`, `errors`, `eval <js>`, `close`). Export `AGENT_BROWSER_EXECUTABLE_PATH=/tmp/ember-chromium` first (setup writes it into `CLAUDE_ENV_FILE` when the harness provides one) |

`smoke.mjs`, `look.mjs` and `oracle.mjs` use `/tmp/ember-chromium` automatically when
`CHROMIUM_PATH` is unset and the wrapper exists; `SMOKE_URL` / `LOOK_URL` override the
target. `npx playwright install chromium` is blocked in this environment — never needed.

**Dev hook** (`game/devhook.ts`, installed only when `import.meta.env.DEV`; absent from
the build, which `verify --full` proves). URL parameters: `?seed=<uint>` routes every
random decision in the game through one seeded PRNG (absent → a real run draws a random
seed at `startRun` and plays the same seeded generator, `createSeededRng`; the hook's rng,
marked by `g.rngFromHook`, always wins); `?scene=<name>&act=<1..4>&depth=<1..10>` boots straight into that screen with a
deterministic fixture (seed defaults to 1) at stage `n = 4(depth − 1) + act − 1`; below depth 1
the fixture holds the depth plan, `won`, the banked score and one pact per depth entered;
`threshold` stops on the THRESHOLD after the depth's last boss, `win` ascends from it, and `pact`
descends into `depth` (from the depth above it); `&hold=1` also seeds `Math.random` (ambient,
shake) and stops the rAF loop from ticking or drawing, so frames advance only through
the hook — this is what makes screenshots pixel-identical. In the page:
`window.__ember.state()` (JSON: scene, subScene, act (= actInDepth + 1), n, depth, actInDepth, seed, cursor,
won, banked, bosses, biome, hero, derived, enemy, clears, score, and the
battle/loot/card/gear/pick/event/threshold/pact/map slice of the current sub-scene),
`step(n)` (n fixed ticks synchronously, one render, returns the state) and
`press('A' | 'B' | 'PAUSE' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT')` (one edge press on the next tick).

## Automatic feedback (hooks)

Deterministic, not remembered: `.claude/settings.json` wires `scripts/agent-feedback.mjs`
into every Claude Code session and subagent in this repo, and `.githooks/pre-commit` into
git. All of it reads `.git/ember-feedback/` (state, incremental `tsc` info, `events.log`
— one JSON line per hook run, the place to check that hooks fire).

| When | What runs | Effect |
|---|---|---|
| SessionStart / SubagentStart | `session-start` / `subagent-start` | records the tree fingerprint and a file snapshot for this session or agent (~50 ms) |
| after every Bash, Edit, Write, MultiEdit, NotebookEdit call (PostToolUse and PostToolUseFailure) | `edit` | stats the tracked + untracked non-ignored files against this agent's last snapshot; no change costs ~40 ms (node start-up). Changed files the agent can be credited with get `eslint` (uncached, those files only) and, for `game/`, `engine/`, `vite.config.ts`, an incremental `tsc` in parallel, ~2–3 s. Errors → exit 2: the model must read and fix them |
| main agent stops (Stop), subagent stops (SubagentStop) | `stop` | if gated files (everything except `*.md`, `.claude/`, `.github/`, `.githooks/`) changed this session and the tree is not the remembered green one, runs `npm run verify` (~14 s) and blocks with its failing gates. Green trees are remembered by content fingerprint, so a repeat stop is ~40 ms |
| `git commit` | `.githooks/pre-commit` → `precommit` | first refuses if any gated file is unstaged or untracked (the verified tree must be the committed tree: stage, or `git stash --keep-index --include-untracked`), then runs the same gate; refuses a red tree; a just-verified tree commits instantly. `npm run gate` runs it by hand and remembers a green result |

- **Fix what the hooks report.** Per-edit feedback names file, line and rule. The stop
  gate blocks at most 3 times in a row, and lets go at once when nothing changed since
  its last block; it then says so to the user — the tree is still red and the commit
  hook will refuse it.
- **Parallel writers.** Changes are credited per agent: the file an Edit/Write names, a
  file the Bash command names, or (Bash only) a file modified during that call that no
  other agent claimed in the last 20 min. A writer is never blocked on another writer's
  file. `tsc` errors in files it did not touch block only when it works alone; with other
  agents active they arrive as non-blocking context. A subagent that stops while other
  subagents run gets the scoped check (its own files), not the whole-tree `verify`; the
  main agent's gate is deferred while background agents or tasks run. Limits: a Bash
  script that edits files without naming them, run at the same moment as another
  writer's edit, can credit either writer; the whole-tree gate still judges everyone at
  the end.
- **Degrades, never hangs.** Every hook has a timeout (60 s edit, 600 s stop) and a
  watchdog; without `node_modules` it says so once and steps aside; when only the
  browser gates fail and the eyes are not ready it releases with a message. Off Linux the
  gate is `lint + check + build` (smoke needs the Linux browser).
- **The commit hook** is enabled per clone by `npm ci` / `npm install` (the `prepare`
  script sets `core.hooksPath=.githooks`; skipped when `CI` or `EMBER_NO_GIT_HOOKS` is
  set, and it leaves an existing `core.hooksPath` or own `pre-commit` alone). Bypass in
  an emergency (owner only): `git commit --no-verify`. `smoke` targets the one dev
  server on 5173, so in a worktree or second clone it smokes the main checkout's server.

## Lint suite and thresholds

Owner-approved and fixed: no suppressions, no `eslint-disable` (inline config is off and
unused directives are errors), no baseline files, no new per-file overrides, no loosened
numbers. **Fix the code, never the config.** If a rule seems genuinely wrong for a case,
stop and report it.

| Gate | Rule |
|---|---|
| `npm run lint` (ESLint, typescript-eslint strict + stylistic, type-checked; uncached) | no comments · `complexity` 10 · `max-depth` 4 · `max-params` 4 · `max-lines` 400 per file (blank lines skipped) · `max-lines-per-function` 80 (blank lines skipped) · `max-nested-callbacks` 3 · `eqeqeq` · `curly` · template literals take numbers and strings only (`String(x)` otherwise) · `no-console` in `game/` and `engine/` · headless and barrel import boundaries |
| naming convention | camelCase by default; module-level `const` may be UPPER_CASE; types PascalCase; object and type properties camelCase or UPPER_CASE (quoted keys and DOM key codes such as `ArrowUp` are free) |
| `tsconfig.json` | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` |
| knip (`lint:full`) | no unused files, exports or dependencies. The skills and this file count as entries: an engine export cited in their code is "used" |
| jscpd (`lint:full`) | zero duplicated blocks (50 tokens / 5 lines) across `game engine scripts sim` |
| dependency-cruiser (`lint:full`) | no cycles, no orphans, headless stays headless, game → engine only via `engine/index.ts`, engine never imports game |

Working within them:

- **Lookup tables over long switches.** A `Record<Union, …>` of values or handlers is
  one line per case and complexity 1 (`frame.ts`, `TUNE` in `engine/ambient.ts`,
  `onEffect`'s `EffectTable` in `game/sim/util.ts`); it is also exhaustive by type.
- **Option and geometry objects over long parameter lists.** Past four parameters,
  group them: `{x, y}`, `{x, y, w, h}`, a style object, or a context object
  (`FixtureContext` in the dev hook).
- **Guard indexed access honestly.** `at(list, i)` / `must(value, what)` from
  `game/lookup.ts` throw a clear error; fixed-length tuples (the palettes) index to a
  plain `string`. Never `!` or a cast to silence the flag.
- **Split along natural seams** — a screen's update vs its view, one biome's sprites per
  file, one rules concern per `game/sim/` file — not at arbitrary line counts. A new
  file must be imported by something (no orphans) and must not form a cycle.

## Skill routing

| Request | Skill |
|---|---|
| any edit to the game (default) | `iterating-on-a-game` |
| new or reshaped system, "more replayable", "longer runs" | `designing-mechanics` — discuss, decide, then contract in DESIGN.md |
| rules / numbers / items / enemies changed, "too easy", "too hard" | `balancing-with-the-simulator` |
| look, "go wild", flat or off-brand visuals | `ensuring-arcade-visuals` |
| pre-handoff feel & correctness pass | `improving-game-quality` |
| controls, labels, pressed/held semantics | `handling-user-input` |
| scene transitions, score, win/lose reporting | `messaging-game-over` |
| secrets, cheat codes, palette unlocks | `adding-easter-egg` |
| play / run / try; the runtime gate | `playing-the-game` |
| ship / publish / "let my brother play it" | `releasing-the-game` |

## Models & orchestration

`.claude/agents/game-writer.md` (Sonnet-class) writes code in milestone saves with
`npm run check` and lint after each, and may run `npm run verify` and `npm run look`
itself. The orchestrator owns git, the release, `verify -- --full`, the oracle and the
balance decisions. **Escalation rule**: if check, lint or smoke fails twice on the same
approach, escalate the writer one tier (Sonnet → Opus) for a fresh attempt. **Design
first**: mechanics changes go through `designing-mechanics` and a decision by the user
before code moves; parallel writers are fine once the contract is written, split by
module (`data.ts` + `game/sim/` vs sprites + screens) so they do not collide. Parallel
writers share one tree and one dev server: each edits only its own files, checks its own
files (`npx tsc --noEmit 2>&1 | grep '^<dir>'`, `npx eslint <files>`) while the others
are mid-change, never kills or restarts the server, and leaves the whole-tree gates to
the orchestrator once everyone reports done. The hooks (*Automatic feedback*) apply the
same split on their own: per-agent feedback while others run, the whole-tree `verify`
when the last one stops. Name each writer's files in its brief so its Bash edits name
them too — that is how the hooks credit a change to the right writer.

## Engine API (this game's copy — authoritative surface is `engine/index.ts`)

Geometry arguments are plain object literals: a point `{x, y}`, a rect `{x, y, w, h}`, a
centred row `{width, y}` (the types `Point`, `Rect`, `CenterRow` live in
`engine/geometry.ts` and are not re-exported). Rects snap to whole logical pixels;
a zero or negative size draws nothing.

| Module | Key exports | Purpose |
|---|---|---|
| loop.ts | `createLoop({update, render}, {step?, maxFrame?})` → `.start()/.stop()/.running` | Fixed-timestep accumulator (`step` 1/60 s); frame-delta clamp `maxFrame` 0.25 s; throws `RangeError` when either is not a positive finite number. Pauses on blur / hidden tab (keeps calling `render(0)`), resets the clock on focus |
| input.ts | `createInput(actions, {onFirstKey, target})`, `controlHints(input)`, `BUTTON_KEY`; types `Input`, `InputOptions`, `ButtonName`, `ActionDecl` | Arrows/WASD → `input.dir`; buttons A = Space/Z, B = X/C, PAUSE = P/Esc (dedicated, aliased — down while ≥1 alias down); `pressed/held/released`, `endFrame()` per tick, `actions`, `dispose()`; labels declared in code |
| scenes.ts | `createScenes(initial = 'TITLE', {onIllegal})` → `.current/.is/.to/.onEnter`; type `SceneMachine` | Enforced machine `TITLE → PLAYING ⇄ PAUSED → (GAME_OVER \| WIN) → restart`; `PLAYING → PLAYING` and `PAUSED → TITLE` allowed. `to()` returns `false` on an illegal move and calls `onIllegal(from, to)` if given — it never writes to the console |
| canvas.ts | `createPixelCanvas({width, height, scale = 3, parent})` → `{canvas, ctx, width, height, scale, resize(scale), clear(color)}`; `fitDisplay(logical, area, maxBacking = 6)` → `{backing, display}`; `autoFit(pc, available, maxBacking = 6)` → detach; types `PixelCanvas`, `FitArea`, `DisplayFit` | Pixel-scaled canvas, smoothing off, scale baked into the transform; throws when `parent` is `null`, and a `RangeError` when a scale is not a positive integer (no silent flooring). `width/height` stay logical; `resize` re-creates the backing store at `width*scale × height*scale` and re-applies transform + smoothing — call it outside a frame. `fitDisplay` picks the displayed size in CSS px per logical px for `area` (no devicePixelRatio): the largest whole number down to 1, the backing equal to it up to `maxBacking`; above the cap a whole-number CSS enlargement of a backing in `[ceil(cap/2), cap]` (largest product, then largest backing: 13 → 6×2, 8 → 4×2, 7 → 6×1); below 1 (area under the logical size) backing 1 and a fractional CSS shrink so nothing clips. `autoFit` applies it now and on every window `resize` (backing via `resize`, display via the canvas's CSS width/height); detach removes the listener and the CSS size |
| sprite.ts | `makeSprite(rows, map, {outline, flipX})`, `flipSprite`, `rotateSprite(sprite, radians)`, `drawSprite(ctx, sprite, {x, y}, px \| {px, tint, tintKeep, dissolve, fringe, fall, seed} = 1)`; types `Sprite`, `SpriteMap`, `SpriteDrawOptions` | ASCII-art sprites; `.`/space/unmapped chars are transparent. `outline` bakes a 1-cell keyline (sprite grows 1 cell per side — use the inner size for hitboxes). `rotateSprite` returns a new nearest-neighbour rotated sprite on a grown canvas. `drawSprite` takes a number (cell size) or `SpriteDrawOptions`: `px` cell size (1), `tint` one colour for every cell (hit flash), `tintKeep` a colour whose cells keep their own ink while tinted (the black keyline), `dissolve` 0..1 eats cells in a seeded order, top rows first, the last quarter of each cell's life drawn in `fringe` and dropped up to `fall` cells (eased), `seed` the dissolve pattern |
| anim.ts | `frameIndex(time, fps, count)`, `blink(time, period = 0.9, onRatio = 0.6)` → 1/0, `pulse(time, period = 1.2)` → 0..1 | Clock-driven animation helpers |
| font.ts | (internal) | 3×5 bitmap font, M and W 5 wide |
| text.ts | `drawText(ctx, text, {x, y}, opts)`, `drawTextCentered(ctx, text, {width, y}, opts)`, `textWidth(text, scale = 1, spacing = 1)`, `drawLogo(ctx, text, {width, y}, {color, shade, shadow, scale = 3, spacing, shadowOffset = 1})`; type `TextOptions` | Proportional bitmap text, uppercased. `TextOptions`: `color`, `scale`, `spacing`, `shadow`/`outline` (bool or color; outline drawn only at `scale >= 3`, degrades to a shadow below). `drawTextCentered` asks for an outline by default at `scale >= 2` unless `shadow` is given. `drawLogo` is a two-tone lit-from-above wordmark; `color` is REQUIRED (it throws), from the palette |
| fills.ts | `fillBands(ctx, rect, colors)`, `fillDither(ctx, rect, {colorA, colorB, pattern})`, `drawBevel(ctx, rect, {fill, light, dark})`, `drawFrame(ctx, rect, {color, thickness = 1})` | Horizontal bands; 4×4 ordered dither (`'checker'` 50 %, the default, or `'sparse'` 25 %; cached per context); slab with light top/left and dark bottom/right; hollow border |
| palette.ts | `PICO8`, `GAMEBOY`, `DUSK`, `NEON`, `SUNSET`, `OCEAN`, `PALETTES`, `swapPalette`, `contrast`; type `Palette` | Curated palettes as fixed-length tuples (16 / 4 / 8 / 8 / 8 / 8), so `PICO8[7]` is a `string`; anything typed `Palette` (`readonly string[]`, e.g. a `swapPalette` result) indexes to `string \| undefined`. `contrast(a, b)` legality: actors ≥3:1 vs static surfaces, ≥4.5:1 authored on any non-black ground (the CRT lift eats ~1.4×); ambient 1.8–2.5:1 band |
| ambient.ts | (internal) | Ambient presets built as 2–3 depth layers with per-particle twinkle and clumping |
| particles.ts | `createParticles({width, height, ambient, ambientCount = 48, ambientColor})` → `.update/.render/.burst(x, y, opts)/.setAmbient(preset, color?)`; types `AmbientPreset`, `BurstOptions` | Ambient layer (stars/rain/snow/embers/bubbles) plus 2–3 px impact bursts (`count` 8, `speed` 90, `life` 0.5 defaults) |
| juice.ts | `createJuice()` → `.shake/.flash/.hitStop/.frozen/.update/.preRender/.postRender` | Screen shake (rounded to whole logical px), flash, hit-stop. Order: clear → `preRender` → world → `postRender` → CRT. `flash(color, duration, origin?)`: uniform overlay peaking at 0.55 alpha, or with `origin` (`{x, y}` logical px) a RADIAL flash centred on the impact (0.75 alpha at centre, transparent at 0.55× the larger frame dimension). Pass the origin on DEATH flashes; WIN/pickup flashes stay uniform |
| audio.ts | `createAudio()` → `.unlock/.play/.ready`; type `Sfx` | WebAudio chiptune sfx (`jump/pickup/explosion/hit/blip/whoosh` — `whoosh` a short noise rush for lunges and swings); `unlock()` inside the first user gesture; `play` before unlock is a silent no-op |
| ui.ts | `SAFE_MARGIN` (8), `drawScore(pc, score, opts)`, `drawLives(pc, lives, opts)`, `hudText(pc, text, {h, v}, {color, scale, shadow, plate})`, `drawPanel(pc, rect, {color, border})`, `dimScene(pc, alpha = 0.55)` | HUD helpers with enforced edge margin and a 1-px drop shadow by default; `hudText` anchors `h: 'left' \| 'center' \| 'right'`, `v: 'top' \| 'middle' \| 'bottom'`, and adds a translucent plate behind centred text at `scale >= 2` unless `plate: false`; `drawPanel` is clamped inside `SAFE_MARGIN`; `dimScene` overscans 16 px so shake can't expose an edge. Dim OR plate, never both |
| crt.ts | `createCrt(opts)` → `.render(ctx, w, h, dt)`; type `CrtOptions` | Draw LAST. Halation (cached snapshot re-drawn ±1 device px, `'lighter'`), phosphor lift, scanlines (`'multiply'` toward mid-grey), vignette + flicker. `CrtOptions`: `scanlineAlpha` (0.09), `vignetteAlpha` (0.35), `flicker` (0.03), `halation` (0.09, 0 skips), `lift` (`'rgb(15,17,28)'`, `''` skips) |
| runtime.ts | `createRuntime({targetOrigin = '*', onStandalone})` → `.gameOver/.scoreChanged/.stateChanged/.embedded/.send`; type `Runtime` | Host contract, wire format `{source:'retrovibe', type, payload}`; posts to the parent frame when embedded, otherwise hands the message to `onStandalone` if given and is silent if not (the Pages build runs standalone and passes none) |
| geometry.ts | (internal) `Point`, `Rect`, `CenterRow`, `snapRect`, `solidRect` | The geometry objects every drawing call takes |

# Handover — Ember Quest gameplay overhaul "The Long Descent" (2026-11-24)

For the next cloud task. Read this first, then `CLAUDE.md` and `DESIGN.md`
(and `STYLE.md` before touching the look). `OVERHAUL_PLAN.md` is the reviewed plan this
work followed, with the owner-vetoable decisions and the features cut for later.

## Where things stand

- **`main`** still holds the game before the overhaul; a push to `main` deploys to
  https://patakil.github.io/ember-quest/. Release only through `releasing-the-game`,
  and only when the owner asks.
- **The overhaul branch** is `claude/fervent-ptolemy-9ivdbk` (`git log main..HEAD`), one
  commit per milestone and per review round:
  - the pack (4 items), the GEAR screen (B on the map), the full NOW / NEW compare card,
    scouting (foe, attack type and weakness per map node), chosen upgrade targets;
  - battle verbs: telegraphed enemy moves, GUARD / PARRY, BREAK, elements, BURN, the
    EMBER BURST gauge, potions, boss phases, previews with real numbers;
  - 69 items, new effect kinds and spells; EVENT rooms;
  - the endless descent: THRESHOLD (ASCEND or DESCEND), pacts, affixes, longer maps,
    THE HOLLOW;
  - save and CONTINUE (one run, multi-tab safe), pause RESUME / ABANDON, the run recap
    with a NEXT TIME tip.
- **Gates**: `npm run verify -- --full` green; rules 22 groups; smoke wins a fight.
- **Balance** (2000 runs, seed 1, 2026-11-24): balanced 38 %, tank 35 %, eliteHungry
  37 %, chestHungry 30 %, glass 17 %, naive 15 %, random 0 %. See `DESIGN.md` →
  *Balance state*.

## Open follow-ups

- **Balance**: tank descends far better than every other policy (clears depth 2 in 63 %
  of its descents against balanced 37 %); naive (15 %) and glass (17 %) sit on their
  floors; balanced clears depth 3 in 7 % (aim ≈ 10 %); elites MUMMY and PALADIN are top
  killers; a pure physical build has no way to break a HEAVY except BURST.
- **Descent variety**: depths 2+ reuse the four act bosses with affixes; only THE HOLLOW
  is new. Pacts cannot be declined.
- **Clarity**: the map cannot inspect rooms beyond the next column; `pact --depth 10`
  has no pact left to offer, so that fixture lands on the depth card.
- **Cut from the plan for a later pass**: origins / classes, a codex, resonance sets, a
  forge and currency, more ailments, a daily seed, a battle-speed toggle.
- From the visual overhaul, still open: the Ice Bear and fallen-knight sprites, the
  empty stage half on rest and win screens, fractional `devicePixelRatio`, no gate on
  `autoFit` across viewports.

## First things to do in the new task

1. **Eyes.** `cat /tmp/ember-eyes.json`. If it is missing or not `"ready":true`, run
   `npm run setup` (the SessionStart hook in `.claude/settings.json` does this in the
   background; it was seen firing in a fresh `claude -p` session on this box on
   2026-11-22, but not yet in a brand-new Air task). It
   installs `node_modules` if needed, extracts Chromium from the `@sparticuz/chromium`
   devDependency, writes `/tmp/ember-chromium`, starts the dev server and proves a
   launch; a repeat run returns in well under a second. No manual apt, no
   `/tmp/browser` install: the old recipe is obsolete. (Setup falls back to
   `sudo apt-get install libnspr4 libnss3 libsqlite3-0` by itself only if the launch with
   the bundled libraries fails and passwordless sudo exists.)
2. **Public link.** Port **5173** is in the environment's Exposed ports, so a new task
   should have `JBCENTRAL_EXPOSED_PORT_URL_5173`; the setup marker's `url` is that
   address when set. `vite.config.ts` reads the variable (binds `0.0.0.0`, allows the
   proxy hostname, runs HMR over `wss:443`), so it must be set **before** Vite starts.
   Only give the owner the URL after
   `curl -s -o /dev/null -w "%{http_code}\n" "$JBCENTRAL_EXPOSED_PORT_URL_5173/"` prints
   200. If the variable is empty, the environment change did not apply — Air applies
   environment settings only to newly created tasks (docs:
   jetbrains.com/help/air/exposed-ports.html, …/manage-environments.html).
3. **Baseline.** `npm run verify`, then `npm run look -- --scene title` and read the
   screenshot it names. Ask the owner which follow-up above comes first.

## The feedback loop is automatic now

`.claude/settings.json` runs `scripts/agent-feedback.mjs` on SessionStart,
SubagentStart, after every Bash/Edit/Write call (PostToolUse and PostToolUseFailure),
and on Stop/SubagentStop; `.githooks/pre-commit` runs it on `git commit` (`npm ci`'s
`prepare` sets `core.hooksPath`). An agent gets eslint + incremental tsc errors for the
files it just changed within ~2–3 s, cannot end a turn on a red tree (at most 3 blocks,
then it is released with a message to the user), and cannot commit one. Green trees are
remembered by content fingerprint, so repeat stops and commits are instant. CLAUDE.md →
*Automatic feedback* has the table and the parallel-writer rules;
`.git/ember-feedback/events.log` shows every hook run. Observed live on 2026-11-22: the
PostToolUse/PostToolUseFailure hooks inside a subagent (with `agent_id`), the main
session's Stop hook, and settings edits taking effect mid-session.

## Gotchas

- **The workspace auto-pushes the branch after every turn.** Commits leave immediately
  (to the task branch, never `main`).
- **Don't `pkill -f <pattern>`** when the pattern appears in your own command line — it
  kills the shell running it (exit 144). `lsof`, `ss` and `bc` are not installed. The
  dev server's pid: `ps -eo pid,args | awk '$2=="node" && /vite/ {print $1}'`.
- **Browser downloads are blocked** (`npx playwright install chromium`, Chrome for
  Testing) and Ubuntu's `chromium` is snap-only; the npm registry works, which is why the
  browser comes from `@sparticuz/chromium`. Its own recommended flags (software GL) make
  each screenshot take 3–18 s; the wrapper's plain `--headless=shell --no-sandbox
  --disable-gpu` take about 0.1 s.
- **knip is pinned to v5** — v6 crashes on this box.
- **Lint runs without a cache**, in `npm run lint` and in `verify`, on purpose: the ESLint
  cache misses cross-file type changes.
- The clone may arrive **shallow**; `git fetch --unshallow` for history. Other remote
  branches: `claude/fable-credits-reset-wbtv7t` (v3 work) and
  `claude/kotlin-multiplatform-plan-9p5h06` (a KMP mobile plan). Neither is the target.

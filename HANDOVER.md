# Handover — Ember Quest v2 with agent eyes and a lint suite (2026-11-22)

For the next Air cloud task. Read this first, then `CLAUDE.md` and `DESIGN.md`
(and `STYLE.md` before touching the look).

## Where things stand

The owner wants the **v2 in-browser game** (keyboard, desktop browser) and to keep
building on it, not the v3 rewrite (party draft, relics, HD-2D, phone layout). v3 is
still in history.

- **`main`** is `93f6bc6`: PR #2 merged the v2 restore, so `main` holds v2 and a push to
  `main` deploys it to https://patakil.github.io/ember-quest/. Only release through the
  `releasing-the-game` skill, and only when the owner asks.
- **This task's branch** is `air/resume-ember-quest-from-handover-doc-d4b12fb1-e`, on top
  of the v2 handover. It added the tooling, not features:
  - `1e6f5fe`: agent eyes — the seeded dev hook (`game/devhook.ts`), `npm run setup`,
    `look`, `verify`, and the lint configuration.
  - `edce53d`: every comment stripped (the style card moved to `STYLE.md`), lint autofix.
  - `00f1c7d`: the refactor oracle (`scripts/oracle.mjs`), hold mode for pixel-identical
    seeded screenshots, `noUncheckedIndexedAccess`.
  - `80baa5e`: all lint debt cleaned — rules split into `game/sim/*`, the engine's
    `draw.ts` split into `canvas/sprite/anim/font/text/fills` (+ `geometry`, `ambient`)
    with geometry-object signatures, presentation split out of `main.ts` into
    `app/state/flow/frame/…` and `game/screens/`, sprites into `game/sprites/`. Its
    acceptance test was behaviour preservation: the oracle (state + pixels) identical
    and `node sim/run.mjs --json` byte-identical to the pre-refactor baselines.
  - then the docs and skills brought in line with all of the above.
- **Gates at hand-off:** `npm run verify -- --full` passes on the whole tree. Full sim:
  balanced 19 %, glass 9 %, tank 17 %, elite-hungry 19 %, chest-hungry 19 %, random 0 %.
- **Known open item** (balance, not fixed here): the game's map links stages more
  generously than the simulator's, so the real game is somewhat easier than the
  *Balance state* table says — see `DESIGN.md` → *Open item*.
- **No feature work yet.** The owner's request is still open: "continue with the browser
  game and the features and functionality that were in there". Ask which v2 feature or
  change comes first.

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
   screenshot it names.

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
- **`eslint .` also lints `.claude/worktrees/`** (agent worktrees are untracked and not
  ignored), so a writer mid-change in its worktree can turn `verify` red in the main
  checkout. Fix pending: ignore `.claude/**` in `eslint.config.mjs` (owner-approved
  config change needed).
- **Lint runs without a cache**, in `npm run lint` and in `verify`, on purpose: the ESLint
  cache misses cross-file type changes.
- The clone may arrive **shallow**; `git fetch --unshallow` for history. Other remote
  branches: `claude/fable-credits-reset-wbtv7t` (v3 work) and
  `claude/kotlin-multiplatform-plan-9p5h06` (a KMP mobile plan). Neither is the target.

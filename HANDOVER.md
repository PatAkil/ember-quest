# Handover — Ember Quest visual overhaul (2026-11-22)

For the next Air cloud task. Read this first, then `CLAUDE.md` and `DESIGN.md`
(and `STYLE.md` before touching the look).

## Where things stand

The owner plays the **v2 in-browser game** (keyboard, desktop browser) and builds on
it; the v3 rewrite stays in history.

- **`main`** is `2b55b37` ("PRs get a comment showing which screens changed, with
  before/after shots (#7)"); a push to `main` deploys to
  https://patakil.github.io/ember-quest/. Release only through `releasing-the-game`,
  and only when the owner asks.
- **The overhaul branch** is `air/resume-failed-job-visual-review-7bf06496-4`
  (`git log main..HEAD`), five commits on top of `main`:
  - `24fe87e`: the game fills the window — whole-number scaling, the Ember Quest
    cabinet shell, legible warnings, coloured map icons, honest level-up labels, clean
    ending screens.
  - `69a6b0d`: auto-commit of work in progress.
  - `a0d598e`: battles look like a fight scene and move — 2× actors, mirrored HUD
    plates, the command band, lunges, spell projectiles, hit flash, dissolve on kill,
    boss banner, lagging HP bars, screen transitions (`game/fx*.ts`,
    `game/transition.ts`, `game/screens/battle-fx*.ts`); the map gets room icons, a
    hero marker and a lit path; loot and equip get item cards.
  - `21467a4`: overhaul round 1 — melee lunges connect with a slash arc, bigger
    fireball and impact blooms, no dead beats before a kill dissolves, no stray numbers
    carried into the next fight; reward screens get the command band and the knight;
    redrawn Ice Bear, wolf, scorpion, Dark Lord and fallen knight; readable desert sun
    and temple columns; clearer map choices.
  - `c029c38`: further styling and enemy presentation.
  - then a review-fix pass (two writers, uncommitted at the time of writing): the
    window fit (whole-number scale down to 1, CSS shrink below 240×160, backing store
    capped at 6× with whole-number CSS enlargement above it, see `STYLE.md` → *Shell
    and scale*), docs brought in line, and battle fixes by the second writer.
- **Visual review:** the overhaul scored **77/100**. `npm run verify -- --full` was
  green on the branch before the review-fix pass.
- **Known open balance item** (unchanged): the game's map links stages more
  generously than the simulator's — see `DESIGN.md` → *Open item*.

## Open follow-ups (not fixed in the review-fix pass)

- The desert sun shows beside the reward panels (`game/backdrop.ts`, the `SUN` placed
  between knight and foe around line 80).
- The two-column battle menu formats its columns differently.
- Pause freezes the enemy mid entrance hop.
- Ambient particles drift across the "ACT 4" and "VICTORY" headlines.
- The loot panel is cramped and its title truncates.
- The Ice Bear and fallen-knight sprites are still weak.
- The stage half stays empty on the rest and win screens.
- `border-radius` on `#screen` in `index.html` clips the canvas corners.
- A presses are swallowed during hit-stop (`game/screens/battle.ts`, `updateBattle`
  returns while `juice.frozen`, around line 180).
- The screen wipe does not gate input.
- Fractional `devicePixelRatio` is ignored by the fit (CSS px only), so a 125 %/150 %
  display resamples the pixels unevenly.
- `drawSprite` (`engine/sprite.ts`) allocates per pixel (a fresh ink object per drawn cell, every frame).
- No gate exercises `autoFit`: hold mode pins 3×, so `smoke`, `look` and the oracle
  never run the window fit; the viewport check was a one-off Playwright script.
- `game/screens/loot.ts` imports a colour (`C_SCROLL`) from `loot-view.ts` — it
  belongs in `game/theme.ts`.

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
- **`eslint .` also lints `.claude/worktrees/`** (agent worktrees are untracked and not
  ignored), so a writer mid-change in its worktree can turn `verify` red in the main
  checkout. Fix pending: ignore `.claude/**` in `eslint.config.mjs` (owner-approved
  config change needed).
- **Lint runs without a cache**, in `npm run lint` and in `verify`, on purpose: the ESLint
  cache misses cross-file type changes.
- The clone may arrive **shallow**; `git fetch --unshallow` for history. Other remote
  branches: `claude/fable-credits-reset-wbtv7t` (v3 work) and
  `claude/kotlin-multiplatform-plan-9p5h06` (a KMP mobile plan). Neither is the target.

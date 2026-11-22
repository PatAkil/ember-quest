# Handover — Ember Quest back on v2 (2026-11-22)

For the next Air cloud task. Read this first, then `CLAUDE.md` and `DESIGN.md`.

## Where things stand

The owner wants the **v2 in-browser game** (keyboard, desktop browser) back,
and to keep building on it, not the v3 rewrite (party draft, relics, HD-2D,
phone layout).

- **Branch:** `air/revert-emberquest-to-browser-version-0865bcc7-2`, pushed.
  Start the new task on it. `main` is untouched and still holds v3, which the
  live site at https://patakil.github.io/ember-quest/ serves. Push to `main` =
  deploy, so only release through the `releasing-the-game` skill, and only when
  the owner asks.
- **Commits on the branch** (on top of `main` = `71dc875`, v3):
  - `55ded76`: tree restored byte-for-byte to `d51f54a` (v2 code + dev tooling,
    the last commit before the v3 design and rewrite). v3 is still in history.
  - `0cd39b8`: `smoke.mjs` takes an optional `CHROMIUM_PATH` (a browser
    Playwright didn't download).
  - `7a69bf1`: `vite.config.ts` works behind Air's exposed-port proxy (see below).
  - this file.
- **Gates at hand-off:** `npm run check` ✓, `npm run build` ✓,
  `npm run smoke` ✓ (with `CHROMIUM_PATH`), `npm run sim` ✓. Policy win rates:
  balanced 19 %, glass 9 %, tank 17 %, random 0 %.
- **Seen in a real browser:** title screen with no console errors; Space → Act 1
  "The Crypt" path map with six empty slots and the HP/MP/stat panel.
- **No feature work yet.** The owner's next request is open: "continue with the
  browser game and the features and functionality that were in there". Ask which
  v2 feature or change comes first.

## First things to do in the new task

1. **Dev server + public link.** The owner added port **5173** to the
   environment's Exposed ports. A new task should therefore have
   `JBCENTRAL_EXPOSED_PORT_URL_5173`. Check it:
   ```
   echo $JBCENTRAL_EXPOSED_PORT_URL_5173
   npm ci
   setsid nohup npm run dev > /tmp/dev.log 2>&1 &      # poll for "Local:" in /tmp/dev.log
   curl -s -o /dev/null -w "%{http_code}\n" "$JBCENTRAL_EXPOSED_PORT_URL_5173/"   # want 200
   ```
   `vite.config.ts` reads that variable: it binds `0.0.0.0`, allows the proxy
   hostname, and runs HMR over `wss:443`. It must be set **before** Vite starts.
   Only give the owner the URL after it returns 200. If the variable is empty,
   the environment change didn't apply. Air applies environment settings only to
   newly created tasks (docs: jetbrains.com/help/air/exposed-ports.html,
   …/manage-environments.html). Fallback: a port that IS in the env list.
2. **Headless browser for validation** (lives in `/tmp`, gone with each task).
   Playwright's and Chrome-for-Testing's downloads are blocked here, and Ubuntu
   26.04's `chromium` is snap-only. The npm registry works:
   ```
   mkdir -p /tmp/browser && cd /tmp/browser && npm init -y && npm i agent-browser @sparticuz/chromium
   node -e "require('@sparticuz/chromium').default.executablePath().then(console.log)"   # → /tmp/chromium
   sudo apt-get update   # required: without it apt fails on libxfixes3 and installs nothing
   sudo DEBIAN_FRONTEND=noninteractive apt-get install -y libnspr4 libnss3 libatk1.0-0t64 \
     libatk-bridge2.0-0t64 libcups2t64 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
     libgbm1 libpango-1.0-0 libasound2t64 libxfixes3
   node -e "console.log(require('@sparticuz/chromium').default.args.join(' '))" > args.txt
   printf '#!/bin/sh\nexec /tmp/chromium %s "$@"\n' "$(cat args.txt)" > /tmp/chromium-wrap && chmod +x /tmp/chromium-wrap
   ```
   The apt install can take over 2 minutes, so run it in the background. The
   binary hangs with plain flags; it needs the sparticuz args (the wrapper adds them).
   Then, from the repo root:
   ```
   CHROMIUM_PATH=/tmp/chromium-wrap npm run smoke
   export AGENT_BROWSER_EXECUTABLE_PATH=/tmp/chromium-wrap
   cd /tmp/browser && npx agent-browser open http://localhost:5173/
   npx agent-browser click "#screen"; npx agent-browser press Space
   npx agent-browser screenshot $AIR_ARTIFACTS_DIR/shot.png; npx agent-browser errors; npx agent-browser close
   ```
   Read the screenshot to judge it.

## Gotchas learned this session

- **The workspace auto-pushes the branch after every turn.** Commits leave
  immediately (to the task branch, never `main`).
- **Don't `pkill -f <pattern>`** when the pattern appears in your own command
  line. It kills the shell running it (exit 144). Kill by PID:
  `ps -eo pid,args | awk '$2=="node" && /vite/ {print $1}' | xargs -r kill`.
  `lsof` and `ss` aren't installed.
- The clone may arrive **shallow**; `git fetch --unshallow` for history.
  Other remote branches: `claude/fable-credits-reset-wbtv7t` (v3 work) and
  `claude/kotlin-multiplatform-plan-9p5h06` (a KMP mobile plan, 75 commits).
  Neither is the target.
- `CLAUDE.md` and the skills on this branch are the **v2** versions. They
  describe `game/data.ts` / `sim.ts` / `sprites.ts` / `main.ts`, not v3's
  `game/data/*` and `game/sim/*`.

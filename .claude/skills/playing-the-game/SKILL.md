---
name: playing-the-game
description: Use when the user asks to play, run, or try the game — and as the pre-commit runtime gate invoked by iterating-on-a-game. Runs the dev-server lifecycle and headless smoke check — reclaim port 5173, launch Vite in the background, run the smoke gate, hand the URL to the user for playtesting.
---

# Playing the game

Start the dev server, verify the game boots clean with the headless smoke check, and hand the URL to the user — who is the playtester. Claude cannot see the canvas and never claims to have played.

One server at a time: the port is pinned to 5173 with `strictPort: true` in `vite.config.ts`, so a second launch fails loudly instead of silently drifting to 5174.

## Steps

### 1. Reclaim port 5173

```bash
lsof -ti:5173 | xargs -r kill
```

Port-based, never handle-based: background-task handles do not survive across Claude sessions, so an orphan dev server from an ended session would hold the port forever. The `-r` makes empty input a no-op.

### 2. Launch the dev server in the background

```bash
npm run dev
```

Run this **as a background task, never foreground** — Vite never exits. Poll the task's output until the readiness line appears:

```
Local:   http://localhost:5173/
```

Budget ~15 seconds. If the line hasn't appeared, read the task output: `strictPort` guarantees a port conflict fails loudly (`Port 5173 is already in use`) — re-run step 1 and relaunch. Never proceed on a server that did not print the readiness line. Leave the server up for the whole session: every save hot-reloads.

### 3. Runtime smoke check

```bash
npm run smoke
```

`smoke.mjs` drives a real headless Chromium via Playwright (a dev dependency of this repo; `npx playwright install chromium` once if it reports "Executable doesn't exist") against `http://localhost:5173/`. It asserts the page loads, a `<canvas>` is attached in the live DOM after `game/main.ts` ran, and zero uncaught `console.error` / `pageerror` fired over a few frames. Nonzero exit is a hard gate failure: read the `SMOKE FAIL` output, fix, repeat from step 2.

### 4. Hand off — with the server UP

Re-verify liveness immediately before the handoff message:

```bash
lsof -ti:5173   # must print a PID
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/   # must print 200
```

Give exactly three things: the URL, the controls (read from the declared action labels: Arrows/WASD move the cursor · SPACE/Z confirm · X/C cancel · P/Esc pause), and the goal in one line ("descend four acts and fell the Seraph — HP zero ends the run"). Report exactly "builds, boots clean, ready to play at http://localhost:5173/" — never "playtested". No checklist at handoff.

### 4b. After they've played

One light follow-up only — "anything feel off — pacing, difficulty, a screen that dragged?" — never a list. When the user reports something wrong, triage privately: title renders with matching hints · cursor and confirm/cancel work · audio unlocks on first key · battle beats read · lose condition shakes and ends the run · restart works after death and after the win · ambient particles and CRT visible · HUD inside the safe margins.

### 5. Teardown — only when asked

Only on an explicit "stop the server". Never after the smoke gate: the default post-gate state is server up, URL live.

```bash
lsof -ti:5173 | xargs -r kill
```

Killing the server makes its background task report a nonzero exit (typically 143) — expected, not a gate failure.

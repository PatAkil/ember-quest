---
name: playing-the-game
description: Use when the user asks to play, run, or try the game — and as the pre-commit runtime gate invoked by iterating-on-a-game. Runs the dev-server lifecycle and the runtime gates — make sure the eyes (browser + dev server on 5173) are up, look at the screens, run verify, hand the URL to the user for playtesting.
---

# Playing the game

Make sure the dev server and the headless browser are up, look at the game, prove it boots clean with the gates, and hand the URL to the user — who is the playtester. Claude can see the canvas now (state JSON and screenshots) and must look before reporting; it still never claims to have played.

One server at a time: the port is pinned to 5173 with `strictPort: true` in `vite.config.ts`, so a second launch fails loudly (`Port 5173 is already in use`) instead of silently drifting to 5174.

## Steps

### 1. Eyes up — browser and dev server

```bash
cat /tmp/ember-eyes.json
```

If the file is missing or does not say `"ready":true`, run:

```bash
npm run setup
```

It is idempotent and port-based, never handle-based (background-task handles do not survive across Claude sessions): it reuses whatever answers 200 on `http://localhost:5173/` and only starts Vite (detached, log in `/tmp/ember-dev.log`) when nothing does. It also extracts Chromium to `/tmp/chromium`, writes the wrapper `/tmp/ember-chromium`, proves a launch, and prints one line:

```
eyes: ready - launch ok (bundled libs via LD_LIBRARY_PATH) | chromium /tmp/ember-chromium | dev <url> | 0.04s
```

`NOT READY - <reason>` exits 1; the details are in `/tmp/ember-setup.log`. Never proceed on a server that does not answer. Leave it up for the whole session: every save hot-reloads. `npx playwright install chromium` is blocked here and never needed.

### 2. Look

```bash
npm run look -- --scene title
npm run look -- --scene battle --act 2 --seed 7
npm run look -- --scene map --keys "Down,Space"
```

Each prints one JSON line — `ok`, the game `state` (scene, sub-scene, act, hero, derived stats, enemy, cursor, and the battle/loot/card/map slice), `errors` (every `console.error` and page error), and `shot`, the screenshot path (`$AIR_ARTIFACTS_DIR/look/…` when that is set, else `/tmp/ember-look/`). Read the state first; read the screenshot whenever the look changed. Scenes: `title map battle levelup loot card paused gameover win`, acts 1–4. With `--scene` or `--seed` the dev hook holds the loop, so the same arguments give the same pixels. For free-form exploration, `npm run browse -- open http://localhost:5173/` (then `press Space`, `screenshot <file>`, `errors`, `close`) with `AGENT_BROWSER_EXECUTABLE_PATH=/tmp/ember-chromium`.

### 3. Runtime gate

```bash
npm run verify
```

One line per gate — eyes, lint, check, build, smoke, `sim:quick` (INFO, never fails) — then `TOTAL PASS` or `TOTAL FAIL (<gates>)` with the tail of each failing gate's output. The smoke gate (`smoke.mjs`) drives the headless Chromium against `http://localhost:5173/`: the page loads, a `<canvas>` is attached after the game module ran, and zero `console.error` / `pageerror` fire over 40 frames. A nonzero exit is a hard gate failure: read the output, fix, repeat from step 2. The same gate also runs on its own — the end-of-turn hook runs `verify` when code changed and blocks while it is red, and the pre-commit hook refuses a red tree (CLAUDE.md → *Automatic feedback*). `npm run gate` runs `verify` and remembers a green tree so the next stop and commit skip it.

### 4. Hand off — with the server UP

Re-verify liveness immediately before the handoff message:

```bash
ps -eo pid,args | awk '$2=="node" && /vite/ {print $1}'
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/
```

The first must print a pid, the second `200`. In an Air task give the public URL (`$JBCENTRAL_EXPOSED_PORT_URL_5173`, also the `url` in `/tmp/ember-eyes.json`) once the same `curl` against it prints 200; otherwise `http://localhost:5173/`.

Give exactly three things: the URL, the controls (read from the declared action labels: Up/Down (arrows/WASD) move the cursor · SPACE/Z select · P/Esc pause), and the goal in one line ("descend four acts and fell the Seraph — HP zero ends the run"). Report exactly "builds, boots clean, ready to play at <URL>" — never "playtested". No checklist at handoff.

### 4b. After they've played

One light follow-up only — "anything feel off — pacing, difficulty, a screen that dragged?" — never a list. When the user reports something wrong, triage privately, looking with `npm run look` where a screen is involved: title renders with matching hints · cursor and select work · audio unlocks on first key · battle beats read · lose condition shakes and ends the run · restart works after death and after the win · ambient particles and CRT visible · HUD inside the safe margins.

### 5. Teardown — only when asked

Only on an explicit "stop the server". Never after the gates: the default post-gate state is server up, URL live. Never `pkill -f` (it matches and kills your own shell) and `lsof` is not installed; kill by pid:

```bash
ps -eo pid,args | awk '$2=="node" && /vite/ {print $1}' | xargs -r kill
```

The `-r` makes empty input a no-op.

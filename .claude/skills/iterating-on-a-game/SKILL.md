---
name: iterating-on-a-game
description: Use when the request changes Ember Quest in any way ("make bosses harder", "add a fifth act", "the map looks flat") — the default path for every edit. Modifies the game in place at the repo root; same validation loop and smoke check every time; commits only at green milestones.
---

# Iterating on Ember Quest

This repo IS the game. `game/` holds the code, `engine/` a per-game fork of the Retrovibe engine, `DESIGN.md` the systems contract. There is no template, no workspace of games, no cloning.

## Workflow

0. **Eyes up.** If `/tmp/ember-eyes.json` is missing or does not say `"ready":true`, run `npm run setup` (idempotent: browser, dev server on 5173, marker). Never start a second dev server.
1. **Read before editing.** `DESIGN.md` first (the contract), `STYLE.md` for anything visual, then the one module that owns the change — the module layout table in `DESIGN.md` names it: `game/types.ts` (types + tuning constants), `game/data.ts` (items, spells, enemies, biomes), the `game/sim/<concern>.ts` file (pure rules, headless; `game/sim.ts` is the barrel), a screen in `game/screens/`, run flow in `game/flow.ts`, colours and layout in `game/theme.ts`, art in `game/sprites/`. Keep that table true: the headless files never import the engine, presentation or the DOM, so the balance simulator keeps working.
2. **Mechanics changes go through `designing-mechanics` first** — trade-offs on the table before code moves. Then route: **balancing-with-the-simulator** after any rules change, **ensuring-arcade-visuals** for look, **improving-game-quality** for the feel pass, **handling-user-input** for controls, **messaging-game-over** for host messaging, **adding-easter-egg** for secrets.
3. **Validation loop** — after **every** edit:
   ```
   npm run check
   npm run lint
   ```
   No comments, no suppressions, thresholds as in `CLAUDE.md` → *Lint suite and thresholds*: fix the code, never the config. Then look at what changed: `npm run look -- --scene <screen> --act <n> --seed 7` — the `state` and `errors` first, the screenshot whenever the look changed.
4. **Milestone** — before a commit or a handoff:
   ```
   npm run verify
   ```
   must print `TOTAL PASS` (check, lint, build, smoke; `sim:quick` is informational). Before a release or after a structural change, `npm run verify -- --full`. A refactor that must not change behaviour also proves it: `node scripts/oracle.mjs --save /tmp/oracle-before.json` before, `--check /tmp/oracle-before.json` after, and `node sim/run.mjs --json > /tmp/sim-before.json` before, `node sim/run.mjs --json | cmp - /tmp/sim-before.json` after (silent = identical). **playing-the-game** owns the dev-server lifecycle and the handoff. A green build alone never means done. Claude may report what it looked at; it never claims to have played the game — report "builds, boots clean, ready to play at <URL>"; the user is the playtester. Escalation rule: if check, lint or smoke fails twice on the same approach, escalate the writer one model tier for a fresh attempt (CLAUDE.md → Models & orchestration).
5. **Commit at every green milestone** (unsigned — never add `-S`). Push only through **releasing-the-game**: a push to `main` is a release to the live URL.

## Engine edits

`engine/` is editable here — it is Ember Quest's private copy. Import from the barrel (`'../engine'`, `'../../engine'` from `game/screens/` and `game/sprites/`); when a new drawing or juice primitive is needed for "wilder" graphics, add it to the engine module that owns the concern and re-export from `engine/index.ts`. Update the engine API table in `CLAUDE.md` in the same edit so the next context knows the surface.

**Restore routing:** for "the old one was better", `git log --oneline` shows milestone commits; `git checkout <hash> -- game engine` restores the code, and `git revert` unwinds a released one.

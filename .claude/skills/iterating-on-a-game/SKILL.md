---
name: iterating-on-a-game
description: Use when the request changes Ember Quest in any way ("make bosses harder", "add a fifth act", "the map looks flat") — the default path for every edit. Modifies the game in place at the repo root; same validation loop and smoke check every time; commits only at green milestones.
---

# Iterating on Ember Quest

This repo IS the game. `game/` holds the code, `engine/` a per-game fork of the Retrovibe engine, `DESIGN.md` the systems contract. There is no template, no workspace of games, no cloning.

## Workflow

1. **Read before editing.** `DESIGN.md` first (the contract), then the module that owns the change: `game/types.ts` (types + tuning constants), `game/data.ts` (items, spells, enemies, biomes), `game/sim.ts` (pure rules, headless), `game/sprites.ts` (art), `game/main.ts` (screens, input, rendering). Keep the module layout table in `DESIGN.md` true: `data.ts` and `sim.ts` never import the engine or the DOM, so the balance simulator keeps working.
2. **Mechanics changes go through `designing-mechanics` first** — trade-offs on the table before code moves. Then route: **balancing-with-the-simulator** after any rules change, **ensuring-arcade-visuals** for look, **improving-game-quality** for the feel pass, **handling-user-input** for controls, **messaging-game-over** for host messaging, **adding-easter-egg** for secrets.
3. **Validation loop** — after **every** edit:
   ```
   npm run check
   ```
4. **Milestone** — before a commit or a handoff, both must pass:
   ```
   npm run build
   ```
   **and** the runtime smoke check via **playing-the-game** (owns the dev-server lifecycle and `npm run smoke`). A green build alone never means done. Claude never claims to have played the game — report "builds, boots clean, ready to play at <URL>"; the user is the playtester. Escalation rule: if the typecheck or smoke gate fails twice on the same approach, escalate the writer one model tier for a fresh attempt (CLAUDE.md → Models & orchestration).
5. **Commit at every green milestone** (unsigned — the repo config disables gpg signing). Push only through **releasing-the-game**: a push to `main` is a release to the live URL.

## Engine edits

`engine/` is editable here — it is Ember Quest's private copy. Import from the barrel `'../engine'` as before; when a new drawing or juice primitive is needed for "wilder" graphics, add it to the engine module that owns the concern and re-export from `engine/index.ts`. Update the engine API table in `CLAUDE.md` in the same edit so the next context knows the surface.

**Restore routing:** for "the old one was better", `git log --oneline` shows milestone commits; `git checkout <hash> -- game engine` restores the code, and `git revert` unwinds a released one.

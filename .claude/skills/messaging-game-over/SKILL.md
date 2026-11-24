---
name: messaging-game-over
description: Use when wiring scene transitions, score updates, or win/lose reporting — or when host messaging looks missing or wrong. Covers when and how a game posts state, score, and game-over transitions to the host via the engine runtime.
---

# Messaging game over (and every other transition)

`engine/runtime.ts` enforces the wire format — this skill only decides **when** to send. Import from the barrel: `import { createRuntime } from '../engine';` (this game creates it once, in `game/app.ts`). Validate with `npm run check` and `npm run lint` (repo root).

## The pinned wire format

Every message is exactly:

```ts
{ source: 'retrovibe', type: 'gameOver' | 'scoreChanged' | 'stateChanged', payload }
```

You never build this object yourself — call the typed helpers on the `Runtime` returned by `createRuntime({ targetOrigin, onStandalone })` (both optional):

- `runtime.gameOver({ score, won })` — terminal state reached (payload fields optional; `won: false` for GAME_OVER, `won: true` for WIN).
- `runtime.scoreChanged(score)` — score changed to a new value.
- `runtime.stateChanged(state)` — scene transition, e.g. `'TITLE' | 'PLAYING' | 'PAUSED' | 'WIN'`.

Embed detection is `window.parent !== window` (exposed as `runtime.embedded`). When embedded, the runtime posts to the parent frame via `postMessage` (default `targetOrigin: '*'`). Standalone — which is how the Pages build and the dev server run — it hands each message to the `onStandalone(message)` callback if one was passed and otherwise does nothing: it never writes to the console (`no-console` is a lint error in `engine/` and `game/`), so a standalone page shows no trace of the sends. To watch them, pass a callback while debugging, or verify the transitions themselves through the dev hook: `npm run look -- --scene gameover` and `--scene win` print a `state` whose `scene` is `GAME_OVER` or `WIN` (and the final `score`), which proves the terminal transitions fire. This repo has no parent-frame harness; the embedded path is the engine's `postMessage` call and nothing else.

## When to send

1. **`stateChanged` on every scene transition.** Wire it once through `scenes.onEnter` handlers so no transition can be missed — this game does it in one place, `wireScenes` in `game/flow.ts`, which also saves the best score on the terminal entries. The pattern:

   ```ts
   scenes.onEnter('PLAYING', () => {
     runtime.stateChanged('PLAYING');
   });
   scenes.onEnter('TITLE', () => runtime.stateChanged('TITLE'));
   scenes.onEnter('PAUSED', () => runtime.stateChanged('PAUSED'));
   scenes.onEnter('GAME_OVER', () => {
     runtime.stateChanged('GAME_OVER');
     runtime.gameOver({ score, won: false });
   });
   ```

2. **`scoreChanged` whenever the score changes** — at the point of mutation, e.g. where a clear adds to the score:

   ```ts
   score += 10;
   runtime.scoreChanged(score);
   ```

3. **`gameOver` once, on entering `GAME_OVER`** (with `won: false`) — or on entering `WIN` with `won: true`:

   ```ts
   scenes.onEnter('WIN', () => {
     runtime.stateChanged('WIN');
     runtime.gameOver({ score, won: true });
   });
   ```

   Putting it in the `onEnter` handler guarantees exactly one send per terminal entry.

This game's sequence, checked end to end on 2026-11-24: a new run sends `stateChanged('PLAYING')` then `scoreChanged(0)`; CONTINUE sends `stateChanged('PLAYING')` then `scoreChanged(saved score)`; every clear one `scoreChanged`; a death sends `scoreChanged(final)` only when the unbanked-half rule changed the score, then `stateChanged('GAME_OVER')` and `gameOver({ score, won })`; ABANDON goes PAUSED → GAME_OVER directly (no `PLAYING` in between); ASCEND sends `scoreChanged(score + glory)`, `stateChanged('WIN')`, `gameOver({ score, won: true })`.

That's all. The module enforces the shape; a game that wires these three points is fully covered. **improving-game-quality** owns the checklist that verifies scene-transition coverage; anything about which button restarts belongs to **handling-user-input**.

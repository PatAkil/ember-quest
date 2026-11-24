---
name: handling-user-input
description: Use when anything touches controls — declaring or relabeling actions, movement handling, edge-vs-held semantics (pressed/held/released, endFrame), title-screen control hints, or audio unlock on first keypress. The unified keyboard contract and owner of the A/B/PAUSE action model.
---

# Handling user input

Every Retrovibe game uses `engine/input.ts` for all keyboard input. Import only from the barrel: `import { createInput, controlHints, BUTTON_KEY } from '../engine';`. The reference implementation is this game's own: `game/app.ts` declares the actions, `game/frame.ts` reads the edges per scene, `game/screens/title.ts` renders the hints — copy its patterns. After any input edit: `npm run check` and `npm run lint` (repo root), then `npm run look -- --scene title` to read the hints off the screenshot.

## Movement — arrows + WASD, one vector

`input.dir` returns `{ x, y }` with each axis in `-1 | 0 | 1`. Arrows and WASD are both bound; opposing keys cancel to 0. Never add your own key listeners for movement — read `dir` every update tick:

```ts
ship.x += input.dir.x * SHIP_SPEED * dt;
ship.y += input.dir.y * SHIP_SPEED * dt;
```

## The buttons — A / B / PAUSE

Actions are two action buttons plus a dedicated pause button, each bound to fixed physical key **aliases**. The binding lives in the engine's `BUTTON_KEY` export (`Readonly<Record<ButtonName, { codes: string[]; hint: string }>>`):

| Button (`ButtonName`) | Keys (`codes`) | Hint shown | Conventional role |
|---|---|---|---|
| `'A'` (primary) | `Space`, `KeyZ` | `SPACE` | jump / fire / confirm / start |
| `'B'` (secondary) | `KeyX`, `KeyC` | `X` | alt-fire / dash / cancel |
| `'PAUSE'` | `KeyP`, `Escape` | `P` | pause toggle — dedicated, **never remap to gameplay** |

Games never rebind keys. They choose *which buttons mean what* via action declarations. Shift is deliberately not a key: five rapid presses opens the OS Sticky Keys dialog on Windows (unpreventable from the browser), stealing focus → blur → auto-pause on exactly the tap pattern a dash key invites.

**Multi-key edge semantics (normative):** a logical button is **down while ≥1 of its alias keys is down**. `pressed()` fires on the 0→≥1 transition; `released()` fires only on the ≥1→0 transition (last alias key up); `held()` checks all alias codes. This is load-bearing for variable jump height wired to `released('A')`: holding Space and tapping Z neither cuts the jump nor re-triggers `pressed`.

## Actions are DECLARED IN CODE — the single source of truth

`createInput(actions: ActionDecl[], opts?: InputOptions)` takes the game's action declarations. Each `ActionDecl` is `{ button: ButtonName; label: string }` — the label is a short human word (**one word, two max**, e.g. `'jump'`, `'fire'`, `'drop bomb'`).

This declaration is the **only** place a button's meaning is written down:

- Title-screen hints render **from** it via `controlHints(input)` — which returns lines like `['SPACE JUMP', 'X FIRE']` (key hint + uppercased label). Movement is implicit (arrows/WASD) and not included; render a movement line separately if desired, as the reference game does.
- **Never hand-write the title-screen control hints anywhere else.** A hand-written hint is a second source of truth that drifts. (Other screens may show contextual button text — e.g. the reference game-over screen's `` `${BUTTON_KEY.A.hint} RESTART` `` — but the key name must come from the same physical binding `BUTTON_KEY` documents, and the title screen always renders from the declarations.)
- When an edit changes what a button does, change the `label` in the **same declaration** in the same edit. There is no separate file to keep in sync — a wrong or missing label is visible the moment the game is played.

Complete setup — the pattern `game/app.ts` follows. The actions are declared once, with their labels, and the title screen renders its hints from exactly this list through `controlHints`, so a label can never drift from what the button does. This game declares `A` as `select`, `B` as `back / gear` and `PAUSE` as `pause` (see `STYLE.md`); horizontal edges go through `dirEdgeX(g)` in `game/state.ts`, vertical through `dirEdge(g)`, and `resetCursorEdge(g)` resets both:

```ts
import { createInput, createAudio } from '../engine';

const audio = createAudio();
const input = createInput(
  [
    { button: 'A', label: 'select' },
    { button: 'B', label: 'back / gear' },
    { button: 'PAUSE', label: 'pause' },
  ],
  { onFirstKey: () => { audio.unlock(); } },
);
```

And the title-screen render. The declared hints come from `controlHints(input)`, never hand-written; the movement line is the one static string, placed after them:

```ts
const hints = controlHints(input);
hints.forEach((hint, i) => {
  drawTextCentered(pc.ctx, hint, { width: W, y: 100 + i * 10 }, { color: PICO8[7] });
});
drawTextCentered(pc.ctx, 'ARROWS/WASD MOVE', { width: W, y: 100 + hints.length * 10 }, { color: PICO8[5] });
```

## Edge vs held semantics

The `Input` interface exposes three queries per button:

- `pressed(button)` — went down **this frame**. Use for one-shot actions: start, pause toggle, fire-per-press, menu confirm.
- `held(button)` — currently down. Use for continuous actions: charging, thrusting, variable jump height.
- `released(button)` — went up **this frame**. Use for release-triggered actions (e.g. cutting a jump short).

Directions have the same latch: `input.pressedDir()` returns `{ x, y }` for direction keys that went down since the last `endFrame()`, even if they were released before the tick ran (a quick tap, or Playwright's default `keyboard.press`). Menus never compare `input.dir` frames by hand — `dirEdge(g)` / `dirEdgeX(g)` read the latch first and the held 0 → ±1 edge second, so a held key still moves once and a tap is never lost.

Confirm buttons are **armed** on every screen a mashed A could reach — the reward screens (LEVEL UP, loot, gift, PICK, event, cards) and also the MAP, GEAR, THRESHOLD, PACT and the title menu: `armA(g)` when the screen opens, `takeA(g)` instead of `input.pressed('A')` when it reads A — A then counts only as a fresh press: it must be up at some point after the screen opened (`armA` notes whether it already is) and the press must land on a later tick, so a press held through the previous screen (a card, a battle's last beat) cannot fire here, while on the map and plain continue cards every new press once the screen is drawn acts at once — one press, one action, no dwell. Screens whose choice is permanent (LEVEL UP, loot and gift, PICK, EVENT, GEAR) open with `armDecision(g)` (`game/transition.ts`) instead: A is ignored until the screen reveal has finished plus `DECIDE_BEAT` (0.15 s, `game/state.ts`), their A prompt is drawn `C_FAINT` until `decisionReady(g)`, and directions work at once. THRESHOLD and PACT wait longer, 1.0 / 0.5 s (`armed(g, { openedAt, delay })`, prompt faint until then), and neither has a preselected row: on THRESHOLD Up lights ASCEND and Down lights DESCEND, on PACT either lights the top row, and A only blips and nudges until one is lit. The battle menu returns the cursor from POTION / BURST to ATTACK after a turn and makes A wait one `DECIDE_BEAT` when it was left on MAGIC (`reopenMenu`). GAME OVER and WIN are armed by time only. PAUSED reads plain presses because `g.clock` is frozen there.

**Confirmations** (`stepMenu` / `drawConfirm` in `game/screens/menu.ts`): a guarded row (NEW RUN over a save, ABANDON RUN) opens `QUESTION  > NO   YES` with NO highlighted and re-arms A; any arrow toggles the highlight, A takes the highlighted answer, B is always NO. The same key pressed twice never confirms.

**2-column grids** (the battle commands and the spell list, `game/screens/battle-menu.ts`): Left/Right walk the list in reading order (Right from the right column goes to the next row's left cell; the last item wraps to the first, across spell pages); Up/Down stay in the column and wrap bottom → top, except that in a spell list with more than one page they turn the page at the edge. Every grid in the game follows this; a new one must too.

Because buttons have alias keys, these are **button-level** edges: switching from one alias to another mid-hold (Space held, Z tapped) produces no `pressed` and no `released` — only the whole button going down or fully up does.

**`endFrame()` must be called exactly once per update tick, after all input reads** — it clears the `pressed`/`released` edges and the `pressedDir()` latch. Call it as the last line of `update(dt)`, after the scene's handler has read `input.dir` and the button edges:

```ts
function update(dt: number): void {
  UPDATE_SCENE[scenes.current](dt);
  input.endFrame();
}
```

Forgetting `endFrame()` makes every `pressed()` stick true forever; calling it before reading input makes edges invisible. Key repeat is filtered (`e.repeat` is ignored), so holding a key produces exactly one `pressed()`.

## Stuck keys on blur — automatic

The engine clears all held keys on `window` blur, so alt-tabbing mid-hold never leaves a key stuck down. Nothing to do in game code — do not add your own blur handling.

## Audio unlock on first keypress

Browsers block audio until a user gesture. The engine handles this by design: pass `onFirstKey` in `InputOptions` and wire it to `audio.unlock()` (see the `createInput` example above — that is the reference game's exact pattern). The engine fires it once, on the very first keydown; `audio.play(...)` before unlock is a silent no-op. Never create an `AudioContext` yourself and never call `unlock()` outside a user gesture.

## Cleanup

`input.dispose()` removes all listeners. Single-game pages (the normal case) never need it; it exists for teardown in embedding scenarios.

## Cross-references

- **improving-game-quality** owns the quality checklist (it verifies hints are present and truthful; label ownership stays here).
- **messaging-game-over** and **adding-easter-egg** defer to this skill for anything label- or binding-related.

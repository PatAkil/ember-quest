---
name: handling-user-input
description: Use when anything touches controls — declaring or relabeling actions, movement handling, edge-vs-held semantics (pressed/held/released, endFrame), title-screen control hints, or audio unlock on first keypress. The unified keyboard contract and owner of the A/B/PAUSE action model.
---

# Handling user input

Every screen uses `engine/input.ts` for keyboard AND pointer, native and in parallel, always both, plus `createHitRegions` for anything tappable. Import only from the barrel: `import { createInput, createHitRegions, controlHints, pointerHints, BUTTON_KEY, TAP_MIN } from '../engine';`. The contract is DESIGN.md's *Presentation > Input* and *UI constraints* sections; `game/screens/*.ts` become its reference implementations once phase 4 lands. After any input edit: `npm run check` (repo root).

## Movement — arrows + WASD, one vector

`input.dir` returns `{ x, y }`, each axis in `-1 | 0 | 1`; opposing keys cancel to 0. `input.dirPressed()` is the edge — the direction that went down THIS frame, cleared by `endFrame()` — and it is what drives keyboard focus through hit regions (below), not free movement: this game has none.

## The buttons — A / B / PAUSE

Two action buttons plus a dedicated pause, each bound to fixed key aliases in `BUTTON_KEY`:

| Button | Keys | Hint | Role here |
|---|---|---|---|
| `'A'` | `Space`, `KeyZ` | `SPACE` | confirm / activate the focused region |
| `'B'` | `KeyX`, `KeyC` | `X` | cancel / BACK |
| `'PAUSE'` | `KeyP`, `Escape` | `P` | pause toggle — dedicated, never remapped |

A button is **down while ≥1 alias is down**; `pressed()`/`released()` fire only on the whole button's 0→≥1 / ≥1→0 transition (aliasing Space and tapping Z mid-hold triggers neither). Games declare which buttons mean what via `ActionDecl[]` (`{ button, label }`); `controlHints(input)` renders the keyboard phrasing from that declaration and `pointerHints(input)` the touch phrasing (`'TAP <LABEL>'`) — a screen never hand-writes either (see *Pointer-type-aware hints* below). Battle additionally binds `Digit1`/`Digit2`/`Digit3` straight to the three skill buttons — the `SKILL_HIT` row's desktop key hint — a shortcut layered on top of, never a replacement for, the arrow+A hit-region route, since digits aren't in the engine's owned key set and so the screen binds them itself.

## Edge vs held semantics

Three queries per button: `pressed()` — down this frame (one-shot: confirm, pause toggle); `held()` — down right now (continuous: charging, holding a guard); `released()` — up this frame. These are button-level: switching aliases mid-hold fires neither edge. **`endFrame()` runs exactly once per update tick, after every input read** — it clears `pressed`/`released` and the pointer's own `pressed`/`released`. Skipping it makes `pressed()` stick true forever; calling it early makes edges invisible. Key repeat is filtered — one `pressed()` per physical press.

## Pointer-type-aware hints

Branch on `input.pointer.type`, not `input.pointer.active` — a desktop mouse merely crossing the canvas sets `active` too, but `type === 'touch'` only ever fires from a real touch. Show `controlHints(input)` for keyboard, `pointerHints(input)` once `type === 'touch'`. Every action needs both a keyboard route and an on-screen tap target in the same change — PAUSE, BACK and inspect included — because a phone has no keys.

## Hit regions — every tap target gets a keyboard route

`createHitRegions(input, { width, height })` is immediate-mode, like drawing: **register in `update()`, before `input.endFrame()`** — `begin()` / `add(id, x, y, w, h, { index, group, disabled })` / `end()` — because `end()` reads that tick's edges (`dirPressed`, `A` pressed, pointer pressed/released). `render()` only *reads*: `region(id)` (the drawn rect, for a focus ring), `hitRect(id)` (the expanded rect, for a debug overlay), `focused()`, `hovered()`, `pressing()`.

```ts
function update(dt: number): void {
  regions.begin();
  regions.add('skill1', SKILL_HIT_X, SKILL_HIT_Y, 400, 120, { index: 0, group: 'skills' });
  regions.end();                                  // resolves THIS tick's tap/focus/activation
  if (regions.activated() === 'skill1') castSkill(0);
  input.endFrame();                               // always last
}
```

- **Expansion.** Any axis under `TAP_MIN = 96` logical px is grown about its centre to `TAP_MIN` and clamped inside the canvas; `TAP_GAP = 12` is the recommended (unenforced) clearance between neighbors. A dev build warns once per undersized id. PAUSE is the pattern even though it is a dedicated key: the ribbon draws it 64×64 at (1192, 24) but still registers an **explicit hit rect** `(1176, 0, 96, 96)`.
- **Drawn-first, two-pass hit test.** A point is tested against every DRAWN rect first, painter's order (last registered wins on overlap); only when none contains it does the registry fall back to the expanded HIT rects, same order. A region's drawn pixels therefore always beat a neighbor's expanded hit rect.
- **Tap commits on release in its own origin.** `activated()` fires on a real tap — pointer pressed AND released inside the *same* region, a drag-off cancels the press — OR on `A` while that region is focused; pointer wins when both land in one frame.
- **Cancel and blur clear, without completing a tap.** `pointercancel` and window `blur` drop `pointer.down` but fire no `released` edge (blur clears held keys the same way, with no `released`) — so a touch the OS took mid-gesture, or a tab-away mid-hold, can never read back as a finished tap or a stuck key.
- **Twin ids.** Registering one id twice (a sprite body and its side panel) makes them one target: a keyboard move never lands on a twin of the already-focused id, twins are invisible to the wrap-to-far-edge search, and the id's geometry (for the focus ring and `region()`) is its *first* registered twin — register the panel first when the ring belongs on it.
- **Keyboard focus moves spatially**: from the focused centre, `dirPressed()` picks the nearest candidate within a ±50° cone (distance + 2× perpendicular offset); failing that it wraps to the far edge of the focused region's `group`; failing that it cycles by `index` on a flat row/column.

## Audio unlock on first input

`onFirstInput` (alias `onFirstKey`) fires once, on the first keydown **OR** the first pointerdown — wire it to `audio.unlock()`. `audio.play(...)` before unlock is a silent no-op; never create an `AudioContext` or call `unlock()` outside a user gesture.

## The safe inset — mutable, per screen

HUD and hit-rect placement clamp against `getSafeInset()`, not a fixed constant: call `setSafeInset({ left, top, right, bottom })` once at boot (engine default 8 each). Every v3 screen sets **24 on every side**, and on a phone (CSS scale < 0.75) `SAFE_BOTTOM_PHONE = 40` on the bottom — the skill bar grows to `SKILL_H_PHONE = 80` there, its hit rects still reaching the bottom edge — nothing else moves. Hit rects may bleed into the margin; drawn panels may not.

## Cleanup and cross-references

`input.dispose()` removes every listener (keyboard, pointer, blur) — teardown only; single-game pages never need it. **improving-game-quality** owns the quality checklist (hints present and truthful); label and binding ownership stays here.

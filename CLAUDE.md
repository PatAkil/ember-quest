# Ember Quest

A roguelike JRPG — branching node map per act, turn-based one-on-one battles,
skill points, a loot table of named items, permadeath. TypeScript + Canvas 2D,
no framework. This repo holds **one game**; it was forked out of Retrovibe so
the game can grow on its own. Live at **https://patakil.github.io/ember-quest/**.

## Repo map

```
ember-quest/
├── DESIGN.md                 # the systems contract — read FIRST for any mechanics work
├── game/
│   ├── types.ts              # shared types + tuning constants (caps, SP gains, drop rates)
│   ├── data.ts               # ITEMS, SPELLS, ENEMIES, BIOMES, ACT_MULT — headless
│   ├── sim.ts                # pure rules + balance policies — headless
│   ├── sprites.ts            # hero/enemy/icon sprites
│   └── main.ts               # screens, input, juice, rendering (the style card is atop)
├── engine/                   # this game's OWN copy of the Retrovibe engine — editable
├── sim/run.mjs               # balance simulator runner (npm run sim)
├── smoke.mjs                 # headless boot gate (npm run smoke)
├── index.html                # arcade shell; game mounts into #screen
├── .github/workflows/pages.yml   # push to main = deploy to GitHub Pages
└── .claude/skills/           # ten skills; agents/game-writer.md
```

## Conventions

- **Commands run at the repo root**: `dev` (Vite, port 5173, strictPort), `check`
  (`tsc --noEmit`), `build`, `smoke`, `sim`.
- **Dev server lifecycle is port-based**: reclaim with `lsof -ti:5173 | xargs -r kill`;
  launch `npm run dev` in the background and poll for `Local:   http://localhost:5173/`.
  Launch it at the start of a session and leave it up — every save hot-reloads.
- **Done means**: `npm run check` after every edit; `npm run build` **and**
  `npm run smoke` green before a commit; `npm run sim` reviewed whenever rules or
  numbers moved. The user is the playtester — Claude reports "builds, boots clean,
  ready to play at <URL>", never "playtested".
- **Commit at green milestones, unsigned** (`commit.gpgsign=false` in this repo's
  config). Message = what changed for the player. `git add -A` is fine here: the
  repo is the game.
- **Push = release.** Only through **releasing-the-game**, only after the gates.
- **Headless boundary**: `game/data.ts` and `game/sim.ts` never import the engine
  or the DOM. Rules live in `sim.ts`; `main.ts` presents them. Break this and the
  simulator stops bundling.
- **DESIGN.md moves with the code.** A rules change edits the contract in the same
  milestone; a balance pass updates the *Balance state* table and its date.
- **Engine edits are allowed** — the engine here is a fork owned by this game.
  New primitives go into the owning module, are re-exported from `engine/index.ts`,
  and are added to the API table below in the same change. There is no fixture
  verification loop here; a visual change is verified by building, smoking, and
  the user looking at it.

## Skill routing

| Request | Skill |
|---|---|
| any edit to the game (default) | `iterating-on-a-game` |
| new or reshaped system, "more replayable", "longer runs" | `designing-mechanics` — discuss, decide, then contract in DESIGN.md |
| rules / numbers / items / enemies changed, "too easy", "too hard" | `balancing-with-the-simulator` |
| look, "go wild", flat or off-brand visuals | `ensuring-arcade-visuals` |
| pre-handoff feel & correctness pass | `improving-game-quality` |
| controls, labels, pressed/held semantics | `handling-user-input` |
| scene transitions, score, win/lose reporting | `messaging-game-over` |
| secrets, cheat codes, palette unlocks | `adding-easter-egg` |
| play / run / try; the runtime gate | `playing-the-game` |
| ship / publish / "let my brother play it" | `releasing-the-game` |

## Models & orchestration

`.claude/agents/game-writer.md` (Sonnet-class) writes code in milestone saves with
`npm run check` after each. The orchestrator owns the dev server, smoke, sim, and
git. **Escalation rule**: if check or smoke fails twice on the same approach,
escalate the writer one tier (Sonnet → Opus) for a fresh attempt. **Design first**:
mechanics changes go through `designing-mechanics` and a decision by the user
before code moves; parallel writers are fine once the contract is written, split
by module (data+sim vs sprites+main) so they do not collide.

## Engine API (this game's copy — authoritative surface is `engine/index.ts`)

Games import from `'../engine'`.

| Module | Key exports | Purpose |
|---|---|---|
| loop.ts | `createLoop({update, render})` → `.start()/.stop()` | Fixed-timestep (60 Hz) accumulator loop; frame-delta clamp (250 ms) + clock reset on focus; auto-pause on blur |
| input.ts | `createInput(actions, {onFirstKey})`, `controlHints(input)`, `BUTTON_KEY` | Arrows/WASD → `input.dir`; buttons A = Space/Z, B = X/C, PAUSE = P/Esc (dedicated, aliased — down while ≥1 alias down); `pressed/held/released`, `endFrame()` per tick; labels declared in code |
| scenes.ts | `createScenes()` → `.current/.is/.to/.onEnter` | Enforced machine `TITLE → PLAYING ⇄ PAUSED → (GAME_OVER | WIN) → restart` |
| draw.ts | `createPixelCanvas`, `makeSprite`, `flipSprite`, `drawSprite`, `frameIndex`, `drawText`, `drawTextCentered`, `textWidth`, `blink`, `pulse`, `drawLogo`, `fillBands`, `fillDither`, `drawBevel`, `drawFrame` | Pixel-scaled canvas, ASCII-art sprites, 3×5 bitmap font (5-wide M/W). `TextOptions.shadow`/`.outline` (bool or color; mutually exclusive; outline only at `scale >= 3`, degrades to shadow at 2). `makeSprite(rows, map, {outline, flipX})` bakes a 1-cell keyline (sprite grows 1 cell per side — use the inner size for hitboxes); `flipSprite`; `frameIndex(time, fps, count)`; `drawLogo(ctx, text, W, y, {color, shade, shadow, scale})` two-tone lit-from-above logo (`color` REQUIRED, from the palette); `fillBands` (horizontal gradient bands), `fillDither` (4×4 ordered dither, 50 %/25 %, cached per context), `drawBevel` (slab with light top/left, dark bottom/right), `drawFrame` (hollow border). `blink(time, period=0.9, onRatio=0.6)`, `pulse(time, period=1.2)` are clock-driven 0..1 helpers |
| palette.ts | `PICO8`, `GAMEBOY`, `DUSK`, `NEON`, `SUNSET`, `OCEAN`, `PALETTES`, `swapPalette`, `contrast` | Curated retro palettes (roles per index) + swap + `contrast(a,b)` legality (actors ≥3:1 vs static surfaces, ≥4.5:1 authored on any non-black ground — the CRT lift eats ~1.4×; ambient 1.8–2.5:1 band) |
| particles.ts | `createParticles({width, height, ambient, ambientColor})` → `.update/.render/.burst/.setAmbient` | Ambient presets (stars/rain/snow/embers/bubbles) built as 2–3 depth layers with per-particle twinkle and clumping; 2–3 px impact bursts |
| juice.ts | `createJuice()` → `.shake/.flash/.hitStop/.frozen/.update/.preRender/.postRender` | Screen shake (rounded to whole logical px), flash, hit-stop. Order: clear → `preRender` → world → `postRender` → CRT. `flash(color, duration, origin?)`: uniform overlay peaking at 0.55 alpha, or with `origin` (`{x, y}` logical px) a RADIAL flash centred on the impact (0.75 alpha at centre, transparent at 0.55× the larger frame dimension). Pass the origin on DEATH flashes; WIN/pickup flashes stay uniform |
| audio.ts | `createAudio()` → `.unlock/.play/.ready` | WebAudio chiptune sfx (`jump/pickup/explosion/hit/blip`); `unlock()` inside the first user gesture |
| ui.ts | `SAFE_MARGIN`, `drawScore`, `drawLives`, `hudText`, `drawPanel`, `dimScene` | HUD helpers with enforced edge margin and a 1-px drop shadow by default; `hudText` adds a translucent plate behind large centred text; `drawPanel(pc, x, y, w, h, {color, border})`; `dimScene(pc, alpha=0.55)` darkens the frame behind an overlay (overscans 16 px so shake can't expose an edge). Dim OR plate, never both |
| crt.ts | `createCrt()` → `.render(ctx, w, h, dt)` | Draw LAST. Halation (cached snapshot re-drawn ±1 device px, `'lighter'`), phosphor lift, scanlines (`'multiply'` toward mid-grey), vignette + flicker. `CrtOptions`: `scanlineAlpha` (0.09), `vignetteAlpha` (0.35), `flicker` (0.03), `halation` (0.09, 0 skips), `lift` (`'rgb(15,17,28)'`, `''` skips). Leaves context state as found |
| runtime.ts | `createRuntime()` → `.gameOver/.scoreChanged/.stateChanged/.embedded/.send` | Host contract, wire format `{source:'retrovibe', type, payload}`; a no-op when not embedded (the Pages build runs standalone) |

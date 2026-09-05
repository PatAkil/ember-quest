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
│   ├── types.ts                     # shared types + every rules constant not owned by a data/ row
│   ├── data/                        # (headless — no engine, no DOM)
│   │   ├── skills.ts                  # SKILLS — every character and enemy skill
│   │   ├── characters.ts              # CHARACTERS — roster, awakenings, leader skills
│   │   ├── enemies.ts                 # ENEMIES, BIOMES, BOSS_HP, ACT_MULT, ELITE_MULT, BOSS_MULT, LAP_MULT
│   │   ├── relics.ts                  # RELIC_MAIN_BASE, MAIN_BY_SLOT, MAIN_WEIGHTS, SUBSTAT_RANGES, LOOT_WEIGHTS, DROP_LEVEL
│   │   ├── sets.ts                    # SETS — 2-piece and 4-piece bonuses
│   │   ├── sigils.ts                  # SIGILS — effects on EPIC/LEGENDARY relics
│   │   ├── pacts.ts                   # PACTS — SHRINE curse/boon pairs
│   │   ├── ascension.ts               # ASCENSION — the A0–A10 ladder
│   │   └── index.ts                   # re-exports + validateData()
│   ├── sim/                         # (headless — bundled by sim/run.mjs)
│   │   ├── rng.ts                     # pick, uniformInt, weighted, chance (phase 2)
│   │   ├── battle.ts                  # ATB, the turn, damage, statuses, enemy AI, simulateBattle (phase 2)
│   │   ├── relics.ts                  # rolling, forging, set detection, derive, compare (phase 3)
│   │   └── run.ts                     # map, rooms, loot, laps, the Vault, simulateRun (phase 6a)
│   ├── art/
│   │   ├── parts.ts                   # layered sprite part library + anchors (phase 4)
│   │   ├── actors.ts                  # character/enemy recipes, animation rigs (phase 4)
│   │   └── vfx.ts                     # procedural effects by SkillId/status (phase 4)
│   ├── screens/*.ts                 # one file per screen; screens/vault.ts owns localStorage (phase 4; vault.ts phase 6a)
│   └── main.ts                      # boot, loop, scene routing, input dispatch
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
- **Headless boundary**: `game/data/*` and `game/sim/*` never import the engine,
  the DOM, `localStorage` or `Math.random` (rng is injected). Rules live in
  `game/sim/*`; `main.ts` and `game/screens/*` present them. Break this and the
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
| input.ts | `createInput(actions, {onFirstKey, onFirstInput, pointer})`, `controlHints(input)`, `pointerHints(input)`, `BUTTON_KEY`, `createHitRegions(input, {width, height})`, `TAP_MIN`, `TAP_GAP` | Arrows/WASD → `input.dir`; `input.dirPressed()` = the direction that went down this frame (edge, cleared by `endFrame`); buttons A = Space/Z, B = X/C, PAUSE = P/Esc (dedicated, aliased — down while ≥1 alias down); `pressed/held/released`, `endFrame()` per tick; labels declared in code. **Pointer** (`pointer: {canvas, width, height}`): primary pointer only, mapped to logical px through `getBoundingClientRect()`, capture on down, `input.pointer = {x, y, down, pressed, released, active, type}`; `onFirstInput` fires once on the first key OR tap (audio unlock). **Hit regions** (immediate mode, pooled): `begin()` / `add(id, x, y, w, h, {index, group, disabled})` / `end()` in `update()` BEFORE `input.endFrame()`; `activated()` = tapped (press and release inside the same region) OR A pressed while focused; `focused()/focus(id)/hovered()/pressing()/region(id)/hitRect(id)`; keyboard focus moves spatially on `dirPressed` (±50° cone, distance + 2×perpendicular, wrap to the far edge in the same group, index cycling on a flat row, twins with the same id skipped); hit rects are expanded to `TAP_MIN = 96` about the centre and clamped to the canvas, drawn rects are tested first (painter's order) so a drawn rect always beats a neighbour's expanded one; a dev warning once per id below TAP_MIN |
| scenes.ts | `createScenes()` → `.current/.is/.to/.onEnter` | Enforced machine `TITLE → PLAYING ⇄ PAUSED → (GAME_OVER | WIN) → restart` |
| draw.ts | `createPixelCanvas`, `pickBackingScale`, `makeSprite`, `flipSprite`, `drawSprite`, `bakeSprite`, `drawBaked`, `tintSprite`, `frameIndex`, `drawText`, `drawTextCentered`, `textWidth`, `FONT_RETRO`, `FONT_HD`, `blink`, `pulse`, `drawLogo`, `fillBands`, `fillDither`, `drawBevel`, `drawFrame` | Pixel-scaled canvas, ASCII-art sprites, 3×5 bitmap font (5-wide M/W). `TextOptions.shadow`/`.outline` (bool or color; mutually exclusive; outline only at `scale >= 3`, degrades to shadow at 2). `makeSprite(rows, map, {outline, flipX})` bakes a 1-cell keyline (sprite grows 1 cell per side — use the inner size for hitboxes); `flipSprite`; `frameIndex(time, fps, count)`; `drawLogo(ctx, text, W, y, {color, shade, shadow, scale})` two-tone lit-from-above logo (`color` REQUIRED, from the palette); `fillBands` (horizontal gradient bands), `fillDither` (4×4 ordered dither, 50 %/25 %, cached per context), `drawBevel` (slab with light top/left, dark bottom/right), `drawFrame` (hollow border). `blink(time, period=0.9, onRatio=0.6)`, `pulse(time, period=1.2)` are clock-driven 0..1 helpers **v3 additions**: `createPixelCanvas({smoothing})` (default false) and `pickBackingScale(cssWidth, dpr)` → 1, or 2 only on a dense desktop (never 1.5); two `BitmapFont`s — `FONT_RETRO` (3×5, uppercases) and `FONT_HD` (7×11 mixed case, 99 glyphs, descenders, slashed zero) — selected per call with `TextOptions.font`, rendered one `drawImage` per glyph from a cached per-(font, scale, colour) atlas (64-entry LRU), outline honoured from `font.outlineMinScale` (1 for HD); `bakeSprite(sprite, px)` → offscreen bitmap, `drawBaked(ctx, bitmap, x, y, {flipX, scale, alpha, rotation, originX, originY})` draws it hard-pixelled with smoothing forced off and restored, `tintSprite(sprite, map)` palette-swaps a Sprite (element tints) |
| palette.ts | `PICO8`, `GAMEBOY`, `DUSK`, `NEON`, `SUNSET`, `OCEAN`, `PALETTES`, `swapPalette`, `contrast` | Curated retro palettes (roles per index) + swap + `contrast(a,b)` legality (actors ≥3:1 vs static surfaces, ≥4.5:1 authored on any non-black ground — the CRT lift eats ~1.4×; ambient 1.8–2.5:1 band) |
| particles.ts | `createParticles({width, height, ambient, ambientColor})` → `.update/.render/.burst/.setAmbient` | Ambient presets (stars/rain/snow/embers/bubbles) built as 2–3 depth layers with per-particle twinkle and clumping; 2–3 px impact bursts |
| juice.ts | `createJuice()` → `.shake/.flash/.hitStop/.frozen/.update/.preRender/.postRender` | Screen shake (rounded to whole logical px), flash, hit-stop. Order: clear → `preRender` → world → `postRender` → CRT. `flash(color, duration, origin?)`: uniform overlay peaking at 0.55 alpha, or with `origin` (`{x, y}` logical px) a RADIAL flash centred on the impact (0.75 alpha at centre, transparent at 0.55× the larger frame dimension). Pass the origin on DEATH flashes; WIN/pickup flashes stay uniform |
| audio.ts | `createAudio()` → `.unlock/.play(name, {pitch, gain})/.ready/.setVolume/.mute` | Synthesized chiptune sfx through one master gain and a soft-knee limiter, per-name cooldowns: `hit magic crit glance burn heal shield buff debuff death enemyDeath turn skill target ui confirm cancel card equip skip win lose boss enrage` (v2's `jump/pickup/explosion/blip` stay as aliases); `unlock()` inside the first user gesture |
| ui.ts | `SAFE_MARGIN`, `setSafeInset`, `getSafeInset`, `drawScore`, `drawLives`, `hudText`, `drawPanel`, `dimScene` | HUD helpers with enforced edge margin and a 1-px drop shadow by default; `hudText` adds a translucent plate behind large centred text; `drawPanel(pc, x, y, w, h, {color, border})`; `dimScene(pc, alpha=0.55)` darkens the frame behind an overlay (overscans 16 px so shake can't expose an edge). Dim OR plate, never both **v3**: the inset is mutable — `setSafeInset({left, top, right, bottom})` (default 8 each; v3 screens set 24, and a 40 bottom on a phone) and every helper clamps against `getSafeInset()`; `SAFE_MARGIN` stays the v2 constant; `hudText` takes `font`; `DIM_BLEED` is 40 |
| light.ts | `createLight({width, height, tier})` → `.setTier/.tier/.setBiome/.renderBackground/.renderLightPlane/.renderPost/.drawContactShadow/.note`; types `BiomeLook`, `BiomeLooks`, `LightActor`, `LightTier`, `KeyLight`, `PoolLight`, `GradeLook`, `FogLook`, `MoteLook`, `ShaftLook`, `PlanePainter` | The HD-2D scene layer (phases 7a/7b). A `BiomeLook` is DATA — key/fill/pool lights, grade + vignette, fog, motes, shafts, rim colour, an ambient preset for particles.ts, and four `PlanePainter`s (far · mid · floor · near). Everything is baked ONCE per (biome, tier): the four planes into padded offscreens with the blur baked in (`ctx.filter`, or a down/up-sample fallback), the whole light rig (key + fill + pool + shafts + the HIGH highlight lift) flattened into ONE bitmap, and the grade + vignette into an opaque multiply map. A frame then draws bitmaps: `renderBackground` (far · mid · floor at their parallax offsets — depth < 1 lags the camera shake, and the planes are oversized by `PLANE_PAD = 40` so no edge shows), actors, `renderLightPlane` (the near plane over them, then the light map at `'lighter'`, per-actor rim spill and prop glow as baked sprites, drifting fog, seeded dust motes), `renderPost` (bloom, then the grade). `drawContactShadow(ctx, feetX, feetY, w)` is a hard two-row ellipse at 0.46 alpha with a denser core — call it before the actor. **Tiers**: HIGH ≈ 7.3 ms/frame at 1280×720 on headless software Chromium (¼-res bloom, highlight lift), MED ≈ 6.3 (⅛-res bloom, mid+floor merged, half the motes, no lift), LOW ≈ 1.5 (one flat opaque backdrop with the key light and grade baked in, vignette only — no blur, no bloom, no light plane), ARCADE = LOW's planes with the caller applying `crt.render`. `note(frameMs)` drops HIGH/MED to LOW after 60 consecutive frames > 20 ms, one way. Bloom is frame-derived (downscale → self-multiply threshold → glow blobs → blur → nearest 2-step upscale) and its SOURCE refreshes on alternate frames — reading back the display canvas costs ~2 ms and a blurred quarter-res signal cannot change fast enough to show it. `renderPost` leaves context state as found. Zero per-frame allocation; `getImageData` never runs in the loop. Bloom XOR CRT halation: the HD tiers must not call `crt.render`. |
| crt.ts | `createCrt()` → `.render(ctx, w, h, dt)` | Draw LAST. Halation (cached snapshot re-drawn ±1 device px, `'lighter'`), phosphor lift, scanlines (`'multiply'` toward mid-grey), vignette + flicker. `CrtOptions`: `scanlineAlpha` (0.09), `vignetteAlpha` (0.35), `flicker` (0.03), `halation` (0.09, 0 skips), `lift` (`'rgb(15,17,28)'`, `''` skips). Leaves context state as found. **v3**: `vignetteAlpha: 0` skips the vignette, and with every layer off (`{scanlineAlpha: 0, flicker: 0, halation: 0, lift: '', vignetteAlpha: 0}`) `render` is an early return — the HD tiers do not call it at all |
| runtime.ts | `createRuntime()` → `.gameOver/.scoreChanged/.stateChanged/.embedded/.send` | Host contract, wire format `{source:'retrovibe', type, payload}`; a no-op when not embedded (the Pages build runs standalone) |

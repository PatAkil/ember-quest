# Ember Quest — the Kotlin Multiplatform plan

Status: **draft for review**, written 2026-09-11 against HEAD `2e50f92` (main and
`claude/fable-credits-reset-wbtv7t` are the same commit). The review log is
`KMP-PLAN-REVIEW.md`. This document is the plan; DESIGN.md stays the game's
systems contract and is not replaced by it.

The plan has two halves that are deliberately kept apart:

- **Part A — Technical**: how the game moves from TypeScript + Canvas 2D to Kotlin
  Multiplatform (KMP) for native Android and iOS apps, and how the new codebase is
  built test-first, specified executably, and held to a quality bar by static analysis.
- **Part B — Functional**: what changes for the player. Two items are decided in
  outline (AI-generated images for every actor; the behaviours a mobile app must have)
  and two are placeholders the owner will fill after this plan is final (the character
  changes; PvP).

The ordering rule that ties them together: **parity before change**. The port
reproduces the game that exists today — rules bit for bit, the run flow decision for
decision, the look to the critic's bar — and only then do the functional changes land
on the new codebase. Section 2 says why.

---

## 0. Summary

**Decision.** Kotlin Multiplatform with **Compose Multiplatform** as the rendering
and input layer, Kotlin in `commonMain` for every rule, targets Android and iOS first,
desktop (JVM) as the development and tooling target, web (Kotlin/Wasm) as a secondary
target to keep the GitHub Pages URL alive. One language for client, tools, tests and
the future PvP server. Alternatives considered are in §A1.3; the choice is confirmed
or overturned by a one-week spike (§A10, phase T0), not by this document.

**Shape.** A new repository with Gradle modules that mirror the boundary the TS code
already enforces: `:rules` (pure, deterministic, no platform), `:engine` (rendering,
input, audio, storage primitives), `:game` (screens), `:sim` (the balance harness),
`:specs` (executable specifications), `:tools` (asset intake and the art loop's
instruments), and thin app modules per platform. Twenty-two thousand lines of
procedural sprite and backdrop code are **not ported**: actors become AI-generated
bitmaps (decided 2026-09-09), backdrops and sound are exported once from the TS build
as image and audio assets.

**Correctness.** The TS simulator is the **oracle**: for every seed and policy it
produces a `RunResult` stream with a SHA-256 over the full records. The Kotlin rules
must reproduce those hashes on every target. Every rule in DESIGN.md gets a stable
ID, every ID gets executable scenarios (Gherkin, run by Cucumber-JVM against the
common rules), and a traceability check fails the build when either side is missing.

**Quality.** Test-first is the working method for every task, verified by the run
logs the agents report, by mutation testing on the rules, and by coverage thresholds.
A single `./gradlew gate` runs the compiler in warnings-as-errors and explicit-API
mode, ktlint, detekt with custom rules that encode this game's conventions (rng last,
no platform randomness in rules, no engine import in rules), Konsist architecture
tests, Kover coverage, the specs, the golden replays, and the balance regression.

**Order.** T0 spike → T1 walking skeleton with all gates → T2 rules by TDD against
the oracle → T3 simulator and balance gate → T4 asset pipeline → T5 engine → T6
screens and the whole run → T7 devices and stores → T8 cut-over. AI asset generation
runs in parallel from day one on the owner's side. Functional changes (characters,
PvP) queue behind T3 for rules and behind T8 for anything the player sees.

**What it costs.** Roughly 20–25 k lines of Kotlin including tests (§A2.5), an
Apple Developer and a Google Play account, a Mac or CI minutes for iOS builds, and
about 183 generated sprite frames on the owner's side (§B2.2). The agent cadence
that built v3 (47 k lines of TS between 2026-09-04 and 09-09) suggests the code side
is weeks of sessions, not months; the asset side and on-device verification are the
long poles.

A note on the premise. Wrapping today's web build with Capacitor would put it in
both stores in days. It would not give the things this plan is for: a codebase built
test-first with executable specifications, static analysis, native performance
headroom for the lit scene on phones, and one language shared with a PvP server. The
wrap remains available as a **bridge** so the brother can play from a store while the
port proceeds (§A12, decision 8).

---

## 1. Where the game stands (the scan)

### 1.1 What exists

| Area | Files | Lines | Nature | Fate in the port |
|---|---|---|---|---|
| Contract | `DESIGN.md` (1 800 lines), `DESIGN-REVIEW.md`, `ART-REVIEW.md`, `STATUS.md`, `CLAUDE.md` | — | Prose + tables, blind-reviewed | Carried over; DESIGN.md gains rule IDs (§A5.1) |
| Types + constants | `game/types.ts` | 637 | Closed unions, every rules constant | Ported 1:1 to enums, sealed interfaces, `const val` |
| Content | `game/data/*.ts` | 941 | Tables: 24 hero skills, 43 actors, 6 biomes, 16 sets, 12 sigils, 6 pacts, A0–A10, loot tables; `validateData()` | Ported 1:1; `validateData` becomes a test |
| Rules | `game/sim/rng.ts`, `relics.ts`, `battle.ts`, `run.ts`, `runstep.ts` | 3 354 | Pure, headless, rng injected, draw order is a contract | Ported by TDD against the oracle (§A3) |
| Screens | `game/screens/*.ts`, `game/main.ts` | 8 416 | Canvas presentation of the run seam; hit regions; HUD | Ported as Compose canvas screens (§A7) |
| Engine | `engine/*.ts` | 5 674 | Loop, input, hit regions, fonts, baked sprites, palette, particles, juice, audio synth, HD-2D light rig (1 863), CRT, host runtime | Ported selectively; light rig re-expressed on Skia; audio exported; CRT deferred; host runtime dropped |
| Art | `game/art/parts*.ts`, `actors*.ts`, `backdrops.ts`, `vfx.ts`, `pixel/*`, `bitmap/*` | 22 300 | Procedural sprite kit, procedural biome painters, particle VFX, the bitmap-actor runtime (stage 0 of option C) | Kit and painters **not ported**; bitmaps and a data-driven VFX system are |
| Tools | `tools/*.mjs`, `tools/*.ts`, `sim/run.mjs`, `smoke.mjs` | 6 300 | Capture, intake, the in-scene and sheet rulers, the fixture harnesses, the Monte Carlo runner, the boot gate | Re-created as `:tools` and `:sim` (JVM); Playwright smoke replaced by per-target boot tests |
| Workflow | `.claude/skills/*` (10), `.claude/agents/game-writer.md`, `.claude/prompts/*` (4) | — | Orchestrator + writer + blind verifier/critic loops, gates before every commit | Rewritten for Gradle (§A9) |

Total: 47 654 lines of TypeScript and scripts. Deployed by `.github/workflows/pages.yml`
to https://patakil.github.io/ember-quest/ on every push to `main`.

### 1.2 What the code already does right for a port

- **The headless boundary is real.** `game/data` and `game/sim` import no engine, DOM,
  storage or ambient randomness; `sim/run.mjs` refuses to run if the bundle mentions
  `window`, `document`, `localStorage` or `engine/`. The rules are pure functions of
  (state, answer, rng).
- **Determinism is a contract, not a hope.** `pick(n, rng) = floor(rng() × n)` is the only
  integer draw; every rolling function takes `rng` last; the order of draws is written
  down per step (rollRelic's eight steps, the turn's ten). `mulberry32(seed)` seeds both
  the harness and the live game (`game/main.ts:267`), so a seed plus a decision log
  replays a run — the dev hook `__eq.decisions()` already does it.
- **The run is a seam.** `runstep.ts`'s `createRun` exposes `state() / pending() /
  token() / decide()`; screens decide nothing and re-derive no rule. `sim/run.mjs
  --selfcheck` proves `simulateRun`, `runSteps + answerWith` and `createRun` agree
  deep-equal per run.
- **The oracle exists.** `sim/run.mjs --dump` prints a SHA-256 over the full
  `RunResult[]` per policy (and per fixture in `--battles` mode); `--json` gives the
  aggregates; the Balance state table in DESIGN.md is a recorded, dated measurement.
- **The art decision is made.** Option C (2026-09-09): every actor is an image-model
  bitmap at its on-screen size; the intake, registry and `drawActor` branch exist
  (stage 0). Twelve artist-plus-critic rounds of the procedural kit are history.

### 1.3 What the code does not have

- **No unit tests.** Quality today is `tsc --strict`, a Playwright boot smoke, the
  simulator's self-checks and refusals, `validateData()`, and blind agent verification
  of claims against captured frames and numbers. There is no test framework in
  `package.json`.
- **No executable specification.** DESIGN.md is precise but prose; its worked examples
  are checked by people and agents, not by a runner.
- **No static analysis beyond the compiler.** No linter, no complexity limits, no
  architecture check other than the bundle-regex refusal.
- **No mid-run persistence.** A reload loses the run; only the Vault survives (one
  `localStorage` key, version-tagged, corrupt → reset). A phone kills background apps,
  so this becomes a requirement (§B3.1).
- **No device measurement.** Performance is measured on headless software Chromium
  (HIGH tier ≈ 7–11 ms per frame); the phone layout is verified on a 390×844 Playwright
  viewport. Nobody has played it on a device.
- **Platform text.** The HUD uses the system sans font
  (`layout.ts:412`), so text metrics differ per platform today already.

### 1.4 Numbers the port is measured against

| Quantity | Value | Source |
|---|---|---|
| Actors | 43 (6 heroes, 6 bosses, 6 elites, 25 normals) | `game/data` |
| Bitmap frames to generate | 6×7 + 6×7 + 6×4 + 25×3 = **183** | `.claude/prompts/bitmap-pipeline.md` poses |
| Bitmap class heights (px) | hero 112 · small 72 · medium 96 · large 112 · elite 128 · boss 192 | DESIGN.md → Layered actors |
| Biomes × planes | 6 × (far, mid, floor, near) + 6 flat LOW planes + 6 light maps + grades | `engine/light.ts` |
| VFX archetypes / skill families | 13 / 13 | `game/art/vfx.ts` |
| Sound effects | 24 | `engine/audio.ts` |
| Policies | 9 | `game/sim/run.ts` |
| Balance ladder (`balanced`, seed 1, 5 000 runs) | act 1 91.1 % · 2 56.2 · 3 40.2 · 4 30.1 · 5 22.3 · 6 14.8 | DESIGN.md → Balance state |
| Logical frame | 1280×720, landscape, `TAP_MIN 96` | DESIGN.md → Presentation |

---

## 2. Principles

1. **Parity before change.** The port reproduces today's game. Rules are bit-identical
   (§A3); the run flow is decision-identical (§A5.4); the look is judged by the same
   instruments and the same critic loop, not by bytes (§A7.6). A functional change
   during the port would invalidate the oracle it is measured against.
2. **The pipeline before the code.** Phase T1 delivers every gate on an almost empty
   repository. No rule is ported until the build fails for the right reasons.
3. **One language.** Rules, screens, tools, tests, the simulator and (later) the PvP
   server are Kotlin. The only non-Kotlin code is the Xcode host and the workflow YAML.
4. **Rules stay pure.** `:rules` depends on nothing but the Kotlin standard library and
   `kotlinx.serialization`. Randomness is injected, last. No time, no platform, no
   floats that vary by target. Enforced by detekt and Konsist, not by discipline.
5. **Specifications are the contract's executable shadow.** DESIGN.md states a rule
   once, with an ID; a scenario proves it; the trace check keeps the two sides in step.
6. **Test first, and show it.** A task's report carries the red run and the green run.
   Mutation testing keeps the tests honest.
7. **Simple beats clever.** Data classes and sealed hierarchies over frameworks; no
   dependency injection container; no reflection; complexity limits in detekt; the
   procedural art code is replaced by assets rather than ported.
8. **Agents verify, the owner plays.** Every writer gets a blind verifier; every visual
   change gets a critic; nobody claims to have playtested. Unchanged from CLAUDE.md.

---

# Part A — Technical

## A1. Platform and stack

### A1.1 Targets

| Target | Role | Minimum | Notes |
|---|---|---|---|
| Android | Primary | API 29 (Android 10) | `BlendMode.ColorDodge / Plus / Multiply / DstOut` need API 29; `RenderEffect` blur needs 31 — the bloom falls back to the MED/LOW tiers below 31 (§A7.3) |
| iOS | Primary | iOS 16 | Compose Multiplatform for iOS is stable; Skia over Metal |
| Desktop (JVM) | Development, tools, headless capture, the simulator | Java 21 | The `dev server` of the new world: `./gradlew :app:desktop:run` with Compose Hot Reload |
| Web (Kotlin/Wasm) | Secondary | Wasm GC browsers | Compose for Web is beta-grade at the time of writing; the TS build keeps serving the Pages URL until the Wasm build passes the parity checklist (§A10, T8) |

Landscape only, 1280×720 logical, letterboxed by the platform window — exactly the
contract's canvas rule, with the CSS fitting replaced by one scale transform (§A7.1).

### A1.2 Stack

| Concern | Choice | Why |
|---|---|---|
| Language / build | Kotlin (K2), Gradle with a version catalog, configuration cache and build cache on | The only multiplatform toolchain JetBrains and Google both back |
| UI / rendering | Compose Multiplatform; one `Canvas` composable per frame; `DrawScope` with `drawImage`, `BlendMode`, `FilterQuality.None`; `GraphicsLayer` + `RenderEffect` for the bloom pass | Common API on all four targets; hard pixels, additive and multiplicative compositing and blur are all expressible |
| Serialization | `kotlinx.serialization` (JSON) | Saves, decision logs, golden fixtures, PvP later |
| Persistence | One JSON file per save via `kotlinx-io`, versioned; corrupt → reset (today's rule) | No database needed for 12 relics and one run |
| Audio | expect/actual player over pre-rendered clips (Android `SoundPool`, iOS `AVAudioPlayer`, desktop `javax.sound`, web `AudioContext`) | The 24 synthesized sounds are exported once (§A8.3); a synth port is work with no player-visible upside |
| Tests | `kotlin.test` runner on every target; Kotest assertions and property testing (multiplatform); Cucumber-JVM for feature files; Compose UI test (`runComposeUiTest`) for flows; Roborazzi for screenshots | §A4, §A5 |
| CLI tools | Clikt | `:sim` and `:tools` command lines |

Versions are pinned in `gradle/libs.versions.toml` at the spike; this document names
no version numbers because the spike, not the plan, verifies them.

### A1.3 Alternatives considered

| Option | Verdict | Reason |
|---|---|---|
| **Compose Multiplatform** | **Chosen** | Backed by JetBrains, stable on Android and iOS, common canvas API with the blend modes and blur the light rig needs, first-class KMP, Compose Hot Reload for the dev loop, headless rendering on desktop for the art instruments |
| KorGE | Rejected | A capable KMP game engine, but a single-maintainer project with a slowed release cadence; the plan's first word is *sustainable* |
| libGDX / KTX | Rejected | JVM-centric; iOS via RoboVM is a separate, aging toolchain; not KMP `commonMain` |
| Capacitor wrap of the TS build | Bridge only | Ships in days, changes nothing about the codebase (§0) |
| Godot / Unity | Out of scope | Not Kotlin; the owner asked for KMP |

The spike (T0) can still overturn the choice: if Compose cannot render a lit battle
frame at 60 fps on a mid-range Android phone with the bloom on, the fallback is to
keep Compose for screens and draw the battle through Skiko directly on the Skia
targets with an Android `SurfaceView` path — a larger platform-specific surface, and
the reason the spike comes first.

## A2. Repository and module architecture

### A2.1 Repository

A **new repository** (`ember-quest-kmp`, owner's GitHub), not a directory inside this
one: Gradle, Renovate, CI and the agents' CLAUDE.md conventions should not share a root
with Vite and npm. This repository stays as it is, becomes the oracle for phases T2–T3,
and is tagged `ts-final` and archived at cut-over (T8). The golden fixtures the oracle
produces are committed to the new repository with the TS commit hash in their header,
so the new repository never needs Node to run its tests.

### A2.2 Modules and the dependency rule

```
:rules        commonMain — types, data, rng, relics, battle, run machine        depends on: kotlinx.serialization only
:engine       commonMain — frame loop, canvas scaling, input + hit regions,     depends on: Compose, kotlinx-io
              bitmap font atlas, baked sprites, light rig, particles, juice,
              audio player, storage
:game         commonMain — screens, the run adapter, art registry, VFX recipes, depends on: :rules, :engine
              the bitmap-actor runtime, boot
:sim          jvmMain    — Monte Carlo harness, policies runner, golden dumper   depends on: :rules
:specs        jvmTest    — Gherkin features + step definitions, the trace check  depends on: :rules, :game (run scripts)
:tools        jvmMain    — intake (image → sprite), capture, seats, metrics,    depends on: :game, :engine
              plane/light-map/sfx exporters' consumers
:app:android  Activity host                                                       depends on: :game
:app:ios      Kotlin framework + iosApp/ Xcode project (SwiftUI host)            depends on: :game
:app:desktop  JVM window host                                                    depends on: :game
:app:web      Wasm host                                                           depends on: :game
```

The arrows point one way and Konsist tests assert them (§A6.2): `:rules` imports
nothing platform-shaped; `:engine` never imports `:rules`; `:game` is the only module
that knows both. Inside `:rules`, packages mirror today's files — `types`, `data`,
`rng`, `relics`, `battle`, `run` — and `data` may import `types` only, exactly
DESIGN.md's module table.

### A2.3 How the TS shapes map to Kotlin

| TS | Kotlin | Note |
|---|---|---|
| String-literal unions (`Element`, `Stat`, `StatusKind`, `SkillId`, `SetId`, `RoomType`, …) | `enum class` | `SkillId` is an enum of ~130 entries; `EnemyId` stays a value class over `String` as today |
| Discriminated unions (`SetBonus`, `SigilEffect`, `Modifier`, `BattleEvent`, `RunPending`) | `sealed interface` + data classes; exhaustive `when` | The compiler replaces `assertNever` |
| `Record<K, V>` tables | `Map<K, V>` built once, `EnumMap` where the key is an enum | Immutable after load |
| Interfaces with mutable fields (`Actor`, `PartyMember`, `Relic`) | `class` with `var`s inside `:rules.battle`; `data class` where the contract says it is data (`Relic`, `Status`) | Mutation stays inside the battle and run machine, never leaks out (snapshots are copies, as `runstep.ts` does today) |
| `Rng = () => number` | `fun interface Rng { fun next(): Double }` | Last parameter everywhere; detekt rule (§A6.1) |
| `runSteps` generator (`yield` a pending, receive an answer) | An explicit **state machine**: `RunMachine.step(answer): Pending?` over a `RunState` data class | Kotlin's `sequence {}` cannot receive a value at `yield`; a coroutine with a `CompletableDeferred` could, but a state machine is what persistence (§A7.5) and a server (§B4) want anyway. The oracle proves the equivalence |
| `Policy` with 13 methods | `interface Policy` | Unchanged; policies live in `:rules` because DESIGN.md defines them as part of the contract |
| `validateData(): string[]` | The same function in `:rules.data`, and a test that asserts it returns empty | Runs on every target |

### A2.4 What is not ported, and what replaces it

| Not ported | Lines | Replacement |
|---|---|---|
| The procedural sprite kit (`parts.ts`, `parts-late.ts`, the kit branches of `actors.ts` / `actors-late.ts`, `pixel/*`) | ≈ 14 000 | Bitmap actors (option C): a registry generated from `manifest.json`, `drawActor` = one `drawImage` per actor. The KMP app launches only when every actor has a bitmap (§B2.3), so no fallback kit is needed |
| Procedural biome painters (`backdrops.ts`) | 4 357 | The four planes per biome exported **once** from the TS build as PNGs at the pad scale, plus the flat LOW plane and the baked light map and grade map per (biome, tier) — "export, don't port" (§A8.2). Regeneration or AI-generated planes are a functional decision (§B2.4) |
| Procedural VFX (`vfx.ts`) | 3 708 | A small particle system in `:engine` (≈ 400 lines) and one recipe per family in `:game` as data (≈ 300 lines); the 13 archetypes' parameters are transcribed, the look is re-judged by the critic |
| WebAudio synth (`audio.ts`) | 406 | 24 clips rendered offline from the TS synth (§A8.3) |
| CRT (`crt.ts`) and the ARCADE tier | 208 | Deferred; possible later as an AGSL/SkSL shader behind the same toggle. Bloom and the grade are in scope; the CRT is not on the parity checklist |
| Host runtime (`runtime.ts`, `postMessage`) | 63 | Dropped; a native app has no host frame |
| Playwright smoke, Vite, esbuild bundling | — | Boot tests per target (§A4.2); Gradle |
| `tools/study.*`, the grid intake (option B) | ≈ 1 800 | Superseded before the port |

### A2.5 Size estimate

| Module | Kotlin lines (est.) | Basis |
|---|---|---|
| `:rules` | 5 000 + 3 500 tests | 1:1 from 4 900 TS lines; tests are new |
| `:specs` | 2 500 (features + steps) | ≈ 150 rules × 2–4 scenarios |
| `:engine` | 3 000 + 800 tests | Light rig shrinks (planes are assets); fonts via Compose text plus one bitmap atlas |
| `:game` | 6 500 + 1 500 UI/screenshot tests | Screens 1:1 minus canvas boilerplate; VFX as data |
| `:sim` | 600 | 1:1 from `run.mjs` |
| `:tools` | 1 500 | Intake, capture, seats, metrics; the sheet rulers for the kit's ramps retire with the kit |
| Apps | 400 | Hosts |
| **Total** | **≈ 20–25 k** | Against 47.7 k TS today |

## A3. Determinism and the parity oracle

The rules port is not judged by review; it is judged by hashes.

### A3.1 The oracle fixtures

From this repository, at the tagged TS commit, a script writes `oracle/`:

- `mulberry32.json` — the first 10 000 outputs for seeds 1, 2, 7, 12, 4 242.
- `rng-primitives.json` — `pick`, `uniformInt`, `weighted`, `chance`,
  `withoutReplacement` over scripted sequences.
- `relics/<seed>.json` — `rollRelic` for every (source, act, lap, ascension, forced)
  cell, 200 relics each, full records.
- `battles/<policy>-<fixture>-<seed>.json` — `--battles` mode: 2 000 battles per cell,
  the aggregate row **and** the full `BattleResult` for the first 25 battles; the SHA-256
  over all 2 000 (today's `--dump`).
- `runs/<policy>-<seed>.json` — `--runs 2 000` per policy and seeds 1, 2, 7: the ladder
  aggregates, the full `RunResult` for the first 20 runs, the SHA-256 over all 2 000.
- `scripts/<name>.json` — decision logs (the `playfull-decisions.json` format: seed,
  config, decisions, and the end state) for a two-act run with a KO, a full six-act win
  under a scripted strong party, a lap, a bank overflow, and a SUMMON swap.

The Kotlin side re-derives every file and compares. Full records for the first N make a
mismatch diffable; the hash over all N makes a reordering that averages to the same
numbers a failure.

### A3.2 Numeric parity rules

| Risk | Rule in the port | Test |
|---|---|---|
| `Math.round` (JS rounds half toward +∞) vs `kotlin.math.round` (half to even) | A single `jsRound(x: Double): Int = floor(x + 0.5)` in `:rules.types`; `kotlin.math.round` and `roundToInt` are **forbidden** in `:rules` by detekt | `mulberry32.json`-driven relic rolls hit half-way cases (`× 0.15`, `× 0.5`) |
| `Math.imul`, `>>> 0`, `/ 4294967296` in mulberry32 | `Int` arithmetic with `toUInt().toDouble()` at the end; unit-tested against the vector | `mulberry32.json` |
| `Math.pow(LAP_MULT.x, lap − 1)` (three sites in `battle.ts`) | Integer-exponent power by repeated multiplication **in both**: the TS oracle generator is patched the same way before the fixtures are dumped, and the patch is verified to change no hash at laps 1–3 | `runs/lapper-*.json` covers laps ≥ 2 |
| FMA contraction on ARM (`a × b + c` fused by the native compiler) | The golden tests run on iOS simulator arm64, Android arm64 emulator, JVM and Wasm in CI; a mismatch on one target is a build failure, and the fix is `-Xno-fma`-class flags or restructuring the expression, never a tolerance | CI matrix (§A6.4) |
| `Double` vs `Float` | `Float` is forbidden in `:rules` (detekt `ForbiddenImport`/type rule) | — |
| Iteration order of tables | Every table in `:rules.data` is an ordered `List`/`LinkedHashMap` built from a literal in DESIGN.md order; `weighted()` walks that order | `relics/*.json` |
| String sorting / locale | No locale-sensitive operations in `:rules`; ids are enums | — |

### A3.3 Exit criterion for the rules port

Phase T2 ends when, on **all four targets**, every oracle file matches: the primitives
and relic cells exactly, the battle and run hashes exactly, the twenty full records
deep-equal, and the decision scripts reach the same end state. From then on the Kotlin
simulator is the oracle and the TS repository is history.

## A4. Test strategy and the TDD working method

### A4.1 The pyramid, by module

| Layer | Where | What | Runner |
|---|---|---|---|
| Unit | `:rules` commonTest | Every function with a rule in DESIGN.md; the scripted-rng technique (§A5.3); property tests for invariants (`hp ≤ maxHp` after every refit, `atb` never clamped, `validateData()` empty, every enum exhaustively handled) | `kotlin.test` on all targets, Kotest property |
| Executable spec | `:specs` jvmTest | Gherkin scenarios per rule ID, run scripts | Cucumber-JVM |
| Golden / differential | `:rules` commonTest | The oracle files (§A3.1) | `kotlin.test` on all targets |
| Balance regression | `:sim` jvmTest | The DESIGN.md Balance state ladder within ±1.0 points per act at 2 000 runs, stall < 0.5 % | `kotlin.test` |
| Engine unit | `:engine` commonTest | Hit-region geometry (TAP_MIN expansion, drawn-rect-beats-expanded, spatial focus), the frame accumulator, the tier controller (`note(frameMs)`), the save codec with corrupt inputs | `kotlin.test` |
| Screenshot | `:game` desktopTest (+ Android, iOS sim nightly) | Every run screen on a fixture (today's `tools/screens.html?screen=…&fixture=…`), the battle frame at seed 1, a hit frame, the KO tableau; perceptual diff with a threshold; an approved-image workflow | Roborazzi |
| Flow | `:game` desktopTest, iOS simulator nightly | The decision scripts driven **through the hit regions** — today's `playfull` — asserting the same end state and capturing one frame per distinct screen | Compose UI test |
| Boot | each app | The app starts, the title renders, no uncaught error within 60 frames | Android instrumented test, iOS XCTest, desktop headless, Wasm in a headless browser |
| Device | manual + CI nightly | Frame time histogram on two reference phones (§A7.7) | `:tools` perf command |

### A4.2 The TDD loop, and how it is verified

Every task an agent takes — a rule, a screen, an engine primitive — runs the same loop,
and the task template in the new CLAUDE.md is the loop:

1. **Locate the rule.** Name the DESIGN.md rule ID (add one if the rule is new — a
   functional change, which needs the owner first).
2. **Write the test or scenario first.** For a rule: the Gherkin scenario and/or the
   unit test; for a screen: the screenshot fixture or the flow step; for an engine
   primitive: the unit test.
3. **Run it red.** The runner must show the new test failing for the expected reason. The
   agent quotes the failing test names and the assertion line in its report.
4. **Implement the minimum.** No speculative generality.
5. **Run it green.** Quote the passing run.
6. **Refactor under the gates.** `./gradlew gate` (§A6.3) must stay green.
7. **Commit test and code together**, message = what changed for the player or the
   contract, plus the rule IDs.

Three mechanisms keep it honest, because a rule that lives only in a prompt is not a
rule:

- **The report format.** A writer's report has `RED:` and `GREEN:` fields with the
  quoted runner lines; the blind verifier re-runs both the test and the gates on a
  clean checkout and rejects a report whose red run cannot be reproduced by reverting
  the implementation commit.
- **Mutation testing** on `:rules` (Pitest on the JVM target with the Kotlin plugin;
  nightly on the whole module, on the changed files per PR): a mutation score below
  the threshold (start 80 %, raise as the port matures) fails the gate. A test that
  cannot kill mutants is not a test.
- **Coverage thresholds** per module in Kover: `:rules` ≥ 95 % line, `:engine` ≥ 75 %,
  `:game` ≥ 60 % (screens are covered by screenshots and flows more than by lines). A
  CI check also fails when a commit touches `:rules/src/commonMain` without touching a
  test or feature file — a heuristic, deliberately loud rather than clever.

### A4.3 The scripted rng

Every roll-dependent rule is tested by handing the function an `Rng` that returns a
scripted sequence and asserting **both** the outcome and the number of draws consumed.
The draw count is the contract's own promise ("always one draw", "no draw at p = 0")
and is what keeps two faithful implementations on the same stream. A helper
`ScriptedRng(0.1, 0.9, …)` throws if a draw is asked for beyond the script, and a test
asserts `rng.consumed == n` at the end. This is the single most important testing
technique in the port, and the reason the TS convention "rng last" is enforced as a
detekt rule.

## A5. Executable specifications

### A5.1 Rule IDs in DESIGN.md

DESIGN.md is the contract; the specifications are its executable shadow. Each rule
paragraph in DESIGN.md gains a stable ID in brackets at its start — `[R-COMBAT-07]`,
`[R-RELIC-12]`, `[R-RUN-03]`, `[R-VAULT-02]`, `[R-INPUT-04]`, `[R-UI-09]` — in the
areas Stats, Elements, Combat (turn order, the turn, skills, statuses, damage,
enemies, between battles), Relics (rolling, mains, substats, sigils, sets), Characters,
Run (map, rooms, pacts, score, laps, ascension, Vault), Difficulty targets, Presentation
(input, UI constraints). IDs are never renumbered; a retired rule keeps its ID with a
one-line "retired" note. This edit is made in **this** repository first (it is a
documentation change, and the TS oracle stays valid) so that both codebases share one
numbering. Estimated count: 140–180 IDs.

### A5.2 Feature files

`specs/features/<area>/<rule-id>-<slug>.feature`, Gherkin, one file per rule ID, tagged
`@rule:R-COMBAT-07`. Scenarios are written in the contract's own vocabulary and use
tables for numbers:

```gherkin
@rule:R-COMBAT-19
Feature: A glancing hit cannot crit and deals GLANCE_MULT of its damage

  Background:
    Given the rng is scripted with 0.10, 0.99
    And a FIRE hero "EMBER" with ATK 280 and CRIT 15
    And a WATER enemy "BOG_TOAD" with DEF 150 and no statuses

  Scenario: Cinder into a WATER target glances on the first draw
    When EMBER casts CINDER on BOG_TOAD
    Then the hit is a glance and not a crit
    And the damage dealt is 168
    And exactly 1 rng draw was consumed
```

Step definitions live in `:specs` and call `:rules` directly through a small test DSL
(actor builders, the scripted rng, a battle harness). The DSL is the only place that
knows the rules' API; scenarios never mention Kotlin. A scenario that needs a whole run
uses the run-script steps (§A5.4).

### A5.3 The trace check

A Gradle task `specTrace` in `:specs` builds `build/reports/spec-trace.md`: one row per
rule ID with its DESIGN.md line, its scenarios, and their last result. The task fails
the build when a rule ID in DESIGN.md has no scenario, when a scenario tags an ID that
DESIGN.md does not contain, or when a feature file has an untagged scenario. This is
the check an agent runs to answer "is this rule specified?" without reading code.

### A5.4 Run scripts

The `playfull-decisions.json` format (seed, `RunConfig`, the decision list with hero
choices per battle turn, the end state) is promoted from a dev artefact to a
specification: `specs/scripts/*.json`. Each script is executed three ways and all
three must agree with its recorded end state:

1. headless, through the run machine (`:rules`);
2. through the screens' adapter without rendering (`:game`, the answer path);
3. through the hit regions in a Compose UI test, capturing one frame per screen
   (`:game` desktop; iOS simulator nightly).

Scripts are the acceptance tests for the run flow and, later, the regression net for
functional changes: a character change that alters a script's end state must update
the script deliberately, in the same commit, with the rule ID that justifies it.

### A5.5 Agent verification

A blind verifier of a rules task receives the rule ID, the feature file and the
trace report — not the implementation — and runs `./gradlew :specs:test specTrace`
on a clean checkout. It reports the runner's output, not an opinion. For screens, the
verifier receives the fixture name and the approved screenshot and runs the screenshot
test. The same shape as today's verification, with a runner where a screenshot reading
used to be.

## A6. Static analysis and quality gates

### A6.1 Tools

| Tool | Scope | Configuration that matters |
|---|---|---|
| Kotlin compiler | all | `allWarningsAsErrors = true`; `explicitApi()` on `:rules`, `:engine`, `:game`; progressive mode; `-Xexpect-actual-classes` only in `:engine` |
| ktlint | all | Official style; `.editorconfig` committed; runs as `ktlintCheck` in the gate and `ktlintFormat` locally |
| detekt | all | Complexity rules on: `CyclomaticComplexMethod` 12, `LongMethod` 40 lines, `LongParameterList` 6, `NestedBlockDepth` 3, `TooManyFunctions` 20, `LargeClass` 400, `ReturnCount` 3; `UnsafeCast`, `UnusedPrivateMember`, `UnnecessaryAbstractClass`. **Per-module configs**: in `:rules` `ForbiddenImport` for `kotlin.random.*`, `kotlin.time.*`, `kotlinx.coroutines.*`, `androidx.*`, `java.*`, `org.jetbrains.skia.*`; `ForbiddenMethodCall` for `kotlin.math.round`, `roundToInt`, `roundToLong`, `System.*`, `Clock.*`, `println`. **Custom rule set** (`:build-logic/detekt-rules`, unit-tested): `RngLastParameter` (a function with an `Rng` parameter has it last), `NoFloatInRules`, `NoMutableTopLevelState` in `:rules`, `SealedWhenExhaustive` (no `else` branch over a sealed hierarchy in `:rules`) |
| Compose rules for detekt | `:game`, `:engine` | Modifier ordering, unstable parameters, `remember` misuse |
| Konsist | `:rules`, `:engine`, `:game` (jvmTest) | Module and package dependency rules (§A2.2); naming (`*Machine`, `*Screen`, `*Policy`); every `data` table is `val` and immutable; every class in `:rules.types` is an `enum`, `sealed`, `data` or `value` class; test files exist per production file in `:rules` |
| Kover | all | Thresholds in §A4.2; XML report for CI, HTML for agents |
| Pitest + Kotlin plugin | `:rules` (JVM) | Threshold 80 %; nightly full, per-PR incremental on changed files |
| Binary compatibility validator | `:rules`, `:engine` | `apiDump` committed; `apiCheck` in the gate so a public-surface change is a visible diff |
| Dependency analysis plugin | all | Unused and undeclared dependencies fail the gate |
| Renovate | repo | Grouped weekly updates against the version catalog; the gate is the merge criterion |
| Android Lint | `:app:android` | `warningsAsErrors`; baseline file forbidden |
| Power-assert compiler plugin | tests | Failure messages show every sub-expression's value — cheaper for an agent to read than a stack trace |
| Spec lint | `:specs` | The trace check (§A5.3); every `.feature` parses; no scenario without a rule tag |
| Asset lint | `:tools` (test) | Every registry entry has its files; heights match the class table; every actor in `data` has every required pose; PNG sizes; plane dimensions per biome |
| gitleaks | CI | No secrets in history |

Not adopted, with the reason: SonarCloud (a service to run, no rule the above do not;
revisit if the owner wants a dashboard); Spotless (ktlint alone suffices); Cucumber
reports to a service (the local HTML report is what agents read).

### A6.2 The architecture as tests

Konsist turns the module table into assertions that run with the unit tests:

```kotlin
"rules depends on nothing platform-shaped" {
    Konsist.scopeFromModule("rules").imports
        .assertFalse { it.name.startsWith("androidx.") || it.name.startsWith("java.") || it.name.startsWith("org.jetbrains.skia") }
}
"data imports types only" { … }
"engine never imports rules" { … }
"every function taking Rng takes it last" { … }
```

The TS bundle-regex refusal becomes a test with a name.

### A6.3 The gate

`./gradlew gate` is one task that depends on: compile all targets, `ktlintCheck`,
`detekt`, `apiCheck`, `konsistTest`, `allTests` (rules on every target that the host
can run: JVM always, Android unit always, iOS simulator on macOS, Wasm in headless
Chromium), `:specs:test`, `specTrace`, `koverVerify`, `buildHealth` (dependency
analysis), `assetLint`, and — when `:rules` or `:sim` changed — `:sim:balanceCheck`.
Pitest, screenshot tests on iOS, and the device perf run are nightly. The gate writes
`build/reports/gate/index.md`, one line per check, which is what an agent pastes into
its report.

### A6.4 CI

GitHub Actions: `ubuntu-latest` for the gate minus iOS; `macos-latest` for the iOS
simulator tests and the Xcode archive; Gradle remote build cache; nightly workflow for
Pitest, screenshot matrices and the perf run; a release workflow that produces an
Android App Bundle and an iOS archive for TestFlight on a tag. The repository is public
today, which keeps macOS minutes free; if it goes private, iOS CI is a cost the owner
accepts explicitly (§A12, decision 10).

## A7. The presentation port

### A7.1 Frame, loop, scale

One `Canvas` composable fills the window; a single transform maps the 1280×720 logical
frame to the letterboxed device rect, computed from the window size — the CSS
`min(100vw, 100vh × 16/9)` rule as a scale. `withFrameNanos` drives a fixed-timestep
accumulator (60 Hz updates, render each vsync, the 250 ms delta clamp and the
focus-reset rule from `engine/loop.ts`). The rules never see `dt`, so a slow phone
changes nothing but animation pacing.

### A7.2 Hard pixels, fonts, sprites

Bitmap actors are `ImageBitmap`s drawn with `FilterQuality.None`, one `drawImage` per
actor, anchored at the registry's `feet`, flipped by a negative x-scale on the
transform. The HD 7×11 bitmap font (`FONT_HD`) is ported as one baked atlas per
(colour, scale) with the same LRU; the HUD's vector text goes through Compose
`TextMeasurer` with a **bundled** open-licence font (today the HUD uses the system
sans, which differs per platform; bundling is the parity-friendly choice and a
functional decision the owner can overrule, §A12). Text metrics differences between
platforms are absorbed by the screenshot thresholds, not by per-platform layout code.

### A7.3 The light rig on Skia

The TS light rig's per-frame passes map to Compose draw calls:

| TS pass | Compose |
|---|---|
| Diorama planes at parallax offsets, oversized by `PLANE_PAD` | `drawImage` of the exported plane PNGs (§A8.2) with translation by depth × shake |
| The light map `'lighter'` behind the actors | `drawImage(lightMap, blendMode = BlendMode.Plus)` |
| Contact shadow + cast lobe | Two ellipses from a cached gradient brush |
| Per-actor multiplicative gain (`'color-dodge'`, one flat sprite under a feathered alpha, linear in `globalAlpha`) | `drawImage(gainSprite, alpha = strength, blendMode = BlendMode.ColorDodge)` — the same collapse to `dest × (1 + a(G − 1))` holds |
| Rim spill (additive) | `BlendMode.Plus` |
| Bloom (frame-derived, ¼ or ⅛ res, self-multiply threshold, blur, actor-ellipse damp with `'destination-out'`) | Render the actor plane into a `GraphicsLayer` at the bloom division; threshold by drawing the layer over itself with `BlendMode.Multiply` twice; `BlurEffect` as the layer's `renderEffect`; punch the gain ellipses with `BlendMode.DstOut`; composite with `BlendMode.Plus`. Refresh on alternate frames as today |
| Grade + vignette (`'multiply'` map) | `drawImage(gradeMap, blendMode = BlendMode.Multiply)`, the map exported per biome |
| Sky body after the grade | `drawImage(skySprite, blendMode = BlendMode.Plus)` in the FAR plane's space |
| Tiers HIGH / MED / LOW, `note(frameMs)` one-way drop after 60 slow frames | Same controller, unit-tested; Android < API 31 (no `RenderEffect`) starts at MED with a cheaper bloom or at LOW |

The rig's constants (`GAIN_FLOOR`, `GAIN_SPREAD_CAP`, `RIM_*`, `SHADOW_CAST_*`, the pool
derivation from `HERO_FEET` / `ENEMY_FEET` with the 60-px overlap clamp) are transcribed
and the pool derivation is unit-tested against the numbers CLAUDE.md records for the
current anchors (enemy (336, 448) rx 163 ry 160; party (632, 448) rx 193 ry 160).

### A7.4 Input

Pointer events map to logical pixels through the same transform; primary pointer only;
a tap commits on release inside the region it began in; `pointercancel` and app pause
clear pressed state. The immediate-mode hit-region registry (`begin / add / end`,
`TAP_MIN 96` expansion clamped to the frame, drawn-rect-beats-expanded, spatial keyboard
focus with the ±50° cone, index cycling, twins skipped) is ported as a pure Kotlin
class in `:engine` with unit tests — it is geometry, and today it is verified only by
looking. Hardware keys (desktop, Android keyboards, iPad) keep A/B/PAUSE parity.
Android's system back is B. The safe inset comes from the platform's window insets
(`WindowInsets.safeDrawing`), replacing the phone-detect heuristic.

### A7.5 Persistence: the save file is the decision log

Two files, JSON, versioned, corrupt → reset with a visible message:

- `vault.json` — today's `VaultSave` (`version`, `vault`, `vaultSlots`,
  `unlockedAscension`).
- `run.json` — the run in progress: `seed`, `RunConfig`, the decision list (each
  `RunPending` kind with its answer; each battle turn's `HeroChoice`), written after
  every landed decision.

Resuming a run replays the decision list through the run machine with the same seed;
because the rules are deterministic the result is the same state, in milliseconds. This
is exactly what `__eq.decisions()` and the `playfull` replay do in dev today, promoted
to the save format. Mid-battle resume lands on the current pending with the battle
replayed to the same turn; the presentation restarts at that turn (no animation state
is saved). A settings file holds volume, the tier override and the ARCADE flag when it
returns. Cloud sync is out of scope until PvP needs accounts (§B4).

### A7.6 Verifying the look

The in-scene instruments are ported to `:tools` on the desktop target using headless
Compose rendering (`ImageComposeScene`): `capture` (title, room card, battle frames
including a hit, pause, inspect; the `playfull` frames), `seats` (each actor's own
pixels at its seat, masks planted at the layout anchors read at runtime, the L* rulers)
and `metrics` (the full-frame numbers the critic uses: dark share, bright share,
centroid, hue spread). The kit's sheet rulers (`rulers.mjs`) retire with the kit; the
bitmap sheet keeps `p50 L`, `% below 35`, `% above 75` and the hit box from the intake.

Parity for the look is **not** byte identity: the blur kernels and compositing
precision differ between Canvas 2D and Skia. The criterion is the seat ruler within
1.5 L of the TS capture on the same seed and the full-frame critic scoring the new
frames no lower than the TS frames on every axis (sprites, scene, UI, VFX, composition,
today 8 · 8 · 8 · 8 · 7). The `capture` PNGs of the TS build at the tagged commit are
committed as references.

### A7.7 Performance

Budget: 60 fps with headroom — ≤ 8 ms per frame at a hit peak on the HIGH tier on the
two reference phones (a mid-range Android from ~2022 and the oldest iPhone that runs iOS
16), measured by `:tools perf` on-device from a scripted battle, histogram committed
per release. Bloom is the known cost (2 ms of readback in the TS build); on Skia the
threshold and blur stay on the GPU with no readback. If the budget fails, the fallback
order is: bloom division 4 → 8, alternate-frame refresh → every third frame, MED tier
default on that device class. `note(frameMs)` remains the runtime guard.

### A7.8 App lifecycle

Pause on background (the rules are turn-based, so nothing is lost); the run file is
already current; audio pauses; on resume the frame clock resets (the loop's focus rule).
Orientation locked to landscape in the manifests. The Android back button and iOS
gestures are handled as B. Low-memory: assets are small (183 sprites of a few KB, 30
planes at 1360×800), no eviction logic is needed at launch.

## A8. Asset pipeline

### A8.1 Intake in Kotlin

`tools/intake.mjs bitmap` (green keying by hue ± 20° and saturation > 0.5, crop to the
opaque bbox, two-step area downscale to the class height, alpha snap at 0.45, feet and
hit box, value stats, `manifest.json` + registry generation) is ported to
`:tools intake` on the JVM with `BufferedImage`. Parity test: EMBER's master
(`tools/in/ember-gen-2.png`) produces a sprite whose pixels match the TS intake's
`game/art/bitmap/ember/idle-0.png` exactly or within one level per channel with the
same bbox and stats (area averaging can differ in the last bit; the test says which).
The registry is generated Kotlin (`BitmapActors.kt`) plus the JSON manifest; the
runtime (`POSE_FALLBACK`, `loadBitmapActors`, `bitmapFor`) is hand-written as today.

### A8.2 Export, don't port: planes, light maps, sound

A one-time TS tool in this repository (`tools/export.mjs`, the last tool written here)
runs the real `engine/light.ts` bake at HIGH and LOW for each biome and writes:
`far/mid/floor/near` PNGs at the pad scale with `PLANE_PAD`, the flat LOW plane, the
light map, the grade+vignette map, the sky sprite, the shaft and mote parameters and
the `BiomeLook` data (key, fill, pools' `actorWeight`, fog, ambient preset) as JSON. The
`:game` art registry loads these; `:engine`'s rig composes them. The floor's 1:1 crisp
bake and the other planes' 1.1111 pad scale are preserved because the export is the
bake itself. Byte-identity of the exported planes against the TS backdrop captures at
`actors=0` is a test in this repository before the export is committed to the new one.

### A8.3 Sound

`tools/export.mjs sfx` renders each of the 24 sounds through the TS synth with an
`OfflineAudioContext` in headless Chromium to 44.1 kHz WAV, then encodes OGG (Android,
desktop, web) and CAF/AAC (iOS). The per-name cooldowns and the limiter's role move to
the Kotlin player as a cooldown table and a master gain; a listening check by the owner
is the acceptance, since no instrument measures "the same sound".

### A8.4 Manifests and validation

Every asset class has a manifest committed beside it and an `assetLint` test:
actors (id, class, height, feet, hit, hitSize, poses → files, stats), planes (biome,
plane, size, pad scale, tier), sfx (name, file per platform, cooldown), fonts. A
missing pose for a registered actor is a build failure once the actor is in the launch
roster (§B2.3).

## A9. The agent workflow, ported

The working method in CLAUDE.md, STATUS.md and the ten skills carries over with the
commands changed. The new repository's CLAUDE.md is written in phase T1 and holds:

| Today | New |
|---|---|
| `npm run check` after every edit | `./gradlew :<module>:compileKotlinJvm detekt ktlintCheck` (fast, ≈ 10 s warm) after every edit; the desktop app hot-reloads |
| `npm run build && npm run smoke` before a commit | `./gradlew gate` |
| `npm run sim` when rules moved | `./gradlew :sim:run --args="--runs 2000"` and `:sim:balanceCheck` |
| `node tools/capture.mjs …`, `seats.mjs` | `./gradlew :tools:run --args="capture battle seed=1"`, `… seats …` |
| Dev server on :5173, snapshot servers on other ports for long captures | No servers: headless desktop rendering is a function call; captures cannot be reset by a hot reload |
| The commit gate in a detached worktree | `git worktree` + `./gradlew gate` in it (the same isolation; Gradle's build cache makes it cheap) |
| Blind verifiers apply the writer's diff on their own port | Blind verifiers run the gate and the named test on a clean worktree |
| `game-writer` (Sonnet) writes; Opus for art, critics, scene | Unchanged roles; the writer's task template is the TDD loop (§A4.2) |
| Skills: iterating, balancing, playing, releasing, designing-mechanics, quality, input, visuals, game-over, easter-egg | Rewritten one-to-one; `playing-the-game` becomes "run the desktop app and the boot tests"; `releasing-the-game` becomes the tag → store-track workflow; a new skill `specifying-a-rule` owns the rule-ID → feature → trace loop |

DESIGN.md continues to move with the code, now with IDs, and the trace check enforces
half of that sentence.

## A10. Delivery phases

Every phase ends green on `./gradlew gate` and updates CLAUDE.md, the skills and this
plan's status line in the same milestone. Sizes are rough and in agent-session days;
the gates are exact.

| # | Phase | Delivers | Exit gate | Size |
|---|---|---|---|---|
| T0 | **Spike** | A throwaway Compose app on Android + iOS drawing the exported crypt planes, EMBER's bitmap, a light map with `Plus`, a `ColorDodge` gain, a `Multiply` grade and a blurred bloom layer, at 1280×720 logical; a frame-time histogram on both reference phones | ≤ 8 ms per frame HIGH on both, hard pixels visible, blend modes correct by screenshot beside the TS frame; the stack decision confirmed or the fallback (§A1.3) chosen | 3–5 |
| T1 | **Walking skeleton** | The new repository with every module, every tool in §A6.1 configured and failing on a seeded violation, `gate`, CI on all runners, CLAUDE.md + skills v1, the rule IDs added to DESIGN.md here and copied over, the oracle export script and `oracle/` committed | `gate` green on a repo whose only code is `mulberry32` with its golden test; the detekt custom rules unit-tested; the trace check failing on one deliberately untagged rule and then passing | 4–6 |
| T2 | **Rules by TDD** | `:rules` in dependency order — types and data (`validateData` as a test), rng, relics, battle, the run machine, policies — each rule ID with its scenarios written first; the differential tests against `oracle/` | §A3.3 on all four targets; trace 100 %; Kover ≥ 95 %; Pitest ≥ 80 % | 8–12 |
| T3 | **Simulator** | `:sim` CLI with today's flags (`--runs`, `--battles`, `--policy`, `--seed`, `--spd`, `--vault`, `--json`, `--dump`, `--selfcheck`), `balanceCheck` | The Balance state ladder reproduced within ±1.0 points; the Kotlin sim becomes the oracle; `oracle/` is regenerated from it and the TS repository is no longer a dependency | 2–3 |
| T4 | **Assets** | `:tools intake`, `export.mjs` here (planes, maps, sfx), the manifests, `assetLint` | Intake parity on EMBER; planes byte-identical to TS captures; 24 clips; every registered actor's poses validated | 3–4 |
| T5 | **Engine** | Loop, scale, input + hit regions (unit-tested), fonts, bitmap draw, the light rig with tiers, particles + VFX system, juice, audio player, storage + decision-log resume | A lit battle frame on all targets within the seat ruler's 1.5 L; hit-region tests green; the tier controller tests green; a run saved and resumed mid-battle in a flow test | 6–9 |
| T6 | **Screens and the whole run** | Every screen (title, draft/SUMMON, leader, map, room card, battle with PAUSE/INSPECT, cards + who-wears-it, REST/SHRINE/FORGE/ALTAR, Vault EQUIP/DOORS/BANK, end screens with the tableau and the act-clear beat); the run adapter; screenshot fixtures; the run scripts through the UI | All five run scripts pass all three ways (§A5.4) on desktop and the iOS simulator; every screen has an approved screenshot; the full-frame critic scores ≥ the TS frames on every axis | 8–12 |
| T7 | **Devices and stores** | Signed Android App Bundle on the Play internal track, iOS archive on TestFlight, on-device perf histograms, store listings, privacy labels (no data collected), crash reporting decision | Boot and a full run on both reference phones by the owner; perf within budget; the brother can install both | 3–5 + owner time |
| T8 | **Cut-over** | The parity checklist (Appendix C) signed; `ts-final` tag here; README here points at the stores and the new repository; Pages serves the Wasm build if it passed the checklist, else a landing page | Owner sign-off | 1 |

T2 and T4 run in parallel; T5 starts once T0 and T4 land; T6 needs T2 and T5. AI asset
generation (§B2) starts at T0 on the owner's side and is the long pole for T7.

## A11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Compose cannot hold the frame budget with the bloom on a mid-range phone | Medium | T0 measures it first; tier fallbacks; the Skiko-direct fallback path |
| Cross-target floating-point divergence (FMA, `pow`) breaks bit parity | Medium | §A3.2; golden tests on every target in CI; the `pow` sites replaced by multiplication in both |
| Compose for Web is not ready when T8 arrives | High | Web is secondary; the TS build keeps serving the URL; no phase depends on Wasm |
| The light rig looks different enough on Skia to fail the critic | Medium | Planes and maps are exported (identical); only the per-frame compositing is re-expressed; the seat ruler and the critic loop are the acceptance, with the TS frames as references |
| Asset generation stalls (183 frames, critic rounds, owner-side) | High | Starts at T0; the launch roster rule (§B2.3) lets the app ship acts 1–2 first if acts 3–6 lag; the kit is not a fallback (it is not ported), so the rule is explicit |
| Gradle's loop is slower than Vite's | Certain | Configuration and build caches, small modules, `compileKotlinJvm` as the inner check, Compose Hot Reload on desktop; agents' inner loop is `:rules` JVM tests (seconds) |
| Model-written Kotlin drifts toward Java idioms and over-abstraction | Medium | `explicitApi`, detekt complexity limits, Konsist naming rules, the "no DI, no reflection" rule, blind review |
| Functional scope creeps into the port | Medium | Principle 1; the oracle fails loudly on any rules change; functional requests queue in §B5 |
| iOS builds need a Mac | Certain | CI macOS runners; the owner's Mac for local device runs; decision 10 |
| Store review (loot, "gambling"-adjacent mechanics) | Low | No real-money purchases; nothing random is bought; standard age rating |
| The web Vault cannot migrate to the apps | Certain | An export code on the web build (§B3.5) is optional; the owner decides whether the two players' Vaults matter |
| Mutation testing tooling for Kotlin (the plugin's licence, JVM-only) | Medium | Run on the JVM target only; if the plugin is unavailable, fall back to plain Pitest with a curated mutator set and a lower threshold, and say so in the gate report |

## A12. Decisions needed from the owner (technical)

1. Confirm Compose Multiplatform after the T0 spike (or take the fallback).
2. A new repository (recommended) versus a Gradle project inside this one.
3. Minimums: Android API 29, iOS 16 (recommended).
4. Web target policy: keep the TS build on Pages until the Wasm build passes the
   checklist (recommended); or drop the web target.
5. Landscape only (recommended, as today) versus a portrait layout later (a functional
   item, not a port item).
6. The CRT/ARCADE toggle: deferred (recommended) or in the parity checklist.
7. A bundled HUD font (recommended) versus the platform's sans.
8. The Capacitor bridge: no (recommended) or yes as a stopgap store release of the TS
   build.
9. Package name and app identity (`com.patakil.emberquest` as the placeholder).
10. iOS build infrastructure: CI macOS runners on a public repository (free) or a
    private repository (paid minutes), plus whether a Mac is available for local
    device runs.
11. Mutation testing: accept the Kotlin plugin's licence terms or the plain-Pitest
    fallback.
12. Crash reporting in the apps (none recommended at launch — no data leaves the
    device — revisited with PvP).

---

# Part B — Functional

## B0. Scope rule

During the port nothing changes for the player except what the platform demands
(§B3). Functional changes are collected here, designed through `designing-mechanics`
into DESIGN.md with rule IDs, specified in `:specs`, tuned in `:sim`, and built after
the phase that makes them safe: rules after T3 (the Kotlin sim is the oracle), anything
visible after T8 (the app is the game). The owner can overrule the order; the cost is
re-baselining the oracle.

## B1. Characters — placeholder for the owner's brief

What is known: six characters at launch, kits in DESIGN.md's Characters table, growing
toward twelve; each has three skills (skill 1 no cooldown, skills 2–3 at 2–5), one
awakening (a stat bonus or an upgraded skill), one leader skill; the draft is one of
the roster plus SUMMONs. The owner will share the changes once this plan is final.

What a character change touches, so the brief can be sized:

| Layer | Item |
|---|---|
| Contract | The roster table, the `SkillId` union, awakening and leader rows, any new `StatusKind` (which needs a source and a rule), the difficulty targets if the roster shape changes (every character must lead in ≥ 5 % of some policy's wins) |
| Specs | New rule IDs and scenarios; updated run scripts where the draft changes |
| Rules | `data/skills`, `data/characters`, `validateData`; a new mechanic means a `Policy` method and one line per archetype so the sim can play it |
| Balance | The ladder re-measured; the Balance state table rewritten and dated |
| Assets | Seven bitmap frames per new character (§B2), a portrait, a VFX family per new skill archetype, a sound if a new family |
| UI | The draft grid (12 = `DRAFT_X × DRAFT_Y` today; more than twelve changes the layout), INSPECT rows |

Placeholder decisions the brief should answer: how many characters; whether kits change
for existing ones; whether any element or role is added; whether the draft rule
(one plus SUMMONs) changes; whether unlocks return (today all are unlocked).

## B2. AI-generated images for characters and enemies

### B2.1 The decision as it stands

Option C (2026-09-09): every actor — heroes, enemies, bosses — is an image-model
sprite used as a bitmap at its on-screen size, generated on the owner's side from one
master frame per character with the prompts in `.claude/prompts/bitmap-pipeline.md` and
`tools/in/README.md`, keyed and shrunk by the intake, judged in frame by a blind critic,
regenerated on failure and never hand-edited. Stage 0 is built here (EMBER's idle 0 is
on the stage); stages 1–4 (EMBER's poses, the other heroes, acts 1–2 enemies and
bosses, acts 3–6) remain and are the same in the KMP world — the intake and the
critic's instruments move to `:tools` at T4.

### B2.2 The asset inventory

183 frames (§1.4): heroes and bosses 7 each (idle ×2, attack ×2, cast, hurt, dead),
elites 4 (idle, attack, hurt, dead), normals 3 (idle, attack, hurt; dead is hurt sunk and
faded). Class heights per the contract. Sources are tracked under `tools/in/<ID>/` (here,
until T4) and then under the new repository's `assets/src/actors/<ID>/`; shrunk sprites
under `assets/actors/<id>/`.

### B2.3 The launch-roster rule

The KMP app ships an actor only with its full pose set. The app's launch content is
whatever set of **whole acts** has every actor complete; a run ends at the last complete
act's doors until the next act is complete. This replaces the kit-as-fallback rule and
is enforced by `assetLint` against a `launchActs` value in the game's config. Acts 1–2
(19 actors, 91 frames) are the first target; acts 3–6 (24 actors, 92 frames) follow.

### B2.4 Decisions the owner should make for this item

1. **Portraits** for the turn ribbon and INSPECT: cropped from the masters by the intake
   (recommended) or generated separately.
2. **Backdrops**: keep the exported procedural planes (parity, zero generation work) or
   generate painted planes per biome with the image model (four layers per biome, the
   light map still computed). The plan supports both; parity ships with the export.
3. **VFX**: keep procedural (recommended; ported as data) or generate flipbooks.
4. **Rights and tooling**: which image model, and its terms for commercial
   distribution in app stores. The generated assets are shipped in the binaries.
5. **Style bible**: the master prompt is the bible today; a page in the new repository
   holds it with the accepted masters as references, so a regenerated frame two years
   from now matches.

### B2.5 Acceptance

The critic loop as recorded in ART-REVIEW.md, on the new frames: one character moves
(stage 1), six silhouettes are distinct on the sheet and in frame (stage 2), the enemy
ranks read at their class heights against the party (stage 3), the full-frame critic's
five axes at ≥ 8 (stage 4). The instruments are `:tools capture`, `seats`, `metrics`.

## B3. What a mobile app must do that the web game does not

These are functional because the player sees them; they are scheduled inside T5–T7
because the platform demands them.

1. **Resume a run.** A run survives the app being killed, a phone call, a reboot: on
   launch the title offers CONTINUE when `run.json` exists, and the run resumes at the
   open decision (mid-battle: at the current turn). Abandoning a run from PAUSE is a
   retreat as today. Rule IDs under a new *Persistence* area.
2. **Orientation and safe areas.** Landscape locked; the frame respects the notch and
   the home indicator through the platform insets; the 40-px phone bottom inset rule is
   replaced by the real inset.
3. **System navigation.** Android back = B everywhere, with a confirm on the battle
   screen (a retreat is a death); the iOS edge gesture is not intercepted.
4. **Settings.** Volume and mute, haptics on hits (optional, default on where the
   device supports it), the quality tier override, reduce-motion honoured (no shake, no
   flash when the OS asks).
5. **The web Vault.** Optional: an export code on the web build that the app can paste
   in once, so the two current players keep their Vaults. Not on the critical path.
6. **App identity.** Icon, splash (the title screen's own logo), store screenshots
   taken by `:tools capture` on device resolutions, an age rating, a privacy label of
   "no data collected".

## B4. PvP — placeholder for the owner's brief

The owner will define PvP after this plan is final. What the technical plan reserves
so that the brief lands on a ready floor:

- **Server-side rules.** `:rules` compiles to the JVM; a Ktor service can run the same
  battle the clients run. A server-authoritative model (the server simulates, the
  clients present) is possible without a second implementation.
- **Determinism and decision logs.** A battle is (config, seed, decisions). An
  asynchronous mode (your party against a stored party under the rules' own enemy AI,
  or a ghost of another player's decisions) needs no real-time networking; a live mode
  is a decision exchange with a server-issued seed.
- **Symmetry.** Several rules are written hero-only or enemy-only ("enemies wear no
  sets", FOCUS aims at the leader, INVINCIBLE is enemy-only, counters are heroes-only
  under REVENGE). The port keeps them exactly (parity) but isolates each behind a named
  predicate in `:rules.battle` so the PvP brief can decide per rule rather than per
  line.
- **Serialization.** Every state and every decision is `@Serializable` from T2.
- **Questions for the brief.** Synchronous or asynchronous; parties from the Vault or
  from a fresh draft; what the enemy side is when both sides are heroes (mirror the AI,
  or the other player's decisions); rewards and their relation to the Vault; accounts
  and identity (Game Center / Play Games sign-in versus an own account service); fairness
  under ascension and Vault relics; cheating (a server-authoritative simulation answers
  most of it); the balance targets for a two-party fight (the sim needs a PvP policy).

## B5. Order of functional work

1. B2 (assets) — starts now, owner-side, parallel to the port.
2. B3 (mobile behaviours) — inside T5–T7.
3. B1 (characters) — after T3 for rules and the sim; after T8 for the assets and UI.
4. B4 (PvP) — after B1, with its own design rounds and a backend.

---

## Appendix A — File-by-file mapping

| TS | Kotlin | Phase |
|---|---|---|
| `game/types.ts` | `:rules` `types/` (`Enums.kt`, `Constants.kt`, `Sealed.kt`, `State.kt`, `Policy.kt`) | T2 |
| `game/data/*.ts` | `:rules` `data/` one file each + `Validate.kt` | T2 |
| `game/sim/rng.ts` | `:rules` `rng/Rng.kt`, `Mulberry32.kt` | T1 (mulberry32), T2 |
| `game/sim/relics.ts` | `:rules` `relics/` (`Roll.kt`, `Forge.kt`, `Sets.kt`, `Derive.kt`, `Compare.kt`, `Text.kt`) | T2 |
| `game/sim/battle.ts` | `:rules` `battle/` (`Battle.kt`, `Actors.kt`, `Statuses.kt`, `Damage.kt`, `Skills.kt`, `Counters.kt`, `Ai.kt`, `Turn.kt`, `Simulate.kt`, `Fixtures.kt`) | T2 |
| `game/sim/run.ts`, `runstep.ts` | `:rules` `run/` (`Map.kt`, `Rooms.kt`, `Vault.kt`, `Policies.kt`, `RunMachine.kt`, `Simulate.kt`) | T2 |
| `sim/run.mjs` | `:sim` `Main.kt` | T3 |
| `tools/intake.mjs` (bitmap mode) | `:tools` `Intake.kt` | T4 |
| `engine/light.ts`, `game/art/backdrops.ts` | `tools/export.mjs` here → `assets/biomes/**`; `:engine` `light/` (`Rig.kt`, `Bloom.kt`, `Tiers.kt`, `Pools.kt`) | T4, T5 |
| `engine/audio.ts` | `tools/export.mjs sfx` → `assets/sfx/**`; `:engine` `audio/` expect/actual | T4, T5 |
| `engine/loop.ts`, `input.ts`, `draw.ts`, `ui.ts`, `juice.ts`, `particles.ts`, `palette.ts`, `scenes.ts` | `:engine` `loop/`, `input/`, `draw/`, `ui/`, `juice/`, `particles/`, `Palette.kt`, `Scenes.kt` | T5 |
| `game/art/vfx.ts` | `:engine` `particles/Vfx.kt` + `:game` `art/VfxRecipes.kt` | T5 |
| `game/art/bitmap/*` | `:game` `art/BitmapActors.kt` (generated), `art/Bitmaps.kt` | T4 |
| `game/screens/*.ts`, `game/main.ts` | `:game` `screens/*Screen.kt`, `RunAdapter.kt`, `Boot.kt` | T6 |
| `tools/capture.mjs`, `seats.mjs`, `probe.mjs`, `screens.ts` fixtures | `:tools` `Capture.kt`, `Seats.kt`, `Metrics.kt`; `:game` desktopTest fixtures | T5–T6 |
| `smoke.mjs` | Boot tests per app | T1 (skeleton), T6 |
| `.github/workflows/pages.yml` | `ci.yml`, `nightly.yml`, `release.yml` | T1 |
| `.claude/*` | `.claude/*` rewritten (§A9) | T1 |

## Appendix B — Command cheat sheet (new repository)

```
./gradlew gate                                   # everything in §A6.3
./gradlew :rules:jvmTest                          # the inner loop, seconds
./gradlew :rules:allTests                         # every target the host can run
./gradlew :specs:test specTrace                   # the executable specs and the trace report
./gradlew :sim:run --args="--runs 2000 --policy balanced,random --seed 1"
./gradlew :sim:run --args="--dump --runs 2000"    # regenerate oracle/ (T3 onward)
./gradlew :tools:run --args="intake assets/src/actors/GALE/attack-0.png id=GALE pose=attack frame=0 class=hero"
./gradlew :tools:run --args="capture battle seed=1"
./gradlew :tools:run --args="seats measure"
./gradlew :app:desktop:run                        # the game, hot-reloading
./gradlew :app:android:installDebug               # a device
```

## Appendix C — The parity checklist (signed at T8)

- [ ] Every oracle file matches on JVM, Android, iOS simulator, Wasm (§A3.3).
- [ ] The Balance state ladder reproduced within ±1.0 points.
- [ ] All five run scripts pass three ways on desktop and iOS simulator (§A5.4).
- [ ] Every screen has an approved screenshot on desktop; battle, cards, map, Vault on
      Android and iOS.
- [ ] Seat ruler within 1.5 L of the TS capture on seeds 1, 4, 12, 16, 20 and the marsh.
- [ ] Full-frame critic ≥ 8 · 8 · 8 · 8 · 7 (no axis below the TS frames).
- [ ] 24 sounds present and heard by the owner.
- [ ] Vault persists across app restarts; a run resumes mid-battle after a force-kill.
- [ ] Frame budget met on both reference phones (§A7.7).
- [ ] Keyboard parity on desktop; back = B on Android; insets honoured on a notched
      phone.
- [ ] The launch roster rule holds for the shipped acts (§B2.3).
- [ ] CLAUDE.md, the skills and DESIGN.md's IDs current; `gate` green on `main`.

## Appendix D — Glossary

**Oracle** — the TS simulator's recorded outputs the Kotlin rules must reproduce.
**Golden test** — a test against a recorded oracle file. **Scripted rng** — an `Rng`
that returns a fixed sequence and counts draws. **Rule ID** — the `[R-AREA-nn]` anchor
on a DESIGN.md rule. **Trace** — the rule-ID ↔ scenario matrix. **Run script** — a
recorded decision log with its end state. **Gate** — `./gradlew gate`. **Parity** —
the checklist in Appendix C. **Tier** — HIGH / MED / LOW quality levels of the light
rig. **Seat ruler** — the in-scene value instrument (`seats`).

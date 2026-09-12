# Ember Quest — the Kotlin Multiplatform plan

Status: **revision 2, under review** (2026-09-11). Written against `2e50f92`, the head
of `claude/fable-credits-reset-wbtv7t` before this plan was added. That branch is
**12 commits ahead of `origin/main`** (`71dc875`, the PR #1 merge), and `origin/main` is
what GitHub Pages serves at https://patakil.github.io/ember-quest/ — so the live site is
v3 *without* the art instruments and the bitmap-actor stage 0 that the branch carries.
The review log is `KMP-PLAN-REVIEW.md`. DESIGN.md stays the game's systems contract;
this document does not replace it.

The plan has two halves, deliberately kept apart:

- **Part A — Technical**: how the game moves from TypeScript + Canvas 2D to Kotlin
  Multiplatform (KMP) for native Android and iOS apps, and how the new codebase is
  built test-first, specified executably, and held to a quality bar by static analysis.
  Part A decides *how things are built*.
- **Part B — Functional**: what changes for the player. Two items are decided in
  outline (AI-generated images for every actor; the behaviours a mobile app must have),
  two are placeholders the owner will fill after this plan is final (the character
  changes; PvP), and one list holds every player-visible decision the port raises.
  Part B decides *what the player sees*, whichever phase builds it.

The rule that ties the halves together: **parity before change**. The port reproduces
the game that exists today — rules bit for bit, the run flow decision for decision, the
scene to the same instruments — and only then do functional changes land on the new
codebase. §2 states the rule with its cost, and §B0 gives the owner the three ways to
schedule the character brief around it.

---

## 0. Summary

**Decision.** Kotlin Multiplatform with **Compose Multiplatform** for rendering and
input, Kotlin in `commonMain` for every rule, targets Android and iOS first, desktop
(JVM) as the development and tooling target, web (Kotlin/Wasm) secondary. One language
for client, tools, tests, the simulator and the future PvP server. Alternatives are in
§A1.3; the choice is confirmed or overturned by the T0 spike (§A10), not by this text.

**Shape.** A new repository with Gradle modules that mirror the boundary the TS code
already enforces: `:rules` (pure, deterministic), `:engine` (rendering, input, audio,
storage), `:game` (screens), `:sim` (the balance harness), `:specs` (executable
specifications), `:tools` (asset intake and the art loop's instruments), thin app
modules, and `:server` reserved for PvP. About 14 000 lines of procedural sprite code
are **not ported** — actors become AI-generated bitmaps (decided 2026-09-09) — and the
six biomes' painted planes and the 24 sounds are exported once from the TS build as
assets.

**Correctness.** The TS simulator is the **oracle**. Before it is frozen, this
repository gets a short pre-flight (§1.5): a canonical record encoder for the hashes,
the one Vault rule that lives in a screen moved into the rules, the decision recorder
made complete, the run scripts recorded, a person playing it. Then the Kotlin rules must
reproduce every oracle hash exactly on the JVM, with the iOS and Wasm legs promoted to
gating as their phases land. Every executable rule in DESIGN.md gets a stable ID, every
ID an executable scenario, and a trace check fails the build when either side is
missing; presentation constraints and difficulty targets get their own ID namespaces
with their own kinds of proof.

**Quality.** Test-first is the working method, made verifiable: two commits per task
(the test, then the implementation), a CI job that proves the test commit fails on its
own, and mutation and coverage thresholds scored **without** the golden replays so the
oracle cannot pay for the tests' honesty. One `./gradlew gate` runs the compiler in
warnings-as-errors and explicit-API mode, ktlint, detekt with this game's own rules,
Konsist architecture tests, Kover, the specs, the golden replays and the balance
regression, and reports every check as PASS, FAIL or SKIPPED with the reason.

**Order.** T0 spike (agent half, then owner half on devices) → T1 walking skeleton with
every gate and the pre-flight in this repository → T2 rules by TDD against the oracle →
T3 simulator → T4 assets → T5 engine → T6 screens and the whole run → T7 devices and
stores (started at T0 for its lead times) → T8 cut-over → T9 characters → T10 PvP. AI
asset generation runs in parallel from T0 on the owner's side.

**What it costs.** The phase sizes in §A10 sum to **41–63 agent-session days** of
code, with only T2 ∥ T4 in parallel. The long poles are owner-side: 182 sprite frames
through a critic loop (§B2.2), device verification, and store enrolment. Money, in
round figures: Apple Developer Program 99 USD per year; Google Play 25 USD once; image
generation for ~180 accepted frames at several attempts each (tens of dollars on
current per-image pricing, more on a subscription); CI minutes free while the new
repository is public; a Mac for local iOS device runs if one is not already in the
house. The sprint that built v3 (47 k lines between 2026-09-04 and 09-09) is **not**
evidence for this port's pace: it ran with no tests, no specs, no static analysis and a
millisecond build loop, which is everything this plan adds. Nothing here is a
calendar; the gates are exact and the sizes are estimates that T1 re-derives (§A2.5).

**The premise, once.** Wrapping the web build with Capacitor would put it in both
stores in days and change nothing about the codebase. It is offered as a bridge for the
brother, not as the plan (§B6, decision B6.4).

### 0.1 The owner's part

Everything below is owner-only. The plan cannot move past the named phase without it.

| Owner task | Why | Needed by | Rough effort |
|---|---|---|---|
| Answer the "first" decisions (§0.2) | They shape T0 and T1 | before T0 | 1 hour |
| Name the two reference phones and whether a Mac is available | T0b's gate and every device number | before T0 | minutes |
| Check the image model's commercial-use terms and record them (§B2.4 #1) | 182 frames ship inside a binary; a wrong answer voids them | before generating | 1 hour |
| Play the TS build through six acts; answer the three open balance decisions (§1.5) | The oracle freezes what it measures; today nobody has played it | before the oracle tag (T1) | 2–4 hours play, 30 min decisions |
| Decide the character-brief timing (§B0) | It decides whether the brief lands here or in Kotlin | before T1 | 30 min |
| Enrol Apple Developer and Google Play; create the app records; run Play's closed test (§A10 T7) | Lead times of days to weeks | start at T0 | 2–3 hours plus waiting |
| Generate and accept 182 sprite frames through the critic loop (§B2) | The app ships only what has art | acts 1–2 by T6, the rest by T8 | the long pole: ~180 frames × several attempts × a critic round per batch; budget 15–30 hours across the port |
| Run T0b on the phones; install TestFlight and the Play internal build at T7 | No agent can touch a device | T0, T7 | 1–2 hours each |
| Listen to the 24 exported sounds | No instrument measures "the same sound" | T4 | 20 min |
| Sign the parity checklist (Appendix C) | Cut-over is the owner's call | T8 | 1 hour |

### 0.2 Answer these first

Four answers unblock T0 and T1; the rest of §A12 and §B6 can wait for their phases.

1. **Devices and Mac** (§A12 #10): which Android phone, which iPhone, is there a Mac?
2. **Image model and rights** (§B2.4 #1): which model, and its commercial terms.
3. **Character-brief timing** (§B0): in the TS build before the freeze, in Kotlin after
   T3, or after T8.
4. **Repository visibility** (§A12 #2): public (free CI minutes, generated assets
   visible) or private (paid macOS minutes).

---

## 1. Where the game stands (the scan)

### 1.1 What exists

| Area | Files | Lines | Nature | Fate in the port |
|---|---|---|---|---|
| Contract | `DESIGN.md` (1 743 lines), `DESIGN-REVIEW.md`, `ART-REVIEW.md`, `STATUS.md`, `CLAUDE.md` | — | Prose + tables, blind-reviewed | Carried over; DESIGN.md gains rule IDs after a repair pass (§A5.1) |
| Types + constants | `game/types.ts` | 637 | Closed unions (`SkillId` has 122 members), every rules constant | Ported 1:1 to enums, sealed interfaces, constants |
| Content | `game/data/*.ts` | 941 | Tables: 24 hero skills, 43 actors, 6 biomes, 16 sets, 12 sigils, 6 pacts, A0–A10, loot tables; `validateData()` | Ported 1:1; `validateData` becomes a test |
| Rules | `game/sim/rng.ts`, `relics.ts`, `battle.ts`, `run.ts`, `runstep.ts` | 3 354 | Pure, headless, rng injected, draw order is a contract; `runSteps` is a generator with ≈ 30 yield sites | Ported 1:1 by TDD against the oracle (§A3) |
| Screens | `game/screens/*.ts`, `game/main.ts` | 8 416 | Canvas presentation of the run seam; hit regions; HUD; one rule (`minAscensionFor`) that belongs in the rules (§1.5) | Ported as Compose canvas screens (§A7) |
| Engine | `engine/*.ts` | 5 674 | Loop, input, hit regions, fonts, baked sprites, palette, particles, juice, audio synth, HD-2D light rig (1 863), CRT, host runtime | Ported selectively; the rig's bakes become assets plus a runtime light map; audio exported; CRT deferred (§B6); host runtime dropped |
| Art | `game/art/parts*.ts`, `actors*.ts`, `backdrops.ts`, `vfx.ts`, `pixel/*`, `bitmap/*` | 22 307 | Procedural sprite kit (≈ 14 100), procedural biome painters (4 357), particle VFX (3 708), the bitmap-actor runtime (stage 0 of option C) | Kit and painters **not ported**; bitmaps and a data-driven VFX system are |
| Tools | `tools/*.mjs`, `tools/*.ts`, `tools/*.html`, `sim/run.mjs`, `smoke.mjs` | 6 299 | Capture, intake, the in-scene and sheet rulers, four fixture harness pages, the Monte Carlo runner, the boot gate | Re-created as `:tools` and `:sim` (JVM) plus desktop fixture pages; Playwright smoke replaced by per-target boot tests |
| Workflow | `.claude/skills/*` (10), `.claude/agents/game-writer.md`, `.claude/prompts/*` (4) | — | Orchestrator + writer + blind verifier/critic loops, gates before every commit | Rewritten per skill (§A9); four skills already name files that no longer exist |

Total: 47 654 lines. `.github/workflows/pages.yml` deploys `main` on every push; PR #1
merged v3 into `main` on 2026-09-09, and STATUS.md's line "`main` still serves playable
v2; never push main" predates that merge.

### 1.2 What the code already does right for a port

- **The headless boundary is real.** `game/data` and `game/sim` import no engine, DOM,
  storage or ambient randomness; `sim/run.mjs` refuses to run if the bundle mentions
  `window`, `document`, `localStorage` or `engine/`.
- **Determinism is a contract.** `pick(n, rng) = floor(rng() × n)` is the only integer
  draw; every rolling function takes `rng` last; the order of draws is written down per
  step. `mulberry32(seed)` seeds the harness **and** the live game (`game/main.ts:239,
  267` — `rng.ts`'s closing comment saying `main.ts` passes `Math.random` is stale).
- **The run is a seam.** `runstep.ts`'s `createRun` exposes `state() / pending() /
  token() / decide()`; screens decide nothing. `sim/run.mjs --selfcheck` proves
  `simulateRun`, `runSteps + answerWith` and `createRun` agree deep-equal per run.
- **The oracle nearly exists.** `sim/run.mjs --dump` prints a SHA-256 over the full
  `RunResult[]` per policy; `--json` gives the aggregates; DESIGN.md's Balance state is a
  recorded, dated measurement. §1.5 lists what the dumper still needs.
- **The art decision is made.** Option C (2026-09-09): every actor is an image-model
  bitmap at its on-screen size; the intake, registry and `drawActor` branch exist
  (stage 0, EMBER's idle 0 only).

### 1.3 What the code does not have

- **No unit tests.** Quality today is `tsc --strict`, a Playwright boot smoke, the
  simulator's self-checks and refusals, `validateData()`, and blind agent verification of
  claims against captured frames and numbers. There is no test framework in
  `package.json`.
- **No executable specification.** DESIGN.md is precise but prose; worked examples are
  checked by people and agents, not by a runner.
- **No static analysis beyond the compiler.**
- **No mid-run persistence.** A reload loses the run; only the Vault survives (one
  `localStorage` key, version-tagged, corrupt → reset). The decision log that would allow
  a replay is DEV-only and records the Vault as a count, not the relics
  (`game/screens/run.ts:274`, `game/main.ts:940`).
- **No device measurement.** A battle frame measures **7.3 ms resting and ~11.5 ms
  median at a hit peak** on headless software Chromium at HIGH; the phone layout is
  verified on an 844×390 Playwright viewport at dpr 3. Nobody has played it, on any
  device.
- **Platform text.** The HUD uses the platform's sans font (`layout.ts:412`), so text
  metrics already differ per platform.

### 1.4 Numbers the port is measured against

| Quantity | Value | Source |
|---|---|---|
| Actors | 43 (6 heroes, 6 bosses, 6 elites, 25 normals) | `game/data` |
| Bitmap frames | 6×7 + 6×7 + 6×4 + 25×3 = 183, of which 1 exists (EMBER idle 0) → **182 to generate** | `.claude/prompts/bitmap-pipeline.md` |
| Class heights (px) | hero 112 · small 72 · medium 96 · large 112 · elite 128 · boss 192 | DESIGN.md → Layered actors |
| Biome images to export | per biome: far, mid, floor, near (HIGH), the merged mid+floor (MED), the flat backdrop (LOW) = 6; × 6 biomes = **36**, each 1360×800 (≈ 4.35 MB decoded) | `engine/light.ts` (`PLANE_PAD` 40, three tiers) |
| Light and grade maps | computed at runtime from exported `BiomeLook` data, per (biome, tier) — not exported (§A7.3) | — |
| VFX archetypes / skill families | 13 / 13 | `game/art/vfx.ts` |
| Sound effects | 24 | `engine/audio.ts` |
| Policies / `Policy` methods | 9 / 13 | `game/sim/run.ts`, `game/types.ts` |
| Battle fixtures in the TS harness | act 1 only: 5 fight packs, 2 elite packs, 1 boss | `game/sim/battle.ts:1227` |
| Balance ladder (`balanced`, seed 1, 5 000 runs) | act 1 91.1 % · 2 56.2 · 3 40.2 · 4 30.1 · 5 22.3 · 6 14.8 | DESIGN.md → Balance state |
| One simulated run, headless | ≈ 4.5 ms (2 000 `balanced` runs in 9.0 s wall, measured 2026-09-11) | `node sim/run.mjs --runs 2000` |
| Logical frame | 1280×720, landscape, `TAP_MIN 96` | DESIGN.md → Presentation |

### 1.5 Pre-flight: what this repository does before it becomes the oracle

These land **here**, on the branch, before the tag `ts-oracle` is cut. Each is small;
together they are what makes "bit for bit" cover the whole game. They are T1
deliverables (§A10).

| # | Task | Why |
|---|---|---|
| 1 | **Decide the release.** Either fast-forward `main` to the branch (a release through `releasing-the-game`, the owner's call) or leave `main` at `71dc875`; either way the oracle is cut from the branch head and tagged `ts-oracle`. STATUS.md's "never push main" line is corrected. | The plan's baseline, the Pages URL and the references must name one commit |
| 2 | **Move rules out of screens.** `minAscensionFor` (`game/screens/vault.ts:143`, DESIGN.md → The Vault) moves into `game/sim/run.ts` and the harness's `--vault` path reads it; an audit of `game/screens/*` for any other rule (candidates: `party.ts`'s `deriveCtxFor`, `cards.ts`'s option building) is recorded in the tag's notes. | The oracle covers only what the rules module computes |
| 3 | **A canonical record encoder in the dumper.** `--dump` hashes `JSON.stringify(RunResult[])`, whose double formatting and key order are V8's; the Kotlin side cannot reproduce that. The dumper gains a canonical form — fixed field order, integers as integers, doubles as their IEEE-754 bit pattern in hex — and hashes that. The same encoder is specified for Kotlin (§A3.1). | Cross-language hashes must hash the same bytes |
| 4 | **Complete the recorder.** The decision log records the full `RunConfig` (Vault relics, not a count), every battle's `HeroChoice` list, and stays DEV-only here. | Run scripts and the save format need it |
| 5 | **Rewrite the three `Math.pow` sites** (`game/sim/battle.ts:284, 287, 289`) as repeated multiplication. **Checked 2026-09-11**: `Math.pow(b, n)` equals repeated multiplication for b ∈ {2.7, 2.5, 2.1} and every n ≤ 9, and the `--dump` hashes for `lapper` and `balanced` (seed 1, 2 000 runs) are unchanged by the rewrite — a proven no-op for laps ≤ 10. | Removes the one transcendental from the parity surface |
| 6 | **Extend the battle fixtures** beyond act 1: one boss per act at its act, the act-2 elite pair, a lap-2 crypt pack, an A5 boss with its fourth skill, one pack under FURY + HASTE. | Today's `--battles` cells are act 1, A0, no pacts |
| 7 | **Record the run scripts** with `capture.mjs playfull` (§A5.4's list, ≈ 10–12), including one that force-quits mid-battle and one that feeds an out-of-range index at every decision kind. | The recorder retires with this repository |
| 8 | **Copy the references** — battle, sheet and backdrop captures at the tag, on seeds 1, 4, 12, 16, 20 and the marsh, at time 0 and shake 0 — into a tracked `reference/ts-oracle/` (today `tools/out/` and `tools/ref/` are gitignored). | The look-parity instruments need a fixed reference |
| 9 | **The contract-repair pass**, then rule IDs (§A5.1): the per-actor gain and `LightActor.kind` (documented only in CLAUDE.md) written into DESIGN.md's HD-2D section; the sprite-vs-ground value law stated; the ship criteria copied from ART-REVIEW.md; a frame budget written; phase 7c (boss intros, distortion) marked *not built*; `compare()`'s set-blindness decided or marked open. Blind-checked like every contract edit here. | An ID on a rule the document does not state is an ID on nothing |
| 10 | **A person plays it** (acts 1–6, on a phone too) and the owner answers the three open balance-rule questions (`compare()` and 4-piece sets; TIDE's rarity; act-1 elite length). Whatever changes lands here before the tag. | The oracle freezes what it measures |
| 11 | **The freeze table** below is written into STATUS.md. | Every open item has a fate |

**Freeze table — STATUS.md's "Next, in order" after the tag**

| STATUS item | Fate |
|---|---|
| 1 Sprite pipeline stages 1–4 | Continues, owner-side, through `tools/intake.mjs` here until `:tools intake` lands (T4), then there |
| 2 The engine value law (`legal()`'s 3.2:1 floor) | Abandoned with the kit; bitmaps carry their own values |
| 3 Drive an act 3–6 battle | Redone in Kotlin as run scripts (§A5.4) with a scripted strong party |
| 4 Full-frame critic round 5 | Runs again on the Kotlin frames at T6; the scene residuals it names are frozen into the exported planes until §B2.4 #3 regenerates them |
| 5 VFX follow-ups | Redone in Kotlin's VFX data (§A2.4) |
| 6 UI residuals | Redone in the Kotlin screens (T6) |
| 7 Balance rules (three decisions) | Decided **before** the tag (pre-flight 10) |
| 8 A person plays it | Before the tag (pre-flight 10) and again at T7 |

**"Verification findings not fixed" (STATUS.md) — the port's keep/fix/decide column**

| Finding | Port |
|---|---|
| Enemy value ceiling at four seats (DUST_WRAITH, CINDER_IMP) | Moot: those actors are regenerated as bitmaps and judged fresh (§B2.5) |
| ASHEN_FORGE mid-band range 17.1 vs 20; marsh moon flat under the dim; FAR arches blurred at HIGH | Frozen into the exported planes; listed in §B2.4 #3 as what regeneration would fix |
| Floor plane at 1:1 vs the 1.1111 pad scale (≈ 49 px disagreement at the edges) | Kept as is by the export; documented as a known property of the assets |
| Ten of thirteen VFX families one fan in ten hues; boss finisher pacing (1.01 s / 0.96 s) | Redone in Kotlin's VFX data; pacing is a screen constant |
| Battle captures not byte-deterministic | Fixed by design in Kotlin: a deterministic render mode (§A4.1) |
| Stage 0 residuals: the light-gain box sized from the kit's `ACTOR_W`; `DEAD_ALPHA`/`DEAD_SINK` never seen | Fixed in the port: the gain box comes from the registry's `hitSize`; a KO frame is in T5's gate |
| Balance-rule diagnoses (`compare()` set-blind, TIDE rarity, act-1 elite length) | Decided before the tag (pre-flight 10) |

---

## 2. Principles

1. **Parity before change — and its price.** The port reproduces today's game: rules
   bit-identical on the oracle, the run flow decision-identical on the scripts, the scene
   within the seat ruler and no worse under the critic. What the owner gains: one fixed
   target, every difference attributable to the port. What the owner waits for: the
   character brief and every other visible change queue behind T3 (rules) or T8 (visible),
   unless it lands in the TS build before the tag (§B0). A rule change during the port
   costs one oracle re-baseline (the mechanism exists from T3).
2. **The pipeline before the code.** T1 delivers every gate on an almost empty repository.
   No rule is ported until the build fails for the right reasons.
3. **One language.** Rules, screens, tools, tests, the simulator and the PvP server are
   Kotlin. The only non-Kotlin code is the Xcode host, the web host page and the CI YAML.
4. **Rules stay pure.** `:rules` depends on the Kotlin standard library and
   `kotlinx.serialization` only. Randomness is injected, last. No time, no platform, no
   `Float`, no hash-ordered collections. Enforced by detekt and Konsist, not by discipline.
5. **Specifications are the contract's executable shadow.** DESIGN.md states a rule once,
   with an ID; a scenario proves it; the trace check keeps the two sides in step.
6. **Test first, and prove it.** Two commits per task; CI proves the first one fails; the
   thresholds are scored without the golden suite.
7. **Simple beats clever.** Data classes and sealed hierarchies over frameworks; no
   dependency injection container; no reflection; no speculative generality for features
   not yet briefed; complexity limits in detekt; procedural art replaced by assets.
   §C shows what a change costs afterwards, which is the test of this principle.
8. **Agents verify, the owner plays.** Every writer gets a blind verifier; every visual
   change gets a critic; nobody claims to have playtested.

---

# Part A — Technical

## A1. Platform and stack

### A1.1 Targets

| Target | Role | Minimum | Notes |
|---|---|---|---|
| Android | Primary | API 29 (Android 10); §A12 #3 offers API 31 | Common `BlendMode.ColorDodge / Plus / Multiply / DstOut / Src` need API 29. `RenderEffect` blur needs API 31: devices on 29–30 run the **LOW** tier (no blur, no bloom — a tier that exists today), verified on an API 29 emulator in T0a |
| iOS | Primary | iOS 16 | Compose Multiplatform for iOS is stable; Skia over Metal |
| Desktop (JVM) | Development, tools, headless capture, the simulator | Java 21 | `./gradlew :app:desktop:run` with Compose Hot Reload is the new dev server |
| Web (Kotlin/Wasm) | Secondary | Wasm-GC browsers | Beta-grade at the time of writing; the TS build keeps serving the Pages URL until the Wasm build passes Appendix C (§A12 #4) |

Landscape only, 1280×720 logical, letterboxed by the platform window: the contract's
canvas rule with the CSS fitting replaced by one scale transform (§A7.1).

**The determinism legs.** Android's Kotlin compiles to JVM bytecode run by ART, so it
adds no numeric coverage beyond the JVM leg. The legs that matter are **JVM**,
**iosSimulatorArm64** (Kotlin/Native on arm64) and **wasmJs**. Android gets boot and
flow tests on an x86_64 emulator, not a golden leg.

### A1.2 Stack

| Concern | Choice | Why |
|---|---|---|
| Language / build | Kotlin (K2), Gradle with a version catalog, configuration cache and build cache on | The multiplatform toolchain JetBrains and Google both back |
| UI / rendering | Compose Multiplatform; one `Canvas` composable; `DrawScope` with `drawImage`, `BlendMode`, `FilterQuality.None`; `GraphicsLayer` for offscreen passes | Common API on all targets; hard pixels, additive and multiplicative compositing and blur are expressible; the bloom chain's exact carrier is decided by T0a (§A7.3) |
| Serialization | `kotlinx.serialization` (JSON) | Saves, decision logs, fixtures, PvP later |
| Persistence | JSON files via `kotlinx-io`, versioned with forward migrations | No database for 12 relics and one run |
| Audio | expect/actual clip player over pre-rendered sounds (Android `SoundPool`, iOS `AVAudioPlayer`, desktop `javax.sound`, web `AudioContext` with the unlock-on-first-gesture rule the web needs) | The synth's `pitch` parameter is unused by any call site today and is dropped |
| Tests | `kotlin.test` in `commonTest` on every target; Kotest assertions and property testing on the **JVM** source sets (Kotest's Wasm support is not assumed); Cucumber-JVM for feature files; Compose UI test for flows; screenshot tooling per target (§A4.1) | §A4, §A5 |
| CLI tools | Clikt | `:sim` and `:tools` |

Versions are pinned in `gradle/libs.versions.toml` at the spike; every tool in §A6.1 is
proved on the empty skeleton in T1 before any rule is ported.

### A1.3 Alternatives considered

| Option | Verdict | Reason |
|---|---|---|
| **Compose Multiplatform** | **Chosen** | Backed by JetBrains, stable on Android and iOS, common canvas API with the blend modes the rig uses, first-class KMP, hot reload on desktop, headless desktop rendering for the instruments |
| KorGE | Rejected | Capable, but a single-maintainer project with a slowed cadence; the plan's first word is *sustainable* |
| libGDX / KTX | Rejected | JVM-centric; iOS via RoboVM is a separate, ageing toolchain; not `commonMain` |
| Capacitor wrap of the TS build | Bridge only | §B6.4 |
| Godot / Unity | Out of scope | Not Kotlin |

If T0 shows Compose cannot carry the bloom chain at the frame budget, the fallback is
Compose for screens and a Skiko-direct battle surface on the Skia targets with an
Android `SurfaceView` path — a larger platform-specific surface, which is why the spike
comes first, and why it tests the whole chain, not a blit.

## A2. Repository and module architecture

### A2.1 Repository

A **new repository** (`ember-quest-kmp`): Gradle, Renovate, CI and the agents'
conventions should not share a root with Vite and npm. This repository is the oracle
from the tag `ts-oracle` (pre-flight, §1.5) until T3, then history: tagged `ts-final`,
README pointing at the stores and the new repository, archived at T8. The oracle
fixtures and the reference captures are committed to the new repository with the tag's
commit hash in their headers, so the new repository never needs Node.

Between T1 and T8 there are two DESIGN.md copies. The one in the **new** repository is
authoritative from the day T1 copies it; this repository's copy is frozen with the tag.

### A2.2 Modules and the dependency rule

```
:rules        commonMain — types, data, rng, relics, battle, run                 depends on: kotlinx.serialization only
:engine       commonMain — frame loop, canvas scaling, input + hit regions,      depends on: Compose, kotlinx-io
              bitmap font atlas, baked sprites, light rig, particles, juice,
              audio player, storage.  Takes the stage anchors as PARAMETERS.
:game         commonMain — screens, layout constants (the anchors), the run     depends on: :rules, :engine
              adapter, art registry, VFX recipes, bitmap runtime, boot
:sim          jvmMain    — Monte Carlo harness, golden dumper                    depends on: :rules
:specs        jvmTest    — feature files + step definitions, the trace check     depends on: :rules, :game (run scripts)
:tools        jvmMain    — intake, capture, seats, metrics, fixture pages        depends on: :game, :engine
:server       reserved for PvP (Ktor); no code until T10                         depends on: :rules
:app:android / :app:ios (+ iosApp/ Xcode) / :app:desktop / :app:web              depend on: :game
```

The arrows point one way and Konsist tests assert them (§A6.2): `:rules` imports
nothing platform-shaped; `:engine` never imports `:rules` or `:game` — today
`game/art/backdrops.ts` imports `HERO_FEET`/`ENEMY_FEET` from the screens' layout, so in
the port the rig receives the anchors from `:game` as a parameter and derives the pools
from them. Inside `:rules`, packages mirror today's files — `types`, `data`, `rng`,
`relics`, `battle`, `run` — with the import rule DESIGN.md actually states: a data table
imports `types` (and `skills`, for `characters` and `enemies`); the data index, which
owns `validateData`, imports every sibling table.

### A2.3 How the TS shapes map to Kotlin

| TS | Kotlin | Note |
|---|---|---|
| String-literal unions (`Element`, `Stat`, `StatusKind`, `SkillId`, `SetId`, `RoomType`, …) | `enum class` | `SkillId`: 122 entries; `EnemyId` a value class over `String` |
| Discriminated unions (`SetBonus`, `SigilEffect`, `Modifier`, `BattleEvent`, `RunPending`) | `sealed interface` + data classes; exhaustive `when` | The compiler replaces `assertNever` |
| `Record<K, V>` tables | `Map<K, V>` built from a literal in DESIGN.md order, `LinkedHashMap` semantics; **`EnumMap` and `HashMap` are banned in `:rules`** (ordinal or hash order would change `weighted()` walks and `Object.entries` sums) | Immutable after load |
| Mutable battle objects (`Actor`, `PartyMember`, `Relic`) | `class` with `var`s inside `battle`; `data class` where the contract calls it data (`Relic`, `Status`) | Mutation stays inside the battle and run; snapshots are copies |
| `Rng = () => number` | `fun interface Rng { fun next(): Double }` | Last parameter everywhere; detekt rule |
| `runSteps` generator (`yield` a pending, receive an answer) with `yield*` delegation into nested resolvers | The same shape, **1:1**: a `@RestrictsSuspension` builder over `kotlin.coroutines` intrinsics with `suspend fun ask(pending): Answer` — stdlib-only, `commonMain`-legal, delegation preserved | Kotlin's `sequence {}` cannot receive a value at `yield`; a hand-written state machine would not be 1:1 (every live local at ≈ 30 suspension points would have to be materialised). The generator is never serialized: persistence is the decision log replayed (§A7.5). The builder is a T1 spike with its own tests |
| `createRun` (`state / pending / token / decide`) and `createBattle / nextReady / runTurn / isOver / battleOutcome` | `RunMachine` and `BattleTurns` in `:rules`, the same API | The run's BATTLE pending hands out the live battle, driven turn by turn by the caller, on the run's own rng — exactly as today |
| `decide(answer: unknown)` — "anything at all may be passed; an illegal answer travels into run.ts untouched and that decision's own fallback decides it" | `sealed interface RunAnswer` with an explicit `Invalid` case; every fallback keeps its rule ID and scenario | The fallbacks are contract; an out-of-range script exercises each (§A5.4) |
| `Policy` with 13 methods | `interface Policy` | Policies live in `:rules` because DESIGN.md defines them |
| `validateData(): string[]` | The same function; a test asserts it returns empty | Runs on every target |

### A2.4 What is not ported, and what replaces it

| Not ported | Lines | Replacement |
|---|---|---|
| The procedural sprite kit (`parts.ts`, `parts-late.ts`, the kit branches of `actors.ts` / `actors-late.ts`, `pixel/*`) | ≈ 14 100 | Bitmap actors (option C): a registry generated from the manifest, `drawActor` = one `drawImage` per actor; `POSE_FALLBACK` kept as the contract states (§B2.3); dev-only placeholder silhouettes for actors with no art yet (§A8.4) |
| Procedural biome painters (`backdrops.ts`) | 4 357 | The painted planes exported **once** per (biome, tier) from the TS bake (§A8.2). The light map, grade map, fog bands, dust motes, shafts and the sky sprite are **re-implemented** in `:engine` from exported `BiomeLook` data (their seeds included), because they are computed, not painted |
| Procedural VFX (`vfx.ts`) | 3 708 | A particle system in `:engine` (≈ 400 lines) and one recipe per family in `:game` as data (≈ 300); the look is re-judged by the critic |
| WebAudio synth (`audio.ts`) | 406 | 24 clips rendered offline (§A8.3); the limiter's job (overlapping voices must not clip) becomes a per-name cooldown table and a headroom rule on clip gain |
| CRT (`crt.ts`) and the ARCADE tier | 208 | Deferred: §B6.1 decides, and DESIGN.md's two ARCADE rules (a phone starts ARCADE; the PAUSE overlay's third button) are edited in the same milestone |
| Host runtime (`runtime.ts`) | 63 | Dropped; a native app has no host frame |
| Playwright smoke, Vite, esbuild | — | Boot tests per target; Gradle |
| `tools/study.*`, the grid intake (option B) | ≈ 1 150 | Superseded before the port |
| The arcade shell in `index.html` (rotate overlay, add-to-Home-Screen hint, fullscreen + orientation lock) | 193 | Native manifests; the web host page keeps the rotate overlay and the audio unlock |

### A2.5 Size estimate

| Module | Kotlin lines (est.) | Basis |
|---|---|---|
| `:rules` | 5 000 + 5 000–7 000 tests | 1:1 from 4 900 TS lines; tests with draw-count assertions on every roll, plus golden and property tests |
| `:specs` | 6 000–9 000 (features + step DSL) | Re-derived at T1 from the Combat pilot (§A5.1); the plan's own sample is 13 lines per scenario |
| `:engine` | 3 500 + 1 000 tests | Light rig: planes are assets, but light map, grade, fog, motes, shafts, bloom, tiers are code |
| `:game` | 6 500 + 1 500 tests | Screens 1:1 minus canvas boilerplate; VFX as data |
| `:sim` | 700 | 1:1 from `sim/run.mjs` (699 lines) |
| `:tools` | 2 000 | Intake, capture, seats, metrics, fixture pages |
| Apps | 400 | Hosts |
| **Total** | **≈ 32–38 k** | Against 47.7 k TS today; the earlier "20–25 k" undercounted tests and specs. T1 replaces these estimates with the pilot's numbers |

## A3. Determinism and the parity oracle

### A3.1 The oracle fixtures

From this repository at `ts-oracle`, a script writes `oracle/`:

- `mulberry32.json` — the first 10 000 outputs for seeds 1, 2, 7, 12, 4 242.
- `rng-primitives.json` — `pick`, `uniformInt`, `weighted`, `chance`,
  `withoutReplacement` over scripted sequences.
- `relics.json` — for every (source, act, lap ∈ 1..3, ascension, forced) cell: the hash
  over 200 rolls; full records for 3 rolls per cell and for 200 rolls in 20 named cells.
  (Full records for every cell would be ≈ 1.2 M relics — not a fixture.)
- `battles/<policy>-<fixture>-<seed>.json` — per fixture cell (act-1 packs plus the
  pre-flight extensions): the aggregate row, the full `BattleResult` for the first 25
  battles, the hash over 2 000.
- `runs/<policy>-<seed>.json` — `--runs 2 000` per policy and seeds 1, 2, 7: the ladder,
  the full `RunResult` for the first 20 runs, the hash over 2 000; plus `--runs 5 000`
  seed 1 for `balanced` (the Balance state row) as an exact-equality fixture.
- `scripts/<name>.json` — the run scripts (§A5.4).

**The canonical encoder.** Every hash is over a canonical byte form produced by the same
specification on both sides: fields in the order the type declares them, integers as
decimal integers, doubles as the 16-hex-digit IEEE-754 bit pattern, strings UTF-8,
arrays in order, no whitespace. Never `JSON.stringify`, never `Double.toString`. The
relic `id` counter (`RollCtx.nextId`, run-scoped, starts at 0) is part of the records
and is reset per run in both implementations.

Full records for the first N make a mismatch diffable; the hash over all N makes a
reordering that averages to the same numbers a failure.

### A3.2 Numeric parity rules

| Hazard | Rule in the port | Proof |
|---|---|---|
| `Math.round` (JS: nearest, ties toward +∞) vs `kotlin.math.round` (ties to even) and `roundToInt` | One `jsRound(x: Double): Int` in `:rules.types`, implemented per the ECMAScript definition: `val f = floor(x); if (x - f >= 0.5) f + 1 else f` (the subtraction is exact below 2^52; `floor(x + 0.5)` is wrong at `0.49999999999999994`). `kotlin.math.round`, `roundToInt`, `roundToLong` are forbidden in `:rules` | Unit tests at 0.5, −0.5, 2.5, 0.49999999999999994, ±2^52 ± 0.5; the relic and damage fixtures |
| mulberry32's `Math.imul`, `>>> 0`, `/ 4294967296` | `Int` arithmetic, `toUInt().toDouble() / 4294967296.0` | `mulberry32.json` |
| `Math.pow(LAP_MULT.x, lap − 1)` | Repeated multiplication in both (pre-flight 5, proven a no-op) | `runs/lapper-*.json` |
| Ready-queue sorts (`battle.ts:949, 1167`): four-key total orders | Ported as the same four-key comparator; `sortedBy` on one key is forbidden by review; the comparator has its own scenarios | Battle fixtures with SPD ties |
| Exact float-equality branches (`deltas[i] === minDelta`) | Primitive `Double` comparisons only; boxed-`Double` `equals`, `List<Double>.indexOf`/`min` are forbidden in `:rules` (Konsist text rule) | Battle fixtures |
| Iteration order (`weighted()` walks, `Object.entries` sums) | Lists and `LinkedHashMap` only; `EnumMap`/`HashMap` banned | Relic fixtures; the awakening-bonus sum gets a scenario now so B1's first stat-bonus awakening cannot break it silently |
| `Float` | Not permitted in `:rules` (Konsist text rule; `ForbiddenImport` cannot see auto-imported `kotlin.Float`) | — |
| Kotlin/Native and Wasm | Kotlin/Native emits IEEE-strict LLVM IR without fast-math or contraction flags, and Wasm has no fused multiply-add — so fused arithmetic is not the expected risk. The expected risks are transcendental implementations (removed by pre-flight 5), text round-trips (removed by the canonical encoder) and hash-ordered collections (banned). Nothing here is a tolerance: a mismatch on any leg is a build failure to be root-caused | The T0a determinism probe (§A10) and the golden legs |
| Locale | No locale-sensitive operations in `:rules`; ids are enums | — |

### A3.3 Exit criterion for the rules port

Phase T2 ends when **on the JVM** every oracle file matches: the primitives and relic
cells exactly, the battle and run hashes exactly, the full records deep-equal, and the
scripts reach their recorded end states. The **iosSimulatorArm64** and **wasmJs** golden
runs are nightly and non-gating during T2, gating from T5 (iOS) and T8 (Wasm). From T3
the Kotlin simulator is the oracle and regenerates `oracle/` from the same seeds.

## A4. Test strategy and the TDD working method

### A4.1 The pyramid, by module

| Layer | Where | What | Runner / target |
|---|---|---|---|
| Unit | `:rules` commonTest | Every function with a rule ID; the scripted rng (§A4.3); property tests for invariants (`hp ≤ maxHp` after every refit, `atb` never clamped, `validateData()` empty, every sealed hierarchy exhaustively handled) | `kotlin.test` on every target |
| Executable spec | `:specs` jvmTest | Gherkin scenarios per R-ID; run scripts | Cucumber-JVM |
| Golden / differential | `:rules` commonTest | The oracle files | `kotlin.test`: JVM gating, iOS/Wasm per §A3.3 |
| Balance regression | `:sim` jvmTest | The `balanced` seed-1 5 000-run ladder: **exact equality** while parity holds; a ±1.0-point band only after a deliberate re-baseline (§A10 T3) | `kotlin.test` |
| Engine unit | `:engine` commonTest | Hit-region geometry, the frame accumulator, the tier controller, the save codec, the pool derivation, the light-map bake at pinned inputs | `kotlin.test` |
| Layout | `:game` commonTest | Every hit region a screen registers, its rect from the layout constants, its index and group, asserted without rendering | `kotlin.test` |
| Flow | `:game` desktopTest; iOS simulator nightly | The run scripts driven through the run adapter (tap region X → answer Y) and through the composed UI, asserting the recorded end state | Compose UI test |
| Screenshot | desktop: `ImageComposeScene` (a Compose Desktop API); Android: Roborazzi on Robolectric; iOS: none gating (an XCTest snapshot job nightly if T5 proves it cheap) | Static screens on fixtures; the battle frame and the KO tableau **only under the deterministic render mode** (fixed frame clock, seeded particles and VFX, sway and motes pinned) — an `:engine` deliverable in T5, because today's battle captures differ on 74 % of pixels between two runs | perceptual diff; approval = the critic's verdict logged in the art review file |
| Boot | each app | The app starts, the title renders, no uncaught error in 60 frames | Android instrumented (x86_64 emulator), iOS XCTest, desktop headless, Wasm in headless Chromium |
| Device | owner + nightly on a device farm if adopted | Frame-time histogram on the two reference phones | `:tools perf` |

### A4.2 The TDD loop, and how it is proved

Every task — a rule, a screen, an engine primitive — runs the same loop, and the task
template in the new CLAUDE.md is the loop:

1. **Locate the rule**: the ID (a new ID is a functional change and needs the owner).
2. **Write the test first.** A rule: the scenario and/or the unit test with its draw
   count. A screen: the layout assertion and the flow assertion (§A4.1) — a screenshot is
   never the first test, because its approved image is recorded from the implementation.
   An engine primitive: the unit test.
3. **Commit the test alone** (`test(R-COMBAT-19): …`) and push. CI runs the named test
   and **asserts it fails**; that run's id is the `RED:` evidence.
4. **Implement the minimum.**
5. **Commit the implementation** (`impl(R-COMBAT-19): …`); CI runs green; that run's id
   is the `GREEN:` evidence.
6. **Refactor under the gates.**
7. **Report** with both run ids. The blind verifier checks the ids, re-runs the gate on a
   clean worktree, and rejects a report whose red run is missing or whose test commit
   passes.

Two more mechanisms, scored so the oracle cannot pay for them:

- **Mutation testing** on `:rules` (JVM), with the golden and differential tests
  **excluded** from the run: threshold 80 % on the unit + spec suite alone, nightly on the
  module and per PR on changed files. The full-suite score is a second, non-gating line.
- **Coverage** (Kover, a JVM number) with the golden suite excluded: `:rules` ≥ 95 %
  line, `:engine` ≥ 75 %, `:game` ≥ 60 % (screens are covered by layout, flow and
  screenshot tests more than by lines). A CI check fails a commit that touches
  `:rules/src/commonMain` without a paired `test(...)` commit — the two-commit rule makes
  it a check on history, not a heuristic on file names.

### A4.3 The scripted rng

Every roll-dependent rule is tested by handing the function an `Rng` that returns a
scripted sequence and asserting **both** the outcome and the number of draws consumed.
`ScriptedRng(0.1, 0.9, …)` throws on a draw past the script, and every such test ends
with `assertEquals(n, rng.consumed)`. The draw count is the contract's own promise
("always one draw", "no draw at p = 0") and is what keeps two implementations on the
same stream. This is the single most important technique in the port, and the reason
"rng last" is a detekt rule.

## A5. Executable specifications

### A5.1 Rule IDs in DESIGN.md — three namespaces

After the repair pass (pre-flight 9), DESIGN.md's rules get stable IDs in three
namespaces, each with its own kind of proof:

| Namespace | Covers | Proof | Enforced by |
|---|---|---|---|
| `R-<AREA>-<nn>` | Executable rules: Stats, Elements, Combat, Relics, Characters, Run, Vault, Persistence | Gherkin scenarios against `:rules` | the trace check, gating |
| `P-<AREA>-<nn>` | Presentation constraints: input, UI geometry and text, the light rig's numbers | A layout/engine unit test or a screenshot fixture named in the trace | the trace check, gating |
| `T-<nn>` | Difficulty targets | A `:sim` gate | nightly |

**Granularity**: one ID per independently testable statement. A table row with its own
behaviour is one ID per row (the 17 statuses are 17 IDs; the 12 sigils are 24 — base and
kindled). A pilot on the Combat section in T1 **counts** the IDs before the sweep; the
plan's expectation after the reviewers' measurement is **350–500 IDs**, not the 140–180
first estimated. IDs are never renumbered; a retired rule keeps its ID with a note; text
the code does not implement (phase 7c) carries no ID. The sweep is a contract edit and
gets a blind check like every other one here.

### A5.2 Feature files

`specs/features/<area>.feature` — **one file per area, many tagged scenarios per file**
(one file per ID would be hundreds of files). Scenarios are written in the contract's
vocabulary and use tables for numbers:

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

(The reviewers re-derived the 168: 280 × 0.7 × (1 − 150/1050), one draw.) Step
definitions in `:specs` call `:rules` through a small DSL — actor builders, the scripted
rng, a battle harness, a relic roller, run-script steps — the only place that knows the
rules' API.

### A5.3 The trace check

`specTrace` in `:specs` builds `build/reports/spec-trace.md`: one row per ID with its
DESIGN.md line, its proof (scenarios for R-IDs; the named test or fixture for P-IDs; the
sim gate for T-IDs), and the last result. It fails the build when an R- or P-ID has no
proof, when a proof tags an ID DESIGN.md does not contain, or when a scenario is
untagged. This is the check an agent runs to answer "is this rule specified?" without
reading code.

### A5.4 Run scripts

The `playfull-decisions.json` format — seed, full `RunConfig` (Vault relics included),
the decisions with every battle's `HeroChoice` list, the end state — is a specification:
`specs/scripts/*.json`. The set is enumerated against the nine room types and the
thirteen `Policy` methods so that every decision kind is covered by design, not by what a
random map happened to visit:

| Script | Covers |
|---|---|
| `crypt-ko` | draft, opening SUMMON, leader, route, FIGHT, cards + who-wears-it, a real KO, REST heal |
| `six-acts-win` | every act with a scripted strong party; ELITE; BOSS cards; the doors → DESCEND; BANK |
| `lap-2` | ANOTHER LAP, `LAP_MULT`, the bank count at lap 2 |
| `bank-overflow` | a full Vault; drop rules; `vaultEquip` and the ascension floor at the next start |
| `summon-swap` | a full-party SUMMON swap onto the leader's slot |
| `altar-shrine-forge` | ALTAR awakening; a SHRINE taken and one declined; FORGE LEVEL, RECAST and REBRAND; REST sharpen |
| `ascension-5` | A5 (fourth boss skill), VEIL taken |
| `stall` | a `TURN_CAP` stall (`deathKind 'STALL'`) |
| `retreat` | a forfeit from PAUSE |
| `mid-battle-kill` | the app killed mid-battle; resume lands on the same turn |
| `illegal-answers` | an out-of-range index at every decision kind; each fallback's rule |

Each script runs three ways and all three must agree with its end state: headless through
`:rules`; through the run adapter without rendering; through the composed UI in a Compose
UI test (desktop; iOS simulator nightly). Scripts are recorded here before `ts-oracle`
(pre-flight 7) because the recorder retires with this repository.

### A5.5 Agent verification

A blind verifier of a rules task receives the ID, the feature file, the trace report and
the two CI run ids — not the implementation — and runs `./gradlew :specs:test specTrace`
on a clean worktree. It reports the runner's output. For screens, the verifier receives
the layout and flow tests and, where one exists, the approved screenshot and the critic's
logged verdict.

## A6. Static analysis and quality gates

### A6.1 Tools, with what each can and cannot see

| Tool | Scope | Configuration and caveats |
|---|---|---|
| Kotlin compiler | all | `allWarningsAsErrors = true`; `explicitApi()` on `:rules`, `:engine`, `:game`; progressive mode |
| ktlint | all | Official style; `.editorconfig` committed |
| detekt | all | Complexity rules on for `:engine`, `:game`, `:tools`: `CyclomaticComplexMethod` 12, `LongMethod` 40, `LongParameterList` 6, `NestedBlockDepth` 3, `TooManyFunctions` (file 20, class 15), `LargeClass` 400, `ReturnCount` 3; `UnsafeCast`, `UnusedPrivateProperty/Function/Class`. **The `:rules` profile is different and says why**: `LongMethod` 120, `CyclomaticComplexMethod` 20, `ReturnCount` off — a draw-ordered procedure (`castSkill` is 98 lines, `runSteps` 97, `buildMap` 86) is one unit, and splitting one is allowed only in a commit whose oracle hashes are unchanged; any residual violation carries `@Suppress` with the rule ID and a reason, counted by a Konsist test that fails if the count rises after Appendix C is signed. `ForbiddenImport` in `:rules` for `kotlin.random.*`, `kotlin.time.*`, `kotlinx.coroutines.*`, `androidx.*`, `java.*`, `org.jetbrains.skia.*`, `java.util.EnumMap/HashMap`; `ForbiddenMethodCall` for `kotlin.math.round`, `roundToInt`, `roundToLong`, `System.*`, `println`. **Caveat**: `ForbiddenMethodCall`, `UnsafeCast` and any rule that needs type resolution run only on JVM/Android compilations — detekt has no type-resolved analysis for common, Native or Wasm source sets — so each of these has a text-level backstop in Konsist, and T1 proves every rule with a seeded violation **per source set**, `roundToInt` in `commonMain` included |
| Custom detekt rule set (`build-logic/detekt-rules`, unit-tested) | `:rules` | `RngLastParameter`, `NoMutableTopLevelState`, `SealedWhenExhaustive` (JVM-resolved; text backstop) |
| Compose rules for detekt | `:game`, `:engine` | Modifier ordering, unstable parameters, `remember` misuse |
| Konsist | all (jvmTest) | Module and package dependencies (§A6.2); naming; every `data` table `val` and immutable; every `:rules.types` class an `enum`, `sealed`, `data` or `value` class; **text-level backstops**: no `Float`, no `roundToInt`, no `EnumMap`/`HashMap`, no boxed-`Double` equality in `:rules`; the `@Suppress` count |
| Kover | JVM | Thresholds in §A4.2; a JVM number, stated as such |
| Pitest | `:rules` JVM | The Gradle plugin needs manual wiring for KMP `jvmMain`/`jvmTest`; the Kotlin-aware mutators are the commercial arcmutate plugin (free for public open-source projects at the time of writing — §A12 #11). Advisory in the nightly until wired and licensed; gating at 80 % once it is |
| Binary compatibility validator | `:rules`, `:engine` | `apiDump` committed; `apiCheck` in the gate |
| Dependency analysis plugin | JVM modules | KMP support is partial; scoped to the JVM source sets |
| Renovate | repo | Grouped weekly updates; the gate is the merge criterion |
| Android Lint | `:app:android` | `warningsAsErrors`; no baseline |
| Power-assert compiler plugin | tests | Sub-expression values in failure messages — cheaper for an agent to read than a stack trace |
| Spec lint | `:specs` | The trace check; every `.feature` parses; no untagged scenario |
| Asset lint | `:tools` (test) | Every registry entry has its files; heights match the class table; a shipped actor has at least `idle-0` (§B2.3); placeholders fail a release build; plane dimensions per (biome, tier); the exported light-rig data parses |
| Art metrics | `:tools` (test) | The bitmap sheet's `p50 L`, `% below 35`, `% above 75` per actor within the intake's recorded bands — the port of today's "43 PASS in `metrics.md`" commit gate |
| gitleaks | CI | No secrets in history |

Not adopted: SonarCloud (a service to run, no rule the above lack); Spotless (ktlint
suffices); hosted Cucumber reports (the local report is what agents read).

### A6.2 The architecture as tests

Konsist turns the module table into assertions that run with the unit tests (illustrative
shape; Konsist's exact API is fixed in T1):

```kotlin
@Test fun `rules depends on nothing platform-shaped`() =
    Konsist.scopeFromModule("rules").files.assertFalse { file ->
        file.hasImport { it.name.startsWith("androidx.") || it.name.startsWith("java.") || it.name.startsWith("org.jetbrains.skia") }
    }
@Test fun `a data table imports types and skills only`() { /* … */ }
@Test fun `engine never imports rules or game`() { /* … */ }
@Test fun `every function taking Rng takes it last`() { /* … */ }
```

The TS bundle-regex refusal becomes tests with names.

### A6.3 The gate

`./gradlew gate` depends on: compile all targets, `ktlintCheck`, `detekt`, `apiCheck`,
`konsistTest`, `allTests` on every target the host can run, `:specs:test`, `specTrace`,
`koverVerify`, `buildHealth`, `assetLint`, `artMetrics`, and — when `:rules` or `:sim`
changed — `:sim:balanceCheck`. Pitest, the iOS and Wasm golden legs, the iOS flow tests
and the device perf run are nightly. The gate writes `build/reports/gate/index.md` with one
line per check as **PASS / FAIL / SKIPPED(reason)** and a banner naming every skipped
target; a writer's report quotes the banner. **Merge to `main` requires no SKIPPED
row**, which only the CI matrix satisfies.

### A6.4 CI

GitHub Actions: `ubuntu-latest` for the gate minus the Apple targets; `macos-latest` for
the iOS simulator golden leg, the iOS flow tests and the Xcode archive; Gradle remote
build cache; `nightly.yml` for Pitest, the screenshot matrices, the iOS/Wasm legs and the
perf run; `release.yml` produces a signed Android App Bundle and an iOS archive on a tag —
signing certificates and profiles live in CI secrets from **T1**, so the release workflow
has produced a signed artefact long before T7. The repository's visibility (§A12 #2)
decides whether macOS minutes cost money.

## A7. The presentation port

### A7.1 Frame, loop, scale

One `Canvas` composable fills the window; one transform maps the 1280×720 logical frame
to the letterboxed device rect. `withFrameNanos` drives a fixed-timestep accumulator
(60 Hz updates, render each vsync, the 250 ms delta clamp and the focus-reset rule from
`engine/loop.ts`). The rules never see `dt`.

### A7.2 Hard pixels, fonts, sprites

Bitmap actors are `ImageBitmap`s drawn with `FilterQuality.None`, one `drawImage` per
actor at the registry's `feet`, flipped by a negative x-scale. The HD 7×11 bitmap font is
one baked atlas per (colour, scale) with the same LRU. The HUD's vector text goes through
`TextMeasurer` with a **bundled** open-licence font by default (§B6.2 can overrule);
per-platform text metrics are absorbed by the screenshot thresholds, never by
per-platform layout code.

### A7.3 The light rig on Skia

What is exported and what is computed: the four painted planes (and MED's merged plane
and LOW's flat backdrop) are exported images; the light map (key, fill, both foot pools,
shafts; HIGH's highlight lift), the grade + vignette map, the fog bands (with their LCG
seed), the dust motes, the sway and the sky sprite are **computed at load or per frame
in Kotlin from the exported `BiomeLook` data**, because they are functions of the anchors
and the tier — exporting them as PNGs would have frozen the pools while the per-actor
gain derived them live. One derivation, one source of truth.

| TS pass | Compose |
|---|---|
| Diorama planes at parallax offsets, oversized by `PLANE_PAD` | `drawImage` of the plane images translated by depth × shake, plus the sway |
| The light map `'lighter'` behind the actors, baked once per (biome, tier) | Baked into an `ImageBitmap` at load from the data; `drawImage(…, blendMode = Plus)` |
| Fog bands and motes drawn behind the actors | Re-implemented (`bakeFogBand`'s LCG, `bakeMoteSprite`, `buildMotes`) |
| Contact shadow + cast lobe | Two ellipses from a cached gradient brush |
| Per-actor gain (`'color-dodge'`, one flat sprite under a feathered alpha, linear in `globalAlpha`) | `drawImage(gainSprite, alpha = strength, blendMode = ColorDodge)` — the same collapse to `dest × (1 + a(G − 1))` |
| Rim spill | `BlendMode.Plus` |
| `'copy'` blits inside the bloom chain | `BlendMode.Src` — equivalent only for full-coverage blits, which these are |
| **Bloom** — source is **the whole composed world** (`ctx.canvas` before the HUD: planes, light map, actors, VFX; `light.ts:1652`), at ¼ (HIGH) or ⅛ (MED) resolution, self-multiply threshold, blur, the actor-ellipse damp with `'destination-out'`, nearest 2-step upscale, refreshed on alternate frames | The world is recorded into a `GraphicsLayer`; the bloom buffer is a second layer drawn from it at the division with `BlendMode.Multiply` twice, a `BlurEffect`, `BlendMode.DstOut` for the damp, then `BlendMode.Plus` over the frame; alternate-frame refresh kept. **Which primitive carries the offscreen buffer is T0a's question**: `GraphicsLayer.toImageBitmap()` is a readback and `Canvas(ImageBitmap)` is software on Android, so T0a proves a layer-to-layer path (or an AGSL/SkSL shader pass behind an expect/actual) on Android and iOS and records it |
| Blur radii (`BLUR_FAR 6`, `BLUR_MID 1.2`, `BLUR_NEAR 8`, the bloom blur) | The planes' blur is already in the exported images. The bloom's blur parameter is **not the same quantity per target** (Android's `RenderEffect` takes a radius, Skia's `makeBlur` a sigma, CSS `blur(N)` is σ = N/2): T0a measures the kernel per target and the rig stores one constant per target with a kernel-width test |
| Grade + vignette (`'multiply'` map; elliptical vignette) | Baked at load; `BlendMode.Multiply` |
| Sky body after the grade, in the FAR plane's space | `BlendMode.Plus` |
| Tiers HIGH / MED / LOW, `note(frameMs)` one-way drop after 60 slow frames | Same controller, unit-tested; API 29–30 starts and stays at LOW |

The rig's constants (`GAIN_FLOOR 0.06`, `GAIN_LIFT 0.24`, `GAIN_SPREAD_CAP 0.14`,
`RIM_FLOOR/LIFT 0.04/0.06`, `SHADOW_CAST_ALPHA 0.82`, the pool derivation with the 60-px
overlap clamp) are transcribed and unit-tested against the recorded numbers at the
current anchors (enemy (336, 448) rx 163 ry 160; party (632, 448) rx 193 ry 160, k ≈
0.551). The per-actor gain box is sized from the registry's `hitSize` (today it is still
the kit's `ACTOR_W`).

### A7.4 Input

Pointer events map to logical pixels through the transform; primary pointer only; a tap
commits on release inside the region it began in; cancel and app pause clear pressed
state. The immediate-mode hit-region registry (`begin / add / end`, `TAP_MIN 96`
expansion clamped to the frame, drawn-rect-beats-expanded, spatial keyboard focus with
the ±50° cone, index cycling, twins skipped) is a pure Kotlin class in `:engine` with unit
tests. Hardware keys keep A/B/PAUSE parity; Android's system back is B; the safe inset
comes from the platform's window insets.

### A7.5 Persistence: the save file is the decision log

Three files, JSON, versioned with **forward migrations** (never a reset of the Vault):

- `vault.json` — today's `VaultSave` (`version`, `vault`, `vaultSlots`,
  `unlockedAscension`).
- `run.json` — the run in progress: `rulesVersion` (a hash over `:rules`' code and
  data, stamped at build), `seed`, the full `RunConfig` (Vault relics included), the
  landed decisions, and the open decision's partial answer — the hero choices of the
  battle in progress — **flushed after every hero turn** as well as after every landed
  decision. A battle is one pending that lands only when it ends and it runs on the run's
  own rng, so the per-turn flush is what makes mid-battle resume possible.
- `settings.json` — volume, mute, haptics, the tier override, the quality toggle.

Resuming replays the log through the run machine from the seed: deterministic rules give
the same state, and one full run replays in ≈ 5 ms headless (§1.4), so a mid-act-4 resume
is well under a frame. Mid-battle resume replays the battle's recorded hero turns (each
`HeroChoice` re-mapped to an `actOptions` index; a choice that does not map is treated as
corruption) and lands on the current turn; no animation state is saved. **If
`rulesVersion` differs from the running app's** — a balance patch, a new character — the
run cannot be replayed faithfully: the app says so and abandons it (the run is minutes
old; the Vault, which does not depend on rules, survives). This is rule `R-PERSIST-02`
and a box in Appendix C. Cloud sync waits for PvP's accounts.

### A7.6 Verifying the look

The instruments are ported to `:tools` on the desktop target using `ImageComposeScene`:
`capture` (title, room card, battle frames including a hit, pause, inspect, the run-script
frames), `seats` (each actor's own pixels at its seat, masked by the bitmap's **own alpha**
— today's mask comes from the kit's line-up page, which retires), `metrics` (the
full-frame numbers the critic uses), and the fixture pages that today are
`tools/lineup.html`, `tools/vfx.html`, `tools/backdrops.html` and `tools/screens.html`
as desktop fixture screens. The kit's sheet rulers retire with the kit; the bitmap sheet
keeps the intake's value stats.

**Look parity is two different questions**, and Appendix C asks them separately:

1. **The scene, ground, UI and VFX** — measured with **one reference sprite planted at
   every seat** (the instrument already supports it): the rig's contribution per seat
   (lit minus unlit) within 1.5 L of the TS reference on the same seeds, seat spread ≤
   5 L, the ground strips within 1.5 L, the plates' contrast ratios held, all
   recomposed at time 0 and shake 0 against `reference/ts-oracle/`.
2. **The actors** are new art and are judged **fresh** under §B2.5's stage gates, never
   against the kit's frames.

The full-frame critic's last verdict on the TS build was **8 · 8 · 8 · 8 · 7 — "ONE MORE
ROUND"**, against a ship rule of ≥ 8 on every axis; the port's bar is "no axis lower",
which keeps composition at 7 as an open item on both codebases, not a pass.

### A7.7 Performance

The TS build measures 7.3 ms resting and ~11.5 ms at a hit peak on software Chromium. The
port's budget on the two reference phones, on HIGH: **≤ 8 ms resting, ≤ 12 ms at a hit
peak** (60 fps needs ≤ 16.6), measured by `:tools perf` from a scripted battle, histogram
committed per release. If the budget fails, in order: bloom division 4 → 8, alternate
frames → every third, MED default on that device class, LOW on API 29–30. `note(frameMs)`
remains the runtime guard.

### A7.8 App lifecycle and memory

Pause on background; the run file is current to the last hero turn; audio pauses; on
resume the frame clock resets. Orientation locked in the manifests. Back = B. Memory: the
planes are **not small** — one biome at HIGH is four 1360×800 images ≈ 17 MB decoded
plus the light and grade maps ≈ 26 MB; the game shows one biome at a time, so biome
assets are loaded on act entry and released on act exit, and `assetLint` checks that
every biome's set decodes within a stated budget.

## A8. Asset pipeline

### A8.1 Intake in Kotlin

`tools/intake.mjs bitmap` (green keying by hue ± 20° and saturation > 0.5, crop, two-step
area downscale to the class height, alpha snap at 0.45, feet and hit box, value stats,
manifest + registry generation) is ported to `:tools intake` on the JVM. Parity test:
EMBER's master produces a sprite matching the TS intake's `idle-0.png` exactly or within
one level per channel with the same bbox and stats. The registry is generated Kotlin plus
the JSON manifest; the runtime (`POSE_FALLBACK`, `loadBitmapActors`, `bitmapFor`) is
hand-written as today.

### A8.2 Export, don't port: planes and light-rig data

A one-time tool here (`tools/export.mjs`, pre-flight) runs the real `engine/light.ts`
bakes and writes per biome: `far`, `mid`, `floor`, `near` at HIGH (the floor crisp at 1:1,
the others at the pad scale — the bake is the export), the MED merged mid+floor plane, the
LOW flat backdrop; and `look.json` — key, fill, the pools' `actorWeight`, grade, vignette,
fog (speed, colours, seed), motes, shafts, the sky body, the ambient preset. The Kotlin rig
bakes the light and grade maps from `look.json` and the anchors it is given.

The parity test is a **recomposition**: the Kotlin rig composes the exported planes with
its own maps at time 0, shake 0, `actors=0`, and the frame is compared to the pinned TS
backdrop capture in `reference/ts-oracle/` within a stated threshold per tier (a plane
cannot be byte-compared to a composed frame). What the export freezes — the scene
residuals the round-4 critic named — is listed in §1.5 and §B2.4 #3.

### A8.3 Sound

`tools/export.mjs sfx` renders the 24 sounds through the TS synth with an
`OfflineAudioContext` in headless Chromium to 44.1 kHz WAV, then OGG (Android, desktop,
web) and CAF/AAC (iOS). The per-name cooldowns move to a table; the owner's ear is the
acceptance.

### A8.4 Manifests, validation, placeholders

Every asset class has a committed manifest and an `assetLint` test: actors (id, class,
height, feet, hit, hitSize, poses → files, stats), planes (biome, tier, size), `look.json`
(parses, pools derive), sfx (name, files, cooldown), fonts. **Placeholders**: a dev-only
generator writes a flat silhouette at the class height for any actor without an `idle-0`,
so T5 and T6 can render every screen before the art exists; a release build fails
`assetLint` if a placeholder is present.

## A9. The agent workflow, ported

| Today | New |
|---|---|
| `npm run check` after every edit | `./gradlew :rules:jvmTest` for rules work (seconds warm); `:<module>:compileKotlinJvm ktlintCheck` for the rest; the desktop app hot-reloads |
| `npm run build && npm run smoke` before a commit | `./gradlew gate` in a worktree |
| `capture.mjs sheets` → 43 PASS for art commits | `artMetrics` + `assetLint` in the gate |
| `npm run sim` when rules moved | `:sim:run` and `:sim:balanceCheck` |
| The commit gate in a detached worktree | `git worktree` + `./gradlew gate` (the build cache makes it cheap) |
| Blind verifiers on their own port | Blind verifiers on a clean worktree with the two CI run ids |
| `game-writer` (Sonnet) writes; Opus for art, critics, scene | Unchanged; the writer's task template is §A4.2 |
| New engine primitives are re-exported and added to CLAUDE.md's API table in the same change | Kept: `engine/README.md` holds the API table, updated in the same commit; `apiCheck` catches the surface, the table carries the meaning |

The ten skills, each re-derived from the current code (four of them name files that no
longer exist today, so "translate" would carry the drift across):

| Skill | Fate |
|---|---|
| iterating-on-a-game | Rewritten: the TDD loop, the gate, the worktree |
| balancing-with-the-simulator | Rewritten for `:sim`; the exact-equality regime until a re-baseline |
| playing-the-game | Rewritten: run the desktop app; the boot tests; the owner installs the phone builds |
| releasing-the-game | Rewritten: tag → `release.yml` → TestFlight and the Play internal track; the web fast lane while it exists (§B6.5) |
| designing-mechanics | Kept; adds "an ID, a scenario, a run script if a decision changed" |
| improving-game-quality | Rewritten for the Compose screens and the deterministic render mode |
| handling-user-input | Rewritten for the Kotlin hit-region class |
| ensuring-arcade-visuals | Rewritten as *judging bitmap actors and the lit scene* (the kit and the CRT are gone) |
| messaging-game-over | Retired with `runtime.ts` |
| adding-easter-egg | Retired; secrets return, if wanted, as a functional item |
| *new* specifying-a-rule | The ID → feature → trace loop |

## A10. Delivery phases

Every phase ends green on `./gradlew gate` and updates CLAUDE.md, the skills and this
plan's status line in the same milestone. Sizes are agent-session days; the **Owner**
column is owner time on the critical path.

| # | Phase | Delivers | Exit gate | Agent | Owner |
|---|---|---|---|---|---|
| T0a | **Spike, agent half** | A throwaway Compose app on desktop and the Android emulator (API 34 and API 29) drawing one biome's planes hand-exported by a scratch script, EMBER's bitmap, a light map with `Plus`, a `ColorDodge` gain, a `Multiply` grade, and **the full bloom chain** (composed-world source, ¼ res, threshold, blur, `DstOut` damp, alternate frames) through a layer-to-layer path; the blur kernel measured per target; **the determinism probe** (mulberry32's vector, `jsRound` at the boundary cases, the lap multipliers, one damage line) run on JVM, iosSimulatorArm64 and wasmJs with hashes in the report | Blend modes match the TS frame by screenshot; the probe's hashes agree on all three legs; the offscreen primitive is named | 3–5 | — |
| T0b | **Spike, owner half** | The same app on the two reference phones; frame-time histograms at HIGH (and LOW on an API 29–30 phone if one exists) | ≤ 8 ms resting, ≤ 12 ms at a hit peak on both; the stack decision confirmed or the fallback (§A1.3) taken | — | 1–2 h + a Mac for the iPhone |
| T1 | **Walking skeleton and pre-flight** | Here: pre-flight 1–11 (§1.5), the tag `ts-oracle`, `oracle/` and `reference/ts-oracle/`. There: the new repository with every module, every tool in §A6.1 configured and proved by a seeded violation per rule per source set, the two-way generator builder spiked and tested, the gate with SKIPPED reporting, CI on both runners with signing in place, CLAUDE.md + skills v1, DESIGN.md copied with the pilot's Combat IDs and the count of the rest | `gate` green on a repository whose only code is `mulberry32` with its golden test; the trace check failing on one deliberately untagged rule and then passing; the Combat pilot's ID count recorded and §A2.5 re-derived | 6–9 | 3–5 h (play, decisions, release call) |
| T2 | **Rules by TDD** | `:rules` in dependency order — types and data, rng, relics, battle, the run generator and machine, policies — each ID with its test first; the golden tests | §A3.3 on the JVM; trace 100 % for R-IDs; Kover ≥ 95 % and Pitest ≥ 80 % scored without the golden suite (Pitest advisory until wired) | 10–14 | — |
| T3 | **Simulator** | `:sim` with every flag `sim/run.mjs` parses (`--runs`, `--battles`, `--n`, `--fixture`, `--policy`, `--seed`, `--spd`, `--vault`, `--json`, `--dump`, `--selfcheck`), `balanceCheck` | The seed-1 5 000-run `balanced` ladder **equal** to the recorded one; the Kotlin sim becomes the oracle and regenerates `oracle/` | 2–3 | — |
| T4 | **Assets** | `:tools intake` with the EMBER parity test; `export.mjs` here (planes, `look.json`, sfx); the manifests; `assetLint`; the placeholder generator | Intake parity; 36 plane images and 6 `look.json` files; 24 clips heard; every registered actor validated | 3–4 | 20 min (sounds) |
| T5 | **Engine** | Loop, scale, input + hit regions, fonts, bitmap draw, the light rig (maps, fog, motes, shafts, sky, bloom, tiers, the deterministic render mode), particles + VFX, juice, audio player, storage with the decision-log save | The recomposition test per tier; a lit battle frame's rig contribution within 1.5 L at every seat with the planted sprite; a KO frame; hit-region and tier tests green; the iOS golden leg promoted to gating; a run saved and resumed mid-battle in a flow test | 8–11 | — |
| T6 | **Screens and the whole run** | Every screen; the run adapter; layout and flow tests; the eleven run scripts three ways; screenshot fixtures under the deterministic mode | All scripts pass three ways on desktop; iOS simulator nightly green; every static screen approved by the critic; the full-frame critic scores no axis lower than 8 · 8 · 8 · 8 · 7 | 8–12 | — |
| T7 | **Devices and stores** (the enrolment starts at T0) | Apple Developer enrolment and App Store Connect record; `PrivacyInfo.xcprivacy`; export compliance; Google Play account, app record, the **closed-testing requirement for new personal accounts** (a continuous 14-day test with a minimum tester count — verify the current number at enrolment); age-rating questionnaires; the privacy policy URL; store listings and screenshots from `:tools capture`; signed builds on TestFlight and the internal track; on-device perf histograms | A full run on both phones by the owner; perf within budget; the brother installed on both | 3–5 | 4–8 h + waiting |
| T8 | **Cut-over** | Appendix C signed; `ts-final` here; README pointers; the Wasm build on Pages if it passed, else a landing page; the Wasm golden leg gating | Owner sign-off | 1 | 1 h |
| T9 | **Characters** (§B1) — sized after the brief | Design rounds → IDs → scenarios → data → balance re-baseline → assets → screens | The gates T2–T6 inherit; a deliberate oracle re-baseline recorded like a Balance state | — | — |
| T10 | **PvP** (§B4) — sized after the brief | Its own design rounds; `:server`; accounts; a PvP policy in `:sim` | — | — | — |

T2 ∥ T4; T5 needs T0 and T4; T6 needs T2 and T5. Totals for T0–T8: **41–63 agent-session
days** plus the owner's part (§0.1). AI asset generation (§B2) runs from T0 and is the
long pole for T7.

## A11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Compose cannot carry the full bloom chain at budget on a mid-range phone | Medium | T0a proves the path, T0b measures it; tier fallbacks; the Skiko-direct fallback |
| Cross-target numeric divergence | Low after the pre-flight (no `pow`, canonical encoder, no hash order) | The T0a probe; golden legs per §A3.3; never a tolerance |
| Compose for Web not ready at T8 | High | Secondary target; the TS build keeps the URL |
| The rig looks different on Skia (blur kernels, compositing precision) | Medium | Planes are exported; maps computed from the same data; per-target blur constants; the recomposition test; the critic |
| Asset generation stalls (182 frames, critic rounds, owner-side) | High | Starts at T0; placeholders keep T5–T6 unblocked; the launch-content policy (§B2.3) lets acts ship as they complete |
| The rule-ID sweep is a session of its own and finds contract gaps | Certain | Pre-flight 9 is a scheduled repair pass with a blind check; the Combat pilot sizes the rest |
| Gradle's loop is slower than Vite's | Certain | Caches, small modules, `:rules:jvmTest` as the inner loop, hot reload on desktop |
| Model-written Kotlin drifts toward over-abstraction | Medium | `explicitApi`, complexity limits, Konsist naming, no DI, blind review |
| Functional scope creeps into the port | Medium | Principle 1; the oracle fails loudly; §B0's options |
| Store lead times and policies (enrolment, Play's closed test, privacy manifests) | Certain | T7 starts at T0; signing in CI from T1 |
| Saved runs invalidated by an update | Certain, by design | `rulesVersion` + abandon-with-message (§A7.5); the Vault migrates forward and is never reset |
| Screenshot tests flake | Certain without it | The deterministic render mode is a T5 deliverable; static screens only until then |
| Mutation tooling for KMP (wiring, licence) | Medium | Advisory until proved in T1; the plain-Pitest fallback with a lower threshold, stated in the gate report |
| The two players' web Vaults do not migrate | Certain | Optional export code (§B3.5) |

## A12. Decisions needed from the owner (technical)

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| 1 | Confirm Compose Multiplatform after T0 | Confirm unless T0b misses the budget on both phones | end of T0 |
| 2 | Repository: new and **public** vs private | New, public (free CI; the generated assets are visible — if that is unwanted, private and paid macOS minutes) | before T1 |
| 3 | Minimums: Android API 29 with LOW on 29–30, or API 31 | API 29 (≈ 95 % of active Android devices; API 31 ≈ 85–90 %, verify at T0) with LOW on 29–30 | before T0a |
| 4 | Web: keep the TS build on Pages until the Wasm build passes Appendix C, or drop web | Keep | before T2 |
| 5 | Generator port shape: the two-way suspension builder (recommended) or a hand-written state machine | The builder, proved in T1 | T1 |
| 6 | `rulesVersion` mismatch: abandon the run with a message (recommended) or attempt a drifted replay | Abandon | T5 |
| 7 | Package name / app id | `com.patakil.emberquest` — a one-way door once a store listing exists | before T7's app records (start of T0) |
| 8 | Screenshot tooling per target | Desktop `ImageComposeScene` + Android Roborazzi gating; iOS nightly XCTest snapshots only if cheap | T5 |
| 9 | Save-file policy for the Vault across updates | Forward migrations, never reset (P19's rule) | T5 |
| 10 | Devices and Mac: which two phones; is there a Mac (local iPhone runs) or CI-only (TestFlight is the only way to a device) | Name them now | before T0 |
| 11 | Mutation testing: the arcmutate Kotlin plugin (free for public open-source projects at the time of writing; paid otherwise) or plain Pitest with a curated mutator set and a lower threshold | The plugin if the repository is public | T1 |
| 12 | Crash reporting | None at launch (no data leaves the device); revisit with PvP | T7 |

Player-visible decisions (the CRT/ARCADE toggle, the HUD font, orientation, the
Capacitor bridge, the web fast lane, telemetry, monetisation) are in **§B6**.

---

# Part B — Functional

## B0. Scope rule, and where the character brief lands

During the port nothing changes for the player except what the platform demands (§B3).
Functional changes are designed through `designing-mechanics` into DESIGN.md with IDs,
specified in `:specs`, tuned in `:sim`, and built after the phase that makes them safe.
The character brief, which the owner will send once this plan is final, has three
possible homes; the owner picks one (§0.2 #3):

| Option | Where | Cost | Wait |
|---|---|---|---|
| **(a) In the TS build, before the tag** | This repository, through the existing loop (design rounds, sim, kit or bitmap art) | Delays T1 by the brief's design and balance rounds; no oracle re-baseline; the art still comes through the bitmap pipeline | Shortest wait for the rules; the art arrives whenever the frames do |
| (b) In Kotlin after T3 | The new repository, under the new specs and gates | One deliberate oracle re-baseline (recorded like a Balance state); the TS repository stays the reference for the rules until T3 only | After T3 (≈ the first third of the port) |
| (c) After T8 | The new repository, as T9 | No port risk; the port is measured against an unchanged game | Longest |

Recommendation: **(a) if the brief is ready before T1 starts and adds no new mechanic
kind** (a new stat, status or room type would need the contract and the policies first);
otherwise **(b)**, since a rules-only change lands in Kotlin under the very machinery the
port exists to build.

## B1. Characters — placeholder for the owner's brief

What is known: six characters at launch, kits in DESIGN.md's Characters table, growing
toward twelve; each has three skills, one awakening (a stat bonus or an upgraded skill),
one leader skill; the draft is one of the roster plus SUMMONs; all six are unlocked.

What a character change touches, so the brief can be sized:

| Layer | Item |
|---|---|
| Contract | The roster table, `SkillId`, awakening and leader rows, any new `StatusKind` (which needs a source and a rule), the difficulty targets (every character must lead in ≥ 5 % of some policy's wins) |
| Specs | New IDs and scenarios; run scripts where the draft changes; the awakening-bonus order scenario if a stat-bonus awakening appears (§A3.2) |
| Rules | `data/skills`, `data/characters`, `validateData`; a new mechanic means a `Policy` method and one line per archetype |
| Balance | The ladder re-measured and re-baselined; the Balance state rewritten and dated |
| Assets | Seven bitmap frames per new character, a portrait, a VFX family per new skill archetype, a sound if a new family |
| UI | The draft grid (12 today; more than twelve changes the layout), INSPECT rows |

The brief should answer: how many characters; whether existing kits change; whether an
element or role is added; whether the draft rule changes; whether unlocks return.

## B2. AI-generated images for characters and enemies

### B2.1 The decision as it stands

Option C (2026-09-09): every actor is an image-model sprite used as a bitmap at its
on-screen size, generated on the owner's side from one master per character with the
prompts in `.claude/prompts/bitmap-pipeline.md` and `tools/in/README.md`, keyed and shrunk
by the intake, judged in frame by a blind critic, regenerated on failure and never
hand-edited. Stage 0 is built here (EMBER's idle 0 is on the stage); stages 1–4 remain and
are the same in the KMP world, with the intake and the instruments moving to `:tools` at
T4. EMBER's accepted master was generated with GPT Image (commit `37096f2`).

### B2.2 The asset inventory

183 frames, 1 done, **182 to generate**: heroes and bosses 7 each (idle ×2, attack ×2,
cast, hurt, dead), elites 4 (idle, attack, hurt, dead), normals 3 (idle, attack, hurt).
Sources under `tools/in/<ID>/` here until T4, then `assets/src/actors/<ID>/` in the new
repository; shrunk sprites under `assets/actors/<id>/`.

### B2.3 Launch content and the pose fallback

DESIGN.md's `POSE_FALLBACK` (attack → idle, cast → attack, hurt → idle, dead → hurt sunk
and faded) is contract and is **kept**: a partially generated actor is playable. What the
port adds is a **release policy**, not a rule: `assetLint` requires `idle-0` for every
actor in the shipped acts, reports every actor running on fallbacks, and fails a release
build if a placeholder silhouette (§A8.4) is present. The owner sets `launchActs` in the
game config; a run ends at the last shipped act's doors until the next act is complete.
Recommendation: ship an act when every actor in it has idle, attack and hurt, and heroes
and bosses have their full sets; acts 1–2 (19 actors, 90 frames remaining) first.

### B2.4 Decisions for this item

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| 1 | **Rights and tooling** — which image model, and its terms for shipping outputs in a store binary | Continue with the model that produced the accepted master; read its current commercial-use clause, quote it into the style bible (#5) with the date. Candidates at writing: GPT Image (terms grant ownership of outputs to the user), Google's Imagen/Gemini image models, Midjourney (commercial rights on paid plans, with a revenue threshold), Flux (licence varies by variant; the open-weights *dev* variant is non-commercial). **Verify at generation time; this decision voids frames if wrong** | before generating (now) |
| 2 | Portraits for the ribbon and INSPECT | Cropped from the masters by the intake | T4 |
| 3 | Backdrops: keep the exported planes, or regenerate painted planes per biome | Keep for parity. Regeneration is the only fix for the scene residuals the export freezes (value-plateau light wells, the bright mass in the ceiling, one hue per biome, FAR arches blurred at HIGH) — schedule it as a dated functional item after T8 | T4 (export) / after T8 (regeneration) |
| 4 | VFX: procedural as data, or generated flipbooks | Procedural | T5 |
| 5 | A style bible page in the new repository: the master prompt, the accepted masters, the rights clause | Yes, at T1 | T1 |
| 6 | Launch content policy (#B2.3) | As recommended there | T6 |

### B2.5 Acceptance

The critic loop as recorded in ART-REVIEW.md, on the new frames and **fresh** (never
against the kit's frames): one character moves (stage 1); six silhouettes distinct on the
sheet and in frame (stage 2); the enemy ranks at their class heights against the party
(stage 3); the full-frame critic's five axes at ≥ 8 (stage 4). Instruments: `:tools
capture`, `seats`, `metrics`, `artMetrics`.

## B3. What a mobile app must do that the web game does not

Functional because the player sees them; scheduled inside T5–T7 because the platform
demands them. Each becomes IDs under a *Persistence* or *App* area.

1. **Resume a run.** A run survives the app being killed, a call, a reboot: the title
   offers CONTINUE when `run.json` exists and resumes at the open decision — mid-battle at
   the current turn. Abandoning from PAUSE is a retreat. An app update that changes the
   rules abandons the run with a message; the Vault always survives (§A7.5).
2. **Orientation and safe areas.** Landscape locked; the frame respects the notch and the
   home indicator through the platform insets.
3. **System navigation.** Android back = B everywhere, with a confirm on the battle screen
   (a retreat is a death); the iOS edge gesture is not intercepted.
4. **Settings.** Volume and mute; haptics on hits (default on where supported); the
   quality tier; reduce-motion honoured (no shake, no flash when the OS asks).
5. **The web Vault.** Optional: an export code on the web build the app can paste once.
   Not on the critical path.
6. **App identity.** Icon, splash (the title's own logo), store screenshots from `:tools
   capture` at device resolutions.
7. **Accessibility.** OS font scale is honoured by the HUD text within the plates' room
   (the layout constants define a maximum); every status and element cue is readable
   without colour (the pictograms already exist); reduce-motion; a canvas game has no
   screen-reader story and the listing says so honestly.
8. **Data and store compliance.** A privacy policy URL (both stores require one even for
   "no data collected"); the data-safety and privacy questionnaires; the age-rating
   questionnaire including the loot declaration (no real-money purchases, nothing random
   is bought); **free, no ads, no in-app purchases** stated as the product decision.
9. **Save compatibility.** `vault.json` migrates forward on every schema change and is
   never reset by an update; only `run.json` can be abandoned (rule `R-PERSIST-02`).
10. **Notifications.** None at launch; revisited with PvP (asynchronous PvP makes push a
    requirement with real infrastructure).
11. **Localisation.** English only, stated; store listings in English.

## B4. PvP — placeholder for the owner's brief

What the technical plan reserves so the brief lands on a ready floor:

- **Server-side rules.** `:rules` compiles to the JVM; `:server` (Ktor) is reserved in the
  module table with no code until T10. A server-authoritative model needs no second
  implementation of the rules.
- **Determinism and decision logs.** A battle is (config, seed, decisions). An
  asynchronous mode needs no real-time networking; a live mode is a decision exchange with
  a server-issued seed.
- **An inventory, not an abstraction.** Several rules are hero-only or enemy-only —
  enemies wear no sets (A10's WILL excepted), FOCUS aims at the leader, INVINCIBLE is
  enemy-only, REVENGE counters are heroes-only. The port keeps them exactly and does
  **not** pre-abstract them (principle 7); instead DESIGN.md's ID sweep produces the list
  of asymmetric rules by ID, so the PvP brief can decide per rule.
- **Serialization.** Every state and decision is `@Serializable` from T2.
- **Questions for the brief.** Synchronous or asynchronous; parties from the Vault or a
  fresh draft; what the enemy side is when both sides are heroes; rewards and the Vault;
  accounts and identity (Game Center / Play Games sign-in versus an own service); fairness
  under ascension and Vault relics; cheating (server authority answers most of it);
  balance targets for a two-party fight (a PvP policy in `:sim`); push notifications and
  their infrastructure.

## B5. Order of functional work

1. §B2.4 #1 (rights) — **now, before a single frame is generated**.
2. B2 (assets) — from T0, owner-side, parallel to the port.
3. B3 (mobile behaviours) — inside T5–T7.
4. B1 (characters) — per the option chosen in §B0.
5. B4 (PvP) — after B1, with its own design rounds and `:server`.

## B6. Player-visible decisions the port raises

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| 1 | The CRT/ARCADE toggle | Defer the CRT. DESIGN.md is edited in the same milestone: a phone starts at the tier T0b measured (not ARCADE), and the PAUSE overlay's third button becomes QUALITY (cycles HIGH / MED / LOW) so the geometry (three 400×96 buttons) is unchanged | T5 |
| 2 | The HUD font | A bundled open-licence sans (identical on every platform) rather than the platform's | T5 |
| 3 | Orientation | Landscape only, as today; a portrait layout is a later functional item | T5 |
| 4 | The Capacitor bridge — a store build of the TS game now | No, unless the brother should get store builds during the port; it costs ~2 days and is thrown away at T8 | before T1 |
| 5 | The web fast lane — keep releasing balance changes to the web build during the port | Yes while the TS build serves the URL; after T8 a balance change is a store release on both platforms, which is the main release-cadence loss of the move. The data tables are `@Serializable` from T2 so a bundled-JSON or signed remote-config path stays possible when PvP's server exists | T3 |
| 6 | Opt-in telemetry (run outcomes, act reached) so balance has human data | No at launch; ask again with PvP | T7 |
| 7 | Monetisation | Free, no ads, no purchases, stated in the listings | T7 |
| 8 | Store identity | Individual accounts publish the owner's legal name on the listing; a company identity needs a D-U-N-S number and weeks | start of T0 |

---

## C. What a change costs afterwards

Principle 7 is only true if a change is cheap. Two worked examples, in the new repository:

**Changing `GLANCE_MULT` 0.70 → 0.65** (a number in the contract).
1. DESIGN.md: the Elements table cell and its ID's text (one line).
2. `specs/features/elements.feature`: the scenarios that assert a glance's damage —
   expected values updated (two or three numbers).
3. `:rules.types`: the constant.
4. `:sim`: `balanceCheck` fails by design; run the ladder, record the new Balance state,
   regenerate `oracle/` (one command each).
5. `gate` green; two commits (`test`, `impl`); one blind verifier.
Files touched: 4. Time: one short session. Nothing else moves — no screen, no asset.

**Adding one character** (the B1 shape).
1. Design round → DESIGN.md rows and IDs (roster, three skills, awakening, leader).
2. Scenarios for each skill's draw order and each status it applies; a run-script update if
   the draft grid changes.
3. `data/skills`, `data/characters`; `validateData` passes; policies unchanged unless a
   new mechanic kind.
4. Ladder re-measured; every-character-leads-≥ 5 % checked; Balance state rewritten;
   `oracle/` regenerated.
5. Seven frames through intake and the critic; a portrait; a VFX recipe per new
   archetype.
6. INSPECT rows and the draft grid if it passes twelve.
Files touched: ≈ 10 plus assets. Time: two or three sessions plus the owner's generation.
The part that is not cheap is the art, and that is the same in both codebases.

---

## Appendix A — File-by-file mapping

| TS | Kotlin | Phase |
|---|---|---|
| `game/types.ts` | `:rules` `types/` | T2 |
| `game/data/*.ts` | `:rules` `data/` one file each + `Validate.kt` | T2 |
| `game/sim/rng.ts` | `:rules` `rng/` | T1 (mulberry32), T2 |
| `game/sim/relics.ts` | `:rules` `relics/` | T2 |
| `game/sim/battle.ts` | `:rules` `battle/` (incl. `BattleTurns.kt`, `Fixtures.kt`) | T2 |
| `game/sim/run.ts`, `runstep.ts` | `:rules` `run/` (`Generator.kt` — the two-way builder, `Steps.kt`, `Map.kt`, `Rooms.kt`, `Vault.kt`, `Policies.kt`, `RunMachine.kt`, `Answers.kt`) | T1 (builder), T2 |
| `sim/run.mjs` | `:sim` | T3 |
| `tools/intake.mjs` (bitmap mode) | `:tools` `Intake.kt` | T4 |
| `engine/light.ts`, `game/art/backdrops.ts` | `tools/export.mjs` here → `assets/biomes/**`; `:engine` `light/` (`Rig.kt`, `Maps.kt`, `Fog.kt`, `Motes.kt`, `Bloom.kt`, `Tiers.kt`, `Pools.kt`) | T4, T5 |
| `engine/audio.ts` | `tools/export.mjs sfx` → `assets/sfx/**`; `:engine` `audio/` expect/actual | T4, T5 |
| `engine/loop.ts`, `input.ts`, `draw.ts`, `ui.ts`, `juice.ts`, `particles.ts`, `palette.ts`, `scenes.ts` | `:engine` `loop/`, `input/`, `draw/`, `ui/`, `juice/`, `particles/`, `Palette.kt`, `Scenes.kt` | T5 |
| `game/art/vfx.ts` | `:engine` `particles/Vfx.kt` + `:game` `art/VfxRecipes.kt` | T5 |
| `game/art/bitmap/*` | `:game` `art/BitmapActors.kt` (generated), `art/Bitmaps.kt` | T4 |
| `game/screens/*.ts`, `game/main.ts` | `:game` `screens/*Screen.kt`, `Layout.kt`, `RunAdapter.kt`, `Boot.kt` | T6 |
| `tools/capture.mjs`, `seats.mjs`, `probe.mjs`, `lineup/vfx/backdrops/screens` pages | `:tools` `Capture.kt`, `Seats.kt`, `Metrics.kt`, `Perf.kt`; desktop fixture screens | T5–T6 |
| `smoke.mjs` | Boot tests per app | T1, T6 |
| `.github/workflows/pages.yml` | `ci.yml`, `nightly.yml`, `release.yml` | T1 |
| `.claude/*` | `.claude/*` per the table in §A9 | T1 |

## Appendix B — Commands (new repository)

```
./gradlew gate                                      # §A6.3; writes build/reports/gate/index.md
./gradlew :rules:jvmTest                            # the inner loop
./gradlew :specs:test specTrace                     # the specs and the trace report
./gradlew :sim:run --args="--runs 5000 --policy balanced --seed 1"
./gradlew :sim:run --args="--dump --runs 2000"      # regenerate oracle/ (T3 onward)
./gradlew :tools:run --args="intake assets/src/actors/GALE/attack-0.png id=GALE pose=attack frame=0 class=hero"
./gradlew :tools:run --args="capture battle seed=1" # also: seats measure · metrics · perf
./gradlew :app:desktop:run                          # the game, hot-reloading
```

## Appendix C — The parity checklist (signed at T8)

- [ ] Every oracle file matches on JVM, iosSimulatorArm64 and wasmJs (§A3.3).
- [ ] The seed-1 5 000-run `balanced` ladder equals the recorded Balance state exactly
      (or a deliberate re-baseline is recorded and dated).
- [ ] All eleven run scripts pass three ways on desktop and on the iOS simulator.
- [ ] Every static screen has a critic-approved screenshot on desktop; battle, cards, map
      and Vault on Android; iOS screenshots only if §A12 #8 adopted them.
- [ ] Scene parity with the planted reference sprite: rig contribution within 1.5 L per
      seat, seat spread ≤ 5 L, ground strips within 1.5 L, on seeds 1, 4, 12, 16, 20 and the
      marsh; the recomposition test green per tier.
- [ ] Full-frame critic: no axis below 8 · 8 · 8 · 8 · 7 (composition stays an open item).
- [ ] Actors judged fresh under §B2.5 for every shipped act; no placeholder in the
      release build.
- [ ] 24 sounds present and heard by the owner.
- [ ] Vault persists across restarts and migrates forward; a run resumes mid-battle after
      a force-kill; a `rulesVersion` mismatch abandons the run with a message.
- [ ] Frame budget met on both reference phones (§A7.7); one biome's assets within the
      memory budget.
- [ ] Keyboard parity on desktop; back = B on Android; insets honoured on a notched
      phone; reduce-motion honoured.
- [ ] DESIGN.md's ARCADE rules edited per §B6.1; CLAUDE.md, the skills and the IDs
      current; `gate` green on `main` with no SKIPPED row.

## Appendix D — Glossary

**Oracle** — the TS simulator's recorded outputs the Kotlin rules must reproduce.
**Golden test** — a test against a recorded oracle file. **Canonical encoder** — the byte
form both sides hash. **Scripted rng** — an `Rng` that returns a fixed sequence and counts
draws. **Rule ID** — the `[R-AREA-nn]` / `[P-…]` / `[T-nn]` anchor on a DESIGN.md
statement. **Trace** — the ID ↔ proof matrix. **Run script** — a recorded decision log
with its end state. **Gate** — `./gradlew gate`. **Parity** — Appendix C. **Tier** —
HIGH / MED / LOW quality levels of the light rig. **Seat ruler** — the in-scene value
instrument. **Planted sprite** — one reference sprite drawn at every seat so the rig, not
the art, is measured.

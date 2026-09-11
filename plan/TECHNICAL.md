# Technical plan — how it is built

The engineering half of the plan. It fixes the platforms and the architecture, the
toolchain, how the rules are ported against the oracle, how the team (one owner, many
agents) practises TDD, how the specification becomes executable, which static analysis
runs where, how the stage is rendered inside a phone's frame budget, how the AI image
pipeline works, how saves and releases work, how agents work in the new repository, and
the phase sequence. The verification loop that ties it together has its own document,
`VERIFICATION.md`; the player-facing scope is `FUNCTIONAL.md`.

Versions quoted are what was current when this was written (2026-09-11) and are pinned
again at P1; every claim about a tool's capability that the plan depends on is a P0/P1
spike, listed in § T14.

## T1 Platforms and product shape

| Target | Role | Minimum | Notes |
|---|---|---|---|
| Android | product | minSdk 26 (Android 8.0), target the current SDK | one activity hosting Compose; sensor-landscape; immersive |
| iOS | product | iOS 16.0 | `iosApp/` Xcode project with a Swift entry point hosting `ComposeUIViewController`; no other Swift |
| Desktop JVM | development and agent platform | JDK 21 | macOS, Windows, Linux; not a store product; where every fast lane runs and every pixel-exact frame is captured |
| Web (wasmJs) | stretch (P9) | browsers with WasmGC — all major engines since December 2024 | Compose for Web is beta as of this writing; the TypeScript build keeps the Pages URL until the Wasm build passes the same gates |

Reference devices (the perf lane's truth): one 2022 mid-range Android (Pixel 6a or Galaxy
A53 class) and one iPhone 12 class, plus the owner's own phones. The frame budget in
§ T9.5 is measured on those, never on a desktop.

## T2 Architecture

### T2.1 Modules

```
kmp/
├── build-logic/           convention plugins: kmp-library, compose-library, quality (every analyser), spec-binder
├── core/                  :core          the rules — commonMain, ZERO dependencies (stdlib only)
├── core-testing/          :core-testing  builders, fakes, trace readers and writers for tests
├── engine/                :engine        the presentation kernel (Compose): frame, input parity, stage renderer, light rig,
│                                          particles, juice, bitmap fonts, the audio player interface
├── ui/                    :ui            screens, art recipes and atlases, VFX, HUD, the layout ruler (Compose; uses :core + :engine)
├── sim/                   :sim           the balance harness (JVM CLI): Monte Carlo, traces, self-check, gates, JSON
├── tools/instruments/     :tools:instruments  shot · storyboard · sheets · frames · metrics · the review bundle (JVM)
├── tools/art/             :tools:art     provider adapters · normalise · the gate · manifests · contact sheets (JVM)
├── tools/audio/           :tools:audio   the synthesizer → WAV (JVM)
├── app/android/  app/ios/  app/desktop/  app/web/   thin shells
├── iosApp/                the Xcode project
├── spec/                  the executable specification: clauses, tables, goldens
├── assets/                source assets and manifests: actors, portraits, backdrops, fonts, sfx
├── ci/                    the lane scripts and their timing ledger
└── CLAUDE.md              the agents' conventions for this tree
```

**Allowed dependency edges** (everything else is forbidden and checked three ways: Gradle
declares only these, a `build-logic` task asserts `:core`'s main configurations resolve to
nothing but the standard library, and Konsist tests check imports per module):

| Module | May depend on | May never import |
|---|---|---|
| `:core` | Kotlin stdlib | `kotlinx.*`, `androidx.*`, `java.*` beyond what stdlib maps, `android.*`, `platform.*`, any logger, any clock, `kotlin.random` |
| `:core-testing` | `:core`, Kotest | platform |
| `:engine` | Compose, Skiko on non-Android source sets | `:core`, `:ui` |
| `:ui` | `:core`, `:engine`, Compose, compose-resources | platform APIs except through `:engine`'s `expect` surface |
| `:sim` | `:core`, `:core-testing`, kotlinx-serialization-json, a CLI parser | Compose |
| `:tools:*` | `:core`, `:ui` (instruments only), `:engine`, JVM libraries | — |
| `:app:*` | `:ui`, `:engine`, `:core`, the platform | nothing network-facing until PvP (a Konsist rule) |

`:core` compiles for jvm, android (the KMP Android library plugin), iosArm64,
iosSimulatorArm64 and wasmJs. `:engine` and `:ui` compile for the same set. Everything under
`:tools` and `:sim` is JVM only.

### T2.2 The rules core, package by package

`types` (every closed union and constant of `game/types.ts`, as sealed interfaces, enums
and `const val`s) · `data` (SKILLS, CHARACTERS, ENEMIES and BIOMES, RELICS' tables, SETS,
SIGILS, PACTS, ASCENSION, `validateData()`) · `rng` (`pick`, `uniformInt`, `weighted`,
`chance`, `withoutReplacement`, `mulberry32`) · `relics` (rolling, levels, forge, sets,
`derive`, `compare`) · `battle` (ATB, the turn, damage, statuses, AI, `intent`,
`simulateBattle`, the interactive API and the event stream) · `run` (the map, rooms, loot,
laps, the Vault as data, the policies, `simulateRun`, `runSteps`) · `session` (the
interactive seam) · `codec` (the canonical text encodings of configs, results, traces and
decision logs — hand-written, so `:core` needs no serialization library; JSON for external
tools lives in `:sim`).

The closed unions stay closed: a sealed interface per union, `when` without `else`, so a
new kind fails the build until every interpreter handles it — the same guarantee the
exhaustive `Record` checks give today.

### T2.3 The seam

The TypeScript seam is a generator: `runSteps` yields a `RunPending`, receives an answer,
continues. Kotlin's `sequence {}` cannot receive a value, so `RunSession` is built on the
standard library's coroutine intrinsics — no kotlinx dependency, no dispatcher, no thread:

```kotlin
class RunSession(config: RunConfig, rng: Rng) : Run {
    private var next: Continuation<Any?>? = null
    private var pending: RunPending? = null
    private var result: RunResult? = null
    private var token = 0
    private var busy = false

    private suspend fun ask(p: RunPending): Any? = suspendCoroutineUninterceptedOrReturn { c ->
        pending = p; next = c; COROUTINE_SUSPENDED
    }
    init {
        val body: suspend () -> RunResult = { runSteps(config, rng, ::ask) }
        body.createCoroutineUnintercepted(Continuation(EmptyCoroutineContext) { result = it.getOrThrow(); pending = null })
            .resume(Unit)
        token = 1
    }
    override fun decide(answer: Any?, expected: Int?): Boolean {
        if (busy || pending == null || (expected != null && expected != token)) return false
        val c = next ?: return false
        busy = true
        try { next = null; c.resume(answer); token += 1 } finally { busy = false }
        return true
    }
    // state() / pending() / token() / result() as today; the view is built at most once per token
}
```

`runSteps` becomes a `suspend` function whose only suspension point is `ask`; everything
resumes synchronously inside `decide`, so an answer either lands before `decide` returns or
is refused. The three-way self-check (`simulateRun` vs `runSteps` with `answerWith` vs
`RunSession.decide`) is ported as a test and stays in the harness.

### T2.4 The presentation model

As today: the phase is derived, never stored — `phase = session.pending()?.kind ?: ROOM` —
and one `when` in `:ui`'s `RunHost` composable maps each pending to its screen, hands the
screen a `RunView` and a `decide(answer, token)` callback, and nothing else. No navigation
library: the run *is* the navigation. Screens are composables over a state object built
from the view (`ScreenState`), which is what the screen tests construct directly from
fixtures. PAUSE, INSPECT, ARCADE and settings are overlays owned by `RunHost`.

The stage (the diorama, the actors, the light, the VFX, the pops) is one `Canvas`
composable, `Stage`, that draws in painter's order onto Skia through `DrawScope`; the HUD
plates, panels, ribbon, command list, cards, map, party columns and every button are
composables placed in the logical 1280×720 space (§ T9.1). Every tap target is a semantics
node with a test tag and a logical rect, so the drivers can tap by tag *or* by contract
geometry, and keyboard focus is one model for both (§ T9.9).

### T2.5 The engine mapping

| `engine/*.ts` today | In Kotlin |
|---|---|
| `loop.ts` fixed-step accumulator, focus clamp, auto-pause | `withFrameNanos` driving a fixed 60 Hz accumulator with the same 250 ms clamp; lifecycle pause from the shells; the clock is injected so tests own time |
| `input.ts` keys, pointer, hit regions, spatial focus | Compose pointer and key events → the same button model (A = Space/Z, B = X/C, PAUSE = P/Esc, digits for skills); the region registry ported (drawn-first two-pass test, `TAP_MIN` 96 expansion, twins, the ±50° cone) as `Focusables`, over semantics nodes for UI and over stage rects for actors |
| `scenes.ts` | a sealed `Scene` with the same enforced transitions |
| `draw.ts` sprites, bitmap fonts, bake, dither, bevel | `ImageBitmap` atlases baked once; `drawImage` with `FilterQuality.None`; glyph atlases baked from the exported glyph tables; the HUD face through `TextMeasurer` with one bundled font |
| `palette.ts` | the same tables and `contrast()` |
| `particles.ts`, `juice.ts` | ported as pure Kotlin over a pooled array; shake rounds to whole logical px; flash and hit-stop as today |
| `audio.ts` | the synthesizer ported as a pure function in `:tools:audio` and run at build time to WAV; `SfxPlayer` (`expect`) plays clips with pitch and gain; cooldowns per name in common code (D12) |
| `ui.ts` safe inset, plates, dim | the mutable inset fed by the platform's insets; plates and dim as composables and draw helpers |
| `light.ts` | the rig in `:engine`: planes baked once per (biome, tier) with a CPU blur, the light map and grade baked, per-actor gain as a `ColorDodge` sprite, rim spill `Plus`, contact shadows from a cached gradient, the vignette in the grade, the sky body after the grade, the tiers and `note(frameMs)` (§ T9) |
| `crt.ts` | scanlines, vignette and flicker as overlays; halation from the bloom buffer (§ T9.4) |
| `runtime.ts` | dropped — there is no host |

## T3 Toolchain and versions

| Tool | Pinned at writing | Role | Notes |
|---|---|---|---|
| Kotlin | 2.4.20 (2.4.0 brought stable context parameters and explicit backing fields) | language and KMP | K2; `-Xexplicit-api=strict` on `:core`, `:engine`, `:ui`; `allWarningsAsErrors` everywhere |
| Compose Multiplatform | 1.12.0 | UI, stage, resources, previews, tests, hot reload | 1.10 made `@Preview` common and Hot Reload stable; 1.11 shipped the v2 UI-test APIs; 1.12 added an MCP server to Hot Reload for agents |
| Gradle | 9.x (the current 9 at P1; detekt 2's alphas build against 9.6) | build | configuration cache and build cache on; `--warning-mode=fail` |
| Android Gradle Plugin | 9.3 | Android target and app | the KMP Android library plugin (`com.android.kotlin.multiplatform.library`) for `:core`, `:engine`, `:ui` |
| JDK | 21 LTS | toolchain | Gradle toolchains pin it |
| Kotest | 6.x | tests on every target, property testing | the multiplatform plugin for native and Wasm; annotation config is JVM-only, so configuration is by code |
| detekt | 1.23.x stable, 2.0 when it leaves alpha | smells, complexity, custom purity rules, Compose rules | if 1.x cannot parse the Kotlin 2.4 syntax `:core` uses, pin the 2.0 alpha in P1 rather than forgo the tool |
| ktlint via Spotless | current | formatting, auto-fixed | detekt's formatting rules stay off to avoid double reports |
| Konsist | 0.17.x | architecture tests | runs as JVM tests over the source tree |
| KGP ABI validation | in Kotlin 2.2+ (experimental DSL) | the public API of `:core` and `:engine` as a reviewed dump | `checkKotlinAbi` in the lane; the standalone validator is frozen upstream |
| Kover | current | coverage with thresholds | JVM-measured for common code |
| Pitest | current (JVM) | mutation testing of `:core` nightly | P1 spike; if it will not run on the KMP JVM target, the plan falls back to property tests and the oracle (§ T6.5) |
| Roborazzi | current | screenshot goldens on desktop and iOS | Compose Desktop is supported; iOS is experimental — desktop goldens are the gate, iOS goldens are informative until stable |
| Compose Hot Reload | 1.2 | live loop on desktop; MCP for agents | not a gate; an instrument (`VERIFICATION.md` § V3) |
| dependency-analysis plugin | current | unused and undeclared dependencies (`buildHealth`) | fails the merge lane |
| Android Lint | AGP's | Android app and library checks | fatal on a chosen set, no baseline |
| Maestro | current | device flows on emulator and simulator | nightly |
| actionlint, shellcheck, markdownlint, a custom spec-lint | current | workflows, scripts, documents, the spec | fast lane |
| Renovate | — | weekly dependency PRs, one tool per PR, through the full lanes | the catalog is the single source of versions |

Upgrade policy: one tool per PR; the full merge lane must pass; a tool that breaks on a
Kotlin upgrade blocks that upgrade until fixed, replaced or, with the owner's sign-off,
removed together with a replacement for its catch.

## T4 Repository and migration mechanics

### T4.1 During the port

The root stays the TypeScript game and keeps its gates. `kmp/` is a self-contained Gradle
project; nothing at the root imports it, and the Pages workflow does not see it.
`.github/workflows/kmp-*.yml` run path-filtered on `kmp/**` and `spec/**`. `kmp/CLAUDE.md`
holds the conventions for the tree (Claude Code loads nested `CLAUDE.md` files when working
under them); the root `CLAUDE.md` gains one line pointing at `plan/` and `kmp/`.

### T4.2 The oracle

`main` is tagged `ts-oracle-v3` at P2. The rules under `game/sim/*`, `game/data/*` and
`game/types.ts` are **never edited again**. The only TypeScript changes the plan allows,
none of them under those paths:

- `sim/run.mjs` gains `--trace` (§ T5.3), recorded from *outside* the rules: the rng is
  injected, so the harness wraps it and logs every draw; `runSteps` and `answerWith` expose
  every pending and answer; `createBattle`/`runTurn` expose the event stream. No rule
  changes, no new field.
- `tools/export-assets.mjs`: every actor's fifteen bakes as PNG with its feet, hit rect and
  size, and every biome's planes, light map and grade per tier as PNG (§ T10.9).
- `game/screens/vault.ts`: the Vault transfer code (`FUNCTIONAL.md` § F2.4), presentation only.
- `engine/draw.ts`: no change; its glyph tables are read by the export tool.

### T4.3 Promotion (P8)

`kmp/*` moves to the root; the TypeScript tree moves to `oracle/` with its lockfile, kept
buildable and runnable (`npm ci && node sim/run.mjs --trace …`) because the differential lane
keeps running against it until the goldens are frozen from the Kotlin harness (§ VERIFICATION
V8). `CLAUDE.md`, `STATUS.md` and the skills are rewritten; `DESIGN.md` becomes the
narrative of `spec/` (§ T7.6).

## T5 The rules port

### T5.1 Order and method

Each module is ported by TDD against the oracle in this order, each one gated before the
next starts: `types` and `data` (a table dump of every data structure from Node compared to
the Kotlin tables; `validateData()` returning `[]`) → `rng` (test vectors: the first 10 000
outputs of `mulberry32(seed)` for seeds 1, 2, 7, 4242, 0xFFFFFFFF as raw bits) → `relics`
(the 60 644-check self-test re-expressed as tests; `rollRelic` traces) → `battle` (event
traces per fixture and policy) → `run` (`RunResult` and pending/answer traces) → `session`
(the three-way self-check) → the policies (their answers are in the traces).

The port is **literal**: the Kotlin follows the TypeScript function by function, expression
by expression, in the same evaluation order, with the file split by section where a
TypeScript file exceeds the size budget (§ T8.3). Cleverness is for after parity.

### T5.2 Numeric fidelity

| TypeScript | Kotlin | Rule |
|---|---|---|
| `number` | `Double` | IEEE 754 binary64 on every target |
| `Math.floor`, `Math.min`, `Math.max` | `floor`, `min`, `max` | never on NaN (a Konsist rule forbids NaN-producing operations in `:core`) |
| `Math.round` | `jsRound(x) = floor(x) + if (x - floor(x) >= 0.5) 1 else 0` | Kotlin's `round` rounds half to even and `roundToInt` differs per platform on ties; `jsRound` is tested against a Node-generated table of 10 000 values including `0.49999999999999994`, `2.5`, `-2.5`, `-0.5` |
| `Math.imul`, `>>> 0`, `\|`, `^` | `Int` multiply (wraps), `toUInt()`, `or`, `xor` | the PRNG's arithmetic |
| `x ** n` with integer `n` (`LAP_MULT.hp ** (lap − 1)`) | a loop of multiplications | no `pow`; libm differs across platforms |
| `a × b × c` | `a * b * c` | verbatim, left to right; never re-associated or simplified |
| `Array.sort` (stable in V8) | `sortedWith` (stable) | the same comparator order |
| `Object.keys` insertion order, `Record` iteration | `LinkedHashMap` or lists in the data's textual order | data order is contract |
| `WeakSet` for OPENER's first-cast gate | a flag on the battle actor | the same observable behaviour |
| `Math.random` | forbidden | the rng is injected; a Konsist rule and a detekt rule both forbid `kotlin.random` and `Random.Default` in `:core` |

A cross-platform determinism test runs 20 seeds × 3 policies × both harness modes on every
target's test task (`jvmTest`, `testDebugUnitTest`, `iosSimulatorArm64Test`, `wasmJsTest`)
and compares the trace hash to a committed expectation. A mismatch on any target is a P3
blocker; the usual cause would be fused multiply-add on ARM or a library function, and the
fix is in the expression, never in the expectation.

### T5.3 The canonical trace

A line-oriented text format written identically by `sim/run.mjs --trace` and `:sim trace`,
hashed with SHA-256; the hash is the parity currency.

```
trace 1
config ascension=0 vaultSlots=0 roster=EMBER,GALE,TIDE,BASALT,SABLE,LUMEN spd=0 seed=7 policy=balanced
draw 0 3fe8b5a2c0000000            # every rng() output as the raw bits of the double, in draw order
pending DRAFT roster=6
answer 2
pending SUMMON offers=GALE,TIDE,LUMEN full=false
answer 0
…
event CAST caster=H0 skill=CINDER targets=E1
event HIT attacker=H0 target=E1 dealt=412 absorb=0 crit=false glance=false killed=false
…
result won=false actReached=3 lap=1 clears=7 actsCleared=2 deathBy=STORM_DRAKE deathKind=WIPE …
result.probe 1 act=1 lap=1 won=true actorTurns=41 …
```

Every field of `RunResult`, `Probe` and `BattleEvent` appears, in the order the TypeScript
types declare them; numbers are printed with a shared exact formatter (integers as
integers, doubles as their shortest round-trip form, which V8 and Kotlin agree on for the
values the rules produce, and as raw bits where a test needs certainty). The `--battles`
mode traces per fixture; the `--runs` mode per policy; `--selfcheck` traces all three
paths. The golden set: seeds {1, 2, 3, 7, 4242} × nine policies × both modes, plus 200 runs
of `balanced` at seed 1 for the balance snapshot.

### T5.4 The harness

`:sim` reproduces `sim/run.mjs` command for command — `--battles`, `--runs`, `--policy`,
`--seed`, `--spd` (numeric and the bare gate), `--vault`, `--json`, `--dump` (now the trace
hash), `--selfcheck` — plus `trace`, `diff-oracle` (runs the TypeScript harness under
`oracle/` and diffs the traces, printing the first divergent line), and `snapshot` (the
Balance state table at the recorded N and seeds, compared to `spec/balance/state.md`).

### T5.5 Balance reproduction

The `DESIGN.md` Balance state table is reproduced to the digit from the same seeds and run
counts before P3 closes; it becomes the first `spec/balance/state.md`, a snapshot test at
reduced N (200 runs, seed 1, `balanced` and `random`) in the commit lane and at full N
nightly. A number moves only with a rule clause change in the same commit.

### T5.6 Public API

`:core` is compiled with explicit API mode; its ABI dump is committed and `checkKotlinAbi`
runs in the module lane. The surface is what `:ui`, `:sim` and the tools need — the same
exports `game/sim/*` has today — and nothing exposes mutable state: results and views are
immutable data classes; the battle's mutable actors live inside `Battle` and are read
through snapshots by the screens, as today's copies are.

## T6 TDD — how the team builds

### T6.1 The cycle, as an agent runs it

1. Pick a clause (`spec/…`, § T7) or write one (status `proposed`) for the behaviour.
2. Write the failing test, named `"<CLAUSE-ID> <what it checks>"`, in the owning module's
   `commonTest`. The edit hook runs the module's compile and the test in ≤ 3 s (L0).
3. Write the least code that passes. Run the module lane (L1, ≤ 30 s).
4. Refactor under the analysers until L1 is clean — the analysers are part of green.
5. Repeat until the milestone; run the commit lane (L2, ≤ 3 min); commit with the clause ids
   in the message.
6. A blind verifier (§ T6.3) writes its own tests from the same clauses in a separate
   worktree; both sets merge; a disagreement is filed against the clause, not the test.

The escalation rule stays: a lane failing twice on the same approach means change the
approach or escalate the writer's model tier; never loosen the gate.

### T6.2 The test taxonomy

| Kind | Lives in | Checks | Lane |
|---|---|---|---|
| Unit per clause | `:core` commonTest, `:engine`, `:ui` | one rule, named by its clause | L0/L1 |
| Property | `:core` commonTest (Kotest property testing, bounded iterations in the fast lanes, more nightly) | invariants: no compounding, `hp ≤ maxHp`, the dead never act, the rng stream is consumed identically by the three seam paths, every closed union interpreted | L1 (100 cases) · L4 (10 000) |
| Table-driven | `:core` | the spec's tables (enemy scale per act, roll ranges, loot weights) read from `spec/` | L1 |
| Differential | `:sim` tests | traces against the oracle's goldens | L2 (the golden set) |
| Snapshot | `:sim` | the balance table at reduced N | L2 · full N at L4 |
| Cross-platform hash | `:core` test tasks per target | determinism | L3 |
| Architecture | Konsist suite in `build-logic`'s quality plugin | boundaries, purity, naming, suppression budget | L1 |
| Screen | `:ui` commonTest with `runComposeUiTest` | semantics: what is on screen, what is enabled, what a tap answers; virtual time | L1 |
| Screenshot | `:ui` jvmTest with Roborazzi | goldens per fixture at k = 1 | L2 |
| Storyboard | `:tools:instruments` | a seeded whole run through the real screens; one PNG per distinct screen; the verdict | L2 (JVM) · L4 (Android, iOS) |
| Asset gate | `:tools:art` tests over `assets/` | every committed actor against the bible's numbers | L2 |
| Perf | `:tools:instruments` on JVM; Macrobenchmark and XCTest metrics on devices | frame-time histograms, allocation rate, app size | L2 (JVM budget) · L4 (devices) |
| Mutation | Pitest on `:core`'s JVM tests | the tests kill the mutants | L4 |
| Device smoke | Maestro flows | boot, the first ten minutes, on emulator and simulator | L3 (boot) · L4 (flows) |

### T6.3 The writer and the verifier

Every writer gets a blind verifier, as today, made mechanical: the verifier receives the
clause ids and the spec, never the writer's diff or report; it writes tests in its own
worktree (§ T13.4) and runs them against the writer's branch. Tests that both wrote stay;
tests only the verifier wrote are the interesting ones. The critic role (an agent with
eyes) is separate again and reads the review bundle (`VERIFICATION.md` § V3.10).

### T6.4 Test hygiene

No sleeps, no wall clock, no network, no filesystem outside a test's temp dir, no shared
mutable state between tests, no order dependence (Kotest runs specs in random order in
CI), no retries anywhere in CI configuration. Builders and fakes live in `:core-testing`;
fixtures are data in `spec/fixtures/`. A test is named by its clause; a test that cannot
name a clause is either a proposed clause or a smell. Tags select lanes: `Fast`, `Golden`,
`Sim`, `Screen`, `Device`, `Nightly`.

### T6.5 Coverage and mutation policy

| Module | Line | Branch | Per-file floor | Mutation (nightly) |
|---|---|---|---|---|
| `:core` | ≥ 95 % | ≥ 90 % | 80 % | ≥ 85 % killed on `battle`, `relics`, `run` |
| `:engine` | ≥ 80 % | ≥ 70 % | 60 % | — |
| `:ui` | ≥ 70 % plus a golden per fixture | — | — | — |
| `:sim`, `:tools:*` | ≥ 60 % | — | — | — |

Thresholds only rise. If Pitest cannot run on the KMP JVM target (P1 spike), `:core`'s
mutation lane is replaced by the property suite at 10 000 cases nightly and the oracle
diff, and the README's risk register records the loss.

### T6.6 What TDD means for screens and art

A screen change starts with the semantics test (what must be on the screen, what is
tappable, what an answer is) and the fixture; the screenshot golden is *recorded* after the
critic approves the frame, never written first — goldens are approved artefacts. An asset
change starts with the gate (the numbers it must meet) and ends with the critic and the
owner; the committed asset is then re-checked by the gate on every build.

## T7 Executable specifications

### T7.1 Shape

`spec/` holds Markdown files, one per topic, written in `DESIGN.md`'s voice (prose, tables,
constants in CAPS) but cut into **clauses** with stable ids:

```markdown
### COMBAT-TURN-05 — statuses tick at turn start, before the action
status: contract
owner: :core

Every duration on the acting actor decrements by 1 at step 5 and a status at 0 is removed,
before the action. STUN(1) therefore skips exactly one turn; a self-buff authored at 3
covers two own actions. `STATUS_TURNS` is the table below.

| kind | turns |
|---|---|
| STUN | 1 |
| … | … |
```

- Ids are `AREA-TOPIC-NN`; they are never renumbered or reused. A retired clause keeps its
  id with `status: retired` and a pointer to what replaced it.
- `status` is `proposed` (written, not yet bound), `contract` (bound to passing tests) or
  `retired`.
- `owner` names the module whose tests bind it.
- A table inside a clause marked `data:` is extracted by the binder to `build/spec/tables/`
  and read by the tests, so the document's numbers are the tests' numbers.
- Prose without a clause id is commentary and binds nothing.

Areas: `combat`, `relics`, `characters`, `enemies`, `run`, `meta`, `balance`, `platform`,
`screens`, `art`, `golden`.

### T7.2 Binding

A test binds a clause by name: the test's name starts with the id
(`"COMBAT-TURN-05 STUN skips exactly one turn"`). The `spec-binder` task (in `build-logic`)
parses `spec/**` and the JUnit XML of every test task in the lane, and writes
`build/reports/spec/matrix.md` and `.json`: per clause, its status, the tests bound to it
and their results. It fails the lane when a `contract` clause has no passing test, when a
test names an unknown id, or when a `proposed` clause has been bound by passing tests for
more than one commit (it must be promoted). Agents read the matrix as the first page of
every verification report.

### T7.3 Goldens as specification

`spec/golden/<name>.trace` with `<name>.sha256` and a `GOLDEN-NN` clause saying what the
golden fixes (seed, policy, mode, the rules version). The commit lane replays them. A golden
may change only in a commit that also changes a `contract` clause of the rules; the merge
lane checks this with the diff. A golden that changes without a clause is a bug, whichever
of the two is wrong.

### T7.4 Screens and flows

`spec/screens/<screen>.md` holds region clauses (the geometry, transcribed from
`layout.ts` as the ruler `:ui` reads), enabled/disabled rules, and flow clauses in
Given/When/Then prose, bound to `runComposeUiTest` tests by id. The storyboard's
expectations (which screens a run must cross, in which order) are `RUN-FLOW-NN` clauses
bound to the storyboard test.

### T7.5 Art

`spec/art/bible.md` holds the bible (`FUNCTIONAL.md` § F3.1) as `ART-NN` clauses with the
numbers; `:tools:art`'s gate tests bind them over `assets/actors/**`. An asset is therefore
specified, and the specification is re-executed on every commit that touches an asset.

### T7.6 Folding `DESIGN.md`

At P2, `DESIGN.md` is folded section by section into `spec/` clauses that quote its text;
nothing is reworded during the fold (parity before change). `DESIGN.md` keeps a banner
pointing at `spec/` and stays the narrative until P8, when it becomes `spec/README.md`. The
fold is complete when the binder reports every clause bound by P3's end.

### T7.7 Changing the contract

Clause first (`proposed`), then the tests, then the code, then promotion to `contract` in
the same PR; where a rule or a number moves, the simulator guards and the balance snapshot
move in that PR too, with the arithmetic in the clause. This is the designing-mechanics
discipline made mechanical.

### T7.8 Spec lint

Unique ids; the id grammar; the `status` and `owner` lines present and valid; every
`data:` table parsable; links resolve; a clause ≤ 60 lines; no two clauses with the same
title; goldens have hashes. Runs in the edit lane on `spec/**`.

## T8 Static analysis and code health

The set, what each catches, where it runs. "Simple and easy to change" is enforced through
the budgets in § T8.3.

| Tool | Catches | Lane |
|---|---|---|
| Kotlin compiler: `allWarningsAsErrors`, explicit API on `:core`/`:engine`/`:ui`, progressive mode | unused code, implicit visibility, inference surprises, deprecated APIs | L0 |
| detekt (default rules at the budgets below, `detekt-rules-libraries`, Compose rules `io.nlopez.compose.rules`, type resolution on) | complexity, size, nesting, return counts, magic numbers outside `types`, `!!`, `lateinit`, exception swallowing, Compose modifier and `remember` misuse, unstable parameters in hot composables | L0 (changed files) · L1 (module) |
| detekt custom rule set (`build-logic`) | in `:core`: any import outside the stdlib, any `kotlin.random`, any `println`, any `System.`/`Clock`, any `pow`; anywhere: `readPixels`/`toPixelMap` inside `:engine`'s frame path; `Thread.sleep`/`delay` in tests | L0 |
| ktlint via Spotless | formatting; auto-applied by the edit hook | L0 |
| Konsist | module boundaries (§ T2.1), package layering inside `:core`, naming (`*Screen`, `*Spec`), every `@Composable` screen has a `@Preview`, every public `:core` function has a clause-named test in its module, suppression budget, no network library in `:app:*` | L1 |
| KGP ABI validation | unreviewed public API changes | L1 |
| Kover | coverage thresholds (§ T6.5) | L2 |
| Compose compiler reports | unstable classes and non-skippable composables in `:ui` stage and HUD packages | L2 |
| Android Lint (fatal set, `checkDependencies`, no baseline) | platform misuse, resource problems, performance lints | L3 |
| dependency-analysis (`buildHealth`) | unused and undeclared dependencies, wrong configurations | L3 |
| Pitest | tests that do not test | L4 |
| Gradle `--warning-mode=fail`, configuration cache required | build script rot | every lane |
| actionlint, shellcheck, markdownlint, spec-lint | workflows, scripts, documents, the spec | L0 |
| Renovate | stale dependencies | weekly |

### T8.1 Suppression policy

A `@Suppress` or a detekt `@Suppress("RuleName")` must carry a `// why:` comment and either
an issue reference or an expiry date; Konsist counts suppressions per module against a
budget (`:core` 10, `:engine` 20, `:ui` 30) and fails above it; expired suppressions fail.
No baselines anywhere: a baseline is a suppression without a reason.

### T8.2 Compose rules that matter here

Stage and HUD composables take `@Stable` state; collections passed into them are
`kotlinx.collections.immutable` or wrapped; `remember` keys are explicit; previews exist for
every screen state in `spec/fixtures/`; no `LaunchedEffect` in the stage (time comes from
the frame loop).

### T8.3 The simplicity budgets

| Budget | Value | Tool |
|---|---|---|
| Cyclomatic complexity per function | ≤ 10 | detekt |
| Cognitive complexity per function | ≤ 12 | detekt |
| Function length | ≤ 40 lines | detekt |
| Parameters | ≤ 5 (constructors ≤ 7) | detekt |
| Nesting depth | ≤ 3 | detekt |
| File length | ≤ 400 lines (`battle.ts`'s 1 236 lines become the sections it already names) | detekt |
| Functions per class | ≤ 11 | detekt |
| Public API growth | reviewed via the ABI dump diff | KGP |
| Module edges | § T2.1 | Gradle + Konsist |
| Suppressions | § T8.1 | Konsist |
| Dead code | zero: explicit API + `allWarningsAsErrors` + dependency-analysis | compiler, plugin |

A budget is raised only by a commit that says why in `kmp/CLAUDE.md`'s budget table.

## T9 Rendering and performance

### T9.1 The logical frame

`Frame` letterboxes a 1280×720 logical space into the window at scale
`k = min(w / 1280, h / 720)` in device px, centred, with the platform's safe insets folded
into the mutable inset (24 px all round; 40 px bottom on phones; larger where a notch
demands). Screens position composables in logical px through `LogicalLayout` (a custom
layout that applies `k`); `layout.ts`'s constants become `Layout`, the shared ruler. Hit
rects are grown to `TAP_MIN = 96` logical px around their centre by the same registry.
Goldens are rendered at `k = 1` on the JVM.

### T9.2 The stage

`Stage` draws, per frame, in today's order: the baked planes at their parallax offsets
(far, mid, floor, near) and the baked light map (`Plus`); contact shadows; actors in
painter's order, one `drawImage` each from the biome-tinted atlas with
`FilterQuality.None`; the per-actor gain (`ColorDodge`) and rim spill (`Plus`) from baked
feathered sprites; VFX particles as blits; damage pops; the bloom (§ T9.4); the grade
(`Multiply`) with the vignette; the sky body after the grade. Everything blurred — the far
plane at 6 px, mid at 1.2, near at 8, the light map's softness — is baked **once per
(biome, tier)** with a separable CPU box blur ×3 into `ImageBitmap`s at boot or on biome
entry; no platform blur effect is used in the frame path. Bakes run on a background
thread at the platform's discretion and are cached in memory per tier.

### T9.3 Hard pixels and the device scale

Where `2k` is an integer (a 1080p phone letterboxes to `k = 1.5`, so a 2-px cell is 3
device px), the actor plane is sampled nearest and is genuinely crisp; where it is not,
the actor plane is sampled bilinear — exactly the web build's look — because uneven cells
shimmer. Decided once at boot from `k`; the setting is visible in the debug drawer.

### T9.4 Bloom and CRT (D11)

Today's bloom is frame-derived (read the frame at quarter resolution, self-multiply
threshold, blur, add back). The plan's default is a **bright-layer bloom**: the things
that are bright by design — VFX particles, prop glows, the sky body, pops — are drawn a
second time into a 320×180 `ImageBitmap` on the CPU, blurred with the same separable
blur, and added back (`Plus`) upscaled with smoothing. It is deterministic, identical on
every platform, allocation-free after warm-up (one buffer, one `IntArray`), and it costs
under a millisecond on a phone CPU. The P0 spike renders the six backdrops and a hit
frame both ways and the full-frame critic compares them; if the bright-layer bloom loses
the look, the fallback is a platform blur on a bright-layer composable (`Modifier.blur`
on Android 12+ and on every Skiko target) with per-platform goldens, and the README's
decision D11 is amended. ARCADE's halation reads the same buffer, so bloom and halation
never both run and the contract's XOR holds; scanlines, vignette and flicker are cheap
overlays everywhere.

### T9.5 Budgets

| Where | Tier | Budget | Checked by |
|---|---|---|---|
| Desktop JVM, headless, 1280×720 | HIGH | frame p95 ≤ 4 ms; zero allocation in steady state over 600 frames (measured with the JVM's thread allocation counter) | L2 perf test |
| Reference Android (2022 mid-range) | MED | frame p95 ≤ 12 ms at 60 Hz, including a hit peak | L4 Macrobenchmark |
| Reference iPhone 12 class | MED | frame p95 ≤ 12 ms | L4 XCTest metrics |
| Any device | LOW | never below 30 Hz | the auto-drop rule as today |
| App size | — | ≤ 100 MB installed, measured per build | L3 size test |
| Boot | — | title in ≤ 2 s cold on the reference phone | L4 |

`note(frameMs)` keeps the contract's rule: HIGH/MED drop to LOW after 60 consecutive
frames over 20 ms, one way, per session.

### T9.6 Text

The HUD face is one bundled open font (Inter or Roboto; chosen in P1 for its rendering at
18 px on Skia), drawn through `TextMeasurer`/`drawText` in the stage and `Text` in the
HUD composables; letter spacing and sizes are `Layout`'s. The two bitmap fonts are exported
from `engine/draw.ts`'s glyph tables and baked to glyph atlases; damage pops and the logo
draw from them with nearest sampling as today.

### T9.7 Memory and size

Actor atlases: 43 actors × 15 frames at ≤ 128×128 (bosses 192×192) ≈ 12–20 MB RGBA in
memory, baked per element tint on demand; on disk as PNG under 5 MB. Backdrops: six
biomes × four planes plus light and grade at 1280×720 with padding as PNG ≈ 20–35 MB — the
largest part of the app. Sound: 24 WAVs ≈ 2 MB (or Ogg where the platform decodes it
cheaply). The size test (§ T9.5) fails the merge lane above budget.

### T9.8 Audio

`:tools:audio` ports the synthesizer as a pure function (oscillators, envelopes, the
noise buffer, the static soft-knee limiter curve) and renders the 24 clips to WAV at build
time; the clips are tested by hash. `SfxPlayer` (`expect`) has one implementation per
platform (Android `SoundPool`, iOS `AVAudioEngine`, desktop `javax.sound.sampled`) with
`play(name, pitch, gain)`; the per-name cooldowns, volume and mute are common. Unlock on
the first input is kept where a platform needs it (web); the apps do not.

### T9.9 Input and focus

One model, `Focusables`: every tappable — a composable button through its semantics node,
an actor through its stage rect — registers a logical rect, an index, a group and a
disabled flag each frame, as today's hit regions do. Pointer events resolve drawn rects
first, then `TAP_MIN`-expanded rects; a tap commits on release in the region it began in;
`pointercancel` and lifecycle pause clear pressed state without firing a release. Keyboard
focus moves spatially (the ±50° cone, distance + 2× perpendicular, wrap to the far edge in
the group, index cycling on a flat row, twins skipped); A activates, B backs, PAUSE pauses,
digits 1–3 cast. The drivers tap by test tag or by logical geometry, so a screen that
draws a button somewhere else fails the storyboard, as today.

## T10 Assets and the AI image pipeline

### T10.1 Stages

```
brief (spec/art + the actor's row) → prompt pack → generate N candidates per pose
  → normalise (alpha clean-up, crop, integer downscale to the cell, palette quantisation onto the element ramp, keyline check, cell alignment)
  → gate (the ported instruments; FUNCTIONAL § F3.4 as numbers) → contact sheet
  → critic (an agent with eyes: the sheet, the lit frame at 1:1 and 2×) → owner (yes / no)
  → accept: PNG + manifest committed under assets/actors/<ID>/ → atlas build (a build output) → frame goldens re-recorded with approval
```

`:tools:art` is a CLI (`generate`, `normalise`, `gate`, `sheet`, `accept`) and a test suite
(the gate over every committed asset). Generation is never part of a build; the accepted
PNG is the source of truth.

### T10.2 Providers

A provider is an adapter behind one interface — `generate(prompt, negative, references,
size, seed?) → candidates` — so the bake-off compares like with like and the cast is made
with **one** sprite provider and one portrait provider. Candidates at writing, to be
re-checked at P0 for terms and capability:

| Provider | Fit | Notes at writing |
|---|---|---|
| Retro Diffusion (RD Pro) | pixel sprites from text with up to nine reference images; trained on licensed pixel art; outputs owned by the creator and usable commercially; per-image pricing (RD Pro ≈ $0.18) | the first candidate for stills at the cell |
| PixelLab | pixel characters as posable skeletons with animation and rotation; API and an MCP server; sprite-sheet export | the first candidate for the fifteen frames — it answers pose consistency by construction |
| Gemini image models ("Nano Banana" line) | reference-conditioned generation and editing; strong consistency | portraits; a pixel candidate only through normalisation |
| FLUX.2 (Black Forest Labs API) | up to eight reference images in the API | portraits; pixel through normalisation |
| OpenAI image models | reference-conditioned | portraits |
| Self-hosted Stable Diffusion / FLUX with a LoRA per character | maximum control and repeatability; GPU cost and time | the fallback if hosted providers cannot hold consistency |

Terms are verified in writing at P0 for every provider used (commercial rights to
outputs, no restriction on games or stores, no training-data claims on our assets); a
provider without them is not used.

### T10.3 Animation strategy

| Option | How | Bet |
|---|---|---|
| (a) posable skeleton | the provider generates all fifteen frames from one character | consistency by construction; the pose vocabulary must be expressible |
| (b) key poses + procedural in-betweens | five stills per actor with references; the existing rig's per-frame transforms (offset, squash, flash, the crown's rise) on whole sprites make the three frames per pose | fewer generations; the settle band and idle-change rules must still be met by the transforms |
| (c) master still + segmentation into the part rig | one still cut into parts and animated by the current anchor rig | the current kit's animation quality, with painted parts; fiddly segmentation |

The P0 bake-off runs (a) and (b) on six actors (EMBER, GALE, HOLLOW_KING, CINDER_IMP,
ASH_HOUND, DUST_WRAITH); (c) is tried only if both fail the gate twice.

### T10.4 The gate

`:tools:instruments` ports `tools/lineup.ts`'s metrics and ART-REVIEW.md's ship
criteria: L* min/p2/p98/max, the five bands, the share below L 35 (whole and interior),
above L 75, lit-from-above delta, contrast mean/min and the share below 3:1 measured
against the **lit ground the actor stands on** (the biome floor's p50, 45–60 after scene
round 6, as STATUS.md's value-law note requires — not the navy), colour count, mirror IoU,
nearest-silhouette IoU across the whole cast, component count, settle band, idle change,
crown rise on hurt 0, dead height, and the frame-to-frame consistency numbers of
`FUNCTIONAL.md` § F3.4. Output: `metrics.md` and `.json`, one row per actor and per
frame, PASS or the failing criteria. The same code runs as tests over `assets/actors/**` in
the commit lane, so no accepted asset can regress silently.

### T10.5 Normalisation rules

Allowed: alpha clean-up and de-halo; crop to the silhouette; integer downscale with
nearest sampling to the cell; palette quantisation to ≤ 24 colours mapped onto the actor's
element ramp and the shared neutrals; keyline enforcement (a missing keyline cell is
added in the material's dark step); cell alignment; mirroring to face right. Forbidden:
repainting content, upscaling, blur, any per-pixel edit an agent makes by hand without
recording it as a normalisation step. Normalisation is deterministic and idempotent
(`normalise` twice is a no-op), so it can be re-run over the whole cast when a rule changes.

### T10.6 Provenance and licensing

`assets/actors/<ID>/manifest.json`: provider, model and version, prompt hash (the prompt
text lives beside it), references used (by asset id), the provider's seed where one
exists, date, the normalisation steps applied with their parameters, the licence, the gate
results at acceptance, who accepted. `assets/LICENSES.md` lists every provider's terms
as verified. Prompts never name a third-party game, character or artist.

### T10.7 Cost and budget

At the listed prices a bake-off of two providers × six actors × five poses × eight
candidates is ≈ 500 images, under $100 for per-image providers plus a month of a
subscription provider; the full cast at six candidates per frame is ≈ 4 000 images, under
$800 at RD Pro's price and far less at the cheaper tiers, plus regeneration. Every
response is cached; an accepted asset is never regenerated; the tool refuses to exceed a
per-actor candidate budget without a flag.

### T10.8 Reproducibility

Generation is not reproducible across providers or time; the accepted PNG is the source.
Everything after it is: normalisation, the gate, the atlas build and the frame goldens.
Atlases are build outputs, never committed.

### T10.9 Today's art as placeholders

`tools/export-assets.mjs` (Playwright over the dev server, like `capture.mjs`) writes every
actor's fifteen bakes as PNG with feet, hit rect and size, and every biome's planes, light
map and grade per tier, into `kmp/assets/legacy/`. P4 ships with them; P6 replaces the
actors one by one behind the gate; the backdrops stay (`FUNCTIONAL.md` § F3.7).

## T11 Persistence, saves and replays

- **A run** is `(rules version, seed, RunConfig, decisions[])` in the canonical text
  encoding of `:core`'s `codec`; the app writes it after every decision and replays it at
  launch (D6, `FUNCTIONAL.md` § F2.1). The rules version is the hash of `:core`'s golden
  set; a save whose version differs from the installed rules is not replayed — the run is
  declared abandoned with the Vault untouched and the player told once. Store updates are
  rare and a run is short; the alternative (shipping old rules) is not worth its weight.
- **The Vault** is `VaultSave` v2: the v1 fields (relics, `vaultSlots`, the unlocked
  ascension) plus settings; migration from the web's v1 through the transfer code, which is
  base64 of the v1 JSON with a checksum and a version byte.
- **Storage** is an `expect` `Store` (a file in the app's private directory; `Preferences`
  on the JVM; `NSUserDefaults`-backed files on iOS) with an in-memory fake for tests.
- **Replays** are the bug report: the debug drawer exports the current run's save, and
  `:sim replay <file>` reproduces it headlessly, prints the trace and renders the storyboard.
- **PvP readiness**: the same encoding carries a party, a relic and a decision stream; a
  server can verify a claimed result by replay (`FUNCTIONAL.md` § F5.2).

## T12 Platform shells and release engineering

- **Android**: one activity, `setContent`, `sensorLandscape`, immersive sticky, the
  lifecycle pausing the loop and yielding audio focus; no network permission until PvP.
- **iOS**: `iosApp/` with a Swift `App` hosting `ComposeUIViewController`; landscape in
  `Info.plist`; a privacy manifest declaring no tracking and no data collection.
- **Desktop**: a `Window` at 16:9 with keyboard; the platform for Hot Reload and the
  instruments.
- **Signing and stores**: fastlane with `match` for Apple certificates and a Play upload
  key in CI secrets; a tag `v*` builds, signs and uploads to the Play internal track and to
  TestFlight; version name from the tag, version code from the commit count.
- **Crash reporting**: none by default; an opt-in toggle in settings can enable a KMP
  crash reporter in a later phase (the owner's call under README question 4).
- **Release notes** are generated from the clause ids in the merged PRs since the last tag.

## T13 Agent workflow and conventions

### T13.1 `kmp/CLAUDE.md`

The repo map for the tree; the lane commands and their budgets; the module edges; the
budget table of § T8.3; the spec workflow (§ T7.7); the writer/verifier/critic roles and
their model tiers (mechanical work on a Sonnet-class model, design, review and critics on an
Opus-class model, the sprite loop's judgement on the strongest available); the isolation
rules (§ T13.4); the commit gate; "never claim to have playtested".

### T13.2 Skills

`kmp-iterating` (the default edit path and the lanes), `kmp-verifying` (run L1/L2, read
the matrix and the bundle, report), `kmp-spec-change` (clause first), `kmp-balancing` (the
harness and the snapshot), `kmp-art-loop` (generate → gate → sheet → critic), `kmp-screens`
(fixtures, semantics tests, goldens), `kmp-device` (emulator/simulator smoke and Maestro),
`kmp-releasing` (tags and stores). The existing skills stay for the TypeScript root until P8.

### T13.3 Hooks

- `SessionStart`: start the Gradle daemon and pre-warm the fast lane
  (`./gradlew :core:jvmTest --offline -q` on a no-op), so the first L0 is warm.
- `PostToolUse` on `Edit`/`Write` of `kmp/**/*.kt` and `spec/**`: the L0 lane for the
  touched module (format, compile, detekt on changed files, spec-lint) with a 3-second
  budget, reporting only failures.
- `PreCommit` (git hook, also run by the gate script): L1 for the touched modules and
  spec-lint.

### T13.4 Isolation

Every writer, verifier and critic works in its own git worktree with its own Gradle project
cache directory (`--project-cache-dir`) and its own driver port; ports are announced in
the task; nobody kills another's daemon. Long instruments (storyboards, sheets) run against
a worktree at HEAD, never against a tree another agent is editing — the lesson STATUS.md
records.

### T13.5 The gate script

`kmp/ci/gate.sh <lane>` runs a lane exactly as CI does, prints the lane's time against its
budget, and writes the review bundle (`VERIFICATION.md` § V3.10). The commit gate is `gate.sh
commit` (L0 + L1 + L2); an agent commits only when it is green, unsigned, pathspec-scoped,
with the clause ids in the message.

## T14 Phase sequence

| Phase | Entry | Deliverables | Exit gate |
|---|---|---|---|
| **P0 Decide and spike** | this plan approved | the owner's answers to README's questions; spikes: (1) headless JVM capture of a Compose stage to PNG at k = 1 and its time; (2) the bright-layer CPU bloom against today's frames on six backdrops and a hit; (3) `RunSession` on intrinsics with a toy generator and the three-way check; (4) the sprite bake-off on six actors, options (a) and (b), with the gate run on the candidates; (5) Pitest on a KMP JVM target; (6) detekt 1.x on Kotlin 2.4 syntax | spike reports with frames, numbers and a recommendation each |
| **P1 The rig** | P0 | `kmp/` with every module present and empty, the convention plugins, every analyser at full strength, the spec binder, the lanes and `gate.sh`, the hooks, `kmp/CLAUDE.md`, CI workflows with path filters and required checks, the hello-world stage (one sprite, one button, one screen test, one golden, one storyboard step) | every lane green and inside budget, timings recorded in `ci/lanes.json` |
| **P2 The oracle and the specs** | P1 | tag `ts-oracle-v3`; `--trace` in `sim/run.mjs`; the golden set recorded and hashed; `DESIGN.md` folded into `spec/` clauses (status `proposed`); the instruments ported (metrics, sheets); `export-assets.mjs` | spec-lint clean; every clause has an id and an owner; goldens frozen |
| **P3 The rules** | P2 | `:core` by TDD in § T5.1's order; `:sim` with every command; `:core-testing`; the cross-platform hash test; the ABI dump | `diff-oracle` clean on the golden set; balance snapshot to the digit; matrix 100 % for `combat`, `relics`, `characters`, `enemies`, `run`, `meta`, `balance`; coverage and mutation at threshold |
| **P4 The stage and the shell** | P1 (parallel with P3 from P2) | `Frame`, `Focusables`, `Stage` with planes, actors from the legacy atlases, light, VFX, pops, audio; the three tiers and ARCADE; the desktop app; the perf test | battle frames captured headlessly for six biomes as goldens; desktop budget met; the reference phone budget met on a stage-only build |
| **P5 The screens** | P3 + P4 | every screen as Compose UI over the seam; fixtures for every screen state; semantics tests; goldens; the storyboard driver; Android and iOS shells; device boot smoke | storyboard `PLAYFULL OK` for two acts and a KO on JVM, Android and iOS; every fixture has a golden; `screens` and `platform` clauses bound; the owner signs the parity checklist on a device |
| **P6 The art** | P0's bake-off + P4 | the pipeline at full strength; the cast regenerated in § F3.5's order; portraits; frame goldens re-recorded per accepted actor | every actor passes the gate; the full-frame critic ≥ 8 on every axis; the owner accepts on a phone |
| **P7 Ship** | P5 (+ P6 for the look) | the F2 changes; store pipelines; the transfer code; credits | installed from both test tracks; the first-ten-minutes test passes |
| **P8 Promote and retire** | P7 | the move to the root; docs and skills rewritten; the oracle under `oracle/` | nothing at the root depends on TypeScript but the oracle |
| **P9 Web (stretch)** | P8 | the wasmJs target through the same gates; Pages switches when it passes | the P5 gates on the Wasm build |

Parallel tracks once P1 lands: P2 → P3 (rules) beside P4 (stage) beside the P6 bake-offs
and pipeline; P5 needs both P3 and P4. The critical path is P1 → P2 → P3 → P5 → P7.

## T15 Technical risk register

| Risk | Mitigation | Tripwire |
|---|---|---|
| Kotest's non-JVM engines lack features the suites use (annotation config, some listeners) | configuration by code only; the JVM lane is the fast truth; non-JVM lanes run the same specs | a spec that cannot run on a target is a P1 finding, not a per-test exclusion |
| The Compose test APIs are experimental and change (v1 deprecated in 1.11) | one thin capture-and-drive abstraction in `:tools:instruments` and `:ui` tests; an upgrade touches it once | a CMP upgrade breaking more than that module |
| Gradle configuration cache incompatibilities in a plugin | the cache is required from P1, so an incompatible plugin is rejected at adoption | any `--no-configuration-cache` in a script |
| macOS runners for the iOS lane are slow or costly | iOS only in the merge and nightly lanes; the simulator boots once per job | the iOS lane over 25 min |
| Kotlin/Native compile time | never in the fast lanes; caching of the K/N distribution and klibs in CI | — |
| Hot Reload's MCP is new | an instrument, not a gate; the headless instruments are the gate | — |
| A store rejection (metadata, privacy, AI-art disclosure) | the privacy manifest and the credits are P7 deliverables; the disclosure follows the store's rule | — |
| The CPU bloom loses the look | the P0 spike and the platform-blur fallback (§ T9.4) | the critic prefers the frame-derived bloom on more than two of eight frames |

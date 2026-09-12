# Technical plan — how it is built

The engineering half of the plan. It fixes the platforms, hosts and identities, the
architecture, the toolchain, how the rules are ported against the oracle, how the team
(one owner, many agents) practises TDD, how the specification becomes executable, which
static analysis runs where, how the stage is rendered inside a phone's frame budget, how
the AI image pipeline works, how saves and releases work, how agents work in the new
repository, and the phase sequence. The verification loop that ties it together has its
own document, `VERIFICATION.md`; the player-facing scope is `FUNCTIONAL.md`.

Versions quoted are what was current when this was written (2026-09-11) and are pinned
again at P1; every claim about a tool's capability that the plan depends on is a P0/P1
spike, listed in § T14.

## T1 Platforms, devices, hosts and identities

| Target | Role | Minimum | Notes |
|---|---|---|---|
| Android | product | **minSdk 29** (Android 10), target the current SDK | Compose's `ColorDodge` and `Multiply` blend modes (the stage's gain and grade) fall back to source-over below API 29 (D3) |
| iOS | product | iOS 16.0 | `iosApp/` Xcode project with a Swift entry point hosting `ComposeUIViewController`; no other Swift |
| Desktop JVM | development and agent platform | JDK 21 | macOS, Windows, Linux; not a store product; where the fast lanes run and where frames are captured |
| Web (wasmJs) | stretch (P9) | browsers with WasmGC — all major engines since December 2024 | Compose for Web is beta at writing; the TypeScript build keeps the Pages URL until the Wasm build passes the same gates |

**Reference devices**: one 2022 mid-range Android (Pixel 6a or Galaxy A53 class) and one
iPhone 12 class, plus the owner's own phones.

**Where the lanes run** (D18). The fast lanes (L0–L2) run in the **environment image**
(`kmp/ci/env.Dockerfile`, § V4) — the agents' cloud environment, the developer's
devcontainer and the CI golden job are the same image. The merge lane (L3) runs on hosted
Linux runners (x86-64, with KVM for an x86-64 Android emulator) plus one hosted
Apple-silicon macOS job for the iOS simulator; no hosted runner can run an **arm64** Android
emulator (x86-64 hosts cannot boot arm64 images and the Apple-silicon runners have no
nested virtualisation), so arm64 ART is proven on physical devices. The device lane (L4)
runs on a self-hosted runner on the owner's machine with the two reference phones,
reachable only by the nightly workflow (a unique label that no pull-request workflow uses;
`schedule` and `workflow_dispatch` on `main` only; Actions requires approval for outside
contributors), with Firebase Test Lab — which has Android and iOS physical devices and a
free daily quota of five physical-device runs — as the fallback when a phone is offline;
a device lane with no device reports SKIPPED, never green. The iPhone lane needs Xcode, so
the self-hosted machine is a Mac or the iPhone lane runs on the farm (README question 5).

**Identities** (D17). Two GitHub accounts: the owner's, and a **machine user** that is a
collaborator with write access and no admin rights, holding a fine-grained token scoped to
contents and pull requests. Every agent session commits, pushes and opens pull requests as
the machine user; the owner is the only entry in `CODEOWNERS` and the only reviewer;
approvals are read from GitHub's review data. A "reviewing agent identity" is deliberately
not used: an agent approving another agent's pull request is the same coordinator
approving itself.

## T2 Architecture

### T2.1 Layout and modules

```
spec/                      the executable specification at the repository root: clauses, tables, goldens, fixtures
kmp/
├── build-logic/           convention plugins: kmp-library, compose-library, quality (every analyser), spec-binder, lanes
├── core/                  :core          the rules — commonMain, ZERO dependencies (stdlib only)
├── core-testing/          :core-testing  builders, fakes, the trace and codec test helpers
├── engine/                :engine        the presentation kernel (Compose): Frame, Layout, Focusables, Stage, the light rig,
│                                          particles, juice, bitmap fonts, the SfxPlayer interface
├── ui/                    :ui            screens, the scene builder, art atlases, VFX, HUD (Compose; uses :core + :engine)
├── sim/                   :sim           the balance harness (JVM CLI): Monte Carlo, traces, self-check, gates, JSON
├── tools/instruments/     :tools:instruments  shot · storyboard · sheets · frames · vfx · backdrops · compare · approve · the review bundle (JVM)
├── tools/art/             :tools:art     provider adapters · normalise · the gate · manifests · contact sheets (JVM)
├── tools/audio/           :tools:audio   the seeded synthesizer → WAV (JVM)
├── app/android/  app/ios/  app/desktop/  app/web/   thin shells
├── iosApp/                the Xcode project
├── assets/                source assets and manifests: actors, portraits, legacy (the export), backdrops, fonts, sfx, LICENSES.md
├── ci/                    env.Dockerfile, lanes.yaml, gate.sh, the timing ledger
└── CLAUDE.md              the agents' conventions for this tree
```

**Allowed dependency edges** — everything else is forbidden and checked three ways: Gradle
declares only these; a `build-logic` task asserts that `:core`'s main configurations resolve
to nothing but the standard library; Konsist tests check imports per module.

| Module | May depend on | May never import |
|---|---|---|
| `:core` | Kotlin stdlib | `kotlinx.*`, `androidx.*`, `java.*` beyond what stdlib maps, `android.*`, `platform.*`, any logger, any clock, `kotlin.random` |
| `:core-testing` | `:core`, Kotest | platform |
| `:engine` | Compose, `kotlinx.collections.immutable`, Skiko on non-Android source sets | `:core`, `:ui` |
| `:ui` | `:core`, `:engine`, Compose, compose-resources, `kotlinx.collections.immutable` | platform APIs except through `:engine`'s `expect` surface |
| `:sim` | `:core`, `:core-testing`, kotlinx-serialization-json, a CLI parser | Compose |
| `:tools:*` | `:core`, `:ui` (instruments only), `:engine`, JVM libraries | — |
| `:app:*` | `:ui`, `:engine`, `:core`, the platform | nothing network-facing until PvP (a Konsist rule) |

`:core` compiles for jvm, android (the KMP Android library plugin), iosArm64,
iosSimulatorArm64 and wasmJs. `:engine` and `:ui` compile for the same set. Everything under
`:tools` and `:sim` is JVM only.

**Where the stage's pieces live** — the boundary that keeps `:engine` free of `:ui`:

| Piece | Module | One sentence |
|---|---|---|
| `Layout` | `:engine` | the contract's geometry as pure constants and helpers (the ruler), no drawing |
| `Frame`, `Focusables` | `:engine` | the letterboxed logical space and the tap/keyboard registry |
| `Stage` | `:engine` | draws one `StageScene` per frame in painter's order; knows nothing about actors, skills or biomes |
| `StageScene` | `:engine` (type) | an immutable description: the biome bake handle, the camera offset, contact shadows, actor blits (bitmap handle, position, flip, scale, alpha), light actors, effect blits, bright-layer blits, pops |
| the light rig, `BiomeLook` (type) | `:engine` | bakes planes, light map, tiers from a `BiomeLook`; lights actors per frame |
| the biome data (`BiomeLook` values, exported) | `:ui` resources | data, loaded by `:ui` and handed to the rig |
| art recipes, atlases, VFX, HUD, screens, the scene builder | `:ui` | builds the `StageScene` from the run's state every frame |

**Test data on every target.** `:core` has no file access on iOS or Wasm, so no test reads a
path. The spec binder (§ T7.2) *generates Kotlin source* into a generated `commonTest`
source set before compilation: `SpecTables.kt` — one `List<Row>` per `data:` table, the
`Row` a data class typed per column from the clause's `types:` line (`int`, `double`,
`string`, `bool`, `enum:<Union>`) or inferred from the cells; `SpecFixtures.kt` — one value
per file under `spec/fixtures/<screen>/<name>.json`, whose schema is the screen's
`ScreenState` as declared in `spec/screens/<screen>.md`, exposed as
`SpecFixtures.<Screen>.<name>`; and the golden hash lists as constants. Full-text goldens,
screenshots and the save corpus are read by JVM-only tests from resources.

### T2.2 The rules core, package by package

`types` (every closed union and constant of `game/types.ts`, as sealed interfaces, enums
and `const val`s) · `data` (SKILLS, CHARACTERS, ENEMIES and BIOMES, RELICS' tables, SETS,
SIGILS, PACTS, ASCENSION, `validateData()`) · `rng` (`pick`, `uniformInt`, `weighted`,
`chance`, `withoutReplacement`, `mulberry32`) · `relics` (rolling, levels, forge, sets,
`derive`, `compare`) · `battle` (ATB, the turn, damage, statuses, AI, `intent`,
`simulateBattle`, the interactive API and the event stream) · `run` (the map, rooms, loot,
laps, the Vault as data including `minAscensionFor`, the policies, `simulateRun`,
`runSteps`) · `session` (the interactive seam, § T2.3) · `codec` (the canonical text
encodings of configs, results, traces, decision logs and state snapshots, and the compact
binary Vault transfer — hand-written, so `:core` needs no serialization library; JSON for
external tools lives in `:sim`) · `version` (`RULES_VERSION`, § T11).

The closed unions stay closed: a sealed interface per union, `when` without `else`, so a
new kind fails the build until every interpreter handles it — the same guarantee the
exhaustive `Record` checks give today.

### T2.3 The seam

The TypeScript seam is a generator: `runSteps` yields a `RunPending`, receives an answer,
continues; a battle is *one* pending, and the screen plays the turns itself. The Kotlin
seam changes exactly that: **every turn of a battle is a pending of the session.**

- Pending kinds are the TypeScript ones — `DRAFT`, `VAULT_EQUIP`, `SUMMON`, `LEADER`,
  `ROUTE`, `RELIC`, `REST`, `SHRINE`, `FORGE`, `ALTAR`, `LAP`, `BANK` — plus two in place of
  `BATTLE`:
  - `HERO_TURN { battle, actor, options }`, raised **at step 7 of the turn**, after the
    cooldown tick and the status tick, with the post-tick `actOptions(battle, actor)` —
    exactly where the harness's policy is asked today. No pending is raised for a hero whose
    turn ends at step 2 (a BURN death) or step 6 (stunned). A VIOLENT extra turn raises a
    second `HERO_TURN`. The answer is `Turn(option)` (an index into the pending's own list,
    the policy's `act` answer) or `Forfeit`.
  - `ENEMY_TURN { battle, actor, intent }`, raised before each enemy turn and answered by
    `Continue`, so the screen can show the intent and pace the playback exactly as today;
    `Continue` draws nothing, is not logged, and a replay answers it by itself. `Forfeit` is
    accepted at an `ENEMY_TURN` too.
  - `Forfeit` aborts the turn loop, calls `battleOutcome` with `forfeit = true` (a loss) and
    draws nothing.
- Answers are a sealed `RunAnswer`, one type per pending kind, integers as `Int`; an
  illegal field still travels into the rules and that decision's documented fallback
  decides it, as today.
- The rng stream is unchanged: `createBattle`, the enemy turns and `runTurn` are called in
  the same order with the same draws, so the oracle traces still match. The web build's
  battle screen enumerates options *before* the turn and indexes the post-tick list with
  that index — the defect `FUNCTIONAL.md` § F1.4 records — so the harness path, which asks
  the policy at step 7, is the one the traces follow.

`RunSession` is built on the standard library's coroutine intrinsics — no kotlinx
dependency, no dispatcher, no thread; `runSteps`, the battle loop, `takeTurn` and
`castSkill` become `suspend` on the paths that reach `ask`, and everything resumes
synchronously inside `decide`:

```kotlin
class RunSession(config: RunConfig, rng: Rng) : Run {
    private var next: Continuation<RunAnswer>? = null
    private var pending: RunPending? = null
    private var result: RunResult? = null
    private var token = 0
    private var busy = false

    private suspend fun ask(p: RunPending): RunAnswer = suspendCoroutineUninterceptedOrReturn { c ->
        pending = p; next = c; COROUTINE_SUSPENDED
    }
    init {
        val body: suspend () -> RunResult = { runSteps(config, rng, ::ask) }
        body.createCoroutineUnintercepted(Continuation(EmptyCoroutineContext) { result = it.getOrThrow(); pending = null })
            .resume(Unit)
        token = 1
    }
    override fun decide(answer: RunAnswer, expected: Int?): Boolean {
        if (busy || pending == null || (expected != null && expected != token)) return false
        val c = next ?: return false
        busy = true
        try { next = null; c.resume(answer); token += 1 } finally { busy = false }
        return true
    }
    // state() / pending() / token() / result() as today; the view is built at most once per token
}
```

**The three-way self-check** compares the three paths the TypeScript harness compares:
(a) `simulateRun` = `runSteps` with an `ask` that returns the policy's answer *without
suspending* (`suspendCoroutineUninterceptedOrReturn { answerWith(p, policy, rng) }`), so
the whole run executes inside one `resume`; (b) `RunSession.decide` fed by `answerWith`
outside the session; (c) `RunSession.decide` fed by `answerWith` through the storyboard
driver's token-armed answer path (a headless `RunHost`). All three must produce the
identical canonical result text and the identical draw count. Policies draw from the run's
rng (`random`'s `act` is a `pick`; `balanced`'s `shrine` is a coin), so a replay from a
harness-recorded log must **burn** those draws: every logged answer carries `draws=<n>`,
the number of rng draws its answerer consumed, and `replay` draws n times before feeding
it. A log recorded by the app or the storyboard driver has `draws=0` throughout.

### T2.4 The presentation model

As today: the phase is derived, never stored — `phase = session.pending()?.kind ?: ROOM` —
and one `when` in `:ui`'s `RunHost` composable maps each pending to its screen, hands the
screen a `RunView` and a `decide(answer, token)` callback, and nothing else. No navigation
library: the run *is* the navigation. Screens are composables over a state object built
from the view (`ScreenState`), which is what the screen tests construct directly from
fixtures. PAUSE, INSPECT, ARCADE and settings are overlays owned by `RunHost`. The battle
screen resolves its `skill-N` and target activations to an option index of the
`HERO_TURN` pending it is showing, never from a list it enumerated earlier.

Every frame `:ui`'s scene builder turns the run's state into a `StageScene` and `Stage`
draws it; the HUD plates, panels, ribbon, command list, cards, map, party columns and every
button are composables placed in the logical 1280×720 space (§ T9.1). Every tap target is a
semantics node with a test tag and a logical rect, so the drivers can tap by tag *or* by
contract geometry, and keyboard focus is one model for both (§ T9.9).

### T2.5 The engine mapping

| `engine/*.ts` today | In Kotlin |
|---|---|
| `loop.ts` fixed-step accumulator, focus clamp, auto-pause | `withFrameNanos` driving a fixed 60 Hz accumulator with the same 250 ms clamp; lifecycle pause from the shells; the clock is injected so tests own time and the storyboard can jump it |
| `input.ts` keys, pointer, hit regions, spatial focus | Compose pointer and key events → the same button model (A = Space/Z, B = X/C, PAUSE = P/Esc, digits for skills; Android back = B); the region registry ported as `Focusables` (drawn-first two-pass test, `TAP_MIN` 96 expansion, twins, the ±50° cone) over semantics nodes for UI and stage rects for actors |
| `scenes.ts` | a sealed `Scene` with the same enforced transitions |
| `draw.ts` sprites, bitmap fonts, bake, dither, bevel | atlases kept at cell resolution, as today's bakes already are; `drawImage` scaled to the device with `FilterQuality.None` or `Low` (§ T9.3); glyph atlases baked from the exported glyph tables; the HUD face through `TextMeasurer` with one bundled font; the vector pictograms as `Path` data |
| `palette.ts` | the same tables and `contrast()` |
| `particles.ts`, `juice.ts` | ported as pure Kotlin over pooled arrays with the per-biome ambient presets; shake rounds to whole logical px; flash and hit-stop as today |
| `audio.ts` | the synthesizer ported as a pure function of an injected seed in `:tools:audio`, run at build time to WAV — two or three variants per clip where the source draws `Math.random` at play time — and `SfxPlayer` (`expect`) plays clips with gain; pitch by resampling in common code (the desktop's `javax.sound.sampled` has no pitch control); cooldowns per name in common code (D12) |
| `ui.ts` safe inset, plates, dim | the mutable inset fed by the platform's insets; plates and dim as composables and draw helpers |
| `light.ts` | the rig in `:engine`: planes arrive **unblurred** from the export; the rig bakes far/mid/near blur (6 / 1.2 / 8 px, the floor crisp), the light map (key, fill, the two foot pools **derived from `Layout`'s anchors** with the 60-px overlap clamp), the grade with its vignette and the tier variants (MED's merged mid+floor, LOW's flat) once per biome at boot or on biome entry; per frame it draws the **drifting fog banks**, the **seeded dust motes** and the **light shafts** as composites of baked sprites behind the actors, the per-actor gain (`ColorDodge`, feet-tested, spread-capped), the rim spill (`Plus`), contact shadows with their cast lobe, a lit prop's pool, the sky body after the grade, and honours `note(frameMs)` |
| `crt.ts` | scanlines, vignette and flicker as overlays; halation from the bloom buffer (§ T9.4) |
| `runtime.ts` | dropped — there is no host |

## T3 Toolchain and versions

| Tool | Pinned at writing | Role | Notes |
|---|---|---|---|
| Kotlin | 2.4.20 | language and KMP | K2; `-Xexplicit-api=strict` on `:core`, `:engine`, `:ui`; `allWarningsAsErrors` everywhere |
| Compose Multiplatform | 1.12.0 | UI, stage, resources, previews, tests, hot reload | 1.10 made `@Preview` common and Hot Reload stable; 1.11 shipped the v2 UI-test APIs; 1.12 added an MCP server to Hot Reload for agents |
| Gradle | 9.x (the current 9 at P1) | build | configuration cache and build cache on; `--warning-mode=fail` |
| Android Gradle Plugin | 9.3 | Android target and app | the KMP Android library plugin (`com.android.kotlin.multiplatform.library`) for `:core`, `:engine`, `:ui`; its host tests run on the JVM, its device tests on an emulator or phone |
| JDK | 21 LTS | toolchain | Gradle toolchains pin it |
| Node | 22.x, pinned in `.nvmrc` and `package.json`'s `engines` | the oracle's runtime | the `pow` table and every golden are recorded on the pinned version |
| Kotest | 6.x with its `io.kotest` Gradle plugin (KSP-based) | tests on every target, property testing | annotation configuration is JVM-only, so configuration is by code |
| detekt | 1.23.x stable, 2.0 when it leaves alpha | smells, complexity, custom purity rules, Compose rules | syntax-only rules in L0 on changed files; type resolution over the tree in L2a, never in a fast lane (type resolution on a KMP tree is slow in 2.0's alphas); if neither version parses the Kotlin 2.4 syntax `:core` uses, the budgets are enforced by the syntax-only rules plus Konsist and type-resolved detekt is dropped — a recorded fallback, not an alpha in a gate |
| ktlint via Spotless | current | formatting, auto-fixed | detekt's formatting rules stay off |
| Konsist | 0.17.x | architecture tests | scoped to the touched module in L1, the whole tree in L2a |
| KGP ABI validation | in Kotlin 2.2+ (experimental DSL; the check task is `checkLegacyAbi` at writing) | the public API of `:core` and `:engine` as a reviewed dump | a JVM-only variant in L1; the klib variant (every native and Wasm target) in L3 |
| Kover | current | coverage with thresholds | JVM-measured for common code |
| Pitest | current (JVM) | mutation testing of `:core` and `:engine`'s pure packages nightly | P0 spike; if it will not run on the KMP JVM target, the fallback in § T6.5 applies |
| Roborazzi | current | screenshot goldens on desktop (the gate) and iOS (informative) | |
| Compose Hot Reload | 1.2 | live loop on desktop; MCP for agents | not a gate; an instrument |
| dependency-analysis plugin | current | unused and undeclared dependencies (`buildHealth`) | L3 |
| Android Lint | AGP's | app and library checks | fatal on a chosen set, no baseline |
| Maestro | current | device flows on emulator, simulator and the phones | L4 |
| actionlint, shellcheck, markdownlint, a custom spec-lint | current | workflows, scripts, documents, the spec | L0 |
| Renovate | — | one **monthly** batch pull request for dependency bumps, through the full lanes, reviewed by the owner like any change to the build | the catalog is the single source of versions |

Upgrade policy: one batch per month; the full merge lane must pass; a tool that breaks on a
Kotlin upgrade blocks that upgrade until fixed, replaced or, with the owner's sign-off,
removed together with a replacement for its catch.

## T4 Repository and migration mechanics

### T4.1 During the port

The root stays the TypeScript game. `kmp/` is a self-contained Gradle project and `spec/`
a sibling at the root; nothing at the root imports either. The repository's own mechanics
change at **P1**, because the plan changes them whether it says so or not:

- **The Pages deploy ignores the port.** `.github/workflows/pages.yml` triggers on every
  push to `main`; it gains `paths-ignore: ['kmp/**', 'spec/**', 'plan/**', '**/*.md']` so
  that a KMP commit never redeploys the live game.
- **`main` is protected by a ruleset** — a pull request required, required checks, branches
  up to date, linear history, a code-owner review on the gate paths, an **empty bypass
  list** (the owner included; an emergency override is a logged ruleset edit) — for the
  whole repository, because GitHub protects branches, not paths. There is **no merge
  queue**: it exists only for organization-owned repositories, and a transfer would move
  the Pages URL. The KMP workflows run path-filtered on `kmp/**` and `spec/**`, and each
  required check has an always-run **shim job** that reports success when the filter
  skipped the real one, so a root-only pull request is not blocked. The TypeScript release
  path therefore becomes a pull request: the `releasing-the-game` skill is rewritten at P1
  (its gates unchanged, `git push origin main` replaced by a pull request the owner merges).
- **Two identities** (§ T1, D17): the machine user for the agents, the owner as the reviewer.
  `CODEOWNERS` names the owner for `kmp/ci/**`, `kmp/build-logic/**`, every analyser
  configuration, `.github/workflows/**`, `spec/golden/**` and its sidecars, and
  `spec/balance/**`.
- **No request reaches the frozen rules by default.** The root `CLAUDE.md`'s skill-routing
  table is rewritten so every game-change row routes to a `kmp-*` skill, and
  `iterating-on-a-game` gains a refusal preamble ("the TypeScript rules are frozen — route
  to `kmp-iterating`"); the CI guard is § T4.2's `oracle-frozen` job.
- **The hand-off documents say so too** (at P0's exit, when questions 1, 2, 6 and 7 close):
  `STATUS.md`'s "Next, in order" is rewritten to point at `plan/`;
  `.claude/prompts/pixel-pipeline.md` is marked superseded with a pointer; `DESIGN.md`'s
  delivery table carries a banner. A fresh session that follows the repository's own
  read order must land here, not in the TypeScript art loop.

`kmp/CLAUDE.md` holds the conventions for the tree (Claude Code loads nested `CLAUDE.md`
files when working under them).

### T4.2 The oracle

The order matters. `tools/export-assets.mjs` lands at **P0** (§ T10.9, the spikes need it).
At P2, in this sequence: (1) the harness gains `--trace` (§ T5.3), `--ascension`, a
canonical `--dump` (§ T5.4) and a strong-party battle fixture; the capture driver gains
`strong=1`; (2) `main` is tagged **`ts-oracle-v3`**; (3) the `oracle-frozen` CI job
becomes a required check: it fails any pull request whose diff touches `game/sim/**`,
`game/data/**`, `game/types.ts` or `game/screens/vault.ts` relative to the tag. From then
on those paths are **never edited again**; the guard is by path, not by directory, because
`oracle/` only exists after P8.

The TypeScript changes the plan allows, none under the frozen paths, all recorded from
*outside* the rules:

- `sim/run.mjs`: `--trace` — the rng is injected, so the harness wraps it and logs every
  draw; `runSteps` and `answerWith` expose every pending and answer; `createBattle`,
  `nextReady` and `runTurn` expose the event stream and the hero turns, and the traced
  drive becomes a fourth path of `--selfcheck` (it must reproduce `simulateRun`'s result);
  `--ascension <A>` into `RunConfig`; `--dump` redefined over the canonical result encoding
  so it is comparable between the builds; a strong-party fixture (the harness's three
  kindled relics on the fixture party) for the home-act battle cells.
- `tools/capture.mjs`: `strong=1` seeds `localStorage['ember-quest/vault']` before boot
  with the harness's three kindled relics and `vaultSlots 3`, so the driver equips them on
  the real EQUIP face and the scripted drive reaches acts 3–6 (`STATUS.md`'s "Next" item 3;
  `__eq.config` is a getter and stays one).
- `tools/export-assets.mjs` (P0): every actor's fifteen bakes and every biome's unblurred
  planes with the light data (§ T10.9); re-run at P4's start from a named tag.
- `tools/lineup.ts` (P0): PNG input with the sidecar contract, and the `PixelActor`
  registry so a PNG candidate stands on the real stage (§ T10.4).
- `.github/workflows/pages.yml`: the path filter (§ T4.1).
- `game/screens/vault-export.ts` (new file): the Vault transfer export
  (`FUNCTIONAL.md` § F2.4), presentation only, if the owner approves the row —
  `vault.ts` itself is frozen because `minAscensionFor` lives there.

### T4.3 Promotion (P8)

`kmp/*` moves to the root; `spec/` stays where it is; the TypeScript tree moves to
`oracle/` with its lockfile, kept buildable (`npm ci && node sim/run.mjs --trace …`) because
`diff-oracle` keeps running nightly against it until the goldens are re-frozen from the
Kotlin harness (`VERIFICATION.md` § V8), and **`pages.yml` is rewritten to build from
`oracle/`** (a working directory and an inverted path filter) so the live URL keeps
serving until P9 switches it. `CLAUDE.md`, `STATUS.md` and the skills are rewritten;
`DESIGN.md` becomes the narrative of `spec/` (§ T7.6).

## T5 The rules port

### T5.1 Order and method

Each module is ported by TDD against the oracle in this order, each one gated before the
next starts; for each module the clause tests and the oracle traces are written **before**
the transcription: `types` and `data` (a table dump of every data structure from Node
compared to the Kotlin tables; `validateData()` returning `[]`) → `rng` (test vectors: the
first 10 000 outputs of `mulberry32(seed)` for seeds 1, 2, 7, 4242 and 0xFFFFFFFF as raw
bits; the `jsRound` and `pow` tables) → `relics` (tests from the `relics` clauses —
`rollRelic`'s eight ordered draws, ranges, the +2/+4/+6 events, the forge modes, the set
pool, the sigil pairs — plus `rollRelic` traces from the oracle; there is no existing relic
test suite to port) → `battle` (event traces per fixture and policy) → `run` (`RunResult`
and pending/answer traces; `minAscensionFor` with its vector from the oracle's screen) →
`session` (the three-way self-check) → the policies (their answers are in the traces).

The port is **literal**: the Kotlin follows the TypeScript function by function, expression
by expression, in the same evaluation order. Today's rules functions are far over the
simplicity budgets (`castSkill` 98 lines, `buildMap` 86, `runSteps` 97, `validateData` 192;
cyclomatic complexity in the twenties and forties), so **`:core` is exempt from the
complexity and length budgets until the P3 parity gate** — a dated suspension in
`kmp/CLAUDE.md`'s budget table; the purity and edge rules apply from the first line. The
split into budget-sized functions is the first post-parity task, made under the goldens.
Cleverness is for after parity.

### T5.2 Numeric fidelity

| TypeScript | Kotlin | Rule |
|---|---|---|
| `number` | `Double` | IEEE 754 binary64 on every target |
| `Math.floor`, `Math.min`, `Math.max` | `floor`, `min`, `max` | never on NaN (a rule forbids NaN-producing operations in `:core`) |
| `Math.round` | `jsRound(x) = floor(x) + if (x - floor(x) >= 0.5) 1 else 0` | Kotlin's `round` rounds half to even and `roundToInt` differs per platform on ties; `jsRound` is tested against a Node-generated table of 10 000 values including `0.49999999999999994`, `2.5`, `-2.5`, `-0.5` (a reviewer's 200 000-sample check found no mismatch) |
| `Math.imul`, `>>> 0`, `>>> n`, `\|`, `^` | `Int` multiply (wraps), `toUInt()`, `ushr n`, `or`, `xor` | the PRNG's arithmetic; the seed is a `UInt` so `0xFFFFFFFF` is a legal seed |
| `Math.pow(LAP_MULT.*, lap − 1)` | a **table** of the oracle's own `Math.pow` results for the three bases at exponents 0–31, generated on the pinned Node and committed as data with its test vector; an exponent past the table is an assertion failure (a lap past 32 is unreachable under `LAP_MULT`) | V8's `pow` is fdlibm's, not correctly rounded for exponents ≥ 3; a multiplication loop matched it on every value tried (27 of 27) but is not guaranteed to; the table is exact by construction |
| `a × b × c` | `a * b * c` | verbatim, left to right; never re-associated or simplified |
| a numeric-difference comparator (`(a, b) => a.x - b.x`) | a `Comparator` returning the **sign** of the same difference (`compareValues` on the same keys in the same order), never `toInt()` | the same total order, no overflow |
| `Array.sort` (stable in V8) | `sortedWith` (stable) | the same comparator order |
| `Object.keys` insertion order, `Record` iteration | `LinkedHashMap` or lists in the data's textual order | data order is contract |
| `WeakSet` for OPENER's first-cast gate | a flag on the battle actor | the same observable behaviour |
| `config.roster` empty → `ROSTER` in `runSteps`, but a SUMMON reads the raw `config.roster` | reproduced as is | a quirk of the oracle (a reviewer measured 0/200 wins on an empty roster against 30/200 on the explicit six); a `RUN-CONFIG` clause names it as contract until the first post-parity rules change; the trace prints the config **as passed** |
| `Math.random` | forbidden | the rng is injected; Konsist and detekt both forbid `kotlin.random` in `:core` |
| a double printed as text | never in a hash — raw IEEE bits everywhere a value is not provably integral | `Double.toString` differs per target (the JVM switches to exponent notation below 1e-3, V8 below 1e-6; Native and Wasm have their own); `Probe.hitFrac` and `partySpd` alone would break the hash |

**Determinism on the product runtimes.** Android host tests run on the JVM, so they prove
nothing about ART. The cross-platform hash test — 20 seeds × 3 policies × both harness
modes, hashed against a committed expectation — runs as a JVM test, as an Android device
test on an **x86-64 emulator with KVM** in L3 (ART's arithmetic, not arm64's), on the iOS
simulator on an Apple-silicon runner in L3, and on the reference phones — or Firebase Test
Lab physical devices — nightly, which is the **arm64 truth**; P3's gate needs it green
once on an arm64 device. On wasmJs it is informative until P9. A mismatch on any product
runtime is a P3 blocker; the fix is in the expression, never in the expectation. The FP
risks are libm and text formatting (both removed above), not fused multiply-add: Wasm's f64
arithmetic does not contract, and the JVM's is strict.

### T5.3 The canonical trace

A line-oriented text format written identically by `sim/run.mjs --trace` and `sim trace`,
LF line endings, one trailing newline, UTF-8, hashed with SHA-256; the hash is the parity
currency. One record per line; the record kinds and their fields, in order:

| Record | Fields |
|---|---|
| `trace 1` | the format version |
| `mode <runs\|battles\|selfcheck> path=<a\|b\|c>` | which harness mode and, for runs, which seam path produced it (§ T2.3); the golden path for `runs` is **b** |
| `cell seed=<uint32> policy=<name> runs=<N>` | a cell is N runs on **one** rng stream in run order, as the harness runs them today |
| `config` | every `RunConfig` field **as passed**: `ascension`, `vaultSlots`, `roster` (empty allowed), `spdDelta`, and each Vault relic in the compact relic encoding of § T11 |
| `run <k>` | the k-th run of the cell (from 0); the `draw` index continues across the cell's runs |
| `draw <i> <hex64>` | the i-th rng output of the cell as the raw bits of the double |
| `pending <KIND> <fields>` | the pending's kind and its data (offers, cards, options as ids and indices); `ENEMY_TURN` is **not** recorded |
| `answer <KIND> <fields> draws=<n>` | the answer given and the draws its answerer consumed; `answer HERO_TURN option=<k> draws=<n>`; `answer FORFEIT draws=0` |
| `event <KIND> <fields>` | one per `BattleEvent`, fields per kind: `TURN_START actor enraged` · `TURN_END actor` · `CAST caster skill targets` · `HIT attacker target dealt absorb crit glance killed` · `STATUS_APPLIED\|RESISTED\|EXPIRED target status turns` · `HEAL target amount source` · `ATB_CHANGE actor delta(bits) reason` · `COUNTER actor target` · `DEATH actor` · `BURN_TICK actor amount` · `VEIL actor` · `STALL` — actors as `H<slot>` / `E<slot>`, skills and enemies by id |
| `result` | every `RunResult` field in the order `game/types.ts` declares them; arrays comma-joined; relics in the compact encoding |
| `probe <n>` | one per `Probe`, every field, doubles as bits |
| `end <draws> <sha256-of-the-run's-lines>` | closes a run; the per-run hash is over that run's records from `run <k>` to here |

Integers print as integers only when the TypeScript value passes `Number.isInteger` and the
Kotlin value round-trips through `toLong()`; every other double prints as bits. `diff-oracle`
has a pretty printer for humans; the hash is over the raw form.

**The golden set** (recorded at P2 from the oracle on the pinned Node; replayed by the
Kotlin harness):

| Cell | Runs / battles | Purpose |
|---|---|---|
| `runs`: seeds {1, 2, 3, 7, 4242} × nine policies × 10 runs | 450 | the baseline |
| `runs`: `balanced` at A0, A5, A10 × `--vault 0/3` × `--spd 0/+10/−10`, seed 1 × 10 runs | 180 | ascension rows, the Vault, SPD deltas |
| `runs`: `lapper` seeds {1, 2} × 100 runs | 200 | laps 2–4 (the `pow` table in use) |
| `battles`: the act-1 fixtures × the two act policies × 100 battles | ≈ 1 600 | the turn, statuses, counters |
| `battles`: every pack of every biome (`fights`, `elites`, the boss — about 48 packs) at its home act, A0 and A5, the strong-party fixture, `balanced` × 20 battles | ≈ 1 920 | every enemy, every boss's fourth skill; the strong party survives late acts |
| `battles`: a long fixture (the strong party with three GUARD relics against the act-6 boss at A10), tuned at P2 until an ENRAGED turn appears | 20 | ENRAGE |
| the balance snapshot: `balanced` and `random`, seed 1, 200 runs each | 400 | § T5.5 |

`sim coverage` reports every `BattleEvent` kind, status, set bonus, sigil effect, pending
kind, room type and ascension row that appears in the set; **P2's gate requires every kind
to appear at least once**, and a cell is added until it does. Storage: `spec/golden/<cell>.
sha256` lists one hash per run or battle plus the set hash; the full text of one run per
policy at seed 1 and one battle per fixture (≈ 3 MB) is kept under `spec/golden/probe/` for
diagnosis; everything else is regenerated from the oracle on demand and kept as a CI
artifact. A reviewer measured a `balanced` run at ≈ 1 100 draws, 54 pendings and 1 800
events (≈ 0.2 MB of text), so the full set is a few hundred megabytes — never committed.

### T5.4 The harness

`sim <command> [flags]` reproduces `sim/run.mjs` mode for mode: `battles`, `runs`,
`selfcheck`, `spd-gate` (the bare `--spd` gate), `snapshot` (§ T5.5), `trace`,
`trace-hash`, `diff-oracle` (runs the TypeScript harness at the repository root until P8
and under `oracle/` after, regenerates the cell, and prints the first divergent line; needs
the pinned Node and `npm ci`, so it runs in L3 and nightly, while L2a replays the committed
hashes), `fixtures` (the home-act pack generator), `coverage` (the trace-coverage report)
and `replay <save>` (§ T11); flags `--policy --seed --runs --n --spd --vault --ascension
--json --dump`. `--dump` is the SHA-256 of the canonical result encoding on both sides
(the TypeScript harness's `--dump` is redefined to match at P2 — a harness change outside
the frozen paths), so it is comparable between the builds.

### T5.5 Balance reproduction

The `DESIGN.md` Balance state table is reproduced from the same seeds and run counts before
P3 closes, and becomes `spec/balance/state-full.md` (the contract's recorded basis: 5 000
runs on seed 1 and 2 000 on seed 2, plus the four verification seeds at 2 000, per policy —
about 135 000 runs, 10–15 minutes of harness time, nightly) and `spec/balance/state-reduced.md`
(200 runs, seed 1, `balanced` and `random`; ≈ 2 s; the commit lane). Both are exact
reproductions of identical inputs: a number moves only with a rule clause change in the
same commit. A reviewer reproduced the contract's `balanced` seed-2 row exactly on today's
code, so the basis is sound.

### T5.6 Public API

`:core` is compiled with explicit API mode; its JVM ABI dump is committed and checked in the
module lane, the klib dumps in the merge lane. The surface is what `:ui`, `:sim` and the
tools need — the same exports `game/sim/*` has today, plus `session` and `codec` — and
nothing exposes mutable state: results, views and snapshots are immutable data classes; the
battle's mutable actors live inside `Battle` and are read through snapshots by the screens.

## T6 TDD — how the team builds

### T6.1 The cycle, as an agent runs it

1. Pick a clause (`spec/…`, § T7) or write one (status `proposed`) for the behaviour.
2. Write the failing test, named `"<CLAUSE-ID> <what it checks>"`, in the owning module's
   `commonTest`. The edit hook (L0, ≤ 8 s) formats, lints and compiles the touched module.
3. Write the least code that passes. Run the module lane (L1, ≤ 90 s): the touched
   modules' fast tests, Konsist, the JVM ABI check, the matrix for the touched clauses.
4. Refactor under the analysers until L1 is clean — the analysers are part of green.
5. Repeat until the milestone; run the commit lane (L2a + L2b, `gate.sh commit`); commit
   with the clause ids in the message. The pre-commit hook runs L1; the pre-push hook runs
   the commit lane.
6. A blind verifier (§ T6.3) writes its own tests from the same clauses in a separate
   worktree; both sets merge; a disagreement is filed against the clause, not the test.

For the port (P3) the same cycle applies with the clause tests and the oracle traces written
before each module is transcribed; TDD in the brief's full sense — the test shapes the code
— governs every change after parity. The escalation rule stays: a lane failing twice on the
same approach means change the approach or escalate the writer's model tier; never loosen
the gate.

### T6.2 The test taxonomy

| Kind | Lives in | Checks | Lane |
|---|---|---|---|
| Unit per clause | `:core` commonTest, `:engine`, `:ui` | one rule, named by its clause | L1 |
| Property | `:core` commonTest (Kotest property testing, bounded iterations in the fast lanes, more nightly) | invariants: no compounding, `hp ≤ maxHp`, the dead never act, the rng stream is consumed identically by the three seam paths, every closed union interpreted | L1 (100 cases) · L4 (10 000) |
| Table-driven | `:core` | the spec's tables (enemy scale per act, roll ranges, loot weights), generated into `SpecTables.kt` by the binder | L1 |
| Differential | `:sim` tests | the committed golden hash lists (L2a); `diff-oracle` against a regenerated trace (L3, nightly) | L2a · L3 |
| Snapshot | `:sim` | the reduced balance table (L2a); the full table (L4) | L2a · L4 |
| Cross-platform hash | `:core` test tasks per runtime | determinism on the JVM, x86-64 ART, the iOS simulator (L3); the arm64 phones or farm devices (L4) | L3 · L4 |
| Architecture | Konsist suite in `build-logic`'s quality plugin | boundaries, purity, naming, suppression budget, an assertion in every test body | L1 (touched module) · L2a (tree) |
| Screen | `:ui` commonTest with `runComposeUiTest` | semantics: what is on screen, what is enabled, what a tap answers; virtual time | L1 |
| Screenshot | `:ui` jvmTest with Roborazzi, inside the environment image | goldens per fixture at k = 1 | L2b · L3 |
| Storyboard | `:tools:instruments` | skip-playback: every biome, boss and screen reached with the strong party and the forcing hooks, once by tag and once by keyboard; a two-act run to a KO (L2b); full playback with frames (L3); Android and iOS, two acts (L4) | L2b · L3 · L4 |
| Visual parity | `:tools:instruments compare` | the exported TypeScript frames against the Kotlin frames, within the band of `VERIFICATION.md` § V3.11 | L2b until P8, then retired with the oracle |
| Asset gate | `:tools:art` tests over `kmp/assets/actors/**` (`assets/legacy/**` exempt and reported) | every committed actor against the bible's pass thresholds | L2b |
| Perf | `:tools:instruments` on JVM; Macrobenchmark and XCTest metrics on the phones | frame-time histograms, allocation rate, peak memory, app size | L2a (JVM) · L3 (size) · L4 (devices) |
| Mutation | Pitest on `:core` and `:engine`'s pure packages | the tests kill the mutants | L4 |
| Device | Maestro flows | boot, the first ten minutes, every edge target under gesture navigation, the tier drop under forced slow frames, audio audibly playing | L3 (boot, audio) · L4 (flows) |

### T6.3 The writer and the verifier

Every writer gets a blind verifier, as today, made mechanical: the verifier receives the
clause ids and the spec, never the writer's diff or report; its worktree is checked out at
the **spec commit**, not the writer's branch, so blindness is structural; it writes tests
tagged `Verifier`; the coordinator runs those tests against the writer's branch. Tests that
both wrote stay; tests only the verifier wrote are the interesting ones. The binder marks a
clause bound only by `Writer`-tagged tests as **weak** in the matrix, and a weak clause
does not count toward P3's "matrix 100 %". The critic role (an agent with eyes) is separate
again and reads the review bundle (`VERIFICATION.md` § V3.12).

### T6.4 Test hygiene

No sleeps, no wall clock, no network, no filesystem outside a test's temp dir, no shared
mutable state between tests, no order dependence (Kotest runs specs in random order in
CI), no retries anywhere in CI configuration for *tests* (infrastructure failures have
their own rule, `VERIFICATION.md` § V5). Every test body contains at least one assertion
(a Konsist rule). Builders and fakes live in `:core-testing`; fixtures are data in
`spec/fixtures/`, generated into Kotlin by the binder. A test is named by its clause; a
test that cannot name a clause is either a proposed clause or a smell. Tags select lanes:
`Fast`, `Golden`, `Sim`, `Screen`, `Device`, `Nightly`, and `Writer` / `Verifier` for
authorship.

### T6.5 Coverage and mutation policy

| Module | Line | Branch | Per-file floor | Mutation (nightly) |
|---|---|---|---|---|
| `:core` | ≥ 95 % | ≥ 90 % | 80 % | ≥ 85 % killed on `battle`, `relics`, `run` |
| `:engine` | ≥ 80 % | ≥ 70 % | 60 % | ≥ 75 % on the pure packages (particles, juice, light math, focus) |
| `:ui` | ≥ 70 % plus a golden per fixture | — | — | — |
| `:sim`, `:tools:*` | ≥ 60 % | — | — | — |

Thresholds only rise. If Pitest cannot run on the KMP JVM target (P0 spike), the mutation
lane is replaced by the property suite at 10 000 cases nightly plus the oracle diff, the
README's risk register records the loss, and the assertion-per-test rule and the verifier's
tests carry the "tests that test" burden.

### T6.6 What TDD means for screens and art

A screen change starts with the semantics test (what must be on the screen, what is
tappable, what an answer is) and the fixture; the screenshot golden is *recorded* after the
critic approves the frame, never written first — goldens are approved artefacts with an
approval record (`VERIFICATION.md` § V5). An asset change starts with the gate (the numbers
it must meet) and ends with the critic and the owner; the committed asset is then re-checked
by the gate on every build.

## T7 Executable specifications

### T7.1 Shape

`spec/` holds Markdown files, one per topic, written in `DESIGN.md`'s voice (prose, tables,
constants in CAPS) but cut into **clauses** with stable ids:

```markdown
### COMBAT-TURN-05 — statuses tick at turn start, before the action
status: contract
owner: :core
paths: core/src/commonMain/kotlin/battle/Turn.kt

Every duration on the acting actor decrements by 1 at step 5 and a status at 0 is removed,
before the action. STUN(1) therefore skips exactly one turn; a self-buff authored at 3
covers two own actions. `STATUS_TURNS` is the table below.

data: STATUS_TURNS
types: enum:StatusKind, int
| kind | turns |
|---|---|
| STUN | 1 |
| … | … |
```

- Ids follow `AREA(-TOPIC)?-NN`. Areas, each with a canonical example: `COMBAT`
  (`COMBAT-TURN-05`), `RELICS` (`RELICS-ROLL-02`), `CHARACTERS` (`CHARACTERS-EMBER-01`),
  `ENEMIES` (`ENEMIES-SCALE-03`), `RUN` (`RUN-MAP-04`, `RUN-FLOW-02`, `RUN-CONFIG-01`),
  `META` (`META-VAULT-01`), `BALANCE` (`BALANCE-LADDER-01`), `PLATFORM`
  (`PLATFORM-BACK-01`), `SCREENS` (`SCREENS-BATTLE-07`), `ART` (`ART-12`), `GOLDEN`
  (`GOLDEN-03`), `SAVE` (`SAVE-02`). Ids are never renumbered or reused; a retired clause
  keeps its id with `status: retired` and a pointer to what replaced it.
- `status` is `proposed` (written, not yet bound), `contract` (bound to passing tests) or
  `retired`; a `known-divergence` note may accompany `proposed` (§ T7.6).
- `owner` names the module whose tests bind it; `paths` lists the source files that
  implement it, so the binder can map a changed file to its clauses. `paths` must exist
  for a `contract` clause; a `proposed` clause may name files that do not exist yet.
- A table marked `data: NAME` with a `types:` line is extracted by the binder into
  `SpecTables.kt` as a typed value, so the document's numbers are the tests' numbers.
- **Granularity**: one clause per independently testable rule or per table; a clause the
  tests cannot name by itself is too coarse, a clause with no test of its own is too fine. A
  clause is ≤ 60 lines.
- Prose without a clause id is commentary and binds nothing.

### T7.2 Binding

A test binds a clause by name: the test's name starts with the id
(`"COMBAT-TURN-05 STUN skips exactly one turn"`). The `spec-binder` task (in `build-logic`):

- generates `SpecTables.kt`, `SpecFixtures.kt` and the golden hash constants into a
  generated `commonTest` source set before compilation;
- after the tests, parses `spec/**` and the JUnit-style reports of every test task in the
  lane (Kotest writes them on every target; the binder reads one report per task and
  merges), and writes `build/reports/spec/matrix.md` and `.json`: per clause, its status,
  the tests bound to it, their tags (writer, verifier) and results;
- fails the lane when a `contract` clause has no passing test in the lane's scope, when a
  test names an unknown id, or when a `proposed` clause has been bound by passing tests
  for more than one commit (it must be promoted). The scope of L1 is the clauses whose
  `paths` intersect the touched modules; L2a's scope is everything. The "one commit" rule
  keeps its state in `spec/matrix.lock` — one line per clause, `id status since-commit` —
  written by the L1 lane in the **pre-commit** hook and staged into the commit it checks.

Agents read the matrix as the first page of every verification report. The binder has its
own tests (`VERIFICATION.md` § V9).

### T7.3 Goldens as specification

`spec/golden/<cell>.sha256` and `spec/golden/probe/*.trace` with a `GOLDEN-NN` clause per
cell saying what it fixes (seed, policy, mode, ascension, the rules version, the Node
version). The commit lane replays the hash lists. A golden may change only in a commit that
also changes a `contract` clause of the rules, bumps `RULES_VERSION`, names the cells it
expects to change and carries an approval record (`VERIFICATION.md` § V5); the merge lane
checks all four. A golden that changes without a clause is a bug, whichever of the two is
wrong.

### T7.4 Screens and flows

`spec/screens/<screen>.md` holds region clauses (the geometry, transcribed from
`layout.ts` as the ruler `:engine`'s `Layout` reads), enabled/disabled rules, the screen's
`ScreenState` schema for its fixtures, and flow clauses in Given/When/Then prose, bound to
`runComposeUiTest` tests by id. The storyboard's expectations (which screens a run must
cross, in which order, every biome and boss reached with the strong party and the forcing
hooks; the seed it uses) are `RUN-FLOW-NN` clauses bound to the storyboard test.

### T7.5 Art

`spec/art/bible.md` holds the bible (`FUNCTIONAL.md` § F3.1) as `ART-NN` clauses with the
numbers, each with its derivation and, for the aligned motion criteria, the bands recorded
at P0's calibration; `:tools:art`'s gate tests bind them over `kmp/assets/actors/**`. It is
written after the look fork closes (P0's exit).

### T7.6 Reconciling and folding `DESIGN.md`

At P2, **before** the fold, the contract is reconciled with the code: the six items
`STATUS.md` names under "DESIGN.md — what looks wrong now that it is built" (the
pixelated-plane amendment and the unstated gain; the missing value-order law; the ship
criteria living in ART-REVIEW.md; the absent frame budget; `minAscensionFor` and the
full-party SUMMON's mend; `compare()`'s blindness to set hooks), the internal contradiction
on the Vault's ascension floor between the *Difficulty targets* and *The Vault* sections,
and a clause-by-clause diff against the code. For each: either `DESIGN.md` is corrected
with the code as truth, or the clause is written as `proposed` with a `known-divergence`
note. Then the fold: section by section into `spec/` clauses that quote the text; nothing
else is reworded (parity before change). `DESIGN.md` keeps a banner pointing at `spec/`
and stays the narrative until P8, when it becomes `spec/README.md`. The fold can be
parallelised by area (the areas are the module boundaries). At P2's end the binder reports
the clause count per area, and P3 is re-sized against it. The fold is complete when every
clause is bound by P3's end.

### T7.7 Changing the contract

Clause first (`proposed`), then the tests, then the code, then promotion to `contract` in
the same PR; where a rule or a number moves, the simulator guards, the balance snapshot,
`RULES_VERSION` and the expected golden cells move in that PR too, with the arithmetic in
the clause. This is the designing-mechanics discipline made mechanical, and the
`kmp-spec-change` skill walks it.

### T7.8 Spec lint

Unique ids; the id grammar; the `status`, `owner` and `paths` lines present and valid
(`paths` existing for `contract` clauses); every `data:` table parsable with its `types:`
line; links resolve; a clause ≤ 60 lines; no two clauses with the same title; goldens have
hashes and a `GOLDEN` clause. Runs in the edit lane on `spec/**`.

## T8 Static analysis and code health

The set, what each catches, where it runs. "Simple and easy to change" is enforced through
the budgets in § T8.3.

| Tool | Catches | Lane |
|---|---|---|
| Kotlin compiler: `allWarningsAsErrors`, explicit API on `:core`/`:engine`/`:ui`, progressive mode | unused code, implicit visibility, inference surprises, deprecated APIs | L0 |
| detekt, syntax-only rules on changed files | size, nesting, return counts, `!!`, `lateinit`, exception swallowing, formatting-adjacent smells | L0 |
| detekt with type resolution over the tree (default rules at the budgets below, `detekt-rules-libraries`, Compose rules `io.nlopez.compose.rules`) | complexity, magic numbers outside `types`, Compose modifier and `remember` misuse, unstable parameters in hot composables | L2a |
| detekt custom rule set (`build-logic`) | in `:core`: any import outside the stdlib, any `kotlin.random`, any `println`, any `System.`/`Clock`, any `pow`; anywhere: a readback of the **display surface** inside `:engine`'s frame path (the bloom's own buffer is not the display surface); `Thread.sleep`/`delay` in tests | L0 |
| ktlint via Spotless | formatting; auto-applied by the edit hook | L0 |
| Konsist | module boundaries (§ T2.1), package layering inside `:core`, naming (`*Screen`, `*Spec`), every `@Composable` screen has a `@Preview`, every public `:core` function has a clause-named test in its module, an assertion in every test, suppression budget and expiry, no network library in `:app:*`, no `LaunchedEffect` in the stage | L1 (touched module) · L2a (tree) |
| KGP ABI validation | unreviewed public API changes | L1 (JVM dump) · L3 (klib dumps) |
| Kover | coverage thresholds (§ T6.5) | L2a |
| Compose compiler reports | unstable classes and non-skippable composables in `:ui`'s stage and HUD packages | L2a |
| Android Lint (fatal set, `checkDependencies`, no baseline) | platform misuse, resource problems, performance lints | L3 |
| dependency-analysis (`buildHealth`) | unused and undeclared dependencies, wrong configurations | L3 |
| Pitest | tests that do not test | L4 |
| Gradle `--warning-mode=fail`, configuration cache required | build script rot | every lane |
| actionlint, shellcheck, markdownlint, spec-lint | workflows, scripts, documents, the spec | L0 |
| Renovate | stale dependencies | monthly |

### T8.1 Suppression policy

A `@Suppress` must carry a `// why:` comment and either an issue reference or an expiry
date; Konsist counts suppressions per module against a budget (`:core` 10, `:engine` 20,
`:ui` 30) and fails above it; expired suppressions fail. No baselines anywhere: a baseline
is a suppression without a reason. **One dated exemption**: during P3, functions of
`:core` that are a literal transcription carry `@Suppress("LongMethod",
"CyclomaticComplexMethod", "CognitiveComplexMethod", "NestedBlockDepth", "ReturnCount") //
why: literal port of <file>:<fn>, expires at P3 parity` and are counted under a separate
`port` budget that the P3 gate zeroes; the split that removes them is the first
post-parity task.

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

A budget is raised only by a commit that says why in `kmp/CLAUDE.md`'s budget table; the
port exemption of § T8.1 is the only suspension and it has an end date.

## T9 Rendering and performance

### T9.1 The logical frame

`Frame` letterboxes a 1280×720 logical space into the window at scale
`k = min(w / 1280, h / 720)` in device px, centred, with the platform's safe insets and
gesture-navigation edges folded into the mutable inset (24 px all round; 40 px bottom on
phones; larger where a notch demands). Screens position composables in logical px through
`LogicalLayout` (a custom layout that applies `k`); `layout.ts`'s constants become
`Layout`, the shared ruler. Hit rects are grown to `TAP_MIN = 96` logical px around their
centre by the same registry. Goldens are rendered at `k = 1`.

### T9.2 The stage

`Stage` draws one `StageScene` per frame, in today's order: the baked planes at their
parallax offsets (far, mid, floor, near; depths 0.3 / 0.62 / 0.9 / 1.35) and the baked light
map (`Plus`); the fog banks, motes and shafts (composites of baked sprites, animated by the
injected clock, behind the actors); contact shadows; actors in painter's order, one
`drawImage` each; the per-actor gain (`ColorDodge`) and rim spill (`Plus`) from baked
feathered sprites; effect blits; damage pops; the bloom (§ T9.4); the grade (`Multiply`)
with the vignette; the sky body after the grade. Everything blurred is baked **once per
(biome, tier)** from the unblurred exported planes with a separable CPU box blur ×3 into
`ImageBitmap`s at boot or on biome entry; no platform blur effect is used in the frame
path. **Residency**: at most two biomes' bakes are held (the current and the previous);
entering a third releases the oldest. Bakes run off the main thread at the platform's
discretion.

### T9.3 Hard pixels and the device scale

Today's bakes are already at cell resolution (`bakeSprite(…, 1)`, drawn at `ACTOR_SCALE` 2);
the atlases keep that — 64 × 64 or 96 × 96 texels per frame — and one cell is drawn at
`2k` device px. Where `2k` is an integer (a 1080p phone letterboxes to `k = 1.5`, so a cell
is 3 device px), the actor plane is sampled nearest and is genuinely crisp; where it is not,
the actor plane is sampled bilinear — the web build's look — because uneven cells shimmer.
Decided once at boot from `k`; the setting is visible in the debug drawer.

### T9.4 Bloom and CRT (D11)

Today's bloom is frame-derived (read the frame at quarter resolution, self-multiply
threshold, blur, add back). The plan's default is a **bright-layer bloom**: the things
that are bright by design — VFX particles, prop glows, the sky body, pops — are drawn a
second time into a 320×180 `ImageBitmap` on the CPU, blurred with the same separable
blur, and added back (`Plus`) upscaled with smoothing. It is deterministic, identical on
every platform, allocation-free after warm-up (one buffer, one `IntArray`), and it costs
under a millisecond on a phone CPU. It is a visible difference and `FUNCTIONAL.md` § F1.3
lists it. The P0 spike renders **the first-ten-minutes screens** — title, draft, map, the
room card, a resting battle frame, INSPECT, PAUSE, GAME OVER — plus **one hit peak per
biome**, about sixteen frames, both ways, and a blind critic compares them; the
bright-layer bloom is accepted only if the critic prefers the frame-derived bloom on no
more than a quarter of them and on no hit peak; otherwise the fallback is a platform blur
on a bright-layer composable (`Modifier.blur` on Android 12+ and on every Skiko target)
with per-platform goldens, and D11 is amended. ARCADE's halation reads the same buffer on
every platform, so bloom and halation never both run and the contract's XOR holds;
scanlines, vignette and flicker are cheap overlays.

### T9.5 Budgets

| Where | Tier | Budget | Checked by |
|---|---|---|---|
| Desktop JVM, headless software Skia, 1280×720 | HIGH | the stage's draw p95 ≤ 9 ms at rest and ≤ 13 ms at a hit peak (today's web build measures 7.3 and 11.5 ms on the same kind of raster path); the stage's own draw allocates nothing, and the whole frame's allocation rate stays ≤ 2× the hello-world Compose baseline recorded at P1 | L2a perf test |
| Reference Android (2022 mid-range) | MED | frame p95 ≤ 12 ms at 60 Hz, including a hit peak; peak resident set ≤ 250 MB | L4 Macrobenchmark |
| Reference iPhone 12 class | MED | frame p95 ≤ 12 ms; peak resident set ≤ 250 MB | L4 XCTest metrics |
| Any device | LOW | never below 30 Hz; the auto-drop exercised by a forced-slow-frame device test | L4 |
| App size | — | ≤ 100 MB installed, re-derived at P4 from the real export, measured per build | L3 size test |
| Boot | — | title in ≤ 2 s cold on the reference phone | L4 |

`note(frameMs)` keeps the contract's rule: HIGH/MED drop to LOW after 60 consecutive
frames over 20 ms, one way, per session.

### T9.6 Text

The HUD face is one bundled open font (Inter or Roboto; chosen in P1 for its rendering at
18 px on Skia), drawn through `TextMeasurer`/`drawText` in the stage and `Text` in the HUD
composables; letter spacing and sizes are `Layout`'s, and the contract's character limits
are re-validated in the bundled face at P1. The two bitmap fonts are exported from
`engine/draw.ts`'s glyph tables and baked to glyph atlases; damage pops and the logo draw
from them with nearest sampling as today.

### T9.7 Memory and size (re-derived at P4 from the real export)

| What | Estimate | Note |
|---|---|---|
| Actor atlases | 645 frames at cell resolution: 555 × 64² + 90 × 96² texels × 4 B ≈ **12–14 MB** RGBA resident; a few MB as PNG | one bake per actor (its own element); cropping to the silhouette halves it again |
| Backdrops on disk | 24 unblurred planes (six biomes × far, mid, floor, near) ≈ 1360 × 800 each; **15–40 MB** as PNG, less with lossy WebP for the opaque far and floor planes | the light rig's parameters are data, not images |
| Backdrops resident | one biome at HIGH ≈ 26 MB of baked bitmaps (four planes, the light map, the grade at 1360 × 800 × 4 B); two biomes resident ≈ 52 MB | § T9.2's residency rule |
| Sound | 24 clips, two or three variants each ≈ 4 MB as WAV, ≈ 1 MB as Ogg | |
| Install | ≤ 100 MB | the size test fails the merge lane above budget |

### T9.8 Audio

`:tools:audio` ports the synthesizer as a pure function of an injected seed (oscillators,
envelopes, the noise buffer, the static soft-knee limiter curve) and renders the 24 clips
to WAV at build time — two or three seeded variants for the clips whose source draws
`Math.random` at play time (the start offset, the partials' timing, the noise) — tested by
hash. `SfxPlayer` (`expect`) has one implementation per platform (Android `SoundPool`, iOS
`AVAudioEngine`, desktop `javax.sound.sampled`) with `play(clip, gain)`; pitch is applied by
resampling in common code before the platform player; the per-name cooldowns, variant
choice (seeded presentation rng), volume and mute are common. Unlock on the first input is
kept only where a platform needs it (web).

### T9.9 Input and focus

One model, `Focusables`: every tappable — a composable button through its semantics node,
an actor through its stage rect — registers a logical rect, an index, a group and a
disabled flag each frame, as today's hit regions do. Pointer events resolve drawn rects
first, then `TAP_MIN`-expanded rects; a tap commits on release in the region it began in;
`pointercancel` and lifecycle pause clear pressed state without firing a release. Keyboard
focus moves spatially (the ±50° cone, distance + 2× perpendicular, wrap to the far edge in
the group, index cycling on a flat row, twins skipped); A activates, B backs, PAUSE pauses,
digits 1–3 cast; Android's back gesture and button are B, with a confirm before leaving
the app from the title or the map. The drivers tap by test tag or by logical geometry, so a
screen that draws a button somewhere else fails the storyboard, as today; a nightly Maestro
flow taps every edge target with gesture navigation enabled.

## T10 Assets and the AI image pipeline

### T10.1 Stages

```
brief (spec/art + the actor's row) → prompt pack → generate every frame of every pose, N candidates
  → normalise (alpha clean-up, crop, integer downscale to the cell, palette quantisation onto the element ramp, keyline check, cell alignment)
  → gate (the instruments of § T10.4; pass thresholds, targets reported) → contact sheet
  → critic (an agent with eyes: the sheet, the lit frame at 1:1 and 2×) → owner (yes / no)
  → accept: PNG + manifest committed under kmp/assets/actors/<ID>/ → atlas build (a build output) → frame goldens re-recorded with approval
```

`:tools:art` is a CLI (`generate`, `normalise`, `gate`, `sheet`, `accept`) and a test suite
(the gate over every committed actor). Generation is never part of a build; the accepted PNG
is the source of truth. At P0 the gate and the sheet exist in **TypeScript** (§ T10.4), so
the bake-off and the art-now option run without Kotlin.

### T10.2 Providers

A provider is an adapter behind one interface — `generate(prompt, negative, references,
size, seed?) → candidates` — so the bake-off compares like with like and the cast is made
with **one** sprite provider and one portrait provider. Candidates at writing; every
provider's terms are verified in writing at P0 and recorded in `kmp/assets/LICENSES.md`
before it is used:

| Provider | Fit | Terms at writing (verify at P0) |
|---|---|---|
| Retro Diffusion (RD Pro) | pixel sprites from text with up to nine reference images; trained on licensed pixel art; per-image pricing (RD Pro ≈ $0.18) | outputs owned by the creator and usable commercially |
| PixelLab | pixel characters as posable skeletons with animation and rotation; API and an MCP server; sprite-sheet export | subscription; commercial use of outputs to be confirmed |
| Gemini image models ("Nano Banana" line) | reference-conditioned generation and editing; strong consistency | portraits; API terms to be confirmed |
| FLUX.2 through Black Forest Labs' API | up to eight reference images | portraits; API terms grant commercial use — but the openly distributed **FLUX.1 [dev] weights are non-commercial** and are not a fallback |
| OpenAI image models | reference-conditioned | portraits; API terms |
| Self-hosted Stable Diffusion XL under CreativeML Open RAIL++-M with a LoRA per character, or FLUX through an authorised API with LoRA support | maximum control and repeatability; GPU cost and time | the commercial-clear self-host fallback if hosted providers cannot hold consistency |

A provider without written commercial terms is not used. No third-party artwork is ever
passed as a reference image (`FUNCTIONAL.md` § F3.1); the reference set is the hand-drawn
study and the accepted cast.

### T10.3 Animation strategy

| Option | How | Bet |
|---|---|---|
| (a) posable skeleton | the provider generates all fifteen frames from one character | consistency by construction; the pose vocabulary must be expressible |
| (b) key poses + a procedural breath | thirteen generated frames per actor with references — every frame of attack, hurt, cast and dead, and idle's first frame — with idle's two in-betweens made by the rig's one-cell breath and follow-through (a translation passes the absolute idle criterion, and idle is the one pose where a translation *is* the motion) | fewer generations; the settle band and the aligned criteria must still be met by the generated frames |
| (c) master still + segmentation into the part rig | one still cut into parts and animated by the current anchor rig | the current kit's animation quality with painted parts; fiddly segmentation |

The P0 bake-off runs (a) and (b) on six actors (EMBER, GALE, HOLLOW_KING, CINDER_IMP,
ASH_HOUND, DUST_WRAITH), **generating every frame** so the motion criteria can be measured,
with the study as the reference; (c) is tried only if both fail the gate twice.

### T10.4 The gate

**At P0, in TypeScript.** `tools/lineup.ts` is extended to measure a PNG frame with a
sidecar `{ id, canvas (64|96), cell, element, pose, frame, feet, hitRect }` — the same
sheet metrics it computes today for a recipe, now for an image — and the `PixelActor`
registry of the pixel-pipeline prompt's stage 0 is built, so a PNG candidate stands on the
real crypt stage in `capture.mjs battle` frames and the in-scene rulers can be read. This
is what the bake-off runs through and what the art-now option needs; it is sized S–M.
**From P1/P2, in Kotlin.** `:tools:instruments` ports the same metrics and rebuilds, from
ART-REVIEW.md's definitions, the instruments that were never committed — the in-scene
rulers (the seat ruler, the two ground strips, the seat spread) and the motion metrics
(settle band, idle change, crown rise, dead height, and the new aligned part-travel and
dead-difference) — and must reproduce the TypeScript gate's numbers cell for cell on the
exported kit before it replaces it.

**The metrics and their status.** *Sheet, pass* (criteria 1–5 as the repository measures
them): L* min/p2/p98/max, the five bands, the share below L 35 (whole and interior), above
L 75, lit-from-above delta; colour count, palette overlap, mirror IoU, nearest-silhouette
IoU, component count. *Sheet, reported only*: contrast against the line-up ground —
criterion 6 is **retired** (`FUNCTIONAL.md` § F3.1). *In scene, pass*: the actor's median
value against the ground at both strips ≥ 1.5:1 at each stage anchor, the seat spread ≤ 5
L*. *Motion, pass*: idle change ≥ 17 % and the settle band 21–39 %, both **absolute**; the
new aligned criteria (part travel 4–8 cells, crown rise ≥ 1 cell, dead height 25–57 %,
dead-vs-idle ≥ 90 % after alignment) with their bands recorded at P0's calibration. *Targets*
(reported; gating only P6's heroes): p50 31–40 with ≥ 45 % below L 35; heroes ≤ 65 %
nearest IoU. **Partial casts**: the cast-wide criteria are measured against the accepted
actors plus the legacy actors standing in for the rest, and gate only once twelve actors
are accepted. **Calibration** (P0): the sheet metrics reproduce today's `metrics.md` cell
for cell on the exported kit; the value targets read the study at 31 / 51 % and the kit's
EMBER at 51 / 43 %; the aligned motion bands are derived on the kit's 43 actors and
recorded in `spec/art/`. Output: `metrics.md` and `.json`, one row per actor and per frame,
PASS or the failing criteria; the same code runs as tests over `kmp/assets/actors/**` in
the commit lane.

### T10.5 Normalisation rules

Allowed: alpha clean-up and de-halo; crop to the silhouette; integer downscale with
nearest sampling to the cell; palette quantisation to ≤ 24 colours mapped onto the actor's
element ramp and the shared neutrals; keyline enforcement (a missing keyline cell is
added in the material's dark step); cell alignment; mirroring to face right. Forbidden:
repainting content, upscaling, blur, any per-pixel edit an agent makes by hand without
recording it as a normalisation step. Normalisation is deterministic and idempotent
(`normalise` twice is a no-op), so it can be re-run over the whole cast when a rule changes.

### T10.6 Provenance, licensing and continuity

`kmp/assets/actors/<ID>/manifest.json`: provider, model and version, prompt hash (the prompt
text lives beside it), references used (by asset id), the provider's seed where one exists,
date, the normalisation steps applied with their parameters, the licence, the gate results
at acceptance, who accepted. `kmp/assets/LICENSES.md` lists every provider's terms as
verified. Prompts never name a third-party game, character or artist. **Continuity**: every
accepted asset, prompt and reference is archived; the accepted cast is the reference set
for later actors (and a trained style reference where the provider offers it); a change of
provider or model means a whole-cast re-gate and a critic round, priced in the README's
money table.

### T10.7 Cost model and ceiling

Bake-off: two looks × two animation options × six actors × their frames (15, or 13) × eight
candidates, over two per-image providers for sprites and one for portraits ≈ 1 000–1 500
images ≈ **$250 in total** at per-image prices (≈ $100–125 per per-image provider), plus
a month of any subscription provider. Cast: 645 frames × six candidates ≈ 3 900 images ≈
$700 at RD Pro's price is the *first-pass* number; at the tolerated 60 % gate rejection and
the owner's taste rounds the expected spend is **$1 500–2 500**, and the worst case with a
self-hosted LoRA fallback ≈ $4 000, which is the **ceiling the tool enforces** (a cast-level
counter beside the per-actor, per-provider candidate budget). Every response is cached; an
accepted asset is never regenerated.

### T10.8 Reproducibility

Generation is not reproducible across providers or time; the accepted PNG is the source.
Everything after it is: normalisation, the gate, the atlas build and the frame goldens.
Atlases are build outputs, never committed.

### T10.9 Today's art as placeholders — the export

`tools/export-assets.mjs` (Playwright over the dev server, like `capture.mjs`; a **P0**
deliverable, re-run at P4's start from a named tag so the parity frames are the frames the
port is measured against) writes into `kmp/assets/legacy/`:

- per actor and (pose, frame): a PNG at cell resolution and a sidecar as in § T10.4;
- per biome: the four painter planes **unblurred**, each at the raster the painter draws
  (far, mid and near at `padScale` 1.1111 into the 40-px-padded offscreen, the floor at 1:1),
  as PNG; and `light.json` — the `BiomeLook` minus its painters: key and fill lights, the
  two pools' pad and alpha parameters (the geometry is derived at boot), the grade, the fog,
  the motes, the shafts, the sky body (in far-plane space), the rim colour, the ambient
  preset; plus the stage anchors the floor's lit patches were painted for;
- `manifest.json` per biome: for each plane its file, pad, `padScale`, depth (0.3 / 0.62 /
  0.9 / 1.35), blur radius to apply (6 / 1.2 / 0 / 8) and whether it is the crisp plane; the
  anchors; the export's commit and tag.

An **anchor-drift test** fails the commit lane when `Layout`'s stage anchors differ from
the manifest's until the painters are ported (P6b), because the floor's painted patches
follow the anchors. P4 ships with the legacy actors and these planes; P6 replaces the
actors one by one behind the gate; P6b replaces the planes.

## T11 Persistence, saves and replays

- **A run** is `(RULES_VERSION, seed, RunConfig, decisions[])` in `:core`'s canonical text
  encoding, where the decisions are the `answer` records of § T5.3 (every `HERO_TURN`
  included, `draws=0` for a human) and `ENEMY_TURN` is never recorded; the app writes it
  after every decision and replays it at launch (D6, `FUNCTIONAL.md` § F2.1). **A state
  snapshot** rides along after every decision — the party with its relics and HP, the map
  and position, act, lap, pacts, clears, score, the Vault, the rng's state (one 32-bit
  word), and, while a battle is open, the pre-battle snapshot plus the hero turns since.
  When `RULES_VERSION` differs from the save's the run resumes from the snapshot under the
  installed rules and the player is told once; an open battle replays its recorded turns
  from the pre-battle snapshot under the new rules and, if a recorded option is out of
  range, restarts from that snapshot; the decision log restarts from that point (a
  `resumed-from-snapshot` marker), because a log spanning two rules versions is not a
  replay. The one case that abandons a run: a save naming content the installed rules no
  longer have (a removed character or skill) — the Vault is untouched and the player told.
  **`resumeRun(snapshot)`** — entering `runSteps` at an arbitrary map position with a
  reconstructed context — is a rules-structure change the literal port does not contain;
  it is a post-parity `:core` change with its own `SAVE-NN` clauses (which state is
  authoritative, what an open battle does) and is why `FUNCTIONAL.md` sizes F2.1 at M.
- **`RULES_VERSION`** is an explicit constant in `:core`'s `version` package, bumped by the
  clause-change protocol (§ T7.7) whenever a rule-bearing clause changes — never by a golden
  re-recording or a trace-format change. A corpus of saves under `spec/fixtures/saves/`
  (mid-map, mid-battle, at every pending kind) is re-recorded in the PR that bumps it; the
  tests assert that a save at version N replays under N to the same state, and that a save
  at N − 1 resumes from its snapshot cleanly.
- **The Vault** is `VaultSave` v2: the v1 fields (relics, `vaultSlots`, the unlocked
  ascension) plus settings; migration from the web's v1 through the transfer.
- **The transfer** (if approved): a compact binary encoding in `codec` — slot 3 bits, rarity
  2, set 4, sigil 4, level 3, kindled 1, main key 4 and base 10, each substat as key 4 +
  **value 10** (a flat-HP substat reaches 720 with its added rolls) + rolls 3 — about 15
  bytes per relic, ≈ 200 bytes for a full Vault with a version byte and a checksum; relic
  ids are regenerated on import. Carried by a deep link the web build shows (≈ 320 Base32
  characters), with paste as the fallback; a QR code is optional and costs a camera
  permission, a scanner dependency and a privacy string. Never a typed short code: the JSON
  is 3.5 KB.
- **Storage** is an `expect` `Store` (a file in the app's private directory; `Preferences`
  on the JVM; `NSUserDefaults`-backed files on iOS) with an in-memory fake for tests.
- **Replays** are the bug report — from every build: a long-press on the title shares the
  current run's save file and GAME OVER shows the seed (`FUNCTIONAL.md` § F2.8), so the
  owner's felt rows and the closed testers on release builds can report a bug that replays;
  the debug drawer's richer export is debug-only. `sim replay <file>` reproduces a save
  headlessly, prints the trace and renders the storyboard.
- **PvP readiness**: the same encoding carries a party, a relic and a decision stream; a
  server can verify a claimed result by replay, subject to the seed-secrecy constraint of
  `FUNCTIONAL.md` § F5.2.

## T12 Platform shells and release engineering

- **Android**: one activity, `setContent`, `sensorLandscape`, immersive sticky, the
  lifecycle pausing the loop and yielding audio focus; the back gesture and button routed to
  B; no network permission until PvP.
- **iOS**: `iosApp/` with a Swift `App` hosting `ComposeUIViewController`; landscape in
  `Info.plist`; a privacy manifest declaring no tracking and no data collection.
- **Desktop**: a `Window` at 16:9 with keyboard; the platform for Hot Reload and the
  instruments.
- **Accounts, testers and stores**: the Apple Developer Program and the Google Play
  developer account are opened at **P0**. A personal Play account created after November
  2023 must run a closed test with at least twelve testers opted in for fourteen continuous
  days per app before production access: the owner recruits and holds those twelve people
  (a P0 task with about a month's lead time), the test **starts on the first P5 build**, and
  its fourteen days are on the path to P7.
- **Signing and stores**: fastlane with `match` for Apple certificates and a Play upload
  key in CI secrets; a tag `v*` builds, signs and uploads to the Play internal track and to
  TestFlight; version name from the tag, version code from the commit count.
- **Crash reporting**: none by default; the opt-in toggle in settings (`FUNCTIONAL.md`
  § F2.2) can enable a KMP crash reporter in a later phase.
- **Release notes** are generated from the clause ids in the merged PRs since the last tag.

## T13 Agent workflow and conventions

### T13.1 `kmp/CLAUDE.md`

The repo map for the tree; the lane commands and their budgets with the machine class each
is measured on; the module edges; the budget table of § T8.3 with the port exemption and
its end date; the spec workflow (§ T7.7); the writer/verifier/critic roles and their model
tiers (mechanical work on a Sonnet-class model, design, review and critics on an Opus-class
model, the sprite loop's judgement on the strongest available); the isolation rules
(§ T13.4); the identities (§ T1); the commit gate; "never claim to have playtested".

### T13.2 Skills — the ten of today and their successors

The current skills are the generic Retrovibe arcade skills: they name files that no longer
exist (`game/data.ts`, `game/sim.ts`, `game/sprites.ts`), targets the contract superseded,
and a 240×160 frame. They are sources of *intent*, not templates; every successor is
written fresh at P1.

| Today | Successor | Note |
|---|---|---|
| `iterating-on-a-game` | `kmp-iterating` | the default edit path and the lanes; the old skill gains the refusal preamble at P1 |
| `playing-the-game` | `kmp-verifying` | run L1/L2, read the matrix and the review bundle, report "builds, boots clean, gates green, frames attached" |
| `designing-mechanics` | `kmp-spec-change` | clause first, the owner's decision before code moves |
| `balancing-with-the-simulator` | `kmp-balancing` | the harness and the snapshot, against the contract's real ladder |
| `ensuring-arcade-visuals` | `kmp-art-loop` (assets) and `kmp-screens` (fixtures, semantics tests, goldens) | the look rules become `spec/art/` and `spec/screens/` |
| `improving-game-quality` | **`kmp-quality`** — the feel rubric written at P1 from `STATUS.md`'s "Playing it on a phone" section, the full-frame critic's first-ten-minutes items and the contract's presentation rules: readability at arm's length, a target tapped once, feedback on every action, prompts that never blink fully off, hit-stop actually rendered, a frame rate that holds through a hit, resume correctness, audio per event kind, a screen that never swallows the run; its mechanisable items are clauses bound to `runComposeUiTest` tests; the first-ten-minutes test is scored against it | |
| `handling-user-input` | folded into `kmp-screens` and `spec/platform/` | the button model and `Focusables` |
| `messaging-game-over` | retired | there is no host |
| `adding-easter-egg` | retired until asked | |
| `releasing-the-game` | rewritten at P1 (a pull request the owner merges) and later `kmp-releasing` (tags and stores) | |
| — | `kmp-device` | emulator, simulator and phone smoke; Maestro |

### T13.3 Hooks

- `SessionStart`: install the git hooks (pre-commit, pre-push), start the Gradle daemon and
  pre-warm the fast lane (`./gradlew :core:jvmTest --offline -q` on a no-op — the
  environment image carries the caches, so it is warm within seconds), and confirm the
  machine identity's token is present.
- `PostToolUse` on `Edit`/`Write` of `kmp/**/*.kt` and `spec/**`: the L0 lane for the
  touched module, **synchronous** with an 8-second budget; a throttle file makes a second
  edit within two seconds of the last run a no-op; only failures are printed.
- `pre-commit` (git hook): L1 for the touched modules and spec-lint; writes and stages
  `spec/matrix.lock`.
- `pre-push` (git hook): the commit lane, L2a + L2b (`gate.sh commit`) — the push is refused
  by the hook, not by the agent's judgement.

### T13.4 Isolation

Every writer, verifier and critic works in its own git worktree with its own Gradle project
cache directory (`--project-cache-dir`) and its own driver port; the verifier's worktree is
at the spec commit (§ T6.3); ports are announced in the task; nobody kills another's
daemon. Long instruments (storyboards, sheets) run against a worktree at HEAD, never
against a tree another agent is editing — the lesson STATUS.md records.

### T13.5 The gate script and the lane definitions

`kmp/ci/lanes.yaml` is the single definition of the lanes: per lane an id (`edit`,
`module`, `commit` — L2a then L2b —, `merge`, `nightly`), the Gradle tasks and script
steps in order, the tags they select, the budget in seconds and the machine class the
budget is for, and the environment image's digest. `gate.sh <lane>` runs a lane exactly as
CI does, prints the lane's time against its budget, appends `{lane, sha, machine, seconds,
result, failed step}` to `kmp/ci/lanes.json`, and writes the review bundle
(`VERIFICATION.md` § V3.12). The CI workflows are **generated from `lanes.yaml`** (a
`build-logic` task writes `.github/workflows/kmp-*.yml`; a check fails when the committed
workflows differ from the generated ones), so "a tool silently disabled" is a diff, not a
new analyser. An agent commits when L1 is green (the pre-commit hook), pushes when the
commit lane is green (the pre-push hook), unsigned, pathspec-scoped, with the clause ids in
the message.

### T13.6 The debug drawer

Debug builds only: seed display, the decision log and snapshot export, a frame-time
overlay, a tier override, the crispness mode, screen fixtures, the forcing hooks the
storyboard uses. Stripped from release builds, which keep only the long-press save export
and the seed on GAME OVER (§ T11).

## T14 Phase sequence

Sizes and the aggregate are in the README (S ≤ 1, M 1–2, L 2–4, XL 4–8 sessions).

| Phase | Entry | Deliverables | Exit gate |
|---|---|---|---|
| **P0 Decide, spike, baseline** (M) | this plan approved | the owner's answers to questions 1, 2, 6 and 7; the Apple and Google accounts opened and the twelve testers' recruitment started; **the owner plays the web build on a phone and records the baseline**; `export-assets.mjs`; the TypeScript gate (PNG input on `lineup.ts`, the `PixelActor` registry) calibrated on the exported kit with the aligned motion bands recorded; provider terms verified into `LICENSES.md`; `STATUS.md`'s "Next", `pixel-pipeline.md` and `DESIGN.md`'s delivery table rewritten to point here; spikes: (1) headless JVM capture of a Compose stage to PNG at k = 1 and its time; (2) the bright-layer CPU bloom against today's frames on the first-ten-minutes screens and six hit peaks; (3) `RunSession` on intrinsics with a toy generator, `HERO_TURN` at step 7, `ENEMY_TURN`, and the three paths of the self-check with draw burning; (4) Pitest on a KMP JVM target; (5) detekt 1.x and 2.0 on Kotlin 2.4 syntax with type resolution timed on a KMP tree; (6) Kotest 6 running one hash test on the iOS simulator, as an Android device test on an x86-64 emulator with KVM, and on wasmJs; (7) the sprite bake-off on six actors, options (a) and (b), both looks, every frame, through the calibrated gate, shown in lit phone frames | spike reports with frames, numbers and a recommendation each; the look fork closed; the decisions recorded in the register |
| **P1 The rig** (M) | P0 | the environment image with its cold start measured; the machine identity, the ruleset, `CODEOWNERS`, the shim jobs, the `pages.yml` filter, the release path as a pull request, the root routing rewrite; `kmp/` with every module present and empty, the convention plugins, every analyser at full strength, the spec binder and its tests, `lanes.yaml`, `gate.sh` and the generated workflows, the hooks, `kmp/CLAUDE.md`, the `kmp-quality` rubric and the other skills; the hello-world stage (one sprite, one button, one screen test, one golden recorded in the image and compared on a second OS, one storyboard step in both modes); **a synthetic `:core`-sized module** generated from the TypeScript rules' function-size histogram (5 000 lines, 300 tests with property tests) and **a synthetic storyboard** that the lane budgets are measured on | every lane green and inside its P1-measurable budget on the synthetic module, timings recorded in `ci/lanes.json` with machine classes; the sizes re-estimated |
| **P2 The oracle and the specs** (L) | P1 | `--trace`, `--ascension`, the canonical `--dump`, the strong-party fixture and `strong=1` in the harness and driver; tag `ts-oracle-v3` after them; the `oracle-frozen` job; the golden set recorded on the pinned Node under the coverage matrix and hashed, with the trace-coverage report; the contract reconciled with the code, then folded into `spec/` clauses (status `proposed`) including the `known-divergence` clauses of `FUNCTIONAL.md` § F1.4; the clause count per area | spec-lint clean; every clause has an id, an owner, `paths` and a status; goldens frozen; every event, status, set, sigil and pending kind appears in the golden set; P3 re-sized against the clause count |
| **P3 The rules** (L) | P2 | `:core` by TDD in § T5.1's order; `:sim` with every command; `:core-testing`; the cross-platform hash test; the ABI dumps; the port exemption zeroed at the end | `diff-oracle` clean on the golden set; the balance tables reproduced; the hash test green on the JVM, the x86-64 Android emulator and the iOS simulator, and once on an arm64 phone or farm device; matrix 100 % (no weak clauses) for the rules areas; coverage and mutation at threshold or the fallback recorded |
| **P4 The stage** (L) | P1 (parallel with P3 from P2) | the parity frames re-exported from a named tag; `Frame`, `Layout`, `Focusables`, `Stage` and `StageScene`, the light rig from the exported data, planes and legacy atlases from the export, VFX, pops, audio; the three tiers and ARCADE; the desktop app and **a throwaway Android shell** for the phone budget; the perf test; the visual-parity comparison | battle frames captured headlessly for six biomes as goldens; the visual-parity band met against the exported frames at HIGH and reported at MED; the desktop budget met; the reference phone budget met on the stage-only build; L2b's content-scaled part measured for frames, the asset gate and the comparison |
| **P5 The screens** (XL) | P3 + P4 | every screen as Compose UI over the seam; fixtures for every screen state; semantics tests; goldens; the storyboard driver with the strong-party fixture and the forcing hooks; the Android and iOS shells; device boot smoke; the closed test started on the first build; L2b's storyboard and golden parts measured | storyboard `PLAYFULL OK` — every biome, boss and screen reached — and a two-act KO run on the JVM in skip-playback mode, the full-playback storyboard in L3, two acts on Android and iOS; every fixture has a golden; `screens` and `platform` clauses bound; the parity checklist's mechanical rows signed by evidence and its felt rows signed by the owner on a device |
| **P6 The art** (L) | P0's bake-off + P4 | the pipeline at full strength; the cast regenerated in `FUNCTIONAL.md` § F3.5's order with the stop decision after the six heroes; portraits; frame goldens re-recorded per accepted actor | every actor passes the gate; the six heroes meet the value targets; the full-frame critic's sprite axis scores above the kit's 8 on the same frames with the other axes not regressed; the owner accepts on a phone |
| **P6b Scene and composition** (L) | P4 (+ P6 for the sprites) | the painters ported or re-authored as data-driven painters (AI backdrops as the owner's option); the light wells, hues, bright-mass and plate-rule items of `STATUS.md`'s round-5 brief; the anchor-drift test retired | the full-frame critic ≥ 8 on every axis |
| **P7 Ship** (M) | P5 (+ P6 for the look; P6b per README question 4) | the approved `FUNCTIONAL.md` § F2 rows including the release-safe replay export; store pipelines; the transfer if approved; credits and disclosure | installed from both test tracks; the first-ten-minutes test passes on the owner's phones; the closed test's fourteen days complete |
| **P8 Promote and retire** (M) | P7 | the move to the root; docs and skills rewritten; the oracle under `oracle/`, still runnable; `pages.yml` building from `oracle/` | nothing at the root depends on TypeScript but the oracle; the live URL still serves |
| **P9 Web (stretch)** (M) | P8 | the wasmJs target through the same gates; Pages switches when it passes | the P5 gates on the Wasm build |

Parallel tracks once P1 lands: P2 → P3 (rules) beside P4 (stage) beside the art pipeline;
P5 needs both P3 and P4; P6b needs P4. The critical path is P1 → P2 → P3 → P5 → P7.

## T15 Technical risk register

| Risk | Mitigation | Tripwire |
|---|---|---|
| Kotest's non-JVM engines lack features the suites use | configuration by code only; the JVM lane is the fast truth; the P0 spike runs one hash test on every target before the suites exist | a spec that cannot run on a target is a P1 finding, not a per-test exclusion |
| The Compose test APIs are experimental and change | one thin capture-and-drive abstraction in `:tools:instruments` and `:ui` tests; an upgrade touches it once | a CMP upgrade breaking more than that module |
| detekt cannot parse Kotlin 2.4 syntax or its type resolution is too slow | syntax-only rules plus Konsist enforce the budgets; type resolution is never in a fast lane and is dropped if it cannot run inside L2a | type-resolved detekt over 3 min on the tree |
| Gradle configuration cache incompatibilities in a plugin | the cache is required from P1, so an incompatible plugin is rejected at adoption | any `--no-configuration-cache` in a script |
| macOS runners are slow or costly | iOS only in the merge and nightly lanes; the simulator boots once per job; Apple-silicon runners | the iOS job over 20 min |
| No hosted arm64 Android runtime | x86-64 ART in the merge lane; arm64 on the phones or the farm nightly; P3 needs one arm64 pass | a hash mismatch on arm64 |
| Kotlin/Native compile time | never in the fast lanes; caching of the K/N distribution and klibs in CI | — |
| Memory pressure on a 2022 phone | atlases at cell resolution, two biomes resident, a peak-RSS budget measured nightly | peak RSS over 250 MB |
| A blend-mode or blur API missing on a platform | minSdk 29; no platform blur in the frame path; the CPU bloom | an API-level fallback appearing in `:engine` |
| The storyboard outgrows the commit lane | skip-playback mode; measured at P1 on a synthetic storyboard and at P5 on the real one; the recorded move to L3 | L2b over 5 min at P5 |
| Hot Reload's MCP is new | an instrument, not a gate; the headless instruments are the gate | — |
| A store rejection (metadata, privacy, AI-art disclosure, the closed-test rule) | the privacy manifest and the credits are P7 deliverables; the closed test starts at P5 with the testers recruited at P0 | — |
| The CPU bloom loses the look | the P0 spike on the first-ten-minutes frames and the platform-blur fallback (§ T9.4) | the critic prefers the frame-derived bloom on more than a quarter of them or on any hit peak |
| A provider retires its model | § T10.6's continuity clause | a provider notice |

## T16 Online — reserved for PvP

Empty by design. When the owner's PvP brief arrives (`FUNCTIONAL.md` § F5), this section
takes the server, the accounts, the network module and its Konsist edge, the seed-secrecy
transport, the side-symmetric rules audit, and their lanes.

# Technical plan — how it is built

The engineering half of the plan. It fixes the platforms, hosts and identities, the
architecture, the toolchain, how the repository holds the frozen prototype beside the new
game, how the rules are rebuilt against the prototype's harness as an oracle, how the team
(one owner, many agents) practises TDD, how the specification becomes executable, which
static analysis runs where, how the stage is rendered inside a phone's frame budget, how
the AI image pipeline works, how saves and releases work, how agents work in the tree, and
the phase sequence. The verification loop that ties it together has its own document,
`VERIFICATION.md`; the player-facing scope is `FUNCTIONAL.md`.

Versions quoted are what was current when this was written (2026-09-12) and are pinned
again at P1; every claim about a tool's capability that the plan depends on is a P0/P1
spike, listed in § T14.

## T1 Platforms, devices, hosts and identities

| Target | Role | Minimum | Notes |
|---|---|---|---|
| Android | product | **minSdk 29** (Android 10), target the current SDK | Compose's `ColorDodge` (the stage's gain) has no PorterDuff equivalent below API 29 and falls back to source-over there; `Multiply` (the grade) maps to a PorterDuff mode that also multiplies alpha; both verified by P0's spike 1 (D3) |
| iOS | product | iOS 16.0 | `iosApp/` Xcode project with a Swift entry point hosting `ComposeUIViewController`; no other Swift |
| Desktop JVM | development and agent platform | JDK 21 | macOS, Windows, Linux; not a store product; where the fast lanes run and where frames are captured |
| Web (wasmJs) | stretch (P8) | browsers with WasmGC — all major engines since December 2024 | Compose for Web is beta at writing; the prototype keeps the Pages URL until the Wasm build passes the same gates, if the owner keeps the demo (README question 3) |

**Reference devices**: one 2022 mid-range Android (Pixel 6a or Galaxy A53 class) and one
iPhone 12 class, plus the owner's own phones; the Android reference phone is lane hardware that stays with the runner under README question 5's runner branch and the owner's Android acceptance and hand-walk device under the farm; the iPhone is bought under either branch of README question 5 as the owner's iOS acceptance device and is lane hardware only under the runner branch; the felt rows and the P7 test are walked on the iPhone and on one Android at or below the reference class — the owner's daily phone (assumed) if it is one, else the reference Android, lent from the runner for those sittings with the farm covering those nights, or simply the owner's under the farm branch — so the frame-rate row is judged at the reference tier (MED).

**Where the lanes run** (D18). The fast lanes (L0–L2) run on `agent-env`, the agents'
cloud environment, provisioned at session start by `ci/env/setup.sh` from the same recipe
as the image (`ci/env/env.Dockerfile`, `VERIFICATION.md` § V4) that CI and the developer's
devcontainer run; whether the cloud environment can run the image itself is P0's
environment spike, and the answer decides only where byte-exact goldens are compared
(inside the image: L3), never whether agents can push. The merge lane (L3) runs on hosted
Linux runners (x86-64, with KVM for an x86-64 Android emulator) plus one hosted
Apple-silicon macOS job for the iOS simulator. GitHub's **arm64 Linux runners**
(`ubuntu-24.04-arm`, free for public repositories since August 2025) are where the arm64
*arithmetic* truth can live in the merge lane: P0's spike 5b runs the hash test on one
(the JVM, and an arm64 Android system image if it boots there), and if it passes the L3
hash test gains that leg. No hosted runner is known to run an **arm64 Android emulator**
(x86-64 hosts cannot boot arm64 images and the Apple-silicon runners have no nested
virtualisation), so ART-specific behaviour on arm64 is proven on a physical device. The device lane
(L4) runs on a self-hosted runner on the owner's machine with the two reference phones —
the Android lane in a Linux VM on the Mac with USB passthrough for the phone, holding
nothing but the phone and the runner token (a macOS guest cannot take a USB device), and
the iPhone lane under a separate user account on the host, since it needs Xcode — the
accepted risk — or on the farm, because what the runner runs is `main`, which no human reviewed outside the owned paths —
registered in a **separate private repository** that the agents' identity cannot see
(§ V5), with Firebase Test Lab — Android and iOS physical devices; the free Spark plan's five
physical-device runs a day cannot be exceeded, so the farm branch is the Blaze plan, 30
physical device-minutes a day free and about $5 per device-hour beyond, under a Test Lab
daily quota that is the ceiling, since a Cloud budget only alerts (README question 5)
— as the fallback for the
hash test and the benchmarks when a phone is offline; the farm runs instrumentation, Robo,
game-loop and XCTest, **not Maestro**, so the Maestro rows are SKIPPED until the phone is
back; a device lane with no device reports SKIPPED, never green. The iPhone lane needs Xcode, so the self-hosted
machine is a Mac or the iPhone lane runs on the farm (README question 5). **At P0**, the
spikes that need macOS (the iOS simulator hash test) run on the owner's Mac or on a
throwaway hosted-macOS workflow committed before the ruleset exists, and the spikes that
need an Android emulator (spike 1's blend modes, spike 5's device test) or a registry
(spike 6's image build, with `packages: write`) run on a throwaway hosted-Linux workflow
with KVM the same way — `agent-env` is a cloud container without
nested virtualisation and the lane workflows do not exist yet.

**Identities** (D17). Six, with different reach: the owner's account (reviews and the
admin acts); the **agents' GitHub App**, which the owner creates and installs on this
repository with the *contents*, *pull requests*, *issues*, *workflows* and *actions* permissions (the
last to dispatch the `record-goldens` and `env-image` workflows and read their artifacts) and no
`checks`; the **gate App** (`checks: write` only), the one identity that posts the
owner-review checks, from a key only a `main`-only environment holds (`VERIFICATION.md`
§ V5); **Renovate**, installed at P1, whose monthly pull request against the owned
version catalog is reviewed like any other and which holds nothing else; and the
**runner's status token**, a fine-grained token on the owner's own account scoped to this
repository with `statuses: write`, `issues: write` and `actions: read` only, held by the private runner repository to post the
nightly's result back, to append its ledger rows as comments to the standing `ledger` issue (§ T13.5) and to download the APKs of the latest successful post-merge L3 run on `main`, since the arm64 guest assembles nothing (README D18); and the **farm's Google Cloud identity** — a service account holding Test Lab's role alone, reached through workload identity federation from the nightly's OIDC token (no stored key; `id-token: write` on the nightly's farm job and on nothing else, the federation bound to this repository's `main`), which the owner creates with the Firebase project at P1 (README question 5) — under the runner branch too, since the fallback nights run the farm. Every agent session mints a short-lived installation token from the App's
private key (an environment secret the owner sets), and commits, pushes and opens pull
requests as the App's bot user; the owner is the only entry in `CODEOWNERS` and the only
reviewer; approvals are read from GitHub's review data on the head commit by the plan's
own **owned-path check** (`VERIFICATION.md` § V5), which is the primary gate on every owned
path, run from `main`'s copy of the workflow so the pull request it gates cannot rewrite
it — `CODEOWNERS` is a second layer, because whether GitHub enforces a code-owner review
at zero required approvals is contested in its own community threads, and P1's first
throwaway pull request verifies it rather than assuming it. A fine-grained
personal token does *not* work here — GitHub does not let a collaborator's fine-grained
token act on a repository owned by another user — and a classic `repo`-scoped token on a
machine-user account is the named fallback if the App path fails P0's spike. A "reviewing
agent identity" is deliberately not used: an agent approving another agent's pull request
is the same coordinator approving itself. **The owner never authors a change on a
code-owned path** — an agent authors, the owner reviews — because GitHub never counts an
author's own review; the one other way through is the bootstrap's `CODEOWNERS` commit (§ V5; a
ruleset edit is not an authoring event).

## T2 Architecture

### T2.1 Layout and modules

The new game is the repository root from the first commit; the prototype lives under
`prototype/` (§ T4).

```
/
├── build-logic/           convention plugins: kmp-library, compose-library, quality (every analyser), spec-binder, lanes, atlas
├── settings.gradle.kts, build.gradle.kts, gradle.properties, gradlew, gradlew.bat   the root Gradle files (P1; the spikes are standalone)
├── core/                  :core          the rules — commonMain, ZERO dependencies (stdlib only)
├── core-testing/          :core-testing  builders, fakes, the trace and codec test helpers, a hand-written SHA-256 (stdlib only) for the hash tests
├── engine/                :engine        the presentation kernel (Compose): Frame, Layout, Focusables, Stage, the light rig,
│                                          particles, juice, bitmap fonts, the SfxPlayer interface
├── ui/                    :ui            screens, the scene builder, atlases, VFX, HUD (Compose; uses :core + :engine)
├── sim/                   :sim           the balance harness (JVM CLI): Monte Carlo, traces, self-check, gates, JSON
├── tools/instruments/     :tools:instruments  shot · storyboard · frames · vfx · backdrops · approve · perf · the review bundle (JVM)
├── tools/stub/            :tools:stub  the verifier's signature-only stub from a klib ABI dump (§ T6.3; JVM, P1's M5)
├── tools/art/             the art tool (TypeScript, Node; its own package.json and lockfile, `npm ci` in the recipe, in Renovate's scope): generate · normalise · gate · rulers · sheet · accept — every image measurement
├── app/android/  app/ios/  app/desktop/  app/web/   thin shells; app/benchmark/ — `:app:benchmark`, a `com.android.test` Macrobenchmark module inside the `app` glob, the device lane's benchmark APK (P5)
├── iosApp/                the Xcode project
├── assets/                actors, portraits, backdrops, fallback (the prototype's sheets and flat backdrops), store (the icon master, the splash, the feature graphic — § F2.5), fonts, sfx, LICENSES.md, spend/ (one row file per generation call)
├── docs/                  privacy/index.html — the public privacy policy the stores require — and support/index.html — the Support URL, naming the reports address — both hand-written, published by pages.yml at /privacy/ and /support/ (P5)
├── ci/                    env/ (env.Dockerfile, setup.sh, versions.env, manifest.image.json), lanes.yaml, gate.sh, required-checks.txt (generated, committed)
├── config/                analyser configuration: detekt, ktlint, the Konsist suite's rules (owned)
├── gradle/                the version catalog libs.versions.toml (owned)
├── spec/                  the executable specification: clauses, tables, goldens (golden/fixtures.md carries the fixtures' schema; golden/images/<kind>/ holds every image golden — screens, frames, vfx, backdrops — with their sidecars, where Roborazzi and the instruments write), fixtures (fixtures/golden/ holds the tuned battle fixtures and the harness's Vault relics as data, the single source both harnesses read; fixtures/art/ the ramps and the seats), synthetic (P1 only)
├── plan/                  this plan; spikes/<n>/REPORT.md
├── prototype/             the TypeScript game, frozen: game/ engine/ sim/ tools/ its docs, prompts and skills, package.json, .nvmrc
├── .github/               workflows: pages.yml (builds prototype/, publishes docs/ from P5; hand-written), prototype.yml (the freeze check and the prototype's gates; hand-written, outside the generated-workflows diff), env-image.yml (builds the environment image and re-checks its manifest; hand-written), owner-review.yml and owner-review-redispatch.yml (§ V5, hand-written), record-goldens.yml (`workflow_dispatch` only, its jobs outside `ci/required-checks.txt`; hand-written), keepalive.yml (a monthly `schedule` that pushes a dated commit to its own branch with the built-in `GITHUB_TOKEN` — repository activity whoever authors it, and no App key in Actions — § V5; hand-written, not required), the generated kmp-*.yml; CODEOWNERS; renovate.json
├── CLAUDE.md              the agents' conventions for this tree (a stub at P0, written at P1)
├── .claude/               the new skills, hooks and agents (P1)
└── .nvmrc                 the exact Node version, the one ci/env/versions.env pins, from P0's move commit; mirrored in prototype/
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
| `:tools:instruments` | `:core`, `:ui`, `:engine`, JVM libraries | — |
| `:tools:stub` | JVM libraries and a CLI parser | Compose, `:core`, `:ui` |
| `:app:*` | `:ui`, `:engine`, `:core`, the platform | nothing network-facing until PvP (a Konsist rule) |

`:core` compiles for jvm, android (the KMP Android library plugin), iosArm64,
iosSimulatorArm64 and wasmJs. `:engine` and `:ui` compile for the same set. Everything under
`:tools:*` and `:sim` is JVM only. The art tool is Node: Node is already the
oracle's runtime until parity and stays a build-time dependency for the art tool after it;
a Kotlin port of the art tool is optional and never a gate.

**Where the stage's pieces live** — the boundary that keeps `:engine` free of `:ui`:

| Piece | Module | One sentence |
|---|---|---|
| `Layout` | `:engine` | the stage geometry as pure constants and helpers (the ruler), no drawing |
| `Frame`, `Focusables` | `:engine` | the letterboxed logical space and the tap/keyboard registry |
| `Stage` | `:engine` | draws one `StageScene` per frame in painter's order; knows nothing about actors, skills or biomes |
| `StageScene` | `:engine` (type) | an immutable description: the biome bake handle, the camera offset, contact shadows, actor blits (bitmap handle, position, flip, scale, alpha), light actors, effect blits, bright-layer blits, pops |
| the light rig, `BiomeLook` (type) | `:engine` | bakes planes, light map, tiers from a `BiomeLook`; lights actors per frame |
| the biome data (`BiomeLook` values) | `:ui` resources | data, authored per biome, loaded by `:ui` and handed to the rig |
| atlases, VFX, HUD, screens, the scene builder | `:ui` | builds the `StageScene` from the run's state every frame |

**Test data on every target.** `:core` has no file access on iOS or Wasm, so no test reads a
path. The spec binder (§ T7.2) *generates Kotlin source* before compilation — the golden
cell table and the fixtures into the owning module's generated `commonMain` source set,
since the harness, the instruments and the debug drawer read them, and the tables and the
hash lists into `commonTest`: `SpecTables.kt` — one `List<Row>` per `data:`
table, the `Row` a data class typed per column from the clause's `types:` line (`int`,
`double`, `string`, `bool`, `enum:<Union>`, each with an optional form `int?` etc. where an
empty cell or `-` is null); `<Module>Fixtures.kt` — one value per
file under `spec/fixtures/<area>/<file-stem>/<name>.json`, the stem naming the
`spec/<area>/` file whose `schema:` block types it (§ T7.4; a screen's `ScreenState`,
`golden`'s fixtures and Vault relics — not `art`'s fixtures: the ramps, which `tools/art` reads directly in TypeScript outside the binder, `tools/art` being no Gradle module, and `seats.json`, which `:tools:instruments` reads from the repository path as a JVM-only reader, outside the binder as the save corpus is;
`spec/fixtures/saves/**` is excluded from the binder and read by JVM tests from resources)
and exposed as `<Module>Fixtures.<Area>.<FileStem>.<name>` — one root object per owning module, named after it (`CoreFixtures`, `SimFixtures`, `UiFixtures`), since each module's generated `commonMain` holds its own — typed by the area file's **first** `schema:` block, its root; every later block in the file is a nested type reachable only through `object:<Name>`, which resolves across the files of one `spec/<area>/` (so `spec/golden/vault.md` may nest the `VaultRelic` that `fixtures.md` declares), and a fixture that does not parse as the root is a binder error; and the golden hash lists as constants. Full-text goldens, screenshots and the save corpus are read by JVM-only
tests from resources.

### T2.2 The rules core, package by package

`types` (every closed union and constant of the prototype's `game/types.ts`, as sealed
interfaces, enums and `const val`s) · `data` (SKILLS, CHARACTERS, ENEMIES and BIOMES, RELICS'
tables, SETS, SIGILS, PACTS, ASCENSION, `validateData()`) · `rng` (`pick`, `uniformInt`,
`weighted`, `chance`, `withoutReplacement`, `mulberry32`) · `relics` (rolling, levels,
forge, sets, `derive`, `compare`) · `battle` (ATB, the turn, damage, statuses, AI, `intent`,
`simulateBattle`, the interactive API and the event stream) · `run` (the map, rooms, loot,
laps, the Vault as data including `minAscensionFor` — a pure function the screens clamp
the chosen ascension with before a run starts; `runSteps` itself accepts any `RunConfig`,
as the oracle does, so the golden cells recorded at A0 with `--vault 3` replay unchanged —
the policies, `simulateRun`, `runSteps`) · `session` (the interactive seam, § T2.3) · `codec` (the canonical text
encodings of configs, results, traces, decision logs and state snapshots — hand-written, so
`:core` needs no serialization library; JSON for external tools lives in `:sim`) · `version`
(`RULES_VERSION`, § T11).

The closed unions stay closed: a sealed interface per union, `when` without `else`, so a
new kind fails the build until every interpreter handles it — the same guarantee the
prototype's exhaustive `Record` checks give.

### T2.3 The seam

The prototype's seam is a generator: `runSteps` yields a `RunPending`, receives an answer,
continues; a battle is *one* pending, and the screen plays the turns itself. The Kotlin
seam changes exactly that: **every turn of a battle is a pending of the session.**

- Pending kinds are the prototype's — `DRAFT`, `VAULT_EQUIP`, `SUMMON`, `LEADER`, `ROUTE`,
  `RELIC`, `REST`, `SHRINE`, `FORGE`, `ALTAR`, `LAP`, `BANK` — plus two in place of
  `BATTLE`:
  - `HERO_TURN { battle, actor, options }`, raised **at step 7 of the turn**, after the
    cooldown tick and the status tick, with the post-tick `actOptions(battle, actor)` —
    exactly where the harness's policy is asked today. No pending is raised for a hero whose
    turn ends at step 2 (a BURN death) or step 6 (stunned). A VIOLENT extra turn raises a
    second `HERO_TURN`. The answer is `Turn(option)` (an index into the pending's own list,
    the policy's `act` answer) or `Forfeit`.
  - `ENEMY_TURN { battle, actor, intent }`, raised before each enemy turn and answered by
    `Continue`, so the screen can show the intent and pace the playback; `Continue` draws
    nothing, is not logged, and a replay answers it by itself. `Forfeit` is accepted at an
    `ENEMY_TURN` too.
  - `Forfeit` aborts the turn loop and books the battle as a lost battle (`deathKind`
    `WIPE`, as the prototype's seam does, with `forfeit = true` on the result and `deathBy` the empty string, printed `-`,
    by decision — the prototype's `findDeathBy` would name a fallen hero's killer — which a `COMBAT-FORFEIT-NN` clause states) and draws nothing; `RETREAT` is `:ui`'s label for it (`FUNCTIONAL.md` § F1.1). No policy forfeits,
    so no golden cell can produce it: forfeit is the third rule the oracle does not exercise — its code has it, no policy takes it —
    (with `RunDebug` the fourth: the storyboard's forcing hooks, an optional argument to
    `runSteps` and `RunSession`, absent and inert on the golden path, reaching `buildMap`,
    `choosePack` and a live battle only when present, bound by `PLATFORM-DEBUG-NN` clauses (§ T7.1's `PLATFORM` area, where § T14 and § V3.2 put the hooks) — a post-gate `:core` change made at P5 through § T7.7's route, as `resumeRun` is, its clauses first and `diff-oracle` proving the golden path unmoved; and
    `BattleCtx.spdDelta` the one rule the goldens never set — the battles harness's
    diagnostic `--spd`, a flat delta on `base.spd` at battle creation — bound by a
    `COMBAT-SPD-NN` clause test; with `minAscensionFor`'s vector and `resumeRun`) and is bound by its `COMBAT-FORFEIT`
    clause tests alone.
- Answers are a sealed `RunAnswer`, one type per pending kind, integers as `Int`; an
  illegal field still travels into the rules and that decision's documented fallback
  decides it, as in the prototype.
- The rng stream is unchanged: `createBattle`, the enemy turns and `runTurn` are called in
  the same order with the same draws, so the oracle traces match. The harness path, which
  asks the policy at step 7, is the one the traces follow; the prototype's screen, which
  enumerates before the tick (`FUNCTIONAL.md` § F1.4), is not a reference.

`RunSession` is built on the standard library's coroutine intrinsics — no kotlinx
dependency, no dispatcher, no thread; `runSteps`, the room resolvers, the battle loop and
`runTurn`/`takeTurn` become `suspend` on the paths that reach `ask` (counters cast without
a choice and `castSkill` never asks), and everything resumes synchronously inside `decide`:

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
        val body: suspend () -> RunResult = { runSteps(config, rng, ::ask, observer, debug) }
        // observer: a RunObserver holder the run writes its reader into, as the prototype's
        //   (`observer.read = { snapshotOf(ctx) }`) — the source of state(), built at most once per token
        // debug: the storyboard's RunDebug hooks (§ T5.3's `debug` record), null and inert on the golden path
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
    // state() / pending() / token() / result() as in the prototype; the view is built at most once per token
}
```

**The three-way self-check** has three genuinely different mechanisms where the prototype's
harness compares two (its `simulateRun` is the body of its `viaSteps`): (a) `simulateRun` = `runSteps` with an `ask` that returns the policy's answer *without
suspending* (`suspendCoroutineUninterceptedOrReturn { answerWith(p, policy, rng) }`), so
the whole run executes inside one `resume`; (b) `RunSession.decide` fed by `answerWith`
outside the session; (c) `RunSession.decide` fed by `answerWith` through a headless
`RunHost` in `:sim` that reproduces `:ui`'s token protocol (the storyboard driver exercises
the real `:ui` host in L2b). All three must produce the
identical canonical result text and the identical draw count. Policies draw from the run's
rng (`random`'s `act` is a `pick`; `balanced`'s `shrine` is a coin), so a replay from a
harness-recorded log must **burn** those draws: every logged answer carries `draws=<n>`,
the number of rng draws its answerer consumed, and `replay` draws n times before feeding
it. A log recorded by the app or the storyboard driver has `draws=0` throughout.

### T2.4 The presentation model

The phase is derived, never stored — `phase = pending?.kind ?: if (result != null) DONE
else ROOM`, `DONE` being the GAME OVER / VICTORY screen's phase — and one
`when` in `:ui`'s `RunHost` composable maps each pending to its screen, hands the screen a
`RunView` and a `decide(answer, token)` callback, and nothing else. No navigation library:
the run *is* the navigation. Screens are composables over a state object built from the
view (`ScreenState`), which is what the screen tests construct directly from fixtures.
PAUSE, INSPECT, ARCADE and settings are overlays owned by `RunHost`. The battle screen
resolves its `skill-N` and target activations to an option index of the `HERO_TURN`
pending it is showing, never from a list it enumerated earlier.

Every frame `:ui`'s scene builder turns the run's state into a `StageScene` and `Stage`
draws it; the HUD plates, panels, ribbon, command list, cards, map, party columns and every
button are composables placed in the logical 1280×720 space (§ T9.1). Every tap target is a
semantics node with a test tag and a logical rect, so the drivers can tap by tag *or* by
geometry, and keyboard focus is one model for both (§ T9.9).

### T2.5 What the stage takes from the prototype

Nothing of the prototype's engine is ported. The stage is designed for the AI cast on a
phone, and it inherits from the prototype what fourteen art rounds and the scene rounds
measured, **as design laws written into `spec/art/` and `BiomeLook` data**, not as code:

| Law | Value carried over |
|---|---|
| The plane split | far · mid · floor · near at depths 0.3 / 0.62 / 0.9 / 1.35; blur 6 / 1.2 / 0 / 8 px, the floor crisp because it is at the actors' depth; everything blurred is baked once per (biome, tier) |
| The light on the ground | two foot pools **derived from the stage anchors** of the two ranks, radii clamped so the pair overlaps by at most 60 px; key and fill lights with a per-body weight so the rig favours neither rank; the shafts baked **into the light map** (the prototype blits one light map per frame with a breathing alpha), fog banks and dust motes as animated composites behind the actors |
| The light on a body | a multiplicative gain (`ColorDodge`) under a feathered ellipse, tested at the feet and spread-capped to the median seat; a small additive rim spill; contact shadows with a cast lobe; the bloom never on a body — the constants of all of it (`GAIN_*`, `RIM_*`, `SHADOW_CAST_*`, `VIGNETTE_*`, the bloom's) are the prototype's, exported once as `rig.json` (§ T4.2) and bound as `spec/platform/` constants |
| The bloom | from the bright layer, quarter resolution, decided at P5 (§ T9.4) |
| The tiers | HIGH, MED (mid and floor merged, half the motes), LOW (one flat plane, the vignette only), ARCADE (LOW plus scanlines, halation from the bloom buffer, a neutral phosphor lift); the one-way auto-drop after 60 consecutive frames over 20 ms |
| The frame and the input | 1280×720 logical, a mutable safe inset, `TAP_MIN` 96 with drawn rects tested first, the ±50° focus cone, A/B/PAUSE with digits for skills |
| The sound | the 24 effects rendered once from the prototype's synthesizer (§ T9.8) |

The fixed-step loop, the button model, the pooled particles, shake and hit-stop are
rewritten in Kotlin from their one-paragraph descriptions in `spec/platform/`; none is
large enough to port.

## T3 Toolchain and versions

| Tool | Pinned at writing | Role | Notes |
|---|---|---|---|
| Kotlin | 2.4.20 | language and KMP | K2; `-Xexplicit-api=strict` on `:core`, `:engine`, `:ui`; `allWarningsAsErrors` everywhere |
| Compose Multiplatform | 1.12.0 | UI, stage, resources, previews, tests, hot reload | 1.10 made `@Preview` common and Hot Reload stable; 1.11 shipped the v2 UI-test APIs; 1.12 added an (experimental) MCP server to Hot Reload for agents |
| Gradle | 9.x (the current 9 at P1) | build | configuration cache and build cache on; `--warning-mode=fail` |
| Android Gradle Plugin | 9.3 | Android target and app | the KMP Android library plugin (`com.android.kotlin.multiplatform.library`) for `:core`, `:engine`, `:ui`; its host tests run on the JVM, its device tests on an emulator or phone |
| JDK | 21 LTS | toolchain | Gradle toolchains pin it |
| Node | 22.x, **one** exact version — the latest 22.x release at the move commit: pinned in `ci/env/versions.env` and the root `.nvmrc` from P0's move commit and mirrored in `prototype/.nvmrc`, with `prototype/package.json`'s `engines` and a lint that fails when they differ added at P2 before the goldens; the environment recipe, `pages.yml` and `diff-oracle` read it | the oracle's runtime; the art tool's | the `pow` table and every golden are recorded on the pinned version |
| TypeScript, typescript-eslint (strict, type-checked), Vitest | current | the art tool's language and its own tests and lint | the tool is small and measured, not a second codebase to govern |
| Kotest | 6.x with its `io.kotest` Gradle plugin (KSP-based) | tests on every target, property testing | annotation configuration is JVM-only, so configuration is by code |
| detekt | 1.23.x stable, 2.0 when it leaves alpha | smells, complexity, custom purity rules, Compose rules | syntax-only rules in L0 on changed files; type resolution over the tree in L2a, never in a fast lane. **Fallbacks, distinct**: if detekt cannot *parse* the Kotlin 2.4 syntax `:core` uses, detekt is dropped — Konsist enforces function length and parameter count **and takes over the custom rule set** (§ T8's purity, readback and sleep rules are import and call checks Konsist can express), the complexity budgets are suspended and the loss is recorded in the README's risk register; if only type resolution is too slow, the syntax-only rules stay and type resolution is dropped |
| ktlint via Spotless | current | formatting, auto-fixed | detekt's formatting rules stay off |
| Konsist | 0.17.x | architecture tests | scoped to the touched module in L1, the whole tree in L2a |
| KGP ABI validation | in Kotlin 2.2+ (experimental DSL; the check task is `checkLegacyAbi` at writing) | the public API of `:core` and `:engine` as a reviewed dump | a JVM-only variant in L1; the klib variant (every native and Wasm target) in L3, on the `hosted-macos-arm64` job — Apple klibs need a Mac — inside its ≤ 20 min |
| Kover | current | coverage with thresholds | JVM-measured for common code |
| Pitest | current (JVM) | mutation testing of `:core` and `:engine`'s pure packages nightly | P0 spike; if it will not run on the KMP JVM target, the fallback in § T6.5 applies |
| Roborazzi | current | screenshot goldens on desktop (the gate) and iOS (informative) | |
| Compose Hot Reload | 1.2 | live loop on desktop; MCP for agents | not a gate; an instrument |
| dependency-analysis plugin | current | unused and undeclared dependencies (`buildHealth`) | L3 |
| Android Lint | AGP's | app and library checks | fatal on a chosen set, no baseline |
| Maestro | current | device flows on emulator, simulator and the phones | L4 |
| actionlint, shellcheck, markdownlint, a custom spec-lint | current | workflows, scripts, documents, the spec | L0 |
| Renovate | — | one **monthly** batch pull request for dependency bumps, through the full lanes, reviewed by the owner like any change to the build; its configuration is `.github/renovate.json` (an owned path under `.github/**`, in the `build` boolean), written at P1, never by Renovate's own onboarding pull request | the catalog owns library and plugin versions, `versions.env` the toolchain (the JDK, Gradle, Node, the SDK) with a lint that pairs the JDK and Gradle entries of the two and the wrapper's `distributionUrl` (`gradle/**` and `gradlew*` are owned paths, § V5) — a lint that runs unconditionally in every lane, since its files sit in four `changes` booleans (`env`, `root`, `prototype`, `build`) and it costs seconds; `tools/art/package.json` is in Renovate's scope too |

Upgrade policy: one batch per month; the full merge lane must pass; a tool that breaks on a
Kotlin upgrade blocks that upgrade until fixed, replaced or, with the owner's sign-off,
removed together with a replacement for its catch; after P7 a red batch waits for the quarterly steady-state session, which is where it is fixed — except a bump the stores mandate (Play's yearly target-API rise), which takes the steady state's out-of-cycle session rather than a second red quarter, with the same fallback: the blocking analyser dropped on the owner's sign-off and the loss recorded.

## T4 The repository, the prototype and the oracle

### T4.1 The move and the freeze (P0)

In one commit at P0, with history preserved by `git mv`: everything that is the prototype
— `game/`, `engine/`, `sim/`, `tools/`, `index.html`, `smoke.mjs`, `package.json` and its
lockfile, `vite.config.*`, `tsconfig.json`, `.gitignore` (its paths kept, now relative to
`prototype/`), `README.md`, `DESIGN.md`, `DESIGN-REVIEW.md`, `STATUS.md`, `ART-REVIEW.md`,
`CLAUDE.md`, and `.claude/` renamed to **`.claude-archive/`** (skills, agents, prompts) —
moves under `prototype/`. The root
receives the plan, a new `README.md` for the tree, a root `LICENSE` the owner chooses at P0
for the code (the generated art is not copyrightable, and `assets/LICENSES.md` says so), a
root `.gitignore`, `ci/env/versions.env`
with the exact Node version (the authoritative pin, which `setup.sh` reads — `setup.sh` and `env.Dockerfile` are created in `ci/env/` by spike 6, in place, and M1 reviews them there; spike 6 fills
the rest of the file), `.nvmrc` mirroring it (and `prototype/.nvmrc` likewise; P2 confirms
the pin, adds `engines` and the lint that fails when any of the four differ), and a stub
`CLAUDE.md` that says what the tree is and routes every game request to `plan/` until P1's
real one. From that commit:

- **The prototype is frozen.** `prototype/**` is code-owned from P1; the only changes ever
  made to it are § T4.2's list, each in a named pull request — P0's among them land before
  the checks exist and are looked at by the owner (`VERIFICATION.md` § V1). Its documents get one banner each
  ("frozen prototype — the game is being rebuilt, see `/plan`"), and `STATUS.md`'s header,
  which still describes a draft pull request that merged on 2026-09-06, is corrected in
  the same banner commit. Its `CLAUDE.md` says that its commands run inside `prototype/`.
  Its skills, agents and prompts are archived under `prototype/.claude-archive/` — renamed
  because Claude Code discovers nested `.claude/` directories as directory-scoped skills,
  and the plan calls those skills obsolete; they are sources of intent for P1's skills.
- **The Pages deploy keeps serving the demo.** `.github/workflows/pages.yml` is edited in
  three places — `defaults.run.working-directory: prototype`, the upload action's `path:
  prototype/dist`, and `setup-node`'s `cache-dependency-path: prototype/package-lock.json`
  with `node-version-file: prototype/.nvmrc` in place of `node-version: 22` (`setup-node`
  prefers the literal when both are present, so the literal goes now) — plus a path filter
  on `prototype/**`, `docs/**` and the workflow file itself, so the live URL keeps serving the prototype, with its defects, until the
  owner retires it or the Wasm build replaces it (README question 3); at P5 the same
  workflow gains a `docs` job — **the one job that assembles and uploads the Pages
  artifact**: `needs: build` with no `if: always()`, so it runs only when `build` succeeded, for as long as
  the `build` job exists (retiring the prototype removes `build`, and `docs` then needs
  nothing), it downloads the prototype's `dist` when the
  `build` job produced one (that job then uploads `dist` as a plain artifact, not the Pages
  one), lays `docs/privacy/index.html` and `docs/support/index.html` beside it as `privacy/`
  and `support/`, and runs the single `upload-pages-artifact`; `deploy` needs `docs`, not
  `build` — the privacy-policy and support pages of § T12, served at `/ember-quest/privacy/`
  and `/ember-quest/support/`, hand-written HTML because a Pages artifact is served verbatim
  with no renderer — an owned-path change outside the freeze. A Pages deployment publishes
  exactly one artifact, so this is the only shape in which a retired or broken prototype
  build (§ V8.3, README question 3(a)) never takes the pages the stores require off the
  air: a red prototype build holds the site at its last deploy — the demo and the pages
  alike, a pages change waiting on the rot repair, since publishing the pages alone would
  remove the demo from the URL — and a retired one is the `build` job removed, after which
  the pages deploy alone.
- **Every workflow runs on every pull request; jobs skip themselves.** A required check
  whose workflow never triggers stays pending and blocks the pull request, so no generated
  workflow carries a path filter: each begins with a `changes` job that computes the paths
  changed against the merge base and outputs booleans — `prototype` (`prototype/**`), `plan`
  (`plan/**`), `spec` (`spec/**`), `assets` (`assets/**`), `art` (`tools/art/**`), `env`
  (`ci/env/**`), `docs` (`docs/**`), one per Gradle module — `core` (with `core-testing/**`), `engine`, `ui`, `sim`,
  `tools` (`tools/instruments/**` and `tools/stub/**` — `tools/art/**` is `art`), `app`, `ios` (`iosApp/**`) — `build` (`build-logic/**`, `gradle/**`,
  `config/**`, `.github/**` — Renovate's `.github/renovate.json` with it — `ci/**` outside `env`, the root build files and `gradlew*`) and `root`
  (the residual: every file at the root and under `.claude/**` that no other glob names —
  today `CLAUDE.md`, `.claude/**`, `.nvmrc`, `LICENSE`, `.editorconfig`, the root
  `README.md` and `.gitignore`, and whatever a tool adds at the root later); a path below
  the root in no glob is a generator error, caught by a test that walks the tree — and every heavy job carries `needs: changes`
  and an `if:` on them — a job skipped by its
  condition reports "skipped" and satisfies a required check. There are no separate shim
  jobs; the skipped job is the shim. The generator names every job after its workflow (`merge-changes`, `merge-jvm`, …), so
  the required checks never share a name, and the nightly, which never runs on a pull
  request, has no required job. `.github/workflows/prototype.yml` is hand-written but
  follows the same shape (it is outside the generated-workflows diff): the freeze check
  runs unconditionally, guarded so it is green until the tag
  exists (`VERIFICATION.md` § V5), and `prototype-check` — the prototype's own gates — runs
  when `prototype` changed. Both are required from P1, as is the `changes` job of every workflow that runs lane
  jobs on a pull request, by its workflow-prefixed name (a job skipped because `changes`
  failed would satisfy a required check).
- **`main` is protected** from P1 by the ruleset of `VERIFICATION.md` § V5 for the whole
  repository, because GitHub protects branches, not paths; there is no merge queue (it
  exists only for organization-owned repositories, and a transfer would move the Pages
  URL). Until P1 the release path of the prototype is a direct push, as today; after it,
  the prototype has no releases.

`CLAUDE.md` at the root holds the conventions for the tree (§ T13.1); Claude Code loads the
root file and any nested one when working under its directory.

### T4.2 The oracle and the allowed changes to the prototype

The prototype's harness (`prototype/sim/run.mjs` over `prototype/game/sim/**`) is the
oracle for the rules. **At P0**, tooling only, nothing under the rules (every command below runs inside
`prototype/` and takes `out=<path>` in the tool's own `key=value` form; the paths named are
repository-root-relative):

- `prototype/tools/capture.mjs sheets frames=1`: writes every actor's fifteen bakes as
  individual PNGs at cell resolution, each with its typed sidecar `<pose>-<frame>.json`
  beside it (§ T10.9), into `assets/fallback/actors/`;
- the `flat=1 tier=<LOW|MED>` frames, for the LOW and MED bars: the biome's unlit composite
  (the file the capture below writes) blitted as the flat tiers blit their merged plane —
  at `-PLANE_PAD`, unblurred, no parallax, and alone: no NEAR painter, since the composite
  folds far, mid and floor and P5's placeholder stage draws that one plane — with LOW's bake (the key light, the grade, the
  vignette map) or the MED rig over it (the light map, the
  gain, the spill, the shadows — the bloom off, since the prototype's frame-derived bloom
  lifts the ground and the app's bright-layer bloom does not), which is the frame P5 draws; through
  `capture.mjs battle … flat=1 tier=MED` (no `pixel=`, the fallback cast), and one small engine hook — a flat plane supplied as an image: at LOW, `bakeFlat`'s key
  light and grade painted over it in place of its painter loop; at MED, the rig over the
  flat blit of it — which no tier does today, since the engine lights only planes it baked
  itself — and, in the same pull request, a `bloom: false` option on `createLight` that
  `renderPost` honours, which the MED frame passes, since the prototype's bloom has no
  switch today: two of the three engine changes P0 makes to the prototype, named here as
  allowed changes (the third is the `unlit` flag below);
- `prototype/tools/capture.mjs backdrops flat=1`: an `unlit` flag on `engine/light.ts`'s
  **bake** path (`bakeFlat`, which at LOW paints the key light and the grade's multiply
  into the plane — a render-path switch cannot remove them) that skips `paintKeyLight`,
  the grade fill and the floor layer of `bakeFlat`'s loop, and returns the padded canvas
  itself (the render path crops the 40-px pad, so the bake canvas is read directly) with
  the far and mid painters composited as its unlit layers and **the floor drawn over them
  through `bakePlane`'s crisp branch at 1:1 inside the flag** — that branch is
  module-private, so the capture cannot call it; this flag is the third engine change —;
  the capture writes **one** composite per biome, unlit, at the padded plane size
  1360 × 800 — `bakeFlat` alone resamples the floor through
  `padScale` with smoothing on and would turn the 2-px stones into gradients, undoing the
  scene-round law § T2.5 carries — into `assets/fallback/backdrops/<BIOME>.png`; six images,
  one placeholder plane per biome for every tier (the near painter's curtains and lip are
  the scene phase's); with `assets/fallback/backdrops/<BIOME>.light.json` per biome: the
  biome's `BiomeLook` value minus its four painter functions — and once, in
  `assets/fallback/backdrops/rig.json`, the rig's own tuned constants the bars were achieved
  with (`GAIN_FLOOR`, `GAIN_LIFT`, `GAIN_TINT`, the gain ellipse's 0.66 × 0.98,
  `GAIN_SPREAD_CAP`, `RIM_FLOOR`, `RIM_LIFT`, `RIM_REF`, `SHADOW_CAST_ALPHA`,
  `SHADOW_CAST_SQUASH` and the 3.0× lobe, `VIGNETTE_RX/RY`, the bloom's alpha and divisor, the contact ellipse's radii and alphas and the cast lobe's offsets, `RIM_PUSH_X/Y` and the `GLOW_*` set),
  bound as `spec/platform/` constants (§ T2.5); the named constants are module-private `const`s in `engine/light.ts` and `backdrops.ts` today, and the contact ellipse's radii and alphas and the cast lobe's offsets are literals inside `drawContactShadow`, so the same pull request lifts those into named module constants and adds `export` to every one, as the ramps export does —, serialised in declaration
  order (key and fill with their `actorWeight`, the pools' colour, ellipse, alpha and `actorWeight`, the grade, the fog,
  the motes, the shafts, the sky body, the rim colour, the ambient preset and colour), plus
  `anchors: {hero: HERO_FEET, enemy: ENEMY_FEET}` from `layout.ts` and
  `pools: {padX: 250, padY: 92, overlapMax: 60}` from `backdrops.ts`, so the rig applies
  every light pass itself and nothing is lit twice;
- `prototype/tools/render-sfx.mjs`: before boot it installs an `OfflineAudioContext`-backed
  shim as `globalThis.AudioContext` (reporting `state: 'running'`, which `play()` requires)
  and `Math.random = mulberry32(seed)` in the page, then renders each of the 24 effects
  through the prototype's own synthesizer three times (seeds 1–3), **each (name, seed) in
  its own `createAudio()` and context** so the per-name cooldowns never drop a variant —
  through `prototype/tools/sfx.html`, a fixture page that imports `createAudio` from the
  engine as `tools/screens.ts` does and exposes `render(name, seed)` to the script, since no
  existing page exposes the synthesizer (`__eq` carries no audio) — to
  48 kHz 16-bit mono `<name>-<k>.wav` into `assets/sfx/` — each clip rendered in an
  `OfflineAudioContext(1, 48000 × 2, 48000)` and trimmed to the last sample above −60 dBFS
  plus 10 ms, so the committed hashes are reproducible — with a manifest `{commit, name,
  seed, sha256}`; no engine edit (§ T9.8);
- the **`PixelActor` registry** (`prototype/game/art/actors.ts`) and `capture.mjs battle
  [pixel=<dir>] biome=<BIOME> party=<ids> pack=<ids> [tier=HIGH|MED|LOW] [flat=1] [phone=1] [seat=all|<id>]
  anchors=1` (the fallback recipes stand in for every id when `pixel=` is absent, as the bar and `flat=1` frames need): a stage-only capture in any biome and tier with no run drive over `prototype/tools/stage.html` (below) — `<dir>` holds
  § T10.9's layout under `<dir>/<ID>/`; a look-B candidate is a 128 × 128 px frame (192 ×
  192 for a boss) with `canvas: 128|192, cell: 1` in its sidecar, drawn at 1:1
  (`FUNCTIONAL.md` § F3.2); the named
  ids are drawn from their PNGs and missing ids fall back to the prototype's recipes; each
  pose is stepped to fixed ticks and written as one frame per (pose, tier); `seat=all`
  plants the biome's six seat actors — the per-biome seat list `spec/art/seats.md` records
  when the art tool is calibrated (`spec/fixtures/art/seats/seats.json`, § T7.5), before any capture plants it, and `seat=all` reads from
  that file: three of the biome's own fallback pack at the enemy anchors, three fallback heroes
  at the party anchors — for the in-scene rulers, and `seat=<id>` one id at all six anchors
  for the rig's own seat-spread measure (the id `seats.json` names as `spread`) — `seat=` overrides `party=` and `pack=` at the
  anchors; the hit flash on a PNG actor
  is an alpha-masked white overlay at the rig's mix; `anchors=1` writes the anchors file
  of § T10.4 and the `<frame>.masks/<seat>.png` masks beside every frame. The bake-off's candidates are thus seen in lit frames and
  the in-scene rulers read from them. A presentation change; the rules are untouched;
- the **banner commit** of § T4.1 (the documents' banners and `STATUS.md`'s corrected
  header);
- `prototype/tools/export-ramps.mjs`: the five element ramps (`ELEMENT_RAMPS`) and the
  shared neutrals (`NEUTRAL`) from `game/art/actors.ts` — both module-private today, so the
  same pull request adds `export` to the two declarations (`actors.ts` is outside the
  frozen paths; `parts.ts` holds the `Ramp` type, not the ramp values) — to `spec/fixtures/art/bible/ramps.json` — a fixture typed by a `schema: Ramps` block that lands with this export in
  `spec/art/bible.md`, ahead of the bible's clauses (§ T2.1's fixture mechanism, not a `data:` table), the five element
  ramps under `elements` and the shared neutrals under `neutrals` — which `normalise` and
  the portrait criterion read;
- `prototype/tools/stage.html`: a fixture page that draws bodies on the lit stage outside
  a driven battle — `biome`, `tier`, `pose`, `tick` and `seats` as query parameters over
  the engine's real scene — since no existing page does (the screens page has no battle,
  the backdrops page feeds light boxes without bodies, and `__eq` exposes a live run's
  objects but cannot compose a stage without a driven battle); the
  `pixel=` capture above drives it;
- optionally, under question 3(c): the three battle-screen defects (two root causes) fixed in
  `prototype/game/screens/battle.ts`, outside the frozen rules paths, as one named pull
  request under the prototype's own gates;
- if the demo proves unusable on the owner's phone at the baseline play (audio unlock,
  fullscreen, touch, frame rate — it has only ever run on a Playwright viewport), a second
  named fix inside the freeze (≈ half a session), or the baseline taken with the gap
  recorded, the owner's choice;
- a repair to the prototype's build, lockfile or CI when `prototype-check` breaks on a
  registry, browser-download or runner-image change — the one class of change allowed
  after P2's freeze, outside the rules paths, in a named pull request;
- `prototype/tools/export-fonts.mjs`: every field of the two `BitmapFont` values (`name`,
  `glyphH`, `glyphs`, `fallbackW`, `caseFold`, `baseline`, `outlineMinScale` — the retro
  face folds case and the HD face's descenders hang from its baseline, so an export without
  them draws blanks and misaligned text) verbatim to `assets/fonts/<name>.json`;
- `prototype/tools/export-study.mjs`: a Node rasteriser over the study's grid strings and
  colour map in `prototype/game/art/pixel/ember-study.ts` (no browser; `tools/study.html`
  draws the same data for eyes), writing the hand-drawn study to
  `assets/fallback/study/ember-study.png` at cell resolution on a 64-cell canvas — the
  ≤ 48 × 64 grid bottom-centred with its feet on the canvas's bottom row — and
  `ember-study-x4.png` at ×4 nearest, with the sidecar of § T10.9.

**At P2**, in this sequence: (1) the harness gains `--trace` and `--cell <id>`, the slug the `cell` line carries (§ T5.3; built on the exposed
`runSteps`, `answerWith`, `createBattle`, `nextReady`, `runTurn` and `Battle.events`, so
nothing under the rules paths changes), `--ascension <A>` into `RunConfig`, `--path a|b`
to choose the seam path a `runs` trace follows — a is `simulateRun` (the generator body,
`viaSteps`), b is `runstep.ts`'s `createRun` (the interactive seam); path c, the headless
`RunHost`, exists only in `sim` —, a canonical `--dump` (§ T5.4), a
strong-party battle fixture (the harness's three kindled relics on the fixture party) for
the home-act cells, the stall and long fixtures and the set-and-sigil family (§ T5.3) as
data in `spec/fixtures/golden/fixtures/*.json` — the **single source**, typed by the `schema:`
block of `spec/golden/fixtures.md`, which `prototype/sim/fixtures.mjs` reads at run time
and the Kotlin harness reads through the binder, so there is no second copy to desync —
with the harness's Vault relics (`VAULT_RELICS`, a literal today) moved into
`spec/fixtures/golden/vault/default.json`, typed by `spec/golden/vault.md`; battles-mode knobs `--party <row> --pack <ids> --act --ascension --clears
--no-stall-gate` (`--party` names a fixture row of `spec/fixtures/golden/fixtures/` or the literal
`battle-fixtures`; `--no-stall-gate` lifts the harness's `STALL_MAX` exit, which fails any
cell whose stall rate passes 0.5 % and would otherwise fail the stall fixture and any
20-battle cell with one stall — golden recording and `diff-oracle` pass it; `--fixture`
keeps its shipped meaning, a `BATTLE_FIXTURES` row with its
party and pack; `--clears` defaults to 0), where the pack is
built by the **exported `spawnPack(ids, act, lap, ascension, clears, pacts)`** — the
function that scales enemies; `fixturePack` is module-private and hard-codes act 1, lap 1,
A0 and no pacts, so it is not the builder — and act, lap, ascension and pacts are passed into `BattleCtx` — which has no clears
field — that the harness today fills with `spdDelta` alone; and
`prototype/sim/coverage.mjs`, the
trace-coverage report over trace files, and `prototype/sim/cells.mjs`, the driver that walks
every cell of `spec/golden/cells.md` through `run.mjs --trace` and writes `spec/golden/`
(§ T5.3); the capture driver gains `strong=1`, which seeds
`localStorage['ember-quest/vault']` before boot with the three kindled relics and
`vaultSlots 3` so the scripted drive equips them on the real EQUIP face and reaches acts
3–6 — an **A3 run**, because three equipped relics raise the floor (`prototype/game/
screens/vault.ts`); P2 confirms the Node pin of `ci/env/versions.env` and both `.nvmrc` files, adds it to
`engines` and adds the lint that fails when any of the four differ;
(2) `main` is tagged **`ts-oracle-v3`** under the tag ruleset; (3) the prototype-freeze
check, required since P1 and vacuous until now, starts failing any pull request whose diff
touches `prototype/game/sim/**`, `prototype/game/data/**`, `prototype/game/types.ts` or
`prototype/game/screens/vault.ts` relative to the tag. From then on those paths are never
edited again.

### T4.3 Unwind

If the rebuild is abandoned at any phase, nothing has to be undone: the prototype runs and
deploys from `prototype/` exactly as it did, its documents and skills are intact under
their banners, and the ruleset, the App and the private runner repository can stay or be
removed by the owner in an afternoon. The new tree is deleted or left as history. What
cannot be recovered is what was spent to that point — the art (D9), the accounts, the
sessions and the owner's hours — and a closed test abandoned restarts its fourteen days.

## T5 The rules

### T5.1 Order and method

`:core` is written **test-first from the clauses**, module by module, each gated before the
next starts, with the oracle's traces as the acceptance test: `types` and `data` (a table
dump of every data structure from Node compared to the Kotlin tables; `validateData()`
returning `[]`) → `rng` (test vectors: the first 10 000 outputs of `mulberry32(seed)` for
seeds 1, 2, 7, 4242 and 0xFFFFFFFF as raw bits; the `jsRound` and `pow` tables) → `relics`
(tests from the `relics` clauses — `rollRelic`'s eight ordered draws, ranges, the +2/+4/+6
events, the forge modes, the set pool, the sigil pairs — plus `rollRelic` traces from the
oracle) → `battle` (event traces per fixture and policy) → `run` (`RunResult` and
pending/answer traces; `minAscensionFor`'s four values — `min(ASCENSION_MAX, n)` for
`n = 0…3` worn relics — and `clampAscension`'s tie-break written into the `META-VAULT`
clauses from `prototype/game/screens/vault.ts`, a table small enough to need no exporter) → `session` (the three-way self-check) → the policies (their answers
are in the traces).

Where a clause fixes arithmetic, the Kotlin follows the prototype's expression in the same
evaluation order (§ T5.2) — that is what makes the traces match, and it is the one place
the code is transcribed rather than designed. The prototype's rules functions are far over
the simplicity budgets (`castSkill` 98 lines, `buildMap` 86, `runSteps` 97, `validateData`
192; cyclomatic complexity in the twenties and forties), so **`:core` carries a
module-wide, dated suspension of the complexity and length budgets in `CLAUDE.md`'s
budget table from P1 until the P3 gate** — P1's synthetic module is generated under it —
and inside it every oracle transcription additionally carries § T8.1's `@Suppress` reason,
so the `port` budget can be counted and must be zero before P3 closes; the purity and
edge rules apply from the first line. The split into budget-sized functions is the gate's
last task, made under the goldens once the traces match, so the gate is passed with no
transcription suppression left.

### T5.2 Numeric fidelity

| Prototype (V8) | Kotlin | Rule |
|---|---|---|
| `number` | `Double` | IEEE 754 binary64 on every target |
| `Math.floor`, `Math.min`, `Math.max` | `floor`, `min`, `max` | never on NaN (a rule forbids NaN-producing operations in `:core`) |
| `Math.round` | `jsRound(x) = floor(x) + if (x - floor(x) >= 0.5) 1 else 0` | Kotlin's `round` rounds half to even, and `roundToInt` returns an `Int`, which overflows on the values `Math.round` is applied to under `LAP_MULT`; `jsRound` is tested against a Node-generated table of 10 000 values including `0.49999999999999994`, `2.5`, `-2.5`, `-0.5` (a reviewer's 200 000-sample check found no mismatch); "round half up" is written into the clause as the rule of the game |
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
modes (`runs` and `battles`), hashed with a hand-written SHA-256 in `:core-testing` (about 120 lines of stdlib
Kotlin, checked against the NIST vectors and, on the JVM, against `MessageDigest`) against
a committed expectation — runs as a JVM test, as an Android device
test on an **x86-64 emulator with KVM** in L3 (ART's arithmetic, not arm64's), on the iOS
simulator (`iosSimulatorArm64`: Kotlin/Native on arm64 with hardware fused multiply-add
present) on an Apple-silicon runner in L3, on the JVM of a free **arm64 Linux runner** in
L3 if P0's spike 5b passes (the arm64 arithmetic truth), and on the reference Android
phone — or a Firebase Test Lab device — nightly, which is the **arm64 ART truth**; P3's
gate needs it green once on an arm64 device. On wasmJs it is informative until P8. A mismatch on any
product runtime is a P3 blocker; the fix is in the expression, never in the expectation.
The FP risks are libm and text formatting (both removed above), not contraction: Wasm's
f64 arithmetic does not contract, the JVM's is strict, and Kotlin/Native emits no
fast-math or contraction flags to LLVM, so `a * b + c` is two roundings there too — the
simulator hash is the proof, and a mismatch there would be a compiler-flag problem to take
to JetBrains, not an expression to rewrite.

### T5.3 The canonical trace

A line-oriented text format written identically by `prototype/sim/run.mjs --trace` and
`sim trace`, LF line endings, one trailing newline, UTF-8, hashed with SHA-256; the hash is
the parity currency. One record per line, fields space-separated; the record kinds and their fields, in order:

| Record | Fields |
|---|---|
| `trace 1` | the format version |
| `mode <runs\|battles>` | which harness mode produced it (`selfcheck` compares canonical results and draw counts, and writes no trace) |
| `cell …` | for runs: `cell id=<slug> seed=<uint32> policy=<name> runs=<N> asc=<A> vault=<n> spd=<d> path=<a\|b\|c>` — a cell is N runs on **one** rng stream in run order, as the harness runs them, and the golden path is **b**; for battles: `cell id=<slug> mode=battles seed=<uint32> pack=<enemy ids '+'-joined> act=<n> asc=<A> clears=<n> party=<fixture> policy=<name> n=<N>` (the boss fixture's display name `BOSS HOLLOW_KING` is never a value: every field and the slug are space-free) — N battles on one stream seeded as stated (the P2 recording uses seed 1 unless the cell table says otherwise); the slug is the golden file's name and `diff-oracle` regenerates a cell from this line and the fixture row it names |
| `config` (runs mode only; battles have no `RunConfig`) | every `RunConfig` field **as passed**: `ascension`, `vaultSlots`, `roster` (empty allowed), `spdDelta`, and each Vault relic in the compact relic encoding |
| `save <format> rules=<N> snap=<S> seed=<uint32>` | saves only (§ T11), never in a trace: a save's first line — the save format's version, the `RULES_VERSION`, the snapshot's schema version and the seed — followed by `config`, `debug` if any, `resumed <S>` if the log was restarted from a snapshot, then the `answer` records |
| `debug <hooks>` | saves only (§ T11), never in a trace: a storyboard's forcing hooks — `act=<n> lap=<n>` (applied before the first decision) and, each with its firing point, `room@<act>.<stage>=<TYPE>`, `pack@<battle k>=<ids>` (`+`-joined, as the `cell` line), `hp@<decision i>=<slot>:<n>` (applied when the replay reaches that act's stage, that battle or that decision index — the party is empty at the first decision, so a point-in-time hook has no earlier moment), any of them absent — which `sim replay` applies at those points; a save carrying it is not portable across `RULES_VERSION` (`VERIFICATION.md` § V3.2) |
| `resumed <S>` | saves only (§ T11), never in a trace: the log was restarted from a snapshot at schema version S, so the `answer` records that follow begin there |
| `run <k>` | the k-th run (or battle) of the cell (from 0); the `draw` index continues across the cell's runs |
| `draw <i> <hex64>` | the i-th rng output of the cell as the raw bits of the double, sixteen lowercase hex digits |
| `pending <KIND> <fields>` | the pending's kind and its data, per kind in the table below; `ENEMY_TURN` is **not** recorded, and the prototype's `BATTLE` pending — which has no Kotlin counterpart — is not recorded either: the prototype's `--trace` emits `HERO_TURN` from inside the wrapped act |
| `answer <KIND> <fields> draws=<n>` | the answer given, per kind in the table below, and the draws its answerer consumed |
| `party H<slot>=<id>[<compact>;…]:<hp> … E<slot>=<id> …` | one per battle start, after `createBattle`'s draws, each hero entry carrying `:<hp>` — so the out-of-battle heals (`postWinHeal`, the boss-entry heal, REST, `mendParty`), which emit no event, are pinned at the next battle — and, in battles mode, once more after `battleOutcome`, which is how `BattleResult.party` is carried: entries separated by single spaces, each hero's worn relics in square brackets `;`-joined (empty brackets for none), every enemy by id; what the coverage report reads sets and sigils from |
| the **compact relic encoding** | wherever a relic appears (`config`, `party`, `result`, the pendings and answers): `<SLOT>:<RARITY>:<SET or ->:<level>:<K or ->:<MAIN><base>:<SUB><value>/<rolls>,…:<SIGIL or ->` — `<base>` is `Relic.main.base`, never the derived `mainValue()`, which the level implies; fields `:`-separated, substats `,`-joined in roll order each with its roll count (rules state: a recast re-rolls a substat `rolls` times), values by the integer-or-bits rule, `-` for absent; a list of relics `;`-joined, `-` when empty; the relic's id is never printed |
| `event <KIND> <fields>` | one per `BattleEvent`, fields per kind: `TURN_START actor enraged` · `TURN_END actor` · `CAST caster skill targets` · `HIT attacker target dealt absorb crit glance killed` · `STATUS_APPLIED\|RESISTED\|EXPIRED target status turns` · `HEAL target amount source` · `ATB_CHANGE actor delta(bits) reason` · `COUNTER actor target` · `DEATH actor` · `BURN_TICK actor amount` · `VEIL actor` · `STALL` — actors as `H<slot>` / `E<slot>`, skills and enemies by id |
| `result` | for runs, exactly the `RunResult` fields the oracle's `types.ts` declares, in that order, except `probes`, which the `probe` records carry; for battles, `BattleResult`'s `won stall enraged actorTurns` only — its `probe` is the `probe` record and its `party` the closing `party` record above; a field the Kotlin adds (`forfeit`) is never printed; list fields joined with `,`, heroes separated by `;`, `-` for null **and for the empty string** (`deathBy` and `deathKind` on a win — no string field is ever legitimately empty and distinct from absent), `<PACT>:<0\|1>` per shrine offer in roll order (`RunResult.shrines` carries the declined ones too); relics in the compact encoding |
| `probe <n>` | one per `Probe`, every field, doubles as bits |
| `end <draws> <sha256>` | closes a run — `<draws>` is the cell's draw index after this run, the counter the `draw` records carry; the per-run hash is over that run's records from `run <k>` through the last record before `end` |

**The fields per pending and answer kind**, lists `,`-joined, `-` for null or none:

| Kind | `pending` fields | `answer` fields |
|---|---|---|
| `DRAFT` | `roster=<ids>` | `pick=<i>` |
| `VAULT_EQUIP` | `slots=<n> vault=<compact relics>` | `equip=<indices>` |
| `SUMMON` | `full=<0\|1> opening=<0\|1> offers=<id>:<favored 0\|1>,… dominant=<ELEMENT>` (an offer carries no relic; the full-party EPIC card is rolled after the answer and shown as its own `RELIC` pending) | `take=<i>` or `swap=<i> out=<j>` or `-` |
| `LEADER` | `party=<ids>` | `seat=<i>` |
| `ROUTE` | `stage=<n> offered=<idx>:<TYPE>,…` | `route=<i>` |
| `RELIC` | `source=<src> cards=<compact relics>` | `card=<i> onto=<j>` or `-` |
| `REST` | `candidates=<indices>` | `heal` or `sharpen=<i>` |
| `SHRINE` | `pact=<id> untaken=<n>` | `take=<0\|1>` |
| `FORGE` | `worn=<compact relics> options=<relic>:<MODE>,… pool=<sets> levels=<n> rebrand=<sets>;…` | `relic=<i> mode=<MODE> substat=<k or -> set=<SET or ->` or `-` |
| `ALTAR` | `candidates=<indices>` | `awaken=<i>` |
| `HERO_TURN` | `actor=H<slot> options=<skill>:<target>,…` — `<skill>` the `ActOption` skill index into `def.skills`, `<target>` the living slot index for an `ENEMY` or `ALLY` spec, `-1` for every other spec | `option=<k>` |
| `LAP` | `banked=<n>` | `descend` or `lap` |
| `BANK` | `n=<n> worn=<compact relics> vault=<compact relics> size=<n>` | `take=<indices> drop=<indices>` |
| `FORFEIT` | — | `forfeit at=<HERO_TURN\|ENEMY_TURN> turn=<actorTurns>` (a `HERO_TURN` or `ENEMY_TURN` answered by the player's quit; the turn count is what lets a replay, which auto-answers `Continue` and records no `ENEMY_TURN`, stop at the same enemy turn rather than the next hero turn) |

A forfeit is an `answer` to the pending it quits — `answer HERO_TURN forfeit at=HERO_TURN turn=<n>` — so the `FORFEIT` row above names its fields, not a kind of its own.

**Flush order**, so two correct implementations produce one file: a `draw` line at the draw;
`event` lines are drained from `battle.events` inside each wrapped act immediately before
that turn's `pending HERO_TURN`, and once more after `battleOutcome`; `pending` and `answer`
at the ask; `party` after `createBattle` returns and before any `event` of that battle;
the drain after `battleOutcome` before the next `party` or the `result`; `probe` records
after `result`, in `probes` order, before `end`.

Integers print as integers only when the prototype's value passes `Number.isInteger` and
the Kotlin value round-trips through `toLong()`; every other double prints as bits;
booleans print `0|1` everywhere (`enraged`, `crit`, `glance`, `killed`, `won`, `stall`).
`diff-oracle` has a pretty printer for humans; the hash is over the raw form. `--dump` is
the SHA-256 over the `result` records of a cell.

**The golden set** (recorded at P2 from the oracle on the pinned Node; replayed by the
Kotlin harness). The cells are one machine-readable table, `spec/golden/cells.md`
(`data: GOLDEN_CELLS` — id, mode, seed, policy, runs, ascension, vault, spd, pack, act,
clears, party; the golden path is always `b`, so there is no path column, and in battles mode the `runs` column is emitted as `n=`, no `path=` is written, and the `vault` and `spd` columns are `-` — spec-lint rejects a value there; the battles harness's `--spd` (`BattleCtx.spdDelta`) is never a golden's, while a runs cell's `spd` column is `RunConfig.spdDelta`, which the runs goldens do set), that the binder
generates into constants and both harnesses read — the prototype's through
`prototype/sim/cells.mjs`, the P2 driver that walks every cell through `run.mjs --trace` (which writes the canonical text to stdout; `cells.mjs` redirects it — `run.mjs` keeps its `--flag value` grammar, the capture tools their `key=value`)
and writes `spec/golden/`, beside `fixtures.mjs`; **the cell line owns seed, act,
ascension, clears, policy and the count, and the fixture row it names (`party`) owns the
party, the relics, the lap and the pacts** — so the lap and the pacts come from the row alone — there are no `--lap` or `--pacts` knobs — and the `battle-fixtures` literal means lap 1 and no pacts — a `party` value names a row of
`spec/fixtures/golden/fixtures/` or the literal `battle-fixtures`, the act-1 cells' party — any `BATTLE_FIXTURES` row's
`make()` party, which draws nothing, with the pack from the cell line's `pack=`, so no row
name is needed — whose lap 1 and no pacts the `GOLDEN` clause records; any
other value is a hard error, never a fallback; a `mode=runs` cell, which drafts its own party, leaves the table's `party`, `pack`, `act` and `clears` columns `-` (the runs `cell` record has none of those fields; spec-lint rejects a value there), and its `vault=<n>` equips the first n relics of `spec/fixtures/golden/vault/default.json` — the harness's three kindled EPICs, `VAULT_RELICS` today — typed by the root block `VaultRelics` of `spec/golden/vault.md` (one field, `relics: list<object:VaultRelic>`, so the file is `{"relics": […]}`) — so a cell is regenerated
from its line plus its fixture row, never from the line alone, so the two enumerate the
same set and `diff-oracle` regenerates a cell from its `cell` line and the fixture row it
names:

| Cell | Runs / battles | Purpose |
|---|---|---|
| `runs`: seeds {1, 2, 3, 7, 4242} × nine policies × 10 runs | 450 | the baseline |
| `runs`: `balanced` at A0, A5, A10 × `--vault 0/3` × `--spd 0/+10/−10`, seed 1 × 10 runs | 180 | ascension rows, the Vault, SPD deltas |
| `runs`: `balanced` seed 1 × 10 runs at each of A1–A4 and A6–A9 | 80 | the eight ascension rows the row above skips |
| `runs`: `lapper` seeds {1, 2} × 100 runs, plus one lapper seed chosen at P2 on which a lap-4 run occurs | 200 + 100 | laps 2–3 on the fixed seeds (exponents 0–2 of the `pow` table); the chosen seed puts exponent 3 in the goldens |
| `battles`: the eight act-1 fixtures (`BATTLE_FIXTURES`: five fights, two elites, the boss) × the two act policies (`random`, `balanced`) × 100 battles | 1 600 | the turn, statuses, counters |
| `battles`: every pack of every biome (`fights`, `elites`, the boss — 48 packs) at its home act, A0 and A5, the strong-party fixture, `balanced` × 20 battles | 1 920 | every enemy, every boss's fourth skill; the strong party survives late acts |
| `battles`: a long fixture (the strong party with three GUARD relics against the act-6 boss at A10), tuned at P2 until an ENRAGED turn appears | 20 | ENRAGE |
| `battles`: a **stall fixture** (a party that cannot kill — healers under a VEIL boss at A10 — run to `TURN_CAP`), tuned at P2 until a `STALL` appears; if none appears within 200 tunings, `STALL` is recorded as unreachable in its `GOLDEN-NN` clause and exempted from the coverage gate | 20 | `STALL`, which no other cell produces (0 in 1 010 runs; the contract's stall rate is 0.0–0.1 %) |
| `battles`: a **set-and-sigil family** — the strong party wearing each of the eight 2-piece sets at two pieces and each of the eight 4-piece sets at four (a set has one bonus at one piece count), and each of the twelve sigils kindled, against the act-1 boss at A0, `balanced` × 20 | 28 × 20 = 560 | every set bonus and every sigil effect, which the run cells cannot guarantee |
| the balance snapshot: `balanced` and `random`, seed 1, 200 runs each | 400 | § T5.5 |

`coverage.mjs` at P2 and `sim coverage` at P3 report every `BattleEvent` kind, status,
set bonus, sigil effect, pending kind, room type and ascension row that **appears** in
the set — an event, status or pending appears when a record of that kind exists; a room
type when a `result`'s `rooms` list carries it; a set bonus when a `party` record shows a
hero wearing the set at the bonus's piece count; a sigil when a `party` record shows a
kindled relic with it worn; an ascension row when a `cell` line carries it. Three kinds never
appear and are exempt: `FORFEIT` (no policy forfeits), `ENEMY_TURN` (answered by
`Continue`, never recorded) and the prototype's `BATTLE` (never recorded); their clause
tests bind them (§ T2.3). The fixtures — party, relics, lap, pacts — live in `spec/fixtures/golden/fixtures/*.json` (§ T4.2),
the single source both harnesses read, so the tuned ones are data, not prose; the cell
line carries the rest. **P2's gate requires every kind to appear at least once**,
and a cell is added until it does. Storage: `spec/golden/<cell>.sha256` holds one
`run <k> <hex>` line per run or battle and a final `set <hex>` line, the SHA-256 over the
run hashes' lowercase hex, in order, with no separator; the full text of one run per policy at seed 1 (run 0 of its cell) and one battle per
fixture (≈ 3 MB) is kept under `spec/golden/probe/` for diagnosis; everything else is
regenerated from the oracle on demand and kept as a CI artifact. A reviewer measured a
`balanced` run at ≈ 1 100 draws, 54 pendings and 1 800 events (≈ 0.2 MB of text), so the
full set is a few hundred megabytes — never committed.

### T5.4 The harness

`sim <command> [flags]` reproduces `prototype/sim/run.mjs` mode for mode: `battles`,
`runs`, `selfcheck`, `spd-gate` (the bare `--spd` gate), `snapshot` (§ T5.5), `trace`,
`trace-hash` (the cell's `set` hash over its run hashes), `diff-oracle` (runs the prototype's harness under `prototype/` on the pinned
Node after `npm ci`, regenerates the cell, and prints the first divergent line; it runs in
L3 and nightly, while L2a replays the committed hashes), `fixtures` (the home-act pack
generator), `coverage` (the trace-coverage report) and `replay <save>` (§ T11); flags
`--cell <id> --policy --seed --runs --n --spd --vault --ascension --path --json --dump` (`--cell` is the slug the `cell` line carries — both harnesses take it and `cells.mjs` passes it, so the tracer writes the line and the driver never invents it; `--path a|b|c`
here; the prototype has `a|b`, and the golden path is **b** on both) and the battles knobs
`--party --pack --act --ascension --clears --no-stall-gate` with the prototype's defaults (the lap and the pacts come from the party row)
(`--clears 0`; golden recording and `diff-oracle` pass `--no-stall-gate`). `--dump` is the
SHA-256 over the canonical `result` records on both sides (the prototype's `--dump` is
redefined to match at P2), so it is comparable between the builds.

### T5.5 Balance reproduction

The `DESIGN.md` Balance state table is reproduced from the same seeds and run counts before
P3 closes, and becomes `spec/balance/state-full.md` (the contract's two recorded rows, seed 1 × 5 000 and seed 2 × 2 000, plus its two
verification seeds, 3 and 4242, at 2 000 — a count this plan fixes, since the contract
names those seeds but not their runs — per policy:
11 000 × nine policies ≈ 99 000 runs, 8–10 minutes of harness time, nightly) and `spec/balance/state-reduced.md`
(200 runs, seed 1, `balanced` and `random`; ≈ 2 s; the commit lane). Both are exact
reproductions of identical inputs: a number moves only with a rule clause change in the
same commit. A reviewer reproduced the contract's `balanced` seed-2 row exactly on the
prototype, so the basis is sound.

### T5.6 Public API

`:core` is compiled with explicit API mode; its JVM ABI dump is committed and checked in the
module lane, the klib dumps in the merge lane. The surface is what `:ui`, `:sim` and the
tools need — the same exports the prototype's `game/sim/*` has, plus `session` and `codec`
— and nothing exposes mutable state: results, views and snapshots are immutable data
classes; the battle's mutable actors live inside `Battle` and are read through snapshots
by the screens.

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

For the rules (P3) the same cycle applies with the clause tests and the oracle traces
written before each module; the traces are the acceptance test, the clause tests shape the
code. The escalation rule stays: a lane failing twice on the same approach means change
the approach or escalate the writer's model tier; never loosen the gate.

### T6.2 The test taxonomy

| Kind | Lives in | Checks | Lane |
|---|---|---|---|
| Unit per clause | `:core` commonTest, `:engine`, `:ui` | one rule, named by its clause | L1 |
| Property | `:core` commonTest (Kotest property testing, bounded iterations in the fast lanes, more nightly) | invariants: no compounding, `hp ≤ maxHp`, the dead never act, the rng stream is consumed identically by the three seam paths, every closed union interpreted | L1 (100 cases) · L4 (10 000) |
| Table-driven | `:core` | the spec's tables (enemy scale per act, roll ranges, loot weights), generated into `SpecTables.kt` by the binder; untagged, so they count as writer tests | L1 |
| Differential | `:sim` tests | the committed golden hash lists (L2a); `diff-oracle` against a regenerated trace (L3, nightly) | L2a · L3 |
| Snapshot | `:sim` | the reduced balance table (L2a); the full table (L4) | L2a · L4 |
| Cross-platform hash | `:core` test tasks per runtime | determinism on the JVM, x86-64 ART, the iOS simulator (L3); the arm64 phone or farm device (L4) | L3 · L4 |
| Architecture | Konsist suite in `build-logic`'s quality plugin | boundaries, purity, naming, suppression budget, an assertion in every test body | L1 (touched module) · L2a (tree) |
| Screen | `:ui` commonTest with `runComposeUiTest` | semantics: what is on screen, what is enabled, what a tap answers; virtual time | L1 |
| Screenshot | `:ui` jvmTest with Roborazzi, inside the environment image | goldens per fixture at k = 1 | L2b · L3 |
| Storyboard | `:tools:instruments` | skip-playback: every biome, boss and screen reached with the strong party and the forcing hooks, once by tag and once by keyboard; a two-act run to a KO (L2b); full playback with frames (L3); Android and iOS, two acts (L4) | L2b · L3 · L4 |
| Asset gate | the art tool's tests over `assets/actors/**` (`assets/fallback/**` exempt and reported) | every committed actor against the bible's pass thresholds | L2b |
| Perf | `:tools:instruments` on JVM; Macrobenchmark and XCTest metrics on the phones | allocation rate and relative frame time on the JVM; frame-time histograms, peak memory, app size on devices | L2a (JVM) · L3 (size) · L4 (devices) |
| Mutation | Pitest on `:core` and `:engine`'s pure packages | the tests kill the mutants | L4 |
| Device | Maestro flows | boot, the first ten minutes, every edge target under gesture navigation, the tier drop under forced slow frames, audio audibly playing | L3 (boot, audio) · L4 (flows) |

### T6.3 The writer and the verifier

Every writer gets a blind verifier, made mechanical: the verifier receives the clause ids
and the spec, never the writer's diff or report; its worktree is checked out at the **spec
commit**, not the writer's branch, plus the writer's public API alone — a signature-only stub `:tools:stub` (a `:tools` CLI, § T2.1; built at M5 beside the binder, an S inside P1's L) generates
from the writer's branch, its **klib** ABI dump the input — the merged klib dump the ABI tool builds on `agent-env`
with the Apple targets inferred (its unsupported-target mode), the full Kotlin signatures
L3's dumps carry; the JVM dump erases nullability and type arguments, and a stub built from it
would compile tests the writer's branch rejects — (a dump is a listing, not compilable
Kotlin) — so
blindness is structural and the tests still compile against a module the spec commit
does not have; it writes tests tagged
`Verifier`; the coordinator runs those tests against the writer's branch. Tests that both
wrote stay; tests only the verifier wrote are the interesting ones. The binder marks a
clause bound only by `Writer`-tagged (or untagged) tests as **weak** in the matrix, and a
weak clause does not count toward P3's "matrix 100 %". The critic role (an agent with eyes)
is separate again and reads the review bundle (`VERIFICATION.md` § V3.10) under the
protocol of `FUNCTIONAL.md` § F3.5.

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
| `:sim`, `:tools:*`, the art tool | ≥ 60 % | — | — | — |

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

- Ids follow `AREA(-TOPIC)?-NN`, the regex `^[A-Z]+(-[A-Z0-9]+)?-[0-9]{2,}$`. Areas, each
  with a canonical example: `COMBAT` (`COMBAT-TURN-05`), `RELICS` (`RELICS-ROLL-02`),
  `CHARACTERS` (`CHARACTERS-EMBER-01`), `ENEMIES` (`ENEMIES-SCALE-03`), `RUN` (`RUN-MAP-04`,
  `RUN-FLOW-02`, `RUN-CONFIG-01`), `META` (`META-VAULT-01`), `BALANCE` (`BALANCE-LADDER-01`),
  `PLATFORM` (`PLATFORM-BACK-01`), `SCREENS` (`SCREENS-BATTLE-07`), `ART` (`ART-12`), `GOLDEN`
  (`GOLDEN-03`), `SAVE` (`SAVE-02`), `SYNTHETIC` (`SYNTHETIC-01`, P1's synthetic module, deleted with it in P3's first `:core` commit). Ids are never renumbered or reused; a retired clause
  keeps its id with `status: retired` and a pointer to what replaced it. A bare
  `AREA-TOPIC` (`COMBAT-FORFEIT`, `META-VAULT`, `RUN-FLOW`) names a *family* of clauses,
  never one clause.
- `status` is `proposed` (written, not yet bound), `contract` (bound to passing tests) or
  `retired`; a `known-divergence` note may accompany `proposed` (§ T7.6).
- `owner` names the module whose tests bind it and whose generated `commonTest` receives
  its tables — or `tools/art` for `ART` clauses, whose `data:` tables the art tool parses
  itself and whose tests report as JUnit XML the binder reads like any other task's;
  `paths`, relative to the repository root, lists the source files that implement it, so
  the binder can map a changed file to its clauses. `paths` must exist
  for a `contract` clause; a `proposed` clause may name files that do not exist yet.
- A table marked `data: NAME` with a `types:` line is extracted by the binder into
  `SpecTables.kt` as a typed value, so the document's numbers are the tests' numbers.
- **Granularity**: one clause per independently testable rule or per table; a clause the
  tests cannot name by itself is too coarse, a clause with no test of its own is too fine. A
  clause's prose is ≤ 60 lines; a `data:` table is exempt from the cap (the cell table has
  ≈ 220 rows, the skill table 24), and spec-lint counts prose lines only.
- Prose without a clause id is commentary and binds nothing.

### T7.2 Binding

A test binds a clause by name: the test's name starts with the id
(`"COMBAT-TURN-05 STUN skips exactly one turn"`; Kotest's `displayFullTestPath` is off so
the JUnit name starts with the id). The `spec-binder` task (in `build-logic`):

- generates `SpecTables.kt` and the golden hash constants into a generated `commonTest`
  source set, and `<Module>Fixtures.kt` and the cell table into a generated `commonMain` one,
  before compilation;
- after the tests, parses `spec/**` and the JUnit-style reports of every test task in the
  lane (Kotest writes them on every target; the binder reads one report per task and
  merges), and writes `build/reports/spec/matrix.md` and `.json`: per clause, its status,
  the tests bound to it, their tags (writer, verifier) and results;
- fails the lane when a `contract` clause has no passing test in the lane's scope, when
  a test names an unknown id, or when a `:core` source file is named in no clause's
  `paths` (§ T8's Konsist row points here). The scope of L1 is the clauses whose `paths` intersect the
  touched modules, less the `ART` and `RUN-FLOW` clauses, whose tests are L2b's; the commit lane's scope is everything, and the binder binds once over
  `gate.sh commit`, reading L2a's and L2b's reports together — `ART` clauses bind only
  through the art tool's gate tests and `RUN-FLOW` clauses through the storyboard, both
  L2b, so a matrix over L2a alone would be red from the first bound `ART` clause. **Promotion is pull-request-scoped and
  stateless**: a `proposed` clause bound by passing tests must be promoted to `contract` in
  the same pull request, and the L3 binder run fails a pull request whose matrix has a
  bound `proposed` clause. No lock file, nothing to rebase.

Agents read the matrix as the first page of every verification report. The binder has its
own tests (`VERIFICATION.md` § V9).

### T7.3 Goldens as specification

`spec/golden/cells.md` (the cell table), `spec/golden/<cell>.sha256` and
`spec/golden/probe/*.trace` with a `GOLDEN-NN` clause per **cell family** — the ten rows
of § T5.3's table, not the ≈ 220 cells — saying what the family fixes (the seeds, policies,
mode, ascensions, the oracle tag `ts-oracle-v3` as the rules version until `RULES_VERSION`
exists at P3, the Node version) — landing `proposed` at P2, when nothing in the tree replays
them, and promoted to `contract` in the P3 pull request where the Kotlin harness first
replays the hash lists; the binder generates the per-cell record from `cells.md`,
and spec-lint checks the family, not the cell. The commit lane replays the hash lists. A
golden may change only in one of two commits: a rules change — one that also changes a
`contract` clause of the rules, bumps `RULES_VERSION`, names the cells it expects to change
and carries an approval record (`VERIFICATION.md` § V5); the merge lane checks all four —
or a re-recording, which bumps the `trace` format version and its `GOLDEN` clause, names
every cell as expected, carries an approval record and leaves `RULES_VERSION` alone (the
P3 trace-format fix — a divergence in the encoding itself, not in a rule — takes this route). A golden that changes without a
clause is a bug, whichever of the two is wrong.

### T7.4 Screens and flows

`spec/screens/<screen>.md` holds region clauses (the geometry as the ruler `:engine`'s
`Layout` reads — designed at P5, not transcribed), enabled/disabled rules, the screen's
state schema, and flow clauses in Given/When/Then prose, bound to `runComposeUiTest` tests
by id. **The schema**: any area file may carry a fenced block `schema: <Name>` — each screen file carries one, `schema: <Screen>State`; `spec/golden/fixtures.md` the `schema: GoldenFixture` block (first, the root) and the `schema: VaultRelic` block it nests, which `spec/fixtures/golden/fixtures/` uses; `spec/golden/vault.md` the `schema: VaultRelics` block, whose one field is `relics: list<object:VaultRelic>`, which `spec/fixtures/golden/vault/` uses; `spec/art/bible.md` the `schema: Ramps` block and `spec/art/seats.md` the `schema: Seats` block (§ T7.5) —
one `field: type` per line over the `types:` vocabulary plus `list<type>` and
`object:<Name>` for nested blocks declared the same way; the binder emits named-argument
constructor calls from the fixture JSON and fails on an unknown field. The storyboard's
expectations (which screens a run must cross, in which order, every biome and boss reached
with the strong party — an A3 run — and the forcing hooks; the seed it uses) are
`RUN-FLOW-NN` clauses bound to the storyboard test.

### T7.5 Art

`spec/art/bible.md` holds the bible (`FUNCTIONAL.md` § F3.1) as `ART-NN` clauses with the
numbers, each with its derivation, the alignment definitions, the band rule's recorded
bands from P0, and the critic's protocol; the art tool's gate tests bind them over
`assets/actors/**`. It is opened when the art tool is calibrated and completed when the look fork closes
(P0's exit), from the bake-off report's recorded bands, with the three in-scene bars
recorded from P0's captures. Beside it `spec/art/seats.md` is opened with the per-biome
seat list and the ground colour, exported as the ramps are — to
`spec/fixtures/art/seats/seats.json`, typed by that file's `schema: Seats` block (a spec
file of its own because a stem has one root type and `bible.md`'s is `Ramps`, § T7.4) — six
biome ids, each with six seat ids in anchor order and `spread`, the one id planted at all
six anchors for the seat-spread reading, and `ground`, one sRGB hex: the per-channel
median of the six biomes' two ground strips on the MED `flat=1` resting frames, measured
by `art rulers` at calibration — the seat list committed first, `ground` appended after
the calibration captures that read it — the one file
`capture.mjs seat=all`, `art rulers`, `art gate` and the Kotlin `frames --seats all` and
`frames --icon` all read.

### T7.6 Reconciling and folding `DESIGN.md`

At P2, **before** the fold, the contract is reconciled with the code: the six items
`STATUS.md` names under "DESIGN.md — what looks wrong now that it is built" (the
pixelated-plane amendment and the unstated gain; the missing value-order law; the ship
criteria living in ART-REVIEW.md; the absent frame budget; `minAscensionFor` and the
full-party SUMMON's mend; `compare()`'s blindness to set hooks), the internal contradiction
on the Vault's ascension floor between the *Difficulty targets* and *The Vault* sections,
`STATUS.md`'s three verifier-confirmed balance diagnoses left for the owner (`compare()`'s
blindness to set hooks; the SABLE/LUMEN guard measuring TIDE's rarity; act-1 elites shorter
than trash packs) — folded into `spec/balance/` as `proposed` clauses with `known-divergence`
notes, the post-gate backlog beside § T5.1's function split — and a clause-by-clause diff
against the code. For each: either the clause is written with
the code as truth, or — where the code is the defect (`FUNCTIONAL.md` § F1.4) — with the
rules' behaviour as truth and a `known-divergence` note naming the prototype's screen. Then
the fold: section by section into `spec/` clauses that quote the text; the rules are not
reworded (the mechanics are the baseline); the presentation sections become the design
inputs of § T2.5 and are rewritten at P5 as `spec/screens/` and `spec/platform/` clauses.
`prototype/DESIGN.md` stays frozen under its banner; `spec/README.md` is the narrative
from P2. The fold can be parallelised by area (the areas are the module boundaries). At
P2's end the binder reports the clause count per area, and P3 is re-sized against it. The
fold is complete when every rules clause is bound by P3's end.

### T7.7 Changing the contract

Clause first (`proposed`), then the tests, then the code, then promotion to `contract` in
the same PR with the owner's review (`VERIFICATION.md` § V5); where a rule or a number
moves, the simulator guards, the balance snapshot, `RULES_VERSION` and the expected golden
cells move in that PR too, with the arithmetic in the clause. This is the
designing-mechanics discipline made mechanical, and the `kmp-spec-change` skill walks it.

### T7.8 Spec lint

Unique ids; the id grammar; the `status`, `owner` and `paths` lines present and valid
(`paths` existing for `contract` clauses); every `data:` table parsable with its `types:`
line; every `schema:` block parsable, and every fixture under `spec/fixtures/art/**` — an area the binder never types, as `spec/fixtures/saves/**`, which JVM tests read — validated against its root schema; links resolve; a clause's prose ≤ 60 lines (tables exempt); no two clauses
with the same title; goldens have hashes and a `GOLDEN` clause; cell ids unique across `cells.md` and matching
`^[a-z0-9][a-z0-9-]*$`, since a cell's id names its golden file and is `--cell`'s
argument. Runs in the edit lane on
`spec/**`.

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
| Konsist | module boundaries (§ T2.1), every included Gradle module applying the quality convention plugin (a `build-logic` test over `settings.gradle.kts`'s includes), package layering inside `:core`, naming (`*Screen`, `*Spec`), every `@Composable` screen has a `@Preview`, every `:core` source file named in some clause's `paths` (a binder check — Konsist links a test to a class by name, and this plan's tests are named by clause, so the per-function rule is § T6.5's per-file coverage floor instead), an assertion in every test, suppression budget and expiry, no network library in `:app:*`, no `LaunchedEffect` in the stage | L1 (touched module) · L2a (tree) |
| KGP ABI validation | unreviewed public API changes | L1 (JVM dump) · L3 (klib dumps) |
| Kover | coverage thresholds (§ T6.5) | L2a |
| Compose compiler reports | unstable classes and non-skippable composables in `:ui`'s stage and HUD packages | L2a |
| Android Lint (fatal set, `checkDependencies`, no baseline) | platform misuse, resource problems, performance lints | L3 |
| dependency-analysis (`buildHealth`) | unused and undeclared dependencies, wrong configurations | L3 |
| Pitest | tests that do not test | L4 |
| Gradle `--warning-mode=fail`, configuration cache required | build script rot | every lane |
| `tsc --strict`, typescript-eslint (strict, type-checked), knip | the art tool: types, smells, dead exports | L0 · L1 |
| actionlint, shellcheck, markdownlint, spec-lint | workflows, scripts, documents, the spec | L0 |
| Renovate | stale dependencies | monthly |

### T8.1 Suppression policy

A `@Suppress` must carry a `// why:` comment and either an issue reference or an expiry
date; Konsist counts suppressions per module against a budget (`:core` 10, `:engine` 20,
`:ui` 30) and fails above it; expired suppressions fail. No baselines anywhere: a baseline
is a suppression without a reason. **One dated exemption**: during P3, functions of `:core`
that transcribe a formula or a procedure from the oracle carry `@Suppress("LongMethod",
"CyclomaticComplexMethod", "CognitiveComplexMethod", "NestedBlockDepth", "ReturnCount") //
why: oracle transcription of <file>:<fn>, expires #<the P3-gate issue>` — an issue reference, as the rule requires, closed by the gate — and are counted under a
separate `port` budget that must be zero for the P3 gate to close; the split that removes
them is the gate's last task, made under the goldens.

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
| File length | ≤ 400 lines (the prototype's `battle.ts` is 1 236 lines and becomes the sections it already names) | detekt |
| Functions per class | ≤ 11 | detekt |
| Public API growth | reviewed via the ABI dump diff | KGP |
| Module edges | § T2.1 | Gradle + Konsist |
| Suppressions | § T8.1 | Konsist |
| Dead code | zero: explicit API + `allWarningsAsErrors` + dependency-analysis; knip for the art tool | compiler, plugins |

A budget is raised only by a commit that says why in `CLAUDE.md`'s budget table; the port
exemption of § T8.1 is the only suspension and it has an end date.

## T9 Rendering and performance

### T9.1 The logical frame

`Frame` letterboxes a 1280×720 logical space into the window at scale
`k = min(w / 1280, h / 720)` in device px, centred, with the platform's safe insets and
gesture-navigation edges folded into the mutable inset (24 px all round; 40 px bottom on
phones; larger where a notch demands). Screens position composables in logical px through
`LogicalLayout` (a custom layout that applies `k`); `Layout` is the shared ruler, designed
at P5 for the new screens (README question 2 decides landscape or portrait before that;
the plan is written for landscape, and a portrait frame would change `Layout`, every
screen and the stage composition — costed in the README). Hit rects are grown to
`TAP_MIN = 96` logical px around their centre by the same registry. Goldens are rendered at
`k = 1`.

### T9.2 The stage

`Stage` draws one `StageScene` per frame, in this order: the baked planes at their
parallax offsets (far, mid, floor, near; depths 0.3 / 0.62 / 0.9 / 1.35) and the baked light
map with the shafts in it (`Plus`); the fog banks and motes (composites of baked sprites,
animated by the injected clock, behind the actors); contact shadows; actors in painter's
order, one `drawImage` each; the per-actor gain (`ColorDodge`) and rim spill (`Plus`) from
baked feathered sprites; effect blits; damage pops; the bloom (§ T9.4); the grade
(`Multiply`) with the vignette; the sky body after the grade. Everything blurred is baked
**once per (biome, tier)** from the unblurred planes with a separable CPU box blur ×3 into
`ImageBitmap`s at boot or on biome entry; no platform blur effect is used in the frame
path. Until the scene phase a biome is one flat, unlit placeholder plane at the padded size
(§ T10.9, the same image at every tier) and its light data, so the whole path exists from
P5 with nothing to bake but the light map and the grade — at MED and HIGH the light map
(key, fill, both pools, shafts) over the plane before the actors, the contact shadows under
them, and after them the per-actor gain, the spill, the bloom and the grade's multiply, as
§ T2.5's ladder says; at LOW the key light and the
grade baked into the plane plus the vignette-only grade map per frame, as the prototype's
LOW draws, so P5's LOW frame is the composite under LOW's bake, captured at P0 through the
same `flat=1 tier=LOW` path; the plane is drawn as the
prototype's flat tiers draw their merged plane — at `-PLANE_PAD`, no parallax and no
shake lag at any tier (`engine/light.ts`'s LOW blit) — until P6 lands four planes at the
four depths.
**Residency**: at most two biomes' bakes are held (the current and the previous); entering
a third releases the oldest. Bakes run off the main thread at the platform's discretion.

### T9.3 Hard pixels and the device scale

Atlases hold each frame at cell resolution — 64 × 64 or 96 × 96 texels — and one cell is
drawn at `2k` device px. Where `2k` is an integer (a 1080p phone letterboxes to `k = 1.5`,
so a cell is 3 device px), the actor plane is sampled nearest and is genuinely crisp; where
it is not, the actor plane is sampled bilinear, because uneven cells shimmer. Decided once
at boot from `k`; the setting is visible in the debug drawer.

### T9.4 Bloom and CRT (D11)

The plan's default is a **bright-layer bloom**: the things that are bright by design — VFX
particles, prop glows, the sky body, pops — are drawn a second time into a 320×180
`ImageBitmap` on the CPU, blurred with the same separable blur, and added back (`Plus`)
upscaled with smoothing. It is deterministic, identical on every platform, allocation-free
after warm-up (one buffer, one `IntArray`), and it costs under a millisecond on a phone
CPU. It is decided **at P5 on the real stage**, not at P0 against the prototype: the
spike renders the ten first-ten-minutes screens of `FUNCTIONAL.md` § F1.5 plus one hit
peak per biome — sixteen frames — with the bright-layer bloom and with the fallback, a
platform blur on a bright-layer composable (`Modifier.blur` on Android 12+ and on every
Skiko target, with per-platform goldens — a fallback that is a no-op below API 31, so
choosing it raises minSdk to 31 as an owner decision recorded in the register at P5, D3
and D11, because the plan has one render path), and the critic, under its protocol, judges them
on the rubric; the CPU bloom stays unless the critic prefers the fallback on more than four
of the sixteen or on any hit peak, in which case D11 is amended. ARCADE's halation reads
the same buffer on every platform, so bloom and halation never both run; scanlines, the
vignette and flicker are cheap overlays, and the phosphor lift is neutral.

### T9.5 Budgets

| Where | Tier | Budget | Checked by |
|---|---|---|---|
| Desktop JVM, headless software Skia, 1280×720 (`agent-env`, `hosted-linux`) | HIGH | the stage's own draw allocates nothing after warm-up; the whole frame's allocation rate ≤ 2× the hello-world Compose baseline recorded at P1; the stage's draw time **relative** to a reference scene rendered in the same run ≤ 1.3× — absolute milliseconds are not asserted on shared cloud hosts | L2a perf test |
| `hosted-linux`, the merge lane | HIGH | the same relative assertions as the row above, plus the absolute draw p95 at rest and at a hit peak **recorded** in the ledger against a provisional expectation of ≤ 9 and ≤ 14 ms — provisional because the prototype's 7.3 and 11.5 ms are medians on headless software Chromium, so the expectation is the median × 1.25 until P1's benchmark on the hello-world stage and P5's on the real one record a p95 — and not asserted, since row 1's rule holds on any shared runner; the absolute assertion is the device lane's | L3 perf test |
| Reference Android (2022 mid-range) | MED | frame p95 ≤ 12 ms at 60 Hz, including a hit peak; peak resident set ≤ 250 MB | L4 Macrobenchmark |
| Reference iPhone 12 class | MED | frame p95 ≤ 12 ms; peak resident set ≤ 250 MB | L4 XCTest metrics |
| Any device | LOW | never below 30 Hz; the auto-drop exercised by a forced-slow-frame device test | L4 |
| App size | — | ≤ 100 MB installed, re-derived at P5 from the accepted cast, measured per build | L3 size test |
| Boot | — | title in ≤ 2 s cold on the reference phone | L4 |

`note(frameMs)` keeps the prototype's rule: HIGH/MED drop to LOW after 60 consecutive
frames over 20 ms, one way, per session.

### T9.6 Text

The HUD face is one bundled open font (Inter or Roboto; chosen in P1 for its rendering at
18 px on Skia; its licence file ships in the app and is named in the credits, `FUNCTIONAL.md`
§ F2.5), drawn through `TextMeasurer`/`drawText` in the stage and `Text` in the HUD
composables; letter spacing and sizes are `Layout`'s, and the contract's character limits
are re-validated in the bundled face at P5 when the screens are designed. The two bitmap
fonts are baked to glyph atlases from their tables (`assets/fonts/<name>.json`, every
field of the prototype's `BitmapFont` values exported verbatim at P0 by `export-fonts.mjs`,
§ T4.2, case folding and baseline included);
damage pops and the logo draw from them with nearest sampling.

### T9.7 Memory and size (re-derived at P5 from the accepted cast)

| What | Estimate | Note |
|---|---|---|
| Actor atlases | 645 frames at cell resolution: 555 × 64² + 90 × 96² texels × 4 B ≈ **12–14 MB** RGBA resident; a few MB as PNG | one bake per actor (its own element); cropping to the silhouette halves it again |
| Backdrops on disk | placeholders: six unlit composites at 1360 × 800, the floor drawn crisp at 1:1 over the resampled far and mid, ≈ 4–10 MB as PNG (measured at P0); after the scene phase, 24 unblurred planes (six biomes × four) ≈ 1360 × 800 each, **15–40 MB** as PNG, less with lossy WebP for the opaque far and floor planes | the light rig's parameters are data, not images |
| Backdrops resident | one biome at HIGH ≈ 26 MB of baked bitmaps (four planes, the light map, the grade at 1360 × 800 × 4 B); two biomes resident ≈ 52 MB | § T9.2's residency rule |
| Sound | 24 clips, three variants each ≈ 4 MB as WAV, ≈ 1 MB as Ogg | |
| Install | ≤ 100 MB | the size test fails the merge lane above budget |

### T9.8 Audio

The synthesizer is not ported. At P0 `prototype/tools/render-sfx.mjs` renders the 24
effects through the prototype's own synthesizer offline — a page-level shim puts an
`OfflineAudioContext` behind `globalThis.AudioContext` and a seeded `mulberry32` behind
`Math.random`, so the clips whose source draws at play time (the start offset, the
partials' timing, the noise) get three seeded variants — to 48 kHz 16-bit mono WAV in
`assets/sfx/`, hashed and committed as assets with the prototype's commit in their
manifest (§ T4.2). `SfxPlayer` (`expect`) has one implementation per platform (Android `SoundPool`,
iOS `AVAudioEngine`, desktop `javax.sound.sampled`) with `play(clip, gain)`. Pitch in the
prototype is a frequency shift with fixed envelope durations, not a resample, and no call
site uses it today; if a pitched variant is ever wanted it is rendered offline the same
way, never resampled at play time. The per-name cooldowns, variant choice (seeded
presentation rng), volume and mute are common (D12).

### T9.9 Input and focus

One model, `Focusables`: every tappable — a composable button through its semantics node,
an actor through its stage rect — registers a logical rect, an index, a group and a
disabled flag each frame. Pointer events resolve drawn rects first, then `TAP_MIN`-expanded
rects; a tap commits on release in the region it began in; `pointercancel` and lifecycle
pause clear pressed state without firing a release. Keyboard focus moves spatially (the
±50° cone, distance + 2× perpendicular, wrap to the far edge in the group, index cycling
on a flat row, twins skipped); A activates, B backs, PAUSE pauses, digits 1–3 cast;
Android's back gesture and button are B, with a confirm before leaving the app from the
title or the map. The drivers tap by test tag or by logical geometry, so a screen that
draws a button somewhere else fails the storyboard; a nightly Maestro flow taps every edge
target with gesture navigation enabled.

## T10 Assets and the AI image pipeline

### T10.1 Stages

```
brief (spec/art + the actor's row) → prompt pack → generate (key-pose candidates, then every frame of the finalists)
  → normalise (alpha clean-up, crop, integer downscale to the cell, palette quantisation onto the element ramp, keyline check, cell alignment)
  → gate (the metrics of § T10.4; pass thresholds, targets reported) → contact sheet
  → critic (an agent with eyes, under its protocol: the sheet, the lit frame at 1:1 and 2×) → owner (yes / no)
  → accept: PNG + manifest committed under assets/actors/<ID>/ → atlas build (a Gradle task) → frame goldens re-recorded with approval
```

The art tool (`tools/art/`, TypeScript) is a CLI (`generate`, `normalise`, `gate`,
`rulers`, `sheet`, `accept`) and a test suite (the gate over every committed actor, run in
the commit lane). Generation is never part of a build; the accepted PNG is the source of
truth. Provider keys are environment secrets the owner sets, and **the hard ceiling is the
providers' own**: every key is prepaid, or under a hard cap the provider enforces — a requirement, not a preference, checked at P0's terms check: a provider that can be neither prepaid nor hard-capped (a post-paid API whose budget only alerts — which metering each candidate has, P0's terms check records, § T10.2's table naming the known cases) is not used, whatever the bake-off says, because the counter below is a mirror and a mirror cannot hold a ceiling; reaching a cap is the stop trigger — the bake-off's keys
$300 in all — RD Pro $150, each painted arm $60, the portrait stills $30, re-split at P0's terms check if a provider drops out — (a second bake-off another $300 by name; a change of provider mid-cast loads new keys capped at the cast ceiling's unspent remainder, so $4 000 stays the cast's *usage* ceiling across providers unless the owner raises it by name — a prepaid key's unspent balance is stranded at the abandoned provider, which is why capping, not prepaying, is the default), the sprite provider $3 500, the
portrait provider $500 (together the $4 000 the cast may cost at per-image prices), P6's plane key $500 on top only if question 4(b) approves it, a subscription
provider the months the owner pays — so a worktree race or a bypassed tool can spend
nothing the owner did not load. The tool's counter mirrors that: `art generate` gives
every call an id, writes a row `{id, kind: bakeoff|cast|plane, key, provider, actor, images,
cost}` — `key` naming the provider key the call was billed to, which the counter sums by — as its own file `assets/spend/<id>.json` before it returns — one file per call, so pull
requests held open together never conflict on a shared ledger, and the counter sums the
directory — and stamps the id on the manifest's
generation entries; the session's pull request carries the rows whether or not an asset
was accepted (a run with nothing to accept leaves its spend rows to ride the next pack's pull request; the counter reads the local ledger, committed or not, so the cap holds meanwhile), `art gate`
fails an actor manifest whose generation ids have no rows, and `art generate` refuses a
call once a key's rows reach 90 % of that key's own cap ($3 150 on the sprite key, $450 on
the portrait key) — so the stop trigger of
`FUNCTIONAL.md` § F3.5 fires before a provider refuses. The counter is a mirror, never the
ceiling. `art generate` accepts as references only committed asset ids under `assets/`,
and `art gate` fails a manifest that names any other reference, so the rule that no
third-party image enters a prompt is enforced by the tool, not by discipline.

### T10.2 Providers

A provider is an adapter behind one interface — `generate(prompt, negative, references,
size, seed?) → candidates` — so the bake-off compares like with like and the cast is made
with **one** sprite provider and one portrait provider. Candidates at writing; every
provider's terms are verified in writing at P0 and recorded in `assets/LICENSES.md` before
it is used:

| Provider | Fit | Pricing | Terms at writing (verify at P0) |
|---|---|---|---|
| Retro Diffusion (RD Pro) | pixel sprites from text with up to nine reference images; trained on licensed pixel art | per image (RD Pro ≈ $0.18) — the per-image sprite provider | outputs owned by the creator and usable commercially |
| PixelLab | pixel characters as posable skeletons with animation and rotation (option (a)); API and an MCP server; sprite-sheet export | subscription — plan, price and monthly generation allowance read from its current terms at P0 | commercial use of outputs to be confirmed at P0; option (a) is in the bake-off only if the terms pass |
| Gemini image models | reference-conditioned generation and editing; strong consistency | per image, metered by Cloud billing, which alerts and never caps — its hard cap is the API's per-day request quota lowered in the Cloud console — a rate, so P0's terms check records that quota times the cast's calendar days below the key's cap, or admits Gemini on a prepaid balance only, or Gemini leaves the bake-off | portraits and the painted look; API terms to be confirmed; without a confirmed cap the painted arm is FLUX.2 alone |
| FLUX.2 through Black Forest Labs' API | up to eight reference images | per image | portraits and the painted look; API terms grant commercial use — but the openly distributed **FLUX.1 [dev] weights are non-commercial** and are not a fallback |
| Self-hosted Stable Diffusion XL under CreativeML Open RAIL++-M with a LoRA per character, or FLUX through an authorised API with LoRA support | maximum control and repeatability | GPU time, outside the per-image counter | the commercial-clear self-host fallback if hosted providers cannot hold consistency |

A provider without written commercial terms is not used. No third-party artwork is ever
passed as a reference image (`FUNCTIONAL.md` § F3.1); the reference set is the hand-drawn
study and the accepted cast.

### T10.3 Animation strategy

| Option | How | Bet |
|---|---|---|
| (a) posable skeleton | the provider generates all fifteen frames from one character (PixelLab) | consistency by construction; the pose vocabulary must be expressible |
| (b) key poses + a procedural breath | thirteen generated frames per actor with references — every frame of attack, hurt, cast and dead, and idle's first frame — with idle's two in-betweens made by the rig's one-cell breath and follow-through (a translation passes the absolute idle criterion, and idle is the one pose where a translation *is* the motion) | fewer generations; the settle band and the aligned criteria must still be met by the generated frames |
| (c) master still + segmentation into a part rig | one still cut into parts and animated by an anchor rig written for it | painted parts in motion; fiddly segmentation; a rig to write |

The P0 bake-off runs (a) and (b) on six actors (EMBER, GALE, HOLLOW_KING, CINDER_IMP,
ASH_HOUND, DUST_WRAITH) under the protocol of § T10.7, **generating every frame of the
finalists** so the motion criteria can be measured, with the study as the reference; (c)
is tried only if both fail the gate twice.

### T10.4 The gate

**One tool, built at P0, in TypeScript** (`tools/art/`, size M): it lifts the sheet metrics
the prototype's `lineup.ts` computes today — L* min/p2/p50/p98/max (p50 is new — `lineup.ts` computes no median), the five bands, the share
below L 35 (whole and interior), above L 75, the lit-from-above delta, colour count,
the contrast columns (mean, min and the sub-3:1 share), mirror IoU, nearest-silhouette
IoU — into a tool that reads a PNG frame with a typed
sidecar, and adds, from ART-REVIEW.md's definitions, what the prototype never committed
(the review's motion, palette and seat numbers came from scratch decoders): the motion
metrics (the absolute settle band and idle change over the union-of-masks denominator;
the aligned part travel, crown rise, dead height and dead-vs-idle difference, with the
alignment defined in `FUNCTIONAL.md` § F3.1), the 8-connected component count, the two
palette metrics — the **cast** palette overlap between actors (< 25 %) and the
**frame-to-frame** palette overlap within an actor (≥ 75 %) — the height consistency, the
halo check, the portrait criteria of `FUNCTIONAL.md` § F3.3, and the **in-scene rulers** — the seat ruler, the two ground
strips, the seat spread and, with `--ground`, the strips' per-channel sRGB median that
`seats.json`'s `ground` records — over any battle frame that carries an **anchors file**
`<frame>.anchors.json` = `{frame: {w, h}, seats: [{seat: 'H0'…'E2', id, pose, frame, feet:
{x, y}, box: {x, y, w, h}}]}` — the strips are derived **per seat** by `art rulers`,
because the six seats stand on three feet rows. **The strips' geometry, stated once**: per
seat, strip 1 is rows `feet.y + 2 … feet.y + 10` and strip 2 rows `feet.y + 30 … feet.y +
40`, each sampled over columns `box.x − 8 … box.x + box.w + 8`, **excluding every cell
under another seat's mask** (the seats of a rank stand 68 px apart, so a back seat's strips would
otherwise sample the next body; the ratio is taken over the surviving cells, and a seat
whose surviving strip keeps under half its columns counts as a miss in the share, never
silently dropped); the strips are `art rulers`'s own derivation from `feet` and `box`, reported in
its output and never written by a producer; the actor's median is
taken over its masked cells, and the mask comes from the producer too — each writes
`<frame>.masks/<seat>.png`, the drawn sprite's alpha at frame scale, beside the anchors
file. This ruler is re-derived here, not calibrated: ART-REVIEW.md measured its strips at
other offsets over 0.9× the sprite width, so its recorded in-scene readings are context,
not a target. Both producers write the anchors file and the masks by that rule: the prototype's `capture.mjs battle pixel=<dir> … anchors=1` frames at P0 (a
candidate standing on the real crypt stage through the `PixelActor` registry, § T4.2) and
the Kotlin `frames` instrument's from P5, which writes the same file. There is no Kotlin
re-implementation to keep in step; the Kotlin side only produces PNGs and anchors files.

**Calibration** (P0, in the bake-off report): the sheet metrics reproduce the prototype's
`metrics.md` cell for cell on the fallback sheets; the value targets read the study at
31 / 51 % and the prototype's EMBER at 51 / 43 %; the motion and consistency metrics are
run over the prototype's 43 actors at P0's frozen tree — the round-14 cast, the tree P2
tags `ts-oracle-v3` — and reproduce
ART-REVIEW.md's **round-14** re-derivation: settle 20.4–38.8 %, idle 20.4–55.8 %, crown
rise 1–3 cells on all 43, dead height 25–56 %, one 8-connected component in all 516
non-dead bakes, nearest silhouette IoU max 76.7 %, mirror IoU max 80.2 % (the cast palette
overlap maximum, 18.4 % at round 13, is re-measured at P0, since round 14 changed a ramp)
and its named per-actor values. **A disagreement is adjudicated, never auto-resolved**:
for the criteria `tools/out/metrics.md` reports — the span, the below-L 35 and above-L 75
shares, the interior share, the five bands, the colour count, the lit-from-above delta,
the contrast columns, mirror and nearest IoU, all with a reference implementation in the
tree — the reproduction must be exact before any band may move; for the criteria whose
recorded numbers came from scratch decoders that were never committed (settle, idle,
crown, dead height, the component count, the palette overlap) the recorded value is
context, not a target — as the in-scene strips above — and every disagreement of either
kind is enumerated in the bake-off report and decided, one by one, as a tool bug or a
definition change, with the owner's sign-off, which is the calibration's exit: an
undecided disagreement, not a non-zero one, is what holds P0 — only then does a changed
definition's new p10–p90 become the band (§ F3.1's band rule). **The calibration is a golden**: the tool's table over
`assets/fallback/**` is committed as `spec/art/calibration.json` and asserted in the commit
lane, so a change to how L*, the masks or the alignment are computed is a golden change
with an approval record, like a screenshot; `tools/art/**` itself is code-owned, and at
P1 the golden is re-asserted against a second reader written independently from the
definitions — a JVM test in `tools/instruments/`, run in L2b beside the golden it checks, asserting
the integer-rounded L* fields and the counts exactly, the one-decimal shares and IoUs
within 0.5 and ΔE within 0.1, a disagreement beyond that going through the calibration's
own adjudication, never a silent re-record; the sheet's metrics alone, not the motion or
in-scene sets, an S inside P1's L —
so a P0 tool bug cannot become the contract unnoticed. The fallback cast is
exempt from the *gate* and reported, so a settle of 19 % on one of the 43, were the tool
to read one, would be a calibration point to adjudicate, not a P0 failure. The in-scene
ruler's three bars are measured here on the prototype's landed rig under § T10.4's own strip
rule, over the fixed set of 36 seats and 72 strip readings, one per tier — LOW and MED over the flat composite through the `flat=1` path for P5,
HIGH on the landed rig for P6 (under question 2's portrait branch, re-recorded at P5 on the portrait placeholders, § F3.1) (the round-13 record of 106 of 108 was taken under the older strips and is scale only), since
the prototype's own record makes it the scene's number, not a sprite's (`FUNCTIONAL.md`
§ F3.1).

**The metrics and their status.** *Sheet, pass*: `FUNCTIONAL.md` § F3.1's *Pass* bullets —
the value span, the shares below L 35 and above L 75, lit from above — as the prototype's
`lineup.ts` measures them (ART-REVIEW.md's criterion 3, the chin shadow and the seams, is
the critic's). *Sheet, reported only*: contrast against the line-up ground —
ART-REVIEW.md's criterion 6 is **retired**. *Size, pass*: the bands of § F3.1 per actor
kind, measured on idle 0 as the silhouette's height in cells. *In scene — reported for a sprite, pass for the stage at P5 and P6*: the WCAG
relative-luminance contrast between the actor's median masked cell and the strip's median
surviving cell, `(Y_hi + 0.05) / (Y_lo + 0.05)` ≥ 1.5:1 at both strips, on one fixed set —
the six seats of each biome's resting frame, 36 seats and 72 strip readings, the seat list
recorded in `spec/art/seats.md` at P0 (`spec/fixtures/art/seats/seats.json`, § T7.5; which fallback actor stands in each seat of each biome, the population both producers plant), an excluded seat a miss, the fallback cast planted as a fixed reference —
with three bars recorded at P0 under this strip rule, one per tier, each the count of the
72 readings at ≥ 1.5:1 the rig achieves (a frame set counting below it fails): P5 is gated
at LOW — the key light and the grade baked into one flat plane plus the vignette-only
grade map per frame, recorded through the `flat=1 tier=LOW` path over the committed
composite (§ T4.2), since `bakeFlat`'s own frame resamples the floor P5 draws crisp — and at the tier
the reference phone's benchmark picks (MED), the frame the testers see, recorded over the
flat composite lit by the rig at MED with its bloom off (§ T4.2's `flat=1 tier=MED` frame;
the app's bloom is bright-layer, § T9.4, and lifts no resting ground), not over the
diorama; P6 at HIGH on the landed rig, with LOW and MED not below the P0-recorded LOW and MED bars; ARCADE
exempt as a stylisation (§ F3.1) (the record's 106 of 108 was measured under the older
rule and is scale, not a bar); the seat
spread — the largest excess of a seat's torso median (rows 0.33–0.72 of the silhouette's
height) over the median seat of the same biome frame's, reported as the maximum over the six
frames, an L* value that is reported, not gated — the rig's own measure with one id at all six anchors, `seat=<id>` and `frames --seat <id>`, 5 L* the intent; the strips excluding every other seat's mask
(`FUNCTIONAL.md` § F3.1). *Motion, pass*: idle change ≥ 17 %
and the settle band 20–39 % (round 12's widened band), both **absolute** over the
union-of-masks denominator; the aligned criteria with their bands under the band rule.
*Halo, pass*: with the silhouette defined as the cells at α ≥ 128 after `normalise`, at
most two cells with 0 < α < 128 in the one-cell ring outside it exceed the actor's p50 L*
by more than 20, and no cell with α > 0 lies farther than one cell outside the
silhouette (a stray pixel). *Portraits, pass* (the
manifest declares `face: {x, y, w, h}` in chip pixels): the face rect lies inside the
48-px chip inset by ≥ 4 px; within it, at least two 8-connected components of ≥ 12 px
below L 35 and at least one of ≥ 4 px above L 75; **the element's hue must be present**: at least 15 % of the chip's cells within
ΔE 12 (CIE76, in CIE Lab) of the element ramp's accent or glow colours as
`spec/fixtures/art/bible/ramps.json` records them (hair, headgear and collar carry it; a face
alone need not), each cell assigned to its nearest ramp, the neutral ramps the element does not share —
`ramps.json`'s `neutrals` list, nine ramps today — permitted and uncounted, while a ramp the
element shares with the neutrals counts for the element (FIRE's glow is byte-identical to
the neutral glow in `game/art/actors.ts`, and the exclusion must not delete the element's
own signature) — counting every neutral, or asking the face itself to be
element-coloured, would make the criterion unfailable or unpassable; consistency with the sprite and the absence of text or
a watermark are the critic's. *Targets* (reported): p50 31–40 with ≥ 45 % below L 35, which alone gates P4's six
heroes; heroes ≤ 65 % nearest IoU, reported at P4 and measured against the accepted cast
only once twelve actors are accepted, never a gate (the prototype's own round 13 left 14
of 66 pairs above it). **Look B**: keyline, colour count, cell alignment,
component count and the halo are reported, not gating (`FUNCTIONAL.md` § F3.2). **Partial casts**:
the cast-wide criteria are measured against the accepted actors plus the fallback actors
standing in for the rest, and gate only once twelve actors are accepted. Output:
`metrics.md` and `.json`, one row per actor and per frame, PASS or the failing criteria;
the same code runs as tests over `assets/actors/**` in the commit lane.

### T10.5 Normalisation rules

Allowed: alpha clean-up and de-halo; crop to the silhouette; integer downscale with
nearest sampling to the cell; palette quantisation to ≤ 24 colours mapped onto the actor's
element ramp and the shared neutrals; keyline enforcement (a missing keyline cell is
added in the material's dark step); cell alignment; mirroring to face right. Forbidden:
repainting content, upscaling, blur, any per-pixel edit an agent makes by hand without
recording it as a normalisation step. Normalisation is deterministic and idempotent
(`normalise` twice is a no-op), so it can be re-run over the whole cast when a rule
changes. At the bake-off, look-B candidates skip the quantisation and the integer
downscale and are resampled bilinear to the cell canvas before measurement, so the
per-cell value, silhouette and motion metrics run on both looks at one resolution.

### T10.6 Provenance, licensing and continuity

`assets/actors/<ID>/manifest.json` — beside the fifteen frames, each with the same
`<pose>-<frame>.json` sidecar as the fallback cast (§ T10.9: canvas, cell, element, pose,
frame, feet, hitRect), written by `art accept` from the normalised frame — `hitRect` derived as the silhouette's bounding box over the torso band, rows 0.33–0.72 of its height (§ F3.1's band), never authored as the prototype's per-recipe `hit`/`hitSize` are, and the fallback sidecars carry the same field computed by the same rule from the captured frame, so a mixed cast ships one hurtbox definition — which is what the
gate reads and the atlas and the stage anchor on —: provider, model and version, prompt hash (the prompt
text lives beside it), references used (by asset id), the provider's seed where one exists,
date, the normalisation steps applied with their parameters, the licence, the gate results
at acceptance, who accepted — and the merge lane matches "who accepted" to the owner's
approving review on the pull request that commits the asset, since `assets/**` is
code-owned. `assets/LICENSES.md` lists every provider's terms as verified. Prompts never
name a third-party game, character or artist. The copyright position of generated output
is stated in `FUNCTIONAL.md` § F3.6. **Continuity**: every accepted asset, prompt and
reference is archived; the accepted cast is the reference set for later actors (and a
trained style reference where the provider offers it); a change of provider or model means
a whole-cast re-gate and a critic round, priced in the README's money table.

### T10.7 Cost model and ceiling

**The bake-off protocol**, per (look, option, provider): eight candidate *stills* of the
key pose (idle 0) per actor, 6 × 8 = 48; the two best per actor by the gate and the critic
are animated in full, 2 × 6 × 14 remaining frames ≈ 168 under option (a), 2 × 6 × 12 = 144 under (b); about
216 images per (a) combination and 192 per (b). The combinations: pixel (a) on PixelLab (subscription), pixel (b)
on RD Pro and on PixelLab, painted (b) on Gemini and on FLUX.2, plus 48 portrait stills —
about 620 per-image generations (3 × 192 + 48; RD Pro ≈ $35; Gemini and FLUX.2 ≈ $10–30 each; portraits
a few dollars) with a factor of two for re-rolls, so **≈ $250 in total including one
month of the subscription provider** — whose plan, price and monthly generation allowance
are read from its current terms at P0's terms check: the arithmetic assumes about $50 for
the month and an allowance above the protocol's ≈ 410–820 generations on that provider (216 + 192, twice that with re-rolls),
and a lower allowance drops option (a) from the bake-off, recorded in the spike report —
at the cost of the consistency-by-construction that only its posable skeleton offers, since
option (a) exists on the subscription provider alone and cannot move to the per-image ones. Cast: 559 frames under option (b), the per-image option — idle's two in-betweens come from
the rig — × six candidates ≈ 3 350 images ≈ $600 at RD Pro's price is the *first-pass*
number (option (a), the subscription provider's posable skeleton, is priced in its months,
its 645 frames the resident count), re-derived at P0's exit once the option is chosen; at the tolerated 60 % gate rejection
and the owner's taste rounds the expected spend is **$1 500–2 500**. **The cast's ceiling is $4 000 of per-image spend**, held as the providers' own caps
(§ T10.1: the sprite key $3 500, the portrait key $500) and mirrored by the tool's
counter, which refuses at 90 % of each key's own cap so the stop trigger fires before either key does. The worst
case, which ends in a self-hosted style model, adds GPU time outside those caps —
≈ $300–800 — and with any subscription is a separate budget the owner approves by name;
the two numbers are not one ceiling. Reaching the ceiling is a stop trigger like the two
decision points of `FUNCTIONAL.md` § F3.5, with the same three branches — a budget the
owner raises by name (a new cap on the key), a change of provider, or stop with the cast
as it stands, mixed where it is mixed (the fallback actors standing in for the rest, which
§ T10.4's partial-cast rule already measures) and approved by name as a shipped state.
P6's planes, if question 4(b) approves them, have their own $500 key, on top of the
$4 000. If the bake-off's winner is a subscription provider, the cast is priced in months,
not images — P4's two to four sessions over about one to three calendar months at the
plan's price, ≈ $50–150 — and its ceiling is the months the owner pays: a month that ends
with the cast incomplete is the same stop trigger, the branches being another month by
name, a change of provider, or stop; P0's terms check records which metering the winner
has, so only one of the two ceilings applies, and that its key can be prepaid or capped — a provider that can be neither is not used (§ T10.1). The *change provider* branch of
`FUNCTIONAL.md` § F3.5 costs a second bake-off at P0's exit (≈ $250 and half a session to
a session, from P0's re-estimate) or the whole-cast re-gate mid-cast. Every response is cached;
an accepted asset is never regenerated.

### T10.8 Reproducibility

Generation is not reproducible across providers or time; the accepted PNG is the source.
Everything after it is: normalisation, the gate, the atlas build and the frame goldens.
Atlases are build outputs, never committed.

### T10.9 The fallback cast and the placeholders

At P0 the prototype's art is captured once, as assets with the prototype's commit in their
manifests, and never regenerated:

- **`assets/fallback/actors/<ID>/<pose>-<frame>.png`** — every actor's fifteen bakes at cell
  resolution with a sidecar `{ id, canvas: 64|96 (128|192 for a look-B candidate), cell: 2 (1 for look B), element, pose: idle|attack|hurt|
  cast|dead, frame: 0..2, feet: {x, y} in cells from the canvas origin, hitRect: {x, y, w,
  h} in cells }` named `<pose>-<frame>.json` beside each PNG. Three uses: the gate's
  calibration set (§ T10.4), the stage's placeholder actors from P1 until the cast lands,
  and the base of option B if the owner stops the AI programme.
- **`assets/fallback/study/ember-study.png`** and **`ember-study-x4.png`** — the hand-drawn
  study at cell resolution and ×4 with the same sidecar: the reference image every prompt
  starts from.
- **`assets/fallback/backdrops/<BIOME>.png`** — one flat, unlit composite of the
  prototype's far, mid and floor painters per biome, from the bake path at the padded plane
  size, drawn by the stage as a single plane at every tier and lit by the rig from
  `light.json` (§ T4.2) until the scene phase, the pools following the anchors it carries.
- **`assets/sfx/`** — the 24 rendered effects (§ T9.8).
- **`assets/fonts/`** — the two bitmap fonts' tables as data (`<name>.json`); the bundled HUD face (Inter or Roboto, § T9.6) lands here at P1 with its licence file, not at P0.

P5 ships the screens over the fallback actors where the cast is not yet accepted and over
the flat backdrops; P4 replaces the actors behind the gate; P6 replaces the backdrops.

## T11 Persistence, saves and replays

- **A run** is `(RULES_VERSION, seed, RunConfig, [debug], decisions[])` in `:core`'s canonical
  text encoding — a `save <format> rules=<N> snap=<S> seed=<uint32>` line, the `config` record, the `debug`
  preamble if any, `resumed <S>` if the log was restarted from a snapshot (§ T5.3), then the `answer` records — where `debug` is the forcing preamble of § T5.3, applied through `RunDebug` (§ T2.3) — present only in a
  storyboard's forced run — and the decisions are the `answer` records of § T5.3 (every `HERO_TURN`
  included, `draws=0` for a human) and `ENEMY_TURN` is never recorded — except that a
  `FORFEIT` given at an enemy turn carries `at=ENEMY_TURN turn=<actorTurns>`, so the replay,
  which auto-answers `Continue`, stops at that turn and not at the next hero turn (§ T5.3); the app writes it
  after every decision and replays it at launch (D6, `FUNCTIONAL.md` § F2.1). **A state
  snapshot** rides along after every decision: **the whole run context** — the party with
  its relics and HP, the map and position, act, lap, pacts, clears this act and in total,
  score, the set pool, the dry streak, the relic sequence, the result accumulators (rooms,
  shrines, rests, swaps, awakenings, turns per battle, enrages, probes, acts cleared), the
  Vault, the act's node trail (`path`), the rng's state (one 32-bit word), and, while a battle is open, the pre-battle
  snapshot plus the hero turns since — the current offers and the terminal fields (`won`, the death kind and killer) re-derived on re-entry, not saved — enumerated field by field in the `SAVE` clauses, so
  a resume without one of them (the set pool would silently change the loot) cannot pass
  review. When `RULES_VERSION` differs from the save's the run resumes from the snapshot
  under the installed rules and the player is told once; an open battle replays its
  recorded turns from the pre-battle snapshot under the new rules and, if a recorded option
  is out of range, restarts from that snapshot; the decision log restarts from that point
  (the `resumed` marker below), because a log spanning two rules versions is not a
  replay. The snapshot lives in its own store slot beside the log, the two written
  together, never inside § T5.3's text encoding, which stays the log alone (so § F2.7's
  share carries no snapshot); the marker is a save-only line after the header, `resumed
  <S>`, which spec-lint rejects in a trace. One of the two cases that abandon a run (the other, a save two or more versions old, is below): a save naming content the installed rules no
  longer have (a removed character or skill) — the Vault is untouched and the player told.
  **`resumeRun(snapshot)`** — entering `runSteps` at an arbitrary map position with a
  reconstructed context — is a rules-structure change the oracle does not contain; it is a
  post-gate `:core` change with its own `SAVE-NN` clauses (which state is authoritative,
  what an open battle does) and is why `FUNCTIONAL.md` sizes F2.1 at M–L.
- **`RULES_VERSION`** is an explicit constant in `:core`'s `version` package, bumped by the
  clause-change protocol (§ T7.7) whenever a rule-bearing clause changes — never by a golden
  re-recording or a trace-format change. A corpus of saves under `spec/fixtures/saves/v<N>/`
  (mid-map, mid-battle, at every pending kind) is recorded in the PR that bumps it and the
  previous version's corpus is kept under `v<N-1>/` (older ones are deleted); the tests
  assert that a save at version N replays under N to the same state, and that a save at
  N − 1 resumes from its snapshot cleanly — which the snapshot's own schema version makes
  decidable: the save header carries it as `snap=` beside the save format's version and `RULES_VERSION`,
  every shape change bumps it under a forward rule (a field added since carries the default
  its `SAVE` clause names, a field dropped is ignored, an unknown field is ignored), the
  decoder keeps the previous reader of each of the three versions, and the N − 1 corpus is
  the proof that the reader works. A snapshot two or more behind in any of the three is
  "two or more versions old" and is abandoned with
  the Vault untouched and the player told, as removed content is — the `SAVE` clauses state
  it, and § F2.1's promise reads "from the previous version".
- **The Vault** is `VaultSave` v1 of the app: relics, `vaultSlots`, the unlocked ascension,
  settings, with a schema version; the prototype's browser Vaults are not imported.
- **Storage** is an `expect` `Store` (a file in the app's private directory; `Preferences`
  on the JVM; `NSUserDefaults`-backed files on iOS, declared in the privacy manifest) with
  an in-memory fake for tests.
- **Replays** are the bug report — from every build: a long-press on PAUSE or GAME OVER shares
  the current run's encoding, the title's the last run's, and GAME OVER shows the seed
  (`FUNCTIONAL.md` § F2.7), so the
  owner's felt rows and the closed testers on release builds can report a bug that replays;
  the debug drawer's richer export is debug-only. The encoding, `sim replay` and the
  storyboard's saves exist under either answer to question 10; a "no" builds no
  persistence and no corpus; the current run's text share stays (§ F2.7). `sim replay <file>` reproduces a save
  headlessly and prints the trace; `instruments storyboard --replay <file>` renders it,
  since `:sim` may not import Compose.
- **PvP readiness**: the same encoding carries a party, a relic and a decision stream; a
  server can verify a claimed result by replay, subject to the seed-secrecy constraint of
  `FUNCTIONAL.md` § F5.2.

## T12 Platform shells and release engineering

- **Android**: one activity, `setContent`, `sensorLandscape`, immersive sticky, the
  lifecycle pausing the loop and yielding audio focus; the back gesture and button routed to
  B; no network permission until PvP.
- **iOS**: `iosApp/` with a Swift `App` hosting `ComposeUIViewController`; landscape in
  `Info.plist`; a privacy manifest declaring no tracking and no data collection **and the
  required-reason entry for user defaults** (`NSPrivacyAccessedAPICategoryUserDefaults`,
  reason `CA92.1`), without which App Store Connect rejects the upload, and the
  export-compliance key `ITSAppUsesNonExemptEncryption = false` in `Info.plist`, without
  which every TestFlight and App Store upload stops on an owner prompt.
- **Desktop**: a `Window` at 16:9 with keyboard; the platform for Hot Reload and the
  instruments.
- **Accounts and testers (P0)**: the Apple Developer Program and the Google Play developer
  account are opened at P0 — unless a Play account already exists, which the owner
  confirms with its creation date before anything else at P0: one created before November 2023 is exempt from the
  closed-test rule below, and Play's twelve-for-fourteen-days obligation falls away with
  its reset risk — most of the recruitment's five to ten owner hours and three of the
  stores' five weeks with it, the tester-triage S shrinking with the pool; the three iPhone
  testers and the channel stay, external TestFlight being theirs and not Play's rule, and
  an Android pool is then the owner's choice — recorded in the register. A personal Play account created after November 2023 must run a
  closed test with at least twelve testers opted in for fourteen continuous days per app
  before production access, and the count must not dip below twelve or the clock resets, so
  the owner recruits **twenty to twenty-five** people with a platform mix — at least
  fourteen on Android 10 or newer — Android 12 or newer if D11's fallback is taken — for Play (two over the rule's twelve), at least three on iPhone with iOS 16 or newer, versions recorded at recruitment, for
  external TestFlight, a tester with one
  phone serving one store — lined up from P2's exit and brought into the channel when P3's gate goes green,
  one to four weeks before P5's first build by pace, the store invitations following the
  last stop.
- **Store set-up (P5, before the first device build ships to testers)**: the App Store name,
  cleared at P0's terms check (both stores and the trademark registers of the EU, the US and the owner's own country, about two hours; a professional clearance is out of scope) and reserved at P0 by creating the App Store Connect record with its bundle id (names are
  unique there; a fallback name is recorded in the register; a record with no build keeps
  its name today — Apple's old 180-day limit is gone — which P0's terms check confirms against the slowest calendar
  (38 weeks at one session a week, about 50 with the contingent items, longer below it), and if any limit shorter than that
  exists only the bundle id is chosen at P0 and the name waits for P5), the application id chosen
  at P0 with it, permanent from the first upload, and Play's listing draft, where names
  need not be unique; the store availability — the release territories decided at P0,
  worldwide with the EU unless narrowed; the store listing
  with its copy and graphics — screenshots from the instruments' phone-sized `shot`, a
  1024 × 500 feature graphic (an S) — which Play needs complete before a closed-track
  release, App Store
  Connect's App Privacy questionnaire (Apple's counterpart to the data-safety form), the EU
  trader-status declaration on both stores (non-trader for a free game; the declaration
  itself is mandatory — Apple removes undeclared apps from the EU storefronts) and the
  Support URL (`docs/support/index.html`, published beside the privacy page by `pages.yml`
  at `/ember-quest/support/`, naming the reports address); a public privacy-policy URL — `docs/privacy/index.html` at the root, outside the freeze,
  hand-written HTML (a Pages artifact is served verbatim, with no renderer), laid into the
  one Pages artifact by `pages.yml`'s `docs` job (§ T4.1) and served at
  `https://patakil.github.io/ember-quest/privacy/` beside the demo (the workflow's path
  filter covers `docs/**`; an owned-path change at P5) and kept
  for as long as either store lists the app whatever README question 3(a) decides; Play's
  data-safety form, content rating and target
  audience, the App Store record; the signed build pipeline — which lands, with the first `v*` tag, before the last scheduled stop, since the stop's build is a signed one the owner installs, while the listings, the forms and the invitations follow the stop — fastlane with `match` for
  Apple certificates (a private certificates repository the owner holds and backs up off
  GitHub), Play App Signing (Google holds the app signing key, so a lost upload key is
  reset through support), an App Store
  Connect API key, a Play upload key and a Play Developer API service account for the
  uploads, all only in the `release` environment, each with a lifetime the owner renews in
  the steady state's quarterly session (the runner's fine-grained token within a year, the
  Apple certificates and profiles annually, the API keys as they expire, and the two
  GitHub Apps' private keys, which never expire, rotated there — a new key generated and
  the old revoked in each App's settings, uninstalling the App the revocation path) (`VERIFICATION.md` § V5); a tag `v*` (owner
  only, the tag ruleset) builds, signs and uploads to Play's **internal** track and to
  TestFlight's **internal** group — the owner's own install path, and all the first tag does,
  since it lands before the store set-up — and, from the first build after the store
  set-up, promotes to Play's **closed-testing track** (the internal track does not run the
  fourteen-day clock; the pipeline promotes each build from internal to closed once the
  listing Play needs is complete) and to TestFlight's **external** group for the
  iPhone-holding testers (at least three of the twenty to twenty-five), since a tester with
  one phone serves one store and iOS would otherwise be tested by nobody but the owner (external TestFlight is free, adds one Beta
  App Review of about a day on the first build, and is an S inside P5); version name from the tag,
  version code from the commit count on a `fetch-depth: 0` checkout. The closed test starts on the build the README's absence protocol names — its one
  statement of that trigger; the fourteen days start when twelve testers have opted in,
  about a week after that build, and Play's first review of that release takes days.
- **The stores (P7)**: the owner submits the iOS build for **App Review** (typical
  turnaround one to three days; a rejection is § T15's risk, answered from the checklist),
  and after the fourteen days applies for Play **production access** and passes Google's
  review, which checks that the testers used the app; the P7 checklist carries both, with
  the credits and disclosure copy.
- **Crash and usage signal**: no SDK; the stores' own — Play Console's Android vitals
  (crashes and ANRs from users who opted into diagnostics, on every track) and its
  pre-launch report, which runs each test-track upload on Test Lab devices for free, and
  TestFlight's crash logs on iOS — are read by the owner and the agents during the closed
  test (`VERIFICATION.md` § V6's device-only crash row) — both can report nothing, since
  each depends on a tester's opt-in; then the testers' channel and § F2.7's share are the
  route, and an empty signal is recorded as such on the P7 row, never read as a clean build and, after P7, by the owner monthly
  and by the quarterly session (README, the steady state); a KMP crash reporter with its
  opt-in toggle is a later decision, not scheduled.
- **The testers' channel**: the listing and the credits screen name one address or form
  for reports, and stays open after P7 as the listing's contact; a report is triaged within
  the week until P7 (an S inside P5's and P7's sizes) and monthly after it — the owner scans
  the channel, the quarterly session answers (README, the steady state) — and
  carries § F2.7's share, whatever question 10 answers.
- **Release notes** are generated from the clause ids in the merged PRs since the last tag.

## T13 Agent workflow and conventions

### T13.1 `CLAUDE.md`

The repo map for the tree; the prototype's status and the freeze; the lane commands and
their budgets with the machine class each is measured on; the module edges; the budget
table of § T8.3 with the port exemption and its end date; the spec workflow (§ T7.7); the
writer/verifier/critic roles and their model tiers (mechanical work on a Sonnet-class
model, design, review and critics on an Opus-class model, the art critic on the one model
and version pinned for the programme in `spec/art/`, `FUNCTIONAL.md` § F3.5); the
isolation rules (§ T13.4); the identities (§ T1); the commit
gate; "never claim to have playtested".

### T13.2 Skills — the prototype's ten and their successors

The prototype's skills are generic Retrovibe arcade skills that name files that no longer
exist, targets the contract superseded, and a 240×160 frame. They are archived under
`prototype/.claude-archive/` — out of Claude Code's skill discovery — as sources of
*intent*, not templates; every successor is written fresh at P1 in the root
`.claude/skills/`.

| Prototype | Successor | Note |
|---|---|---|
| `iterating-on-a-game` | `kmp-iterating` | the default edit path and the lanes |
| `playing-the-game` | `kmp-verifying` | run L1/L2, read the matrix and the review bundle, report "builds, boots clean, gates green, frames attached" |
| `designing-mechanics` | `kmp-spec-change` | clause first, the owner's decision before code moves |
| `balancing-with-the-simulator` | `kmp-balancing` | the harness and the snapshot, against the contract's real ladder |
| `ensuring-arcade-visuals` | `kmp-art-loop` (assets) and `kmp-screens` (fixtures, semantics tests, goldens) | the look rules become `spec/art/` and `spec/screens/` |
| `improving-game-quality` | **`kmp-quality`** — the feel rubric written at P1 from `STATUS.md`'s "Playing it on a phone" section, the full-frame critic's first-ten-minutes items and the contract's presentation rules: readability at arm's length, a target tapped once, feedback on every action, prompts that never blink fully off, hit-stop actually rendered, a frame rate that holds through a hit, resume correctness, audio per event kind, a screen that never swallows the run; its mechanisable items are clauses bound to `runComposeUiTest` tests; the felt rows and the first-ten-minutes test are scored against it | |
| `handling-user-input` | folded into `kmp-screens` and `spec/platform/` | the button model and `Focusables` |
| `messaging-game-over` | retired | there is no host |
| `adding-easter-egg` | retired until asked | |
| `releasing-the-game` | `kmp-releasing` (tags and stores; owner only) | |
| — | `kmp-device` | emulator, simulator and phone smoke; Maestro |

### T13.3 Hooks

- `SessionStart`: run `ci/env/setup.sh` where the host is not the image (idempotent,
  cached where the host allows), install the git hooks (pre-commit, pre-push), start the
  Gradle daemon and pre-warm the fast lane (`./gradlew :core:jvmTest --offline -q` on a
  no-op), mint the App's installation token and confirm it.
- `PostToolUse` matching the `Edit` and `Write` tools (a hook matcher selects tool names,
  not paths), whose script reads the edited path from the tool input and acts only on
  `**/*.kt`, `spec/**`, `tools/art/**`, `ci/**`, `.github/**`, `config/**`,
  `gradle/libs.versions.toml` and `**/*.md` (the lints of § T8 run on the last five): the
  L0 lane
  for the touched module, **synchronous** with an 8-second budget; a throttle file makes a
  second edit within two seconds of the last run a no-op; only failures are printed.
- `pre-commit` (git hook): L1 for the touched modules and spec-lint.
- `pre-push` (git hook): the commit lane, L2a + L2b (`gate.sh commit`) — the push is refused
  by the hook, not by the agent's judgement; L3 re-runs it, so a skipped hook only delays
  the same verdict.

### T13.4 Isolation

Every writer, verifier and critic works in its own git worktree with its own Gradle project
cache directory (`--project-cache-dir`) and its own driver port; the verifier's worktree is
at the spec commit (§ T6.3); ports are announced in the task; nobody kills another's
daemon. Long instruments (storyboards, sheets) run against a worktree at HEAD, never
against a tree another agent is editing — the lesson the prototype's STATUS.md records.

### T13.5 The gate script and the lane definitions

`ci/lanes.yaml` is the single definition of the lanes: per lane an id (`edit`, `module`,
`commit-a`, `commit-b` — which `gate.sh commit` runs in order, each with its own ledger row
—, `merge`, `nightly`; `gate.sh` also has two verbs that are not lanes, `commit` and
`env-check`), the Gradle tasks and script steps in order, the tags they select,
the budget in seconds and the machine class the budget is for, and the environment image's
digest. `gate.sh <lane>` runs a lane exactly as CI does,
prints the lane's time against its budget, writes `{lane, sha, machine, started_at (RFC
3339, UTC), seconds, result, failed step}` as `lanes.json` inside the review bundle
(`VERIFICATION.md` § V3.10). **The ledger** is the union of three sources, since nothing
in the tree can be one (`ci/**` is owner-reviewed and pull-request workflows cannot
push): CI uploads every bundle as a workflow artifact (`hosted-linux`,
`hosted-macos-arm64`); the agent's own `agent-env` rows — which never reach a workflow —
are written by the pull-request-opening step into a fenced `lanes` block in the pull
request body and re-written, with the new rows appended, on every push, which the nightly
reads through the API beside the artifacts; and the
private device-runner repository appends its rows as comments to the standing `ledger` issue in this repository, created at M7, which its token's `issues: write` allows and the nightly reads (or the farm's rows
arrive through the nightly's own artifact, under question 5's other branch). L3 also re-runs L0–L2 timed on `hosted-linux` as a second reading of the
fast lanes. The CI workflows are **generated from `lanes.yaml`** (a `build-logic` task writes
`.github/workflows/kmp-*.yml`; the generated-workflows job, an ordinary `pull_request` job with no secrets, fails when
the committed `kmp-*.yml` differ from what the head's generator writes; the hand-written
workflows are outside the diff, `VERIFICATION.md` § V5; the generator also writes
`ci/required-checks.txt` — the generated job names plus the literal list of the
hand-written jobs that `ci/lanes.yaml` carries under `required-hand-written:`, which the generator concatenates (`prototype.yml`'s three — `prototype-freeze`, `prototype-check` and `prototype-changes` — and `env-image`'s two, `env-image-changes` and `env-image`, prefixed like the generated ones) and the three gate-App checks —
and an L3 job reads the branch's active rules through the API and fails when a listed
job is not required; adding one is the owner's act, named in every phase that adds a job
(P1's M7 — the Android and iOS compile jobs, one owner ruleset act inside P1's eight sittings; the wasm job is informative until P8 — 5b's arm64 leg, P5's device jobs, P8's wasm) — the pull request that adds the job fails
the list check until the owner has added the rule, and the check is then re-run, not
re-pushed (a re-run re-reads the branch's rules; a push would dismiss the approval), so
the adding happens while that pull request is open — taken when no other owner-gated pull
request is open; removing one runs the other way, the owner dropping the rule first and the
job leaving the workflow after — because a new required check reads "expected" on an older head until a
push and a push dismisses the owner's approval — otherwise it costs a re-review per open
owner-gated pull request, which the phase's sittings absorb), so "a tool silently disabled" is a diff, not
a new analyser. An agent
commits when L1 is green (the pre-commit hook), pushes when the commit lane is green (the
pre-push hook), unsigned, with the clause ids in the message; a session's writers
integrate into one pull request per track.

### T13.6 The debug drawer

Debug builds only: seed display, the decision log and snapshot export, a frame-time
overlay, a tier override, the crispness mode, screen fixtures, the forcing hooks the
storyboard uses. Stripped from release builds, which keep only the long-press save export
and the seed on GAME OVER (§ T11).

## T14 Phase sequence

Sizes and the aggregate are in the README (S ≤ 1, M 1–2, L 2–4, XL 4–8 sessions). Spike
code and reports live under `plan/spikes/<n>/` with a `REPORT.md` each, as standalone
builds never included in the root `settings.gradle.kts` (`plan/spikes/5b/` for spike 5b). The agents' App (README question 7(a), or its fallback) is created before anything, since no agent pushes without it; the move commit of § T4.1 lands
next, since `setup.sh` reads the `ci/env/versions.env` it creates; spike 6 (the environment) runs
next, since spikes 1, 4 and 5 run on the environment it proves — and the owner's go or
no-go on the game comes here — after question 3(c)'s fix if it was taken — before those spikes, the art tool, the captures, the
accounts and the bake-off (README, the P0 owner row); spikes 3 and 4 run over
spike 2's tree; spike 5's hash test is defined — `mulberry32` on seeds {1, 2, 7, 4242,
0xFFFFFFFF} × 10 000 raw bits and the `jsRound` table, against Node-generated expectations.

| Phase | Entry | Deliverables | Exit gate |
|---|---|---|---|
| **P0 Decide, spike, freeze, bake-off** (XL) | this plan approved | the owner's answers to questions 1, 2, 3(b), 3(c), 6, 7, 8 and 10, and the character brief of `FUNCTIONAL.md` § F4 or the acceptance of § F4.3's price for a later change; the Apple and Google accounts opened and twenty to twenty-five testers' recruitment started; the GitHub App created and installed; **the owner plays the prototype on a phone as the owner's first act after the move commit and question 3(c)'s fix, before the accounts, the testers and the bake-off's spend, records `plan/BASELINE.md` and says go or no-go on the game**, recorded in the register; the move to `prototype/`, the banners, the Pages workflow, the stub `CLAUDE.md`; the captures of § T4.2 (the fallback sheets, the flat backdrops with light data, the study, the sounds, the glyph tables); the `PixelActor` registry; **the art tool** with the full metric set, calibrated, the bands recorded; provider terms verified into `LICENSES.md`; spikes: (1) headless JVM capture of a Compose stage to PNG at k = 1 and its time, on `agent-env`; (2) `RunSession` on intrinsics with a toy generator, `HERO_TURN` at step 7, `ENEMY_TURN`, and the three paths of the self-check with draw burning; (3) Pitest on a KMP JVM target; (4) detekt 1.x and 2.0 on Kotlin 2.4 syntax with type resolution timed on a KMP tree; (5) Kotest 6 running one hash test on the iOS simulator (a throwaway hosted-macOS workflow or the owner's Mac), as an Android device test on an x86-64 emulator with KVM, and on wasmJs; (5b) the same hash test on a free `ubuntu-24.04-arm` runner — the JVM, and an arm64 Android system image if it boots — which decides whether the arm64 arithmetic truth lives in L3; spike 1 also renders the stage's `ColorDodge` and `Multiply` on the Android emulator at API 28 and 29 — the fact D3 rests on — on a throwaway hosted-Linux workflow with KVM (§ T1); (6) the environment: `setup.sh` on `agent-env` with its cold start, the image built once from `env.Dockerfile` to its registry by a throwaway workflow with `packages: write` (its digest is pinned at P1, `VERIFICATION.md` § V9), and an agent session minting an App token and opening a pull request; (7) the sprite bake-off on six actors, options (a) and (b), both looks, under § T10.7's protocol, through the calibrated gate, shown in lit phone frames from the prototype's stage; (8) the pinned critic scoring the prototype's round-14 cast in lit frames three times under the protocol, the sheet committed under `spec/art/calibration-sheet/`, the medians recorded **per axis** as the **baseline** every later bar is set against; the ramps export and the stage fixture page of § T4.2 | spike reports with frames, numbers and a recommendation each; the owner's go or no-go on the game recorded; the calibration's disagreements adjudicated; the look fork closed; the critic's per-axis baselines committed to `spec/art/` beside the protocol and the calibration sheet; the decisions recorded in the register; the sizes re-estimated |
| **P1 The rig** (L) | P0 | the environment image (built at spike 6) rebuilt by its own workflow with its digest pinned in `lanes.yaml`, and `setup.sh` proven equivalent by `env-check` on `agent-env`, macOS (the owner's Mac or a hosted-macOS job) and L3's bare runner; the calibration golden's second reader (§ T10.4); the gate App and its `gates` environment, and Renovate installed; the owner-review workflow and its re-dispatch; the provisional ruleset and `CODEOWNERS`, the two throwaway pull requests that prove the review mechanics, the required checks, the tag ruleset, the `release` environment, the prototype workflow (the freeze check and `prototype-check`, required) and, if question 5 chose the runner, the private device-runner repository; every module present and empty with the convention plugins, every analyser at full strength, the spec binder and its tests, `lanes.yaml`, `gate.sh` and the generated workflows, the hooks, `CLAUDE.md`, the `kmp-quality` rubric and the other skills; the hello-world stage (one fallback sprite over one flat backdrop, one button, one screen test, one golden recorded in the image and compared on the owner's Mac, one storyboard step in both modes); **a synthetic `:core`-sized module** generated from the prototype rules' function-size histogram (5 000 lines, 300 tests with property tests) and **a synthetic storyboard** that the lane budgets are measured on | every lane green (for L3 and L4 the P1 subset `VERIFICATION.md` § V9 names) and inside its P1-measurable budget on the synthetic module, timings recorded in the bundles' `lanes.json` with machine classes; the sizes and the calendar re-derived and **accepted by the owner, or the programme stops here** (the cast's generation paused while the decision is pending, the art spend committed so far stated) |
| **P2 The spec and the oracle** (L) | P1 | `--trace`, `--cell <id>`, `--ascension`, `--path`, the canonical `--dump`, the strong-party and stall fixtures, `coverage.mjs`, `cells.mjs`, the fixtures export and the battles-mode knobs and `strong=1` in the prototype's harness and driver; the Node pin confirmed and `engines` added; tag `ts-oracle-v3`; the prototype-freeze check; the golden set recorded on the pinned Node under `cells.md` and hashed, with the coverage report; the contract reconciled with the code, then folded into `spec/` clauses (status `proposed`), the `known-divergence` notes of `FUNCTIONAL.md` § F1.4 among them; the clause count per area | spec-lint clean; every clause has an id, an owner, `paths` and a status; goldens frozen; every event, status, set, sigil, pending kind, room type and ascension row appears in the golden set (but the kinds § T5.3 exempts); P3 and P5 re-sized against the clause count and **accepted by the owner, or the programme stops here** (generation paused while the decision is pending, the committed art spend stated) |
| **P3 The rules** (L) | P2 | `:core` test-first in § T5.1's order; `:sim` with every command; `:core-testing`; the save format and the `SAVE` clauses designed around question 10's answer; the cross-platform hash test; the ABI dumps; the port exemption zeroed at the end | `diff-oracle` clean on the golden set; the balance tables reproduced; the hash test green on the JVM, the x86-64 Android emulator and the iOS simulator, and once on an arm64 phone or farm device; matrix 100 % (no weak clauses) for the rules areas — the clauses whose `owner` is `:core`; coverage and mutation at threshold or the fallback recorded |
| **P4 The cast** (L, parallel with P2–P3) | P0's bake-off | the pipeline at full strength; the cast generated in `FUNCTIONAL.md` § F3.5's order with the stop decision after the six heroes, judged on the prototype's stage frames; portraits; every accepted actor committed with its manifest under the owner's review | every actor passes the gate; the six heroes meet the value targets the rejected kit fails (re-derived on look B's reference if question 1 chooses painted); the full-frame critic's sprite axis at least one above P0's recorded baseline under the same pinned protocol, capped at 9 (expected 9 against 8; the old 8 was a single unprotocolled verdict and proves nothing; a baseline already at 9 leaves the cap nothing to give, so that axis's bar is an owner decision recorded in the register before P4 starts); the owner accepts on a phone |
| **P5 The stage and the screens** (XL) | P3 (+ P4's heroes for the felt rows) | `Frame`, `Layout`, `Focusables`, `Stage` and `StageScene`, the light rig from the light data over the flat backdrops, atlases, VFX, pops, audio; the three tiers and ARCADE; the bloom decision (§ T9.4; before the first test-track build, since its fallback would reset a running closed test); every screen as Compose UI over the seam, designed for the phone; `FUNCTIONAL.md` § F2.2–F2.7 (the bug-report export with the first signed build the owner installs) and, under question 10's yes, F2.1's resume path; fixtures for every screen state; semantics tests; goldens; the storyboard driver with the strong-party fixture and the forcing hooks (set act and lap, jump to a room type, force a pack, set a hero's hp — `spec/platform/` clauses; `RunDebug` in `:core` a post-gate change under § T7.7, § T2.3); the phase's new required checks added by the owner when the L3 list check names them; the Android and iOS shells; the `:app:benchmark` Macrobenchmark module (`com.android.test`, § T2.1) the device lane's benchmark APK comes from; device boot smoke; the store set-up and the signed build pipeline (§ T12) with the privacy page, the testers' channel and the stores' own crash signal; the owner's last scheduled stop, on the first playable build — a signed build on the internal tracks, so the pipeline and the first tag precede it; the closed track and the external group start after the store set-up — and before the listings, the forms, the invitations and the closed test (README, the P5 owner row); the closed test started on Play's closed-testing track and on external TestFlight with testers from the same pool, on the build the README's absence protocol names, and its reports triaged (an S inside the XL); a first build over the fallback actors where the cast is not yet accepted is a mixed cast the owner approves by name; L2b's content-scaled parts measured; the memory and size table re-derived; the cast re-judged on the real stage | storyboard `PLAYFULL OK` — every biome, boss and screen reached — and a two-act KO run on the JVM in skip-playback mode, the full-playback storyboard in L3, two acts on Android and iOS; every fixture has a golden; `screens` and `platform` clauses bound; the desktop and reference-phone budgets met; the in-scene rulers at their P0-recorded bars for LOW and for the reference phone's default tier (MED) over each biome's resting frame (under question 2's portrait branch, reported and owner-approved as the portrait bars that P6 then holds, `FUNCTIONAL.md` § F3.1) — the fixed set of 36 seats and 72 strip readings, the fallback cast as the reference (`art rulers` in L2b over `frames --cast fallback --seats all`, and over `--seat <spread id>` per biome for the reported spread; and once over the accepted cast at P5's end, reported — the party's and the enemy rank's medians, the regression scene round 6 fixed, which the fallback-cast gate cannot see; a reading below 1.5:1 takes the cast-miss branch); the full-frame critic's UI and VFX axes at least one above P0's per-axis baseline, capped at 9 (a baseline already at 9 is an owner decision), with all five axes recorded at P5's end, and the sprite axis not below its P4 reading — a miss is the rig's to fix inside P5 (the gain, the pools and the cast lobe are P5 code), never the sprites', with the cast-miss bound: after one rig rework still below, the owner accepts it as a recorded miss carried into P6 — the bar re-recorded in the same owner-reviewed pull request, `FUNCTIONAL.md` § F3.1 — or holds P7 for P6 (question 4(a)); the felt rows signed by the owner on a device (one Android at or below the reference class among them, § T1), or accepted as recorded misses under `FUNCTIONAL.md` § F1.5's bound |
| **P6 The scene** (L) | P5 (+ P4) | the six biomes' planes as data-driven painters — the default — or, if README question 4 approved them by name with their budget line, AI-generated planes judged by the scene rulers, the critic and the owner (`FUNCTIONAL.md` § F3.7); the light wells, hues, bright-mass and plate-rule items of `STATUS.md`'s round-5 brief; the flat placeholders retired | the in-scene rulers at their P0-recorded HIGH-tier bars over each biome's resting frame with the fallback cast as the reference, LOW and MED not below their P0-recorded bars; the full-frame critic's scene and composition axes at least one above P0's per-axis baseline under the protocol, capped at 9 (the rejected look scored 8 · 8 · 8 · 8 · 7 — an absolute 8 already met on the scene axis, not on composition, which stands at 7; a baseline already at 9 makes that axis's bar an owner decision recorded before the phase), and the sprite, UI and VFX axes not below their P4 and P5 readings; the owner accepts on a phone — a ruler below its bar or a no on the phone is one rework of the planes, then the owner's decision, a recorded miss or the phase held (§ F3.1) |
| **P7 Ship** (M) | P5 (+ P6 per README question 4) | credits and disclosure; the closed test's feedback triaged and answered — a report that breaks a run (a crash, a stuck screen, an unexpected lost run — under question 10's no, a run lost to the platform killing the app is the designed loss, a recorded known miss, not a blocker) is a blocker that holds the `v*` tag and is fixed inside the M whatever it touches, a rules fix under § T7.7 with its clause — the first inside the M, the second and the third an S each, beyond which P7 re-sizes or the owner decides; other presentation fixes inside the M; a triage list of the remaining rule-touching reports the owner decides as § F2 or § T7.7 changes after P7 (an S–M in the first steady-state session); the App Store submission and App Review; the Play production-access application after the closed test's fourteen days — the stores' clock, about five weeks from the closed test's build, is the calendar's third term (README) | installed from both test tracks; the first-ten-minutes test passes on the owner's phones; App Review passed; production access granted — or, under the tester-shortfall fallback, Android held in closed testing as a recorded state while iOS ships |
| **P8 Web (stretch)** (M) | P7 | the wasmJs target through the same gates; Pages switches from the prototype when it passes | the P5 gates on the Wasm build |
| **Steady state** (after P7; ≈ one session a quarter) | P7 | Google Play's annual target-API bump and Apple's SDK minimum for submissions, the stores' policy re-attestations, Renovate's monthly batch through the full lanes, a store-side fix when one is needed; the first session answers the closed test's rule-touching reports the owner chose; every quarterly session reads the testers' channel, Play's vitals, TestFlight's crashes and the store reviews, which the owner scans monthly, and a run-breaking production report is a blocker that buys an out-of-cycle session; once a year the owner decides to continue, hand over or delist, against the install counts, the channel and the reviews (README, the steady state) | the lanes, unchanged; a `v*` tag per release |

Parallel tracks: P4 (the cast) runs beside P2 → P3 from P0's exit, since it needs only the
tool, the providers and the owner; P5 needs P3 and, for its felt rows, P4's heroes; P6
needs P5. The critical path is P0 → P1 → P2 → P3 → P5 → P7.

## T15 Technical risk register

| Risk | Mitigation | Tripwire |
|---|---|---|
| The GitHub App path fails (token minting from the agents' environment, a permission the App lacks) | P0 spike (6); the classic-token machine user as the named fallback with the same review rules | the spike report |
| A store account suspended, or the signing material lost | Play App Signing (the upload key is reset through support); the `match` repository backed up off GitHub; the API keys re-issued; an appeal, then the other store's listing alone (README risks) | a suspension notice; a failed signed upload |
| The agents' environment cannot reproduce the image (cold start too slow, a tool missing) | `setup.sh` measured at P0; a self-hosted agent pool costed beside D18; goldens are L3's job either way | cold start over 6 min; a lane over budget on `agent-env` |
| Kotest's non-JVM engines lack features the suites use | configuration by code only; the JVM lane is the fast truth; spike (5) runs one hash test on every target before the suites exist | a spec that cannot run on a target is a P1 finding, not a per-test exclusion |
| The Compose test APIs are experimental and change | one thin capture-and-drive abstraction in `:tools:instruments` and `:ui` tests; an upgrade touches it once | a CMP upgrade breaking more than that module |
| detekt cannot parse Kotlin 2.4 syntax, or its type resolution is too slow | the two fallbacks of § T3, distinct | type-resolved detekt over 90 s on the tree (L2a's whole budget is 5 min); a parse failure |
| Gradle configuration cache incompatibilities in a plugin | the cache is required from P1, so an incompatible plugin is rejected at adoption | any `--no-configuration-cache` in a script |
| macOS runners are slow or costly | iOS only in the merge and nightly lanes; the simulator boots once per job; Apple-silicon runners | the iOS job over 20 min |
| No hosted arm64 Android runtime | x86-64 ART in the merge lane; arm64 on the phone or the farm nightly; P3 needs one arm64 pass | a hash mismatch on arm64 |
| Kotlin/Native compile time | never in the fast lanes; caching of the K/N distribution and klibs in CI | — |
| Memory pressure on a 2022 phone | atlases at cell resolution, two biomes resident, a peak-RSS budget measured nightly | peak RSS over 250 MB |
| A blend-mode or blur API missing on a platform | minSdk 29; no platform blur in the frame path; the CPU bloom | an API-level fallback appearing in `:engine` |
| The storyboard outgrows the commit lane | skip-playback mode; measured at P1 on a synthetic storyboard and at P5 on the real one; the recorded move to L3 | L2b over 5 min at P5 |
| Hot Reload's MCP is new | an instrument, not a gate; the headless instruments are the gate | — |
| A store rejection (metadata, privacy, AI-art disclosure, the closed-test rule), or a closed test that resets | the store set-up at P5 with the owner's checklist; the privacy manifest entries; the tester count with a margin; the testers' channel and the stores' crash reports read weekly | opted-in testers below fourteen; any rejection notice |
| The presentation is designed without a reference and misses the prototype's feel | `plan/BASELINE.md` as the written bar; the rubric; the felt rows at P5; the stage laws carried as data | a felt row the owner cannot sign |
| The cast is accepted on the prototype's stage and reads wrong on the new one | the re-judgement at P5's end against P4's sprite-axis reading; the rig adjusts the light inside P5 — one rework, then the owner's decision — and the scene phase the planes, never the sprites | the critic's in-scene verdict at P5 |
| The CPU bloom loses the look | the P5 spike on sixteen frames and the platform-blur fallback (§ T9.4) | the critic prefers the fallback on more than four of them or on any hit peak |
| A provider retires its model | § T10.6's continuity clause | a provider notice |
| The critic's model changes mid-programme and re-scales the instrument | the model and version pinned and recorded on every verdict; a change re-scores the frozen calibration sheet and records the offset (`FUNCTIONAL.md` § F3.5) | a verdict on an unrecorded model |

## T16 Online — reserved for PvP

Empty by design. When the owner's PvP brief arrives (`FUNCTIONAL.md` § F5), this section
takes the server, the accounts, the network module and its Konsist edge, the seed-secrecy
transport, the side-symmetric rules audit, and their lanes.

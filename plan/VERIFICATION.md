# The verification loop — fast and airtight

The brief asks for extra attention here: how do agents get feedback that is fast enough to
keep in the loop and complete enough that nothing slips through? This document is the
answer. It defines the lanes and their time budgets on named machines, the instruments
that let an agent see and measure its own work, how determinism and time control make
every check exact, how the gates are enforced and by whom, and — the airtight part — which
failure class each gate catches and which classes are not automatable. `TECHNICAL.md`
§§ T6–T8 say how tests, specs and analysers are written; this document says when they run
and what they prove.

## V1 Two properties, honestly stated

**Fast** means each lane has a time budget for a named machine class, the budget is
measured on every run and checked nightly, and a check that outgrows its lane moves to a
slower lane rather than being trimmed. The fast lanes are what an agent runs dozens of
times an hour; if they take minutes they are skipped, and a skipped gate is no gate. The
budgets were sized against measurements (a warm Gradle round trip is 1–2 s; today's rules
are 5 000 lines) and are proven at P1 on a synthetic module of that size, not on a
hello-world.

**Airtight** means every failure class the project can name has a gate that catches it
(§ V6), and the gates are enforced by machines wherever a machine can: git hooks that
refuse a commit or a push, a protected branch with required checks and a merge queue, code
ownership that keeps the gates' own configuration out of the agents' hands, an approval
identity that cannot be the author's. Two things stay with discipline and are audited by
the next machine gate: the edit hook (L0) reports and cannot block, and the review bundle is
read by people and critics. Where a class cannot be made airtight — a device-only crash, the
owner's taste — this document says so and names the slower gate that covers it.

## V2 The lanes

| Lane | Budget (machine) | Trigger | Contents | Proves |
|---|---|---|---|---|
| **L0 edit** | ≤ 5 s (the agent's container, warm Gradle and Kotlin daemons, a configuration-cache hit; debounced to one run per burst of edits) | the `PostToolUse` hook after every edit of `*.kt` or `spec/**`; `gate.sh edit` | ktlint on the file; the touched module's incremental `compileKotlinJvm`; detekt's syntax-only rules on the changed files; spec-lint on changed clauses | it compiles, it is formatted, it has no new smell |
| **L1 module** | ≤ 60 s (the agent's container) | the pre-commit hook; by the agent after each milestone; `gate.sh module` | the touched modules' `jvmTest` (`Fast` tag: unit, property at 100 cases, table-driven, screen semantics with virtual time); detekt with type resolution on the touched modules; Konsist scoped to them; the JVM ABI dump check; the spec matrix for the clauses whose `paths` intersect the touched modules | the rules and screens do what their clauses say; the architecture holds |
| **L2 commit** | ≤ 5 min (the agent's container or a hosted Linux runner; the golden step inside the canonical container) | the pre-push hook (`gate.sh commit`); every push | the whole JVM test set; the committed golden hash lists; the reduced balance snapshot; screenshot goldens; the storyboard on the JVM (all six acts with the strong party, and a two-act run to a KO); the visual-parity comparison (until P8); the asset gate; the anchor-drift test; the desktop perf test; Kover thresholds; Konsist over the tree; the review bundle | nothing observable changed unless a clause changed |
| **L3 merge** | ≤ 30 min wall-clock across parallel jobs (hosted Linux; one Apple-silicon macOS job ≤ 20 min) | the pull request (required checks; merge queue) | L2 re-run on the runner; every target compiles (Android, the iOS framework, wasmJs); the klib ABI dumps; the cross-platform hash test on an arm64 Android emulator device test and on the iOS simulator (wasm informative); `diff-oracle` on the probe subset (Node); Android Lint; `buildHealth`; the size test; the emulator and simulator boot smoke with the audio-plays assertion; workflow and script lint; the generated-workflows check; the golden-approval check (approver ≠ author); the `oracle-frozen` check; the nightly-rules status (§ V5) | it ships on every platform |
| **L4 nightly** | ≤ 3 h (hosted runners; the self-hosted device runner) | schedule; on demand | the full Monte Carlo at the contract's basis (5 000 runs on seed 1, 2 000 on seed 2 and the four verification seeds, per policy); `diff-oracle` on the whole golden set; property tests at 10 000 cases; Pitest on `:core` and `:engine`'s pure packages; the storyboard on emulator and simulator (two acts); Maestro flows (the first ten minutes, every edge target under gesture navigation, the forced tier drop); device benchmarks on the reference phones (frame time, peak memory, boot); the hash test on the phones; iOS screenshot goldens (informative); the lane-budget check over the ledger | the slow truths: balance, mutation, devices |

A lane's contents may grow; its budget may not, without a README decision. `gate.sh` and
CI append `{lane, sha, machine, seconds, result, failed step}` to `kmp/ci/lanes.json` on
every run; the nightly checks each lane's p90 over the week per machine class.

## V3 The instruments — what agents see and measure

Everything below is a command in `:tools:instruments` (or `:sim`) that writes files an
agent can read (PNG, Markdown, JSON) and returns a non-zero exit on failure. The PNGs are
what an agent with eyes looks at; the tables are what it argues with.

1. **`shot`** — render any screen state from a fixture to a PNG, headlessly, in process:
   `instruments shot --screen map --fixture act3 [--phone] [--tier LOW]`, at `k = 1`,
   1280×720, with virtual time; one thin wrapper over the desktop headless scene so a
   Compose test-API change touches one file. 100–300 ms per frame after warm-up. Replaces
   `tools/screens.html` + `capture.mjs shot`.
2. **`storyboard`** — drive a seeded run through the *real* screens, tapping by test tag or
   by contract geometry, one PNG per distinct screen crossed, `decisions.json` (the seed
   plus every answer, hero turns included, which `:sim replay` reproduces headlessly), and a
   verdict line: `PLAYFULL OK` when the requested acts were cleared (or the run was won, or
   `--ko` produced the death it asked for), `PLAYFULL ENDED act=… room=…` with a non-zero
   exit when the party died, `PLAYFULL STALLED` on a budget overrun. `--strong` seeds the
   run with the harness's kindled Vault relics so the drive reaches all six acts, every
   biome and every boss; `--keyboard` drives the same run by the keyboard route. Seconds on
   the JVM because time is virtual; the same driver runs in instrumentation on Android and
   iOS nightly. Replaces `capture.mjs playfull`.
3. **`sheets`** — line-ups (colour, greyscale, silhouette at ×2 and ×4), every actor's pose
   sheet, contact sheets of candidates, and `metrics.md`/`.json` against the bible; the
   art gate's human face. Replaces `tools/lineup.html` + `capture.mjs sheets`.
4. **`frames`** — battle frames at chosen virtual ticks per biome and tier: the resting
   frame, a hit peak, +360 ms, PAUSE, INSPECT, GAME OVER, the act-clear tableau; and the
   in-scene rulers (the seat ruler, the two ground strips, the seat spread) over them.
   Byte-deterministic because every draw is seeded and time is virtual (today's captures
   differ on 74 % of pixels between two runs; these will not).
5. **`vfx`** — every `SkillId`'s effect at its peak frame with its cost per family; and
   **`backdrops`** — every biome at every tier with no actors. The successors of
   `tools/vfx.html` and `tools/backdrops.html`, both in the L2 golden set.
6. **`compare`** — the visual-parity comparison: the exported TypeScript frames of a biome,
   tier and seat against the Kotlin frames (§ V3.11).
7. **`sim`** (`:sim`) — the harness tables and JSON; `trace`, `trace-hash`, `diff-oracle`
   with the first divergent line, `selfcheck`, `spd`, `vault`, `snapshot`, `fixtures`,
   `replay`.
8. **The spec matrix** — `build/reports/spec/matrix.md`: every clause, its status, its
   tests (writer / verifier), their results; the first page of every verification report.
9. **`perf`** — frame-time histograms (p50/p95/p99), allocation rate, and the per-pass cost
   table of the stage on the JVM; the device benchmark results nightly.
10. **The review bundle** — `build/review/<sha>/`: the matrix, the test summary, the lane
    timings, the sim diff, the sheets and metrics, the storyboard, the perf table, the
    changed goldens side by side with their previous versions and their approval records.
    `gate.sh` writes it; a verifier, a critic and the owner read it; a pull request links
    it. Replaces the ad hoc `tools/out/` reading of today.
11. **The visual-parity band** (P4's gate, then L2 until P8): for each biome at each tier,
    measured by the same instruments over the exported TypeScript frame and the Kotlin
    frame of the same seat and tick — the ground's p50 within ± 3 L*, the actor-median-vs-
    ground ratio at both strips within ± 0.1, the frame's share below L 35 and above L 75
    within ± 3 points, the centre-third lead within ± 3 L*; the fog, motes and shafts
    checked by the same numbers over a frame averaged across one drift period. A band, not
    bytes: the two rasterisers differ, the light rig's arithmetic must not.
12. **Hot Reload with its MCP server** — for a live loop on desktop: an agent edits, the
    app reloads, the agent asks the running app for a screenshot or the UI tree. An
    instrument for exploration, never a gate (the gate is the headless, deterministic path).
13. **Device shots** — `adb`/`simctl` screenshots and Maestro flow recordings from the
    nightly lane, for the platform-only classes (§ V6).

## V4 Determinism and time control

- **Randomness**: seeded everywhere; `:core` takes an rng; `:ui` takes one for presentation
  randomness (particle jitter, idle offsets, sound variants) separate from the rules';
  nothing calls the platform's random in a test.
- **Time**: the loop takes a clock; under test it is a virtual clock stepped by the test
  (`mainClock.autoAdvance = false; advanceTimeBy(16)` in Compose tests; the instruments'
  driver steps frames explicitly). No `delay`, no `sleep`, no wall-clock reads outside the
  shells (a detekt rule).
- **Rendering**: goldens are recorded and compared **inside one canonical container image**
  (Linux, pinned Skiko, the bundled fonts) at `k = 1`, where they are byte-exact; a golden
  diff prints the changed pixel count and a side-by-side. Skia rasterises text through the
  host's font backend and its SIMD tier is fixed per architecture, so a golden run on a
  macOS or Windows desktop reports a diff with a tolerance and **never fails the lane**;
  `gate.sh commit` runs the golden step in the container. Android and iOS goldens
  (Roborazzi) are per platform with a small tolerance and are informative until the tooling
  is stable. The P1 hello-world golden is recorded in the container and compared on a
  second OS to prove the rule.
- **Ordering**: Kotest runs specs in random order in CI to expose order dependence.
- **Flakes**: a *test* that fails and then passes without a code change is a bug filed
  against the test the same day; CI has no retry setting for tests; a flaky test is fixed
  or deleted with its clause re-bound, never quarantined. **Infrastructure failures** are a
  separate class (§ V5).

## V5 Gates and enforcement

| Gate | Enforced by | What it refuses |
|---|---|---|
| L0 | the `PostToolUse` hook (reports, cannot block an edit); the agent's discipline in `kmp/CLAUDE.md`; audited by L1 | — |
| L1 | the pre-commit git hook, installed by `SessionStart` | a commit whose touched modules fail |
| L2 | the **pre-push git hook** (`gate.sh commit`), installed by `SessionStart`; re-run by L3 on the runner | a push that changes behaviour without a clause |
| L3 | branch protection on `main`: required checks with always-run shim jobs, a merge queue, no direct pushes; `CODEOWNERS` review on gate configuration, workflows, goldens and their sidecars, the balance state (D17); no agent holds a bypass token | a merge that fails on any platform or touches the gates without the owner |
| L4 | a nightly job that files an issue and pings the owner on failure and sets a repository variable `nightly-rules=red` when a `Sim` or `Mutation` check failed; the L3 workflow reads it and fails any pull request that touches `:core` or the rules areas of `spec/` while it is red | a slow truth ignored |
| Goldens | `instruments approve <golden>` writes a sidecar `{golden, old sha, new sha, clause id, approver, timestamp, bundle}`; the approver must be the pull request's reviewer (the owner or a reviewing agent identity that never writes code), and an L3 check fails a golden whose sidecar's approver is the commit's author or is missing | a self-certified visual or rules change |
| Suppressions | Konsist budgets and expiry; the dated port exemption (`TECHNICAL.md` § T8.1) | an unexplained exception |
| The oracle | the `oracle-frozen` required check from P2: any diff under `game/sim/**`, `game/data/**`, `game/types.ts` relative to `ts-oracle-v3` fails | drift in the reference |
| The spec | the binder and spec-lint | an unbound contract clause, an unknown id, an unpromoted proposal |
| The lanes themselves | the CI workflows are generated from `kmp/ci/lanes.yaml`; a check fails when they differ | a tool silently disabled |
| Infrastructure failures | an emulator or simulator that fails to boot, a runner evicted, a network error before any test body ran: re-run **once**, the re-run recorded in the ledger with its reason; a second failure is real. A red required check can be overridden only by the owner, and the override is a logged comment on the pull request naming the check and the reason | a flaky test disguised as infrastructure; an unlogged override |

A pull request must carry: the clause ids it binds or changes; the review bundle link; for
a screen or asset change, the golden diff and its approval sidecar; for a rules or number
change, the balance snapshot diff and the arithmetic in the clause. Writers, verifiers and
critics are separate agents (`TECHNICAL.md` § T6.3).

## V6 Failure classes and the gate that catches each

| Failure class | Caught by | Lane |
|---|---|---|
| A rule implemented wrong | the clause's tests; the golden hash lists | L1 · L2 |
| A rule drifted from the oracle in a way no unit test names | the golden hash lists over the coverage matrix (every draw, pending, hero turn, event and field); `diff-oracle` | L2 · L3 · L4 |
| A rule that is right on one runtime and wrong on another (libm, formatting, integer overflow) | the cross-platform hash test on the JVM, an arm64 Android device test, the iOS simulator, the phones | L3 · L4 |
| Nondeterminism (a hidden `Random`, a clock, iteration order) | the purity rules; the three-way self-check; the hash test; random spec order | L0 · L1 · L3 |
| A closed union grown without every interpreter updated | exhaustive `when`, `allWarningsAsErrors` | L0 |
| A balance regression | the reduced snapshot; the full ladder nightly | L2 · L4 |
| A visual regression on a screen | goldens per fixture, in the canonical container | L2 |
| A visual regression in the lit frame (bloom, light, actors, fog, motes, shafts) | the biome frame goldens; the `backdrops` and `vfx` goldens; the visual-parity band until P8; the full-frame critic on the bundle | L2 · review |
| A layout or tap-target regression (a button drawn elsewhere, registered disabled) | the storyboard fails to advance; the semantics tests | L1 · L2 |
| Keyboard parity broken | the storyboard runs once by tag and once by the keyboard route | L2 |
| An edge target unreachable under gesture navigation | the Maestro edge-target flow | L4 |
| A performance regression on the JVM | the perf budget test | L2 |
| A performance regression on a phone; the tier drop not firing | the device benchmarks; the forced-slow-frame flow | L4 |
| An allocation in the stage's own draw; a display-surface readback | the allocation-rate assertion; the detekt rule | L2 · L0 |
| Memory pressure on a phone | the peak-resident-set budget | L4 |
| An asset that fails the bible | the asset gate over `kmp/assets/actors/**` | L2 |
| An asset that passes the numbers and fails the eye | the critic on the contact sheet and the frame; the owner; the stop rule | review |
| The exported floor patches out of step with the stage anchors | the anchor-drift test (until P6b) | L2 |
| A dependency-boundary violation | Gradle, Konsist, the `:core` no-deps assertion | L0 · L1 |
| A public API change nobody meant | the JVM ABI dump; the klib dumps | L1 · L3 |
| Complexity or size creep | the budgets (with the dated port exemption) | L0 · L1 |
| Dead code, unused dependencies | explicit API + warnings as errors; `buildHealth` | L0 · L3 |
| A test that tests nothing | the assertion rule; Pitest; the verifier's tests; weak clauses in the matrix | L1 · L4 |
| A flaky test | random order, no retries, the flake rule | L3 · L4 |
| A save that no longer replays after a rules change | the `RULES_VERSION` rule; the save corpus (version N replays, N − 1 resumes from its snapshot) | L2 |
| App size creep | the size test | L3 |
| Audio silent on a platform | the emulator audio-plays assertion; the Maestro flow on the phones | L3 · L4 |
| A crash only on a device | the boot smoke; the nightly storyboard on emulator and simulator; Maestro flows | L3 · L4 |
| A spec clause nobody tests | the binder | L1 |
| A golden changed to make a test pass | the approval sidecar (approver ≠ author) and the clause-change rule | L2 · L3 |
| The gates' own configuration changed by a writer | `CODEOWNERS` review | L3 |
| A tool silently disabled | the generated-workflows check | L3 |
| Missing or wrong feedback (a hit without a pop, a prompt that blinks off, no hit-stop) | the mechanisable items of the `kmp-quality` checklist as clauses and tests; the rest by the critic and the owner in the first ten minutes | L1 · review |
| A store rejection | not automatable; the P7 checklist and the owner's submission | — |
| The owner's taste | not automatable; the critic reduces the surprises, the owner decides | — |

## V7 Measuring the loop

`kmp/ci/lanes.json` accumulates every lane run with its machine class. The nightly lane
asserts each lane's p90 duration over the last week, per machine class, is inside its
budget and files an issue otherwise, naming the slowest task. Also tracked: flakes (target
zero; each one an issue), infrastructure re-runs (each one logged), coverage and mutation
trends (must not fall), spec coverage (100 % of contract clauses, none weak), time-to-green
per change (from the first L1 failure to a green L2, from the bundle's timestamps), and the
review bundle's size (a bundle nobody can read in five minutes is too big). The owner reads
a one-page summary monthly; the budgets are revisited then and only then.

## V8 The oracle's lifecycle

1. **P2–P5**: `ts-oracle-v3` is the reference; the committed hash lists gate L2;
   `diff-oracle` regenerates cells in L3 (the probe subset) and nightly (the whole set); the
   TypeScript harness at the repository root must stay runnable (`npm ci`).
2. **Parity (P5's gate)**: the Kotlin harness records the same golden set; the hashes are
   equal; `spec/golden/` now carries the Kotlin-recorded lists and the oracle becomes a
   nightly cross-check only.
3. **First rules change after parity**: the goldens move with a clause and `RULES_VERSION`
   bumps (§ V5); the oracle no longer matches by design and is retired from the nightly;
   `oracle/` stays in the repository as history.
4. **PvP**: `:core` is the oracle for a server that verifies results by replay.

## V9 Bootstrapping the rig (P1)

In order, each proven before the next: the convention plugins and the empty modules with
the edge assertions → `lanes.yaml`, `gate.sh` and the generated workflows → Spotless and
detekt with the budgets → Kotest on the JVM with one clause and the binder generating one
table → Konsist and the JVM ABI dump → `Frame`, `Layout` and `Stage` drawing one exported
sprite and one button → the headless `shot` → one screen semantics test with virtual time →
one Roborazzi golden recorded in the canonical container and compared on a second OS → the
storyboard driver crossing one screen → the perf test with the allocation baseline → the
hooks (edit, pre-commit, pre-push) → the CI workflows with path filters, shim jobs, the
required checks and `CODEOWNERS` → the Android, iOS and wasm compiles in L3 → the nightly
skeleton → **the synthetic `:core`-sized module** (5 000 lines, 300 tests) that every
budget is measured on. P1 ends when every lane is green *and* every budget holds on the
synthetic module with the ledger to show it. If a budget cannot be met there, the plan is
wrong about the lane's contents and is fixed here, not later.

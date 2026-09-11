# The verification loop — fast and airtight

The brief asks for extra attention here: how do agents get feedback that is fast enough to
keep in the loop and complete enough that nothing slips through? This document is the
answer. It defines the lanes and their time budgets, the instruments that let an agent see
and measure its own work, how determinism and time control make every check exact, how
the gates are enforced, and — the airtight part — which failure class each gate catches.
`TECHNICAL.md` §§ T6–T8 say how tests, specs and analysers are written; this document says
when they run and what they prove.

## V1 Two properties

**Fast** means each lane has a time budget, the budget is measured on every run and
checked nightly, and a check that outgrows its lane moves to a slower lane rather than
being trimmed. The fast lanes are what an agent runs dozens of times an hour; if they take
minutes they are skipped, and a skipped gate is no gate.

**Airtight** means every failure class the project can name has a gate that catches it
(§ V6), the gates are enforced by machines (hooks, required checks, a merge queue) rather
than by discipline, no test is retried, no golden is updated without an approval record, no
suppression lacks a reason, and the loop is itself measured (§ V7). Where the plan cannot
make a class airtight (a device-only crash, the owner's taste) it says so and names the
slower gate that covers it.

The two properties pull against each other; the lanes are the resolution.

## V2 The lanes

| Lane | Budget | Trigger | Contents | Proves |
|---|---|---|---|---|
| **L0 edit** | ≤ 3 s | the `PostToolUse` hook after every edit of `*.kt` or `spec/**`; `gate.sh edit` | Spotless apply on the file; the touched module's `compileKotlinJvm`; detekt on changed files; spec-lint on changed clauses | it compiles, it is formatted, it has no new smell |
| **L1 module** | ≤ 30 s | before every commit (pre-commit hook), by the agent after each milestone; `gate.sh module` | the touched modules' `jvmTest` (`Fast` tag: unit, property at 100 cases, table-driven, screen semantics), Konsist, `checkKotlinAbi`, the spec matrix for the touched areas | the rules and screens do what their clauses say; the architecture holds |
| **L2 commit** | ≤ 3 min | the commit gate `gate.sh commit`; every push | the whole JVM test set; the differential lane on the golden set (`diff-oracle` or the frozen goldens); the balance snapshot at reduced N; screenshot goldens; the storyboard on JVM (two acts + a KO); the asset gate; the desktop perf test; Kover thresholds; the review bundle | nothing observable changed unless a clause changed |
| **L3 merge** | ≤ 20 min | the pull request (required checks; merge queue) | L2 plus: every target compiles (Android, iOS framework, wasmJs); the cross-platform hash test on Android unit tests and the iOS simulator; Android Lint; `buildHealth`; the size test; the emulator and simulator boot smoke; workflow and script lint | it ships on every platform |
| **L4 nightly** | ≤ 3 h | schedule; on demand | the full Monte Carlo at 2000 runs per policy on two seeds; property tests at 10 000 cases; Pitest on `:core`; the storyboard on emulator and simulator; Maestro flows; device benchmarks on the reference phones; iOS screenshot goldens (informative); Renovate; the lane-budget check over the day's `ci/lanes.json` | the slow truths: balance, mutation, devices |

A lane's contents may grow; its budget may not, without a README decision. Timings are
appended to `ci/lanes.json` by `gate.sh` and by CI on every run.

## V3 The instruments — what agents see and measure

Everything below is a command in `:tools:instruments` (or `:sim`) that writes files an
agent can read (PNG, Markdown, JSON) and returns a non-zero exit on failure. The PNGs are
what an agent with eyes looks at; the tables are what it argues with.

1. **`shot`** — render any screen state from a fixture to a PNG, headlessly, in process:
   `instruments shot --screen map --fixture act3 [--phone] [--tier LOW]`. Uses the desktop
   headless scene (`ImageComposeScene` or its v2 equivalent, wrapped once so an API change
   touches one file) at `k = 1`, 1280×720, with virtual time. 100–300 ms per frame after
   warm-up. Replaces `tools/screens.html` + `capture.mjs shot`.
2. **`storyboard`** — drive a seeded whole run through the *real* screens, tapping by test
   tag or by contract geometry, one PNG per distinct screen crossed, `decisions.json` (the
   seed plus every answer, which `:sim replay` reproduces headlessly), and a verdict line:
   `PLAYFULL OK` when the requested acts were cleared (or the run won, or `--ko` produced
   the death it asked for), `PLAYFULL ENDED act=… room=…` with a non-zero exit when the
   party died, `PLAYFULL STALLED` on a budget overrun. Seconds on the JVM because time is
   virtual and animations are stepped; the same driver runs in instrumentation on Android
   and iOS nightly. Replaces `capture.mjs playfull`.
3. **`sheets`** — line-ups (colour, greyscale, silhouette at ×2 and ×4), every actor's pose
   sheet, contact sheets of candidates, and `metrics.md`/`.json` against the bible; the
   art gate's human face. Replaces `tools/lineup.html` + `capture.mjs sheets`.
4. **`frames`** — battle frames at chosen virtual ticks per biome: the resting frame, a hit
   peak, +360 ms, PAUSE, INSPECT, GAME OVER, the act-clear tableau; byte-deterministic
   because every draw is seeded and time is virtual (today's captures differ on 74 % of
   pixels between two runs; these will not).
5. **`sim`** (`:sim`) — the harness tables and JSON; `trace`, `diff-oracle` with the first
   divergent line, `selfcheck`, `spd`, `vault`, `snapshot`, `replay`.
6. **The spec matrix** — `build/reports/spec/matrix.md`: every clause, its status, its
   tests, their results; the first page of every verification report.
7. **`perf`** — frame-time histograms (p50/p95/p99), allocation rate, and the per-pass cost
   table of the stage on the JVM; the device benchmark results nightly.
8. **Hot Reload with its MCP server** — for a live loop on desktop: an agent edits, the app
   reloads, the agent asks the running app for a screenshot or the UI tree. An instrument
   for exploration, never a gate (the gate is the headless, deterministic path).
9. **Device shots** — `adb`/`simctl` screenshots and Maestro flow recordings from the
   nightly lane, for the platform-only classes (§ V6).
10. **The review bundle** — `build/review/<sha>/`: the matrix, the test summary, the lane
    timings, the sim diff, the sheets and metrics, the storyboard, the perf table, the
    changed goldens side by side with their previous versions. `gate.sh` writes it; a
    verifier, a critic and the owner read it; a pull request links it. Replaces the ad hoc
    `tools/out/` reading of today.

## V4 Determinism and time control

- **Randomness**: seeded everywhere; `:core` takes an rng; `:ui` takes one for presentation
  randomness (particle jitter, idle offsets) separate from the rules'; nothing calls the
  platform's random in a test.
- **Time**: the loop takes a clock; under test it is a virtual clock stepped by the test
  (`mainClock.autoAdvance = false; advanceTimeBy(16)` in Compose tests; the instruments'
  driver steps frames explicitly). No `delay`, no `sleep`, no wall-clock reads outside the
  shells (a detekt rule).
- **Rendering**: goldens are rendered on the JVM at `k = 1` with the bundled fonts and one
  Skia build, so they are byte-exact; a golden diff prints the changed pixel count and a
  side-by-side. Android and iOS goldens (Roborazzi) are per platform with a small
  tolerance for text rasterisation and are informative until the tooling is stable.
- **Ordering**: Kotest runs specs in random order in CI to expose order dependence.
- **Flakes**: a test that fails and then passes without a code change is a bug filed
  against the test the same day; CI has no retry setting; a flaky test is fixed or deleted
  with its clause re-bound, never quarantined.

## V5 Gates and enforcement

| Gate | Enforced by | What it refuses |
|---|---|---|
| L0 | the `PostToolUse` hook (reports, cannot block an edit) and the agent's discipline in `kmp/CLAUDE.md` | — |
| L1 | the pre-commit git hook | a commit whose touched modules fail |
| L2 | `gate.sh commit`; the push is refused by the agent's skill when L2 is red | a push that changes behaviour without a clause |
| L3 | branch protection: required checks, a merge queue, no direct pushes to `main` for `kmp/**` | a merge that fails on any platform |
| L4 | a nightly job that files an issue and pings the owner on failure; the next day's merges are blocked while the nightly is red on the rules (`Sim`, `Mutation` tags) | a slow truth ignored |
| Goldens | `instruments approve <golden>` records who, why and the clause id into the golden's sidecar; a golden changed without a sidecar entry fails L2 | a silent visual or rules change |
| Suppressions | Konsist budgets and expiry (`TECHNICAL.md` § T8.1) | an unexplained exception |
| The oracle | `ts-oracle-v3` is a tag; `oracle/` is read-only in CI (a workflow fails on any diff under it) | drift in the reference |
| The spec | the binder and spec-lint | an unbound contract clause, an unknown id |

A pull request must carry: the clause ids it binds or changes; the review bundle link; for
a screen or asset change, the golden diff approved; for a rules or number change, the
balance snapshot diff and the arithmetic in the clause. Writers, verifiers and critics are
separate agents (`TECHNICAL.md` § T6.3).

## V6 Failure classes and the gate that catches each

| Failure class | Caught by | Lane |
|---|---|---|
| A rule implemented wrong | the clause's tests; the differential lane | L1 · L2 |
| A rule drifted from the oracle in a way no unit test names | the trace diff on the golden set (every draw, event and field) | L2 |
| A rule that is right on one platform and wrong on another (FP, integer overflow) | the cross-platform hash test | L3 |
| Nondeterminism (a hidden `Random`, a clock, iteration order) | the purity rules; the three-way self-check; the hash test; random spec order | L0 · L1 · L3 |
| A closed union grown without every interpreter updated | exhaustive `when`, `allWarningsAsErrors` | L0 |
| A balance regression | the snapshot at reduced N; the full ladder nightly | L2 · L4 |
| A visual regression on a screen | goldens per fixture | L2 |
| A visual regression in the lit frame (bloom, light, actors) | the biome frame goldens; the full-frame critic on the bundle | L2 · review |
| A layout or tap-target regression (a button drawn elsewhere, registered disabled) | the storyboard fails to advance; the semantics tests | L1 · L2 |
| Keyboard parity broken | the storyboard runs once by tag and once by keyboard route | L2 |
| A performance regression on the JVM | the perf budget test | L2 |
| A performance regression on a phone | the device benchmarks | L4 |
| An allocation in the frame loop | the allocation-rate assertion; the `readPixels` rule | L2 · L0 |
| An asset that fails the bible | the asset gate over `assets/` | L2 |
| An asset that passes the numbers and fails the eye | the critic on the contact sheet and the frame; the owner | review |
| A dependency-boundary violation | Gradle, Konsist, the `:core` no-deps assertion | L0 · L1 |
| A public API change nobody meant | the ABI dump | L1 |
| Complexity or size creep | the budgets | L0 |
| Dead code, unused dependencies | explicit API + warnings as errors; `buildHealth` | L0 · L3 |
| A flaky test | random order, no retries, the flake rule | L3 · L4 |
| A save that no longer replays after a rules change | the rules-version check in the save; a replay test over a corpus of saves in `spec/fixtures/saves/` | L2 |
| App size creep | the size test | L3 |
| A crash only on a device | the boot smoke; the nightly storyboard on emulator and simulator; Maestro flows | L3 · L4 |
| A spec clause nobody tests | the binder | L1 |
| A golden changed to make a test pass | the approval sidecar and the clause-change rule | L2 · L3 |
| A tool silently disabled | `gate.sh` runs the lane definitions from `ci/lanes.yaml`, which the nightly compares to the CI workflows; a lane missing a tool fails | L4 |
| A store rejection | not automatable; the P7 checklist and the owner's submission | — |
| The owner's taste | not automatable; the critic reduces the surprises, the owner decides | — |

## V7 Measuring the loop

`ci/lanes.json` accumulates every lane run: lane, git sha, duration, result, which tool
failed. The nightly lane asserts each lane's p90 duration over the last week is inside its
budget and files an issue otherwise, naming the slowest task. Also tracked: flakes (target
zero; each one an issue), coverage and mutation trends (must not fall), spec coverage (must
be 100 % of contract clauses), time-to-green per change (from the first L1 failure to a
green L2, from the bundle's timestamps), and the review bundle's size (a bundle nobody
can read in five minutes is too big). The owner reads a one-page summary monthly; the
budgets are revisited then and only then.

## V8 The oracle's lifecycle

1. **P2–P5**: `ts-oracle-v3` is the reference; `diff-oracle` runs in L2 against the golden
   set; the TypeScript harness under `oracle/` (root, until P8) must stay runnable.
2. **Parity (P5's gate)**: the Kotlin harness records the same golden set; the two hashes
   are equal; `spec/golden/` now carries the Kotlin-recorded traces and the oracle becomes
   a nightly cross-check only.
3. **First rules change after parity**: the goldens move with a clause (§ V5); the
   oracle no longer matches by design and is retired from the nightly; `oracle/` stays
   in the repository as history.
4. **PvP**: `:core` is the oracle for a server that verifies results by replay.

## V9 Bootstrapping the rig (P1)

In order, each proven on the hello-world stage before the next: the convention plugins and
the empty modules with the edge assertions → Spotless and detekt with the budgets → Kotest
on JVM with one clause and the binder → Konsist and the ABI dump → `Frame` + `Stage`
drawing one exported sprite and one button → the headless `shot` → one screen semantics
test with virtual time → one Roborazzi golden → the storyboard driver crossing one screen
→ the perf test → `gate.sh` with `ci/lanes.yaml` and the timing ledger → the hooks → the
CI workflows with path filters and the required checks → the Android, iOS and wasm
compiles in L3 → the nightly skeleton. P1 ends when every lane is green *and* every
budget holds with the ledger to show it. If a budget cannot be met on the hello-world stage
the plan is wrong about the lane's contents and is fixed here, not later.

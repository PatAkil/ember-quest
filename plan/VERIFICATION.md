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
slower lane rather than being trimmed — as a recorded decision that also moves the failure
class it catches in § V6. The fast lanes are what an agent runs dozens of times an hour; if
they take minutes they are skipped, and a skipped gate is no gate. The budgets were sized
against measurements taken on this repository (a warm Gradle round trip 1–2 s; an
incremental compile of a 6 000-line module 3–4 s; 200 harness runs 1.7 s; 2 000 runs 9 s)
and are proven at P1 on a synthetic module the size of the rules and a synthetic storyboard,
not on a hello-world.

**Airtight** means every failure class the project can name has a gate that catches it
(§ V6), and the gates are enforced by machines wherever a machine can: git hooks that
refuse a commit or a push, a ruleset on `main` with required checks and an empty bypass
list, two GitHub identities so that no author approves their own change, code ownership
that keeps the gates' own configuration out of the agents' hands, approvals verified
through GitHub's review data rather than a file. Two things stay with discipline and are
audited by the next machine gate: the edit hook (L0) reports and cannot block, and the
review bundle is read by people and critics. Where a class cannot be made airtight — a
device-only crash, the owner's taste — this document says so and names the slower gate
that covers it.

## V2 The lanes

| Lane | Budget (machine) | Trigger | Contents | Proves |
|---|---|---|---|---|
| **L0 edit** | ≤ 8 s (the agent's environment image, warm Gradle and Kotlin daemons, a configuration-cache hit; one run per two seconds at most) | the `PostToolUse` hook after every edit of `*.kt` or `spec/**`; `gate.sh edit` | ktlint on the file; detekt's syntax-only rules on the changed files; spec-lint on changed clauses; the touched module's incremental `compileKotlinJvm` — if P1's measurement shows the compile does not fit on this machine class, it moves to L1 and the hook says so | it compiles, it is formatted, it has no new smell |
| **L1 module** | ≤ 90 s (the agent's environment image) | the pre-commit hook; by the agent after each milestone; `gate.sh module` | the touched modules' `jvmTest` (`Fast` tag: unit, property at 100 cases, table-driven, screen semantics with virtual time); Konsist scoped to the touched modules; the JVM ABI dump check; the spec matrix for the clauses whose `paths` intersect the touched modules (which also writes `spec/matrix.lock` and stages it) | the rules and screens do what their clauses say; the architecture holds |
| **L2a commit, measured at P1** | ≤ 5 min (the agent's environment image) | the pre-push hook (`gate.sh commit`), which runs L2a and L2b | the whole JVM test set; the committed golden hash lists; the reduced balance snapshot; detekt with type resolution over the tree; Konsist over the tree; Kover thresholds; the desktop perf test on the stage; the anchor-drift test | nothing observable changed unless a clause changed |
| **L2b commit, content-scaled** | target ≤ 5 min, first measured at P4 (frames, the asset gate, the parity comparison) and P5 (goldens, the storyboard); if it outgrows the target at P5 the storyboard moves to L3 and § V6's rows move with it, as a README decision | the pre-push hook | screenshot goldens — byte-exact inside the environment image, SKIPPED-GOLDEN outside it (§ V4); the storyboard in **skip-playback mode** (every biome, boss and screen reached with the strong party and the forcing hooks, once by tag and once by the keyboard route; a two-act run to a KO); the `vfx` and `backdrops` goldens; the asset gate; the visual-parity comparison (until P8); the review bundle | the screens and the assets did not change unless approved |
| **L3 merge** | ≤ 30 min wall-clock across parallel jobs (hosted Linux; one Apple-silicon macOS job ≤ 20 min for the iOS simulator) | the pull request (required checks with always-run shim jobs; a ruleset, no queue) | L2a and L2b re-run in the environment image (the byte-exact goldens); every target compiles (Android, the iOS framework, wasmJs); the klib ABI dumps; the cross-platform hash test on the JVM, on an x86-64 Android emulator with KVM and on the iOS simulator (wasm informative); `diff-oracle` on the probe subset (Node pinned); the full-playback storyboard with frames; Android Lint; `buildHealth`; the size test; the emulator and simulator boot smoke with the audio-plays assertion; workflow and script lint; the generated-workflows check; the approval check through GitHub's review data; the `oracle-frozen` check; the nightly-rules status; the rules-change golden-diff check (§ V5) | it ships on every platform |
| **L4 nightly** | ≤ 3 h (hosted runners; the self-hosted device runner or the farm) | schedule; `workflow_dispatch` on `main`; never a pull request | the full Monte Carlo at the contract's basis (≈ 135 000 runs, 10–15 min); `diff-oracle` on the whole golden set; property tests at 10 000 cases; Pitest on `:core` and `:engine`'s pure packages; the storyboard on emulator and simulator (two acts); Maestro flows (the first ten minutes, every edge target under gesture navigation, the forced tier drop); the hash test and the device benchmarks (frame time, peak memory, boot) on the reference phones, or on Firebase Test Lab physical devices when a phone is offline — the **arm64 ART truth**; iOS screenshot goldens (informative); the lane-budget check over the ledger | the slow truths: balance, mutation, devices, arm64 |

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
   by contract geometry, and write `decisions.json` (the seed plus every answer, hero turns
   included, which `:sim replay` reproduces headlessly) and a verdict line: `PLAYFULL OK`
   when every requested biome, boss and screen was **reached** (or `--ko` produced the
   death it asked for), `PLAYFULL ENDED act=… room=…` with a non-zero exit when the party
   died before that, `PLAYFULL STALLED` on a budget overrun. `--strong` seeds the Vault
   with the harness's kindled relics (through the real EQUIP face); `--force` uses the debug
   hooks — the same ones `ko=1` uses today — to reach a boss or a screen the party would
   not survive to, so the gate is "reached", never "won"; `--keyboard` drives by the
   keyboard route. **Skip-playback mode** (the commit lane): virtual time jumps straight to
   the next decision, animations are not stepped, and nothing is rasterised — seconds per
   act; **playback mode** (the merge lane): every turn is played at its paced length in
   virtual time and one PNG is written per distinct screen crossed. The same driver runs in
   instrumentation on Android and iOS nightly. Replaces `capture.mjs playfull`.
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
   `tools/vfx.html` and `tools/backdrops.html`, both in the commit lane's golden set.
6. **`compare`** — the visual-parity comparison: the exported TypeScript frames of a biome,
   tier and seat against the Kotlin frames (§ V3.11).
7. **`approve <golden>`** — writes the approval sidecar for a changed golden with the pull
   request number, the clause id and the reason; the approver is whoever reviews that pull
   request, verified in L3 (§ V5).
8. **`sim`** (`:sim`) — `sim <command> [flags]`: `battles`, `runs`, `selfcheck`, `spd-gate`,
   `snapshot`, `trace`, `trace-hash`, `diff-oracle` (the first divergent line), `fixtures`
   (the home-act pack generator), `coverage` (the trace-coverage report: every event kind,
   status, set bonus, sigil effect, pending kind, room type and ascension row that appears
   in the golden set), `replay <save>`; flags `--policy --seed --runs --n --spd --vault
   --ascension --json --dump`.
9. **The spec matrix** — `build/reports/spec/matrix.md`: every clause, its status, its
   tests (writer / verifier), their results; the first page of every verification report.
10. **`perf`** — frame-time histograms (p50/p95/p99), allocation rate, and the per-pass cost
    table of the stage on the JVM; the device benchmark results nightly.
11. **The visual-parity band** (P4's gate, then the commit lane until P8): for each biome,
    measured by the same instruments over the exported TypeScript frame — re-exported at
    P4's start from a named tag — and the Kotlin frame of the same seat and tick, at HIGH
    (the web's tier) and reported at MED: the ground's p50 within ± 3 L*, the actor-median-
    vs-ground ratio at both strips within ± 0.1, the frame's share below L 35 and above L 75
    within ± 3 points, the centre-third lead within ± 3 L*; the fog, motes and shafts
    checked by the same numbers over a frame averaged across one drift period. A band, not
    bytes: the two rasterisers differ, the light rig's arithmetic must not.
12. **The review bundle** — `build/review/<sha>/`: the matrix, the test summary, the lane
    timings, the sim diff, the sheets and metrics, the storyboard, the perf table, the
    changed goldens side by side with their previous versions and their approval records.
    `gate.sh` writes it; a verifier, a critic and the owner read it; a pull request links
    it. Replaces the ad hoc `tools/out/` reading of today.
13. **Hot Reload with its MCP server** — for a live loop on desktop: an agent edits, the
    app reloads, the agent asks the running app for a screenshot or the UI tree. An
    instrument for exploration, never a gate (the gate is the headless, deterministic path).
14. **Device shots** — `adb`/`simctl` screenshots and Maestro flow recordings from the
    nightly lane, for the platform-only classes (§ V6).

## V4 Determinism and time control

- **Randomness**: seeded everywhere; `:core` takes an rng; `:ui` takes one for presentation
  randomness (particle jitter, idle offsets, sound variants) separate from the rules';
  nothing calls the platform's random in a test.
- **Time**: the loop takes a clock; under test it is a virtual clock stepped by the test
  (`mainClock.autoAdvance = false; advanceTimeBy(16)` in Compose tests; the instruments'
  driver steps frames explicitly, or jumps in skip-playback mode). No `delay`, no `sleep`,
  no wall-clock reads outside the shells (a detekt rule).
- **Rendering**: goldens are recorded and compared **inside one environment image** —
  `kmp/ci/env.Dockerfile`, pinned by digest in `lanes.yaml`: the image the agents' cloud
  environment runs in, the developer's devcontainer, and the CI golden job (JDK, the
  Android SDK, the Gradle distribution, warmed dependency and build caches, Skiko, the
  bundled fonts). Inside it goldens are byte-exact at `k = 1`; a golden diff prints the
  changed pixel count and a side-by-side. Skia rasterises text through the host's font
  backend and its SIMD tier is fixed per architecture, so outside the image (a macOS or
  Windows desktop, a container that cannot run Docker) the golden step reports
  **SKIPPED-GOLDEN** with a tolerance diff for the human — never green — and L3 is the
  byte-exact gate. Android and iOS goldens (Roborazzi) are per platform with a small
  tolerance and are informative until the tooling is stable. The P1 hello-world golden is
  recorded in the image and compared on a second OS to prove the rule.
- **Ordering**: Kotest runs specs in random order in CI to expose order dependence.
- **Flakes**: a *test* that fails and then passes without a code change is a bug filed
  against the test the same day; CI has no retry setting for tests; a flaky test is fixed
  or deleted with its clause re-bound, never quarantined. **Infrastructure failures** are a
  separate class (§ V5).

## V5 Gates and enforcement

| Gate | Enforced by | What it refuses |
|---|---|---|
| L0 | the `PostToolUse` hook (synchronous per edit, ≤ 8 s, one run per two seconds; reports, cannot block an edit); the agent's discipline in `kmp/CLAUDE.md`; audited by L1 | — |
| L1 | the pre-commit git hook, installed by `SessionStart` | a commit whose touched modules fail |
| L2a + L2b | the **pre-push git hook** (`gate.sh commit`), installed by `SessionStart`; re-run by L3 on the runner | a push that changes behaviour without a clause |
| L3 | a **ruleset** on `main`: a pull request required, required checks with always-run shim jobs, branches up to date, linear history, a code-owner review on gate configuration, workflows, goldens and their sidecars, and the balance state, and an **empty bypass list** — the owner included; **two identities**: agents push and open pull requests as a non-admin machine user with a fine-grained token (contents and pull requests only), the owner is the only code owner and the only reviewer; no merge queue (unavailable on a user-owned repository; up-to-date branches serialise merges instead) | a merge that fails on any platform, or touches the gates without the owner |
| L4 | a nightly job that files an issue and pings the owner on failure and sets a repository variable `nightly-rules=red` when a `Sim` or `Mutation` check failed; the L3 workflow reads it and fails any pull request that touches `:core` or the rules areas of `spec/` while it is red | a slow truth ignored |
| Goldens | `instruments approve <golden>` writes a sidecar `{golden, old sha, new sha, clause id, pull request, reason}`; the L3 check reads the pull request's **approving reviews through the GitHub API** and fails a golden change whose pull request has no approval from the owner's login, or whose sidecar is missing; the machine user cannot approve | a self-certified visual or rules change |
| Rules changes | a pull request that bumps `RULES_VERSION` must name, in its clause, the golden cells it expects to change; the L3 check verifies that every other cell's hashes are unchanged and prints the first divergent line of each changed cell into the bundle | a bug frozen into a golden beside a legitimate change |
| Suppressions | Konsist budgets and expiry; the dated port exemption (`TECHNICAL.md` § T8.1) | an unexplained exception |
| The oracle | the `oracle-frozen` required check from P2: any diff under `game/sim/**`, `game/data/**`, `game/types.ts` or `game/screens/vault.ts` relative to `ts-oracle-v3` fails | drift in the reference |
| The spec | the binder and spec-lint | an unbound contract clause, an unknown id, an unpromoted proposal |
| The lanes themselves | the CI workflows are generated from `kmp/ci/lanes.yaml`; a check fails when they differ | a tool silently disabled |
| The device runner | the self-hosted runner carries a unique label that only the nightly workflow uses; that workflow runs on `schedule` and `workflow_dispatch` from `main` only, never on a pull request; Actions requires approval for all outside contributors | a fork's pull request reaching the owner's machine |
| Infrastructure failures | an emulator or simulator that fails to boot, a runner evicted, a network error before any test body ran: re-run **once**, the re-run recorded in the ledger with its reason; a second failure is real. A red required check can be overridden only by the owner editing the ruleset, and the edit is a logged comment on the pull request naming the check and the reason | a flaky test disguised as infrastructure; an unlogged override |

A pull request must carry: the clause ids it binds or changes; the review bundle link; for
a screen or asset change, the golden diff and its approval sidecar; for a rules or number
change, the balance snapshot diff, the expected golden cells and the arithmetic in the
clause. Writers, verifiers and critics are separate agents (`TECHNICAL.md` § T6.3). The
owner's review load is stated in the README's money table.

## V6 Failure classes and the gate that catches each

| Failure class | Caught by | Lane |
|---|---|---|
| A rule implemented wrong | the clause's tests; the golden hash lists | L1 · L2a |
| A rule drifted from the oracle in a way no unit test names | the golden hash lists over the coverage matrix (every draw, pending, hero turn, event and field); the trace-coverage report; `diff-oracle` | L2a · L3 · L4 |
| A rule that is right on one runtime and wrong on another (libm, formatting, integer overflow) | the cross-platform hash test on the JVM, x86-64 ART and the iOS simulator; the arm64 phones or farm devices | L3 · L4 |
| Nondeterminism (a hidden `Random`, a clock, iteration order) | the purity rules; the three-way self-check; the hash test; random spec order | L0 · L1 · L3 |
| A closed union grown without every interpreter updated | exhaustive `when`, `allWarningsAsErrors` | L0 |
| A balance regression | the reduced snapshot; the full ladder nightly | L2a · L4 |
| A visual regression on a screen | goldens per fixture, in the environment image (SKIPPED-GOLDEN outside it) | L2b · L3 |
| A visual regression in the lit frame (bloom, light, actors, fog, motes, shafts) | the biome frame goldens; the `backdrops` and `vfx` goldens; the visual-parity band until P8; the full-frame critic on the bundle | L2b · review |
| A layout or tap-target regression (a button drawn elsewhere, registered disabled) | the storyboard fails to reach; the semantics tests | L1 · L2b |
| Keyboard parity broken | the storyboard runs once by tag and once by the keyboard route | L2b |
| An edge target unreachable under gesture navigation | the Maestro edge-target flow | L4 |
| A performance regression on the JVM | the perf budget test | L2a |
| A performance regression on a phone; the tier drop not firing | the device benchmarks; the forced-slow-frame flow | L4 |
| An allocation in the stage's own draw; a display-surface readback | the allocation-rate assertion; the detekt rule | L2a · L0 |
| Memory pressure on a phone | the peak-resident-set budget | L4 |
| An asset that fails the bible | the asset gate over `kmp/assets/actors/**` | L2b |
| An asset that passes the numbers and fails the eye | the critic on the contact sheet and the frame; the owner; the stop rule | review |
| The exported floor patches out of step with the stage anchors | the anchor-drift test (until P6b) | L2a |
| A dependency-boundary violation | Gradle, Konsist, the `:core` no-deps assertion | L0 · L1 |
| A public API change nobody meant | the JVM ABI dump; the klib dumps | L1 · L3 |
| Complexity or size creep | the budgets (with the dated port exemption) | L0 · L2a |
| Dead code, unused dependencies | explicit API + warnings as errors; `buildHealth` | L0 · L3 |
| A test that tests nothing | the assertion rule; Pitest; the verifier's tests; weak clauses in the matrix | L1 · L4 |
| A flaky test | random order, no retries, the flake rule | L3 · L4 |
| A save that no longer replays after a rules change | the `RULES_VERSION` rule; the save corpus (version N replays, N − 1 resumes from its snapshot) | L2a |
| App size creep | the size test | L3 |
| Audio silent on a platform | the emulator audio-plays assertion; the Maestro flow on the phones | L3 · L4 |
| A crash only on a device | the boot smoke; the nightly storyboard on emulator and simulator; Maestro flows | L3 · L4 |
| A spec clause nobody tests | the binder | L1 |
| A golden changed to make a test pass | the approval check through GitHub's reviews and the clause-change rule; the expected-cells check on rules changes | L3 |
| The gates' own configuration changed by a writer | `CODEOWNERS` review by the owner; the machine user is not an admin | L3 |
| A tool silently disabled | the generated-workflows check | L3 |
| A fork's pull request reaching the owner's machine | the runner label and trigger restriction; approval for outside contributors | — (configuration, checked by the generated-workflows diff) |
| Missing or wrong feedback (a hit without a pop, a prompt that blinks off, no hit-stop) | the mechanisable items of the `kmp-quality` rubric as clauses and tests; the rest by the critic and the owner in the first ten minutes | L1 · review |
| A store rejection | not automatable; the P7 checklist and the owner's submission | — |
| The owner's taste | not automatable; the critic reduces the surprises, the owner decides | — |

## V7 Measuring the loop

`kmp/ci/lanes.json` accumulates every lane run with its machine class. The nightly lane
asserts each lane's p90 duration over the last week, per machine class, is inside its
budget and files an issue otherwise, naming the slowest task. Also tracked: flakes (target
zero; each one an issue), infrastructure re-runs (each one logged), coverage and mutation
trends (must not fall), spec coverage (100 % of contract clauses, none weak), time-to-green
per change (from the first L1 failure to a green L2, from the bundle's timestamps), the
owner's review queue (pull requests waiting on the owner and for how long), and the
review bundle's size (a bundle nobody can read in five minutes is too big). The owner reads
a one-page summary monthly; the budgets are revisited then and only then.

## V8 The oracle's lifecycle

1. **P2–P3**: `ts-oracle-v3` is the reference; the committed hash lists gate L2a;
   `diff-oracle` regenerates cells in L3 (the probe subset) and nightly (the whole set); the
   TypeScript harness at the repository root must stay runnable (`npm ci`, Node pinned).
2. **Rules parity (P3's gate)**: the Kotlin harness records the same golden set; the hashes
   are equal; `spec/golden/` now carries the Kotlin-recorded lists and the oracle becomes a
   nightly cross-check only. Visual parity is P4's and P5's gate (§ V3.11).
3. **First rules change after parity**: the goldens move with a clause, `RULES_VERSION`
   bumps and the expected cells are named (§ V5); the oracle no longer matches by design
   and is retired from the nightly; `oracle/` stays in the repository as history.
4. **PvP**: `:core` is the oracle for a server that verifies results by replay.

## V9 Bootstrapping the rig (P1)

In order, each proven before the next: the environment image (`kmp/ci/env.Dockerfile`,
cold start measured) → the machine identity, the ruleset, `CODEOWNERS`, the shim jobs, the
Pages filter → the convention plugins and the empty modules with the edge assertions →
`lanes.yaml`, `gate.sh` and the generated workflows → Spotless and detekt with the budgets →
Kotest on the JVM with one clause and the binder generating one table, **and the binder's
own tests** (an unbound clause, an unknown id, a stale `proposed`, a missing report each
fail a fixture lane) → Konsist and the JVM ABI dump → `Frame`, `Layout` and `Stage` drawing
one exported sprite and one button → the headless `shot` → one screen semantics test with
virtual time → one Roborazzi golden recorded in the image and compared on a second OS → the
storyboard driver crossing one screen in both modes → the perf test with the allocation
baseline → the hooks (edit, pre-commit, pre-push) → the CI workflows with path filters, the
required checks and the approval check → the Android, iOS and wasm compiles in L3 → the
nightly skeleton → **the synthetic `:core`-sized module** (generated from the TypeScript
rules' measured function-size histogram: 5 000 lines, 300 tests including property tests)
and **a synthetic storyboard** (a run of the hello-world screens long enough to measure the
skip-playback and playback modes per act) that every budget is measured on. P1 ends when
every lane is green *and* every P1-measurable budget holds with the ledger to show it. If a
budget cannot be met there, the plan is wrong about the lane's contents and is fixed here,
not later.

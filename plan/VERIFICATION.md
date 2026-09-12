# The verification loop — fast and airtight

The brief asks for extra attention here: how do agents get feedback that is fast enough to
keep in the loop and complete enough that nothing slips through? This document is the
answer. It defines the lanes and their time budgets on named machine classes, the
instruments that let an agent see and measure its own work, how determinism and time
control make every check exact, how the gates are enforced and by whom, and — the airtight
part — which failure class each gate catches and which classes are not automatable.
`TECHNICAL.md` §§ T6–T8 say how tests, specs and analysers are written; this document says
when they run and what they prove.

## V1 Two properties, honestly stated

**Fast** means each lane has a time budget for a named machine class (§ V7), the budget is
measured on every run and checked nightly, and a check that outgrows its lane moves to a
slower lane rather than being trimmed — as a recorded decision that also moves the failure
class it catches in § V6. The fast lanes are what an agent runs dozens of times an hour; if
they take minutes they are skipped, and a skipped gate is no gate. The budgets were sized
against two sets of measurements: the prototype's harness on this repository (200 runs
1.7 s; 2 000 runs 9 s) and, for Gradle and Kotlin, a scratch KMP project a round-2 reviewer
timed (a warm Gradle round trip 1–2 s; an incremental compile of a 6 000-line module
3–4 s). Both are re-measured at P0's environment spike and proven at P1 on a synthetic
module the size of the rules and a synthetic storyboard, not on a hello-world.

**Airtight** means every failure class the project can name has a gate that catches it
(§ V6), and the gates are enforced by machines wherever a machine can: a ruleset on `main`
with required checks and an empty bypass list, a tag ruleset, a release environment that
holds the signing secrets, two identities so that no author approves their own change, code
ownership that keeps the gates' own configuration, the goldens, the art and the contract
out of the agents' hands, and approvals verified through GitHub's review data on the head
commit rather than a file. Four things stay with discipline and are audited by the next
machine gate: the edit hook (L0) reports and cannot block; the git hooks (L1, L2) can be
skipped with `--no-verify`, so L3 re-runs everything they run; the review bundle is read by
people and critics; the critic's score is a review under a protocol, never a gate. Where
a class cannot be made airtight — a device-only crash, the owner's taste — this document
says so and names the slower gate that covers it.

## V2 The lanes

| Lane | Budget (machine class) | Trigger | Contents | Proves |
|---|---|---|---|---|
| **L0 edit** | ≤ 8 s (`agent-env`, warm Gradle and Kotlin daemons, a configuration-cache hit; one run per two seconds at most) | the `PostToolUse` hook after every edit of `*.kt`, `spec/**` or `tools/art/**`; `gate.sh edit` | ktlint on the file; detekt's syntax-only rules on the changed files; spec-lint on changed clauses; the touched module's incremental `compileKotlinJvm` — if P1's measurement shows the compile does not fit on this machine class, it moves to L1 and the hook says so; for the art tool, `tsc` on the file | it compiles, it is formatted, it has no new smell |
| **L1 module** | ≤ 90 s (`agent-env`) | the pre-commit hook; by the agent after each milestone; `gate.sh module` | the touched modules' `jvmTest` (`Fast` tag: unit, property at 100 cases, table-driven, screen semantics with virtual time); Konsist scoped to the touched modules; the JVM ABI dump check; the spec matrix for the clauses whose `paths` intersect the touched modules; the art tool's own tests when it changed | the rules and screens do what their clauses say; the architecture holds |
| **L2a commit, measured at P1** | ≤ 5 min (`agent-env`) | the pre-push hook (`gate.sh commit`), which runs L2a and L2b | the whole JVM test set; the committed golden hash lists; the reduced balance snapshot; detekt with type resolution over the tree; Konsist over the tree; Kover thresholds; the desktop perf test on the stage (allocation-based and relative to a same-run baseline, § T9.5) | nothing observable changed unless a clause changed |
| **L2b commit, content-scaled** | target ≤ 5 min, first measured at P4 (the asset gate over the cast) and P5 (frames, goldens, the storyboard); if it outgrows the target at P5 the storyboard moves to L3 and § V6's rows move with it, as a README decision | the pre-push hook | screenshot goldens — byte-exact inside the environment image, SKIPPED-GOLDEN with a tolerance report outside it, which the hook accepts (§ V4); the storyboard in **skip-playback mode** (every biome, boss and screen reached with the strong party and the forcing hooks, once by tag and once by the keyboard route; a two-act run to a KO); the `vfx` and `backdrops` goldens; the asset gate over `assets/actors/**`; the review bundle | the screens and the assets did not change unless approved |
| **L3 merge** | ≤ 30 min wall-clock across parallel jobs (`hosted-linux`; one `hosted-macos-arm64` job ≤ 20 min for the iOS simulator) | the pull request (required checks with always-run shim jobs; a ruleset, no queue) | L2a and L2b re-run in the environment image (the byte-exact goldens); every target compiles (Android, the iOS framework, wasmJs); the klib ABI dumps; the cross-platform hash test on the JVM, on an x86-64 Android emulator with KVM and on the iOS simulator (wasm informative); `diff-oracle` on the probe subset (Node pinned); the full-playback storyboard with frames; Android Lint; `buildHealth`; the size test; the emulator and simulator boot smoke with the audio-plays assertion; workflow and script lint; the generated-workflows check; the approval check on the head commit through GitHub's review data; the contract-clause check; the prototype-freeze check; the nightly status read from the last nightly run; the rules-change golden-diff check (§ V5) | it ships on every platform |
| **L4 nightly** | ≤ 3 h (`hosted-linux` and `hosted-macos-arm64`; the device lane on `device-runner` in its own private repository, or the farm) | schedule; `workflow_dispatch` on `main`; never a pull request | the full Monte Carlo at the contract's basis (≈ 135 000 runs, 10–15 min); `diff-oracle` on the whole golden set; property tests at 10 000 cases; Pitest on `:core` and `:engine`'s pure packages; the storyboard on emulator and simulator (two acts); Maestro flows (the first ten minutes, every edge target under gesture navigation, the forced tier drop); the device benchmarks (frame time, peak memory, boot) and the arm64 hash test on the reference Android phone, or on Firebase Test Lab physical devices when the phone is offline — the **arm64 ART truth**; the iPhone for benchmarks and Maestro (a Kotlin/Native test binary needs an XCTest wrapper to run on a device, which is not scheduled: `iosSimulatorArm64` in L3 already proves Native arm64 arithmetic); iOS screenshot goldens (informative); the lane-budget check over the ledger | the slow truths: balance, mutation, devices, arm64 |

A lane's contents may grow; its budget may not, without a README decision. `gate.sh` and
CI append `{lane, sha, machine, seconds, result, failed step}` to `ci/lanes.json` on every
run; the nightly checks each lane's p90 over the week per machine class.

## V3 The instruments — what agents see and measure

Everything below is a command that writes files an agent can read (PNG, Markdown, JSON)
and returns a non-zero exit on failure. The PNGs are what an agent with eyes looks at; the
tables are what it argues with. The Kotlin instruments live in `:tools:instruments` (or
`:sim`); every image *measurement* lives in one TypeScript tool, `tools/art/`
(`TECHNICAL.md` § T10.4), which reads PNGs whichever stage drew them.

1. **`shot`** — render any screen state from a fixture to a PNG, headlessly, in process:
   `instruments shot --screen map --fixture act3 [--phone] [--tier LOW]`, at `k = 1`,
   1280×720, with virtual time; one thin wrapper over the desktop headless scene so a
   Compose test-API change touches one file. 100–300 ms per frame after warm-up.
2. **`storyboard`** — drive a seeded run through the *real* screens, tapping by test tag or
   by contract geometry, and write `decisions.json` (the seed plus every answer, hero turns
   included, which `:sim replay` reproduces headlessly) and a verdict line: `PLAYFULL OK`
   when every requested biome, boss and screen was **reached** (or `--ko` produced the
   death it asked for), `PLAYFULL ENDED act=… room=…` with a non-zero exit when the party
   died before that, `PLAYFULL STALLED` on a budget overrun. `--strong` seeds the Vault
   with the harness's kindled relics through the real EQUIP face — which, as the rules
   demand, makes it an **A3 run** (three equipped relics raise the minimum ascension to 3),
   and the `RUN-FLOW` clauses say so; `--force` uses the debug hooks — the same ones the
   prototype's `ko=1` uses — to reach a boss or a screen the party would not survive to, so
   the gate is "reached", never "won"; `--keyboard` drives by the keyboard route.
   **Skip-playback mode** (the commit lane): virtual time jumps straight to the next
   decision, animations are not stepped, and nothing is rasterised — seconds per act;
   **playback mode** (the merge lane): every turn is played at its paced length in virtual
   time and one PNG is written per distinct screen crossed. The same driver runs in
   instrumentation on Android and iOS nightly.
3. **`frames`** — battle frames at chosen virtual ticks per biome and tier: the resting
   frame, a hit peak, +360 ms, PAUSE, INSPECT, GAME OVER, the act-clear tableau, with the
   stage anchors written beside them so the art tool's rulers can read them.
   Byte-deterministic because every draw is seeded and time is virtual (the prototype's
   captures differ on 74 % of pixels between two runs; these will not).
4. **`vfx`** — every `SkillId`'s effect at its peak frame with its cost per family; and
   **`backdrops`** — every biome at every tier with no actors; both in the commit lane's
   golden set.
5. **`approve <golden>`** — writes the approval sidecar for a changed golden with the
   branch, the clause id and the reason; the merge lane resolves the pull request from the
   branch and verifies the owner's approving review on the head commit (§ V5).
6. **`sim`** (`:sim`) — `sim <command> [flags]`: `battles`, `runs`, `selfcheck`, `spd-gate`,
   `snapshot`, `trace`, `trace-hash`, `diff-oracle` (the first divergent line), `fixtures`
   (the home-act pack generator), `coverage` (the trace-coverage report: every event kind,
   status, set bonus, sigil effect, pending kind, room type and ascension row that appears
   in the golden set, "appears" as `TECHNICAL.md` § T5.3 defines it), `replay <save>`;
   flags `--policy --seed --runs --n --spd --vault --ascension --path --json --dump`.
7. **`art`** (`tools/art/`, TypeScript) — `art gate <dir>` (the sheet, motion and
   consistency metrics of `FUNCTIONAL.md` § F3.1 over PNG frames with sidecars), `art
   rulers <frame.png> --anchors <json>` (the seat ruler, the two ground strips, the seat
   spread over any battle frame — the prototype's at P0, the Kotlin stage's from P5), `art
   sheet` (line-ups in colour, greyscale and silhouette at ×2 and ×4, pose sheets, contact
   sheets of candidates, `metrics.md`/`.json`), `art generate`, `art normalise`, `art
   accept`. The gate's human face and the bake-off's instrument.
8. **The spec matrix** — `build/reports/spec/matrix.md`: every clause, its status, its
   tests (writer / verifier), their results; the first page of every verification report.
9. **`perf`** — frame-time histograms (p50/p95/p99), allocation rate, and the per-pass cost
   table of the stage on the JVM; the device benchmark results nightly.
10. **The review bundle** — `build/review/<sha>/`: the matrix, the test summary, the lane
    timings, the sim diff, the sheets and metrics, the storyboard, the perf table, the
    changed goldens side by side with their previous versions and their approval records.
    `gate.sh` writes it; a verifier, a critic and the owner read it; a pull request links
    it.
11. **Hot Reload with its MCP server** — for a live loop on desktop: an agent edits, the
    app reloads, the agent asks the running app for a screenshot or the UI tree. An
    instrument for exploration, never a gate (the gate is the headless, deterministic path).
12. **Device shots** — `adb`/`simctl` screenshots and Maestro flow recordings from the
    nightly lane, for the platform-only classes (§ V6).

## V4 Determinism and time control

- **Randomness**: seeded everywhere; `:core` takes an rng; `:ui` takes one for presentation
  randomness (particle jitter, idle offsets, sound variants) separate from the rules';
  nothing calls the platform's random in a test.
- **Time**: the loop takes a clock; under test it is a virtual clock stepped by the test
  (`mainClock.autoAdvance = false; advanceTimeBy(16)` in Compose tests; the instruments'
  driver steps frames explicitly, or jumps in skip-playback mode). No `delay`, no `sleep`,
  no wall-clock reads outside the shells (a detekt rule).
- **The environment recipe**: `ci/env/` holds one recipe in two forms that must agree —
  `env.Dockerfile` (the image CI and the devcontainer run, pinned by digest in
  `lanes.yaml`) and `setup.sh` (the same steps — JDK, the Android SDK, the Gradle
  distribution, Node at `.nvmrc`, the bundled fonts, warmed caches where the host allows —
  for a host that cannot run the image). The agents' cloud environment is such a host: it
  is provisioned by a session-start script, not by an image, so it runs `setup.sh`, and P0's
  environment spike measures its cold start (budget ≤ 6 min to a warm L0; the alternative,
  costed in the README, is a self-hosted agent pool that runs the image).
- **Rendering**: goldens are recorded and compared **inside the image**. Inside it goldens
  are byte-exact at `k = 1`; a golden diff prints the changed pixel count and a
  side-by-side. Skia rasterises text through the host's font backend and its SIMD tier is
  fixed per architecture, so outside the image (an agent session, a macOS or Windows
  desktop) the golden step reports **SKIPPED-GOLDEN** with a tolerance diff for the human;
  the pre-push hook accepts it and puts the report in the bundle, and L3 is the byte-exact
  gate — a golden is never green outside the image. Android and iOS goldens (Roborazzi)
  are per platform with a small tolerance and are informative until the tooling is stable.
  The P1 hello-world golden is recorded in the image and compared on the owner's Mac to
  prove the rule.
- **Ordering**: Kotest runs specs in random order in CI to expose order dependence.
- **Flakes**: a *test* that fails and then passes without a code change is a bug filed
  against the test the same day; CI has no retry setting for tests; a flaky test is fixed
  or deleted with its clause re-bound, never quarantined. **Infrastructure failures** are a
  separate class (§ V5).

## V5 Gates and enforcement

| Gate | Enforced by | What it refuses |
|---|---|---|
| L0 | the `PostToolUse` hook (synchronous per edit, ≤ 8 s, one run per two seconds; reports, cannot block an edit); the agent's discipline in `CLAUDE.md`; audited by L1 | — |
| L1 | the pre-commit git hook, installed by `SessionStart` (skippable with `--no-verify`; audited by L3) | a commit whose touched modules fail |
| L2a + L2b | the **pre-push git hook** (`gate.sh commit`), installed by `SessionStart` (skippable; re-run by L3 on the runner, which is the gate) | a push that changes behaviour without a clause |
| L3 | a **ruleset** on `main`: a pull request required; **required approvals 0** with a **code-owner review on owned paths**; stale approvals dismissed on push and approval required on the most recent push; required checks with always-run shim jobs; branches up to date; linear history; an **empty bypass list** — the owner included; **two identities**: agents commit, push and open pull requests as a **GitHub App** the owner installs on the repository (contents, pull requests, workflows; short-lived installation tokens), the owner is the only code owner and the only reviewer; **the owner never authors a change on an owned path** — an agent authors, the owner reviews — because an author's own review never counts; no merge queue (unavailable on a user-owned repository; up-to-date branches serialise merges instead). `CODEOWNERS` names the owner for `ci/**`, `build-logic/**`, every analyser configuration, `.github/**`, `spec/golden/**` and its sidecars, `spec/balance/**`, `spec/art/**`, `assets/**` and `prototype/**` | a merge that fails on any platform, or touches the gates, the goldens, the art or the prototype without the owner |
| Tags and secrets | a **tag ruleset**: `v*` and `oracle-*` can be created, moved or deleted only by the owner; the signing material lives only in a **`release` environment** with the owner as required reviewer, so no pull-request workflow can read it; pull-request workflows run with no secrets at all | a moved oracle tag; a store upload or a secret read from an agent's branch |
| L4 | a nightly job that files an issue and pings the owner on failure; the L3 workflow reads the **last nightly run's conclusion** through the API (`actions: read` on the built-in token) and fails any pull request that touches `:core` or the rules areas of `spec/` while a `Sim` or `Mutation` check is red | a slow truth ignored |
| Goldens | `instruments approve <golden>` writes a sidecar `{golden, old sha, new sha, clause id, branch, reason}`; the L3 check resolves the pull request from the branch, reads its **approving reviews through the GitHub API**, and fails a golden change unless an approving review by the owner's login has `commit_id` equal to the pull request's head and the sidecar's `new sha` matches the golden in that tree; the check runs on `pull_request_review` events as well as pushes, so an approval given after the check ran turns it green. An approving review by the App satisfies neither the code-owner rule nor the owner-login check | a self-certified visual or rules change; an approval outrun by a later push |
| Contract clauses | the **contract-clause check**: a pull request whose diff changes the text or the status of a clause with `status: contract`, or promotes a clause to `contract`, needs the owner's approving review on the head commit, read as above; `proposed` clauses move freely, so the P2 fold is not throttled | a rule of the game changed without the owner |
| Rules changes | a pull request that bumps `RULES_VERSION` must name, in its clause, the golden cells it expects to change; the L3 check verifies that every other cell's hashes are unchanged and prints the first divergent line of each changed cell into the bundle | a bug frozen into a golden beside a legitimate change |
| Suppressions | Konsist budgets and expiry; the dated port exemption (`TECHNICAL.md` § T8.1) | an unexplained exception |
| The prototype | `prototype/**` is code-owned, and the **prototype-freeze check** fails any pull request that changes `prototype/game/sim/**`, `prototype/game/data/**`, `prototype/game/types.ts` or `prototype/game/screens/vault.ts` relative to `ts-oracle-v3` once the tag exists; the allowed changes are `TECHNICAL.md` § T4.2's list, each in a named pull request | drift in the reference |
| The spec | the binder and spec-lint; a `proposed` clause bound by passing tests must be promoted in the same pull request (the binder fails a pull request whose matrix has a bound `proposed` clause) | an unbound contract clause, an unknown id, an unpromoted proposal |
| The lanes themselves | the CI workflows are generated from `ci/lanes.yaml`; a check fails when they differ; the workflows' path filter includes `.github/workflows/**` and `ci/**`, so a workflow change tests itself | a tool silently disabled |
| The device runner | the self-hosted runner is registered in a **separate private repository** that the App is not installed on; that repository's nightly workflow runs on `schedule`, checks out `main` of this one and posts its results back as a commit status with a token it alone holds; no workflow of this repository can name the runner | an agent's or a fork's pull request reaching the owner's machine |
| Infrastructure failures | an emulator or simulator that fails to boot, a runner evicted, a network error before any test body ran: re-run **once**, the re-run recorded in the ledger with its reason; a second failure is real. A red required check can be overridden only by the owner editing the ruleset, and the edit is a logged comment on the pull request naming the check and the reason | a flaky test disguised as infrastructure; an unlogged override |

A pull request must carry: the clause ids it binds or changes; the review bundle link; for
a screen or asset change, the golden diff and its approval sidecar; for a rules or number
change, the balance snapshot diff, the expected golden cells and the arithmetic in the
clause. Writers, verifiers and critics are separate agents (`TECHNICAL.md` § T6.3). A
session's writers integrate into one pull request per track, so merges — which serialise
under "branches up to date" at the length of the merge lane — happen a few times a day,
not per writer. The owner's review load, by phase, and the absence protocol are in the
README ("What the owner does").

## V6 Failure classes and the gate that catches each

| Failure class | Caught by | Lane |
|---|---|---|
| A rule implemented wrong | the clause's tests; the golden hash lists | L1 · L2a |
| A rule drifted from the oracle in a way no unit test names | the golden hash lists over the coverage matrix (every draw, pending, hero turn, event and field); the trace-coverage report; `diff-oracle` | L2a · L3 · L4 |
| A rule that is right on one runtime and wrong on another (libm, formatting, integer overflow, contraction) | the cross-platform hash test on the JVM, x86-64 ART and the iOS simulator (arm64); the arm64 Android phone or farm devices | L3 · L4 |
| Nondeterminism (a hidden `Random`, a clock, iteration order) | the purity rules; the three-way self-check; the hash test; random spec order | L0 · L1 · L3 |
| A closed union grown without every interpreter updated | exhaustive `when`, `allWarningsAsErrors` | L0 |
| A balance regression | the reduced snapshot; the full ladder nightly | L2a · L4 |
| A visual regression on a screen | goldens per fixture, in the environment image (SKIPPED-GOLDEN outside it) | L2b · L3 |
| A visual regression in the lit frame (bloom, light, actors, fog, motes) | the biome frame goldens; the `backdrops` and `vfx` goldens; the art tool's rulers over the frames; the full-frame critic on the bundle | L2b · review |
| A layout or tap-target regression (a button drawn elsewhere, registered disabled) | the storyboard fails to reach; the semantics tests | L1 · L2b |
| Keyboard parity broken | the storyboard runs once by tag and once by the keyboard route | L2b |
| An edge target unreachable under gesture navigation | the Maestro edge-target flow | L4 |
| A performance regression on the JVM | the perf test (allocation-based; relative to the same-run baseline) | L2a |
| A performance regression on a phone; the tier drop not firing | the device benchmarks; the forced-slow-frame flow | L4 |
| An allocation in the stage's own draw; a display-surface readback | the allocation-rate assertion; the detekt rule | L2a · L0 |
| Memory pressure on a phone | the peak-resident-set budget | L4 |
| An asset that fails the bible | the asset gate over `assets/actors/**` | L2b |
| An asset that passes the numbers and fails the eye | the critic under its protocol on the contact sheet and the frame; the owner; the stop rule | review |
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
| A golden changed to make a test pass | the approval check on the head commit and the clause-change rule; the expected-cells check on rules changes | L3 |
| A contract clause changed by a writer alone | the contract-clause check | L3 |
| The gates' own configuration changed by a writer | `CODEOWNERS` review by the owner; the App has no admin rights | L3 |
| A tool silently disabled | the generated-workflows check | L3 |
| The oracle tag moved; a store upload from a branch | the tag ruleset; the release environment | L3 |
| An agent's or a fork's pull request reaching the owner's machine | the runner in a private repository the App cannot see | — (configuration, reviewed by the owner) |
| Missing or wrong feedback (a hit without a pop, a prompt that blinks off, no hit-stop) | the mechanisable items of the `kmp-quality` rubric as clauses and tests; the rest by the critic and the owner in the first ten minutes | L1 · review |
| A store rejection | not automatable; the P5 store set-up and the P7 checklist, the owner's submission | — |
| The owner's taste | not automatable; the critic reduces the surprises, the owner decides | — |

## V7 Measuring the loop

Machine classes, named in `lanes.yaml` and in every ledger row: **`agent-env`** (the
agents' cloud environment as provisioned by `setup.sh`; its CPU and memory recorded at
P0's spike), **`hosted-linux`** (GitHub's standard Linux runner), **`hosted-macos-arm64`**
(GitHub's Apple-silicon runner), **`device-runner`** (the owner's machine with the
phones). `ci/lanes.json` accumulates every lane run with its machine class. The nightly
lane asserts each lane's p90 duration over the last week, per machine class, is inside its
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
   prototype's harness under `prototype/` must stay runnable (`npm ci`, Node pinned in its
   `.nvmrc`).
2. **Rules parity (P3's gate)**: the Kotlin harness records the same golden set; the hashes
   are equal; `spec/golden/` now carries the Kotlin-recorded lists and the oracle becomes a
   nightly cross-check only.
3. **First rules change after parity**: the goldens move with a clause, `RULES_VERSION`
   bumps and the expected cells are named (§ V5); the oracle no longer matches by design
   and is retired from the nightly; `prototype/` stays in the repository as history and as
   the demo for as long as the owner keeps it (README question 3).
4. **PvP**: `:core` is the oracle for a server that verifies results by replay.

## V9 Bootstrapping the rig (P1)

In order, each proven before the next: the environment recipe — the image built and
pinned, `setup.sh` proven equivalent on `agent-env` with its cold start in the ledger
(P0's spike, confirmed here) → the GitHub App installed and an agent session opening a
pull request with it → the convention plugins and the empty modules with the edge
assertions → `lanes.yaml`, `gate.sh` and the generated workflows with their shim jobs,
merged **before** the ruleset names them → the ruleset (approvals 0, code-owner review,
stale-approval dismissal, the required checks), `CODEOWNERS`, the tag ruleset and the
`release` environment — from here every step lands as a pull request → Spotless and detekt
with the budgets → Kotest on the JVM with one clause and the binder generating one table,
**and the binder's own tests** (an unbound clause, an unknown id, a bound `proposed` clause
in a pull request, a missing report each fail a fixture lane) → Konsist and the JVM ABI
dump → `Frame`, `Layout` and `Stage` drawing one fallback sprite over one placeholder
backdrop and one button → the headless `shot` → one screen semantics test with virtual
time → one Roborazzi golden recorded in the image and compared on the owner's Mac → the
storyboard driver crossing one screen in both modes → the perf test with the allocation
baseline → the hooks (edit, pre-commit, pre-push) → the Android, iOS and wasm compiles in
L3 → the nightly skeleton and the private device-runner repository → **the synthetic
`:core`-sized module** (generated into `:core` itself under `spec/synthetic/` clauses from
the prototype rules' measured function-size histogram: 5 000 lines, 300 tests including
property tests; both deleted in P3's first `:core` commit) and **a synthetic storyboard**
(a run of the hello-world screens long enough to measure the skip-playback and playback
modes per act) that every budget is measured on. P1 ends when every lane is green *and*
every P1-measurable budget holds with the ledger to show it. If a budget cannot be met
there, the plan is wrong about the lane's contents and is fixed here, not later.

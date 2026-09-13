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
holds the signing secrets, separate identities so that no author approves their own change and no workflow's own
token can post the owner-review checks, code
the plan's own owned-path check — an approving review by the owner on the head commit,
read through GitHub's API — on the gates' own configuration, the goldens, the art, the
tool that measures the art, the prototype and the contract — run from `main`'s copy of
the workflow so the pull request it gates cannot rewrite it — with code ownership as a
second layer whose enforcement at zero approvals P1's first throwaway pull request
verifies rather than assumes, the art tool refusing any reference image that is not a
committed asset, and the environment's two forms checked against one version manifest.
Seven things stay with discipline and are audited by the next machine gate: **P0's
artefacts** — the move and the banner, the capture tools, the art tool and its calibration
golden, the critic's protocol (`plan/spikes/7/CRITIC.md`) and the per-axis baselines it
produces, the fallback captures and the sound hashes — land before any machine gate exists,
so the owner looks at those commits and P1 re-asserts the calibration golden against a
second, independently written reader; the edit hook (L0) reports and cannot block; the git hooks (L1, L2) can be
skipped with `--no-verify`, so L3 re-runs everything they run; the review bundle is read by
people and critics; the critic's score is a review under a protocol, never a CI gate — it is a phase-exit criterion at P4, P5 and P6 (§ T14); and the M1–M3 window at P1 — the environment recipe first, committed in place by spike 6 and reviewed at M1 before `CODEOWNERS` or any check exists — whose owned-path pull requests (the ruleset, the workflows, the gate App's wiring) land before the owned-path check exists at M4, gated only by `CODEOWNERS` (required approvals 1 for that window if M2 finds code-owner review unenforced) and audited by M4's second throwaway pull request; and the art programme's commits before M4 — P4's generation starts at P0's exit, so an actor can be gated and accepted while neither the owned-path check nor L2b's asset gate exists — whose pull requests stay open until M4 merges them, with the asset gate re-run over every actor accepted before M4 at P1's exit (§ V9). Where
a class cannot be made airtight — a device-only crash, the owner's taste — this document
says so and names the slower gate that covers it.

## V2 The lanes

| Lane | Budget (machine class) | Trigger | Contents | Proves |
|---|---|---|---|---|
| **L0 edit** | ≤ 8 s (`agent-env`, warm Gradle and Kotlin daemons, a configuration-cache hit; one run per two seconds at most) | the `PostToolUse` hook after every edit of `*.kt`, `spec/**`, `tools/art/**`, `ci/**`, `.github/**`, `config/**`, the version catalog or a `.md`; `gate.sh edit` | ktlint on the file; detekt's syntax-only rules on the changed files; spec-lint on changed clauses; `gate.sh env-check` when `ci/env/**` changed (which can only re-assert the last install against the committed manifest — an edit to `versions.env` is unverified until L3's bare-runner job); the touched module's incremental `compileKotlinJvm` — if P1's measurement shows the compile does not fit on this machine class, it moves to L1 and the hook says so; for the art tool, `tsc` on the file | it compiles, it is formatted, it has no new smell |
| **L1 module** | ≤ 90 s (`agent-env`) | the pre-commit hook; by the agent after each milestone; `gate.sh module` | the touched modules' `jvmTest` (`Fast` tag: unit, property at 100 cases, table-driven, screen semantics with virtual time); Konsist scoped to the touched modules; the JVM ABI dump check; the spec matrix for the clauses whose `paths` intersect the touched modules, less the `ART`, `RUN-FLOW`, `GOLDEN` and `BALANCE` clauses, whose tests are the commit lane's (`TECHNICAL.md` § T7.2); the art tool's own tests when it changed | the rules and screens do what their clauses say; the architecture holds |
| **L2a commit** (`commit-a`), measured at P1 on the synthetic module and re-measured at P3 against the recorded goldens and the reduced snapshot, which the synthetic module cannot carry | ≤ 5 min (`agent-env`) | the pre-push hook (`gate.sh commit`), which runs L2a and L2b | the whole JVM test set; the committed golden hash lists; the reduced balance snapshot; detekt with type resolution over the tree; Konsist over the tree; Kover thresholds; the desktop perf test on the stage (allocation-based and relative to a same-run baseline, § T9.5) | nothing observable changed unless a clause changed |
| **L2b commit** (`commit-b`), content-scaled | target ≤ 5 min; its storyboard step measured at P1 on the synthetic storyboard, its content-scaled steps first measured at P4 (the asset gate over the cast) and P5 (frames, goldens, the real storyboard); if it outgrows the target at P5 the storyboard moves to L3 and § V6's rows move with it, as a README decision | the pre-push hook | screenshot goldens — byte-exact inside the environment image, SKIPPED-GOLDEN with a tolerance report outside it, which the hook accepts (§ V4); the storyboard in **skip-playback mode** (every biome, boss and screen reached with the strong party and the forcing hooks, once by tag and once by the keyboard route; a two-act run to a KO); the `vfx` and `backdrops` goldens (every image golden lives under `spec/golden/images/<kind>/`, § T2.1); the asset gate over `assets/actors/**`; the spec matrix over every clause whose binding tests carry a tag the lane runs, bound from L2a's and L2b's reports together (a clause bound only by `Device`- or `Nightly`-tagged tests is L4's matrix, `TECHNICAL.md` § T7.2); the calibration golden (`spec/art/calibration.json`, `TECHNICAL.md` § T10.4) and its second reader; from P5, `art rulers` over each biome's resting-frame golden — the fixed set of 36 seats and 72 strip readings with the fallback cast as the reference, at LOW and at the reference phone's default tier (MED) from P5, and at HIGH as well from P6 — each at the in-scene bar recorded at P0 for that tier, a count of the 72 readings at ≥ 1.5:1 — the gate test sums the six biome frames' twelve readings each and compares the total to the clause's bar (`FUNCTIONAL.md` § F3.1) —, the seat spread reported beside it, not gated (the bars re-recorded at P5 under question 2's portrait branch, and at the reached count when the owner accepts a ruler miss, § F3.1); the review bundle | the screens and the assets did not change unless approved |
| **L3 merge** | ≤ 30 min wall-clock across parallel jobs (`hosted-linux`; one `hosted-macos-arm64` job ≤ 20 min for the iOS simulator) | the pull request (required checks — the `changes` job of every workflow that runs lane jobs on a pull request among them, named after its workflow — whose heavy jobs skip themselves by path condition; a ruleset, no queue, no up-to-date rule) | L2a and L2b re-run in the environment image (the byte-exact goldens); every target compiles (Android, the iOS framework; wasmJs as an informative, non-required job until P8) and the app, androidTest and Macrobenchmark APKs are uploaded as artifacts for the device lane; the klib ABI dumps (on the macOS job, inside its budget); the cross-platform hash test on the JVM, on an x86-64 Android emulator with KVM, on the iOS simulator and — if P0's spike 5b passes — on the JVM of a free `ubuntu-24.04-arm` runner, the arm64 arithmetic truth in the merge lane (wasm informative); `diff-oracle` on the probe subset (Node pinned; gated on `core \|\| prototype` with § T4.1's `build \|\| root \|\| spec \|\| assets`); the full-playback storyboard with frames; Android Lint; `buildHealth`; the size test; the emulator and simulator boot smoke with the audio-plays assertion; workflow and script lint; the generated-workflows job (head code, no secrets); `env-check` on the bare runner (§ V4); the gate App's three checks (`owner/owned-path`, the approval read on the head commit through GitHub's review data; `owner/goldens`; `owner/contract-clause`, § V5); the prototype workflow (the freeze check unconditional, `prototype-check` skipped by its condition when `prototype/**` did not change); the nightly status read from the last nightly run; the rules-change golden-diff check (§ V5) | it ships on every platform |
| **L4 nightly** | ≤ 3 h (`hosted-linux` and `hosted-macos-arm64`; the device lane on `device-runner` in its own private repository, or the farm) | schedule; `workflow_dispatch` on `main`; never a pull request | the full Monte Carlo at the contract's basis (≈ 99 000 runs, 8–10 min); `diff-oracle` on the whole golden set; property tests at 10 000 cases; Pitest on `:core` and `:engine`'s pure packages; the storyboard on emulator and simulator (two acts); Maestro flows (the first ten minutes, every edge target under gesture navigation, the forced tier drop); the device benchmarks (frame time, peak memory, boot) and the arm64 hash test on the reference Android phone, or on Firebase Test Lab physical devices when the phone is offline — the **arm64 ART truth** (the farm runs instrumentation tests and the benchmarks, never Maestro, so the Maestro rows report SKIPPED whenever the phone is unavailable); the iPhone for benchmarks and Maestro (a Kotlin/Native test binary needs an XCTest wrapper to run on a device, which is not scheduled: `iosSimulatorArm64` in L3 already proves Native arm64 arithmetic); iOS screenshot goldens (informative); the binder over the `Device`- and `Nightly`-tagged tests' reports, the second matrix, read by P5's gate for the clauses only those tests bind (`TECHNICAL.md` § T7.2); the lane-budget check over the ledger | the slow truths: balance, mutation, devices, arm64 |

A lane's contents may grow; its budget may not, without a README decision. `gate.sh` writes
`{lane, sha, machine, started_at, seconds, result, failed step}` as `lanes.json` into the review bundle;
CI uploads every bundle as a workflow artifact, an agent's `agent-env` rows travel in the
pull request body (`TECHNICAL.md` § T13.5), and the nightly aggregates both per machine
class and checks each lane's p90 — so the fast lanes' budgets have a data source after P1,
not only at it.

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
   by contract geometry, and write the run as a save in `:core`'s canonical text encoding (`RULES_VERSION`, the seed,
   the config and every answer, hero turns included — `TECHNICAL.md` § T11; the encoding
   and `sim replay` exist whatever question 10 answers, only persisting a run in the app is
   contingent; a forced run carries its forcing hooks, each with its firing point (§ T5.3's `debug`
   record: act and lap before the first decision, a room at an act's stage, a pack at a
   battle index, a hero's hp at a decision index), as a `debug` preamble that `sim
   replay` applies at those points, and such a save is not portable across
   `RULES_VERSION`), which `sim replay` reproduces headlessly and a verdict line: `PLAYFULL OK`
   when every requested biome, boss and screen was **reached** (or `--ko` produced the
   death it asked for), `PLAYFULL ENDED act=… room=…` with a non-zero exit when the party
   died before that, `PLAYFULL STALLED` on a budget overrun. `--strong` seeds the Vault
   with the harness's kindled relics through the real EQUIP face — which, as the rules
   demand, makes it an **A3 run** (three equipped relics raise the minimum ascension to 3),
   and the `RUN-FLOW` clauses say so; `--force` uses the debug hooks — set act and lap, jump to a room type, force a pack, set
   a hero's hp; the prototype's `ko=1` is only the last of these, so the rest are P5's to
   build as `spec/platform/` clauses — to reach a boss or a screen the party would not survive to, so
   the gate is "reached", never "won"; `--keyboard` drives by the keyboard route.
   **Skip-playback mode** (the commit lane): virtual time jumps straight to the next
   decision, animations are not stepped, and nothing is rasterised — seconds per act;
   **playback mode** (the merge lane): every turn is played at its paced length in virtual
   time and one PNG is written per distinct screen crossed. The same driver runs in
   instrumentation on Android and iOS nightly.
3. **`frames`** — battle frames at chosen virtual ticks per biome and tier: the resting
   frame, a hit peak, +360 ms, PAUSE, INSPECT, GAME OVER, the act-clear tableau, each with
   the anchors file of `TECHNICAL.md` § T10.4 and the `<frame>.masks/<seat>.png` masks beside it so the art tool's rulers can read it;
   `frames --icon` writes § F2.5's icon master and splash from an accepted hero's idle frame
   at 16× over `seats.json`'s recorded `ground` (`TECHNICAL.md` § T7.5), and the feature graphic over a stage
   capture;
   `--cast fallback` plants the fallback cast whatever `assets/actors/**` holds, `--bloom off` renders the ruler frames without the bright-layer bloom (as P0's bar frames were), and
   `--seats all` fills every anchor with the biome's six seat actors from `spec/fixtures/art/seats/seats.json`, the
   per-biome seat list (`TECHNICAL.md` § T7.5), the population the prototype's `seat=all` plants, and `--seat <id>` plants one id at all six anchors for the seat-spread reading, as the prototype's `seat=<id>` — the id `seats.json` names as `spread`, one such frame per biome in L2b's frame step beside the `--seats all` frames — how the ruler frames of P5's and P6's gates are made
   once P4 commits actors.
   Byte-deterministic because every draw is seeded and time is virtual (the prototype's
   captures differ on 74 % of pixels between two runs; these will not).
4. **`vfx`** — every `SkillId`'s effect at its peak frame with its cost per family; and
   **`backdrops`** — every biome at every tier with no actors; both in the commit lane's
   golden set.
5. **`approve <golden>`** — writes the approval sidecar for a new or changed golden, with its old and new shas, the
   branch, the clause id and the reason; the merge lane resolves the pull request from the
   branch and verifies the owner's approving review on the head commit (§ V5).
6. **`sim`** (`:sim`) — `sim <command> [flags]`: `battles`, `runs`, `selfcheck`, `spd-gate`,
   `snapshot`, `trace`, `trace-hash` (the cell's `set` hash over its run hashes), `diff-oracle` (the first divergent line), `fixtures`
   (the home-act pack generator), `coverage` (the trace-coverage report: every event kind,
   status, set bonus, sigil effect, pending kind, room type and ascension row that appears
   in the golden set, "appears" as `TECHNICAL.md` § T5.3 defines it), `replay <save>`;
   flags `--cell <id> --policy --seed --runs --n --spd --vault --ascension --path --json --dump` and the
   battles knobs `--party --pack --act --ascension --clears --no-stall-gate` (the lap and the pacts come from the party row) with the
   prototype's defaults (golden recording and `diff-oracle` pass `--no-stall-gate`).
7. **`art`** (`tools/art/`, TypeScript) — `art gate <dir>` (the sheet, motion and
   consistency metrics of `FUNCTIONAL.md` § F3.1 over PNG frames with sidecars), `art
   rulers <frame.png> --anchors <json> [--ground]` (the seat ruler, the two ground strips, the seat
   spread over any battle frame — the prototype's at P0, the Kotlin stage's from P5 — and with
   `--ground` the strips' per-channel sRGB median `seats.json`'s `ground` records), `art
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
  `env.Dockerfile` (the image CI and the devcontainer run, built by its own workflow to
  `ghcr.io/<owner>/ember-quest-env`, whose pull request writes the digest into
  `lanes.yaml`; the image carries the marker `/etc/ember-env-image`, which is how the hooks
  tell the image from any other host) and `setup.sh` (the same steps — JDK, the Android
  SDK, the Gradle distribution, Node at the exact version `ci/env/versions.env` pins from P0 (the two `.nvmrc` files
  mirror it), the bundled fonts, warmed caches where the host allows — for a host that cannot
  run the image, on Linux with `apt` and on macOS with `brew`, since the owner's Mac runs
  P0's iOS spike and P1's golden comparison). **They agree by construction and by check**:
  both read one `ci/env/versions.env` and both end by writing a manifest of the installed
  versions (the JDK, Gradle, Node, every Android SDK package, the fonts, and a `marker`
  naming which form wrote it): the image's build writes `ci/env/manifest.image.json`,
  committed in the pull request that pins the digest; a host writes
  `build/env/manifest.json` (gitignored); `gate.sh env-check` compares a host's manifest
  with the committed image manifest and fails when any field but `marker` differs. It has
  three venues, each comparing two *different* forms: L0 on `ci/env/**` edits, on the
  agent's host — which can only re-assert the last install, since the host manifest is
  written by `setup.sh` at session start, so an edit to the recipe is unverified until L3;
  L3, where a dedicated `env-check` job runs `setup.sh` on the **bare** `hosted-linux`
  runner — not in the image — and compares, the one machine-gated venue; and the image
  workflow (`.github/workflows/env-image.yml`, hand-written, outside the generated diff,
  created in § V9's M3), which runs on every `pull_request`, its own `changes` job on the three recipe globs — `ci/env/env.Dockerfile`, `setup.sh`
  or `versions.env`, never `manifest.image.json`, which is the hand-back's own artifact —
  gating the build job (a required check named `env-image`), on `workflow_dispatch` and on `push`
  to `main`: on a pull request it builds the image from the head, pushes it to the
  registry tagged by the head commit, and uploads the rebuilt `manifest.image.json` and
  the digest as an artifact the agent commits into the same pull request (the
  `record-goldens` pattern of the rendering bullet below); it fails while the committed
  manifest differs from what it built or `lanes.yaml`'s digest is not the one this pull
  request's first build pushed under the head tag — the workflow finds its last build by the newest commit tag on the branch in the
  registry and rebuilds only when a recipe file changed since that commit — the manifest
  is not a recipe file, so the hand-back commit itself triggers no rebuild and the check verifies the pinned digest and the
  committed manifest against that last image, not the current head's — and passes once the agent has committed them, so a recipe edit is
  never deadlocked on a manifest that could only exist after its own merge; on `main` it
  rebuilds from `main`'s recipe and turns `main` red if the rebuilt
  manifest differs from the committed one — it publishes the same commit status the merge
  lane's post-merge run does, with the `env` boolean set, so the red-`main` rule of § V5
  reads it — the recipe pins its base image and package
  versions so the two builds agree — and the owner's review of `ci/env/**` is the review
  of what the image contains: the digest the pull request built is the one pinned, and
  the one `main` verified. "Proven equivalent" at P1 means the check passing on
  `agent-env`, on macOS (the owner's Mac, or a hosted-macOS job if there is none) and in
  L3. The agents' cloud
  environment is such a host: it is provisioned by a session-start script, not by an
  image, so it runs `setup.sh`, and P0's environment spike measures its cold start (budget
  ≤ 6 min to a warm L0; the alternative, costed in the README, is a self-hosted agent pool
  that runs the image).
- **Rendering**: goldens are recorded and compared **inside the image**. An agent whose
  host cannot run the image records a golden through the
  **`record-goldens`** workflow — its own `workflow_dispatch`-only workflow with a
  `screens` input (one screen or all), whose job names are outside
  `ci/required-checks.txt`, so a recording run re-posts no required check onto the head
  commit and spends no merge lane on one PNG — which renders inside
  the image and uploads the PNGs as an artifact the agent commits with their approval
  sidecars — so a new screen has a golden to diff against and a host-rendered PNG is
  never committed; question 9's pool makes the same recording local. Inside the image
  goldens are byte-exact at `k = 1`; a golden diff prints the changed pixel count and a
  side-by-side. Skia rasterises text through the host's font backend and chooses its SIMD tier at run
  time from the CPU's features, which the image cannot pin — so M6 records one golden
  through `record-goldens` and compares it in L3, both runs writing the CPU's feature
  flags (`/proc/cpuinfo`, or Skia's selected `SkOpts` tier) into the bundle — a hosted
  runner's silicon cannot be chosen, only observed — and the gate counts as proven only
  once two distinct sets have compared byte-equal; a divergence, or no second set by M8,
  pins the SIMD tier through Skia's build flags in the image, a per-CPU-class tolerance on
  the goldens the fallback to that — and outside the image (an agent session, a macOS or Windows
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

Three checks read the owner's approving reviews — the owned-path check, the goldens check
and the contract-clause check. All three are **one workflow,
`.github/workflows/owner-review.yml`**, with exactly two triggers: `pull_request_target`
(`opened`, `synchronize`, `reopened`, `ready_for_review`) and `workflow_dispatch` with one
input, the pull request number. Under either trigger it runs `main`'s copy of the file,
looks the pull request up through the API, reads its changed files through the API — no checkout of the untrusted head in the job
that holds the gate App's key, so nothing of it can run there — and a pull request cannot
rewrite the check that gates it — and posts its three verdicts as **check runs on the head commit** through a
dedicated **gate App** (`checks: write` and nothing else; its private key is a secret of
an environment `gates` whose deployment-branch rule allows `main` only, which a
`pull_request_target` job may read because that event's environment rules are evaluated
against the default branch, and a `pull_request` or `pull_request_review` job may not,
because theirs are evaluated against `refs/pull/N/merge`). The ruleset requires the three
checks **from that App**, so a check run of the same name posted by any workflow's own
token — the GitHub Actions app — does not count; the agents' App has no `checks`
permission. Because `pull_request_target` has no review-event activity type, a second,
four-line workflow, `.github/workflows/owner-review-redispatch.yml`, on
`pull_request_review` (`submitted`, `dismissed`) does one thing: it dispatches
`owner-review.yml` on `main` with the pull request's number. That workflow runs in the
merge-commit context (`refs/pull/N/merge` — GitHub's events reference, and its 2025-11-07
changelog on environment branch protections, which evaluates that event's environment
rules against the merge ref) and may be the pull request's own copy of the file, so it is
trusted with nothing: it holds no secrets, asks for `actions: write` only, and the gate re-reads
the head commit from the API rather than taking it as an input, so the worst a rewritten
copy can do is fail to dispatch, which leaves the checks pending, never green. So an
approval given after the check ran turns it green without a new push, and no head-branch
edit can weaken the gate; P1's second throwaway pull request proves both halves, and § V9
creates both files beside `lanes.yaml`. The owner never authors a change on an owned path
**or a contract clause**, since an author's own review never counts — the rule is about repository files, so a ruleset edit (the logged one of the
infrastructure-failures row below, the required-check adds of § T13.5) is not an authoring
event — with one exception, the one the bootstrap needs:
the owner creates `CODEOWNERS` and *then* the provisional ruleset
directly at P1, before the checks exist — in that order, because the ruleset's empty bypass
list refuses the owner's own push the moment it exists. After P1 the owner's own words (the
baseline, a register entry, an answer to a question) reach `plan/**` through an agent that
commits what the owner dictates and the owner then reviews.

| Gate | Enforced by | What it refuses |
|---|---|---|
| L0 | the `PostToolUse` hook (synchronous per edit, ≤ 8 s, one run per two seconds; reports, cannot block an edit); the agent's discipline in `CLAUDE.md`; audited by L1 | — |
| L1 | the pre-commit git hook, installed by `SessionStart` (skippable with `--no-verify`; audited by L3) | a commit whose touched modules fail |
| L2a + L2b | the **pre-push git hook** (`gate.sh commit`), installed by `SessionStart` (skippable; re-run by L3 on the runner, which is the gate) | a push that changes behaviour without a clause |
| L3 | a **ruleset** on `main`: a pull request required; **required approvals 0**; stale approvals dismissed on push (the owned-path check itself pins the approval to the head commit, so the "most recent push" setting is not used); required checks — every generated workflow runs on every pull request, a first `changes` job computes the changed paths against the merge base, and each heavy job carries `needs: changes` with an `if:` on its outputs, because a job skipped by its condition satisfies a required check while a workflow filtered out by paths leaves it pending forever (there are no separate shim jobs: the skipped job is the shim); **the `changes` job of every workflow that runs lane jobs on a pull request is itself a required check** — the generator names every job after its workflow (`merge-changes`, `merge-jvm`, …) so no two required checks share a name, and the hand-written workflows follow the same rule (`prototype-changes`, `prototype-freeze`, `prototype-check`; `env-image-changes`, `env-image`), and the nightly, which never runs on a pull request, is outside this rule — because a job skipped by a failed `needs:` satisfies a required check too, so a `changes` failure must be red, never a free pass; **code outside the owned paths merges on green checks alone** — the lanes are its reviewer — except where it binds a clause: a pull request that promotes a `proposed` clause to `contract` needs the owner's review (the contract-clause check), which is the normal case through P3 and P5, so those phases integrate one owner-gated pull request per session per track by design (§ T13.5), not by accident; linear history; an **empty bypass list** — the owner included; **no up-to-date requirement**, because updating a branch pushes a commit that dismisses the owner's approval, so every unrelated merge would cost a fresh review — a semantic conflict between two green pull requests is caught instead by the post-merge run of the merge lane on `main` (on `push` to `main` the `changes` job outputs all-true, as on `workflow_dispatch`, so that run is unconditional): that run — and `env-image.yml`'s own `push`-to-`main` run, which publishes the same status with the `env` boolean set (§ V4) — publishes, as a commit status on `main`, the module booleans of its failing tasks — — every completed run publishes one, a success naming no boolean — and the L3 workflow reads the last **completed** run's status of each through the API, so an in-flight run keeps the previous verdict, a green run clears it, and an absent status means only that no run has completed yet (read as green until P1's first post-merge run) — each Gradle task belongs to one module, and a cross-module job's status names every boolean its fix may touch: the hash test to `core`; `diff-oracle` to `core`, `spec` and `prototype` (its repair may be the oracle's build, lockfile or CI, § T4.2); `:sim`'s golden replay and its reduced balance snapshot to `core` and `spec`; the JVM perf test in `:tools:instruments` to `engine`; the storyboard to `ui`, `engine`, `core`, `assets` and `spec`; the screenshot, frame, `vfx` and `backdrops` goldens to `ui`, `spec` and `assets` (their repair is a re-record under `spec/golden/images/<kind>/` with its `approve` sidecar, § T2.1); the asset gate to `assets` and `art`; the calibration golden, its second reader and `art rulers` to `art`, `assets`, `spec` and `ui` — a pull request intersecting any of a failing job's booleans may merge — and a failure attributable to no module to the boolean of the paths its fix touches — `env-check` on the bare runner to `env`, a lint to the boolean of the file it flagged (the status names the file), spec-lint to `spec`, the generated-workflows job and `buildHealth` to `build`, the size test to `build`, `assets`, `ui` and `app` — so the fixing pull request always intersects the status and the rule cannot deadlock on its own fix — and while it is red the L3 workflow fails every pull request whose own `changes` outputs do not intersect them (a fix touches the failing area; anything else waits — the booleans are the `changes` job's, § T4.1, so while `:core` is red a `:core` fix may merge and a `:ui` pull request waits, never the reverse); the **owned-path check**, a required check that reads the pull request's approving reviews through the API and fails any pull request touching an owned path without the owner's approving review on the head commit — the primary gate on owned paths, independent of `CODEOWNERS` semantics (whether GitHub enforces a code-owner review at zero approvals is contested, and P1's first throwaway pull request verifies it; `CODEOWNERS` stays as the second layer either way); **the identities**: agents commit, push and open pull requests as a **GitHub App** the owner installs on the repository (contents, pull requests, issues, workflows, actions; short-lived installation tokens; no `checks`), the gate App posts the three owner-review checks — their check-run names, spelled identically in the ruleset, `ci/required-checks.txt` and `owner-review.yml`: `owner/owned-path`, `owner/goldens`, `owner/contract-clause` — and nothing else, the owner is the only code owner and the only reviewer; **the owner never authors a change on an owned path** — an agent authors, the owner reviews — because an author's own review never counts; no merge queue (GitHub's own page: "available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud", read 2026-09-12). The owned paths — one list, in the check's code, from which `CODEOWNERS` is generated and a `build-logic` test asserts the two agree — as literal globs: `ci/**`, `build-logic/**`, `config/**` (detekt and ktlint configuration live there; the Konsist suite is `build-logic`'s), `.editorconfig`, `gradle/**` and `gradlew*` (the catalog, and the wrapper — a second Gradle pin beside `versions.env`, which § T3's lint pairs with it, and a jar every lane executes), `.github/**`, `spec/golden/**` and its sidecars, `spec/balance/**`, `spec/art/**`, `spec/fixtures/**` (the cells' inputs, the rules' test vectors and the palette the portrait criterion measures against), `docs/**` (the privacy policy the stores hold the owner to), `assets/**`, `tools/art/**`, `prototype/**`, and — because the bar an agent's work is judged by must not be the agent's to move — `plan/**` except `plan/spikes/**` (the register, the questions, the money, `BASELINE.md`), `.claude/**` and `CLAUDE.md` (the rubric, the hooks, the budget table), the root `LICENSE` and `README.md` (question 8(b)'s legal fork and the repository's front page), and the root build files `settings.gradle.kts`, `build.gradle.kts` and `gradle.properties` (a `build-logic` test asserts every included module applies the quality convention plugin) | a merge that fails on any platform, or touches the gates, the goldens, the art, the art tool or the prototype without the owner |
| Tags and secrets | a **tag ruleset**: `v*` and `ts-oracle-*` can be created, moved or deleted only by the owner — its bypass list holds the owner as repository admin, the one bypass in the repository, because a ruleset exempts nobody implicitly and a tag must be creatable by someone; the signing material lives only in a **`release` environment** with the owner as required reviewer and a deployment branch-and-tag rule admitting `main` and `v*` alone, so no pull-request workflow can read it — a `pull_request` job's environment rules are evaluated against `refs/pull/N/merge`, which the rule refuses before any approval prompt — (a public repository's gate: on a private one — question 8(b) — required reviewers need GitHub Enterprise, and that branch keeps the tag ruleset alone); the generated lane workflows run with no secrets at all — the nightly's farm job holds none either, only `id-token: write` for the farm's workload identity federation (`TECHNICAL.md` § T1) — and the one pull-request workflow that reads a secret is `owner-review.yml`, under `pull_request_target` from `main`'s copy, and that secret is the gate App's key, never the signing material | a moved oracle tag; a store upload or a secret read from an agent's branch |
| L4 | a nightly job that files an issue and pings the owner on failure; the L3 workflow reads the **last nightly run's conclusion** through the API (`actions: read` on the built-in token) and, while the nightly's `Sim` job or its Pitest job is red, fails any pull request whose `changes` outputs do **not** intersect the booleans that job's own status names — `Sim`'s `core`, `spec`, `prototype` (the whole-set `diff-oracle` runs through the prototype harness) and `sim`; Pitest's `core` and `engine` — the red-`main` rule's polarity: the fix touches the failing area and anything else waits (no nightly run yet, or no such job, reads as green until P1's first nightly; after it a last run older than 48 hours reads as red — failing every pull request until the nightly is dispatched on `main` (`workflow_dispatch`, which the agents' App may do), since no code change refreshes a run — because GitHub disables a public repository's scheduled workflows after 60 days without repository activity and the steady state's quarters are longer than that — Renovate's monthly batch is the usual keep-alive and a monthly scheduled `keepalive.yml` (hand-written, § T2.1) pushing a dated commit to its own branch with the built-in `GITHUB_TOKEN` — repository activity whether or not a bump exists that month, and no App key in Actions — the deterministic one, and a stale nightly fails the next pull request instead of passing silently; a pull request that intersects them — the fix's shape, which usually touches `:sim`'s harness too — merges) | a slow truth ignored |
| Goldens | `instruments approve <golden>` writes a sidecar `{golden, old sha (`-` for a golden recorded for the first time), new sha, clause id, branch, reason}`; the L3 check resolves the pull request from the branch, reads its **approving reviews through the GitHub API**, and fails a golden change unless an approving review by the owner's login has `commit_id` equal to the pull request's head and the sidecar's `new sha` matches the golden in that tree; the check is the owner-review workflow above, re-dispatched on review events, so an approval given after it ran turns it green. An approving review by the App satisfies neither the code-owner rule nor the owner-login check | a self-certified visual or rules change; an approval outrun by a later push |
| Contract clauses | the **contract-clause check**: a pull request whose diff changes the text or the status of a clause with `status: contract`, or promotes a clause to `contract`, needs the owner's approving review on the head commit, read as above; `proposed` clauses move freely, so the P2 fold is not throttled | a rule of the game changed without the owner |
| Rules changes | a pull request that bumps `RULES_VERSION` must name, in its clause, the golden cells it expects to change; the L3 check verifies that every other cell's hashes are unchanged and prints the first divergent line of each changed cell into the bundle | a bug frozen into a golden beside a legitimate change |
| Suppressions | Konsist budgets and expiry; the dated port exemption (`TECHNICAL.md` § T8.1) | an unexplained exception |
| The prototype | `prototype/**` is an owned path, and a **separate workflow, `.github/workflows/prototype.yml`, runs on every pull request with no path filter** (a required check whose workflow never triggers stays pending and blocks the pull request): the **prototype-freeze check** runs unconditionally, on a checkout with `fetch-depth: 0` so tags are present, as `git rev-parse -q --verify refs/tags/ts-oracle-v3 >/dev/null \|\| exit 0` followed by `git diff --quiet ts-oracle-v3 HEAD -- prototype/game/sim prototype/game/data prototype/game/types.ts prototype/game/screens/vault.ts` — genuinely vacuous, and green, until the tag exists at P2 (an unguarded `git diff` against a missing ref exits non-zero and would block every pull request) — and **`prototype-check`** is a job with `needs: changes` and `if: needs.changes.outputs.prototype == 'true'` — `\|\| needs.changes.outputs.spec == 'true'` from P2, since `--selfcheck` reaches `VAULT_RELICS`, which `prototype/sim/fixtures.mjs` then reads from `spec/fixtures/golden/vault/default.json` — and until the oracle retires (§ V8.3), when the owner drops the rule first and the job leaves the workflow after — the order for removing any required check, or every pull request waits on a check nobody posts — a skipped job satisfies a required check — running, inside `prototype/` on the Node of `.nvmrc` (the exact version pinned from P0): `npm ci`, `npx playwright install --with-deps chromium`, `npm run check`, `npm run build`, `npm run preview -- --strictPort &` then a `curl --retry 30 --retry-connrefused --retry-delay 2 http://localhost:4173/` loop (no undeclared package) and `SMOKE_URL=http://localhost:4173/ npm run smoke`, and `node sim/run.mjs --selfcheck --runs 20`; both required from P1, so the P1 and P2 changes to the prototype are merged under its own gates and the harness that records the goldens is proven runnable in CI; the allowed changes are `TECHNICAL.md` § T4.2's list, each in a named pull request | drift in the reference; a broken oracle harness |
| The spec | the binder and spec-lint; a `proposed` clause bound by passing tests must be promoted in the same pull request (the binder fails a pull request whose matrix has a bound `proposed` clause) | an unbound contract clause, an unknown id, an unpromoted proposal |
| The lanes themselves | the CI workflows are generated from `ci/lanes.yaml`; the **generated-workflows job** — an ordinary `pull_request` job of the merge workflow, head code, no secrets, a required check like any lane job — runs the head's generator and fails when the committed `kmp-*.yml` differ from what it generates (`prototype.yml`, `pages.yml`, `env-image.yml`, `record-goldens.yml`, `keepalive.yml` and the two owner-review workflows are hand-written and outside the diff); it cannot run under `pull_request_target`, since that would execute the head's generator with the privileged token, and it need not: its own defeat needs a change to `.github/**`, `ci/**` or `build-logic/**`, which are owned paths, so the owner's review on the head commit is the gate behind it | a tool silently disabled; a gate rewritten by the pull request it gates |
| The device runner | the self-hosted runner is registered in a **separate private repository** that the App is not installed on; that repository's nightly workflow runs on `schedule`, checks out `main` of this one, posts its results back as a commit status with a token it alone holds, and appends its `lanes.json` rows as comments to the standing `ledger` issue (`issues: write`, one issue, created at M7) — the ledger's third source; no workflow of this repository can name the runner | an agent's or a fork's pull request reaching the owner's machine |
| Infrastructure failures | an emulator or simulator that fails to boot, a runner evicted, a network error before any test body ran: re-run **once**, the re-run and its reason recorded as a comment on the pull request (or in the nightly's issue), which § V7's count reads — enforced, not trusted: every required job fails when `github.run_attempt` is above 1 and no comment on the pull request names the re-run, since the agents' App holds the `actions` permission that re-runs a check — a comment naming the required-check list's re-run (§ T13.5) or the `env-image` hand-back is the second logged class, outside § V7's infrastructure count; a second failure is real. A red required check can be overridden only by the owner editing the ruleset, and the edit is a logged comment on the pull request naming the check and the reason | a flaky test disguised as infrastructure; an unlogged override |

A pull request must carry: the clause ids it binds or changes; the review bundle link; for
a screen or asset change, the golden diff and its approval sidecar; for a rules or number
change, the balance snapshot diff, the expected golden cells and the arithmetic in the
clause. Writers, verifiers and critics are separate agents (`TECHNICAL.md` § T6.3). A
session's writers integrate into one pull request per track, so merges happen a few times
a day, not per writer, and with no up-to-date requirement an approved pull request stays
approved while others merge. The owner's review load, by phase, and the absence protocol are in the
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
| An edge target unreachable under gesture navigation | the Maestro edge-target flow (under question 5's farm branch: the owner's manual walk before each `v*` tag) | L4 |
| A performance regression on the JVM | the perf test (allocation-based; relative to the same-run baseline) | L2a |
| A performance regression on a phone; the tier drop not firing | the device benchmarks; the forced-slow-frame flow (under question 5's farm branch the tier drop is the owner's manual walk before each `v*` tag) | L4 |
| An allocation in the stage's own draw; a display-surface readback | the allocation-rate assertion; the detekt rule | L2a · L0 |
| Memory pressure on a phone | the peak-resident-set budget | L4 |
| An asset that fails the bible | the asset gate over `assets/actors/**` | L2b |
| An asset that passes the numbers and fails the eye | the critic under its protocol on the contact sheet and the frame; the owner; the stop rule | review |
| A third-party image used as a reference | `art generate` accepts only committed asset ids; the gate fails a manifest naming any other | L2b |
| The art tool's own metrics changed | `tools/art/**` owner-reviewed; the calibration golden over `assets/fallback/**` | L2b · L3 |
| The critic's model drifts | the model and version on every verdict; the calibration re-score on a change | review |
| A dependency-boundary violation | Gradle, Konsist, the `:core` no-deps assertion | L0 · L1 |
| A public API change nobody meant | the JVM ABI dump; the klib dumps | L1 · L3 |
| Complexity or size creep | the budgets (with the dated port exemption) | L0 · L2a |
| Dead code, unused dependencies | explicit API + warnings as errors; `buildHealth` | L0 · L3 |
| A test that tests nothing | the assertion rule; Pitest; the verifier's tests; weak clauses in the matrix | L1 · L4 |
| A flaky test | random order, no retries, the flake rule | L3 · L4 |
| A save that no longer replays after a rules change (under question 10's yes; a "no" builds no persistence and no corpus) | the `RULES_VERSION` rule; the save corpus (version N replays, N − 1 resumes from its snapshot) | L2a |
| App size creep | the size test | L3 |
| Audio silent on a platform | the emulator audio-plays assertion; the Maestro flow on the phones | L3 · L4 |
| A crash only on a device | the boot smoke; the nightly storyboard on emulator and simulator; Maestro flows; after release, Play Console's vitals and TestFlight's crash logs — both can report nothing, § T12 | L3 · L4 |
| A spec clause nobody tests | the binder | L1 · L2b |
| A golden changed to make a test pass | the approval check on the head commit and the clause-change rule; the expected-cells check on rules changes | L3 |
| A contract clause changed by a writer alone | the contract-clause check | L3 |
| The gates' own configuration changed by a writer | `CODEOWNERS` review by the owner; the App has no admin rights; a forged check run does not count, since the ruleset requires the checks from the gate App | L3 |
| The plan, the rubric or the hooks rewritten by a writer | `plan/**` (but the spike reports), `.claude/**` and `CLAUDE.md` are owned paths | L3 |
| A tool silently disabled | the generated-workflows job over the head's generator, behind the ownership of `.github/**`, `ci/**` and `build-logic/**` | L3 |
| The gate's own workflow rewritten by the pull request it gates | the owner-review checks run under `pull_request_target` from `main`; `.github/**` and `ci/**` are owned paths | L3 |
| A semantic conflict between two green pull requests (no up-to-date requirement) | the post-merge run of the merge lane on `main`; a red `main` fails unrelated pull requests | L3 (post-merge) |
| The environment's two forms drift | `gate.sh env-check` over the version manifests: a host form against the committed image manifest in L0 and in L3's bare-runner job; the rebuilt image against the committed manifest in the image workflow | L0 (on `ci/env/**` edits) · L3 · the image workflow |
| An edge target unreachable under gesture navigation, with the phone unavailable | not covered by the farm: the Maestro rows report SKIPPED, never green, until the phone is back | L4 |
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
phones). **The ledger** is the union of three sources — every bundle's `lanes.json`
uploaded as a CI artifact, the `agent-env` rows carried in pull request bodies, and the
device-runner repository's rows appended as comments to a standing `ledger` issue in this repository, which the owner creates at M7 — never the failure issue, which exists only on a red night (`TECHNICAL.md` § T13.5;
under question 5's farm branch, the farm's rows arrive through the nightly's own artifact
instead);
every row carries its machine class and its `started_at`. The nightly lane asserts each lane's p90 duration
over the last week's rows, per machine class, is inside its budget and files an issue
otherwise, naming the slowest task. Also tracked: flakes (target
zero; each one an issue), infrastructure re-runs (each one logged), coverage and mutation
trends (must not fall), spec coverage (100 % of contract clauses, none weak), time-to-green
per change (from the first L1 failure to a green L2, from the bundle's timestamps), the
owner's review queue (pull requests waiting on the owner and for how long), and the
review bundle's size (a bundle nobody can read in five minutes is too big). The owner reads
a one-page summary monthly while the programme runs and quarterly after P7, with each
session; the budgets are revisited then and only then.

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
   and is retired from the nightly, and `prototype-check` with it — the prototype workflow keeps the freeze check alone from then on, the harness's rot repair leaves § T4.2's allowed changes, and the Pages site keeps publishing `docs/**` through its `docs` job — the one that assembles and uploads the Pages artifact — for as long as the prototype build is green, and alone once that build is retired (§ T4.1); `prototype/` stays in the repository as history and as
   the demo for as long as the owner keeps it (README question 3).
4. **PvP**: `:core` is the oracle for a server that verifies results by replay.

## V9 Bootstrapping the rig (P1)

In order, each proven before the next, in **eight review milestones** — the owner's
review load for P1, marked M1–M8:

- **M1 — the environment.** The image, built at P0's spike 6 by a throwaway workflow with
  `packages: write` (the agents' App has no `packages` permission), and `setup.sh` running
  on `agent-env` and on the owner's Mac; the digest pin, `env-check` and the cold-start row
  come in M3, once `lanes.yaml` and `gate.sh` exist → an agent session opening a pull
  request with the App installed at P0.
- **M2 — the review mechanics.** The owner creates `CODEOWNERS` and *then* the
  **provisional ruleset** (a pull request required, approvals 0, a code-owner review
  required, stale approvals dismissed, no required checks yet) — in that order, since the
  ruleset's empty bypass list refuses the owner's own push the moment it exists; from here
  every step lands as a pull request — and **the first throwaway pull request**, which
  proves whether a code-owner review is enforced at zero required approvals — and if it is not, required approvals go to 1 until M4's owned-path check exists, then back to 0, so the M1–M3 window never rests on `CODEOWNERS` alone (§ V1).
- **M3 — the rig's skeleton.** The convention plugins and the empty modules with the edge
  assertions → the owner creates the **gate App** and the `gates` environment holding its
  key (§ V5) → `lanes.yaml`, `gate.sh`, the generated workflows (every one running on every
  pull request with its `changes` job and the generated-workflows job), the prototype
  workflow, `record-goldens.yml`, and the owner-review workflow with its review-event re-dispatch (§ V5;
  hand-written, not generated), and with them the image's digest pinned in `lanes.yaml`,
  `env-check` green on `agent-env`, the Mac and L3's bare-runner job, and the cold start in
  the ledger, and `.github/workflows/env-image.yml` building the image on each recipe pull
  request (the three recipe files, never the manifest) and handing back the manifest and digest to commit.
- **M4 — the gates.** The required checks added to the ruleset (every lane job and every
  `changes` job of the pull-request workflows, by their workflow-prefixed names, the
  generated-workflows job, the three owner-review checks from the gate App — the list `ci/required-checks.txt` the generator writes, which an L3 job checks against the branch's active rules from then on), the tag ruleset and the `release` environment with its `main`-and-`v*` deployment rule; Renovate installed → **the second
  throwaway pull request**, which proves the owned-path check failing on an owned path
  without the owner's review on the head commit, passing once the review is given without
  a new push, and unweakened by a head-branch edit to the check's own workflow.
- **M5 — the analysers and the binder.** Spotless and detekt with the budgets → the
  calibration golden's second reader — a JVM test in `tools/instruments/`, in L2b — written from § T10.4's definitions without reading
  `tools/art`, asserted equal to `spec/art/calibration.json` within § T10.4's tolerances — the calibration sheet's metrics alone, an S inside P1's L (`TECHNICAL.md` § T10.4) → Kotest on
  the JVM with one clause and the binder generating one table, **and the binder's own
  tests** (an unbound clause, an unknown id, a bound `proposed` clause in a pull request, a
  missing report each fail a fixture lane) → Konsist and the JVM ABI dump → the verifier's stub generator (`:tools:stub`, § T6.3), an S inside P1's L.
- **M6 — the hello-world stage.** `Frame`, `Layout` and `Stage` drawing one fallback
  sprite over one placeholder backdrop and one button → the headless `shot` → one screen
  semantics test with virtual time → one Roborazzi golden recorded through the `record-goldens` job
  and compared on macOS (the owner's Mac, or a hosted-macOS job) , where the step asserts
  SKIPPED-GOLDEN with the tolerance diff written into the bundle — never a green and never
  a hard failure, § V4 — and byte-exact in L3, both runs' CPU feature sets in the bundle, proven once two distinct sets have compared equal, otherwise the SIMD tier pinned in the image (§ V4) → the storyboard driver crossing one screen in both modes →
  the perf test with the allocation baseline.
- **M7 — the hooks and the platforms.** The hooks (edit, pre-commit, pre-push) → the
  Android, iOS and wasm compiles in L3 → the nightly skeleton and, if question 5 chose the runner, the private
  device-runner repository with the standing `ledger` issue in this repository that the owner creates for its rows (§ V7) — and, before question 5 closes, the Android phone reached over
  USB from the Linux VM on the owner's Mac by the real `adb`, and one instrumentation run (`adb install`, then `am instrument`) on
  it from the app and androidTest APKs L3 assembles and uploads from M7 on (P5's device lane reads the same artifacts), which the owner downloads by hand (`gh run download`; the token that automates it exists only once question 5 chooses the runner) — the guest assembles nothing, since it is
  arm64 and Google ships no build-tools for it (README D18) — (README question 5: the path
  is not a given, and the farm is the answer if the phone is not reached); the iPhone lane's
  development-only signing identity (§ T1) is created here too, under the host's separate
  user account, if question 5's runner branch is taken.
- **M8 — the budgets.** **The synthetic `:core`-sized module** (generated into `:core`
  itself under `spec/synthetic/` clauses from the prototype rules' measured function-size
  histogram: 5 000 lines, 300 tests including property tests; the module deleted and its clauses retired in P3's first
  `:core` commit) and **a synthetic storyboard** (a run of the hello-world screens long
  enough to measure the skip-playback and playback modes per act) that every budget is
  measured on.

P1 ends when every lane is green — for L3 the compiles on every target, the goldens, the
lints, the generated-workflows job, the owner-review checks, the prototype workflow,
`env-check`, the size test over the hello-world build, and the asset gate re-run over every actor `art accept` committed before M4 (§ V1), and the calibration golden's second reader green (`TECHNICAL.md` § T10.4); for L4 the nightly skeleton's
schedule, its issue on failure, the device runner's SKIPPED row (or the farm's, under question 5's other branch) and the ledger check; the
oracle's, the hash test's, Pitest's, the Monte Carlo's and the devices' content arrive with
P2–P5 — *and* every P1-measurable budget holds with the ledger to show it, and the owner
has accepted the re-derived sizes and calendar or stopped. If a
budget cannot be met there, the plan is wrong about the lane's contents and is fixed here,
not later.

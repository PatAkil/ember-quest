# Ember Quest, rebuilt on Kotlin Multiplatform — the plan

**Status: revision 5, under review (2026-09-12).** This folder is the plan for building
Ember Quest again, from scratch, as one Kotlin Multiplatform (KMP) codebase that ships
native Android and iOS apps, runs on the desktop JVM as the developers' and the agents'
fastest platform, and can later take the web back. The TypeScript + Canvas 2D web build is
treated as a **prototype that validated the mechanics**: it is frozen, it stays playable
as the live demo, its rules are the oracle the new rules are checked against, and nothing
else of it is migrated — the owner's decision of 2026-09-12, which this revision carries.
Nothing here is built yet. The plan has been reviewed by adversarial and blind reviewer
agents in three full rounds (112, 97 and 73 findings; round 3 returned one blocking finding
and 27 gaps, all resolved) and a fourth is in progress: its blind implementer's 21 findings
(two blocking, both mechanical) are resolved in this revision, and its other three
reviewers are running on this revision; `REVIEW.md` is the log of every round, and this
README will say so when a round closes with no blocking or gap finding. Until then, treat
it as a draft.

| File | What it holds |
|---|---|
| `README.md` (this file) | **what you are approving**: the decisions, the open questions, the cost, what the owner does, what stands still, the roadmap, the risks |
| `FUNCTIONAL.md` | **what the player gets**: the mechanics that move unchanged, what the new presentation decides, the defects the spec fixes, the AI-generated character and enemy art as the player sees it, the placeholders for the owner's character changes and for PvP |
| `TECHNICAL.md` | **how it is built**: platforms, identities and hosts, architecture, toolchain, the repository with the frozen prototype, the rules rebuilt against the oracle, TDD, executable specifications, static analysis, rendering and performance, the AI image pipeline, persistence, release engineering, the agent workflow, the phase sequence |
| `VERIFICATION.md` | **the loop**: the verification lanes and their budgets, the instruments that let agents see and measure their work, determinism and time control, the gates and how they are enforced, the failure classes and which gate catches each |
| `REVIEW.md` | the review rounds: every finding, its severity, what changed |

The functional and the technical are deliberately separate documents. A functional change
(a character, a mode, an art direction) is the owner's decision and is written as a change
to the specification; a technical change is the team's and is written against the
verification loop. The rebuild carries **no change to the mechanics** (principle 3): the
rules are rebuilt exactly and proven against the oracle before anything is allowed to
differ, while the presentation is designed for phones from the start. PvP is the one
functional item that will reopen the technical plan (a server, accounts, a network
module); `TECHNICAL.md` § T16 is the empty seat it will take.

## What you are approving

1. **A restart on one KMP codebase**: Android (Android 10+) and iOS (16+) as products, the
   desktop JVM for development and agents, the web as a stretch (D1–D3). The prototype
   moves under `prototype/`, frozen, and keeps serving the live URL as the demo (D2, D19).
2. **Why not keep TypeScript.** The alternatives were weighed when the restart was decided
   (D1): a WebView shell around the prototype would reach the store tracks in about 2–4
   sessions and keep everything, but adds no rig and no native surface; React Native with
   Skia would keep the rules verbatim in about 8–14 sessions with the loop on Linux;
   Flutter with Flame fits a 2D game but adds a third language; native twice doubles the
   only reviewer's load; Lynx has no confirmed canvas. Kotlin was chosen as the language
   the owner reviews in, for the richest static-analysis and architecture-rule set, for a
   JVM core a PvP server can run unchanged, and for Google's and JetBrains' backing of
   Compose. The price of that choice is the rules rebuild and the rig, costed below.
3. **The mechanics are the baseline; the presentation is new.** The prototype's rules are
   the oracle and are rebuilt bit for bit; the screens, the stage and the art are designed
   for a phone, taking from the prototype only its measured laws; every later change is
   specified, tested and gated on its own (principles 2–3, `FUNCTIONAL.md` § F1).
4. **The rig before the rules.** Lanes with budgets measured on a module the size of the
   rules, executable specifications bound to tests, the analyser set, and an enforcement
   model built on a GitHub App for the agents, the owner as the only reviewer, a ruleset,
   a tag ruleset, a release environment and a device runner the agents cannot reach — all
   before the rules move (principle 4, `VERIFICATION.md`, D15–D18).
5. **AI-generated character and enemy art** through a measured gate built at P0 as one
   TypeScript tool, the cast built in P4 in parallel with the rules, the owner deciding the
   look at the end of the bake-off, an explicit stop rule, honest limits (the gate is a
   floor, not the bar) and a stated copyright position (D9, D10, `FUNCTIONAL.md` § F3).
6. **What it costs and what stands still** (below): 16–32 autonomous sessions to the
   stores' test tracks; the demo stands still with its known defects. **Approving the plan
   approves P0's spend**: the bake-off (≈ $250 including a month's subscription), the two
   developer accounts (≈ $124), and reference handsets if the owner does not own them.
7. **Nine open questions** that are the owner's to answer, listed at the end, each with the
   phase it closes in and the price of each branch.

## Where we start from

- **One prototype**: about 45 000 lines of TypeScript and JavaScript (rules core 4 900 ·
  engine 5 700 · screens 7 400 · art 21 900 · tools and harness 3 700 · the rest `main.ts`
  and the shell) plus about 4 900 lines of contract and review logs. A headless,
  deterministic rules core with injected randomness; a per-game fork of the Retrovibe engine
  (loop, input with hit regions, bitmap fonts, palettes, particles, juice, a synthesized
  sound set, the HD-2D light rig, CRT); ten screens over a resumable run "seam"; a
  procedural art kit that bakes 43 actors, six painted biomes and thirteen VFX archetypes.
- **What it validated**: the mechanics. A systems contract, `DESIGN.md` (1 700 lines), that
  the code follows and the simulator measures against; a balance state within 2.5 points
  of every act target on four seeds, which two reviewers reproduced exactly. `STATUS.md`
  lists six places where the contract and the code are known to disagree; the spec
  reconciles them at P2.
- **Verification as practised**: `tsc` after every edit; a build and a Playwright boot gate
  before every commit; a Monte Carlo harness with nine policies, a three-way self-check of
  the seam, `--dump` hashes over whole run results, `validateData()`; a capture tool that
  shoots line-ups, pose sheets, battle frames and a scripted run on desktop and phone
  viewports, and measures the sheets against the art ship criteria in CIE L*. There is no
  unit-test framework, no test per rule, no static analysis beyond the compiler, the
  captures are not byte-deterministic, and the scripted run dies at the act-2 boss by
  design, so no act 3–6 battle has ever been driven on screen.
- **Four known defects** in the prototype's screens, found by the reviews: a hero's option
  picked from a list enumerated *before* the turn's cooldown tick while the rules
  re-enumerate after it (a wrong action on about one hero turn in six), a skill greyed out
  that is legal by the time the turn resolves, a crash on the four-piece VIOLENT set's
  extra turn, and the Vault's ascension floor enforced by a screen rather than the rules.
  The rules core and the simulator never take those paths; the spec states the correct
  behaviour and the prototype keeps its defects (`FUNCTIONAL.md` § F1.4).
- **Deployment**: a push to `main` deploys to GitHub Pages; "the phone" is that page in a
  browser, verified only on a Playwright viewport. **Nobody has played it** on any device.
- **The art is not at the owner's bar** (Octopath Traveler's HD-2D). Fourteen critic rounds
  passed every numeric ship criterion at 9/10 and still read "off"; a hand-drawn pixel
  study showed the procedural kit is the ceiling. The owner's decision of 2026-09-06
  (hand-drawn heroes and bosses, "option B") is what this plan proposes to replace with
  AI-generated sprites — question 6 asks the owner to confirm that, and option B stays the
  named fallback. The prototype's sprites and sounds are captured once as the fallback
  cast and the placeholders.
- **The team**: one owner who reviews, plus agents. The three-day v3 build of the prototype
  was one overnight session of fifteen hours after a design session two days earlier.

## Where we are going

One Gradle project at the repository root (a zero-dependency `:core` with the rules; a
`:ui` of Compose Multiplatform screens over a Skia-drawn stage; thin Android, iOS and
desktop shells; a `:sim` harness; JVM instruments; one TypeScript art tool), a `spec/`
folder of executable specifications that the build binds to tests, and the prototype
under `prototype/`, frozen. Android and iOS are the products; desktop JVM is where agents
get seconds-long feedback and pixel-exact frames; web (Kotlin/Wasm) is a stretch target
that takes the Pages URL from the prototype once it passes the same gates.

## Principles (the non-negotiables)

1. **The rules stay headless and deterministic.** `:core` has no dependencies — not the
   platform, not Compose, not a coroutines library, not a logger — and the build asserts
   it. Every draw goes through the injected rng; the same seed, code and decisions give the
   same result on every runtime the product ships on, checked on the JVM, on ART (x86-64 in
   the merge lane, arm64 on a real phone nightly) and on the iOS simulator.
2. **The oracle comes first.** The prototype's harness at a frozen tag is the reference
   until parity is proven: same seeds, same policies, byte-identical canonical traces. No
   rule is "rebuilt from memory".
3. **The mechanics are the baseline; the presentation is new.** The rebuild carries no
   change to a rule. The owner's character changes, PvP and every rule-touching addition
   land as specified changes *after* the rules gate. The screens and the stage are designed
   for phones and accepted by the owner on a device against a written baseline.
4. **The rig before the rules.** The verification rig — lanes, budgets, instruments, static
   analysis, spec binding, identities — is built and its budgets are measured on a
   synthetic module the size of `:core`, not on a hello-world, before any rules code moves.
5. **TDD, with the spec as the source of tests.** A change starts with a failing test named
   after a specification clause. An independent verifier agent writes tests from the clause
   without seeing the writer's code; a disagreement is a spec ambiguity or a bug, and both
   are fixed at the spec. For the rules the clause tests and the oracle traces are written
   before each module.
6. **Every gate is fast, or it is not a gate.** Each lane has a time budget on a named
   machine class, the budget is measured on every run, and a check that outgrows its lane
   moves to a slower lane — it is never trimmed or skipped, and the move is a recorded
   decision, not a drift.
7. **Art is measured first, then judged by eyes — and the numbers are a floor, not the
   bar.** The same instruments that scored the kit 9/10 will pass generated images that
   still read wrong; the critic, under a repeatable protocol, and the owner decide, and the
   plan has a stop rule.
8. **The owner is the playtester and decides the functional forks.** Agents report "builds,
   boots clean, gates green, frames attached", never "playtested".
9. **Simple and easy to change is enforced, not hoped for.** Complexity, size, dependency
   direction and public API surface are budgets checked by tools, with suppressions that
   carry a reason and an expiry — and one dated exemption, the oracle transcriptions in
   `:core` until the rules gate.
10. **Enforcement is by machines where a machine can do it, and the plan says where it
    cannot.** Two identities, rulesets, a release environment, required checks and code
    ownership; what is left to discipline (the edit hook, the git hooks, the critic) is
    audited by the next machine gate.

## Decision register

Each decision names the alternatives it beat and whether the owner must sign it off.
"Reversible" is the cost of changing it later. Detail lives in `TECHNICAL.md`.

| # | Decision | Chosen | Alternatives | Why | Reversible | Owner |
|---|---|---|---|---|---|---|
| D1 | Stack | Kotlin Multiplatform with Compose Multiplatform for every screen; the battle stage on a Compose `Canvas` through Skia (§ T2) | keep TypeScript in a WebView shell (≈ 2–4 sessions); React Native + Skia via Expo (≈ 8–14 sessions, the rules kept verbatim); Flutter + Flame; native Swift and Kotlin; Lynx | the language the owner reviews in; the richest analysis and architecture-rule set; a JVM core for PvP; Google- and JetBrains-backed; stable on the three products' platforms; first-class test APIs, screenshot testing, hot reload with an MCP server for agents | `:core` and `spec/` are framework-free; the alternatives stay costed here | **yes** (decided 2026-09-12, recorded here) |
| D2 | Repository | This repository: the new game at the root from the first commit, the prototype under `prototype/` with history, frozen and code-owned; the rules frozen as the oracle at tag `ts-oracle-v3` with a freeze check from P2 (§ T4) | a new repository for the game (the oracle by submodule, a second Pages site); an organization transfer | the oracle and the demo stay next to the game with no promotion phase; a transfer would move the Pages URL | one afternoon | **yes** (question 8) |
| D3 | Platforms | Android **minSdk 29** (Android 10) and iOS 16.0+ as products; desktop JVM for agents; web as a stretch (§ T1) | minSdk 26; web first | Compose's `ColorDodge` and `Multiply` blend modes (the stage's gain and grade) fall back to source-over below API 29; Android 10 covers the phones the product targets | one phase | **yes** (market reach; the web) |
| D4 | Rules method | Test-first from the clauses, with the oracle's canonical traces over a coverage matrix as the acceptance test; arithmetic transcribed in the prototype's evaluation order (§ T5) | a rewrite checked only statistically against the balance table | the oracle is exact and free, and the mechanics are the one thing the prototype validated | n/a | no |
| D5 | The seam | `RunSession` on the standard library's coroutine intrinsics; **hero turns are decisions** raised at step 7 of the turn; enemy turns stepped one at a time; forfeit a decision (§ T2.3) | a hand-written state machine; kotlinx.coroutines | reproduces the generator; a uniform decision log; the self-check paths the prototype's harness actually compares | one phase | no |
| D6 | Saves and replays | A run is `(RULES_VERSION, seed, RunConfig, decision log)` plus a snapshot of the whole run context after every decision; replay when versions match, resume from the snapshot when they differ (§ T11) — **contingent on `FUNCTIONAL.md` § F2.1's yes**, else state only | state only; abandon runs on a version change | replay is exact and cheap and is the bug report and the PvP message; the snapshot keeps a permadeath run alive across a store update | one phase | no (F2.1 is the owner's row) |
| D7 | Executable specifications | `spec/` clauses with stable ids, bound to Kotest tests by id; a binder that generates test data and fails the lane on unbound or unknown ids; promotion pull-request-scoped; a contract clause changes only with the owner's review; goldens as frozen specs; the contract reconciled with the code before the fold (§ T7) | Cucumber; prose only | one test framework; traceability the build enforces; the owner owns the rules of the game mechanically | one phase | no |
| D8 | Static analysis set | Compiler strictness, detekt, ktlint via Spotless, Konsist, KGP ABI validation, Kover, Android Lint, Compose rules, dependency-analysis, Pitest nightly, workflow/shell/markdown/spec linters; strict TypeScript, typescript-eslint and knip on the art tool; `:core`'s oracle transcriptions exempt from the complexity budgets until the rules gate (§ T8) | fewer tools | the brief; each tool has a distinct catch | one phase | no |
| D9 | Art pipeline | AI-generated sprites through one provider-agnostic TypeScript tool with a numeric gate (the prototype's criteria plus the review's motion and in-scene rulers, built at P0) and an agent critic under a repeatable protocol; the cast built in P4 beside the rules; assets committed with provenance under the owner's review; a continuity plan; the copyright position stated (§ T10, `FUNCTIONAL.md` § F3.6) | hand-drawn (option B); keep the prototype's kit | the brief; the kit is the measured ceiling | **not cheaply** after the cast is made; option B stays the fallback | **yes** (question 6) |
| D10 | Art look | Pixel sprites at the contract's cell under the stage's light laws, painted portraits; the fork closes at P0's exit on lit phone frames from the prototype's stage (§ F3.2) | painted characters | the laws, the criteria and the bar are built for pixel figures; a painted look is judged on a reduced gate so the fork is real | one phase | **yes** (question 1) |
| D11 | Bloom and CRT | Bright-layer bloom at quarter resolution on the CPU; halation from the same buffer; decided at P5 on the real stage against a platform-blur fallback (§ T9.4) | frame-derived bloom via platform blur | determinism, one code path | one phase | no |
| D12 | Audio | The 24 effects rendered once at P0 from the prototype's own synthesizer to WAV, with seeded variants; pitch by resampling (§ T9.8) | port the synthesizer; runtime synthesis per platform | identical sound everywhere; nothing to port | one phase | no |
| D13 | Test framework | Kotest 6 with property testing (§ T3) | kotlin.test; JUnit 5 | one DSL for `:core` and `:ui`; tags for lanes | one phase | no |
| D14 | Build | Gradle with version catalogs, configuration cache, build cache; Amper not adopted (§ T3) | Amper | lowest risk for the analyser set | one phase | no |
| D15 | Branch model and releases | `main` protected by a **ruleset** — a pull request required, required approvals 0 with a code-owner review on owned paths, stale approvals dismissed on push, required checks with always-run shim jobs, branches up to date, linear history, an empty bypass list; a **tag ruleset** on `v*` and `ts-oracle-*`; the signing secrets only in a **`release` environment** the owner approves; **no merge queue** (unavailable on a user-owned repository) (§ T4.1, § V5) | a long-lived branch; an organization transfer for a queue | protection is per branch, so it covers the frozen prototype too; a transfer would move the live URL | one phase | **yes** (question 7) |
| D16 | Backdrops | Flat, unlit composites of the prototype's painters captured once at the padded plane size as placeholders, drawn as one plane and lit at boot by the rig from the biome's light data; the scene phase makes four planes per biome as data-driven painters or AI-generated planes (§ T9.2, § T10.9) | port the prototype's painters; no placeholders | the stage exists from P5 with nothing to bake; the scene is designed for the new cast, not inherited | one phase | no |
| D17 | Identities and approvals | Agents commit, push and open pull requests as a **GitHub App** the owner installs (contents, pull requests, workflows; short-lived tokens); the owner is the only code owner and the only reviewer; **the owner never authors a change on an owned path**; goldens, gate configuration, workflows, the spec's art, goldens and balance, the assets, the prototype and every contract clause need the owner's review on the head commit, verified through GitHub's review data (§ T1, § V5) | a machine user with a fine-grained token (does not work on a user-owned repository); one identity; a reviewing agent identity | GitHub never counts an author's own review; an agent-identity approval is the coordinator approving itself | — | **yes** (question 7) |
| D18 | Where the device lane runs | A self-hosted runner on the owner's machine with the two reference phones, registered in a **separate private repository** the App cannot see, running nightly on a schedule; a device farm (Firebase Test Lab) as the fallback and as the arm64 truth when the phone is offline; emulator and simulator lanes on hosted runners (§ T1) | hosted runners only; a farm only; the runner in this repository (reachable by an agent's pull request) | real hardware is the only truth for frame budgets, memory and arm64 arithmetic; the runner must be out of the agents' reach | one phase | **yes** (question 5) |
| D19 | The prototype's role | Frozen at P0: the oracle for the rules, the live demo, the source of the spec, and — captured once — the fallback cast, the flat backdrops, the sounds and the glyph tables; nothing else moves; its defects stay (§ T4) | migrate the engine and screens incrementally (the plan's revisions 1–3); delete it | the mechanics are what it validated; a port of its presentation would carry a look the owner does not want and machinery the restart does not need | it is history either way | **yes** (decided 2026-09-12) |
| D20 | Presentation direction | The stage's measured laws (dark figures on a lit ground, four planes with the middle one sharp, two derived foot pools, a gain not a wash, the tier ladder) kept as the art direction; every screen designed fresh for a phone against a written baseline (§ T2.5, `FUNCTIONAL.md` § F1.2) | an open art direction | the bar has not changed and the laws were paid for; the screens had never been on a phone | the laws are data | **yes** (with question 1) |

## What this costs and what stands still

**Effort.** One *session* is an autonomous overnight run of about **12–16 hours** by a
coordinator with two to six parallel writers, verifiers and critics — the unit `STATUS.md`
records. Calibration, from the git history: the prototype's v3 (the contract, the rules,
ten screens, six biomes, fourteen art rounds, the scene and UI rounds, the balance)
landed in one such session of fifteen hours (49 commits, 2026-09-05 21:54 → 09-06 13:04
UTC) after a two-commit design session two days earlier. The aggregate below is a
**per-phase sum**, not a multiple of that: sizes S ≤ 1, M 1–2, L 2–4, XL 4–8; P0 L, P1 M,
P2 L, P3 L, P4 L (in parallel), P5 XL, P6 L, P7 M — **16–32 sessions**, about 24 at the
midpoints; without the scene phase 14–28; the web stretch adds 1–2. The critical path
P0 → P1 → P2 → P3 → P5 → P7 is 12–24 of them. At three sessions a week that is five to
eleven weeks; the closed test's fourteen days run inside P5–P7. The sizes are re-estimated
three times: after P0's spikes, after P1 measures the lanes on a `:core`-sized module, and
after P2 counts the clauses.

**Money (to be confirmed at P0).**

| Item | One-off | Recurring |
|---|---|---|
| Agent compute | — | covered by the owner's subscription plan, whose limits bound the cadence (this review's own sessions hit them); a session of this size at API list prices would be an order of magnitude above a single agent run — measured on one real session after P1 and recorded here, not guessed |
| Apple Developer Program | — | ≈ $99 / year |
| Google Play developer account | ≈ $25 | a personal account created after November 2023 must run a closed test with ≥ 12 opted-in testers for 14 continuous days per app before production access, and the count may not dip — the owner recruits and holds **fifteen to twenty** people (lead time about a month); the test starts on the first P5 build that passes the merge lane |
| Image generation | the bake-off ≈ $250 including one month of the subscription provider (the protocol and the arithmetic in `TECHNICAL.md` § T10.7); the cast ≈ $700 base, $1 500–2 500 expected, a **$4 000 ceiling the tool enforces on per-image API spend**; subscriptions and any GPU time are a separate budget the owner approves by name | ≈ $20–60 per later character at the per-image price including re-rolls and a portrait; ≈ $1 500–2 500 to regenerate the cast if the provider or its model is retired |
| Reference handsets | ≈ $400–900 if not already owned (a 2022 mid-range Android, an iPhone 12 class) | — |
| CI | none on a public repository's hosted runners; macOS minutes cost more on a private one | Firebase Test Lab beyond its free daily quota (five physical-device runs a day) if the self-hosted runner is not used; a self-hosted agent pool ≈ $50–150 / month only if question 9 chooses it |
| The owner's review | — | by phase, below |

**What the owner does, by phase.** Everything below is the owner's and nobody else's.

| When | The owner |
|---|---|
| P0 | answers questions 1, 2, 6, 7 and 8; opens the two developer accounts; starts recruiting fifteen to twenty testers; plays the prototype on a phone and writes `plan/BASELINE.md`; creates the GitHub App and stores its key as the agents' secret; sets the provider keys and the bake-off budget; reviews the one commit that moves the prototype; decides the look on lit phone frames at the bake-off's end (one sitting) |
| P1 | answers questions 5 and 9; lends a Mac for one golden comparison and, if chosen, hosts the runner; reviews about five to ten pull requests on the rig's owned paths |
| P2 | creates the tag `ts-oracle-v3` (only the owner can, under the tag ruleset) and adds the two prototype checks to the ruleset's required checks; reviews the golden set's commits (two or three pull requests); no clause reviews — the fold writes proposals |
| P3 | reviews the contract promotions, one pull request per rules module (six to eight) |
| P4 | says yes or no to 43 contact sheets on a phone, in the order of `FUNCTIONAL.md` § F3.5 (a few minutes each, batched per pack into about ten pull requests), and takes the two stop decisions |
| P5 | reviews the goldens, batched into one pull request per session (four to eight); walks the felt rows on a device; sets up the store listings, the privacy-policy page, the data-safety form and the content rating; answers question 4 |
| P6 | reviews the six biomes' sheets (about six pull requests) |
| P7 | runs the first-ten-minutes test on release builds; cuts the tag; applies for production access; answers question 3 |
| Monthly | reads the one-page summary; reviews the dependency batch |
| Always | keeps the runner machine on, if chosen |

**When the owner is away.** Agents continue on stacked branches; nothing that needs the
owner's review merges (goldens, art, contract clauses, gate paths); the nightly keeps
running on `main`; the device lane reports SKIPPED; the review queue is the first item on
return. An absence costs calendar, never rework. Overnight sessions therefore leave such
pull requests for the morning, and the plan's cadence assumes the owner reviews on most
days during P4–P6.

**What stands still.** The prototype is frozen at P0 with its four known defects and its
art; the live URL keeps serving it as the demo until question 3 is answered; nothing of it
is maintained. Until the first P5 build, the only thing anyone can play is that demo.

## Roadmap

Phases end with **gates**, not dates. Entry, deliverables and exit criteria per phase are
in `TECHNICAL.md` § T14, which this table summarises.

| Phase | Delivers | Gate | Size |
|---|---|---|---|
| P0 Decide, spike, freeze, bake-off | The owner's answers to questions 1, 2, 6, 7 and 8; the accounts and the tester recruitment started; **the owner plays the prototype on a phone and writes the baseline**; the prototype moved under `prototype/` and frozen, the demo still deploying; the fallback cast, the flat backdrops, the sounds and the glyph tables captured once; the art tool built in TypeScript with the full metric set and calibrated; seven spikes (headless JVM capture; the coroutine seam with hero-turn pendings and the three self-check paths; Pitest; detekt; Kotest 6 on the iOS simulator, an x86-64 Android emulator and wasm; the agents' environment and the GitHub App; the sprite bake-off on six actors, both looks, both animation options, through the calibrated gate, shown in lit phone frames) | Spike reports with frames and numbers; the look fork closed; the decisions recorded in the register; the sizes re-estimated | L |
| P1 The rig | The environment recipe proven on the agents' machine; the App, the ruleset, `CODEOWNERS`, the tag ruleset, the release environment, the prototype's own workflow (the freeze check and its gates), the private runner repository; every module wired; every lane with its budget measured on a synthetic `:core`-sized module and a synthetic storyboard; the analyser set; the spec binder; hooks and skills including the `kmp-quality` rubric | Every lane green and inside budget on the synthetic module, timings in the ledger | M |
| P2 The spec and the oracle | The prototype's harness gains `--trace`, `--ascension`, `--path`, a canonical `--dump`, the strong-party and stall fixtures and the coverage report; the Node pin; tag `ts-oracle-v3`; the freeze check; the golden set recorded under the cell table with a coverage report; the contract reconciled with the code, then folded into `spec/` clauses; the clause count and the re-estimate | Spec-lint clean; every clause has an id, an owner and a status; goldens frozen; every event, status, set, sigil, pending kind, room type and ascension row appears in the golden set | L |
| P3 The rules | `:core` test-first, module by module; the `:sim` harness | Traces identical to the oracle on the golden set; the balance tables reproduced; the hash test green on the JVM, an x86-64 Android emulator and the iOS simulator, and once on an arm64 phone or a farm device; spec matrix 100 % for the rules areas with no weak clause; coverage and mutation at threshold | L |
| P4 The cast (parallel with P2–P3) | The pipeline at full strength; the cast generated in `FUNCTIONAL.md` § F3.5's order with the stop decision after the six heroes, judged on the prototype's stage; portraits | Every actor passes the gate; the six heroes meet the value targets; the full-frame critic's sprite axis ≥ 8 under the protocol; the owner accepts on a phone | L |
| P5 The stage and the screens | The frame, the stage over the flat backdrops with the light data, VFX, pops, audio, tiers and ARCADE, the bloom decision; every run screen as Compose UI over the seam, designed for the phone; fixtures, semantics tests, goldens; the storyboard driver; the Android and iOS shells; the store set-up and the signed build pipeline; the closed test started | The storyboard **reaches** every biome, every boss and every screen with the strong party and forcing hooks, and plays a two-act run to a KO, on the JVM; two acts on Android and iOS; every fixture has a golden; the desktop and reference-phone budgets met; the felt rows signed by the owner on a device | XL |
| P6 The scene | The six biomes' planes as data-driven painters or AI-generated planes; the light wells, hues and composition items of `STATUS.md`'s round-5 brief; the placeholders retired | The full-frame critic ≥ 8 on every axis; the owner accepts on a phone | L |
| P7 Ship | The approved `FUNCTIONAL.md` § F2 rows; credits and disclosure; the release-safe replay export; the production-access application | Installed from both test tracks; the first-ten-minutes test passes on the owner's phones; production access granted | M |
| P8 Web (stretch) | The wasmJs target through the same gates; Pages switches from the prototype when it passes | The P5 gates on the Wasm build | M |
| Then | The owner's character changes (built after P3, before or after P7 as the owner decides), then PvP (`FUNCTIONAL.md` § F4, § F5) | Their own gates | — |

**Parallel:** P4 (the cast) runs beside P2 → P3 from P0's exit; P5 needs P3 and, for its
felt rows, P4's heroes; P6 needs P5. Whether P7 waits for P6 is question 4.

## Risks (top ten)

| Risk | Mitigation | Tripwire |
|---|---|---|
| The rules drift from the oracle in a way the traces miss | Traces cover every draw, pending, hero turn, event and result field over a coverage matrix with a stall and an enrage fixture; a coverage report proves every kind appears | Any trace diff blocks P3's gate |
| Numbers differ across runtimes (libm, text formatting, integer overflow, contraction) | Expressions transcribed in the prototype's order; `pow` from an oracle-generated table; doubles traced as raw bits; round-half-up explicit; Node pinned; the hash test on the JVM, x86-64 ART and the iOS simulator in the merge lane, an arm64 phone nightly | A hash mismatch on any product runtime |
| The identity or the environment does not work on the owner's platform | P0 spike (6) proves the App token and the setup script from an agent session; a classic-token machine user and a self-hosted agent pool are the named, costed fallbacks | The spike report; a cold start over 6 min |
| The presentation is designed without a reference and misses the prototype's feel | The owner's written baseline; the `kmp-quality` rubric; the felt rows at P5; the stage's laws carried as data | A felt row the owner cannot sign |
| The stage cannot hold 60 Hz on a mid-range phone | Everything blurred is baked; per-frame work is blits; the CPU bloom is quarter-res; tiers; a device lane on real phones | Frame-time p95 > 12 ms at MED on the reference phone |
| Generated art passes the numbers and fails the eye (the kit's own history) | The gate is a floor; the critic under a protocol and the owner judge lit phone frames; a stop rule with named branches; the fallback cast exists from P0 | The owner's "no" at the bake-off or after the six heroes |
| AI art cannot hold consistency across 15 frames | A posable-skeleton or reference-conditioned provider; the finalists animated in full at the bake-off; consistency criteria after alignment; one provider for the cast | Gate rejection above 60 % after the bake-off tuning |
| The provider or its model is retired, or the output's copyright position matters later | Accepted assets, prompts and references archived; the accepted cast conditions later actors; a new provider means a whole-cast re-gate, priced; the copyright position stated up front with its options | A provider notice; a new actor failing consistency against the cast |
| The rig is red on the first honest `:core` commit (budgets sized on a toy) | Budgets measured on a synthetic `:core`-sized module and a synthetic storyboard at P1; `:core`'s transcriptions exempt until the gate; type-resolved detekt, the klib ABI check and full Konsist out of the fast lanes | A lane over budget in the ledger for a week |
| The team is one owner plus agents | The spec and the tests are the memory; every decision is in this register or the spec; the App, the rulesets and `CODEOWNERS` keep the gates, the art and the contract out of the agents' hands; the owner's load and absence protocol are stated | A change without a spec id or a test |

## Open questions for the owner

Each is a real fork; the plan recommends but does not choose. The phase each closes in and
the price of each branch are stated so nothing waits on a question nobody knew was due.

1. **The look (D10)** — closes at P0's exit. Pixel sprites at the contract's cell under the
   stage's light (recommended), or painted characters under the same light, judged on a
   reduced gate? Decided on the bake-off's lit phone frames (`FUNCTIONAL.md` § F3.2).
   Painted means re-deriving the value criteria at P4 (about one extra session) and a bar
   the owner has not named.
2. **Orientation** — closes at P0's start, before the art tool's in-scene rulers are
   calibrated. Landscape (recommended: the stage's laws and every measured number are
   16:9), or portrait? Portrait is a different stage composition and a different ruler for
   every screen: about 2–4 extra sessions in P5, and the in-scene criteria re-derived.
3. **The demo (D2, D19)** — closes at P7. Keep the Pages URL serving the frozen prototype
   until the Wasm build passes the same gates (recommended, free), retire it when the app
   ships, or drop it at P0? Dropping the web saves the wasm compile in every merge lane
   (about a minute) and nothing else.
4. **Ship before or after the scene phase** — closes at P5's end. Ship over the flat
   placeholder backdrops after P5 and run P6 after (recommended: a playable app 2–4
   sessions sooner), or hold P7 until P6 reaches 8 on every axis?
5. **The device lane (D18)** — closes at P1. A self-hosted runner on the owner's machine in
   a private repository (recommended) — and is that machine a Mac, which the iPhone lane
   needs — or the farm only (free within five physical runs a day; iOS devices included)?
6. **Option B reversed (D9)** — closes at P0. Confirm that AI-generated sprites replace the
   2026-09-06 decision to hand-draw the heroes and bosses; hand-drawing stays the named
   fallback under the stop rule, and the fallback cast exists either way.
7. **The release path and the identities (D15, D17)** — closes at P0, because P1 builds it.
   Confirm the GitHub App for the agents, the ruleset with the owner as the only reviewer,
   and the rule that the owner never authors a change on an owned path. A "no" means a
   long-lived protected `kmp` branch with the same rules and `main` left to the prototype:
   about one extra session and a weaker gate on the prototype's freeze.
8. **The repository (D2)** — closes at P0. The prototype under `prototype/` in this
   repository (recommended: the oracle and the demo stay beside the game), or a new
   repository for the game with the prototype left where it is (the oracle by submodule, a
   second Pages site, about half a session of extra plumbing)?
9. **The agents' environment** — closes at P1, after P0's spike. If the session-start
   script's cold start is over six minutes on the cloud environment: accept it (every
   session starts slower, nothing else changes), or fund a self-hosted agent pool that runs
   the image (≈ $50–150 a month) and gets byte-exact goldens in the fast lanes too?

Store identity — free, no accounts, no analytics, no crash reporting — is the plan's
assumption until PvP; it is not a question unless the owner wants otherwise.

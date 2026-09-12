# Ember Quest, rebuilt on Kotlin Multiplatform — the plan

**Status: revision 10, under review (2026-09-12).** This folder is the plan for building
Ember Quest again, from scratch, as one Kotlin Multiplatform (KMP) codebase that ships
native Android and iOS apps, runs on the desktop JVM as the developers' and the agents'
fastest platform, and can later take the web back. The TypeScript + Canvas 2D web build is
treated as a **prototype that validated the mechanics**: it is frozen, it stays playable
as the live demo, its rules are the oracle the new rules are checked against, its sprite
sheets, flat backdrops, sounds, glyph tables and hand-drawn study are captured once as the
fallback art and the placeholders, and nothing else of it is migrated — the owner's
decision of 2026-09-12, which this revision carries.
Nothing here is built yet. The plan has been reviewed by adversarial and blind reviewer
agents in eight rounds (112, 97, 73, 71, 54, 59, 69 and 62 findings; every blocking, gap
and numbers finding of each round was resolved in the next revision, every minor one
applied or listed in `REVIEW.md` with the reason it was declined); this is revision 10,
after round 8, whose two blocking findings were residue of the previous revision's own
fixes — the in-scene ruler still gating the painted look at the bake-off, and a
generated-workflows job that would have had to run the pull request's own generator
under the privileged trigger.
`REVIEW.md` is the log of every round. The loop's own bar is a round that returns zero
blocking and zero gap findings — minor findings are treated as residual — and the owner may
hold it to the brief's stricter "no more findings"; this README will say when a round
closes clean. Until then, treat it as a draft.

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
   Two cautions make the comparison fair: the alternatives' figures are migration-only,
   while the brief's technical half — the rig, the executable spec, the analysers, the art
   programme — would be spent under any option (about 8–16 of the 19–38 sessions, P0, P1
   and P4), so the real delta of Kotlin is the rules rebuild and the fresh presentation,
   P2, P3 and P5; and the strongest alternative is not a WebView shell but *keeping
   TypeScript and building the brief's rig there* (≈ 10–16 sessions), which delivers TDD,
   the executable spec, the analysers, the loop and the AI cast on the prototype's code,
   reaches the stores only through a WebView shell, keeps the presentation the owner
   rejected, and leaves the JVM core PvP would reuse unbuilt.
3. **The mechanics are the baseline; the presentation is new.** The prototype's rules are
   the oracle and are rebuilt bit for bit; the screens, the stage and the art are designed
   for a phone, taking from the prototype only its measured laws; every later change is
   specified, tested and gated on its own (principles 2–3, `FUNCTIONAL.md` § F1); the six
   presentation rows of `FUNCTIONAL.md` § F2.2–F2.7 (settings, safe areas, interruptions,
   identity, tiers, bug reports) are approved with this plan, and F2.1 is question 10.
4. **The rig before the rules.** Lanes with budgets measured on a module the size of the
   rules, executable specifications bound to tests, the analyser set, and an enforcement
   model built on a GitHub App for the agents, a gate App that alone can post the
   owner-review checks, the owner as the only reviewer, a ruleset,
   a tag ruleset, a release environment and a device runner the agents cannot reach — all
   before the rules move (principle 4, `VERIFICATION.md`, D15, D17–D18).
5. **AI-generated character and enemy art** through a measured gate built at P0 as one
   TypeScript tool, the cast built in P4 in parallel with the rules, the owner deciding the
   look at the end of the bake-off, an explicit stop rule, honest limits (the gate is a
   floor, not the bar) and a stated copyright position (D9, D10, `FUNCTIONAL.md` § F3).
6. **What it costs and what stands still** (below): about 16–32 sessions of agent
   capacity to a build on the stores' test tracks during P5 (the critical path P0–P3 and
   P5 is 14–28 deep, and P4's cast runs beside it but is not free) and 19–38 to production
   access (P7, the scene phase included) — on a calendar whose floor is the owner's fifty
   to sixty review sittings (about 60–90 hours of the owner's time) up to the first
   test-track build plus the stores' four weeks after it, about twelve to fourteen weeks
   at one sitting a weekday, which agent capacity stretches only below about two to three
   sessions a week; the demo stands still with its known defects. **Approving the plan
   approves P0's spend**: the bake-off (≈ $250 including a month's subscription), the two
   developer accounts (≈ $124), and reference handsets if the owner does not own them.
7. **Ten open questions** that are the owner's to answer, listed at the end, each with the
   phase it closes in and the price of each branch.
8. **What the game will not have** (`FUNCTIONAL.md` § F6): accessibility features beyond
   the readability rules, music, localisation, monetisation, cloud saves, accounts — each
   a later § F2 row if the owner wants it.

## Where we start from

- **One prototype**: about 45 000 lines of TypeScript and JavaScript (rules core 4 900 ·
  engine 5 700 · screens 7 400 · art 21 900 · tools and harness 3 700 · the rest `main.ts`
  and the shell) plus about 4 900 lines of contract and review logs. A headless,
  deterministic rules core with injected randomness; a per-game fork of the Retrovibe engine
  (loop, input with hit regions, bitmap fonts, palettes, particles, juice, a synthesized
  sound set, the HD-2D light rig, CRT); twelve screen states in nine screen files over a
  resumable run "seam"; a procedural art kit that bakes 43 actors, six painted biomes and
  thirteen VFX archetypes.
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
  was one overnight session of fifteen hours after a design session the day before.

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
   `:core` until the rules gate. The budgets are detekt's and Konsist's; if P0's spike
   finds detekt cannot parse the Kotlin the tree uses, Konsist keeps function length and
   parameter count and the complexity budgets are suspended as a loss recorded in the risk
   table (`TECHNICAL.md` § T3).
10. **Enforcement is by machines where a machine can do it, and the plan says where it
    cannot.** Separate identities, rulesets, a release environment, required checks that only
    the gate App can post, and code ownership; what is left to discipline — P0's artefacts,
    which land before any machine gate exists (the move, the capture tools, the art tool
    and its calibration golden, the critic's protocol and its per-axis baselines, the
    fallback captures and the sound hashes), the edit hook, the git hooks, the review
    bundle and the critic — is audited by the next machine gate (`VERIFICATION.md` § V1).

## Decision register

Each decision names the alternatives it beat and whether the owner must sign it off.
"Reversible" is the cost of changing it later. Detail lives in `TECHNICAL.md`.

| # | Decision | Chosen | Alternatives | Why | Reversible | Owner |
|---|---|---|---|---|---|---|
| D1 | Stack | Kotlin Multiplatform with Compose Multiplatform for every screen; the battle stage on a Compose `Canvas` through Skia (§ T2) | keep TypeScript in a WebView shell (≈ 2–4 sessions, migration only); keep TypeScript and build the brief's rig there (≈ 10–16 sessions); React Native + Skia via Expo (≈ 8–14 sessions, the rules kept verbatim); Flutter + Flame; native Swift and Kotlin; Lynx | the language the owner reviews in; the richest analysis and architecture-rule set; a JVM core for PvP; Google- and JetBrains-backed; stable on the three products' platforms; first-class test APIs, screenshot testing, hot reload with an MCP server for agents | `:core` and `spec/` are framework-free; the alternatives stay costed here | **yes** (decided 2026-09-12, recorded here) |
| D2 | Repository | This repository, **public as it is today and staying public**: the new game at the root from the first commit, the prototype under `prototype/` with history, frozen and code-owned; the rules frozen as the oracle at tag `ts-oracle-v3` with a freeze check from P2 (§ T4). Public is what keeps the hosted runners (the arm64 leg included), Pages and the privacy-policy host free, and it makes the game's source and the AI cast public — a consequence the copyright position of `FUNCTIONAL.md` § F3.6 already accepts; a private repository would pay for macOS minutes and lose the arm64 runners | a new repository for the game (the oracle by submodule, a second Pages site); an organization transfer | the oracle and the demo stay next to the game with no promotion phase; a transfer would move the Pages URL | one afternoon | **yes** (question 8) |
| D3 | Platforms | Android **minSdk 29** (Android 10) and iOS 16.0+ as products; desktop JVM for agents; web as a stretch (§ T1) | minSdk 26 with a LOW-only build below 29 (a second render path, rejected); web first | Compose's `ColorDodge` and `Multiply` blend modes (the stage's gain and grade) — `ColorDodge` has no PorterDuff equivalent below API 29 and falls back to source-over there, while `Multiply` maps to a PorterDuff mode that also multiplies alpha — are to be verified by P0's spike 1, which renders the stage on the Android emulator at API 28 and 29, a surprise there confirming or lowering the floor as a register decision, never a second render path; Android 8–9 are a low single-digit share of active devices in 2026, and Android 10 covers the phones the product targets | one phase | **yes** (by approving this plan — "What you are approving", item 1) |
| D4 | Rules method | Test-first from the clauses, with the oracle's canonical traces over a coverage matrix as the acceptance test; arithmetic transcribed in the prototype's evaluation order (§ T5) | a rewrite checked only statistically against the balance table | the oracle is exact and free, and the mechanics are the one thing the prototype validated | n/a | no |
| D5 | The seam | `RunSession` on the standard library's coroutine intrinsics; **hero turns are decisions** raised at step 7 of the turn; enemy turns stepped one at a time; forfeit a decision (§ T2.3) | a hand-written state machine; kotlinx.coroutines | reproduces the generator; a uniform decision log; the self-check paths the prototype's harness actually compares | one phase | no |
| D6 | Saves and replays | A run is `(RULES_VERSION, seed, RunConfig, decision log)` plus a snapshot of the whole run context after every decision; replay when versions match, resume from the snapshot when they differ (§ T11) — **contingent on question 10's yes** (`FUNCTIONAL.md` § F2.1); on "no", no run is persisted at all (the Vault and the settings only, as the prototype), the decision log lives in memory for a bug report, and the replay corpus and the save clauses are not built | state only; abandon runs on a version change | replay is exact and cheap and is the bug report and the PvP message; the snapshot keeps a permadeath run alive across a store update | one phase | **yes** (question 10) |
| D7 | Executable specifications | `spec/` clauses with stable ids, bound to Kotest tests by id; a binder that generates test data and fails the lane on unbound or unknown ids; promotion pull-request-scoped; a contract clause changes only with the owner's review; goldens as frozen specs; the contract reconciled with the code before the fold (§ T7) | Cucumber; prose only | one test framework; traceability the build enforces; the owner owns the rules of the game mechanically | one phase | no |
| D8 | Static analysis set | Compiler strictness, detekt, ktlint via Spotless, Konsist, KGP ABI validation, Kover, Android Lint, Compose rules, dependency-analysis, Pitest nightly, workflow/shell/markdown/spec linters; strict TypeScript, typescript-eslint and knip on the art tool; `:core`'s oracle transcriptions exempt from the complexity budgets until the rules gate; two named fallbacks if P0's spikes force them — detekt dropped to Konsist's length and parameter rules with the complexity budgets suspended, Pitest replaced by the property suite at 10 000 cases — each a recorded loss in the risk table (§ T3, § T6.5, § T8) | fewer tools | the brief; each tool has a distinct catch | one phase | no |
| D9 | Art pipeline | AI-generated sprites through one provider-agnostic TypeScript tool with a numeric gate (the prototype's criteria plus the review's motion and in-scene rulers, built at P0) and an agent critic under a repeatable protocol; the cast built in P4 beside the rules; assets committed with provenance under the owner's review; a continuity plan; the copyright position stated (§ T10, `FUNCTIONAL.md` § F3.6) | hand-drawn (option B); keep the prototype's kit | the brief; the kit is the measured ceiling | **not cheaply** after the cast is made; option B stays the fallback | **yes** (question 6) |
| D10 | Art look | Pixel sprites at the contract's cell under the stage's light laws, painted portraits; the fork closes at P0's exit on lit phone frames from the prototype's stage (§ F3.2) | painted characters | the laws, the criteria and the bar are built for pixel figures; a painted look is judged on a reduced gate so the fork is real | one phase before P4; a whole new cast after it (D9) | **yes** (question 1) |
| D11 | Bloom and CRT | Bright-layer bloom at quarter resolution on the CPU; halation from the same buffer; decided at P5 on the real stage against a platform-blur fallback (§ T9.4) | frame-derived bloom via platform blur | determinism, one code path | one phase | no |
| D12 | Audio | The 24 effects rendered once at P0 from the prototype's own synthesizer to WAV, three seeded variants each; no runtime pitching — a pitched variant, if ever wanted, is rendered offline the same way (§ T9.8) | port the synthesizer; runtime synthesis per platform | identical sound everywhere; nothing to port | one phase | no |
| D13 | Test framework | Kotest 6 with property testing (§ T3) | kotlin.test; JUnit 5 | one DSL for `:core` and `:ui`; tags for lanes | one phase | no |
| D14 | Build | Gradle with version catalogs, configuration cache, build cache; Amper not adopted (§ T3) | Amper | lowest risk for the analyser set | one phase | no |
| D15 | Branch model and releases | `main` protected by a **ruleset** — a pull request required, required approvals 0, stale approvals dismissed on push, required checks — every workflow's `changes` job among them, since a job skipped because `changes` failed would satisfy a required check too — (every workflow runs on every pull request with its heavy jobs skipped by path conditions, since a skipped job satisfies a required check and a filtered-out workflow does not); **code outside the owned paths merges on green checks alone** — the lanes are its reviewer, the owner reads the monthly summary and may review any pull request, and nothing waits for that; linear history, an empty bypass list, and **no up-to-date requirement** (it would dismiss every owner approval at every unrelated merge; a semantic conflict is caught by the post-merge run of the merge lane on `main`, which turns `main` red and blocks unrelated merges until fixed) — and the plan's own **owned-path check** (an approving review by the owner on the head commit, read through the API, required on every pull request that touches an owned path, and run from `main`'s copy of the workflow so the pull request it gates cannot rewrite it), with `CODEOWNERS` as a second layer whose enforcement at zero approvals is verified by P1's first throwaway pull request; a **tag ruleset** on `v*` and `ts-oracle-*`; the signing secrets only in a **`release` environment** the owner approves; **no merge queue** (GitHub offers it to organization-owned repositories only, checked 2026-09-12; were that to change, a queue would make the post-merge conflict machinery optional) (§ T4.1, § V5) | a long-lived branch; an organization transfer for a queue | protection is per branch, so it covers the frozen prototype too; a transfer would move the live URL | one phase | **yes** (question 7) |
| D16 | Backdrops | One flat, unlit composite of the prototype's far, mid and floor painters per biome, baked once through the prototype's own bake path at the padded plane size as the placeholder for every tier, drawn as one plane and lit at boot by the rig from the biome's light data; the scene phase makes four planes per biome as data-driven painters or AI-generated planes (§ T9.2, § T10.9) | port the prototype's painters; no placeholders | the stage exists from P5 with nothing to bake; the scene is designed for the new cast, not inherited | one phase | no |
| D17 | Identities and approvals | Agents commit, push and open pull requests as a **GitHub App** the owner installs (contents, pull requests, issues, workflows; short-lived tokens; no `checks` permission); a second **gate App** (`checks: write` only, its key in a `main`-only environment) is the only identity that can post the owner-review checks, so no workflow's own token can forge them; Renovate is a third app whose monthly pull request is reviewed like any other; the owner is the only code owner and the only reviewer; **the owner never authors a change on an owned path or a contract clause**; goldens, gate configuration, workflows, the spec's art, goldens and balance, the assets, the art tool, the prototype, the plan itself (`plan/**` but the spike reports), the agents' conventions and rubric (`.claude/**`, `CLAUDE.md`) and every contract clause need the owner's review on the head commit, verified through GitHub's review data by the owned-path check, never by `CODEOWNERS` semantics alone (§ T1, § V5) | a machine user with a fine-grained token (does not work on a user-owned repository); one identity; a reviewing agent identity | GitHub never counts an author's own review; an agent-identity approval is the coordinator approving itself | — | **yes** (question 7) |
| D18 | Where the device lane runs | A self-hosted runner on the owner's machine with the two reference phones — in its own user account or a VM that holds nothing but the phones and the runner token, since what it runs is `main`, which no human reviewed outside the owned paths — registered in a **separate private repository** the App cannot see, running nightly on a schedule; a device farm (Firebase Test Lab) as the fallback for the hash test and the benchmarks when the phone is offline (it cannot run the Maestro flows); GitHub's free arm64 Linux runners for the arm64 JVM hash test in the merge lane if P0's spike 5b passes; emulator and simulator lanes on hosted runners (§ T1) | hosted runners only; a farm only; the runner in this repository (reachable by an agent's pull request) | real hardware is the only truth for frame budgets, memory and ART-specific arithmetic; the runner must be out of the agents' reach | one phase | **yes** (question 5) |
| D19 | The prototype's role | Frozen at P0: the oracle for the rules, the live demo, the source of the spec, and — captured once — the fallback cast, the flat backdrops, the sounds, the glyph tables and the hand-drawn study; nothing else moves; its defects stay (§ T4) | migrate the engine and screens incrementally (the plan's revisions 1–3); delete it | the mechanics are what it validated; a port of its presentation would carry a look the owner does not want and machinery the restart does not need | it is history either way | **yes** (decided 2026-09-12) |
| D20 | Presentation direction | The stage's measured laws (dark figures on a lit ground, four planes with the middle one sharp, two derived foot pools, a gain not a wash, the tier ladder) kept as the art direction; every screen designed fresh for a phone against a written baseline (§ T2.5, `FUNCTIONAL.md` § F1.2) | an open art direction | the bar has not changed and the laws were paid for; the screens had never been on a phone | the laws are data | **yes** (with question 1) |

## What this costs and what stands still

**Effort.** One *session* is an autonomous overnight run of about **12–16 hours** by a
coordinator with two to six parallel writers, verifiers and critics — the unit `STATUS.md`
records. Calibration, from the git history: the prototype's v3 (the contract, the rules,
twelve screen states, six biomes, fourteen art rounds, the scene and UI rounds, the balance)
landed in one such session of fifteen hours (49 commits, 2026-09-05 21:54 → 09-06 13:04
UTC) after a two-commit design session the day before. The aggregate below is a
**per-phase sum**, not a multiple of that: sizes S ≤ 1, M 1–2, L 2–4, XL 4–8; P0 XL (the art tool is an M inside
it, the bake-off with the calibration another M, the move, the captures and the eight
spikes an L), P1 L (§ V9's twenty steps and about fifteen pull requests), P2 L, P3 L, P4 L
(in parallel), P5 XL, P6 L, P7 M — **19–38 sessions**, about 28 at the midpoints; without
the scene phase 17–34; the web stretch adds 1–2. The critical path
P0 → P1 → P2 → P3 → P5 → P7 is 15–30 of them (17–34 if P7 waits for P6, question 4); the
first test-track build arrives *during* P5 (the closed test starts on the first build that
passes the merge lane) after 14–28 sessions of depth and 16–32 of capacity, P4's cast
included, and P5's felt rows close it. **The calendar is the largest of three terms, and the third is serial.** The first
is agent capacity, which the subscription's limits bound: at *n* sessions a week the
programme takes 19/*n* to 38/*n* weeks — three a week gives six to thirteen, one a week
nineteen to thirty-eight; this review's own rounds hit those limits twice, so the low case
is real. The second is the owner's review latency: every owned-path change and every
contract clause waits for the owner's review on its head commit (D17). Counted in
**review sittings** — one sitting clears one milestone of one to a few pull requests that
land together and lasts about an hour to an hour and a half (P4's contact sheets twenty to
forty minutes, P3's contract promotions one to three hours) — the phases need P0 ≈ 5 (the
spike reports, the critic's protocol and baselines, the calibration's adjudication, the
prototype commits, the look decision), P1 ≈ 8 (about fifteen pull requests), P2 ≈ 8–10,
P3 ≈ 6–8, P4 ≈ 12, P5 ≈ 4–8, P6 ≈ 6, P7 ≈ 3 — **fifty to sixty sittings** (52–60), about
**60–90 hours** of the owner's time with the baseline play, the felt rows and the
first-ten-minutes test — and P1 alone takes about a week and a half; a sitting that clears
several milestones shortens it, a week's absence lengthens it by a week (the absence
protocol under *What the owner does, by phase*). **The third is the stores' lead time, and
it starts only at the first test-track build**: the fifteen to twenty testers (about a
month's lead), Play's review of the first closed-testing release (days), the fourteen
continuous days, Google's review of the production-access application (up to about a week
by Google's own statement, longer in exceptional cases) and App Review (one to three days,
longer on a rejection) — about four weeks that follow the build rather than overlap the
programme. So at one sitting a weekday the first test-track build cannot arrive in fewer
than about eight to ten weeks (the 41–47 sittings of P0–P4 and P5's first half precede it,
one a day) and P7 not in fewer than about **twelve to fourteen weeks**, whatever the
agents' capacity; agent capacity stretches that only below about two to three sessions a
week. P1's exit measures one real session against the plan's limits and one real review
week against the owner's and re-derives the first two terms; the third is re-read from the
stores' current rules at P5. The sizes are re-estimated three times — after P0's spikes,
after P1 measures the lanes on a `:core`-sized module, and after P2 counts the clauses —
and the second and third are the owner's to accept or to stop on (P1's and P2's exit
gates, below); P0's is folded into approving P1's start. None of it lands in `plan/`
unread: `plan/**` is an owned path.

**Money (to be confirmed at P0).**

| Item | One-off | Recurring |
|---|---|---|
| Agent compute | — | the owner's Claude subscription — its tier and monthly price are recorded here at P0, and the *n* sessions a week it sustains is the calendar's first term; this review ran on it and hit its weekly limit twice, which is the low case of about one to two sessions a week, and a higher tier or a second seat raises *n*; a session of this size at API list prices would be an order of magnitude above a single agent run — measured on one real session after P1 and recorded here, not guessed |
| Apple Developer Program | identity verification (a government ID) before anything ships; the developer name shown on the listing — and an address and phone under the EU's trader rules only if the owner declares as a trader, which a free game without monetisation need not; the owner checks the current forms at P0 | ≈ $99 / year |
| Google Play developer account | ≈ $25, plus identity verification (a government ID, a phone and a payment method) before anything ships; a developer name and a contact email shown on the listing (an address only under a trader declaration, as for Apple) | a personal account created after November 2023 must run a closed test with ≥ 12 opted-in testers for 14 continuous days per app before production access, the count may not dip, and Google's review checks that they used the app — the owner lines up **fifteen to twenty** people who will actually play, recruited about a month before P5's first build; the test starts on the first P5 build that passes the merge lane |
| Image generation | the bake-off ≈ $250 including one month of the subscription provider, whose plan, price and allowance are confirmed at P0's terms check (the protocol and the arithmetic in `TECHNICAL.md` § T10.7); the cast ≈ $700 base, $1 500–2 500 expected; the tool caps per-image API spend at **$4 000** — a counter persisted in `assets/spend.json` under the owner's review, behind provider-side budget caps or prepaid credits on every key the owner sets, and reaching it is a third stop trigger with the stop rule's branches (`TECHNICAL.md` § T10.7); the stop rule's *change provider* branch costs a second bake-off at P0's exit (≈ $250 and half a session to a session, from P0's re-estimate) or the whole-cast re-gate mid-cast; if the bake-off's winner is the subscription provider, the cast costs its months instead — P4's two to four sessions over about one to three calendar months, ≈ $50–150 at the plan's price, under an allowance-months ceiling in the same counter (`TECHNICAL.md` § T10.7); the worst case that ends in a self-hosted style model adds GPU time outside that counter, ≈ $300–800, which with any subscription is a separate budget the owner approves by name | ≈ $20–60 per later character at the per-image price including re-rolls and a portrait; ≈ $1 500–2 500 to regenerate the cast if the provider or its model is retired |
| Reference handsets | ≈ $400–900 if not already owned (a 2022 mid-range Android, an iPhone 12 class) | — |
| A Mac | assumed owned; it runs P0's iOS spike, P1's golden comparison and, under question 5's recommended branch, the device runner and the iPhone lane; ≈ $600–1 200 if it must be bought | — |
| AI-generated backdrop planes (P6, only if question 4 approves them by name) | ≈ 24 planes × ten candidates, 240–500 per-image generations ≈ $50–150 at the per-image prices, under its own **$500** ceiling in the counter | — |
| Keeping the listings alive (after P7) | — | about one session a quarter of agent capacity, which covers Google Play's annual target-API bump, Apple's SDK minimum for submissions, the stores' policy re-attestations and the dependency batches, plus the two developer accounts above |
| Option B, if the art stops | not in the aggregate: the twelve heroes' and bosses' master frames ≈ 8–12 sessions at the study's measured rate (one hand-drawn idle frame took a session), the other fourteen frames per actor **unmeasured** — measured at P0 by drawing EMBER's remaining frames only if the owner wants option B priced before deciding; otherwise "stop" means shipping the fallback cast as it is (question 6) | — |
| CI | none on a public repository's hosted runners (arm64 Linux included); macOS minutes cost more on a private one | Firebase Test Lab if the self-hosted runner is not used: the free tier's five physical runs a day cannot be exceeded at all, so the farm branch is the Blaze plan — 30 physical device-minutes a day free, then about $5 per device-hour — and the plan's nightly of about ten short physical runs is ≈ $100–200 a month; a self-hosted agent pool ≈ $50–150 / month only if question 9 chooses it |
| The owner's review | — | by phase, below |

**What the owner does, by phase.** Everything below is the owner's and nobody else's.
After P1 the owner's own words — `plan/BASELINE.md`, a register entry, an answer to a
question — reach `plan/**` through an agent that commits what the owner dictates and the
owner then reviews, since an author's own review never counts on an owned path
(`VERIFICATION.md` § V5).

| When | The owner |
|---|---|
| P0 | answers questions 1, 2, 3(b), 3(c), 6, 7, 8 and 10; opens the two developer accounts and passes their identity verification; lines up fifteen to twenty testers who will actually play, to be recruited about a month before P5's first build; plays the prototype on a phone and writes `plan/BASELINE.md`; **creates the GitHub App, installs it on this repository and stores its key as the agents' secret** (spike 6 needs the installation); sets the provider keys and the bake-off budget; looks at the prototype's P0 commits — the move, the banner, the capture tools and the fixture pages, about nine, ten with question 3(c) — at the calibration's adjudication, and at the critic's protocol (`plan/spikes/7/CRITIC.md`) with the three baseline sheets before the bake-off's first verdict, since no machine gates them yet (`VERIFICATION.md` § V1); decides the look on lit phone frames at the bake-off's end (one sitting). An absent owner blocks the environment spike |
| P1 | answers questions 5 and 9; **does the admin acts no agent can**: creates `CODEOWNERS` and then the provisional ruleset (the one owned-path change the owner authors, before the checks exist — in that order, since the ruleset's empty bypass list refuses the owner's own push the moment it exists), approves the two throwaway pull requests that prove the review mechanics, creates the gate App and the `gates` environment holding its key before the owner-review workflow lands, adds the required checks, creates the tag ruleset and the `release` environment, installs Renovate, creates the private runner repository and registers the runner if chosen (`VERIFICATION.md` § V5, § V9); runs `setup.sh` on the Mac — a JDK, the Android SDK, Gradle and Node installed on the owner's own machine — until `env-check` passes there, and lends it for one golden comparison; reviews the rig's owned-path pull requests — about fifteen, batched into about eight milestones that `VERIFICATION.md` § V9 names, each proven before the next; **accepts the re-estimated sizes and calendar at P1's exit, or stops** — the programme-level stop, repeated at P2's exit against the clause count; the art programme keeps its own three triggers, and P4's generation starts at P0's exit either way. An absent owner blocks P1, not only its review queue |
| P2 | reviews the prototype harness pull requests (about five to seven, one per allowed change, each on an owned path); creates the tag `ts-oracle-v3` (only the owner can, under the tag ruleset); reviews the golden set's commits (two or three pull requests); no clause reviews — the fold writes proposals; **accepts the P3 and P5 sizes re-derived from the clause count, or stops** |
| P3 | reviews the contract promotions, one pull request per rules module (six to eight) |
| P4 | says yes or no to 43 contact sheets on a phone, in the order of `FUNCTIONAL.md` § F3.5 (a few minutes each, batched per pack into about twelve pull requests), and takes the stop decisions |
| P5 | reviews the goldens and the `screens` and `platform` clause promotions, batched into one pull request per session (four to eight); walks the felt rows on a device; sets up the store listings, the privacy-policy page (`docs/privacy/index.html`, published beside the demo by the Pages workflow, `TECHNICAL.md` § T12), the data-safety form and the content rating; names the testers' channel in the listing and reads it weekly with the agents' triage, alongside the stores' own crash reports; **creates the Apple certificates repository and the Play upload key and stores both in the `release` environment** (no agent can); answers question 4. An absent owner blocks the first test-track build |
| P6 | reviews the six biomes' sheets and their clause promotions (about six pull requests) |
| P7 | runs the first-ten-minutes test on release builds; reads the closed test's feedback and the stores' crash reports with the agents' triage; cuts the tag; submits the iOS build for App Review and answers its questions; applies for Play production access; answers question 3(a) |
| Monthly | reads the one-page summary; reviews the dependency batch |
| Always | keeps the runner machine on, if chosen |

**When the owner is away.** Agents continue on stacked branches; nothing that needs the
owner's review merges (goldens, art, contract clauses, gate paths); the nightly keeps
running on `main`; the device lane reports SKIPPED; the review queue is the first item on
return. An absence costs calendar, never rework — with one exception, the closed test,
which only the owner holds: the first test-track build is promoted to the closed track
only when the owner can cover the fourteen days and a week after them, and an absence
inside that window that lets the opted-in count dip restarts the fourteen days, the one
rework an absence can cause. Otherwise: the ruleset has no up-to-date
requirement, so an approved pull request stays approved while unrelated ones merge, and a
session opens one pull request per owner-gated path and stacks nothing behind it.
Overnight sessions therefore leave such pull requests for the morning, and the plan's
cadence assumes the owner reviews on most days during P4–P6.

**What stands still.** The prototype is frozen at P0 with its four known defects and its
art; the live URL keeps serving it as the demo until question 3 is answered; nothing of it
is maintained. Until the first P5 build, the only thing anyone can play is that demo. Three
of the four defects (the wrong action on one hero turn in six and the stale greying of the
command list, which share one root cause — the pre-tick enumeration — and the extra-turn
crash) live in `screens/battle.ts`, outside the frozen rules paths, so they *could* be
fixed inside the freeze for about one session under the prototype's own gates — question 3
offers it; by default they stay, by decision, not by accident.

**If the owner stops.** Nothing has to be undone (`TECHNICAL.md` § T4.3): the prototype runs
and deploys as before, and the new tree is history. What cannot be recovered is what was
spent — the art, the accounts, the sessions and the owner's hours to that point — and a
closed test abandoned restarts its fourteen days.

## Roadmap

Phases end with **gates**, not dates. Entry, deliverables and exit criteria per phase are
in `TECHNICAL.md` § T14, which this table summarises.

| Phase | Delivers | Gate | Size |
|---|---|---|---|
| P0 Decide, spike, freeze, bake-off | The owner's answers to questions 1, 2, 3(b), 3(c), 6, 7, 8 and 10; the accounts and the tester recruitment started; the App created and installed; **the owner plays the prototype on a phone and writes the baseline**; the prototype moved under `prototype/` and frozen, the demo still deploying; the fallback cast, the flat backdrops, the sounds, the glyph tables and the hand-drawn study captured once; the art tool built in TypeScript with the full metric set and calibrated; eight spikes (headless JVM capture with the blend modes on the Android emulator; the coroutine seam with hero-turn pendings and the three self-check paths; Pitest; detekt; Kotest 6 on the iOS simulator, an x86-64 Android emulator and wasm, and the hash test on a free arm64 Linux runner; the agents' environment and the GitHub App; the sprite bake-off on six actors, both looks, both animation options, through the calibrated gate, shown in lit phone frames; the pinned critic scoring the prototype's cast as the baseline the P4 bar is set against) | Spike reports with frames and numbers; the look fork closed; the critic's per-axis baselines committed to `spec/art/` beside the protocol and the calibration sheet; the decisions recorded in the register; the sizes re-estimated | XL |
| P1 The rig | The environment recipe proven on the agents' machine with its two forms checked against one version manifest; the ruleset, `CODEOWNERS` and the two throwaway pull requests that prove the review mechanics, the tag ruleset, the release environment, the prototype's own workflow (the freeze check and its gates), the private runner repository; every module wired; every lane with its budget measured on a synthetic `:core`-sized module and a synthetic storyboard; the analyser set; the spec binder; hooks and skills including the `kmp-quality` rubric | Every lane green and inside its P1-measurable budget on the synthetic module and storyboard, timings in the ledger; L2b's content-scaled steps measured at P4/P5; the sizes and the calendar re-derived and **accepted by the owner, or the programme stops here** | L |
| P2 The spec and the oracle | The prototype's harness gains `--trace`, `--ascension`, `--path`, a canonical `--dump`, the strong-party and stall fixtures and the coverage report; the Node pin confirmed and `engines` added; tag `ts-oracle-v3`; the freeze check; the golden set recorded under the cell table with a coverage report; the contract reconciled with the code, then folded into `spec/` clauses; the clause count and the re-estimate | Spec-lint clean; every clause has an id, an owner, `paths` and a status; goldens frozen; every event, status, set, sigil, pending kind, room type and ascension row appears in the golden set; P3 and P5 re-sized against the clause count and **accepted by the owner, or the programme stops here** | L |
| P3 The rules | `:core` test-first, module by module; the `:sim` harness | Traces identical to the oracle on the golden set; the balance tables reproduced; the hash test green on the JVM, an x86-64 Android emulator and the iOS simulator, and once on an arm64 phone or a farm device; spec matrix 100 % for the rules areas with no weak clause; coverage and mutation at threshold | L |
| P4 The cast (parallel with P2–P3) | The pipeline at full strength; the cast generated in `FUNCTIONAL.md` § F3.5's order with the stop decision after the six heroes, judged on the prototype's stage; portraits through their own criteria | Every actor passes the gate; the six heroes meet the value targets the rejected kit fails; the full-frame critic's sprite axis at least **one above the prototype cast's baseline** scored under the same pinned protocol at P0, capped at 9 (expected 9 against 8; an unrecalibrated 8 would prove nothing; a baseline already at 9 leaves the cap nothing to give, so that axis's bar is an owner decision recorded in the register before P4 starts); the owner accepts on a phone | L |
| P5 The stage and the screens | The frame, the stage over the flat backdrops with the light data, VFX, pops, audio, tiers and ARCADE, the bloom decision; every run screen as Compose UI over the seam, designed for the phone; `FUNCTIONAL.md` § F2.2–F2.7 (settings, safe areas, interruptions, identity, tiers, the bug-report export with the first test-track build) and, if question 10 said yes, F2.1's resume path; fixtures, semantics tests, goldens; the storyboard driver; the Android and iOS shells; the store set-up (the privacy page, the testers' channel, the stores' own crash signal — no SDK) and the signed build pipeline; the closed test started on Play's closed-testing track and TestFlight | The storyboard **reaches** every biome, every boss and every screen with the strong party and forcing hooks, and plays a two-act run to a KO, on the JVM; two acts on Android and iOS; every fixture has a golden; the desktop and reference-phone budgets met; the full-frame critic's UI and VFX axes at least one above P0's per-axis baseline, capped at 9, with all five axes recorded (the sprite axis is P4's, the scene and composition axes P6's); the felt rows signed by the owner on a device | XL |
| P6 The scene | The six biomes' planes as data-driven painters (the default, inside the L) or, if question 4 approved them by name with their own budget line, AI-generated planes judged by the scene rulers, the critic and the owner (`FUNCTIONAL.md` § F3.7); the light wells, hues and composition items of `STATUS.md`'s round-5 brief; the placeholders retired | The full-frame critic's **scene and composition axes** at least one above P0's per-axis baseline under the pinned protocol, capped at 9 (the rejected look scored 8 · 8 · 8 · 8 · 7, so an absolute 8 would be met before P6 starts; a baseline already at 9 makes that axis's bar an owner decision recorded before the phase), and the sprite, UI and VFX axes not below their P4 and P5 readings; the owner accepts on a phone | L |
| P7 Ship | Credits and disclosure; the closed test's feedback triaged (an S inside the M); the App Store submission and App Review; the Play production-access application after the fourteen days — the stores' clock, about four weeks from the first test-track build, is the calendar's third term | Installed from both test tracks; the first-ten-minutes test passes on the owner's phones; App Review passed; Play production access granted | M |
| P8 Web (stretch) | The wasmJs target through the same gates; Pages switches from the prototype when it passes | The P5 gates on the Wasm build | M |
| Steady state (after P7) | Keeping the two listings alive: Google Play's annual target-API bump and Apple's SDK minimum for submissions, the stores' policy re-attestations, Renovate's monthly batch through the full lanes, a store-side fix when one is needed | The lanes, unchanged; a `v*` tag per release | ≈ one session a quarter, which covers the annual target-SDK bump |
| Then | The owner's character changes (built after P3, before or after P7 as the owner decides; sized per class in `FUNCTIONAL.md` § F4.3 — S–M per new character, a batch of six ≈ L), then PvP (`FUNCTIONAL.md` § F5; unsized until the brief arrives, re-planned in `TECHNICAL.md` § T16) | Their own gates | S–L; PvP — |

**Parallel:** P4 (the cast) runs beside P2 → P3 from P0's exit; P5 needs P3 and, for its
felt rows, P4's heroes; P6 needs P5. Whether P7 waits for P6 is question 4.

## Risks

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
| The team is one owner plus agents | The spec and the tests are the memory; every decision is in this register or the spec; the App, the rulesets and the owned-path check keep the gates, the art, the contract, the plan and the rubric out of the agents' hands; the owner's load and absence protocol are stated | A change without a spec id or a test |
| Agent capacity is the bottleneck (the subscription's limits stopped two of this plan's own review rounds) | The calendar is stated as a function of sessions per week; P1 measures one real session against the limits; a slower cadence changes dates, not phases | A week with fewer sessions than the calendar assumed |
| A store rejection, or a closed test that resets (App Review rejects the build; production access is refused; the opted-in count dips below twelve, which restarts the fourteen days) | The P5 store set-up with the owner's checklist and the privacy manifest entries; fifteen to twenty testers recruited for a floor of twelve; the testers' channel read weekly; the stores' own crash reports | Opted-in testers below fourteen; any rejection notice |
| The owner's review queue is the binding calendar term (fifty to sixty sittings) | Batching into milestones; one pull request per owner-gated path with nothing stacked behind it; the absence protocol; § V7's review-queue measure | A pull request waiting on the owner more than five weekdays |
| detekt cannot parse the tree's Kotlin, or Pitest will not run on the KMP JVM target (P0 spikes 3 and 4) | The named fallbacks: Konsist keeps function length and parameter count with the complexity budgets suspended as a recorded loss; the property suite at 10 000 cases nightly replaces mutation (`TECHNICAL.md` § T3, § T6.5) | A spike report choosing a fallback; a budget row with no tool |

## Open questions for the owner

Each is a real fork; the plan recommends but does not choose. The phase each closes in and
the price of each branch are stated so nothing waits on a question nobody knew was due.

1. **The look (D10)** — closes at P0's exit. Pixel sprites at the contract's cell under the
   stage's light (recommended), or painted characters under the same light, judged on a
   reduced gate? Decided on the bake-off's lit phone frames (`FUNCTIONAL.md` § F3.2).
   Painted means the value *targets* re-derived at P4 on look B's own reference (about one
   extra session; the pass thresholds gate both looks unchanged), a bar the owner has not
   named, and a different asset model: painted frames ship at twice the cell canvas, so the
   cast's atlases are ≈ 50 MB resident against 12–14 — which with two biomes' bakes presses
   the 250 MB peak-memory budget, one biome resident being the lever — and ≈ 8–15 MB on
   disk, inside the install budget; both re-derived at P0's exit (`FUNCTIONAL.md` § F3.2).
2. **Orientation** — closes at P0's start, before the art tool's in-scene rulers are
   calibrated. Landscape (recommended: the stage's laws and every measured number are
   16:9), or portrait? Portrait is a different stage composition and a different ruler for
   every screen: about 2–4 extra sessions in P5, plus the in-scene ruler re-derived twice —
   at P0 for the bake-off, whose lit frames come from the prototype's 16:9 stage either
   way, and at P5 against the new stage, with P4's gate re-run on the re-derived ruler
   (about half a session more).
3. **The demo and the web (D2, D19, D3)** — three parts. (a) *The demo*, closes at P7:
   keep the Pages URL serving the frozen prototype until the Wasm build passes the same
   gates (recommended, free) or retire it when the app ships — the Pages site itself stays
   up either way, because it publishes the privacy-policy page the stores require for as
   long as the app is listed (`TECHNICAL.md` § T12). (b) *The web as a target*,
   closes at P0: keep wasmJs as the stretch target (recommended; it costs about a minute of
   compile in every merge lane until P8) or drop it, which removes P8 and that minute and
   nothing else. (c) *The demo's three screen defects* (two root causes), closes at P0 before the move commit:
   fix them inside the freeze (≈ 1 session outside the aggregate, one named pull request
   under the prototype's own gates, `TECHNICAL.md` § T4.2) or leave them (recommended:
   leave them; it is a prototype, and the demo has them from P0 either way until fixed).
4. **The scene phase** — two parts, both closing at P5's end. (a) *Ship before or after
   it*: ship over the flat placeholder backdrops after P5 and run P6 after (recommended: a
   playable app 2–4 sessions sooner — knowing that the placeholder stage is one unlit
   composite of the prototype's far, mid and floor painters per biome, lit by the rig but
   with no plane separation, no depth of field and no near-plane curtains, flatter than
   the demo the owner judged, D16), or hold P7 until P6 clears its gate (the scene and
   composition axes at least one above P0's baseline, capped at 9)? (b) *P6's backdrops*:
   data-driven painters (recommended, the default, inside P6's L) or AI-generated planes,
   which the owner approves by name with their own budget line — ≈ $50–150 under a $500
   ceiling and about half a session of P6's size for the prompts and the critic rounds
   (`FUNCTIONAL.md` § F3.7).
5. **The device lane (D18)** — closes at P1. A self-hosted runner on the owner's machine in
   a private repository (recommended: no recurring cost, the phones the owner already
   holds, about half a session to set up — it must be a Mac for the iPhone lane, which the
   money table assumes the owner owns, and it runs `main`'s nightly, code no human reviewed
   outside the owned paths, so the runner lives in its own user account or a VM that holds
   nothing but the phones and its token, D18), or the farm only (on the Blaze plan, the only
   one that can pay past the free 30 physical device-minutes a day: a nightly of about ten
   short runs is ≈ $100–200 a month at about $5 per device-hour; about a quarter of a
   session to wire; and the farm runs the hash test and the benchmarks but **not the
   Maestro flows**, which are then SKIPPED every night)? Either way, if P0's spike 5b passes, the arm64 arithmetic truth moves to a free
   arm64 Linux runner in the merge lane and the phone keeps only the ART-specific and the
   performance rows.
6. **Option B reversed (D9)** — closes at P0. Confirm that AI-generated sprites replace the
   2026-09-06 decision to hand-draw the heroes and bosses (the AI cast: ≈ $1 500–2 500 and
   P4's 2–4 sessions, inside the aggregate; the stop rule's *change provider* branch costs
   a second bake-off at P0's exit — ≈ $250 and half a session to a session — or the
   whole-cast re-gate mid-cast, money table). Hand-drawing stays the named fallback under
   the stop rule, priced in the money table at ≈ 8–12 sessions for the twelve master
   frames at the study's measured rate, the remaining fourteen frames per actor
   unmeasured, outside the aggregate; if that price is not acceptable, "stop" means
   shipping the fallback cast as it is, and the owner should approve that sentence
   knowingly. The fallback cast exists either way.
7. **The identities and the release path (D15, D17)** — two parts, both closing at P0,
   because P1 builds them. (a) *The identities*: the agents' GitHub App, the gate App that
   alone posts the owner-review checks, and Renovate — three apps the owner creates or
   installs in about half an hour. A "no" to the agents' App means a classic-token machine
   user with the same review rules (`TECHNICAL.md` § T1; about a quarter of a session to
   swap, and a long-lived token to rotate by hand); a "no" to the gate App means the checks
   are posted by the workflow's own token, which any workflow in the tree could forge, so
   that gate becomes discipline (`VERIFICATION.md` § V5). (b) *The release path*: the
   ruleset on `main` with the owner as the only reviewer and the rule that the owner never
   authors a change on an owned path. A "no" means a long-lived protected `kmp` branch with
   the same rules and `main` left to the prototype: about one extra session and a weaker
   gate on the prototype's freeze.
8. **The repository (D2)** — closes at P0. The prototype under `prototype/` in this
   repository, public as it is today (recommended: the oracle and the demo stay beside the
   game; public keeps the hosted runners, the arm64 leg, Pages and the privacy host free
   and makes the source and the cast public — a private repository would pay for macOS
   minutes and lose the arm64 runners), or a new
   repository for the game with the prototype left where it is — the oracle by submodule,
   pinned in L3 and the nightly, a second Pages site, and a second ruleset, `CODEOWNERS`,
   App installation, tag ruleset and freeze workflow on the prototype's repository: about
   one to two sessions of extra plumbing, or half a session if the prototype's repository
   is left unprotected and its freeze becomes discipline?
9. **The agents' environment** — closes at P1, after P0's spike. If the session-start
   script's cold start is over six minutes on the cloud environment: accept it (every
   session starts slower, nothing else changes), or fund a self-hosted agent pool that runs
   the image (≈ $50–150 a month) and gets byte-exact goldens in the fast lanes too?
10. **Resume anywhere (D6, `FUNCTIONAL.md` § F2.1)** — closes at P0, because P3 designs
   the save format and the `SAVE` clauses around the answer. Yes (recommended): a run
   survives a closed app, a call and a store update; the save carries a snapshot of the
   whole run context; one price, `FUNCTIONAL.md` § F2.1's M, all of it inside the aggregate —
   the save format and the `SAVE` clauses inside P3's size, ≈ 1–2 sessions inside P5's XL
   for the persistence and the screens, and the post-gate `resumeRun` change in `:core`
   (an S inside the M) with its corpus; a "no" saves about those 1–2 sessions of P5 and
   the clauses' share of P3. No: no run is persisted at all — the Vault and the settings
   only, as the prototype — § F2.7's share-the-save and § T11's replay corpus are not
   built, so no release build can export a run and a closed tester's bug report is a seed
   and a description (the seed on GAME OVER stays either way), and a permadeath run is
   lost whenever the platform kills the app in the background — a cost every closed
   tester will meet.

Store identity — free, no accounts, no analytics, no crash reporting — is the plan's
assumption until PvP; it is not a question unless the owner wants otherwise.

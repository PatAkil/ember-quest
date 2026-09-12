# Ember Quest → Kotlin Multiplatform — the plan

**Status: revision 3, under review (2026-09-11).** This folder is the plan for moving Ember
Quest from its TypeScript + Canvas 2D web build to one Kotlin Multiplatform (KMP) codebase
that ships native Android and iOS apps, runs on the desktop JVM as the developers' and the
agents' fastest platform, and can later take the web back. Nothing here is built yet. The
plan is being reviewed by adversarial and blind reviewer agents; `REVIEW.md` is the log of
every round, and this README will say so when a round closes with no blocking or gap
finding. Until then, treat it as a draft.

| File | What it holds |
|---|---|
| `README.md` (this file) | **what you are approving**: the decisions, the open questions, the cost and what stands still, the roadmap, the risks |
| `FUNCTIONAL.md` | **what the player gets**: the parity baseline, the differences a native app carries and the defects the port fixes, the proposed mobile-native changes, the AI-generated character and enemy art as the player sees it, the placeholders for the owner's character changes and for PvP |
| `TECHNICAL.md` | **how it is built**: platforms, identities and hosts, architecture, toolchain, the rules port against the TypeScript oracle, TDD, executable specifications, static analysis, rendering and performance, the AI image pipeline, persistence, release engineering, the agent workflow, the phase sequence |
| `VERIFICATION.md` | **the loop**: the verification lanes and their budgets, the instruments that let agents see and measure their work, determinism and time control, the gates and how they are enforced, the failure classes and which gate catches each |
| `REVIEW.md` | the review rounds: every finding, its severity, what changed |

The functional and the technical are deliberately separate documents. A functional change
(a character, a mode, an art direction) is the owner's decision and is written as a change
to the specification; a technical change is the team's and is written against the
verification loop. The port itself carries **no functional change** (principle 3) beyond
the listed platform differences and the listed defect fixes, so that parity can be proven
mechanically before anything is allowed to differ. PvP is the one functional item that
will reopen the technical plan (a server, accounts, a network module); `TECHNICAL.md` § T16
is the empty seat it will take.

## What you are approving

1. **The move** to one KMP codebase: Android (Android 10+) and iOS (16+) as products, the
   desktop JVM for development and agents, the web as a stretch (D1–D3).
2. **Parity first.** The TypeScript rules are frozen as an oracle and ported bit for bit; the
   port carries no functional change except `FUNCTIONAL.md` § F1.3's platform differences
   and § F1.4's four known defects, each recorded as a clause; every later change is
   specified, tested and gated on its own (principles 2–3).
3. **The rig before the port.** Lanes with budgets measured on a module the size of the
   rules, executable specifications bound to tests, the analyser set, and an enforcement
   model built on two GitHub identities, all before the rules move (principle 4,
   `VERIFICATION.md`, D15–D18).
4. **AI-generated character and enemy art** through a measured gate and a critic, the gate
   built first in TypeScript so the bake-off can run at P0, with the owner deciding the look
   at the end of the bake-off, an explicit stop rule, and honest limits: the gate is a floor,
   not the bar (D9, D10, `FUNCTIONAL.md` § F3).
5. **What it costs and what stands still** (below): 18–36 autonomous sessions to the
   stores' test tracks, calibrated against this repository's own three-day v3 build; the
   live web build stands still for that time unless the owner takes the art-now option
   (question 6).
6. **Eight open questions** that are the owner's to answer, listed at the end; four of them
   close at P0's exit.

## Where we start from

- One game: about 45 000 lines of TypeScript and JavaScript (rules core 4 900 · engine
  5 700 · screens 7 400 · art 21 900 · tools and harness 3 700 · the rest `main.ts` and
  the shell) plus 7 000 lines of contract and review logs. A headless, deterministic rules
  core (`game/types.ts`, `game/data/*`, `game/sim/*`) with injected randomness; a per-game
  fork of the Retrovibe engine (loop, input with hit regions, bitmap fonts, palettes,
  particles, juice, a synthesized sound set, the HD-2D light rig, CRT); ten screens over a
  resumable run "seam" (`game/sim/runstep.ts`); a procedural art kit that bakes 43 actors,
  six painted biomes and thirteen VFX archetypes.
- A systems contract, `DESIGN.md` (1 700 lines), that the code follows and the simulator
  measures against; a balance state within 2.5 points of every act target on four seeds,
  which a reviewer reproduced exactly on today's code. `STATUS.md` lists six places where
  the contract and the code are known to disagree.
- Verification as practised today: `tsc` after every edit; `vite build` and a Playwright
  boot gate before every commit; a Monte Carlo harness (`sim/run.mjs`) with nine policies, a
  three-way self-check of the seam, `--dump` hashes over whole run results, `validateData()`;
  a capture tool that shoots line-ups, pose sheets, battle frames and a scripted run on
  desktop and phone viewports, and measures the sheets against the art ship criteria in
  CIE L*. There is no unit-test framework, no test per rule, no static analysis beyond the
  compiler, the captures are not byte-deterministic, and the scripted run dies at the act-2
  boss by design, so no act 3–6 battle has ever been driven on screen.
- Two latent defects the reviews found in the shipped web build: the battle screen picks a
  hero's option from a list enumerated *before* the turn's cooldown tick while the rules
  re-enumerate after it (a wrong action on about one hero turn in six), and a hero wearing
  the four-piece VIOLENT set would crash the interactive battle on its extra turn. The port
  fixes both, as recorded clauses (`FUNCTIONAL.md` § F1.4).
- Deployment: a push to `main` deploys to GitHub Pages; "the phone" is that page in a
  browser, verified only on a Playwright viewport. **Nobody has played it**, on any device.
- The art is not at the owner's bar (Octopath Traveler's HD-2D). Fourteen critic rounds
  passed every numeric ship criterion at 9/10 and still read "off"; a hand-drawn pixel study
  showed the procedural kit is the ceiling. The owner's decision of 2026-09-06 (hand-drawn
  heroes and bosses, "option B") is what this plan proposes to replace with AI-generated
  sprites — question 7 asks the owner to confirm that, and option B stays the named
  fallback.

## Where we are going

One Gradle project under `kmp/` in this repository (a zero-dependency `:core` with the rules
ported bit for bit; a `:ui` of Compose Multiplatform screens over a Skia-drawn stage;
thin Android, iOS and desktop shells; a `:sim` harness; a `:tools` set for assets and
instruments) and a `spec/` folder at the repository root of executable specifications that
the build binds to tests. Android and iOS are the products; desktop JVM is where agents get
seconds-long feedback and pixel-exact frames; web (Kotlin/Wasm) is a stretch target that
keeps the Pages URL alive once it passes the same gates.

## Principles (the non-negotiables)

1. **The rules stay headless and deterministic.** `:core` has no dependencies — not the
   platform, not Compose, not a coroutines library, not a logger — and the build asserts
   it. Every draw goes through the injected rng; the same seed, code and decisions give the
   same result on every runtime the product ships on, checked on the JVM, on ART (x86-64 in
   the merge lane, arm64 on real phones nightly) and on the iOS simulator.
2. **The oracle comes first.** The TypeScript build at a frozen tag is the reference until
   parity is proven: same seeds, same policies, byte-identical canonical traces. No rule is
   "ported from memory".
3. **Parity before change.** The port carries no functional change. The owner's character
   changes, PvP and every mobile-native addition land as specified changes *after* the
   parity gates. The only differences the port may carry are `FUNCTIONAL.md` § F1.3's
   platform differences and § F1.4's known defects, each a clause.
4. **The rig before the port.** The verification rig — lanes, budgets, instruments, static
   analysis, spec binding, identities — is built and its budgets are measured on a
   synthetic module the size of `:core`, not on a hello-world, before any rules code moves.
5. **TDD, with the spec as the source of tests.** A change starts with a failing test named
   after a specification clause. An independent verifier agent writes tests from the clause
   without seeing the writer's code; a disagreement is a spec ambiguity or a bug, and both
   are fixed at the spec. For the port itself the clause tests and the oracle traces are
   written before each module is transcribed.
6. **Every gate is fast, or it is not a gate.** Each lane has a time budget on a named
   machine class, the budget is measured on every run, and a check that outgrows its lane
   moves to a slower lane — it is never trimmed or skipped, and the move is a recorded
   decision, not a drift.
7. **Art is measured first, then judged by eyes — and the numbers are a floor, not the
   bar.** The same instruments that scored the kit 9/10 will pass generated images that
   still read wrong; the critic and the owner decide, and the plan has a stop rule.
8. **The owner is the playtester and decides the functional forks.** Agents report "builds,
   boots clean, gates green, frames attached", never "playtested".
9. **Simple and easy to change is enforced, not hoped for.** Complexity, size, dependency
   direction and public API surface are budgets checked by tools, with suppressions that
   carry a reason and an expiry — and one dated exemption, the literal port of `:core`
   until parity.
10. **Enforcement is by machines where a machine can do it, and the plan says where it
    cannot.** Two GitHub identities, hooks, rulesets, required checks and code ownership;
    what is left to discipline (the edit hook) is audited by the next machine gate.

## Decision register

Each decision names the alternatives it beat and whether the owner must sign it off.
"Reversible" is the cost of changing it later. Detail lives in `TECHNICAL.md`.

| # | Decision | Chosen | Alternatives | Why | Reversible | Owner |
|---|---|---|---|---|---|---|
| D1 | UI framework | Compose Multiplatform for every screen; the battle stage on a Compose `Canvas` through Skia (§ T2) | KorGE; libGDX + RoboVM; raw Skiko; a WebView | JetBrains- and Google-backed; stable on the three products' platforms; most of the game is UI; first-class test APIs, screenshot testing, hot reload with an MCP server for agents | `:core` and `spec/` are framework-free | no |
| D2 | Repository | Same user-owned repository: `kmp/` and `spec/` beside the TypeScript game, promoted at P8; the rules frozen as the oracle at tag `ts-oracle-v3`, guarded by a CI job from P2 (§ T4) | A new repository; an organization transfer | The oracle must sit next to the port; an organization transfer would move the Pages URL | one phase | no |
| D3 | Platforms | Android **minSdk 29** (Android 10) and iOS 16.0+ as products; desktop JVM for agents; web as a stretch (§ T1) | minSdk 26; web first | Compose's `ColorDodge` and `Multiply` blend modes (the stage's gain and grade) fall back to source-over below API 29; Android 10 covers the phones the product targets | one phase | **yes** (market reach; the web) |
| D4 | Rules port method | Literal port verified by canonical traces against the oracle over a coverage matrix (§ T5) | A rewrite from the specification | The oracle is exact and free | n/a | no |
| D5 | The seam | `RunSession` on the standard library's coroutine intrinsics; **hero turns are decisions** raised at step 7 of the turn; enemy turns stepped one at a time (§ T2.3) | A hand-written state machine; kotlinx.coroutines | Reproduces the generator; a uniform decision log; the self-check paths the TypeScript harness actually compares | one phase | no |
| D6 | Saves and replays | A run is `(RULES_VERSION, seed, RunConfig, decision log)` plus a state snapshot after every decision; replay when versions match, resume from the snapshot when they differ (§ T11) | State only; abandon runs on a version change | Replay is exact and cheap and is the bug report and the PvP message; the snapshot keeps a permadeath run alive across a store update | one phase | no |
| D7 | Executable specifications | `spec/` clauses with stable ids, bound to Kotest tests by id; a binder that generates test data and fails the lane on unbound or unknown ids; goldens as frozen specs; the contract reconciled with the code before the fold (§ T7) | Cucumber; prose only | One test framework; traceability the build enforces | one phase | no |
| D8 | Static analysis set | Compiler strictness, detekt, ktlint via Spotless, Konsist, KGP ABI validation, Kover, Android Lint, Compose rules, dependency-analysis, Pitest nightly, workflow/shell/markdown/spec linters; `:core`'s literal port exempt from the complexity budgets until parity (§ T8) | Fewer tools | The brief; each tool has a distinct catch | one phase | no |
| D9 | Art pipeline | AI-generated sprites through a provider-agnostic tool with a numeric gate (the repository's criteria, built first in TypeScript for P0) and an agent critic; assets committed with provenance and a continuity plan for the day a model is retired (§ T10) | Hand-drawn (option B); keep the kit | The brief; the kit is the measured ceiling | **not cheaply** after the cast is made; option B stays the fallback | **yes** (question 7) |
| D10 | Art look | Pixel sprites at the contract's cell under the light rig, painted portraits; the fork closes at P0's exit on lit phone frames (§ F3.2) | Painted characters | The rig, the contract and the instruments are built for pixel figures | one phase | **yes** (question 1) |
| D11 | Bloom and CRT | Bright-layer bloom at quarter resolution on the CPU; halation from the same buffer; a spike on the first-ten-minutes frames before it is final (§ T9.4) | Frame-derived bloom via platform blur | Determinism, one code path; listed as a visible difference | one phase | no |
| D12 | Audio | The 24 effects rendered to WAV at build time by a seeded port of the synthesizer, with variants; pitch by resampling (§ T9.8) | Runtime synthesis per platform | Identical sound everywhere; testable | one phase | no |
| D13 | Test framework | Kotest 6 with property testing (§ T3) | kotlin.test; JUnit 5 | One DSL for `:core` and `:ui`; tags for lanes | one phase | no |
| D14 | Build | Gradle with version catalogs, configuration cache, build cache; Amper not adopted (§ T3) | Amper | Lowest risk for the analyser set | one phase | no |
| D15 | Branch model and releases | `main` protected by a **ruleset** — a pull request required, required checks with always-run shim jobs, branches up to date, linear history, a code-owner review on gate paths, an empty bypass list — for the whole repository; **no merge queue** (unavailable on a user-owned repository); the Pages deploy ignores the port; the TypeScript release becomes a pull request (§ T4.1) | A long-lived branch; an organization transfer for a queue | Protection is per branch, so the release path changes too and the plan says so; a transfer would move the live URL | one phase | **yes** (it changes the owner's release path and adds review load) |
| D16 | Backdrops | Planes exported unblurred with the light rig's parameters as data; the rig bakes at boot; painters ported or re-authored in the scene phase P6b (§ T9.2, § T10.9) | Pre-blurred planes per tier; port the painters before parity | One code path for light; pools stay derived from the anchors; one image set | one phase | no |
| D17 | Identities and approvals | Agents push and open pull requests as a **non-admin machine user**; the owner is the only code owner and the only reviewer; goldens, gate configuration, workflows and the balance state need the owner's review; the merge lane verifies approvals through GitHub's review data, never a text file (§ T4.1) | One identity; a reviewing agent identity | GitHub cannot count an author's own review; an agent-identity approval is the coordinator approving itself | — | no |
| D18 | Where the device lane runs | A self-hosted runner on the owner's machine with the two reference phones, reachable only by the nightly workflow, never by a pull request; a device farm (Firebase Test Lab, which has Android and iOS physical devices) as the fallback and as the arm64 truth when the phone is offline; emulator and simulator lanes on hosted runners (§ T1) | Hosted runners only; a farm only | Real hardware is the only truth for frame budgets, memory and arm64 arithmetic | one phase | **yes** (question 5) |

## What this costs and what stands still

**Effort.** One *session* is an autonomous overnight run of about 8–12 hours by a
coordinator with two to six parallel writers, verifiers and critics — the unit `STATUS.md`
records. Calibration: this repository's v3 (the contract, the rules, ten screens, six
biomes, fourteen art rounds, the scene and UI rounds, the balance) landed in 50 commits over
three days, about three to six such sessions. Sizes: S ≤ 1, M 1–2, L 2–4, XL 4–8. Summing
the roadmap to the stores' test tracks (P0–P8 including the scene phase P6b): **18–36
sessions**, about 27 at the midpoints; without P6b 16–32; the web stretch adds 1–2. The
critical path is P1 → P2 → P3 → P5 → P7. At three sessions a week that is six to twelve
weeks; the closed test's fourteen days run inside that. The sizes are re-estimated twice:
after P1 measures the lanes on a `:core`-sized module, and after P2 counts the clauses.

**Money (to be confirmed at P0).**

| Item | One-off | Recurring |
|---|---|---|
| Agent compute | — | on the order of $100–300 per session at API list prices (≈ $3 000–8 000 for the programme), or covered by the owner's subscription plan; the owner knows which applies |
| Apple Developer Program | — | ≈ $99 / year |
| Google Play developer account | ≈ $25 | a personal account created after November 2023 must run a closed test with ≥ 12 opted-in testers for 14 continuous days per app before production access — the owner recruits and holds those twelve people (lead time about a month); the test starts on the first P5 build |
| Image generation | the bake-off ≈ $250 across both looks, both animation options and two per-image providers, plus a month of any subscription provider; the cast ≈ $700 base, $1 500–2 500 expected, a **$4 000 ceiling the tool enforces** | ≈ $50–150 per later character; ≈ $1 500–2 500 to regenerate the cast if the provider or its model is retired |
| Reference handsets | ≈ $400–900 if not already owned (a 2022 mid-range Android, an iPhone 12 class) | — |
| CI | none on a public repository's hosted runners; macOS minutes cost more on a private one | Firebase Test Lab beyond its free daily quota (five physical-device runs a day) if the self-hosted runner is not used |
| The owner's review | — | a few pull requests a week that only the owner may approve (goldens, gate configuration, the balance state) plus one monthly dependency batch |

**What stands still.** From P2 the web build's rules are frozen, and its art is frozen unless
the owner takes the art-now option (question 6). For the duration of the port the only
thing anyone can play is the current web build at its current quality; `STATUS.md`'s "Next"
list is superseded by this plan and is rewritten at P0's exit to say so.

## Roadmap

Phases end with **gates**, not dates. Entry, deliverables and exit criteria per phase are
in `TECHNICAL.md` § T14, which this table summarises.

| Phase | Delivers | Gate | Size |
|---|---|---|---|
| P0 Decide, spike, baseline | The owner's answers to questions 1, 2, 6 and 7; the developer accounts and the tester recruitment started; **the owner plays the current web build on a phone and records the baseline**; the art gate built in TypeScript (PNG input on the line-up instrument, a PNG actor on the stage) and calibrated; the asset export; the hand-off documents rewritten to point at this plan; seven spikes (headless JVM capture and its time; the bright-layer bloom against today's frames; the coroutine seam with hero-turn pendings and the three self-check paths; Pitest on a KMP JVM target; detekt on Kotlin 2.4 syntax; Kotest 6 running one hash test on the iOS simulator, an x86-64 Android emulator and wasm; the sprite bake-off on six actors, both looks, both animation options, through the calibrated gate, shown in lit phone frames) | Spike reports with frames and numbers; the look fork closed; the decisions recorded in the register | M |
| P1 The rig | `kmp/` skeleton with every module wired; the agent environment image; the machine identity, the ruleset, `CODEOWNERS`, the Pages filter, the release path as a pull request; every lane with its budget measured on a synthetic `:core`-sized module and a synthetic storyboard; the analyser set; the spec binder; hooks and skills including the `kmp-quality` rubric | Every lane green and inside budget on the synthetic module, timings in the ledger | M |
| P2 The oracle and the specs | `--trace`, `--ascension`, canonical `--dump` and the strong-party option in the harness; tag `ts-oracle-v3` after them; the `oracle-frozen` job; the golden set recorded under the coverage matrix with a trace-coverage report; the contract reconciled with the code, then folded into `spec/` clauses; the clause count and the re-estimate | Spec-lint clean; every clause has an id, an owner and a status; goldens frozen; every event, status, set, sigil and pending kind appears in the golden set | L |
| P3 The rules | `:core` by TDD, module by module; the `:sim` harness | Traces identical to the oracle on the golden set; the balance tables reproduced; the hash test green on the JVM, an x86-64 Android emulator and the iOS simulator, and once on an arm64 phone or a farm device; spec matrix 100 % for the rules areas with no weak clause; coverage and mutation at threshold | L |
| P4 The stage | The logical frame, input parity, the stage from the export and the light data, the legacy atlases, VFX, pops, audio, tiers and ARCADE, a throwaway Android shell | Battle frames captured headlessly for six biomes; the **visual-parity band** met against the exported frames at HIGH; the desktop and reference-phone budgets met | L |
| P5 The screens | Every run screen as Compose UI over the seam; fixtures and semantics tests; goldens in the canonical image; the storyboard driver; the Android and iOS shells; the closed test started | The storyboard **reaches** every biome, every boss and every screen with the strong party and forcing hooks, and plays a two-act run to a KO, on the JVM; two acts on Android and iOS; every fixture has a golden; the parity checklist's mechanical rows signed by evidence and its felt rows by the owner on a device | XL |
| P6 The art | The pipeline at full strength; the cast regenerated in `FUNCTIONAL.md` § F3.5's order with the stop decision after the six heroes; portraits | Every actor passes the gate; the six heroes meet the value targets the kit fails; the full-frame critic's sprite axis scores **above the kit's 8** on the same frames, the other axes not regressed; the owner accepts on a phone | L |
| P6b Scene and composition | The painters ported or re-authored as data-driven painters (AI backdrops as the owner's option); the light wells, hues and composition items of `STATUS.md`'s round-5 brief; the plate residuals | The full-frame critic ≥ 8 on every axis | L |
| P7 Ship | The approved `FUNCTIONAL.md` § F2 rows; store pipelines; credits and disclosure; the release-safe replay export | Installed from both test tracks; the first-ten-minutes test passes on the owner's phones | M |
| P8 Promote and retire | `kmp/` to the root; docs and skills rewritten; the TypeScript tree kept as the oracle under `oracle/` with the Pages deploy following it | Nothing at the root depends on TypeScript but the oracle; the live URL still serves | M |
| P9 Web (stretch) | The wasmJs target through the same gates; Pages switches when it passes | The P5 gates on the Wasm build | M |
| Then | The owner's character changes (from P5 on, before or after P7 as the owner decides), then PvP (`FUNCTIONAL.md` § F4, § F5) | Their own gates | — |

**Parallel once P1 lands:** P2 → P3 (rules) beside P4 (stage) beside the art pipeline;
P5 needs P3 and P4; P6b needs P4. Whether P7 waits for P6b is question 4.

## Risks (top ten)

| Risk | Mitigation | Tripwire |
|---|---|---|
| The port drifts from the oracle in a way the traces miss | Traces cover every draw, pending, hero turn, event and result field over a coverage matrix; a trace-coverage report proves every kind appears | Any trace diff blocks P3's gate |
| Numbers differ across runtimes (libm, text formatting, integer overflow) | Expressions copied verbatim; `pow` from an oracle-generated table; doubles traced as raw bits; `jsRound` explicit; Node pinned for the oracle; the hash test on the JVM, x86-64 ART and the iOS simulator in the merge lane, arm64 phones nightly | A hash mismatch on any product runtime |
| The stage cannot hold 60 Hz on a mid-range phone | Everything blurred is baked; per-frame work is blits; the CPU bloom is quarter-res; tiers; a device lane on real phones | Frame-time p95 > 12 ms at MED on the reference phone |
| Generated art passes the numbers and fails the eye (the kit's own history) | The gate is a floor; the critic and the owner judge lit phone frames; a stop rule with named branches | The owner's "no" at the bake-off or after the six heroes |
| AI art cannot hold consistency across 15 frames | A posable-skeleton or reference-conditioned provider; the bake-off generates all frames; consistency criteria after alignment; one provider for the cast | Gate rejection above 60 % after the bake-off tuning |
| The provider or its model is retired before the roster grows | Accepted assets, prompts and references archived; the accepted cast conditions later actors; a new provider means a whole-cast re-gate, priced in the money table | A provider notice, or a new actor failing consistency against the cast |
| The rig is red on the first honest `:core` commit (budgets sized on a toy) | Budgets measured on a synthetic `:core`-sized module and a synthetic storyboard at P1; `:core` exempt from the complexity budgets until parity; type-resolved detekt, the klib ABI check and full Konsist out of the fast lanes | A lane over budget in the ledger for a week |
| iOS and device lanes are slow, flaky or unavailable | iOS only in the merge and nightly lanes; an infrastructure-failure class with one recorded re-run; the device lane reports SKIPPED when a phone is offline and the farm covers the arm64 truth | The iOS job over 20 min; a device lane SKIPPED for a week |
| A tool is abandoned or breaks on a Kotlin release | Every tool pinned; one owner task per Kotlin upgrade; a tool leaves only with a replacement for its catch; detekt's type resolution has a named fallback | A pinned tool fails to build on an upgrade |
| The team is one owner plus agents | The spec and the tests are the memory; every decision is in this register or the spec; two identities and `CODEOWNERS` keep the gates out of the agents' hands; the owner's review load is stated | A change without a spec id or a test |

## Open questions for the owner

Each is a real fork; the plan recommends but does not choose. Questions 1, 2, 6 and 7 close
at P0's exit; the rest before the phase that needs them.

1. **The look (D10).** Pixel sprites at the contract's cell under the existing light rig
   (recommended), or painted characters under the same rig? Decided on the bake-off's lit
   phone frames (`FUNCTIONAL.md` § F3.2).
2. **Orientation.** Landscape only, as today (recommended — the stage is 16:9 and the
   contract's geometry is landscape), or a portrait layout? It shapes the frame, every
   screen's geometry and the drivers, so it closes at P0.
3. **The web target (D3).** Keep the Pages URL alive with the TypeScript build until the
   Wasm build passes the same gates (recommended), switch then, or drop the web?
4. **Ship before or after the scene phase.** Ship at composition 7 after P6 and run P6b
   after (recommended: a playable app sooner), or hold P7 until P6b reaches 8 on every axis
   — or drop P6b, which the brief did not ask for?
5. **The device lane (D18).** A self-hosted runner with the owner's phones (recommended) —
   and is that machine a Mac, which the iPhone lane needs — or a device farm?
6. **Art now or at P6.** The gate is built in TypeScript at P0 either way. Option A: run
   the pipeline against the web build during P0–P2 so generated actors reach the Pages URL
   early (1–2 extra sessions; the accepted PNGs carry into KMP; the parity frames are then
   re-exported from a named tag at P4); option B: wait for P6.
7. **Option B reversed.** Confirm that AI-generated sprites replace the 2026-09-06 decision
   to hand-draw the heroes and bosses; hand-drawing stays the named fallback under the stop
   rule.
8. **The release path (D15).** Confirm that releases of the web game become pull requests
   through the protected branch, with the owner's review on goldens and gate configuration.

Store identity — free, no accounts, no analytics, no crash reporting by default — is the
plan's assumption until PvP; it is not a question unless the owner wants otherwise.

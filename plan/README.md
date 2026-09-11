# Ember Quest → Kotlin Multiplatform — the plan

**Status: revision 2, under review (2026-09-11).** This folder is the plan for moving Ember
Quest from its TypeScript + Canvas 2D web build to one Kotlin Multiplatform (KMP) codebase
that ships native Android and iOS apps, runs on the desktop JVM as the developers' and the
agents' fastest platform, and can later take the web back. Nothing here is built yet. The
plan is being reviewed by adversarial and blind reviewer agents; `REVIEW.md` is the log of
every round, and this README will say so when a round closes with no blocking or gap
finding. Until then, treat it as a draft.

| File | What it holds |
|---|---|
| `README.md` (this file) | **what you are approving**: the decisions, the open questions, the cost and what stands still, the roadmap, the risks |
| `FUNCTIONAL.md` | **what the player gets**: the parity baseline, the differences a native app carries, the proposed mobile-native changes, the AI-generated character and enemy art as the player sees it, the placeholders for the owner's character changes and for PvP |
| `TECHNICAL.md` | **how it is built**: platforms, architecture, toolchain, the rules port against the TypeScript oracle, TDD, executable specifications, static analysis, rendering and performance, the AI image pipeline, persistence, release engineering, the agent workflow, the phase sequence |
| `VERIFICATION.md` | **the loop**: the verification lanes and their budgets, the instruments that let agents see and measure their work, determinism and time control, the gates and how they are enforced, the failure classes and which gate catches each |
| `REVIEW.md` | the review rounds: every finding, its severity, what changed |

The functional and the technical are deliberately separate documents. A functional change
(a character, a mode, an art direction) is the owner's decision and is written as a change
to the specification; a technical change is the team's and is written against the
verification loop. The port itself carries **no functional change** (principle 3), so that
parity can be proven mechanically before anything is allowed to differ. PvP is the one
functional item that will reopen the technical plan (a server, accounts, a network module);
`TECHNICAL.md` § T16 is the empty seat it will take.

## What you are approving

1. **The move** to one KMP codebase: Android (Android 10+) and iOS (16+) as products, the
   desktop JVM for development and agents, the web as a stretch (D1–D3).
2. **Parity first.** The TypeScript rules are frozen as an oracle and ported bit for bit; the
   port carries no functional change; every later change is specified, tested and gated on
   its own (principles 2–3).
3. **The rig before the port.** Lanes with measured budgets, executable specifications bound
   to tests, and the analyser set, all built and measured before the rules move (principle
   4, `VERIFICATION.md`).
4. **AI-generated character and enemy art** through a measured gate and a critic, with the
   owner deciding the look at the end of the bake-off, an explicit stop rule, and honest
   limits: the gate is a floor, not the bar (D9, D10, `FUNCTIONAL.md` § F3).
5. **What it costs and what stands still** (below): 45–85 autonomous sessions to the
   stores' test tracks; the live web build stands still for that time unless the owner
   takes the art-now option (question 6).
6. **Seven open questions** that are the owner's to answer, listed at the end.

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
  measures against; a balance state within 2.5 points of every act target on four seeds.
  `STATUS.md` lists five places where the contract and the code are known to disagree.
- Verification as practised today: `tsc` after every edit; `vite build` and a Playwright
  boot gate before every commit; a Monte Carlo harness (`sim/run.mjs`) with nine policies, a
  three-way self-check of the seam, `--dump` hashes over whole run results, `validateData()`;
  a capture tool that shoots line-ups, pose sheets, battle frames and a scripted run on
  desktop and phone viewports, and measures the sheets against the art ship criteria in
  CIE L*. There is no unit-test framework, no test per rule, no static analysis beyond the
  compiler, the captures are not byte-deterministic, and the scripted run dies at the act-2
  boss by design, so no act 3–6 battle has ever been driven on screen.
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
ported bit for bit; a `:ui` of Compose Multiplatform screens over a Skia-drawn stage; thin
Android, iOS and desktop shells; a `:sim` harness; a `:tools` set for assets and
instruments) and a `spec/` folder at the repository root of executable specifications that
the build binds to tests. Android and iOS are the products; desktop JVM is where agents get
seconds-long feedback and pixel-exact frames; web (Kotlin/Wasm) is a stretch target that
keeps the Pages URL alive once it passes the same gates.

## Principles (the non-negotiables)

1. **The rules stay headless and deterministic.** `:core` has no dependencies — not the
   platform, not Compose, not a coroutines library, not a logger — and the build asserts
   it. Every draw goes through the injected rng; the same seed, code and decisions give the
   same result on every platform the product runs on, checked on real runtimes (JVM, an
   arm64 Android emulator and device, an Apple-silicon iOS simulator).
2. **The oracle comes first.** The TypeScript build at a frozen tag is the reference until
   parity is proven: same seeds, same policies, byte-identical canonical traces. No rule is
   "ported from memory".
3. **Parity before change.** The port carries no functional change. The owner's character
   changes, PvP and every mobile-native addition land as specified changes *after* the
   parity gates. The only differences the port may carry are listed in `FUNCTIONAL.md`
   § F1.3.
4. **The rig before the port.** The verification rig — lanes, budgets, instruments, static
   analysis, spec binding — is built and its budgets are measured on a synthetic module
   the size of `:core`, not on a hello-world, before any rules code moves.
5. **TDD, with the spec as the source of tests.** A change starts with a failing test named
   after a specification clause. An independent verifier agent writes tests from the clause
   without seeing the writer's code; a disagreement is a spec ambiguity or a bug, and both
   are fixed at the spec. For the port itself the clause tests and the oracle traces are
   written before each module is transcribed.
6. **Every gate is fast, or it is not a gate.** Each lane has a time budget on a named
   machine class, the budget is measured on every run, and a check that outgrows its lane
   moves to a slower lane — it is never trimmed or skipped.
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
    cannot.** Hooks, protected branches, required checks and code ownership; what is left to
    discipline (the edit hook) is audited by the next machine gate.

## Decision register

Each decision names the alternatives it beat and whether the owner must sign it off.
"Reversible" is the cost of changing it later.

| # | Decision | Chosen | Alternatives considered | Why | Reversible | Owner |
|---|---|---|---|---|---|---|
| D1 | UI framework | Compose Multiplatform (CMP) for every screen; the battle stage drawn on a Compose `Canvas` through Skia | KorGE; libGDX + RoboVM; raw Skiko; the web build in a WebView | JetBrains- and Google-backed; Android, iOS and desktop stable, web in beta; most of the game is UI (cards, map, vault, party), which Compose gives with tap targets, keyboard focus and semantics; first-class test APIs (virtual time, `captureToImage`), screenshot testing, hot reload with an MCP server for agents. KorGE would win only if the stage needed per-frame shaders; it does not (§ T9) | `:core` and `spec/` are framework-free; `:ui` is not | no |
| D2 | Repository | Same repository: the KMP project under `kmp/`, `spec/` at the root, promoted at P8; the TypeScript rules frozen as the oracle at tag `ts-oracle-v3`, guarded by a CI job from P2 | A new repository; KMP at the root beside `package.json` | The oracle and its harness must sit next to the port for differential testing; the history, the contract and the review logs are the port's requirements | one phase | no |
| D3 | Platforms | Android **minSdk 29** (Android 10) and iOS 16.0+ as products; desktop JVM for development and agents; web (wasmJs) as a stretch | minSdk 26; web first; desktop as a product | Compose's non-Porter-Duff blend modes (the stage's `ColorDodge` gain and `Multiply` grade) silently fall back to source-over below API 29; Android 10 covers the phones the product targets | one phase (a per-API fallback path) | yes (web) |
| D4 | Rules port method | Literal port of `game/sim/*` and `game/data/*` into `:core`, expression trees copied verbatim, verified by canonical traces against the oracle over a coverage matrix of seeds, policies, ascensions and laps | A rewrite from the specification alone | The oracle is exact and free; a rewrite would re-discover every determinism decision the contract took five review rounds to fix | n/a | no |
| D5 | The seam | `RunSession` on the standard library's coroutine intrinsics — a resumable computation that suspends on each `RunPending` and resumes with a typed answer, synchronous and single-threaded — with **battle turns as first-class decisions** | An explicit hand-written state machine; kotlinx.coroutines | The TypeScript generator is a resumable computation; the intrinsics reproduce it with no dependency and no scheduler; the three Kotlin paths of the self-check are defined in § T2.3 | one phase | no |
| D6 | Saves and replays | A run is saved as `(RULES_VERSION, seed, RunConfig, decision log)` where the log includes every hero turn; resume is replay. A small state snapshot after every decision is the fallback when the installed rules version differs from the save's | Serialize the whole run state only; abandon runs on a version change | Determinism makes replay exact and cheap; the same artifact is a bug report, a share code and the PvP message; the snapshot keeps a permadeath run alive across a store update | one phase | no |
| D7 | Executable specifications | `spec/` clauses with stable ids, bound to Kotest tests by id; a binder that generates the tests' data from the clauses and fails the lane on unbound or unknown ids; goldens as frozen specs; a reconciliation of the contract with the code before the fold | Cucumber/Gherkin; keep `DESIGN.md` as prose only | One test framework; traceability the build enforces; readable by agents and the owner | one phase | no |
| D8 | Static analysis set | Compiler strictness, detekt (smells, complexity, custom purity rules), ktlint via Spotless, Konsist, KGP ABI validation, Kover thresholds, Android Lint, Compose rules, dependency-analysis, Pitest nightly, workflow/shell/markdown/spec linters — with the literal port of `:core` exempt from the complexity budgets until parity | Fewer tools | The brief asks for many, each with a distinct catch; the cost is one warm daemon and one dated exemption | one phase | no |
| D9 | Art pipeline | AI-generated sprites through a provider-agnostic tool with a numeric gate (the ported ship criteria at their real thresholds) and an agent critic; assets committed with provenance and a continuity plan for the day a model is retired; generation is build-time, never runtime | Hand-drawn pixel grids (the owner's option B); keep the kit | The brief; the kit is the measured ceiling; hand-drawing 43 × 15 frames is the slowest path | **not cheaply**: reversing after the cast is made means regenerating 645 frames; option B stays the fallback for heroes and bosses | **yes** (question 7) |
| D10 | Art look | Keep the HD-2D identity — pixel sprites at the contract's 2-px cell under the soft light rig — with painted AI portraits for cards and chips; the fork closes at the end of the P0 bake-off | Painted (non-pixel) characters under the same rig | The whole scene rig, the contract and the instruments are built for pixel figures and the bar was set by the owner; the bake-off shows both on a phone frame before the owner decides | one phase until `spec/art/` is written | **yes** (question 1) |
| D11 | Bloom and CRT | Bloom from an explicit bright layer at quarter resolution on the CPU (deterministic, common code); ARCADE's halation reads the same buffer; scanlines, vignette and flicker everywhere | Frame-derived bloom via platform blur effects | Determinism of goldens, one code path, no per-platform blur API; it is a visible difference and is listed as one (`FUNCTIONAL.md` § F1.3) with a spike and a critic comparison before it is final | one phase | no |
| D12 | Audio | The 24 sound effects rendered to WAV at build time by a seeded Kotlin port of the synthesizer (two or three variants where the source randomises), played through a small platform player; pitch by resampling in common code | Port the synthesizer to run at runtime per platform | Zero runtime synthesis risk; identical sound on every platform; the synth stays testable as a pure function | one phase | no |
| D13 | Test framework | Kotest 6 (multiplatform, its `io.kotest` Gradle plugin) with property testing; JUnit only where a platform runner demands it | kotlin.test; JUnit 5 | Property tests, data-driven tables, tags for lanes, one DSL for `:core` and `:ui` | one phase | no |
| D14 | Build | Gradle with version catalogs, configuration cache, build cache, the Kotlin Gradle plugin's ABI validation; Amper not adopted | Amper | Amper's coverage of the analyser set is not proven; Gradle is the lowest-risk path for agents that already know it | one phase | no |
| D15 | Branch model and releases | `main` becomes protected (required checks, a merge queue, no direct pushes) for the whole repository; KMP work lands under `kmp/` and `spec/` with path-filtered checks and always-run shim jobs; the Pages deploy ignores `kmp/**`, `spec/**`, `plan/**` and Markdown; the TypeScript release path becomes a pull request through the same queue (the `releasing-the-game` skill is rewritten at P1) | A long-lived `kmp` branch; path-scoped protection (GitHub has none) | Long-lived branches rot; protection is per branch, so the release path has to change too, and the plan says so | one phase | no |
| D16 | Backdrops | The six biomes' painter planes are exported **unblurred** as bitmaps with the light rig's parameters as **data**; `:engine` bakes blur, light map, tiers and the anchor-derived foot pools at boot; the painters themselves are ported or re-authored in the post-parity scene phase (P6b) | Ship pre-blurred planes per tier; port the 4 400-line painters before parity | One code path for light on every platform; the pools stay derived from the stage anchors; one set of images to ship; the scene work that composition needs has a phase of its own | one phase | no |
| D17 | Gates the agents cannot self-approve | Gate configuration, workflows, goldens, their approval sidecars and the balance state are owned in `CODEOWNERS` by the owner; a required review from code owners on those paths; the L3 lane checks that a golden's approver is not its author; no agent holds a bypass token | Trust the skills | "Airtight" enforced by the agents it constrains is not airtight | — | no |
| D18 | Where the device lane runs | A self-hosted runner on the owner's machine with the two reference phones attached, for the nightly device lane; a device farm (Firebase Test Lab) as the fallback; when a device is offline the lane reports SKIPPED, never green; emulator and simulator lanes on hosted runners (Apple-silicon macOS for iOS) | Hosted runners only (no phones); a farm only | Real hardware is the only truth for frame budgets and memory; a farm costs per minute and cannot hold the owner's handsets | one phase | yes (question 5) |

## What this costs and what stands still

**Effort.** Sizes are order-of-magnitude in autonomous sessions — an overnight run of a
coordinator with writers, verifiers and critics of the kind `STATUS.md` records — S ≤ 1,
M 2–4, L 5–10, XL 10–20. Summing the roadmap's phases to the stores' test tracks (P0–P8
including the scene phase P6b): **45–85 sessions**, about 65 at the midpoints; without P6b
40–75; the web stretch adds 2–4. The critical path is P1 → P2 → P3 → P5 → P7. The sizes are
re-estimated twice: after P1 measures the lanes on a `:core`-sized module, and after P2
counts the clauses the fold produced.

**Money (to be confirmed at P0).**

| Item | One-off | Recurring |
|---|---|---|
| Apple Developer Program | — | ≈ $99 / year |
| Google Play developer account | ≈ $25 | a personal account created after November 2023 must run a closed test with ≥ 12 testers for 14 continuous days per app before production access — calendar time, started at P0 |
| Image generation | bake-off ≈ $100 per per-image provider (+ a month of any subscription provider); the cast ≈ $700 base, $1 500–2 500 expected at the plan's tolerated rejection rate, a **$4 000 ceiling the tool enforces** | regeneration for new characters ≈ $50–150 each |
| Reference handsets | ≈ $400–900 if not already owned (a 2022 mid-range Android, an iPhone 12 class) | — |
| CI | none on a public repository's hosted runners; macOS minutes cost 10× on a private one | a device farm only if the self-hosted runner is not used |

**What stands still.** From P2 the web build's rules are frozen, and its art is frozen unless
the owner takes the art-now option (question 6). For the duration of the port the only
thing anyone can play is the current web build at its current quality; `STATUS.md`'s "Next"
list is superseded by this plan except where the roadmap names an item (the strong-party
driver, the value law inside the gate, a person playing on a phone).

## Roadmap

Phases end with **gates**, not dates. Details, entry and exit criteria per phase:
`TECHNICAL.md` § T14.

| Phase | Delivers | Gate | Size |
|---|---|---|---|
| P0 Decide, spike, baseline | The owner's answers to the questions below; developer accounts opened and the Play closed test started; **the owner plays the current web build on a phone and records the baseline**; the art gate's input contract and calibration; the asset export and the metrics port (needed by the spikes); seven spikes (headless JVM capture and its time; the bright-layer bloom against today's frames; the coroutine seam; Pitest on a KMP JVM target; detekt on Kotlin 2.4 syntax; Kotest 6 on the iOS simulator, an Android device test and wasm running one hash test; the sprite bake-off on six actors both ways, through the calibrated gate, shown in lit phone frames); the look fork closed | Spike reports with frames and numbers; the owner's decisions recorded in this register | M |
| P1 The rig | `kmp/` skeleton with every module wired; every lane running with its budget measured on a synthetic `:core`-sized module; the analyser set; the spec binder; hooks (edit, pre-commit, pre-push) and skills; `pages.yml` path filter; branch protection with shim jobs; `CODEOWNERS`; the root routing rewritten so no game-change request reaches the frozen rules | Every lane green and inside budget on the synthetic module, timings in the ledger | M |
| P2 The oracle and the specs | `--trace` in the TypeScript harness and the strong-party driver option; tag `ts-oracle-v3` cut after them; the `oracle-frozen` CI job; the golden set recorded under the coverage matrix and hashed; the contract reconciled with the code, then folded into `spec/` clauses; the clause count and the re-estimate | Spec-lint clean; every clause has an id, an owner and a status; goldens frozen; sizes re-estimated | L |
| P3 The rules | `:core` by TDD, module by module (types, data, rng, relics, battle, run, session); the `:sim` harness | Traces identical to the oracle on the golden set; the balance table reproduced exactly at the recorded N and seeds; the cross-platform hash test green on JVM, an arm64 Android emulator and the iOS simulator (wasm informative); spec matrix 100 % for the rules areas; coverage at threshold; mutation at threshold or the fallback recorded | L |
| P4 The stage | The logical frame, input parity, the stage (planes from the export, the light rig from data, actors from the legacy atlases, VFX, pops), audio, the tiers and ARCADE, a throwaway Android shell for the phone budget | Battle frames captured headlessly for six biomes; the **visual-parity band** met against the exported TypeScript frames; the desktop and reference-phone budgets met | L |
| P5 The screens | Every run screen as Compose UI over the seam; fixtures and semantics tests; goldens in the canonical container; the storyboard driver; the Android and iOS shells; device boot smoke | The storyboard clears **all six acts** with the strong party and a KO run on the JVM, and two acts on Android and iOS; every fixture has a golden; the parity checklist's mechanical rows signed by evidence and its felt rows signed by the owner on a device | XL |
| P6 The art | The pipeline at full strength; the cast regenerated in `FUNCTIONAL.md` § F3.5's order; portraits; a stop decision after the first six accepted actors | Every actor passes the gate; the full-frame critic scores the **sprite axis** ≥ 8 with the other four axes not regressed; the owner accepts the look on a phone | L |
| P6b Scene and composition | The painters ported or re-authored as data-driven painters (AI backdrops as the owner's option); the light wells, hues and composition items of `STATUS.md`'s round-5 brief; the UI plate residuals | The full-frame critic ≥ 8 on every axis | L |
| P7 Ship | The approved `FUNCTIONAL.md` § F2 rows; store pipelines; credits and disclosure | Installed from both test tracks; the first-ten-minutes test passes on the owner's phones | M |
| P8 Promote and retire | `kmp/` to the root; docs and skills rewritten; the TypeScript tree kept only as the frozen oracle under `oracle/` | Nothing at the root depends on TypeScript but the oracle | M |
| P9 Web (stretch) | The wasmJs target through the same gates; Pages switches when it passes | The P5 gates on the Wasm build | M |
| Then | The owner's character changes, then PvP — each a specified functional change on the stable platform (`FUNCTIONAL.md` § F4, § F5) | Their own gates | — |

**Parallel once P1 lands:** P2 → P3 (rules) beside P4 (stage) beside the art pipeline
(P6's tooling, from P0); P5 needs P3 and P4. P6b may run before or after P7 — question 4.

## Risks (top ten)

| Risk | Mitigation | Tripwire |
|---|---|---|
| The port drifts from the oracle in a way the traces miss | Traces cover every rng draw, every pending, every hero turn, every event and every result field, over a coverage matrix (ascensions, the Vault, SPD deltas, laps, every pack at its home act) | Any trace diff blocks P3's gate |
| Numbers differ across runtimes (libm, text formatting, integer overflow) | Expressions copied verbatim; `pow` from an oracle-generated table; doubles traced as raw bits; `jsRound` defined explicitly; the hash test on JVM, arm64 Android and Apple-silicon iOS | A hash mismatch on any product runtime |
| The stage cannot hold 60 Hz on a mid-range phone in Compose | Everything blurred is baked; per-frame work is blits; the CPU bloom is quarter-res; tiers as today; a device lane on real phones | Frame-time p95 > 12 ms at MED on the reference phone |
| Generated art passes the numbers and fails the eye (the kit's own history) | The gate is a floor; the critic and the owner judge lit phone frames; a stop rule with named branches (option B for heroes and bosses, or keep the kit and spend on composition) | The owner's "no" at the bake-off or after the first six accepted actors |
| AI art cannot hold consistency across 15 frames per actor | A posable-skeleton or reference-conditioned provider; key poses generated, only idle in-betweens procedural; motion criteria measured after alignment; one provider for the cast | Gate rejection above 60 % after the bake-off tuning |
| The provider or its model is retired before the roster grows | Accepted assets, prompts and references archived; a reference set (and, if available, a LoRA) trained on the accepted cast conditions later actors; a new provider means a whole-cast re-gate | A provider notice, or a new actor failing the consistency criteria against the cast |
| The rig is red on the first honest `:core` commit (budgets sized on a toy) | Budgets measured on a synthetic `:core`-sized module at P1; `:core` exempt from complexity budgets until parity; the klib ABI check and full Konsist out of the fast lanes | A lane over budget in the ledger for a week |
| iOS and device lanes are slow, flaky or unavailable | iOS only in merge and nightly lanes on Apple-silicon runners; an infrastructure-failure class with one recorded re-run; the device lane reports SKIPPED when a phone is offline | The iOS job over 20 min; a device lane SKIPPED for a week |
| A tool is abandoned or breaks on a Kotlin release | Every tool pinned; one owner task per Kotlin upgrade; a tool leaves only with a replacement for its catch | A pinned tool fails to build on an upgrade |
| The team is one owner plus agents | The spec and the tests are the memory; every decision is in this register or the spec; skills encode the loop; `CODEOWNERS` keeps the gates out of the agents' hands | A change without a spec id or a test |

## Open questions for the owner

Each is a real fork; the plan recommends but does not choose. Questions 1, 6 and 7 close
at P0's exit; the rest before the phase that needs them.

1. **The look (D10).** Pixel sprites at the contract's cell under the existing light rig
   (recommended), or painted characters under the same rig? Decided on the bake-off's lit
   phone frames (`FUNCTIONAL.md` § F3.2).
2. **Orientation.** Landscape only, as today (recommended — the stage is 16:9 and the
   contract's geometry is landscape), or a portrait layout as a later phase?
3. **The web target (D3).** Keep the Pages URL alive with the TypeScript build until the
   Wasm build passes the same gates (recommended), switch then, or drop the web?
4. **Ship before or after the scene phase.** Ship at composition 7 after P6 and run P6b
   after (recommended: a playable app sooner), or hold P7 until P6b reaches 8 on every axis?
5. **The device lane (D18).** A self-hosted runner with the owner's phones (recommended),
   or a device farm?
6. **Art now or at P6.** The pipeline's first half (generate → normalise → gate → sheet) does
   not depend on Kotlin. Option A: run it against the web build during P0–P2 so generated
   actors reach the Pages URL early (2–4 extra sessions, the accepted PNGs carry into KMP);
   option B: wait for P6 (recommended only if the owner does not need the web build to
   improve meanwhile).
7. **Option B reversed.** Confirm that AI-generated sprites replace the 2026-09-06 decision
   to hand-draw the heroes and bosses; hand-drawing stays the named fallback under the stop
   rule.

Store identity — free, no accounts, no analytics, no crash reporting by default — is the
plan's assumption until PvP; it is not a question unless the owner wants otherwise.

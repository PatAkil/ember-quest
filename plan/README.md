# Ember Quest → Kotlin Multiplatform — the plan

**Status: draft for review (2026-09-11).** This folder is the plan for moving Ember Quest
from its TypeScript + Canvas 2D web build to one Kotlin Multiplatform (KMP) codebase that
ships native Android and iOS apps, runs on the desktop JVM as the developers' and the
agents' fastest platform, and can later take the web back. Nothing here is built yet.
The plan was reviewed by adversarial and blind reviewer agents until a round produced no
blocking or gap findings; `REVIEW.md` is that log.

| File | What it holds |
|---|---|
| `README.md` (this file) | why, the principles, the decision register, the roadmap, the risks, the owner's open questions |
| `FUNCTIONAL.md` | **what the player gets**: the parity baseline, the mobile-native changes, the AI-generated character and enemy art as the player sees it, the placeholders for the owner's character changes and for PvP |
| `TECHNICAL.md` | **how it is built**: platforms, architecture, toolchain, the rules port against the TypeScript oracle, TDD, executable specifications, static analysis, rendering and performance, the AI image pipeline, persistence, release engineering, the agent workflow, the phase sequence |
| `VERIFICATION.md` | **the loop**: the verification lanes and their time budgets, the instruments that let agents see and measure their work, determinism and time control, the gates and how they are enforced, the failure classes and which gate catches each |
| `REVIEW.md` | the adversarial and blind review rounds: every finding, its severity, what changed |

The functional and the technical are deliberately separate documents. A functional change
(a character, a mode, an art direction) is the owner's decision and is written as a change
to the specification; a technical change is the team's and is written against the
verification loop. The port itself carries **no functional change** (principle 3 below) so
that parity can be proven mechanically before anything is allowed to differ.

## Where we start from

- One game, 52 000 lines of TypeScript: a headless, deterministic rules core (`game/types.ts`,
  `game/data/*`, `game/sim/*` — about 4 800 lines) with injected randomness; a per-game fork of
  the Retrovibe engine (5 700 lines: loop, input with hit regions, bitmap fonts, palettes,
  particles, juice, a synthesized sound set, the HD-2D light rig, CRT); ten screens (7 500 lines)
  over a resumable run "seam" (`game/sim/runstep.ts`); and 21 000 lines of procedural art (an
  ASCII part kit that bakes 43 actors, six painted biomes, thirteen VFX archetypes).
- A systems contract, `DESIGN.md` (1 700 lines), that the code follows and the simulator
  measures against; a balance state within 2.5 points of every act target on four seeds.
- Verification as practised today: `tsc` after every edit; `vite build` and a Playwright boot
  gate before every commit; a Monte Carlo harness (`sim/run.mjs`) with nine policies, a
  three-way self-check of the seam, `--dump` hashes over whole run results, `validateData()`; a
  capture tool that shoots line-ups, pose sheets, battle frames and a scripted whole-run drive
  on desktop and phone viewports, and measures the sheets against the art ship criteria in CIE
  L*. There is no unit-test framework, no test per rule, no static analysis beyond the compiler,
  and the captures are not byte-deterministic.
- Deployment: a push to `main` deploys to GitHub Pages; "the phone" is that page in a browser,
  verified only on a Playwright viewport. Nobody has played it on a device.
- The art is not at the owner's bar (Octopath Traveler's HD-2D). Fourteen critic rounds
  reached 9/10 on the sheets and still read "off"; a pixel study showed the procedural kit is
  the ceiling. The owner's earlier decision (hand-drawn heroes and bosses) is superseded by
  this plan's direction: **AI-generated images for characters and enemies**, under the same
  measured criteria.

## Where we are going

One Gradle project under `kmp/` in this repository: a zero-dependency `:core` (the rules,
ported bit for bit), a `:ui` of Compose Multiplatform screens over a Skia-drawn stage,
thin `:app:android` / `:app:ios` / `:app:desktop` shells, a `:sim` harness, a `:tools` set for
assets and instruments, and a `spec/` folder of executable specifications that the build
binds to tests. Android and iOS are the products; desktop JVM is where agents get
sub-second feedback and pixel-exact frames; web (Kotlin/Wasm) is a stretch target that
keeps the Pages URL alive once it is verified.

## Principles (the non-negotiables)

1. **The rules stay headless and deterministic.** `:core` has no dependencies — not the
   platform, not Compose, not coroutines libraries, not a logger — and the build asserts it.
   Every draw goes through the injected rng; the same seed, code and decisions give the same
   result on every platform, checked by a cross-platform hash test.
2. **The oracle comes first.** The TypeScript build at a frozen tag is the reference
   implementation until parity is proven: same seeds, same policies, byte-identical
   canonical traces. No rule is "ported from memory".
3. **Parity before change.** The port carries no functional change. The owner's character
   changes, PvP and every mobile-native addition land as specified changes *after* the
   parity gates, each with its own spec clauses, tests and simulator guards. The one
   exception list is in `FUNCTIONAL.md` § F1.3 (things a native app cannot keep identical).
4. **The rig before the port.** The verification rig — lanes, budgets, instruments, static
   analysis, spec binding — is built and measured on a hello-world stage before any rules
   code moves. A gate that arrives after the code it should have guarded is a gate that
   was never trusted.
5. **TDD, with the spec as the source of tests.** A change starts with a failing test named
   after a specification clause. An independent verifier agent writes tests from the clause
   without seeing the writer's code; a disagreement is a spec ambiguity or a bug, and both
   are fixed at the spec.
6. **Every gate is fast, or it is not a gate.** Each lane has a time budget that is itself
   checked. A slow check moves to a slower lane rather than being skipped.
7. **Art is measured first, then judged by eyes.** Generated images pass the numeric ship
   criteria before an agent or the owner looks at them; the numbers are the same instruments
   the current repo uses, ported.
8. **The owner is the playtester and decides the functional forks.** Agents report "builds,
   boots clean, gates green, frames attached", never "playtested".
9. **Simple and easy to change is enforced, not hoped for.** Complexity, size, dependency
   direction and public API surface are budgets checked by tools, with suppressions that
   must carry a reason and an expiry.

## Decision register

Each decision names the alternatives it beat and whether the owner must sign it off.
"Reversible" means the cost of changing it later is bounded by one phase.

| # | Decision | Chosen | Alternatives considered | Why | Reversible | Owner |
|---|---|---|---|---|---|---|
| D1 | UI framework | Compose Multiplatform (CMP) for every screen, with the battle stage drawn on a Compose `Canvas` through Skia | KorGE (a Kotlin game engine); libGDX + RoboVM; raw Skiko; keep the web build in a WebView | Backed by JetBrains and Google; Android/iOS/desktop stable, web in beta; most of the game is UI (cards, map, vault, party) which Compose gives with accessibility, tap targets and keyboard focus for free; first-class test APIs (`runComposeUiTest`, time control, `captureToImage`), screenshot testing (Roborazzi), hot reload with an MCP server for agents. KorGE would win only if the stage needed shaders per frame; it does not (§ TECHNICAL T9). A WebView is not a native app. | Partly: `:core` and the specs are framework-free; `:ui` is not | no |
| D2 | Repository | Same repository, the KMP project under `kmp/`, promoted to the root when parity is reached; the TypeScript game frozen as the oracle at tag `ts-oracle-v3` | A new repository; KMP at the root beside `package.json` | The oracle, its harness and its instruments must sit next to the port for differential testing; the history, the contract and the review logs are the port's requirements; one owner, one place | yes | no |
| D3 | Platforms | Android (minSdk 26) and iOS (16.0+) as products; desktop JVM as the development and agent platform; web (wasmJs) as a stretch target | Web first; desktop as a product | The brief is a sustainable mobile app; desktop is where the loop is fastest and frames are pixel-exact; the web stays served by the TypeScript build until the Wasm build passes the same gates | yes | yes (web) |
| D4 | Rules port method | Literal port of `game/sim/*` and `game/data/*` into `:core`, expression trees copied verbatim, verified by canonical traces against the oracle over seeds × policies | A rewrite from the specification alone | The oracle is exact and free; a rewrite would re-discover every determinism decision the contract took five review rounds to fix | n/a | no |
| D5 | The seam | `RunSession` on `kotlin.coroutines` intrinsics (a resumable computation that suspends on each `RunPending` and resumes with the answer), synchronous and single-threaded | An explicit hand-written state machine; kotlinx.coroutines | The TypeScript generator is a resumable computation; the intrinsics reproduce it with no dependency and no scheduler, so the three-way self-check stays meaningful | yes | no |
| D6 | Saves and replays | A run is saved as `(seed, RunConfig, decision log)`; resume is replay | Serialize the run state | Determinism makes replay exact and cheap; the same artifact is a bug report, a share code and the PvP message | yes | no |
| D7 | Executable specifications | `spec/` clauses with stable ids, bound to Kotest tests by id; a build task that fails on unbound clauses and unknown ids; example tables as test data; golden traces as frozen specs | Cucumber/Gherkin; keep `DESIGN.md` as prose only | One test framework; traceability the build can enforce; readable by agents and by the owner | yes | no |
| D8 | Static analysis set | Compiler strictness, detekt (smells, complexity, custom purity rules), ktlint via Spotless (format), Konsist (architecture), KGP ABI validation, Kover thresholds, Android Lint, Compose rules, dependency-analysis, Pitest on `:core` nightly, workflow/shell/markdown/spec linters | Fewer tools | The brief asks for many, each with a distinct catch; the cost is one warm daemon | yes | no |
| D9 | Art pipeline | AI-generated sprites through a provider-agnostic tool with a numeric gate (the ported ship criteria) and an agent critic; assets committed with provenance; generation is build-time, never runtime | Hand-drawn pixel grids (the owner's 2026-09-06 option B); keep the kit | The brief; the kit is the measured ceiling; hand-drawing 43 × 15 frames is the slowest path | yes | yes (look, § F3.2) |
| D10 | Art look | Keep the HD-2D identity: pixel sprites at the contract's 2-px cell under the soft light rig; painted AI portraits for cards and chips | Painted (non-pixel) characters under the same rig | The whole scene rig, the contract and the instruments are built for it and the bar was set by the owner; the fork is presented in § F3.2 for the owner | yes | **yes** |
| D11 | Bloom and CRT | Bloom from an explicit bright layer at quarter resolution on the CPU (deterministic, common code); CRT scanlines and vignette everywhere, halation only where a cheap frame read exists | Frame-derived bloom via platform blur effects | Determinism of goldens, one code path, no per-platform blur API; a spike compares frames before the decision is final (§ T9.4) | yes | no |
| D12 | Audio | The 24 sound effects rendered to WAV at build time by a Kotlin port of the synthesizer, played through a small platform player interface | Port the synthesizer to run at runtime per platform | Zero runtime synthesis risk; identical sound on every platform; the synth stays testable as a pure function | yes | no |
| D13 | Test framework | Kotest 6 (multiplatform) with property testing; JUnit only where a platform runner demands it | kotlin.test; JUnit 5 | Property tests, data-driven tables, tags for lanes, one DSL for `:core` and `:ui` | yes | no |
| D14 | Build | Gradle with version catalogs, configuration cache, build cache, the Kotlin Gradle plugin's ABI validation; Amper not adopted | Amper | Amper's tooling coverage for the static-analysis set is not proven; Gradle is the lowest-risk path for agents that already know it | yes | no |
| D15 | Branch model | KMP work lands on `main` under `kmp/` with path-filtered required checks; the TypeScript gates stay required for the root; Pages keeps deploying the TypeScript build | A long-lived `kmp` branch | Long-lived branches rot; the TypeScript build cannot be broken by `kmp/` because nothing at the root imports it | yes | no |

## Roadmap

Phases end with **gates**, not dates. Sizes are order-of-magnitude in autonomous sessions
(S ≤ 1, M 2–4, L 5–10, XL > 10) and are re-estimated after Phase 1 measures the lanes.
Details, entry and exit criteria per phase: `TECHNICAL.md` § T14.

| Phase | Delivers | Gate | Size |
|---|---|---|---|
| P0 Decide and spike | The owner's answers to the open questions below; four spikes (headless frame capture on JVM, the CPU bloom against the current frame, the coroutine seam, one AI provider bake-off on six actors) | Spike reports with frames and numbers | M |
| P1 The rig | `kmp/` skeleton, every module empty but wired; every lane running with its budget measured on a hello-world stage; static analysis at full strength; the spec binder; the hooks and skills for agents; CI required checks | The rig is green and each lane is inside its budget | M |
| P2 The oracle and the specs | `ts-oracle-v3` tagged; the canonical `--trace` added to the TypeScript harness; goldens recorded (seeds × policies × modes); `DESIGN.md` folded into `spec/` clauses with ids; the metrics instruments ported | Every clause has an id; the oracle's goldens are frozen and hashed | M |
| P3 The rules | `:core` by TDD, module by module (types, data, rng, relics, battle, run, session); the `:sim` harness | Traces identical to the oracle on every seed and policy; the balance table reproduced to the digit; cross-platform hash test green on JVM, Android, iOS simulator, Wasm; spec matrix 100 %; mutation score at threshold | L |
| P4 The stage and the shell | The logical frame, input parity, the stage (planes, actors, light, VFX, pops), the exported current art as placeholder atlases, audio | Battle frames captured headlessly; goldens for six biomes; frame budget met on desktop and on the reference phone | L |
| P5 The screens | Every run screen as Compose UI over the seam; the storyboard driver plays whole runs headlessly; device smoke on emulator and simulator | Whole-run drive green on JVM, Android and iOS; every screen fixture has a golden; the parity checklist (`FUNCTIONAL.md` § F1) signed by the owner on a device | L |
| P6 The art | The AI pipeline at full strength; the cast regenerated actor by actor behind the numeric gate and the critic; portraits | Every actor passes the gate; the full-frame critic scores ≥ 8 on every axis; the owner accepts the look on a phone | L |
| P7 Ship | Play internal track and TestFlight through CI; crash reporting opt-in; the Vault transfer code on the web build; store metadata | Installed from the stores' test tracks on the owner's devices; the first-ten-minutes test passes | M |
| P8 Promote and retire | `kmp/` to the root; skills and `CLAUDE.md` rewritten; the TypeScript build kept only as the frozen oracle under `oracle/` | Nothing at the root depends on TypeScript except the oracle | S |
| P9 Web (stretch) | The wasmJs target through the same gates; Pages switches when it passes | Same gates as P5 on the Wasm build | M |
| Then | The owner's character changes, then PvP — each a specified functional change on the stable platform (`FUNCTIONAL.md` § F4, § F5) | Their own gates | — |

**Critical path:** P1 → P2 → P3 → P5 → P7. **Parallel once P1 lands:** P2 and the P4 stage
work; the P6 bake-offs can start at P0 and continue beside P3–P5; the AI pipeline's gate
(the ported instruments) is a P2 deliverable. What can start today: P0's spikes and the
owner's answers.

## Risks (top ten)

| Risk | Mitigation | Tripwire |
|---|---|---|
| The port drifts from the oracle in a way the traces miss | Traces cover every rng draw, every event and every result field; hashes over the full result set, not aggregates; policies × seeds × modes | Any trace diff blocks P3's gate |
| Floating point differs across platforms (fused multiply-add on ARM, Wasm) | Expressions copied verbatim; integer powers by multiplication; `jsRound` defined explicitly; the cross-platform hash test on every target in CI | A hash mismatch on any target |
| The stage cannot hold 60 Hz on a mid-range phone in Compose | Everything blurred is baked; per-frame work is blits; the CPU bloom is quarter-res; tiers as today; a device benchmark lane | Frame-time p95 > 16.7 ms on the reference phone |
| AI art cannot hold consistency across 15 frames per actor | A reference-conditioned provider or a posable-skeleton provider; key poses generated, in-betweens procedural; the numeric gate rejects drift; one provider for the whole cast | Gate rejection rate > 60 % after the bake-off tuning |
| AI art licensing is unfit for a store release | Only providers whose terms grant commercial rights to outputs; provenance per asset; the licence recorded in the manifest | A provider without written commercial terms is not used |
| The value law (dark sprite on lit ground) is not met by generated sprites | The gate includes the value law; post-processing may darken ramps but never repaint; a critic round per actor | An actor failing the value law twice goes back to prompt design |
| Kotlin/Native and Xcode make the iOS lane too slow for the loop | iOS is a CI lane, never a local gate; the JVM lane proves the common code; iOS runs nightly and pre-merge | iOS lane > 25 min |
| A tool in the static-analysis set is abandoned or breaks on a Kotlin release | Every tool pinned; one owner task per Kotlin upgrade; a tool may be removed only with a replacement for its catch | A pinned tool fails to build on an upgrade |
| The team is one owner plus agents | The spec and the tests are the memory; every decision is in this register or the spec; skills encode the loop | A change without a spec id or a test |
| Compose for Web is not ready when P9 starts | The web is a stretch; the TypeScript build keeps the URL | P9 gates fail twice |

## Open questions for the owner

Each is a real fork; the plan recommends but does not choose.

1. **The look (D10).** Pixel sprites at the contract's cell under the existing light rig
   (recommended), or painted characters under the same rig? § `FUNCTIONAL.md` F3.2.
2. **Orientation.** Landscape only, as today (recommended — the stage is 16:9 and the
   contract's geometry is landscape), or a portrait layout as a later phase?
3. **The web target (D3).** Keep the Pages URL alive with the TypeScript build indefinitely
   (recommended until P9 passes), switch to the Wasm build when it passes, or drop the web?
4. **Store identity.** Free, no accounts, no analytics at launch (recommended); PvP will
   need accounts — decide then.
5. **The character changes and PvP** are placeholders awaiting the owner's details;
   `FUNCTIONAL.md` § F4 and § F5 give the templates and the questions they will need.

# KMP-PLAN.md — review log

The plan in `KMP-PLAN.md` was reviewed in rounds, the way DESIGN.md was
(`DESIGN-REVIEW.md`): each round runs four fresh agents in parallel against the
current text, findings are triaged, every BLOCKING, GAP and NUMBERS item is
applied, NOISE is listed with the reason it was declined, and the next round starts
from the edited text. The loop stops at a full round with zero BLOCKING and zero GAP.

The four reviewers per round:

| Reviewer | Kind | Brief |
|---|---|---|
| A — adversarial, technical | red team | Break the stack, determinism, testing-tool, static-analysis, sizing, rendering and asset-pipeline claims; verify against the repository and the reviewer's own knowledge of the KMP ecosystem |
| P — adversarial, process and functional | red team | Break the TDD method, the executable-specification design, the agent workflow port, the phases' exit gates, the technical/functional separation, the placeholders and the decision lists |
| F — blind fact checker | blind | Check every claim about this repository against the source; list omissions |
| O — blind owner's stand-in | blind | Read cold as the owner; judge fit to the request, clarity, completeness for a fresh start, honesty, missing questions |

Severity: BLOCKING (would fail or mislead an executor) · GAP (necessary and missing)
· NUMBERS (a wrong count, constant or estimate) · CLARITY (confusing or unjustified)
· NOISE (style; declined with a reason).

## Round 1 — 2026-09-11, on revision 1 (`2c74b82`)

Findings: A 25 · P 25 · F 13 + 6 omissions · O 17 + 11 questions. Every BLOCKING, GAP
and NUMBERS item applied in revision 2; NOISE listed at the end with the reason.

Measured while triaging (in this repository, HEAD `2c74b82`): local `main` = `eaad3c7`
(v2), `origin/main` = `71dc875` (the PR #1 merge), the branch 12 commits ahead; a 2 000-run
`balanced` simulation takes 9.0 s wall (≈ 4.5 ms per run); `Math.pow(b, n)` equals
repeated multiplication for b ∈ {2.7, 2.5, 2.1} and n ≤ 9, and the `--dump` hashes for
`lapper` and `balanced` (seed 1, 2 000 runs) are byte-identical under the rewrite;
`minAscensionFor` lives in `game/screens/vault.ts:143`; the decision recorder is DEV-only
and records the Vault as a count (`game/screens/run.ts:274`, `game/main.ts:940`).

### A — adversarial, technical

| ID | Sev | Finding (short) | Resolution |
|---|---|---|---|
| A1 | BLOCKING | Baseline commit claim false; main vs branch; Pages serves `origin/main` | Header, §1.1, §A2.1 rewritten with the measured state; pre-flight 1 (release decision, tag `ts-oracle`) |
| A2 | BLOCKING | Seat ruler 1.5 L against kit frames contradicts AI actors; mask from a deleted instrument | §A7.6 split: scene measured with a planted reference sprite and the bitmap's own alpha; actors judged fresh (§B2.5); Appendix C rewritten |
| A3 | BLOCKING | Bloom source is the composed world, not the actor plane; offscreen path unverified | §A7.3 row rewritten; T0a proves the full chain and names the primitive; `'copy'` row added |
| A4 | BLOCKING | `ForbiddenMethodCall` needs type resolution (JVM only); `Float` invisible to `ForbiddenImport` | §A6.1: caveat stated; Konsist text-level backstops; seeded violation per rule per source set in T1 |
| A5 | BLOCKING | Generator → state machine is not 1:1 | §A2.3: a `@RestrictsSuspension` two-way builder, 1:1, spiked in T1; persistence by replay |
| A6 | BLOCKING | `:engine` would import the stage anchors from `:game` | §A2.2: the rig takes the anchors as parameters |
| A7 | BLOCKING | Pools frozen in an exported PNG while the gain derives them live | §A7.3/§A8.2: light and grade maps computed from `look.json` and the anchors; only painted planes exported |
| A8 | BLOCKING | Save format inconsistent; recorder DEV-only; Vault as a count | §A7.5 rewritten (flush per hero turn, full `RunConfig`); pre-flight 4; script `mid-battle-kill` |
| A9 | BLOCKING | Relic fixtures would be ≈ 1.2 M records | §A3.1: hash per cell + sampled full records |
| A10 | BLOCKING | ±1.0 balance band at 2 000 vs a 5 000-run reference is noise or dead weight | Exact equality at 5 000, seed 1, while parity holds (§A4.1, T3) |
| A11 | GAP | Android leg adds no numeric coverage; no arm64 emulator on ubuntu | §A1.1 determinism legs: JVM · iosSimulatorArm64 · wasmJs |
| A12 | GAP | Saved runs vs rule changes unstated | `rulesVersion`, abandon with message, `R-PERSIST-02` (§A7.5, §B3.1, Appendix C) |
| A13 | GAP/NUMBERS | Asset inventory short a tier; memory claim wrong | §1.4, §A7.8, §A8.2: 36 planes, per-biome load/unload, decoded footprint stated |
| A14 | GAP | ARCADE is contractual (phone default tier; PAUSE button) | §B6.1: DESIGN.md edited in the same milestone; QUALITY button keeps the geometry |
| A15 | GAP | Sorts, float equality, `EnumMap`, `nextId` | §A3.2 rows added; `EnumMap`/`HashMap` banned; `nextId` in the records |
| A16 | GAP | Store lead times absent | T7 starts at T0; signing in CI from T1; §0.1 owner table; §B6.8 store identity |
| A17 | GAP | Kotest/Wasm, Pitest/KMP, dependency-analysis/KMP, Kover scope | §A1.2, §A6.1 caveats and fallbacks; proved in T1 |
| A18 | GAP | Two screenshot mechanisms; `ImageComposeScene` is desktop-only | §A4.1 per-target tooling; §A12 #8; Appendix C boxes scoped |
| A19 | GAP | Planes cannot be byte-compared to composed frames; fog/motes are code | §A8.2 recomposition test; §A2.4/§A7.3 re-implementation listed; T5 re-sized |
| A20 | GAP | References would land in gitignored dirs | Pre-flight 8: `reference/ts-oracle/` |
| A21 | GAP | Typed `decide` deletes the fallback surface | §A2.3 `RunAnswer.Invalid`; script `illegal-answers` |
| A22 | GAP | `-Xno-fma` does not exist; FMA not the live risk | §A3.2 row rewritten |
| A23 | GAP | Blur parameter differs per target | §A7.3: measured in T0a, one constant per target |
| A24 | NUMBERS | `jsRound` boundary; `'copy'` row | §A3.2 per-spec implementation with boundary tests; row added |
| A25 | NUMBERS | ID count and `:specs` sizing low ~3× | §A5.1 granularity + Combat pilot; §A2.5 re-derived (32–38 k) |

### P — adversarial, process and functional

| ID | Sev | Finding (short) | Resolution |
|---|---|---|---|
| P1 | BLOCKING | Hash over `JSON.stringify` not reproducible | Canonical encoder on both sides (§A3.1, pre-flight 3) |
| P2 | BLOCKING | Golden tests alone satisfy mutation/coverage | Scored with the golden suite excluded (§A4.2) |
| P3 | BLOCKING | Red run unverifiable with one commit | Two commits per task; CI proves the test commit fails; run ids are the evidence (§A4.2) |
| P4 | BLOCKING | Presentation and difficulty targets not Gherkin-able | Namespaces R-/P-/T- with their own proofs (§A5.1, §A5.3) |
| P5 | BLOCKING | T2 exit on Wasm and iOS depends on open items | JVM exit; iOS gating at T5, Wasm at T8 (§A3.3); decisions re-dated |
| P6 | BLOCKING | Look parity contradicts the art change; 8·8·8·8·7 is a failing verdict | §A7.6 split; "ONE MORE ROUND" stated |
| P7 | BLOCKING | `minAscensionFor` lives in a screen | Pre-flight 2 moves it into the rules here |
| P8 | BLOCKING | Launch-roster rule overturned `POSE_FALLBACK` | §B2.3: fallback kept; a release policy instead; §B2.4 #6 |
| P9 | BLOCKING | T0's gate is owner-blocked | T0a/T0b split; Owner column in §A10 |
| P10 | BLOCKING | detekt limits vs a 1:1 port of draw-ordered functions | `:rules` profile with rationale; splits only with unchanged hashes (§A6.1) |
| P11 | GAP | Screens have no red-first artefact | Layout and flow assertions first; screenshots non-gating, critic-approved (§A4.1, §A4.2) |
| P12 | GAP | Balance tolerance (= A10) | Exact equality |
| P13 | GAP | Mid-battle resume needs per-turn saves and a replay cost | §A7.5: per-hero-turn flush; 4.5 ms per run measured |
| P14 | GAP | No battle machine named | `BattleTurns` in §A2.3 and Appendix A; the nested-machine shape stated |
| P15 | GAP | MED has no assets; API 29–30 has no path | §A1.1 LOW on 29–30; MED merged plane exported; §A12 #3 |
| P16 | GAP | Gate can be green with skipped targets | PASS/FAIL/SKIPPED and the merge criterion (§A6.3) |
| P17 | GAP | Five scripts do not cover the decision kinds | Eleven scripts enumerated (§A5.4); pre-flight 7 |
| P18 | GAP | Skills cannot be rewritten one-to-one | Per-skill table (§A9) |
| P19 | GAP | B3 not a store-app list | B3.7–B3.11 added |
| P20 | GAP | Rights decision unowned and after the work starts | §B2.4 #1 first, with candidates; §B5 item 1; §0.2 |
| P21 | GAP | No needed-by / recommendation columns | §A12, §B2.4, §B6 tables; §0.2 |
| P22 | GAP | Predicate isolation is speculative generality | Removed; an ID inventory instead (§B4) |
| P23 | NUMBERS | ID count, one-file-per-ID, `:specs` size, total | §A5.1, §A5.2 (one file per area), §A2.5 |
| P24 | NUMBERS | Cadence sentence not evidence | §0 rewritten with the arithmetic (41–63 days) |
| P25 | NUMBERS | `pow` at laps > 3; `jsRound` boundary | Measured: no-op for n ≤ 9 and hashes unchanged (pre-flight 5); `jsRound` per spec |

### F — blind fact checker

| ID | Sev | Finding (short) | Resolution |
|---|---|---|---|
| F1 | BLOCKING | Baseline (= A1) | As A1 |
| F2 | BLOCKING | "data imports types only" is not DESIGN.md's rule | §A2.2 restated (skills for two tables; the index imports siblings) |
| F3 | GAP | MED bakes (= A13/P15) | As A13 |
| F4 | GAP | Battle fixtures are act 1 only | §1.4 stated; pre-flight 6 extends them |
| F5 | GAP | The export freezes the critic's open scene blockers | §1.5 keep/fix table; §B2.4 #3 names them |
| F6 | GAP | Recorder DEV-only; Vault as a count (= A8) | As A8 |
| F7 | GAP | DESIGN.md not clean for IDs | Pre-flight 9 repair pass with a blind check |
| F8 | GAP | Stage 0 residuals (gain box from `ACTOR_W`; KO never seen) | §A7.3, §1.5 table; KO frame in T5's gate |
| F9 | GAP | Byte-identity test cannot run (= A19) | As A19 |
| F10 | GAP | Sim flags incomplete | T3 lists every flag `sim/run.mjs` parses |
| F11 | NUMBERS | 7.3 ms resting / ~11.5 ms peak; 8 ms is a new target | §1.3, §A7.7 |
| F12 | NUMBERS | `SkillId` 122 | Fixed |
| F13 | NUMBERS | Grid intake ≈ 1 150 lines | Fixed |
| F-om-1 | GAP | "Verification findings not fixed" never referenced | §1.5 keep/fix/decide table |
| F-om-2 | GAP | Only three of the judging fixture pages ported | §A7.6 lists all four as desktop fixture screens |
| F-om-3 | GAP | The art-metrics commit gate lost | `artMetrics` in the gate (§A6.1, §A9) |
| F-om-4 | GAP | Audio unlock on the web target | §A1.2 |
| F-om-5 | GAP | The arcade shell has no home | §A2.4 last row |
| F-om-6 | GAP | The engine API doc convention dropped | §A9 (`engine/README.md` in the same commit) |

### O — blind owner's stand-in

| ID | Sev | Finding (short) | Resolution |
|---|---|---|---|
| O1 | BLOCKING | T0 not startable (needs T4's export, unnamed devices, a Mac) | T0a hand-exports one biome; devices are a precondition (§0.1, §0.2); T0b is the owner half |
| O2 | BLOCKING | No freeze rule for this repository | §1.5 freeze table; `ts-oracle` tag; the authoritative DESIGN.md named (§A2.1) |
| O3 | BLOCKING | Parity frozen around a game nobody played; three balance decisions open | Pre-flight 10 before the tag |
| O4 | BLOCKING | No money, no totals, a misleading cadence sentence | §0 "What it costs" with money, 41–63 days, the v3 comparison disowned |
| O5 | BLOCKING | 1:1 port vs complexity limits | `:rules` detekt profile; `@Suppress` counted (§A6.1) |
| O6 | GAP | The character brief parked behind the whole port | §B0's three options with a recommendation; §0.2 #3 |
| O7 | GAP | Determinism not tested until T2; a non-existent flag | T0a determinism probe on three legs; §A3.2 rewritten |
| O8 | GAP | Release-cadence loss unstated | §B6.5: the web fast lane; `@Serializable` tables; the loss named |
| O9 | GAP | Saved run vs app update (= A12) | As A12 |
| O10 | GAP | Bloom source changed silently (= A3) | As A3 |
| O11 | GAP | No "your part" section | §0.1 |
| O12 | GAP | Decisions not decidable from the text | Recommendation and needed-by columns; reach numbers; licence terms; model candidates; the one-way door |
| O13 | GAP | Screenshot tests will flake (74 % pixel drift today) | Deterministic render mode as a T5 deliverable; static screens only until then |
| O14 | GAP | The roadmap stops at T8; no `:server` | T9, T10 sketched; `:server` reserved (§A2.2) |
| O15 | CLARITY | "Simple and easy to change" never costed | §C worked examples |
| O16 | CLARITY | Separation leaks (font, CRT, orientation in A12) | §B6 holds every player-visible decision; §A12 points to it |
| O17 | GAP | Nothing renders during T5–T6 without art | Placeholder silhouettes (§A8.4), failing release builds |
| O-q | — | Eleven questions the plan should have asked | Folded into §0.1, §0.2, §B0, §B6 (telemetry, monetisation, store identity, the fast lane, the brother's builds) and the abort criterion in §A1.3/T0b |

### Noise, declined or absorbed

- Appendices A and B "restate §A2 and §A10" (O): kept, trimmed — executors need the
  mapping; the owner can skip them.
- §A2.3 is writer-level detail (O): kept; it is where the generator decision lives.
- Capacitor argued three times (O): now once in §0 as a pointer and once as decision
  §B6.4.
- §A7.3 prose duplicated CLAUDE.md (O): the table alone carries it now.
- `rng.ts`'s stale comment about `Math.random` (A): noted in §1.2; a one-line fix in this
  repository, not a plan item.
- detekt rule names (`UnusedPrivateMember` deprecated; `TooManyFunctions` thresholds) (A):
  fixed in §A6.1.
- The Konsist sample would not compile (A): rewritten as `kotlin.test` shape and labelled
  illustrative; the exact API is fixed in T1.
- The audio `pitch` parameter and the limiter's role (A): §A1.2 and §A2.4 corrected.
- DESIGN.md 1 743 lines; the Playwright viewport is 844×390; `:sim` is 699 lines; the
  floor bakes crisp (F): all corrected.
- "detekt ≈ 10 s warm" is optimistic with type resolution (P): the inner loop is now
  `:rules:jvmTest`; detekt runs in the gate.
- The ID sweep is a session of its own (P): it is now pre-flight 9 with a blind check.
- The worked Gherkin example checks out (P): kept as the reference example.


# The plan's review log

How the plan in this folder was reviewed before it was handed to the owner. Each round
ran four independent agents in parallel over the four documents: two **adversarial**
reviewers told to break the plan (one on the technical axes — feasibility, the rules port,
the verification loop, rendering, the art pipeline, sequencing; one on product scope,
process and migration risk) and two **blind** reviewers who judged only what was written
(one as the engineer who has to execute P0–P2 next week — "what would I have to guess?";
one as the owner's advisor holding the plan against the brief, ask by ask). None saw the
plan's drafting or each other's reports.

Severities: **BLOCKING** — the plan could not be executed as written, or a claim it depends
on was false · **GAP** — a real case or need the plan never addressed · **NUMBERS** — a
value, version, budget or estimate was wrong and the reviewer showed why · **MINOR** —
clarity or style. Every BLOCKING, GAP and NUMBERS finding was resolved by editing the plan;
MINOR findings were applied where they cost nothing and are otherwise listed with the reason
they were declined so the owner can overrule. The loop stops when a round returns zero
BLOCKING and zero GAP findings.

Reviewer ids: A = adversarial technical · B = adversarial product and process · C = blind
implementer · D = blind owner's advisor. Round numbers prefix the ids (1-A3 = round 1,
adversarial technical, finding 3).

## Round 1 — on revision 1 (commit `e11c4e3`)

Four reviewers, 112 findings: 20 BLOCKING, 49 GAP, 25 NUMBERS, 18 MINOR. Many were the
same defect seen from four sides; the resolution column names where revision 2 fixed it.
The structural changes revision 2 made because of this round: the seam gained hero turns
as first-class decisions and the save a state snapshot (A4, B3, C2, D3); the lanes were
re-budgeted against measurements and their contents moved (A16, A17, B27, C23, D12); the
enforcement model became mechanical — pre-push hook, protected `main`, `CODEOWNERS`,
approver ≠ author, generated workflows (B4, B5, B6, C10, C11, D2); the backdrop pipeline
became "unblurred planes plus light as data, the rig bakes at boot" (A8, B20, B26, C13,
C14, D13); the art gate's thresholds returned to the repository's real criteria with the
reference numbers as targets, the motion metrics are measured after alignment, and the
plan says plainly that the gate is a floor with a stop rule and decision points (A3, B1,
B2, B17, B24, C5, D10); the trace and the golden set were specified as a grammar and a
coverage matrix with hashes committed rather than traces (A5, A6, C6, C8, D11); P6's gate
was scoped to the sprite axis and a scene phase P6b was added (A3, B1); the README became
the approval surface with the aggregate cost, the money and what stands still (B22, B29,
D5, D20); minSdk rose to 29 (A1); goldens are byte-exact only inside one canonical
container (A2, D6); `spec/` moved to the repository root (C3, A22).

### A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | Compose's non-Porter-Duff blend modes need API 29; below it the gain and grade silently become source-over | minSdk 29 (D3, § T1) |
| A2 | BLOCKING | JVM goldens are byte-exact only on one host (font backends, SIMD tiers) | goldens recorded and compared inside one canonical Linux container; elsewhere a tolerance that never fails the lane (§ V4) |
| A3 | BLOCKING | P6's "critic ≥ 8 on every axis" is unreachable with the scene frozen | P6 gates on the sprite axis; P6b Scene and composition added (README roadmap, § T14) |
| A4 | GAP | The BATTLE answer is not a decision; targets are region indices; partial-battle resume undefined; answer scalars untyped | hero turns are `HERO_TURN` pendings answered by an option index; typed `RunAnswer`; mid-battle resume from the pre-battle snapshot plus the turns since (§ T2.3, § T5.3, § T11) |
| A5 | GAP | The golden set covered two act policies and act-1 fixtures only; no ascension, Vault, SPD, laps; N unspecified | the coverage matrix with N per cell, per-run hash lists committed, a probe subset in full text, a home-act fixture generator (§ T5.3) |
| A6 | GAP | Double-to-text differs per target; a shortest-round-trip printer is a port nobody budgeted | non-integral doubles are traced as raw bits; integers only when both sides agree (§ T5.2, § T5.3) |
| A7 | GAP | The three self-check paths collapse in Kotlin | the three paths defined: non-suspending `ask`, `RunSession` + `answerWith`, replay from the log (§ T2.3) |
| A8 | GAP | Two incompatible backdrop designs; pools no longer derived from anchors | unblurred planes + light as data; the rig bakes at boot; pools derived from `Layout` (D16, § T2.5, § T9.2, § T10.9) |
| A9 | GAP | Android host tests run on the JVM; nothing runs `:core` on ART/arm64; Intel simulators | the hash test as an Android device test on an arm64 emulator and on the phone; Apple-silicon macOS runners (§ T5.2, § V2) |
| A10 | GAP | The literal port breaks the complexity budgets and the suppression budget on day one | `:core` exempt from the complexity and length budgets until parity, under a separate `port` suppression budget zeroed by the P3 gate (§ T5.1, § T8.1) |
| A11 | GAP | The "60 644-check relic self-test" does not exist | reference removed; relic tests written from the clauses and `rollRelic` traces (§ T5.1) |
| A12 | GAP | Spikes needed P2 deliverables; P4's phone budget needed a P5 shell | the export and the metrics port are P0 deliverables; a throwaway Android shell in P4 (§ T14) |
| A13 | GAP | The transfer "short code" is 4.9 KB of base64 | a compact binary encoding ≈ 180 bytes as a QR code and deep link; optional (§ T11, § F2.4) |
| A14 | GAP | Missing failure classes: memory, gesture-navigation edges, the tier drop, audio | rows and lanes added (§ V6, § T6.2, § T9.5) |
| A15 | GAP | FLUX.1 [dev] is non-commercial; the fallback fails the plan's own licensing rule | the fallback is SDXL under its open licence or FLUX through an authorised API; terms verified at P0 into `LICENSES.md` (§ T10.2) |
| A16 | NUMBERS | L0 ≤ 3 s is below Gradle's measured floor; type-resolved detekt is per module; T6.1 added a test | L0 ≤ 5 s = ktlint + incremental compile + syntax-only detekt + spec-lint, debounced; type-resolved detekt and tests in L1 ≤ 60 s; budgets measured on a synthetic 5 000-line module (§ V2, § T6.1, § V9) |
| A17 | NUMBERS | The KMP ABI check dumps klibs of every target; Konsist re-parses the tree; task names wrong | JVM ABI dump in L1, klib dumps in L3; Konsist scoped in L1, full in L2; names corrected as "at writing" (§ T3, § T8) |
| A18 | NUMBERS | Atlas and backdrop sizes wrong; crispness needs cell-resolution atlases | atlases at cell resolution; one unblurred plane set; the size table re-derived and re-measured at P4 (§ T9.3, § T9.7) |
| A19 | NUMBERS | 4 ms vs today's 7.3 ms on the same raster path; zero allocation impossible; the bloom violates the readback rule | stage draw p95 ≤ 9 ms at rest, ≤ 13 ms at a hit; "the stage's own draw allocates nothing" plus a measured whole-frame ceiling; the rule reworded to the display surface (§ T9.5, § T8) |
| A20 | NUMBERS | V8's `pow` is fdlibm; a multiplication loop is not guaranteed equal; Wasm does not fuse | an oracle-generated table for the three bases at exponents 0–31; the FP risk reworded (§ T5.2, README risks) |
| A21 | NUMBERS | The bake-off costs ≈ $86 per provider, not < $100 for two | "$100 per per-image provider"; per-actor, per-provider candidate budgets (§ T10.7) |
| A22 | MINOR | Cross-file disagreements (spec location, iOS budget, halation, immutable collections edge, Kotest plugin, line count) | all reconciled: `spec/` at the root, iOS job ≤ 20 min inside L3's 30, halation from the bloom buffer everywhere and listed in § F1.3, the edge added, the plugin named, ≈ 45 000 lines |
| A23 | MINOR | The synth draws `Math.random` at play time; desktop has no pitch control | a seeded port with two or three variants per clip; pitch by resampling (§ T2.5, § T9.8, D12) |
| A24 | MINOR | The empty-roster quirk | printed as passed; a `RUN-CONFIG` clause names the quirk (§ T5.2) |
| A25 | MINOR | `>>> n` and a 0xFFFFFFFF seed | `ushr`; the seed is a `UInt` (§ T5.2) |

### B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | P6's gate needs the composition axis, whose levers the plan froze | = A3 |
| B2 | BLOCKING | The numbers-then-eyes loop already ran to 9/10 without the bar; no stop rule | the honesty paragraph, two decision points, "stop means" (§ F3.2, § F3.5); principle 7 rewritten |
| B3 | BLOCKING | Mid-battle resume is not deliverable from seam-granularity decisions | = A4 |
| B4 | BLOCKING | `pages.yml` has no path filter; every KMP commit on `main` redeploys the live game | `paths-ignore` at P1, in the allowed TypeScript changes (§ T4.1, § T4.2) |
| B5 | BLOCKING | Path-filtered required checks skip and block the queue; protecting `main` breaks the direct-push release | shim jobs; `main` protected for the whole repository; the release becomes a pull request and the skill is rewritten at P1 (D15, § T4.1) |
| B6 | BLOCKING | The root skill routing sends every game change at the frozen rules until P8 | the routing rewritten and a refusal preamble at P1; the `oracle-frozen` job at P2 (§ T4.1, § T4.2) |
| B7 | BLOCKING | "Whole runs" vs "two acts"; acts 3–6 never driven | the strong-party option in the TypeScript driver and the Kotlin storyboard; P5 gates on all six acts on the JVM (§ T4.2, § V3.2, § T14) |
| B8 | BLOCKING | The parity checklist is unobservable by play; the owner never played; open rows undefined | mechanical rows signed by evidence, ≤ 8 felt rows the owner walks, the P0 baseline play, an open felt row keeps P5 open (§ F1.4) |
| B9 | GAP | The read-only guard names a directory that appears at P8 | the `oracle-frozen` job by path from P2; `diff-oracle` at the root until P8 (§ T4.2, § T5.4) |
| B10 | GAP | A no-rewording fold turns known-false contract prose into contract clauses | the reconciliation step before the fold; `known-divergence` (§ T7.6, § F1.1) |
| B11 | GAP | The bloom change and two platform differences were missing from F1.3 | rows for bloom and halation, Android back, windowing (§ F1.3) |
| B12 | GAP | A client-known seed enables information cheating in PvP | the seed-secrecy constraint; server-held stream or commit–reveal (§ F5.2) |
| B13 | GAP | One provider for the cast is fatal for later roster additions; D9 is not cheaply reversible | the continuity clause; D9's reversibility corrected; the cost in § F4.3 (§ F3.6, § T10.6) |
| B14 | GAP | No device-lane host, no costs, the Play closed-test rule unmentioned | D18; the money table; accounts and the closed test at P0/P5 (README, § T1, § T12) |
| B15 | GAP | No successor for the feel checklist | `kmp-quality` and the skill mapping table; the first-ten-minutes test scored against it (§ T13.2, § F1.4) |
| B16 | GAP | Reference frames are not in the repository; third-party screenshots as references; the study ignored | derivations recorded; no third-party artwork as a reference; the study is the reference set and in the bake-off (§ F3.1, § T10.2, § T10.3) |
| B17 | GAP | The motion criteria are satisfied by translating a sprite | measured after best-fit alignment; part travel; dead ≥ 90 % different; option (b) only for idle in-betweens (§ F3.1, § T10.3) |
| B18 | GAP | Any rules change abandons in-flight saves on auto-update | the state snapshot fallback; `RULES_VERSION` bumps only on rule-bearing changes (D6, § T11, § F2.1) |
| B19 | GAP | The character placeholder lacked the unions, a worked example, the roster-size question, the art cost | all added (§ F4.1–F4.5) |
| B20 | GAP | Bitmap backdrops orphan the painters; anchors baked into images drift | light as data and the rig at boot; the anchor-drift test until P6b; the painters ported in P6b (D16, § T10.9) |
| B21 | GAP | The look fork stayed open past the phase that depends on it | closes at P0's exit; `spec/art/` written after (D10, § F3.2, § T7.5) |
| B22 | GAP | No aggregate size; the live game stands still unnamed | "What this costs and what stands still"; question 6 (README) |
| B23 | NUMBERS | The transfer code is 4 600 characters | = A13 |
| B24 | NUMBERS | Gate thresholds set at unreached or withdrawn values | pass thresholds are the repository's criteria; the reference numbers are targets; the share-below-3:1 against a lit ground replaced by the in-scene ruler (§ F3.1, § T10.4) |
| B25 | NUMBERS | "Under $800" is low by 2–4× | the cost model with the expected band and an enforced ceiling (§ T10.7, README) |
| B26 | NUMBERS | Per-tier backdrops ≈ 78 images; the blur contradiction; atlas memory | = A8, A18 |
| B27 | NUMBERS | L0 contradiction; the nightly Monte Carlo below the contract's basis | = A16; L4 at the contract's basis (§ V2, § T5.5) |
| B28 | NUMBERS | 52 000 lines | ≈ 45 000 with the arithmetic (README) |
| B29 | NUMBERS | P2, P5, P8 under-sized | P2 L, P5 XL, P8 M, P6b L; the aggregate (README) |
| B30 | MINOR | The README claimed a finished review | the status paragraph rewritten (README) |
| B31 | MINOR | V1 vs V5 on enforcement; the asset gate's scope | § V1 rewritten; the gate over `kmp/assets/actors/**` with `legacy/` exempt |

### C — blind, implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `commonTest` cannot read files on iOS or Wasm with zero dependencies | the binder generates Kotlin source (`SpecTables.kt`, `SpecFixtures.kt`, hash constants); full-text goldens JVM-only (§ T2.1, § T7.2) |
| C2 | BLOCKING | The decision log's battle-interior grammar | = A4 |
| C3 | BLOCKING | `spec/` location contradicted in four places | `spec/` at the repository root everywhere (§ T2.1, § T4.1, § T13.3, § V2) |
| C4 | BLOCKING | `Stage` in `:engine` needed `:ui` | `StageScene` draw records; `Layout`, `Frame`, `Focusables` in `:engine`; the placement table (§ T2.1) |
| C5 | BLOCKING | The gate did not exist at P0; no PNG contract; cast-wide criteria on six actors; thresholds nobody meets | the input contract and sidecar, the partial-cast rule, calibration against the study and the kit, as P0 deliverables (§ T10.4, § T14) |
| C6 | BLOCKING | The trace was not a grammar (draw index, event fields, driver path, Vault, line endings, doubles) | the record table, path per mode, LF and trailing newline, raw bits (§ T5.3) |
| C7 | BLOCKING | Visual parity of the stage was proved by nothing | the visual-parity band as P4's gate and an L2 check until P8 (§ V3.11, § T14) |
| C8 | GAP | Golden N and size unstated | = A5 |
| C9 | GAP | The binder's file→area mapping, cross-target aggregation and "one commit" state | `paths` per clause; one report per task merged; `spec/matrix.lock` (§ T7.1, § T7.2) |
| C10 | GAP | `lanes.yaml` had no schema; "compare to the workflows" was a new analyser | the schema; the workflows generated from `lanes.yaml` with a diff check (§ T13.5, § V5) |
| C11 | GAP | Golden approval was self-certifying | the sidecar and approver ≠ author (§ V5, D17) |
| C12 | GAP | No CI host, device or minute budget | D18, § T1, the money table |
| C13 | GAP | Fog, motes and shafts missing from the mapping and the parity row | listed in § T2.5, § T9.2, § F1.1 and the parity band |
| C14 | GAP | No plane-cache policy | two biomes resident; a peak-memory budget (§ T9.2, § T9.5) |
| C15 | GAP | The export format unspecified | the manifest field by field (§ T10.9) |
| C16 | GAP | The relic self-test does not exist | = A11 |
| C17 | GAP | Clause granularity and the size of P2/P3 | the granularity rule; the clause count at P2's end and the re-estimate (§ T7.1, § T7.6) |
| C18 | GAP | No infrastructure-failure class or override path | one recorded re-run; the owner's logged override (§ V5) |
| C19 | GAP | `diff-oracle` needs Node inside a 3-minute lane | committed hash lists in L2; `diff-oracle` in L3 and nightly with the Node prerequisite (§ T5.4, § V2) |
| C20 | GAP | The tag's ordering and the read-only rule's scope | the sequence at P2 and the path-scoped guard (§ T4.2) |
| C21 | GAP | The literal port vs the budgets | = A10 |
| C22 | GAP | The rules version derived from the golden set; the save corpus meaningless | explicit `RULES_VERSION`; the corpus re-recorded with it; N and N − 1 tests (§ T11) |
| C23 | NUMBERS | L0 below Gradle's floor | = A16 |
| C24 | NUMBERS | L3 20 min vs the iOS tripwire 25 | L3 ≤ 30 min wall-clock, the iOS job ≤ 20 (§ V2, § T15) |
| C25 | NUMBERS | Atlas ≈ 50 MB; per-element caching | = A18; one bake per actor |
| C26 | NUMBERS | Zero allocation is unattainable in Compose | = A19 |
| C27 | NUMBERS | 52 000 lines | = B28 |
| C28 | NUMBERS | Four vs six spikes; "eight frames" vs seven rendered | seven spikes in both documents; eight comparison frames named (§ T9.4, § T14) |
| C29 | NUMBERS | Wasm in P3's gate; Kotest on non-JVM targets unspiked | Wasm informative until P9; the Kotest spike at P0 (§ T5.2, § T14) |
| C30 | MINOR | `--dump` redefined | `--dump` unchanged; `--trace-hash` added (§ T5.4) |
| C31 | MINOR | The id grammar broken by its own examples | `AREA(-TOPIC)?-NN` with an example per area (§ T7.1) |
| C32 | MINOR | L2 enforced by the agent's skill | the pre-push hook (§ V5, § T13.3) |
| C33 | MINOR | One balance file for two number sets | `state-full.md` and `state-reduced.md` (§ T5.5) |
| C34 | MINOR | Whole runs vs two acts | = B7 |

### D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | The README cited a review log and a convergence that did not exist | the status paragraph (README) |
| D2 | BLOCKING | "Airtight" enforced by the agents it constrains; gate configuration in agent-editable files; self-approved goldens | the pre-push hook, `CODEOWNERS`, approver ≠ author, no bypass token, generated workflows (D17, § V1, § V5) |
| D3 | GAP | The decision log cannot replay a human's battle | = A4 |
| D4 | GAP | Acts 3–6 never driven | = B7 |
| D5 | GAP | The art waits for P6 behind the port; no aggregate; "session" undefined | question 6 (art now); the aggregate and the definition (README) |
| D6 | GAP | Goldens differ by OS | = A2 |
| D7 | GAP | The in-scene rulers and the VFX and backdrop harnesses had no successor | rebuilt from ART-REVIEW's definitions; `vfx`, `backdrops`, `frames` with the rulers (§ V3, § T10.4) |
| D8 | GAP | The feel checklist and the input contract had no successor | = B15 |
| D9 | GAP | Vacuous binding outside `:core` | the assertion rule; Pitest on `:engine`'s pure packages; weak clauses in the matrix (§ T6.3, § T6.5) |
| D10 | GAP | The gate is necessary, not sufficient; no consequence, no fallback | = B2 |
| D11 | NUMBERS | The golden set's N and size | = A5 |
| D12 | NUMBERS | L0 contents; T6.1 vs V2 | = A16 |
| D13 | NUMBERS | Atlas and backdrop sizes; the blur contradiction | = A8, A18 |
| D14 | NUMBERS | 52 000 lines | = B28 |
| D15 | NUMBERS | L3 vs the iOS tripwire; spikes; P5 wording; the nightly-blocks-merges mechanism | = C24, C28, B7; the `nightly-rules` variable (§ V5) |
| D16 | MINOR | F2 read as decided; the transfer maybe unwanted; Renovate weekly; the debug drawer in the functional plan | F2 "proposed, per row"; the transfer optional; Renovate monthly; the drawer in § T13.6 |
| D17 | MINOR | Option B's reversal asserted on the owner's behalf | question 7; option B is the named fallback |
| D18 | MINOR | The verbatim port is not the T6.1 cycle | stated in principle 5 and § T6.1 |
| D19 | MINOR | Separation leaks; the bible duplicated; PvP will reopen TECHNICAL | the dev-hooks row moved; the bible's numbers live in § F3.1 with § T10.4 pointing at them; § T16 reserved |
| D20 | MINOR | Not an hour's read; the approval surface scattered | "What you are approving" (README); the light-rig prose in § T2.5 cut to the mapping; the roadmap appears once in full (README) with § T14 carrying the entry/exit detail |
| D21 | MINOR | Budgets named no machine | machine classes per lane and in the ledger (§ V2, § V7) |
| D22 | MINOR | `pow` and `jsRound` verified for these constants; make them test vectors | the tables are committed test vectors (§ T5.2) |

**Declined or only partly applied (MINOR):** A22's suggestion to keep `spec/` under
`kmp/` — declined in favour of C3's root location, which outlives P8; D20's "cut
TECHNICAL to pointers" — the light-rig prose was cut, but the technical detail the
implementer (C) asked for made TECHNICAL longer, not shorter, and the README now carries
the whole approval surface so the owner need not read it; D16's "drop the transfer" — made
optional rather than dropped, since it is small and the owner decides.

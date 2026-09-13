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
clarity or style. Every BLOCKING and GAP finding was resolved by editing the plan; a NUMBERS finding was
resolved the same way or declined with the evidence; MINOR findings were applied where they cost nothing and are otherwise listed with the reason
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

## Round 2 — on revision 2 (commit `10f9942`)

Four reviewers, 97 findings: 8 BLOCKING, 37 GAP, 21 NUMBERS, 31 MINOR (D's readability
note counted). Round 1's fixes were checked, and five of them were found defective — those
are the BLOCKING rows below. The structural changes revision 3 made because of this round:
the seam's hero turn was placed at step 7 of the turn, after the tick, with the enemy turn a
pending of its own, the extra turn a second decision, forfeit defined and the screen's
pre-tick enumeration listed as a divergence the port fixes (A5, A6, C1, C3, C8); the
self-check became the TypeScript harness's trio of paths with every logged answer carrying
the draws its answerer consumed (A2, C2); the identity model became two accounts — a
non-admin machine user that writes and the owner who alone reviews — with approvals read
through the API and the merge queue dropped for a ruleset (A1, A3, B1, C6, D1); the hosts
were corrected — an x86-64 emulator with KVM in L3, arm64 on the phones or a device farm, one
environment image that is the agents' container, the developer's and CI's, the device runner
fenced to the nightly (A4, A13, B8, B9, C4, C5, D2, D3, D6); the art gate is built in
TypeScript at P0 with the export pinned to the oracle's tag, criterion 6 retired for the
lit-ground ruler, criteria 7 and 8 kept absolute with the aligned criteria calibrated at P0
(A7, A12, B2, B3, B4, C11, C14); the lanes were re-cut — L0 ≤ 8 s, L2 split into a part
measured at P1 and a content-scaled part, the six-act storyboard's playback in L3 and its
skip-playback in the commit lane (A14, B19, C12, C13, D4); the harness gained
`--ascension`, the strong-party fixture, a canonical `--dump` and one stream per cell with
run boundaries, and the cells were recounted (A8, A9, A11, A18, C9, C16, C17); goldens after
the oracle retires need an explained diff (B12); release builds export replays (B13); P8
keeps the live URL alive (B14); the money and effort were restated with a defined session,
the agent compute, the cast's regeneration and a calendar (B6, B23, D8, D13).

### 2-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The merge queue is organization-only; a transfer would move the Pages URL | dropped: a **ruleset** with required checks, always-run shim jobs, up-to-date branches and linear history (D15, § V5) |
| A2 | BLOCKING | Self-check path (c) replayed a log while the policy consumed draws the replay never made | the TypeScript harness's three paths mirrored; every logged answer carries `draws=<n>` and the replay burns them; an app log has `draws=0`; "identical draw count" dropped for replays (§ T2.3, § T5.3, § T11) |
| A3 | BLOCKING | No identity model — one account cannot author and approve | a **non-admin machine user** authors; the owner is the only code owner and reviewer; L3 reads the approving review through the API (D17, § T1, § V5) |
| A4 | BLOCKING | An arm64 Android emulator runs on no hosted runner | the x86-64 emulator with KVM in L3; arm64 ART on the owner's phones nightly or Firebase Test Lab physical devices, priced (§ T1, § V2, README money) |
| A5 | GAP | Where `HERO_TURN` suspends; stunned and BURN-killed actors; the extra turn; forfeit | step 7 after the tick; no pending for an actor that lost its turn; the VIOLENT extra turn is a second `HERO_TURN`; `Forfeit` accepted at any battle pending; the screen's divergences listed (D5, § T2.3, § F1.3, § F1.4) |
| A6 | GAP | Enemy intents and the forecast need per-turn stepping | `ENEMY_TURN { battle, actor, intent }` before each enemy turn, answered by `Continue`, never recorded (§ T2.3, § T5.3) |
| A7 | GAP | The repository's motion criteria are absolute, the plan's aligned; option (b)'s breath scores zero aligned; the bake-off needs fifteen frames | criteria 7 and 8 absolute as defined; new aligned criteria calibrated at P0; option (b) generates thirteen frames plus the procedural idle (§ F3.1, § T10.3, § T10.4) |
| A8 | GAP | No `--ascension`; act-1 fixtures die in acts 3–6; ENRAGE and the fourth skill never exercised | `--ascension` and the strong-party fixture as allowed oracle changes; every pack at its home act, A0 and A5; a long fixture tuned until an ENRAGED turn appears (§ T4.2, § T5.3) |
| A9 | GAP | Multi-run cells shared one stream with no run boundary | one stream per cell in run order; `run <k>` records; the draw index continues across a cell's runs (§ T5.3) |
| A10 | GAP | `minAscensionFor` lives in `game/screens/vault.ts`, outside the freeze and the sim | `META-VAULT-01` in `:core` with the screen's numbers as its vector; the placement listed as a defect the port fixes; `vault.ts` inside the `oracle-frozen` paths (§ T2.2, § T4.2, § F1.4, § V5) |
| A11 | GAP | `--dump` "unchanged and comparable" was a contradiction | a canonical `--dump` on both sides, a harness change at P2 (§ T4.2, § T5.4) |
| A12 | GAP | The art-now option changes the frames the parity band measures | the export is pinned to `ts-oracle-v3`; a web art change re-exports and re-approves (§ T10.9, README question 6) |
| A13 | GAP | A self-hosted runner on a public repository executes fork code | a unique label used only by the nightly workflow on `schedule` and `workflow_dispatch` from `main`; fork pull requests require approval (D18, § V5, § V6) |
| A14 | NUMBERS | L0 at 6–12 s realistically; type-resolved detekt on KMP up to 24 minutes; a six-act storyboard is ≈ 75 000 frames | L0 ≤ 8 s on the touched module only; type-resolved detekt out of L0/L1; the six-act playback in L3, skip-playback and the one-act slice in L2b (§ V2, § V3, § T8) |
| A15 | NUMBERS | A substat value reaches 720; 9 bits overflow | value 10 bits, bytes recomputed; ids regenerated on import (§ T11) |
| A16 | NUMBERS | The full balance basis is ≈ 135 000 runs, ≈ 10 minutes in Node | 10–15 minutes budgeted, nightly (§ T5.5) |
| A17 | NUMBERS | `Screen` maps to PorterDuff below 29 — the D3 argument named the wrong modes | D3 cites `ColorDodge` and `Multiply` only (README D3, § T1) |
| A18 | NUMBERS | The battles cell count did not add up | "one pack per enemy" defined and recounted: the pack sweep ≈ 1 920, the fixture sweep ≈ 1 600 (§ T5.3) |
| A19 | MINOR | `__eq.config` is a getter | `strong=1` seeds `localStorage['ember-quest/vault']` before boot (§ T4.2) |
| A20 | MINOR | The export placed in three phases | P0 everywhere (§ T4.2, § T10.9, § T14) |
| A21 | MINOR | `gate.sh commit` = L0+L1+L2 against pre-commit L1 / pre-push L2 | pre-commit runs L1; pre-push runs `gate.sh commit` = L2a + L2b (§ V2, § V5, § T13.3) |
| A22 | MINOR | P6's "sprite ≥ 8" equals the kit's current score | above the kit's 8 on the same frames, and the value targets met (§ F3.5, README roadmap) |
| A23 | MINOR | Pin the Node version for the oracle and the `pow` table | the environment image's pinned Node generates the table (§ T5.2, § V4) |
| A24 | MINOR | Bakes are already at cell resolution; "collapse" misdescribed them | reworded: atlases kept at cell resolution as today's bakes are (§ T2.5, § T9.3) |
| A25 | MINOR | A strong party does not guarantee a win | the storyboard gate is "reached", never "won"; forcing hooks (§ V3) |
| A26 | MINOR | `partySpd` is also a double | covered by the bits rule (§ T5.2) |

### 2-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | A single GitHub identity; the sidecar read the git author, which is spoofable; the merge queue | = A1, A3; the sidecar names the pull request and L3 reads its approving reviews (§ V5) |
| B2 | BLOCKING | P0's exit needed a gate that only existed in Kotlin from P1 and a PNG-on-stage path never built; the export scheduled in three phases | the gate is built in TypeScript at P0 — `lineup.ts` PNG input with the sidecar contract, the `PixelActor` registry — and the export happens at P0 (§ T4.2, § T10.4, § T10.9, § T14) |
| B3 | GAP | Criterion 6 (≥ 3:1 against the navy) contradicts the value target; the repository moved the law to the lit ground | the in-scene ruler ≥ 1.5:1 at the seats in the pass line; the navy basis retired; calibrated at P0 (§ F3.1) |
| B4 | GAP | Motion bands derived as absolute while alignment was uncalibrated; the criteria-7/8 instruments do not exist | = A7; "rebuilt from ART-REVIEW's definitions, calibrated at P0" (§ F3.1, § T10.4) |
| B5 | GAP | `STATUS.md`'s "Next", `pixel-pipeline.md` and DESIGN's delivery table still said option B until P8 | rewritten, marked superseded and bannered at P0's exit (§ T4.1, README "What stands still") |
| B6 | GAP | The money table lacked agent sessions and the cast's regeneration; no calendar | rows added; the calendar as a cadence — three sessions a week, six to twelve weeks, the closed test inside it (README) |
| B7 | GAP | The closed test's start contradicted between README and TECHNICAL; twelve testers need lead time | it starts on the first P5 build; recruitment starts at P0 with a month's lead (README, § T12, § T14) |
| B8 | GAP | The self-hosted runner on a public repository; is the owner's machine a Mac? | = A13; question 5 asks; hosted macOS plus Firebase Test Lab otherwise (README question 5, D18) |
| B9 | GAP | The agent's container has no JDK, SDK, Gradle or caches; the canonical golden container was not the agent's | the environment image `kmp/ci/env.Dockerfile` is P1's first deliverable with its cold start measured, and it is the agents' container, the developer's and CI's; outside it the golden step reports `SKIPPED-GOLDEN`, never green (§ V4, § V9, § T1) |
| B10 | GAP | The `kmp-quality` rubric's sources are stale generic checklists | written at P1 from `STATUS.md`'s phone section and the critic's first-ten-minutes items; the sources marked stale (§ T13.2) |
| B11 | GAP | A six-act storyboard gated on a win on a fixed seed couples it to balance | forcing hooks like `ko=1`; the gate is every biome, boss and screen **reached** (§ V3) |
| B12 | GAP | After the oracle retires goldens are self-recorded; a bug in the same commit as a clause change freezes | the explained golden diff — with the change disabled the previous hashes reproduce; the changed cells named in the clause with the first divergent line (§ V5, § V8, § T7.3) |
| B13 | GAP | Release builds had no replay export | F2.8: a long-press on the title shares the save; the seed on GAME OVER (§ F2, § T11) |
| B14 | GAP | P8 moves `package.json`, `pages.yml` breaks and the live URL dies | P8 rewrites `pages.yml` to build from `oracle/` until P9 (§ T4.3) |
| B15 | GAP | Orientation must close at P0 | README question 2; F2.3 |
| B16 | GAP | F2.1 "never abandons" against F4.3's REMOVAL; F2.1 is M, not S | F2.1 sized M with the removal exception (§ F2, § F4.3, § T11) |
| B17 | GAP | The eight bloom comparison frames were built to pass | the first-ten-minutes screens plus one hit peak per biome; a threshold per frame class (§ T9.4, § V3) |
| B18 | NUMBERS | P6's gate already met by the kit | = A22 |
| B19 | NUMBERS | Storyboard playback of 66–90 k frames takes minutes | skip-playback measured at P1; the six-act playback in L3 with the one-act slice in L2b (§ V2, § V3) |
| B20 | NUMBERS | The `--dump` contradiction | = A11 |
| B21 | NUMBERS | Substat 10 bits | = A15 |
| B22 | NUMBERS | The bake-off cost formula was wrong | recomputed per provider and in total, ≈ $250 (§ T10.7, README money) |
| B23 | NUMBERS | The session unit was ambiguous; 65 sessions was 20–40× the v3 build | a session defined by hours and agent count, calibrated against v3's three days; 18–36 sessions (README) |
| B24 | NUMBERS | The web has no MED-on-phone rule — `BASE_TIER` is HIGH | the tier row corrected: HIGH everywhere today, MED on phones is a difference the app introduces; the band measured at HIGH and reported at MED (§ F1.3) |
| B25 | NUMBERS | `STATUS.md`'s divergence list has six items | = D12 |
| B26 | MINOR | The inventory omitted the pictograms and the ambient presets; the character limits need the bundled font; the reference frames need a named commit | added to the Presentation row; the limits re-validated at P5; the export pinned to the tag (§ F1.1, § T9.6, § T10.9) |
| B27 | MINOR | A QR code needs a camera permission, a scanner and an association file | paste primary; QR optional with its costs named (§ F2.4, § T11) |
| B28 | MINOR | The `PostToolUse` mechanism | = C22 |
| B29 | MINOR | Alpha detekt in a gate against principle 6; Renovate on owned paths needs the owner | detekt 1.23.x stable, 2.0 when it leaves alpha; one monthly dependency batch (§ T8, README money) |
| B30 | MINOR | The parity phase P3 against P5; hero-turn granularity, forfeit and the crash toggle as rows | § V8 aligned; rows in § F1.3 and § F1.4 |

### 2-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The screen enumerates actions before the tick and the rules after it at step 7; 16.4 % of hero turns differ — a latent oracle bug | = A5; the screen enumerates from the pending; the TypeScript trace emits the pending from inside the wrapped act; the divergence listed (§ T2.3, § F1.4) |
| C2 | BLOCKING | Path (c) replay skipped the policy's draws | = A2 |
| C3 | GAP | The VIOLENT extra hero turn calls the policy with no prompt and throws in the interactive path | a second `HERO_TURN`; listed as a defect the port fixes (§ T2.3, § F1.4) |
| C4 | GAP | The arm64 emulator on no hosted runner | = A4 |
| C5 | GAP | The canonical container undefined; no Docker in sandboxes | = B9 |
| C6 | GAP | Approver ≠ author read a text sidecar | = B1 |
| C7 | GAP | Snapshot resume needs `resumeRun(snapshot)`, a rules-structure change, unspecified and M | specified as entering `runSteps` at a map position, built after parity; F2.1 sized M (§ T11, § F2) |
| C8 | GAP | Enemy intents before they act are impossible if enemy turns run atomically | = A6 |
| C9 | GAP | Multi-run cells share one stream | = A9 |
| C10 | GAP | The generated API, the fixture schema, `matrix.lock`'s format and who commits it | `SpecTables.kt` and the fixture schema (§ T2.1, § T6.2); `matrix.lock` one line per clause, written by L1 in the pre-commit hook and staged (§ T7.2) |
| C11 | GAP | The motion metrics are not in `lineup.ts` | rebuilt from ART-REVIEW's definitions at P0 with the review's published per-actor values as the calibration target (§ T10.4) |
| C12 | GAP | Storyboard "seconds" undefined | frame-stepping with virtual time, rendering only captured frames; skip-playback; the timings synthetic at P1 (§ V3, § V4) |
| C13 | NUMBERS | L0 measured: 3.4–4.0 s compile, 4.5–5.6 s test | L0 ≤ 8 s; V9's rule kept (§ V2) |
| C14 | NUMBERS | The settle band is the absolute diff; aligned would fail fourteen actors | = A7 |
| C15 | NUMBERS | Substat 10 bits | = A15 |
| C16 | NUMBERS | The `--dump` contradiction | = A11; `trace-hash` is the cross-build comparison (§ T5.4) |
| C17 | NUMBERS | 37 × 2 × 20 = 1 480 | = A18 |
| C18 | MINOR | The export in three phases; T4.2's sequence | = A20; the sequence is `--trace`, strong, tag (§ T4.2) |
| C19 | MINOR | `__eq.config` is a getter | = A19 |
| C20 | MINOR | The `:sim` CLI mixed subcommands and flags | one grammar — subcommands with flags (§ T5.4) |
| C21 | MINOR | `paths:` validity only for contract clauses | stated (§ T7.1) |
| C22 | MINOR | The `PostToolUse` hook is synchronous | stated: synchronous, ≤ 8 s, one run per two seconds, reports and cannot block (§ V5, § T13.3) |
| C23 | MINOR | JS numeric comparators need a translation rule | a `Comparator` returning the sign of the same difference; `sortedWith` is stable (§ T5.2) |
| C24 | MINOR | `instruments approve` missing from the list | instrument 7 (§ V3) |
| C25 | MINOR | The synthetic module's shape | generated from the rules' measured function-size histogram, property tests included (§ V9) |

### 2-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | Identities, the admin bypass, the merge queue; which gates need the owner | = A1, A3; the ruleset applies to administrators; the owner-only approvals named per gate (D17, § V5) |
| D2 | GAP | The canonical golden image is not available in the agent's container | = B9 |
| D3 | GAP | The self-hosted runner on a public repository | = A13 |
| D4 | NUMBERS | L2 ≤ 5 min is unprovable at P1 for content-scaled steps | L2 split: L2a measured at P1, L2b content-scaled and measured at P4 and P5, with what moves to L3 named (§ V2) |
| D5 | NUMBERS | The closed test's start | = B7 |
| D6 | NUMBERS | The arm64 emulator's host | = A4 |
| D7 | MINOR | `--dump` uses V8 formatting | = A11 |
| D8 | MINOR | The agent compute row | added (README money) |
| D9 | MINOR | D15 and D3 should be owner decisions; the review load; whether and when the owner reviews | Owner: yes on both; the review-load row in the money table; the owner-only approvals named per gate (§ V5) |
| D10 | MINOR | The README's "Then" row against F4.4 | aligned: from P5 on |
| D11 | MINOR | The keyboard storyboard run missing from L2 | in L2b (§ V2, § V3) |
| D12 | MINOR | `STATUS.md`'s list has six items | six, listed (§ T7.6, § F1.1) |
| D13 | MINOR | Recruiting the testers is a P0 deliverable | = B7 |
| D14 | MINOR | The binder's own tests | V9's first step |
| D15 | MINOR | Verifier blindness | the verifier's worktree at the spec commit; the coordinator runs its tests against the writer's branch (§ T6.3, § T13.4) |
| D16 | MINOR | Register cells are paragraphs; the roadmap appears twice with divergent wording | the two roadmap copies reconciled (the README in full, § T14 the entry and exit conditions); the register partly, see below |

**Declined or only partly applied (MINOR):** D16's "one line per decision" — each decision
stays one table row, but the row keeps its alternatives and its reason because the register
is the approval surface and those are what the owner is approving; B6's calendar is a
cadence and a range, not dates per phase, because the sizes are re-estimated twice (after P1
and P2) and dates written now would be wrong by then; B27's QR code is kept as an option
with its costs named rather than removed.

## Round 3 — on revision 3 (commit `de4e6bd`)

Four reviewers, 73 findings: 1 BLOCKING, 27 GAP, 13 NUMBERS, 32 MINOR. The one blocking
finding was a platform fact: a fine-grained personal token cannot act for a collaborator on
a repository owned by another user, so the "machine user" of D17 could not push (A1).
Seven round-2 resolutions were found defective and are re-resolved below (A2/C1, A3/D1/C18,
B1, B11, B12/D6, C7, C9). Between round 3 and revision 4 the owner also decided to **treat
the prototype as disposable and start from scratch** (README D19); revision 4 therefore
removes the migration machinery — the promotion phase, the Pages path filter, the export of
the prototype's art as the parity baseline, the visual-parity band, the Vault transfer —
and several round-3 findings are resolved by that removal rather than by a fix, marked
"moot under the restart". The structural changes revision 4 made because of this round:
the agents' identity is a **GitHub App** (A1, A13, B4, C10); approvals are pinned to the
head commit with stale approvals dismissed (A3, C18, D1); tags and secrets are protected
by a tag ruleset and a release environment (B2); `spec/**`'s contract clauses, `spec/art/`,
the assets and the prototype are owner-reviewed (B3, D2); the runner lives in a private
repository (B1); the environment is one recipe in two forms with the agents' cloud
environment named as a `setup.sh` host and goldens honest about it (B5, C9, D12); **every
image measurement is one TypeScript tool built at P0**, motion metrics and rulers included
(A2, C1, C2, C3, B6); the golden set gained a stall fixture, a battle cell record and a
machine-readable cell table (A4, A5, C5, C6, C20); `matrix.lock` was dropped for
pull-request-scoped promotion (C7); the fixture schema got a notation (C8); the store
set-up moved to P5 with the production-access step at P7 (B7, D3); the bake-off got a
protocol its arithmetic follows (B12, D6); the session was recalibrated against the git
history (B11); the owner's work is one table with an absence protocol (B8, D10); and the
copyright position of generated art is disclosed (B10).

### 3-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | A collaborator's fine-grained token cannot act on a user-owned repository, so the machine user could not push or open pull requests | a **GitHub App** the owner installs (contents, pull requests, workflows; short-lived installation tokens); a classic-token machine user as the named fallback; the nightly status read through the API instead of a variable write (D17, § T1, § V5, § V9, P0 spike 6) |
| A2 | GAP | The motion metrics and the in-scene rulers did not exist in `lineup.ts` and were scheduled in Kotlin from P1, yet P0 needed them | one TypeScript art tool at P0 with the full metric set, calibrated against the review's published values; no Kotlin re-implementation (§ T10.4, § V3.7) |
| A3 | GAP | An approval survived a later push; nothing pinned it to the head commit | stale approvals dismissed on push; the check requires an owner review whose commit is the head and a sidecar matching the tree; the check runs on review events (§ V5) |
| A4 | NUMBERS | `STALL` appeared in no golden cell | a tuned stall fixture cell (§ T5.3) |
| A5 | NUMBERS | The lapper seeds reach lap 3, not 4 | laps 2–3 stated; one lapper seed chosen at P2 on which a lap-4 run occurs (§ T5.3) |
| A6 | MINOR | The shafts are baked into the light map in the prototype, not drawn per frame | the law carried as "shafts baked into the light map" (§ T2.5, § T9.2) |
| A7 | MINOR | `castSkill` never reaches `ask`; the prototype's `BATTLE` pending has no counterpart | the suspend set corrected; `BATTLE` never recorded, `HERO_TURN` emitted from the wrapped act (§ T2.3, § T5.3) |
| A8 | MINOR | The snapshot omitted run-scoped rule state (the set pool, the dry streak, the accumulators) | the snapshot is the whole run context, enumerated in the `SAVE` clauses (§ T11) |
| A9 | MINOR | `strong=1` forces an A3 run through the Vault floor | stated for the driver and the `RUN-FLOW` clauses (§ T4.2, § V3.2, § T7.4) |
| A10 | MINOR | The macOS host for P0's spikes was unnamed; a Native test binary cannot run on an iPhone without an XCTest wrapper | the owner's Mac or a throwaway hosted-macOS workflow; the iPhone kept for benchmarks and Maestro, `iosSimulatorArm64` the Native arm64 proof (§ T1, § V2) |
| A11 | MINOR | The Gradle timings were not this repository's | attributed to the round-2 scratch measurement (§ V1) |
| A12 | MINOR | Kotlin/Native was not covered by the contraction argument | stated: no fast-math or contraction flags; the simulator hash is the proof (§ T5.2) |
| A13 | MINOR | "The machine user cannot approve" was not a platform fact; an owner-authored PR on an owned path can never be approved | reworded; the owner never authors on an owned path, the logged override is the only other way (§ T1, § V5, D17) |

### 3-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The runner fence stopped forks only; the agents' own pull requests could reach the owner's machine | the runner in a **separate private repository** the App cannot see, on a schedule (D18, § T1, § V5) |
| B2 | GAP | Nothing protected the tags or the signing secrets from the agents' identity | a tag ruleset on `v*` and `oracle-*`; secrets only in a `release` environment; pull-request workflows carry no secrets (D15, § V5, § T12) |
| B3 | GAP | Contract clauses outside goldens and balance were not owner-reviewed | the contract-clause check: a `contract` clause changes or is promoted only with the owner's review on the head commit; `spec/art/`, `spec/golden/`, `spec/balance/`, `assets/**` and `prototype/**` code-owned (§ V5, D7, D17) |
| B4 | GAP | The owner could never merge an owner-authored change on an owned path | the rule that the owner never authors on an owned path; required approvals 0 with the code-owner review; said in question 7 (§ T1, § V5, README) |
| B5 | GAP | The agents' cloud environment could not be assumed to run the image | one recipe in two forms (`env.Dockerfile`, `setup.sh`); the cloud environment runs the script; P0 spike 6 measures it; a self-hosted pool is question 9; goldens are L3's job (§ V4, § T1, § T14) |
| B6 | GAP | The painted option could not pass a pixel-only gate | a reduced gate for look B; normalisation's quantisation and downscale skipped at the bake-off (`FUNCTIONAL.md` § F3.2, § T10.4, § T10.5) |
| B7 | GAP | A closed test cannot roll out without the listing, the privacy policy, the data-safety form and content rating; production access needs an application | the store set-up at P5; the application at P7; fifteen to twenty testers; the reset rule (§ T12, § T14, README) |
| B8 | GAP | The review load is daily in P4–P6, not "a few a week"; nothing said what happens when the owner is away | "What the owner does, by phase" and the absence protocol (README); batching per session (§ V5) |
| B9 | GAP | No unwind if the port is abandoned | moot under the restart and stated: nothing has to be undone (§ T4.3) |
| B10 | GAP | A licence to use is not ownership; wholly generated output is unprotectable | the copyright position and the options disclosed (`FUNCTIONAL.md` § F3.6; README D9, risks) |
| B11 | NUMBERS | The v3 build was one fifteen-hour session, not three to six | the session redefined as 12–16 hours; the calibration stated from the git history; the aggregate a per-phase sum (README) |
| B12 | NUMBERS | The bake-off's formula gave 2 500–5 800 images, not 1 000–1 500 | the protocol — eight key-pose stills per actor, two finalists animated in full — with its arithmetic ≈ 700 per-image generations ≈ $250 with re-rolls and a month's subscription (§ T10.7) |
| B13 | NUMBERS | $100–300 per session at list prices was an order of magnitude low | the row says "covered by the owner's plan; measured on one real session after P1" (README) |
| B14 | NUMBERS | The $4 000 ceiling cannot meter subscriptions or GPU time | the ceiling scoped to per-image API spend; the rest a separate named budget (§ T10.7, README) |
| B15 | MINOR | Five inconsistent sentences (the critical path, P7's gate, two vs four defects, the questions closing at P0, the line count) | reconciled: P0 on the critical path; production access in P7's gate; four defects; five questions at P0; 4 900 lines |
| B16 | MINOR | "The `:core` API can already run a battle with a policy on either side" was false | deleted; the asymmetry stated (`FUNCTIONAL.md` § F5.2) |
| B17 | MINOR | The privacy manifest needs the user-defaults required-reason entry | added (§ T12, § T11) |
| B18 | MINOR | Merges serialise at the merge lane's length under "branches up to date" | one pull request per track per session; stated (§ V5, § T13.5) |
| B19 | MINOR | `STATUS.md`'s header still describes a draft pull request | corrected in the banner commit at P0 (§ T4.1) |
| B20 | MINOR | Approving the plan approves P0's spend | said in "What you are approving" item 6 (README) |

### 3-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | GAP | The P0 gate was scoped to sheet metrics while the bake-off needed motion metrics and rulers that did not exist | = A2 |
| C2 | GAP | The alignment, part travel, crown rise and dead difference were undefined; the bands were both fixed and "recorded at P0"; `spec/art/` was written before the fork closed | the definitions and the band rule (`FUNCTIONAL.md` § F3.1); the bands recorded in the bake-off report and carried into `spec/art/` when it is written (§ T7.5, § T10.4) |
| C3 | GAP | A painted candidate could never reach the owner | = B6 |
| C4 | GAP | The bloom spike needed a prototype engine switch the plan did not list | moot under the restart: the bloom is decided at P5 on the real stage against a platform-blur fallback (§ T9.4, D11) |
| C5 | GAP | P2's coverage gate had no producer at P2 and "appears" was undefined for sets and sigils | `prototype/sim/coverage.mjs` at P2, `sim coverage` at P3; "appears" defined per kind (§ T4.2, § T5.3) |
| C6 | GAP | No record identified a battle cell; no machine-readable cell manifest | the battle `cell` record; `spec/golden/cells.md` as a `data:` table both harnesses read (§ T5.3, § T7.3) |
| C7 | GAP | `spec/matrix.lock` could not be written at pre-commit time and conflicted across worktrees and rebases | dropped: promotion is pull-request-scoped and stateless, checked by the L3 binder run (§ T7.2, § V5) |
| C8 | GAP | No notation declared a `ScreenState` for the fixture generator | the `schema:` block (§ T7.4, § T2.1, § T7.8) |
| C9 | GAP | The environment image was assumed to be the agents' container with no mechanism; the pre-push hook could refuse every push outside it | = B5; SKIPPED-GOLDEN passes the hook with a report (§ V4, § V5) |
| C10 | GAP | The ruleset named required checks before the workflows existed; the approvals count was unstated; the sole code owner could not approve their own change | V9 reordered (workflows and shim jobs first); approvals 0 with the code-owner review; the owner never authors on owned paths (§ V9, § V5, D15) |
| C11 | NUMBERS | The Gradle timings attributed to this repository | = A11 |
| C12 | NUMBERS | detekt's parse failure and slow type resolution were conflated | the two fallbacks made distinct (§ T3, § T15) |
| C13 | NUMBERS | The Node pin did not exist and no step created it | created at P2 in `prototype/.nvmrc` and `engines`, plus the root `.nvmrc` for the art tool; read by the recipe, `pages.yml` and `diff-oracle` (§ T3, § T4.2) |
| C14 | NUMBERS | "About sixteen frames" was fourteen | the ten first-ten-minutes screens plus six hit peaks = sixteen, stated once (§ T9.4) |
| C15 | MINOR | The sidecar had no types; the stage flag, the study PNG and the unblurred-plane page were unnamed | the sidecar typed; `capture.mjs battle pixel=<dir>`; the study at cell resolution and ×4; the unblurred export dropped with the restart (§ T10.9, § T4.2) |
| C16 | MINOR | Where spikes live and run, and how keys and the budget reach agents | `plan/spikes/<n>/REPORT.md`; a throwaway hosted-macOS workflow; keys as environment secrets; the counter in the tool (§ T14, § T10.1) |
| C17 | MINOR | The refusal preamble preceded the freeze; the workflows' path filter did not include the workflows | the freeze is by `prototype/` ownership and the freeze check at P2; the filter includes `.github/workflows/**` and `ci/**` (§ T4.1, § V5) |
| C18 | MINOR | Whether an approval survives a push; the sidecar named a pull request that does not exist yet | = A3; the sidecar names the branch (§ V3.5, § V5) |
| C19 | MINOR | Small conventions an implementer would guess (the `paths` base, the id regex, untagged tests, the tables' module, `displayFullTestPath`, the `.sha256` format, the hash span, hex case, separators, `path=`) | each fixed in § T7.1, § T7.2, § T5.3 and § T6.2 |
| C20 | MINOR | The rules version at P2; no seam-path flag; the fixtures and policies unnamed; the harness changes touch nothing frozen | the oracle tag as the version; `--path`; the eight fixtures and two policies named; stated (§ T7.3, § T4.2, § T5.3) |
| C21 | MINOR | How the `minAscensionFor` vector is produced headlessly | by bundling `vault.ts` with the engine stubbed into a fixture (§ T5.1) |
| C22 | MINOR | The synthetic module's home, its clauses and its deletion | inside `:core` under `spec/synthetic/`, deleted in P3's first commit (§ V9, § T14) |
| C23 | MINOR | The baseline record, the cold-start budget, the second OS and the machine-class names | `plan/BASELINE.md`; ≤ 6 min; the owner's Mac; `agent-env`, `hosted-linux`, `hosted-macos-arm64`, `device-runner` (`FUNCTIONAL.md` § F1.5, § V4, § V7) |

### 3-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | A push after the owner's approval defeated the golden gate; the check had no review trigger | = A3 |
| D2 | GAP | The paths where the owner's decision is promised were not machine-guarded (`spec/art/`, the assets, platform and meta clauses) | = B3; the manifest's accepter matched to the approving review (§ T10.6) |
| D3 | GAP | The closed test started at P5 while the store pipeline and set-up were P7 deliverables | = B7 |
| D4 | GAP | `Forfeit` was a player-facing action FUNCTIONAL never mentioned; round 2's claimed row did not exist | forfeit in the Combat row and the screens' PAUSE with QUIT (`FUNCTIONAL.md` § F1.1, § F1.2); the round-2 entry corrected by this log |
| D5 | GAP | The plan decided on the owner's behalf that the known defects stay in the only playable build | moot under the restart and stated: the prototype is frozen with its defects, said in "What stands still" (README) |
| D6 | NUMBERS | The bake-off count did not multiply out | = B12 |
| D7 | NUMBERS | The bloom's frame set was undefined | = C14 |
| D8 | NUMBERS | P0 was sized M with an M-sized tool inside it | P0 sized L (README, § T14) |
| D9 | MINOR | The WebView alternative was named without a price | "Why not keep TypeScript" with every alternative's price (README item 2, D1) |
| D10 | MINOR | The owner's own work was scattered; overnight sessions cannot merge owner-reviewed pull requests | "What the owner does, by phase" and the absence protocol (README) |
| D11 | MINOR | The questions' closing phases and branch costs were missing | each question names its phase and its price (README) |
| D12 | MINOR | The machine class was an image, not hardware; an absolute perf assertion on shared hosts would flake | machine classes named; the L2a assertion allocation-based and relative; absolute milliseconds on the hosted runner and the phones (§ V7, § T9.5) |
| D13 | MINOR | Pushing workflows needs the Workflows permission | the App holds it (§ T1, D17) |
| D14 | MINOR | Git hooks are bypassable; the critic's score is not a gate | both stated as discipline audited by L3; the critic's protocol (§ V1, `FUNCTIONAL.md` § F3.5) |
| D15 | MINOR | Nine consistency items | reconciled where they survive the restart: the P2 gate names room type and ascension row; `perf` in the instruments; the canvas as rows × columns; question numbers checked; the scores named per use; the crash-report toggle removed until a reporter ships; the device class defined by a first-launch benchmark; the ceiling scoped; the timings attributed; the lock file dropped |
| D16 | MINOR | No save/resume row; F2.1's "no" hid its cost; D6 depended on it; F4 details before P6 fold into the cast | the Persistence row; F2.1 recommended with the cost of "no"; D6 marked contingent; the F4 timing note (`FUNCTIONAL.md` § F1.1, § F2, § F4) |
| D17 | MINOR | The status paragraph gave no trajectory | the three rounds' tallies in the status paragraph (README) |

**Declined or only partly applied (MINOR):** A6's byte-comparable shafts — the law is
carried, but nothing is byte-compared against the prototype under the restart; C19's
`--dump` "over the result records" — adopted as written; D15's "the timings 'taken on this
repository'" — attributed rather than removed, since the harness numbers are this
repository's.

## Round 4 — on revision 4 (commit `8c22896`)

Round 4 ran in two parts. The first attempt lost three of its four reviewers to the model's
usage limit; the blind implementer (C) completed on revision 4 and its 21 findings were
resolved into **revision 5**, on which the adversarial technical (A), the adversarial
product (B) and the owner's advisor (D) reviewers then ran on a lighter model at the
owner's request. Part 1, C: 2 BLOCKING, 5 GAP, 3 NUMBERS, 11 MINOR; 46 round-3 resolutions
checked and holding, one defective (3-B2's tag pattern → C1).

### 4-C — blind, the implementer (revision 4)

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The tag ruleset's pattern `oracle-*` does not match the tag it exists to protect, `ts-oracle-v3` | the pattern is `ts-oracle-*` (D15, § V5) |
| C2 | BLOCKING | A pull request touching only `prototype/**` triggers no KMP workflow, so the freeze check is shimmed green or can never run; nothing ran the prototype's own gates on the P0 and P2 changes | a separate `prototype.yml` on `prototype/**` with no shim: the freeze check and `prototype-check` (`npm ci`, check, build, smoke, `--selfcheck`), both required from P1 (§ T4.1, § V2, § V5, § T14, README) |
| C3 | GAP | The placeholder backdrop was a lit frame that the rig would light again; the plane size and `light.json`'s content were unstated | the capture is the four painters composited **unlit** at the padded 1360 × 800 through a `light=0` dev switch; `light.json` is the `BiomeLook` minus its painters plus the anchors and the pool constants (§ T4.2, § T10.9, § T9.2, D16, `FUNCTIONAL.md` § F3.7) |
| C4 | GAP | The trace's `pending` and `answer` fields were unspecified for twelve kinds, and the interleaving of `draw` and `event` lines was undefined | a per-kind field table, a `party` record and a flush order (§ T5.3) |
| C5 | GAP | The rulers needed anchors no capture wrote, in no schema | the anchors file `<frame>.anchors.json` with its schema, written by `capture.mjs battle … anchors=1` at P0 and by `frames` from P5 (§ T10.4, § T4.2, § V3.3) |
| C6 | GAP | `pixel=<dir>` left the seats, the frames, the flash, the spread ruler's input and `phone=1` to guess | `capture.mjs battle pixel=<dir> party=<ids> pack=<ids> [phone=1] [seat=all] anchors=1` as a stage-only capture, defined (§ T4.2) |
| C7 | GAP | `ci/lanes.json` could not be written by CI or pushed by agents (an owned path, no write token) | the ledger is `lanes.json` in the review bundle, uploaded as a CI artifact and aggregated by the nightly; nothing in the tree (§ T13.5, § T2.1, § V2, § V7, § T14) |
| C8 | NUMBERS | Eight ascension rows and every set bonus and sigil could not "appear" in the listed cells | cells added: `balanced` at A1–A4 and A6–A9 (80 runs) and a set-and-sigil fixture family (28 × 20 battles) (§ T5.3) |
| C9 | NUMBERS | ART-REVIEW.md publishes cast ranges, not a per-actor table; its settle minimum 20.4 % is below the band | the calibration restated against the recorded ranges and maxima; the fallback cast exempt-and-reported (§ T10.4) |
| C10 | NUMBERS | A later character at 90–150 images is $20–60, not $50–150 | corrected (`FUNCTIONAL.md` § F4.3, README money) |
| C11 | MINOR | The move list omitted `README.md`, `DESIGN-REVIEW.md` and `.gitignore`; an empty `.claude/` cannot be committed; the banner commit was unlisted | added; a new root README; the banner commit listed (§ T4.1, § T4.2) |
| C12 | MINOR | The offline sound render needed a page-level shim and unstated formats | the `AudioContext` and `Math.random` shims, three seeds, 48 kHz 16-bit mono, the manifest (§ T4.2, § T9.8) |
| C13 | MINOR | The glyph-table export and the study's path were unnamed | `export-fonts.mjs` → `assets/fonts/<id>.json`; the study under `assets/fallback/study/` (§ T4.2, § T9.6, § T10.9) |
| C14 | MINOR | The band rule was undefined for a partially overlapping interval | p10 below the low or p90 above the high replaces the band (`FUNCTIONAL.md` § F3.1) |
| C15 | MINOR | Only the owner can create the tag and add the required check, and the P2 row did not say so | added to the owner's P2 row (README) |
| C16 | MINOR | The critic's protocol lived in a clause written after the bake-off that needs it | frozen in `plan/spikes/7/CRITIC.md` before the first verdict, promoted at P0's exit (`FUNCTIONAL.md` § F3.5) |
| C17 | MINOR | The spikes' order, spike 4's tree, spike 5's content and the spikes' builds | spike 6 first; spike 4 on spike 2's tree; spike 5's hash defined; standalone builds (§ T14) |
| C18 | MINOR | Two `.nvmrc` files with no agreement rule; `setup.sh` only for Linux; the registry, the digest's route and the image marker unnamed | one version with a lint; `setup.sh` on Linux and macOS; `ghcr.io/<owner>/ember-quest-env`, the digest written by the image workflow's pull request, the marker file (§ T3, § V4) |
| C19 | MINOR | L2b's storyboard step measured at P1 in one place and P5 in another | the storyboard step at P1 on the synthetic storyboard; the content-scaled steps at P4/P5 (§ V2) |
| C20 | MINOR | `ART` clauses had no owner the Kotlin binder could serve; look-B measurement resolution unstated | `owner: tools/art`, the tool parsing its tables and reporting JUnit XML; look B resampled to the cell canvas for measurement (§ T7.1, § T10.5, `FUNCTIONAL.md` § F3.2) |
| C21 | MINOR | No cell id; a runs cell not regenerable from its line; sets and sigils not computable from `config`/`result`; the stall fixture without knobs or an exit | an `id` column and slug; asc/vault/spd on the runs `cell` line; the `party` record; `prototype/sim/fixtures.mjs`; the 200-tunings exit (§ T5.3) |

Part 2 — A, B and D on **revision 5** (commit `f5c3def`), on a lighter model: A 2 BLOCKING,
4 GAP, 2 NUMBERS, 8 MINOR; B 0 BLOCKING, 7 GAP, 6 NUMBERS, 9 MINOR; D 1 BLOCKING, 3 GAP,
1 NUMBERS, 7 MINOR. Round 4 in total: 71 findings — 5 BLOCKING, 19 GAP, 12 NUMBERS, 35
MINOR — resolved in **revision 6**. Both new blocking findings were defective round-4 part-1
resolutions: the prototype workflow that D1 shows would block every other pull request, and
the unlit placeholder that A2 shows cannot come from the render path. The structural changes
revision 6 made: the prototype workflow runs on every pull request with its heavy job
conditionally skipped (D1, A1, A11); the placeholder backdrop is one unlit composite per
biome from the bake path (A2, A8); the plan's own owned-path check is the primary gate on
owned paths with `CODEOWNERS` as a verified second layer (B2), and the art tool is owned
with its calibration a golden (B3); the owner's admin acts at P1 and P5 are in the owner's
table (B1); App Review, the closed-testing track and TestFlight's kinds are in the release
path (D2); the § F2 rows have phases and F2.1 is question 10, closed at P0 (D3, B11); the
character changes and option B are sized and the calendar is a function of capacity (D4,
B5, B9); the portraits have criteria and a fallback, the reference rule is mechanical and
the critic's model is pinned (B4, B6, B7).

### 4-A — adversarial, technical (revision 5)

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | `prototype-check` as specified cannot pass in CI: the smoke gate needs a running server and `npm ci` installs no browser | the command names `playwright install`, a preview server and `SMOKE_URL` (§ V5) |
| A2 | BLOCKING | A `light=0` switch in the render path cannot produce an unlit, four-painter, padded composite: LOW's light is baked, the near painter is not in the flat bake, the render path crops the pad | an `unlit` flag on the bake path; one composite per biome — far, mid and floor at the LOW blur — read from the padded bake canvas; six images for every tier (§ T4.2, § T10.9, § T9.2, D16, `FUNCTIONAL.md` § F3.7) |
| A3 | GAP | A nested `.claude/` is discovered as directory-scoped skills, so the archived prototype skills would still be offered | `prototype/.claude-archive/` (§ T4.1, § T13.2, `FUNCTIONAL.md` § F3.5) |
| A4 | GAP | The fast lanes run on `agent-env`, whose rows never reach a CI artifact, so their budgets had no data source after P1 | the pull-request-opening step pastes the session's rows into the pull request body; L3 re-runs L0–L2 timed on `hosted-linux` (§ T13.5, § V2, § V7) |
| A5 | GAP | The font export dropped `caseFold`, `baseline` and `outlineMinScale` and misnamed `name` | every field exported verbatim (§ T4.2, § T9.6, § T10.9) |
| A6 | GAP | Forfeit is a third rule the oracle cannot cover, and "credited to RETREAT" is presentation, not rules | the split stated (`WIPE` with `forfeit` in the rules, `RETREAT` the screens' label); bound by clause tests; never in a golden (§ T2.3, § T5.3, `FUNCTIONAL.md` § F1.1) |
| A7 | NUMBERS | A set has one bonus at one piece count, so "four pieces also grants the two-piece bonus" was wrong and the cell failed its own coverage definition; room types appear only in `result` | eight 2-piece sets at two, eight 4-piece sets at four; rooms from `result`'s list (§ T5.3) |
| A8 | NUMBERS | Twenty-four placeholders at 6 MB against single planes at 15–40 MB; ARCADE's composite is LOW's | six composites, ≈ 4–10 MB, measured at P0 (§ T9.7, § T4.2) |
| A9 | MINOR | The derived phase had no `DONE` | added (§ T2.4) |
| A10 | MINOR | `working-directory` alone leaves the Pages deploy broken | the three edits named (§ T4.1) |
| A11 | MINOR | The checks were "from P1" in three places and P2 in two; "the P0 captures" cannot be gated; the Node pin arrives at P2 | both required from P1, vacuous until the tag; "the P1 and P2 changes"; Node 22.x until P2 (§ T4.1, § T4.2, § V5, README) |
| A12 | MINOR | The two palette-overlap metrics were conflated and one attributed to `lineup.ts` | the cast and frame-to-frame metrics named; both new (§ T10.4, `FUNCTIONAL.md` § F3.1) |
| A13 | MINOR | 64 × 48 against the 64 × 64 canvas | the canvas 64 × 64; the figure ≤ 48 columns (`FUNCTIONAL.md` § F3.1) |
| A14 | MINOR | No denominator for the motion criteria; "must reproduce" with none | differing cells ÷ the union of the masks; "reproduces, or the definition is recorded as changed" (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A15 | MINOR | The prototype's self-check compares two mechanisms, not three | stated (§ T2.3) |
| A16 | MINOR | Pitch by resampling is not the prototype's pitch; the offline shim must report `running` and avoid the cooldowns | stated: no resampling; the shim's state; one context per (name, seed) (§ T9.8, § T4.2) |

### 4-B — adversarial, product and process (revision 5)

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The owner-only admin acts of P1 and P5 were missing from the owner's table | the rows name them; an absent owner blocks P1 and the first test-track build (README) |
| B2 | GAP | Code-owner review at zero required approvals is contested; the enforcement rested on it | the owned-path check is the primary gate; `CODEOWNERS` a second layer verified in V9's first step (§ V5, § V9, § T1, D15, D17) |
| B3 | GAP | The art tool was not owner-reviewed and its calibration was a one-off report | `tools/art/**` owned; `spec/art/calibration.json` asserted in the commit lane (§ T10.4, § V5, § V6) |
| B4 | GAP | Forty-three portraits with no criteria and no fallback | their criteria; the sprite-head-crop fallback the screens accept (`FUNCTIONAL.md` § F3.3, § T10.4) |
| B5 | GAP | Option B, the stop rule's branch, was unsized | ≈ 8–16 sessions outside the aggregate; question 6 priced both ways; a money-table row (README, `FUNCTIONAL.md` § F3.5) |
| B6 | GAP | The no-third-party-references rule was discipline only | `art generate` accepts only committed asset ids; the gate fails unknown references (`FUNCTIONAL.md` § F3.1, § T10.1, § V1, § V6) |
| B7 | GAP | The critic's model was unpinned and contradicted "the strongest available" | pinned with its version; re-scoring on a change (`FUNCTIONAL.md` § F3.5, § T13.1, § T15, § V6) |
| B8 | NUMBERS | The calibration quoted round-13 ranges against the round-14 tree | the round-14 ranges; palette overlap re-measured; the tag as the reference tree (§ T10.4) |
| B9 | NUMBERS | The three-sessions-a-week calendar was unsupported by capacity the review itself exceeded | the calendar as a function of sessions per week; P1 measures a session; an agent-capacity risk row (README) |
| B10 | NUMBERS | "16–32 sessions to the test tracks" was the number to production access | 11–22 to a test-track build, 16–32 to production access (README item 6) |
| B11 | NUMBERS | P7 was charged with § F2 rows built in P5 | each row assigned a phase; P7 keeps F2.7 (`FUNCTIONAL.md` § F2, § T14, README) |
| B12 | NUMBERS | The alternatives were priced as migrations against a total that includes the rig and the art | the like-for-like note; the rig-in-TypeScript alternative priced (README item 2, D1) |
| B13 | NUMBERS | No Mac row; questions 5 and 6 unpriced | the Mac row; both priced (README) |
| B14 | MINOR | "The ledger" undefined after its file was removed; a re-run's reason had no home | defined once; the reason as a pull request comment or the nightly's issue (§ T13.5, § V2, § V5, § V7) |
| B15 | MINOR | § F4.4's question reference | = D9 |
| B16 | MINOR | Question 3 mixed the demo and the web target | split into (a) and (b) with their phases (README) |
| B17 | MINOR | The Pages workflow's three edits | = A10 |
| B18 | MINOR | "The only irreversible spend" omitted the sessions, the hours and the tester clock | stated (§ T4.3, README) |
| B19 | MINOR | The demo's fixable screen defects were disclosed without the option | question 3(a) offers the fix; "What stands still" says so (README) |
| B20 | MINOR | `STATUS.md`'s three balance diagnoses were not carried | `spec/balance/` proposals with `known-divergence` notes (§ T7.6) |
| B21 | MINOR | A sprite axis ≥ 8 is already met by the rejected kit | ≥ 9 for P4; the discriminators named (`FUNCTIONAL.md` § F3.5, § T14, README) |
| B22 | MINOR | "An absence costs calendar, never rework" ignored the stack's rebase | stated; one pull request per owner-gated path (README) |

### 4-D — blind, the owner's advisor (revision 5)

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | A required check whose workflow triggers only on `prototype/**` stays pending on every other pull request | the workflow runs on every pull request; the freeze check unconditional; `prototype-check` a conditionally skipped job (§ T4.1, § V2, § V5) |
| D2 | GAP | No App Store submission or App Review; the internal track does not run the closed test's clock; TestFlight's kind unstated | App Review at P7 in the deliverables, the gate and the owner's row; Play's closed-testing track; TestFlight internal (§ T12, § T14, README) |
| D3 | GAP | The § F2 rows had no decision moment, and F2.1 must be settled before P3 designs the save format | question 10 at P0; a Phase column per row; P3 designs the `SAVE` clauses around it (README, `FUNCTIONAL.md` § F2, § T14) |
| D4 | GAP | The character changes, the one announced functional change, had no effort price | a Size column in § F4.3; the "Then" row sized (`FUNCTIONAL.md`, README) |
| D5 | NUMBERS | "Ten screens" followed by twelve items | twelve screen states in nine files (`FUNCTIONAL.md` § F1.2, README) |
| D6 | MINOR | The three-second benchmark against the two-second boot budget | the benchmark runs behind the title (`FUNCTIONAL.md` § F2.6) |
| D7 | MINOR | The ceiling equated with a worst case that includes costs outside it | the two numbers separated (§ T10.7, README) |
| D8 | MINOR | The unwind lived only in TECHNICAL | "If the owner stops" in the README |
| D9 | MINOR | § F4.4 cited the wrong question; D3 had no closing moment | § F4.5 cited; D3 approved with item 1 (`FUNCTIONAL.md`, README) |
| D10 | MINOR | No accessibility position | stated in § F6 |
| D11 | MINOR | The status under-reported the disposition and silently set the exit bar | the status names the minor findings' disposition and the bar, and the owner's stricter option (README) |
| D12 | MINOR | The rig-in-TypeScript alternative unpriced | = B12 |

**Declined or only partly applied (MINOR):** A8's "cut the set to 18" — moot, the set is
six; D11's stricter bar — offered to the owner, not adopted by the loop, since a round with
zero minor findings from four reviewers is not a bar any document meets.

## Round 5 — on revision 6 (commit `1180072`)

Four reviewers on a lighter model, 55 findings: 6 BLOCKING, 16 GAP, 11 NUMBERS, 22 MINOR.
The six blocking rows are three defects seen by several reviewers: the P4 gate value that
revision 6 raised to 9 in two documents and left at 8 in the phase table (A9, B1, C8, D1);
the freeze check's command, which exits non-zero with no tag and cannot see tags on a
shallow checkout (A1, C1, B14); and a bootstrap order that proved the review mechanics
before the ruleset, `CODEOWNERS` and the check existed (B2, C2, A5). The gaps were in the
enforcement plumbing and the P0 tooling: the owned-path check could be rewritten by the
pull request it gates (B3), shim jobs could not run under a workflow-level path filter (B4,
A3), the owned-path and contract-clause checks had no review-event trigger and would
deadlock (C3, D8), "branches up to date" would dismiss every approval at every unrelated
merge (A4), the compact relic encoding, the halo and portrait metrics, the strips' geometry
and the environment's equivalence test were undefined (C4, C5, C6, C7, A7), the farm cannot
run Maestro and GitHub's free arm64 runners were never weighed (B7, B8), and the P4 bar was
set against a score taken without the pinned protocol (B6). Revision 7 resolves all of
them; the structural changes: every workflow runs on every pull request with a `changes`
job and self-skipping jobs, no up-to-date rule, the three owner-review checks on review
events and under `pull_request_target` from `main`'s definition, a two-step P1 bootstrap
with two throwaway pull requests, `env-check` over a version manifest, spike 5b on an arm64
runner, and the critic's baseline scored at P0.

### 5-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The freeze check exits non-zero with no tag and a shallow checkout has no tags | `git rev-parse -q --verify … \|\| exit 0` before the diff; `fetch-depth: 0` (§ V5, § T4.1) |
| A2 | GAP | `prototype-check` raced the preview server | `--strictPort` and `wait-on` before the smoke (§ V5) |
| A3 | GAP | Shim jobs inside path-filtered workflows never run | no workflow-level filters; a `changes` job and self-skipping jobs in every workflow (§ T4.1, § V5, D15) |
| A4 | GAP | "Branches up to date" dismisses every approval at every unrelated merge | the rule dropped; a semantic conflict is caught by the post-merge run on `main`, which blocks unrelated merges while red (§ V5, D15, README) |
| A5 | GAP | V9 proved the review mechanics before the artefacts existed; "P1's first step" | the provisional ruleset and `CODEOWNERS`, then two throwaway pull requests at the right places (§ V9, § T1, § V1, D15) |
| A6 | GAP | `bakeFlat` resamples the floor, so the composite cannot carry the crisp floor | far and mid from the unlit `bakeFlat` path, the floor through `bakePlane`'s crisp branch at 1:1 (§ T4.2, § T9.7) |
| A7 | GAP | The recipe's two forms had no drift check and no failure-class row | `versions.env`, the manifest, `gate.sh env-check`; a § V6 row (§ V4, § V6, § V9) |
| A8 | NUMBERS | The settle band is 20–39 since round 12, not 21–39 | corrected (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A9 | NUMBERS | § T14's P4 gate still at 8 | the gate is one above the P0 baseline under the pinned protocol, expected 9 (§ T14, README, `FUNCTIONAL.md` § F3.5) |
| A10 | NUMBERS | The size bands did not match ART-REVIEW's record (hero 52–60, standard 40–50, elite 50–56, bosses 65–93) | the recorded bands, with any change recorded as a decision (`FUNCTIONAL.md` § F3.1) |
| A11 | MINOR | P0's question lists disagreed | one list — 1, 2, 3(b), 6, 7, 8, 10 — in all three places (README, § T14) |
| A12 | MINOR | P5's and P6's clause promotions missing from the owner's rows | added (README) |

### 5-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | The P4 gate value in the phase table | = A9 |
| B2 | BLOCKING | The bootstrap order | = A5 |
| B3 | GAP | The owned-path check ran from the pull request's own head and could be rewritten by it | the three owner-review checks and the generated-workflows check run under `pull_request_target` from `main`'s definition; a § V6 row (§ V5, § V6, D15) |
| B4 | GAP | The shims had no trigger under a workflow-level filter | = A3 |
| B5 | GAP | The App must be installed at P0 for spike 6 | the P0 owner row; "an absent owner blocks the environment spike" (README) |
| B6 | GAP | The P4 bar compared a protocolled score against an unprotocolled 8 | spike 8: the pinned critic scores the prototype's cast at P0; the bar is baseline + 1 (`FUNCTIONAL.md` § F3.5, § T14, README) |
| B7 | GAP | The farm branch exceeds the free quota nightly and cannot run Maestro | priced; the farm covers the hash test and the benchmarks; the Maestro rows SKIPPED (README question 5, § T1, § V2, § V6, D18) |
| B8 | GAP | GitHub's free arm64 Linux runners were never weighed | spike 5b; an arm64 JVM leg in L3 if it passes; the phone's role narrowed (§ T1, § T5.2, § V2, § T14, D18, README) |
| B9 | NUMBERS | D12 still said "pitch by resampling" | corrected (README D12) |
| B10 | NUMBERS | P0's deliverable lists omitted questions 10 and 3(b) | = A11; question 3 split in the owner's table |
| B11 | NUMBERS | "11–22 to the test tracks" omitted P4's capacity | 13–26 of capacity, 11–22 of depth; the first build during P5 (README) |
| B12 | NUMBERS | Option B's 8–16 rested on an unmeasured speed-up | the masters ≈ 8–12 at the measured rate, the derived frames unmeasured, measurable at P0 (README, `FUNCTIONAL.md` § F3.5) |
| B13 | NUMBERS | "Two days earlier" was one day | "the day before" (README) |
| B14 | MINOR | The freeze command's guard and checkout | = A1 |
| B15 | MINOR | The README's P1 gate promised more than P1 measures | "P1-measurable" (README) |

### 5-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The freeze check's command | = A1 |
| C2 | BLOCKING | The bootstrap order | = A5 |
| C3 | BLOCKING | The owned-path and contract-clause checks had no review-event trigger and would deadlock | the sentence above § V5's table: all three checks run on review events (§ V5) |
| C4 | GAP | The compact relic encoding was never defined | a row in the trace table (§ T5.3) |
| C5 | GAP | The halo check and the portrait metrics had no formulas | formulas and statuses (§ T10.4, `FUNCTIONAL.md` § F3.3) |
| C6 | GAP | The strips' rows and x-window were unstated | stated once (§ T10.4) |
| C7 | GAP | "Proven equivalent" had no criterion | = A7 |
| C8 | NUMBERS | The P4 gate value | = A9 |
| C9 | NUMBERS | § F3.7 said four painters per biome and tier | far, mid and floor; six images (`FUNCTIONAL.md` § F3.7) |
| C10 | MINOR | P0's question lists | = A11 |
| C11 | MINOR | "Every analyser configuration" was not a glob | literal globs (§ V5) |
| C12 | MINOR | The `changes` job and the shims unspecified | specified (§ T4.1, § V5) |
| C13 | MINOR | `setup.sh` read a `.nvmrc` that does not exist until P2 | "22.x until the pin" (§ V4) |
| C14 | MINOR | `--path c` has no prototype counterpart | `--path a\|b` on the prototype, `a\|b\|c` in `sim` (§ T4.2, § T5.4) |
| C15 | MINOR | The sound render's length and trim | stated (§ T4.2) |
| C16 | MINOR | The `:core` exemption described two ways | reconciled: a module-wide suspension plus the per-function reason (§ T5.1) |
| C17 | MINOR | `device-runner` rows never reached the ledger | appended to the nightly's issue (§ V5, § T13.5) |
| C18 | MINOR | Palette overlap had no formula | defined (`FUNCTIONAL.md` § F3.1) |

### 5-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | NUMBERS | The P4 gate value | = A9 |
| D2 | MINOR | D12's resampling; "two or three variants" | = B9; three (§ T9.7) |
| D3 | MINOR | P0's question lists | = A11 |
| D4 | MINOR | Question 10's "no" branch written three ways; F2.7 and the corpus not marked contingent | one statement in question 10, echoed in D6; F2.7 and § T11's corpus contingent (README, `FUNCTIONAL.md` § F2) |
| D5 | MINOR | "Top ten" with eleven rows | "Risks" (README) |
| D6 | MINOR | The App installed at P1 but needed at P0 | = B5 |
| D7 | MINOR | The P2 owner row omitted the harness pull requests | added (README) |
| D8 | MINOR | The review-event trigger and the "or a contract clause" rule | = C3; the rule widened (§ V5, D17) |
| D9 | MINOR | D3's blend-mode fact unspiked and unpriced | spike 1 covers it; the reach cost and the rejected alternative stated (README D3, § T14) |
| D10 | MINOR | § F6 absent from the approval surface | item 8 of "What you are approving" (README) |

**Declined or only partly applied (MINOR):** none declined; A4's content-addressed approval
was not adopted — dropping the up-to-date rule is simpler and the post-merge run covers
the case it protected.

## Round 6 — on revision 7 (commit `ad63359`)

Four reviewers on a lighter model, 59 findings: 5 BLOCKING, 14 GAP, 6 NUMBERS, 34 MINOR.
The five blocking rows are mechanical defects in text that revision 7 introduced: the
anchors file's two frame-level strips could not hold a per-seat rule that yields three
pairs (C1, A11); `env-check` compared a marker field that only the image has, so P1's exit
could never be met on a host (C2, A2); the battles cell record carried no seed although the
oracle regenerates a cell from that line alone (C3); `setup.sh` read a `.nvmrc` that does
not exist until P2 (C4); and the three owner-review checks were told to run both on
`pull_request_review` events and under `pull_request_target`, which are mutually exclusive
— round 5's B3 and C3 were applied in one sentence and cancelled each other (B1). The gaps:
the calendar was derived from agent capacity alone and never from the owner's review
latency over fifty to sixty owned-path pull requests (B2, B7); P6's gate was still an
absolute 8 that the rejected prototype already meets (B3, D6); P0 calibrates every later
art gate's instrument before `main` is protected and resolves every disagreement in the
tool's favour (B4); question 3's fix session hung off a question that closes at P7 (B5); the
trace's SUMMON row omitted the one field the policy reads (A1); the first bootstrap step
depended on later ones (A3); a "most recent push" setting was listed with no meaning at
zero approvals (A4); the seat ruler had no mask, the ramps no data, the coverage gate an
unrecordable kind, the golden table no optional type, `env-check` no hook and no lane, and
"the failing area" no definition (C5–C10). Revision 8 resolves all of them; the structural
changes: the owner-review checks run under `pull_request_target` only, from `main`'s
definition, and a tiny review-event workflow re-dispatches them on the head commit; the
calendar is the larger of two terms, agent capacity and review latency, with the
owner-gated pull requests counted per phase; P4's and P6's gates are baseline + 1 per axis
against P0's pinned-critic baselines, capped at 9; P0's artefacts are the fifth item on §
V1's discipline list, with an adjudicated calibration and a second reader at P1; the
environment recipe writes two manifests and compares every field but the marker; the
anchors file is per seat with a mask per seat and a pose and frame; `.nvmrc` exists from
P0's move commit; question 3 is three questions.

### 6-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The trace's SUMMON row printed a relic that does not exist and omitted `favored`, the one field the policy reads | `offers=<id>:<favored 0\|1>,… dominant=<ELEMENT>`; the full-party EPIC card is rolled after the answer and shown as its own `RELIC` pending (§ T5.3) |
| A2 | GAP | `env-check` compared the image marker, which only the image has, so P1's exit could never be met on a host; the image's manifest had no home | every field but `marker` is compared; the image writes `ci/env/manifest.image.json` (committed), a host writes `build/env/manifest.json` (§ V4, § T2.1, § V9) |
| A3 | GAP | The first bootstrap step depended on `gate.sh`, `lanes.yaml`, the ledger and a pull request, which come later | the image is built at P0 (spike 6); the pin, `env-check` and the cold-start measurement follow `lanes.yaml` and the ledger in § V9's order (§ V9, § T14) |
| A4 | GAP | "Approval required on the most recent push" beside "required approvals 0" had no stated meaning, was absent from D15 and untested | the setting is not used — the owned-path check pins the approval to the head commit; D15 lists every setting the ruleset carries (§ V5, README D15) |
| A5 | NUMBERS | Question 6 priced option B at ≈ 8–16 sessions against ≈ 8–12 in the money table and § F3.5 | 8–12 for the masters, the derived frames unmeasured (README question 6) |
| A6 | MINOR | "Up-to-date branches serialise merges" beside "no up-to-date requirement" | the residue removed (§ V5) |
| A7 | MINOR | The ledger had two sources in § V7 and three in § T13.5; `device-runner` rows missing from § V7 | one three-source definition in both (§ V7, § T13.5) |
| A8 | MINOR | `env-check`'s lane stated three ways | L0 and L3 name it; § V4 and § V6 agree (§ V2, § V4, § V6) |
| A9 | MINOR | "Every pending kind appears" could not hold: `BATTLE` and `ENEMY_TURN` are never recorded | the coverage gate exempts `FORFEIT`, `ENEMY_TURN` and `BATTLE` in one sentence (§ T5.3, § T14) |
| A10 | MINOR | The halo criterion contradicted itself | "at most two cells in the ring, none elsewhere" (§ T10.4) |
| A11 | MINOR | One global `strips` pair against a per-seat rule; the geometry differed from the ART-REVIEW convention it cited | strips per seat entry; the ruler's geometry re-derived from the convention and recorded (§ T10.4) |
| A12 | MINOR | The compact relic encoding dropped `rolls`, which drives RECAST; `result` included `probes` | `/<rolls>` appended; `result` excludes `probes` and the Kotlin-only fields (§ T5.3) |
| A13 | MINOR | `spec/fixtures/meta/min-ascension.json` fitted no fixture rule and `:core` tests may not read files | fixtures are generated per area (`spec/fixtures/<area>/…`), `meta` included (§ T2.1, § T5.1) |
| A14 | MINOR | The stage-only `pixel=` capture had no harness in the prototype | `prototype/tools/stage.html`, a fixture page that draws the six seats at a pose, frame and tier, listed among the allowed prototype changes (§ T4.2) |
| A15 | MINOR | The P4 bar "baseline + 1" had no ceiling | capped at 9 (`FUNCTIONAL.md` § F3.5, § T14, README) |

### 6-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | The three owner-review checks were told to run on `pull_request_review` events and under `pull_request_target`, which are mutually exclusive; on the review trigger the gate is rewritable by the pull request it gates | the checks run under `pull_request_target` only, from `main`'s definition; a tiny `pull_request_review` workflow that touches nothing re-dispatches them on the head commit; the second throwaway pull request tests both halves (§ V5, § V9, D15) |
| B2 | GAP | The calendar was derived from agent capacity alone; fifty to sixty owner-gated pull requests set a floor it never accounted for | the calendar is the larger of two terms; the owner-gated pull requests counted per phase; the floor at one sitting a day; P1's exit re-derives both (README) |
| B3 | GAP | P6's gate was an absolute 8 on every axis, which the rejected prototype's 8·8·8·8·7 already meets | baseline + 1 per axis, capped at 9, against P0's per-axis full-frame baseline (README, § T14) |
| B4 | GAP | P0 builds and calibrates the instrument every later art gate depends on before `main` is protected, and the calibration rule resolves every disagreement in the tool's favour; § V1 omitted P0 | P0's artefacts are the fifth item on § V1's discipline list; a disagreement between the tool and the eye is recorded and signed off by the owner, never resolved by the band alone; a second reader re-scores the sheet at P1 (§ V1, § T10.4) |
| B5 | GAP | Question 3(a)'s fix session hung off a question that closes at P7, outside the allowed prototype changes and every phase's size | question 3 split: (a) the demo's future at P7, (b) the frozen tag at P0, (c) the two screen defects at P0 as an optional, sized fix pull request inside the allowed changes (README question 3, § T4.2) |
| B6 | NUMBERS | Option B's price in question 6 | = A5 |
| B7 | NUMBERS | The P1 owner row said five to ten pull requests against § V9's ~15 steps | about fifteen pull requests in about eight review milestones (README P1 row, § V9) |
| B8 | NUMBERS | The five-run daily quota is Spark's, which cannot be exceeded; Blaze's terms differ and the nightly cost more than stated | Spark 5 physical runs a day, no overage; Blaze 30 device-minutes a day then ≈ $5 per device-hour; the nightly priced on those terms (README money table, question 5, § T1) |
| B9 | NUMBERS | "48 of the 64 columns" was recorded nowhere | at most 64 columns (`ACTOR_W`), the derivation recorded (`FUNCTIONAL.md` § F3.1) |
| B10 | MINOR | The portrait branch's ruler re-derivation and the P0 stage's portrait frames were named but not sized or phased | question 2 sizes and phases both (README question 2) |
| B11 | MINOR | Question 10's "no" branch did not say it loses every reproducible bug report from release builds | said (README question 10) |
| B12 | MINOR | The critical path silently assumed question 4's recommended branch | "(14–28 if P7 waits for P6, question 4)" (README) |

### 6-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | Two frame-level strips could not hold a per-seat rule that yields three pairs | = A11 |
| C2 | BLOCKING | `env-check`'s marker field and the image manifest's missing location | = A2 |
| C3 | BLOCKING | The battles cell record carried no `seed=` | `seed=<uint32>` in the battles form (§ T5.3) |
| C4 | BLOCKING | No `.nvmrc` exists, yet `setup.sh` (P0) and the prototype check (P1) read it | P0's move commit creates `.nvmrc` = `22` at the root and in `prototype/`; P2 pins the exact version (§ T2.1, § T4.1, § V4) |
| C5 | GAP | The seat ruler needs the actor's mask and nothing produced one | each producer writes `<frame>.masks/<seat>.png`; the anchors entry names `pose` and `frame` (§ T10.4) |
| C6 | GAP | The ramps existed only in words; ΔE was unqualified | `export-ramps.mjs` writes `spec/art/ramps.json` at P0; ΔE is CIE76 in Lab (§ T4.2, § T10.4, `FUNCTIONAL.md` § F3.1) |
| C7 | GAP | `ENEMY_TURN` is never recorded but the coverage gate required it | = A9 |
| C8 | GAP | `cells.md` spans two cell kinds with disjoint columns and the binder had no optional type | optional types (`int?` and the rest) in the binder's vocabulary (§ T2.1, § T5.3) |
| C9 | GAP | `env-check`'s lane stated three ways and the hook's matcher never fired on `ci/env/**` | `ci/env/**` in the PostToolUse matcher; L0 and L3 list `env-check` (§ T13.3, § V2) |
| C10 | GAP | "The failing area" was never defined | the post-merge run publishes the `changes` booleans its failed jobs depend on as a commit status on `main`; L3 fails a pull request whose own outputs do not intersect them (§ V5) |
| C11 | MINOR | Five lane ids for six budgeted lanes | `commit-a` and `commit-b` (§ T13.5, § V2) |
| C12 | MINOR | `lanes.json` had no timestamp | `started_at` (§ T13.5, § V7) |
| C13 | MINOR | The ledger's two sources then three | = A7 |
| C14 | MINOR | The `changes` outputs had no path mapping; assets, the art tool and `ci/**` belonged to none | the booleans and their globs stated, `assets`, `art-tool` and `ci` added (§ T4.1, § V5) |
| C15 | MINOR | Path (c) described two ways | the headless `RunHost` in `:sim` (§ T2.3, § T4.2, § T5.4) |
| C16 | MINOR | The `result` field set would move every battles-cell hash if it followed the Kotlin type | pinned to the oracle's `types.ts` fields; Kotlin-only fields excluded (§ T5.3) |
| C17 | MINOR | `min-ascension.json` reached no target under the screen-keyed fixture rule | = A13 |
| C18 | MINOR | `;` joined both a relic list and the `party` record's entries | the `party` entries are space-separated and a relic list is bracketed `[…]` (§ T5.3) |
| C19 | MINOR | The frozen calibration sheet had no committed location | `spec/art/calibration-sheet/*.png` (`FUNCTIONAL.md` § F3.5, § T14) |
| C20 | MINOR | The Pages workflow's `node-version-file` switch was in no P2 list and `node-version` had to go with it | both in the P2 list (§ T4.1, § T4.2, § T14) |

### 6-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | NUMBERS | Option B's price in question 6 | = A5 |
| D2 | MINOR | The ledger defined two ways | = A7 |
| D3 | MINOR | The README's first paragraph and § F6 contradicted D19's list of what survives | both use D19's list (README, `FUNCTIONAL.md` § F6) |
| D4 | MINOR | F2.7 was phased P7 with a P5 rationale | F2.7 at P5 with the first test-track build (`FUNCTIONAL.md` § F2, README, § T14) |
| D5 | MINOR | `ENEMY_TURN` and the coverage gate | = A9 |
| D6 | MINOR | P6's absolute gate | = B3 |
| D7 | MINOR | The port template's `@Suppress` reason fitted neither form the rule accepts | `expires #<the P3-gate issue>` (§ T8.1) |
| D8 | MINOR | The bootstrap window contradicted "never authors" and `prototype/**` was called owned from P0 | the bootstrap exception stated once; `prototype/**` owned from P1; the P0 owner row says the owner looks at the ~7 prototype commits (§ V5, § T4.1, README) |
| D9 | MINOR | One hand-written GOLDEN clause per cell is ≈ 218 clauses | one generated clause per cell family (§ T7.3) |
| D10 | MINOR | Two wordings of the later-character price | "including re-rolls and the portrait" in both (`FUNCTIONAL.md` § F4.3, README) |
| D11 | MINOR | `config/` and `gradle/` absent from the tree | added (§ T2.1) |
| D12 | MINOR | "D15–D18" cited D16, which is backdrops | "D15, D17–D18" (README) |

**Declined or only partly applied (MINOR):** none declined.

## Round 7 — on revision 8 (commit `a54341b`)

Four reviewers on a lighter model, 69 findings: 3 BLOCKING, 27 GAP, 9 NUMBERS, 30 MINOR.
The count rose because the reviewers reached ground the plan had not covered, not because
revision 8 broke: the three blocking rows are one wrong source file (the ramps export named
`parts.ts`, which holds only the type; C1), one leftover trigger contradiction (a
`workflow_dispatch` re-dispatch with no such trigger, and a Goldens row still on review
events; C2, A4), and one criterion the prototype's own record had moved — the in-scene
contrast ruler, which ART-REVIEW's coordinator decision after round 13 makes the scene
owner's number and which revision 8 still gated every generated sprite on (A1). The gaps
fall in four groups. The stores and the testers: the calendar had no term for the closed
test's lead time (B1), there was no crash or usage signal and no tester channel (B7, D3),
no host for the privacy policy (B8), no steady-state row (B9). The art programme's money
and bars: the $4 000 counter had no home and no stop branch (B2), a baseline already at 9
made the cap the bar (B3), the critic's protocol was not on the discipline list (B4),
P6's planes had neither criteria nor a budget (B6, D2), the painted branch had no shipping
resolution (D4). Enforcement: `plan/**`, `.claude/**` and `CLAUDE.md` were not owned paths
(B5, D1) and the re-estimates were nobody's decision (D5). The specification:
`BattleResult`'s record was unwritable (A2, C4), the ground strips sampled the next seat's
body (A3), the Vault floor as a rule of the game would have refused the golden cells (C3),
the sheet metrics had no p50 (C5), the sound render had no page (C6), the emulator spikes
no host (C7), the accepted actors no sidecar (C8), the gate workflow no tree entry (C9),
and L3's `env-check` nothing to compare (C10, A6). Revision 9 resolves all of them and
declines one minor (D17). The structural changes: the owner-review checks post as check
runs through a dedicated gate App whose key only a `main`-only environment holds and are
required from that App, with `pull_request_target` plus `workflow_dispatch` as the only
triggers; the calendar is the largest of three terms, counted in review sittings; every
axis of the critic has an owning phase; the in-scene ruler is the stage's; the spend
counter is a committed file behind provider-side caps; the plan and the rubric are owned
paths; the stores' own crash signal and a testers' channel replace "crash reporting:
none".

### 7-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | Every generated sprite was gated on actor-median-vs-ground ≥ 1.5:1, which the prototype's record after round 13 makes the scene owner's number: over the derived pools' ground no ramp clears it without breaking the enemy ceiling | the in-scene ruler is reported for a sprite and gated for the stage at P5 and P6; its bar is re-derived at P0 on the landed rig (`FUNCTIONAL.md` § F3.1, § F3.4, § T10.4) |
| A2 | GAP | `BattleResult` has `probe` (singular) and a `Party` object, so the battles `result` record was undefined | `won stall enraged actorTurns`; `probe` via the `probe` record; `party` via a closing `party` record with `:<hp>` per hero (§ T5.3) |
| A3 | GAP | The ground strips never excluded the neighbouring seats' masks, which the 68-px row pitch puts inside them | every cell under another seat's mask is excluded; a seat keeping under half its columns is reported, never gated (§ T10.4) |
| A4 | GAP | The Goldens row still ran the check on `pull_request_review` events | the row names the owner-review workflow, re-dispatched on review events (§ V5) |
| A5 | GAP | P6's gate spanned five axes of which P6 delivers two; P5 had no critic gate | P5 owns the UI and VFX axes, P6 the scene and composition axes, each with a no-regression rule on the rest; all five recorded at P5's end (README, § T14, `FUNCTIONAL.md` § F3.5) |
| A6 | GAP | The manifest was named two ways and L3's `env-check`, inside the image, had nothing to compare | one manifest sentence; L3's `env-check` job runs `setup.sh` on the bare runner (§ V4, § V2, § V6) |
| A7 | NUMBERS | The merge-lane p95 budget was justified by medians, on a runner row 1 exempts from absolute milliseconds | the row records the absolute p95 against a provisional median × 1.25 and asserts only the relative rule; the device lane asserts absolutes (§ T9.5) |
| A8 | MINOR | "`__eq` is read-only" is false | "`__eq` exposes a live run's objects but cannot compose a stage" (§ T4.2) |
| A9 | MINOR | The calibration named a tag that exists two phases later | "at P0's frozen tree — the round-14 cast, the tree P2 tags `ts-oracle-v3`" (§ T10.4) |
| A10 | MINOR | A `PostToolUse` matcher selects tools, not paths | the hook matches the `Edit` and `Write` tools and filters the edited path itself (§ T13.3) |
| A11 | MINOR | The image build was in § V9's first step but in no spike | spike 6 builds the image once; P1 rebuilds it by its own workflow and pins the digest (§ T14, § V9) |
| A12 | MINOR | The merge queue's absence on a user-owned repository was uncertain | verified against GitHub's documentation (organization-owned repositories only) and dated; a queue, if ever offered, would make the post-merge machinery optional (README D15, § V5) |
| A13 | MINOR | `<MAIN><value>` did not say base or derived | `<MAIN><base>` is `Relic.main.base`, never `mainValue()` (§ T5.3) |
| A14 | MINOR | L2a's budget was measured at P1 on content it does not have until P3 | re-measured at P3 against the recorded goldens and the reduced snapshot (§ V2) |

### 7-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The calendar had no term for the stores: the testers' lead, Play's first review, the fourteen days, the production-access review and App Review put P7 about four weeks after the first test-track build whatever the agents do | the third calendar term, stated with its parts; P7 no sooner than about four weeks after the first test-track build (README effort, item 6, P7 rows; § T14) |
| B2 | GAP | The $4 000 counter "lives in the tool" across worktrees with no provider cap and no branch for reaching it | provider-side caps or prepaid credits per key; the counter is `assets/spend.json` under the owner's review; reaching it is a third stop trigger and a mixed cast is approved by name (§ T10.1, § T10.7, `FUNCTIONAL.md` § F3.5, README money table) |
| B3 | GAP | "Baseline + 1, capped at 9" equals the baseline when an axis comes back at 9 | a baseline already at 9 makes that axis's bar an owner decision recorded before the phase (README P4 and P6 rows, § T14, `FUNCTIONAL.md` § F3.5) |
| B4 | GAP | The critic's protocol and the per-axis baselines, which set every later bar, were on neither § V1's list nor the P0 owner row | both on § V1's list, README principle 10 and the P0 owner row |
| B5 | GAP | `.claude/**` and `CLAUDE.md`, which hold the rubric the felt rows are scored against, were not owned paths | `.claude/**`, `CLAUDE.md` and `plan/**` (except `plan/spikes/**`) are owned paths (§ V5, § V6, README D17, the risk row) |
| B6 | GAP | P6's "painters or AI-generated planes" was never scheduled as a decision, had no plane-shaped gate and no money line | painters are the default; generated planes only if question 4 approves them by name, judged by the scene rulers, the critic and the owner, under a $500 ceiling with a money-table line (`FUNCTIONAL.md` § F3.7, README question 4, money table, P6 rows, § T10.7, § T14) |
| B7 | GAP | Twelve to twenty testers on unknown handsets with no crash signal and no reporting path | the stores' own crash signal — Android vitals, the pre-launch report, TestFlight's crash logs — with no SDK; the testers' channel named in the listing; triage an S inside P5 and P7 (§ T12, § T14, README P5 and P7 rows) |
| B8 | GAP | The privacy policy needs a public host for the app's whole life and the only web property is the frozen demo question 3(a) may retire | `docs/privacy.md` published by the Pages workflow at `/privacy/`; the site stays up either way (§ T12, § T4.1, § T2.1, README question 3 and the P5 owner row) |
| B9 | GAP | Nothing after P8 keeps two listings alive | a steady-state roadmap row (≈ one session a quarter plus the annual target-SDK bump) and a recurring money line (README, § T14) |
| B10 | NUMBERS | § T1 still said the five-run quota could be paid past | § T1 carries the Spark and Blaze terms (§ T1) |
| B11 | NUMBERS | The per-phase enumeration summed to 44–52, mixed milestones with pull requests, and omitted P0, P7 and the cadence | counted in review sittings, P0 and P7 included, 50–58 at one sitting a weekday (README) |
| B12 | NUMBERS | The subscription provider's price and allowance were never named and option (a) rested on unconfirmed terms | the plan, price and allowance are read at P0's terms check; the arithmetic's assumption is stated; option (a) is in the bake-off only if the terms pass (§ T10.7, § T10.2, README money table) |
| B13 | NUMBERS | Question 8's "half a session" omitted the second repository's ruleset, `CODEOWNERS`, App, tag ruleset, freeze workflow and the submodule pin | one to two sessions with the plumbing named, or half a session with the prototype unprotected (README question 8) |
| B14 | MINOR | 3(c) was absent from both P0 rows; the study from D19 and the P0 capture list | added (README, § T14) |
| B15 | MINOR | P6's five-axis gate | = A5 |
| B16 | MINOR | No store row in the README's risks | a store row with the tripwire "opted-in testers below fourteen; any rejection notice" (README; § T15's tripwire) |
| B17 | MINOR | Question 10's yes was priced two ways | one price (README question 10, `FUNCTIONAL.md` § F2.1) |

### 7-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `export-ramps.mjs` read `parts.ts`, which holds only the `Ramp` type; the ramps are private constants in `actors.ts` | `ELEMENT_RAMPS` and `NEUTRAL` from `game/art/actors.ts`, exported in the same pull request (§ T4.2) |
| C2 | BLOCKING | "Only under `pull_request_target`" beside a `workflow_dispatch` re-dispatch and a Goldens row on review events | one trigger set — `pull_request_target` plus `workflow_dispatch` with the pull request number — and the Goldens row's clause removed; both workflow files named (§ V5) |
| C3 | GAP | The Vault floor "as a rule of the game" would refuse the golden cells recorded at A0 with three Vault relics | `minAscensionFor` is a pure function the screens clamp with; `runSteps` accepts any `RunConfig`, as the oracle does (§ T2.2, `FUNCTIONAL.md` § F1.1, § F1.4) |
| C4 | GAP | The battles `result` record | = A2 |
| C5 | GAP | The P4 target reads p50, which no lifted metric computes | p50 added to the metric list (§ T10.4) |
| C6 | GAP | `render-sfx.mjs` had no page exposing the synthesizer | `prototype/tools/sfx.html`, a fixture page exposing `render(name, seed)` (§ T4.2) |
| C7 | GAP | Spikes 1 and 5 need an Android emulator and § T1 named a P0 host only for macOS | a throwaway hosted-Linux workflow with KVM (§ T1, § T14) |
| C8 | GAP | Accepted actors had a manifest but no per-frame sidecar, which the gate, the atlas and the stage need | `assets/actors/<ID>/` carries the same `<pose>-<frame>.json` sidecar, written by `art accept` (§ T10.6) |
| C9 | GAP | The owner-review workflow and its re-dispatch were in no tree listing and no § V9 step | named in § T2.1's tree and created beside `lanes.yaml` in § V9 |
| C10 | GAP | L3's `env-check` compared the image with itself | L3's job runs `setup.sh` on the bare runner; the image workflow compares the rebuilt image with the committed manifest (§ V4, § V6) |
| C11 | NUMBERS | The sittings arithmetic | = B11 |
| C12 | MINOR | 3(c) in the P0 lists; `paths` in the README's P2 gate | added (README, § T14) |
| C13 | MINOR | The 64 columns cited `ACTOR_W`, which is 128 screen px | `ACTOR_PART = 64` cells, `ACTOR_W` its 128 px (`FUNCTIONAL.md` § F3.1) |
| C14 | MINOR | `PoolLight` has no pad field | "the pools' colour, ellipse, alpha and `actorWeight`" (§ T4.2) |
| C15 | MINOR | `pack=<id>` for a `+`-joined list, and a fixture name with a space | `pack=<enemy ids '+'-joined>`; every field and the slug space-free (§ T5.3) |
| C16 | MINOR | Base or derived main | = A13 |
| C17 | MINOR | The calibration example (20.4 %) is inside the 20–39 band | a settle of 19 %, outside it (§ T10.4) |
| C18 | MINOR | Written `strips` values versus the rule | the values are the rule applied; `art rulers` recomputes and fails on a mismatch (§ T10.4) |
| C19 | MINOR | The `schema:` block was defined for screens only | any area file may carry one; `spec/meta/vault.md` carries the vector types (§ T7.4) |
| C20 | MINOR | Spike 6 read a `.nvmrc` the move commit creates, with no order stated | the move commit lands before any spike runs (§ T14) |
| C21 | MINOR | `Mutation` is not a tag | "the nightly's `Sim` job or its Pitest job" (§ V5) |

### 7-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | `plan/**` and `.claude/**` unowned | = B5 |
| D2 | GAP | P6's planes had no number and no ceiling | = B6 |
| D3 | GAP | Nobody reads or triages what the testers report | = B7 |
| D4 | GAP | The painted branch had no shipping resolution and its atlas and install consequences were unpriced | 128 × 128 px per frame, ≈ 50 MB resident, re-derived at P0's exit, in § F3.2's fork table and question 1's price (`FUNCTIONAL.md` § F3.2, README question 1) |
| D5 | GAP | The three re-estimates turned into no decision | P1's exit gate and owner row: the owner accepts the re-estimated sizes and calendar or stops (README, § T14) |
| D6 | NUMBERS | The sittings arithmetic | = B11 |
| D7 | NUMBERS | Question 10's price | = B17 |
| D8 | NUMBERS | "About seven" prototype commits against nine or ten | "about nine, ten with question 3(c)" (README P0 owner row) |
| D9 | MINOR | 3(c) in the P0 rows | = B14 |
| D10 | MINOR | D3 said "verified" of a spike not yet run, and `Multiply` maps to a PorterDuff mode below API 29 | D3 and § T1 say what falls back (`ColorDodge`), what maps (`Multiply`, alpha included) and that spike 1 verifies both at API 28 and 29 (README D3, § T1, § T14) |
| D11 | MINOR | Principle 10 named three of § V1's five | carries the five (README) |
| D12 | MINOR | Question 7 bundled three decisions with one price | split into (a) the identities and (b) the release path, each priced (README question 7) |
| D13 | MINOR | No store row in the risks | = B16 |
| D14 | MINOR | The study absent from D19 | added (README D19) |
| D15 | MINOR | Question 4 did not say what the placeholder stage lacks | said (README question 4) |
| D16 | MINOR | Renovate is a third writing identity in a "two identities" model, installed in no phase | named in D17, § T1's identities, P1's deliverables and the P1 owner row (README, § T1, § T14) |
| D17 | MINOR | The re-dispatch workflow "runs the pull request's own copy" was called wrong | **declined**: a `pull_request_review` run executes in the merge-commit context (`refs/pull/N/merge`) — GitHub's events reference, and its 2025-11-07 changelog on environment branch protections, say so — so the pull request's copy can run; the sentence was reworded so the design depends on neither copy (§ V5) |

**Declined or only partly applied (MINOR):** D17, declined for the reason in its row. A12's
P1 check was not adopted: the merge queue's availability was verified against GitHub's
documentation and dated instead, and nothing in the plan depends on it.

## Round 8 — on revision 9 (commit `4ccdfbc`)

Four reviewers on a lighter model, 62 findings: 2 BLOCKING, 27 GAP, 7 NUMBERS, 26 MINOR.
Both blocking rows are residue of revision 9's own fixes: § F3.2 and § F3.4 still gated
the painted look on the in-scene ruler that § F3.1 had just made the stage's (C1), and the
generated-workflows check, moved under `pull_request_target` in an earlier round, would
have had to execute the pull request's own generator with the privileged token (A1, B8).
Four more round-7 resolutions were found defective the same way — the spend ceiling in
`art gate` reds the lanes for good and forbids the stop branch it exists for (A5), the
privacy page's route cannot serve the URL the stores are given and its edits never trigger
the deploy (A6, B13, C5), the store term was composed as a parallel term when it is serial
(B9), and 11.5 × 1.25 is 14.4, not 13 (C9). The gaps are of three kinds. Owner commitments
absent from the approval surface: the sittings' hours and the subscription's tier (B4,
D1), the repository's visibility (D3), that non-owned code merges unreviewed and reaches
the owner's Mac (D4), the accounts' identity verification (D5), the analyser fallbacks
(D2), the closed test during an absence (B3), the owner's route into `plan/**` after P1
(B1), a stop at P2 (B2), the change-provider branch's price (B5), the subscription
provider's missing ceiling (B6), the baselines in the unowned spikes folder (B7).
Mechanisms: the `changes` job not itself required (A2), the image built with no
`packages` permission (C3), a floating Node version failing `env-check` (C4), no digest
in `:core-testing` (C7), no `issues` permission (C8), the gate App absent from § V9's
order (C2). And the specification: the P2 harness knobs and fixtures the golden cells
need (A3, C6), the portrait ΔE measured against a ramp with no skin tones (A4), the
silhouette target unreachable beside the fallback cast (A7), the painted look's display
path (D6). Revision 10 resolves all of them and declines none; the structural changes: P0
is XL and P1 L, so the aggregate is 19–38 sessions with a calendar floor of twelve to
fourteen weeks; the generated-workflows job runs the head's generator as an ordinary
pull-request job behind the owned paths; every `changes` job is a required check; § V9 is
marked in eight milestones with the gate App in its place; the Node version is exact from
P0; the art programme's counter covers a subscription winner; and the owner's commitments
— hours, identity verification, a public repository, unreviewed non-owned merges — are on
the approval surface.

### 8-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The generated-workflows check under `pull_request_target` would run the head's generator with the privileged token, or with `main`'s generator could never pass the pull requests that add it | an ordinary `pull_request` job over the head's generator, no secrets, required like any lane job; its defeat needs an owned-path change (§ V5, § V6, § T13.5, § T2.1) |
| A2 | GAP | A job skipped because `changes` failed satisfies a required check too | every workflow's `changes` job is itself a required check (§ V5, § T4.1, README D15) |
| A3 | GAP | The golden cells need packs at home acts, ascensions and a stall fixture the prototype's harness cannot build, and § T4.2's P2 list did not allow the changes | `fixtures.mjs`, the pack generator and the `--act --ascension --lap --pacts` knobs into the existing `BattleCtx` (§ T4.2, § T5.3) |
| A4 | GAP | The portrait ΔE criterion measured a face against a ramp of accents and glows with no skin tones | the union of the element ramp and the shared neutrals; `ramps.json` records both (§ T10.4, `FUNCTIONAL.md` § F3.3) |
| A5 | GAP | The ceiling in `art gate` reds the lanes for good once reached and forbids the stop branch | the ceiling refuses in `art generate`; `art gate` only reports the counter (§ T10.1) |
| A6 | GAP | The Pages filter on `prototype/**` never deploys a `docs/**` change, and a copied `.md` serves as raw Markdown | the filter covers `docs/**` and the workflow; `docs/privacy/index.html` is copied into `dist/privacy/` (§ T4.1, § T12, § T2.1, README) |
| A7 | GAP | The silhouette target as a P4 gate is unreachable beside the 37 fallback actors | reported at P4 and never a gate; the value target alone gates the six heroes (§ T10.4) |
| A8 | NUMBERS | The balance basis double-counted two verification seeds | seeds 1, 2, 3 and 4242; 11 000 per policy, ≈ 99 000 runs, 8–10 minutes (§ T5.5, § V2) |
| A9 | MINOR | Three of the four defects live in `battle.ts` | "three, two root causes" (README, § T4.2) |
| A10 | MINOR | `sim replay` rendering the storyboard breaks `:sim`'s edge | `sim replay` prints the trace; `instruments storyboard --replay` renders it (§ T11) |
| A11 | MINOR | A JSON file tagged as a `data:` table | a fixture typed by a `schema: Ramps` block (§ T4.2, § T10.4) |
| A12 | MINOR | The empty string had no encoding | prints as `-` (§ T5.3) |
| A13 | MINOR | The ruleset before `CODEOWNERS` refuses the owner's own push | `CODEOWNERS` first, then the ruleset (§ V5, § V9, README P1 row) |
| A14 | MINOR | L0's `env-check` cannot see the edit that triggers it | it re-asserts the last install only; the edit is unverified until L3 (§ V2, § V4) |

### 8-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | After P1 the owner had no route to put their own words into `plan/**` | an agent commits what the owner dictates and the owner reviews it (README, § V5) |
| B2 | GAP | Three re-estimates but one stop, taken before the clause count | P2's exit is an accept-or-stop on the re-sized P3 and P5; "the one" dropped (README, § T14) |
| B3 | GAP | The absence protocol ignored the closed test, the one thing an absence can reset | the build is promoted to the closed track only when the owner can cover the window; the reset is named as the one rework an absence causes (README) |
| B4 | GAP | The subscription's tier and the sittings' hours were never sized | the tier and price recorded at P0 with the low case named; sittings at an hour to an hour and a half with per-phase bands, ≈ 60–90 hours (README) |
| B5 | GAP | "Change provider" was priced nowhere | a second bake-off ≈ $250 and half a session to a session at P0's exit; the whole-cast re-gate mid-cast (README question 6 and money table, `FUNCTIONAL.md` § F3.5, § T10.7) |
| B6 | GAP | A subscription winner had no counter, no ceiling and no cast price | the cast priced in months with an allowance-months ceiling in the same counter; trigger 3 is whichever binds (§ T10.7, README money table, `FUNCTIONAL.md` § F3.5) |
| B7 | GAP | The per-axis baselines lived in `plan/spikes/`, the one unowned subtree | committed to `spec/art/` beside the protocol and the sheet (`FUNCTIONAL.md` § F3.5, § T14, README P0 gate) |
| B8 | GAP | The generated-workflows check had no posting identity and no file | = A1 |
| B9 | NUMBERS | The store term was composed as parallel; the floor was two weeks short | serial: eight to ten weeks to the first build plus four, a floor of twelve to fourteen weeks; item 6 says "during P5" (README) |
| B10 | NUMBERS | P0's L held an M art tool, eight spikes, the bake-off and the calibration; P1's M held twenty steps | P0 XL and P1 L, the aggregate re-derived: 19–38 sessions, the critical path 15–30, depth 14–28 (README, § T14) |
| B11 | NUMBERS | The painted branch's resident figure was checked against the install budget | priced against the peak-memory budget with one biome resident as the lever, and ≈ 8–15 MB on disk (README question 1, `FUNCTIONAL.md` § F3.2) |
| B12 | MINOR | Question 1 and § F3.2 disagreed on whether B's value criteria are re-derived | the pass thresholds gate both looks; B re-derives the value targets at P4 (README question 1, `FUNCTIONAL.md` § F3.2) |
| B13 | MINOR | Raw Markdown in a Vite artifact | = A6 |
| B14 | MINOR | The binding calendar term had no risk row | a review-queue row with the tripwire "waiting more than five weekdays" (README) |

### 8-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | § F3.2 and § F3.4 still gated look B on the in-scene ruler, so no candidate could pass and the fork could not close | B is gated on value, silhouette and motion, the in-scene ruler reported; criterion 4 reads "on the sheet; in scene reported" (`FUNCTIONAL.md` § F3.2, § F3.4) |
| C2 | GAP | § V9 never created the gate App, its environment or Renovate | M3 creates the gate App and its environment before the owner-review workflow; Renovate in M4; the README's P1 row in the same order (§ V9, README) |
| C3 | GAP | The image build from an agent session had no `packages` permission | spike 6 builds it by a throwaway workflow with `packages: write` (§ T14, § T1, § V9) |
| C4 | GAP | A floating `22` reds `env-check` between P0's image and P1's host | the exact version in `versions.env` and both `.nvmrc` files from P0's move commit; P2 confirms it (§ T2.1, § T3, § T4.1, § V4, § V5, README) |
| C5 | GAP | The Pages route | = A6 |
| C6 | GAP | The tuned fixtures and the Vault relics were JS literals the Kotlin harness could not build the cells from | exported to `spec/fixtures/golden/*.json` under a `schema:` block both harnesses read (§ T4.2, § T5.3, § T2.1) |
| C7 | GAP | Neither `:core` nor `:core-testing` had a digest for the hash test | a hand-written SHA-256 in `:core-testing`, checked against the NIST vectors and `MessageDigest` (§ T2.1, § T5.2) |
| C8 | GAP | Agents must file issues and the App had no `issues` permission | added (README D17, § T1, § V5) |
| C9 | NUMBERS | 11.5 × 1.25 is 14.4 | ≤ 14 ms (§ T9.5) |
| C10 | MINOR | `--path a\|b` never mapped to the prototype's mechanisms | a is `simulateRun`, b is `createRun` (§ T4.2) |
| C11 | MINOR | § V2's `lanes.json` record omitted `started_at` | added (§ V2) |
| C12 | MINOR | The ramps as a `data:` table | = A11 |
| C13 | MINOR | The eight milestones were nowhere marked | § V9 marked M1–M8 (§ V9) |
| C14 | MINOR | `prototype.yml` called generated | hand-written, outside the diff (§ T4.1, § T2.1) |
| C15 | MINOR | The study export had no renderer or canvas rule | `export-study.mjs`, a Node rasteriser with the canvas and padding rule (§ T4.2) |
| C16 | MINOR | The `pixel=` bullet never named the page it drives | it names `stage.html`; "above" (§ T4.2) |

### 8-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | A sitting had no length and the owner's hours no total | = B4 |
| D2 | GAP | The analyser fallbacks were in no risk row, and principle 9 and D8 did not qualify themselves | a risk row; principle 9 and D8 qualified (README) |
| D3 | GAP | The repository's visibility was never stated, and everything free depends on it | public, and staying public, in D2 and question 8 with the private alternative's cost (README) |
| D4 | GAP | Non-owned code merges unread and runs nightly on the owner's Mac | D15 says so; question 5 and D18 put the runner in its own account or a VM (README, § T1) |
| D5 | GAP | The accounts' identity verification and public developer identity were never mentioned | in the P0 row and both account rows (README) |
| D6 | GAP | A painted frame had no path onto the prototype's stage | `canvas: 128, cell: 1`, drawn at 1:1 by the `PixelActor` registry (`FUNCTIONAL.md` § F3.2, § T4.2, § T10.9) |
| D7 | NUMBERS | P0 ≈ 3 omitted two sittings the same README assigns to P0 | P0 ≈ 5; 52–60 (README) |
| D8 | NUMBERS | The steady-state row and the money line double-counted the target-SDK bump | "about one session a quarter, which covers the annual target-SDK bump" in both (README) |
| D9 | MINOR | Two of four defects | = A9 |
| D10 | MINOR | Question 4 closed two forks with one answer and no session price for the AI branch | split into (a) and (b); the AI branch priced in sessions (README) |
| D11 | MINOR | D10's reversibility ignored the cast | "one phase before P4; a whole new cast after it" (README) |
| D12 | MINOR | The Mac's real P1 job was understated | stated: `setup.sh` and `env-check` on the owner's machine (README P1 row) |
| D13 | MINOR | The bake-off and the baselines were counted in P0 and P4 | P0 only (README P4 row) |
| D14 | MINOR | "The one continue/stop decision" while P4's cast begins at P0's exit | "the programme-level stop, repeated at P2's exit; the art programme keeps its own triggers" (README P1 row) |
| D15 | MINOR | Resident bytes against an install budget | = B11 |
| D16 | MINOR | § F2's heading and its first sentence disagreed, and the README never listed F2.2–F2.7 as approved | the heading reads "approved with the plan, row by row"; item 3 names F2.2–F2.7 (README, `FUNCTIONAL.md` § F2) |
| D17 | MINOR | Testers must actually play, and holding them from P0 may be months | recruited about a month before P5's first build, people who will actually play (README money table, P0 row) |
| D18 | MINOR | Question 10's price did not say whether it sits inside P5's XL | "inside P5's XL", with the saving on "no" (README question 10) |

**Declined or only partly applied (MINOR):** none declined.

## Round 9 — on revision 10 (commit `5ab9fd4`)

Four reviewers on a lighter model, 59 findings: 1 BLOCKING, 22 GAP, 5 NUMBERS, 31 MINOR.
The blocking row is residue again: revision 10 named `fixturePack` as the P2 pack builder,
which is module-private and hard-codes act 1, while enemy scaling happens in the exported
`spawnPack` (C1, A3). Two round-8 resolutions had over-corrected: adding the shared
neutrals to the portrait palette criterion made it unfailable (A2), and the in-scene ruler,
taken off the sprites, was attached to no stage gate (B5) and had no formula — its 1.5:1 is
a luminance contrast, not an L* ratio (A1, C13). The remaining gaps are of round 8's three
kinds. Owner commitments the approval surface lacked: the admin hours (B1, D4), the
baseline play sequenced after the defect fix and doubling as a product go or no-go (B2,
B3), the character brief's real deadline (B4), the store name and ids (D3), a mixed cast at
launch when a subscription winner paces P4 (D1). Mechanisms: the spend counter's rows and
the per-key caps (B6), `changes` job names colliding (B8), the image workflow's file (A9,
C3), goldens recorded where the image cannot run (A5), a forfeit at an enemy turn that a
replay would misplace (A4), the P1 subset of L3 and L4 (C6). The specification: the
fixtures' single source and the cell line's ownership (C4, C5), the painted boss canvas
(C7, D2), the owned fixture paths (C2), iOS tested by nobody but the owner (B7). Two
minors are declined with GitHub's own pages quoted: the merge queue is
organization-only (B18) and a `pull_request_review` run is in the merge-commit context
(B23). Revision 11 resolves the rest; the structural changes: the in-scene ruler has a
formula, a share-based bar and a place in P5's and P6's gates and in L2b; the calendar
states both the best case and the measured case; the owner's admin hours, the go or
no-go, the character brief's deadline and the mixed-cast approval are on the approval
surface; every job name carries its workflow; the fixtures are one JSON source; the
counter's rows land in every pull request behind per-key caps.

### 9-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The in-scene ruler had no formula: its 1.5:1 is a luminance-contrast ratio, not the L* ratio the bible's word "value" implies, and whether the gate is every seat or a share was unstated | the WCAG relative-luminance ratio defined; the bar is the share the landed rig achieved at P0 (106 of 108); the seat spread defined on the torso band (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A2 | GAP | With the neutrals counted, every grey and nearly every low-chroma colour lies within ΔE 20 of the reference set, so the portrait criterion could not fail | the element's hue must be present — at least 15 % of the chip's cells within ΔE 12 of the accent or glow — with the neutrals permitted and uncounted (§ T10.4, `FUNCTIONAL.md` § F3.3) |
| A3 | GAP | `fixturePack` is private and act-1-only; `BattleCtx` does not scale enemies | the exported `spawnPack(ids, act, lap, ascension, clears, pacts)` builds the pack and the same values go into `BattleCtx` (§ T4.2, § T5.3) |
| A4 | GAP | A forfeit at an enemy turn would replay at the next hero turn, after rng draws | `forfeit at=<kind> turn=<actorTurns>`; the replay stops at that turn (§ T5.3, § T11) |
| A5 | GAP | Goldens must be recorded inside the image, which the agents' host may not run | the merge workflow's `record-goldens` job renders inside the image and uploads the PNGs; question 9's second reason restated (§ V4, § V9, README question 9) |
| A6 | MINOR | Booleans had no encoding | `0\|1` everywhere (§ T5.3) |
| A7 | MINOR | The N − 1 save corpus vanished at the first bump | the previous version's corpus kept under `v<N-1>/` (§ T11) |
| A8 | MINOR | An exporter for four values, outside the allowed changes | the four values and the tie-break written into the `META-VAULT` clause (§ T5.1) |
| A9 | MINOR | The image-build workflow had no file and no bootstrap step | `.github/workflows/env-image.yml`, hand-written, created in M3 (§ T2.1, § V4, § V9) |
| A10 | MINOR | `node-version: 22` kept beside `node-version-file` at P0 | the literal goes at P0 (§ T4.1) |
| A11 | MINOR | A `selfcheck` trace mode with no definition | dropped from the `mode` record (§ T5.3) |

### 9-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The owner's non-review work — accounts, apps, rulesets, the runner, the Mac, the listings, the testers, the channel, App Review — was unpriced, and the steady state had no owner figure | ≈ 15–25 hours over the programme, most in P0, P1 and P5; the steady state's owner share stated (README effort, item 6, money table) |
| B2 | GAP | The baseline play would record a feel the spec forbids, on a battle screen with the two hero-turn defects | the play follows question 3(c)'s fix if taken, and `BASELINE.md` records the two defects as excluded from the bar (README P0 row and question 3(c), `FUNCTIONAL.md` § F1.5) |
| B3 | GAP | Nothing asked whether the game is worth building before P3 | the baseline play is a go or no-go recorded in the register, before the rig and the cast are paid for; a risk row (README P0 row, P0 gate, risks; § T14) |
| B4 | GAP | The character brief's free-fold deadline is P0's exit and nothing asked for it by then | the brief due at P0's exit, or § F4.3's price accepted (README P0 row, `FUNCTIONAL.md` § F4, § T14) |
| B5 | GAP | The in-scene ruler was "gated at P5 and P6" but in neither phase's exit criteria nor any lane | in P5's and P6's exit rows and in L2b's contents from P5 (README, § T14, § V2) |
| B6 | GAP | The counter's rows could stay in a worktree, parallel packs could each spend the headroom, and the per-key caps had no amounts | every run's rows land in a pull request, `art gate` fails a manifest with no rows, per-key caps with amounts in the P0 row, P6's $500 on top of the $4 000 (§ T10.1, § T10.7, README) |
| B7 | GAP | iOS reached App Review tested by nobody but the owner | external TestFlight with the same testers, an S inside P5 (§ T12, README P5 rows, § T14) |
| B8 | GAP | Same-named `changes` jobs across workflows collide as required checks | the generator names every job after its workflow; the nightly is outside the rule (§ V5, § T4.1, README D15, § V9) |
| B9 | NUMBERS | The twelve-to-fourteen-week floor assumed a capacity the plan's own measurement says the owner does not have | both cases stated: twelve to fourteen weeks at three or more sessions a week, nineteen to thirty-eight at the measured one to two (README item 6 and effort) |
| B10 | NUMBERS | 60–90 hours did not follow from the sitting lengths | ≈ 45–90 hours of review (README) |
| B11 | NUMBERS | The private repository was a parenthetical cost, not a priced branch | question 8(b), priced (README question 8) |
| B12 | NUMBERS | The portrait branch omitted the placeholders, the cell scale, the size bands and the anchors | re-priced at 4–6 extra sessions with each part named (README question 2) |
| B13 | MINOR | The subscription tier was a blank and the money table had no total | the Max-class tier assumed at ≈ $100–200 a month; a programme-total row (README money table) |
| B14 | MINOR | The closed test's trigger was stated two ways | one statement — the first merge-lane pass inside a window the owner can cover (README money table, absence protocol; § T14) |
| B15 | MINOR | D16's owner column said "no" for a decision question 4(b) makes | "yes (question 4(b))" (README) |
| B16 | MINOR | The P2 row denied a clause review the balance fold needs | "no contract-clause reviews; the `spec/balance/` proposals are one owned-path review" (README P2 row) |
| B17 | MINOR | Question 9 tied the pool's golden benefit to the cold start | the two reasons split (README question 9) |
| B18 | MINOR | The merge queue's absence was uncertain | **declined**: GitHub's "Managing a merge queue" page, quoted and dated in D15 and § V5, offers it to organization-owned repositories only |
| B19 | MINOR | A user account and a VM offered as equal isolations | the VM recommended, the user account the accepted-risk fallback (README D18, question 5, § T1) |
| B20 | MINOR | The three-strikes rule was a fourth stop route with no branches | trigger 4 with the same three branches (`FUNCTIONAL.md` § F3.4, § F3.5) |
| B21 | MINOR | The plane provider's terms were verified nowhere | verified into `LICENSES.md` before the branch is taken (`FUNCTIONAL.md` § F3.7, README question 4) |
| B22 | MINOR | The P2 Node bullet | = C8 |
| B23 | MINOR | "Runs in the merge-commit context" was called false | **declined**: GitHub's events reference and its 2025-11-07 changelog put `pull_request_review` in the merge-commit context; the sentence now cites them (§ V5) |

### 9-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The named pack builder is private and act-1-only, and the knobs went where enemies are not scaled | = A3 |
| C2 | GAP | `spec/fixtures/**` was unowned though it holds the cells' inputs and the portrait palette | `spec/fixtures/golden/**` and `spec/fixtures/art/**` owned (§ V5) |
| C3 | GAP | The image workflow existed in no listing and no milestone | = A9 |
| C4 | GAP | The cell line had no `lap` or `pacts` and nothing said which of the line and the fixture wins | the cell line owns seed, act, ascension, policy and the count; the fixture row owns party, relics, lap and pacts (§ T5.3) |
| C5 | GAP | Two copies of the fixtures with no authority | the JSON is the single source; `fixtures.mjs` reads it at run time (§ T4.2, § T5.3, § T2.1) |
| C6 | GAP | "Every lane green" was unevaluable for L3 and L4 at P1 | the P1 subset named (§ V9, § T14, README P1 gate) |
| C7 | GAP | A painted boss had no canvas | 192 px, `canvas: 128\|192` (`FUNCTIONAL.md` § F3.2, § T4.2, § T10.9) |
| C8 | MINOR | The P2 bullet still replaced a `22` P0 no longer writes | it confirms the pin and adds `engines` and the lint (§ T4.2) |
| C9 | MINOR | Two sources for the Node pin with no precedence | `versions.env` authoritative from the move commit, read by `setup.sh`; the lint covers all four (§ T4.1, § T14) |
| C10 | MINOR | The nightly's `changes` job would be a required check that never reports | the rule scoped to pull-request workflows (§ T4.1, § V5) |
| C11 | MINOR | `gate.sh commit` and `env-check` are not lane ids | the two non-lane verbs listed (§ T13.5) |
| C12 | MINOR | The golden fixtures' schema file was unnamed | `spec/golden/fixtures.md` (§ T7.4, § T2.1) |
| C13 | MINOR | Every seat or a share | = A1 |

### 9-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | A subscription winner paces P4 by its allowance and nothing requires a complete cast at the first build | the fourth pace stated; a first build over the fallback actors is a mixed cast the owner approves by name (README effort, P5 and P7 rows; `FUNCTIONAL.md` § F3.5; § T14) |
| D2 | GAP | The painted boss canvas | = C7 |
| D3 | GAP | The store name and the bundle and application ids were never reserved or chosen | in § T12's P5 list and the P5 owner row (§ T12, README) |
| D4 | NUMBERS | The hours were not derived and excluded the admin work | = B1, B10 |
| D5 | MINOR | The P2 row's clause reviews | = B16 |
| D6 | MINOR | The README's P3 gate omitted the recorded fallback | added (README) |
| D7 | MINOR | Question 6 did not name the exposure a yes authorises | the ceiling named (README question 6) |
| D8 | MINOR | Two triggers for the closed test | = B14 |
| D9 | MINOR | `spend.json` and `BASELINE.md` are public too | named (README D2, question 8) |
| D10 | MINOR | F2.1's parts exceed an M at the high end | M–L, and question 10 agrees (`FUNCTIONAL.md` § F2, README question 10) |
| D11 | MINOR | The regeneration rule still caught criterion 6 | criterion 6 and every reported-only reading excluded (`FUNCTIONAL.md` § F3.4) |
| D12 | MINOR | The P2 Node bullet | = C8 |

**Declined or only partly applied (MINOR):** B18 and B23, each declined with GitHub's own
page quoted in the plan.

## Round 10 — on revision 11 (commit `5c87c9a`)

Four reviewers on a lighter model, 72 findings: 2 BLOCKING, 28 GAP, 10 NUMBERS, 32 MINOR.
Both blocking rows are in the plumbing revision 11 added: the agents' App lacked the
`actions` permission the `record-goldens` job needs (A1), and a pull request editing the
environment recipe could never pass `env-check`, because the image manifest it is compared
against could only exist after its own merge (C1, A16). The gaps show that the last two
revisions' mechanisms had grown baroque — the spend ledger needed a row schema and a join
key to be enforceable (C4, A8), its per-key caps sat below the counter's ceiling so the
stop trigger could never fire (A10, B12), the allowance-months ceiling assumed a metering
no finalist may have (B7), and the in-scene ruler had a moving denominator, two
re-derivation points, no frame set and no tier (A4, A5, C5, C12). Revision 12 therefore
simplifies as much as it fixes: the art spend's hard ceiling is the providers' own caps
($3 500 and $500, the counter a mirror that refuses at 90 %), a subscription winner is
paid in months, and the in-scene bar is the share of one fixed set of 72 readings —
each biome's resting frame at HIGH — measured once at P0 under the tool's own strip rule.
The other gaps are of the familiar kinds. Owner commitments: the testers' platform split
and a fallback if twelve cannot be held (B1, B2), the go or no-go as P0's first act before
any spend (B3), the character brief already at P0 (B4 held), a sized response to what the
testers report (B5), orientation decided after the baseline play (D1), the Firebase billing
account and the pool's host (D2), a bound on felt-row rework (D3), USB passthrough for the
runner VM (D4), `docs/**` owned (D5), a root `LICENSE` and the bundled font's licence
(B8), a sanctioned repair to `prototype-check` (B9), the first tag and the release
approvals as owner acts (D12). Mechanisms: the required-check list generated and checked
(C3), the halo criterion unpassable as worded (A2), a second portrait clause left beside
the new one (A3), the red-`main` rule's `kmp` boolean too coarse to block anything (A9),
the platform-blur fallback a no-op below API 31 (A7), spec-lint's line cap against the
cell table (A6), the storyboard's two save formats (C7), `clears` missing from the pack
knobs and the cell line, and the act-1 fixtures' party unowned (C2, C6, A13). Numbers:
sittings to the build (41–47) against the whole (52–60), the depth to the build (12–24),
the two-a-week band (12–19), the programme total ($1 900–3 000) and its recurring extras,
private-repository pricing and GitHub Pro for rulesets (B10, B11, B13, B14, C8, D6, D7,
D8, D10, D11, B19). Revision 12 resolves all of them and declines none.

### 10-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The App's permissions did not include `actions`, so no agent could dispatch `record-goldens` or read its artifact | `actions` added to the App in D17, § T1 and § V5 |
| A2 | GAP | "No cell elsewhere on the frame above p50 + 20" is contradicted by the value pass itself | the halo reads the one-cell ring and stray opaque cells outside the silhouette only (§ T10.4) |
| A3 | GAP | Two portrait palette clauses, one unpassable | the 60 % clause deleted; the 15 % element-hue clause stands in § T10.4 and § F3.3 |
| A4 | GAP | The share's denominator moved with seat exclusion | the seat list is fixed at P0 and an excluded seat is a miss (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A5 | GAP | The bar was re-derived at P5 from the frames it gates | one bar, measured at P0, used unchanged by P5 and P6 (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A6 | GAP | Spec-lint's 60-line cap against the cell and skill tables | prose capped, `data:` tables exempt (§ T7.1, § T7.8) |
| A7 | GAP | `Modifier.blur` is a no-op below API 31 with minSdk 29 | choosing the fallback raises minSdk to 31 as a register decision (§ T9.4) |
| A8 | GAP | A spend row carried no key to a manifest | every call has an id, stamped on the row and the manifest (§ T10.1) |
| A9 | GAP | The `kmp` boolean made the red-`main` rule block nothing | per-module booleans (§ T4.1, § V5) |
| A10 | NUMBERS | The per-key caps ($3 500) sat below the $4 000 ceiling | the caps are the ceiling: $3 500 + $500; the counter refuses at 90 % (§ T10.1, § T10.7, README) |
| A11 | MINOR | `PACT:true` beside "booleans `0\|1`" | `<PACT>:1` (§ T5.3) |
| A12 | MINOR | The round row's reason was wrong | ties-to-even and `Int` overflow named (§ T5.2) |
| A13 | MINOR | `spawnPack`'s sixth argument and the fixture-selecting flag were unnamed | `--clears` and `--fixture` (§ T4.2) |
| A14 | MINOR | `spec/fixtures/meta/` unowned | `spec/fixtures/**` owned (§ V5) |
| A15 | MINOR | "Pull-request workflows run with no secrets" is false of `owner-review.yml` | scoped to the generated lanes and the signing material (§ V5) |
| A16 | MINOR | `env-image.yml`'s trigger unstated | = C1 |

### 10-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | "The same testers" for Play and TestFlight; a tester with one phone serves one store | twenty to twenty-five with a platform mix: at least twelve Android, at least three iPhone (README, § T12) |
| B2 | GAP | No branch if twelve Android testers cannot be held | iOS first with Android left in closed testing, or a paid testing service priced at P5 (README money table and risks) |
| B3 | GAP | The go or no-go sat at P0's exit, after the bake-off's spend | P0's first act, before the spend; two or three people on the public demo as a second signal (README, `FUNCTIONAL.md` § F1.5, § T14) |
| B4 | GAP | The character brief's free-fold deadline | already at P0's exit since revision 11; held |
| B5 | GAP | Tester feedback was budgeted as triage only | presentation fixes inside P7's M; rule-touching reports decided by the owner, an S–M in the first steady-state session (README, § T14) |
| B6 | GAP | Question 8(a) had no moment before the move commit | "closes at P0's start, before the move commit" (README) |
| B7 | GAP | The allowance-months ceiling assumed a metering no finalist may have | a subscription winner is paid in months; P0's terms check records the metering, so one ceiling applies (§ T10.7, README, `FUNCTIONAL.md` § F3.5) |
| B8 | GAP | The bundled font's licence and a root `LICENSE` | the credits name every bundled asset's licence; the move commit adds a root `LICENSE` the owner chooses (`FUNCTIONAL.md` § F2.5, § T4.1, § T9.6, README P0 row) |
| B9 | GAP | `prototype-check` is required and nothing sanctioned repairing it | a repair to the build, lockfile or CI is an allowed change (§ T4.2) |
| B10 | NUMBERS | Item 6 put all sittings before the build and counted all of P5 as depth | 41–47 sittings to the build, 52–60 over the programme; 12–24 deep to the build, 14–28 to P5's end (README) |
| B11 | NUMBERS | 19–38 weeks labelled "one to two a week" | twelve to nineteen at two, nineteen to thirty-eight at one (README) |
| B12 | NUMBERS | The caps below the ceiling | = A10 |
| B13 | NUMBERS | The programme total did not follow from its items and omitted the farm and the pool | ≈ $1 900–3 000; the recurring extras named (README) |
| B14 | NUMBERS | Every minute is metered on a private repository, and rulesets need Pro | question 8(b) priced accordingly; the CI row points at it (README) |
| B15 | MINOR | § T12 stated the closed test's trigger without the window | restated (§ T12) |
| B16 | MINOR | P6's plane key conditioned a P0 act on question 4(b) | moved to the P5 owner row (README) |
| B17 | MINOR | "A month before P5's first build" names no observable trigger | "when P3's gate goes green" (README, § T12) |
| B18 | MINOR | "An order of magnitude" had no comparand | about ten times the month's subscription, measured at P1 (README) |
| B19 | MINOR | Question 2's parts summed to 4.5–6.5 | "five to six and a half" (README) |
| B20 | MINOR | The runner's status token was a fifth, unnamed credential | named in D17, § T1 and the P1 owner row |

### 10-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | A recipe edit could never pass `env-check`: the committed image manifest exists only after the merge | `env-image.yml` runs on the pull request, pushes the image tagged by the head and hands back the manifest and digest to commit in the same pull request (§ V4, § V9) |
| C2 | GAP | `spawnPack` scales by `clearsThisAct`, which no knob, field or column carried | `--clears`, a `clears` column and the `cell` field (§ T4.2, § T5.3) |
| C3 | GAP | Nothing kept the ruleset's required checks in step with the jobs the lanes grow | the generator writes `ci/required-checks.txt` and an L3 job checks the branch's active rules; adding a check is an owner act named per phase (§ T13.5, § V9, § T14, README P5 row) |
| C4 | GAP | The spend row could not express the ceilings, the allowance or the manifest check | the row has an id and a kind; the ceilings are the providers' caps; the allowance is gone (§ T10.1, § T10.7) |
| C5 | GAP | The in-scene gate named no frame set, tier or denominator | each biome's resting frame at HIGH, 72 readings (`FUNCTIONAL.md` § F3.1, § T10.4, § V2, § T14, README) |
| C6 | GAP | The act-1 cells' party, lap and pacts had no owner | a `party` value resolves against `spec/fixtures/golden/`, else `BATTLE_FIXTURES` with its defaults recorded (§ T5.3) |
| C7 | GAP | Two formats for one round trip; `replay` contingent on question 10 | the storyboard writes the canonical save; the encoding and `sim replay` exist either way (§ V3, § T11, README D6) |
| C8 | NUMBERS | Depth to the first build | = B10 |
| C9 | MINOR | "From this line alone" beside "never from the line alone" | reconciled (§ T5.3) |
| C10 | MINOR | Bare `AREA-TOPIC` ids | a family, never a clause (§ T7.1) |
| C11 | MINOR | `light.json`'s path and a `path` column | `<BIOME>.light.json`; the golden path is always `b` (§ T4.2, § T5.3) |
| C12 | MINOR | 106/108 as the bar versus "context, not a target" | the bar is P0's measurement under the new rule; 106/108 is scale only (§ T10.4, `FUNCTIONAL.md` § F3.1) |
| C13 | MINOR | The L0 hook never fired on the files three of its linters read | the path set widened (§ T13.3, § V2) |
| C14 | MINOR | The ledger block was written at open only | re-written on every push (§ T13.5) |
| C15 | MINOR | Spike 3's tree and the root Gradle files | named (§ T14, § T2.1) |
| C16 | MINOR | `wait-on` undeclared; the exact Node version unnamed | a `curl --retry` loop; the latest 22.x at the move commit (§ V5, § T3) |
| C17 | MINOR | The forcing hooks equated with `ko=1` | listed as P5's `spec/platform/` clauses (§ V3, § T14) |

### 10-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | Orientation decided before the owner has held the game | question 2 closes after the baseline play, P0's first act (README) |
| D2 | GAP | The Firebase billing account and the pool's host were nobody's act | the P1 owner row and question 5 (README) |
| D3 | GAP | A felt row that never passes had no bound | one more rework, then accept as a recorded miss or stop (`FUNCTIONAL.md` § F1.5, README, § T14) |
| D4 | GAP | A phone cannot reach a macOS VM | a Linux VM with USB passthrough for the Android lane; the iPhone lane under a separate user account or on the farm (README D18 and question 5, § T1) |
| D5 | GAP | `docs/**` unowned | owned (§ V5, README D17) |
| D6 | NUMBERS | Item 6's sittings before the build | = B10 |
| D7 | NUMBERS | The programme total's band | = B13 |
| D8 | NUMBERS | The steady state's compute and the runner's power unpriced | priced (README money table) |
| D9 | MINOR | § F6 contradicted questions 2 and 3(c) | qualified (`FUNCTIONAL.md` § F6) |
| D10 | MINOR | The two-a-week band | = B11 |
| D11 | MINOR | Sessions and sittings to the build counted P5 differently | both count P5's first half (README) |
| D12 | MINOR | The first tag and the release approvals were absent from the owner's acts | in the P5 row and the steady state (README) |
| D13 | MINOR | § T12's trigger statement | = B15 |
| D14 | MINOR | The `port` budget zeroed at the gate yet split after it | the split is the gate's last task (§ T5.1, § T8.1) |
| D15 | MINOR | A wasm break would block every merge | the wasm compile is informative until P8 (README question 3(b), § V2) |
| D16 | MINOR | The painted branch's money | re-derived at P0's exit (README question 1) |
| D17 | MINOR | A rejection's re-apply cost | named (README risks) |
| D18 | MINOR | The export-compliance key | `ITSAppUsesNonExemptEncryption` (§ T12) |
| D19 | MINOR | Question 8(a)'s moment | = B6 |

**Declined or only partly applied (MINOR):** none declined.

## Round 11 — on revision 12 (commit `7f82ba5`)

Four reviewers on a lighter model, 73 findings: 2 BLOCKING, 29 GAP, 8 NUMBERS, 34 MINOR.
The two blocking rows are one defect: the gloss revision 12 wrote on the red-`main` rule
had its direction inverted (A1, C1). About a third of the gaps are residue of revision
12's own edits — the halo criterion now measured an empty set (A2), the seat spread's bar
was never measured at P0 (A3), the per-module booleans left `iosApp/**`, `core-testing/**`
and `config/**` in none (A4), the required-check list could not hold the hand-written
jobs it was said to hold (C5), the `env-image` hand-back needed a digest nothing made
stable (C6), `--fixture` was given a second meaning and an unknown `party` fell back
silently (C7), the `sim` flag list lacked the battles knobs (C3), and the minSdk-31
consequence never reached the README's platform decision (D1) — which is why a read-only
consistency pass now precedes every round. The rest are new ground: the image goldens had
no home (A5), out-of-battle heals left no trace (A6), promotion pull requests contradicted
"merges on green alone" (A7), the image pinned from a pull request's head was never
verified against `main`'s recipe (A8), adding a required check dismisses every open
approval (A9), the size bands had no gate status (A10), the binder generated fixtures the
main code needs into test source sets (C2), the detekt fallback lost the custom rules
(C4), the save corpus had no schema (C8), the art tool had no `package.json` (C9); and on
the owner's side a wrapper to run Play's clock early (B1, weighed and declined), a paid
tester service that Google's own check defeats (B2, dropped), P7's gate under the iOS-first
fallback (B3), generation not paused at the stops (B4), the go or no-go taken on a
defective build (B5, so question 3(c) now recommends the fix), the aggregate silently
excluding the character changes and PvP (B6), the Mac assumed rather than confirmed (B7),
the store name reserved too late (B8), no blocker class for a run-breaking tester report
(B9), question 10's "no" during the closed test (B10), and an absence during P4 under a
subscription winner (D2). Revision 13 resolves all of them and declines none.

### 11-A — adversarial, technical

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The red-`main` gloss said a red `:core` blocks `:core` pull requests and lets `:ui` merge — the opposite of the rule | while `:core` is red a `:core` fix may merge and a `:ui` pull request waits (§ V5) |
| A2 | GAP | The silhouette is the opaque-cell set, so the ring outside it holds nothing | the silhouette is α ≥ 128 after `normalise`; the ring reads 0 < α < 128; stray cells are α > 0 farther out (§ T10.4) |
| A3 | GAP | The seat spread's 5 L* was an absolute the rig measured with one sprite; the cast spreads wider | its bar is what the landed rig achieves on the same 72-reading set at P0; 5 L* is the intent (`FUNCTIONAL.md` § F3.1, § T10.4) |
| A4 | GAP | `iosApp/**`, `core-testing/**` and `config/**` fell in no boolean, so their pull requests ran nothing | `ios` added; `core-testing` in `core`, `config` in `build`; a path in no glob is a generator error (§ T4.1) |
| A5 | GAP | The image goldens had no home the goldens check could watch | `spec/golden/images/<kind>/`, owned and in the check's path (§ T2.1, § V2) |
| A6 | GAP | Out-of-battle heals moved hero HP with no record | the battle-start `party` record carries `:<hp>` per hero (§ T5.3) |
| A7 | GAP | Every first-binding pull request trips the contract-clause check, contradicting "merges on green alone" | stated: except where it promotes a clause, the normal case through P3 and P5, integrated one owner-gated pull request per session per track by design (§ V5, README D15) |
| A8 | GAP | The image built from a pull request's head was pinned unverified | `main` rebuilds from its recipe and goes red if the manifest differs; the owner's review of `ci/env/**` is the review of the image (§ V4) |
| A9 | GAP | A new required check reads "expected" on every open head and a push dismisses the approval | taken when no owner-gated pull request is open, else a re-review each (§ T13.5) |
| A10 | GAP | The size bands had no gate status | *Size, pass* on idle 0 (§ T10.4) |
| A11 | MINOR | The `unlit` flag left the resampled floor under the crisp one | the flag drops the floor layer from `bakeFlat`'s loop (§ T4.2) |
| A12 | MINOR | "Criteria 1–5" was ambiguous between two numberings | § F3.1's *Pass* bullets named; ART-REVIEW's criterion 3 the critic's (§ T10.4) |
| A13 | MINOR | Declined shrine offers had no encoding | `<PACT>:<0\|1>` in roll order (§ T5.3) |
| A14 | MINOR | No nightly run yet had no verdict | reads as green (§ V5) |
| A15 | MINOR | A job cannot carry a trigger | the merge workflow carries `workflow_dispatch`; `changes` outputs all-true on it (§ V4) |
| A16 | MINOR | `clears` had two owners | the fallback records lap 1 and no pacts only (§ T5.3) |

### 11-B — adversarial, product and process

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | A wrapper of the prototype could run Play's fourteen days early | weighed and declined, with the reasons, in the calendar section (README) |
| B2 | GAP | The paid tester fallback was unpriced and is what Google's genuine-use check catches | dropped; iOS-first is the only fallback (README) |
| B3 | GAP | P7's gate was unreachable under the iOS-first fallback | the gate names the recorded state (README, § T14) |
| B4 | GAP | The cast kept generating through the P1 and P2 stops | generation pauses while a decision is pending; each stop states the committed art spend (README P1 row, § T14) |
| B5 | GAP | The go or no-go was taken on a build with the hero-turn defect | question 3(c) now recommends the fix; if left, the decision knowingly accepts a degraded signal (README) |
| B6 | GAP | The aggregate silently excluded the character changes and PvP | said at the aggregate and in item 6 (README) |
| B7 | GAP | P1's exit rested on a Mac the plan only assumed | the owner confirms at P0; a hosted-macOS job stands in otherwise (README money table and P1 row, § V4, § V9, § T14) |
| B8 | GAP | The store name reserved at P5 with no fallback | reserved at P0 with the accounts, a fallback name recorded (README P0 and P5 rows, § T12) |
| B9 | GAP | No blocker class for a run-breaking tester report | holds the `v*` tag and is fixed inside P7 whatever it touches (README, § T14) |
| B10 | GAP | Question 10's "no" was priced as savings only | the closed-test cost named (README question 10) |
| B11 | NUMBERS | A floor of twelve against a tripwire at fourteen | the Android floor is fourteen, two over the rule (README, § T12) |
| B12 | NUMBERS | The measured rate came from review rounds, with no sub-one-a-week case | the case named; P1's stop is taken on the measured real session (README) |
| B13 | NUMBERS | The felt-row bound's worst case was unpriced | four reworks in all across the eight (`FUNCTIONAL.md` § F1.5) |
| B14 | NUMBERS | P5's sittings were fewer than P4's | P5 ≈ 8–12 sittings of two to three hours; the totals re-derived (README) |
| B15 | MINOR | The bake-off had no cap of its own | $300, a second bake-off another $300 by name (§ T10.1) |
| B16 | MINOR | Each document named one of the two exceptions to "never authors" | both in both (§ T1, § V5) |
| B17 | MINOR | The `LICENSE` choice had no options | the fork stated beside question 8(b), all rights reserved recommended (README) |
| B18 | MINOR | The App Privacy questionnaire and the Support URL | added to the P5 list (§ T12) |
| B19 | MINOR | A red monthly batch had no session | it waits for the quarterly session (§ T3) |
| B20 | MINOR | An unspent sprite cap cannot fund the plane key | reworded (`FUNCTIONAL.md` § F3.5) |
| B21 | MINOR | "P0's first act" when 3(c)'s fix precedes it | "the owner's first act" (README, `FUNCTIONAL.md` § F1.5, § T14) |

### 11-C — blind, the implementer

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The red-`main` rule stated both ways | = A1 |
| C2 | GAP | The binder generated fixtures the harness, the instruments and the debug drawer need into `commonTest` | the cell table and the fixtures go to `commonMain`, the tables and hash lists to `commonTest` (§ T2.1, § T7.2) |
| C3 | GAP | `sim` had no battles knobs | `--party --pack --act --lap --clears --pacts` with the prototype's defaults (§ T5.4, § V3) |
| C4 | GAP | The detekt fallback lost the custom rule set | Konsist takes it over (§ T3) |
| C5 | GAP | The generated required-check list could not hold the hand-written jobs or the gate-App checks | a committed literal block beside the generated names (§ T13.5) |
| C6 | GAP | The `env-image` hand-back needed a stable digest | the workflow rebuilds only when `ci/env/**` changed; the digest is the first build's under the head tag (§ V4) |
| C7 | GAP | `party` had no token and an unknown value fell back silently; `--fixture` had two meanings | `battle-fixtures` is the literal, any other value an error; `--party` names a row, `--fixture` keeps its meaning (§ T5.3, § T4.2) |
| C8 | GAP | The fixture-to-schema mapping was an enumeration and the save corpus had no schema | the `spec/<area>/` file that declares it; `saves/**` excluded from the binder (§ T2.1) |
| C9 | GAP | The art tool had no `package.json`, install step or Renovate scope | all three (§ T2.1, § T3) |
| C10 | NUMBERS | "About 4 900 lines of contract and review logs" | about 4 400 (README) |
| C11 | MINOR | The `unlit` flag and the floor | = A11 |
| C12 | MINOR | Root-relative paths from commands that run inside `prototype/` | stated once, with `--out` (§ T4.2) |
| C13 | MINOR | `config` in battles mode | runs mode only (§ T5.3) |
| C14 | MINOR | `BattleCtx` has no clears field | `clears` goes to `spawnPack` alone (§ T4.2) |
| C15 | MINOR | Two version sources with no pairing | the catalog owns libraries, `versions.env` the toolchain, a lint pairs them (§ T3) |
| C16 | MINOR | "§ V9's twenty steps" | "eight milestones" (README) |
| C17 | MINOR | The M2–M3 window absent from § V1 | the sixth discipline item (§ V1) |
| C18 | MINOR | No nightly run yet | = A14 |
| C19 | MINOR | 3(c)'s fix before the move commit, under gates that do not exist yet | the decision closes at P0's start; the fix lands after the move under the prototype's gates run by hand (README) |

### 11-D — blind, the owner's advisor

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | minSdk 31 lived in § T9.4 only, under a decision marked "Owner: no" | D3 names the rise; D11 is an owner decision if the fallback is chosen (README) |
| D2 | GAP | An absence over P4 burns a paid month under a subscription winner | the second exception in the absence protocol; the P4 row says so (README) |
| D3 | NUMBERS | The best case needs a second seat the budget never priced | priced at roughly the same again per month, outside the total (README) |
| D4 | NUMBERS | The "no" branch omitted the `resumeRun` S it also saves | added (README question 10) |
| D5 | NUMBERS | 4.5–6.5 rounded up | "four and a half to six and a half" (README question 2) |
| D6 | MINOR | 19–38 to production access counts P6 the recommended branch defers | 17–34 under question 4(a), 19–38 with the scene phase (README) |
| D7 | MINOR | The listing copy is due at P5 | F2.5's phase (`FUNCTIONAL.md` § F2) |
| D8 | MINOR | The accounts and the testers preceded the go | after it (README P0 row) |
| D9 | MINOR | Question 9 priced money only | half a session to set up and an hour a month (README) |
| D10 | MINOR | The closed testers see the placeholder stage either way | said (README question 4) |
| D11 | MINOR | The worst-case total was two ceilings, not a total | ≈ $4 900 plus the stop branches (README) |
| D12 | MINOR | The testers' lead sat in the post-build list | moved (README) |
| D13 | MINOR | The art tool and the captures had no P0 sitting | in the P0 list; P0 ≈ 6 (README) |
| D14 | MINOR | "Never a gate" against three phase-exit criteria | "never a CI gate; a phase-exit criterion at P4–P6" (§ V1) |
| D15 | MINOR | P2 ≈ 8–10 against its row's 8–11 | 8–11, carried into the totals (README) |
| D16 | MINOR | D20's owner column pointed at question 1 | "by approving this plan, item 3" (README) |
| D17 | MINOR | No fallback if three iPhone testers cannot be found | internal TestFlight with the first-ten-minutes test on both owner phones (README) |

**Declined or only partly applied (MINOR):** none declined.

## Round 12 — on revision 13 (commit `7d736f0`)

Four reviewers on a lighter model, 56 findings: 2 BLOCKING, 25 GAP, 5 NUMBERS, 24 MINOR.
The two blocking rows are one slip and one fact: the consistency pass's own fix to the
`changes` booleans left the root files (`CLAUDE.md`, `.claude/**`, `.nvmrc`, `LICENSE`,
the root `README.md`, `.gitignore`, `.editorconfig`) in no glob, which § T4.1's own
"a path in no glob is a generator error" rule turns into a red generator test from the
first commit (C1, = A3); and the prototype's harness exits non-zero when any cell's stall
rate passes `STALL_MAX = 0.005`, so the golden stall cell — tuned until a stall appears —
failed golden recording and `diff-oracle` by construction (C2). Again about a third of
the gaps are residue of revision 13's edits: the nightly-red rule had no carve-out for
the fix that clears it (A1), the red-`main` booleans were published per job while the
L3 jobs span every module (A2, C5), the fixture path still named no declaring file for
the screens area (A5, C7), the `env-image` hand-back could not find its last build (C6),
`battle-fixtures` had no builder (C4), the halo criterion gated look B, which bilinear
resampling fails by construction (A7), the storyboard save's forced state was not a
decision and replayed to a different run (A6), and the in-scene bar was measured on the
prototype's full rig but gated P5's flat placeholder (A9). The owner's side: a personal
Play account never named as the choice the 12-tester rule follows from (B1), the App
Store name reserved without the bundle id that reserves it (B2), the upload credentials
and the listing graphics missing from P5 (B3), nobody reading the channel, the vitals or
the reviews after P7 (B4, D1), the blocker class unbounded (B5), the demo never run on a
real phone before the go or no-go (B8), the root build files outside the owned paths
(B9), no gate asking whether a generated actor resembles someone else's (D2), and a new
hero's art priced as free (D3). Revision 14 resolves all of them and declines none.

### 12-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The nightly-red rule blocked the `:core` fix that clears it | the same carve-out as the red-`main` rule: a pull request confined to the failing area merges (§ V5) |
| A2 | GAP | Red `main` published per-job booleans while L3's jobs span every module | the post-merge run publishes the module booleans of its failing tasks, cross-module jobs attributed by convention (hash test and `diff-oracle` to `core`, storyboard to `ui`) (§ V5; = C5) |
| A3 | GAP | Root files in no `changes` glob — a generator error by § T4.1's own rule | a `root` boolean: `CLAUDE.md`, `.claude/**`, `.nvmrc`, `LICENSE`, `.editorconfig`, the root `README.md` and `.gitignore` (§ T4.1; = C1) |
| A4 | GAP | `prototype-check` skipped the one change that can break the oracle harness | `prototype-check` gated on `prototype || spec` from P2 (§ V5); `diff-oracle` on `core || spec || prototype` (§ V2) |
| A5 | GAP | A fixture's declaring file was unresolvable in the screens area | `spec/fixtures/<area>/<file-stem>/<name>.json` → `SpecFixtures.<Area>.<FileStem>.<name>` (§ T2.1; = C7) |
| A6 | GAP | Forced storyboard state was not a decision, so the save replayed differently | the forcing hooks recorded as a `debug:` preamble the replay applies; such a save is not portable across `RULES_VERSION` (§ V3) |
| A7 | GAP | The halo criterion gated look B, which bilinear resampling fails by construction | halo reported-only for look B (§ F3.2, § T10.4) |
| A8 | GAP | "The value order of dark figures on a lit ground" had no metric | the phrase dropped; § F3.7 gates on the rulers § T10.4 defines |
| A9 | GAP | One bar measured on the full rig gated the flat placeholder at P5 | two bars recorded at P0: LOW tier for P5, HIGH for P6, the fallback cast as the fixed reference (§ F3.1, § T10.4, § V2, § T14, README) |
| A10 | NUMBERS | Three reworks per row against four in all | the priced worst case: two per row, six in all; a third rework on one row is the branch trigger (§ F1.5; = B11) |
| A11 | MINOR | The `result` record's separator unstated; a doubled em-dash | "fields space-separated" once at the top of the record table; the dash removed (§ T5.3) |
| A12 | MINOR | The seat spread called a share of 72 readings | 36 seats / 72 strip readings; the spread's bar an L* value over the 36 (§ T10.4, § F3.1) |
| A13 | MINOR | `strips` in the anchors file carried nothing the tool lacks | dropped from the anchors schema (§ T10.4) |
| A14 | MINOR | P6's ruler frames carried the accepted cast against a bar set on the fallback | the fallback cast planted at the anchors in both places (§ F3.7, § T14) |
| A15 | MINOR | `deathBy` on a forfeit unsaid | empty on a forfeit, printed as `-` (§ T2.3, § T5.3) |
| A16 | MINOR | "The owner's first act of P0" preceded by a decision and a commit | "the owner's first act after the repository and defect decisions and the move commit" (README, § F1.5, § T14; = D6) |

### 12-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The 12-tester rule follows from a personal Play account, never named as the choice | the fork named in the money row: personal chosen, the organisation route's D-U-N-S lead and trader declaration stated (README) |
| B2 | GAP | The App Store name "reserved" at P0 without the bundle id that reserves it | reserved at P0 by creating the App Store Connect record with its bundle id; the application id chosen with it; Play gets only the owner's listing draft (README P0 row, § T12) |
| B3 | GAP | No App Store Connect API key, no Play Developer API service account, no listing graphics | both credentials in the `release` environment and the P5 owner row; screenshots from the instruments' `shot`, the feature graphic an S (§ T12, README) |
| B4 | GAP | Nobody read the channel, the vitals or the reviews after P7 | the quarterly session reads them; an out-of-cycle fix session at most one a year; the blocker class extended to a run-breaking production report (README, § T14, § T12; = D1) |
| B5 | GAP | The blocker class unbounded | at most three inside P7's M; beyond, P7 re-sizes or the owner decides (README P7 row, § T14) |
| B6 | GAP | Holding P7 for P6 priced as calendar alone | the retention load and the reset risk of a longer closed test added to the branch (question 4(a)) |
| B7 | GAP | An absence at a stop-pause burns a subscription month | the subscription is not renewed while a stop decision is pending (absence protocol) |
| B8 | GAP | The go or no-go on a build never run on a real phone | the branch named: a second named fix inside the freeze (≈ half a session), or the baseline taken with the gap recorded (§ T4.2, README P0 row) |
| B9 | GAP | The root build files outside the owned paths; nothing asserted the quality plugin | `settings.gradle.kts`, the root `build.gradle.kts` and `gradle.properties` owned; a `build-logic` test asserts every included module applies the quality convention plugin (§ V5, § T8) |
| B10 | NUMBERS | "One hand-drawn idle frame took a session" unsupported | the rate marked unmeasured; option B's sessions a guess until P0 measures it (README money row, question 6, § F3.5) |
| B11 | NUMBERS | Two incompatible felt-row bounds | = A10 (§ F1.5) |
| B12 | MINOR | The worst case used the bake-off's $250 estimate against its $300 cap | ≈ $4 924 (README) |
| B13 | MINOR | "With the same testers" across two stores | "testers from the same pool" (README, § T14) |
| B14 | MINOR | P0's breakdown counted the bake-off and the calibration twice | "the six other spikes" (README) |

### 12-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | Root files in no `changes` glob fail the generator's own test from the first commit | = A3: the `root` boolean (§ T4.1) |
| C2 | BLOCKING | The harness exits non-zero on the stall cell it is meant to record | `--no-stall-gate` added to the P2 harness change and the flag list; golden recording and `diff-oracle` pass it (§ T4.2, § T5.4) |
| C3 | GAP | The stage capture had no biome selector, so the 72 readings could not be taken at P0 | `biome=<BIOME>` and `tier=` in the capture's flags; "a stage-only capture in any biome" (§ T4.2) |
| C4 | GAP | `battle-fixtures` had no builder; the boss cell could not be regenerated | its party from any `BATTLE_FIXTURES` row's `make()`, which draws nothing, the pack from the cell line's `pack=` (§ T5.3) |
| C5 | GAP | The post-merge run skipped by path too, so a cross-module break left `main` green | on `push` to `main` `changes` outputs all-true, as on `workflow_dispatch` (§ V5; = A2) |
| C6 | GAP | `env-image` could not find its last build after the hand-back | the workflow resolves the last build as the newest commit tag on the branch in the registry and verifies the digest and the manifest against that image (§ V4) |
| C7 | GAP | The fixture path named no declaring file for the screens area | = A5 (§ T2.1) |
| C8 | NUMBERS | Round 11 logged as 74 findings, 30 GAP, against 73 rows in its tables | 73 and 29 in the log and the README's series |
| C9 | MINOR | `--out <path>` against the tool's `key=value` parser | `out=<path>` (§ T4.2) |
| C10 | MINOR | The device-runner repository, the third ledger source and the SKIPPED row unconditional on question 5 | all three conditional on question 5's runner branch; under the farm branch the farm's rows arrive through the nightly's own artifact (§ V9, § V7, § T13.5) |
| C11 | MINOR | "Every pull-request workflow's `changes` job" could not hold for `owner-review.yml` | "every workflow that runs lane jobs on a pull request" (§ V5, § T4.1) |
| C12 | MINOR | `ramps.json` typed by a bible written later | the `schema: Ramps` block lands with the ramps export (§ T4.2) |
| C13 | MINOR | Spike 5b had no directory | `plan/spikes/5b/` (§ T14) |

### 12-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | No steady-state duty for the channel, the vitals or the reviews; the Support URL served the demo | = B4; the Support URL is `docs/support/index.html`, naming the reports address (README, § T14, § T12) |
| D2 | GAP | No gate asked whether a generated actor resembles someone else's | criterion 8, "no recognisable third-party character, mark or logo", on the critic's sheet; the residual risk stated (§ F3.4, § F3.6) |
| D3 | NUMBERS | A new hero's art priced as free | a changed hero folds free; a new one adds its frames, its ≈ $15–30 and its sheet outside the 43/645 model (§ F4, README P0 row) |
| D4 | MINOR | Principle 10 listed five disciplines against § V1's six | the M2–M3 window added (README) |
| D5 | MINOR | D6's "no" branch promised a decision log no build could export | scoped to the debug drawer (README D6) |
| D6 | MINOR | "The owner's first act of P0" | = A16 (README, § F1.5, § T14) |
| D7 | MINOR | The WebView wrapper's Play-policy risk stated in one place only | carried into D1 and item 2 (README) |
| D8 | MINOR | The near-daily assumption stated for P4–P6 only | stated for the whole run to the first test-track build (README) |
| D9 | MINOR | Question 6 closed "at P0" with no order against the bake-off's spend | "closes at P0's start, before the bake-off's spend" (README) |
| D10 | MINOR | The monthly hour outside the programme's owner time | added (README) |
| D11 | MINOR | The three balance diagnoses never reached the approval surface | named in the P3 owner row as a post-gate decision the owner owes (README) |
| D12 | MINOR | D2's enumeration of what "public" exposes omitted `plan/**` | added (README D2) |
| D13 | MINOR | The whole-cast re-gate priced in money, not sessions | 2–4 sessions beside its money (question 6, money row) |

**Declined or only partly applied (MINOR):** none declined.

## Round 13 — on revision 14 (commit `c0d4641`)

Four reviewers on a lighter model, 52 findings: 0 BLOCKING, 21 GAP, 7 NUMBERS, 24 MINOR —
the first round with no blocking finding. The gaps sit on the plan's edges rather than in
its core: the tag ruleset's bypass list was never stated, and a ruleset exempts nobody
implicitly (A6); the Gradle wrapper was a second toolchain pin outside every gate (A5,
B1); the golden-recording job re-posted the merge lane's required checks onto the head
commit (A4); the forcing hooks had no firing point, so a forced storyboard save still
replayed differently (A2); the in-scene bars covered LOW and HIGH while the testers see
MED over the placeholder (A3); the nightly carve-out said "confined to" where the rule it
copies says "intersect" (A7); the seat spread's median had no population (A1); the
calibration's "must be exact" reached criteria with no reference implementation in the
tree (C1); a multi-schema area file had no root (C2, A13); Renovate's own configuration
would have failed the generator's tree test (C3); the placeholder plane had no depth (C4);
and on the owner's side the character brief's design time and the plan's own reading were
in no hours line (B2, D2), the phone-in-a-VM path was unproven (B3), the opted-in count
had no observer (B4), the accepted cast was never gated on the stage it ships on (B5),
the steady state's upgrade debt and the programme's own attrition had no risk row (B6,
B7), the App Store name's reservation had no stated lifetime (B8), the private branch
lost a gate it did not name (B10), D11's minSdk decision was off the P5 owner row (D1),
and the re-gate's money was outside the worst case (B11). Revision 15 resolves all of
them; one is applied in part with the evidence (B9).

### 13-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The seat spread's "median seat" had no population | the median seat of the same biome frame, reported as the maximum over the six frames (§ F3.1, § T10.4) |
| A2 | GAP | Three of the five forcing hooks are point-in-time; "applied before the first decision" cannot replay them | each hook carries its firing point — `room@<stage>`, `pack@<battle>`, `hp@<decision>`; act and lap before the first decision (§ T5.3, § V3.2) |
| A3 | GAP | P5's bar was LOW while the shipped app runs MED or HIGH over the placeholder | three bars at P0, one per tier; P5 gated at LOW and at the reference phone's default tier (MED), P6 at HIGH (§ F3.1, § T10.4, § V2, § T14, README P5 row) |
| A4 | GAP | `record-goldens` dispatched the merge workflow and re-posted every required check, red by construction | its own `workflow_dispatch`-only workflow with job names outside `ci/required-checks.txt` (§ V4, § T1) |
| A5 | GAP | `gradlew*` and `gradle/wrapper/**` outside the owned paths | `gradle/**` and `gradlew*` owned; the wrapper's `distributionUrl` in § T3's version lint (§ V5, § T3; = B1) |
| A6 | GAP | The tag ruleset's bypass list unstated; an empty one makes every tag uncreatable | the tag ruleset's bypass list holds the owner as repository admin, the one bypass in the repository (§ V5, README D15) |
| A7 | GAP | The nightly carve-out said "confined to" where the red-`main` rule says "intersect" | "intersect" in both (§ V5) |
| A8 | NUMBERS | A standard enemy 40–50 rows against the review's 11–16 % (40–58) | 40–58 rows, the review's band (§ F3.1) |
| A9 | NUMBERS | The counter refused at 90 % of the kind's $4 000 while the sprite key caps at $3 500 | the counter refuses at 90 % of each key's own cap — $3 150 sprites, $450 portraits (§ T10.1, § T10.7, README) |
| A10 | MINOR | The band rule added an upper bound to one-sided criteria | only the stated side of a one-sided criterion moves (§ F3.1) |
| A11 | MINOR | Two flush positions open: the final `event` drain against `party`, and `probe` | `party` before any `event` of its battle; the post-outcome drain before the next `party` or `result`; `probe` after `result`, before `end` (§ T5.3) |
| A12 | MINOR | `root` was a literal list, so the next root file fails the generator test again | `root` is the residual for the root and `.claude/**`; the generator error is for paths below the root (§ T4.1) |
| A13 | MINOR | `tools/art` is no Gradle module to receive ART fixtures; a multi-schema file had no top type | ART fixtures read by `tools/art` outside the binder; the first `schema:` block is the root (§ T2.1, § T7.4; = C2) |

### 13-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The Gradle wrapper a second unowned pin executed by every lane | = A5 (§ V5, § T3) |
| B2 | GAP | The character brief's design time in no hours line | named, with the plan's reading and the ten questions, as owner time the plan does not size; missing P0's exit costs § F4.3's price (README, twice) |
| B3 | GAP | The phone-in-a-Linux-VM path unproven on an Apple-silicon Mac | M7 proves the path with the real phone before question 5 closes; the farm is the answer if it fails (README question 5, § V9) |
| B4 | GAP | The opted-in count — the tripwire's number — had no observer | Play Console's testing-requirement tracker read weekly on the P5 and P7 owner rows (README) |
| B5 | GAP | The accepted cast never gated on the stage it ships on | P5's exit: the sprite axis not below its P4 reading, a miss the rig's to fix inside P5 (§ T14, README, § F3.5, § T15) |
| B6 | GAP | No risk row for the steady state's upgrade debt against a store-mandated bump | a risk row with § T3's fallback and the out-of-cycle session; § T3 says a mandated bump does not wait for the quarter (README, § T3) |
| B7 | GAP | No risk row for the programme's own attrition; nothing playable until P5 | a risk row with a month-without-a-session tripwire; the interim gap stated as an accepted cost; the stops also ask whether the game is still wanted (README) |
| B8 | GAP | The App Store name's reservation lifetime never asked | a build-less record keeps its name today (Apple's 180-day limit is gone), confirmed at P0's terms check; if a limit has returned, only the ids are chosen at P0 (§ T12, README P0 row) |
| B9 | NUMBERS | 8(b)'s rate $0.008, allowance 3 000 on Pro, Pro's own price missing | the allowance (3 000 on Pro) and Pro's ≈ $4 a month applied; the rate stays $0.006 — GitHub cut Linux 2-core from $0.008 to $0.006 on 2026-01-01 (README question 8(b)) |
| B10 | NUMBERS | A private repository loses the `release` environment's required reviewer (GitHub Enterprise only) | stated in 8(b), § V5 and the P5 owner row: the private branch ships behind the tag ruleset alone (README, § V5) |
| B11 | NUMBERS | The whole-cast re-gate's ≈ $1 500–2 500 outside the cell and the worst case | in the Image-generation cell and the worst-case line, ≈ $6 400–7 400 with it (README money table) |
| B12 | NUMBERS | The six felt-row reworks counted, not priced | six S-sized reworks inside P5's XL, each re-walked in P5's next sitting inside its 8–12 (§ F1.5) |
| B13 | MINOR | "Prepaid or capped" put $4 000 out before the P1 and P2 stops | capped is the default; prepaying is the owner's choice with its exposure named (README P0 row; = D6) |
| B14 | MINOR | The three-or-more-sessions branch had no all-in recurring figure | ≈ $200–400 a month on that branch in the total row (README) |
| B15 | MINOR | `CODEOWNERS` and the check's list could drift | one list in the check's code, `CODEOWNERS` generated from it, a test asserting they agree (§ V5) |

### 13-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | GAP | "Must be exact" reached criteria with no reference implementation; a disagreement's effect on P0's exit unstated | exact for the seven criteria the committed instrument computes; the scratch-decoder criteria adjudicated with the recorded value as context; an undecided disagreement, not a non-zero one, holds P0 (§ T10.4) |
| C2 | GAP | A multi-schema area file had no root block | the first `schema:` block is the root; later blocks are nested, reachable through `object:<Name>` (§ T2.1, § T7.4) |
| C3 | GAP | Renovate's configuration in no glob; `gradlew.bat` uncovered | `.github/renovate.json`, written at P1, in the tree and the `build` boolean; `gradlew*` (§ T2.1, § T3, § T4.1) |
| C4 | GAP | The placeholder plane's depth and parallax a guess | drawn as the flat tiers draw their merged plane — at `-PLANE_PAD`, no parallax, no shake lag — until P6 (§ T9.2) |
| C5 | NUMBERS | The cast's first pass priced at 645 frames though option (b) generates 559 | 645 under (a), 559 under (b): ≈ 3 400–3 900 images ≈ $600–700, re-derived at P0's exit (§ T10.7, README) |
| C6 | MINOR | "As the prototype's seam does" was wrong for `deathBy` | `deathBy` empty by decision; the prototype's `findDeathBy` would name a fallen hero's killer (§ T2.3) |
| C7 | MINOR | The Pages copy step's source resolved under the `prototype` working directory | `$GITHUB_WORKSPACE/docs/…` (§ T4.1) |
| C8 | MINOR | The `set` hash's input unstated | over the run hashes' lowercase hex, in order, no separator (§ T5.3) |
| C9 | MINOR | The cell table's `runs` column against the battles record's `n=` | in battles mode `runs` is emitted as `n=` and no `path=` is written (§ T5.3) |
| C10 | MINOR | The gate App's three check-run names never fixed | `owner/owned-path`, `owner/goldens`, `owner/contract-clause`, spelled identically in the ruleset, the list and the workflow (§ V5, § V2) |
| C11 | MINOR | M6's golden step had no pass condition | it asserts SKIPPED-GOLDEN with the tolerance diff in the bundle, never a green or a hard failure (§ V9) |

### 13-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | D11's minSdk decision off the P5 owner row; the Android 10–11 share unstated | on the P5 row, the share read from the Play Console's device catalogue at the decision (README) |
| D2 | GAP | The brief's design time and the plan's reading in no hours line | = B2 (README) |
| D3 | MINOR | Question 8(b) omitted `plan/**` from what public exposes | added (README) |
| D4 | MINOR | Two consecutive risk rows each claimed the bottleneck | the review queue binds at three or more sessions a week, agent capacity below (README) |
| D5 | MINOR | "Four known defects" stated as the default against 3(c)'s recommendation | "one, if question 3(c) takes the fix" in both places (README) |
| D6 | MINOR | $4 000 loaded at P0 before the providers are named | the bake-off's keys at P0's start, the cast's after the bake-off names the providers (README P0 row; = B13) |
| D7 | MINOR | Question 2's 4.5–6.5 sessions outside the aggregate sentence | added, with the calendar moving (README) |
| D8 | MINOR | "Rebuilt bit for bit" against the three rules the oracle lacks | the exception named in item 3 (README) |
| D9 | MINOR | The device lane SKIPPED in an absence while the runner stays on | "when the phones travel with the owner" (README) |
| D10 | MINOR | The demo-unusable branch unpriced on the approval surface | ≈ half a session outside the aggregate (README P0 row) |
| D11 | MINOR | Item 4 promised a runner question 5 may not take | "a device lane out of the agents' reach (the runner or the farm — question 5)" (README) |
| D12 | MINOR | The owner "sets up" the privacy page on an owned path | the owner dictates it; an agent commits it from the owner's copy (README P5 row) |
| D13 | MINOR | The farm branch's recurring owner walk in no steady-state line | on the "Always" row, conditional on question 5, about half an hour per tag (README) |

**Declined or only partly applied:** B9 in part — the $0.008 rate was declined with the evidence above; the allowance and Pro's price were applied.

## Round 14 — on revision 15 (commit `8b1ed4f`)

Four reviewers on a lighter model, 51 findings: 2 BLOCKING, 22 GAP, 4 NUMBERS, 23 MINOR.
The two blocking rows are mechanisms of the plan's own making, both found by the
implementer: the environment image's hand-back commit lands `manifest.image.json` inside
the `ci/env/**` glob that triggers a rebuild, so each hand-back re-armed the failure it
was meant to clear (C1); and the device runner's ledger rows were to be appended to the
nightly's issue with a token holding `statuses: write` alone, onto an issue that exists
only on a red night (C2). The gaps: the tier the testers see had its bar measured on the
prototype's four-plane diorama while P5 draws one flat plane (C5), and what LOW draws over
that plane was never stated (A1); a bar had no form (A3); L2b dropped the shipped tiers
after P6 (A5); the room hook still fired once per act and lap (A6); the portrait hue
criterion deleted FIRE's own glow (A4); the required-check list check failed the very
pull request that adds a job (A2); ARCADE was ungated (C8); the calibration's second
reader was in no milestone (C6); the Kotlin `frames` instrument could not plant the
fallback cast (C7); the runs cells had no legal `party` and the Vault relics no home (C3);
the save had no header (C4); and on the owner's side the art programme committed before
M4's gate (B1), a provider that cannot cap (B2), a public repository's schedules going
silent after sixty days (B3), `prototype-check` outliving the oracle (B4), no stop after
P2 (B5), the reservation limit never held against the calendar (B6), no risk row for the
resemblance exposure (B7), a lever whose existence nobody checked (B8), a P5 cast miss
that could be neither fixed nor waived (D1), and the app icon, splash and feature graphic
with no producer (D2). Revision 16 resolves all of them and declines none.

### 14-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | What LOW draws over the placeholder unstated; the prototype's LOW has no pools and no gain | LOW is the key light and the grade baked into the plane and nothing else, as the prototype's `bakeFlat`; MED and HIGH draw the full rig over it; the LOW bar is the prototype's LOW frame over the same composite (§ T9.2, README D16, § F3.1, § T10.4) |
| A2 | GAP | The list check failed the pull request that adds a lane job until the owner edits the ruleset | the check is re-run, not re-pushed, once the owner adds the rule, while that pull request is open (§ T13.5) |
| A3 | GAP | The form of a bar never given | a bar is a count: the number of the 72 readings at ≥ 1.5:1 the rig achieves at P0 for that tier; a frame set counting below it fails (§ F3.1, § T10.4, § V2) |
| A4 | GAP | The hue criterion excluded the neutrals FIRE's glow is byte-identical to | each cell to its nearest ramp; only the neutral ramps the element does not share are uncounted (§ T10.4, § F3.3) |
| A5 | GAP | L2b measured HIGH only after P6, dropping the shipped tiers | LOW and MED from P5, HIGH as well from P6; P6's exit holds LOW and MED at their P5 bars (§ V2, § T14, README P6 row) |
| A6 | GAP | `room@<stage>` fired once per act and lap | `room@<act>.<stage>` (§ T5.3, § V3.2) |
| A7 | NUMBERS | A 3-minute detekt tripwire inside a 5-minute L2a | 90 s (§ T15) |
| A8 | MINOR | "The oracle does not contain forfeit" is false; § F1.1 omitted the `deathBy` change | the oracle never exercises it; `deathBy` empty by decision named in § F1.1's row (README item 3, § T2.3, § F1.1) |
| A9 | MINOR | The seam sketch's `state()` had no source | the observer in `runSteps`'s signature (§ T2.3) |
| A10 | MINOR | `lineup.ts`'s bands, colour count and interior share in neither calibration class | in the exact-reproduction list (§ T10.4; = C9) |
| A11 | MINOR | `FORFEIT` listed as a kind while it answers a pending | a forfeit is an `answer` to the pending it quits, one example line (§ T5.3) |
| A12 | MINOR | The version lint's four files sit in four booleans and no job keys on `root` | the lint runs unconditionally in every lane (§ T3) |

### 14-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | Actors accepted and committed during P1 before M4's gate and L2b's asset gate | in § V1's discipline list; their pull requests held until M4; the asset gate re-run over them at P1's exit (§ V1, § V9) |
| B2 | GAP | The $4 000 ceiling assumed every provider can cap; Gemini's budgets only alert | a cap the provider enforces is a selection criterion at P0's terms check; where the winner cannot cap, the counter is the ceiling (§ T10.1, § T10.7, README) |
| B3 | GAP | GitHub disables a public repository's schedules after 60 days; a stale nightly read as green | Renovate's monthly batch is the keep-alive; a last run older than 48 hours reads as red (§ V5, README steady state) |
| B4 | GAP | `prototype-check` required forever, gating nothing after the oracle retires | it retires with the oracle; the prototype workflow keeps the freeze check alone (§ V8.3, § V5) |
| B5 | GAP | No stop after P2; a felt-row "stop" during a running closed test undefined | the last stop on P5's first playable build, before the store set-up and the closed test; a stop ends a running test and a resumption restarts the fourteen days (README P5 rows, § T14, § F1.5) |
| B6 | GAP | The reservation limit never held against the slowest calendar | the terms check asks for the limit against 38 weeks; any shorter limit moves the name to P5 (§ T12, README P0 row) |
| B7 | GAP | No risk row for the resemblance exposure | a row with its response and price (README risks) |
| B8 | GAP | Nobody checked that a higher tier or a second seat exists | P0 records whether the tier can rise and a second seat is permitted; the fast branch is conditional on it (README money row, calendar) |
| B9 | NUMBERS | P5's XL and P7's M overloaded by named sub-items; three free blockers | the felt-row worst case a contingent item outside P5's band (up to 2–4 sessions); the first blocker inside P7's M, the second and third an S each (§ F1.5, README, § T14) |
| B10 | NUMBERS | 8(b)'s "free arm64 leg lost" false since 2026-01-29; the allowance drained by macOS at 10× | the arm64 leg metered at $0.005 on two vCPUs; Linux bills in full — the nightly ≈ $30, the merge lane ≈ $0.50 a pull request (README question 8(b)) |
| B11 | MINOR | The wrapper rationale's mixed-cast objection contradicted the accepted branch | the clause dropped (README) |
| B12 | MINOR | "No recurring cost" assumed the postponed self-hosted platform charge stays away | named as an assumption, ≈ $4–8 a month if it returns (README question 5) |
| B13 | MINOR | The App justified by spike 6 alone, though no agent pushes without it | the first thing P0 does, before the move commit (README P0 row, § T14) |
| B14 | MINOR | Spend-only pull requests uncounted in P4's sittings | spend rows ride the next pack's pull request; the counter reads the local ledger (§ T10.1) |

### 14-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The env-image hand-back rebuilt on its own artifact and never converged | the rebuild keys on the three recipe files, never on `manifest.image.json` (§ V4, § V9 M3) |
| C2 | BLOCKING | The runner's ledger rows needed `issues: write` and an issue that exists only on a red night | a standing `ledger` issue created at M7; the token holds `statuses: write` and `issues: write` (§ T1, README D17, § V5, § V7, § T13.5) |
| C3 | GAP | Runs cells had no legal `party`; the Vault relics no typed home | `party=-` for runs cells; `spec/fixtures/golden/vault/default.json` typed by `spec/golden/vault.md`, `vault=<n>` equipping its first n (§ T5.3, § T4.2, § T7.4) |
| C4 | GAP | No record carried `RULES_VERSION` or the seed, so a save had nothing to parse | a `save 1 rules=<N> seed=<uint32>` first line, never in a trace (§ T5.3, § T11) |
| C5 | GAP | The MED bar measured on the diorama P5 never draws | recorded over the flat composite lit by the rig at MED through a `flat=1 tier=MED` look, a fixture-page change (§ F3.1, § T10.4, § T4.2) |
| C6 | GAP | The calibration golden's second reader in no milestone or exit | in M5, P1's exit list and P1's deliverables (§ V9, § T14) |
| C7 | GAP | No Kotlin instrument could plant the fallback cast once P4 commits actors | `frames --cast fallback --seats all` (§ V3.3, § T14) |
| C8 | GAP | ARCADE ungated by the in-scene rule | exempt as a stylisation, one transform over every biome (§ F3.1, § T10.4) |
| C9 | MINOR | `lineup.ts`'s other metrics in neither calibration class | = A10 (§ T10.4) |
| C10 | MINOR | `debug:` and `debug` spellings | one spelling (§ V3.2, § T11) |
| C11 | MINOR | `end <draws>` unstated | the cell's draw index after the run (§ T5.3) |
| C12 | MINOR | The prototype's cells driver unnamed | `prototype/sim/cells.mjs` (§ T5.3) |
| C13 | MINOR | `record-goldens.yml` created by no milestone | in M3's list (§ V9) |
| C14 | MINOR | Where `setup.sh` and `env.Dockerfile` land at P0 | in `ci/env/` by spike 6, reviewed there by M1 (§ T4.1) |
| C15 | MINOR | The `tools` boolean's glob unwritten | `tools/instruments/**` (§ T4.1) |

### 14-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | A P5 cast miss could be neither fixed nor waived | the felt rows' bound: one rig rework, then a recorded miss carried into P6 or P7 held (§ T14, README P5 row, § F3.5, § T15) |
| D2 | GAP | The icon, the splash and the feature graphic had no producer, source or gate | a crop of an accepted hero's idle frame over the ember ground, under `assets/store/`, reviewed on the P5 row (§ F2.5, README, § T2.1) |
| D3 | NUMBERS | "An absolute 8 would be met" though composition scored 7 | met on the scene axis, not on composition (README P6 row, § T14) |
| D4 | MINOR | Item 6 priced the bake-off at $250 while the keys carry $300 | "≈ $250 expected, capped at $300 on the keys" (README) |
| D5 | MINOR | Two quantities, one number (17–34) | "of capacity" and "deep" (README) |
| D6 | MINOR | Three owner decisions off the owner table | the bake-off's branch and the already-at-9 bar on the P0 row, the stop decisions on P4, the mixed cast on P5 (README) |
| D7 | MINOR | The support page missing from the P5 row | named beside the privacy page (README) |
| D8 | MINOR | The module summary omitted `:engine` and `:core-testing` | named (README) |
| D9 | MINOR | Whose hour of pool upkeep | the owner's, outside item 6's lines on that branch (README question 9) |
| D10 | MINOR | The aggregate under a "no" to question 6 unstated | 17–34 without P4's L, option B outside it (README question 6) |

**Declined or only partly applied:** none declined.

## Round 15 — on revision 16 (commit `f1cf52b`)

Four reviewers on a lighter model, 48 findings: 0 BLOCKING, 16 GAP, 10 NUMBERS, 22 MINOR —
the second round with no blocking finding. The gaps: the seat spread was called gated but
no lane measured it, and its two producers planted different populations (A1, C4); the
rig's tuned constants, which the bars were achieved with, were in no export (A2); LOW's
frame omitted the vignette map it draws (A3) and its bar was recorded on a floor P5 never
draws (A4); the hand-written workflows' `changes` jobs could share a check name (A6); the
cell line's slug came from no flag (C1); the Vault file's root was a list the grammar
cannot express (C2); a fixture row's lap and pacts fought the knobs (C3); and on the
owner's side the steady state's recurring compute was misstated (B1), the device lane
could not assemble on an arm64 guest (B2), the store identity had no refresh once the
cast lands (B3), a provider that cannot cap was still allowed (B4, A5), an existing Play
account might predate the rule the whole test plan rests on (D1), and the ruler bars and
P6's acceptance had no rework bound (D2). The numbers: the measured pace was an estimate
from a day of rounds (B5); the outermost ceiling omitted the second bake-off (A7, B6,
D3); the admin hours and the review sittings were short (B8, B9); question 1's residency
lever was unsized (B10); the slowest branch was cut against nothing (B11); and the icon
could not reach 1 024 px at 4× (B12). Revision 17 resolves all of them; one is declined
with the evidence (B7).

### 15-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The seat spread "gated" but measured by no lane; two producers, two populations | reported, not gated — the rig's own measure with one id at all six anchors, `seat=<id>` and `frames --seat <id>` (§ F3.1, § T10.4, § V2, § V3.3) |
| A2 | GAP | The rig's tuned constants in no table or export | exported once as `rig.json` with the light data and bound as `spec/platform/` constants (§ T4.2, § T2.5) |
| A3 | GAP | LOW's frame stated without the vignette-only grade map it draws | "plus the vignette-only grade map every frame" (§ F3.1, § T9.2, § T10.4) |
| A4 | GAP | The LOW bar recorded on `bakeFlat`'s resampled floor | recorded through the `flat=1 tier=LOW` path over the committed composite, as MED (§ F3.1, § T10.4, § T4.2, § T9.2) |
| A5 | GAP | The no-cap branch left the ceiling unenforced | = B4: prepaid or provider-capped is a requirement; the counter is never the ceiling (§ T10.1, § T10.7, README) |
| A6 | GAP | Hand-written workflows' `changes` jobs could share a check name | prefixed like the generated ones — `prototype-changes`, `env-image-changes` (§ V5, § T13.5) |
| A7 | NUMBERS | The outermost ceiling omitted the second bake-off | ≈ $6 700–7 700 (README; = B6, D3) |
| A8 | MINOR | The 3(c) fix promised an interactive second decision the frozen `run.ts` cannot ask | a synchronous auto-choice in the prototype; the second decision is the seam's (§ F1.4) |
| A9 | MINOR | The neutrals enumeration two ramps short; § F3.3's sentence garbled | `ramps.json`'s `neutrals` list; the sentence repaired (§ T10.4, § F3.3) |
| A10 | MINOR | The klib dumps named no runner | on the macOS job, inside its budget (§ T3, § V2) |
| A11 | MINOR | The third stop trigger stated two ways | once, per key at 90 % (§ F3.5) |
| A12 | MINOR | Removing a required check had no order | the owner drops the rule first, then the job leaves (§ V5, § T13.5) |

### 15-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The steady state's "only recurring compute" false under the farm or pool branches; 8(b)'s metered CI outside the recurring total | the farm's or the pool's monthly cost continues after P7; 8(b) adds ≈ $150–300 a month while the programme runs; a budget of two out-of-cycle sessions shared by three triggers (README money table) |
| B2 | GAP | The Android lane cannot assemble on an arm64 guest — Google ships no build-tools for it | the lane assembles nothing: it downloads the merge lane's APKs (the token's `actions: read`) and runs them by `adb`; M7 proves one `connectedCheck` that way (README D18, D17, § T1, § V9) |
| B3 | GAP | The store identity cut from the fallback hero had no refresh | re-cut from the accepted hero before the P7 tag, a listing update and one owner sitting on the P7 row (§ F2.5, README) |
| B4 | GAP | The cap rule stated three incompatible ways | prepaid or provider-capped is a requirement — a provider that is neither is not used; the counter is a mirror (§ T10.1, § T10.7, README) |
| B5 | NUMBERS | "The one to two a week this review measured" unsupported — all rounds inside a day | the cap suggests, not measures; *n* is measured at P1 (README, three places; "estimated pace") |
| B6 | NUMBERS | The outermost ceiling short by the second bake-off | = A7 (README) |
| B7 | NUMBERS | GitHub's Linux rate claimed at $0.008 | declined: GitHub cut Linux 2-core from $0.008 to $0.006 on 2026-01-01 (its changelog; verified in round 13); $0.006 stands |
| B8 | NUMBERS | The admin hours short of the plan's own list | ≈ 25–45 hours (README, twice) |
| B9 | NUMBERS | P4's sittings allowed no taste round; P0's six carried too much | P0 ≈ 8, P4 ≈ 12–18; 59–74 sittings, 46–59 to the first build, nine to twelve weeks, thirteen to sixteen with the stores, ≈ 60–125 hours (README, five places) |
| B10 | NUMBERS | Question 1's painted branch a third calendar mover, its residency lever unsized | named in the effort paragraph: ≈ 1 session inside P4's L, the residency change inside P5's XL (README) |
| B11 | NUMBERS | "A year or more below one" priced nowhere while the checks are cut against 38 weeks | below one session a week the plan is not priced and P1's stop is the answer (README) |
| B12 | NUMBERS | The icon master cannot reach 1 024 px at 4× | 16×, nearest-neighbour (§ F2.5) |
| B13 | MINOR | "About a month before the build" only at one session a week | lined up from P2's exit, invited at P3's gate — one to four weeks by pace (README, § T12) |
| B14 | MINOR | The closed test's trigger omitted what precedes the build | = D5 (README, § T12) |
| B15 | MINOR | The bake-off's paid month a third absence exception | named (README) |
| B16 | MINOR | Three triggers claimed the one out-of-cycle session | a budget of two, shared (README; = B1) |
| B17 | MINOR | Option (a) cannot move to the per-image providers | the clause dropped; dropping (a) costs the consistency mitigation (§ T10.7) |

### 15-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | GAP | The cell line's slug came from no flag | `--cell <id>` on both harnesses, passed by `cells.mjs` (§ T5.4, § T14) |
| C2 | GAP | A list-rooted schema the grammar cannot express | the root has one field, `relics: list<object:VaultRelic>` (§ T5.3, § T7.4) |
| C3 | GAP | The fixture row's lap and pacts against the `--lap`/`--pacts` knobs | `--party <row>` takes both from the row and refuses the flags; `battle-fixtures` means lap 1, no pacts (§ T5.3) |
| C4 | GAP | Two producers planted different seat populations; the seat list in no file | the per-biome seat list recorded in `spec/art/bible.md`; `seat=all` and `--seats all` plant it, `seat=<id>` and `--seat <id>` one id (§ T4.2, § V3.3, § F3.1, § T10.4) |
| C5 | MINOR | "The one engine change" beside a second; a private branch the capture cannot call | two engine changes; the `unlit` flag returns the composite with the crisp floor inside it (§ T4.2) |
| C6 | MINOR | The lifted metrics omitted the contrast columns | added (§ T10.4) |
| C7 | MINOR | The producers' definitions named no masks | `<frame>.masks/<seat>.png` in both (§ V3.3, § T4.2) |
| C8 | MINOR | The second reader had no module or lane; the calibration golden absent from L2b | a JVM test in `tools/instruments/` in L2b; the golden and its reader in L2b's contents (§ T10.4, § V2, § V9) |
| C9 | MINOR | The icon had a reviewer but no producer or ground value | `frames --icon` over the bible's recorded ground colour (§ F2.5, § V3.3) |
| C10 | MINOR | The protocol freeze ordered against the bake-off, not spike 8 | before spike 7 or 8, whichever runs first (§ F3.5) |
| C11 | MINOR | Held art pull requests would conflict on one spend file | one row file per generation call under `assets/spend/`, summed by the counter (§ T10.1, README, § T2.1) |
| C12 | MINOR | "Their P5 bars" ambiguous | "the P0-recorded LOW and MED bars" (§ F3.1, § T10.4, § T14, README) |
| C13 | MINOR | The art fixtures validated by nothing | spec-lint validates `spec/fixtures/art/**` against its root schema (§ T7.8) |

### 15-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | Never asked whether a Play account predating November 2023 exists | confirmed with its creation date at P0; an older account drops the closed-test rule and the recruitment (README P0 row, § T12) |
| D2 | GAP | The ruler bars and P6's acceptance had no rework bound | the cast-miss shape: one rework of the rig or the planes, then a recorded miss or the phase held (§ F3.1, § T14, README P6 row) |
| D3 | NUMBERS | The outermost ceiling omitted the second bake-off | = A7 (README) |
| D4 | MINOR | Out-of-band items undercounted | every one listed in the effort paragraph (README) |
| D5 | MINOR | The closed test's trigger omitted the last stop, the store set-up and the invitations | named in the trigger's three statements (README, § T12) |
| D6 | MINOR | Question 5 costed on phones the owner may not own | "holds, or buys at P0" (README) |

**Declined or only partly applied:** B7 declined with the evidence above.

## Round 16 — on revision 17 (commit `3c691ad`)

Four reviewers on a lighter model, 45 findings: 0 BLOCKING, 17 GAP, 4 NUMBERS, 24 MINOR —
the third round with no blocking finding. The gaps: no engine path lit a supplied plane,
so the LOW and MED bars' venue had no producer (A1, C2); a golden re-recording that bumps
no rule had no route past the merge lane (A2); the blind verifier could not compile
against a module the spec commit lacks (A3); a red `main` from a step no module owns
published an empty set (A4); a save two versions old had no stated fate (A5); nothing ever
compared the shipped party's values with the shipped enemy rank's (B1); the field crash
signal could be empty and nothing said so (B2); the EU trader-status declaration was in no
checklist (B3); the one-re-run rule was left to discipline while the agents' App holds
`actions` (B4); M2's "not enforced" branch had no response (B5); the testers' phones were
never held against the minSdk fork (D1); the critic's pinned prompt had no stated
behaviour under look B (D2); the portrait branch fought the P0-recorded bars (D3); the
bible's seat list was written after the captures that plant it (C1); `hitRect` had no
derivation for a generated actor (C3); and the device lane's APKs came from no named run
(C4). The numbers: the outermost ceiling mixed caps with expectations (B6, D7); the
contingent list omitted the re-gate (D4); the farm's fallback nights were unpriced on the
recommended branch (D5); 8(b)'s metered CI was outside the programme total (D6).
Revision 18 resolves all of them and declines none.

### 16-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | No engine path lights a supplied bitmap; "two engine changes" did not cover LOW over the composite | the hook is a flat plane supplied as an image — `bakeFlat`'s bake over it at LOW, the rig over its flat blit at MED — the second engine change (§ T4.2; = C2) |
| A2 | GAP | A trace-format re-recording could satisfy neither golden rule | a second route: a re-recording commit bumping the `trace` version and its `GOLDEN` clause, every cell named, an approval record, `RULES_VERSION` untouched (§ T7.3) |
| A3 | GAP | The verifier's worktree at the spec commit has no API to compile against | the writer's public API alone — the ABI dump or a signature-only stub — beside the spec commit (§ T6.3) |
| A4 | GAP | A red `main` from a non-Gradle step published no module | attributed to `build`, where such a fix lives (§ V5) |
| A5 | GAP | A save older than N − 1 had no stated behaviour | abandoned with the Vault untouched and the player told, as removed content; § F2.1's promise reads "from the previous version" (§ T11, § F2.1) |
| A6 | MINOR | `rig.json`'s constants are module-private with no export named | `export` added to them in the same pull request, as the ramps export does (§ T4.2) |
| A7 | MINOR | `--lap`/`--pacts` refused wherever a party is named | the knobs dropped; the lap and the pacts come from the row alone (§ T4.2, § T5.3, § T5.4, § V3) |
| A8 | MINOR | The secret-bearing job checked out the untrusted head | the changed files read through the API, no checkout (§ V5) |

### 16-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | No number compares the shipped party with the shipped enemy rank | `art rulers` once over the accepted cast at P5's end, the two rank medians reported (§ T14, § F3.1) |
| B2 | GAP | The field crash signal can be empty; F2.7's share died with question 10's "no" | the run's text share exists whatever question 10 answers; an empty signal is recorded as such and the channel is the route (§ F2.7, § T12) |
| B3 | GAP | The EU trader-status declaration in no checklist | on P5's checklist for both stores, non-trader for a free game (§ T12, README P5 row, money table) |
| B4 | GAP | The one-re-run rule left to discipline while the App holds `actions` | every required job fails on `run_attempt` > 1 without a logged comment (§ V5) |
| B5 | GAP | No response if M2 finds code-owner review unenforced | required approvals 1 until M4's check exists, then back to 0 (§ V9, § V1) |
| B6 | NUMBERS | The "outermost ceiling" mixed caps with expected values; new keys were never capped | a change of provider loads keys capped at the ceiling's unspent remainder; the ceiling before a budget raised by name is $5 224, the ≈ $6 700–7 700 the expected worst case (§ T10.1, README money table, question 6) |
| B7 | MINOR | The farm's fallback nights unpriced; two rules for a phone-less night | = D5/D13 (README) |
| B8 | MINOR | The last stop "before the invitations" against invitations at P3's gate | one ordering: the channel at P3's gate, the store invitations after the last stop (README, § T12) |
| B9 | MINOR | A second seat does not buy three sessions a week outright | doubles the estimate to two-to-four; three needs the upper half of P1's measurement (README) |
| B10 | MINOR | "P1 takes a week and a half" is review latency | qualified (README) |
| B11 | MINOR | The log's own claim ignored the declined numbers findings | "resolved the same way or declined with the evidence" (REVIEW.md, README) |
| B12 | MINOR | The loop had a bar and no cap | the owner may stop it; a further round costs about a session; P0 may start with open minors (README) |

### 16-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | GAP | The bible's seat list written at P0's exit, after the captures that plant it | the bible is opened when the art tool is calibrated — the seat list, the ground colour and the bars first — and `seat=all` reads the file (§ T7.5, § T4.2, § F3.1) |
| C2 | GAP | Neither engine change lit the committed composite at LOW | = A1 (§ T4.2) |
| C3 | GAP | `hitRect` had no derivation for a generated actor | the silhouette's bounding box over the torso band, never authored (§ T10.6) |
| C4 | GAP | The device lane's APKs came from no named run and L3 uploaded none | L3 uploads the app, androidTest and Macrobenchmark APKs; the lane takes the latest successful post-merge L3 run on `main` (§ V2, README D18, § T1) |
| C5 | MINOR | A `types:` line optional in one place, required in two | required (§ T2.1) |
| C6 | MINOR | `rig.json` omitted the shadow's own geometry | the contact ellipse's radii and alphas and the lobe's offsets added (§ T4.2) |
| C7 | MINOR | The pack hook's join unstated | `+`-joined, as the `cell` line (§ T5.3) |
| C8 | MINOR | `trace-hash` never defined | the cell's `set` hash over its run hashes (§ T5.4, § V3) |
| C9 | MINOR | The exact-reproduction split misdescribed `metrics.md` | the criteria `metrics.md` reports, all of them (§ T10.4) |
| C10 | MINOR | M7's `connectedCheck` assembles | an instrumentation run by `adb install` and `am instrument` (§ V9) |
| C11 | MINOR | The standing `ledger` issue's repository unnamed | this repository (§ V7, § V9, § T13.5) |

### 16-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | Testers' phones never held against the minSdk fork | Android 10 or newer, 12 if D11's fallback is taken, in all three places; the count checked before the decision (README, § T12) |
| D2 | GAP | The critic's pinned prompt under look B unstated | look-neutral; the calibration sheet re-scored under B, the offset a register entry inside question 1's session (§ F3.2, README question 1) |
| D3 | GAP | The portrait branch against the P0-recorded bars; no producer for portrait placeholders | the bars re-recorded at P5 on the landscape composites cropped to 9:16 (`portrait=1`), the bands re-derived at P0 (§ F3.1, § T10.4, § V2, README question 2) |
| D4 | NUMBERS | The contingent list omitted the whole-cast re-gate | added, 2–4 sessions (README) |
| D5 | NUMBERS | The farm's fallback nights unpriced on the recommended branch; two rules for a phone-less night | the reference phones stay with the runner; the farm takes the hash test and the benchmarks only when the runner or a phone is down, ≈ $3–7 a night, in the CI row (README, § T1) |
| D6 | NUMBERS | 8(b)'s metered CI absent from the programme total | in its recurring cell (README) |
| D7 | MINOR | The second bake-off at $250 in a ceiling that caps it at $300 | = B6 (README) |
| D8 | MINOR | "`plan/**` is an owned path" against the spike reports' exclusion | "but the spike reports" (README) |
| D9 | MINOR | "Nothing of it is maintained" against the build repair | "but its build … until the oracle retires" (README) |
| D10 | MINOR | The older-Play-account exemption absent from the third term | "about two weeks if P0 finds an older account" (README) |
| D11 | MINOR | The P4 gate unconditional under look B | "re-derived on look B's reference if question 1 chooses painted" (README, § T14) |
| D12 | MINOR | "An S inside the M" read as P7's | "inside § F2.1's M–L" (README) |
| D13 | MINOR | Whether a daily phone is committed to the runner | the reference phones stay with the runner; the felt rows use the owner's daily phone (§ T1, README) |
| D14 | MINOR | The header's claim false for a declined numbers finding | "every numbers and minor one applied or listed … with the reason it was declined" (README) |

**Declined or only partly applied:** none declined.

## Round 17 — on revision 18 (commit `cc89b2d`)

Four reviewers on a lighter model, 46 findings: 1 BLOCKING, 15 GAP, 5 NUMBERS, 25 MINOR.
The blocking row is the binder's scope: the commit lane's matrix was read from L2a's
reports alone while the `ART` clauses bind only through the art tool's gate tests and the
`RUN-FLOW` clauses through the storyboard, both L2b, so L2a would have been red from the
first bound `ART` clause (C1). The gaps: the forcing hooks reached inside the rules with
no seam (A1); the second reader was asserted equal with no tolerance (A2); the MED bar was
recorded with a frame-derived bloom on the ground the app's bright-layer bloom never lifts
(A3); the battles harness's `spdDelta` was bound by no cell (A4); the fallback sidecar's
`hitRect` had no rule (A5); the store pages depended on a prototype build that retires
(D1); the game's name was never cleared (D2); the farm billed without a ceiling (B1); no
credential had a lifetime or a rotation owner (B2); a designed run loss was a blocker under
question 10's "no" (B3); the accepted cast's in-scene reading had no consumer (B4); the
look-B offset was zero by construction (B5); the mandated re-runs collided with the
enforced re-run rule (C2, A11); `portrait=1` was undefined and a centre crop lost the seats
(C3); and the title's share had no run under a "no" (C4). The numbers: the opt-in ramp
after the build (B6); a round priced as a session against the loop's own day of rounds
(B7); the P0 pull requests miscounted (D3); P0's sittings without their reading depth
(D4). Revision 19 resolves all of them; one is declined with the evidence (A6).

### 17-A — adversarial, technical

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The forcing hooks reach inside `runSteps` and a live battle with no seam | `RunDebug`, an optional argument to `runSteps` and `RunSession`, null and inert on the golden path, bound by `DEBUG-NN` clauses — the fourth rule the oracle does not contain (§ T2.3, README item 3, § T11) |
| A2 | GAP | The second reader asserted equal with no tolerance or column list | exact on the integer-rounded L* fields and the counts, within 0.5 on the shares and IoUs and 0.1 on ΔE; a disagreement goes through the calibration's adjudication (§ T10.4, § V9) |
| A3 | GAP | The MED bar recorded with the prototype's frame-derived bloom on the ground | recorded with the bloom off, since the app's bright-layer bloom lifts no resting ground (§ F3.1, § T10.4, § T4.2) |
| A4 | GAP | `BattleCtx.spdDelta` set only on the battles path and bound by no cell | the battles harness's diagnostic knob, never a golden's; a `COMBAT-SPD-NN` clause test binds it — the one rule the goldens never set (§ T2.3, § T5.3, README item 3) |
| A5 | GAP | The fallback sidecar's `hitRect` written by a different producer with no rule | computed by § T10.6's rule from the captured frame, never from the recipe's `hit`/`hitSize` (§ T10.9) |
| A6 | NUMBERS | GitHub's Linux rate claimed at $0.008 | declined: GitHub cut Linux 2-core to $0.006 on 2026-01-01 (its changelog; verified in round 13); $0.006 stands |
| A7 | MINOR | A function reference cannot carry the observer's assignment | an observer holder object in the sketch (§ T2.3) |
| A8 | MINOR | A KGP dump is not compilable Kotlin | the generated stub is the rule, the dump its input (§ T6.3) |
| A9 | MINOR | The bars listed among the bible's inputs | = D10/C6 (§ T7.5) |
| A10 | MINOR | The feature graphic had two grounds | over a stage capture; the icon and splash over the ground colour (§ V3.3) |
| A11 | MINOR | The list check's deliberate re-run tripped the enforced re-run rule | = C2 (§ V5) |
| A12 | MINOR | V1's P0 list omitted the environment recipe; the window starts at M1 | added; the M1–M3 window (§ V1, README principle 10) |

### 17-B — adversarial, product and process

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The farm's Blaze project billed without a ceiling — a Cloud budget only alerts | a Test Lab daily quota set at P1 is the ceiling, a budget alert beside it; a risk row (README CI row, P1 row, risks; § T1) |
| B2 | GAP | No credential had a lifetime or a rotation owner | the runner's token rotated and the Apple signing material and store API keys renewed inside the quarterly session, the owner's act (README steady state, § T12) |
| B3 | GAP | A designed run loss was a tag-holding blocker under question 10's "no" | an unexpected lost run only; the designed loss a recorded known miss (README P7 row, § T14) |
| B4 | GAP | The accepted cast's in-scene reading had no consumer | a reading below 1.5:1 takes the cast-miss branch (§ F3.1, § T14) |
| B5 | GAP | Re-scoring the pixel sheet under the pinned prompt reproduces its own baseline | the critic scores the bake-off's B finalists beside the pixel sheet; the difference is the offset (§ F3.2, README question 1) |
| B6 | NUMBERS | Nothing between the build and day 1 of the fourteen days | about a week for fourteen testers to install and opt in; the third term about five weeks, the best case fourteen to seventeen (README, four places; § T12) |
| B7 | NUMBERS | "A further round costs about a session" against sixteen rounds in a day; a weekly cap cannot be hit twice in a day | a tenth of a session; the five-hour rolling limit named (README, three places) |
| B8 | MINOR | The hardware acts absent from the P0 row | the Mac confirmed and the handsets bought after the go or no-go (README P0 row) |
| B9 | MINOR | "The language the owner reviews in" against a merge model where the Kotlin merges on green | the spec, the build files and the analyser configuration (README D1) |
| B10 | MINOR | A recruitment floor conditional on a decision three phases later | each tester's Android version recorded at recruitment, 12 or newer preferred (README) |
| B11 | MINOR | The per-image base priced option (a)'s frames, which the per-image providers cannot make | ≈ $600 at option (b)'s 3 354 images; option (a) in its months (README, § T10.7) |

### 17-C — blind, the implementer

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | L2a's matrix over "everything" while the `ART` and `RUN-FLOW` clauses bind only in L2b | the binder binds once over `gate.sh commit`, reading L2a's and L2b's reports together (§ T7.2, § V2, § V6) |
| C2 | GAP | The mandated re-runs (the list check, the `env-image` hand-back) had no class under the enforced rule | a second logged class, outside § V7's count (§ V5) |
| C3 | GAP | `portrait=1` undefined; a centre 9:16 crop loses the seats at x 290–732 | the portrait bars are recorded at P5 by the Kotlin `frames` instrument on the placeholders it draws, the seats re-anchored by `Layout`; the prototype gains no portrait mode (§ F3.1, README question 2, § T4.2) |
| C4 | GAP | The title's long-press had no run to share under a "no" | the share on PAUSE and GAME OVER; the title shares the last run's, kept in memory until the next run (§ F2.7) |
| C5 | MINOR | Battles rows' `vault` and `spd` columns unstated | `-`, rejected by spec-lint otherwise (§ T5.3) |
| C6 | MINOR | The bars among the bible's inputs | = D10 (§ T7.5) |
| C7 | MINOR | A family id named as a single clause | "`META-VAULT` clauses", "a `COMBAT-FORFEIT-NN` clause" (§ T5.1, § T2.3) |
| C8 | MINOR | `rig.json` omitted the rim's lean and the glow constants | `RIM_PUSH_X/Y` and the `GLOW_*` set added (§ T4.2) |
| C9 | MINOR | `seat=` against `party=`/`pack=` with no precedence | `seat=` overrides at the anchors (§ T4.2) |
| C10 | MINOR | T14's P0 exit omitted the go or no-go and the calibration adjudication | both added (§ T14) |
| C11 | MINOR | "`parts.ts` holds only the `Ramp` type" is false | "the `Ramp` type, not the ramp values" (§ T4.2) |

### 17-D — blind, the owner's advisor

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | The store pages published only by a prototype build that retires | a `docs` job of its own in `pages.yml`, run whatever the prototype build does (§ T4.1, § V8.3, README question 3(a)) |
| D2 | GAP | The product name and ids fixed permanently with no clearance | a search of both stores and the trademark registers at P0's terms check; the resemblance row covers the name and the listing (README P0 row, risks; § T12) |
| D3 | NUMBERS | "About nine, ten with 3(c)" P0 pull requests against § T4.2's eleven | eleven, twelve with 3(c) (README) |
| D4 | NUMBERS | P0's eight sittings against nineteen artefacts | what each pair of sittings reads, and at what depth (README) |
| D5 | MINOR | Question 10's yes and D6 promised survival with no exception | § F2.1's two exceptions on both (README) |
| D6 | MINOR | Handsets bought at P0 before question 5 decides whether phones are lane hardware | the Android one by P1's M7, the iPhone only under the runner branch (README, twice) |
| D7 | MINOR | The bake-off's keys loaded before the go or no-go | after it, hard-capped (README P0 row) |
| D8 | MINOR | Question 1 not void under a "no" to question 6; the "no" arithmetic kept the bake-off's M | "void if question 6 is no"; 16–32 (README) |
| D9 | MINOR | Orientation had no register row | D21 (README) |
| D10 | MINOR | The bars listed among the bible's inputs | the seat list and the ground colour read, the bars recorded from the captures (§ T7.5) |
| D11 | MINOR | The non-recommended branches' prices outside the contingent list | one clause (README) |
| D12 | MINOR | A daily phone assumed but unnamed | named in the handsets row and § T1 (README, § T1) |

**Declined or only partly applied:** A6 declined with the evidence above.


## Round 18 — on revision 19 (commit `c060654`)

Four reviewers on a lighter model, 51 findings: 6 BLOCKING, 15 GAP, 5 NUMBERS, 25 MINOR.
Four of the six blocking rows are one finding and revision 19's own residue: the `docs`
job added for round 17's D1 could not publish beside the prototype build — a Pages
deployment takes exactly one artifact, `deploy` needed `build`, and the copy was still
written as a step of the build job (A1, B1, C1, D1). The fifth is the MED bar's bloom-off
with no engine switch to provide it inside the freeze's closed list (C2; A6 as a minor),
the sixth a red-`main` attribution that sent every no-module failure to `build` and so
blocked the one pull request that could fix a red `env-check`, whose paths are `env`
(A2). The gaps: the N − 1 snapshot undecodable when the bumping commit changed its shape
(A3); what a pull request reads while the post-merge run is in flight (A4); no iPhone
under the farm branch though the felt rows, the P7 test and the tester-shortfall floor
need one (B2, D2); the portrait bars recorded by the instrument P5's gate then reads (B3);
the look-B offset confounded with the finalists' own quality (B4); the two GitHub Apps'
private keys nobody rotates (B5); the shadow constants that were literals, not exports
(C3); the seat list with no format for its three readers (C4); the ground colour undefined
(C5); `RunDebug` built by no phase (C6); the NEAR painter unstated on the flat frame (C7);
the iPhone testers with no iOS floor (D3); the release territories nowhere (D4); the
account-age check after the recruitment ask (D5). Two numbers moved on verified facts: the
farm's cost ignored Test Lab's 30 free device-minutes a day (B6), and question 8(b)'s
macOS figure was never re-derived at the 2026 rate of $0.062 a minute (B7). Nothing was
declined.

### 18-A (adversarial, technical) — 2 BLOCKING, 2 GAP, 0 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The store pages' `docs` job could not publish beside the prototype build: one Pages artifact per deployment, `deploy` needing `build`, a second upload colliding, the copy still a build-job step | the `docs` job is the one job that assembles and uploads — `needs: build`, `if: always()`, the prototype's `dist` downloaded when its job produced one, one `upload-pages-artifact`; `deploy` needs `docs`; a red prototype build costs the demo its next deploy, never the store pages, and a retired one is the `build` job removed (§ T4.1, § T12, § V8.3, README question 3(a)) |
| A2 | BLOCKING | A no-module failure attributed to `build` deadlocked `env-check` on its own fix, whose paths are `env` | attributed to the boolean of the paths its fix touches: `env-check` to `env`, a lint to its file's boolean, spec-lint to `spec`, the workflows job, `buildHealth` and the size test to `build` (§ V5) |
| A3 | GAP | The N − 1 snapshot undecodable when the bumping commit changed its shape, or a re-recording bumped the trace grammar | the snapshot's own schema version in the header beside `RULES_VERSION` and the trace version; a forward rule — an added field carries its `SAVE` clause's default, a dropped or unknown one is ignored; the previous reader of each kept, the N − 1 corpus the proof; two or more behind in any is "two or more versions old" (§ T11) |
| A4 | GAP | What a pull request reads while the post-merge run is in flight | the last completed post-merge run's status through the API; an in-flight run keeps the previous verdict (§ V5) |
| A5 | MINOR | The dangling clause in the Pages bullet | gone with A1 |
| A6 | MINOR | No mechanism turned the prototype's bloom off for the MED bar | a `bloom: false` option on `createLight` in the hook's pull request, the third allowed engine change (§ T4.2; C2) |
| A7 | MINOR | The stub's ABI dump unqualified; the JVM dump erases nullability and type arguments | the klib dump named as the input (§ T6.3) |
| A8 | MINOR | The `GOLDEN` clauses' status at P2 unstated | `proposed` at P2, promoted in the P3 pull request that first replays them (§ T7.3) |
| A9 | MINOR | "Every public `:core` function has a clause-named test" is not expressible in Konsist | a binder check that every `:core` source file is in some clause's `paths`; the per-file coverage floor carries the rest (§ T8) |
| A10 | MINOR | § T9.2 read as the grade applied before the actors | the light map before the actors, the grade's multiply after them (§ T9.2) |

### 18-B (adversarial: product, process, risk) — 1 BLOCKING, 4 GAP, 3 NUMBERS, 7 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | The `docs` job, as A1 | as A1 |
| B2 | GAP | No iPhone under the farm branch, yet the felt rows, the P7 test and the tester-shortfall floor need one | bought under either branch, by P5's felt rows, as the owner's iOS acceptance device — ≈ $300–500 of the handsets' range; lane hardware only under the runner branch (README handsets row, item 6, P0 row, question 5; § T1) |
| B3 | GAP | The portrait bars re-recorded at P5 by the instrument P5's gate then reads, so that gate cannot fail | on the portrait branch P5's ruler is reported and owner-approved as the bars, with the landscape bars beside them; P6's gate is the first that holds them (§ F3.1, README question 2, § T14) |
| B4 | GAP | The look-B offset measured on the B finalists confounds the medium with their quality | the calibration sheet re-rendered in look B by the winning provider from the pixel frames — the same content in both media — scored beside the pixel sheet (§ F3.2, README question 1) |
| B5 | GAP | The two GitHub Apps' private keys never expire and nobody rotates them | rotated in the quarterly session — a new key generated, the old revoked in the App's settings; uninstalling the App the revocation path (README steady state, § T12) |
| B6 | NUMBERS | The farm's cost ignored the 30 free device-minutes a day (verified: Firebase Test Lab quotas and pricing) | 40–80 device-minutes a night, 10–50 billed, ≈ $25–125 a month, ≈ $300–1 500 a year; a fallback night ≈ $1–4 (README CI row, steady state, programme total, question 5, absence protocol) |
| B7 | NUMBERS | Question 8(b)'s macOS figure never re-derived at the 2026 rate (verified: $0.062 a minute since 2026-01-01, GitHub's pricing change) | a twenty-minute job $1.24; twenty to forty pull requests a month with fifteen jobs inside Pro's included minutes ≈ $6–31, the nightly's macOS minutes ≈ $56–112, about $60–140 a month; the metered-CI recurring ≈ $100–200 (README question 8(b), money table) |
| B8 | NUMBERS | *n* inferred from a day that measured the five-hour limit, and a second seat priced as the best case's gate | *n* unknown until P1 measures it, the one-to-two a week an assumption; the second seat or tier contingent on that measurement, taken only if it puts *n* below three (README money table, calendar paragraph) |
| B9 | MINOR | No all-in total | the row relabelled one-off, hardware and subscription excluded; all in ≈ $2 200–4 800, ≈ $2 600–5 700 with the handsets, ≈ $2 500–6 600 and ≈ $2 900–7 500 on the fast branch (README) |
| B10 | MINOR | "12 if D11's fallback is taken" read as a tester count | "Android 12 or newer" (README P0 row, § T12) |
| B11 | MINOR | The prepaid-or-capped rule silently eliminated Gemini | its metering named in § T10.2's table: Cloud billing alerts, the per-day request quota lowered in the console is the cap, confirmed at P0's terms check or FLUX.2 is the painted arm alone (§ T10.1, § T10.2) |
| B12 | MINOR | The contingent items' calendar unstated | up to six to twelve sessions, two to twelve weeks at the three paces, none in the best case (README) |
| B13 | MINOR | The P7 re-cut omitted the store screenshots | named (README P7 row, § F2.5) |
| B14 | MINOR | The keep-alive rested on Renovate having a bump every month | a monthly `keepalive` push under the agents' App the deterministic one, Renovate the usual (§ V5, README steady state) |
| B15 | MINOR | The clearance's territories, hours and scope unstated | the EU, the US and the owner's own country, about two hours in the admin band, a professional clearance out of scope (README P0 row, § T12; with D4) |

### 18-C (blind implementer) — 2 BLOCKING, 5 GAP, 1 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The `docs` job, as A1 | as A1 |
| C2 | BLOCKING | The MED bar's bloom-off needs a switch the freeze's two allowed engine changes do not provide | a `bloom: false` option on `createLight` that `renderPost` honours, in the hook's pull request — three allowed changes (§ T4.2) |
| C3 | GAP | The shadow constants are literals inside `drawContactShadow`, so "adds `export`" had nothing to export | lifted into named module constants and exported in the same pull request (§ T4.2) |
| C4 | GAP | The per-biome seat list had no format for its three readers | exported as the ramps are to `spec/fixtures/art/bible/seats.json` under a `schema: Seats` block, the one file `capture.mjs`, the art tool and the Kotlin `frames` read (§ T7.5, § T4.2, § V3) |
| C5 | GAP | The bible's ground colour undefined | one sRGB hex — the per-channel median of the six biomes' two ground strips on the MED `flat=1` resting frames, measured by `art rulers` at calibration — in `seats.json` (§ T7.5) |
| C6 | GAP | No phase built `RunDebug` | a post-gate `:core` change at P5 through § T7.7's route, as `resumeRun` is, its clauses first and `diff-oracle` proving the golden path unmoved (§ T2.3, § T14) |
| C7 | GAP | Whether the `flat=1` frame draws the NEAR painter unstated | the supplied plane alone, no NEAR painter, at LOW and MED (§ T4.2) |
| C8 | NUMBERS | "0 in 910 runs" against a table summing to 1 010 | 1 010 (§ T5.3) |
| C9 | MINOR | The orphan clause | gone with A1 |
| C10 | MINOR | A runs cell's `pack`, `act` and `clears` columns unstated | `-` with `party`; spec-lint rejects a value (§ T5.3) |
| C11 | MINOR | Which run the probe keeps | run 0 of its cell (§ T5.3) |
| C12 | MINOR | § F3.1 still had the bars recorded beside the seat list | beside the ground colour, the bars recorded from the captures (§ F3.1) |
| C13 | MINOR | Who downloads M7's APK before the runner token exists | the owner, by hand (§ V9 M7) |
| C14 | MINOR | M7's compile jobs outside the required-check budget | named, one owner ruleset act inside P1's sittings (§ T13.5) |

### 18-D (blind owner's advisor) — 1 BLOCKING, 4 GAP, 1 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | The `docs` job, as A1 | as A1 |
| D2 | GAP | No iPhone under the farm branch, as B2 | as B2 |
| D3 | GAP | The iPhone testers had no iOS-version floor at recruitment | iOS 16 or newer, recorded at recruitment (README money table, P0 row; § T12) |
| D4 | GAP | No release territories anywhere; the clearance outside the admin hours and the P5 store set-up | a P0 decision — worldwide, the EU included, unless narrowed; the availability in § T12's store set-up; the clearance and the territories in the admin enumeration (README P0 row, admin paragraph; § T12) |
| D5 | GAP | The account-age check after the recruitment ask, with no effort or calendar delta | first in the P0 row; the branch drops five to ten owner hours, P5's tester-triage S and three of the stores' five weeks (README P0 row, calendar paragraph; § T12) |
| D6 | NUMBERS | A subscription month counted under a key cap | ≈ $200 of per-image spend under keys capped at $300 plus ≈ $50 of subscription outside them; the worst case ≈ $4 975 and the ceiling's subscription months named (README item 6, programme total) |
| D7 | MINOR | D17's owned-path summary omitted the build files | the build logic, the analyser configuration, the catalog and wrapper, the root build files (README D17) |
| D8 | MINOR | The share built with the first test-track build, after the felt rows | with the first signed build the owner installs (§ F2.7, § T14) |
| D9 | MINOR | No all-in total, as B9 | as B9 |
| D10 | MINOR | D21 before D20 | swapped (README) |
| D11 | MINOR | "The programme's last stop" is not the last | "last scheduled stop" (README P5 row and roadmap, § T14) |
| D12 | MINOR | The trigger abbreviated (in the calendar paragraph, not item 6) | it points at the absence protocol's one statement (README) |

**Declined or only partly applied:** none.


## Round 19 — on revision 20 (commit `febb095`)

Four reviewers on a lighter model, 47 findings: 2 BLOCKING, 17 GAP, 7 NUMBERS, 21 MINOR.
Both blocking rows are revision 20's own residue. The `docs` job's `if: always()` meant a
red prototype build would publish a Pages artifact holding the store pages alone and so
remove the demo from the live URL, the opposite of what § T4.1 claimed (A1, B3); and the
seat list's fixture was placed under `spec/fixtures/art/bible/`, a stem whose root type is
the ramps' `Ramps` block, which the binder's first-block rule cannot type twice (A2, C1).
The gaps: Firebase Test Lab needed a credential no identity held while § V5 said the lane
workflows hold no secrets (B2); the exempt Play account dropped the iPhone testers, whom
Play's rule never governed (B1, D2); the felt rows' Android was unconstrained (B4); the root
`LICENSE` was not an owned path (B5); the steady state had no review point (B6);
`env-image.yml`'s red `main` was read by nothing (A3); `:sim`'s golden replay was
attributed to its host module, not the module it asserts (A4); the seat-spread id was
named nowhere and its frames produced by no lane (A5, C4); the snapshot had no place in
the save's grammar (C2); `ground` was ordered before the captures it is measured on (C3);
question 6's "no" was priced in sessions only (D1); the Android handset had no role under
the farm (D3, B14); and what precedes the last scheduled stop was unstated (D4). The
numbers: the second reader unpriced in P1 (A6); the horizon cut against 38 weeks without
the contingent items (B7); the fast branch priced at nine months (B8); prepaying stranding
a balance the usage ceiling does not count (B9); "none in the best case" false for
question 3(c)'s recommended session (B10); the worst case's enumeration summing to $4 424
(C5); and the second seat sold as the fourteen-week gate (D5). Nothing was declined.

### 19-A (adversarial, technical) — 1 BLOCKING, 4 GAP, 1 NUMBERS, 5 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | The `docs` job's `if: always()` published the pages without the demo whenever the prototype build was red | no `if: always()`: `docs` runs only when `build` succeeded, for as long as the job exists; a red build holds the site at its last deploy, demo and pages alike; a retired build is the job removed (§ T4.1) |
| A2 | GAP | `seats.json` placed in the `bible` stem, whose root type is `Ramps` | its own spec file `spec/art/seats.md` with `schema: Seats`, the fixture `spec/fixtures/art/seats/seats.json`, in § T7.4's list and § T2.1's layout (§ T7.5, § T4.2, § V3, § F3.1) |
| A3 | GAP | `env-image.yml`'s red `main` read by nothing | it publishes the merge lane's commit status with the `env` boolean set (§ V4) |
| A4 | GAP | `:sim`'s golden replay and snapshot and the JVM perf test attributed to their host module | attributed to the module whose behaviour they assert — `core`, `engine` (§ V5) |
| A5 | GAP | The seat-spread id named nowhere; its frames produced by no lane | `spread` in `seats.json`; `frames --seat <spread id>` per biome in L2b's frame step and the P5 gate row (§ T7.5, § V3, § T14, § F3.1, § T4.2) |
| A6 | NUMBERS | The second reader unpriced in P1 | the sheet's metrics alone, an S inside P1's L (§ T10.4, § V9 M5) |
| A7 | MINOR | `run.ts` named for `runTurn`'s policy call | `battle.ts` (§ F1.4) |
| A8 | MINOR | The snapshot's field list omitted the node trail; the offers and terminal fields unaddressed | `path` added; the offers and terminal fields re-derived on re-entry (§ T11) |
| A9 | MINOR | The klib dump produced only on macOS | the merged dump the ABI tool builds on `agent-env` with the Apple targets inferred (§ T6.3) |
| A10 | MINOR | `ground` read before it can exist | the seat list committed first, `ground` appended after the calibration captures (§ T7.5, § F3.1) |
| A11 | MINOR | `options=<skill>:<target>` fields ambiguous | the `ActOption` skill index; the slot or `-1` (§ T5.3) |

### 19-B (adversarial: product, process, risk) — 0 BLOCKING, 6 GAP, 4 NUMBERS, 4 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The exempt Play account dropped the iPhone testers too | Play's obligation alone falls away; the iPhone testers and the channel stay, an Android pool the owner's choice (README P0 row, calendar paragraph; § T12) |
| B2 | GAP | Test Lab needed a credential no identity held; § V5 said the lanes hold no secrets | a sixth identity: the farm's service account through workload identity federation from the nightly's OIDC token, no stored key, created with the Firebase project at P1 (§ T1, README D17 and P1 row, § V5) |
| B3 | GAP | The `docs` job, as A1 | as A1 |
| B4 | GAP | The felt rows' Android unconstrained; the daily phone may be an iPhone or a flagship | one Android at or below the reference class in the felt rows and the P7 test — the daily phone if it is one, else the reference Android lent from the runner (README handsets row, P5 rows; § T1, § T14) |
| B5 | GAP | The root `LICENSE` not an owned path | `LICENSE` and the root `README.md` owned (§ V5, README D17) |
| B6 | GAP | The steady state without a review point | an annual decision to continue, hand over or delist, against the install counts, the channel and the reviews, with the delist path (README steady state, § T14) |
| B7 | NUMBERS | The horizon cut against 38 weeks without the contingent items | about 50 weeks, up to twelve subscription months (README calendar paragraph, P0 row, money table; § T12) |
| B8 | NUMBERS | The fast branch priced at nine months | three to four months at $200–400: ≈ $2 500–4 600, ≈ $2 900–5 500 with the handsets (README money table) |
| B9 | NUMBERS | Prepaying strands a balance the usage ceiling does not count | the ceilings are usage ceilings, capping the default for that reason too (README P0 row, programme total; § T10.1) |
| B10 | NUMBERS | "None in the best case" false for question 3(c)'s recommended session | stated, the aggregate then 20–39 (README) |
| B11 | MINOR | Three "first" acts in the P0 row | the order stated once (README P0 row; with D6) |
| B12 | MINOR | § V6's Maestro rows under the farm branch | the owner's manual walk before each `v*` tag (§ V6) |
| B13 | MINOR | "Three exceptions" mixed rework and money | one rework exception, two money ones (README absence protocol) |
| B14 | MINOR | The Android handset's role under the farm, as D3 | as D3 |

### 19-C (blind implementer) — 1 BLOCKING, 3 GAP, 1 NUMBERS, 9 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | The seats fixture's stem, as A2 | as A2 |
| C2 | GAP | Where the snapshot lives in the save's grammar | its own store slot beside the log, never in the text encoding; the marker a save-only `resumed <S>` line (§ T11) |
| C3 | GAP | `ground` ordered before the captures; `art rulers` reports no colour | the two-step write; `art rulers --ground` (§ T7.5, § T10.4, § F3.1; with A10) |
| C4 | GAP | The seat-spread frames, as A5 | as A5, plus the P5 gate row (§ T14) |
| C5 | NUMBERS | The worst case's enumeration summed to $4 424 | the cast's $4 000 ceiling and P6's $500 plane key named; $4 424 without the key (README money table) |
| C6 | MINOR | The HUD face listed among P0's captures | lands at P1 with its licence file (§ T10.9) |
| C7 | MINOR | The spend row carried no key | a `key` field, the counter sums by it (§ T10.1) |
| C8 | MINOR | The two throwaway pull requests out of order against § V9 | the first at M2, the second at M4 after the gate App and the checks (README P1 row) |
| C9 | MINOR | "The rules areas" undefined | the clauses whose `owner` is `:core` (§ T14, README roadmap) |
| C10 | MINOR | The klib dump on Linux, as A9 | as A9 |
| C11 | MINOR | The save-corpus row unconditional | under question 10's yes (§ V6) |
| C12 | MINOR | The literal block's source | `ci/lanes.yaml`'s `required-hand-written:` list, concatenated by the generator (§ T13.5) |
| C13 | MINOR | One `SpecFixtures` root emitted per owning module | `<Module>Fixtures`, one per module (§ T2.1, § T7.2) |
| C14 | MINOR | "The ranks stand 68 px apart" | the seats of a rank (§ T10.4) |

### 19-D (blind owner's advisor) — 0 BLOCKING, 4 GAP, 1 NUMBERS, 3 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | GAP | Question 6's "no" priced in sessions only | fourteen to twenty sittings go with them, the pre-build floor about six to eight weeks (README question 6) |
| D2 | GAP | The exempt Play account and the iPhone testers, as B1 | as B1 |
| D3 | GAP | The Android handset had no role under the farm | the owner's Android acceptance and hand-walk device under the farm, lane hardware under the runner (README handsets row, Always row; § T1) |
| D4 | GAP | What precedes the last scheduled stop | the signing pipeline and the first `v*` tag before it; the listings, the forms and the invitations after (README P5 rows; § T14, § T12) |
| D5 | NUMBERS | The second seat sold as the fourteen-week gate | the fourteen-week floor is the review queue's at two a week; three or more buys about two weeks off the upper end (README calendar paragraph) |
| D6 | MINOR | Two acts each first in the P0 row | the order stated (README P0 row) |
| D7 | MINOR | "The one product decision before P3" against the P1 and P2 stops | taken on the game itself; the stops re-ask it (README P0 row, § F1.5's neighbour in `FUNCTIONAL.md`) |
| D8 | MINOR | The demo "free" after the oracle retires | its build unmaintained then; a rot repair a steady-state out-of-cycle item (README question 3(a)) |

**Declined or only partly applied:** none.


## Round 20 — on revision 21 (commit `3a7ae2a`)

Four reviewers on a lighter model, 46 findings: 1 BLOCKING, 17 GAP, 6 NUMBERS, 22 MINOR.
The blocking row is revision 21's own residue: round 19's D4 moved the first `v*` tag
before the store set-up while § T12 still defined every tag as an upload to Play's
closed-testing track and to external TestFlight, both of which the listing has to precede
(D1). The gaps: the Macrobenchmark APK the lanes run came from a module no phase built
(C1); `keepalive.yml` pushed as the agents' App, whose key has no home in Actions (A2);
the verifier's stub generator existed in no module, deliverable or milestone (A1); L1's
matrix scope would have failed on every art-tool commit (A3); an accepted ruler miss left
the lane red on every push (C2); `seats.json` had no reader named outside the binder (C3);
cell ids were unchecked (C4); the bake-off's $300 had no per-key split though the refusal
is per key (B1); Gemini's per-day quota bounds a rate, not the cumulative spend (B2);
nothing said which P0 deliverables wait for the go or no-go (B3); "hand over" was undefined
(B4); the owner's weekly hours were never stated (B5); D11's decision was not ordered
before the closed test it could reset (B6); question 7(b)'s "no" left the `gates`
environment's `main`-only rule unchanged (B7); no risk row covered a suspended account or
lost signing material (B8); the scene phase after the release reached players through no
priced release (D2); and question 2's portrait branch was unpriced in the owner's currency
(D3). The numbers: `<target>` defined the inverse of the oracle (A4); the elite band a row
above the review's floor (A5); question 8(b) at its macOS subtotal (B9, D4); the GitHub
rates without a confirmation marker (B10); and the bake-off's image counts taken from
option (a) alone (C5). Nothing was declined.

### 20-A (adversarial, technical) — 0 BLOCKING, 3 GAP, 2 NUMBERS, 4 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | GAP | The verifier's stub generator existed in no module, deliverable or milestone | `:tools:stub`, a `:tools` CLI in § T2.1, built at M5 beside the binder, an S inside P1's L (§ T6.3, § T2.1, § V9) |
| A2 | GAP | `keepalive.yml` pushing as the agents' App needed a key with no home in Actions | it pushes with the built-in `GITHUB_TOKEN` — a commit is repository activity whoever authors it, and no App key enters Actions (§ T2.1, § V5, README steady state) |
| A3 | GAP | L1's matrix scope would fail on every art-tool commit, `ART` clauses binding only in L2b | L1's scope excludes the `ART` and `RUN-FLOW` clauses, whose tests are L2b's (§ T7.2) |
| A4 | NUMBERS | `<target>` defined as the inverse of `actOptions` | the living slot index for an `ENEMY` or `ALLY` spec, `-1` for every other (§ T5.3) |
| A5 | NUMBERS | "An elite 50–56" against the review's recorded 49 floor | 49–56 (§ F3.1) |
| A6 | MINOR | § V4 read as a workflow-level path filter | as C9 |
| A7 | MINOR | The synthetic module's clauses had no area | `SYNTHETIC`, deleted with the module in P3's first `:core` commit (§ T7.1) |
| A8 | MINOR | Seeds 3 and 4242 "at 2 000" presented as the contract's | the contract's two rows plus its two verification seeds at 2 000, a count the plan fixes (§ T5.5) |
| A9 | MINOR | The version code from a depth-1 checkout | on a `fetch-depth: 0` checkout (§ T12) |

### 20-B (adversarial: product, process, risk) — 0 BLOCKING, 8 GAP, 2 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| B1 | GAP | The bake-off's $300 had no per-key split, the refusal being per key | RD Pro $150, each painted arm $60, the portrait stills $30, re-split at P0's terms check if a provider drops out (§ T10.1) |
| B2 | GAP | Gemini's per-day quota bounds a rate, not the cumulative spend | the terms check records quota × the cast's calendar days below the key's cap, or admits Gemini on a prepaid balance only, or Gemini leaves the bake-off (§ T10.2) |
| B3 | GAP | Nothing said which P0 deliverables wait for the go or no-go | before the go only the App, the move commit and the environment spike; the other spikes, the art tool, the captures, the accounts, the testers and the bake-off wait (README P0 row, § T14) |
| B4 | GAP | "Hand over" undefined | the app transferred on each store, the Apps and the `release` environment re-created by the new owner, the `match` repository and the Firebase project handed across — a session and a sitting (README steady state) |
| B5 | GAP | The owner's weekly hours never stated | about seven to thirteen a week at the fourteen-week floor, two to five at one session a week (README) |
| B6 | GAP | D11's decision not ordered before the closed test its fallback could reset | before the first test-track build (README P5 row, § T14) |
| B7 | GAP | Question 7(b)'s "no" left the `gates` environment's `main`-only rule unchanged | the rule admits the `kmp` branch instead (README question 7(b)) |
| B8 | GAP | No risk row for a suspended account or lost signing material | a row in both tables: Play App Signing, the `match` repository backed up off GitHub, the keys re-issued, an appeal, then the other store's listing alone (README risks, § T15, § T12) |
| B9 | NUMBERS | Question 8(b) at its macOS subtotal | about $100–200 a month all in (README question 8(b); with D4) |
| B10 | NUMBERS | The two GitHub rates carried no confirmation marker | read again at P0's terms check (README question 8(b)) |
| B11 | MINOR | A ruleset edit counted as an authoring exception | the rule is about repository files; one exception, the bootstrap's (§ V5) |
| B12 | MINOR | The device-only crash row omitted the stores' crash signals | Play vitals and TestFlight's crash logs, with the caveat (§ V6) |
| B13 | MINOR | The exceptions' sentence still listed the rework case among the money ones | two of money, one of rework (README absence protocol) |
| B14 | MINOR | D2's § F3.6 cross-reference for a money consequence | question 8(b) (README D2) |
| B15 | MINOR | The channel's within-the-week triage promised past P7 | until P7, then monthly, the quarterly session answering (§ T12) |
| B16 | MINOR | M7's proof attributed to the runner branch alone | spent under either branch (README question 5) |

### 20-C (blind implementer) — 0 BLOCKING, 4 GAP, 1 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| C1 | GAP | No Macrobenchmark module existed for the APK the lanes run | `:app:benchmark`, a `com.android.test` module inside the `app` glob, a P5 deliverable (§ T2.1, § T14) |
| C2 | GAP | An accepted ruler miss left L2b red on every push | the bar re-recorded at the reached count in the same owner-reviewed pull request, as a golden is (§ F3.1, § T14, README roadmap) |
| C3 | GAP | `seats.json` read by `:tools:instruments` with no reader named outside the binder | read from the repository path as a JVM-only reader, as the save corpus is (§ T2.1) |
| C4 | GAP | Cell ids unchecked for uniqueness or grammar | spec-lint: unique across `cells.md`, matching `^[a-z0-9][a-z0-9-]*$` (§ T7.8) |
| C5 | NUMBERS | 216 images per combination is option (a)'s; (b) is 192 | 216 for (a), 192 for (b); ≈ 620 per-image generations; ≈ 410–820 on the subscription provider (§ T10.7) |
| C6 | MINOR | Two mechanisms for `minAscensionFor`'s table; an unexplained fixture directory | the `spec/fixtures/meta/vault/` entry dropped, the `META-VAULT` table stands (§ T7.4, § T2.1) |
| C7 | MINOR | Eight spikes, nine reports, as D7 | as D7 |
| C8 | MINOR | `--trace`'s destination unstated | stdout, redirected by `cells.mjs`; the two flag grammars named (§ T5.4) |
| C9 | MINOR | `env-image.yml` "when the recipe changed" | on every pull request, its `changes` job gating the build (§ V4; with A6) |
| C10 | MINOR | "The three baseline sheets" | the calibration sheet and its three scorings (README P0 row) |
| C11 | MINOR | `pixel=<dir>` mandatory for frames that plant the fallback cast | optional; the fallback recipes stand in when it is absent (§ T4.2) |

### 20-D (blind owner's advisor) — 1 BLOCKING, 2 GAP, 1 NUMBERS, 6 MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | The first `v*` tag, before the store set-up, was a closed-track and external-TestFlight upload the listing must precede | the first tag uploads to Play's internal track and TestFlight's internal group alone; promotion to the closed track and the external group begins with the first build after the store set-up (§ T12, README P5 rows, § T14) |
| D2 | GAP | The scene phase after the release, and later character changes, reach players through no priced release | a further store release — a `v*` tag, the `release` approval, App Review's days, a Play update — an S of agent work and one owner sitting (README P6 row, question 4(a); § F4.4) |
| D3 | GAP | Question 2's portrait branch unpriced in the owner's currency | about two to four extra sittings, the pre-build floor about ten to thirteen weeks, the portrait bars' approval (README question 2, D21, effort paragraph) |
| D4 | NUMBERS | Question 8(b) at its macOS subtotal, as B9 | as B9 |
| D5 | MINOR | § F3.5's fourth trigger missing from the P4 row | second, third and fourth (README P4 row) |
| D6 | MINOR | The one-off total's top counted the planes the recommended branch never buys | ≈ $1 900–2 900 on the recommended branches, ≈ $3 000 with the planes; the all-in lines re-derived (README money table) |
| D7 | MINOR | Eight spikes, nine reports | nine reports, 5b's beside 5's (README P0 rows) |
| D8 | MINOR | Three statements of the closed test's trigger claiming to be one | the Play row and § T12 point at the absence protocol (README, § T12) |
| D9 | MINOR | The owner's table ended at P7 | an "After P7" row (README) |
| D10 | MINOR | The felt rows "close P5" though its store set-up follows them | they close P5's gate; the store set-up and the closed test are its tail (§ F1.5, README) |

**Declined or only partly applied:** none.

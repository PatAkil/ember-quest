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

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

Four reviewers on a lighter model, 54 findings: 6 BLOCKING, 16 GAP, 11 NUMBERS, 21 MINOR.
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

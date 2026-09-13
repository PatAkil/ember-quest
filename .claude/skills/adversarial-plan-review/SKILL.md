---
name: adversarial-plan-review
description: Run a multi-reviewer review loop over a plan, design doc, spec, proposal or build brief — independent adversarial and blind reviewer agents, a severity taxonomy, a logged revision per round, a consistency pass, and a data-driven stop rule. Use this whenever the user asks to "review the plan", "spawn reviewers", "red-team the design", "get blind reviews", "improve until there are no more findings", "keep reviewing until it's solid", or wants a document iterated against several independent readers before approval or build. Also use it to decide when such a loop should stop, and to set one up for a future initiative.
---

# Adversarial plan review

A review loop is a machine for finding what a document's author cannot see. It is also a
machine for growing the document, and past a point it finds mostly what its own previous
fixes broke. This skill sets the loop up so that both halves are visible from the first
round, and so that the stop is decided by data instead of by exhaustion.

The protocol below was distilled from a 32-round loop over a ~4 000-line plan (four
reviewers a round, 1 746 findings, all resolved). Read `references/case-study.md` for the
numbers; the short version is in "What the data showed" at the end of this file.

## The shape of one round

```
revision N  ──► 4 reviewers in parallel (read-only)  ──► reports A–D
                                                              │
   revision N+1 ◄── one edit script per reviewer ◄── triage ◄─┘
        │
        ├──► 2 consistency checkers (read-only) ──► residue fixes ──► revision N+1 final
        │
        └──► loop_metrics.py ──► CONTINUE / STOP verdict ──► next round or close
```

Every round has the same six steps. Do them in this order and do not skip the
consistency pass or the metrics; those two are what kept the loop honest.

### 1. Agree the bar before round 1

Ask the requester which bar the loop stops at, and write it into the document's status
paragraph and the log header before the first round:

- **The loop's own bar**: a round returns zero BLOCKING and zero GAP findings.
- **The practical bar** (recommend this one): zero BLOCKING, and no GAP that changes a
  phase's size, price or gate. Minor findings are residual.
- **The stop rule** (always, whichever bar): the loop also stops when
  `loop_metrics.py` reports a plateau (see step 6), even if the bar is not met, and the
  requester is told why.

"Until there are no more findings" is not a reachable bar for adversarial review of a long
document: four hostile readers of ~4 000 lines will always return something. Say so at the
start, propose the practical bar, and let the requester choose. Recording the choice in the
document is what lets you stop later without relitigating it.

### 2. Freeze scope before round 1

A scope change mid-loop resets the count (the case study's round 4 rewrite went from 73
findings back to 71 and cost two rounds to recover). Get the decisions that shape the
document (stack, scope, what is in and out) before the first round; if one changes later,
note the reset in the log so the series stays readable.

### 3. Four reviewers, two adversarial and two blind

Spawn all four in parallel, in the background, on a lighter model than the orchestrator
(the case study used Opus reviewers under a Fable orchestrator; finding quality did not
drop when the reviewers were lightened). Each gets its own brief file and writes its own
report file. None sees another's report or the drafting.

| Id | Role | What it hunts |
|---|---|---|
| A | adversarial, technical | mechanisms that cannot work as specified, claims the code or the platform contradicts, unmeasurable metrics, hidden phase dependencies |
| B | adversarial, product / process / money / risk | unpriced branches, unowned acts, missing signals before a commitment, store and vendor facts, calendar arithmetic |
| C | blind implementer | "what would I have to guess to start on Monday": undefined files, formats, orders, gates that cannot be evaluated |
| D | blind owner's advisor | holds the document against the requester's brief ask by ask; the approval surface's honesty |

The brief structure that worked is in `references/briefs.md`; generate the files with
`scripts/make_briefs.py`. Three rules in the briefs matter more than the rest:

- **Verify, don't assume**: reviewers check the document's claims against the code and
  against what they know for certain about tools and vendors, and say when they are unsure.
  This is what caught the false platform claims (an App Store feature that exists only for
  updates, a GitHub tier rule, a token lifetime).
- **Condensed report format**, one line per finding: `id | SEV | location | finding with
  evidence | Fix: the smallest edit`. Anything longer costs the orchestrator a round.
- **"Previous resolutions checked: holding / defective"** at the end of every report. This
  is the residue signal: it tells you how much of the last revision's work did not land.

Severities, applied strictly: **BLOCKING** (could not be executed as written, or a
load-bearing claim is false), **GAP** (a real case the document never addresses),
**NUMBERS** (a value is wrong and the reviewer shows why), **MINOR** (clarity, style,
consistency). Blocking and gap are the loop's currency; the others are context.

### 4. Triage and revise, one script per reviewer

Do not edit by hand. For each report write one edit script of anchored replacements using
`scripts/anchored_edit.py`: every replacement names the exact text it expects, once, and the
run aborts with `MISMATCH` before anything is committed if an anchor is absent or doubled.
Run the scripts in dependency order (a fix that rewrites a sentence another reviewer also
anchored on must go first), grep for stale phrases the fixes should have removed, then
commit one revision with every finding logged.

Triage rules, learned the hard way:

- **Fix every BLOCKING and GAP.** Decline only with evidence, and log the decline so the
  requester can overrule.
- **NUMBERS**: fix, but first find the *rule* behind the number and state the rule once in
  the document. Two reviewers in successive rounds reversed the same calendar figure
  (19 vs 20 weeks) because the composition rule lived in nobody's head but the author's.
- **MINOR**: apply while the loop is young (rounds 1–3); after the substantive count
  plateaus, *log minors without editing* and batch them into one editorial pass at the end.
  Every edit is a new surface for the next round; a third of each late round in the case
  study was residue of the previous revision's own edits.
- **Duplicates** ("C2 = A6"): resolve once, mark the other row "with A6" in the log.
- **Keep fixes minimal and local.** Do not widen a sentence into a paragraph of
  qualifications; if a fix needs a new mechanism, add one sentence where the mechanism is
  defined and one cross-reference where it is used, nothing more.

### 5. Consistency pass before the next round

After every revision, run two read-only checkers over the diff: one for **numbers** (every
total re-derived from its parts, every count matched to its list) and one for
**mechanisms** (every rule stated in two places compared). Briefs in
`references/briefs.md`. Apply their findings as a second commit on the same revision.

In the case study the checkers caught 8–16 self-inflicted inconsistencies per revision
that the reviewers would otherwise have reported as findings. Start them at round 1; the
case study added them at revision 13 and the rounds before that carried 40–60
"defective resolution" flags each.

### 6. Measure, then decide

Run `scripts/loop_metrics.py <log>` after logging each round. It prints the series
(total, blocking, gap, substantive = blocking + gap, duplicates) and a verdict:

- **CONTINUE** while substantive findings are still falling beyond the noise, or while blocking findings are still frequent — but when the window is flat and the blocking findings are residue of your own edits, treat it as PLATEAU.
- **PLATEAU** when the last six rounds show no trend in substantive findings beyond the
  noise of a count (the fitted change over the window within two standard deviations,
  the square root of the mean) and blocking findings are rare (at most two in the last
  round and two a round on average). At a plateau, tell the requester the
  numbers and recommend stopping at the practical bar, or narrowing the loop to blocking
  and gap findings only. Do not run another full round on autopilot.
- **RESIDUE-BOUND** when defective resolutions plus consistency slips in a round exceed
  half of that round's substantive findings: the loop is now mostly reviewing its own edits.
  Stop editing minors, tighten the fixes, and expect the next round to be the last.

Log the verdict in the round's entry so the requester can see the trend without reading
thirty tables.

## Closing the loop

When it stops, in one commit: set the document's status line to "the review loop closed at
round N", say in one sentence which bar it closed at and why, append a closing line to the
log with the round count and the findings total, and give the requester a recap that
stands alone: what the loop produced, the headline commitments, the open decisions that
are theirs, and the honest note that the last revision's edits were seen by the checkers
only. Offer a pull request; do not open one unasked.

## The log and the status paragraph

Keep one log file (`REVIEW.md` or the project's equivalent) with a header that states the
roles, the severities, the bar and the id scheme, then one entry per round:

```
## Round N — on revision M (commit `hash`)
<one paragraph: totals, the blocking rows and what they changed, the gaps, the numbers>
### N-A (adversarial, technical) — a BLOCKING, b GAP, c NUMBERS, d MINOR
| # | Sev. | Finding | Resolution |
...
**Declined or only partly applied:** none | <ids with evidence>
```

Keep the document's status paragraph current: revision, round count, the series of
totals, the last round's shape, and the bar. A verification script that recounts each
table's rows against its header (see `references/log-format.md`) belongs in the revision
step; the case study's log was itself found wrong by the checkers twice.

## Cost accounting

State the price of a round up front and repeat it at every plateau. In the case study a
late round cost about 2 million tokens (four reviewers at 280–480 k each, two checkers at
280–380 k) and about an hour of wall clock with the revision; the requester's own reading
of the document is the larger cost and grows with every round because the document grows.

## What the data showed

Thirty-two rounds over 40 hours. The first three rounds took the plan from 112 findings
(20 blocking) to 73 (1 blocking) — the loop earning its keep. After a scope reset at round
4, substantive findings (blocking + gap) reached the 14–31 band by round 6 and **never
left it for 26 rounds**. Totals drifted from 52 to 32 across rounds 13–32, about one
finding per round, while the plan grew from 53 000 to 84 000 words: each fix added
qualifications, so the consistency surface grew as fast as the findings fell. Blocking
findings after round 6 were 0–3 a round (one spike of 6), and the last four were residue
of the author's own edits. The loop paid for itself through about round 13–16; the second
half changed no decision. The stop rule in step 6 first fires at round 12 of that series, then at every round from 19 on but two; everything after round 13 was optional.

## Files in this skill

- `references/case-study.md` — the numbers behind the rules above, round by round.
- `references/briefs.md` — the four reviewer briefs and the two checker briefs as
  templates, with the report formats.
- `references/log-format.md` — the log header, the entry format, the status paragraph and
  the row-count verifier.
- `scripts/make_briefs.py` — writes the six brief files for a round from a small JSON.
- `scripts/anchored_edit.py` — the edit helper with the MISMATCH guard; import it from a
  per-reviewer revision script.
- `scripts/loop_metrics.py` — parses the log and prints the series and the verdict.
- `assets/hooks.json` — an optional PostToolUse hook that prints the verdict whenever the
  log is edited, so the plateau cannot be missed.

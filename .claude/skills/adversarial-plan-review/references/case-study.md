# Case study: 32 rounds over a Kotlin Multiplatform plan

The loop reviewed a four-document plan (README as the approval surface, FUNCTIONAL,
TECHNICAL, VERIFICATION) for rebuilding a TypeScript prototype game on Kotlin
Multiplatform. Four reviewers a round (A adversarial technical, B adversarial product and
money, C blind implementer, D blind owner's advisor), one revision per round, a two-checker
consistency pass after each revision from revision 13 on. The requester's brief said
"improve the plan until there are no more findings"; the loop was stopped by the requester
at round 32 at the practical bar.

## The series

Substantive = BLOCKING + GAP. Round 4 was a scope reset (the plan was rewritten from a
migration to a start from scratch) and ran in two parts on two revisions.

| Round | Total | Blocking | Gap | Numbers | Minor | Substantive |
|---|---|---|---|---|---|---|
| 1 | 112 | 20 | 49 | 25 | 18 | 69 |
| 2 | 97 | 8 | 37 | 21 | 31 | 45 |
| 3 | 73 | 1 | 27 | 13 | 32 | 28 |
| 4 | 71 | 5 | 19 | 12 | 35 | 24 |
| 5 | 55 | 6 | 16 | 11 | 22 | 22 |
| 6 | 59 | 5 | 14 | 6 | 34 | 19 |
| 7 | 69 | 3 | 27 | 9 | 30 | 30 |
| 8 | 62 | 2 | 27 | 7 | 26 | 29 |
| 9 | 59 | 1 | 22 | 5 | 31 | 23 |
| 10 | 72 | 2 | 28 | 10 | 32 | 30 |
| 11 | 73 | 2 | 29 | 8 | 34 | 31 |
| 12 | 56 | 2 | 25 | 5 | 24 | 27 |
| 13 | 52 | 0 | 21 | 7 | 24 | 21 |
| 14 | 51 | 2 | 22 | 4 | 23 | 24 |
| 15 | 48 | 0 | 16 | 10 | 22 | 16 |
| 16 | 45 | 0 | 17 | 4 | 24 | 17 |
| 17 | 46 | 1 | 15 | 5 | 25 | 16 |
| 18 | 51 | 6 | 15 | 5 | 25 | 21 |
| 19 | 47 | 2 | 17 | 7 | 21 | 19 |
| 20 | 46 | 1 | 17 | 6 | 22 | 18 |
| 21 | 42 | 0 | 19 | 4 | 19 | 19 |
| 22 | 46 | 1 | 18 | 6 | 21 | 19 |
| 23 | 45 | 2 | 14 | 3 | 26 | 16 |
| 24 | 47 | 1 | 19 | 2 | 25 | 20 |
| 25 | 49 | 2 | 16 | 5 | 26 | 18 |
| 26 | 45 | 1 | 19 | 6 | 19 | 20 |
| 27 | 39 | 1 | 14 | 2 | 22 | 15 |
| 28 | 38 | 1 | 13 | 3 | 21 | 14 |
| 29 | 39 | 2 | 13 | 5 | 19 | 15 |
| 30 | 38 | 0 | 9 | 6 | 23 | 9 |
| 31 | 42 | 2 | 13 | 3 | 24 | 15 |
| 32 | 32 | 0 | 12 | 3 | 17 | 12 |

Totals: 1 746 findings, none declined in rounds 24–32, four declined with evidence in all.

## Where the yield fell off

Three markers, in order of strictness:

1. **Round 6.** Substantive findings reached the 14–31 band and never left it for the
   remaining 26 rounds. The mean over rounds 7–32 is 19; there is no trend. Everything the
   loop found after round 6 was real, but nothing it found changed a decision, a phase,
   the stack or the money by more than a line.
2. **Round 7.** The reviewers' "previous resolutions checked" sections started flagging
   the last revision's fixes as defective in bulk: every reviewer in rounds 7–12 reported
   defective resolutions, typically ten to fifteen ids each. The loop had started reviewing
   its own edits. The consistency pass (revision 13 onward) cut that to 3–12 ids a round,
   at the cost of 8–16 self-inflicted slips fixed per revision before the reviewers saw it.
3. **Rounds 13–16.** The first zero-blocking round (13), the consistency pass added, and
   totals at 45–52. From here to round 32 totals drifted down by about one finding per round
   while the plan grew from 53 000 to 84 000 words. The stop rule in SKILL.md (no trend in
   substantive findings beyond a count's noise over six rounds, blocking rare) first fires
   at round 12 of this series, then at every round from 19 on but two; `loop_metrics.py`
   reproduces this from the log.

The late blocking findings were residue: rounds 29 and 31 each had two, all four caused by
the author's own previous edits (a token variable with a one-hour lifetime introduced two
revisions earlier; a ruleset act placed on the wrong phase; a store feature that exists
only for updates; two capture sets left with a switch the third had gained).

## What grew

| Revision | Lines | Words |
|---|---|---|
| 1 | 1 501 | 18 702 |
| 3 | 2 158 | 30 718 |
| 4 (rewrite) | 2 372 | 34 486 |
| 6 | 2 591 | 38 464 |
| 11 | 3 110 | 49 993 |
| 13 | 3 256 | 53 483 |
| 17 | 3 457 | 60 004 |
| 21 | 3 592 | 65 448 |
| 27 | 3 811 | 74 533 |
| 34 | 3 891 | 83 596 |

Words grew 4.5× while lines grew 2.6×: late fixes lengthened sentences with qualifications
and parentheticals rather than adding sections. Denser prose is harder to keep consistent
and harder for the requester to read, and both costs compound per round.

## Time and tokens

Rounds 1–34 ran from the evening of day 1 to the afternoon of day 3, about 40 hours of
wall clock. Rounds 13–32 took about 19.5 hours: roughly 58 minutes per round including
the revision and the consistency pass, with the four reviewers running 18–29 minutes each
in parallel. A late round cost about 2 million tokens: four reviewers at 280–480 k each
and two checkers at 280–380 k each.

## What worked and should be kept

- Two adversarial specialists plus two blind readers. The blind implementer found the
  most executable defects (undefined files, orders, gates); the owner's advisor kept the
  approval surface honest and gave the "approve with conditions" verdict that made the
  stop defensible.
- "Verify, don't assume" in the briefs. Reviewers checked claims against the code and
  against vendor facts, and corrected false platform claims the author had written from
  memory.
- One edit script per reviewer with anchored replacements and a MISMATCH guard; no
  partial revision was ever committed.
- The consistency pass after every revision, split into numbers and mechanisms.
- Every finding logged with its resolution, duplicates cross-referenced, declines with
  evidence. The log is what let the requester decide to stop.
- Lighter models for reviewers once the loop was in steady state.

## What should change next time

- Agree the bar and the stop rule before round 1, in writing, in the document.
- Run the consistency checkers from round 1, not round 13.
- Stop editing minors once the substantive count plateaus; batch them at the end.
- State every derived number's rule once, in one place, so reviewers cannot reverse each
  other's arithmetic (the two-a-week calendar went 20 → 19 → 20 in three rounds).
- Run `loop_metrics.py` after every round and put its verdict in the log entry.
- Freeze scope before round 1; a rewrite mid-loop resets the series.
- Watch the word count. A plan that grows 1 000 words a round is being qualified, not
  improved.

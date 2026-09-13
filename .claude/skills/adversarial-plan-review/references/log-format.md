# The review log and the status paragraph

## Log header (once)

```
# The plan's review log

How the plan was reviewed. Each round ran four independent agents in parallel over the
documents: two adversarial reviewers (A technical; B product, process, money and risk) and
two blind reviewers (C the implementer who has to execute the first phases next week; D the
requester's advisor holding the plan against the brief). None saw the drafting or each
other's reports.

Severities: BLOCKING — could not be executed as written, or a load-bearing claim is false ·
GAP — a real case the plan never addresses · NUMBERS — a value is wrong and the reviewer
shows why · MINOR — clarity or style. Every BLOCKING and GAP is resolved by editing the
plan; NUMBERS the same way or declined with evidence; MINOR applied while the loop is young
and logged without editing once the substantive count plateaus.

The bar: <the loop's bar or the practical bar, as agreed>. The stop rule: the loop also
stops at a plateau reported by loop_metrics.py, and the requester is told why.

Ids: A/B/C/D as above, prefixed by the round (12-A3 = round 12, reviewer A, finding 3).
```

## One entry per round

```
## Round N — on revision M (commit `hash`)

<One paragraph: "Four reviewers, T findings: b BLOCKING, g GAP, n NUMBERS, m MINOR." Then
the blocking rows and what changed because of them, the gaps in one sentence each, the
numbers, the declines. End with the metrics verdict: "loop_metrics: CONTINUE | PLATEAU |
RESIDUE-BOUND (substantive 19, 18, 20 over the last three rounds)".>

### N-A (adversarial, technical) — a BLOCKING, b GAP, c NUMBERS, d MINOR

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| A1 | BLOCKING | <one clause> | <what changed, where: § refs> |
| A2 | GAP | <one clause> | with B3 |

### N-B ... N-C ... N-D likewise

**Declined or only partly applied:** none. | <id — the evidence, one line each>
```

## The document's status paragraph

Keep at the top of the approval surface:

```
**Status: revision M, under review (date).** ... reviewed by four independent agents in
N rounds (t1, t2, ..., tN findings; the series is in REVIEW.md). This is revision M,
after round N, whose <blocking findings in one clause>; its <gaps in one clause>; its
<numbers in one clause>; <declined: none | ids>. The loop's bar is <bar>; the stop rule is
<rule>.
```

When the loop closes, the first sentence becomes "**Status: revision M — the review loop
closed at round N (date).**" and the paragraph says which bar it closed at and why.

## Row-count verifier

Run after appending an entry; every table header's counts must equal its rows.

```python
import re, sys
s = open(sys.argv[1]).read(); n = sys.argv[2]
sec = s[s.index(f"## Round {n} "):]
ok = True
for m in re.finditer(r"### \d+-([A-D]) .*? — (\d+) BLOCKING, (\d+) GAP, (\d+) NUMBERS, (\d+) MINOR\n\n(.*?)(?=\n###|\n\*\*Declined)", sec, re.S):
    rows = [l for l in m.group(6).split("\n") if l.startswith("| " + m.group(1))]
    sev = {k: sum(1 for l in rows if f"| {k} |" in l) for k in ("BLOCKING", "GAP", "NUMBERS", "MINOR")}
    want = dict(zip(("BLOCKING", "GAP", "NUMBERS", "MINOR"), map(int, m.groups()[1:5])))
    print(m.group(1), len(rows), sev, "OK" if sev == want else f"BAD {want}"); ok &= sev == want
sys.exit(0 if ok else 1)
```

#!/usr/bin/env python3
"""Parse a review log (the REVIEW.md format in references/log-format.md) and print the
series of findings per round with a stop verdict.

usage: loop_metrics.py <log.md> [--brief] [--residue <json>] [--window 6] [--max-blocking 2]

The residue file is optional: {"12": {"defective": 9, "slips": 14}, ...} — defective
resolutions the reviewers flagged for that round and consistency slips fixed on the
revision it reviewed. With it the RESIDUE-BOUND verdict can fire.

Verdicts:
  CONTINUE       substantive findings (blocking + gap) still falling
  PLATEAU        the last <window> rounds show no trend in substantive findings beyond
                 the noise of a count (two standard deviations, sqrt of the mean) and
                 blocking findings are rare (window mean and last round <= max-blocking)
  RESIDUE-BOUND  defective + slips >= half of the last round's substantive count
Exit code 0 always; the verdict is advice, not a gate.
"""
import json, re, sys

def parse(text):
    parts = re.split(r"^## Round (\d+)[^\n]*\n", text, flags=re.M)
    rounds = []
    for i in range(1, len(parts), 2):
        n, body = int(parts[i]), parts[i + 1]
        rows = re.findall(r"^\| [A-Z]\d+ \| (BLOCKING|GAP|NUMBERS|MINOR) \|", body, re.M)
        hdr = re.findall(r"^### \d+-[A-Z] .*? — (\d+) BLOCKING, (\d+) GAP, (\d+) NUMBERS, (\d+) MINOR", body, re.M)
        if rows:
            # the table rows are the ground truth (the log verifier keeps headers equal to them)
            b, g, nu, m = (rows.count(k) for k in ("BLOCKING", "GAP", "NUMBERS", "MINOR"))
            total = b + g + nu + m
        elif hdr:
            b, g, nu, m = (sum(int(h[k]) for h in hdr) for k in range(4))
            total = b + g + nu + m
        else:
            # no per-reviewer tables: sum every "a BLOCKING, b GAP, c NUMBERS, d MINOR" the
            # entry states (a round run in parts states one per part)
            quads = re.findall(r"(\d+) BLOCKING, (\d+) GAP, (\d+) NUMBERS, (\d+) MINOR", body)
            if quads:
                b, g, nu, m = (sum(int(q[k]) for q in quads) for k in range(4))
                total = b + g + nu + m
            else:
                s = re.search(r"(\d+) findings", body)
                total, b, g, nu, m = (int(s.group(1)) if s else 0), None, None, None, None
        dup = len(re.findall(r"\| with [A-Z]\d+", body))
        declined = re.search(r"\*\*Declined or only partly applied:\*\* (.*)", body)
        rounds.append(dict(round=n, total=total, blocking=b, gap=g, numbers=nu, minor=m,
                           substantive=(b + g) if b is not None else None, duplicates=dup,
                           declined=(declined.group(1).strip() if declined else "?")))
    return rounds

def verdict(rounds, residue, window, max_blocking):
    """PLATEAU when the last <window> rounds show no material trend in substantive findings
    (the fitted change over the window is within two standard deviations of a single
    count, sqrt(mean)) and blocking findings are rare (window mean <= max_blocking, last
    round <= max_blocking). RESIDUE-BOUND when the residue file says the last round's
    defective resolutions plus consistency slips reach half of its substantive count."""
    known = [r for r in rounds if r["substantive"] is not None]
    if len(known) < window:
        return "CONTINUE", "fewer than %d comparable rounds" % window
    last = known[-1]
    tail = known[-window:]
    ys = [r["substantive"] for r in tail]; n = len(ys)
    mean = sum(ys) / n
    xs = [i - (n - 1) / 2 for i in range(n)]
    slope = sum(x * (y - mean) for x, y in zip(xs, ys)) / sum(x * x for x in xs)
    change = slope * (n - 1)
    noise = 2 * mean ** 0.5
    flat = abs(change) <= noise
    blk = [r["blocking"] or 0 for r in tail]
    res = residue.get(str(last["round"]), {})
    r_total = res.get("defective", 0) + res.get("slips", 0)
    series = ", ".join(map(str, ys))
    if r_total and last["substantive"] and r_total >= 0.5 * last["substantive"]:
        return "RESIDUE-BOUND", "defective %d + slips %d >= half of substantive %d in round %d" % (
            res.get("defective", 0), res.get("slips", 0), last["substantive"], last["round"])
    if flat and sum(blk) / n <= max_blocking and blk[-1] <= max_blocking:
        return "PLATEAU", "substantive %s over the last %d rounds (fitted change %+.1f against noise ±%.1f), blocking %s" % (
            series, n, change, noise, ", ".join(map(str, blk)))
    if not flat and change < 0:
        return "CONTINUE", "substantive still falling (%s: fitted change %+.1f, noise ±%.1f)" % (series, change, noise)
    if flat:
        return "CONTINUE", "substantive flat (%s) but blocking %s — check whether the blocking findings are residue of your own edits; if they are, treat this as PLATEAU" % (series, ", ".join(map(str, blk)))
    return "CONTINUE", "substantive rising (%s: fitted change %+.1f) — a scope change or a regression in the fixes; look before the next round" % (series, change)

def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__); return 0
    path = argv[1]; brief = "--brief" in argv
    window = int(argv[argv.index("--window") + 1]) if "--window" in argv else 6
    max_blocking = int(argv[argv.index("--max-blocking") + 1]) if "--max-blocking" in argv else 2
    residue = json.load(open(argv[argv.index("--residue") + 1])) if "--residue" in argv else {}
    rounds = parse(open(path, encoding="utf-8").read())
    if not rounds:
        print("no '## Round N' entries found in", path); return 0
    if not brief:
        print("round total block gap num minor subst dup")
        for r in rounds:
            f = lambda k: "-" if r[k] is None else r[k]
            print("%5d %5s %5s %3s %3s %5s %5s %3d" % (r["round"], f("total"), f("blocking"), f("gap"), f("numbers"), f("minor"), f("substantive"), r["duplicates"]))
    v, why = verdict(rounds, residue, window, max_blocking)
    grand = sum(r["total"] for r in rounds)
    print("%s — %s. %d rounds, %d findings in all." % (v, why, len(rounds), grand))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))

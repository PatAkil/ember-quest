#!/usr/bin/env python3
"""Anchored edits for a revision script.

    from anchored_edit import Editor
    e = Editor("/repo/plan/")            # every path below is relative to this root
    e.r("TECHNICAL.md", "old exact text", "new text")          # exactly one occurrence
    e.r("README.md", "twice", "thrice", count=2)                 # exactly two
    e.rx("VERIFICATION.md", r"the port\s+exemption", "the module-wide suspension")
    e.insert_before("README.md", "| detekt cannot parse", "| new risk row ... |")
    e.done()                              # prints the tally; exits 1 on any MISMATCH

A mismatch (an anchor found zero times, or a different number of times than declared)
prints a MISMATCH line and applies nothing for that item; every other item is applied.
Wrap the commit in a guard that skips it when the script exits non-zero, so a partial
revision is never committed:

    python3 rev_a.py && git add -A && git commit -m "..."
"""
import re, sys

class Editor:
    def __init__(self, root):
        self.root = root if root.endswith("/") else root + "/"
        self.fails = 0; self.n = 0

    def _read(self, f): return open(self.root + f, encoding="utf-8").read()
    def _write(self, f, s): open(self.root + f, "w", encoding="utf-8").write(s)

    def r(self, f, old, new, count=1):
        s = self._read(f); c = s.count(old)
        if c != count:
            self.fails += 1; print("MISMATCH (%d, want %d) in %s: %r" % (c, count, f, old[:110])); return False
        self._write(f, s.replace(old, new)); self.n += 1; return True

    def rx(self, f, pattern, new, count=1):
        s = self._read(f); m = re.findall(pattern, s)
        if len(m) != count:
            self.fails += 1; print("RX MISMATCH (%d, want %d) in %s: %r" % (len(m), count, f, pattern[:110])); return False
        self._write(f, re.sub(pattern, new, s)); self.n += 1; return True

    def insert_before(self, f, line_prefix, new_line):
        lines = self._read(f).split("\n")
        idx = [i for i, l in enumerate(lines) if l.startswith(line_prefix)]
        if len(idx) != 1:
            self.fails += 1; print("MISMATCH (%d, want 1) line prefix in %s: %r" % (len(idx), f, line_prefix[:110])); return False
        lines.insert(idx[0], new_line); self._write(f, "\n".join(lines)); self.n += 1; return True

    def done(self):
        print("edits:", self.n, "failed:", self.fails)
        if self.fails:
            sys.exit(1)

if __name__ == "__main__":
    print(__doc__)

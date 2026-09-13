#!/usr/bin/env python3
"""Write the four reviewer briefs and the two consistency-checker briefs for one round.

usage: make_briefs.py <config.json> <out_dir>

config.json keys (all strings unless noted):
  what            "a plan" / "a design document" / "a build brief"
  plan_dir        absolute path of the documents' folder
  docs            list of file names, the approval surface first
  log             the log file name (REVIEW.md)
  project         one paragraph: what the documents propose, for a reader who has never
                  seen the repository
  repo            absolute path of the repository (READ-ONLY for reviewers)
  scratch         absolute path of a scratch dir the reviewers may write in
  round, revision integers; lines: approximate total line count of the documents
  bar             the agreed bar, e.g. "a round that returns zero BLOCKING and zero GAP
                  findings, or the practical bar: zero BLOCKING and no GAP that moves a
                  phase's size, price or gate"
  technical_axes  A's axes, one sentence listing the sections and mechanisms to attack
  product_axes    B's axes
  first_phases    C's phases, e.g. "P0, P1 and P2"; sequence_sections: where the order lives
  brief_asks      D's list of the requester's asks, semicolon-separated
  code_paths      what reviewers may verify against (paths); tooling: vendors and tools
  prev_hash, hash, diff_path, diff_summary   for the checker briefs (may be placeholders
                  until the revision is committed; rerun then)

Prompts are written as prompt-A.txt … prompt-D.txt, checker-numbers.txt and
checker-mechanisms.txt. Launch each as a background agent whose only instruction is to
read its brief in full and follow it.
"""
import json, os, sys

ROLES = {
 "A": ("adversarial, technical", "Break the plan on the technical axes: {technical_axes}. Look for: a mechanism that cannot work as specified (a platform semantic that does not exist or does not do what the plan says; a check that can never pass; a file read before it exists; a step that depends on a later one), a specification an implementer would have to guess, a number the plan states that the code contradicts, a metric whose formula is inconsistent, unmeasurable or unfailable, a hidden dependency between phases, and, from round 2 on, a previous resolution that does not actually resolve its finding or introduced a new defect.", "Be adversarial about substance and economical with words."),
 "B": ("adversarial: product, process, money and risk", "Break the plan on scope, sequence, ownership, money, calendar and external dependencies: {product_axes}. Look for: a commitment made before the signal that should inform it; a branch priced on one side only; an act no one is assigned; a vendor, store or platform fact the plan gets wrong; a total its own parts do not reproduce; a risk with no tripwire; an owner hour or cost stated nowhere; a step the requester cannot perform as described; and, from round 2 on, a previous resolution that does not resolve its finding.", "Be adversarial about substance and economical with words."),
 "C": ("blind implementer", "You are the engineer who has to execute {first_phases} next week, alone, with no one to ask, following {sequence_sections} step by step. Read the plan as written and report everything you would have to guess; everything that contradicts itself (if two sections disagree, that is a finding — do not resolve it by guessing intent); every command, path, file, workflow, permission, schema, format, grammar, record or field that is undefined, inconsistent between its definition and its uses, or defined after it is used; every step whose inputs do not exist when it runs; every gate whose pass condition cannot be evaluated from what is written; and every claim about this repository that the code contradicts. Your deliverable is what stands between you and starting on Monday.", "Be exact and economical with words."),
 "D": ("blind owner's advisor", "You advise the person who has to approve this plan and live with it. Hold the plan against the brief, ask by ask: {brief_asks}. For each ask say whether it is delivered, delivered with a caveat the approval surface states, or missing. Then read the approval surface as the requester will: every commitment of time, money, hardware, accounts and attention must be on it and must reconcile with the body. Give a verdict: approve, approve with conditions (list them), or do not approve (say what would change your mind).", "Be candid and economical with words."),
}

COMMON = """You are one of four independent reviewers of {what} in {plan_dir} — {docs_list}, and {log_clause}. {project} This is revision {revision} (the HEAD commit of the checked-out branch; `git log -1` shows it). The plan is at round {round} of a review loop whose bar is {bar}. Read all the documents in full (about {lines} lines) before writing anything.

YOUR ROLE: reviewer {id} — {role}. {role_text} Cite locations precisely: `FILE § section` or `FILE:line` for the plan, `path:line` for the code.

Verify, don't assume: check the plan's claims about the repository against the files ({code_paths}) and its claims about tooling and vendors ({tooling}) against what you know for certain — say when you are not certain.

Severities — apply them strictly, neither inflated nor lenient:
- BLOCKING: the plan could not be executed as written, or a claim it depends on is false (show the evidence).
- GAP: a real case or need the plan never addresses (not a preference for more detail).
- NUMBERS: a value, version, budget or estimate is wrong and you show why.
- MINOR: clarity, consistency or style.
An open question the plan explicitly leaves to the requester is not a finding unless it is mis-stated or mis-priced. Do not report one defect twice under different ids; if several locations share a defect, list the locations under one id.

RULES: the repository is READ-ONLY for you — do not edit, create, move or delete any file under {repo}; do not run git commands that change state (no add/commit/checkout/stash/push/reset); do not install dependencies or start servers. Put any notes or scripts under {scratch}/ (it exists). Write your condensed report to that directory as {id}.md and return the same content as your final message.

REPORT FORMAT (condensed — one line per finding, about 40 words of finding plus the fix):
# Review round {round} — reviewer {id} ({role}) — revision {revision}
<N> BLOCKING · <N> GAP · <N> NUMBERS · <N> MINOR
{id}<n> | <SEV> | <location> | <finding with its evidence> | Fix: <the smallest edit that resolves it>
...
{prev_section}

Order the findings by severity, then by document. {closing}"""

CHECKER = """You are a read-only consistency checker for a document set: {docs_list} under {plan_dir} at revision {revision}, the HEAD commit ({hash}) of the checked-out branch. {log} is the review log and is out of scope except as context.

Your scope is {scope} ONLY: {scope_def} {other} is NOT your scope; another checker covers it. Design opinions and wording are not your scope either.

Method:
1. Start with the revision's diff: {diff_path} (the output of `git diff {prev_hash} {hash} -- {plan_dir}`). For every {unit} the diff adds or changes, grep the documents for every other statement of the same {unit} and check they agree. The diff touched, among other things: {diff_summary}
2. {step2}
3. The repository is READ-ONLY for you: do not edit, create or delete any file under {repo}. Write scratch only under {scratch}/.

Report: write {scratch}/{name}.md in exactly this format and return the same content as your final message:

# Consistency check ({name}) — revision {revision}
<k> inconsistencies

{prefix}1 | <file>:<line> vs <file>:<line> | <the two statements, quoted briefly, and how they disagree> | Fix: <the smallest edit that makes them agree, naming which side is right and why>
{prefix}2 | ...

## Checked and {ok_word} (no finding)
<one line per {unit} you traced across the files and found consistent>

Only report a genuine contradiction between two statements or a total that does not equal its parts; do not report design opinions or wording. Quote line numbers from the files as they are now."""

SCOPES = {
 "numbers": dict(scope="NUMBERS", scope_def="counts, sums, ranges, prices, hours, weeks, sessions, line counts, table totals, list lengths (\"six actors\", \"four allowed changes\"), version numbers, dates and ordinal words — anywhere one statement contradicts another, a total does not equal its parts, or a count does not match its list.", other="Mechanisms", unit="number", step2="Then re-derive, from the plan's own stated parts, every total its tables state and every count it gives of a list it also enumerates.", prefix="N", ok_word="reproducing"),
 "mechanisms": dict(scope="MECHANISMS", scope_def="a rule, process, gate, job, file, flag, name or ownership that one place states one way and another place states another way — a file named with two paths, a step said to happen at two different points, a deliverable one section owns and another assigns elsewhere, a renamed thing whose old name survives somewhere.", other="Numbers", unit="mechanism", step2="Then walk the cross-references the plan itself makes in the changed passages and confirm the referenced section says what the reference claims.", prefix="M", ok_word="consistent"),
}

def main(argv):
    if len(argv) != 3:
        print(__doc__); return 1
    cfg = json.load(open(argv[1])); out = argv[2]; os.makedirs(out, exist_ok=True)
    cfg = dict(cfg); cfg["prev"] = int(cfg["round"]) - 1
    if cfg["prev"] == 0:  # round 1: no earlier rounds to check
        cfg["log_clause"] = "%s (the review log, empty before this round)" % cfg["log"]
        cfg["prev_section"] = "## Earlier resolutions checked\nNone: this is round 1."
    else:
        cfg["log_clause"] = "%s (the log of %d earlier rounds; the round-%d tables are at its end)" % (cfg["log"], cfg["prev"], cfg["prev"])
        cfg["prev_section"] = ("## Round-%d resolutions checked\nHolding: <round-%d ids from %s whose resolution you verified in the text>. "
                               "Defective: <ids whose resolution does not resolve the finding, one-line reason each — each is also a finding above>.") % (cfg["prev"], cfg["prev"], cfg["log"])
    cfg["docs_list"] = ", ".join(cfg["docs"])
    for k in ("technical_axes", "product_axes", "first_phases", "sequence_sections", "brief_asks", "code_paths", "tooling", "prev_hash", "hash", "diff_path", "diff_summary"):
        cfg.setdefault(k, "<" + k + ">")
    for rid, (role, text, closing) in ROLES.items():
        c = dict(cfg, id=rid, role=role, closing=closing)
        c["role_text"] = text.format(**c)
        open(os.path.join(out, "prompt-%s.txt" % rid), "w").write(COMMON.format(**c))
    for name, sc in SCOPES.items():
        c = dict(cfg, name=name, **sc)
        open(os.path.join(out, "checker-%s.txt" % name), "w").write(CHECKER.format(**c))
    print("wrote", ", ".join(sorted(os.listdir(out))), "in", out)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))

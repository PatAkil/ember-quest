---
name: releasing-the-game
description: Use when the user asks to ship, publish, deploy, release, or "let my brother play the new version" — and at the end of an overnight session's last green milestone. Pushes main to GitHub, watches the Pages workflow, and verifies the live URL serves the new bundle.
---

# Releasing the game

A push to `main` is a release: `.github/workflows/pages.yml` builds and deploys to **https://patakil.github.io/ember-quest/** on every push. Nothing is pushed until the gates are green, and a broken release is fixed forward or reverted, never left.

## Gates (all four, in this order)

```
npm run check
npm run build
npm run smoke          # against the running dev server — playing-the-game steps 1–3
npm run sim -- --runs 1000 --policy balanced,random   # only when rules changed
```

The sim gate is a sanity line, not a tuning session: balanced within its target band, random under 5 %.

## Ship

```bash
git status --short                 # only intended files
git add -A && git commit -m "<what changed for the player>"
git push origin main
gh run watch "$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
curl -s https://patakil.github.io/ember-quest/ | grep -o 'assets/index-[^"]*\.js'
```

The last line prints the deployed bundle name; it must match the file in `dist/assets/` from the local build. Pages can serve the previous version for up to a minute after the run finishes — recheck before reporting.

Commit messages describe the change for a player ("bosses telegraph their big hit"), not the implementation. Signing is off in this repo's config; never add `-S`.

## Report

Three things: the live URL, what changed for the player, and one line on balance if rules moved ("balanced 19 %, random 0 %, unchanged"). Claude has not played the release; the user and their brother are the playtesters.

## Roll back

```bash
git revert HEAD --no-edit && git push origin main
```

Reverting re-runs the workflow and restores the previous bundle within about a minute.

# Ember Quest

A roguelike JRPG in the retro arcade style: a branching node map per act,
turn-based one-on-one battles, skill points, a loot table of named items, and
permadeath.

**Play it:** https://patakil.github.io/ember-quest/

## Controls

Keyboard only (desktop browser). Up / Down (arrow keys or W / S) move the
cursor, **Space** or **Z** selects, **P** or **Esc** pauses. Sound starts on the
first keypress.

## Develop

```
npm install
npm run dev
npm run build
```

`npm run dev` serves the game at http://localhost:5173/; `npm run build`
type-checks and writes the production build to `dist/`. `npm run verify` runs
every gate (type-check, lint, build, headless smoke, a quick balance sim).

Built with [Retrovibe](https://github.com/PatAkil/retrovibe): TypeScript +
Canvas 2D, no game framework. See `DESIGN.md` for the systems design, `STYLE.md` for the look, and
`CLAUDE.md` for how AI coding agents work on it.

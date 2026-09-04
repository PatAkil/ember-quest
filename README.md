# Ember Quest

A roguelike JRPG in the retro arcade style: a branching node map per act,
turn-based one-on-one battles, skill points, a loot table of named items, and
permadeath.

**Play it:** https://patakil.github.io/ember-quest/

## Controls

Keyboard only (desktop browser). Arrow keys / WASD move the cursor,
**Space** or **Z** confirms (A), **X** or **C** cancels (B), **P** or **Esc**
pauses. Sound starts on the first keypress.

## Develop

```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

Built with [Retrovibe](https://github.com/PatAkil/retrovibe): TypeScript +
Canvas 2D, no game framework. See `DESIGN.md` for the systems design.

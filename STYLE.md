# Ember Quest — style card

The visual contract for this game. Read it before any change to the look, sprites,
palette or juice, and edit it in the same milestone when a decision below changes.
It used to be the header comment of `game/main.ts`; the code carries no comments now,
so the art decisions live here. The general rules behind it (palette discipline,
contrast floors, sprite craft, CRT) are in the **ensuring-arcade-visuals** skill.

## The game in one paragraph

A retro roguelike JRPG. No overworld walking, no real-time action: every screen is a
menu or a battle tableau. The hero descends through **four acts** — Crypt → Tundra →
Desert → Holy Temple — each a branching node map (FIGHT / ELITE / REST / LOOT / BOSS)
leading to that act's single boss. Combat is turn-based, one enemy at a time: ATTACK
(free) or a known spell (costs MP); enemies hit back PHYSICAL or MAGIC and carry their
own resists. Every clear pays **skill points**, spent on the LEVEL UP screen (HP / MP /
ATK / MAG / DEF / MDEF / CRIT), and loot is a table of **named items** in six slots —
one item per slot, a new find replaces the old — where every RARE+ item carries a
unique effect (hex dagger, ramping axe, twin bolts, reflect mail, phoenix pendant…).
Permadeath; felling the Seraph wins the run. Rules live in `game/sim/`, content in
`game/data.ts` (see `DESIGN.md`); the presentation code only draws them.

## Decisions

| Axis | Decision |
|---|---|
| Palette | **PICO8**. The background is a flat **black void** (`PICO8[0]`); the depth planes are the only thing separating "menu" screens from "battle" screens. |
| Hero | A **crimson knight**, 22×27 at px 1: body 8, shade 2, highlight 9, white (7) plume, yellow (10) visor, grey (6/5) blade angled off his right side as its own silhouette island. |
| Sprite craft | Every actor authored at px 1 at its rendered size (normals 14–38 px, elites 14–25, bosses 26–39 wide), keyline in the rows, 2–3 body tones plus flat accents, 2-frame breathe / float idles (`game/sprites/`). |
| Background planes | Under the ambient layer, inside the ambient band. **Crypt**: `PICO8[1]` pillars, with torch flames only as wall sconces on the two outer pillars (brown cup, grey bracket, at y 56–66) — clear of the HUD panels, the title lines and the card frame. The map draws the same backdrop through `renderBiomeBackdrop(g, dim)`, whose `dim` multiplies every internal alpha (map: 0.45). **Tundra**: `PICO8[1]` crescent moon + ice peaks. **Desert**: a low orange sun behind brown dune domes at reduced alpha. **Temple**: fluted dark-grey columns with gold capitals. |
| Surfaces | `drawBevel` floors — Crypt 5/6/1, Tundra 1/12/0, Desert 4/9/2, Temple 6/7/5 (fill / light / dark) — with one dither lip, and black ground shadows under the actors. Panels are **square** dark-blue (1) plates with a yellow (10) keyline; the selected row gets a dark-purple (2) bar. The floor bevel overscans 1 px each side so no edge highlight shows. |
| Text roles | `theme.ts` names them: `C_TEXT` 7, `C_DIM` 6 (7.83:1 on navy), `C_FAINT` 13 (lilac, 5.04:1 on black, 3.31:1 on navy — only for unavailable or empty things: empty slots, unaffordable actions, cleared/unreachable map nodes, map edges), `C_WARN` 9 (orange, 6.89:1 on navy, 4.61:1 on the purple bar — the resist tag). `PICO8[5]` is fill-only (bar troughs, dividers), never text. Map nodes: cursor blinks 7/10, reachable 7, future nodes keep a `C_FAINT` frame with a `C_DIM` label so the route stays readable. Map room icons and gear icons carry their shape in their hue (5×5; room icons with a black keyline). |
| Rarity language | Item names tint by rarity: grey / blue / pink / yellow (COMMON / RARE / EPIC / LEGENDARY). |
| Logo | `drawLogo` with color 10, shade 9, shadow 2. The title prop is the knight at px 2 on the Crypt floor with a slime idling opposite. |
| Accent | Warm yellow (10) for headings, the selected row and borders. |
| Ambient | Crypt embers · Tundra snow · Desert embers as dust (peach, 15) · Temple bubbles as motes (gold, 10). |
| Juice | Shake + yellow flash on hits; red shake + flash when struck; damage/heal pops spawn above the struck actor's head (from the sprite height) with a solid black backing — scale 2 with a black shadow for normal hits, scale 3 with a black outline for crits; crits also get a hit-stop that holds the battle queue; bursts in each actor's own hue; on the killing blow a red **radial** flash from the hero plus a freeze-frame — the knight falls where he stood and the killer stays under the dim. |
| Terminal screens | The live tableau (actors and backdrop only — no HUDs, no battle log, no pops) + `dimScene`, with two hollow `drawFrame` boxes that never overlap the actors: the headline in the sky (y 6–35) and the summary + prompt on the floor band (y 116–154). Dim, never a plate. |
| Shell and scale | `index.html` is a slim arcade cabinet: "Ember Quest" marquee, one bezel, a light-grey (`#a39c94`) hint — under 80 CSS px of vertical chrome. The 240×160 frame is scaled by the **largest whole integer** (min 2) that fits the window or host iframe in CSS px (`autoFit` in `game/app.ts`), re-fit on resize, never CSS-stretched; hold mode (`?hold=1`, the screenshot tooling) pins it at 3× (720×480). |

## Controls (as presented)

Up / Down (arrows or WASD) move every cursor; **A** confirms, spends a point or
advances; **PAUSE** pauses. **B is intentionally undeclared** — the title's hints come
from the declared actions (`select`, `pause`).

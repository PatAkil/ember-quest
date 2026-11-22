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
| Background planes | Under the ambient layer, inside the ambient band. **Crypt**: `PICO8[1]` pillars + torch flames. **Tundra**: `PICO8[1]` crescent moon + ice peaks. **Desert**: a low orange sun behind brown dune domes at reduced alpha. **Temple**: fluted dark-grey columns with gold capitals. |
| Surfaces | `drawBevel` floors — Crypt 5/6/1, Tundra 1/12/0, Desert 4/9/2, Temple 6/7/5 (fill / light / dark) — with one dither lip, and black ground shadows under the actors. Panels are **square** dark-blue (1) plates with a yellow (10) keyline; the selected row gets a dark-purple (2) bar. |
| Rarity language | Item names tint by rarity: grey / blue / pink / yellow (COMMON / RARE / EPIC / LEGENDARY). |
| Logo | `drawLogo` with color 10, shade 9, shadow 2. The title prop is the knight at px 2 on the Crypt floor with a slime idling opposite. |
| Accent | Warm yellow (10) for headings, the selected row and borders. |
| Ambient | Crypt embers · Tundra snow · Desert embers as dust (peach, 15) · Temple bubbles as motes (gold, 10). |
| Juice | Shake + yellow flash on hits; red shake + flash when struck; crits get a scale-3 outlined number and a hit-stop; bursts in each actor's own hue; on the killing blow a red **radial** flash from the hero plus a freeze-frame — the knight falls where he stood and the killer stays under the dim. |
| Terminal screens | The live tableau + `dimScene` + a hollow `drawFrame` bezel. |

## Controls (as presented)

Up / Down (arrows or WASD) move every cursor; **A** confirms, spends a point or
advances; **PAUSE** pauses. **B is intentionally undeclared** — the title's hints come
from the declared actions (`select`, `pause`).

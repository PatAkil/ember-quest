# Ember Quest — style card

The visual contract for this game. Read before any change to look, sprites, palette or juice. Moved out of `game/main.ts` when comments were removed from the code.

Ember Quest — a retro roguelike JRPG. No overworld walking, no real-time
action: every screen is a menu or a battle tableau. Descend through FOUR
ACTS (Crypt -> Tundra -> Desert -> Holy Temple), each a branching node map
(FIGHT/ELITE/REST/LOOT/BOSS) leading to that act's single boss. Combat is
turn-based, one enemy at a time: ATTACK (free) or a known spell (costs MP);
enemies hit back PHYSICAL or MAGIC and carry their own resists.

v2 PROGRESSION (see DESIGN.md): every clear pays SKILL POINTS spent on the
LEVEL UP screen (HP/MP/ATK/MAG/DEF/MDEF/CRIT), and loot is a table of NAMED
ITEMS in six slots — one item per slot, a new find replaces the old — where
every RARE+ item carries a unique effect (hex dagger, ramping axe, twin
bolts, reflect mail, phoenix pendant...). Rules live in sim.ts, content in
data.ts; this file is screens, input, juice and rendering only.
Permadeath; felling the Seraph wins the run.

STYLE CARD — diverges from the reference game, both verification fixtures,
AND every sibling in workspace/ (see workspace/ember-descent/game/main.ts for
the sibling this most needs to differ from — same fiction):
  - PALETTE: PICO8. Background is a flat BLACK VOID (PICO8[0]) — ember-descent
    uses PICO8[1]; this game's depth planes are the only thing separating
    "menu" screens from "battle" screens.
  - HERO: a CRIMSON KNIGHT, 22x27 at px 1 — body 8, shade 2, highlight 9,
    white (7) plume, yellow (10) visor, grey (6/5) blade angled off his right
    side as its own silhouette island. NOT blue (ember-descent's hero).
  - SPRITE CRAFT: every actor authored at px 1 at rendered size (normals
    14-38 px, elites 14-25, bosses 26-39 wide), keyline in the rows, 2-3 body
    tones + flat accents, 2-frame breathe/float idles (sprites.ts).
  - BACKGROUND PLANES (under the ambient layer, inside the ambient band):
    CRYPT [1] pillars + torch flames; TUNDRA [1] crescent moon + ice peaks;
    DESERT low orange sun behind brown dune domes at reduced alpha; TEMPLE
    fluted dark-grey columns with gold capitals.
  - SURFACES: drawBevel floors — CRYPT 5/6/1, TUNDRA 1/12/0, DESERT 4/9/2,
    TEMPLE 6/7/5 — one dither lip; black ground shadows under actors. Panels
    are square dark-blue (1) plates with a yellow (10) keyline, selected rows
    get a dark-purple (2) bar — the opposite of ember-descent's notched panels.
  - RARITY LANGUAGE: item names tint by rarity — grey / blue / pink / yellow.
  - LOGO: drawLogo 10 / 9 / 2; the title prop is the knight at px 2 on the
    Crypt floor with a slime idling opposite.
  - ACCENT: warm yellow (10) for headings, the selected row and borders.
  - AMBIENT: embers / snow / embers-as-dust (peach) / bubbles-as-motes (gold).
  - JUICE: shake + yellow flash on hits, red shake + flash when struck, crits
    get a scale-3 outlined number and a hit-stop, bursts in each actor's own
    hue, a red RADIAL flash from the hero + freeze-frame on the killing blow;
    the knight falls where he stood and the killer stays under the dim.
  - TERMINAL SCREENS: live tableau + dimScene + a hollow drawFrame bezel.

Controls: Up/Down (arrows/WASD) move every cursor; A confirms / spends a
point / advances; PAUSE pauses. B is intentionally undeclared.

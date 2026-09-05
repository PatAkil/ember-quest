# Ember Quest v3 — art review log

The owner's bar for the character art is Octopath Traveler's HD-2D sprites,
and the look is make-or-break. This file is the durable record of the art
loop: the diagnosis, the style rules every artist round works from, each
blind critic's verdict and correction list, and the verifiable plan. Sprite
work happens in `game/art/parts.ts` (the part library and its four-shade
material ramps) and `game/art/actors.ts` (recipes, rigs, baking, palettes);
the scene in `engine/light.ts` and `game/art/backdrops.ts`.

## Diagnosis (2026-09-05)

Three passes of sprites reached "competent 16-bit", not HD-2D. The causes,
in order of weight:

1. **Pixel density (an engine decision, corrected).** Actors drew at ×3 with
   64-cell parts: a 3-px cell and a hero at 20 % of a 720-px frame. Octopath's
   sprites are ≈ 48 native pixels tall at ≈ 2 px per pixel, 13 % of the frame
   — the same pixels per sprite at half the on-screen size. A side-by-side of
   the same bakes at ×3 and ×2 settled it: the contract now says
   `ACTOR_SCALE = 2`, heroes 52–60 cells, `ACTOR_W 128`, `BOSS_W 192`.
2. **Authoring method.** Sprites are ASCII grids composed from parts by a
   language model that sees its work only through screenshots. That caps
   hair, folds, hands and faces; the critic loop below is the counter.
3. **No scene.** Octopath's frames are at least half lighting: depth of
   field, light shafts, bloom, a lit ground with hard contact shadows, haze.
   The diorama module (`engine/light.ts`) is the answer; the sprites need
   contact shadows and a darker ground plane to sit at all.
4. **UI (an engine decision, corrected).** A 7×11 bitmap font at scale 2–3
   in flat boxes reads as arcade. The contract now gives the HUD a vector
   font (`HUD_FONT`, 18 px), thin translucent plates and portraits in the
   turn ribbon; the bitmap font stays for damage pops, the logo and card
   titles.
5. **VFX** are gradient blobs until bloom exists.
6. **Animation** is rigid-part keyframes; hurt and death were unreadable and
   are re-authored as a recoil and a collapse.

## Style rules (the brief every round works from)

About 3 heads tall with a big readable head; the face two dark eye clusters
with a highlight; hair a 3-tone mass with strand notches; 3–4 shades per
material with hue shift (shadows toward blue/violet, highlights warm),
desaturated midtones, never pure black; one top-left key light with shadow
under chin, arms and folds; a single thin rim highlight on the lit edge,
never a closed loop; selective dark outlines only where forms meet the
background or each other; collars, belts with buckles, trims, gloves and
boots darker than the garment, cape linings; hands on every humanoid with
weapons held in them; weapons proportionally large and shaded; element as a
dominant garment ramp plus a neutral secondary; a harmonious palette across
the cast; mean contrast ≥ 3:1 against the stage ground (`#1d2b53` in the
line-up), glowing creatures ≤ 6:1; idle 2–4 breathing frames, attacks with
weapon travel, a real hurt recoil, a real death collapse.

## Critic rounds

### Round 1 verdict: NOT CLOSE — 4/10
Two reasons: (1) nobody has hands — every arm is a flat 2–3 cell bar and every weapon floats unheld; (2) mean contrast against the stage navy (#1d2b53) is 1.75–2.9:1 for 15 of 19 actors, under the repo's ≥ 3:1 actor rule. Meets the bar: the 3-head proportion, non-black darks, BASALT's 4-step armour ramp with a cool shadow shift, TIDE's orb, real weapon travel on attack.

## Global
1. Hands everywhere: terminate every arm bar with a 3×3 hand block in the skin or glove ramp, one shade darker than the forearm; move each weapon 1–2 cells inward so its haft overlaps the hand (all six heroes, MARSH HAG, PYRE KNIGHT, DROWNED KNIGHT).
2. Lift the mass off the ground colour: raise each garment midtone ~18 % in value; push each sprite's outline two steps darker than its darkest body tone. Worst first: SABLE (1.75:1), CINDER IMP (2.10), DUST WRAITH (2.32), MARSH HAG (2.29), BOG TOAD (2.40). Cap FROST WISP (8.45:1) and FEN FIRE (9.71:1): drop their core two steps, keep only a 2-cell white hotspot.
3. Shade count: enemies carry 6–13 colours total. Every material gets four cells — highlight / mid / shade1 / shade2. Minimum: a shade-2 band across the bottom 3 rows of every torso, shade-1 under every horizontal edge.
4. Hue shift runs the wrong way on skin and cloth (EMBER skin H34 → H22 → H13 warms into shadow). Rotate every shadow tone 12–20° toward blue/violet and drop saturation ~10 points; keep highlights warm. Copy the armour ramp's logic.
5. No rim light exists: add one 1-px rim in the material's highlight tone along the upper-left silhouette only — top of head, outer shoulder, outer thigh. Never a closed loop.
6. No cloth has a fold: on every robe, tabard, tunic and cloak add 2–3 one-cell vertical shade-1 lines from belt to hem, unevenly spaced, plus a 2-cell shade-2 band under the hem.
7. One face on everyone: raise eyes 2 rows, close the gap by 1 cell, then vary per character — brow angle (1 cell), mouth width, cheek shade.
8. Four characters share one helm: BASALT one continuous slit + pauldrons wider than the helm; CRYPT WARDEN a flat-topped bucket; PYRE KNIGHT a keeled brow; DROWNED KNIGHT a broken, holed crown.

## Per character
- EMBER — keep the 3-tone flame and hair. Fix: the vest is two flat red slabs; add orange trim as a 1-cell line down both front edges and a shade-2 band at its hem; give the legs a real gap.
- GALE — keep the tunic's lit/shade split and the leg gap. Fix: the left dagger is a 14-cell beige plank; halve it, taper the blade, add a crossguard and a dark grip. No scarf and no forward lean exist — add both.
- TIDE — keep the orb. Fix: the robe is a bell; two 1-cell shade-1 fold lines from belt to hem and a 2-cell lighter panel on the lit side; hands must cradle the orb.
- BASALT — keep the armour ramp. Fix: helm wider than the shoulders — pauldrons 2 cells wider each side; the tower shield is a square door — round the lower corners, a 3×3 central boss, a bevel.
- SABLE — keep the lit eyes. Fix: the hood reads as a motorcycle helmet — a 2-cell peak and a cowl draping onto the shoulders, a cloak silhouette behind; grey shoulder pipes off-palette — re-tint to plum.
- LUMEN — keep the braid. Fix: the halo is a flat bar — an ellipse, 2 tones, back arc darker; the gold mantle is dithered noise — two shoulder plates with a clean edge.
- HOLLOW KING — keep the scale and the slit eyes. Fix: the ribcage is a radiator — curve the ribs down-and-out, shorter toward the pelvis; build the missing left arm; hooked claws on both.
- PALE SAINT — keep nothing yet. Fix: a refrigerator silhouette — flare the hem 4 cells, add arms and sleeves, shift the medallion off centre; a real eye cluster and a chin shadow.
- CINDER IMP — wings merge with the body: drop them two shades, a 1-cell dark gap.
- ASH HOUND — remove the two red flank dots; add ears and a shoulder/haunch break.
- CRYPT WARDEN — the lantern floats at the hip: attach it to a hand on a visible arm.
- DUST WRAITH — reads as a beetle: tatter the whole lower silhouette, fade the bottom 6 rows toward the ground tone.
- PYRE KNIGHT — the shield is a flat egg: a bevel, a boss, 4 rivets.
- BOG TOAD — curve the mouth; a lighter belly band.
- FROST WISP — a flying saucer at 17×19: grow to ~26 tall, a trailing wisp tail, cut the core brightness.
- MARSH HAG — the hair is a tan bonnet in the skin family: darken two steps and cool it; a hunch and a hooked profile.
- SILT CRAB — claws float, detached, steel grey: 2-cell arms, the brown ramp; round the carapace.
- FEN FIRE — an egg: cut 2–3 flame tongues into the top silhouette, a dark core.
- DROWNED KNIGHT — keep the water streaks. Fix: a broken/split shield, weed or barnacle notches.

## Animation
Attack reads (keep the travel). Cast acceptable. HURT does not read: replace the hop with a recoil — head back 1 cell, torso shifted 2 cells away from the hit, weapon arm dropped, a 1-frame white-out. DEAD does not read: author a real collapse to a wide low box ≈ 40 × 18, head below the shoulder line, the weapon dropped as a separate part on the ground. Only one idle frame exists: author idle B — torso 1 cell down, shoulders 1 cell in, hair/cape trailing 1 cell.

## Scene note (for the scene writer)
Each actor needs a 2-row elliptical contact shadow at ~40 % alpha, width ≈ 0.8× the foot span, hard-edged, 60 % directly under the feet. Keep the ground plane 15–20 % darker than the mid-field; hold everything within 12 cells of an actor low-saturation and low-detail; the fill light from the lower right in a cool tone; no bright backdrop element in the actors' horizontal band.


## The verifiable plan

| Step | Change | Check |
|---|---|---|
| 1 | Actors at ×2, heroes 52–60 cells | Hero height 13–17 % of the frame; 2-px cells; contrast ≥ 3:1 per sprite; wisps ≤ 6:1 |
| 2 | Critic round 2 on the redone cast, then round 3 | Blind critic score ≥ 7, then ≥ 8; every per-character line resolved |
| 3 | Diorama: DoF planes, light pool, contact shadows, shafts, bloom, grade | Side-by-side with the owner's reference frames; HIGH tier < 8 ms per frame |
| 4 | HUD restyle: vector font, thin plates, portraits in the ribbon, thin bars | HUD text ≤ 24 px; no opaque boxes; one screenshot per screen beside the reference |
| 5 | VFX under bloom: particle-based skill effects | One screenshot per skill family beside the reference effect frame |
| 6 | Full-frame critic: sprites, scene, UI, VFX, composition scored 1–10 against the references | Ship when every axis is ≥ 8 |

The owner's four reference frames (a desert ruin battle, a job-costume
sprite line-up, a bloomed water skill, a village with light shafts) are not
in the repository; they are described here and by the critic's notes.

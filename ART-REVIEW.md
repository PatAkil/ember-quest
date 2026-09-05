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

### Round 2 verdict: ONE MORE ROUND — 6/10 (from 4/10)

Resolved from round 1: contrast (all 19 ≥ 3:1 by mean; wisp 5.22, fen
fire 5.52 under the cap), non-black darks, hue-shifted shadows on cloth and
metal, hands on GALE, TIDE, SABLE and both knights, folds on TIDE, LUMEN,
the HAG and the WARDEN, most per-character fixes, the hurt white-out and
idle B. Two reasons it is not 8: the greyscale plate shows every actor as
one mid-value mass with no dark anchor and no cast shadow, so nothing reads
as lit form; and the bodies are still boxes with side-bar arms, with three
props unheld (BASALT's mace, LUMEN's bow, the HAG's staff).

**Global, round 3:**
1. Value hierarchy: every actor gets a dark anchor of ≥ 20 % of body pixels
   at L 25–32 (boots, belt, gloves, hood interior, under-hem, the shadow side
   of the skirt) and one 4–6 cell area at L 78–85 (collar, pauldron top,
   cuff); nothing stays a single 30-point band.
2. Self-shadow on every humanoid: a 2-row shade-2 band on the chest under
   the hair/chin mass; a 1-cell shade-1 seam down the torso where each arm
   overlaps; a 2-row shade-2 under every belt and hem.
3. Kill the box: narrow each torso 1 cell at the waist, drop the outer end
   of the shoulder top row 1 cell, merge floating shoulder blocks (EMBER,
   GALE, LUMEN) into the torso with a 1-cell seam instead of a gap.
4. Props held: each haft overlaps the hand block by ≥ 2 cells with two
   shade-2 finger notches across it — GALE is the model; fix BASALT, LUMEN
   (bow inward, string outside the head), the HAG (mirror the staff).
5. Hand construction: 3 wide × 4 tall, joined by a 1-cell wrist in the
   sleeve tone, outer edge one shade darker, two finger notches — no 4×4
   slab with a stray dot.
6. Faces: sclera 1 cell, spacing ±1 and brow angle per character; replace
   the black tooth fringe (TIDE, WARDEN, HAG) with a 2-row shade-2 hem band
   and an uneven 2-3-2 scallop.

**Per character, round 3:** EMBER two vertical folds and a hem on the vest,
close the forearm gap · GALE halve the left blade, darken its spine, add
the scarf and the lean · TIDE slope the shoulder plank into shoulders ·
BASALT connect the mace haft, a V hem and folds on the tabard · SABLE a
6-cell visor slot, cowl onto the shoulders · LUMEN a 2-tone halo ellipse,
bowstring off the face · HOLLOW KING curved ribs shortening to the pelvis,
a sternum · PALE SAINT flare the hem 4 cells, break the cape's symmetry ·
CINDER IMP wings two shades down with a dark gap · ASH HOUND ears, shade-1
breaks at shoulder and haunch · CRYPT WARDEN drop the BASALT brow bar and
rivets · DUST WRAITH fade the bottom 4 rows, three uneven notches · PYRE
KNIGHT a bevelled shield edge and four rivets · BOG TOAD a crease eye-to-hip
and a back highlight · FROST WISP a mid-cyan ring in the core · MARSH HAG
drop the shoulder 2 cells, hook the profile · SILT CRAB a carapace seam and
eyestalks · FEN FIRE raise the core two steps, offset low-left · DROWNED
KNIGHT one socket pair plus two streaks.

**Animation:** idle A/B needs follow-through (hair, hem and flame are
identical between frames); hurt must move the torso 2 cells off the hit and
the tilted head must be re-authored, not rotated (broken keylines); dead is
a rotated standing sprite — redraw it with buckled knees, a folded torso,
the head below the idle shoulder row, the face down-turned, the weapon a
separate part on the ground.

**Ship criteria (the critic's bar for SHIP):**
1. Greyscale: every actor spans L 15–85, ≥ 20 % of body pixels below L 35,
   ≥ 8 % above L 75.
2. Zero floating props; every haft overlaps a hand ≥ 2 cells with notches.
3. Every humanoid carries the chin cast shadow and the under-arm seams.
4. Nineteen silhouettes distinguishable with the fill removed; no shared
   helm construction.
5. The death frame: no rotated face, head below the idle shoulder row,
   weapon detached.
6. Mean contrast ≥ 3:1 with ≤ 45 % of body pixels below 3:1 (now 44–66 %).

### Round 3 (2026-09-05): what the artist changed

Six-step material ramps under a bimodal contrast law (steps 0–1 are the only
tones allowed under 3:1 against the stage; every other step is lifted until it
clears 3.2:1), authored dark anchors (collars, belts with deep seams, hem
bands, boots, gloves, hood interiors, the shadow side of every skirt) and
authored light ends; asymmetric arms with 3×4 hands, wrists and finger
notches, a fingers layer painted over every haft, weapons authored on a
diagonal across the body; staggered stance rows, narrowed waists, the chin
cast shadow and under-arm seams on every humanoid, both bosses included;
faces at 13 cells inside a 23-cell head with sclera and a per-character brow;
MARSH_HAG on her own hunched body; `LayerKeyframe.part` overrides for sheared
idle and hurt heads, and authored `fallenBody` / `fallenHead` collapses with
the weapon dropped by a solver. The sheets and numbers now come from
`node tools/capture.mjs sheets` (tools/out/); from round 4 on `metrics.md`
measures CIE L* rather than HSL lightness, reports the interior share below
L 35 with the one-cell keyline excluded, and the top-quarter vs bottom-quarter
lightness delta — the three measures this round's critic used to catch a
passing table that did not read.

### Round 3 verdict: ONE MORE ROUND — 7/10 (from 6/10)

Round 2's first reason is genuinely fixed: the greyscale plate is no longer one mid-value mass. On the twelve large actors the dark anchor is real interior mass, not keyline (interior-only below-L35, excluding the 1-cell outline: EMBER 33.8 %, PYRE 33.9 %, DUST_WRAITH 33.3 %, SABLE 28.8 %, PALE_SAINT 22.6 %), and the highlight is a real lit area, not a rim line (largest contiguous interior blob 19–111 cells, bar was 4–6). Hands with wrists and finger notches now grip on GALE, SABLE, MARSH_HAG, CRYPT_WARDEN and both spear knights; faces on EMBER, GALE, LUMEN and PALE_SAINT carry sclera, brow, nose and a chin shadow; folds, hem bands, belts and boots are everywhere; and the twelve large actors have a genuinely re-authored death (93–98 % pixel difference from idle after best alignment — not a rotation). It is not at the bar for two reasons, both visible in one glance at the sheets. **First, seven of the nineteen are not animated at all**: in `poses-ASH_HOUND/DUST_WRAITH/BOG_TOAD/FROST_WISP/SILT_CRAB/FEN_FIRE/CINDER_IMP.png` the attack frame is pixel-identical to idle (0.0 % diff), the hurt frame is pixel-identical to idle, and the death frame is the standing idle sprite clipped by the ground line (0.8–4.8 % diff) — criterion 5 fails outright for 37 % of the cast. **Second, the armoured figures are one sprite in three palettes**: at ×6 BASALT, PYRE_KNIGHT and DROWNED_KNIGHT share an identical 2×3 torso panel grid, the same belt-strap row, the same rounded-rect shield with the same boss at the same offset, and the same haft angle (shape-IoU 86.2 % BASALT↔DROWNED, 82.9 % PYRE↔DROWNED, 79.0 % BASALT↔PYRE), with CRYPT_WARDEN on the same torso-and-legs chassis. Underneath both sits the thing that most separates this line-up from octopath-1: not one of the nineteen carries a weight shift. Every humanoid stands square-on with both feet at the same row, both shoulders at the same row and the head centred — Octopath's line-up is contrapposto, turned shoulders and a cell of head turn on every job.

**Global, round 4:**
1. **Stance, on all twelve humanoids.** Drop the weight-bearing hip 1 cell and raise the other; shift the pelvis 1 cell toward the weight leg; push the weapon-side shoulder 2 cells forward (that side 2 cells wider, the far shoulder top row 1 cell lower); shift the head 1 cell toward the weapon side so the far eye sits 1 cell from the silhouette edge instead of centred. No figure may keep both boot rows level and both shoulder rows level.
2. **Break the knight chassis into three silhouette classes.** BASALT wide and short — pauldrons 3 cells past the hip line, a full-height kite shield reaching the knee. PYRE_KNIGHT tall and narrow — no shield, a two-handed polearm crossing the body at 60°, a tabard hem to mid-shin. DROWNED_KNIGHT hunched — head 2 cells forward of the chest, shoulder row 2 cells below BASALT's, a torn cloak breaking the right edge. Retire the shared panel grid: give each a different plate count and strap direction.
3. **Animate the seven creatures.** Each needs an attack frame with ≥ 6 cells of travel on the striking part (jaw, claw, core), a hurt frame with the mass shifted 2 cells off the hit and the eye row 1 cell back, and a real collapse: body height ≤ 55 % of the idle height, the top of the mass below the idle mid-line, legs folded or splayed. Sinking the idle sprite through the floor is not a death frame.
4. **Fix the four figures that are flat or bottom-lit** (top-quarter mean L vs bottom-quarter, measured on `lineup-x2.png`): SABLE 44.5 / 46.5, MARSH_HAG 53.3 / 54.8, HOLLOW_KING 59.4 / 58.4, CRYPT_WARDEN 53.9 / 50.1. Put the top quarter ≥ 12 L above the bottom: lighten the hood/helm crown and the outer shoulder 2 steps, drop the bottom 4 rows of the skirt/hem 2 steps.
5. **Real interior darks on the small creatures.** `metrics.md` measured HSL lightness; in CIE L\* on the same rendered sheet, BOG_TOAD is 18.0 % below L35, FROST_WISP 17.9 %, FEN_FIRE 13.1 % — under the 20 % bar — and excluding the 1-cell keyline, 13.9 / 7.4 / 7.8 % (ASH_HOUND 12.8 %). Their anchor is the outline plus saturated green and cyan that the metric scored as dark. Add a 3-row shade-2 underside band on the hound, toad and crab and a dark core on both wisps, then re-check in L\*.
6. **Pull the cast into one key.** The crimson shields, the pure-green hag robe, the magenta cloak and the cyan hair run 2–3× the chroma of anything in octopath-1. Cut saturation ~25 % on every garment midtone; keep full chroma only for light sources (TIDE's orb, the lantern, PYRE's flame, the wisp cores) and one accent per character.
7. **Matched boots.** EMBER, GALE, LUMEN and MARSH_HAG each have one dark-brown boot and one pale-tan boot — that reads as an error, not a lit leg. Same ramp on both, far boot one step darker.
8. **Merge the floating shoulder caps** on EMBER and LUMEN (round-2 item 3, unfixed): the light cap is still separated from the garment by a 1-cell dark gap. Replace the gap with a 1-cell shade-1 seam.

**Per character, round 4:** EMBER — shoulder caps float, the staff carries a cream blob where a 3×4 hand with a wrist belongs, mismatched boots · TIDE — no arms at all; in `poses-TIDE.png` attack 1 the orb translates across the robe with nothing attached; build two sleeves from the plank down to a cupped pair under the orb, slope the plank ends 2 cells into shoulders, replace the even comb hem with an uneven 2-3-2 scallop · BASALT — the mace is gripped directly under its head with the whole haft dangling across the shield; move the gauntlet to the bottom third and cut the haft above it to 4 cells; the helm slit's six white dots read as teeth, make it one continuous slit · SABLE — bottom-lit; the cowl still ends in a hard curve instead of draping onto the shoulders; the visor is a full-width dark band that reads as sunglasses, cut it to 6 cells with a 2-cell bridge · LUMEN — the bow stave sits beside the glove rather than through it, and the second diagonal limb across the chest is clutter · CRYPT_WARDEN — best helm in the cast, but value-flat top to bottom (+3.8 L) · HOLLOW_KING — the ribcage is still the radiator from round 1: seven straight parallel bars of equal length; curve each rib down-and-out, shorten by 2 cells per pair toward the pelvis, sternum 1 cell proud; the arms are 4-strip bundles that read as brooms; the dead frame introduces a large brown mass that exists nowhere in the standing sprite · PALE_SAINT — the silhouette is still a rectangle in `lineup-x2-sil.png`: flare the hem 4 cells, drop the right cape lining 3 cells below the left, shift the medallion 2 cells off centre · MARSH_HAG — the face is a blank olive oval with two single-pixel eyes; add sclera, a brow, a 2-cell hooked nose breaking the profile, a chin shadow; bottom-lit · PYRE_KNIGHT — the head reads as a bare flesh dome with a moustache and a flame growing out of the skull, not a helm · DROWNED_KNIGHT — the helm's three vertical bars read as an insect face; break the crown's top edge with two missing cells · CINDER_IMP — head fused to the torso with no neck, reads as a red box with horns · ASH_HOUND — four identical straight leg bars with no joint or haunch break; belly the same value as the back · DUST_WRAITH — one uniform mass with a single rim line; 9.0 % above L75, the lowest in the cast, and it is one edge · BOG_TOAD — the lavender rectangle mid-belly is off-palette and reads as a label · FROST_WISP — still a lamp on a stick; give it a torn trailing tail and a dark core · SILT_CRAB — flat carapace with no dome shading, arms 1 cell · FEN_FIRE — still an egg with two horizontal white bands; cut 3 uneven tongues into the top silhouette and put the dark core low-left.

**Animation:** Seven actors have no animation at all — CINDER_IMP, ASH_HOUND, DUST_WRAITH, BOG_TOAD, FROST_WISP, SILT_CRAB, FEN_FIRE: attack frame 1 is 0.0 % different from idle frame 0, hurt frame 1 is 0.0 % different, idle frame 2 is 0.0 % different from idle frame 0, and dead frame 0 is 0.8–4.8 % different (the idle sprite clipped at the ground). The hurt row leans entirely on the white-out: on PYRE_KNIGHT and DROWNED_KNIGHT the recoil frames differ from idle by only 23–26 %, and most of that is translation — the head does not go back and the torso does not clear the hit. Idle follow-through still does not read: on the heroes the change between idle frames is a body bob plus a small prop shift; the hair mass, hem edge and cape outline are the same shape frame to frame, which is exactly the round-2 note. And the death is one template across all twelve animated actors — head at the left on the ground, a wedge body rising to the right, the prop detached at the right — so nineteen characters die in one silhouette. Attack travel and cast read fine on the twelve.

**Ship criteria check:**
1. **FAIL (partial).** `metrics.md` showed all 19 passing, but the read fails on two counts. In `lineup-x2-grey.png` SABLE, MARSH_HAG, HOLLOW_KING and CRYPT_WARDEN do not read as lit form — their top quarter is within ±4 L of, or darker than, their bottom quarter. And the metric's L was HSL lightness: in CIE L\* on the same sheet BOG_TOAD (18.0 %), FROST_WISP (17.9 %) and FEN_FIRE (13.1 %) fall under the 20 % dark bar, and excluding the keyline ASH_HOUND drops to 12.8 %, FROST_WISP 7.4 %, FEN_FIRE 7.8 %. Highlights are honest — every actor has a contiguous interior bright blob of 11–111 cells, not a rim line — though on TIDE, LUMEN, CRYPT_WARDEN and PALE_SAINT that blob is a glowing prop or a white garment rather than a key-light plane.
2. **FAIL — TIDE only.** Every other haft, orb and shield is held: BASALT's gauntlet is on the mace haft, LUMEN's glove is at the bow, MARSH_HAG's staff carries a notched hand at chest height, PALE_SAINT's orb sits in a cupped hand. TIDE has no arms at all and its orb translates freely across the robe in `poses-TIDE.png` attack 0–1.
3. **PASS.** Chin cast shadow present on all twelve humanoids (clearest on EMBER, TIDE, PALE_SAINT, CRYPT_WARDEN in the ×4 crops), under-arm seams present throughout — though on EMBER and LUMEN the separation is still a gap rather than the 1-cell seam round 2 asked for.
4. **FAIL.** `lineup-x2-sil.png`: BASALT, PYRE_KNIGHT and DROWNED_KNIGHT are one body build (shape-IoU 86.2 / 82.9 / 79.0 %) with CRYPT_WARDEN on the same torso and legs. A second family — TIDE, SABLE, MARSH_HAG, DUST_WRAITH, PALE_SAINT — is a shared bell with no arms in the outline (77–85 %). PALE_SAINT is a plain rectangle. Helms are now differentiated at the head (CRYPT_WARDEN's flat bucket, PYRE's flame, DROWNED's holes, BASALT's slit), but the bodies under them are not.
5. **FAIL.** Passes on the twelve large actors — no rotated face, head below the idle shoulder row, weapon detached as a separate part (93–98 % different from idle). Fails on seven: CINDER_IMP, ASH_HOUND, DUST_WRAITH, BOG_TOAD, FROST_WISP, SILT_CRAB and FEN_FIRE die as their standing idle sprite.
6. **PASS.** `metrics.md`: mean contrast 3.48 (DUST_WRAITH) to 5.54 (FROST_WISP), all ≥ 3:1; below-3:1 share 22.4–43.2 %, all under 45 %; the glowing pair capped at 5.54 and 5.44, under 6:1.

# Aswang Night: what is built, and what is next

Updated 2026-11-24 (map and bug pass). The design is `DESIGN_PROPOSAL.md` (direction B, the vigil) with a loot-and-level
loop added on top, as Keith asked. This file tracks the state of the build.

## The game in one paragraph

Five nights guarding your pregnant sister's house in a 1950s Visayan barrio. By day you gather, trade
and prepare; at dusk you protect the house's openings; at night you guard it, and an errand forces you
away from it. One neighbour is the aswang. Each night ends at cockcrow with an account of what held
and what did not. Rosing's strength (three points) carries over: at none, the game is lost.

## What is in the game now

| Area | State |
| --- | --- |
| Map | A planned barrio (four houses with yards, a plaza round the well, paths, groves, treeline), a trail east, and the old sitio with the hilot's house and three empty ones |
| Day and night | Day (2 to 3 minutes), dusk, night (4 to 6 minutes), cockcrow report, five nights, three endings plus a losing one |
| The house | Door and two windows take salt or garlic (hold G); each protection holds once. A smudge fire's smoke guards the roof. Three breaches in all and Rosing is lost |
| Errands | Night 1 water from the well. Night 2 the albularyo's oil. Night 3 call the hilot along the trail. Night 4 tobacco for the kapre and find the legs. Night 5 salt the legs before cockcrow |
| Aswang (on foot, nights 1 and 3) | Waits outside the light, tries one opening at a time, draws off when you bring the lamp to her, hunts you if you are far from the house or in the dark |
| Manananggal (nights 2, 4, 5) | Settles on the roof unless smoke stops her; striking the house post drives her off and brings her down on you; dives at your lamp away from the house; ended by salting her lower half |
| Tikbalang (trail, night 3 on) | Does not kill. The trail loops until you turn your shirt inside out (hold T) |
| Kapre | A three-metre giant standing in the balete's roots after dark, lit by his cigar. Run under the tree and he roars and blows out your lamp; leave tobacco at his feet and on the last night his ember shows where the legs are |
| Sigbin (night 5) | Her hound, let out 40 seconds into the last night. It walks backwards toward your lit lamp and drinks your shadow: five seconds of that and you go down. Shutter the lamp (F) and it loses you; it will not step over salt; the whip drives it off |
| Nang Pacing | Walks the barrio by day, visits each morning, makes her offer on day 3 |
| The hilot | Stands in her yard by day and watches you come up the path. After dark she keeps indoors; on night 3 she opens her door to your call and answers from the threshold, nodding as she speaks |
| Balance | `game/scripts/duel.mjs` plays a fight (the amalanhig, or `--foe=dog` / `--foe=crawler`) four ways (standing, backing off, stepping aside, running with no whip) and reports the result; the numbers live in `WHIP` and `AMALANHIG` in data.ts. As tuned: standing and trading costs a grab now and then, stepping aside wins clean in 12-20 s, running at once gets away. Dogs: a careless fight costs 3-4 bites, backing off 0-1. Crawler: backing off with the lamp lit wins clean, in the dark it is a losing fight |
| Feel and settings | A blow on a creature stops the world for 0.06 s (0.12 s on the last blow) and flashes the one struck; being hurt stops it for 0.08 s. The screen shake eases in and out instead of jittering. The pause menu sets screen shake (full / half / off), flashes (full / reduced), the volume of the effects and of the night's sounds, and the resolution (auto: drawn at fewer pixels while the frame rate is under 50, sharpening again at 58; or full). Every panel works from the keyboard: arrows move, Enter chooses |
| Tools | `scripts/hitch.mjs` finds slow frames and says whether a shader was compiled at that moment; `scripts/soak.mjs` plays minutes of a night in real time and looks for memory and object growth; `scripts/economy.mjs` adds up coins in and out against targets; `scripts/prodfps.mjs` measures a production build. Bugs are kept in `docs/BUGS.md`; `docs/PLAYTEST.md` is the form for a hand-played session |
| Health | You have 100 (Hardy perk: +25 a rank; a thick-skin charm turns some harm aside). Bites and grabs take it; at 0 you go down and the night is lost. Hold H to eat a bundle of herbs (+30); it is full again each morning. The aswang's and manananggal's grabs and the sigbin's drained shadow still end the night outright. Creatures that can be hurt show a bar over them once struck |
| The aswang's kin (night 2 on) | Dead dogs in pairs in the north and west fields, and a crawler (a man gone on all fours) to the east from night 3. They come out 25 s after dusk, wander, and go for you within 9 m (dogs) or 7 m (crawler), less if your lamp is shuttered. A bite takes 10 (dog) or 20 (crawler); then they draw off and come again. They give up once you are 13 m (dog) or 12 m (crawler) ahead, or 18 m / 16 m from where they took up the chase, so running gets away. Salt stops them. The whip lays a dog down in 2 blows and a crawler in 3, but in the dark a crawler shrugs off three quarters of a blow. Each leaves coins, a trophy (fangs, nails) and experience. How many come out a night: 2 dogs on night 2, then 2+1, 3+1, 4+2 |
| The kin in human guise (night 3 on) | A farmer (night 3), a priest (night 4), a nurse then the farmer again (night 5), one at a time, walking the paths of the barrio like neighbours out late. Within 7 m they stop and watch you. While the face holds your blows do nothing to them. Hold up garlic (G) within 4.5 m (the braid is not spent) and it reels for 2.2 s, glowing: now it is kin and can be hurt. Strike it first, or let it within 2.4 m with the face on, and it drops the face and strikes first. Farmer 90 health, blow 18; priest 100, 22, slow; nurse 70, 14, quick. They give up like the others (13 m ahead, 18 m from where they took up the chase). Each leaves coins and a black stone. Kadyo's work for them on nights 3, 4 and 5. Tuned with `duel.mjs --foe=farmer|priest|nurse`: garlic first and backing off wins clean, standing costs two to four blows, walking up bare to the priest can end the night |
| The bench | Beside Rosing's house, by day (E). Itak (15 c, 2 kindling, a fang): V strikes what is close in front, 45 a blow, every 1.1 s, for some breath. Salt pouch (2 salt, a herb): Z throws it, what is in front reels 2.5 s (the aswang and the sigbin are driven off). Garlic string (3 garlic): turns the next bite or grab aside. Bamboo bars on a window (4 kindling, 4 c): its protection holds once more each night. Barbs for the whip (3 fangs, 2 herbs): a third more a blow. A longer lash (2 nails, 6 c): a metre more reach. Charms bound with a fang or a nail come out better than Kadyo's plain ones. Sibat (the itak on a pole; 3 kindling, a black stone, needs the itak): V reaches 1.1 m further. Smudge bundle (2 herbs, a kindling): X, 30 s of smoke in which the kin lose you and the manananggal will not dive. Strong oil (2 oil, a herb, a nail): goes in the lamp at dusk, burns the whole night without using oil and lights half as far again. Bells on the fence (8 c, 2 fangs): ring when the house is tried while you are more than 10 m from it. Stake fence (4 kindling, 5 c, a nail): nine panels round the yard; the aswang takes a third longer at each opening |
| Hunter perks | Mangangayam gains Keen edge (whip and itak 15% more a rank) and Skinner (25% a rank for a second trophy) |
| Favours (by day) | Each is asked once, accepted or refused, and lapses at dusk. Rosing (days 2-5, at the door): water from the well, two bundles of kindling, herbs for tea; done, she gains a point of strength. Nong Kadyo (from day 2, after his talk): five bundles of herbs for 12 c, experience and his trust. The hilot (from day 3, in her yard): her mother's rosary from the empty house east of hers, for a strong charm and herbs. Nang Pacing (from day 2, once): a strand of Rosing's hair for 20 c; that night something has hold of Rosing and she starts a point weaker. The goal card lists what is taken |
| Old tales | Eight pages, one for each creature, found in chests and jars (55% while any are left). Each gives experience and goes in the bag, under the charms, with what the creature fears |
| Nong Kadyo's work | From day 2 his trade opens with work for the coming night (lay down 2 dogs, a crawler...). Take it, do it, and he pays coins and experience the next day. Work not done by morning lapses. The goal card shows how it goes |
| Amalanhig (old sitio graveyard, every night) | Two lie under the crosses and rise stiff as planks when you come within 8 m after dark. Slow to turn, a little faster than you walk (1.9 m/s), and it works its way round houses and trees; a salt line stops them; a grab takes 40 health, throws you clear and leaves you a 1.4 s head start. Get 14 m ahead and it gives up. Three whip blows (34 each against its 100, every 4 s, each throwing it 2 m) lay one down till morning and drop coins, herbs and sometimes a charm. Nong Kadyo warns of them on day 3 |
| Nong Kadyo | Stands at the foot of his ladder day and night with his stick and lamp; turns his head to watch you, leans in and nods when he speaks; his lamp glows after dark. Advice each day, trade, charms, a tonic for Rosing, the whip |
| Loot | 20 places to search (chests, jars, sacks, fronds, herbs), refilled each day and each night; the old sitio is richer |
| Bag and learning | Seven supplies with a carry limit, charms with four rarities (wear two), levels, nine perks on three paths |
| Proofs | The salted door, the boiling oil, the patadyong. All three and Kadyo's trust open the third ending |
| Sound | All made in the browser, no files: crickets, wind, steps, the tiktik (loud when far, faint when near), heartbeat, scratching, shrieks, a rooster |
| Screens | Title, pause, bag, trade, dialogue with a typewriter and letterbox, a card naming each day and night, cockcrow report, endings. Progress saved at each dusk and morning |
| Guidance | A card that always says what to do next, an arrow to where it is (with distance), soft rings under things you can use, key-cap prompts with a hold ring, and the house's four openings shown top-left, turning red when one is attacked |
| Look | Two bundled typefaces (Cinzel, Cormorant Garamond), line icons drawn in code, film grain, a vignette that reddens with danger, a camera that draws back when she is on the roof |
| Houses | The gallery hut was open at the front. `tools/blender/fit_hut.py` gives it a front wall, doorway, woven door, a propped shutter at the front and on each side, and a ladder to the porch, all made from the hut's own wall and post pieces. Doors and shutters stand open by day, close at nightfall where people live, and hang loose in the empty houses; lamplight shows through after dark. Garlic hangs on the frame it protects |
| Ground and plants | The ground is one painted surface: worn earth with ragged edges where people walk, damp dark soil under trees and houses, and shadows that fall to the south-east. Grass grows in swaying clumps; the edge of the map is a wall of broad-leaved undergrowth |
| Dressing | Gallery models placed by hand: stone crosses and bare trees in the old sitio; root stumps, mossy logs and boulders at the forest edge; stools, baskets, flower beds, water jars, firewood, rain barrels, straw and a cooking fire at lived-in houses; wheelbarrows left about; roosters by day (they roost at night); a stone-ringed fire for the smudge fire. Credited in `CREDITS.md` |
| Night | Fireflies (thick about the balete), mist lying in the low ground, warm light spilling from lit windows, a firmer moon |
| Motion | Walking and running clips play at the rate that matches real speed (each clip's foot speed is measured once), so feet do not slide; the lantern swings on its handle |
| Comfort | A loading bar on the title; the world stops while the bag, the trade or the pause is open; a house or tree between the camera and you thins to a screen of dots instead of hiding you |

## Not built yet

- **Models still missing:** none of the speaking characters.
- **A few things are still built in code:** the trail marker, the undergrowth and the grass. They are
  shaped and shaded to sit with the models, but they are not models. The gallery had no usable banana
  plant, bamboo, rice mortar, carabao, second house type or period scarecrow, and its human figures are
  built from photographs of real people, so none were used.
- **Real sound:** everything is synthesized. Recorded night ambience and voices would lift it a great deal.
- **Balance:** the numbers come from scripted test runs, not from people playing.
- **The opening walk-in**, a title-screen settings page, and quality levels.

## How it was tested

Three tools, all in `game/scripts/` and all needing the dev server running.

`npm run selftest` plays all five nights by script in a
headless browser and checks 76 things: movement, every item, every errand, each creature's rule,
trade, charms, levels, saving, the endings and losing. `npm run shots` photographs the main screens
into `game/shots/`. Both run on the real graphics card and reported 45 to 80 frames a second.

`node scripts/play.mjs` plays the first day and night in real time with real key presses and takes
pictures as it goes. It found what the stepped test could not: a black screen at the start, the
aswang stuck against a wall for the rest of a night, a house hiding the player, creatures that kept
moving while the bag was open. All four are fixed.

`node scripts/frames.mjs` stands in a dozen places by day and night and reports frames per second
and the longest single frame.

What none of this covers: nobody has played it by hand, so difficulty and feel are a first guess,
and the sound (all synthesized) has not been listened to.

## How it is built

- Browser: Vite, React, three.js through React Three Fiber, zustand. In `game/`.
- `layout.ts` is the map as data. `data.ts` is items, loot, charms and perks. `story.ts` is the nights
  and every line of speech. `state.ts` is the game state and saving. `interact.ts` is everything you
  can do by standing next to something.
- Rendering budget seen in tests: 140 to 220 thousand triangles and 20 to 56 draw calls per frame.
  Grass and undergrowth are drawn in squares of ground so that off-screen squares are skipped.

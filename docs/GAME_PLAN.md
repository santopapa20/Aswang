# Aswang Night: what is built, and what is next

Updated 2026-11-23. The design is `DESIGN_PROPOSAL.md` (direction B, the vigil) with a loot-and-level
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
| Nang Pacing | Walks the barrio by day, visits each morning, makes her offer on day 3 |
| Nong Kadyo | Heard at his door (no model yet): advice each day, trade, charms, a tonic for Rosing, the whip |
| Loot | 20 places to search (chests, jars, sacks, fronds, herbs), refilled each day and each night; the old sitio is richer |
| Bag and learning | Seven supplies with a carry limit, charms with four rarities (wear two), levels, nine perks on three paths |
| Proofs | The salted door, the boiling oil, the patadyong. All three and Kadyo's trust open the third ending |
| Sound | All made in the browser, no files: crickets, wind, steps, the tiktik (loud when far, faint when near), heartbeat, scratching, shrieks, a rooster |
| Screens | Title, pause, bag, trade, dialogue with a typewriter and letterbox, a card naming each day and night, cockcrow report, endings. Progress saved at each dusk and morning |
| Guidance | A card that always says what to do next, an arrow to where it is (with distance), soft rings under things you can use, key-cap prompts with a hold ring, and the house's four openings shown top-left, turning red when one is attacked |
| Look | Two bundled typefaces (Cinzel, Cormorant Garamond), line icons drawn in code, film grain, a vignette that reddens with danger, a camera that draws back when she is on the roof |

## Not built yet

- **The amalanhig** (the enemy you can fight and loot). Needs a model, so there is no combat beyond the whip.
- **Models still missing:** Nong Kadyo, the hilot and the sigbin. Kadyo and the hilot are voices at a
  door for now.
- **A few props are still stand-ins:** the fire pit and the trail marker are simple shapes built in
  code. Chests, pots, sacks, firewood, herbs, shrubs, ferns and rock piles are gallery models
  (`assets/props/`, credited in `CREDITS.md`).
- **Real sound:** everything is synthesized. Recorded night ambience and voices would lift it a great deal.
- **Balance:** the numbers come from scripted test runs, not from people playing.
- **The opening walk-in**, a title-screen settings page, and quality levels.

## How it was tested

`npm run selftest` (in `game/`, with the dev server running) plays all five nights by script in a
headless browser and checks 68 things: movement, every item, every errand, each creature's rule,
trade, charms, levels, saving, the endings and losing. `npm run shots` photographs the main screens
into `game/shots/`. Both run on the real graphics card and reported 45 to 80 frames a second.

What that does not cover: nobody has played it by hand, so difficulty and feel are a first guess,
and the sound (all synthesized) has not been listened to.

## How it is built

- Browser: Vite, React, three.js through React Three Fiber, zustand. In `game/`.
- `layout.ts` is the map as data. `data.ts` is items, loot, charms and perks. `story.ts` is the nights
  and every line of speech. `state.ts` is the game state and saving. `interact.ts` is everything you
  can do by standing next to something.
- Rendering budget seen in tests: 140 to 220 thousand triangles and 20 to 56 draw calls per frame.
  Grass and undergrowth are drawn in squares of ground so that off-screen squares are skipped.

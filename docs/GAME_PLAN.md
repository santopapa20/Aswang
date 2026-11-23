# Aswang Night: whole-game plan

Written 2026-11-23. This is the working plan; change it when decisions change.

## The game in one paragraph

A top-down 3D survival horror game in a remote Visayan barrio in the 1950s. You are a young
villager with a kerosene lamp. Each day you prepare; each night creatures from Philippine folklore
hunt you and you must live until sunrise. Every creature is beaten the way the old stories say, so
the game teaches the folklore through play. Five nights, each adding a new threat.

## Core loop

1. **Day (about 2 minutes).** Walk the barrio. Gather salt, garlic, lamp oil and holy items. Talk to
   villagers for rumours about tonight's creature. Decide where to make your stand and prepare it
   (salt lines at doorways, garlic at windows).
2. **Dusk.** A short warning: church bell, villagers go indoors, the light turns.
3. **Night (3 to 5 minutes).** Survive. Move, hide, use your counters. Light attracts some
   creatures and repels others; noise carries.
4. **Sunrise.** Night survived. A short tally (what hunted you, what you used), then the next day.

Lose when caught. Restart from the morning of that day.

## The five nights

| Night | New threat | What it teaches |
| --- | --- | --- |
| 1 | Aswang | Noise and distance; salt lines and garlic at doorways |
| 2 | Manananggal | Look up; find her lower half and salt it |
| 3 | Tikbalang (and the wakwak's call begins) | Reversed controls; turn your shirt inside out |
| 4 | Kapre and sigbin | Respect territory; watch what walks backwards |
| 5 | All of them | Everything together, a longer night |

## Creatures and their counters

| Creature | Behaviour | Counter | Status |
| --- | --- | --- | --- |
| Aswang | Wanders, notices noise, screams, chases, strikes. By day she is a normal villager | Cannot cross a salt line; garlic drives her back | Model and animation done, hunting works |
| Manananggal | Flies over fences and huts, dives at you. Her lower half stands hidden somewhere | Salt on the lower half ends her for the night; she must return before dawn | Prompts written, model not generated |
| Wakwak | Mostly heard, rarely seen. Its call is LOUD when far and quiet when close | Listen: when the call goes quiet, get indoors | Not started. Mainly sound plus a small flying shape |
| Tikbalang | Tall, horse-headed. Near it your controls flip and paths loop | Turn your shirt inside out (hold a key for 2 seconds) | Not started |
| Kapre | A giant smoking in the balete tree. Harmless unless you enter its yard | Stay out of the glowing-ember range; go around | Not started |
| Sigbin | Low, walks backwards, drains you if it reaches your shadow | Keep your lamp between you and it; it avoids light | Not started |

## The player

- Moves: walk, run (noisy, uses stamina), sneak (quiet, slow).
- Lamp: your light and your risk. Oil runs down at night; refill from oil found by day. Can be
  shuttered (dark, quiet) at the cost of seeing little.
- Carries: salt (lines and throws), garlic (worn or hung), holy water (one-use stun), a rosary
  (steadies your nerve, see below), a bolo (cuts bamboo for barricades by day, not a weapon).
- Nerve: standing near creatures or in the dark with no lamp raises fear, which shakes the camera
  and makes you louder. Calms indoors behind salt.

## The map

One barrio, about 70 by 70 metres:

- Three or four bahay kubo, one of which is yours (the safe house).
- A small stone chapel with a bell (holy ground: creatures slow down near it).
- A balete tree (the kapre's home) at the edge.
- A well, a coconut grove, banana trees, a bamboo thicket, a rice paddy edge, a dirt path.
- Fences, carts, pots, drying racks: cover that breaks line of sight.

## Screens and sound

- Title screen, pause, night tally, settings with three quality levels (important for Intel UHD:
  shadows off / lamp shadows / lamp shadows plus better fog).
- Sound does half the work in horror: night insects, wind in palms, footsteps by surface, the
  lamp's hiss, the wakwak's call, the aswang's scream, a church bell. Free CC0 sounds.
- Progress saved in the browser (which night you reached, settings).

## How it is built

- Browser: Vite, React, three.js through React Three Fiber, zustand for state. In `game/`.
- Characters: Tripo model, Blender scripts, Mixamo motion, one `.glb` per character with named clips.
- Budget per frame on Intel UHD: under about 400,000 triangles on screen, one shadow-casting
  light (the lamp), characters 45,000 triangles, props 2,000 to 20,000.
- Published as a static site, linked from the portfolio.

## Milestones

| | Milestone | Done when |
| --- | --- | --- |
| M0 | Night scene | Player, aswang chase, hut, fence, sunrise. **Done** |
| M1 | Counters | Pick up salt and garlic; salt lines stop the aswang; garlic repels; lamp oil |
| M2 | Manananggal | She flies, dives, and can be ended by salting her lower half |
| M3 | The barrio | Real trees, chapel, well, props; your house as a safe house with doorways |
| M4 | Day and night cycle | Day phase with gathering, dusk, five-night progression, saving |
| M5 | The other four | Tikbalang, kapre, sigbin, wakwak with their counters |
| M6 | Sound and screens | Audio, title, pause, tally, settings, quality levels |
| M7 | Polish and publish | Balance, performance pass, credits page, deployed link |

## Assets

Tripo costs: about 55 to 60 credits to generate a textured model, 5 to export one from the gallery.

### To generate (unique, nobody else has them)

| Asset | Notes | Credits |
| --- | --- | --- |
| Manananggal, winged upper body | Prompts in `assets/manananggal/PROMPTS.md`. Wings rigged by script | 60 |
| Aswang, human guise | The same woman by day: tidy hair, clean baro and patadyong, normal hands | 60 |
| Tikbalang | Tall, thin, horse head, long limbs, human-shaped enough for Mixamo | 60 |
| Kapre | Huge hairy giant, seated pose option, cigar separate | 60 |
| Sigbin | Low hound-like creature, long ears, hind legs longer than front | 60 |
| Wakwak | Bat-bird with ragged wings; seen small and briefly | 60 |
| Villagers, 2 or 3 | Old man, woman, child, for the day phase | 120 to 180 |
| Chapel | Small weathered stone chapel with a bell, if the gallery has no good one | 60 |
| Balete tree | Large strangler fig with hanging roots, if the gallery has no good one | 60 |

About 600 to 720 credits, plus a reserve for regenerating ones that come out badly.

### To take from Tripo's gallery (5 credits each)

Scenery: coconut palms, banana trees, bamboo clumps, a stone well, a wooden cart, clay pots, rocks,
a bench, a drying rack, a closed bahay kubo, a chapel and a balete if good ones exist.
Items: kerosene lantern, garlic braid, salt bowl or sack, rosary, holy water bottle, bolo, oil can.

About 20 to 30 models, 100 to 150 credits. Each one is shrunk with `tools/blender/optimize_model.py`.
Credit the creators on the credits page.

### Made here or free

Ground and path textures, grass, sky and moon, fog, embers and dust particles, the manananggal's
lower half (cut from the aswang model), all sound (CC0 libraries), fonts and interface.

### Rough total

About 750 to 900 of the 2,415 credits, leaving more than half in reserve.

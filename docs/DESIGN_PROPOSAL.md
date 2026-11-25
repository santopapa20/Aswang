# Aswang: game design proposal

Written 2026-11-23. This is a proposal, not a decision. Nothing is built from it yet.
Three labels are used throughout:

- **Exists**: already in the project.
- **Recommend**: what I think we should do.
- **Decide**: yours to choose before we build.

All names, Visayan words and story beats are placeholders for you to correct. You are the Cebuano
speaker here, I am not.

---

## 1. Audit: what we have actually built

### What exists

| Area | In the project today | In the game? |
| --- | --- | --- |
| Game | Browser game, top-down 3D, about 1,000 lines of code. One barrio of about 70 m. One night of 3 minutes with a countdown, "CAUGHT" and "SUNRISE" screens | Yes |
| Player | Walk, run, sneak. Each makes a different amount of noise. Kerosene lamp that casts real light. Six animations | Yes |
| Aswang, transformed | Wanders, notices noise, screams, chases, strikes. Stopped by a salt line, driven back by garlic | Yes |
| Aswang, human form | Model with idle, walk and look-around | No, unused |
| Manananggal | Flies, spots the lamp, dives. Her lower half stands by the balete; salting it ends her | Yes |
| Tikbalang | Follows you, reverses your controls, charges, kills. Beaten by turning your shirt inside out | Yes |
| Kapre | Four concept images and what looks like its Tripo model, in your Downloads folder since this afternoon | Not in the project yet |
| Sigbin | Four concept images in Downloads. No model | No |
| Wakwak | Nothing | No |
| Other villagers | None in the project. If you have generated some, they are not in the folder yet | No |
| Environment | One hut model used three times (solid, cannot be entered), fence, 34 palms, well, balete tree, flat ground | Yes |
| Items | Lantern (used). Garlic and rosary models (unused). Salt is a placeholder disc | Partly |
| Tools | A full pipeline from a picture to an animated game model, including bodies Mixamo refuses | Yes |

Not started at all: sound, story, any goal other than the timer, daytime, talking to anyone, saving,
menus, hiding places.

### What kind of game this is right now

Honestly: it is a small arena. You stand in a field for three minutes while three creatures come at
you one after another. It works technically and it looks good, but it is not yet a game anyone
would play twice.

### The problems, plainly

1. **There is nothing to do.** The only goal is a clock. Nothing asks you to go anywhere.
2. **The best strategy is to stand still.** Pour salt, wait. A horror game where waiting wins is not
   frightening.
3. **Every creature is the same enemy.** Aswang, manananggal and tikbalang all end in "caught".
   They look different but play the same: something runs at you, you use its one trick.
4. **Each trick is solved once.** After you learn "hold T", the tikbalang is never a threat again.
   Knowledge replaces tension instead of feeding it.
5. **There is no sound.** In horror, sound is at least half of the fear. In a top-down game it is
   more than half, because the camera cannot do close-ups or jump scares.
6. **Assets are ahead of design.** Most of the 25 commits are models. Six creatures were planned
   because the folklore has six famous names, not because the game needs six hunters.
7. **The old plan had mechanics without a purpose.** A nerve meter, holy water, a bolo, a rosary, a
   chapel. They sound right for horror but nothing in the game needed them.

### What the assets are quietly telling us

- We made the aswang twice: as a monster and as an ordinary woman. That is not a wave-survival
  idea. It says **the monster is somebody's neighbour**.
- The manananggal's lower half was cut from the aswang model, so it wears the same skirt. Without
  planning it, we made them **the same woman**.
- The kapre belongs in the balete and the tikbalang on a trail. Those are **places with owners**,
  not enemies that roam.
- The player carries a lamp and a braid of garlic on his belt. He is not a victim who woke up in a
  nightmare. He is **someone who came to keep watch**.

### What can be reused

Nearly everything: the player, the lamp, noise and sneaking, salt lines, garlic, the aswang's
hunting behaviour, the manananggal's flight, the lower half, the tikbalang's reversed controls and
shirt counter, the barrio and the whole asset pipeline. The recommendation below changes what these
things are *for*, not the things themselves.

---

## 2. Three directions

| | A. Five nights of survival | B. The vigil | C. The road |
| --- | --- | --- | --- |
| In one line | Survive until sunrise, a new monster each night | Guard your sister's house for five nights and work out which neighbour is the aswang | Walk from the barrio to the town at night; each stretch belongs to a different creature |
| What you do | Run, hide, use counters | Prepare by day, guard and run errands by night, gather proof | Travel, solve each creature's rule, move on |
| Strengths | Mostly built. Smallest job | Gives a goal, a person to care about, a mystery, and a reason to move. Uses the human-form aswang. Folklore becomes the rules of play | Strong set pieces, tight pacing |
| Weaknesses | Problems 1 to 4 above remain. Feels like many small web games | Needs writing, a day phase and one or two villagers | Needs a new environment for every chapter. Played once and done |
| New assets | Sigbin, wakwak, chapel, props | One villager, a few small props | Many: forest, river, field, town edge |
| Difficulty | Low | Medium | High |

**Recommend: B, the vigil.** It is the only one that fixes "nothing to do" and "stand still wins",
it uses what we already made, and it needs the fewest new assets. A is safe but forgettable. C is
the most cinematic but would have us making environments for months.

---

## 3. The concept

**Aswang** is a top-down folk-horror game about keeping watch.

> Five nights guarding your pregnant sister's house in a 1950s Visayan barrio, while you work out
> which of the neighbours who greet you every morning is the thing that circles the house every night.

The nine questions:

1. **What is it about?** A vigil. In the old stories the aswang comes for the unborn child, and the
   men of the family guard the house until the birth. That custom is the game.
2. **Who is he and why is he here?** A young man of about nineteen (placeholder name: Andoy) who
   left the barrio as a boy to work in town. He is called home in 1953 because his sister Rosing is
   close to giving birth and her husband is away cutting cane in Negros for the milling season. He
   no longer knows who is who in the barrio. Neither does the player.
3. **The central conflict.** Something tests the house every night, and it is one of the
   neighbours. The birth is five nights away.
4. **Primary objective.** Keep Rosing alive until the child is born, and find the aswang's weakness
   before the last night.
5. **Normal play.** By day: walk the barrio, gather what you can, talk, look at what last night left
   behind, set your protections at dusk. By night: guard the house, and leave it when the night's
   errand forces you to.
6. **What makes it different.** You protect a home and a person, not only yourself. The monster
   brings you breakfast. Every rule in the game is a real belief you first hear as a rumour. Not
   every spirit is an enemy.
7. **Why keep playing.** Each night ends with an answer and a worse question. Rosing's condition
   carries over, so mistakes stay with you. And you want to know who it is.
8. **The source of fear.** Not the chase. It is the walk away from the house, the sound that gets
   quieter as she gets closer, and saying good morning to someone you have started to suspect.
9. **Folklore as gameplay.** See the table below. The rule is: a belief only goes in the game if
   the player *does* something because of it.

### Folklore that becomes a mechanic

| Belief | What the player does |
| --- | --- |
| The tiktik: the aswang's sound is loud when she is far and faint when she is near | Listens. Silence is the alarm. This replaces the wakwak as a separate creature |
| Salt, garlic and ash bar her way | Places them at the door, windows and under the house at dusk. Each holds once |
| The manananggal leaves her lower half behind | Searches for it. Salt on it means she cannot rejoin and dies at sunrise |
| An albularyo's oil boils when an aswang is near | Carries the bottle by day while visiting neighbours |
| Excuse yourself when passing a spirit's place | Walks, does not run, and holds a key to say the words at the balete and on the trail |
| The tikbalang makes the path loop; turn your shirt inside out | Notices the same tree twice, then breaks the spell |
| The kapre smells of tobacco and can be befriended | Follows the ember in the dark, brings tobacco |
| The first cockcrow ends the night | The night has no clock on screen, only the sky and the rooster |

**Decide:** whether the words are "tabi, apo" or something else in your Cebuano. "Tabi-tabi po" is
Tagalog.

---

## 4. The gameplay

### The loop

1. **Morning.** What happened to the house overnight: scratches on the doorpost, a dead hen, salt
   scattered. Someone visits.
2. **Day (about 3 minutes).** The sun moves; you cannot do everything. Choose: gather salt, garlic
   and lamp oil; talk to a neighbour; follow up a rumour.
3. **Dusk.** Set the protections. You never have enough for every opening.
4. **Night.** Guard the house. At some point the night's errand sends you away from it.
5. **First cockcrow.** A short account: what was breached, how Rosing is, what you learned.

### Systems we keep, add and cut

| System | Verdict | Why |
| --- | --- | --- |
| Lamp, noise, walk/run/sneak | **Exists**, keep | Already the heart of moving at night |
| Salt lines, garlic | **Exists**, keep, repurpose | They now protect the house, not only you |
| The house and its openings | **Recommend**, new, most important | Door, two windows, roof. Each can hold one protection. A breach weakens Rosing. Three breaches across the game and she is lost |
| Rosing as a voice | **Recommend** | She speaks from inside. She is never fully seen. No model, no interior, and it is more frightening |
| The night's errand | **Recommend**, new | One reason each night to leave: water, the albularyo's oil, the hilot, tobacco. This is what makes you move |
| Shuttering the lamp | **Recommend** | Dark and hidden, or lit and seen. A choice the player makes constantly |
| Talking to neighbours | **Recommend**, small | Short text conversations. Rumours, some of them wrong, as in real life |
| Proof | **Recommend**, small | Three proofs of who she is, each found by doing something, kept on one notes screen |
| Hiding under a house | **Decide** | Houses stand on posts, so the space underneath is a natural hiding place. Cheap to add later |
| Nerve meter, holy water, bolo, rosary item, chapel | **Cut** | Nothing in this game needs them |
| Combat | **Cut** | He is a watchman with a lamp. The moment he can fight, the fear is gone |
| Inventory grid, crafting, puzzles | **Cut** | Three supplies and a few story objects are enough |

---

## 5. What each creature is for

Only one of them hunts you.

### The aswang and the manananggal: one woman

- **Role.** The antagonist. A kind widow (placeholder: Nang Pacing) who brings food and offers to
  sit with Rosing. She did not choose what she is. **Exists:** both forms and the human form.
- **When.** By day, at your door. Nights 1 to 5 around the house: on foot at first, and from the
  air once the door is barred.
- **Behaviour.** Patient and clever. She does not rush you. She circles, tests one opening, and
  waits for you to leave. She goes for the house when you are far and for you when you are between.
- **How she finds you.** Noise and lamplight (**exists**).
- **Surviving.** Salt, garlic, distance, darkness. She cannot be killed in a fight.
- **Defeating her.** Only on the last night, by finding and salting her lower half before cockcrow.
- **Why it frightens.** You hear her get quieter. And the next morning she asks how you slept.

**Decide:** are they the same woman? I recommend yes. It makes one strong villain out of two
ordinary monsters, and the skirt on the lower half becomes the moment the player understands.

### The tikbalang: the trail

- **Role.** The owner of the trail to the next sitio, where the hilot lives. Not her ally. Not evil.
- **When.** Night 3, on the trail, and again whenever you take it.
- **Behaviour.** It does not kill. It makes the path bring you back to where you started, while the
  lamp oil burns and the house stands unguarded. You see it only as a tall shape at the edge of the light.
- **Surviving.** Notice the loop, turn your shirt inside out (**exists**), walk and excuse yourself.
- **Why it frightens.** Lost time. You know what is happening at the house while you walk in circles.

This changes what **exists**: today it charges and kills. I recommend removing the kill. It is a
code change, not an asset change. As a third chaser it is the weakest of the three; as the thing
that steals your time it is unlike anything else in the game.

### The kapre: the witness

- **Role.** It has sat in the balete for a hundred years and sees everything, including where she
  leaves her legs. The lower half already stands beside the balete in our map.
- **When.** From night 1 as a red ember far off in the dark. Up close on night 4.
- **Behaviour.** Harmless if respected. If you run through its yard or forget to excuse yourself, it
  comes down and blows out your lamp. It does not hurt you. It leaves you in the dark, far from home.
- **Befriending.** Bring tobacco. It will point with the ember.
- **Why it is memorable.** A giant that is not your enemy, and a punishment worse than a chase.

### The sigbin: her hound (optional)

- **Role.** In the stories some families keep a sigbin. Here it is hers, let out on the last night.
- **Behaviour.** It does not attack you. It attacks your **shadow**, which only exists while your
  lamp is lit. Shutter the lamp and it loses you, and so do you.
- **Recommend:** build it last, or not at all for the first release. It needs a four-legged rig
  made by hand, and nights 1 to 4 do not need it.

### The wakwak

**Recommend: no model.** Its famous trait, the call that fades as it nears, becomes the aswang's
sound. That saves a model and puts the best audio idea in the folklore at the centre of the game.

---

## 6. The player's experience

### Opening (2 minutes)

Late afternoon. Andoy walks the path into the barrio with his bundle. A card: *Visayas, 1953.
Milling season. The men are in Negros.* A woman at the well greets him warmly and walks him to his
sister's house. Rosing speaks through the window; she cannot get up. The woman promises to bring
supper. The sun goes down.

### First 10 minutes: what the player learns

How to move and light the lamp. That running is loud. That the house has a door and windows and
only one handful of salt. That the sound in the dark gets *quieter* when it should get louder.

### First 30 minutes

Night 1, the first full day, and the start of night 2: the first proof, the first breach or the
first clean night, and the first time the roof is scratched.

### The five nights

| Night | Name | What is new | What you find out |
| --- | --- | --- | --- |
| 1 | The first watch | Guarding, the tiktik, an errand to the well | Something tested the door |
| 2 | The roof | She comes from above. Smoke under the house. Fetch the albularyo's oil | It is a manananggal. The oil boiled in the morning, near someone |
| 3 | The trail | Fetch the hilot along the tikbalang's trail. Pacing offers to watch Rosing while you are gone | Whether you trusted her |
| 4 | The balete | The kapre, tobacco, the search for the lower half | The skirt. You follow her home at dawn |
| 5 | The birth | Everything, and the longest night. Rosing in labour | The ending |

Tension rises in three ways: the errands take you further each night, your supplies never quite
cover every opening, and after night 3 she knows that you know.

### Climax and endings

On night 5 you must hold the house and find where she has hidden her lower half *this* time. The
kapre, if you were respectful, shows the way.

- **Sunrise.** The lower half is salted. She cannot rejoin and is caught by the first light in the
  yard. In the stories an aswang cannot die until she passes on what she carries. She asks you to
  take it. **Take it:** she dies in peace and the title of the game becomes about you. **Refuse:**
  the child is safe and the barrio keeps its aswang. **The albularyo's way**, if you earned his
  trust: it is sealed in a bamboo tube and buried under the balete.
- **The empty house.** Three breaches. Morning comes. She brings breakfast.

### Chapter 1 in full: "The first watch"

- **Objective.** Keep the house until cockcrow. About 6 minutes.
- **Dusk.** Rosing, from inside: there is one bowl of salt and one braid of garlic. The door and two
  windows. You choose two of three.
- **Early night.** Insects, wind in the palms. A dog barks somewhere and stops. Far off, a clicking:
  tik-tik-tik. Rosing: "If you hear it loud, it is far. Father used to say that."
- **The errand.** Rosing is burning with thirst. The jar is empty. The well is 20 metres into the dark.
- **The walk.** The clicking grows fainter with every step. At the well the bucket takes four long
  seconds. A shape stands at the edge of the lamplight and is gone.
- **The return.** The opening you left unprotected is being tried. Run and she turns to you. Sneak
  and she has more time at the window. This is the game's central choice, taught in one minute.
- **Standoff.** She cannot cross the salt. She stands outside the light. She leaves before dawn.
- **Cockcrow.** The account: door held, one window scratched, Rosing frightened but well.
- **Morning.** Claw marks on the frame. Pacing arrives with rice porridge: "The dogs were restless
  last night. Did you sleep?"
- **Progression.** The barrio opens up by day. The albularyo's hut at the far edge is now reachable.

Almost all of this is built from what **exists**. New work: the house's openings, Rosing's lines,
the errand, the aswang's circling behaviour, and sound.

---

## 7. What will make players love it, and what will lose them

**What will work**

- **Sound first.** The reversed tiktik, a voice from inside the house, scratching on nipa, a
  rooster that means safety.
- **The lamp as the camera.** In top-down the lamp's small circle *is* the fear. Everything
  frightening should happen at its edge.
- **Daylight dread.** The scariest scene may be a polite conversation.
- **Recognisable creatures.** Filipino players should say "yes, that is exactly what my lola said".
  Others should learn it by surviving it.
- **A story people retell.** "The monster was the neighbour who fed me" and "the giant in the tree
  helped me" are things players tell their friends.

**What will bore or frustrate**

- Waiting with nothing to do. Every night needs its errand.
- Dying to a rule nobody told you. Every rule must be heard as a rumour first.
- Repeating a whole night after one mistake. Breaches should hurt, not restart.
- Long daytime chores. Keep the day to three minutes and two or three real choices.

**What would make it feel cheap**

- Jump scares and loud stings. They do not work from above and they age badly.
- Gore. The manananggal is disturbing enough as a silhouette.
- Six monsters that all chase.
- Treating belief as stupidity. The albularyo and the hilot are the most competent people in the
  barrio. No real province is named.

**An honest note on "AAA".** This is a browser game made by one person on a laptop with integrated
graphics. It cannot compete on spectacle and should not try. It can be small, sharp and finished:
60 to 90 minutes, one barrio, one villain, and a subject no big studio has done properly. Darkwood
proved that top-down horror can be frightening. That is the bar, not Resident Evil.

---

## 8. Roadmap

In order. Each step ends with something playable.

| # | Step | Covers | Done when |
| --- | --- | --- | --- |
| 1 | **Decisions** | Vision and design | Section 9 is answered |
| 2 | **Night 1, complete, with sound** | Core prototype, player mechanics, enemy AI, audio | Someone who has never seen the game plays "The first watch" and is tense. If they are not, we fix this before anything else |
| 3 | **Day and morning** | Story, UI | You can talk to Pacing, gather, set protections at dusk, and read the morning's account |
| 4 | **Night 2: the roof** | Enemy AI | The manananggal goes for the house, not only for you |
| 5 | **Night 3: the trail** | Level design, enemy AI | The trail exists, the tikbalang misleads instead of killing |
| 6 | **Night 4: the balete** | Enemy AI, story | The kapre is in the game; the lower half can be found and recognised |
| 7 | **Night 5 and the endings** | Story and progression | The game can be finished |
| 8 | **Screens and saving** | UI | Title, pause, notes, settings with quality levels, progress saved |
| 9 | **Polish** | Optimisation, atmosphere | Steady frame rate on your laptop; second sound pass; lighting pass |
| 10 | **Testing and release** | Testing | Five people finish it without help; credits; published link on your portfolio |

**Assets this needs beyond what exists:** the albularyo (one model), the kapre (rig the model you
already have), a few small props from the gallery (water jar, oil bottle, tobacco, firewood), and
free sounds. That is all. **Recommend an asset freeze** on everything else, including the sigbin and
the wakwak, until step 7 is done.

Step 2 is the largest single step and the one that decides whether this is a game.

---

## 9. Decisions needed from you

1. **Direction:** A, B or C. I recommend B.
2. **One villain:** are the aswang and the manananggal the same woman? I recommend yes.
3. **Rosing:** heard but not seen? I recommend yes for the first release.
4. **The tikbalang:** does it mislead instead of kill? I recommend yes.
5. **Sigbin and wakwak:** sigbin last or never, wakwak as sound only? I recommend yes to both.
6. **Names and language:** English with Cebuano words? Which names? Which words for excusing yourself?
7. **The protagonist:** the returning younger brother, or someone else?
8. **The ending where he takes it:** too dark, or exactly right?

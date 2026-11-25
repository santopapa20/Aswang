/**
 * Development only: a play-through that checks itself. Open the game with #shot=selftest and it plays
 * all five nights by script, testing each mechanic and item, and prints a pass/fail list on screen.
 * It is not a substitute for a person playing: it cannot judge feel, difficulty, sound or looks.
 */
import { canCraft, hitStop, hurt, live, loadSave, mods, useGame } from "./game/state";
import { BLADE, HERB_PRICE } from "./game/data";
import { benchSpot, doorOf, firePit, hidingSpots, hilotSpot, home, house, nodes, stakeSolids, well } from "./game/layout";
import { BALETE_ROOTS } from "./game/interact";

type Dev = { run: (seconds: number, fps?: number) => void; show: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const G = () => useGame.getState();
const dev = () => (window as unknown as { __aswang: Dev }).__aswang;
const key = (code: string, down = true) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
const run = (s: number) => dev().run(s);
const hold = (code: string, seconds: number) => { key(code); run(seconds); key(code, false); };
const at = (x: number, z: number) => { live.player.set(x, 0, z); run(0.3); };
const DOOR = doorOf(home), KADYO = doorOf(house("kadyo")), HILOT = doorOf(house("hilot"));
const SPOT = { door: [DOOR.x, DOOR.z + 0.5], west: [home.x - 3.6, home.z + 1.2], east: [home.x + 3.6, home.z + 1.2] } as const;

const results: { name: string; ok: boolean; note: string }[] = [];
const check = (name: string, ok: boolean, note: unknown = "") => { results.push({ name, ok, note: typeof note === "string" ? note : JSON.stringify(note) }); };

/** Plays `seconds` of night, going to whichever opening is being worked on. Stops early when `until` is true. */
let tried = false;      // something has worked at an opening at some point (which opening she picks is chance)
async function guard(seconds: number, until: () => boolean = () => false) {
  for (let t = 0; t < seconds && G().stage === "night" && !until(); t += 1) {
    if (live.breachAt) tried = true;
    if (G().onRoof && G().bag.kindling > 0 && live.smoke <= 0) { at(firePit.x, firePit.z + 1.1); hold("KeyE", 1.3); }
    else if (live.breachAt && live.breach > 0 && !G().onRoof) { const s = SPOT[live.breachAt]; live.player.set(s[0], 0, s[1]); }
    else if (G().overhead) live.player.x += t % 2 ? 5 : -5;            // step aside from a dive
    run(1);
    if (t % 15 === 0) await sleep(5);
  }
}
const toDawn = async () => { live.clock = Math.min(live.clock, 2); run(3); await sleep(300); };
const skipTalk = async () => { for (let i = 0; i < 12 && G().dialogue; i++) { live.skipTyping = true; await sleep(30); if (G().dialogue?.choices && G().dialogue!.index === G().dialogue!.lines.length - 1) break; G().advance(); } };
const prompt = (k: "E" | "G") => live.prompts[k]?.label ?? "";

export async function selfTest() {
  try { await play(); } catch (e) { check("the test itself ran to the end", false, String(e)); }
  report();
}

async function play() {
  // ---------- day 1
  G().newGame(); await sleep(300); await skipTalk();
  check("new game starts on day 1", G().stage === "day" && G().night === 1);
  check("objective points at Rosing's door", live.objective.title === "Rosing's house" || (run(0.2), live.objective.title === "Rosing's house"), live.objective.title);
  key("KeyW"); run(2); key("KeyW", false);
  check("walking moves the player", live.player.z < 29.5, live.player.z.toFixed(1));
  const z0 = live.player.z; key("ShiftLeft"); key("KeyW"); run(2); key("KeyW", false); key("ShiftLeft", false);
  check("running is faster and uses breath", z0 - live.player.z > 5 && live.stamina < 0.9, { moved: (z0 - live.player.z).toFixed(1), breath: live.stamina.toFixed(2) });
  at(DOOR.x, DOOR.z + 0.5);
  check("door offers the kitchen supplies", prompt("E").includes("kitchen"), prompt("E"));
  hold("KeyE", 1.3);
  check("supplies taken", G().bag.salt === 1 && G().bag.garlic === 1 && G().bag.oil === 5, G().bag);
  hold("KeyG", 1.2);
  check("salt laid at the door", G().wards.door === "salt" && G().bag.salt === 0, G().wards);
  at(SPOT.west[0], SPOT.west[1] - 1.2); hold("KeyG", 1.2);
  check("garlic hung at the west window", G().wards.west === "garlic", G().wards);
  // searching, by day
  at(6.5, 8.6); const before = JSON.stringify(G().bag); hold("KeyE", 2.2);
  check("searching the sack gives something and marks it", G().searched.length === 1 && JSON.stringify(G().bag) !== before, G().bag);
  // Nang Pacing
  run(1); at(live.pacing.x + 0.8, live.pacing.z + 0.8);
  check("Nang Pacing is in the barrio and can be talked to", live.pacing.here && prompt("E").includes("Pacing"), prompt("E"));
  hold("KeyE", 0.6); await sleep(50);
  check("talking opens a conversation", !!G().dialogue); await skipTalk();
  // Nong Kadyo and trade
  at(KADYO.x, KADYO.z + 0.5); hold("KeyE", 0.6); await sleep(50);
  check("Nong Kadyo speaks", !!G().dialogue, prompt("E")); await skipTalk(); await sleep(50);
  check("then his trade opens", G().panel === "trade", G().panel);
  G().set({ bag: { ...G().bag, kindling: 0, tobacco: 0, coins: 40, herbs: 12 }, charms: [], worn: [] });      // a known purse with room to buy, and no charm yet, whatever the sack held
  // a button answers only once the screen has caught up with the purse, so wait for it to be live before pressing
  const click = async (word: string) => {
    for (let i = 0; i < 40; i++) {
      const b = [...document.querySelectorAll<HTMLButtonElement>(".offers .offer")].find((o) => o.textContent!.includes(word));
      if (b && !b.disabled) { b.click(); await sleep(60); return; }
      await sleep(50);
    }
  };
  const salt0 = G().bag.salt; await click("Salt");
  check("buying salt costs 3 centavos", G().bag.salt === salt0 + 1 && G().bag.coins === 37, G().bag);
  await click("Sell a bundle");
  check("selling herbs pays", G().bag.herbs === 11 && G().bag.coins === 37 + HERB_PRICE, G().bag);
  await click("charm bound");
  check("a charm is bound from herbs and worn", G().charms.length === 1 && G().worn.length === 1 && G().bag.herbs === 5, G().charms);
  G().add("coins", 30); await click("whip");
  check("the whip can be bought", G().hasWhip, G().bag.coins);
  G().setPanel(null);
  G().gainXp(80); const carry0 = mods().carry; G().spendPoint("pockets");
  check("levelling gives a point and a perk changes the numbers", G().level >= 2 && mods().carry === carry0 + 5, { level: G().level, carry: mods().carry });
  const c = G().charms[0] ?? G().addCharm(); G().wear(c.id); const off = G().worn.length; G().wear(c.id);
  check("a charm can be taken off and put on", off === 0 && G().worn.length === 1);
  at(DOOR.x, DOOR.z + 0.5); G().add("kindling", 3);
  check("door offers to wait for dusk", prompt("E") === "Wait for dusk", prompt("E"));
  hold("KeyE", 2.2); await sleep(400);

  // ---------- night 1
  check("night 1 begins, aswang on foot", G().stage === "night" && G().form === "foot", G().stage);
  check("a card names the night", G().banner?.big === "Night I", G().banner);
  await guard(60, () => !!G().errand);
  check("Rosing asks for water", G().errand?.id === "water", G().errand);
  check("the aswang is out there", live.aswang.active, live.aswang);
  at(well.x, well.z + 1.7); hold("KeyE", 4);
  check("water drawn at the well", G().carrying === "water", prompt("E"));
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.3);
  check("water errand done", !!G().errand?.done, G().errand);
  const oil0 = G().bag.oil; await guard(70);
  check("the lamp burns oil", G().bag.oil < oil0, { before: oil0, after: G().bag.oil });
  check("the house was tried during the night", tried || G().tally.held + G().tally.breaches > 0, G().tally);
  key("KeyF"); run(0.2); const shut = !G().lampOn; key("KeyF", false); key("KeyF"); key("KeyF", false);
  check("F shutters the lamp", shut);
  at(home.x + 9, home.z + 12); G().add("salt", 1); const lines0 = G().lines.length; key("KeyQ"); run(0.2); key("KeyQ", false);
  check("Q pours a line of salt", G().lines.length === lines0 + 1, G().lines.length);
  key("KeyR"); run(0.2); key("KeyR", false);
  check("R cracks the whip", live.whipWait > 0, live.whipWait);
  await toDawn();
  check("cockcrow ends the night with an account", G().stage === "morning" && G().report.length >= 3, G().report);
  check("Rosing survived night 1", G().rosing >= 2, G().rosing);

  // ---------- day and night 2
  G().nextDay(); await sleep(300);
  check("day 2: Nang Pacing visits", G().night === 2 && !!G().dialogue, G().dialogue?.lines.length);
  await skipTalk();
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.3);
  check("progress is saved and can be continued", G().continueGame() && G().night === 2); await sleep(300);
  G().set({ rationTaken: true, bag: { salt: 3, garlic: 2, oil: 10, kindling: 4, tobacco: 0, herbs: 0, coins: 10 }, wards: { door: "salt", west: "garlic", east: "garlic" } });
  at(firePit.x, firePit.z + 1.1); hold("KeyE", 1.3);
  check("the smudge fire can be fed", live.smoke > 60, live.smoke.toFixed(0));
  G().startNight(); await sleep(400);
  check("night 2: she takes to the air", G().form === "air");
  live.smoke = 0; await guard(40, () => G().mana === "hunting");
  check("the manananggal appears, and her legs stand at the balete", G().mana === "hunting");
  G().set({ bag: { ...G().bag, kindling: 0 } });
  await guard(130, () => G().onRoof);
  check("she settles on the roof", G().onRoof, { elapsed: live.elapsed.toFixed(0) });
  run(3); const b1 = live.breach;
  check("the roof attack builds", b1 > 0.1, b1.toFixed(2));
  at(DOOR.x, DOOR.z + 0.5);
  check("the door offers the house post", prompt("E").includes("Strike"), prompt("E"));
  hold("KeyE", 1); run(0.5);
  check("striking the post drives her off the roof", !G().onRoof && live.breach === 0);
  await guard(8, () => G().overhead);
  check("and she comes for him", G().overhead || live.caught > 0);
  live.caught = 0; G().set({ overhead: false, bag: { ...G().bag, kindling: 3 } });
  await guard(40, () => !!G().errand);
  at(KADYO.x, KADYO.z + 0.5); hold("KeyE", 1.9);
  check("Nong Kadyo gives the oil", G().carrying === "lana" && G().hasLana, prompt("E"));
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.3);
  check("oil errand done", !!G().errand?.done);
  live.caught = 0; await toDawn();
  check("night 2 ends", G().stage === "morning" || G().stage === "over", G().stage);

  // ---------- day and night 3
  G().set({ rosing: 3, stage: "morning" }); G().nextDay(); await sleep(300);
  for (let i = 0; i < 12 && G().dialogue && !(G().dialogue!.choices && G().dialogue!.index === G().dialogue!.lines.length - 1); i++) { live.skipTyping = true; await sleep(30); G().advance(); }
  check("day 3: the oil boils, and she makes her offer", G().proofs.oil && !!G().dialogue?.choices, G().proofs);
  key("Digit2"); key("Digit2", false); await sleep(60);
  check("the offer can be refused", G().trusted === false && !G().dialogue, G().trusted);
  G().set({ rationTaken: true, bag: { salt: 4, garlic: 2, oil: 12, kindling: 3, tobacco: 1, herbs: 0, coins: 0 }, wards: { door: "salt", west: "garlic", east: "garlic" } });
  G().startNight(); await sleep(400); await guard(20, () => !!G().errand);
  check("night 3: the hilot errand", G().errand?.id === "hilot", G().errand);
  at(40, 0); key("KeyD"); for (let i = 0; i < 9; i++) run(5); key("KeyD", false);
  check("the trail brings him back", G().lost && live.loops >= 2 && live.player.x < 82, { x: live.player.x.toFixed(0), loops: live.loops });
  hold("KeyT", 2.3);
  check("turning the shirt breaks it", G().shirt && !G().lost);
  key("KeyD"); for (let i = 0; i < 6; i++) run(5); key("KeyD", false);
  check("and the trail lets him through", live.player.x > 92, live.player.x.toFixed(0));
  at(HILOT.x, HILOT.z + 0.5); hold("KeyE", 1.9);
  check("the hilot answers", G().errand?.step === 1, prompt("E"));
  check("she comes to her door", live.hilotOut > 0, live.hilotOut.toFixed(1));
  // the amalanhig: one rises when he comes near its grave, and three blows of the whip lay it down
  G().set({ hasWhip: true });
  at(99.5, 10.3); run(3.2);
  check("an amalanhig rises from its grave", live.amalanhig[0].mode === "hunt" && live.amalanhig[1].mode === "grave", live.amalanhig.map((a) => a.mode));
  const coins0 = G().bag.coins;
  // he stands his ground and cracks the whip each time it comes within reach of it
  for (let i = 0; i < 3; i++) {
    const a = live.amalanhig[0];
    for (let k = 0; k < 60 && Math.hypot(a.x - live.player.x, a.z - live.player.z) > 2.6; k++) run(0.1);
    live.whipWait = 0; live.stamina = 1; key("KeyR"); run(0.2); key("KeyR", false); run(0.3);
  }
  run(1.2);
  // the other one: its grab hurts him but does not end the night, and herbs put it right
  const full = live.health;
  at(117, 10.6);
  for (let k = 0; k < 120 && live.health >= full; k++) run(0.1);
  check("a grab hurts him but the night goes on", live.health < full && live.health > 0 && live.caught <= 0 && G().stage === "night", { health: live.health.toFixed(0), caught: live.caught });
  at(HILOT.x, HILOT.z + 0.5); const hurtTo = live.health; G().add("herbs", 2); hold("KeyH", 1.5);
  check("eating herbs (hold H) gives health back", live.health > hurtTo, { before: hurtTo.toFixed(0), after: live.health.toFixed(0) });
  check("its health bar empties with the blows", live.amalanhig[0].hp <= 0, live.amalanhig[0].hp.toFixed(2));
  check("three blows of the whip lay it down", live.amalanhig[0].mode === "down" && G().bag.coins > coins0 && live.caught <= 0, { mode: live.amalanhig[0].mode, hits: live.amalanhig[0].hits, coins: G().bag.coins - coins0 });
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.1);
  check("hilot errand done", !!G().errand?.done);
  await toDawn();

  // ---------- day and night 4
  G().set({ rosing: 3, stage: "morning" }); G().nextDay(); await sleep(300); await skipTalk();
  G().set({ rationTaken: true, bag: { salt: 4, garlic: 2, oil: 12, kindling: 4, tobacco: 2, herbs: 0, coins: 0 }, wards: { door: "salt", west: "garlic", east: "garlic" } });
  G().startNight(); await sleep(400); live.smoke = 150; await guard(30, () => G().mana === "hunting" && !!G().errand);
  check("night 4: the kapre errand", G().errand?.id === "kapre", G().errand);
  live.player.set(-27, 0, -15); key("ShiftLeft"); key("KeyA"); run(1.2); key("KeyA", false); key("ShiftLeft", false);
  check("running under the balete gets the lamp blown out", live.lampBlown > 0 && G().kapre === "angry", { blown: live.lampBlown.toFixed(0), kapre: G().kapre });
  live.lampBlown = 0; at(BALETE_ROOTS.x + 0.5, BALETE_ROOTS.z + 0.6); hold("KeyE", 1.6);
  check("tobacco befriends it", G().kapre === "friend" && G().errand?.step === 1, G().kapre);
  at(hidingSpots[0].x + 0.4, hidingSpots[0].z + 1.2); hold("KeyE", 1.4);
  check("the legs are recognised", G().proofs.skirt && G().legsSeen, G().proofs);
  hold("KeyE", 1.7);
  check("salt on the stump ends her for the night", G().mana === "ended", G().mana);
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.1);
  check("kapre errand done", !!G().errand?.done);
  await toDawn();

  // ---------- day and night 5
  G().set({ rosing: 3, stage: "morning", kadyoTrust: 3 }); G().nextDay(); await sleep(300);
  check("day 5: she knows that he knows", G().dialogue?.lines.some((l) => l.text === "So will I.") ?? false);
  await skipTalk();
  G().set({ rationTaken: true, bag: { salt: 4, garlic: 2, oil: 14, kindling: 4, tobacco: 0, herbs: 0, coins: 0 }, wards: { door: "salt", west: "garlic", east: "garlic" } });
  G().startNight(); await sleep(400); live.smoke = 150; await guard(40, () => G().mana === "hunting" && !!G().errand);
  check("night 5: the legs are hidden somewhere new", G().legsAt > 0 && G().errand?.id === "legs", G().legsAt);
  run(0.3);
  check("the kapre's ember shows the way", live.objective.target?.x === hidingSpots[G().legsAt].x, live.objective);
  // her hound
  at(DOOR.x + 3, DOOR.z + 4); live.elapsed = Math.max(live.elapsed, 41); run(0.5);
  check("night 5: the sigbin is let out", live.sigbin.out, live.sigbin);
  live.sigbin.x = live.player.x + 6; live.sigbin.z = live.player.z; run(6);
  check("lamp lit: it closes on him", live.sigbin.near < 2.6, live.sigbin.near.toFixed(1));
  run(2.5);
  const drunk = live.sigbin.drain;
  check("it drinks his shadow, and the card says so", live.sigbin.feeding && drunk > 0.2 && live.objective.title === "Your shadow", { ...live.sigbin, card: live.objective.title });
  key("KeyF"); key("KeyF", false); run(2.5);
  check("shuttering the lamp loses it", !G().lampOn && !live.sigbin.feeding && live.sigbin.drain < drunk, { lamp: G().lampOn, ...live.sigbin });
  key("KeyF"); key("KeyF", false); run(1.5);
  check("lamp lit again: it comes back", live.sigbin.feeding, live.sigbin);
  G().add("salt", 1); live.sigbin.x = live.player.x + Math.sin(live.facing) * 5; live.sigbin.z = live.player.z + Math.cos(live.facing) * 5; key("KeyQ"); run(0.2); key("KeyQ", false); run(4);
  check("it will not step over salt", live.sigbin.near < 2.6 && !live.sigbin.feeding, live.sigbin);
  G().set({ lines: [], hasWhip: true }); live.whipWait = 0; live.stamina = 1; run(1); key("KeyR"); run(0.2); key("KeyR", false); run(3);
  check("the whip drives it off", live.sigbin.near > 6 && !live.sigbin.feeding, live.sigbin.near.toFixed(1));
  // (lamp shuttered for this: with it lit, whether she happens to dive on him just then is chance)
  G().set({ lampOn: false, overhead: false });
  const s = hidingSpots[G().legsAt]; at(s.x + 0.4, s.z + 1.2); hold("KeyE", 1.4); hold("KeyE", 1.7);
  G().set({ lampOn: true });
  check("salting them on the last night finishes her", G().mana === "dead" && !!G().errand?.done, G().mana);
  await toDawn();
  check("first light: the choice", G().stage === "ending" && G().ending === "choice", { stage: G().stage, ending: G().ending });
  await sleep(100);
  check("the third way is offered", !!document.querySelector(".sheet .menu button.primary"));
  G().chooseEnding("sealed"); await sleep(100);
  check("an ending is reached", G().ending === "sealed" && !!document.querySelector(".sheet h1"));

  // ---------- losing
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk(); G().startNight(); await sleep(300);
  G().set({ rosing: 1 }); G().breach("test"); await sleep(200);
  check("three breaches lose the game", G().stage === "over" && G().ending === "empty", G().stage);

  // ---------- a shadow drunk dry
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk();
  G().set({ night: 5, bag: { salt: 0, garlic: 0, oil: 6, kindling: 0, tobacco: 0, herbs: 0, coins: 0 } }); G().startNight(); await sleep(300);
  at(DOOR.x + 3, DOOR.z + 4); live.smoke = 150; live.elapsed = 41; run(0.5);
  live.sigbin.x = live.player.x + 1.4; live.sigbin.z = live.player.z; run(9);
  check("a shadow drunk dry puts him down", live.caught > 0 || G().stage !== "night", { caught: live.caught, drain: live.sigbin.drain, stage: G().stage });

  // ---------- no health left
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk(); G().startNight(); await sleep(300);
  live.health = 8; hurt(20); run(0.2);
  check("at no health he goes down", live.caught > 0 || G().stage !== "night", { health: live.health, caught: live.caught });

  // ---------- the aswang's kin, and Nong Kadyo's work
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk();
  G().nextDay(); await sleep(200); await skipTalk();
  check("Nong Kadyo offers work for the night", G().bounties.some((b) => b.state === "offered" && b.kind === "dog"), G().bounties);
  G().takeBounty(G().bounties[0].id);
  G().set({ rationTaken: true, hasWhip: true, bag: { ...G().bag, oil: 9 } }); G().startNight(); await sleep(300); await skipTalk();
  live.elapsed = 30; at(-20, -8);
  let hunted = false, found = false;
  const up = (d: { mode: string }) => !["away", "dead", "dying"].includes(d.mode);
  for (let i = 0; i < 900 && G().bounties[0]?.state !== "done" && live.caught <= 0; i++) {
    const dogs = live.kin.dog.filter(up);
    // go to them once they are out (they come out far from him)
    if (dogs.length && !dogs.some((d) => d.mode === "hunt" || d.mode === "bite" || d.mode === "back" || d.mode === "hit")) { const d = dogs[0]; at(d.x + 5, d.z); found = true; }
    run(0.1);
    if (live.kin.dog.some((d) => d.mode === "hunt")) hunted = true;
    if (live.kin.dog.filter(up).some((d) => Math.hypot(d.x - live.player.x, d.z - live.player.z) < 3) && live.whipWait <= 0) { live.stamina = 1; key("KeyR"); run(0.1); key("KeyR", false); }
    if (live.health < 40) live.health = 100;      // (this checks the hunt, not his health)
  }
  check("dead dogs come out and go for him", found && hunted, live.kin.dog);
  check("two laid down: the work is done, with fangs for it", G().bounties[0]?.state === "done" && G().trophies.fang >= 2, { bounty: G().bounties[0], fangs: G().trophies.fang });
  const purse = G().bag.coins; G().payBounty(G().bounties[0].id);
  check("and Nong Kadyo pays for it", G().bag.coins > purse && !G().bounties.some((b) => b.state === "done"), G().bag.coins - purse);
  // a crawler shrugs off the whip in the dark
  G().set({ night: 3 }); G().startNight(); await sleep(300); await skipTalk();
  live.elapsed = 30; at(5, -5);
  for (let i = 0; i < 200 && !up(live.kin.crawler[0]); i++) run(0.1);
  const cr = live.kin.crawler[0];
  check("a crawler comes out on the third night", up(cr), cr.mode);
  at(cr.x + 2.2, cr.z); G().set({ lampOn: false }); live.whipWait = 0; live.stamina = 1; const h0 = cr.hp; key("KeyR"); run(0.1); key("KeyR", false); const dark = h0 - cr.hp; run(1.2);      // (a blow while it reels from the last does nothing)
  at(cr.x + 2.2, cr.z); G().set({ lampOn: true }); live.whipWait = 0; live.stamina = 1; const h1 = cr.hp; key("KeyR"); run(0.1); key("KeyR", false); const lit = h1 - cr.hp;
  check("in the dark the whip slides off it; in lamplight it bites", dark > 0 && lit > dark * 3, { dark: dark.toFixed(2), lit: lit.toFixed(2) });

  // ---------- the kin in human guise: night 3 brings the farmer
  const walker = () => live.kin.guise[0];
  const night3 = async () => {
    G().set({ night: 3, rationTaken: true, hasWhip: true, bag: { ...G().bag, garlic: 2, oil: 9 } }); G().startNight(); await sleep(300); await skipTalk();
    live.elapsed = 30; at(-30, 25);
    for (let i = 0; i < 200 && !up(walker()); i++) { run(0.1); live.health = 100; }
  };
  const beside = (d: number) => { const w = walker(); at(w.x + d, w.z); live.facing = -Math.PI / 2; };
  await night3();
  check("a night walker comes out on the third night, in a farmer's face", up(walker()) && !walker().shown && walker().mode === "stroll", walker());
  beside(3.4); run(0.2);
  const offer = prompt("G");
  hold("KeyG", 0.5);
  check("garlic held up shows it for what it is: it reels, and the garlic is kept", offer === "Hold up garlic" && walker().shown && walker().mode === "recoil" && G().bag.garlic === 2, { offer, ...walker(), garlic: G().bag.garlic });
  live.whipWait = 0; live.stamina = 1; beside(2.6);
  const hw = walker().hp; key("KeyR"); run(0.1); key("KeyR", false);
  check("shown, the whip marks it", walker().hp < hw, { before: hw, after: walker().hp });
  G().set({ bounties: [{ id: 90, kind: "guise", count: 1, got: 0, coins: 16, xp: 60, text: "", night: 3, state: "taken" }] });
  for (let i = 0; i < 400 && up(walker()); i++) {
    if (Math.hypot(walker().x - live.player.x, walker().z - live.player.z) > 3) beside(2.6);
    if (live.whipWait <= 0) { live.stamina = 1; key("KeyR"); run(0.1); key("KeyR", false); } else run(0.1);
    live.health = 100; live.caught = 0;
  }
  check("laid down: a black stone from under its tongue, and Nong Kadyo's work is done", G().trophies.stone >= 1 && G().bounties[0]?.state === "done", { stone: G().trophies.stone, bounty: G().bounties[0] });
  await night3();
  live.whipWait = 0; live.stamina = 1; beside(3.0);
  key("KeyR"); run(0.1); key("KeyR", false); run(0.2);
  check("struck with the face still on, it takes no harm, and drops the face and comes", walker().hp === 1 && walker().shown && ["turn", "strike", "alert", "hunt"].includes(walker().mode), walker());
  await night3();
  live.health = 100; beside(1.2); run(0.9);
  check("let close with the face on, it strikes first", walker().shown && live.health < 100, { health: live.health, ...walker() });
  await night3();
  G().set({ kit: { ...G().kit, smudge: 1 } }); hold("KeyX", 0.1);
  beside(5); run(0.6);
  check("in smudge smoke it does not notice him", live.smudge > 0 && G().kit.smudge === 0 && walker().mode === "stroll", { smudge: live.smudge, mode: walker().mode });

  // ---------- the bench: making things by day, and using them at night
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk();
  G().set({ hasWhip: true, bag: { ...G().bag, coins: 40, kindling: 8, salt: 4, herbs: 6, garlic: 3, oil: 9 }, trophies: { fang: 5, claw: 2, stone: 0 } });
  at(benchSpot.x, benchSpot.z + 0.7); hold("KeyE", 0.6); await sleep(50);
  check("the bench opens by day", G().panel === "bench", prompt("E"));
  for (const id of ["itak", "pouch", "string", "barsWest", "barbs", "lash"] as const) G().craft(id);
  const kit = G().kit;
  check("the itak, a pouch, a garlic string, bars, barbs and a longer lash are made", kit.itak && kit.pouch === 1 && kit.string === 1 && kit.bars.west && kit.barbs && kit.lash && G().trophies.fang === 1 && G().trophies.claw === 0, { kit, trophies: G().trophies });
  check("and the whip is stronger and longer for it", mods().whipDamage > 40 && mods().whipReach > 4.5, { damage: mods().whipDamage, reach: mods().whipReach });
  G().setPanel(null);
  G().set({ wards: { door: "salt", west: "garlic", east: null }, rationTaken: true }); G().startNight(); await sleep(300); await skipTalk();
  G().testWard("west");
  check("bamboo bars: the barred window holds once without spending its garlic", G().wards.west === "garlic", G().wards);
  live.health = 100; hurt(20);
  check("the garlic string turns a bite aside, and is spent", live.health === 100 && G().kit.string === 0, { health: live.health, string: G().kit.string });
  live.elapsed = 60; at(99.5, 10.3); run(3.2);
  const am = live.amalanhig[0];
  for (let k = 0; k < 60 && Math.hypot(am.x - live.player.x, am.z - live.player.z) > 1.5; k++) run(0.1);
  live.facing = Math.atan2(am.x - live.player.x, am.z - live.player.z); live.stamina = 1;
  const hpBefore = am.hp; key("KeyV"); run(0.1); key("KeyV", false);
  check("the itak bites deep at close quarters", hpBefore - am.hp > 0.4, { before: hpBefore.toFixed(2), after: am.hp.toFixed(2) });
  run(1.3);
  for (let k = 0; k < 60 && Math.hypot(am.x - live.player.x, am.z - live.player.z) > 2.5; k++) run(0.1);
  live.facing = Math.atan2(am.x - live.player.x, am.z - live.player.z);
  const hpPouch = am.hp; key("KeyZ"); run(0.1); key("KeyZ", false); run(0.2);
  check("a salt pouch in its face makes it reel, without harm", am.mode === "hit" && am.hp === hpPouch && G().kit.pouch === 0, { mode: am.mode, hp: am.hp });

  // ---------- the rest of the bench: the sibat, smudge, strong oil, bells and the stake fence
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk();
  G().set({ hasWhip: true, bag: { ...G().bag, coins: 40, kindling: 12, herbs: 6, oil: 5 }, trophies: { fang: 2, claw: 2, stone: 1 } });
  const waits = !canCraft(G(), "spear");
  G().set({ kit: { ...G().kit, itak: true } });
  for (const id of ["spear", "smudge", "strongOil", "bells", "hedge"] as const) G().craft(id);
  const k2 = G().kit;
  check("the sibat waits for the itak; then a sibat, a smudge bundle, strong oil, bells and the stake fence are made", waits && k2.spear && k2.smudge === 1 && k2.strongOil === 1 && k2.bells && k2.hedge && G().trophies.stone === 0 && G().trophies.claw === 0 && G().trophies.fang === 0, { waits, kit: k2, trophies: G().trophies });
  check("the itak on a pole reaches further", mods().bladeReach > BLADE.range + 1, mods().bladeReach);
  await sleep(150); run(0.2);
  check("the stake fence stands round the yard", stakeSolids.length > 0 && stakeSolids.every((c) => c.r > 0), stakeSolids[0]);
  G().set({ rationTaken: true }); G().startNight(); await sleep(300); await skipTalk();
  const oilStrong = G().bag.oil;
  check("strong oil goes into the lamp at dusk", G().strongLamp && G().kit.strongOil === 0, { strong: G().strongLamp, left: G().kit.strongOil });
  for (let i = 0; i < 6; i++) { run(10); live.health = 100; live.caught = 0; }
  check("and burns the night through without touching his oil", G().bag.oil === oilStrong && G().stage === "night", { before: oilStrong, after: G().bag.oil });
  at(30, -20); live.breachAt = "west"; run(0.2);
  check("the bells ring when the house is tried while he is away", G().toasts.some((t) => t.text.includes("bells")), G().toasts.map((t) => t.text));

  // ---------- favours by day, and the old tales
  G().toTitle(); await sleep(100); G().newGame(); await sleep(200); await skipTalk();
  G().nextDay(); await sleep(200); await skipTalk();
  G().set({ rationTaken: true, rosing: 2 });
  const pick = async (n: number) => { await skipTalk(); key(`Digit${n}`); key(`Digit${n}`, false); await sleep(60); };
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 0.7); await sleep(50); await pick(1);
  check("Rosing asks a favour, and it is taken", G().favours.some((f) => f.id === "water"), G().favours);
  at(well.x + 1.6, well.z); hold("KeyE", 3.3);
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.2); await skipTalk();
  check("water brought: Rosing is stronger for it", G().rosing === 3 && !G().favours.some((f) => f.id === "water"), { rosing: G().rosing, favours: G().favours });
  at(KADYO.x, KADYO.z + 0.5); hold("KeyE", 0.6); await sleep(50); await skipTalk(); await pick(1); await sleep(100);
  check("Nong Kadyo asks for herbs", G().favours.some((f) => f.id === "herbs") && G().panel === "trade", { favours: G().favours, panel: G().panel });
  G().set({ bag: { ...G().bag, herbs: 6 } }); const coinsK = G().bag.coins; const trust = G().kadyoTrust; await sleep(100);
  [...document.querySelectorAll<HTMLButtonElement>(".offers .offer")].find((b) => b.textContent!.includes("as he asked"))?.click(); await sleep(60);
  check("and pays for them", G().bag.coins === coinsK + 12 && G().kadyoTrust === trust + 1 && G().bag.herbs === 1, { coins: G().bag.coins - coinsK, herbs: G().bag.herbs });
  G().setPanel(null);
  run(1); at(live.pacing.x + 0.8, live.pacing.z + 0.8); hold("KeyE", 0.6); await sleep(50); await pick(1);
  check("Nang Pacing asks for a strand of Rosing's hair", G().favours.some((f) => f.id === "hair"), G().favours);
  at(DOOR.x, DOOR.z + 0.5); hold("KeyE", 1.2); await skipTalk();
  run(0.5); at(live.pacing.x + 0.8, live.pacing.z + 0.8); const coinsP = G().bag.coins; hold("KeyE", 0.6); await sleep(50); await skipTalk();
  check("she pays for it", G().bag.coins === coinsP + 20 && G().hairGiven === 2, { coins: G().bag.coins - coinsP, hairGiven: G().hairGiven });
  G().set({ rosing: 3 }); G().startNight(); await sleep(300); await skipTalk();
  check("and that night something has hold of Rosing", G().rosing === 2, G().rosing);
  G().set({ stage: "morning" }); G().nextDay(); await sleep(200); await pick(2);      // (day 3 opens with her offer: refused)
  at(hilotSpot.x, hilotSpot.z + 0.9); hold("KeyE", 0.6); await sleep(50); await pick(1);
  check("the hilot asks for her mother's rosary", G().favours.some((f) => f.id === "rosary"), G().favours);
  const ruin = doorOf(house("ruin1")); at(ruin.x, ruin.z + 0.5); hold("KeyE", 2.5);
  const charms0 = G().charms.length; at(hilotSpot.x, hilotSpot.z + 0.9); hold("KeyE", 0.6); await sleep(50); await skipTalk();
  check("found in the empty house and given back: a charm for it", G().rosaryDone && G().charms.length === charms0 + 1, { done: G().rosaryDone, charms: G().charms.length });
  const xp0 = G().xp + G().level * 1000; G().findTale();
  check("an old tale goes in the book", G().tales.length === 1 && G().xp + G().level * 1000 > xp0, G().tales);

  // ---------- the fix pass: one-time sitio loot, hit-stop, keyboard panels, the saved game
  const chest = nodes.find((n) => n.rich && n.kind === "baul")!;
  G().set({ stage: "day" }); at(chest.x, chest.z + 0.9); hold("KeyE", 3.2);
  G().set({ searched: [] });                           // (as on the next day)
  check("the sitio's chests are emptied once, for good", G().emptied.includes(chest.id) && !prompt("E").includes("chest"), { emptied: G().emptied, prompt: prompt("E") });
  G().set({ stage: "night" }); live.freeze = 0; hitStop(0.1); dev().run(0.05, 60);
  const slow = live.timeScale; run(0.3);
  check("a hit-stop slows the game for a moment, then lets go", slow < 0.2 && live.timeScale === 1 && live.freeze === 0, { slow, after: live.timeScale });
  G().set({ stage: "day" }); G().setPanel("pause"); await sleep(350);
  const first = document.activeElement?.textContent ?? "";
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown" })); await sleep(30);
  const second = (document.activeElement?.closest(".setting") ?? document.activeElement)?.textContent ?? "";   // the Sound row's first switch
  check("panels work from the keyboard: something is selected on opening, and the arrows move", first.includes("Go on") && second.includes("How to play"), { first, second });
  G().setPanel(null); await sleep(50);
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Slash" })); await sleep(250);
  const guideOpen = G().panel === "guide" && !!document.querySelector(".guidebook"), firstPage = document.querySelector(".guidebook .steps")?.children.length ?? 0;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Slash" })); await sleep(50);
  check("? opens the guide on how to play (four steps), and closes it again", guideOpen && firstPage === 4 && G().panel === null, { guideOpen, firstPage, panel: G().panel });
  G().setPanel(null);
  // the saved game: versioned, backed up, and a damaged save falls back to the backup
  G().set({ night: 3, stage: "morning" }); G().nextDay(); await sleep(200); await skipTalk();
  G().set({ stage: "morning" }); G().nextDay(); await sleep(200); await skipTalk();
  const good = JSON.parse(localStorage.getItem("aswang-night-save-v1") ?? "{}");
  check("the save carries a version stamp and a backup", good.version === 2 && !!localStorage.getItem("aswang-night-save-v1-backup"), { version: good.version });
  localStorage.setItem("aswang-night-save-v1", "{\"version\": 2, \"nig");
  const back = loadSave();
  check("a damaged save falls back to the backup", !!back && back.night === 4, back?.night);
  localStorage.setItem("aswang-night-save-v1", JSON.stringify({ ...good, version: 99 }));
  localStorage.removeItem("aswang-night-save-v1-backup");
  check("a save from a newer game is refused, not half-loaded", loadSave() === null);
  localStorage.setItem("aswang-night-save-v1", JSON.stringify({ ...good, version: undefined, night: 2, bag: { coins: -5, salt: "x" } }));
  const old = loadSave();
  check("an old unstamped save loads, with bad numbers put right", !!old && old.night === 2 && old.bag.coins === 0 && old.bag.salt === 0 && old.kit.itak === false, old?.bag);

}

function report() {
  const pre = document.createElement("pre");
  pre.id = "selftest";
  const failed = results.filter((r) => !r.ok);
  pre.textContent = `SELF-TEST ${results.length - failed.length}/${results.length} passed\n` + results.map((r) => `${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : "   <- " + r.note}`).join("\n");
  pre.style.cssText = "position:fixed;inset:0;z-index:99;margin:0;padding:20px;overflow:auto;background:#07070a;color:#e9e3d6;font:13px/1.5 Consolas,monospace";
  document.body.appendChild(pre);
}

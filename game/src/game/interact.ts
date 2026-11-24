/**
 * Everything the player can do by standing next to something. Rebuilt from the game state each frame,
 * so a thing offers itself only when it makes sense (the well only when water is wanted, and so on).
 * E is the main action; G lays a protection at one of the house's openings.
 */
import { ITEMS, ItemId, NODE, rollLoot, aCharm } from "./data";
import { doorOf, firePit, hidingSpots, home, house, kapreSpot, nodes, openings, well } from "./layout";
import { Game, live, mods, rnd } from "./state";
import { KADYO_DAY, PACING_DAY, PROOF_TEXT, ROSING_SAYS } from "./story";

export type Interactable = {
  key: string; button: "E" | "G"; x: number; z: number; r: number;
  label: string; hold: number; act?: () => void;          // no `act`: shown greyed, as a reason
};

const DOOR = doorOf(home);
const KADYO = doorOf(house("kadyo"));
const HILOT = doorOf(house("hilot"));
/** Where an offering is left: on the ground at the kapre's feet. */
export const BALETE_ROOTS = { x: kapreSpot.x + 1.5, z: kapreSpot.z + 1.5 };

function list(found: Partial<Record<ItemId, number>>) {
  return (Object.keys(found) as ItemId[]).map((k) => `${found[k]} ${ITEMS[k].name.toLowerCase()}`).join(", ");
}

export function interactables(g: Game): Interactable[] {
  const out: Interactable[] = [];
  const m = mods(g);
  const night = g.stage === "night", day = g.stage === "day";
  const e = g.errand && !g.errand.done ? g.errand : null;

  // ---- things to search
  for (const n of nodes) {
    if (g.searched.includes(n.id)) continue;
    out.push({
      key: `node${n.id}`, button: "E", x: n.x, z: n.z, r: 1.35, label: NODE[n.kind].verb, hold: NODE[n.kind].seconds * m.search,
      act: () => {
        const { found, charm } = rollLoot(n.kind, n.rich, m.loot, rnd);
        const got: Partial<Record<ItemId, number>> = {};
        let left = false;
        for (const k of Object.keys(found) as ItemId[]) { const t = g.add(k, found[k]!); if (t) got[k] = t; if (t < found[k]!) left = true; }
        g.markSearched(n.id);
        g.gainXp(NODE[n.kind].xp);
        g.toast(Object.keys(got).length ? `Found: ${list(got)}${left ? ". You cannot carry the rest." : ""}` : "You cannot carry any more.", left ? "plain" : "good");
        if (charm) { const c = g.addCharm(n.rich ? 0.04 : 0); g.toast(`Hidden at the bottom: ${aCharm(c)}.`, "good"); g.gainXp(15); }
      },
    });
  }

  // ---- the house's openings (G)
  for (const o of openings) {
    if (g.wards[o.id]) continue;
    const first: ItemId = o.id === "door" ? "salt" : "garlic", second: ItemId = o.id === "door" ? "garlic" : "salt";
    const kind = g.bag[first] > 0 ? first : g.bag[second] > 0 ? second : null;
    out.push({
      key: `ward-${o.id}`, button: "G", x: o.x, z: o.z, r: 1.5, hold: 0.9,
      label: kind ? (kind === "salt" ? `Lay salt across ${o.name}` : `Hang garlic at ${o.name}`) : `Nothing protects ${o.name}`,
      act: kind ? () => { if (g.setWard(o.id, kind as "salt" | "garlic")) g.gainXp(3); } : undefined,
    });
  }

  // ---- the door (E): one thing at a time, the most urgent first
  const door = (label: string, hold: number, act?: () => void) => out.push({ key: "door", button: "E", x: DOOR.x, z: DOOR.z, r: 1.7, label, hold, act });
  if (g.onRoof && night) door("Strike the house post!", 0.7, () => { live.struck = true; });
  else if (g.carrying === "water") door("Give Rosing the water", 1, () => { g.set({ carrying: null }); g.say("Rosing", ROSING_SAYS.water); g.stepErrand(); });
  else if (g.carrying === "lana") door("Give Rosing the oil", 1, () => { g.set({ carrying: null }); g.say("Rosing", ROSING_SAYS.lana); g.stepErrand(); });
  else if (e && ((e.id === "hilot" && e.step === 1) || (e.id === "kapre" && e.step === 2))) door("Tell Rosing you are back", 0.8, () => { g.say("Rosing", ROSING_SAYS.home); g.stepErrand(); });
  else if (day && !g.rationTaken) door("Take salt, garlic and oil from the kitchen", 1, () => {
    g.set({ rationTaken: true });
    const got = { salt: g.add("salt", g.night === 1 ? 1 : 2), garlic: g.add("garlic", 1), oil: g.add("oil", 5) };
    g.toast(`From the kitchen: ${list(got)}`, "good");
    g.hint("wards", "Stand at the door or beside a window and hold G to protect it. You never have enough for all three.");
  });
  else if (day && !g.dialogue) door("Wait for dusk", 1.8, () => g.startNight());
  else door("Speak to Rosing", 0.5, () => g.say("Rosing", ROSING_SAYS.idle[Math.floor(rnd() * ROSING_SAYS.idle.length)]));

  // ---- the smudge fire
  out.push({
    key: "fire", button: "E", x: firePit.x, z: firePit.z, r: 1.5, hold: 1.1,
    label: g.bag.kindling > 0 ? `Feed the smudge fire${live.smoke > 0 ? " again" : ""}` : "The smudge fire needs kindling",
    act: g.bag.kindling > 0 ? () => { g.spend("kindling", 1); live.smoke = Math.min(160, live.smoke + 70); g.gainXp(3); } : undefined,
  });

  // ---- errands
  if (e?.id === "water" && e.step === 0) out.push({ key: "well", button: "E", x: well.x, z: well.z, r: 2.1, label: "Draw water", hold: 3.6, act: () => { g.set({ carrying: "water" }); g.stepErrand(); } });
  if (night && e?.id === "lana" && e.step === 0) out.push({
    key: "kadyo", button: "E", x: KADYO.x, z: KADYO.z, r: 1.7, label: "Knock, and ask for the oil", hold: 1.6,
    act: () => { g.set({ carrying: "lana", hasLana: true }); g.say("Nong Kadyo", "Here. Carry it at your hip. When it boils, one of them is near. Now go, she is alone."); g.stepErrand(); },
  });
  if (night && e?.id === "hilot" && e.step === 0) out.push({
    key: "hilot", button: "E", x: HILOT.x, z: HILOT.z, r: 1.7, label: "Call up to the hilot", hold: 1.6,
    act: () => { live.hilotOut = 10; g.say("The hilot", "Rosing's brother? I know. I will come when it is time. Go back to her. And mind the trail."); g.add("herbs", 2); g.stepErrand(); },
  });

  // ---- Nong Kadyo by day: talk first, then trade
  if (day) out.push({
    key: "kadyo", button: "E", x: KADYO.x, z: KADYO.z, r: 1.7, hold: 0.4, label: g.talked.includes("kadyo") ? "Trade with Nong Kadyo" : "Talk to Nong Kadyo",
    act: () => {
      if (g.talked.includes("kadyo")) { g.setPanel("trade"); return; }
      g.set({ talked: [...g.talked, "kadyo"], kadyoTrust: g.kadyoTrust + 1 });
      g.gainXp(10);
      g.talk(KADYO_DAY[g.night] ?? [], () => g.setPanel("trade"));
    },
  });
  // ---- Nang Pacing by day
  if (day && live.pacing.here) out.push({
    key: "pacing", button: "E", x: live.pacing.x, z: live.pacing.z, r: 1.9, hold: 0.4, label: "Talk to Nang Pacing",
    act: () => {
      const first = !g.talked.includes("pacing");
      g.set({ talked: [...g.talked, "pacing"] });
      if (g.hasLana && !g.proofs.oil) { g.set({ proofs: { ...g.proofs, oil: true } }); g.gainXp(25); g.talk([{ who: "", text: PROOF_TEXT.oil }, { who: "Nang Pacing", text: "What is that you carry, Dong? ...No matter. Good day." }]); }
      else if (first && g.night === 1) g.talk(PACING_DAY[1]);
      else g.talk([{ who: "Nang Pacing", text: ["Go and sit with your sister, Dong.", "Such a quiet barrio, no? Nothing ever happens here.", "You should rest. You will need your strength tonight."][Math.floor(rnd() * 3)] }]);
    },
  });

  // ---- the balete and what stands in its roots
  if (night && g.kapre !== "friend") out.push({
    key: "roots", button: "E", x: BALETE_ROOTS.x, z: BALETE_ROOTS.z, r: 1.8, hold: 1.4,
    label: g.bag.tobacco > 0 ? "Leave tobacco at the giant's feet" : "You have nothing to offer him",
    act: g.bag.tobacco > 0 ? () => {
      g.spend("tobacco", 1); g.set({ kapre: "friend" }); g.gainXp(30);
      g.toast("He takes it without a word. The ember brightens, then dips once toward the far side of the roots.", "good");
      if (e?.id === "kapre" && e.step === 0) g.stepErrand();
    } : undefined,
  });
  if (night && g.form === "air" && g.mana !== "ended" && g.mana !== "dead" && g.mana !== "absent") {
    const s = hidingSpots[g.legsAt];
    if (!g.legsSeen) out.push({
      key: "legs", button: "E", x: s.x, z: s.z, r: 1.9, label: "Look closer", hold: 1.2,
      act: () => {
        g.set({ legsSeen: true });
        if (!g.proofs.skirt) { g.set({ proofs: { ...g.proofs, skirt: true } }); g.gainXp(30); }
        g.toast(PROOF_TEXT.skirt);
        if (e?.id === "kapre" && e.step === 1) g.stepErrand();
      },
    });
    else out.push({
      key: "legs", button: "E", x: s.x, z: s.z, r: 1.9, hold: 1.5,
      label: g.bag.salt > 0 ? "Pour salt on the stump" : "You have no salt for the stump",
      act: g.bag.salt > 0 ? () => {
        g.spend("salt", 1); g.gainXp(40);
        if (g.night === 5) { g.set({ mana: "dead", overhead: false, onRoof: false }); g.toast("She cannot join herself again. It is finished. Hold the house until cockcrow.", "good"); if (e?.id === "legs") g.stepErrand(); }
        else { g.set({ mana: "ended", overhead: false, onRoof: false }); g.toast("Her body is salted. She cannot come back to it tonight.", "good"); }
      } : undefined,
    });
  }
  return out;
}

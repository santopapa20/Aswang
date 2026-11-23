/**
 * What the player should be doing right now, in one line, and where. The interface shows it as a card
 * and an arrow; nothing in the game depends on it.
 */
import { doorOf, firePit, hidingSpots, home, house, openings, P2, well } from "./layout";
import { BALETE_ROOTS as ROOTS } from "./interact";
import { Game, live } from "./state";

export type Objective = { title: string; text: string; target: P2 | null; urgent: boolean };

const DOOR = doorOf(home);
const KADYO = doorOf(house("kadyo"));
const HILOT = doorOf(house("hilot"));
const one = (title: string, text: string, target: P2 | null = null, urgent = false): Objective => ({ title, text, target, urgent });

export function objective(g: Game): Objective {
  if (g.stage === "day") {
    if (!g.rationTaken) return one("Rosing's house", "Go to the door and take the day's salt, garlic and lamp oil.", DOOR);
    const open = openings.find((o) => !g.wards[o.id]);
    if (open && (g.bag.salt > 0 || g.bag.garlic > 0)) return one("Protect the house", `Hold G at ${open.name}. You will not have enough for every opening.`, open);
    if (!g.talked.includes("kadyo")) return one("Before dark", "Nong Kadyo knows what is coming tonight. His hut is to the north-east. Or search, and wait at the door when ready.", KADYO);
    return one("Before dark", "Search for supplies while there is light. Wait at Rosing's door when you are ready for the night.", live.clock < 40 ? DOOR : null);
  }
  if (g.stage !== "night") return one("", "", null);

  // the house under attack comes before everything else
  if (g.onRoof) {
    return g.bag.kindling > 0
      ? one("On the roof", "Feed the smudge fire. The smoke will drive it off.", firePit, true)
      : one("On the roof", "Strike the house post at the door. Then run sideways.", DOOR, true);
  }
  if (live.breachAt && live.breach > 0) {
    const o = openings.find((x) => x.id === live.breachAt)!;
    return one("At the house", `It is at ${o.name}. Bring your lamp to it.`, o, true);
  }
  if (g.lost && live.loops >= 3) return one("Led astray", "Stop walking. Hold T to turn your shirt inside out.", null, true);

  const e = g.errand;
  if (g.carrying === "water") return one("Water for Rosing", "Carry the water back to her door.", DOOR);
  if (g.carrying === "lana") return one("The albularyo's oil", "Bring the oil home to Rosing.", DOOR);
  if (e && !e.done) {
    if (e.id === "water") return one("Water for Rosing", "Draw water at the well.", well);
    if (e.id === "lana") return one("The albularyo's oil", "Knock at Nong Kadyo's hut and ask for the oil.", KADYO);
    if (e.id === "hilot") return e.step === 0 ? one("Call the hilot", "Take the trail east to the old sitio. Call at her lit window.", HILOT) : one("Call the hilot", "Go home.", DOOR);
    if (e.id === "kapre") {
      if (e.step === 0) return one("The one in the balete", g.bag.tobacco > 0 ? "Leave tobacco at the giant's feet. Walk. Do not run under the tree." : "You need tobacco. Old chests sometimes hold it.", ROOTS);
      if (e.step === 1) return one("The one in the balete", "Something stands in the roots on the far side. Look closer.", hidingSpots[0]);
      return one("The one in the balete", "Go home.", DOOR);
    }
    if (e.id === "legs") {
      const shown = g.kapre === "friend" && g.mana === "hunting";
      return one("End it", shown ? "Follow the ember to her legs and salt them before cockcrow." : "Find where she hid her legs and salt them before cockcrow.", shown ? hidingSpots[g.legsAt] : null);
    }
  }
  const away = Math.hypot(live.player.x - home.x, live.player.z - home.z) > 14;
  if (g.mana === "dead") return one("Hold until cockcrow", "It is finished. Stay with the house until the light comes.", away ? DOOR : null);
  return one("Keep watch", away ? "The house is unguarded. Go back." : "Stay by the house. Listen: loud is far, faint is near.", away ? DOOR : null);
}

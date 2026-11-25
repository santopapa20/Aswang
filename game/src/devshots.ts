/**
 * Development only. Opening the game with #shot=<name> puts it straight into a chosen moment, so a
 * headless browser can photograph each screen (see README, "Checking the screens"). Never loaded in a build.
 */
import { live, useGame } from "./game/state";
import { benchSpot, doorOf, hilotSpot, home, house } from "./game/layout";

const HILOT = doorOf(house("hilot"));

type Dev = { run: (seconds: number, fps?: number) => void; show: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const G = () => useGame.getState();
const dev = () => (window as unknown as { __aswang: Dev }).__aswang;
const key = (code: string, down = true) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
const hold = (code: string, seconds: number) => { key(code); dev().run(seconds); key(code, false); };
const at = (x: number, z: number) => { live.player.set(x, 0, z); dev().run(0.4); };
const stocked = { salt: 3, garlic: 2, oil: 9, kindling: 3, tobacco: 1, herbs: 7, coins: 34 };

async function begin(night = 1) {
  G().newGame();
  await sleep(300);
  G().set({ dialogue: null, banner: null, night, bag: { ...stocked }, rationTaken: true });
  await sleep(200);
}
async function dusk(night = 1, wards = true) {
  await begin(night);
  if (wards) G().set({ wards: { door: "salt", west: "garlic", east: null } });
  G().startNight();
  await sleep(500);
  G().set({ banner: null });
}

/** Night 3 with the given face out on the path, and him a few steps from it. */
const walker = async (look: "farmer" | "priest" | "nurse") => {
  await dusk(3); live.guiseLook = look; live.elapsed = 30; at(-30, 25);
  const w = live.kin.guise[["farmer", "priest", "nurse"].indexOf(look)];
  for (let k = 0; k < 300 && w.mode !== "stroll"; k++) dev().run(0.1);
  at(w.x + 3.6, w.z + 1.2); dev().run(0.6);
  return w;
};
const SHOTS: Record<string, () => Promise<void>> = {
  title: async () => {},
  intro: async () => { G().newGame(); await sleep(300); G().set({ banner: null }); G().advance(); G().advance(); },
  banner: async () => { await begin(2); G().startNight(); await sleep(1500); },
  day: async () => { await begin(1); G().set({ rationTaken: false, bag: { ...stocked, salt: 0, garlic: 0, oil: 0, kindling: 0, tobacco: 0, herbs: 0, coins: 0 } }); at(-9, 16); },
  door: async () => { await begin(1); at(-18, 13.3); },
  plaza: async () => { await begin(2); at(2, 9); },
  sitio: async () => { await begin(2); at(115.6, -7.4); key("KeyE"); dev().run(1.2); },
  night: async () => { await dusk(1); at(-17, 14.5); dev().run(8); },
  breach: async () => {
    await dusk(1); at(2, 6);
    for (let i = 0; i < 160 && live.breach < 0.45; i++) dev().run(1);
    at(live.aswang.x + 3.4, live.aswang.z + 4.4);
  },
  hunted: async () => { await dusk(1); at(8, 24); G().set({ hunted: true }); live.aswang.near = 4; dev().run(0.2); },
  roof: async () => {
    await dusk(2); at(-17, 15);
    for (let i = 0; i < 160 && !G().onRoof; i++) dev().run(1);
    dev().run(4);
  },
  trail: async () => { await dusk(3); at(61, 0.6); dev().run(2); },
  balete: async () => { await dusk(4); at(-26.2, -14.2); dev().run(22); at(-26, -14); },
  kapre: async () => { await dusk(4); at(-27, -15); key("ShiftLeft"); key("KeyA"); dev().run(1.0); key("KeyA", false); key("ShiftLeft", false); dev().run(1.6); },
  sigbin: async () => {
    await dusk(5); at(-11, 17); live.elapsed = 45; dev().run(1);
    live.sigbin.x = live.player.x + 4.2; live.sigbin.z = live.player.z + 1.2; dev().run(6);
  },
  sigbinDark: async () => {
    await dusk(5); at(-11, 17); live.elapsed = 45; dev().run(1);
    live.sigbin.x = live.player.x + 4.2; live.sigbin.z = live.player.z + 1.2; dev().run(5);
    G().set({ lampOn: false }); dev().run(2.5);
  },
  hilot: async () => { await begin(3); at(hilotSpot.x + 1.6, hilotSpot.z + 3.2); dev().run(2); },
  hilotDoor: async () => {
    await dusk(3); live.elapsed = 60; at(HILOT.x + 0.4, HILOT.z + 0.6); dev().run(1);
    live.hilotOut = 10; G().say("The hilot", "Rosing's brother? I know. I will come when it is time."); dev().run(2.5);
  },
  amalanhig: async () => { await dusk(3); live.elapsed = 60; at(102.6, 6.2); dev().run(3.3); },
  amalanhigRise: async () => { await dusk(3); live.elapsed = 60; at(102.6, 6.2); dev().run(1.4); },
  amalanhigDown: async () => {
    await dusk(3); live.elapsed = 60; G().set({ hasWhip: true }); at(99.5, 10.3); dev().run(3.2);
    for (let i = 0; i < 3; i++) {
      const a = live.amalanhig[0];
      for (let k = 0; k < 60 && Math.hypot(a.x - live.player.x, a.z - live.player.z) > 2.6; k++) dev().run(0.1);
      live.whipWait = 0; live.stamina = 1; hold("KeyR", 0.2); dev().run(0.3);
    }
    dev().run(1.5);
  },
  fight: async () => {
    await dusk(3); live.elapsed = 60; G().set({ hasWhip: true }); at(100.5, 7.5); dev().run(3.2);
    const a = live.amalanhig[0];
    for (let k = 0; k < 60 && Math.hypot(a.x - live.player.x, a.z - live.player.z) > 2.6; k++) dev().run(0.1);
    live.whipWait = 0; hold("KeyR", 0.2); dev().run(0.4);
    const h = live.health;
    for (let k = 0; k < 60 && live.health >= h; k++) dev().run(0.1);
    dev().run(0.25);
  },
  night5: async () => { await dusk(5); live.elapsed = 30; dev().run(2); },
  dogs: async () => {
    await dusk(2); G().set({ hasWhip: true, bounties: [{ id: 1, kind: "dog", count: 2, got: 0, coins: 12, xp: 40, text: "", night: 2, state: "taken" }] });
    live.elapsed = 30; at(-20, -8);
    const up = () => live.kin.dog.filter((d) => !["away", "dead", "dying"].includes(d.mode));
    for (let k = 0; k < 300 && up().length < 2; k++) dev().run(0.1);
    const d = up()[0]; if (d) at(d.x + 5.5, d.z + 1.5);
    dev().run(1.3);
  },
  crawler: async () => {
    await dusk(3); live.elapsed = 30; at(5, -5);
    const c = live.kin.crawler[0];
    for (let k = 0; k < 300 && c.mode !== "prowl"; k++) dev().run(0.1);
    at(c.x + 4.5, c.z + 1.5); dev().run(1.0);
  },
  // a kin in human guise on the path (the farmer), and one shown up by garlic (the nurse)
  guise: async () => { await walker("farmer"); },
  unmasked: async () => { const w = await walker("nurse"); w.unmask = true; dev().run(0.6); },
  stakes: async () => {
    await begin(3); G().set({ kit: { ...G().kit, hedge: true } }); await sleep(200);
    at(home.x - 4.5, home.z + 8); dev().run(0.5);
  },
  work: async () => {
    await begin(3);
    G().set({ bounties: [
      { id: 1, kind: "dog", count: 2, got: 2, coins: 12, xp: 40, text: "Two dogs run the north field at night.", night: 2, state: "done" },
      { id: 2, kind: "dog", count: 2, got: 0, coins: 12, xp: 40, text: "The dogs are back. Two of them again.", night: 3, state: "offered" },
      { id: 3, kind: "crawler", count: 1, got: 0, coins: 16, xp: 55, text: "Something goes on all fours by the shut house. Keep your lamp on it: in the dark the whip slides off.", night: 3, state: "offered" },
    ], trophies: { fang: 2, claw: 0, stone: 0 } });
    at(24, -18.7); G().setPanel("trade");
  },
  bench: async () => {
    await begin(3); G().set({ hasWhip: true, trophies: { fang: 4, claw: 1, stone: 0 }, kit: { ...G().kit, itak: true, pouch: 2, string: 0, bars: { west: false, east: false }, barbs: false, lash: false } });
    at(benchSpot.x, benchSpot.z + 0.7); G().setPanel("bench");
  },
  yard: async () => { await begin(3); at(benchSpot.x + 1.5, benchSpot.z + 2.6); dev().run(0.5); },
  favour: async () => {
    await begin(2); G().set({ rationTaken: true, favours: [{ id: "herbs", state: "taken" }, { id: "hair", state: "taken" }] });
    at(-18.27, 13.2); hold("KeyE", 0.7); await sleep(200); live.skipTyping = true;
  },
  // the bag's other pages: press its tab once the bag is open
  bagCharms: async () => { await SHOTS.bag(); await sleep(150); [...document.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => /Charms/.test(b.textContent ?? ""))?.click(); await sleep(200); },
  bagLearning: async () => { await SHOTS.bag(); await sleep(150); [...document.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => /Learning/.test(b.textContent ?? ""))?.click(); await sleep(200); },
  bagTales: async () => { await SHOTS.tales(); await sleep(150); [...document.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => /tales/i.test(b.textContent ?? ""))?.click(); await sleep(200); },
  tales: async () => { await begin(3); G().set({ tales: ["aswang", "sigbin", "amalanhig"] }); G().setPanel("bag"); },
  bag: async () => { await begin(3); for (let i = 0; i < 4; i++) G().addCharm(i * 0.03); G().gainXp(150); G().set({ hasWhip: true, proofs: { salt: true, oil: false, skirt: false } }); G().setPanel("bag"); },
  trade: async () => { await begin(2); at(24, -18.7); G().setPanel("trade"); },
  pause: async () => { await dusk(1); G().setPanel("pause"); },
  morning: async () => { await dusk(1); dev().run(20); hold("KeyE", 0.2); live.clock = 1; dev().run(2); await sleep(600); },
  ending: async () => { await dusk(5); G().set({ mana: "dead", kadyoTrust: 3, proofs: { salt: true, oil: true, skirt: true } }); live.clock = 1; dev().run(2); await sleep(600); },
  lost: async () => { await dusk(1); G().set({ rosing: 1 }); G().breach("It got in through the east window."); await sleep(600); },
  talk: async () => { await begin(3); G().set({ banner: null }); G().nextDay(); await sleep(300); G().set({ banner: null }); for (let i = 0; i < 3; i++) { live.skipTyping = true; await sleep(120); G().advance(); } live.skipTyping = true; },
};

export async function runShot(name: string) {
  for (let i = 0; i < 700 && !(typeof dev()?.run === "function" && live.fps > 0); i++) await sleep(150);
  if (name === "selftest") await (await import("./devtest")).selfTest();
  else if (/^at_/.test(name)) {
    // at_<x>_<z>_<d|n>: stand anywhere on the map by day or by night (for looking the map over)
    const [, x, z, when] = name.split("_");
    if (when === "n") await dusk(1); else await begin(1);
    at(+x, +z); dev().run(when === "n" ? 5 : 1.5);
  }
  else await (SHOTS[name] ?? SHOTS.title)();
  dev().show?.();
  document.title = `shot ${name} ready`;
}

/**
 * Development only. Opening the game with #shot=<name> puts it straight into a chosen moment, so a
 * headless browser can photograph each screen (see README, "Checking the screens"). Never loaded in a build.
 */
import { live, useGame } from "./game/state";

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
  balete: async () => { await dusk(4); at(-22.8, -16.4); dev().run(22); at(-23, -16.6); },
  bag: async () => { await begin(3); for (let i = 0; i < 4; i++) G().addCharm(i * 0.03); G().gainXp(150); G().set({ hasWhip: true, proofs: { salt: true, oil: false, skirt: false } }); G().setPanel("bag"); },
  trade: async () => { await begin(2); at(24, -18.7); G().setPanel("trade"); },
  pause: async () => { await dusk(1); G().setPanel("pause"); },
  morning: async () => { await dusk(1); dev().run(20); hold("KeyE", 0.2); live.clock = 1; dev().run(2); await sleep(600); },
  ending: async () => { await dusk(5); G().set({ mana: "dead", kadyoTrust: 3, proofs: { salt: true, oil: true, skirt: true } }); live.clock = 1; dev().run(2); await sleep(600); },
  lost: async () => { await dusk(1); G().set({ rosing: 1 }); G().breach("It got in through the east window."); await sleep(600); },
  talk: async () => { await begin(3); G().set({ banner: null }); G().nextDay(); await sleep(300); G().set({ banner: null }); for (let i = 0; i < 3; i++) { live.skipTyping = true; await sleep(120); G().advance(); } live.skipTyping = true; },
};

export async function runShot(name: string) {
  for (let i = 0; i < 200 && !(typeof dev()?.run === "function" && live.fps > 0); i++) await sleep(150);
  if (name === "selftest") await (await import("./devtest")).selfTest();
  else await (SHOTS[name] ?? SHOTS.title)();
  dev().show?.();
  document.title = `shot ${name} ready`;
}

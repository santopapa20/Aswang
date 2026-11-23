import { create } from "zustand";
import { Vector3 } from "three";
import { BASE_CARRY, Charm, ITEMS, ItemId, MAX_RANK, PerkId, WORN_CHARMS, makeCharm, xpForLevel } from "./data";
import { hidingSpots, home, HUT, OpeningId, START } from "./layout";
import type { Objective } from "./objective";
import { ENDINGS, ERRANDS, ErrandId, Form, INTRO, Line, NIGHTS, PACING_DAY, PACING_KNOWS, PACING_TRUSTED, PROOF_TEXT, ROSING_SAYS } from "./story";

export type Stage = "title" | "day" | "night" | "morning" | "over" | "ending";
export type WardKind = "salt" | "garlic";
/** A line of salt on the ground, from point A to point B. The aswang cannot cross it. */
export type SaltLine = { ax: number; az: number; bx: number; bz: number };
export type Dialogue = { lines: Line[]; index: number; choices?: { text: string; pick: () => void }[]; then?: () => void };
export type Panel = null | "bag" | "trade" | "pause";
export type Toast = { id: number; text: string; tone: "good" | "bad" | "plain" };
export const SHIRT_SECONDS = 2;
const SAVE_KEY = "aswang-night-save-v1";

const emptyBag = (): Record<ItemId, number> => ({ salt: 0, garlic: 0, oil: 0, kindling: 0, tobacco: 0, herbs: 0, coins: 0 });
const noPerks = (): Record<PerkId, number> => ({ lungs: 0, softstep: 0, wick: 0, firmhand: 0, pockets: 0, quickhands: 0, fleet: 0, strongarm: 0, scavenger: 0 });

/** Everything that is kept between sessions. */
const freshRun = () => ({
  night: 1,
  rosing: 3,                                   // her strength: each breach takes one, at none she is lost
  bag: emptyBag(),
  charms: [] as Charm[],
  worn: [] as number[],
  nextCharm: 1,
  xp: 0, level: 1, points: 0, perks: noPerks(),
  wards: { door: null, west: null, east: null } as Record<OpeningId, WardKind | null>,
  proofs: { oil: false, salt: false, skirt: false },
  hasWhip: false, hasLana: false,
  kapre: "unknown" as "unknown" | "angry" | "friend",
  trusted: null as boolean | null,             // did he let Pacing sit with Rosing on the third night
  kadyoTrust: 0,
  tonicOn: 0,                                  // the day he last bought Rosing a tonic (one a day)
  seen: [] as string[],                        // one-time hints already shown
});
/** Everything that belongs to the current day or night only. */
const freshNight = () => ({
  lines: [] as SaltLine[],
  searched: [] as number[],
  errand: null as { id: ErrandId; step: number; done: boolean } | null,
  carrying: null as "water" | "lana" | null,
  form: "foot" as Form,
  legsAt: 0, legsSeen: false,
  mana: "absent" as "absent" | "hunting" | "ended" | "dead",
  hunted: false, overhead: false, onRoof: false,
  shirt: false, lost: false,
  lampOn: true,
  rationTaken: false,
  talked: [] as string[],
  tally: { held: 0, breaches: 0, searched: 0, xp: 0 },
});

type GameState = ReturnType<typeof freshRun> & ReturnType<typeof freshNight> & {
  stage: Stage;
  runId: number;          // goes up whenever a day or night begins, so characters can reset themselves
  shadows: boolean;
  muted: boolean;
  dialogue: Dialogue | null;
  panel: Panel;
  caption: { who: string; text: string; id: number } | null;
  toasts: Toast[];
  report: string[];
  ending: string | null;  // a key of ENDINGS, or "choice" while he decides
  banner: { big: string; small: string; id: number } | null;   // the card shown as a day or night begins

  newGame: () => void;
  continueGame: () => boolean;
  startNight: () => void;
  endNight: (cause: "dawn" | "caught") => void;
  nextDay: () => void;
  chooseEnding: (key: "take" | "refuse" | "sealed") => void;
  toTitle: () => void;

  add: (item: ItemId, n: number) => number;
  spend: (item: ItemId, n: number) => boolean;
  gainXp: (n: number) => void;
  spendPoint: (perk: PerkId) => void;
  addCharm: (bonus?: number) => Charm;
  wear: (id: number) => void;

  setWard: (id: OpeningId, kind: WardKind) => boolean;
  testWard: (id: OpeningId) => "held" | "open";
  breach: (text: string) => void;
  markSearched: (id: number) => void;
  pourSalt: (line: SaltLine) => boolean;
  useGarlic: () => boolean;

  setErrand: (id: ErrandId) => void;
  stepErrand: () => void;
  set: (patch: Partial<GameState>) => void;
  say: (who: string, text: string) => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  hint: (key: string, text: string) => void;
  talk: (lines: Line[], then?: () => void, choices?: Dialogue["choices"]) => void;
  advance: () => void;
  setPanel: (p: Panel) => void;
  toggleShadows: () => void;
  toggleMute: () => void;
};

let ids = 1;
export const ROMAN = ["I", "II", "III", "IV", "V"];
let rndSeed = (Date.now() % 100000) + 7;
export const rnd = () => { rndSeed = (rndSeed * 16807) % 2147483647; return (rndSeed & 0xffffff) / 0x1000000; };

export const useGame = create<GameState>((set, get) => ({
  ...freshRun(),
  ...freshNight(),
  stage: "title",
  runId: 0,
  shadows: false,
  muted: false,
  dialogue: null,
  panel: null,
  caption: null,
  toasts: [],
  report: [],
  ending: null,
  banner: null,

  newGame: () => {
    set((s) => ({ ...freshRun(), ...freshNight(), stage: "day", runId: s.runId + 1, dialogue: null, panel: null, caption: null, toasts: [], report: [], ending: null }));
    live.player.set(START.x, 0, START.z);
    live.facing = Math.PI; live.smoke = 0;
    beginClock(NIGHTS[0].daySeconds);
    set({ banner: { big: "Day I", small: "Before dark", id: ids++ } });
    get().talk(INTRO);
  },
  continueGame: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      set((s) => ({ ...freshRun(), ...saved, ...freshNight(), stage: "day", runId: s.runId + 1, dialogue: null, panel: null, caption: null, toasts: [], report: [], ending: null }));
      placeAtHome();
      beginClock(NIGHTS[get().night - 1].daySeconds);
      return true;
    } catch { return false; }
  },
  startNight: () => {
    const s = get();
    const plan = NIGHTS[s.night - 1];
    save();
    set({
      ...freshNight(), stage: "night", runId: s.runId + 1, form: plan.form, panel: null, dialogue: null,
      // on the last night she hides her legs somewhere new; before that, in the roots of the balete
      legsAt: s.night === 5 ? 1 + Math.floor(rnd() * (hidingSpots.length - 1)) : 0,
      mana: "absent",
    });
    beginClock(plan.seconds);
    live.lampBlown = 0; live.breach = 0; live.breachAt = null; live.loops = 0;      // smoke from a fire fed before dusk carries over
    set({ banner: { big: `Night ${ROMAN[s.night - 1]}`, small: plan.name, id: ids++ } });
  },
  endNight: (cause) => {
    const s = get();
    if (s.stage !== "night") return;
    const report: string[] = [];
    let rosing = s.rosing;
    if (cause === "caught") {
      report.push("It caught you in the dark. You woke at cockcrow, cold, with the lamp out.");
      report.push("The house stood unguarded for the rest of the night.");
      rosing -= 1;
    } else report.push("The first cock crows. The night is over.");
    if (cause === "caught" && s.errand && !s.errand.done) report.push(`${ERRANDS[s.errand.id].title}: abandoned.`);     // being caught is its own cost
    else if (s.errand && !s.errand.done && !(s.errand.id === "legs")) {
      report.push(`${ERRANDS[s.errand.id].title}: left undone. Rosing paid for it.`);
      rosing -= 1;
    } else if (s.errand?.done && s.errand.id !== "legs") report.push(`${ERRANDS[s.errand.id].title}: done.`);
    if (s.trusted && s.night === 3) {
      report.push("Nang Pacing sat with Rosing all night. In the morning Rosing is grey, and does not remember sleeping.");
      rosing -= 1;
    }
    report.push(s.tally.breaches === 0 ? "Nothing got into the house." : `The house was entered ${s.tally.breaches === 1 ? "once" : `${s.tally.breaches} times`}.`);
    if (s.tally.held) report.push(`Your protections turned it back ${s.tally.held === 1 ? "once" : `${s.tally.held} times`}.`);
    const left = (Object.values(s.wards).filter(Boolean)).length;
    report.push(left ? `${left} of your protections still ${left === 1 ? "stands" : "stand"}.` : "No protection is left on the house.");
    rosing = Math.max(0, rosing);
    report.push(["Rosing is gone.", "Rosing is very weak. She cannot take another night like this.", "Rosing is shaken and pale.", "Rosing is frightened, but well."][rosing]);
    const bonus = 30 + (s.tally.breaches === 0 ? 20 : 0);
    set({ rosing, report, lines: [], hunted: false, overhead: false, onRoof: false, lost: false, carrying: null, dialogue: null, panel: null, caption: null });
    get().gainXp(bonus);
    live.prompts.E = live.prompts.G = null;
    if (rosing <= 0) { set({ stage: "over", ending: "empty" }); return; }
    if (s.night === 5) { set({ stage: "ending", ending: s.mana === "dead" ? "choice" : "remains" }); clearSave(); return; }
    set({ stage: "morning" });
  },
  nextDay: () => {
    const s = get();
    const night = s.night + 1;
    set({ ...freshNight(), night, stage: "day", runId: s.runId + 1, report: [], banner: { big: `Day ${ROMAN[night - 1]}`, small: "Before dark", id: ids++ } });
    placeAtHome();
    beginClock(NIGHTS[night - 1].daySeconds);
    save();
    // the morning visit
    const g = get();
    let lines = PACING_DAY[night] ?? [];
    if (night === 4 && s.trusted) lines = PACING_TRUSTED;
    if (night === 5 && Object.values(s.proofs).filter(Boolean).length >= 2) lines = PACING_KNOWS;
    const extra: Line[] = [];
    if (s.wards.door === "salt" && !s.proofs.salt) { extra.push({ who: "", text: PROOF_TEXT.salt }); set({ proofs: { ...s.proofs, salt: true } }); }
    if (s.hasLana && !s.proofs.oil) { extra.push({ who: "", text: PROOF_TEXT.oil }); set({ proofs: { ...get().proofs, oil: true } }); }
    if (extra.length) g.gainXp(25 * extra.length);
    if (night === 3) {
      g.talk([...lines, ...extra], undefined, [
        { text: "Yes. Thank you, Nang Pacing.", pick: () => { set({ trusted: true }); get().toast("Nang Pacing will sit with Rosing tonight."); } },
        { text: "No. I will not leave the house to anyone.", pick: () => { set({ trusted: false }); get().say("Nang Pacing", "As you like, Dong. As you like."); } },
      ]);
    } else g.talk([...lines, ...extra]);
  },
  chooseEnding: (key) => set({ ending: key }),
  toTitle: () => set({ stage: "title", dialogue: null, panel: null, caption: null, toasts: [], ending: null }),

  add: (item, n) => {
    const s = get();
    const room = ITEMS[item].weighs ? Math.max(0, mods(s).carry - carried(s)) : n;
    const take = Math.min(n, room);
    if (take > 0) set({ bag: { ...s.bag, [item]: s.bag[item] + take } });
    return take;
  },
  spend: (item, n) => {
    const s = get();
    if (s.bag[item] < n) return false;
    set({ bag: { ...s.bag, [item]: s.bag[item] - n } });
    return true;
  },
  gainXp: (n) => {
    let { xp, level, points } = get();
    xp += n;
    let rose = false;
    while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level += 1; points += 1; rose = true; }
    set((s) => ({ xp, level, points, tally: { ...s.tally, xp: s.tally.xp + n } }));
    if (rose) get().toast(`You have learned something. Level ${level}. Press Tab to choose.`, "good");
  },
  spendPoint: (perk) => set((s) => (s.points > 0 && s.perks[perk] < MAX_RANK ? { points: s.points - 1, perks: { ...s.perks, [perk]: s.perks[perk] + 1 } } : s)),
  addCharm: (bonus = 0) => {
    const charm = makeCharm(get().nextCharm, rnd, bonus);
    set((s) => ({ charms: [...s.charms, charm], nextCharm: s.nextCharm + 1, worn: s.worn.length < WORN_CHARMS ? [...s.worn, charm.id] : s.worn }));
    return charm;
  },
  wear: (id) => set((s) => ({ worn: s.worn.includes(id) ? s.worn.filter((w) => w !== id) : s.worn.length < WORN_CHARMS ? [...s.worn, id] : [...s.worn.slice(1), id] })),

  setWard: (id, kind) => {
    const s = get();
    if (s.wards[id] || !s.spend(kind, 1)) return false;
    set({ wards: { ...get().wards, [id]: kind } });
    return true;
  },
  testWard: (id) => {
    const s = get();
    if (!s.wards[id]) return "open";
    const holds = rnd() < mods(s).firm;
    set({ wards: holds ? s.wards : { ...s.wards, [id]: null }, tally: { ...s.tally, held: s.tally.held + 1 } });
    get().gainXp(10);
    return "held";
  },
  breach: (text) => {
    const s = get();
    if (s.stage !== "night") return;
    set({ rosing: Math.max(0, s.rosing - 1), tally: { ...s.tally, breaches: s.tally.breaches + 1 } });
    get().say("Rosing", ROSING_SAYS.breach);
    get().toast(text, "bad");
    live.shake = 1;
    if (get().rosing <= 0) get().endNight("dawn");
  },
  markSearched: (id) => set((s) => ({ searched: [...s.searched, id], tally: { ...s.tally, searched: s.tally.searched + 1 } })),
  pourSalt: (line) => {
    if (!get().spend("salt", 1)) return false;
    set((s) => ({ lines: [...s.lines, line] }));
    return true;
  },
  useGarlic: () => get().spend("garlic", 1),

  setErrand: (id) => set({ errand: { id, step: 0, done: false } }),      // the objective card says what it is
  stepErrand: () => {
    const e = get().errand;
    if (!e || e.done) return;
    const step = e.step + 1, done = step >= ERRANDS[e.id].steps.length;
    set({ errand: { ...e, step, done } });
    if (done) { get().gainXp(40); get().toast(`${ERRANDS[e.id].title}: done.`, "good"); }

  },
  set: (patch) => set(patch),
  say: (who, text) => set({ caption: { who, text, id: ids++ } }),
  toast: (text, tone = "plain") => {
    const id = ids++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5200);
  },
  hint: (key, text) => { if (!get().seen.includes(key)) { set((s) => ({ seen: [...s.seen, key] })); get().toast(text); } },
  talk: (lines, then, choices) => { if (lines.length) set({ dialogue: { lines, index: 0, then, choices }, panel: null }); else then?.(); },
  advance: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.index + 1 < d.lines.length) { set({ dialogue: { ...d, index: d.index + 1 } }); return; }
    if (d.choices) return;                     // the last line waits for a choice
    set({ dialogue: null });
    d.then?.();
  },
  setPanel: (panel) => set({ panel }),
  toggleShadows: () => set((s) => ({ shadows: !s.shadows })),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));

// ---- helpers ---------------------------------------------------------------------------------
function beginClock(seconds: number) { live.length = seconds; live.clock = seconds; live.elapsed = 0; }
function placeAtHome() { live.player.set(home.x + 1.2, 0, home.z + HUT.hz + 2.2); live.facing = 0; }
export const carried = (s: Pick<GameState, "bag">) => (Object.keys(s.bag) as ItemId[]).reduce((n, k) => n + (ITEMS[k].weighs ? s.bag[k] : 0), 0);
export const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* private window */ } };
function save() {
  const s = useGame.getState();
  const keep: Record<string, unknown> = {};
  for (const k of Object.keys(freshRun())) keep[k] = (s as unknown as Record<string, unknown>)[k];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(keep)); } catch { /* private window */ }
}

/** What his learning and the charms he wears add up to. */
export function mods(s: Pick<GameState, "perks" | "charms" | "worn"> = useGame.getState()) {
  const charm = (stat: string) => s.charms.filter((c) => s.worn.includes(c.id) && c.stat === stat).reduce((n, c) => n + c.value, 0);
  const p = s.perks;
  return {
    noise: Math.max(0.4, 1 - 0.1 * p.softstep - charm("quiet")),
    stamina: 1 + 0.25 * p.lungs + 1.5 * charm("steady"),
    oil: Math.max(0.3, 1 - 0.15 * p.wick - charm("thrifty")),
    lamp: 1 + charm("bright"),
    speed: 1 + 0.05 * p.fleet + 0.5 * charm("swift"),
    search: Math.max(0.35, 1 - 0.18 * p.quickhands),
    firm: Math.min(0.85, 0.2 * p.firmhand + 1.4 * charm("firm")),
    carry: BASE_CARRY + 5 * p.pockets,
    loot: 0.2 * p.scavenger + 1.5 * charm("lucky"),
    whip: Math.max(0.3, 1 - 0.2 * p.strongarm),
  };
}

export const endingText = (key: string) => ENDINGS[key];

/** True if walking from (x1,z1) to (x2,z2) would step over the salt line. */
export function crossesLine(x1: number, z1: number, x2: number, z2: number, l: SaltLine) {
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) =>
    (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = side(l.ax, l.az, l.bx, l.bz, x1, z1);
  const d2 = side(l.ax, l.az, l.bx, l.bz, x2, z2);
  const d3 = side(x1, z1, x2, z2, l.ax, l.az);
  const d4 = side(x1, z1, x2, z2, l.bx, l.bz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
export type Game = GameState;
/** Something has him. He goes down, and the rest of the night is lost. */
export function catchPlayer() {
  if (live.caught > 0 || useGame.getState().stage !== "night") return;
  live.caught = 2.6; live.shake = 1;
}

/** Values that change every frame live here instead of in React state, so nothing re-renders. */
export const live = {
  player: new Vector3(START.x, 0, START.z),
  facing: Math.PI,
  playerNoise: 0,          // how far away the player can be noticed, in metres
  clock: 0,                // seconds left in this day or night
  elapsed: 0,
  length: 1,
  daylight: 1,             // 1 in full day, 0 in full night
  stamina: 1,              // 0 to 1
  oilBurn: 0,              // seconds burned towards the next unit of oil
  smoke: 0,                // seconds of smoke left on the smudge fire
  lampBlown: 0,            // seconds until a lamp the kapre blew out can be relit
  whipWait: 0,             // seconds until the whip can be used again
  breach: 0,               // 0 to 1: how far she is through an opening
  breachAt: null as OpeningId | null,
  shirtTurn: 0,
  loops: 0,                // times the trail has brought him back
  shake: 0,
  jump: 0,                 // metres the player was moved along X this frame (the camera follows without a glide)
  /** What E and G would do right now. `progress` is 0 to 1 while held, or -1 when it cannot be done. */
  prompts: { E: null, G: null } as Record<"E" | "G", null | { label: string; progress: number }>,
  /** Things within a few steps that can be used: the 3D view draws a ring under each. */
  near: [] as { x: number; z: number; r: number; button: "E" | "G"; focus: boolean }[],
  objective: { title: "", text: "", target: null, urgent: false } as Objective,
  /** Where the objective is on screen, in percent, for the interface's arrow. */
  guide: { show: false, x: 50, y: 50, angle: 0, on: false, dist: 0, urgent: false },
  typing: false,           // a line of speech is still being written out
  skipTyping: false,
  aswang: { x: 0, z: 0, near: 99, active: false },
  pacing: { x: 0, z: 0, here: false },      // where Nang Pacing is standing by day
  caught: 0,               // seconds left of being struck down, before the night is cut short
  struck: false,           // he has just struck the house post (the manananggal listens for it)
  whipCrack: false,        // he has just cracked the whip (the aswang listens for it)
  ember: { x: 0, z: 0, on: false },         // where the kapre's ember is pointing, if it owes him
  fps: 0,
};

import { create } from "zustand";
import { Vector3 } from "three";
import { aCharm, Favour, FavourId, GuiseLook, TALES, TaleId, BASE_CARRY, BASE_HEALTH, BLADE, Bounty, RECIPES, RecipeId, WHIP, BOUNTY_OFFERS, Charm, KinKind, TrophyId, ITEMS, ItemId, MAX_RANK, PerkId, WORN_CHARMS, makeCharm, xpForLevel } from "./data";
import { hidingSpots, home, HUT, nodes, OpeningId, START } from "./layout";
import type { Objective } from "./objective";
import { sound } from "./audio";
import { ENDINGS, ERRANDS, ErrandId, Form, INTRO, Line, NIGHTS, PACING_DAY, PACING_KNOWS, PACING_TRUSTED, PROOF_TEXT, ROSING_SAYS } from "./story";

export type Stage = "title" | "day" | "night" | "morning" | "over" | "ending";
export type WardKind = "salt" | "garlic";
/** A line of salt on the ground, from point A to point B. The aswang cannot cross it. */
export type SaltLine = { ax: number; az: number; bx: number; bz: number };
export type Dialogue = { lines: Line[]; index: number; choices?: { text: string; pick: () => void }[]; then?: () => void };
export type Panel = null | "bag" | "trade" | "bench" | "pause" | "guide";
export type Toast = { id: number; text: string; tone: "good" | "bad" | "plain" };
export const SHIRT_SECONDS = 2;
const SAVE_KEY = "aswang-night-save-v1";
const SETTINGS_KEY = "aswang-night-settings";
/** resolution: "auto" lowers the drawing resolution while the frame rate is short of 60 (App.tsx); "full" never does. */
export type Settings = { shake: number; flashes: "full" | "reduced"; sfx: number; ambience: number; music: number; resolution: "auto" | "full" };
const DEFAULT_SETTINGS: Settings = { shake: 1, flashes: "full", sfx: 0.8, ambience: 0.8, music: 0.75, resolution: "auto" };
function loadSettings(): Settings {
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    const unit = (x: unknown, dflt: number) => (typeof x === "number" && x >= 0 && x <= 1 ? x : dflt);
    return { shake: unit(d.shake, 1), flashes: d.flashes === "reduced" ? "reduced" : "full", sfx: unit(d.sfx, 0.8), ambience: unit(d.ambience, 0.8), music: unit(d.music, 0.75), resolution: d.resolution === "full" ? "full" : "auto" };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

const emptyBag = (): Record<ItemId, number> => ({ salt: 0, garlic: 0, oil: 0, kindling: 0, tobacco: 0, herbs: 0, coins: 0 });
const noPerks = (): Record<PerkId, number> => ({ keen: 0, skinner: 0, hardy: 0, lungs: 0, softstep: 0, wick: 0, firmhand: 0, pockets: 0, quickhands: 0, fleet: 0, strongarm: 0, scavenger: 0 });

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
  trophies: { fang: 0, claw: 0, stone: 0 } as Record<TrophyId, number>,
  /** What he has made at the bench: the itak, salt pouches and garlic strings (counts), bars on the windows,
   *  the whip's barbs and longer lash, the itak on a pole (spear), smudge bundles and flasks of strong oil
   *  (counts), the bells on the fence and the thorn hedge round the yard. */
  kit: { itak: false, pouch: 0, string: 0, bars: { west: false, east: false }, barbs: false, lash: false, spear: false, smudge: 0, strongOil: 0, bells: false, hedge: false },
  emptied: [] as number[],                     // the sitio's chests, jars and sacks he has emptied: what people left behind does not come back
  tales: [] as TaleId[],                       // the old tales he has found, for the book in the bag
  rosaryDone: false,                           // he found the hilot's rosary for her
  hairGiven: 0,                                // the day he gave Nang Pacing a strand of Rosing's hair (0: never)
  pacingAsked: false,
  bounties: [] as Bounty[],                    // Nong Kadyo's: offered for the coming night, taken, or done and waiting to be paid
  nextBounty: 1,
});
/** Everything that belongs to the current day or night only. */
const freshNight = () => ({
  lines: [] as SaltLine[],
  favours: [] as Favour[],                      // asked and taken by day; gone at dusk
  barsUsed: { west: false, east: false },       // the bamboo bars have already held once tonight
  searched: [] as number[],
  errand: null as { id: ErrandId; step: number; done: boolean } | null,
  carrying: null as "water" | "lana" | null,
  form: "foot" as Form,
  legsAt: 0, legsSeen: false,
  mana: "absent" as "absent" | "hunting" | "ended" | "dead",
  hunted: false, overhead: false, onRoof: false,
  shirt: false, lost: false,
  lampOn: true,
  strongLamp: false,                            // the lamp was filled with strong oil at dusk: it burns all night, further
  rationTaken: false,
  talked: [] as string[],
  tally: { held: 0, breaches: 0, searched: 0, xp: 0 },
});

type GameState = ReturnType<typeof freshRun> & ReturnType<typeof freshNight> & {
  stage: Stage;
  runId: number;          // goes up whenever a day or night begins, so characters can reset themselves
  shadows: boolean;
  muted: boolean;
  /** Player settings, kept between sessions: screen shake (1 full, 0.5 half, 0 off), flashes, and volumes 0..1. */
  settings: Settings;
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
  /** Nong Kadyo's work: take an offer, be paid for one done, and count a kin laid down. */
  takeBounty: (id: number) => void;
  payBounty: (id: number) => void;
  laidDown: (kind: KinKind) => void;
  /** Make something at the bench, if he has what it takes. */
  craft: (id: RecipeId) => boolean;
  /** Favours: take one, move it on (he is carrying the thing), or finish it. */
  takeFavour: (id: FavourId) => void;
  carryFavour: (id: FavourId) => void;
  endFavour: (id: FavourId) => void;
  /** An old tale found in a chest or a jar. */
  findTale: () => boolean;
  toggleMute: () => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
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
  settings: loadSettings(),
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
    const saved = loadSave();
    if (!saved) {
      if (hasSave()) get().toast("The saved game could not be read. It may come from a newer version of the game.", "bad");
      return false;
    }
    set((s) => ({ ...saved, ...freshNight(), stage: "day", runId: s.runId + 1, dialogue: null, panel: null, caption: null, toasts: [], report: [], ending: null }));
    placeAtHome();
    beginClock(NIGHTS[get().night - 1].daySeconds);
    return true;
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
    live.lampBlown = 0; live.breach = 0; live.breachAt = null; live.loops = 0; live.hilotOut = 0; live.kinOut = { dog: 0, crawler: 0, guise: 0 }; live.guiseNext = 0; live.smudge = 0;      // smoke from a fire fed before dusk carries over
    set({ banner: { big: `Night ${ROMAN[s.night - 1]}`, small: plan.name, id: ids++ } });
    // a flask of strong oil goes into the lamp at dusk: it burns the whole night through, and further
    if (s.kit.strongOil > 0) {
      set({ strongLamp: true, kit: { ...get().kit, strongOil: s.kit.strongOil - 1 } });
      get().toast("You fill the lamp with the strong oil. It will burn all night, and throw its light further.", "good");
    }
    // what was done with the hair she asked for: tonight it has hold of Rosing
    if (s.hairGiven === s.night) {
      set({ rosing: Math.max(1, get().rosing - 1) });
      get().say("Rosing", "Dong... I cannot breathe. Something is pulling at me, from the inside.");
      get().toast("Rosing wakes choking. Something has hold of her: she is weaker tonight.", "bad");
    }
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
    // his work: what was done waits to be paid, what was not is gone, and there is new work for tonight
    let nextBounty = s.nextBounty;
    const bounties = [...s.bounties.filter((b) => b.state === "done"), ...(BOUNTY_OFFERS[night] ?? []).map((o) => ({ ...o, id: nextBounty++, got: 0, night, state: "offered" as const }))];
    set({ ...freshNight(), night, stage: "day", runId: s.runId + 1, report: [], bounties, nextBounty, banner: { big: `Day ${ROMAN[night - 1]}`, small: "Before dark", id: ids++ } });
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
    // bamboo bars: the first try at a barred window each night does not spend its protection
    if ((id === "west" || id === "east") && s.kit.bars[id] && !s.barsUsed[id]) {
      set({ barsUsed: { ...s.barsUsed, [id]: true }, tally: { ...s.tally, held: s.tally.held + 1 } });
      get().gainXp(10);
      return "held";
    }
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
  markSearched: (id) => set((s) => ({ searched: [...s.searched, id], emptied: nodes.find((n) => n.id === id)?.rich ? [...s.emptied, id] : s.emptied, tally: { ...s.tally, searched: s.tally.searched + 1 } })),
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
  takeBounty: (id) => set((s) => ({ bounties: s.bounties.map((b) => (b.id === id && b.state === "offered" ? { ...b, state: "taken" } : b)) })),
  payBounty: (id) => {
    const b = get().bounties.find((x) => x.id === id && x.state === "done");
    if (!b) return;
    set((s) => ({ bounties: s.bounties.filter((x) => x.id !== id) }));
    get().add("coins", b.coins); get().gainXp(b.xp);
    get().toast(`Nong Kadyo pays ${b.coins} centavos.`, "good");
  },
  takeFavour: (id) => set((s) => ({ favours: [...s.favours.filter((f) => f.id !== id), { id, state: "taken" }] })),
  carryFavour: (id) => set((s) => ({ favours: s.favours.map((f) => (f.id === id ? { ...f, state: "carrying" } : f)) })),
  endFavour: (id) => set((s) => ({ favours: s.favours.filter((f) => f.id !== id) })),
  findTale: () => {
    const s = get(), left = TALES.filter((t) => !s.tales.includes(t.id));
    if (!left.length) return false;
    const t = left[Math.floor(rnd() * left.length)];
    set({ tales: [...s.tales, t.id] });
    get().gainXp(15);
    get().toast(`Folded among the cloth, a page in an old hand: "${t.title}". It is in your bag (Tab).`, "good");
    return true;
  },
  craft: (id) => {
    const s = get(), r = RECIPES.find((x) => x.id === id);
    if (!r || !canCraft(s, id)) return false;
    const bag = { ...s.bag }, trophies = { ...s.trophies };
    for (const [k, n] of Object.entries(r.cost)) { if (k in trophies) trophies[k as TrophyId] -= n!; else bag[k as ItemId] -= n!; }
    const kit = { ...s.kit, bars: { ...s.kit.bars } };
    if (id === "itak") kit.itak = true;
    else if (id === "pouch") kit.pouch += 1;
    else if (id === "string") kit.string += 1;
    else if (id === "barsWest") kit.bars.west = true;
    else if (id === "barsEast") kit.bars.east = true;
    else if (id === "barbs") kit.barbs = true;
    else if (id === "lash") kit.lash = true;
    else if (id === "spear") kit.spear = true;
    else if (id === "smudge") kit.smudge += 1;
    else if (id === "strongOil") kit.strongOil += 1;
    else if (id === "bells") kit.bells = true;
    else if (id === "hedge") kit.hedge = true;
    set({ bag, trophies, kit });
    if (id === "fangCharm" || id === "clawCharm") { const c = get().addCharm(id === "clawCharm" ? 0.25 : 0.12); get().toast(`You bind ${aCharm(c)}.`, "good"); }
    else get().toast(`Made: ${r.name.toLowerCase()}.`, "good");
    get().gainXp(6);
    return true;
  },
  laidDown: (kind) => {
    let met: Bounty | null = null;
    set((s) => ({
      bounties: s.bounties.map((b) => {
        if (b.kind !== kind || b.state !== "taken") return b;
        const got = Math.min(b.count, b.got + 1);
        if (got >= b.count) met = { ...b, got, state: "done" };
        return got >= b.count ? { ...b, got, state: "done" } : { ...b, got };
      }),
    }));
    if (met) get().toast("Nong Kadyo's work is done. He will pay in the morning.", "good");
  },
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setSetting: (key, value) => set((s) => {
    const settings = { ...s.settings, [key]: value };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private window */ }
    return { settings };
  }),
}));

// ---- helpers ---------------------------------------------------------------------------------
function beginClock(seconds: number) { live.length = seconds; live.clock = seconds; live.elapsed = 0; }
function placeAtHome() { live.player.set(home.x + 1.2, 0, home.z + HUT.hz + 2.2); live.facing = 0; }
export const carried = (s: Pick<GameState, "bag">) => (Object.keys(s.bag) as ItemId[]).reduce((n, k) => n + (ITEMS[k].weighs ? s.bag[k] : 0), 0);
// ---- the saved game (save-systems: plain data, a version stamp, a backup, and a check on load) --------
/** Bump when the shape of the saved run changes, and add a step to MIGRATIONS that brings the old
 *  shape up to the new one. Version 1 is the first shape, saved before the stamp existed. */
const SAVE_VERSION = 2;
const BACKUP_KEY = SAVE_KEY + "-backup";
type Saved = Record<string, unknown> & { version: number };
const MIGRATIONS: Record<number, (d: Saved) => Saved> = {
  // 1 -> 2: health, the bench, the kin's trophies, bounties, favours and tales came in; their defaults are
  // filled by the merge with a fresh run below, so nothing needs moving
  1: (d) => d,
};
export const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY) || !!localStorage.getItem(BACKUP_KEY); } catch { return false; } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(BACKUP_KEY); } catch { /* private window */ } };
function save() {
  const s = useGame.getState();
  const keep: Saved = { version: SAVE_VERSION };
  for (const k of Object.keys(freshRun())) keep[k] = (s as unknown as Record<string, unknown>)[k];
  try {
    // the last good save becomes the backup before the new one is written
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(keep));
  } catch { /* private window, or storage full: the game goes on unsaved */ }
}
/** Reads the save (or, if it is damaged, the backup), brings an older one up to date and checks it.
 *  Null when there is nothing usable, or when it comes from a newer version of the game. */
export function loadSave(): ReturnType<typeof freshRun> | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let d = JSON.parse(raw) as Saved;
      if (!d || typeof d !== "object") continue;
      let v = Number.isInteger(d.version) ? d.version : 1;
      if (v > SAVE_VERSION) return null;                   // from a newer game: refuse rather than half-load
      while (v < SAVE_VERSION) { d = MIGRATIONS[v](d); v += 1; }
      const run = checkRun(d);
      if (run) return run;
    } catch { /* unreadable: try the backup */ }
  }
  return null;
}
/** Every field from a fresh run, overlaid with the saved values that make sense; null if the core is broken. */
function checkRun(d: Saved): ReturnType<typeof freshRun> | null {
  const fresh = freshRun();
  const night = Number(d.night);
  if (!Number.isInteger(night) || night < 1 || night > NIGHTS.length) return null;
  const num = (x: unknown, lo: number, hi: number, dflt: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : dflt);
  const counts = <T extends Record<string, number>>(base: T, x: unknown): T => {
    const out = { ...base };
    if (x && typeof x === "object") for (const k of Object.keys(base)) (out as Record<string, number>)[k] = Math.floor(num((x as Record<string, unknown>)[k], 0, 9999, 0));
    return out;
  };
  const savedKit = (d.kit ?? {}) as Partial<typeof fresh.kit>;
  return {
    ...fresh,
    ...(d as Partial<typeof fresh>),
    night,
    rosing: Math.round(num(d.rosing, 0, 3, 3)),
    bag: counts(fresh.bag, d.bag),
    trophies: counts(fresh.trophies, d.trophies),
    perks: counts(fresh.perks, d.perks),
    xp: Math.floor(num(d.xp, 0, 1e7, 0)), level: Math.floor(num(d.level, 1, 99, 1)), points: Math.floor(num(d.points, 0, 99, 0)),
    kit: { ...fresh.kit, ...savedKit, bars: { ...fresh.kit.bars, ...(savedKit.bars ?? {}) } },
    charms: Array.isArray(d.charms) ? (d.charms as typeof fresh.charms) : [],
    worn: Array.isArray(d.worn) ? (d.worn as number[]) : [],
    bounties: Array.isArray(d.bounties) ? (d.bounties as typeof fresh.bounties) : [],
    tales: Array.isArray(d.tales) ? (d.tales as typeof fresh.tales) : [],
    seen: Array.isArray(d.seen) ? (d.seen as string[]) : [],
    emptied: Array.isArray(d.emptied) ? (d.emptied as number[]) : [],
  };
}

/** What his learning and the charms he wears add up to. */
/** Whether a thing made only once has been made. */
export function made(kit: GameState["kit"], id: RecipeId) {
  const once: Partial<Record<RecipeId, boolean>> = { itak: kit.itak, barsWest: kit.bars.west, barsEast: kit.bars.east, barbs: kit.barbs, lash: kit.lash, spear: kit.spear, bells: kit.bells, hedge: kit.hedge };
  return !!once[id];
}
/** Whether he has what a recipe takes (and has not already made a thing made only once). */
export function canCraft(s: Pick<GameState, "bag" | "trophies" | "kit" | "hasWhip">, id: RecipeId) {
  const r = RECIPES.find((x) => x.id === id)!;
  if (r.whip && !s.hasWhip) return false;
  if (r.needs === "itak" && !s.kit.itak) return false;
  if (r.once && made(s.kit, id)) return false;
  return Object.entries(r.cost).every(([k, n]) => (k in s.trophies ? s.trophies[k as TrophyId] : s.bag[k as ItemId]) >= n!);
}
export function mods(s: Pick<GameState, "perks" | "charms" | "worn"> & Partial<Pick<GameState, "kit" | "strongLamp">> = useGame.getState()) {
  const charm = (stat: string) => s.charms.filter((c) => s.worn.includes(c.id) && c.stat === stat).reduce((n, c) => n + c.value, 0);
  const p = s.perks;
  return {
    noise: Math.max(0.4, 1 - 0.1 * p.softstep - charm("quiet")),
    stamina: 1 + 0.25 * p.lungs + 1.5 * charm("steady"),
    oil: Math.max(0.3, 1 - 0.15 * p.wick - charm("thrifty")),
    lamp: 1 + charm("bright") + (s.strongLamp ? 0.5 : 0),
    speed: 1 + 0.05 * p.fleet + 0.5 * charm("swift"),
    search: Math.max(0.35, 1 - 0.18 * p.quickhands),
    firm: Math.min(0.85, 0.2 * p.firmhand + 1.4 * charm("firm")),
    carry: BASE_CARRY + 5 * p.pockets,
    loot: 0.2 * p.scavenger + 1.5 * charm("lucky"),
    whip: Math.max(0.3, 1 - 0.2 * p.strongarm),
    health: BASE_HEALTH + 25 * p.hardy,
    guard: Math.min(0.6, 1.5 * charm("tough")),       // share of harm a charm turns aside
    damage: 1 + 0.15 * (p.keen ?? 0),                   // what his blows take, times the weapon's own
    whipDamage: WHIP.damage * (1 + 0.15 * (p.keen ?? 0)) * (s.kit?.barbs ? 4 / 3 : 1),
    whipReach: WHIP.range + (s.kit?.lash ? 1 : 0),
    bladeDamage: BLADE.damage * (1 + 0.15 * (p.keen ?? 0)),
    bladeReach: BLADE.range + (s.kit?.spear ? BLADE.spear : 0),
    skinner: 0.25 * (p.skinner ?? 0),                   // chance of a second trophy
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
/**
 * Something hurts him: a bite, a claw, a grab. What a worn charm turns aside is taken off first. At no
 * health left he goes down, as if caught, and the rest of the night is lost. Only at night.
 */
export function hurt(amount: number) {
  const s = useGame.getState();
  if (live.caught > 0 || s.stage !== "night") return;
  if (s.kit.string > 0) {
    // the garlic string at his neck turns it aside, and is spent
    s.set({ kit: { ...s.kit, string: s.kit.string - 1 } });
    s.toast("The garlic string at your neck turns it aside.", "good"); sound.held();
    live.shake = Math.max(live.shake, 0.3);
    return;
  }
  live.health = Math.max(0, live.health - amount * (1 - mods(s).guard));
  live.hurt = 1; live.shake = Math.max(live.shake, 0.55); sound.hurt(); hitStop(0.08);
  if (live.health <= 0) catchPlayer();
}
/**
 * Hit-stop: the world all but stops for a moment on an impact, so the blow reads (game-feel). Frames
 * keep coming; every gameplay step is scaled by `live.timeScale` (see `step`), which the camera sets
 * from `live.freeze` in real time. A stop asked for while one is running is skipped, not stacked.
 */
export function hitStop(seconds: number) {
  if (live.freeze > 0) return;
  live.freeze = seconds;
}
/** One frame's game time: capped against stalls, and slowed during a hit-stop. */
export const step = (rawDt: number) => Math.min(rawDt, 0.1) * live.timeScale;
/** Something has him. He goes down, and the rest of the night is lost. */
export function catchPlayer() {
  if (live.caught > 0 || useGame.getState().stage !== "night") return;
  live.caught = 2.6; live.shake = 1;
}

/** Values that change every frame live here instead of in React state, so nothing re-renders. */
/** One of the roaming kin, as the others see it. `unmask`: garlic was just held up to it (Guise.tsx);
 *  `shown`: a kin in human guise has dropped the face. */
const kinSlot = () => ({ mode: "away", x: 0, z: 0, hp: 1, unmask: false, shown: false });
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
  /** The amalanhig in the old sitio, for the self-test and the hints: what each is doing, where, and how often struck. */
  amalanhig: [0, 1].map(() => ({ mode: "grave", x: 0, z: 0, hits: 0, hp: 1 })),
  health: BASE_HEALTH,     // what he has left; at 0 he goes down (see hurt)
  hurt: 0,                 // 1 just after he is hurt, fading: the red flash at the edges
  eating: 0,               // seconds into eating a bundle of herbs (hold H)
  /** The roaming kin (Kin.tsx): each slot's state, and how many of each kind have come out tonight. */
  kin: { dog: [0, 1].map(kinSlot), crawler: [0].map(kinSlot), guise: [0, 1, 2].map(kinSlot) },
  kinOut: { dog: 0, crawler: 0, guise: 0 },
  guiseNext: 0,            // night seconds before the next kin in human guise may come out (one laid down waits)
  guiseLook: null as GuiseLook | null,   // dev only (scripts/duel.mjs): which face comes out, whatever the night
  smudge: 0,               // seconds left that a smudge bundle smoulders on him: the kin lose his scent
  freeze: 0,               // real seconds left of a hit-stop
  timeScale: 1,            // how fast the game runs this frame: 1, or nearly 0 during a hit-stop
  itakWait: 0,             // seconds until the itak can strike again
  slash: false,            // he has just struck with the itak (the creatures listen for it, like the whip)
  saltThrow: false,        // he has just thrown a salt pouch
  hilotOut: 0,             // seconds left that the hilot stands in her open doorway, answering his call
  caught: 0,               // seconds left of being struck down, before the night is cut short
  struck: false,           // he has just struck the house post (the manananggal listens for it)
  whipCrack: false,        // he has just cracked the whip (the aswang listens for it)
  ember: { x: 0, z: 0, on: false },         // where the kapre's ember is pointing, if it owes him
  /** Her hound on the last night: where it is, whether it is at his shadow, and how much it has drunk (0 to 1). */
  sigbin: { x: 0, z: 0, near: 99, out: false, feeding: false, drain: 0 },
  fps: 0,
  dpr: 1,                  // the drawing resolution the automatic setting has come to (App.tsx)
};

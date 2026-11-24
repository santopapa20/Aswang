/** What can be carried, found, learned and bought. Rules only; no drawing and no state here. */
import type { NodeKind } from "./layout";

// ---- supplies --------------------------------------------------------------------------------
export type ItemId = "salt" | "garlic" | "oil" | "kindling" | "tobacco" | "herbs" | "coins";
export const ITEMS: Record<ItemId, { name: string; use: string; weighs: boolean }> = {
  salt: { name: "Salt", use: "Lay it across the door, or pour a line on the ground. She cannot cross it.", weighs: true },
  garlic: { name: "Garlic", use: "Hang it at a window. Carried, one braid drives her back when she reaches you.", weighs: true },
  oil: { name: "Lamp oil", use: "The lamp drinks it through the night.", weighs: true },
  kindling: { name: "Kindling", use: "Feeds the smudge fire in the yard. Its smoke keeps the roof clear.", weighs: true },
  tobacco: { name: "Tobacco", use: "Something in the balete likes it.", weighs: true },
  herbs: { name: "Herbs", use: "Eat a bundle to heal (hold H). Nong Kadyo trades for them, and binds them into charms.", weighs: true },
  coins: { name: "Centavos", use: "For Nong Kadyo.", weighs: false },
};
export const ITEM_ORDER: ItemId[] = ["salt", "garlic", "oil", "kindling", "tobacco", "herbs", "coins"];
export const BASE_CARRY = 22;

// ---- harm and fighting ------------------------------------------------------------------------
export const BASE_HEALTH = 100;
/** Eating a bundle of herbs: how long he must stand still for it, and how much it gives back. */
export const EAT = { seconds: 1.2, heals: 30 };
/** The stingray-tail whip: what one blow takes from a thing that can be hurt, how far it reaches, and how
 *  many seconds before it can be cracked again (the Strong arm perk shortens that). */
export const WHIP = { damage: 34, range: 3.6, cooldown: 4 };
// ---- the aswang's kin, who roam the fields at night (Kin.tsx) ------------------------------------
export type KinKind = "dog" | "crawler";
export type TrophyId = "fang" | "claw";
export const TROPHIES: Record<TrophyId, { name: string; text: string }> = {
  fang: { name: "Dog's fangs", text: "Pulled from a dead thing that ran as a dog. Kept for the workbench." },
  claw: { name: "Crawler's nails", text: "Black, and longer than a man's should be. Kept for the workbench." },
};
/** How each kind behaves. Speeds in metres a second (he walks 1.7 and runs 3.6), turn in radians a second,
 *  harm out of his 100, notice in metres (shorter when his lamp is shuttered), leash how far from where it
 *  took up the chase it will follow him before it turns back.
 *  Tuned with scripts/duel.mjs --foe=dog / --foe=crawler: a pair of dogs costs a careless fighter three or
 *  four bites, backing off costs fewer, and running gets away; a crawler is won clean by backing off with
 *  the lamp lit, and is a losing fight in the dark. A crawler struck while his
 *  lamp is not on it shrugs off `unlit` of the blow: in the dark the whip slides off it. */
export const KIN = {
  dog: { name: "dog", leash: 18, health: 60, speed: 3.0, prowl: 1.1, turn: 5, reach: 1.0, harm: 10, rest: 2.0, notice: 9, lose: 13, knockback: 1.8, stagger: 0.7, trophy: "fang" as TrophyId, coins: [2, 5], xp: 18, unlit: 0, bar: 1.05 },
  crawler: { name: "crawler", leash: 16, health: 80, speed: 2.4, prowl: 0.9, turn: 3.5, reach: 1.15, harm: 20, rest: 2.0, notice: 7, lose: 12, knockback: 1.4, stagger: 1.0, trophy: "claw" as TrophyId, coins: [4, 8], xp: 30, unlit: 0.75, bar: 1.2 },
};
/** How many of each come out on each night in all, and how many may be about at once. */
export const KIN_NIGHTS: Record<number, Record<KinKind, number>> = { 1: { dog: 0, crawler: 0 }, 2: { dog: 2, crawler: 0 }, 3: { dog: 2, crawler: 1 }, 4: { dog: 3, crawler: 1 }, 5: { dog: 4, crawler: 2 } };
export const KIN_AT_ONCE: Record<KinKind, number> = { dog: 2, crawler: 1 };
export const KIN_FIRST = 25;      // seconds into the night before the first come out
export const KIN_AGAIN = 40;      // seconds before another comes out in place of one laid down

// ---- the workbench, beside Rosing's house (by day) ------------------------------------------------
/** The itak (bolo): close and quick. V to strike what is in front of him. */
export const BLADE = { damage: 45, range: 1.7, cooldown: 1.1, breath: 0.15 };
/** A salt pouch thrown in the face of what is in front of him (Z): it reels for `stun` seconds. */
export const POUCH = { range: 3.4, stun: 2.5 };
export type RecipeId = "itak" | "pouch" | "string" | "barsWest" | "barsEast" | "barbs" | "lash" | "fangCharm" | "clawCharm";
export type Cost = Partial<Record<ItemId | TrophyId, number>>;
export const RECIPES: { id: RecipeId; name: string; text: string; cost: Cost; icon: string; once?: boolean; whip?: boolean }[] = [
  { id: "itak", name: "Itak", text: "A bolo with its handle bound in palm, and a dog's fang set in the pommel against them. V strikes what is in front of you: close, quick, and deep.", cost: { coins: 15, kindling: 2, fang: 1 }, icon: "blade", once: true },
  { id: "pouch", name: "Salt pouch", text: "A twist of salt and crushed leaves. Z throws it in the face of whatever is in front of you, and it reels.", cost: { salt: 2, herbs: 1 }, icon: "salt" },
  { id: "string", name: "Garlic string", text: "Worn at the neck. The next bite or grab is turned aside, and the string is spent.", cost: { garlic: 3 }, icon: "garlic" },
  { id: "barsWest", name: "Bamboo bars, west window", text: "Split bamboo lashed across it. Each night its protection holds once more before it is spent.", cost: { kindling: 4, coins: 4 }, icon: "window", once: true },
  { id: "barsEast", name: "Bamboo bars, east window", text: "The same across the east window.", cost: { kindling: 4, coins: 4 }, icon: "window", once: true },
  { id: "barbs", name: "Barbs for the whip", text: "Dog's fangs worked into the lash. Each blow takes a third more.", cost: { fang: 3, herbs: 2 }, icon: "whip", once: true, whip: true },
  { id: "lash", name: "A longer lash", text: "Crawler's nails knotted along a new length. The whip reaches a metre further.", cost: { claw: 2, coins: 6 }, icon: "whip", once: true, whip: true },
  { id: "fangCharm", name: "A charm with a fang in it", text: "Herbs and a fang knotted with a prayer. Better than plain ones, more often.", cost: { herbs: 4, fang: 1 }, icon: "charm" },
  { id: "clawCharm", name: "A charm with a nail in it", text: "Herbs and a crawler's nail. These come out old and strong.", cost: { herbs: 4, claw: 1 }, icon: "charm" },
];

// ---- favours asked by day (interact.ts) -----------------------------------------------------------
export type FavourId = "water" | "kindling" | "tea" | "herbs" | "rosary" | "hair";
export type Favour = { id: FavourId; state: "taken" | "carrying" };
/** What each favour is, as the goal card and the door put it. */
export const FAVOURS: Record<FavourId, { from: string; task: string }> = {
  water: { from: "Rosing", task: "Rosing: water from the well" },
  kindling: { from: "Rosing", task: "Rosing: two bundles of kindling" },
  tea: { from: "Rosing", task: "Rosing: a bundle of herbs for tea" },
  herbs: { from: "Nong Kadyo", task: "Nong Kadyo: five bundles of herbs" },
  rosary: { from: "The hilot", task: "The hilot: her mother's rosary, in the empty house east of hers" },
  hair: { from: "Nang Pacing", task: "Nang Pacing: a strand of Rosing's hair" },
};
/** What Rosing asks for on each day. */
export const ROSING_FAVOUR: Record<number, FavourId> = { 2: "water", 3: "kindling", 4: "tea", 5: "water" };
export const KADYO_HERBS = 5;

// ---- old tales, found in chests and jars, that fill the book in the bag ---------------------------
export type TaleId = "aswang" | "manananggal" | "tikbalang" | "kapre" | "sigbin" | "amalanhig" | "dogs" | "crawler";
export const TALES: { id: TaleId; title: string; text: string }[] = [
  { id: "aswang", title: "The one who walks at night", text: "By day a neighbour, kind and helpful. By night she listens at the floorboards for the unborn. Salt across the door, garlic at the window; each holds once. She hates a light carried to where she works." },
  { id: "manananggal", title: "The one who leaves her legs", text: "She splits at the waist and flies, and leaves the lower half standing hidden. Smoke keeps her off the roof. Salt or ash on the stump, and she cannot join herself again before the cock crows." },
  { id: "tikbalang", title: "The owner of the trail", text: "Tall as a palm, with a horse's head. He does not kill; he leads you round and round. Turn your shirt inside out and ask his pardon, and the path lets you go." },
  { id: "kapre", title: "The smoker in the balete", text: "A giant who sits in the old trees with his cigar. Run under his tree and he blows out your light. Leave him tobacco and he remembers you." },
  { id: "sigbin", title: "The hound that walks backwards", text: "It goes tail first, its head between its legs, and it drinks shadows. No light, no shadow. It will not step over salt, and the stingray tail sends it off." },
  { id: "amalanhig", title: "The one who could not die", text: "An aswang who never passed it on cannot rest. It rises stiff, unable to bend, and turns slowly. Step aside and run. It cannot follow far from its grave." },
  { id: "dogs", title: "The dogs of her house", text: "When one of them dies, the dogs of the house are not buried. They run the fields at night in pairs. Salt stops them; they do not chase far from where they found you." },
  { id: "crawler", title: "The one on all fours", text: "Kin who have gone too far into it, and forgot how to stand. In the dark nothing harms them. Keep your lamp on them, and strike while it is lit." },
];
export const TALE_CHANCE = 0.55;     // chance a chest or a jar holds a page, while there are pages still to find

// ---- Nong Kadyo's bounties -------------------------------------------------------------------
export type Bounty = { id: number; kind: KinKind; count: number; got: number; coins: number; xp: number; text: string; night: number; state: "offered" | "taken" | "done" };
/** What he asks for on the day before each night. Each can be done with what comes out that night. */
export const BOUNTY_OFFERS: Record<number, Pick<Bounty, "kind" | "count" | "coins" | "xp" | "text">[]> = {
  2: [{ kind: "dog", count: 2, coins: 10, xp: 40, text: "Two dogs run the north field at night. Dead things wearing dogs. Lay them both down." }],
  3: [
    { kind: "dog", count: 2, coins: 10, xp: 40, text: "The dogs are back. Two of them again." },
    { kind: "crawler", count: 1, coins: 14, xp: 55, text: "Something goes on all fours by the shut house. Keep your lamp on it: in the dark the whip slides off." },
  ],
  4: [
    { kind: "dog", count: 3, coins: 15, xp: 55, text: "Three dogs tonight. They hunt in pairs; a line of salt stops them." },
    { kind: "crawler", count: 1, coins: 14, xp: 55, text: "The one on all fours. Lamp on it, then the whip." },
  ],
  5: [
    { kind: "crawler", count: 2, coins: 22, xp: 75, text: "She has called her kin for the birth. Two crawlers. They must not reach the house." },
    { kind: "dog", count: 3, coins: 15, xp: 55, text: "And the dogs. Three." },
  ],
};

/** The amalanhig (Amalanhig.tsx). Kept here with the whip so the fight is tuned in one place
 *  (scripts/duel.mjs plays it out with different ways of fighting and reports how each went). */
export const AMALANHIG = {
  wake: 8,          // metres from its grave at which it hears him after dark
  lose: 14,         // how far ahead of it he must get before it gives up and goes back down
  leash: 28,        // and how far from its grave it will follow him at all
  speed: 1.9,       // metres a second: a little faster than he walks, much slower than he runs
  turn: 1.1,        // radians a second: its joints have set, so it turns slowly. Step aside and it lurches past
  reach: 1.2,       // how close it must be, facing him, to get its hands on him
  health: 100,      // three whip blows lay it down for the rest of the night
  grabHarm: 40,     // what its hands take from him; it lets go and he staggers clear
  grabRest: 2.5,    // seconds before it can get hold of him again
  letGo: 1.4,       // seconds it stands after a grab before it comes on again: his head start
  knockback: 2.0,   // metres a whip blow throws it back
  stagger: 1.2,     // seconds it reels after a blow before it comes on again
};

// ---- charms: found or made, two can be worn ---------------------------------------------------
export type StatId = "quiet" | "bright" | "thrifty" | "swift" | "steady" | "lucky" | "firm" | "tough";
export const STATS: Record<StatId, { noun: string; text: (v: number) => string }> = {
  quiet: { noun: "soft steps", text: (v) => `You are heard from ${pct(v)} less far` },
  bright: { noun: "the long flame", text: (v) => `The lamp reaches ${pct(v)} further` },
  thrifty: { noun: "the slow wick", text: (v) => `The lamp uses ${pct(v)} less oil` },
  swift: { noun: "quick feet", text: (v) => `You move ${pct(v * 0.5)} faster` },
  steady: { noun: "long breath", text: (v) => `You can run ${pct(v * 1.5)} longer` },
  lucky: { noun: "the open hand", text: (v) => `You find ${pct(v * 1.5)} more` },
  firm: { noun: "the held door", text: (v) => `${pct(v * 1.4)} chance a protection holds a second time` },
  tough: { noun: "the thick skin", text: (v) => `You take ${pct(v * 1.5)} less harm` },
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
export const RARITY = [
  { name: "Worn", colour: "#b9b3a6", value: 0.07 },
  { name: "Old", colour: "#7fb38a", value: 0.11 },
  { name: "Blessed", colour: "#7aa2e0", value: 0.17 },
  { name: "Ancestral", colour: "#e0a23a", value: 0.26 },
];
export type Charm = { id: number; stat: StatId; rarity: number; value: number };
export const charmName = (c: Charm) => `${RARITY[c.rarity].name} habak of ${STATS[c.stat].noun}`;
/** The name with "a" or "an" in front, for sentences. */
export const aCharm = (c: Charm) => `${/^[AEIOU]/.test(charmName(c)) ? "an" : "a"} ${charmName(c)}`;
export function makeCharm(id: number, rnd: () => number, bonus = 0): Charm {
  const stats = Object.keys(STATS) as StatId[];
  const roll = rnd() - bonus;
  const rarity = roll < 0.03 ? 3 : roll < 0.14 ? 2 : roll < 0.42 ? 1 : 0;
  return { id, stat: stats[Math.floor(rnd() * stats.length)], rarity, value: RARITY[rarity].value * (0.9 + rnd() * 0.2) };
}
export const WORN_CHARMS = 2;

// ---- what turns up where ---------------------------------------------------------------------
export const NODE: Record<NodeKind, { name: string; verb: string; seconds: number; xp: number }> = {
  baul: { name: "wooden chest", verb: "Search the chest", seconds: 2.6, xp: 12 },
  banga: { name: "clay jar", verb: "Look in the jar", seconds: 1.8, xp: 8 },
  sako: { name: "sack", verb: "Open the sack", seconds: 1.6, xp: 7 },
  kindling: { name: "fallen palm fronds", verb: "Gather kindling", seconds: 1.8, xp: 4 },
  herbs: { name: "herbs", verb: "Pick the herbs", seconds: 1.6, xp: 5 },
};
type Drop = [ItemId, number, number, number];                 // item, chance, at least, at most
const TABLE: Record<NodeKind, Drop[]> = {
  baul: [["coins", 0.9, 3, 9], ["oil", 0.5, 1, 2], ["salt", 0.45, 1, 2], ["tobacco", 0.3, 1, 1], ["garlic", 0.3, 1, 1]],
  banga: [["salt", 0.8, 1, 3], ["oil", 0.35, 1, 2], ["coins", 0.3, 1, 3]],
  sako: [["garlic", 0.6, 1, 2], ["salt", 0.4, 1, 2], ["kindling", 0.4, 1, 2], ["tobacco", 0.18, 1, 1], ["coins", 0.25, 1, 4]],
  kindling: [["kindling", 1, 2, 3]],
  herbs: [["herbs", 1, 1, 3]],
};
const CHARM_CHANCE: Record<NodeKind, number> = { baul: 0.22, banga: 0.05, sako: 0.06, kindling: 0, herbs: 0.02 };
/** Rolls what a searched place gives. `rich` places (the old sitio) give more; `more` is the finder's own bonus. */
export function rollLoot(kind: NodeKind, rich: boolean, more: number, rnd: () => number) {
  const found: Partial<Record<ItemId, number>> = {};
  for (const [item, chance, lo, hi] of TABLE[kind]) {
    if (rnd() > chance * (rich ? 1.15 : 0.8)) continue;
    const n = lo + Math.floor(rnd() * (hi - lo + 1));
    found[item] = Math.max(1, Math.round(n * (rich ? 1.25 : 1) * (1 + more)));
  }
  if (Object.keys(found).length === 0) { const [item] = TABLE[kind][0]; found[item] = 1; }
  return { found, charm: rnd() < CHARM_CHANCE[kind] * (rich ? 1.3 : 0.5) * (1 + more) };
}

// ---- what you learn --------------------------------------------------------------------------
export type PerkId = "keen" | "skinner" | "hardy" | "lungs" | "softstep" | "wick" | "firmhand" | "pockets" | "quickhands" | "fleet" | "strongarm" | "scavenger";
export const PATHS: { name: string; about: string; perks: PerkId[] }[] = [
  { name: "Bantay", about: "The watchman: breath, quiet and the lamp.", perks: ["hardy", "lungs", "softstep", "wick"] },
  { name: "Tinun-an", about: "The albularyo's pupil: protections and careful hands.", perks: ["firmhand", "pockets", "quickhands"] },
  { name: "Mangangayam", about: "The hunter: legs, the whip, a nose for what is hidden.", perks: ["keen", "skinner", "fleet", "strongarm", "scavenger"] },
];
export const PERKS: Record<PerkId, { name: string; text: string }> = {
  hardy: { name: "Hardy", text: "25 more health." },
  keen: { name: "Keen edge", text: "Whip and itak take 15% more." },
  skinner: { name: "Skinner", text: "25% chance of a second trophy from the kin." },
  lungs: { name: "Long breath", text: "Run 25% longer before tiring." },
  softstep: { name: "Soft step", text: "Heard from 10% less far." },
  wick: { name: "Trimmed wick", text: "The lamp uses 15% less oil." },
  firmhand: { name: "Firm hand", text: "20% chance a protection holds a second time." },
  pockets: { name: "Deep pockets", text: "Carry 5 more." },
  quickhands: { name: "Quick hands", text: "Search 18% faster." },
  fleet: { name: "Fleet", text: "Move 5% faster." },
  strongarm: { name: "Strong arm", text: "The whip is ready 20% sooner." },
  scavenger: { name: "Scavenger", text: "Find 20% more." },
};
export const MAX_RANK = 3;
export const xpForLevel = (level: number) => 40 + level * 35;

// ---- Nong Kadyo's trade ----------------------------------------------------------------------
export const SHOP: { item: ItemId; cost: number }[] = [
  { item: "salt", cost: 3 }, { item: "garlic", cost: 4 }, { item: "oil", cost: 3 }, { item: "kindling", cost: 2 }, { item: "tobacco", cost: 9 },
];
export const HERB_PRICE = 3;        // centavos he gives for one bundle of herbs
export const CHARM_HERBS = 6;       // herbs he binds into one charm
export const WHIP_COST = 30;
export const TONIC = { herbs: 4, coins: 6 };  // Rosing's tonic: gives back one of her strength, once a day

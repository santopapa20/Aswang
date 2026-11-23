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
  herbs: { name: "Herbs", use: "Nong Kadyo trades for them, and binds them into charms.", weighs: true },
  coins: { name: "Centavos", use: "For Nong Kadyo.", weighs: false },
};
export const ITEM_ORDER: ItemId[] = ["salt", "garlic", "oil", "kindling", "tobacco", "herbs", "coins"];
export const BASE_CARRY = 22;

// ---- charms: found or made, two can be worn ---------------------------------------------------
export type StatId = "quiet" | "bright" | "thrifty" | "swift" | "steady" | "lucky" | "firm";
export const STATS: Record<StatId, { noun: string; text: (v: number) => string }> = {
  quiet: { noun: "soft steps", text: (v) => `You are heard from ${pct(v)} less far` },
  bright: { noun: "the long flame", text: (v) => `The lamp reaches ${pct(v)} further` },
  thrifty: { noun: "the slow wick", text: (v) => `The lamp uses ${pct(v)} less oil` },
  swift: { noun: "quick feet", text: (v) => `You move ${pct(v * 0.5)} faster` },
  steady: { noun: "long breath", text: (v) => `You can run ${pct(v * 1.5)} longer` },
  lucky: { noun: "the open hand", text: (v) => `You find ${pct(v * 1.5)} more` },
  firm: { noun: "the held door", text: (v) => `${pct(v * 1.4)} chance a protection holds a second time` },
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
export type PerkId = "lungs" | "softstep" | "wick" | "firmhand" | "pockets" | "quickhands" | "fleet" | "strongarm" | "scavenger";
export const PATHS: { name: string; about: string; perks: PerkId[] }[] = [
  { name: "Bantay", about: "The watchman: breath, quiet and the lamp.", perks: ["lungs", "softstep", "wick"] },
  { name: "Tinun-an", about: "The albularyo's pupil: protections and careful hands.", perks: ["firmhand", "pockets", "quickhands"] },
  { name: "Mangangayam", about: "The hunter: legs, the whip, a nose for what is hidden.", perks: ["fleet", "strongarm", "scavenger"] },
];
export const PERKS: Record<PerkId, { name: string; text: string }> = {
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
export const HERB_PRICE = 2;        // centavos he gives for one bundle of herbs
export const CHARM_HERBS = 6;       // herbs he binds into one charm
export const WHIP_COST = 30;
export const TONIC = { herbs: 4, coins: 6 };  // Rosing's tonic: gives back one of her strength, once a day

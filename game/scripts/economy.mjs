// The economy check (after the balance-check method: every number judged against a stated target, and a
// number with no target reported as not judged, never as fine). It rolls the game's own loot tables
// (src/game/data.ts, imported directly) many times and adds up, night by night, the coins a player can
// earn and what there is to spend them on, for two players: one who keeps to the barrio, and one who also
// goes to the old sitio, does the work and the favours, and hunts the kin.
//   node scripts/economy.mjs
import { BOUNTY_OFFERS, CHARM_HERBS, HERB_PRICE, KADYO_HERBS, KIN, KIN_NIGHTS, RECIPES, SHOP, TONIC, WHIP_COST, rollLoot } from "../src/game/data.ts";
import { nodes } from "../src/game/layout.ts";

let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xffffff) / 0x1000000; };
const TRIALS = 4000;
/** What searching a set of places once gives on average. */
function expected(where) {
  const sum = {};
  for (let t = 0; t < TRIALS; t++) for (const n of where) {
    const { found } = rollLoot(n.kind, n.rich, 0, rnd);
    for (const [k, v] of Object.entries(found)) sum[k] = (sum[k] ?? 0) + v;
  }
  for (const k of Object.keys(sum)) sum[k] /= TRIALS;
  return sum;
}
const barrio = nodes.filter((n) => n.x < 34), sitio = nodes.filter((n) => n.x >= 92);
const eb = expected(barrio), es = expected(sitio);
const f = (x) => (x ?? 0).toFixed(1);
console.log("== One search of every place (the land's herbs and fronds grow back each day; the sitio's chests, jars and sacks are emptied once)");
console.log(`barrio (${barrio.length} places): ${Object.entries(eb).map(([k, v]) => `${k} ${f(v)}`).join(", ")}`);
console.log(`sitio  (${sitio.length} places): ${Object.entries(es).map(([k, v]) => `${k} ${f(v)}`).join(", ")}`);

const avg = (k) => (KIN[k].coins[0] + KIN[k].coins[1]) / 2;
console.log("\n== Coins a night can bring in (day searches + night)");
console.log("night | barrio herbs sold | sitio chests | kin drops | Kadyo's work | favours | total (barrio only) | total (everything)");
let runB = 0, runA = 0;
const rows = [];
for (let n = 1; n <= 5; n++) {
  const herbsSold = (eb.herbs ?? 0) * HERB_PRICE;               // the barrio's herbs, all sold
  const barrioCoins = (eb.coins ?? 0) + herbsSold;
  // the sitio: what people left behind is there once (searched on night 3's errand); its herbs grow back daily
  const sitioCoins = n === 3 ? (es.coins ?? 0) + (es.herbs ?? 0) * HERB_PRICE : n > 3 ? (es.herbs ?? 0) * HERB_PRICE : 0;
  const kin = KIN_NIGHTS[n].dog * avg("dog") + KIN_NIGHTS[n].crawler * avg("crawler");
  const work = (BOUNTY_OFFERS[n] ?? []).reduce((s, b) => s + b.coins, 0);
  const favours = (n >= 2 ? 12 : 0) + (n === 2 ? 20 : 0);       // Kadyo's herbs every day from 2; Pacing's 20 once
  runB += barrioCoins; runA += barrioCoins + sitioCoins + kin + work + favours;
  rows.push({ n, runB, runA });
  console.log(`  ${n}   | ${f(barrioCoins).padStart(17)} | ${f(sitioCoins).padStart(12)} | ${f(kin).padStart(9)} | ${String(work).padStart(12)} | ${String(favours).padStart(7)} | ${f(runB).padStart(19)} | ${f(runA).padStart(18)}`);
}

const once = RECIPES.filter((r) => r.once).reduce((s, r) => s + (r.cost.coins ?? 0), 0);
const perNight = 2 * SHOP.find((x) => x.item === "salt").cost + SHOP.find((x) => x.item === "garlic").cost + 2 * SHOP.find((x) => x.item === "kindling").cost;
console.log("\n== Things to spend on");
console.log(`whip ${WHIP_COST} c · bench items made once ${once} c · tonic ${TONIC.coins} c + ${TONIC.herbs} herbs a day · a night's extra supplies (2 salt, a garlic, 2 kindling) about ${perNight} c · tobacco ${SHOP.find((x) => x.item === "tobacco").cost} c`);
const sinks = WHIP_COST + once + 5 * perNight + 4 * TONIC.coins + SHOP.find((x) => x.item === "tobacco").cost;
console.log(`everything worth buying across the five nights: about ${sinks} c`);

// ---- judged against stated targets
console.log("\n== Against the targets");
const whipNight = rows.find((r) => r.runB >= WHIP_COST)?.n;
const whipNightA = rows.find((r) => r.runA >= WHIP_COST)?.n;
const verdict = [];
const judge = (name, ok, detail) => { verdict.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };
judge("a player who stays in the barrio can buy the whip by day 3 (target: night 3, the first night with a crawler)", (whipNight ?? 9) <= 3, `night ${whipNight ?? "never"}`);
judge("a player who does everything can buy it by day 2 (the first night with dogs)", (whipNightA ?? 9) <= 2, `night ${whipNightA ?? "never"}`);
const ratio = runA / sinks;
judge("doing everything earns no more than about twice what is worth buying (target: at most 2.5x, so coins keep meaning)", ratio <= 2.5, `${ratio.toFixed(2)}x (${f(runA)} c against ${sinks} c)`);
judge("staying in the barrio still covers the nightly supplies (target: at least the five nights' extras)", runB >= 5 * perNight, `${f(runB)} c against ${5 * perNight} c`);
console.log(`not judged (no stated target): charm prices (${CHARM_HERBS} herbs), herb price (${HERB_PRICE} c), Kadyo's ${KADYO_HERBS}-herb favour`);
console.log(`\nHealth: ${verdict.every(Boolean) ? "HEALTHY" : "CONCERNS"}`);

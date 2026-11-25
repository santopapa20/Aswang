import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { canCraft, carried, endingText, hasSave, live, made, mods, ROMAN, useGame } from "./state";
import { aCharm, Bounty, CHARM_HERBS, EAT, FAVOURS, KADYO_HERBS, KIN_NAMES, RECIPES, RecipeId, TALES, TROPHIES, TrophyId, charmName, HERB_PRICE, ITEM_ORDER, ITEMS, ItemId, MAX_RANK, PATHS, PERKS, RARITY, SHOP, STATS, TONIC, WHIP_COST, WORN_CHARMS, xpForLevel } from "./data";
import { NIGHTS } from "./story";
import { openings } from "./layout";
import { choose, toggles } from "./input";
import { sound } from "./audio";
import { Icon } from "./Icons";

/** Everything drawn on top of the 3D view. */
export function Hud() {
  const stage = useGame((s) => s.stage);
  const panel = useGame((s) => s.panel);
  const dialogue = useGame((s) => s.dialogue);
  const banner = useGame((s) => !!s.banner);
  return (
    <>
      <div className="grain" />
      {stage === "title" && <Title />}
      {stage === "morning" && <Morning />}
      {(stage === "over" || stage === "ending") && <Ending />}
      {(stage === "day" || stage === "night") && (
        <div className={`hud ${dialogue ? "talking" : ""} ${banner ? "fresh" : ""}`}>
          <Play />
          <Banner />
          {dialogue && <DialogueBox />}
          {panel === "bag" && <Bag />}
          {panel === "trade" && <Trade />}
          {panel === "bench" && <Bench />}
          {panel === "pause" && <Pause />}
          {panel && <PanelKeys panel={panel} />}
        </div>
      )}
    </>
  );
}

const KEYS: [string, string][] = [
  ["W A S D", "Move"], ["Shift", "Run"], ["C", "Sneak on or off"], ["E hold", "Use, search, talk"], ["G hold", "Protect a door or window; hold up garlic"],
  ["Q", "Pour a line of salt"], ["F", "Shutter the lamp"], ["R", "Crack the whip"], ["V", "Strike with the itak"], ["Z", "Throw a salt pouch"], ["X", "Light a smudge bundle"], ["H hold", "Eat herbs to heal"], ["T hold", "Turn your shirt inside out"],
  ["Tab", "Bag and learning"], ["Esc", "Pause"], ["M", "Sound on or off"],
];
/** What goes on the bar along the bottom: things you use. Herbs and money are shown as a purse beside it. */
const SUPPLIES: ItemId[] = ["salt", "garlic", "oil", "kindling", "tobacco"];
const ITEM_ICON: Record<ItemId, string> = { salt: "salt", garlic: "garlic", oil: "oil", kindling: "kindling", tobacco: "tobacco", herbs: "herbs", coins: "coins" };
const Keys = () => <ul className="keys">{KEYS.map(([k, v]) => <li key={k}><kbd>{k}</kbd><span>{v}</span></li>)}</ul>;
const Candles = ({ n }: { n: number }) => <span className="candles">{[0, 1, 2].map((i) => <i key={i} className={i < n ? "on" : ""}><Icon name="flame" size={17} /></i>)}</span>;

function Title() {
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const [help, setHelp] = useState(false);
  const saved = hasSave();
  // the models take a while to arrive the first time: say so, and do not start on a black screen
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  // ready once nothing has been arriving for a moment, and it stays ready
  useEffect(() => { if (ready || active) return; const id = setTimeout(() => setReady(true), 900); return () => clearTimeout(id); }, [active, ready]);
  return (
    <div className="screen title">
      <div className="embers">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 1.3}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />)}</div>
      <div className="title-card">
        <p className="eyebrow">A folk horror in five nights</p>
        <h1 className="logo">Aswang<span>Night</span></h1>
        <p className="place">Visayas · 1953</p>
        <p className="lede">Your sister is near her time. Her husband is cutting cane in Negros.<br />Every night, something tests the house. Every morning, a neighbour asks how you slept.</p>
        <nav className="menu">
          {!ready && <div className="loading"><span>Lighting the lamps</span><i><b style={{ width: `${Math.max(4, progress)}%` }} /></i></div>}
          {ready && saved && <button className="primary" onClick={() => { sound.wake(); continueGame(); }}>Continue the watch</button>}
          {ready && <button className={saved ? "" : "primary"} onClick={() => { sound.wake(); newGame(); }}>{saved ? "Begin again" : "Begin the watch"}</button>}
          <button onClick={() => setHelp(!help)}>How to play</button>
          <button onClick={() => { sound.wake(); toggleMute(); }}>Sound: {muted ? "off" : "on"}</button>
        </nav>
        {help && (
          <div className="howto">
            <p>By day, gather and prepare. At dusk, protect the door and windows. At night, guard the house, and leave it only when you must. Each protection holds once. Three breaches and Rosing is lost.</p>
            <Keys />
          </div>
        )}
        <p className="fine">Keyboard, or touch on a phone held sideways. Sound matters: use headphones if you can.</p>
      </div>
    </div>
  );
}

/** The card that names a day or a night as it begins. */
function Banner() {
  const banner = useGame((s) => s.banner);
  if (!banner) return null;
  return (
    <div className="banner" key={banner.id}>
      <div>
        <i className="rule" />
        <h2>{banner.big}</h2>
        <p>{banner.small}</p>
        <i className="rule" />
      </div>
    </div>
  );
}

/** The arrow to the current objective. It follows the 3D view every frame, outside React. */
function Arrow() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const g = live.guide, d = el.current;
      if (d) {
        d.style.opacity = g.show ? "1" : "0";
        d.style.left = `${g.x}%`; d.style.top = `${g.y}%`;
        d.className = `guide ${g.on ? "on" : "off"} ${g.urgent ? "urgent" : ""}`;
        (d.firstChild as HTMLElement).style.transform = g.on ? "rotate(180deg)" : `rotate(${g.angle + Math.PI / 2}rad)`;
        (d.lastChild as HTMLElement).textContent = `${Math.round(g.dist)} m`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return <div ref={el} className="guide"><span><Icon name="arrow" size={22} /></span><em /></div>;
}

function Prompt({ k, p }: { k: "E" | "G" | "T"; p: { label: string; progress: number } }) {
  const off = p.progress < 0;
  return (
    <div className={`prompt ${off ? "off" : ""} ${p.progress > 0 ? "holding" : ""}`}>
      {!off && (
        <span className="keycap">
          <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" /><circle className="fill" cx="18" cy="18" r="16" style={{ strokeDashoffset: 100.5 * (1 - Math.max(0, Math.min(1, p.progress))) }} /></svg>
          <b>{k}</b>
        </span>
      )}
      <span>{p.label}</span>
    </div>
  );
}

/** One thing on the belt along the bottom: its icon, how many, its key, and what it is (or how it is). */
function Item({ icon, n, label, keyed, empty, lit, carry, title }: { icon: string; n?: number; label: string; keyed?: string | null; empty?: boolean; lit?: boolean; carry?: boolean; title?: string }) {
  return (
    <div className={`item ${empty ? "empty" : ""} ${lit ? "lit" : ""} ${carry ? "carry" : ""}`} title={title ?? label}>
      <span className="well">{keyed && <kbd className="key">{keyed}</kbd>}<Icon name={icon} size={22} />{n !== undefined && <b>{n}</b>}</span>
      <em>{label}</em>
    </div>
  );
}

/** The playing screen. It re-reads the fast-changing values ten times a second. */
function Play() {
  const g = useGame();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(id); }, []);
  const [caption, setCaption] = useState(g.caption);
  useEffect(() => {
    setCaption(g.caption);
    if (!g.caption) return;
    const id = setTimeout(() => setCaption(null), 4200 + g.caption.text.length * 45);
    return () => clearTimeout(id);
  }, [g.caption]);

  const night = g.stage === "night";
  const plan = NIGHTS[g.night - 1];
  const done = Math.min(1, 1 - live.clock / Math.max(1, live.length));
  const m = mods(g);
  const o = live.objective;
  const work = g.bounties.filter((b) => b.state !== "offered");
  const lit = g.lampOn && live.lampBlown <= 0;
  const fear = night && live.aswang.active ? Math.max(0, 1 - live.aswang.near / 9) : 0;
  const attacked = live.breach > 0 ? (g.onRoof ? "roof" : live.breachAt) : null;
  const warn = !night ? null
    : live.caught > 0 ? "It has you"
    : g.overhead ? "Wings overhead · run sideways"
    : live.sigbin.feeding ? "It is at your shadow · F shutters the lamp"
    : g.hunted ? "It has seen you"
    : live.lampBlown > 0 ? `Your lamp is out · ${Math.ceil(live.lampBlown)}s`
    : night && g.bag.oil <= 0 && !g.strongLamp ? "The lamp is dry"
    : null;
  const slots: [string, string, string | null, boolean][] = [
    ...openings.map((x): [string, string, string | null, boolean] => [x.id === "door" ? "door" : "window", x.id === "door" ? "Door" : x.id === "west" ? "West" : "East", g.wards[x.id], attacked === x.id]),
    ["roof", "Roof", live.smoke > 0 ? `${Math.ceil(live.smoke)}s` : null, attacked === "roof"],
  ];
  const late = live.clock < 30;

  return (
    <>
      <div className="vignette" />
      <div className={`fear ${g.settings.flashes === "reduced" ? "calm" : ""}`} style={{ opacity: Math.max(fear * 0.85, attacked ? 0.35 : 0, g.hunted ? 0.6 : 0, night ? live.sigbin.drain * 0.9 : 0) }} />
      <div className="hurt" style={{ opacity: live.hurt * (g.settings.flashes === "reduced" ? 0.35 : 0.9) }} />
      <div className="blackout" style={{ opacity: live.caught > 0 ? Math.min(1, 1.25 - live.caught / 2.6) : 0 }} />

      <div className="scrim top" /><div className="scrim bottom" />
      <header className="topbar">
        <section className="status">
          <div className="status-head"><span className="label">Rosing</span><Candles n={g.rosing} /></div>
          <div className="wards">
            {slots.map(([icon, label, state, hit], i) => (
              <div key={i} className={`ward ${state ? "on" : ""} ${hit ? "hit" : ""}`} title={`${label}: ${hit ? "something is breaking in" : state ?? "open"}`}>
                <span className="ring"><Icon name={icon} size={17} />{hit && <i className="meter" style={{ height: `${Math.min(100, live.breach * 100)}%` }} />}</span>
                <b>{label}</b>
                <em>{hit ? "breaking" : state ?? "open"}</em>
              </div>
            ))}
          </div>
        </section>

        <section className={`time ${night ? "night" : "day"} ${late ? "late" : ""} ${g.onRoof || g.overhead ? "aside" : ""}`}>
          <h2>{night ? `Night ${ROMAN[g.night - 1]}` : `Day ${ROMAN[g.night - 1]}`}</h2>
          <p>{night ? (late ? "First light is near" : plan.name) : late ? "Dusk is coming" : "Before dark"}</p>
          <div className="sky">
            <i className="gone" style={{ width: `${done * 100}%` }} />
            <span className="body" style={{ left: `${done * 100}%` }}>
              <svg width="14" height="14" viewBox="0 0 24 24">{night ? <path d="M20 14.600A8.200 8.200 0 1 1 9.400 4a6.600 6.600 0 0 0 10.600 10.600z" /> : <circle cx="12" cy="12" r="6.5" />}</svg>
            </span>
          </div>
        </section>

        <section className={`goal ${o.urgent ? "urgent" : ""}`}>
          {o.title ? (
            <>
              <h3><span>{o.title}</span>{o.target && live.guide.dist > 2.2 && <em>{Math.round(live.guide.dist)} m</em>}</h3>
              <p>{o.text}</p>
            </>
          ) : null}
          {(g.favours.length > 0 || work.length > 0) && (
            <ul className="work">
              {g.favours.map((f) => <li key={f.id} className={f.state === "carrying" ? "done" : ""}>{FAVOURS[f.id].task}{f.state === "carrying" ? " · you have it" : ""}</li>)}
              {work.map((b) => <li key={b.id} className={b.state}>{b.state === "done" ? "Nong Kadyo's work is done: he pays in the morning" : `Nong Kadyo: ${b.count === 1 ? `a ${KIN_NAMES[b.kind][0]}` : KIN_NAMES[b.kind][1]}, ${b.got} of ${b.count}`}</li>)}
            </ul>
          )}
        </section>
      </header>

      {warn && <div className="warn">{warn}</div>}
      <Arrow />
      <div className="toasts">{g.toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}><Icon name={t.tone === "good" ? "check" : t.tone === "bad" ? "cross" : "eye"} size={15} /><span>{t.text}</span></div>)}</div>

      <div className="centre">
        {caption && !g.dialogue && <div className="caption" key={caption.id}>{caption.who && <b>{caption.who}</b>}<span>{caption.text}</span></div>}
        {g.lost && live.shirtTurn > 0 && <Prompt k="T" p={{ label: "Turning your shirt inside out", progress: Math.min(1, live.shirtTurn / 2) }} />}
        {!g.dialogue && !g.panel && live.shirtTurn <= 0 && (
          <div className="prompts">
            {live.prompts.E && <Prompt k="E" p={live.prompts.E} />}
            {live.prompts.G && <Prompt k="G" p={live.prompts.G} />}
          </div>
        )}
      </div>

      <footer className="bottombar">
        <section className="vitals">
          <div className={`vital ${live.health / m.health < 0.3 ? "low" : ""}`} title="Health: bites and grabs take it; eat herbs (hold H) or rest by day">
            <Icon name="heart" size={15} />
            <div className="bar health"><i style={{ width: `${(live.health / m.health) * 100}%` }} />{live.eating > 0 && <b className="eat" style={{ width: `${(live.eating / EAT.seconds) * 100}%` }} />}</div>
            {live.eating > 0 && <span>eating</span>}
          </div>
          <div className={`vital ${live.stamina < 0.25 ? "low" : ""}`} title="Breath: running spends it">
            <Icon name="breath" size={15} /><div className="bar breath"><i style={{ width: `${live.stamina * 100}%` }} /></div>
          </div>
          <div className="vital level" title="What you have learned">
            <span>Level {g.level}</span><div className="bar gold"><i style={{ width: `${(g.xp / xpForLevel(g.level)) * 100}%` }} /></div>
            {g.points > 0 && <em className="learn">{g.points} to learn <kbd>Tab</kbd></em>}
          </div>
        </section>

        <section className="belt">
          {SUPPLIES.filter((k) => g.bag[k] > 0 || k !== "tobacco").map((k) => {
            const keyed = k === "salt" ? "Q" : k === "oil" && night ? "F" : null;
            const glowing = k === "oil" && night && lit && (g.bag.oil > 0 || g.strongLamp);
            const say = k === "oil" && night ? (live.lampBlown > 0 ? "blown out" : !g.lampOn ? "shuttered" : g.strongLamp ? "strong oil" : g.bag.oil <= 0 ? "dry" : "lamp lit") : ITEMS[k].name;
            return <Item key={k} icon={ITEM_ICON[k]} n={g.bag[k]} label={say} keyed={keyed} empty={g.bag[k] === 0} lit={glowing} title={`${ITEMS[k].name}: ${ITEMS[k].use}`} />;
          })}
          {(g.hasWhip || g.kit.itak || g.kit.pouch > 0 || g.kit.string > 0 || g.kit.smudge > 0 || live.smudge > 0) && <i className="sep" />}
          {g.hasWhip && <Item icon="whip" label={live.whipWait > 0 ? `${Math.ceil(live.whipWait)}s` : "Whip"} keyed="R" empty={live.whipWait > 0} />}
          {g.kit.itak && <Item icon="blade" label={g.kit.spear ? "Sibat" : "Itak"} keyed="V" empty={live.itakWait > 0} />}
          {g.kit.pouch > 0 && <Item icon="salt" n={g.kit.pouch} label="Pouch" keyed="Z" />}
          {g.kit.string > 0 && <Item icon="garlic" n={g.kit.string} label="String" lit />}
          {(g.kit.smudge > 0 || live.smudge > 0) && <Item icon="flame" n={g.kit.smudge} label={live.smudge > 0 ? `smoke ${Math.ceil(live.smudge)}s` : "Smudge"} keyed="X" lit={live.smudge > 0} />}
          {g.favours.filter((f) => f.state === "carrying").map((f) => <Item key={f.id} icon="charm" label={f.id === "rosary" ? "Rosary" : "Her hair"} carry />)}
          {g.carrying && <Item icon={g.carrying === "water" ? "salt" : "oil"} label={g.carrying === "water" ? "Water" : "The oil"} carry />}
        </section>

        <section className="purse">
          <div className="coins">
            <span title="Centavos"><Icon name="coins" size={15} />{g.bag.coins}</span>
            <span title="Herbs"><Icon name="herbs" size={15} />{g.bag.herbs}</span>
            <span title="How much you carry" className={carried(g) >= m.carry ? "full" : ""}><Icon name="bag" size={15} />{carried(g)}<small>/{m.carry}</small></span>
          </div>
          <div className="hints"><span><kbd>Tab</kbd>bag</span><span><kbd>Esc</kbd>pause</span><span><kbd>C</kbd>{toggles.sneak ? "sneaking" : "sneak"}</span></div>
        </section>
      </footer>
    </>
  );
}

function DialogueBox() {
  const d = useGame((s) => s.dialogue)!;
  const advance = useGame((s) => s.advance);
  const line = d.lines[d.index];
  const last = d.index === d.lines.length - 1;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0); live.typing = true; live.skipTyping = false;
    const id = setInterval(() => setShown((c) => {
      if (live.skipTyping || c >= line.text.length) { live.typing = false; clearInterval(id); return line.text.length; }
      return c + 2;
    }), 20);
    return () => { clearInterval(id); live.typing = false; };
  }, [line.text]);
  const full = shown >= line.text.length;
  return (
    <>
      <div className="letterbox top" /><div className="letterbox bottom" />
      <div className="dialogue" onClick={() => (full ? advance() : (live.skipTyping = true))}>
        <div className="said">
          {line.who && <b>{line.who}</b>}
          <p className={line.who ? "" : "narration"}>{line.text.slice(0, shown)}<i className="rest">{line.text.slice(shown)}</i></p>
          {full && last && d.choices ? (
            <div className="choices">{d.choices.map((c, i) => <button key={i} onClick={(e) => { e.stopPropagation(); choose(i); }}><kbd>{i + 1}</kbd>{c.text}</button>)}</div>
          ) : <span className="more">{full ? <><kbd>Enter</kbd> {last ? "close" : "next"}</> : " "}</span>}
        </div>
      </div>
    </>
  );
}

type BagTab = "carried" | "charms" | "learning" | "tales" | "known";

/**
 * The bag (Tab): one page at a time instead of everything at once. What he carries, the charms (worn first),
 * what he has learned and can still learn, the old tales, and what he has found out about his neighbour.
 * It opens on Learning when there is something to spend, otherwise on what he carries.
 */
function Bag() {
  const g = useGame();
  const m = mods(g);
  const [tab, setTab] = useState<BagTab>(() => (g.points > 0 ? "learning" : "carried"));
  const proofs: [boolean, string, string, string][] = [
    [g.proofs.salt, "The salted door", "She would not come near it.", "Leave salt across the door overnight, and see who visits in the morning."],
    [g.proofs.oil, "The oil", "It boiled beside Nang Pacing.", "An albularyo's oil boils when one of them is near."],
    [g.proofs.skirt, "The patadyong", "The legs in the roots wear her skirt.", "They leave their legs standing somewhere."],
  ];
  const known = proofs.filter(([has]) => has).length;
  const worn = g.charms.filter((c) => g.worn.includes(c.id));
  const loose = g.charms.filter((c) => !g.worn.includes(c.id));
  const tabs: [BagTab, string, string][] = [
    ["carried", "Carried", `${carried(g)} of ${m.carry}`],
    ["charms", "Charms", `${worn.length} of ${WORN_CHARMS} worn`],
    ["learning", "Learning", g.points > 0 ? `${g.points} to spend` : `level ${g.level}`],
    ["tales", "Old tales", `${g.tales.length} of ${TALES.length}`],
    ["known", "What you know", `${known} of ${proofs.length}`],
  ];
  const trophies = (Object.keys(TROPHIES) as TrophyId[]).filter((k) => g.trophies[k] > 0);
  const kit: [string, string, string, number | null][] = [
    ...(g.hasWhip ? [["whip", "Stingray-tail whip", "Crack it (R) when one is close: she falls back, and a thing that can be hurt is hurt.", null] as [string, string, string, number | null]] : []),
    ...(g.kit.itak ? [["blade", g.kit.spear ? "Sibat" : "Itak", g.kit.spear ? "The itak on a pole (V): it reaches a metre further." : "Strikes what is close in front of you (V).", null] as [string, string, string, number | null]] : []),
    ...(g.kit.pouch ? [["salt", "Salt pouches", "Thrown in the face of what is in front of you (Z): it reels.", g.kit.pouch] as [string, string, string, number | null]] : []),
    ...(g.kit.string ? [["garlic", "Garlic strings", "Worn at the neck: the next bite or grab is turned aside.", g.kit.string] as [string, string, string, number | null]] : []),
    ...(g.kit.smudge ? [["flame", "Smudge bundles", "Lit (X), the smoke hides you for half a minute.", g.kit.smudge] as [string, string, string, number | null]] : []),
    ...(g.kit.strongOil ? [["oil", "Strong oil", "Goes in the lamp at dusk and burns all night.", g.kit.strongOil] as [string, string, string, number | null]] : []),
  ];
  const charmCard = (c: (typeof g.charms)[number]) => {
    const on = g.worn.includes(c.id);
    return (
      <button key={c.id} className={`charm-card ${on ? "worn" : ""}`} style={{ ["--rarity" as string]: RARITY[c.rarity].colour }} onClick={() => g.wear(c.id)}>
        <span className="gem"><Icon name="charm" size={20} /></span>
        <span className="charm-body"><b>{charmName(c)}</b><span>{STATS[c.stat].text(c.value)}</span></span>
        <em>{on ? "Worn" : worn.length >= WORN_CHARMS ? "Swap" : "Wear"}</em>
      </button>
    );
  };
  return (
    <div className="panel wide bag">
      <header>
        <h2>Your bag</h2>
        <span className="meta">
          <span className="purse-head">
            <span className="chip" title="Centavos"><Icon name="coins" size={14} />{g.bag.coins}</span>
            <span className="chip" title="Herbs"><Icon name="herbs" size={14} />{g.bag.herbs}</span>
            <span className={`chip ${carried(g) >= m.carry ? "short" : ""}`} title="How much you carry"><Icon name="bag" size={14} />{carried(g)}/{m.carry}</span>
          </span>
          <kbd>Tab</kbd>
        </span>
      </header>
      <nav className="tabs" role="tablist">
        {tabs.map(([id, name, sub]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`${tab === id ? "on" : ""} ${id === "learning" && g.points > 0 ? "news" : ""}`} onClick={() => setTab(id)}>
            <b>{name}</b><small>{sub}</small>
          </button>
        ))}
      </nav>

      {tab === "carried" && (
        <div className="bag-page">
          <h3>Supplies</h3>
          <div className="cards">
            {ITEM_ORDER.map((k) => (
              <div key={k} className={`card-item ${g.bag[k] ? "" : "empty"}`}>
                <span className="card-icon"><Icon name={ITEM_ICON[k]} size={22} /></span>
                <span className="card-body"><b>{ITEMS[k].name}</b><span>{ITEMS[k].use}</span></span>
                <em>{g.bag[k]}</em>
              </div>
            ))}
          </div>
          {kit.length > 0 && (
            <>
              <h3>Made and bought</h3>
              <div className="cards">
                {kit.map(([icon, name, text, n]) => (
                  <div key={name} className="card-item">
                    <span className="card-icon"><Icon name={icon} size={22} /></span>
                    <span className="card-body"><b>{name}</b><span>{text}</span></span>
                    {n !== null && <em>{n}</em>}
                  </div>
                ))}
              </div>
            </>
          )}
          {trophies.length > 0 && (
            <>
              <h3>Trophies <small>for the bench</small></h3>
              <div className="cards">
                {trophies.map((k) => (
                  <div key={k} className="card-item">
                    <span className="card-icon"><Icon name={TROPHY_ICON[k]} size={22} /></span>
                    <span className="card-body"><b>{TROPHIES[k].name}</b><span>{TROPHIES[k].text}</span></span>
                    <em>{g.trophies[k]}</em>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "charms" && (
        <div className="bag-page">
          {g.charms.length === 0 ? (
            <p className="empty-page">No charms yet. Old chests hide them, Nong Kadyo binds them from herbs, and the bench makes better ones.</p>
          ) : (
            <>
              <h3>Worn <small>{worn.length} of {WORN_CHARMS}{worn.length >= WORN_CHARMS && loose.length ? ": choose another to swap it for the oldest" : ""}</small></h3>
              {worn.length ? <div className="cards">{worn.map(charmCard)}</div> : <p className="empty">Nothing worn. Choose one below.</p>}
              {loose.length > 0 && <><h3>In the bag</h3><div className="cards">{loose.map(charmCard)}</div></>}
            </>
          )}
        </div>
      )}

      {tab === "learning" && (
        <div className="bag-page">
          <p className="page-lede">{g.points > 0 ? `You have ${g.points} to spend. Each skill can be learned ${MAX_RANK} times.` : `Level ${g.level}. Laying the kin down, searching and keeping the house earn more.`}</p>
          <div className="paths">
            {PATHS.map((path) => (
              <section key={path.name} className="path">
                <h4>{path.name}</h4>
                <p className="path-about">{path.about}</p>
                {path.perks.map((id) => (
                  <button key={id} className="perk" disabled={g.points <= 0 || g.perks[id] >= MAX_RANK} onClick={() => g.spendPoint(id)}>
                    <div><b>{PERKS[id].name}</b><p>{PERKS[id].text}</p></div>
                    <span className="rank">{Array.from({ length: MAX_RANK }, (_, n) => <i key={n} className={n < g.perks[id] ? "on" : ""} />)}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}

      {tab === "tales" && (
        <div className="bag-page">
          {g.tales.length === 0 ? <p className="empty-page">None yet. Pages of the old tales turn up in chests and jars.</p> : (
            <div className="tales">
              {TALES.filter((t) => g.tales.includes(t.id)).map((t) => <article key={t.id} className="tale"><h4>{t.title}</h4><p>{t.text}</p></article>)}
            </div>
          )}
          {g.tales.length > 0 && g.tales.length < TALES.length && <p className="fine">{TALES.length - g.tales.length} more to find, in chests and jars.</p>}
        </div>
      )}

      {tab === "known" && (
        <div className="bag-page">
          <p className="page-lede">What you have seen for yourself about Nang Pacing.</p>
          <div className="cards one">
            {proofs.map(([has, name, yes, no]) => (
              <div key={name} className={`card-item ${has ? "found" : "empty"}`}>
                <span className="card-icon"><Icon name={has ? "check" : "eye"} size={20} /></span>
                <span className="card-body"><b>{name}</b><span>{has ? yes : no}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TROPHY_ICON: Record<TrophyId, string> = { fang: "fang", claw: "claw", stone: "stone" };
const costIcon = (k: string) => (k in TROPHY_ICON ? TROPHY_ICON[k as TrophyId] : ITEM_ICON[k as ItemId]);
const costName = (k: string) => (k in TROPHIES ? TROPHIES[k as TrophyId].name : ITEMS[k as ItemId].name);

/** What something takes, as small chips: an icon and a number each, red where he has too few. */
function Costs({ cost, have }: { cost: Partial<Record<string, number>>; have: (k: string) => number }) {
  return <span className="costs">{Object.entries(cost).map(([k, n]) => <span key={k} className={`chip ${have(k) < n! ? "short" : ""}`} title={`${n} ${costName(k)} (you have ${have(k)})`}><Icon name={costIcon(k)} size={14} />{n}</span>)}</span>;
}
/** What he has to trade with, for a panel's header. */
function Purse({ keys }: { keys: string[] }) {
  const g = useGame();
  const have = (k: string) => (k in g.trophies ? g.trophies[k as TrophyId] : g.bag[k as ItemId]);
  return <span className="purse-head">{keys.map((k) => <span key={k} className="chip" title={costName(k)}><Icon name={costIcon(k)} size={14} />{have(k)}</span>)}</span>;
}

/**
 * One thing to buy, sell, make or take, in a panel: its icon, its name and what it does, what it takes,
 * and what pressing it does. Kept outside the panels: defined inside one, it would be rebuilt on every
 * update and could swallow a click.
 */
function Offer({ icon, name, count, text, note, side, action, state, act }: {
  icon: string; name: string; count?: number; text: string; note?: string; side?: React.ReactNode; action: string;
  state: "ready" | "off" | "done"; act: () => void;
}) {
  return (
    <button className={`offer ${state}`} disabled={state !== "ready"} onClick={act}>
      <span className="offer-icon"><Icon name={icon} size={22} /></span>
      <span className="offer-body">
        <b>{name}{count ? <small>{count} made</small> : null}</b>
        <span className="offer-text">{text}</span>
        {note && <span className="offer-note">{note}</span>}
      </span>
      <span className="offer-side">{side}<em>{action}</em></span>
    </button>
  );
}

function Trade() {
  const g = useGame();
  const full = carried(g) >= mods(g).carry;
  const have = (k: string) => (k in g.trophies ? g.trophies[k as TrophyId] : g.bag[k as ItemId]);
  const buy = (item: (typeof SHOP)[number]) => { if (!full && g.spend("coins", item.cost)) g.add(item.item, 1); };
  const ready = (ok: boolean) => (ok ? "ready" : "off") as "ready" | "off";
  return (
    <div className="panel shop">
      <header>
        <h2>Nong Kadyo <small>trades by day</small></h2>
        <span className="meta"><Purse keys={["coins", "herbs"]} />{full && <span className="chip short" title="You can carry no more"><Icon name="bag" size={14} />full</span>}<kbd>Esc</kbd></span>
      </header>
      {g.bounties.length > 0 && (
        <>
          <h3>His work</h3>
          <section className="offers work">{g.bounties.map((b) => <WorkOffer key={b.id} b={b} />)}</section>
        </>
      )}
      <h3>Buy{full && <small>your bag is full</small>}</h3>
      <section className="offers">
        {SHOP.map((it) => <Offer key={it.item} icon={ITEM_ICON[it.item]} name={ITEMS[it.item].name} text={ITEMS[it.item].use} side={<Costs cost={{ coins: it.cost }} have={have} />} action="Buy" state={ready(g.bag.coins >= it.cost && !full)} act={() => buy(it)} />)}
        {!g.hasWhip && <Offer icon="whip" name="Stingray-tail whip" text="The old weapon against them. It does not kill her. It makes her let go." side={<Costs cost={{ coins: WHIP_COST }} have={have} />} action="Buy" state={ready(g.bag.coins >= WHIP_COST)}
          act={() => { if (g.spend("coins", WHIP_COST)) { g.set({ hasWhip: true }); g.toast("A stingray-tail whip. Press R when she is close.", "good"); } }} />}
      </section>
      <h3>Herbs</h3>
      <section className="offers">
        {g.favours.some((f) => f.id === "herbs") && <Offer icon="herbs" name={`${KADYO_HERBS} bundles, as he asked`} text="He takes them and puts them straight in the pot." note={g.bag.herbs < KADYO_HERBS ? `You have ${g.bag.herbs} of ${KADYO_HERBS}.` : undefined}
          side={<span className="gain"><Icon name="coins" size={14} />+12</span>} action="Give" state={ready(g.bag.herbs >= KADYO_HERBS)}
          act={() => { if (g.spend("herbs", KADYO_HERBS)) { g.endFavour("herbs"); g.add("coins", 12); g.gainXp(30); g.set({ kadyoTrust: g.kadyoTrust + 1 }); g.toast("Nong Kadyo pays 12 centavos, and thinks the better of you.", "good"); } }} />}
        <Offer icon="herbs" name="Sell a bundle" text="He always needs them." side={<span className="gain"><Icon name="coins" size={14} />+{HERB_PRICE}</span>} action="Sell" state={ready(g.bag.herbs >= 1)} act={() => { if (g.spend("herbs", 1)) g.add("coins", HERB_PRICE); }} />
        <Offer icon="charm" name="Have a charm bound" text="Herbs, a prayer and a little oil knotted into a habak. No two come out alike." side={<Costs cost={{ herbs: CHARM_HERBS }} have={have} />} action="Bind" state={ready(g.bag.herbs >= CHARM_HERBS)}
          act={() => { if (g.spend("herbs", CHARM_HERBS)) { const c = g.addCharm(0.05); g.toast(`Nong Kadyo binds ${aCharm(c)}.`, "good"); } }} />
        <Offer icon="flame" name="A tonic for Rosing" text="Bitter leaves boiled down. It gives her back some of her strength."
          note={g.rosing >= 3 ? "She does not need it." : g.tonicOn === g.night ? "One a day is all she can take." : undefined}
          side={<Costs cost={{ herbs: TONIC.herbs, coins: TONIC.coins }} have={have} />} action="Buy"
          state={ready(g.rosing < 3 && g.tonicOn !== g.night && g.bag.herbs >= TONIC.herbs && g.bag.coins >= TONIC.coins)}
          act={() => { if (g.spend("herbs", TONIC.herbs) && g.spend("coins", TONIC.coins)) { g.set({ rosing: Math.min(3, g.rosing + 1), tonicOn: g.night }); g.toast("A tonic for Rosing. She will be stronger tonight.", "good"); } }} />
      </section>
    </div>
  );
}

/** The workbench beside the house: what can be made, what it takes, and what he already has. */
function Bench() {
  const g = useGame();
  const have = (k: string) => (k in g.trophies ? g.trophies[k as TrophyId] : g.bag[k as ItemId]);
  return (
    <div className="panel shop">
      <header>
        <h2>The bench <small>beside the house</small></h2>
        <span className="meta"><Purse keys={["coins", "kindling", "herbs", "fang", "claw", "stone"]} /><kbd>Esc</kbd></span>
      </header>
      <section className="offers">
        {RECIPES.map((r) => {
          const done = made(g.kit, r.id);
          const note = done ? undefined : r.whip && !g.hasWhip ? "Needs a whip first: Nong Kadyo sells one." : r.needs === "itak" && !g.kit.itak ? "Make the itak first." : undefined;
          const count = r.id === "pouch" ? g.kit.pouch : r.id === "string" ? g.kit.string : r.id === "smudge" ? g.kit.smudge : r.id === "strongOil" ? g.kit.strongOil : 0;
          return <Offer key={r.id} icon={r.icon} name={r.name} count={count} text={r.text} note={note} side={done ? undefined : <Costs cost={r.cost} have={have} />}
            action={done ? "Made" : "Make"} state={done ? "done" : canCraft(g, r.id) ? "ready" : "off"} act={() => g.craft(r.id)} />;
        })}
      </section>
    </div>
  );
}

/** One piece of Nong Kadyo's work: take it, see how it goes, or be paid for it. */
function WorkOffer({ b }: { b: Bounty }) {
  const g = useGame();
  const what = `${b.count === 1 ? "One" : b.count === 2 ? "Two" : b.count === 3 ? "Three" : b.count} ${KIN_NAMES[b.kind][b.count === 1 ? 0 : 1]}`;
  const pay = <span className="gain"><Icon name="coins" size={14} />+{b.coins}</span>;
  if (b.state === "done") return <Offer icon="check" name={`${what}: done`} text={`${b.count === 1 ? "Laid down" : b.count === 2 ? "Both laid down" : `All ${b.count} laid down`}. He adds ${b.xp} experience to the coins.`} side={pay} action="Collect" state="ready" act={() => g.payBounty(b.id)} />;
  if (b.state === "taken") return <Offer icon="whip" name={`${what}: taken`} text={b.text} note={`${b.got} of ${b.count} so far.`} side={pay} action="Tonight" state="off" act={() => {}} />;
  return <Offer icon="whip" name={what} text={b.text} side={pay} action="Take" state="ready" act={() => { g.takeBounty(b.id); g.toast("You take Nong Kadyo's work for tonight.", "good"); }} />;
}

/**
 * Keyboard control for any open panel (game-ui-ux): the first thing that can be used is selected when it
 * opens, the arrow keys move between buttons and sliders in reading order (Left and Right turn a slider
 * instead), and Enter or Space uses what is selected. Esc and Tab still close panels as before.
 */
function PanelKeys({ panel }: { panel: string }) {
  useEffect(() => {
    const items = () => [...document.querySelectorAll<HTMLElement>(".hud .panel button:not(:disabled), .hud .panel input")];
    // select the first thing once the panel is on screen (tried again shortly after, in case it was still drawing)
    // the chosen tab if the panel has tabs (the bag), otherwise the first thing that can be used
    const first = () => { if (!document.activeElement?.closest(".hud .panel")) (document.querySelector<HTMLElement>(".hud .panel [aria-selected=true]") ?? items()[0])?.focus(); };
    const ids = [0, 60, 200].map((ms) => setTimeout(first, ms));
    const down = (e: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!keys.includes(e.code)) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.tagName === "INPUT" && (e.code === "ArrowLeft" || e.code === "ArrowRight")) return;   // the slider's own keys
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      const at = el ? list.indexOf(el) : -1;
      const next = at < 0 ? 0 : (at + (e.code === "ArrowUp" || e.code === "ArrowLeft" ? -1 : 1) + list.length) % list.length;
      list[next].focus();
      list[next].scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", down);
    return () => { ids.forEach(clearTimeout); window.removeEventListener("keydown", down); };
  }, [panel]);
  return null;
}

/** One setting: its name, and its choices side by side; the one in force is lit. */
function Choice<T extends string | number | boolean>({ name, value, options, set }: { name: string; value: T; options: [T, string][]; set: (v: T) => void }) {
  return (
    <div className="setting">
      <span>{name}</span>
      <span className="segments">{options.map(([v, label]) => <button key={label} className={v === value ? "on" : ""} aria-pressed={v === value} onClick={() => set(v)}>{label}</button>)}</span>
    </div>
  );
}

function Pause() {
  const g = useGame();
  const s = g.settings;
  const shake = s.shake >= 1 ? 1 : s.shake > 0 ? 0.5 : 0;
  return (
    <div className="panel pause">
      <header><h2>Paused</h2><span className="meta"><kbd>Esc</kbd></span></header>
      <div className="pause-cols">
        <section>
          <nav className="menu"><button onClick={() => g.setPanel(null)} className="primary">Go on</button></nav>
          <h3>Settings</h3>
          <Choice name="Sound" value={!g.muted} options={[[true, "On"], [false, "Off"]]} set={(v) => { if (v === g.muted) g.toggleMute(); }} />
          <div className="setting"><span>Effects</span><span className="slider"><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => g.setSetting("sfx", Number(e.target.value))} aria-label="Effects volume" /><em>{Math.round(s.sfx * 100)}</em></span></div>
          <div className="setting"><span>Night sounds</span><span className="slider"><input type="range" min={0} max={1} step={0.05} value={s.ambience} onChange={(e) => g.setSetting("ambience", Number(e.target.value))} aria-label="Night sounds volume" /><em>{Math.round(s.ambience * 100)}</em></span></div>
          <Choice name="Screen shake" value={shake} options={[[1, "Full"], [0.5, "Half"], [0, "Off"]]} set={(v) => g.setSetting("shake", v)} />
          <Choice name="Flashes" value={s.flashes} options={[["full", "Full"], ["reduced", "Reduced"]]} set={(v) => g.setSetting("flashes", v)} />
          <Choice name="Lamp shadows" value={g.shadows} options={[[true, "On"], [false, "Off"]]} set={(v) => { if (v !== g.shadows) g.toggleShadows(); }} />
          <Choice name="Resolution" value={s.resolution} options={[["auto", "Auto"], ["full", "Full"]]} set={(v) => g.setSetting("resolution", v)} />
          <p className="fine">Your progress is kept at each dusk and each morning.</p>
          <nav className="menu"><button onClick={() => g.toTitle()} className="quiet">Leave to the title</button></nav>
        </section>
        <section className="keyside">
          <h3>Keys</h3>
          <Keys />
          <p className="fine">Arrow keys move through this menu, Enter chooses.</p>
        </section>
      </div>
    </div>
  );
}

function Morning() {
  const g = useGame();
  const stats: [string, string, number][] = [["check", "Protections held", g.tally.held], ["cross", "Times it got in", g.tally.breaches], ["bag", "Places searched", g.tally.searched], ["star", "Learned", g.tally.xp]];
  return (
    <div className="screen dawn">
      <div className="sheet">
        <p className="eyebrow">After night {ROMAN[g.night - 1]} · {NIGHTS[g.night - 1].name}</p>
        <h1>Cockcrow</h1>
        <div className="tally">{stats.map(([icon, label, n]) => <div key={label}><Icon name={icon} size={18} /><b>{n}</b><span>{label}</span></div>)}</div>
        <ul className="report">{g.report.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <div className="rosing">Rosing <Candles n={g.rosing} /></div>
        {g.points > 0 && <p className="fine good">You have {g.points} to spend on what you have learned. Open your bag with Tab once the day begins.</p>}
        <nav className="menu row"><button className="primary" onClick={() => g.nextDay()}>Morning <kbd>Enter</kbd></button></nav>
      </div>
    </div>
  );
}

function Ending() {
  const g = useGame();
  if (g.ending === "choice") {
    const sealed = g.kadyoTrust >= 3 && Object.values(g.proofs).every(Boolean);
    return (
      <div className="screen dawn">
        <div className="sheet">
          <p className="eyebrow">The fifth morning</p>
          <h1>First light</h1>
          <ul className="report">
            <li>From inside the house, a thin new cry. The child is born.</li>
            <li>In the yard, Nang Pacing lies where the light caught her, and cannot rise.</li>
            <li>"I cannot die until someone takes it. Dong. Please."</li>
          </ul>
          <nav className="menu">
            <button onClick={() => g.chooseEnding("take")}>Open your hands</button>
            <button onClick={() => g.chooseEnding("refuse")}>Step back</button>
            {sealed && <button className="primary" onClick={() => g.chooseEnding("sealed")}>Call for Nong Kadyo</button>}
          </nav>
          {!sealed && <p className="fine">There may have been a third way, for someone the albularyo trusted, who had all three proofs.</p>}
        </div>
      </div>
    );
  }
  const e = endingText(g.ending ?? "remains");
  return (
    <div className={`screen ${g.ending === "empty" ? "bad" : "dawn"}`}>
      <div className="sheet">
        <p className="eyebrow">{g.stage === "over" ? `Night ${ROMAN[g.night - 1]}` : "An ending"}</p>
        <h1>{e.title}</h1>
        <ul className="report">{e.lines.map((l, i) => <li key={i} style={{ animationDelay: `${0.6 + i * 1.1}s` }}>{l}</li>)}</ul>
        <nav className="menu row">
          {g.stage === "over" && hasSave() && <button className="primary" onClick={() => g.continueGame()}>Try this night again</button>}
          <button onClick={() => g.toTitle()}>Back to the title</button>
        </nav>
      </div>
    </div>
  );
}

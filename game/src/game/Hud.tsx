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
        <p className="fine">Keyboard only. Sound matters: use headphones if you can.</p>
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

      <header className="topbar">
        <section className="card house">
          <h3>Rosing <Candles n={g.rosing} /></h3>
          <div className="slots">
            {slots.map(([icon, label, state, hit], i) => (
              <div key={i} className={`slot ${state ? "on" : ""} ${hit ? "hit" : ""}`}>
                <Icon name={icon} size={20} />
                <b>{label}</b>
                <em>{hit ? "under attack" : state ?? "open"}</em>
                {hit && <i className="meter" style={{ width: `${Math.min(100, live.breach * 100)}%` }} />}
              </div>
            ))}
          </div>
        </section>

        <section className={`card dial ${night ? "night" : "day"} ${late ? "late" : ""} ${g.onRoof || g.overhead ? "aside" : ""}`}>
          <h2>{night ? `Night ${ROMAN[g.night - 1]}` : `Day ${ROMAN[g.night - 1]}`}</h2>
          <p>{night ? (late ? "First light is near" : plan.name) : late ? "Dusk is coming" : "Before dark"}</p>
          <div className="sky">
            <i className="gone" style={{ width: `${done * 100}%` }} />
            <span className="body" style={{ left: `${done * 100}%` }}>
              <svg width="16" height="16" viewBox="0 0 24 24">{night ? <path d="M20 14.600A8.200 8.200 0 1 1 9.400 4a6.600 6.600 0 0 0 10.600 10.600z" /> : <circle cx="12" cy="12" r="6.5" />}</svg>
            </span>
            <em className="from">{night ? "dusk" : "dawn"}</em><em className="to">{night ? "cockcrow" : "dusk"}</em>
          </div>
        </section>

        <section className={`card goal ${o.urgent ? "urgent" : ""}`}>
          {o.title ? (
            <>
              <h3>{o.title}{o.target && live.guide.dist > 2.2 && <span>{Math.round(live.guide.dist)} m</span>}</h3>
              <p>{o.text}</p>
            </>
          ) : <p className="dim">…</p>}
          {g.favours.length > 0 && <ul className="work">{g.favours.map((f) => <li key={f.id} className={f.state === "carrying" ? "done" : ""}>{FAVOURS[f.id].task}{f.state === "carrying" ? " (you have it)" : ""}</li>)}</ul>}
          {work.length > 0 && <ul className="work">{work.map((b) => <li key={b.id} className={b.state}>{b.state === "done" ? `Nong Kadyo's work is done: he pays in the morning` : `Nong Kadyo's work: ${b.count === 1 ? `a ${KIN_NAMES[b.kind][0]}` : KIN_NAMES[b.kind][1]}, ${b.got} of ${b.count}`}</li>)}</ul>}
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
        <section className="pack">
          <div className="hotbar">
            {SUPPLIES.filter((k) => g.bag[k] > 0 || k !== "tobacco").map((k) => {
              const keyed = k === "salt" ? "Q" : k === "oil" && night ? "F" : null;
              const glowing = k === "oil" && night && lit && (g.bag.oil > 0 || g.strongLamp);
              return (
                <div key={k} className={`tile ${g.bag[k] === 0 ? "none" : ""} ${glowing ? "lit" : ""}`} title={`${ITEMS[k].name}: ${ITEMS[k].use}`}>
                  {keyed && <kbd className="key">{keyed}</kbd>}
                  <Icon name={ITEM_ICON[k]} size={22} /><b>{g.bag[k]}</b><em>{k === "oil" && night ? (live.lampBlown > 0 ? "blown out" : !g.lampOn ? "shuttered" : g.strongLamp ? "strong oil" : g.bag.oil <= 0 ? "dry" : "lamp lit") : ITEMS[k].name}</em>
                </div>
              );
            })}
            {g.hasWhip && <div className={`tile ${live.whipWait > 0 ? "none" : ""}`}><kbd className="key">R</kbd><Icon name="whip" size={22} /><em>{live.whipWait > 0 ? `${Math.ceil(live.whipWait)}s` : "Whip"}</em></div>}
            {g.kit.itak && <div className={`tile ${live.itakWait > 0 ? "none" : ""}`}><kbd className="key">V</kbd><Icon name="blade" size={22} /><em>Itak</em></div>}
            {g.kit.pouch > 0 && <div className="tile"><kbd className="key">Z</kbd><Icon name="salt" size={22} /><b>{g.kit.pouch}</b><em>Pouch</em></div>}
            {g.kit.string > 0 && <div className="tile lit"><Icon name="garlic" size={22} /><b>{g.kit.string}</b><em>String</em></div>}
            {(g.kit.smudge > 0 || live.smudge > 0) && <div className={`tile ${live.smudge > 0 ? "lit" : ""}`}><kbd className="key">X</kbd><Icon name="flame" size={22} /><b>{g.kit.smudge}</b><em>{live.smudge > 0 ? `smoke ${Math.ceil(live.smudge)}s` : "Smudge"}</em></div>}
            {g.favours.filter((f) => f.state === "carrying").map((f) => <div key={f.id} className="tile carry"><Icon name="charm" size={22} /><em>{f.id === "rosary" ? "Rosary" : "Her hair"}</em></div>)}
            {g.carrying && <div className="tile carry"><Icon name={g.carrying === "water" ? "salt" : "oil"} size={22} /><em>{g.carrying === "water" ? "Water" : "The oil"}</em></div>}
          </div>
          <div className="meters">
            <label title="Health: bites and grabs take it; eat herbs (hold H) or rest by day to get it back"><Icon name="heart" size={15} /><span>{live.eating > 0 ? "Eating" : "Health"}</span><div className={`bar health ${live.health / mods(g).health < 0.3 ? "low" : ""}`}><i style={{ width: `${(live.health / mods(g).health) * 100}%` }} />{live.eating > 0 && <b className="eat" style={{ width: `${(live.eating / EAT.seconds) * 100}%` }} />}</div></label>
            <label title="Breath: running spends it"><Icon name="breath" size={15} /><span>Breath</span><div className={`bar ${live.stamina < 0.25 ? "low" : ""}`}><i style={{ width: `${live.stamina * 100}%` }} /></div></label>
            <label title="What you have learned"><Icon name="star" size={15} /><span>Level {g.level}</span><div className="bar gold"><i style={{ width: `${(g.xp / xpForLevel(g.level)) * 100}%` }} /></div></label>
            <span className="purse">
              <span title="Centavos"><Icon name="coins" size={14} /> {g.bag.coins}</span>
              <span title="Herbs"><Icon name="herbs" size={14} /> {g.bag.herbs}</span>
              <span title="How much you carry" className={carried(g) >= m.carry ? "full" : ""}><Icon name="bag" size={14} /> {carried(g)}/{m.carry}</span>
            </span>
            {g.points > 0 && <span className="learn"><kbd>Tab</kbd> {g.points} to learn</span>}
          </div>
        </section>
        <section className="hints"><span><kbd>Tab</kbd> bag</span><span><kbd>Esc</kbd> pause</span><span><kbd>C</kbd> {toggles.sneak ? "sneaking" : "sneak"}</span></section>
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
        {line.who && <div className="portrait">{line.who.replace(/^(Nang|Nong|The) /, "")[0]}</div>}
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

function Bag() {
  const g = useGame();
  const m = mods(g);
  const proofs: [boolean, string, string, string][] = [
    [g.proofs.salt, "The salted door", "She would not come near it.", "Leave salt across the door overnight, and see who visits in the morning."],
    [g.proofs.oil, "The oil", "It boiled beside Nang Pacing.", "An albularyo's oil boils when one of them is near."],
    [g.proofs.skirt, "The patadyong", "The legs in the roots wear her skirt.", "They leave their legs standing somewhere."],
  ];
  return (
    <div className="panel wide">
      <header><h2><Icon name="bag" size={20} /> What you carry, and what you have learned</h2><span><kbd>Tab</kbd> close</span></header>
      <div className="cols">
        <section>
          <h3>Supplies <small>{carried(g)} of {m.carry}</small></h3>
          {ITEM_ORDER.map((k) => <div key={k} className={`row ${g.bag[k] ? "" : "dim"}`}><Icon name={ITEM_ICON[k]} size={22} /><div><b>{ITEMS[k].name}</b><p>{ITEMS[k].use}</p></div><em>{g.bag[k]}</em></div>)}
          {(Object.keys(TROPHIES) as TrophyId[]).filter((k) => g.trophies[k] > 0).map((k) => <div key={k} className="row"><Icon name="star" size={22} /><div><b>{TROPHIES[k].name}</b><p>{TROPHIES[k].text}</p></div><em>{g.trophies[k]}</em></div>)}
          {g.hasWhip && <div className="row"><Icon name="whip" size={22} /><div><b>Stingray-tail whip</b><p>Crack it when one is close: she falls back, and a thing that can be hurt is hurt.</p></div><em>R</em></div>}
          <h3>What you know</h3>
          {proofs.map(([has, name, yes, no]) => <div key={name} className={`row ${has ? "" : "dim"}`}><Icon name={has ? "check" : "eye"} size={20} /><div><b>{name}</b><p>{has ? yes : no}</p></div></div>)}
        </section>
        <section>
          <h3>Charms <small>wear {WORN_CHARMS}</small></h3>
          {g.charms.length === 0 && <p className="empty">None yet. Old chests hide them, Nong Kadyo binds them from herbs, and the bench makes better ones.</p>}
          {g.charms.map((c) => (
            <button key={c.id} className={`charm ${g.worn.includes(c.id) ? "worn" : ""}`} style={{ borderLeftColor: RARITY[c.rarity].colour }} onClick={() => g.wear(c.id)}>
              <Icon name="charm" size={22} />
              <div><b style={{ color: RARITY[c.rarity].colour }}>{charmName(c)}</b><p>{STATS[c.stat].text(c.value)}</p></div>
              <em>{g.worn.includes(c.id) ? "worn" : "wear"}</em>
            </button>
          ))}
          <h3>Old tales <small>{g.tales.length} of {TALES.length}</small></h3>
          {g.tales.length === 0 && <p className="empty">None yet. Pages of the old tales turn up in chests and jars.</p>}
          {TALES.filter((t) => g.tales.includes(t.id)).map((t) => <div key={t.id} className="row tale"><Icon name="eye" size={20} /><div><b>{t.title}</b><p>{t.text}</p></div></div>)}
        </section>
        <section>
          <h3>Learning <small>level {g.level} · {g.points} to spend</small></h3>
          {PATHS.map((path) => (
            <div key={path.name} className="path">
              <h4>{path.name}<small>{path.about}</small></h4>
              {path.perks.map((id) => (
                <button key={id} className="perk" disabled={g.points <= 0 || g.perks[id] >= MAX_RANK} onClick={() => g.spendPoint(id)}>
                  <div><b>{PERKS[id].name}</b><p>{PERKS[id].text}</p></div>
                  <span className="rank">{Array.from({ length: MAX_RANK }, (_, i) => <i key={i} className={i < g.perks[id] ? "on" : ""} />)}</span>
                </button>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

/** One line of Nong Kadyo's trade. (Kept outside Trade: defined inside, it would be rebuilt on every update and could swallow a click.) */
function Offer({ icon, name, price, text, off, act }: { icon: string; name: string; price: string; text: string; off: boolean; act: () => void }) {
  return <button className="perk" disabled={off} onClick={act}><Icon name={icon} size={22} /><div><b>{name}</b><p>{text}</p></div><span className="price">{price}</span></button>;
}

function Trade() {
  const g = useGame();
  const full = carried(g) >= mods(g).carry;
  const buy = (item: (typeof SHOP)[number]) => { if (!full && g.spend("coins", item.cost)) g.add(item.item, 1); };
  return (
    <div className="panel shop">
      <header><h2>Nong Kadyo</h2><span><Icon name="coins" size={15} /> {g.bag.coins} centavos · <Icon name="herbs" size={15} /> {g.bag.herbs} herbs · <kbd>Esc</kbd> close</span></header>
      {g.bounties.length > 0 && (
        <section className="offers work">
          {g.bounties.map((b) => <WorkOffer key={b.id} b={b} />)}
        </section>
      )}
      <section className="offers">
        {g.favours.some((f) => f.id === "herbs") && <Offer icon="herbs" name={`${KADYO_HERBS} bundles of herbs, as he asked`} price="+12 c" text={g.bag.herbs >= KADYO_HERBS ? "He takes them and puts them straight in the pot." : `You have ${g.bag.herbs} of ${KADYO_HERBS}.`} off={g.bag.herbs < KADYO_HERBS}
          act={() => { if (g.spend("herbs", KADYO_HERBS)) { g.endFavour("herbs"); g.add("coins", 12); g.gainXp(30); g.set({ kadyoTrust: g.kadyoTrust + 1 }); g.toast("Nong Kadyo pays 12 centavos, and thinks the better of you.", "good"); } }} />}
        {SHOP.map((it) => <Offer key={it.item} icon={ITEM_ICON[it.item]} name={ITEMS[it.item].name} price={`${it.cost} c`} text={full ? "You cannot carry any more." : ITEMS[it.item].use} off={g.bag.coins < it.cost || full} act={() => buy(it)} />)}
        <Offer icon="herbs" name="Sell a bundle of herbs" price={`+${HERB_PRICE} c`} text="He always needs them." off={g.bag.herbs < 1} act={() => { if (g.spend("herbs", 1)) g.add("coins", HERB_PRICE); }} />
        <Offer icon="charm" name="Have a charm bound" price={`${CHARM_HERBS} herbs`} text="He knots herbs, a prayer and a little oil into a habak. No two come out alike." off={g.bag.herbs < CHARM_HERBS}
          act={() => { if (g.spend("herbs", CHARM_HERBS)) { const c = g.addCharm(0.05); g.toast(`Nong Kadyo binds ${aCharm(c)}.`, "good"); } }} />
        <Offer icon="flame" name="A tonic for Rosing" price={`${TONIC.herbs} herbs + ${TONIC.coins} c`}
          text={g.rosing >= 3 ? "She does not need it." : g.tonicOn === g.night ? "One a day is all she can take." : "Bitter leaves boiled down. It gives her back some of her strength."}
          off={g.rosing >= 3 || g.tonicOn === g.night || g.bag.herbs < TONIC.herbs || g.bag.coins < TONIC.coins}
          act={() => { if (g.spend("herbs", TONIC.herbs) && g.spend("coins", TONIC.coins)) { g.set({ rosing: Math.min(3, g.rosing + 1), tonicOn: g.night }); g.toast("A tonic for Rosing. She will be stronger tonight.", "good"); } }} />
        {!g.hasWhip && <Offer icon="whip" name="Stingray-tail whip" price={`${WHIP_COST} c`} text="The old weapon against them. It does not kill her. It makes her let go." off={g.bag.coins < WHIP_COST}
          act={() => { if (g.spend("coins", WHIP_COST)) { g.set({ hasWhip: true }); g.toast("A stingray-tail whip. Press R when she is close.", "good"); } }} />}
      </section>
    </div>
  );
}

/** The workbench beside the house: what can be made, what it takes, and what he already has. */
function Bench() {
  const g = useGame();
  const have = (k: string) => (k in g.trophies ? g.trophies[k as TrophyId] : g.bag[k as ItemId]);
  const label = (k: string, n = 2) => (k === "fang" ? (n === 1 ? "dog's fang" : "dog's fangs") : k === "claw" ? (n === 1 ? "crawler's nail" : "crawler's nails") : k === "stone" ? (n === 1 ? "black stone" : "black stones") : k === "coins" ? "centavos" : k === "herbs" && n === 1 ? "bundle of herbs" : ITEMS[k as ItemId].name.toLowerCase());
  const owned = (id: RecipeId) => made(g.kit, id);
  return (
    <div className="panel shop">
      <header><h2>The bench</h2><span><Icon name="star" size={15} /> {g.trophies.fang} fangs · {g.trophies.claw} nails · {g.trophies.stone} stones · <Icon name="coins" size={15} /> {g.bag.coins} · <kbd>Esc</kbd> close</span></header>
      <section className="offers">
        {RECIPES.map((r) => {
          const cost = Object.entries(r.cost).map(([k, n]) => `${n} ${label(k, n)}`).join(", ");
          const short = Object.entries(r.cost).filter(([k, n]) => have(k) < n!).map(([k]) => label(k));
          const status = owned(r.id) ? "Made." : r.whip && !g.hasWhip ? "You need a whip first (Nong Kadyo sells one)." : r.needs === "itak" && !g.kit.itak ? "Make the itak first." : short.length ? `Not enough ${short.join(" or ")}.` : "";
          const count = r.id === "pouch" ? g.kit.pouch : r.id === "string" ? g.kit.string : r.id === "smudge" ? g.kit.smudge : r.id === "strongOil" ? g.kit.strongOil : 0;
          return <Offer key={r.id} icon={r.icon} name={`${r.name}${count ? ` (${count})` : ""}`} price={owned(r.id) ? "made" : "make"} text={`${owned(r.id) ? "" : `Takes ${cost}. `}${r.text}${status && !owned(r.id) ? ` ${status}` : ""}`} off={!canCraft(g, r.id)} act={() => g.craft(r.id)} />;
        })}
      </section>
    </div>
  );
}

/** One piece of Nong Kadyo's work: take it, see how it goes, or be paid for it. */
function WorkOffer({ b }: { b: Bounty }) {
  const g = useGame();
  const what = `${b.count === 1 ? "One" : b.count === 2 ? "Two" : b.count === 3 ? "Three" : b.count} ${KIN_NAMES[b.kind][b.count === 1 ? 0 : 1]}`;
  if (b.state === "done") return <Offer icon="check" name={`${what}: done`} price={`+${b.coins} c`} text={`${b.count === 1 ? "Laid down" : b.count === 2 ? "Both laid down" : `All ${b.count} laid down`}. He adds ${b.xp} experience to the coins.`} off={false} act={() => g.payBounty(b.id)} />;
  if (b.state === "taken") return <Offer icon="whip" name={`${what}: taken`} price={`${b.coins} c`} text={`${b.text} ${b.got} of ${b.count} so far.`} off act={() => {}} />;
  return <Offer icon="whip" name={`Work for tonight: ${what.toLowerCase()}`} price={`${b.coins} c`} text={`${b.text} Take it, and lay ${b.count === 1 ? "it" : "them"} down tonight.`} off={false} act={() => { g.takeBounty(b.id); g.toast("You take Nong Kadyo's work for tonight.", "good"); }} />;
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
    const first = () => { if (!document.activeElement?.closest(".hud .panel")) items()[0]?.focus(); };
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

function Pause() {
  const g = useGame();
  const s = g.settings;
  const shakeName = s.shake >= 1 ? "full" : s.shake > 0 ? "half" : "off";
  return (
    <div className="panel">
      <header><h2>Paused</h2><span><kbd>Esc</kbd> go on</span></header>
      <section>
        <Keys />
        <nav className="menu row">
          <button onClick={() => g.setPanel(null)} className="primary">Go on</button>
          <button onClick={() => g.toggleMute()}>Sound: {g.muted ? "off" : "on"}</button>
          <button onClick={() => g.toggleShadows()}>Lamp shadows: {g.shadows ? "on" : "off"}</button>
          <button onClick={() => g.setSetting("shake", s.shake >= 1 ? 0.5 : s.shake > 0 ? 0 : 1)}>Screen shake: {shakeName}</button>
          <button onClick={() => g.setSetting("flashes", s.flashes === "full" ? "reduced" : "full")}>Flashes: {s.flashes}</button>
          <button onClick={() => g.setSetting("resolution", s.resolution === "auto" ? "full" : "auto")} title="Auto draws at a lower resolution while the game runs slow, and sharpens again when it can">Resolution: {s.resolution}</button>
          <button onClick={() => g.toTitle()}>Leave to the title</button>
        </nav>
        <div className="volumes">
          <label>Effects <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => g.setSetting("sfx", Number(e.target.value))} aria-label="Effects volume" /><em>{Math.round(s.sfx * 100)}</em></label>
          <label>Night sounds <input type="range" min={0} max={1} step={0.05} value={s.ambience} onChange={(e) => g.setSetting("ambience", Number(e.target.value))} aria-label="Night sounds volume" /><em>{Math.round(s.ambience * 100)}</em></label>
        </div>
        <p className="fine">Arrow keys move between these, Enter chooses, Left and Right turn a slider.</p>
        <p className="fine">Your progress is kept at each dusk and each morning.</p>
      </section>
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

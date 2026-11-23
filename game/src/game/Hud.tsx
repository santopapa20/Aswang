import { useEffect, useState } from "react";
import { carried, endingText, hasSave, live, mods, useGame } from "./state";
import { CHARM_HERBS, charmName, HERB_PRICE, ITEM_ORDER, ITEMS, MAX_RANK, PATHS, PERKS, RARITY, SHOP, STATS, WHIP_COST, WORN_CHARMS, xpForLevel } from "./data";
import { ERRANDS, NIGHTS } from "./story";
import { openings } from "./layout";
import { choose } from "./input";
import { sound } from "./audio";

/** Everything drawn on top of the 3D view. */
export function Hud() {
  const stage = useGame((s) => s.stage);
  const panel = useGame((s) => s.panel);
  const dialogue = useGame((s) => s.dialogue);
  if (stage === "title") return <Title />;
  if (stage === "morning") return <Morning />;
  if (stage === "over" || stage === "ending") return <Ending />;
  return (
    <div className="hud">
      <Play />
      {dialogue && <DialogueBox />}
      {panel === "bag" && <Bag />}
      {panel === "trade" && <Trade />}
      {panel === "pause" && <Pause />}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["WASD", "move"], ["Shift", "run"], ["C", "sneak on/off"], ["E (hold)", "use, search, talk"], ["G (hold)", "protect a door or window"],
  ["Q", "pour a line of salt"], ["F", "shutter the lamp"], ["R", "crack the whip"], ["T (hold)", "turn your shirt inside out"],
  ["Tab", "bag and learning"], ["Esc", "pause"], ["M", "sound on/off"],
];

function Title() {
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const saved = hasSave();
  return (
    <div className="screen title">
      <div className="card">
        <p className="over">Visayas · 1953</p>
        <h1>ASWANG NIGHT</h1>
        <p className="sub">Five nights guarding your sister's house.<br />One of the neighbours is the thing that circles it.</p>
        <div className="buttons">
          {saved && <button className="primary" onClick={() => { sound.wake(); continueGame(); }}>Continue the watch</button>}
          <button className={saved ? "" : "primary"} onClick={() => { sound.wake(); newGame(); }}>{saved ? "Begin again" : "Begin the watch"}</button>
        </div>
        <ul className="keys">{KEYS.map(([k, v]) => <li key={k}><b>{k}</b>{v}</li>)}</ul>
        <p className="fine">Played with the keyboard. Sound matters: use headphones if you can.</p>
      </div>
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
  const done = 1 - live.clock / Math.max(1, live.length);
  const errand = g.errand;
  const m = mods(g);
  const breachName = live.breachAt && live.breach > 0 ? (g.onRoof ? "the roof" : openings.find((o) => o.id === live.breachAt)?.name) : null;
  const warn = !night ? null
    : live.caught > 0 ? "IT HAS YOU"
    : g.overhead ? "WINGS OVERHEAD · RUN SIDEWAYS"
    : breachName ? `IT IS AT ${breachName.toUpperCase()}`
    : g.hunted ? "IT HAS SEEN YOU"
    : live.lampBlown > 0 ? "YOUR LAMP IS OUT"
    : null;

  return (
    <>
      <div className="top">
        <div className="phase">{night ? `NIGHT ${g.night}` : `DAY ${g.night}`}<span>{night ? plan.name : "before dark"}</span></div>
        <div className={`track ${night ? "night" : "day"}`}><i style={{ left: `${Math.min(100, done * 100)}%` }} /></div>
      </div>
      {warn && <div className="warn">{warn}{breachName && <div className="bar red"><i style={{ width: `${Math.min(100, live.breach * 100)}%` }} /></div>}</div>}

      <div className="house">
        <div className="who">ROSING <span className="pips">{[0, 1, 2].map((i) => <i key={i} className={i < g.rosing ? "on" : ""} />)}</span></div>
        <div className="wards">
          {openings.map((o) => <span key={o.id} className={g.wards[o.id] ? "on" : ""}>{o.id === "door" ? "Door" : o.id === "west" ? "West" : "East"}<em>{g.wards[o.id] ?? "open"}</em></span>)}
          <span className={live.smoke > 0 ? "on" : ""}>Roof<em>{live.smoke > 0 ? `smoke ${Math.ceil(live.smoke)}s` : "open"}</em></span>
        </div>
      </div>

      {errand && (
        <div className={`errand ${errand.done ? "done" : ""}`}>
          <b>{ERRANDS[errand.id].title}</b>
          <p>{errand.done ? "Done." : ERRANDS[errand.id].steps[errand.step]}</p>
        </div>
      )}
      <div className="toasts">{g.toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>

      {caption && !g.dialogue && <div className="caption">{caption.who && <b>{caption.who}</b>}{caption.text}</div>}
      {g.lost && live.shirtTurn > 0 && <div className="prompt"><span>Turning your shirt inside out</span><div className="bar"><i style={{ width: `${Math.min(100, live.shirtTurn * 50)}%` }} /></div></div>}
      {live.prompt && !g.dialogue && !g.panel && live.shirtTurn <= 0 && (
        <div className={`prompt ${live.prompt.progress < 0 ? "off" : ""}`}>
          <span>{live.prompt.progress >= 0 && <kbd>{live.prompt.key}</kbd>}{live.prompt.label}</span>
          {live.prompt.progress > 0 && <div className="bar"><i style={{ width: `${Math.min(100, live.prompt.progress * 100)}%` }} /></div>}
        </div>
      )}

      <div className="pack">
        <div className="supplies">
          {ITEM_ORDER.filter((k) => g.bag[k] > 0 || k === "salt" || k === "garlic" || k === "oil").map((k) => (
            <span key={k} className={g.bag[k] === 0 ? "none" : ""}>{ITEMS[k].name}<b>{g.bag[k]}</b></span>
          ))}
          {g.carrying && <span className="carry">{g.carrying === "water" ? "A jar of water" : "The albularyo's oil"}</span>}
        </div>
        <div className="meters">
          <label>Breath<div className="bar"><i style={{ width: `${live.stamina * 100}%` }} /></div></label>
          <label>Level {g.level}<div className="bar gold"><i style={{ width: `${(g.xp / xpForLevel(g.level)) * 100}%` }} /></div></label>
          <span className="small">Carrying {carried(g)}/{m.carry}{g.points > 0 && <em> · {g.points} to learn (Tab)</em>}{night && !g.lampOn && <em> · lamp shuttered</em>}</span>
        </div>
      </div>
      <div className="corner">Tab: bag · Esc: pause<br />{live.fps.toFixed(0)} fps</div>
    </>
  );
}

function DialogueBox() {
  const d = useGame((s) => s.dialogue)!;
  const advance = useGame((s) => s.advance);
  const line = d.lines[d.index];
  const last = d.index === d.lines.length - 1;
  return (
    <div className="dialogue" onClick={() => advance()}>
      {line.who && <b>{line.who}</b>}
      <p className={line.who ? "" : "narration"}>{line.text}</p>
      {last && d.choices ? (
        <div className="choices">{d.choices.map((c, i) => <button key={i} onClick={(e) => { e.stopPropagation(); choose(i); }}><kbd>{i + 1}</kbd>{c.text}</button>)}</div>
      ) : <span className="more">Enter ▸</span>}
    </div>
  );
}

function Bag() {
  const g = useGame();
  const m = mods(g);
  return (
    <div className="panel wide">
      <header><h2>What you carry, and what you have learned</h2><span>Tab to close</span></header>
      <div className="cols">
        <section>
          <h3>Supplies <small>{carried(g)}/{m.carry}</small></h3>
          {ITEM_ORDER.map((k) => <div key={k} className={`row ${g.bag[k] ? "" : "dim"}`}><b>{ITEMS[k].name}</b><em>{g.bag[k]}</em><p>{ITEMS[k].use}</p></div>)}
          {g.hasWhip && <div className="row"><b>Stingray-tail whip</b><em>R</em><p>Crack it when she is close and she falls back.</p></div>}
          <h3>What you know</h3>
          <div className={`row ${g.proofs.salt ? "" : "dim"}`}><b>The salted door</b><p>{g.proofs.salt ? "She would not come near it." : "Leave salt across the door overnight, and see who visits in the morning."}</p></div>
          <div className={`row ${g.proofs.oil ? "" : "dim"}`}><b>The oil</b><p>{g.proofs.oil ? "It boiled beside Nang Pacing." : "An albularyo's oil boils when one of them is near."}</p></div>
          <div className={`row ${g.proofs.skirt ? "" : "dim"}`}><b>The patadyong</b><p>{g.proofs.skirt ? "The legs in the roots wear her skirt." : "They leave their legs standing somewhere."}</p></div>
        </section>
        <section>
          <h3>Charms <small>wear {WORN_CHARMS}</small></h3>
          {g.charms.length === 0 && <p className="dim">None yet. Old chests hide them, and Nong Kadyo binds them from herbs.</p>}
          {g.charms.map((c) => (
            <button key={c.id} className={`charm ${g.worn.includes(c.id) ? "worn" : ""}`} onClick={() => g.wear(c.id)}>
              <b style={{ color: RARITY[c.rarity].colour }}>{charmName(c)}</b>
              <p>{STATS[c.stat].text(c.value)}</p>
              <em>{g.worn.includes(c.id) ? "worn" : "wear"}</em>
            </button>
          ))}
        </section>
        <section>
          <h3>Learning <small>level {g.level} · {g.points} to spend</small></h3>
          {PATHS.map((path) => (
            <div key={path.name} className="path">
              <h4>{path.name}<small>{path.about}</small></h4>
              {path.perks.map((id) => (
                <button key={id} className="perk" disabled={g.points <= 0 || g.perks[id] >= MAX_RANK} onClick={() => g.spendPoint(id)}>
                  <b>{PERKS[id].name}</b><span className="rank">{Array.from({ length: MAX_RANK }, (_, i) => <i key={i} className={i < g.perks[id] ? "on" : ""} />)}</span>
                  <p>{PERKS[id].text}</p>
                </button>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Trade() {
  const g = useGame();
  const buy = (item: (typeof SHOP)[number]) => { if (g.bag.coins >= item.cost && carried(g) < mods(g).carry && g.spend("coins", item.cost)) g.add(item.item, 1); };
  return (
    <div className="panel">
      <header><h2>Nong Kadyo</h2><span>Esc to close · you have {g.bag.coins} centavos, {g.bag.herbs} herbs</span></header>
      <section>
        {SHOP.map((it) => (
          <button key={it.item} className="perk" disabled={g.bag.coins < it.cost} onClick={() => buy(it)}>
            <b>{ITEMS[it.item].name}</b><span className="rank">{it.cost} c</span><p>{ITEMS[it.item].use}</p>
          </button>
        ))}
        <button className="perk" disabled={g.bag.herbs < 1} onClick={() => { if (g.spend("herbs", 1)) g.add("coins", HERB_PRICE); }}>
          <b>Sell a bundle of herbs</b><span className="rank">+{HERB_PRICE} c</span><p>He always needs them.</p>
        </button>
        <button className="perk" disabled={g.bag.herbs < CHARM_HERBS} onClick={() => { if (g.spend("herbs", CHARM_HERBS)) { const c = g.addCharm(0.05); g.toast(`Nong Kadyo binds a ${charmName(c)}.`, "good"); } }}>
          <b>Have a charm bound</b><span className="rank">{CHARM_HERBS} herbs</span><p>He knots herbs, a prayer and a little oil into a habak. No two come out alike.</p>
        </button>
        {!g.hasWhip && (
          <button className="perk" disabled={g.bag.coins < WHIP_COST} onClick={() => { if (g.spend("coins", WHIP_COST)) { g.set({ hasWhip: true }); g.toast("A stingray-tail whip. Press R when she is close.", "good"); } }}>
            <b>Stingray-tail whip</b><span className="rank">{WHIP_COST} c</span><p>The old weapon against them. It does not kill her. It makes her let go.</p>
          </button>
        )}
      </section>
    </div>
  );
}

function Pause() {
  const g = useGame();
  return (
    <div className="panel">
      <header><h2>Paused</h2><span>Esc to go on</span></header>
      <section>
        <ul className="keys">{KEYS.map(([k, v]) => <li key={k}><b>{k}</b>{v}</li>)}</ul>
        <div className="buttons">
          <button onClick={() => g.setPanel(null)} className="primary">Go on</button>
          <button onClick={() => g.toggleMute()}>Sound: {g.muted ? "off" : "on"}</button>
          <button onClick={() => g.toggleShadows()}>Lamp shadows: {g.shadows ? "on" : "off"}</button>
          <button onClick={() => g.toTitle()}>Leave to the title</button>
        </div>
        <p className="fine">Your progress is kept at each dusk and each morning.</p>
      </section>
    </div>
  );
}

function Morning() {
  const g = useGame();
  return (
    <div className="screen">
      <div className="card">
        <p className="over">After night {g.night} · {NIGHTS[g.night - 1].name}</p>
        <h1 className="small">COCKCROW</h1>
        <ul className="report">{g.report.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="fine">You learned {g.tally.xp} this night{g.points > 0 ? `, and have ${g.points} to spend in your bag (Tab)` : ""}.</p>
        <div className="buttons"><button className="primary" onClick={() => g.nextDay()}>Morning <kbd>Enter</kbd></button></div>
      </div>
    </div>
  );
}

function Ending() {
  const g = useGame();
  if (g.ending === "choice") {
    const sealed = g.kadyoTrust >= 3 && Object.values(g.proofs).every(Boolean);
    return (
      <div className="screen">
        <div className="card">
          <h1 className="small">FIRST LIGHT</h1>
          <ul className="report">
            <li>From inside the house, a thin new cry. The child is born.</li>
            <li>In the yard, Nang Pacing lies where the light caught her, and cannot rise.</li>
            <li>"I cannot die until someone takes it. Dong. Please."</li>
          </ul>
          <div className="buttons">
            <button onClick={() => g.chooseEnding("take")}>Open your hands</button>
            <button onClick={() => g.chooseEnding("refuse")}>Step back</button>
            {sealed && <button className="primary" onClick={() => g.chooseEnding("sealed")}>Call for Nong Kadyo</button>}
          </div>
          {!sealed && <p className="fine">There may have been a third way, for someone the albularyo trusted, who had all three proofs.</p>}
        </div>
      </div>
    );
  }
  const e = endingText(g.ending ?? "remains");
  return (
    <div className={`screen ${g.ending === "empty" ? "bad" : ""}`}>
      <div className="card">
        <h1 className="small">{e.title}</h1>
        <ul className="report">{e.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        {g.stage === "over" && g.report.length > 0 && <p className="fine">{g.report[g.report.length - 1]}</p>}
        <div className="buttons">
          {g.stage === "over" && hasSave() && <button className="primary" onClick={() => g.continueGame()}>Try this night again</button>}
          <button onClick={() => g.toTitle()}>Back to the title</button>
        </div>
      </div>
    </div>
  );
}

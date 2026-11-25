import { useState } from "react";
import { BLADE, GUISE, KIN, SMUDGE, WHIP } from "./data";
import { useGame } from "./state";
import { Icon } from "./Icons";

/**
 * How the game works, in one place (game-ui-ux: teach the loop, then the screen, then the threats). Opened
 * from the title (How to play), the pause menu, or the ? key while playing. The creatures are shown only once
 * their night has been reached, so the guide does not spoil what comes later; the ones that come tonight are
 * marked. Every rule here is the game's own (Aswang.tsx, Manananggal.tsx, Kin.tsx, Guise.tsx and the rest);
 * the numbers come from data.ts.
 */
type Page = "play" | "house" | "night" | "keys" | "day";

type Threat = { id: string; name: string; nights: number[]; icon: string; know: string; works: string[]; not: string };
const THREATS: Threat[] = [
  {
    id: "aswang", name: "The one who walks", nights: [1, 3], icon: "eye",
    know: "A clicking in the dark: loud when she is far, faint when she is near. When she works at an opening, its ring at the top left turns red and fills.",
    works: [
      "Salt or garlic at every opening before dark (hold G there). Each turns her back once.",
      "Go to the opening she is working with your lamp lit: she draws off.",
      "The whip (R) makes her let go; a salt pouch (Z) drives her off.",
    ],
    not: "She cannot be killed. Far from the house, in the dark, or noisy close to her, she comes for you instead, and a grab ends the night.",
  },
  {
    id: "manananggal", name: "The one who flies", nights: [2, 4, 5], icon: "wing",
    know: "Wings overhead. On the roof, the Roof ring turns red and fills; away from the house, she dives at your lamp.",
    works: [
      "Feed the smudge fire in the yard with kindling (hold E): its smoke keeps her off the roof. The Roof ring counts the smoke down.",
      "On the roof, strike the house post at the door (hold E): she comes down on you instead of breaking in.",
      "When she dives, run sideways. A smudge bundle (X) keeps her from diving.",
      "Find the lower half she left standing, and salt it: she cannot join herself again.",
    ],
    not: "Salt and garlic at the door and windows do not keep her off the roof.",
  },
  {
    id: "dogs", name: "Dead dogs", nights: [2, 3, 4, 5], icon: "fang",
    know: "They come out a while after dusk, in pairs, in the north and west fields, and growl before they come at you.",
    works: [
      `The whip lays one down in ${Math.ceil(KIN.dog.health / WHIP.damage)} blows. Each leaves coins and fangs for the bench.`,
      "A line of salt (Q) stops them.",
      `Run: they give up once you are ${KIN.dog.lose} m ahead.`,
    ],
    not: `A bite takes ${KIN.dog.harm} of your health.`,
  },
  {
    id: "crawler", name: "The one on all fours", nights: [3, 4, 5], icon: "claw",
    know: "Low and quick, east of the barrio. It shrieks when it sees you.",
    works: [
      "Keep your lamp lit and on it, then the whip: in lamplight it takes the full blow.",
      "A line of salt stops it; running gets away.",
    ],
    not: `In the dark the whip slides off it (it shrugs off ${Math.round(KIN.crawler.unlit * 100)}% of the blow). A bite takes ${KIN.crawler.harm}.`,
  },
  {
    id: "guise", name: "Night walkers", nights: [3, 4, 5], icon: "garlic",
    know: "Someone walking the paths after dark, like a neighbour out late: a farmer, a priest, a nurse. Nobody in the barrio walks at night. It stops and watches you.",
    works: [
      `Hold up garlic (hold G within ${GUISE.garlic} m). Its face slides and it reels: now it can be hurt. The garlic is not used up.`,
      "Then fight it as kin: the whip, the itak, salt to stop it.",
    ],
    not: `While the face holds, your blows do nothing, and striking it makes it come at you. Let it within ${GUISE.close} m with the face on and it strikes first.`,
  },
  {
    id: "amalanhig", name: "The one who could not die", nights: [3, 4, 5], icon: "cross",
    know: "In the old sitio's graveyard. After dark it rises when you come near, stiff as a plank, arms out.",
    works: [
      "It turns slowly: step aside and run past it.",
      "A line of salt stops it. Three blows of the whip lay it down till morning, and what it was buried with is yours.",
    ],
    not: "Let it get its hands on you and it takes a great deal of your health.",
  },
  {
    id: "tikbalang", name: "The owner of the trail", nights: [3, 4, 5], icon: "arrow",
    know: "On the trail east, after dark, you are walked back to where you were, again and again. The only sign: the same rag on the same post, twice.",
    works: ["Stand still and turn your shirt inside out (hold T). The trail lets you go for the night."],
    not: "Walking on only burns your lamp while the house stands unguarded.",
  },
  {
    id: "kapre", name: "The smoker in the balete", nights: [4, 5], icon: "tobacco",
    know: "A giant in the old tree north-west, with a glowing cigar.",
    works: ["Walk under his tree, do not run. Leave tobacco at his feet (hold E) and he remembers you: his ember points where something is hidden."],
    not: "Run under his tree and he blows out your lamp.",
  },
  {
    id: "sigbin", name: "The hound that walks backwards", nights: [5], icon: "moon",
    know: "It comes on tail first, and it wants your shadow, which only exists while your lamp is lit.",
    works: ["Shutter the lamp (F): it has nothing to follow.", "A line of salt stops it; the whip sends it off for a while."],
    not: "Once it is at your feet it drinks your shadow until you drop.",
  },
];

const KEYS: [string, string, string][] = [
  ["Move", "W A S D", "Walk. Hold Shift to run: running spends breath, and you are heard further."],
  ["Move", "C", "Sneak: slow and quiet. Press again to walk."],
  ["Use", "E (hold)", "Search, talk, pick, feed the fire, draw water. The ring under the prompt fills while you hold."],
  ["Use", "G (hold)", "Lay salt or hang garlic at a door or window. Near a night walker: hold up garlic."],
  ["Protect", "Q", "Pour a line of salt across the ground ahead. Things that walk will not cross it."],
  ["Light", "F", "Shutter or open the lamp. Lit, you see and she keeps off; shuttered, you are harder to find."],
  ["Fight", "R", `Crack the whip: it reaches ${WHIP.range} m all round, then needs ${WHIP.cooldown} s.`],
  ["Fight", "V", `Strike with the itak (once made): close, in front of you, every ${BLADE.cooldown} s.`],
  ["Fight", "Z", "Throw a salt pouch in the face of what is in front of you: it reels."],
  ["Fight", "X", `Light a smudge bundle: ${SMUDGE.seconds} s of smoke in which the kin lose you.`],
  ["Live", "H (hold)", "Eat a bundle of herbs to get health back. Stand still while you eat."],
  ["Live", "T (hold)", "Turn your shirt inside out, when the trail will not let you go."],
  ["Menus", "Tab", "Your bag: supplies, charms, learning, old tales."],
  ["Menus", "Esc", "Pause and settings. ? opens this guide."],
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const [page, setPage] = useState<Page>("play");
  const reached = (t: Threat) => t.nights[0] <= g.night;
  const tonight = (t: Threat) => t.nights.includes(g.night);
  const shown = THREATS.filter(reached);
  const later = THREATS.length - shown.length;
  const pages: [Page, string][] = [["play", "How to play"], ["house", "The house"], ["night", "The night"], ["day", "By day"], ["keys", "Controls"]];
  return (
    <div className="panel wide bag guidebook">
      <header>
        <h2>How to play</h2>
        <span className="meta"><button className="close" onClick={onClose} aria-label="Close the guide"><Icon name="cross" size={16} /></button></span>
      </header>
      <nav className="tabs" role="tablist">
        {pages.map(([id, name]) => <button key={id} role="tab" aria-selected={page === id} className={page === id ? "on" : ""} onClick={() => setPage(id)}><b>{name}</b></button>)}
      </nav>

      {page === "play" && (
        <div className="bag-page">
          <p className="page-lede">Keep your sister Rosing and her unborn child alive for five nights. Each day you prepare; each night something tests the house.</p>
          <ol className="steps">
            <li><span className="step-n">1</span><div><b>Day: get ready</b><p>Take the day's salt, garlic and lamp oil at Rosing's door. Search for more, trade with Nong Kadyo, make things at the bench, do favours. The line at the top runs from dawn to dusk.</p></div></li>
            <li><span className="step-n">2</span><div><b>Dusk: protect the house</b><p>Hold G at the door and at each window to lay salt or hang garlic. You will not have enough for every opening: choose.</p></div></li>
            <li><span className="step-n">3</span><div><b>Night: keep watch</b><p>Stay near the house with your lamp. When something works at an opening, go there. Rosing will send you on one errand; go, and come back quickly.</p></div></li>
            <li><span className="step-n">4</span><div><b>Cockcrow: see how it went</b><p>The night ends at first light. Each time something gets in, Rosing loses a candle; if you are struck down, she loses one too. At none, she is lost.</p></div></li>
          </ol>
          <h3>Reading the screen</h3>
          <div className="legend">
            <div><Icon name="flame" size={18} /><span><b>Top left</b> Rosing's candles, and a ring for the door, both windows and the roof. Gold: guarded. Red and filling: something is breaking in.</span></div>
            <div><Icon name="sun" size={18} /><span><b>Top centre</b> The day or night, and how far through it you are.</span></div>
            <div><Icon name="arrow" size={18} /><span><b>Top right</b> What to do now. The arrow on screen points the way.</span></div>
            <div><Icon name="heart" size={18} /><span><b>Bottom left</b> Health, breath and what you have learned.</span></div>
            <div><Icon name="bag" size={18} /><span><b>Bottom centre</b> What you carry, with its key. Dashed: you have none.</span></div>
            <div><Icon name="coins" size={18} /><span><b>Bottom right</b> Centavos, herbs, and how full your bag is.</span></div>
          </div>
        </div>
      )}

      {page === "house" && (
        <div className="bag-page">
          <p className="page-lede">The house has four ways in. Something that gets in costs Rosing a candle.</p>
          <div className="cards">
            <div className="card-item"><span className="card-icon"><Icon name="door" size={20} /></span><span className="card-body"><b>Door and windows</b><span>Hold G at each to lay salt or hang garlic. Either turns her back once, then it is spent.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="roof" size={20} /></span><span className="card-body"><b>The roof</b><span>Only smoke keeps the roof. Feed the smudge fire in the yard with kindling (hold E) on the nights she flies.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="flame" size={20} /></span><span className="card-body"><b>Your lamp</b><span>Go to an opening she is working with your lamp lit, and she draws off. It burns oil all night: carry enough.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="charm" size={20} /></span><span className="card-body"><b>Rosing's strength</b><span>Three candles. A tonic from Nong Kadyo or a favour done for her gives one back.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="window" size={20} /></span><span className="card-body"><b>Made at the bench</b><span>Bamboo bars: a window holds once more each night. A stake fence: she takes longer at each opening. Bells: you hear when the house is tried.</span></span></div>
          </div>
        </div>
      )}

      {page === "night" && (
        <div className="bag-page">
          <p className="page-lede">What you have met, how to know it, and what works against it.{later > 0 ? ` ${later} more come on later nights.` : ""}</p>
          <div className="threats">
            {shown.map((t) => (
              <article key={t.id} className={`threat ${tonight(t) ? "tonight" : ""}`}>
                <h4><Icon name={t.icon} size={18} />{t.name}{tonight(t) && <em>{g.stage === "night" ? "Tonight" : "Comes tonight"}</em>}</h4>
                <p className="know">{t.know}</p>
                <ul className="works">{t.works.map((w) => <li key={w}><Icon name="check" size={14} />{w}</li>)}</ul>
                <p className="not"><Icon name="cross" size={14} />{t.not}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {page === "day" && (
        <div className="bag-page">
          <p className="page-lede">The day is short. What you do with it decides how the night goes.</p>
          <div className="cards">
            <div className="card-item"><span className="card-icon"><Icon name="bag" size={20} /></span><span className="card-body"><b>Search</b><span>Chests, jars and sacks (hold E). The land's herbs and kindling grow back; what people left in the old sitio is there once.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="coins" size={20} /></span><span className="card-body"><b>Nong Kadyo</b><span>North-east of the well. He sells supplies and the whip, buys herbs, binds charms, and has work: lay the kin down at night for pay.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="blade" size={20} /></span><span className="card-body"><b>The bench</b><span>Beside the house. Makes the itak, salt pouches, bars for the windows and more, from supplies and the kin's trophies.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="check" size={20} /></span><span className="card-body"><b>Favours</b><span>Rosing, Nong Kadyo, the hilot and Nang Pacing ask things of you. Each pays, and each takes time. Not every one is kind.</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="star" size={20} /></span><span className="card-body"><b>Learning</b><span>Searching, keeping the house and laying the kin down teach you. Spend what you learn in your bag (Tab).</span></span></div>
            <div className="card-item"><span className="card-icon"><Icon name="herbs" size={20} /></span><span className="card-body"><b>Health</b><span>Bites and grabs take it. Eat herbs (hold H); it is full again each morning.</span></span></div>
          </div>
        </div>
      )}

      {page === "keys" && (
        <div className="bag-page">
          <div className="keylist">
            {KEYS.map(([group, k, what], i) => (
              <div key={k} className="keyrow">
                <span className="group">{i === 0 || KEYS[i - 1][0] !== group ? group : ""}</span>
                <kbd>{k}</kbd>
                <span>{what}</span>
              </div>
            ))}
          </div>
          <p className="fine">On a phone held sideways: the left half of the screen is a stick, and the buttons on the right do what can be done now.</p>
        </div>
      )}
    </div>
  );
}

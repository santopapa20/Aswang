import { useEffect, useState } from "react";
import { live, SHIRT_SECONDS, useGame } from "./state";

/** Text on top of the 3D view. It re-reads the fast-changing values a few times a second. */
export function Hud() {
  const phase = useGame((s) => s.phase);
  const hunted = useGame((s) => s.hunted);
  const shadows = useGame((s) => s.shadows);
  const salt = useGame((s) => s.salt);
  const garlic = useGame((s) => s.garlic);
  const mana = useGame((s) => s.mana);
  const overhead = useGame((s) => s.overhead);
  const tik = useGame((s) => s.tik);
  const lost = useGame((s) => s.lost);
  const shirt = useGame((s) => s.shirt);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const t = Math.ceil(live.timeLeft);
  const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

  return (
    <div className="hud">
      <div className="top">UNTIL SUNRISE <b>{clock}</b></div>
      {phase === "playing" && (overhead ? <div className="warn">WINGS OVERHEAD · RUN</div>
        : lost ? <div className="warn">YOU ARE LED ASTRAY · YOUR FEET GO THE WRONG WAY</div>
        : hunted ? <div className="warn">IT HAS SEEN YOU</div> : null)}
      {phase === "playing" && (
        <div className="notes">
          {mana === "hunting" && <div className="note">A manananggal is flying. Find the legs she left behind and salt them.</div>}
          {mana === "ended" && <div className="note good">Her body is salted. She cannot return tonight.</div>}
          {tik === "stalking" && !lost && <div className="note">Something tall is walking after you. Keep your distance.</div>}
          {lost && <div className="note">A tikbalang has you. Stand still and hold T to turn your shirt inside out.</div>}
          {shirt && <div className="note good">Your shirt is inside out. The tikbalang cannot lead you astray tonight.</div>}
        </div>
      )}
      {phase === "playing" && lost && live.shirtTurn > 0 && (
        <div className="turning">
          Turning your shirt
          <div className="bar"><i style={{ width: `${Math.min(100, (live.shirtTurn / SHIRT_SECONDS) * 100)}%` }} /></div>
        </div>
      )}
      <div className="bag">
        <span>Salt <b>{salt}</b></span>
        <span>Garlic <b>{garlic}</b></span>
      </div>
      <div className="help">
        WASD or arrows: move · Shift: run · C: sneak on/off<br />
        E: pour a line of salt (she cannot cross it) · garlic drives her back by itself<br />
        T (hold, standing still): turn your shirt inside out when you are led astray<br />
        L: lamp shadows {shadows ? "on" : "off"} · R: restart
      </div>
      <div className="stats">{live.fps.toFixed(0)} fps</div>
      {phase === "caught" && (
        <div className="banner caught"><h1>CAUGHT</h1><p>Press R to try again</p></div>
      )}
      {phase === "survived" && (
        <div className="banner survived"><h1>SUNRISE</h1><p>You lived through the night. Press R to play again</p></div>
      )}
    </div>
  );
}

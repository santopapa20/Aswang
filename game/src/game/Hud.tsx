import { useEffect, useState } from "react";
import { live, useGame } from "./state";

/** Text on top of the 3D view. It re-reads the fast-changing values a few times a second. */
export function Hud() {
  const phase = useGame((s) => s.phase);
  const hunted = useGame((s) => s.hunted);
  const shadows = useGame((s) => s.shadows);
  const salt = useGame((s) => s.salt);
  const garlic = useGame((s) => s.garlic);
  const mana = useGame((s) => s.mana);
  const overhead = useGame((s) => s.overhead);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const t = Math.ceil(live.timeLeft);
  const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

  return (
    <div className="hud">
      <div className="top">UNTIL SUNRISE <b>{clock}</b></div>
      {phase === "playing" && (overhead ? <div className="warn">WINGS OVERHEAD · RUN</div> : hunted ? <div className="warn">IT HAS SEEN YOU</div> : null)}
      {mana === "hunting" && phase === "playing" && <div className="note">A manananggal is flying. Find the legs she left behind and salt them.</div>}
      {mana === "ended" && phase === "playing" && <div className="note good">Her body is salted. She cannot return tonight.</div>}
      <div className="bag">
        <span>Salt <b>{salt}</b></span>
        <span>Garlic <b>{garlic}</b></span>
      </div>
      <div className="help">
        WASD or arrows: move · Shift: run · C: sneak on/off<br />
        E: pour a line of salt (she cannot cross it) · garlic drives her back by itself<br />
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

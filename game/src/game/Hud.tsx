import { useEffect, useState } from "react";
import { live, useGame } from "./state";

/** Text on top of the 3D view. It re-reads the fast-changing values a few times a second. */
export function Hud() {
  const phase = useGame((s) => s.phase);
  const hunted = useGame((s) => s.hunted);
  const shadows = useGame((s) => s.shadows);
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
      {hunted && phase === "playing" && <div className="warn">IT HAS SEEN YOU</div>}
      <div className="help">
        WASD or arrows: move · Shift: run · C: sneak on/off<br />
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

import { useEffect, useRef, useState } from "react";
import { live, mods, useGame } from "./state";
import { stick, toggles } from "./input";
import { Icon } from "./Icons";

/**
 * Controls for a touch screen (game-ui-ux: touch targets of 56 px and more, thumbs at the edges). They press
 * the same keys the keyboard does, so every rule stays in one place:
 *  - the left half of the screen is a floating stick: put a thumb down anywhere there and push. Pushed to
 *    the edge, he runs.
 *  - on the right, buttons for what can be done now: Use (E) and the garlic/protection button (G) are held
 *    like the keys; the whip, the itak, a pouch, a smudge bundle, salt, the lamp, eating herbs, turning the
 *    shirt, sneaking; and along the top, the bag and pause.
 * Shown once the screen is touched (or on a device whose main pointer is a finger), hidden on a keyboard press.
 */
/** Keeps a finger's moves and lifting with the element it went down on, even if it slides off. */
const capture = (e: React.PointerEvent) => { try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* not a live pointer */ } };
const press = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
const RUN_AT = 0.82;          // how far the stick must be pushed to run
const DEAD = 0.18;            // and to move at all
const REACH = 56;             // pixels from where the thumb went down to the edge of the stick

export function TouchControls() {
  const [on, setOn] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
  const [, tick] = useState(0);
  const base = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const touch = (e: PointerEvent) => { if (e.pointerType === "touch") setOn(true); };
    const keyboard = (e: KeyboardEvent) => { if (e.isTrusted) setOn(false); };   // a real key: someone has a keyboard
    const coarse = matchMedia("(pointer: coarse)");
    const changed = () => setOn(coarse.matches);     // a tablet docked to a keyboard, or the device emulated
    window.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", keyboard, true);
    coarse.addEventListener("change", changed);
    return () => { window.removeEventListener("pointerdown", touch, true); window.removeEventListener("keydown", keyboard, true); coarse.removeEventListener("change", changed); };
  }, []);
  // what can be done changes as he walks about: look again a few times a second
  useEffect(() => { if (!on) return; const id = setInterval(() => tick((n) => n + 1), 150); return () => clearInterval(id); }, [on]);

  // the rest of the interface drops its keyboard hints while the controls are up (styles.css: .touching)
  useEffect(() => { document.body.classList.toggle("touching", on); }, [on]);
  const g = useGame();
  if (!on) return null;
  const playing = g.stage === "day" || g.stage === "night";
  const free = playing && !g.dialogue && !g.panel;
  const night = g.stage === "night";

  // ---- the stick
  const release = () => {
    base.current = null; setKnob(null);
    stick.on = false; stick.x = 0; stick.z = 0; run(false);
  };
  const running = useRef(false);
  const run = (yes: boolean) => { if (yes !== running.current) { running.current = yes; press("ShiftLeft", yes); } };
  const moveStick = (e: React.PointerEvent) => {
    const b = base.current;
    if (!b || e.pointerId !== b.id) return;
    let dx = e.clientX - b.x, dy = e.clientY - b.y;
    const len = Math.hypot(dx, dy);
    if (len > REACH) { dx *= REACH / len; dy *= REACH / len; }
    const k = Math.min(1, len / REACH);
    stick.on = k > DEAD; stick.x = dx / REACH; stick.z = dy / REACH;
    run(k >= RUN_AT && !toggles.sneak);
    setKnob({ x: b.x, y: b.y, dx, dy });
  };

  // ---- a button that holds its key while the finger is on it
  const hold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); capture(e); press(code, true); },
    onPointerUp: () => press(code, false),
    onPointerCancel: () => press(code, false),
    onLostPointerCapture: () => press(code, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  // a plain function, not a component: a component made here would be new each render, and the button
  // would be rebuilt under the finger (losing its hold) every time the controls look again
  const btn = ({ code, icon, label, big, lit, count }: { code: string; icon: string; label: string; big?: boolean; lit?: boolean; count?: number }) => (
    <button key={code} className={`tbtn ${big ? "big" : ""} ${lit ? "lit" : ""}`} aria-label={label} {...hold(code)}>
      <Icon name={icon} size={big ? 30 : 22} />
      <span>{label}</span>
      {count !== undefined && <b>{count}</b>}
    </button>
  );

  const m = mods(g);
  const E = live.prompts.E, G = live.prompts.G;
  return (
    <>
    {/* outside the touch layer, so it covers the title and the other full screens too */}
    <div className="turn-phone"><Icon name="arrow" size={30} /><p>Turn your phone sideways to play.</p></div>
    <div className="touch">
      {free && (
        <div
          className="stickzone"
          onPointerDown={(e) => { e.preventDefault(); capture(e); base.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; setKnob({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 }); }}
          onPointerMove={moveStick}
          onPointerUp={release}
          onPointerCancel={release}
        >
          {knob && <div className="stick" style={{ left: knob.x, top: knob.y }}><i style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} /></div>}
          {!knob && <p className="stickhint">Hold here and push to walk · push to the edge to run</p>}
        </div>
      )}
      {playing && (
        <div className="tmenu">
          <button className="tbtn small" aria-label="Bag" onPointerDown={(e) => { e.preventDefault(); press("Tab", true); press("Tab", false); }}><Icon name="bag" size={20} /></button>
          <button className="tbtn small" aria-label="Pause" onPointerDown={(e) => { e.preventDefault(); press("Escape", true); press("Escape", false); }}><Icon name="moon" size={20} /></button>
        </div>
      )}
      {free && (
        <div className="tactions">
          <div className="tcluster">
            {btn({ code: "KeyE", icon: "eye", label: E?.label ?? "Use", big: true, lit: !!E && E.progress >= 0 })}
            {G && btn({ code: "KeyG", icon: /garlic/i.test(G.label) ? "garlic" : "door", label: G.label, lit: G.progress >= 0 })}
            {g.hasWhip && btn({ code: "KeyR", icon: "whip", label: live.whipWait > 0 ? `${Math.ceil(live.whipWait)}s` : "Whip", lit: live.whipWait <= 0 })}
            {g.kit.itak && btn({ code: "KeyV", icon: "blade", label: g.kit.spear ? "Sibat" : "Itak", lit: live.itakWait <= 0 })}
          </div>
          <div className="trow">
            {g.bag.salt > 0 && btn({ code: "KeyQ", icon: "salt", label: "Salt line", count: g.bag.salt })}
            {g.kit.pouch > 0 && btn({ code: "KeyZ", icon: "salt", label: "Pouch", count: g.kit.pouch })}
            {night && g.kit.smudge > 0 && btn({ code: "KeyX", icon: "flame", label: live.smudge > 0 ? `${Math.ceil(live.smudge)}s` : "Smudge", count: g.kit.smudge })}
            {night && btn({ code: "KeyF", icon: "oil", label: g.lampOn ? "Shutter" : "Unshutter", lit: g.lampOn })}
            {g.bag.herbs > 0 && live.health < m.health - 0.5 && btn({ code: "KeyH", icon: "herbs", label: "Eat (hold)", count: g.bag.herbs })}
            {g.lost && btn({ code: "KeyT", icon: "charm", label: "Shirt (hold)" })}
            <button className={`tbtn ${toggles.sneak ? "lit" : ""}`} aria-label="Sneak" onPointerDown={(e) => { e.preventDefault(); press("KeyC", true); press("KeyC", false); tick((n) => n + 1); }}>
              <Icon name="breath" size={22} /><span>{toggles.sneak ? "Sneaking" : "Sneak"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

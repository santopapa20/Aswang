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
  const running = useRef(false);
  /** A tapped Use or Garlic: its key stays down until the thing is done, he walks off, or it is gone. */
  const latch = useRef<{ code: "KeyE" | "KeyG"; peak: number; until: number } | null>(null);
  const [stickUsed, setStickUsed] = useState(() => { try { return localStorage.getItem("aswang-stick-used") === "1"; } catch { return false; } });

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
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const l = latch.current;
      if (l) {
        const p = live.prompts[l.code === "KeyE" ? "E" : "G"];
        const progress = p ? p.progress : -1;
        l.peak = Math.max(l.peak, progress);
        // done (the ring filled and went back), walked away, nothing there any more, or taking too long
        if (!p || progress < 0 || stick.on || performance.now() > l.until || (l.peak > 0.05 && progress < l.peak - 0.25)) { press(l.code, false); latch.current = null; }
      }
      tick((n) => n + 1);
    }, 100);
    return () => clearInterval(id);
  }, [on]);

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
    if (!stickUsed && k > 0.5) { setStickUsed(true); try { localStorage.setItem("aswang-stick-used", "1"); } catch { /* private window */ } }
  };

  // ---- a button that holds its key while the finger is on it. Use and Garlic need a hold of up to a second
  // and a half on a keyboard; on glass a tap starts them and they finish by themselves (`latch`).
  const latched = (code: string): code is "KeyE" | "KeyG" => code === "KeyE" || code === "KeyG";
  const hold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault(); e.stopPropagation(); capture(e);
      if (latched(code)) { if (latch.current) press(latch.current.code, false); latch.current = { code, peak: 0, until: performance.now() + 4000 }; }
      press(code, true);
    },
    onPointerUp: () => { if (!latched(code)) press(code, false); },
    onPointerCancel: () => { if (!latched(code)) press(code, false); },
    onLostPointerCapture: () => { if (!latched(code)) press(code, false); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  // a plain function, not a component: a component made here would be new each render, and the button
  // would be rebuilt under the finger (losing its hold) every time the controls look again
  const btn = ({ code, icon, label, big, lit, count, progress }: { code: string; icon: string; label: string; big?: boolean; lit?: boolean; count?: number; progress?: number }) => (
    <button key={code} className={`tbtn ${big ? "big" : ""} ${lit ? "lit" : ""} ${progress && progress > 0 ? "doing" : ""}`} aria-label={label} {...hold(code)}
      style={progress && progress > 0 ? { ["--p" as string]: `${Math.min(1, progress) * 360}deg` } : undefined}>
      <Icon name={icon} size={big ? 24 : 19} />
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
          {!knob && !stickUsed && <p className="stickhint">Touch and drag here to walk. Drag further to run.</p>}
        </div>
      )}
      {playing && (
        <div className="tmenu">
          <button className="tbtn small" aria-label="Bag" onPointerDown={(e) => { e.preventDefault(); press("Tab", true); press("Tab", false); }}><Icon name="bag" size={19} /></button>
          <button className="tbtn small" aria-label="Pause" onPointerDown={(e) => { e.preventDefault(); press("Escape", true); press("Escape", false); }}><Icon name="pause" size={17} /></button>
        </div>
      )}
      {free && (
        <div className="tactions">
          <div className="tcluster">
            {E && E.progress >= 0 && btn({ code: "KeyE", icon: "hand", label: "Use", big: true, lit: true, progress: E.progress })}
            {G && G.progress >= 0 && btn({ code: "KeyG", icon: /garlic/i.test(G.label) ? "garlic" : "door", label: /garlic/i.test(G.label) ? "Garlic" : /salt/i.test(G.label) ? "Salt it" : "Protect", big: !E || E.progress < 0, lit: true, progress: G.progress })}
            {g.hasWhip && btn({ code: "KeyR", icon: "whip", label: live.whipWait > 0 ? `${Math.ceil(live.whipWait)}s` : "Whip", lit: live.whipWait <= 0 })}
            {g.kit.itak && btn({ code: "KeyV", icon: "blade", label: g.kit.spear ? "Sibat" : "Itak", lit: live.itakWait <= 0 })}
          </div>
          <div className="trow">
            {g.bag.salt > 0 && btn({ code: "KeyQ", icon: "salt", label: "Salt", count: g.bag.salt })}
            {g.kit.pouch > 0 && btn({ code: "KeyZ", icon: "salt", label: "Pouch", count: g.kit.pouch })}
            {night && g.kit.smudge > 0 && btn({ code: "KeyX", icon: "flame", label: live.smudge > 0 ? `${Math.ceil(live.smudge)}s` : "Smudge", count: g.kit.smudge })}
            {night && btn({ code: "KeyF", icon: "oil", label: g.lampOn ? "Shutter" : "Unshutter", lit: g.lampOn })}
            {g.bag.herbs > 0 && live.health < m.health - 0.5 && btn({ code: "KeyH", icon: "herbs", label: "Eat (hold)", count: g.bag.herbs })}
            {g.lost && btn({ code: "KeyT", icon: "charm", label: "Shirt (hold)" })}
            <button className={`tbtn ${toggles.sneak ? "lit" : ""}`} aria-label="Sneak" onPointerDown={(e) => { e.preventDefault(); press("KeyC", true); press("KeyC", false); tick((n) => n + 1); }}>
              <Icon name="feet" size={19} /><span>{toggles.sneak ? "Sneaking" : "Sneak"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./styles.css";
import { live, useGame } from "./game/state";

// While developing, expose the game state so it can be poked from the browser console.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__aswang = { live, useGame };
  const shot = location.hash.match(/^#shot=([\w.-]+)/);
  if (shot) void import("./devshots").then((m) => m.runShot(shot[1]));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

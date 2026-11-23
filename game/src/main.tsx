import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { live, useGame } from "./game/state";

// While developing, expose the game state so it can be poked from the browser console.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__aswang = { live, useGame };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

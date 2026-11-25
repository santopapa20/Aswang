import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative, so one build works at the site root, under /Aswang/ on GitHub Pages, or opened from disk (assetUrl.ts)
  base: "./",
  server: { port: 5173, strictPort: true },
});

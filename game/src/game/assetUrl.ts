/**
 * Where a file in `public/` really is. The game names its models by their place in `public/`
 * ("/models/hut.glb"), and those names are used as keys too (useProp's KEEP_RELIEF, drawcount.mjs). When the
 * site is served from a sub-folder (GitHub Pages: /Aswang/), the files are under that folder, so a name
 * is turned into an address only at the moment it is fetched. Vite's `base` is "./" (vite.config.ts), so
 * BASE_URL is relative and the same build works at the root, in a sub-folder, or opened from disk.
 */
export const assetUrl = (name: string) => `${import.meta.env.BASE_URL}${name.replace(/^\//, "")}`;

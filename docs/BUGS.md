# Bugs

One list, worked top down. Severity is how bad it is; priority is how soon it is fixed.

- **Severity:** S1 crash, lost progress or cannot go on · S2 a feature broken, still playable · S3 degraded, a way round exists · S4 cosmetic.
- **Priority:** P1 fix now · P2 before the next milestone · P3 backlog · P4 accepted, won't fix.

Found with the real-time replay (`scripts/play.mjs`), the hitch finder (`scripts/hitch.mjs`), the
economy check (`scripts/economy.mjs`), the soak run (`scripts/soak.mjs`), the production-build frame
counter (`scripts/prodfps.mjs`) and the self-test.

## Fixed (2026-11-24, the fix pass)

| ID | Sev | Pri | What was wrong | Fix | Verified by |
|---|---|---|---|---|---|
| BUG-0001 | S2 | P1 | Every creature stalled the game the first time it appeared (down to 4 fps on night 1 when the aswang came out). The warm-up prepared only what was visible at load, and creatures are hidden until their night. | `Warmup` (App.tsx) shows hidden things for the moment of the call, prepares textures and shaders with `compileAsync`, and runs again at 3 s and 9 s for late loads. | `hitch.mjs`: no shader compiled mid-play on nights 1 and 5 |
| BUG-0002 | S3 | P1 | A 0.8 s freeze the first time he walked to the well, 0.3 s at the house: props that loaded after the warm-up compiled on first sight. | Same as BUG-0001 (the repeat passes). | `play.mjs`: longest frame 806 → 49 ms at the well |
| BUG-0003 | S3 | P1 | A stall of up to 0.2 s whenever a creature first broke into a run: its footstep speed was measured on first use, separately for every copy. | Measured once per model (shared cache) while the game loads (useCharacter.ts). | `hitch.mjs` night 5: 6 → 1 slow frame, 41 → 53 fps |
| BUG-0004 | S3 | P1 | The sitio's chests, jars and sacks refilled every day, so coins could be farmed (2.6x everything worth buying). | What people left behind is emptied once per run (`emptied`); the land's herbs and fronds still grow back. | `economy.mjs`: HEALTHY |
| BUG-0005 | S3 | P2 | A player who kept to the barrio could not quite pay for a night's extra supplies. | Herbs sell for 3 centavos (was 2); bounty pay trimmed a sixth. | `economy.mjs`: 84 c against 70 c |
| BUG-0006 | S2 | P1 | The save had no version and no backup; a damaged or newer save could half-load. | Version stamp, backup of the last good save, migration step, and every field checked and clamped on load (state.ts). | self-test: damaged save falls back, newer refused, old one loads |
| BUG-0007 | S3 | P2 | Screen shake jumped to a random spot every frame (a buzz), and nothing could turn it down. | Trauma-squared shake on summed sines, decaying in real time; Screen shake full / half / off. | by eye: not yet (ask in the playtest) |
| BUG-0008 | S3 | P2 | The bench, trade, bag and pause panels needed the mouse in a keyboard game; nothing was selected on opening. | Arrow keys move, Enter chooses, first item selected on opening, a clear focus outline. | self-test |
| BUG-0009 | S4 | P2 | Creatures went from not seeing him to charging in the same instant. | The kin stop and stare for 0.45 s first. | `duel.mjs`: dogs and crawler as before; fleeing gets away 3 of 3 from each |

## Fixed (2026-11-25, frame rate)

| ID | Sev | Pri | What was wrong | Fix | Verified by |
|---|---|---|---|---|---|
| BUG-0010 | S3 | P2 | The production build ran 43-50 fps on this laptop. Two causes, measured with `drawcount.mjs` and `bound.mjs`: every animated character was exempt from frustum culling, so off-screen creatures were drawn anyway (a night-5 frame drew 413k triangles with 153k on screen); and the graphics are limited by pixels (half resolution ran 51 -> 77 fps behind the house), while the canvas drew up to 1.25 device pixels. | Characters are culled with their bind-pose sphere at twice the radius (useCharacter.ts); the canvas draws at 1 device pixel, and Resolution: auto (the default, in the pause menu) steps down to 0.7 while under 50 fps and back at 58; the ground's texture filtering eased from 4x to 2x. | `prodfps.mjs`: 50 / 43 -> 83 / 79 fps (standing / walking, full resolution); `drawcount.mjs` night 5: 413k -> 153k triangles; `frames.mjs`: the slowest places (the sitio by day 53, Rosing's yard at night 57) stay above where the resolution steps down |

## Soak (2026-11-25)

`node scripts/soak.mjs 6 night5`, night held for the whole 6 minutes, the player moved between seven spots:
heap 150-177 MB and swinging with collection, not climbing (+8% minute 1 to 6); geometries settle at 75 by
minute 2.5 (props loading in), textures 78 and shaders 42 flat; 39 -> 58 fps. **PASS.**

The soak script itself had two faults, fixed: its driver died on the first frame (the frame's timestamp can
come before the start time, giving index -1), which hung an earlier run for 83 minutes; and with the player
away from the house the aswang broke in until the night ended, so half a run measured the ending screen. It
now reads each checkpoint from outside the page (a stalled page reports STALLED), keeps Rosing alive, and
will not pass a run that left the night. `duel.mjs` now treats the kin's stare as noticing him.

## Open

| ID | Sev | Pri | What | Notes |
|---|---|---|---|---|
| BUG-0013 | S3 | P3 | Once, the first production load in a fresh browser froze for about 15 s after Begin. The next run did not. | Not reproduced. Possibly the preview server's first reads of the large model files out of OneDrive. Watch for it in the playtest. |
| BUG-0011 | S4 | P3 | One slow frame (about 130 ms) can still come when a bite lands. | No shader behind it; likely the hurt sound and the HUD's toast together. |
| BUG-0014 | — | P2 | The touch controls have only been tried on an emulated phone (`scripts/touch.mjs`), not on a real one. | Try them on a phone held sideways: the stick, holding Use and garlic, and whether the smaller interface can be read. |
| BUG-0012 | — | P2 | Nobody has played the whole game by hand. | `docs/PLAYTEST.md` is the form for that session. |

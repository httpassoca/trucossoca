# Controls: recommendation

Synthesis of [controls-conventions.md](./controls-conventions.md) (what desktop card and tabletop games do) and
[controls-web-tech.md](./controls-web-tech.md) (what the browser and three.js allow). Read those for the sources; this
page is the decision proposal. Nothing here is implemented yet except what is marked *(done)*.

## The rule

**The mouse means one thing per stance, and the stance is explicit.** Seated, the cursor is a hand: it points, lifts,
clicks and drags cards and buttons. Standing or ghost, the mouse is the eyes: pointer lock, look around, walk with the
keys. Every mouse action keeps the key it has today, so keyboard-first regulars lose nothing.

This is what Tabletop Simulator, Tabletop Playground, Inscryption, Poker Night and Red Dead's poker table converge on:
a seated card game has a free cursor, and looking around is a held button, not the default.

## Seated: free cursor, hold right button to look

| Input | Action |
| --- | --- |
| Move mouse | A visible cursor. Hovering one of your cards lifts it a little (the tell others see); hovering a card on the table shows who threw it and in which trick *(done, tooltip)* |
| Left click on your card | Selects it (rises, glows). Click again or `Enter` plays it. Click elsewhere or right click deselects |
| Left drag your card past the drop zone and release | Plays it with a throw. A short drag snaps back, so no accidental play |
| Left click a HUD button (Truco, Aceito, Corro, Coberta, Nova partida) | Same as its key. The buttons are reachable because the cursor is free |
| **Hold right button + move** | Look around, yaw and pitch clamped as today. Release and the cursor is back where it was |
| Wheel | Lean in and out (replaces right-button lean) |
| **Hold `Shift`** | Lift your cards to your face to read them; release to rest them face-down at the table edge *(done, provisional key)* |
| `1` `2` `3`, arrows + `Enter`, `T`, `C`, `X`, `R` | Unchanged |
| `Space` | Bounce; twice within 450 ms stands up (unchanged) |
| `Esc` | Opens the menu. No pointer lock to release, so no browser cooldown |

Why this and not a centre reticle under pointer lock: a reticle makes you aim your whole head at a card, calls need
buttons placed in the 3D world, and every session keeps paying the browser's pointer-lock costs (Esc reserved, 1.25 s
cooldown before re-locking in Chrome, cursor jump on exit). The seated part of a session is most of it.

Why not Inscryption's edge-look: least discoverable of the options, and the outer cards of the fan sit exactly where the
cursor would trigger it.

## Standing and ghost: pointer lock, first-person idiom

| Input | Action |
| --- | --- |
| Click on the canvas | Locks the pointer. Only this stance ever requests the lock |
| Move mouse | Look |
| `WASD`, `Space` | Walk, jump (unchanged) |
| `Shift` near your chair | Sit down (unchanged). Ghost near a bot's chair: take its seat between hands *(done)* |
| Left click | Standing with a seat: plays the selected card from afar, like `Enter`. Ghost: nothing |
| Right button, wheel | Nothing while standing |
| Crosshair over a card on the table | Tooltip with who threw it *(done)* |
| `Tab` | Ghost cycles chairs (unchanged) |
| `Esc` | Browser releases the lock, the menu opens, a click resumes (unchanged) |

Switching stance: sitting calls `exitPointerLock()` from the page, which keeps the next lock free of the Esc cooldown;
standing (`Space` twice) requests the lock from that key press's activation.

## What changes in the code

- `input.ts` gets a `mode`: `look` while locked, `cursor` while unlocked. Cursor mode adds hover, click, drag with pointer
  capture, and right-button look through `movementX`, which browsers report even without lock.
- A hand-rolled `Raycaster` on a card layer, no `@threlte/extras` (it would add `camera-controls`, `three-mesh-bvh`,
  `troika-three-text` and only raycasts on DOM events). The tooltip already uses one *(done)*.
- The truco prompt, the key bar and a small "Truco" button become clickable HUD, which the HUD rework already makes
  reachable (the prompt no longer sits under the menu backdrop).
- Sensitivity becomes a setting, because `movementX` units differ per browser and OS zoom.

## Open questions for you

1. **Peek gesture.** Two candidates, both cheap: hold `Shift` (implemented now) or hover-lift (moving the cursor over
   your cards lifts them, moving away rests them). Hover is one gesture fewer; hold is a deliberate act that reads as a
   tell at the table. Recommendation: keep hold `Shift`, add hover-lift of the single card under the cursor as a preview.
2. **Drag to throw.** Worth the extra code, or is click-then-click enough? Recommendation: ship click-then-click and
   `Enter` first; add drag-throw after, it only changes how the play starts.
3. **Wheel for lean.** Right button is taken by look, so lean moves to the wheel. Alternative: no lean at all, since
   lifting cards and the tooltip replace most of what leaning was for. Recommendation: wheel lean, small range.

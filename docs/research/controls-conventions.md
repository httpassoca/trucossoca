# Mouse + keyboard conventions for a seated 3D card game that also lets you stand up

Research notes, September 2026. Question: what desktop control schemes let the mouse *act* (play a card, call truco,
answer a call, lift cards to look) and not only look, in a first-person game where the player sits at a small table,
can stand up and walk, and where ghosts walk freely. The goal is play that is fluid and graspable in thirty seconds.

Current scheme in this repo (`README.md` "Teclado primeiro", `apps/web/src/lib/input.ts`): pointer lock always;
mouse only looks; right button held leans in (seated only); `1`/`2`/`3` or arrows + `Enter` play; `T` truco; `C` cover;
prompts answer with `Enter` / `X` / `R`; `Space` bounces, twice stands; `WASD` walks; `Shift` near the chair sits;
`Tab` cycles seats for ghosts; `Esc` releases the lock and opens the menu. Nothing in 3D is clickable.

Source quality: official knowledge bases and specs were used where they exist (Tabletop Simulator KB, Tabletop
Playground KB, W3C Pointer Lock, MDN, Chrome Developers, three.js). PCGamingWiki, StrategyWiki, Fandom and some
Steam pages refused automated fetches (403/402), so for Inscryption, Poker Night, Slay the Spire, Gwent, Hand of Fate and
RDR2 the evidence is the developer's own words on Steam/PlayStation Blog, Steam discussions with dev replies, and key
tables reproduced by guide sites. Those are marked "secondary" below.

## 1. How well-regarded games split look and act on one mouse

### Inscryption (first-person card table in a cabin)
- Scheme: free cursor, point-and-click. The developer: "Inscryption was originally designed to be a point-and-click
  adventure controlled with a mouse" ([PlayStation Blog, Daniel Mullins, 2022](https://blog.playstation.com/2022/08/26/learn-how-the-dualsense-controller-helps-bring-some-of-inscryptions-deepest-secrets-to-life/)).
  The view changes in discrete snaps, not by mouse-look: on console you "snap between views with the analog stick, use the
  face buttons to examine and play your cards, then press the adaptive trigger to end your turn" (same source). On PC the
  snaps are WASD and on-screen arrows that appear when the cursor rests at the edges of the screen; a community secrets
  guide tells players to "hover over the centre of edges of the screen without arrows to reveal arrows leading to hidden
  areas" ([Steam guide "Extra Secrets", secondary](https://steamcommunity.com/sharedfiles/filedetails/?id=2633162226)).
  Players describe it as "WASD your way through it" and "mouse for interacting stuff"
  ([Steam thread](https://steamcommunity.com/app/1092790/discussions/0/3091149848173152738)).
- Does well: the mouse is always a hand. Hover lifts a card, click plays it, click the bell ends the turn; there is no
  mode to learn. Snapped views mean the table is always framed correctly for clicking.
- Costs: the game confines the cursor to the window, which broke an on-screen-keyboard user; the dev promised "a keyboard
  shortcut to disable it" ([Steam "Mouse lock" thread, dev reply](https://steamcommunity.com/app/1092790/discussions/0/4975907019749020526/)).
  Some players find the snapped camera "like a game from 30 years ago" (thread above). No free look at all.

### Tabletop Simulator (TTS)
- Scheme, from the official KB: "Hold RMB anywhere on the table (not on an object) and move around to control the camera
  rotation"; MMB held pans, wheel zooms; WASD pans; LMB picks up an object and letting go drops it; `F` flips; `Q`/`E`
  rotate; "Zoom in on a specific object by hovering over it and pressing the ALT key"; `P` switches to first-person, where
  WASD + RMB move and look, `Space` flies up, `Ctrl` down ([TTS KB, Controls & Movement](https://kb.tabletopsimulator.com/player-guides/basic-controls/)).
  Advanced: "Holding ALT and clicking SHIFT while hovering over an Object shows the underside" and other players are
  alerted; typing a number over a deck draws that many cards ([TTS KB, Advanced Controls](https://kb.tabletopsimulator.com/player-guides/advanced-controls/)).
  Physics: "Pick up, rotate, shake, and throw any object" ([Steam store page](https://store.steampowered.com/app/286160/Tabletop_Simulator/)).
  Hidden hands: a Hand Zone "determines where their 'seat' is" and its contents can be hidden and shown "on your screen in
  an easy-access pop-up panel" ([TTS KB, Zone Tools](https://kb.tabletopsimulator.com/game-tools/zone-tools/)).
- Does well: one rule ("left = hands, right = eyes") that survives every camera mode, including first person. Hover +
  ALT is a universal "look closer" that also works as a peek.
- Costs: a physics sandbox with no rules needs many modifier keys (ALT, F, Q/E, numbers); the first-person mode is a
  fly-cam, not a body, and TTS has no notion of a seated player getting up.

### Tabletop Playground (TTP)
- Scheme: camera "similar to Tabletop Simulator"; you "pick up objects and 'throw' them virtually"; "when you hover over
  an object, a handy little list of useful hotkeys for the object pops up in the lower right corner"
  ([Meeple Mountain, secondary](https://www.meeplemountain.com/articles/learn-how-to-use-tabletop-playground/)).
  Cards: "You can take the top card from a stack by dragging it off", and "click on it and hold until you pick up the stack";
  "While you hold a card, its face isn't visible to other players (they will only see a grey blur)"; "the card front face
  is not visible for yourself either while you hold a card with its back face up" ([TTP KB, Cards](https://tabletopplayground.com/knowledge-base/cards/)).
  Holders: "Cards on the holder with their front face up are only visible to the owning player, other players just see a
  grey blur" ([TTP KB, Card holders](https://tabletopplayground.com/knowledge-base/card-holders/)).
- Does well: the drag-vs-hold distinction (quick drag = one card, hold = the stack) and the contextual hotkey list on
  hover make a deep scheme self-teaching. The grey blur is a good "you are holding something private" affordance.
- Costs: same sandbox burden as TTS; the KB has no controls page at all, it relies on the in-game tutorial
  ([TTP KB, Getting started](https://tabletopplayground.com/knowledge-base/getting-started/)).

### Hearthstone / Gwent / Slay the Spire / Balatro (2D card games, the drag-or-click family)
- Hearthstone: cards are dragged from hand to the board (players report bugs as "I am not able to drag the cards to the
  board", [Blizzard forums](https://us.forums.blizzard.com/en/hearthstone/t/cant-drag-cards-to-the-board/17737));
  "Players can mouse over any card or hero power at any time to read its description", legal plays "are illuminated with
  a bright green aura", and "Mousing over something will highlight it in red on your opponent's screen"
  ([Hearthstone wiki, Gameplay](https://hearthstone.wiki.gg/wiki/Gameplay)). Does well: hover = read, green = playable,
  drag = commit, your hover is visible to the other side (social signal). Costs: drag only; no keyboard.
- Gwent (Witcher 3 era): players split between mouse-only and "Some actions using mouse, some using keyboard" (52%), with
  complaints that "Sometimes I can double-click a card to perform an action...but sometimes I can't" and right-click
  meaning different things per screen ([CDPR forum poll](https://forums.cdprojektred.com/forum/en/the-witcher-series/the-witcher-3-wild-hunt/68462-pc-users-do-you-play-gwent-with-just-the-mouse-or-just-keyboard-or-both)).
  Lesson: inconsistent click semantics are the thing players remember.
- Slay the Spire: you drag a card to its target; untargeted cards are dragged "to the center of the screen"; right click
  releases a drag ([Steam thread on touch mode](https://steamcommunity.com/app/646570/discussions/0/1754645970776730698/)).
  StS 2 adds `1-9` to select a card but players "cannot figure out how to use the card" from the keyboard
  ([Steam thread](https://steamcommunity.com/app/2868840/discussions/0/806845754928942255/)). Lesson: a select key without
  a confirm key is half a scheme.
- Balatro: "Left Click: Select/deselect any card and booster packs, select blind, or press any other button. Hold Left
  Click: Hold and drag any card to move it. Right Click: Deselect all selected playing cards." ([Balatro wiki, Controls](https://balatrowiki.org/w/Controls)).
  Does well: click toggles selection, a big button commits ("Play Hand"), right click cancels. Drag exists only for
  reordering, so an accidental drag never plays a card. Costs: two clicks per play; almost no keyboard in vanilla (mods add
  `A S D F G` selection and hotkeys, [Typist mod](https://balatromods.miraheze.org/wiki/Typist)).

### Poker Night at the Inventory (first-person seated poker)
- Scheme: a fixed first-person seat; the player is "an unseen silent participant" ([Wikipedia](https://en.wikipedia.org/wiki/Poker_Night_at_the_Inventory));
  all play is mouse clicks on chips and buttons, and the 2026 remaster added "gamepads as well as its usual mouse input"
  ([Steam store page](https://store.steampowered.com/app/3897800/Poker_Night_at_the_Inventory/)). The camera cuts on its
  own during table talk; tells guides note that "turning off table conversations in the settings prevents camera cuts"
  ([games.gg, secondary](https://games.gg/poker-night-at-the-inventory/guides/poker-night-at-the-inventory-list-of-all-tells/)).
- Does well: no look axis at all, so the mouse is 100% action; buttons are big and on the table.
- Costs: the camera is directed, not owned; nothing to do with your body.

### Hand of Fate
- Scheme: the dealer table is mouse point-and-click on cards laid out in front of you; arrow keys navigate menus
  ("You have to use your arrow-keys (instead of WASD)") and "you can use your mouse, too (click on items in the
  background)" ([Steam thread](https://steamcommunity.com/app/266510/discussions/0/617328415060174545/)); devs: "We did
  most of our dev with M+K" ([Steam thread, dev reply](https://steamcommunity.com/app/266510/discussions/0/618453594764241624)).
  In the sequel "you can currently bind the mouse's combat functions to keyboard keys" ([HoF2 Steam thread, dev reply](https://steamcommunity.com/app/456670/discussions/0/3183345000082206847/)).
- Does well: a fixed seated camera over a table where every card is a button.
- Costs: keyboard parity was bolted on and users report being "blocked from being able to pick different cards".

### Card Shark
- Scheme: sleights are gestures. On mouse: "Up/Down/Left/Right -> Click and drag mouse in the same direction",
  "Clockwise/Counterclockwise -> Click and drag the mouse the correct circular motion", buttons -> "Click on the card you
  want to select" ([Steam guide, secondary](https://steamcommunity.com/sharedfiles/filedetails/?id=3346109866)).
- Does well: the mouse *is* the hand; dragging a card feels like handling it.
- Costs: "some gestures are really hard. sometimes I don't understand where I have to click first to register the
  gesture" ([Steam thread](https://steamcommunity.com/app/1371720/discussions/0/3414306773847972993/)). Gesture input is
  the opposite of "graspable in thirty seconds".

### Red Dead Redemption 2 poker (sit at a table inside a first-person world)
- Scheme: walk up, interact to sit; `V` "switches your view between the modes" including first person
  ([Steam thread](https://steamcommunity.com/app/1174180/discussions/0/3153076242548019437)). At the table the keys are:
  "Poker View Your Hand = R/Mouse Button", "Poker Show Community Cards = Spacebar", "Poker Fold = F", "Poker Check/Fold =
  G", "Poker Show Possible Hands = H", bets with arrow keys and "Place Bet/Play Move = RETURN"; `Backspace` leaves
  ([key table, secondary](https://steamah.com/red-dead-redemption-2-default-keyboard-commands/)).
- Does well: the mouse still looks (you can watch opponents) and one mouse button doubles as the peek; everything else is
  a single key with an on-screen prompt. Sitting and leaving are explicit, prompted actions.
- Costs: the mouse never touches a card; play is a HUD of prompts, so the table is scenery.

## 2. "Hold to peek" versus cards always visible

- Physical poker convention, reproduced in VR: "you'll need to physically pick up your cards and look at them"; other
  players "won't be able to see them" but will see "every time they double-check their hole cards"
  ([PokerStars VR review, casino.org](https://www.casino.org/blog/pokerstars-vr/)). Peeking is a visible social act.
- Desktop poker: RDR2 binds the peek to a held key or mouse button ("View Your Hand = R/Mouse Button", key table above).
  Prominence Poker players ask for exactly that: "being able to check your cards by quickly pressing space would be great"
  because "you can do everything in game with the mouse though. With One button"
  ([Steam thread](https://steamcommunity.com/app/384180/discussions/3/133261370013774005/)).
- Sandboxes: TTS shows hidden cards in a permanent hand panel and offers a modifier peek (ALT zoom; ALT+Shift shows the
  underside and "Other players are alerted"). TTP hides a held card from everyone else as a grey blur, and hides its face
  from *you* while it is face-down in your hand.
- VR: TTS in VR toggles a grabbed card "between the orientation you picked it up, and held facing you (and hidden from
  other players)" ([onelivesleft, TTS SteamVR binding walkthrough](http://blog.onelivesleft.com/2019/03/tabletop-simulators-steamvr-binding.html)).
- Inscryption keeps cards always visible in a fan and lifts the hovered one; there is no peek because there is no bluff.

Takeaway for Truco: Truco is a bluffing game with three cards, so the poker convention fits better than the always-open
fan. A *held* peek (key or button) that lifts the cards toward the camera and is visible to others as a gesture gives
"tells" for free; cards should rest face-down or edge-on on the table when not peeked, and a hover-lift can serve as the
seated peek when the mouse acts.

## 3. Hybrid look schemes and what pointer lock costs in a browser

| Scheme | Used by | Discoverability | Trade-off |
| --- | --- | --- | --- |
| Free cursor, snapped views | Inscryption | High: cursor is always visible and clickable | No free look; edge arrows are easy to miss |
| Free cursor, hold RMB to look | TTS, TTP | High: RMB-drag is the tabletop/RTS norm | Right button is not available for actions; small yaw per drag |
| Free cursor, hold MMB to rotate | Baldur's Gate 3 | Medium | Wheel click is awkward on many mice ([PCGamesN, secondary](https://www.pcgamesn.com/baldurs-gate-3/camera-controls)) |
| Edge-look (cursor near edge turns camera) | RTS edge scroll; small browser games ("To rotate the camera, you can move the mouse cursor to the left or right edge of the screen", [itch.io jam entry](https://itch.io/post/12781955)) | Low | Fires whenever you reach for something at the edge; unusable with a UI at the edges |
| Pointer lock, click to lock, Esc to unlock | three.js `PointerLockControls` ("a perfect choice for first person 3D games"; overlay says "Click to play", "Look: MOUSE") ([three.js docs](https://threejs.org/docs/api/en/extras/controls/PointerLockControls.html), [example](https://threejs.org/examples/misc_controls_pointerlock.html)) | High for FPS players, low for everyone else | Cursor gone, nothing clickable |

Browser facts that shape the choice:
- Lock needs a gesture: "Transient activation is required when calling requestPointerLock()" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)).
- `Esc` is reserved: "The ESC key is the recommended default unlock gesture" ([W3C Pointer Lock 2.0](https://w3c.github.io/pointerlock/)).
  After it, "If calling requestPointerLock() immediately after releasing the pointer lock via the default unlock gesture
  (instead of through an exitPointerLock() call), the call will fail, even if a transient activation is available" (MDN).
  "Repeated escapes of pointer lock can signal user agent to not re-lock the pointer without more specific user action"
  (W3C). This is why `input.ts` needs a click to resume and why an in-game menu on `Esc` cannot be closed with `Esc`.
- On unlock "The system mouse cursor must be displayed again and positioned at cursor position" where it was locked (W3C),
  so the cursor jumps back to the lock click, not to where the crosshair was.
- Chrome briefly added a permission prompt for pointer lock (Chrome 131) and then reverted: "We have decided not to launch
  the Keyboard Lock and Pointer Lock permissions... the permission modal frequently caused confusion on legitimate sites"
  ([Chrome Developers](https://developer.chrome.com/blog/keyboard-lock-pointer-lock-permission)).
- `Esc` can only be captured in fullscreen with `navigator.keyboard.lock(['Escape'])`, with a two-second hold as the
  escape hatch ([Chrome Developers](https://developer.chrome.com/blog/better-full-screen-mode)). Not usable in a windowed tab.
- Raw input: `requestPointerLock({ unadjustedMovement: true })` disables OS acceleration; "Some platforms may not support
  unadjusted movement" ([MDN, Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)).

Conclusion: pointer lock is the right tool only while the body moves (standing, ghost). Seated, a free cursor with a
held-button look costs nothing in the browser (no gesture, no `Esc` fight, no cursor jump) and turns the whole mouse into
a hand. Edge-look is the least discoverable option and conflicts with any HUD at the edges.

## 4. Seated and standing in games that have both

- RDR2: sit via the world prompt, leave via a key (`Backspace`), `V` toggles first person. Seated, the mouse looks and one
  button peeks; standing, the mouse looks and buttons shoot/interact. Same mouse meaning in both modes (look), the
  *keyboard* changes meaning (key table and threads above).
- Garry's Mod: "walk up to your seat, look at it, and press E"; only vehicle seats are sittable; `Use` exits the seat
  ([Steam thread](https://steamcommunity.com/app/4000/discussions/1/864959336391409315)). Mouse keeps looking while seated.
- Sea of Thieves: "hold 'X' on a controller or 'F' on a keyboard to sit down", `R` toggles first/third person
  ([Rare Thief, secondary](https://rarethief.com/how-to-sit-and-sleep-in-sea-of-thieves/)); tavern card games are a
  community request, not a feature ([Sea of Thieves forums](https://www.seaofthieves.com/community/forums/topic/142165/table-and-chairs-on-ships-taverns-to-sit-and-play-cards/3)).
- TTS: `P` cycles first-person / third-person / top-down; first person is WASD + RMB look with `Space`/`Ctrl` for height
  (TTS KB above). The mouse means the same in every mode: LMB grabs, RMB-drag looks. TTP in VR: grabbed objects "rotate
  together with your hand" and you can resize yourself to the table ([TTP KB, motion controllers](https://tabletopplayground.com/knowledge-base/using-motion-controllers/)).
- Pattern: every game keeps one mouse meaning across modes and switches modes with an explicit, prompted key (`E`/`F`
  hold to sit, `Backspace`/`Use` to get up). None of them changes what the mouse does when you sit; RDR2 adds a mouse-button
  peek only because the mouse otherwise has nothing to do at a poker table.

## 5. Mouse affordances that make actions obvious

- Hover highlight + lift: Inscryption lifts the hovered card; Hearthstone enlarges on mouse-over and glows playable cards
  green (wiki above). Cheap, universal, and it doubles as the peek in a bluffing game.
- Playable-state colour: Hearthstone's "bright green aura" on everything you may play or command; the End Turn button
  glows when nothing is left to do (wiki above). Translates directly to "your turn" and "you may call truco".
- Drop zone: StS drags untargeted cards "to the center of the screen"; Hearthstone drags to the board. A visible zone in
  front of the chair ("play here") removes the guess.
- Drag-and-release to throw: TTS and TTP let a fast release fling objects (Steam page, TTP KB). Fun for the "jogar a
  carta" feel; risky for accidental plays unless a threshold (distance past the zone or release speed) is required.
- Click-to-play with confirm: Balatro (select, then "Play Hand"), StS 2's `1-9` select (without a confirm, players are
  lost). Two-step play is the safest for a three-card game where one mistake decides the hand.
- Contextual on-screen buttons: Poker Night and RDR2 keep bet/fold/check as always-visible buttons or prompts; Inscryption
  puts the "end turn" bell on the table as a 3D object. Truco's calls ("Truco!", "Aceito", "Corro") should be both a 3D
  thing on the table and a HUD button, mouse-clickable, with the key printed on it.
- Hover hotkey list: TTP shows "a handy little list of useful hotkeys for the object" on hover (Meeple Mountain above).
  The cheapest tutorial there is.
- Right click cancels: Balatro (deselect), StS (release the drag). Never bind an irreversible action to right click.
- Visible hover to others: Hearthstone highlights your hover in red on the opponent's screen; PokerStars VR shows
  double-checking hole cards. In a 2v2 game with friends, showing "who is fiddling with which card" is part of the fun.
- Keyboard parity: RDR2 gives every table action a key and a prompt; Hand of Fate and Gwent show what happens when parity
  is bolted on later. Keep the existing keys and print them on the buttons.

## Recommendations for this game

Principle: the mouse means one thing per *stance*, and the stance is explicit. Seated, the cursor is a hand; standing or
ghost, the mouse is the eyes. Every mouse action keeps its current key.

### Seated, candidate A: free cursor, hold right button to look (recommended)

| Input | Action |
| --- | --- |
| Move mouse (no button) | Move a visible cursor; hovering a card lifts it toward the camera (your peek, visible to others as a lean/lift); hovering a button or the monte shows a tooltip with its key |
| Left click on own card | Select it (it rises and glows); left click again, or `Enter`, plays it. Click elsewhere or right click deselects |
| Left drag own card past the drop zone in front of the chair, release | Plays it with a throw; a short drag snaps back (no accidental play) |
| Left click a 3D/HUD button ("Truco!", "Aceito", "Corro", "Coberta", "Nova partida") | Same as its key (`T`, `Enter`, `X`, `C`) |
| Hold right button + move | Look around (yaw/pitch clamped as today); release returns to the cursor. No pointer lock needed |
| Wheel | Lean in/out (replaces today's right-button zoom); or select next/previous card when a prompt is open |
| Hover a played card on the table | Lift it slightly and show whose it is and the trick order |
| `1` `2` `3`, arrows + `Enter`, `T`, `C`, `X`, `R` | Unchanged |
| `Space` | Bounce; twice within 450 ms stands up (unchanged) |
| `Esc` | Opens the menu (cursor already free, so no lock dance) |

Why: acting needs a cursor, and a cursor in a seated game costs nothing (Inscryption, Hand of Fate, Poker Night, Balatro
all live without mouse-look). Hold-RMB-to-look is the tabletop norm (TTS, TTP) and the same gesture the player already
uses on the right button here. Free cursor while seated removes the browser's `Esc`/re-lock problems for the 95% of the
session spent seated. Hover-lift gives Truco its peek and its tells. Click-then-click (Balatro) plus drag-past-zone (StS,
Hearthstone) means both "careful" and "flashy" players can play a card in one gesture without misplays.

### Seated, candidate B: keep pointer lock, act with a centre reticle

| Input | Action |
| --- | --- |
| Move mouse | Look (as today); a small reticle sits at the centre; the card or button under the reticle highlights and lifts |
| Left click | Play the card under the reticle, or press the button under it; `Enter` does the same to the selected card |
| Hold right button | Lean in (as today), which also brings the cards under the reticle |
| Wheel | Cycle selection `1` -> `2` -> `3` (mirrors arrows) |
| Keys | Unchanged |

Why not: it is a first-person-shooter idiom; players must aim the whole head at a card, calls need buttons placed in the
world, and every session still pays the pointer-lock costs (gesture to re-lock, `Esc` reserved, cursor jump). Choose it
only if free look while seated matters more than clicking.

### Seated, candidate C: free cursor with edge-look (Inscryption-like)

Same as A, but the camera yaws when the cursor rests near the left/right screen edge instead of holding RMB. Rejected:
edge-look is the least discoverable option in the table above, it fights any HUD at the edges, and the outer cards of the
fan sit exactly where the cursor would trigger it. Keep RMB-hold; optionally show small edge arrows as a *click* target
for players who never find the right button.

### Standing and ghost: pointer lock, FPS idiom (recommended)

| Input | Action |
| --- | --- |
| Click on canvas | Locks the pointer ("Click to play" overlay, three.js convention); lock is requested only in this stance |
| Move mouse | Look |
| `WASD` | Walk; `Space` jumps; `Shift` near own chair sits (unchanged) |
| Left click | While standing with a seat: plays the selected card from afar (same as `Enter`), so a standing player is never stuck; ghost: nothing |
| Right button | Nothing (no lean while standing); free for a future "point at" emote |
| Wheel | Nothing, or next/previous card selection for a standing player |
| `Tab` | Ghost cycles chairs (unchanged) |
| `Esc` | Browser unlocks; menu opens; a click resumes (unchanged; the browser forbids re-locking without a click) |

Sitting down (`Shift` near the chair, or walking into it) calls `exitPointerLock()` and switches to candidate A; standing
(`Space` twice) requests the lock from that key press's transient activation. Because the exit is programmatic, not `Esc`,
the browser allows the next lock without the cooldown described in section 3.

Mode switch rule, from section 4: one mouse meaning per stance, an explicit prompted key to change stance, and the HUD
prints the key on every button so the keyboard-first scheme stays the fast path for regulars.

## Sources

- Inscryption: [PlayStation Blog](https://blog.playstation.com/2022/08/26/learn-how-the-dualsense-controller-helps-bring-some-of-inscryptions-deepest-secrets-to-life/), [Steam "Mouse lock"](https://steamcommunity.com/app/1092790/discussions/0/4975907019749020526/), [Steam controls thread](https://steamcommunity.com/app/1092790/discussions/0/3091149848173152738), [Steam "Extra Secrets" guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2633162226)
- Tabletop Simulator: [Controls & Movement](https://kb.tabletopsimulator.com/player-guides/basic-controls/), [Advanced Controls](https://kb.tabletopsimulator.com/player-guides/advanced-controls/), [Zone Tools](https://kb.tabletopsimulator.com/game-tools/zone-tools/), [Steam page](https://store.steampowered.com/app/286160/Tabletop_Simulator/), [VR bindings walkthrough](http://blog.onelivesleft.com/2019/03/tabletop-simulators-steamvr-binding.html)
- Tabletop Playground: [Cards](https://tabletopplayground.com/knowledge-base/cards/), [Card holders](https://tabletopplayground.com/knowledge-base/card-holders/), [Motion controllers](https://tabletopplayground.com/knowledge-base/using-motion-controllers/), [Getting started](https://tabletopplayground.com/knowledge-base/getting-started/), [Meeple Mountain](https://www.meeplemountain.com/articles/learn-how-to-use-tabletop-playground/)
- Hearthstone: [wiki Gameplay](https://hearthstone.wiki.gg/wiki/Gameplay), [Blizzard forums](https://us.forums.blizzard.com/en/hearthstone/t/cant-drag-cards-to-the-board/17737)
- Gwent: [CDPR forum poll](https://forums.cdprojektred.com/forum/en/the-witcher-series/the-witcher-3-wild-hunt/68462-pc-users-do-you-play-gwent-with-just-the-mouse-or-just-keyboard-or-both)
- Slay the Spire: [Steam touch thread](https://steamcommunity.com/app/646570/discussions/0/1754645970776730698/), [StS 2 keyboard thread](https://steamcommunity.com/app/2868840/discussions/0/806845754928942255/)
- Balatro: [wiki Controls](https://balatrowiki.org/w/Controls), [Typist mod](https://balatromods.miraheze.org/wiki/Typist)
- Poker Night: [Wikipedia](https://en.wikipedia.org/wiki/Poker_Night_at_the_Inventory), [Steam page (remaster)](https://store.steampowered.com/app/3897800/Poker_Night_at_the_Inventory/), [games.gg tells](https://games.gg/poker-night-at-the-inventory/guides/poker-night-at-the-inventory-list-of-all-tells/)
- Hand of Fate: [Steam M+K thread](https://steamcommunity.com/app/266510/discussions/0/618453594764241624), [Steam keyboard thread](https://steamcommunity.com/app/266510/discussions/0/617328415060174545/), [HoF2 thread](https://steamcommunity.com/app/456670/discussions/0/3183345000082206847/)
- Card Shark: [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3346109866), [Steam mouse thread](https://steamcommunity.com/app/1371720/discussions/0/3414306773847972993/)
- RDR2: [key table](https://steamah.com/red-dead-redemption-2-default-keyboard-commands/), [first-person thread](https://steamcommunity.com/app/1174180/discussions/0/3153076242548019437)
- Poker peek: [PokerStars VR](https://www.casino.org/blog/pokerstars-vr/), [Prominence Poker thread](https://steamcommunity.com/app/384180/discussions/3/133261370013774005/)
- Sit/stand: [Garry's Mod](https://steamcommunity.com/app/4000/discussions/1/864959336391409315), [Sea of Thieves sit](https://rarethief.com/how-to-sit-and-sleep-in-sea-of-thieves/), [Sea of Thieves forum](https://www.seaofthieves.com/community/forums/topic/142165/table-and-chairs-on-ships-taverns-to-sit-and-play-cards/3), [BG3 camera](https://www.pcgamesn.com/baldurs-gate-3/camera-controls)
- Pointer lock: [W3C Pointer Lock 2.0](https://w3c.github.io/pointerlock/), [MDN API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), [MDN requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock), [Chrome permission revert](https://developer.chrome.com/blog/keyboard-lock-pointer-lock-permission), [Chrome Keyboard Lock](https://developer.chrome.com/blog/better-full-screen-mode), [three.js PointerLockControls](https://threejs.org/docs/api/en/extras/controls/PointerLockControls.html), [three.js example](https://threejs.org/examples/misc_controls_pointerlock.html), [edge-look jam example](https://itch.io/post/12781955)

# Mouse on 3D cards, tooltips, and pointer lock on the web

Research for `apps/web` (Vite + Svelte 5 + Threlte 8 `@threlte/core` only, three r186). Current setup: pointer lock is
requested on the canvas by click (`apps/web/src/lib/input.ts`), `mousemove` is only read while locked and drives
`look.tyaw/tpitch`, there is no raycasting, the HUD is DOM over the canvas, in-scene labels and speech bubbles are
`THREE.Sprite`s with canvas textures (`scene/builders.ts`), and each card is a `THREE.Group` with two single-sided
`PlaneGeometry` meshes (front and rear) whose targets `userData.tp/tq` are set by `scene/layout.ts` and lerped every
frame in `World.svelte`. Where a card lands is already decided by a seed (`scene/throw.ts`).

Every claim below links to a primary source (MDN, W3C, three.js/Threlte source, Chromium/Firefox/WebKit sources).

## 1. Pointer Lock API

### Requesting, options, promise

- `element.requestPointerLock({ unadjustedMovement: true })` asks for raw mouse deltas without OS acceleration; the
  option "disables OS-level adjustment for mouse acceleration, and accesses raw mouse input instead"
  ([MDN requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)).
- The call returns a Promise in the current draft, but MDN warns "this version is not yet a standard and is not
  implemented by all browsers" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)).
  Per browser-compat-data, Chrome returns a promise "from version 92", Safari "from version 18.4"; the Firefox entry
  (supported since 50) carries no such note, so keep the `?.catch?.()` guard the repo already uses
  ([BCD api/Element.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json)).
- Rejections defined by the spec: `NotAllowedError` when there is no transient activation and the document "has not
  previously released a successful pointer lock with exitPointerLock()", `SecurityError` (sandbox), `WrongDocumentError`,
  `InvalidStateError`, and `NotSupportedError` when `unadjustedMovement` is asked for but unsupported
  ([W3C Pointer Lock 2.0](https://w3c.github.io/pointerlock/)).
- `unadjustedMovement` support: Chrome 88 on "macOS Catalina 10.15.1+, Windows, and ChromeOS. Not yet supported on
  Linux"; Firefox 152; Safari 18.4 ([BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json),
  [web.dev](https://web.dev/articles/disable-mouse-acceleration),
  [Bugzilla 2037802](https://bugzilla.mozilla.org/show_bug.cgi?id=2037802)). The recommended pattern is to request it
  and, on `NotSupportedError`, fall back to a plain `requestPointerLock()`
  ([web.dev](https://web.dev/articles/disable-mouse-acceleration)). In Firefox the unsupported case surfaces as a generic
  `PointerLockDeniedFailedToLock` rather than a distinct error
  ([PointerLockManager.cpp](https://searchfox.org/mozilla-central/source/dom/base/PointerLockManager.cpp)).
  For a card game, acceleration is not a problem; the option is optional polish.

### User gesture and re-locking

- "Transient activation is required when calling requestPointerLock()"
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)). The spec relaxes it only when
  the page itself exited via `exitPointerLock()`; after a user-driven exit "an event generated as a result of an
  engagement gesture must be received by the document before requestPointerLock will succeed"
  ([MDN Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API),
  [spec](https://w3c.github.io/pointerlock/)).
- MDN: "If calling requestPointerLock() immediately after releasing the pointer lock via the default unlock gesture
  (instead of through an exitPointerLock() call), the call will fail, even if a transient activation is available"
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)).
- Chrome's cooldown is a hard constant. In `chrome/browser/ui/exclusive_access/pointer_lock_controller.cc`:
  `// The amount of time to disallow repeated pointer lock calls after the user successfully escapes from one lock
  request. constexpr base::TimeDelta kEffectiveUserEscapeDuration = base::Milliseconds(1250);` — a request without a
  gesture answers `kRequiresUserGesture`, and one inside the window answers `kUserEscapeCooldown`; both exceptions
  are skipped when "the page has unlocked (i.e. not the user), or if we're in tab fullscreen"
  ([pointer_lock_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/pointer_lock_controller.cc)).
  Blink turns those into `NotAllowedError "A user gesture is required to request Pointer Lock."` and
  `SecurityError "Pointer lock cannot be acquired immediately after the user has exited the lock."`
  ([blink pointer_lock_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/page/pointer_lock_controller.cc)).
  The old design doc states the intent: "if a user has exited mouse lock, the site cannot reacquire it without the
  user clicking on site content" ([Chromium mouse lock design](https://www.chromium.org/developers/design-documents/mouse-lock/)).
- Firefox checks `doc->HasValidTransientUserGestureActivation()` on every request and keeps no extra timer state
  ([PointerLockManager.cpp](https://searchfox.org/mozilla-central/source/dom/base/PointerLockManager.cpp)).
- Practical rule: never re-lock from a timer or from `pointerlockchange`; re-lock only from a click (which the repo's
  `onClick` already does) and treat a rejection as "show the click-to-look hint".

### Escape

- "The ESC key is the recommended default unlock gesture" ([spec](https://w3c.github.io/pointerlock/)). In Chrome the
  key is consumed by the browser before the renderer: `BrowserView::PreHandleKeyboardEvent` runs
  `focus_manager->ProcessAccelerator(accelerator)` → `BrowserView::AcceleratorPressed` →
  `ExclusiveAccessManager::HandleUserKeyEvent`, which handles `VKEY_ESCAPE` and returns handled when
  `PointerLockController::HandleUserPressedEscape()` unlocks
  ([browser_view.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/views/frame/browser_view.cc),
  [exclusive_access_manager.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/exclusive_access_manager.cc)).
  So the page sees only `pointerlockchange`, never the Esc `keydown`; `input.ts` already relies on this.
- The "Press Esc to exit" bubble: `kShowTime = base::Milliseconds(3800)` ("Time the bubble is shown before hiding
  automatically") and `kSnoozeTime = base::Minutes(15)` ("Time without user input that must elapse before the bubble is
  re-shown") ([exclusive_access_bubble.h](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/exclusive_access_bubble.h)).
  It is 3.8 s, not ~1 s, and after the first lock it stays snoozed while the user keeps interacting. Chrome also has a
  press-and-hold path (`kHoldEscapeTime = 1500 ms`) for controllers that require holding Esc (keyboard lock), not plain
  pointer lock ([exclusive_access_manager.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/exclusive_access_manager.cc)).
- Lock also exits when "the user agent, window, or tab loses focus" or the element disconnects
  ([spec](https://w3c.github.io/pointerlock/)); the repo's `blur` handler covers the key state.

### Events and movementX/Y

- `pointerlockchange` fires on `document` for lock and unlock, "is not cancelable and does not bubble"; read
  `document.pointerLockElement` to know which ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/pointerlockchange_event)).
  `pointerlockerror` fires on failure; Chrome 36, Firefox 50, Safari 10.1 for both
  ([BCD api/Document.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Document.json)).
- `movementX = currentEvent.screenX - previousEvent.screenX`, "zero for all events other than mousemove, pointermove,
  and pointerrawupdate" ([MDN movementX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX)).
- The spec: "movementX and movementY must be updated regardless of pointer lock state", and when the pointer re-enters
  the window without a known previous position they "must be set to zero" ([spec](https://w3c.github.io/pointerlock/)).
  While locked, `clientX/screenX` are "held constant, as if the mouse is not moving"
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)).
- Units are not interoperable: "Depending on the browser and operating system, the movementX units may be a physical
  pixel, a logical pixel, or a CSS pixel" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX),
  [w3c/pointerlock#42](https://github.com/w3c/pointerlock/issues/42)). Firefox recently switched unadjusted deltas to
  device pixels "to match Chromium's convention" ([Bugzilla 1829401](https://bugzilla.mozilla.org/show_bug.cgi?id=1829401)).
  Sensitivity should be a user setting, not a constant that assumes CSS pixels.
- Firefox quirks: `pointermove` movement values were wrong under lock (bug 1402657), `exitPointerLock` could emit one
  spurious non-zero move (bug 1460819), and from Firefox 148 `pointerrawupdate` carries non-zero movement "because of a
  web-compat issue" ([bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1402657),
  [bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1460819),
  [public-pointer-events](https://lists.w3.org/Archives/Public/public-pointer-events/2025OctDec/0053.html)).
  Reading `mousemove` (as the repo does) is the safe path for look deltas.

### Switching between locked look and a free cursor

- Unlocked, the OS cursor is real: `clientX/clientY` are valid for picking, and `movementX` is still filled from
  `screenX` deltas, so hold-right-button-to-look works without lock. Because the delta is a screen-coordinate
  difference, it becomes zero once the cursor stops at a screen edge; there is no way to get more travel without lock
  ([spec](https://w3c.github.io/pointerlock/)). Accept that as the trade-off of cursor mode, and keep locked mode for
  standing/ghost wandering where unlimited yaw matters.
- Right-button look must `preventDefault()` on `contextmenu` (the repo does). Note "in Firefox, holding Shift while
  right-clicking bypasses the contextmenu event" ([MDN contextmenu](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)).
- Use `setPointerCapture` on the canvas during a right-drag so the drag survives leaving the canvas; capture cannot be
  set while pointer lock is active (`InvalidStateError`), so only do it in cursor mode
  ([Pointer Events spec](https://w3c.github.io/pointerevents/)).
- A clean switch is one `mode` derived from `pointerlockchange`: locked → `look`; unlocked → `cursor`. Entering `look`
  always comes from a click on the canvas (gesture + cooldown), entering `cursor` comes from Esc (browser) or
  `document.exitPointerLock()` (page, e.g. when a prompt opens). The page-initiated exit keeps the gesture exemption,
  so a re-lock right after a prompt closes can be automatic in the spec and in Chrome
  ([spec](https://w3c.github.io/pointerlock/), [pointer_lock_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/pointer_lock_controller.cc)).

## 2. Picking in three.js

- `Raycaster` defaults: `near = 0`, `far = Infinity`, `layers = new Layers()`, `params.Mesh = {}`.
  `setFromCamera(coords, camera)` takes NDC (`-1..1`), sets the origin from `camera.matrixWorld` and the direction by
  unprojecting `coords`; `intersectObjects(objects, recursive = true)` sorts by distance. Per object it checks
  `object.layers.test(raycaster.layers)` before calling `object.raycast`
  ([Raycaster.js r186](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/core/Raycaster.js)).
- Centre ray under pointer lock: `setFromCamera(new Vector2(0, 0), camera)` is exactly the crosshair; with a free
  cursor use `((clientX - rect.left) / rect.width) * 2 - 1` and `-((clientY - rect.top) / rect.height) * 2 + 1`
  (Threlte's default compute does the same with `offsetX/offsetY` and a `ResizeObserver`)
  ([defaults.svelte.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/defaults.svelte.ts)).
- `Mesh.raycast` first tests the world-space bounding sphere, then the local bounding box, then triangles; for
  `FrontSide` materials it calls `ray.intersectTriangle(..., backfaceCulling = true)`, so a `PlaneGeometry` seen from
  behind is not hit ([Mesh.js r186](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/objects/Mesh.js)).
  The repo's cards have a front and a rear plane, so one of the two always faces the camera; picking the group
  (`intersectObject(group, true)`) hits whichever is visible. Flat cards on the table are hit reliably because the
  test is exact triangle intersection, not a thickness; the ray is transformed into local space by the inverse
  `matrixWorld`, so rotation is handled ([Mesh.js](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/objects/Mesh.js)).
  A slightly larger invisible `BoxGeometry` proxy would only be needed for a fatter hit area.
- `Sprite.raycast` does intersect (two triangles in view space), so name labels and bubbles are pickable by default
  ([Sprite.js r186](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/objects/Sprite.js)). Put them on a
  layer the raycaster does not test, or set `sprite.raycast = () => {}`. "Objects must share a layer with the camera
  to be rendered" and "Raycaster has a layers property used to filter objects"
  ([three.js Layers](https://threejs.org/docs/#api/en/core/Layers)); enabling an extra layer on card meshes keeps
  them rendered by the default camera (layer 0) while `raycaster.layers.set(CARD_LAYER)` restricts picking.
- Performance: ~40 cards × 2 planes × 2 triangles with sphere/box rejection is trivial; pass the flat list of card
  meshes with `recursive = false` rather than the whole scene. Only raycast on input, coalesced to one test per
  animation frame; Threlte's plugin does the same ("First move this frame — process immediately", then a rAF for
  coalesced moves) ([setupInteractivity.svelte.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/setupInteractivity.svelte.ts)).
  Browsers already coalesce `pointermove` per frame ([MDN getCoalescedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)).
  Under lock, the camera moves while the mouse is still, so the centre ray must be re-tested each frame in `useTask`
  (cheap), not only on `mousemove`.
- Hover dedupe: keep the last hovered card id; emit enter/leave only on change. Threlte derives
  `pointerover/out/enter/leave` the same way, by diffing a `hovered` map
  ([setupInteractivity.svelte.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/setupInteractivity.svelte.ts)).

### Threlte `interactivity()` vs hand-rolled

- The plugin is enabled by calling `interactivity()` in a component inside `<Canvas>`; it supports `onclick,
  oncontextmenu, ondblclick, onwheel, onpointerup, onpointerdown, onpointerover, onpointerout, onpointerenter,
  onpointerleave, onpointermove, onpointermissed`, offers `compute` (custom ray), `filter` (hits), `target` (DOM element,
  default `useDOM().dom`) and `enabled`; events carry `intersections`, `ray`, `camera`, `pointer` (NDC), `nativeEvent`,
  `stopPropagation` ([docs](https://threlte.xyz/docs/reference/extras/interactivity),
  [types.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/types.ts),
  [context.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/context.ts)).
- It registers objects through `<T>` props: an object becomes interactive when one of those handler props is a
  function on the `<T>` that created it ([plugin.svelte.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/plugin.svelte.ts)).
  The repo builds cards imperatively and mounts them with `<T is={g}>`, which fits (`<T is={g} onclick={...}>`), but
  hover/click via DOM `pointer*` on the canvas breaks under pointer lock: `clientX/offsetX` freeze
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)), so the crosshair case needs a custom
  `compute` that sets `pointer` to `(0, 0)` and calls `setFromCamera`, and the plugin still only raycasts on DOM
  events, not when the camera turns ([setupInteractivity.svelte.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/setupInteractivity.svelte.ts)).
- Dependency cost: `@threlte/extras@9.21.1` has peers `svelte >= 5`, `three >= 0.160` (matches `@threlte/core@8.6.0`)
  but installs `camera-controls`, `three-mesh-bvh`, `troika-three-text`, `three-perf`, `three-viewport-gizmo` and
  `@threejs-kit/instanced-sprite-mesh` as hard dependencies ([npm registry](https://registry.npmjs.org/@threlte%2Fextras),
  [package.json](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/package.json)). ESM imports
  tree-shake the bundle, but the install and lockfile grow for one ~60-line feature. Pin `^9.21.1` if adopted.
- Verdict: not worth it here. A hand-rolled raycaster is smaller than the `compute` workaround and runs from
  `useTask`, which the lock mode needs anyway.

## 3. Dragging and throwing a card

- Pointer capture: on `pointerdown` over a card call `canvas.setPointerCapture(e.pointerId)`; "subsequent events for the
  pointer will be targeted at the capture element until capture is released", and it is released implicitly after
  `pointerup`/`pointercancel` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture),
  [spec](https://w3c.github.io/pointerevents/)). Supported since Chrome 55, Firefox 59, Safari 13
  ([BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json)). This only applies in cursor
  mode (lock forbids capture, see above); in lock mode "drag" is: press on the crosshair card, move the camera, release.
- Mapping the cursor to the table: `Ray.intersectPlane(plane, target)` returns the point or `null`; a `Plane(normal,
  constant)` with `normal = (0, 1, 0)` and `constant = -TABLE_TOP` is the table surface
  ([three.js Ray](https://threejs.org/docs/#api/en/math/Ray)). Use `raycaster.ray` after `setFromCamera`, so the same
  code serves both modes. Lift the dragged card a few centimetres above the plane and move its `userData.tp` there;
  the existing per-frame lerp in `World.svelte` gives the smoothing.
- Release velocity: keep the last ~5 `pointermove` samples `{t, x, z}` (table-plane coordinates) and divide the
  displacement between the oldest and newest by their time span; `getCoalescedEvents()` can add intermediate samples
  in Chrome 58+, Firefox 59+, Safari 18.2+ ([BCD api/PointerEvent.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/PointerEvent.json)).
  Only the direction and a "was it a flick" threshold matter, because the landing spot comes from `throwSpot()`.
- Throw-to-target: on release, if the plane point is over the table (radius test against the table centre) or the
  flick points at the table, call `table.play(id)`; the snapshot then sets the seeded target and the lerp flies the
  card. A small arc is a per-frame add to `y` proportional to `sin(pi * progress)`. If the release is outside the
  table, restore the hand target from `layoutCards`.
- Threlte's plugin has a `clickDistanceThreshold` of 8 px to tell click from drag
  ([context.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/interactivity/context.ts));
  the same threshold separates "click to play" from "drag" here.

## 4. Tooltips anchored to a 3D card

- DOM projected: `Vector3.project(camera)` "projects this vector from world space into the camera's normalized device
  coordinate (NDC) space" (`matrixWorldInverse` then `projectionMatrix`)
  ([Vector3.js r186](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/math/Vector3.js)); pixels are
  `x * w/2 + w/2`, `-y * h/2 + h/2`, exactly what Threlte's `<HTML>` does in `defaultCalculatePosition`, applied as
  `translate3d(...)` each frame from a `useTask` on the render stage
  ([HTML utils.ts](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/components/HTML/utils.ts),
  [HTML.svelte](https://raw.githubusercontent.com/threlte/threlte/main/packages/extras/src/lib/components/HTML/HTML.svelte)).
  Hide when the point is behind the camera (`z > 1` after projection). Pros: real text, CSS theme, i18n via the same
  Svelte strings as the HUD, screen readers. Cons: one DOM write per frame; occlusion needs an extra raycast (Threlte's
  `isObjectVisible` does `setFromCamera` + `intersectObjects(occlude)` and compares distances).
- `THREE.Sprite` with a `CanvasTexture` (current labels): lives in the scene, scales with distance, no per-frame DOM.
  Cons: text is rasterised per string (re-render on language/theme change), no CSS, and sprites are raycastable, so
  they must be excluded from picking ([Sprite.js](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/objects/Sprite.js)).
- `@threlte/extras <HTML>`: mounts a sibling of the canvas (needs a positioned parent), supports `occlude`, `center`,
  `distanceFactor`, `pointerEvents`, `portal`; `occlude="blending"` "requires canvas with pointer-events: none"
  ([docs](https://threlte.xyz/docs/reference/extras/html)). Same dependency cost as above.
- Keeping it out of the way of picking: give the tooltip `pointer-events: none` so it is "not the target of pointer
  events" and events "go through the element and target whatever is underneath"
  ([MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)); raycasting itself is
  unaffected by DOM, only DOM event targeting is. Under lock nothing changes: the tooltip follows the crosshair card.

## 5. Keyboard parity and focus

- A focused `<button>` is activated by both keys: "Space: Activates the button. Enter: Activates the button"
  ([WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/button/)). "Most browsers do give focus to a button being
  clicked, but Safari does not, by design" ([MDN button](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)).
  So after a HUD click in Chrome/Firefox the next Space (bounce) or Enter (play) would re-fire the button. Fix: call
  `(e.currentTarget as HTMLElement).blur()` in the button's click handler, or give HUD buttons `tabindex="-1"` and
  focus the canvas; also ignore game keys when `document.activeElement` is an input. `blur()` is the documented
  inverse of `focus()`, which makes an element "the element that will receive keyboard and similar events by default"
  ([MDN focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)).
- Held keys: `KeyboardEvent.repeat` "is true if the given key is being held down such that it is automatically
  repeating" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat)); `input.ts` already
  filters Space with it.
- HUD layering: make the overlay `pointer-events: none` and each button `pointer-events: auto`; "pointer events
  targeted at descendants (that don't set pointer-events to none) will still trigger" and elements with `none` "will
  still receive focus through sequential keyboard navigation using the Tab key"
  ([MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)), so Tab (used to cycle seats,
  with `preventDefault`) stays safe. While locked the cursor is hidden and clicks go to the lock element, so the HUD is
  effectively keyboard-only; while unlocked the buttons work and the canvas beneath still gets picking events.

## 6. Browser differences that matter on desktop

- Pointer lock exists in Chrome 37+, Firefox 50+, Safari 10.1+ (macOS); promise return Chrome 92+, Safari 18.4+
  ([BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json)). WebKit only fixed
  `requestPointerLock` to return a Promise in Safari Technology Preview 209
  ([WebKit release notes](https://webkit.org/blog/16296/release-notes-for-safari-technology-preview-209/)).
- `unadjustedMovement`: Chrome 88 (no Linux), Firefox 152 (Android rejects), Safari 18.4 (macOS only, via NSEvent
  unaccelerated deltas) ([BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json),
  [Bugzilla 2037802](https://bugzilla.mozilla.org/show_bug.cgi?id=2037802),
  [webkit-changes](https://www.mail-archive.com/webkit-changes@lists.webkit.org/msg212018.html)).
- Re-lock after Esc: Chrome has the 1250 ms cooldown plus a gesture; Firefox and Safari need the gesture only
  ([pointer_lock_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/exclusive_access/pointer_lock_controller.cc),
  [PointerLockManager.cpp](https://searchfox.org/mozilla-central/source/dom/base/PointerLockManager.cpp)).
- `movementX` units differ per browser/OS/zoom ([w3c/pointerlock#42](https://github.com/w3c/pointerlock/issues/42)).
- `pointerrawupdate`: Chrome 77+ (secure context since 142), Firefox 148+, not in Safari
  ([BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Element.json)); not needed for cards.
- Firefox on Wayland historically had erratic lock deltas ([Bugzilla 1598967](https://bugzilla.mozilla.org/show_bug.cgi?id=1598967),
  [1680397](https://bugzilla.mozilla.org/show_bug.cgi?id=1680397)); a cursor mode that needs no lock is the fallback.
- Safari does not focus buttons on click ([MDN button](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)),
  so the blur-after-click fix is a no-op there, which is fine.

## What this means for the repo

Recommended minimal approach, without `@threlte/extras`:

1. One `Raycaster` in a small `scene/pick.ts`, restricted to a `CARD_LAYER`; card meshes get that layer enabled and
   sprites never do. It takes an NDC point: `(0, 0)` in lock mode, the cursor in cursor mode. `World.svelte` calls it
   from `useTask` (lock mode, camera moves) and from a rAF-coalesced `pointermove` (cursor mode).
2. A `mode` in `input.ts` derived from `pointerlockchange`: `look` while locked (current behaviour plus crosshair
   picking and click-to-play), `cursor` while unlocked (hover, click, drag, right-button look through `movementX` with
   pointer capture). Re-lock only from a canvas click; a page-initiated `exitPointerLock()` when a prompt opens keeps
   the gesture exemption.
3. Tooltip as a DOM node in the HUD with `pointer-events: none`, positioned by `project()` each frame; keep the existing
   sprites for names and bubbles (excluded from the raycaster).
4. Drag ends on the table plane; `table.play(id)` then hands the flight to the existing seeded target + lerp.

### Raycaster hook (`scene/pick.ts`)

```ts
import * as THREE from 'three';
import { TABLE_TOP, type CardGroup } from './builders';
export const CARD_LAYER = 1;
const ray = new THREE.Raycaster(); ray.layers.set(CARD_LAYER);
const ndc = new THREE.Vector2();
export const TABLE_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_TOP);

/** meshes of all cards, flat, once; each mesh has layers.enable(CARD_LAYER) */
export function pickable(cards: CardGroup[]) { return cards.flatMap((g) => g.children as THREE.Mesh[]); }

/** e === null → crosshair (pointer lock). Returns the card group under the ray, or null. */
export function pickCard(cam: THREE.Camera, meshes: THREE.Mesh[], canvas: HTMLElement, e: { clientX: number; clientY: number } | null) {
  if (e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  else ndc.set(0, 0);
  ray.setFromCamera(ndc, cam);
  const hit = ray.intersectObjects(meshes, false)[0];
  return hit ? (hit.object.parent as CardGroup) : null;
}
/** where the current ray meets the table, for dragging */
export function tablePoint(out: THREE.Vector3) { return ray.ray.intersectPlane(TABLE_PLANE, out); }

/** enter/leave only on change */
let hovered: CardGroup | null = null;
export function updateHover(next: CardGroup | null, on: (g: CardGroup | null) => void) { if (next !== hovered) { hovered = next; on(next); } }
```

### Mode switch (`input.ts` additions)

```ts
type Mode = 'look' | 'cursor';
let mode: Mode = 'cursor', rightHeld = false, moveQueued: PointerEvent | null = null;
const onChange = () => { mode = isLocked() ? 'look' : 'cursor'; rightHeld = false; ui.locked = mode === 'look'; /* menu logic as today */ };
const onPointerDown = (e: PointerEvent) => {
  if (mode !== 'cursor') return;
  if (e.button === 2) { rightHeld = true; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button === 0 && ui.hover) drag.start(e);                 // capture inside drag.start
};
const onPointerUp = (e: PointerEvent) => { if (e.button === 2) rightHeld = false; else drag.end(e); };
const onPointerMove = (e: PointerEvent) => {
  if (mode === 'look') { applyLook(e.movementX, e.movementY); return; }   // today's onMove
  if (rightHeld) { applyLook(e.movementX, e.movementY); return; }        // unlocked look; delta is 0 at screen edges
  if (drag.active) { drag.move(e); return; }
  if (!moveQueued) requestAnimationFrame(() => { const ev = moveQueued!; moveQueued = null; hoverAt(ev); });
  moveQueued = e;                                                        // one raycast per frame
};
// look mode: World.svelte's useTask calls pickCard(cam, meshes, canvas, null) every frame and updateHover(...)
// enter look only from a click: onClick = () => { if (mode === 'cursor' && !drag.active) resume(); }
// leave look from the page (prompt opens): document.exitPointerLock() — keeps the re-lock gesture exemption
```

### Tooltip anchor (HUD component, runs inside `<Canvas>` via `useTask`)

```ts
import { useTask, useThrelte } from '@threlte/core';
const { camera, size } = useThrelte();
const v = new THREE.Vector3();
let el: HTMLDivElement; let shown = $state(false);
useTask(() => {
  const g = ui.hoverCard, cam = camera.current;               // CardGroup or null
  if (!g || !cam) { shown = false; return; }
  v.setFromMatrixPosition(g.matrixWorld).project(cam);
  if (v.z > 1) { shown = false; return; }                     // behind the camera
  const { width, height } = size.current;
  el.style.transform = `translate3d(${(v.x + 1) / 2 * width}px, ${(1 - v.y) / 2 * height}px, 0) translate(-50%, -120%)`;
  shown = true;
});
// <div bind:this={el} class="tip" hidden={!shown} style="position:absolute; left:0; top:0; pointer-events:none">{label(ui.hoverCard)}</div>
```

Everything here stays inside `@threlte/core` + `three`, keeps the sprites for the things that should live in the world,
and puts the cross-browser risk (lock cooldown, delta units) behind one `mode` and one user sensitivity setting.

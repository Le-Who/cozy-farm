# Opt-in Guest Book button surface: implemented, not released

Base: local `6df90d1`, preserving the semantic checkpoint and the `e71e473` / `9967131` disposition. This implements the preferred retained-button interaction, not the unsafe remounting select. It does **not** replace `main.ts`, the live panel renderer, art, CSS, domain, audio, reward rules, save schema or storage.

## Real host contract

`GuestBookButtonSurface` is an explicitly constructed, unstyled off-main module. Its constructor requires `enabled: true`; no production source imports it. All resident/activity/memory buttons, Back and exact command buttons carry their real `data-action` before insertion. Subsequent renders retain every control node, updating text, hidden/disabled state and exact tokens only. No native select or post-insertion action conversion is involved.

The host must configure its **one existing** capture installer with:

```ts
installActionClickGuard(appRoot, { guestBookButtons: true })
const book = new GuestBookButtonSurface({
  enabled: true,
  root: guestBookRoot,
  farm: () => farm,
  active: () => dialog.open && panel === 'neighbor-visits',
  dispatch: command => runExistingVisitBranchOnce(command),
})
// In the ONE existing delegated handler, after capture:
if (book.click(event)) return
// In header Back / Escape / cancel / Alt+Left, before parent navigation:
if (book.back(event)) return
```

`runExistingVisitBranchOnce` is illustrative host code, not a new domain executor or a supplied production integration. It must preserve the existing panel-open, location, serial, reducer, route and persistence checks. Do not synthesize clicks or install a second guard. Successful actions remain the responsibility of that existing handler.

The capture option adds only `guest-book-choice` and `guest-book-back` to that installed guard's local recognition. It is snapshotted at installation. The production call, global `guardedActions` and `isGuardedAction` default classification are unchanged. No timer/cooldown/publication layer is added. Omitting the explicit host option is deliberately **not safe** for button-to-invite crossing; the harness keeps that negative control visible rather than pretending the renderer itself owns capture.

`click` consumes owned disabled/hidden/stale/mismatched/wrong-panel specimens without passing them to an unrelated live branch. Valid commands resolve only through `GuestBookView` against current farm state. Choices and nested Back call no domain handler. Root Back returns false for existing parent history; repeat Back is consumed. Close is still Close, never Finish.

Use `snapshot()` / `restore(snapshot, optionalFocus)` only for local panel history. This is not FarmState. `render()` is passive and never calls focus, scroll or persistence. Explicit selection/Back may restore focus with `preventScroll`; restore does so only when explicitly given a focus target.

## Concrete evidence

- `button-surface-harness.mjs`: 10 scenarios pass using actual DOM propagation, the actual surface and actual capture installer. No private guard-set injection. Covers six options in two choices, one exact invite, all recorded memories, retained nodes, zero passive writes, guard opt-in negative control, same-gesture crossing, held Enter/Space, four Back paths, local history/focus/scroll, eligibility vs readiness, stale day/revision/serial, both replies/no reply, Close, malformed/hidden/wrong-panel controls.
- With the fixture lane's `qa/fixture.mjs`, the tenth case earns its starting state through 119 public reducer commands and compares all six full oracle states for carrot/quiet then beetroot/curious. The original carrot/quiet memory remains exact. This is DOM events plus public reducers, **not native farming**.
- `button-native.mjs`: trusted Chromium pointer/keyboard runs at **568×320, 390×700, 1280×800**. Each proves Finn locked / Bea eligible, exact Finn-orchard snapshot and focus restore, local Escape ownership, passive farm/storage/focus/scroll stability, real held Enter blocked until keyup, and exactly one invite → hen introduction → quiet reply. Every control node survives. No external requests or page errors.
- 30 focused tests and all 1,472 existing suite tests pass; full suite/build results are recorded in the parent evidence directory. `npm run build` includes Russian audit and TypeScript. No dependency/package change.

The isolated native host intentionally does not persist domain actions; its accepted-domain-action count is separate from its storage spy. This does **not** claim live save-write parity or production panel-history integration. The other lane's real production trace owns that evidence.

## Reproduce with existing tools only

From `game/` (the fixture module is from the companion fixture lane):

```sh
GUEST_BOOK_DOM_MODULE=file:///path/to/existing/jsdom/lib/api.js \
GUEST_BOOK_EARNED_FIXTURE=file:///path/to/qa/fixture.mjs \
node prototypes/guest-book/button-surface-harness.mjs

GUEST_BOOK_EARNED_FIXTURE=file:///path/to/qa/fixture.mjs \
PLAYWRIGHT_MODULE=/path/to/existing/playwright/index.mjs \
CHROMIUM_PATH=/path/to/existing/chrome-headless-shell \
GUEST_BOOK_QA_OUTPUT=/path/to/evidence \
node prototypes/guest-book/button-native.mjs
```

## Release hold remains explicit

This is a **functional interaction surface**, not an approved visual layout. Inspected unstyled screenshots show the CTA below the fold at 568×320 and default browser-sized controls. They do not meet the layout/44px acceptance gate, are named `unstyled-not-approved`, and must not be passed off as mockups or final UI. No native touch or assistive-technology proof is claimed. Approve the concrete visual target before real main/panel-history integration, then rerun these gesture cases on the final assembled layout and real save/route checks. No GitHub write, release, package install, paid service or generation was used.

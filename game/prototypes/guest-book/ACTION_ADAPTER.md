# Guest Book action bridge: isolated, HOLD for integration

Base: `c663f252eb723c070b16f15646f9f54a1f3fb759`, whose parent is live `3248e4f51812209194fc672b6211f69913f173cc`.

This adds an opt-in adapter and DOM harness only. Production `main.ts`, renderer, `action-click-guard.ts`, domain, storage and CSS remain byte-identical. The adapter is not imported by production and installs no listeners. It is **not ready to mount as the final Guest Book**.

## Narrow host contract

- One `GuestBookView` and one adapter; view owns only ephemeral selection. `Host.active()` must mean the live/open `neighbor-visits` panel. `Host.farm()` supplies current farm, never a captured old snapshot.
- The host's existing `installActionClickGuard(root)` remains the only capture-time gesture owner. Call `adapter.click(event)` from the ONE existing delegated handler after capture. If consumed, do not also execute another branch. `dispatch(command)` invokes the existing route/reducer once; no synthetic click, bubbling attribute conversion, parallel listener or second guard.
- Real command controls must carry matching `data-action="visit-*"` plus the prototype command/context attributes **in the HTML before DOM insertion**. The resolver checks current activity/serial/phase/revision and enabled status. Detached, disabled, mismatched or wrong-panel controls cannot dispatch.
- Proposed exact choice/back IDs: `guest-book-choice`, `guest-book-back`. They are constants/proposals only, NOT added to production's global guarded set. They need capture recognition before a button-driven visual implementation is integratable. Do not alias read-only choices to unrelated transaction IDs.
- Read-only button or select choices call `view.choose` and request explicit focus restoration. Selection, memories/rules and Back never call a farm action or save. Native `select` remains a read-only choice, not an invitation.
- Call `adapter.back(event)` before existing parent navigation for header Back, native cancel/Escape and Alt+Left. A consumed nested Back returns to the exact invitation or actual active guest; false falls back to existing history/close. Preserve the existing key-repeat prevention before this call. Close is not Finish. Actual guest identity always wins over a remembered invitation selection.
- Parent history stores only `view.snapshot()`; restoring uses `view.restore()`. The future host must restore source focus/scroll on explicit return, never on passive redraw. No new domain cooldown is invented.

## What the harness actually proves

The harness executes real DOM event propagation through **the current capture installer** and one delegated host callback. Its source is transpiled in a private VM only to provide that DOM's `Element` realm. A second test variant appends exactly the two proposed IDs to the private set; it does not edit the product file or duplicate the guard algorithm.

Before parsing each test specimen, test-only string transformations add the outset `data-action` attributes. The actual prototype renderer is unchanged, and its original inert markup cannot dispatch through this adapter.

Nine scenarios cover:

1. All six exact options, associated native select label, one invitation, read-only selection and restored focus.
2. Existing command → freshly rendered command crossing click is blocked by the real capture guard.
3. Enter/Space ownership survives command redraw until keyup.
4. Choice-button → fresh invite is unsafe with the unchanged set; the two proposed IDs prevent it.
5. Proposed choice/Back buttons preserve held-key ownership without another guard.
6. **HOLD witness:** select pointerdown → change/remount → pointerup/click retargeted to a fresh invite is still executable. The two button IDs and select focus restoration do not prevent it.
7. Existing active guest beats preview; both replies are exact, old phase/node/context is rejected, consumed commands do not fall through.
8. Button/Escape/cancel/Alt+Left return locally before parent Back; no guest completion or save.
9. Close leaves guest alive; wrong-panel and original inert controls do not execute.

The HOLD witness is an adversarial DOM sequence establishing that the bridge does NOT enforce the required invariant. It is not a claim that a particular native browser necessarily retargets a select popup that way. A passing HOLD test means the missing invariant was detected, not that shipping is approved.

## Safe correction options after the separate visual checkpoint

**Preferred simple route:** approve a compact activity-button layout first. Emit named `data-action` attributes from the outset; approve only the two concrete guard-set entries. Then the tested existing capture algorithm owns both selection and subsequent fresh CTA gestures. No generic global action schema is needed.

**If native select is retained:** retain the actual select and its focus; do not replace/move a mutating CTA during the same pointer gesture. Establish and test a host render/release invariant covering pointerdown/change/pointerup/click/cancel and keyboard selection. Focus restoration alone is insufficient. Do not add a parallel cooldown or silently broaden the global guard here.

No correction option is implemented by this artifact. After a visual target and one of these choices are accepted, integrate the host hooks, repeat gesture tests against the final actual markup, then run a narrow native gate. Until then: **HOLD, off-main only**.

## Reproduce

The code/tests use the pre-existing Node/TypeScript environment. The optional DOM harness uses already installed jsdom; it adds no package dependency or installation:

```sh
# From game/; module URL can point to an existing local jsdom installation.
GUEST_BOOK_DOM_MODULE=file:///workspace/scratch/30c16872133b/repo/node_modules/jsdom/lib/api.js \
  node prototypes/guest-book/action-adapter-harness.mjs
node --test tests/guest-book-prototype.test.ts
./node_modules/.bin/tsc --noEmit
```

The fixture is the existing restored-valid synthetic prototype setup, not an earned/native progression. No browser, visual-layout acceptance, audio change, native focus claim, external service or push is included.

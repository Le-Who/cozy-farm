# Guest Book interaction disposition, off-main

Base: `e71e473` (the held adapter checkpoint). One opt-in unstyled DOM specimen/test; no production code, renderer, CSS, native browser or broad guard changes.

## Decision

**Recommend upfront activity buttons.** It is the simpler interaction contract: each exact activity button and the invitation CTA exist before input; node identity never changes. Selection uses the existing capture algorithm with the two previously proposed concrete keys (`guest-book-choice`, `guest-book-back`). No additional publication state, timer, second guard or global action schema is needed. The actual guard source remains unchanged; the test adds only those keys to its private VM set.

This is an interaction decision, NOT approval of the six-button visual arrangement. The future mockup may use resident groups or the existing two-step choice, but must retain all exact IDs/labels, eligibility, stable nodes and a distinct explicit invitation.

## Two modes in the one specimen

1. **Buttons:** current choice is applied on the ordinary click, not pointerdown. The old executable token becomes stale; the same CTA node receives the current exact token. Existing capture ownership blocks the second click at 180 ms after a 100 ms selection and held Enter through replacement targets. A separate gesture at 800 ms can invite once. No markup remount occurs before or after release.
2. **Retained native select:** the actual select, its options and the same CTA node remain present throughout. A change updates only the read-only view, label and truthful eligibility. It deliberately leaves the CTA executable token stale/pending. Pointerup/cancel merely releases selection ownership; it does NOT publish an invitation. Only a distinct pointerdown on the CTA, non-repeat activation key on the focused CTA, or focused assistive click after release publishes the current token. Then the existing guard and resolver/domain own the actual invitation. The trailing popup click without a new CTA origin cannot spend/execute.

The select mode therefore needs a **local pending-token/origin handoff**, not just retained DOM identity. This is confined to the specimen; it is not added to the adapter or any production reader. Do not pick the select visually and omit that contract. Buttons avoid this extra state and are preferred.

## Assertions, not visual claims

The same adversarial change → trailing click sequence that executed an invite in the prior HOLD harness now yields **0 invitations** in both modes. A fresh deliberate CTA gesture yields exactly one selected `beaFlock`, serial 1. All node identities remain exact throughout. Old selection/day/serial tokens are rejected; repeat activation adds nothing. Enter ownership, release, focused assistive activation and a locked Finn → eligible Bea select transition are also checked. Browsing/choice phases keep the entire farm unchanged.

The test uses the existing prototype's restored-valid synthetic fixture, actual `GuestBookView`, invitation reducers, and actual `installActionClickGuard` under jsdom. It is not an earned progression or native popup/assistive-technology proof. There are no timers or arbitrary delays in the specimen's logic; timestamps exercise the guard's existing 500 ms rule only.

## Future visual/native gate

- Approve a concrete layout separately, then register the two exact guard keys only for the chosen button controls. Keep real `data-action` attributes in initial markup; no late conversion or synthetic redispatch.
- Preserve nodes/footprints and selection focus; never introduce a mutating control beneath an unfinished gesture. Do not use this unstyled specimen as production rendering.
- If retaining select, native-test real popup pointer/touch dismissal, cancellation, keyboard and assistive activation, including focus behavior. The prototype accepts focused assistive clicks; AT activation that does not first focus the CTA is not yet claimed supported. Do not ship that limitation without native resolution.
- Integrate after these gates using the existing adapter's single delegated host/Back contract. Main/renderer/guard/store remain untouched by this artifact.

Reproduce from `game/` using already installed jsdom (no package change):

```sh
GUEST_BOOK_DOM_MODULE=file:///workspace/scratch/30c16872133b/repo/node_modules/jsdom/lib/api.js \
  node prototypes/guest-book/interaction-disposition.mjs
```

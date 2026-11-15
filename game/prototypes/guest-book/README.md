# Home Guest Book: reversible semantic prototype

Base: `3248e4f51812209194fc672b6211f69913f173cc`.
Status: controller/semantic review only. **Not connected to `main.ts`**, not a replacement for the live renderer, no styles/assets/audio/save/domain changes. Removing the two new source modules and their test removes the prototype completely.

## Reference decision

Inspected `cozy-menu-clarity-20261115/menu-reference-abc.png` and `menu-target-ab.png`. They depict the kitchen and Bea/Finn services in the town. They show useful existing visual vocabulary, but **do not depict or approve a Home Guest Book layout**. No new ImageGen or external call was made. The HTML here is a semantic specimen, not an approved visual mockup. Do not publish it as the finished menu.

## Boundary

- `GuestBookView` owns only resident/activity/page/memory selection and a transient revision. `snapshot/restore` are intended for the existing panel-history stack, never FarmState/localStorage. Restore copies only validated selection fields and cannot supply an executable action.
- `current(farm)` recomputes exact invitation eligibility and current readiness. Missing harvest/baking supplies is informative, **not an extra invitation gate**. The existing `canInviteNeighbor` rule and ledger limit remain authoritative.
- `choose` and `back` update only local selection. Rules/memories Back returns to the exact selected invitation, or to the active guest. At the visit root `back()` returns false so the host can use its existing parent Back/Close. No Back implicitly ends a visit.
- All six activities remain reachable in at most two choices: resident, then that resident's activity. One selected detail and one explicit invitation; locked activities remain discoverable. All recorded memories remain available through a named mode and labeled selector.
- Active visit controls use its real activity/serial, not the invitation preview. Keep every eligible hen, both distinct replies, leave-without-reply and close-without-ending. A repeat visit shows its current observation without replacing the original saved memory.
- `resolve` accepts only a currently displayed enabled action with the current transient revision/day/location/ledger/observation context. It returns an existing action/value pair, **never executes it**. Production domain handlers must still validate it. A stale selection, old day, old serial, earlier observation phase, or forged action fails closed.
- `renderGuestBookPrototype` uses existing semantic tokens only. Its `data-guest-*` attributes are deliberately not `data-action`, so injecting a specimen into the current UI cannot accidentally execute a live transaction. No listener or save/focus/scroll operation is installed.

## Tested now

`node --test tests/guest-book-prototype.test.ts tests/neighbor-visits.test.ts tests/cooking-return.test.ts`

The focused tests use the existing neighbor-visits test's restored valid synthetic setup, **not a newly earned native progression**. They execute actual public invitation, ordinary work, introduction, reply/finish, rest, travel and restore reducers. Seven new scenarios cover all six options, exact gate/readiness distinctions, root/nested Back, restored selection, invalid/stale requests, six first memories, repeated visits, both reply choices, no reply, read-only rendering/selection, escaped fields and rendered-token resolution. Existing neighbor-visit/domain and cooking-return tests are regression controls. Type checking, Russian-text audit and production build pass. Existing tracked files remain byte-identical.

No native focus, pixel fit, touch, held-key gate or persistence adapter claim is made. Passive projection does not even have DOM or storage access; the future host adapter still needs its own end-to-end checks.

## Next visual/integration gate, not done here

1. Prepare a Guest Book-specific realizable visual reference using the existing approved art. Old kitchen/service boards alone are not approval. No new paid/generation action is included in this prototype.
2. At 568×320 show the selected resident/activity, genuine current condition and a complete minimum 44px primary together without scrolling or horizontal overflow. Also verify 390×700 and 1280×800. Clearly named full-width controls expose memories/rules; no tiny triangle and no hidden unique action.
3. Integrate only at `case 'neighbor-visits'`, local view state/PanelVisit capture+restore, and a scoped read-only choice adapter. Feed resolved commands into the existing `visit-*` handlers without weakening the panel-open, gesture/repeat, current serial, location or reducer checks. Never dispatch arbitrary action fields from storage. Do not add persistent selection fields.
4. Preserve the invitation choice while visiting the workshop or a source and returning; focus/scroll restore on explicit Back only. Passive redraw must not move focus or scroll. Browsing, selector changes, rules, memories, Back and Escape produce zero writes.
5. Native exact-action parity for locked / eligible / active-pending / active-observed / repeat / six-memory states. All six activities reachable in at most two choices, full labels, existing location routes preserved. One real accepted invitation and finish per gesture; held Enter/double-click/stale buttons cannot repeat them. Sleep/travel still ends an active visit once and keeps the same memory ledger.

No production integration, commit, browser session, new service, generation, charge or push occurred in this prototype step.

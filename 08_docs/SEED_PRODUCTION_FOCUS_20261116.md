# Keep keyboard focus in hotbar seed production

Frozen stock base: `3072fdadc59d35ede03d96b82dece31904ff73ac` (supplied equivalent of remote `f488f429`). Isolated from the desktop receipt candidate `ad27c23`; no receipt or visual-layout changes are included. This is an unpublished focus fix, not a production release.

## Cause and intended flow

After successful `save-crop-seeds`, the existing redraw replaces the exchange button with a new quote token. Generic `focusKey()` includes that token, so it cannot match the prior button and falls back to Close. The prior actual native investigation established this behavior; its flag-off result and screenshot are retained in `evidence/baseline` rather than rerunning an already confirmed baseline.

A player who focused the hotbar's production control should remain in that operation if another ordinary product is available. After the last ordinary product, the new seeds are usable and the existing sow selector is the relevant next control. Focus does not choose, plant, produce, or buy anything.

## Narrow implementation

Only after a successful conversion in the hotbar Seeds panel, and only when that control owned focus before the action:

1. Find the newly rendered enabled seed-production button with the current exact quote token.
2. If disabled or absent, choose the enabled current sow selector with its exact current token.
3. If neither is valid, use the matching read-only crop packet if available; otherwise keep the host's existing fallback.

The helper returns an existing control; the host applies `focus({preventScroll:true})`. It never copies or modifies a token, creates controls, clicks, dispatches an event, or saves. The existing domain guard, `perform()` call, gesture guard, rendering, labels, stock, rare-product logic, and quantities are unchanged. Inventory's seed tab and all other panels retain their old behavior.

## Native acceptance

Real main at bare `/`, isolated contexts, existing Chrome for Testing, trusted inputs:

| Scenario | Initial ordinary carrots | Focus after one conversion | Native writes | Held Enter repeats blocked |
| --- | ---: | --- | ---: | ---: |
| 1440×900 desktop | 3 | fresh enabled `Получить 3 семени` | 1 | 4 |
| 568×320 compact | 1 | existing `Сеять морковь` | 1 | 4 |

The fixture begins with `createFarm()` and one public ripe-carrot harvest. The compact precondition uses two public seed-production calls before browser startup to leave the final ordinary product. These are explicit fixture preconditions, not browser actions or a user save.

In each viewport, 12 actual Tab presses reach the exchange. A native Enter keydown converts once. Four trusted repeat keydowns occur after a 650 ms pause, beyond the click guard's window; all are prevented by the unchanged held-key guard even with focus restored. Keyup followed by Tab moves on normally. No new selection, purchase, sow, sale, or second conversion occurs.

The complete save equals the reducer oracle. The old token is rejected without changing the save. The focused control remains enabled, 44 px high, and inside the content clipping boundary. Scroll stays exactly 0 on desktop and 247 px on compact. No CSS or DOM layout changes are introduced. The compact disabled-exchange explanatory text retains its existing scrolling; it is not hidden by this fix.

All native events are trusted; no page errors or external requests occurred. Screenshots: `evidence/native/1440-{before,after}.png` and `568-{before,after}.png`.

## Checks

- 17 existing seed-choice, seed-saving, and held-action tests pass.
- Four new focus-selection/host contracts pass. One initial source-inspection regex incorrectly treated equality as assignment; only those four tests were rerun after correcting the regex. Application behavior was not changed to satisfy that false assertion.
- Russian UI audit, TypeScript, and Vite production build pass; the existing large-bundle warning remains.
- Source hashes confirm seed domain/selection/UI/CSS, action guards, farm, Market grid, Guest Book renderer, and global stylesheet match stock exactly.
- No installation, paid tool, push, publication, or unrelated change.

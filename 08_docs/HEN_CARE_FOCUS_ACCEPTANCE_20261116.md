# Opened hen friendship: existing compact page, neutral result focus

Base: `3072fdadc59d35ede03d96b82dece31904ff73ac` (normal remote f488 equivalent). Independent of service-entry, Market, house, seed and cooking candidates. Not pushed or published.

## Actual opened experience, not a new layout

The current **Познакомиться → Дружба со стаей** screen already has one selected-hen page. It does not render repeated nested hen cards. At 1440×900, 360×640 and 568×320 the initial earned state exposes all four named choices, their friendship counts, selected name/stage/count, pet, walk and its lock reason, three stock-labelled treats, and the full named **Характер и правила** control without scrolling.

Native initial content is 417 px on desktop and 226 px in short landscape. The earlier same-day service-route packet provides the portrait control at 489 px, also fitting without scrolling. This scope does not claim to redesign that already working hierarchy.

## Remaining defect and bounded correction

Trusted hen selection 0 → 3 → 0 already preserves the focused selected choice and causes zero writes. However, a successful **Погладить** or **Угостить** disables its current button. The generic redraw fallback then moves keyboard focus to **Закрыть меню**, away from the hen and result.

This patch changes only that fallback:

- First preserve a fresh enabled button with the original identity, as before.
- Only for this panel and a completed care button belonging to the still-selected hen, use its existing read-only `<progress>`.
- The progress already has the accessible name `Дружба · Плюша`, current value and maximum nine. It gains `tabindex=-1`, not a new Tab stop, and a focus-visible outline.
- No activation, disabled-state change, token replacement, save or command is performed by the focus helper. A completed treat whose buttons disappear at full friendship uses the same neutral result target.
- Invalid/unrelated actions, a different selected hen, missing progress, or a still-enabled care control retain the existing fallback.
- Focus uses the existing `preventScroll:true`. No geometry, copy, handler, renderer, narrative, domain or save change.

Next Tab after pet reaches the available treat; after favorite treat unlocks walking, next Tab reaches the existing walk action. Enter on the focused progress does nothing. It never silently starts another care action or a walk.

This is an application focus patch in the isolated branch, not another DEV layout flag. Ordinary build compiles the fix locally; remote/production remains untouched.

## Complete existing choice/state inventory

| Choice or state | Existing behavior preserved |
| --- | --- |
| Named roster | Four current hens, fifth only after a legitimate hatch. Each carries name, points out of nine, and selected state. Selection changes only view state, never the farm/save. |
| Selected identity | Name, stage and numeric progress remain together. Stages at 0/3/6/9 and all current status text unchanged. |
| Pet | Once per hen per day; +1 friendship subject to cap. Already-petted action remains disabled with its current label. No automatic treat or feeding. |
| Three treats | Ordinary carrot, greens and apple, each with ×1 cost and actual stock. Zero stock disabled. One treat per hen per day; favorite +2, other +1, cap nine. Rare produce is never spent. |
| Favorite discovery | Unknown preference is not disclosed as known. A tried treat/favorite gets its current existing status; stock count updates after the one spend. |
| Treated today | All treat commands disabled and next-day status visible. No repeated spend. |
| Completed friendship | Nine points plus known favorite removes unnecessary treat spending and shows the existing completion note. Pet remains available on a later day. |
| Walk | Unlock at three points, home/scene availability, one companion at a time, existing other-hen/returning reasons. Start/finish/returning states unchanged. No added reward or cost. |
| Character and rules | Existing named 44 px summary, not a tiny unlabeled triangle. Full character/hint, learned favorite, earned notes, next threshold and care/walk rules remain keyboard reachable. |
| Back/close | Existing route and dismissal unchanged. Close simply stops being the unintended result-focus destination after successful care. |

## Earned native flow

The fixture is the same public-command-earned day-3 hatchery used by the service inspection: 36 successful commands from `createFarm`, restore validation after each, four hens, no fabricated resources, no user save. No mix is performed in the new care run; initial ordinary carrot stock is three and apple stock two.

Baseline at 1440×900 and 568×320:
1. Guide → coop → Познакомиться. All initial controls visible and at least 44 px.
2. Trusted Tab/Enter selects hen 3, then hen 0. Correct focused selection, zero writes.
3. Pet Плюша: exactly one canonical save, points 0 → 1, focus incorrectly Close.
4. Favorite carrot: exactly one further canonical save, carrot 3 → 2, points 1 → 3, favorite discovered, walk enabled; focus incorrectly Close.
5. Named notes open/close: earned first note present, no writes.

Candidate repeats that bounded flow at 1440×900 and 568×320, plus a 360×640 regression. After each care action:
- Focus is the existing progress, name `Дружба · Плюша`, value 1 or 3, maximum 9, fully in the visible content clip.
- Held Enter remains held past 650 ms with four repeat events; then a released/fresh Enter on progress. Neither causes a further save or action.
- Exactly one Tab reaches the remaining enabled treat or newly enabled walk.
- Complete farm equals the canonical `petChicken`/`treatHen` oracle. No change to feeding, money, timers or unrelated stock beyond those reducers.

A separate 360×640 pointer-click control confirms both care gestures still produce exactly their original two saves and the same neutral result focus. No external requests/page errors; all recorded inputs trusted. Physical touchscreen and screen-reader operation are not claimed.

## Geometry and existing limitation

All 14 matched desktop/short-landscape states have exactly identical copy, action/label/value/disabled tuples, content/command rectangles, scroll positions, full saves and write counts. The only intended difference is post-care focus and its outline. The portrait candidate retains the same compact hierarchy and visible result.

The known short-landscape dense favorite line still causes the bottom 3.59 px of the notes summary to lie below the initial clip. Keyboard Tab reveals that full named control with a 4 px scroll. Its separate existing fix is `04b3758` / `henDenseFit`; it is not duplicated or silently included here. No claim that this focus patch fixes that layout defect.

## Checks and source scope

- Eight focused checks pass: three new neutral-target/invalid-state/wiring tests plus the five existing friendship-view tests covering selection, stock/rarity, daily guards, walk states, completed friendship and fifth hen.
- Russian audit, TypeScript and normal production build pass. Existing large-chunk warning only.
- Canonical friendship renderer, companion logic, farm reducers and input guard remain byte-identical to base. `main.ts` changes one import and the scoped fallback; stylesheet adds only one outline rule.
- Application files: `src/hen-care-focus.ts`, `src/main.ts`, `src/hen-friendship.css`; test: `tests/hen-care-focus.test.ts`.

## Evidence

`baseline/` and `candidate/` have labelled actual screenshots for `friendship-initial`, `selected-3`, `selected-0`, `after-pet`, `after-favorite`, `notes-open`, `notes-closed`. `pointer/` has the compact pointer control. Existing same-day opened screenshots are preserved with their service-route source JSON. Results include exact saves, focus and geometry.

`qa/fixture.mjs`, `qa/native.mjs`, `qa/compare.mjs` reproduce the earned state and checks. `checks/` contains logs and exact comparison. No unrelated suite, recipe, Market, scene or economy loop was repeated.

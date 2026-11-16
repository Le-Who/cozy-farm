# Short-landscape task card: unblock the tomato bed

Base: `753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9`. Local, unpublished responsive HUD correction. No assets, camera/world/input changes, gameplay or save changes.

## Exact baseline

At 568×320, the upper-right tomato bed center projects to `(395.078, 85.062)`. `elementFromPoint` returns the task card. A trusted mouse click reaches that task, not the bed; the tomato stays ripe. This is a real blocked interaction, not merely visual overlap. The initial task happens to focus an empty bed and makes zero primary writes.

## Bounded correction

The existing island projection publishes its current left/right field edges through an optional presentation callback on view/resize updates. Camera math and pointer hit testing are unchanged. Main measures the top HUD's actual safe-area-aware bounds and height, chooses an available side rail of at least 96 px, and sets presentation variables. CSS moves only the short-landscape home field-view task card into that rail. It keeps the full task name and count, button action, accessible description, title and `J` shortcut. The decorative medallion is omitted there; no content/action is removed.

The card is below the measured header and inside `--left`/`--right` safe margins. A one-sided notch can select the left rail. There is no duplicated camera formula in application layout code. The native QA runner independently calculates the known projection to prove input reaches the intended target.

**Broader limitation:** when neither side provides 96 px of readable space, the old layout is intentionally retained, rather than shrinking the button or hiding/truncating its text. Extremely cramped/large bilateral-inset landscape layouts still need a broader HUD/scene-viewport design. This checkpoint fixes the demonstrated 568×320 issue without pretending to solve all possible screen geometries. Portrait and non-field/off-home presentation remain unchanged.

## Reproduce

From this worktree:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chrome-headless-shell \
TASK_QA_OUTPUT=evidence-final \
node game/prototypes/task-rail/native.mjs
```

The runner serves actual `main.ts`, blocks external requests and starts each isolated context from canonical, unmodified `createFarm()`. Baseline mode `TASK_QA_BASELINE=1` is only for the exact unmodified base checkout. Do not use it against the corrected source and call that a baseline.

Candidate cases: 568×320; 568×320 with actual emulated CSS safe-area insets (24 px left/right, 12 top, 16 bottom); a right-side notch (24 left, 44 right); 844×390; portrait control 360×640. It asserts full task text visibility, preserved `J`, all 16 bed centers reaching the canvas, no card/soil intersection, and card containment between top HUD and hotbar on landscape. Task click/focus and journal shortcut remain read-only. The exact formerly blocked tomato target is activated by trusted mouse or touchscreen input; the entire save must equal one public `workBed` call, with exactly one primary write and tomato stock +3. No direct reducer call is injected into the page.

The portrait card's existing 40 px height is intentionally unchanged; candidate landscape cards remain at least 44 px. No physical-device or screen-reader acceptance is claimed.

Focused tests: `field-hud`, `field-hint`, `basket-hotbar`, `bed-work-intent`; Russian audit, TypeScript and production build. Evidence lives beside the worktree in `evidence-baseline/` and `evidence-final/`.

## Default-safety and performance

This is intended as a default fix, not a query opt-in. Eligibility is Home + field view + landscape ≤900 px wide and <480 px high + at least 96 px free side space. CSS's matching short-landscape breakpoint ends at 479 px. The no-room fallback preserves the existing layout. The medallion is hidden only inside `[data-field-rail]`; other layouts keep it.

Projection notifications are memoized by field edges and viewport. A `ResizeObserver` reacts to actual header size changes; repeated measured HUD bounds do not rewrite styles. Unchanged animation frames neither notify the bridge nor measure/write its HUD. The native runner instruments an 800 ms idle animation interval in every candidate case: zero additional header layout reads and zero rail style writes. A regression test also exercises 100 unchanged camera updates.

Final recorded run passes all five cases, with all 16 bed centers unobstructed, all task text visible, and exactly one primary write for the trusted tomato harvest (+3), matching the complete public-reducer save. Task click and `J` navigation add zero writes. Forty recorded input events are trusted. No page errors or external requests. Twenty focused tests, Russian audit (250 files, 0 untranslated UI strings), TypeScript and production build pass.

Before/after layout pair: `evidence-baseline/568x320-initial.png` and `evidence-final/568x320-initial.png`. Action proof: baseline `blocked-tomato-click.png` versus candidate `tomato-harvested.png`, with their native JSON receipts. The source domain file remains unchanged.

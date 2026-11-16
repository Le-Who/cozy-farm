# Market sale browsing: local opt-in prototype

Baseline: `753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9`. Enable only on the local Vite DEV server with `?marketSaleGrid=1`. Production removes the conditional stylesheet and wrapper. The ordinary route retains its original markup.

## Verified remaining gap

Search, groups and harvest families already exist in main. They were not rebuilt. On a synthetic 34-type inventory at 360×640, scrolling the baseline sale list moved the group and search fields outside the dialog's clipping region. The remaining sticky bar exposed market tabs, not the inventory filters.

## One bounded change

- Keep the existing native group/family select and existing search above a separately scrollable two-/three-column stock grid.
- Keep the existing bulk-sale action visible below the grid. Native controls remain at least 44px tall.
- Choosing quantity presents the existing exact-sale editor without the other product cards, market tabs or disabled bulk action competing with it. Category/search remain available; Close returns the full list and exact source focus.
- Reuse all existing item keys, filter logic, quantity validation, presentation tokens, gesture guard, sale handlers and storage. The only TypeScript changes are the DEV CSS gate and conditional wrapper. No inventory state or new handler is added.
- Existing recipe shortcuts remain in the markup. Outer scrolling remains available as an overflow fallback, while the filters remain sticky.

## Evidence

`native.mjs` runs actual main.ts in sandboxed Chromium. It seeds one isolated, canonical synthetic save with 34 ordinary/rare stock types; subsequent sale actions are trusted native inputs. This is not earned gameplay progression and never accesses an owner's save.

Baseline: 360×640, inventory and after-scroll screenshots, confirming the missing filter visibility.
Candidate: 568×320, 360×640, 1280×800. It verifies all 34 semantic keys, visible group/search after grid scrolling, visible exact quantity/confirmation controls, cancel with zero writes and restored source focus, native group+query filtering of the exact rare apple, invalid quantity rejection, double-click committing three units once, and exact full-save/reload parity. Receipts include 15 candidate game screenshots.

Existing focused tests cover exact sales, family/search behavior, presentation ownership and the quantity stepper. TypeScript, Russian audit and production build pass; no DEV marker remains in production JS/CSS. No full suite, physical-touch or every possible recipe-shortcut/zoom configuration is claimed. This is not published or enabled for production.

The runner accepts `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `MARKET_QA_OUTPUT`, optional `MARKET_QA_WIDTH`, and `MARKET_QA_BASELINE=1`. It installs nothing and makes no external requests.

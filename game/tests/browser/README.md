# Focused native Orders regression

Run from `game/` with paths to an existing Playwright module and Chromium-compatible testing browser:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/path/to/chrome-headless-shell \
node --test tests/browser/market-order-selection.test.mjs
```

Optional `ORDERS_SELECTION_OUTPUT` writes per-viewport screenshots and JSON observations. Chromium sandbox stays enabled. The test uses a new temporary browser context, an earned public-reducer fixture, and a local Vite server. It neither reads a real save nor permits external requests. It checks the existing Orders selection at desktop, portrait and short landscape: nested picker position is retained, the selected detail receives focus, all choices remain available, and browsing does not write the farm.

# Compact coop overview: local candidate

Baseline: `753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9`.

Scope is the **first coop/incubator screen**, not the separate “Познакомиться” friendship screen. Enable only with Vite DEV and `?coopCompact=1`. No production flag, storage field or new action handler is introduced.

The candidate keeps the existing feeding, egg collection and incubation actions together. Each selected heading opens its complete original detail. The ordinary-egg cost remains visible before incubation; duration and stock are available under its heading. Full-nest/capacity warnings remain visible. Care, packing, petting and the unchanged next-morning forecast are named disclosures rather than a long always-open list.

Every original action button is moved intact from the canonical renderer, not recreated. Action/value/context, disabled state and command handlers are unchanged. Disclosure choices are local module state only. The canonical coop renderer and the friendship page are untouched.

## Observed native comparison

Actual `main.ts`, Chromium, **568×320**, public-reducer-earned hatchery fixture. Baseline and candidate use the same saved farm. No runtime farm editing and no primary action activation were used.

- Baseline content: 632px in a 223px viewport.
- Candidate overview: 223px in the same 223px viewport, no initial scroll.
- All 12 original action payloads/disabled states match exactly.
- Primary actions and service summaries are at least 44px; actual action buttons are 44px.
- All five disclosures (incubator, care, packing, hens, forecast) were opened/closed with trusted native input. Full save equality and zero save writes held throughout.
- Initial panel text excluding closed disclosures: 449 → 172 characters. This is not an offscreen visibility metric.
- No page errors or external requests.
- Nine targeted canonical coop tests and final TypeScript/production build pass. Candidate markers are absent from production assets.

Expanded optional sections intentionally scroll. Portrait, basic/packing/full-flock visual variants and physical-device accessibility are not claimed by this small candidate. It is not published or production-enabled.

Run the scoped native check with the existing Playwright and Chrome headless-shell paths:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chrome-headless-shell \
COOP_QA_OUTPUT=/absolute/path/to/evidence \
node prototypes/coop-compact/native.mjs
```

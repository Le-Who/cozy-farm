# Orders landing and own-shop discoverability: bounded local check

Baseline: `753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9`.

## What current main already does

Actual baseline captures at 360×640 and 568×320 show **one 44px own-shop entry at the top**, not the bottom. The grouped order picker and selected detail are already visible on landing. All seven orders in the earned fixture are selectable, selection survives tab changes, and browsing writes nothing. Replacing this layout would not address a demonstrated current defect.

The remaining mismatch is the entry's name: at Home it says “В лавку в гавань”, while the actual destination page is “Своя лавка”.

## Minimal prototype

Local Vite DEV query `?marketOrdersEntry=1` changes only the Home-side **Orders** entry to **“Своя лавка в гавани”**. The same single button keeps `open-panel / bay-shop`, its existing village-built gate, position, dimensions, and route. Other Market tabs, including Sale, keep their existing label. No description, extra header, duplicate shortcut, CSS or alternate handler is added. Production removes the query gate and proposed label.

## Verification and limits

The native runner uses the existing 119-public-reducer earned-home fixture, replayed against this exact main's domain modules. That initial fixture is not a claim of native progression. All subsequent actions use trusted browser input.

Candidate checks at 568×320, 360×640 and 1280×800 cover the complete current order portfolio, focused selection, timing disclosure, tab return, one visible 44px shop entry and exact unchanged save with zero Orders-browsing writes. The actual 360px shop route is also opened and its “Своя лавка” heading captured.

Opening the shop from Home is **not** read-only: its existing route crosses to the village. Both baseline and candidate produced the exact unchanged `sail(..., 'village')` state and two primary persistence writes, with no stock/coin/economy change. This existing crossing was not redesigned or described as zero-write navigation.

Seven existing Orders tests, Russian audit, TypeScript and production build pass. No new economy, storage, order grouping, filters, assets or Sale/incubation changes. No publication or production activation. Physical touch, screen-reader behavior and every possible order portfolio are not newly claimed.

Reproduce with existing tools using `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `ORDERS_QA_OUTPUT`; optional `ORDERS_QA_WIDTH`, `ORDERS_QA_BASELINE=1` and `ORDERS_QA_ROUTE=1` select bounded checks. The runner does not install anything or contact external services.

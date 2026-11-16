# Hen friendship: baseline first, one dense-state fit fix

Frozen main: `753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9`.

## What is already solved

The real “Познакомиться” screen already shows **one selected hen**, four named choices, the selected hen’s care actions, three treats and one notes disclosure. Native 568×320 and 360×640 baseline checks found every normal-state control visible without scrolling. Trusted selection of another hen preserves the complete farm and causes zero writes. No redesign or new labels were warranted.

## Actual remaining defect

A public-reducer-earned favorite treat plus pet adds the “Любимое” line. At 568×320 that dense state had 240px of content in a 231px content viewport. The bottom **3.59px of the 44px “Характер и правила” control** was clipped. Dense 360×640 already fit.

The candidate does only this: when a known-treat extra line exists in short landscape, allow the dialog its existing content height up to `100dvh - 16px`, instead of the ordinary 28px margin. No text, labels, ordering, controls, domain functions or familiar selection state change.

Enable only with Vite DEV and `?henDenseFit=1`. Production compilation removes the import. The stylesheet targets only the dense hen-friendship dialog; normal-state rendering stays unchanged.

## Verified candidate

Actual main, 568×320, same dense earned fixture:

- 240px content in a 240px viewport, `scrollTop = 0`.
- Notes control remains 44px and has 6px clearance below it.
- Text and every action/value/context/disabled tuple exactly match baseline.
- Trusted select 0 → 3 → 0 and notes open/close preserve full farm equality and zero writes.
- No browser errors or external requests.
- Five focused existing friendship-view tests, TypeScript/production build and production-marker exclusion pass.

Physical-device/screen-reader acceptance and unrelated viewport states are not claimed. This is local-only; nothing is published.

The native scripts use `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `COOP_QA_OUTPUT` (shared runner output variable). `dense-fit-native.mjs` additionally reads the existing dense baseline report through `HEN_BASELINE_REPORT`; it does not repeat passing normal-state browser checks.

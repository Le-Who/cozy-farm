# Interaction and material polish — 2026-11-08

Local changes after base `8f9936a4ce4b4fd44acaf169f6b88dd895df703d`. Final production bundle `index-xdYqM0ui.js`, CSS `index-BddxS0GT.css`, cut worker `workshop-cut-worker-CccrLeeP.js`, served by Vite preview on port 5264.

- `node --test --test-reporter=spec tests/*.test.ts`: 163 passed, 0 failed.
- `npm run build`: TypeScript and production build passed. Existing >500 kB bundle warning remains.
- Production native mouse 1280×900 and CDP touch 390×844: exhausted packet + empty soil opens seeds; owned tile immediately selects and persists; empty tile previews purchase without switching selection; purchase selects the bought seed; no confirmation control remains. Back from Collections preserves the originating bed. Normal-motion last-seed planting followed by another empty bed opens the picker without spending extra stock.
- Production Coop menus at 1280×900 and 390×844: no-feed purchase → Feed flock; buying does not feed automatically; one serving consumed; level 1 has no basket action; level 2 packs baskets, no crates; Packing House packs crates. Portrait dialog width and scrollWidth both 366.
- Ordinary new-save hen garden drag/reload plus isolated boat-enabled travel fixture: native mouse/touch, garden/orchard, invalid water/building drops, reduced motion, Grove round trip, no resource spending. `hen-roaming-native-qa.json` records coordinates and fixture boundaries. Hungry feed station opens Coop and disappears after feeding.
- Bakery fixture has level 3 Bakery, no completed Fair, exactly 2 wheat and 1 egg: entry/cancel leave save unchanged; native mix/form/Bake yields one farmhouse bread, consumes ingredients once, no handmade stock or pattern, reload valid. 390×844 and 568×320 reviewed. Advanced fixture verifies Home bread → Village hotbar → regular pastry and the correct separate output. See both bakery receipts.
- Cookery native touch 390×844 and mouse 568×320: authored syrup/jam in pot, spoonful, stream and jar; one commit, repeated Enter cannot recommit, cancel zero. DPR 1→1.25→2, no-resize-event buffer update, progress preservation, forced WebGL loss/restoration and disposal checked in the isolated native harness. See `cookery-material-verification.json`. Before/after images use the same portrait scale. New transparent sources and generation prompts are in `01_primary_target/lavender-bay/cookery/material-polish/`.
- Final production fishing at 568×320 from fresh origin, no progression fixture: native cast, Moonfish and boot caught, no white hook/fish rings, hard light planes or foam rail; ascending controls hidden, brief item-only callouts, automatic result, repeated award guard and pending token cleared. No page/WebGL errors. See production fishing receipt. Surface and depth composition also reviewed at 1440×900 and 390×844 before the final copy-only tidy.

Native motion files remain in the ignored local evidence folder:

- `output/playwright/cookery-material-native-motion-final.webm`
- `output/playwright/hen-roaming-video/page@af6d87a109bcc747444d8410f4cd62b0.webm`
- `output/playwright/fishing-production-no-duplicates.webm`

These are Chromium desktop and emulated touch/viewport checks, not a claim of testing physical iOS/Android devices. New development directions are proposals only; none of the seven has been implemented under this change.

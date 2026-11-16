# Guest Book buttons in real main: strict local DEV integration

Local baseline: `edad8fd`, then exactly the three files from reviewed repeat-copy change `211d18e`, plus the companion earned-fixture QA patch. No push, release, package change, new service or art/layout approval is part of this branch.

## Opt-in boundary

Run the existing Vite dev server and open `/?guestBookButtons=1`. The condition is **both** `import.meta.env.DEV` and exact query value `1`. Without the query, real main still renders the existing six-card Guest Book. In a production build, even a query-bearing URL still renders the existing book: the conditional dynamic import is eliminated and the button surface payload is absent.

This is not a production feature flag or saved preference. There is no window test API, exposed farm object, injected runtime event adapter, fixture loader in main, or new persistent field.

## Actual integration

- One existing app capture guard, opted in only for this dev path. In addition to the two previously reviewed button keys it recognizes the **exact Home entry** `open-panel / neighbor-visits`, so its first click cannot run into a newly displayed invitation. Default recognition remains unchanged. No second guard or synthetic redispatch.
- The real app's one delegated handler calls `surface.click` before ordinary branches. A resolved command calls the extracted existing `visit-*` switch. The six branch bodies are byte-identical to the previous real main implementation; they retain `perform()`, real `VersionedSave`, dialog/panel checks, exact serial parsing, domain validation, close behavior and real source routes.
- The real `neighbor-visits` draw branch retains the surface across passive draws. Leaving the panel may replace its DOM; re-entry uses the same local view. Normal passive draws skip the generic replacement-focus routine only for this opted-in retained surface.
- `PanelVisit` captures only validated local selection and a non-executable focus key. Real history restores that selection before remount, then restores the exact source command/choice and existing scroll in the existing guarded RAF. Nothing is added to FarmState or storage.
- Nested rules/memories own header Back, Escape, cancel and Alt+Left first. At the book root ownership returns to ordinary Home/parent history. The dev book header uses the already guarded Guest Book Back key. Close never finishes a visit.

## Native proof, not a simulated host

`main-native.mjs` runs **actual main.ts** in Chromium at 568×320 and 360×640. It seeds one save earned by the companion fixture's 119 public reducers. Subsequent changes use trusted browser input, not page reducer calls or state swaps.

It checks:

1. Real Map → Home → Guest Book entry; locked Finn vs eligible Bea; one exact invite.
2. Nested header Back/Escape, root Home history and exact Finn-orchard choice on re-entry, with no primary save writes.
3. Actual first invite → source-route canvas focus → carrot harvest → quiet reply. Exact full saves and reloads match the oracle.
4. Actual repeat invite → beetroot harvest → curious reply. The first carrot/quiet memory survives both active-repeat and finished reloads unchanged. Reading memories writes nothing.
5. Held Enter on a choice, real Tab to the CTA, repeat Enter: no invitation and no save. A fresh Enter after release invites once. `VersionedSave` commits asynchronously, so the test waits for its durable serial before checking exact saved contents.
6. Actual pastry `visit-do` → workshop → Alt+Left: real `PanelVisit` restores activity, source-command focus and scroll, without another save. Close preserves the visit; explicit Finish saves once.

`main-gates.mjs` checks real default dev, opted-in dev, and query-bearing production pages: respectively 6 / 1 / 6 visible invitation controls, 0 / 1 / 0 new surfaces, and zero browsing writes. It also checks the built JavaScript for absent surface payload markers.

The unchanged companion `qa/native-repeat.mjs` separately runs the full two-crop route with the opt-in **absent** at both viewports. `handler-and-domain-parity.json` records exact existing-handler extraction and unchanged domain/storage/package files relative to the prepared baseline.

## Reproduce

Use the already installed tools; no dependency installation:

```sh
npm run build
node --test tests/*.test.ts
node --test prototypes/guest-book/qa/fixture.test.mjs
GUEST_BOOK_QA_OUTPUT=/path/to/evidence node prototypes/guest-book/main-native.mjs
GUEST_BOOK_QA_OUTPUT=/path/to/evidence node prototypes/guest-book/main-gates.mjs
GUEST_BOOK_EXPECT_REPEAT_COPY=1 GUEST_BOOK_QA_OUTPUT=/path/to/default-evidence \
  node prototypes/guest-book/qa/native-repeat.mjs
```

The runners accept the same existing `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` overrides as the fixture runner. `button-surface-harness.mjs` additionally proves the exact entry capture contract with real DOM propagation; the unguarded default remains an explicit negative control rather than a hidden global change.

## Still NOT a release or visual acceptance

No styling was added. The real dev surface intentionally shows default browser controls inside the existing game dialog. At 568×320 the invitation and selected details require scrolling and the default CTA is smaller than the final 44px requirement. Screenshots are functional evidence only. Concrete layout approval, final play-scale fit, native touch and assistive-technology coverage remain future gates. Do not enable this path in production or present these screenshots as finished UI.

## Companion explicit-command focus confirmation

A separate follow-up applies only the shared surface `click()` fix from `16cfc58`; the frozen main integration remains `98cb3be`. `main-focus-native.mjs` performs one short **real main** 360×640 run: native Tab reaches hen 0, Enter introduces it and moves focus to the visible quiet reply, held Enter cannot answer or save again, and a fresh Enter after release answers once. Exact primary save counts are 0 → 1 (invite) → 2 (hen) → 2 (held repeat) → 3 (reply). Invite and reply close the actual dialog without the shared helper stealing focus into its hidden contents. Every recorded input is trusted; no page errors or external requests. No further full sweeps or styling were added for this follow-up.

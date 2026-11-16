# Earned Guest Book browser fixture

Off-production QA only. No `main.ts` import, new package, install, service, saved
selection field or runtime hook. Source modules, handlers, art and styles are
unchanged. Deleting this directory removes the fixture and runner.

## What is real, and what is setup

`fixture.mjs` starts at `createFarm()` and replays the 119 successful public
commands from the earlier `3248e4f` native-baseline preparation. Every intermediate
save is checked with `restoreCurrentFarm`. It does **not** assign inventory,
meeting counters, residence, crop growth, active visits or memories directly.

The fixture naturally reaches day 15 Home: Bea eligible, Finn still locked,
zero Home visits, ripe star carrot at bed 1 and ripe dew beetroot at bed 5.
This is earned **reducer** setup, not a claim that those 119 steps were performed
through browser controls.

`native-repeat.mjs` seeds that one initial save into a fresh isolated browser
context. Afterward it only observes storage and uses real click, wheel and
keyboard input. It never swaps saves mid-run, calls a page reducer, dispatches a
synthetic event, patches the game handler, or installs prototype listeners.

The native production route is:

1. Open Bay → Home → Kitchen/guests/upgrades disclosure → Guest Book.
2. Check all three Bea invitations enabled and all three Finn invitations locked.
3. Explicitly invite Bea for harvest; reopen book and use **К зрелой грядке**.
4. The real source route focuses the crop; press Enter on the focused canvas.
5. Reply **О тихих радостях**; reload and compare the exact saved bytes and full state.
6. Separately invite Bea again; repeat the source route and harvest the next ripe crop.
7. Reload while this second visit is active: beetroot remains the current observation,
   while carrot and quiet remain the sole first memory.
8. Reply **О новых идеях**; reload and check first subject/detail/day/serial/quiet
   were not overwritten. Read the native book and check the gates again.

Each size has six accepted native mutations and exactly six primary save writes.
Every checkpoint is compared against the full independently computed oracle.
Entry, routing, memory browsing and reload add zero writes. Inputs are recorded
with `isTrusted`. Requests outside the local origin (and `/api/`) are blocked and
reported. The browser and Vite server always close in `finally`.

## Run

Run from `game/`, with the project's existing dependencies:

```sh
node --test prototypes/guest-book/qa/fixture.test.mjs
node prototypes/guest-book/qa/fixture.mjs ../evidence/fixture
GUEST_BOOK_QA_OUTPUT=../evidence/native-repeat \
  node prototypes/guest-book/qa/native-repeat.mjs
```

The runner uses the existing local Playwright/Chromium paths from this workspace.
On another machine provide existing installations explicitly, without installing
anything automatically:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chrome \
GUEST_BOOK_QA_OUTPUT=/absolute/path/to/evidence \
  node prototypes/guest-book/qa/native-repeat.mjs
```

To run the same trace against another checkout without copying its product code:

```sh
GUEST_BOOK_GAME_ROOT=/absolute/path/to/candidate/game \
GUEST_BOOK_SOURCE_COMMIT=exact-source-commit \
GUEST_BOOK_EXPECT_REPEAT_COPY=1 \
GUEST_BOOK_QA_OUTPUT=/absolute/path/to/candidate-evidence \
  node prototypes/guest-book/qa/native-repeat.mjs
```

`GUEST_BOOK_EXPECT_REPEAT_COPY=1` additionally checks distinct first/repeat harvest
messages, `Сегодня: Свёкла`, the correct current/first-memory explanation, and
absence of the first-moment narrative from the repeat active card. The save oracle
remains the unchanged domain-state oracle; copy must not change state.

## Verified results

- Baseline source: inert checkpoint `6df90d1`, whose live game path remains `3248e4f`.
- Copy candidate: `211d18e6c59aed0f38feb43e8286c90dbad4bdcd`.
- Both pass at **568×320** and **360×640**. Three fixture tests pass.
- `evidence/native-repeat/native-repeat-result.json` is the baseline report.
- `evidence/native-repeat-candidate/native-repeat-result.json` is the candidate report.
- The reports include exact six action arguments, all state projections, geometry,
  trusted input records, errors/external-request arrays, and closure status.

The first candidate runner attempt probed the wrong result container after a
reply and is preserved under `evidence/candidate-harness-attempt-1`. Production
`perform()` puts that result in `.dialog-feedback` before closing the book; the
old harvest `.toast` is hidden, not replaced. The final runner correctly reports
the exact closed-dialog feedback and **does not claim a visible farewell toast**.
This was a harness correction, not a product failure.

## Scope limits

- Crop work is native **keyboard Enter after native source focus**, not a pointer
  harvest or touchscreen claim.
- This checks the unchanged production Guest Book. Transient resident/activity
  selection is not integrated there. `fixture.test.mjs` checks `GuestBookView`
  snapshot/restore on the earned fixture, but that part is **model-level**, not a
  native production selection/history claim. The separate opt-in button-surface
  lane owns actual selection-adapter/browser tests.
- Screenshots are scroll checkpoints showing subjects/header context, not proof
  that the entire memory card or every reply fits at once. Existing short-landscape
  clipping/scrolling remains; no layout approval is implied.
- No runtime/startup size cost, production integration, commit, push, deployment,
  paid generation or external service is part of this fixture.

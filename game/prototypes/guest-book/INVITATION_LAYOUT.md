# Guest Book invitation: opt-in layout candidate

Baseline: `053660bd90e0c1da4fcfc4f398f5ef0b83188269`.

This is still **DEV + `?guestBookButtons=1` only**. The new `guest-book-dev.ts` entry imports the scoped stylesheet and the retained button surface. The ordinary book, save schema, domain reducers and production routes are unchanged. Production build inspection finds none of the surface, picker or scoped stylesheet markers.

## Layout

- Portrait: two direct resident choices and three direct activity choices. The selected item has a clear lavender fill/border.
- Short landscape: two selected fields open retained choice buttons. All three 44px activity options fit in the content viewport without scrolling. Escape closes the open picker first. Choosing an option returns focus to its selected field.
- All invitation, field, choice and book-navigation buttons are exactly 44px tall. The primary action remains an explicit exact-activity invitation.
- Show the goal for an eligible guest, or the real locked reason, without repeating the full title. Readiness, invitation dialogue and visit rules remain under **Подготовка**. This optional disclosure expands in normal flow and may intentionally require scrolling; the collapsed choose/invite path does not.
- Global Islands/Collections/Map shortcuts are hidden only inside this focused dev book. Header history Back and Close remain; the game’s global destinations remain available after leaving the book.

No control nodes are replaced on passive render. Picker/disclosure state is local UI only. No storage fields, domain validation, action identity, capture guard or save handler changed.

## Acceptance

`invitation-layout-native.mjs` runs the real `main.ts` with the earned 119-public-reducer initial fixture, then trusted native input only. It checks both **568×320** and **360×640**, all six activities, each open compact picker, zero horizontal overflow and zero necessary selection/invitation scrolling, exact 44px controls, locked Finn vs eligible Bea, nested Back/choice preservation, no browsing writes, retained control identities, trusted touch, held-key suppression and exactly one saved invitation. It captures actual game screenshots, not mockups.

After the full layout pass, `GUEST_BOOK_QA_DELTA=1` limits the runner to the small 568×320 accessible-name/disclosure delta rather than repeating the full matrix. The existing narrow DOM contract harness and TypeScript build cover the small helper changes. Prior full domain suites were not rerun.

Known scope limits: optional preparation content can scroll, real physical-phone and screen-reader checks are not claimed, and Active/Memory styling is a separate patch. This candidate is not enabled in production or published.

Run with the existing tools:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chrome-headless-shell \
GUEST_BOOK_QA_OUTPUT=/absolute/path/to/evidence \
node prototypes/guest-book/invitation-layout-native.mjs
```

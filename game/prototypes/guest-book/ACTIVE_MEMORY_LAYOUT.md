# Active visit and Memories: isolated DEV layout

Parent: invitation checkpoint `d9cd81c796b2d530292f3cab62528cdfc89beb16`, ultimately recovered from remote `053660bd90e0c1da4fcfc4f398f5ef0b83188269`.

This delta does not publish or enable the prototype in production. The shared DEV entry imports the new stylesheet; the normal production build strips the entry and stylesheet. No domain, balancing, handler, save-schema or storage code changes.

## Scope

- Active visit has one heading and a keyboard-scrollable description. Short landscape places retained actions alongside it. Portrait stacks these areas.
- Memory choices and the selected record are a two-column spread where space allows; portrait stacks them. Long lists and records scroll independently. Empty command space is not reserved.
- Visible controls are at least 44 px tall. Existing command nodes/values and selection keys stay retained and unchanged.
- Only explicit Active/Memories navigation reveals its focused destination. Passive redraw does not change focus or scroll. An explicit memory choice starts that record at its beginning. A command that becomes hidden transfers focus only under the existing ownership check.

## Focused validation

`active-memory-native.mjs` runs actual `main.ts` with `?guestBookButtons=1` in headless Chromium with its sandbox enabled. Native input follows the normal Home entry, then introduces a hen, reads/selects memories and uses Escape to return. Its initial save combines the existing earned-home fixture with domain callbacks that create three memories and a pending repeat hen visit. Those initial memories are synthetic preconditions, not a claim of native gameplay progression.

Viewports: **568×320, 360×640 and 1280×800**. The runner verifies clipped geometry, 44 px commands, no horizontal overflow, exact full save after the one hen action, zero writes from browsing, unchanged first memory, explicit focus visibility, and selection/focus/scroll across passive redraw. It writes 12 actual game screenshots and a JSON receipt. This is not physical touch or assistive-technology acceptance, and does not claim new artwork or native visual coverage for every possible activity/count.

Additional focused checks: 9 prototype tests, 10 retained-button DOM contract checks, TypeScript, Russian audit, production build. No repeated full-game suite or deployment was run for this layout delta.

Use existing installed tools, providing `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `GUEST_BOOK_QA_OUTPUT` to run the native script. The runner performs no installs, network service calls, or publication.

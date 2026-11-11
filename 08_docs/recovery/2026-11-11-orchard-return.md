# Earlier fruit from an existing nursery tree

## Confirmed barrier

The old fruit hint chose the first planted tree before considering a paused, adult nursery tree without fruit. A newly planted peach or pear needed three rests, even when returning the owned adult to a free slot would give fruit after one rest. This is a new, evidence-backed UX improvement, not a claim to reconstruct an identical historical implementation.

## Change

- Prefer ready planted fruit, then ready nursery fruit. Preserve the explicit free-space route for ready nursery fruit when the orchards are full.
- Otherwise compare the real number of rests to fruit. A paused tree is proposed only with a reachable empty slot and a strictly earlier harvest. Ties keep the planted source, with the current reachable orchard preferred.
- Kitchen ingredient links and the shared task guidance open the orchard and identify the exact nursery entry. Opening the hint does not move, plant, harvest, spend, or sleep. Back returns to the selected kitchen recipe.
- Nursery rows say that the displayed wait starts after returning the tree to the garden. A ready tree can be collected immediately after return.
- Returning a nursery tree now uses the existing click/key guard. Actual UI testing reproduced the previous double-click defect: two trees moved after a redraw. The guard prevents the second action and held-key activation.
- No growth, reward, price, inventory, or save-schema rules changed. Return still costs no coins and records the existing one unit of work. Rest and harvest remain separate explicit actions.

## Verification

- 641/641 tests pass. Eight new tests cover the faster paused source, reload, explicit return/rest/harvest, ties, nearest planted tree, inaccessible/full orchards, ready fruit priority, every species and valid growth stage, and the click/key guard. Existing nursery and coin-guidance expectations now point to the explicit orchard panel.
- Build passes, with the existing large-chunk warning only.
- Audio catalogue rebuilt from existing sources. Runtime and dist audits pass: 164 takes, no missing or unreferenced files. The existing panel-opening cue description includes this read-only route. No new recording or runtime audio asset changes.
- `git diff --check` passes.

Actual main game, loopback port 5201, isolated Vite cache:

1. Desktop: day 5, 18 coins, 0 work, no pears; a young planted pear and young/adult nursery pears. Kitchen → garden preserves → missing pear opened the orchard and focused the adult nursery entry. Both nursery waits were visible. Before explicit return, the v3 save was byte-identical to the fixture baseline.
2. Before guard correction, a double click reproduced two returns, work 0→2 and nursery 2→0.
3. After correction, repeated the kitchen route on a separate clean localhost origin in a 390 px iframe. The v3 save remained byte-identical before return. A double click returned only the adult: work 0→1, nursery 2→1, last garden slot still empty, day 5, coins 18, pears 0. The young nursery tree remained paused at age 0.
4. Back restored the selected garden-preserves recipe. Reload preserved all inspected state.
5. Explicit double click on “До утра” advanced only day 5→6. The returned adult had 2 ready pears; the original planted tree had age 1 and no fruit; the nursery tree remained age 0. Stock still had 0 pears, coins 18, work 0.
6. Opened that adult tree and explicitly collected 2 pears. Stock became 2, ready fruit became 0, work 1, coins 18. Reload preserved the inspected result.

Desktop and 390 px screenshots were reviewed. The environment lacks WebGL2, so actual main menus, routing, domain actions and save results were exercised, not the 3D scene or its animation. The HUD-specific action uses the tested shared task route; a separate live HUD goal was not seeded. Held Enter behavior is unit-tested, not a new native held-key test.

Fixtures are explicit, loopback-only and refuse existing v3/v2 saves:
- `game/tests/manual/orchard-return.html`
- `game/scripts/qa/orchard-return-mobile.html`

Local work only. No push or deployment.

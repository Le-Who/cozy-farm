# Mobile runtime bakery backgrounds 08–09

Created on 2026-11-07 with two separate built-in ImageGen edits. No runtime code, typed layout config, UI positions, or camera code was changed.

## Files and source images

| Selected clean source | Actual pixels | Runtime WebP | Runtime bytes |
| --- | --- | --- | --- |
| [08-runtime-portrait-clean.png](08-runtime-portrait-clean.png) | 1000 × 1573 | `game/public/art/lavender/workshop-authored/room-portrait.webp` | 1,700,818 |
| [09-runtime-landscape-clean.png](09-runtime-landscape-clean.png) | 1846 × 852 | `game/public/art/lavender/workshop-authored/room-landscape.webp` | 1,760,188 |

Portrait edit target: [05-mobile-portrait.png](05-mobile-portrait.png), 977 × 1610.

Selected portrait generated source: `C:\Users\user\.codex\generated_images\01a1b48e-995c-7093-9ed9-2f0b4be05f78\exec-b7ec8dc7-a128-4eb6-98c5-621e9812a3a6.png`.

Landscape edit target: [06-mobile-landscape.png](06-mobile-landscape.png), 1846 × 852.

Selected landscape generated source: `C:\Users\user\.codex\generated_images\01a1b48e-995c-7093-9ed9-2f0b4be05f78\exec-49870a35-1c0a-4a75-a4cc-036c23199df5.png`.

The prompt requested exact source pixel geometry. ImageGen changed portrait dimensions from 977 × 1610 to 1000 × 1573: width +2.35%, height −2.30%, aspect +4.76%. Per the coordinator's subsequent explicit clarification, the selected asset is accepted on preserved composition, palette, full rounded board edges and empty working surface, rather than pixel identity or exact dimensions. No resampling, stretching or cropping was applied afterward. Landscape retained its original pixel dimensions. Calibrate against the coordinates of these selected clean assets below; do not reuse the older 05–06 measurements.

## Visual acceptance and encoding check

Both clean PNGs and the actual runtime WebPs were opened and inspected at native resolution. Dough, rolling pin, knife, scraper, inventory tokens, X, Bake, interactive-object contact shadows and selected-tool glow are removed. The restored board is continuous warm wood with gentle flour dust, without dough-shaped dark shadows. The room, window and sea view, lavender curtains and roof, oven fire and baked loaves, surrounding jars/plants/ceramics, board rim and front thickness remain recognizably the same authored composition.

Landscape retains the folded cream/lavender cloth at the former rolling-pin resting position. This is an intentional background prop, not an overlooked tool. Its approximate image rectangle is [706, 217, 1140, 340] px; reserve it as the tool-parking zone if dough must remain on bare wood. Portrait retains the lower-left cloth, flower and vanilla decoration.

WebPs were encoded with Pillow `lossless=True, method=6`, without resizing. Decoding each WebP and comparing its RGB pixel array with the selected PNG produced exact equality for every pixel. Thus the runtime files reproduce their accepted clean PNGs without additional image loss; this is separate from the small generative drift relative to the original mockup.

## Top-plane calibration points

Coordinate origin: the top-left pixel of the CLEAN SOURCE IMAGE. Order: TL, TR, BR, BL.

These are the nominal sharp corners obtained by extending the straight edges of the board's upper plane through its rounded corners. They are not an axis-aligned bounding rectangle, not the bottom of the front lip, and not the contact-shadow boundary. Rounded hand-painted edges introduce a few pixels of measurement ambiguity; the integer tuples below are the fixed calibration targets used in the QA overlays. Do not treat a rounded arc's extremum as a different plane corner.

| Clean asset | TL | TR | BR | BL |
| --- | --- | --- | --- | --- |
| 08 portrait, 1000 × 1573 | **(28, 447)** | **(965, 447)** | **(987, 1397)** | **(18, 1397)** |
| 09 landscape, 1846 × 852 | **(73, 225)** | **(1284, 225)** | **(1408, 760)** | **(−6, 760)** |

The landscape BL has x=−6 because the extended left and front edge tangents intersect just outside the image. Its actual rounded wooden corner is visible inside the image; this does not mean the art was cropped or that an interactive object belongs outside the viewport. Keep the nominal corner for plane calibration. Use the interior quad below for usable interaction bounds.

Equivalent normalized image coordinates:

```json
{
  "portrait": {
    "width": 1000,
    "height": 1573,
    "topPlaneTL_TR_BR_BL": [
      [0.028000, 0.284170],
      [0.965000, 0.284170],
      [0.987000, 0.888112],
      [0.018000, 0.888112]
    ]
  },
  "landscape": {
    "width": 1846,
    "height": 852,
    "topPlaneTL_TR_BR_BL": [
      [0.039545, 0.264085],
      [0.695558, 0.264085],
      [0.762730, 0.892019],
      [-0.003250, 0.892019]
    ]
  }
}
```

Suggested inset quads that avoid the bevel/front lip, also TL/TR/BR/BL:

- Portrait: **[(66, 482), (928, 482), (946, 1360), (61, 1360)]** px.
- Landscape: **[(105, 255), (1250, 255), (1361, 726), (35, 726)]** px. The cloth parking rectangle still needs separate exclusion if applicable.

When using `contain`, transform points as `viewportPoint = imageOffset + sourcePoint * containScale`. Avoid independently scaling x and y. When fitting a 3D plane, preserve TL/TR/BR/BL order rather than substituting the minimum/maximum coordinate rectangle.

## Calibration evidence

Artifacts are under `output/imagegen/workshop-calibration/`:

- `08-plane-quad.png` and `09-plane-quad.png`: actual clean image plus purple top-plane edge tangents and green interior quad, with source-pixel axes and corner labels.
- `08-09-board-points.json`: exact same pixel and normalized tuples in machine-readable form.
- `08-edge-0.png`, `08-edge-1.png`, `09-edge-0.png`, `09-edge-1.png`: read-only inspection crops of the back/front board edges.

The QA charts are derived measurement diagrams only. They are not runtime artwork; the runtime WebPs contain no lines, labels, tools, dough or UI.

## Exact portrait edit prompt

Input: `05-mobile-portrait.png`. Built-in ImageGen, `transparent_background=false`.

```text
Use case: precise-object-edit. Edit ONLY the supplied portrait bakery workshop screen into a CLEAN RUNTIME BACKGROUND. Preserve its EXACT native977x1610pixel canvas, aspect ratio, camera, framing, all room architecture, all four board corners, board position/size/perspective/thickness, and every other background detail. NO recomposition, zoom, crop, extension or movement of the board. REMOVE ONLY these interactive objects and their own cast shadows/glows: both central cream dough pieces; the vertical rolling pin on the left and its lavender selected glow; the curved baker's knife on the right; the metal bench scraper at lower right; the top-left wheat2 and egg1 UI tokens; the top-right circular X; the bottom-right Bake button. Reconstruct the exact continuous wooden board grain where dough/tools were, preserving the original warm surface light, small natural wood variations and the lightly scattered flour that is already on the board. Remove dough/tool-shaped dark contact shadows and all lavender selection halos without flattening the board's natural lighting. Where UI tokens covered curtains/wall, restore the same embroidered lavender curtains or wall in place; where Bake was, restore continuous matching tabletop wood grain and light flour, with NO new object. KEEP the entire oven and its baked loaves/fire glow, lavender roof, sea view/window, curtains, foliage, jars, jug, fruits, all shelves, cabinets, lower-left lavender cloth/flower/vanilla, and all noninteractive background props EXACTLY where they are. Do not remove the baked breads inside the oven. Do not add anything. Empty usable board, no dough, no tools, no rolling pin, no scraper/knife, no wheat/egg UI, no numbers, no X, no Bake, no text, no UI at all. Match untouched pixels and fixed landmarks as closely as possible. Final output must be the same977x1610image composition, with just the specified foreground objects inpainted away.
```

## Exact landscape edit prompt

Input: `06-mobile-landscape.png`. Built-in ImageGen, `transparent_background=false`.

```text
Use case: precise-object-edit. Edit ONLY the supplied LANDSCAPE bakery workshop screenshot into its CLEAN RUNTIME BACKGROUND. Keep EXACT native1846x852pixel canvas and aspect ratio, exact framing/camera, room layout, entire board position, dimensions, perspective, rounded edges, all four corners and visible front lip/feet. NO recomposition, crop, scaling, new camera or shifted architecture. REMOVE ONLY all three central dough pieces; the rolling pin at the board's upper edge and its lavender selected glow; the curved baker's knife at lower left; the metal bench scraper in the right nook; all UI tokens wheat2/egg1 at top left, circular X at top right, and Bake at lower right. Remove ONLY these items' own contact shadows and halos. Restore warm continuous wooden board grain beneath them, with the same original soft directional light and existing lightly scattered flour, never dough-shaped dark stains. IMPORTANT KEEP the folded lavender-and-cream CLOTH that was under the rolling pin, with its exact position, weave and folds; remove only the pin and shadow from that cloth. Preserve all noninteractive background objects and scenery EXACTLY: window, lavender curtains/flowers, sea and lighthouse, jug and yellow fruits, wheat basket and hanging towel, jars/shelves/plants, oven with baked breads and fire glow, lavender roof, right flower jug, tabletop and flour dust. Do NOT remove baked loaves inside the oven or the decorative wheat in the background basket. Restore the same curtain/wall behind UI tokens and continuous tabletop wood where Bake was. The result is the identical room and board, now empty of interactive tools/dough/UI. NO new objects, no text, no UI, no figures, no design changes, no generic panel or card. Preserve the original overall image pixel geometry and background detail as closely as possible. Output exactly1846x852composition.
```

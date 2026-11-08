# Sheet 02 — materials, tools, raw dough and finished bakes

Created with built-in ImageGen using two visual references:

1. `01-art-master.png` — approved exact object and interior art direction.
2. `../03-cohesion-materials.png` — Lavender Bay world materials, rounded forms and palette.

## Result and source

- Final production-reference sheet: [02-materials-and-tools.png](02-materials-and-tools.png).
- Final generated source: `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-84157e3d-ec48-4adc-b850-6ef3a1f8923b.png`.
- First generated source: `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-bdda037e-3b64-4f15-b1ad-17bd6b717a4b.png`.
- First source preserved locally as `02-materials-and-tools-initial-source.png`.

The final sheet was copied without recolouring, resizing or compositing. It is an opaque cream-background artboard, not a transparent runtime prop atlas.

The first generation was inspected for object completeness, master fidelity, consistent lighting and raw-versus-baked material distinction. Its two cut dough faces looked like airy baked crumb. One targeted ImageGen correction replaced only those cut-face textures with dense moist raw dough, preserving the composition and finished bakes. The final sheet was inspected again.

The sheet shows a complete open glazed bowl and wooden spoon; a turned rolling pin with both handles; curved pastry knife and straight scraper with blade thickness, wood grips and rivets; a raw kneaded mound, raw folded pastry and separated fresh-cut portions; and three distinct finished bakes. Wood, ceramic glaze, metal, linen and raw/baked dough share the master palette and window light.

## Full initial prompt

Use case: stylized-concept. Asset type: premium production art direction sheet for the Lavender Bay interactive bakehouse, sheet 02 materials and tools.
Reference image 1 is the APPROVED EXACT art direction and object design master: the authored warm seaside bakery by the window, its cream glazed ceramic mixing bowl with lavender rim and hand-painted botanical sprigs, honey wood board, gracefully turned rolling pin, curved pastry knife with wood arch handle and brass rivets, proper steel bench scraper, tactile lavender woven linen. Reference image 2 establishes the existing Lavender Bay world cohesion, matte rounded shapes and harmonious warm/cool palette. Do not copy any lettering from reference 2.
Create ONE beautifully composed landscape production-reference artboard, approximately 1536x1024 or higher, on a warm pale cream studio-paper background with very faint warm tonal variation. This is a finished art-reference page with large readable objects, NOT a game UI, a contact sheet of tiny icons or a sheet of flat material textures. Absolutely no written labels, numbers, typography, diagrams or grid lines.
Art direction: lovingly authored stylized high-end cozy game 3D paint/render, same refined craftsmanship as reference 1. All objects share a single soft upper-left window light, warm bounce, gentle cool lavender fill, subtle contact shadows and consistent three-quarter orthographic tabletop viewing angle around 40 degrees. Restrained natural materials, clean silhouettes, detailed tactile surfaces without harsh outlines or sterile plastic. Keep generous breathing room and clear separation so every tool is fully visible at large scale.
Composition in a coherent curated five-group arrangement with varied elegant spacing, no visible panel boundaries:
Upper left, a large complete ceramic mixing bowl matching the approved master, shown open enough to clearly read the glazed interior, thick rolled lavender lip, real wall thickness, fluted cream exterior, one practical pouring lip and lavender botanical painting. A wooden spoon rests beside it rather than hiding the interior.
Upper middle, a large graceful honey-maple rolling pin matching the master, with a barrel, properly inset turned axle ends and TWO rounded wooden handles; lavender sprig painted on the barrel, delicate wood grain, full object visible from end to end. A small fold of warm ivory and lavender woven linen underneath one end.
Upper right, two separate fully visible real tools: the master's crescent curved steel pastry knife with an arched honey-wood handle and two brass rivets, and the straight rounded-corner steel bench scraper with a substantial matching wooden grip and two brass rivets. Show blade thickness, gentle edge bevel and restrained satin metal reflections; proper complete finished objects, never primitive capsules or disconnected parts.
Lower left extending toward the middle, a beautiful tactile raw dough study: one soft kneaded wheat-ivory dough mound with subtle finger dents and stretched gluten folds, one folded raw turnover with a hand-pinched seam, and two freshly cut raw dough portions separated slightly so the new cut faces and very fine moist pores are visible. Raw dough is pale soft creamy ivory, clearly distinct from baked crust, with restrained flour dust and supple yielding surfaces. No hands or people.
Lower right, a warm appetizing finished bake study: a round bun, a long hand-rolled loaf and a folded pastry/turnover, sitting naturally on a small matching honey-wood sample board, golden flaky crust, tiny toasted edges, believable scoring and softly flour-dusted high points, all three silhouettes clearly distinct and fully visible.
Along the low foreground, weave the material story into the artboard naturally: a small fold of detailed lavender gingham linen, a close patch of rounded honey wood grain and the cream ceramic/steel surfaces already present, rather than adding technical swatch grids. Preserve the master object's exact personality and palette. High-quality production reference suitable to guide real Three.js models, UVs and materials.
Avoid: any UI, arrows, callouts, text, logos, watermark, character, hands, cartoon outlines, saturated orange varnish, grey unfinished models, floating objects, missing handles, incomplete hollow bowls, giant dough bubbles, raw dough that looks like a smooth yellow sphere, tiny unreadable prop thumbnails, a static gameplay board composition replacing live deformation.

## Full refinement prompt

Use case: precise-object-edit. Edit this artboard with one targeted material correction. Preserve the full composition, every object, lighting, ceramic bowl, rolling pin, tools, cloth, raw dough mound, folded raw turnover and all baked bread exactly as they are. Change ONLY the TWO visible cut faces on the two small pale raw-dough portions near the lower middle-left (between the raw mound and baked-bread board). These two portions are fresh UNBAKED dough, but the cut faces currently look like airy baked bread crumb. Replace only their porous crumb texture with dense moist freshly-cut raw wheat dough: smooth supple ivory interior, subtle fine gluten strands and faint smeared knife ridges, almost no visible holes except extremely tiny pinpricks. The outer portions stay pale raw dough, with the existing light flour dust and exact silhouettes. Do not alter the golden baked items on the right. No text, labels, new objects or layout changes.

## Proposed modular runtime layers after art acceptance

These are asset-production suggestions, not implementation changes:

- **Room background:** an authored layer containing the window, curtains, view, wall, shelves and oven, with foreground work tools removed from that layer. Keep the accepted light and composition. The oven opening may have a separate gentle emissive/glow layer.
- **Counter and board:** real Three.js surfaces matched to the accepted board silhouette and four projected corners; wood maps and restrained wear/edge details derived specifically for those meshes. Match the camera to the art before calibrating interaction coordinates. The master contains perspective convergence, so a perspective camera with a long focal length may match more faithfully than forcing an orthographic rectangle.
- **Foreground trim:** a separate transparent counter-front / board-front-lip occlusion layer if required for the exact authored silhouette. It must share the same camera registration; contact shadows stay on the real work surface.
- **Tools:** complete real 3D bowl with inner wall and rolled rim, two-handle rolling pin, curved steel knife and straight scraper. Supply UV-ready cream glaze, honey wood and satin steel maps, plus transparent lavender botanical and brass-rivet decals where useful. The cream artboard itself never becomes a runtime prop.
- **Dough:** live deformable meshes with a subdued raw surface map; new closed cut faces use a dense moist interior map rather than baked crumb. Fold seam detail follows the deformed surface. Baking changes material/roughness/colour on the same batch meshes.
- **Small authored accents:** optional transparent linen, flour and botanical decal layers around the board perimeter, with clean alpha and explicit contact anchors. Keep the broad board centre clear for the actual dough and tools.

No code or gameplay state was changed for this sheet.

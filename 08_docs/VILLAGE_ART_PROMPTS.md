# Lavender Harbour — Bea and Finn

Generated with built-in ImageGen using the existing farmer and fair guest atlases as style references. Source art uses genuine generated transparency; packing preserves RGBA and performs no background removal or recolouring.

Target atlas: six horizontal 256 × 256 cells; baseline y=236 in each cell. Frame order: idle, four rightward walk phases, service. Idle portraits use the first atlas cell. Runtime uses approximately 94 world-unit height.

## Bea prompt

Use case: stylized-concept. Asset type: production 2D game character sprite atlas for Cozy Farm Lavender Bay.
Input images are STYLE REFERENCES ONLY: image 1 farmer actions, image 2 guest walk. Match their soft rounded painted toy-like matte 3D appearance, clean detailed silhouettes and warm top-left lighting, orthographic 40 degree game view. Create a different adult character BEA, a friendly mature female baker: chestnut hair in a neat bun, kind expressive face, cream apron over muted coral dress and lavender sleeves, warm brown practical boots. Readable as an adult neighbour, charming proportions matching reference farmer.
Exactly SIX full-body frames in a strict 3 columns x 2 rows grid, equal square cells, transparent canvas, no grid lines or labels. Each full character entirely inside its cell with generous transparent margins. Fixed body scale and common feet baseline in every cell. Reading order: 1 idle standing three-quarter toward screen right; 2 right-walking left-foot forward; 3 right-walking passing pose; 4 right-walking right-foot forward; 5 right-walking opposite passing pose; 6 service pose smiling and presenting a small tray of round buns. Walking frames face toward right; distinct leg and arm motion, no duplicates. Keep same face, apron and proportions in all six. Source sheet 1536x1024, 512 square cells, each character ~410 pixels tall, feet at cell y472; pack target uses 256 square cells baseline236.
True transparent background and spaces between limbs. NO background, scenery, floor, cast shadow, ground shadow, text, numbers, labels, border, watermark. No baked-in shadows beneath feet. Only the six isolated RGBA character poses.

## Finn prompt

Use case: stylized-concept. Asset type: production 2D game character sprite atlas for Cozy Farm Lavender Bay.
Input images are STYLE REFERENCES ONLY: image 1 farmer actions, image 2 guest walk. Match their soft rounded painted toy-like matte 3D appearance, clean detailed silhouettes and warm top-left lighting, orthographic 40 degree game view. Create a different adult character FINN, a friendly mature male coastal fisher: short sandy brown hair, kind expressive face, small neat beard, sea-mint shirt with soft muted blue overalls, cream straw fisher hat with muted blue band, warm brown practical boots. Readable as an adult neighbour, charming proportions matching reference farmer.
Exactly SIX full-body frames in a strict 3 columns x 2 rows grid, equal square cells, transparent canvas, no grid lines or labels. Each full character entirely inside its cell with generous transparent margins. Fixed body scale and common feet baseline in every cell. Reading order: 1 idle standing three-quarter toward screen right; 2 right-walking left-foot forward; 3 right-walking passing pose; 4 right-walking right-foot forward; 5 right-walking opposite passing pose; 6 service pose looking ahead and pointing toward the sea, with a small fishing map held in the other hand. Walking frames face toward right; distinct leg and arm motion, no duplicates. Keep same face, hat and proportions in all six. Source sheet 1536x1024, 512 square cells, each character ~410 pixels tall, feet at cell y472; pack target uses 256 square cells baseline236.
True transparent background and spaces between limbs. NO background, scenery, floor, cast shadow, ground shadow, text, numbers, labels, border, watermark. No baked-in shadows beneath feet. Only the six isolated RGBA character poses.

## Files and acceptance

## Harbour plate and handmade icons — root integration

Generated using the built-in ImageGen with actual transparency. Plate reference images: `01-master-island.png`, `game/public/art/lavender/cape-plate.webp`. Original: [village-plate-source.png](../01_primary_target/lavender-bay/village-plate-source.png), 1585×992 RGBA; runtime [village-plate.webp](../game/public/art/lavender/village-plate.webp), normalized to1586×992 without recolouring or background removal. All source corners alpha0. Native anchors live in `lavender-village.ts`.

Plate prompt: Production game island plate for Cozy Farm Lavender Bay. References give exact visual language, orthographic40° camera, warm upper-left light, creamy ivory highlights and muted brown darkest tones, matte rounded painterly forms, happy green grass, honey wood, lavender roofs. New inhabited harbour quarter, landscape about1.6:1, whole shore cliffs and bottom-left dock visible, isolated on real transparent background with small margins. Two small cream cottages along the back, paths in front. Compact open bakery workshop on the middle-left, communal oval table and benches to the lower-right, fishing lookout on right shore. Spacious central walkway. Lavender, white and coral flowers and rounded trees at the edges. Shadows touch their bases, bushes do not sit under buildings. No people, animals, boats, text, signage, icons or UI. No water and no stepping stones off the island. Premium joyful cozy mobile farming game, readable at play scale. Outside island and below dock must be transparent alpha.

Handmade icons: [handmade-source.png](../01_primary_target/lavender-bay/handmade-source.png), 2172×724 RGBA. Three equal cells, resized independently to256×256 while retaining alpha. Runtime files `ui-handmade-round.webp`, `ui-handmade-folded.webp`, `ui-handmade-long.webp`. References: cohesion materials master and `ui-honey-biscuits.webp`.

Icon prompt: Production transparent icon strip for Cozy Farm Lavender Bay, exactly3 isolated handmade bakery items in one equally spaced horizontal row of square cells. Left round fluffy golden bun with soft cross score; middle folded half-moon pastry with crimped seam; right elongated golden loaf with3diagonal scores. Honey golden crust, pale cream soft edges, matte rounded handpainted volumes, upper-left light, muted warm shadows, no black. Orthographic40° camera and equal readable icon scale. Actual transparent background, no cast shadows, ground, plates, text, labels or grid. Generous transparent margins and complete silhouettes.

- [Bea source](../01_primary_target/lavender-bay/village-bea-source.png), generated by built-in ImageGen in one call, 1536 × 1024 RGBA.
- [Finn source](../01_primary_target/lavender-bay/village-finn-source.png), generated by built-in ImageGen in one separate call, 1536 × 1024 RGBA.
- [Bea atlas](../game/public/art/lavender/village-bea.webp) and [Finn atlas](../game/public/art/lavender/village-finn.webp): 1536 × 256 lossless RGBA WebP.
- Idle crops: [Bea](../game/public/art/lavender/ui-bea.webp), [Finn](../game/public/art/lavender/ui-finn.webp), each 256 × 256 lossless RGBA WebP.

Both sources were inspected in full, then composited over a saturated blue-green background to inspect silhouettes and gaps. Backgrounds and spaces between the poses are transparent. All four source corners have alpha 0. Bea source has 880,718 completely transparent pixels; Finn has 1,134,449. Generated very low alpha edge noise is retained; no matte extraction, alpha thresholding or background removal was applied to delivered pixels.

Packing: crop six original 512 × 512 cells in reading order; resize each cell to 256 × 256 with Lanczos; preserve generated RGBA; translate the full cell vertically to put the lowest substantial boot pixel at y=236; paste into a transparent horizontal 6 × 1 atlas. Alpha >=32 was used solely to measure this boot location. Vertical translations for Bea: [0,1,1,1,0,0]; Finn: [-1,1,0,1,0,-1]. No frame was recoloured or regenerated during packing. Each packed cell's four corners retain alpha 0. UI portraits are exact copies of frame 0.

The assembled six-frame rows were inspected on a contrast background after packing. Both characters keep the same outfit, relative scale and ground baseline through walking and service poses. Runtime scene scale and motion acceptance are owned by the main integration task.

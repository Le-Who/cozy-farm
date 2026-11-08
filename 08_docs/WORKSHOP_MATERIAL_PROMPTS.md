# Bakehouse generated material textures

Built-in ImageGen generated the three source textures separately. This is the material layer for real Three.js geometry and deforming dough; it contains no UI mockup, static board composition, fixed camera props or replacement for interaction.

The runtime owner confirmed: board PlaneGeometry UV 0…1, size 6.5 × 4.2; linen repeats 3 × 3; dough uses sphere / retained cut-mesh UVs. Geometry supplies lighting, deformation, contact shadows, the ceramic bowl, rolling pin, scraper and knife.

## Outputs

- [Wood diffuse](../game/public/art/lavender/workshop-wood.webp), 1024 × 1024 lossless RGB WebP, 1,128,266 bytes.
- [Linen diffuse](../game/public/art/lavender/workshop-linen.webp), 1024 × 1024 lossless RGB WebP, 1,429,938 bytes.
- [Raw dough diffuse](../game/public/art/lavender/workshop-dough.webp), 1024 × 1024 lossless RGB WebP, 1,128,510 bytes.

Each source was 1254 × 1254. Packing used only Lanczos resize to the agreed 1024 × 1024 contract and lossless WebP encoding; no recolouring or procedural replacement was applied. These are opaque material maps, so alpha is intentionally absent. No isolated raster props were required: the runtime owner is implementing the active props as complete geometry.

## Sources

- [Wood source](../01_primary_target/lavender-bay/workshop-material-wood-source.png)
- [Linen source](../01_primary_target/lavender-bay/workshop-material-linen-source.png)
- [Dough source](../01_primary_target/lavender-bay/workshop-material-dough-source.png)

All three were inspected at source size. Wood contains flowing grain without board silhouettes or baked bevels. Linen contains a regular four-check repeat and visible weave. Dough contains irregular small pores and flour variation without baked crust, scoring, object silhouettes or cast shadows. Side-by-side preview: `game/.playwright-cli/workshop-materials-preview.jpg`.

Load as sRGB diffuse maps. Use a neutral white material colour to avoid multiplying the base colour by the previous yellow procedural material. If used for bump, clone the dough texture and interpret it as data, with a very small bump strength. These are generated base-colour textures, not calibrated scanned PBR sets; final colour and repeat acceptance belongs to the live scene.

## Wood v2 colour refinement

The live warm-lit board read too orange, so a targeted built-in ImageGen edit retained the wood grain while moving the palette toward pale biscuit and cream. The original was preserved. New diffuse: `game/public/art/lavender/workshop-wood-v2.webp`; source: `01_primary_target/lavender-bay/workshop-material-wood-v2-source.png`. Output remains 1024 × 1024 lossless RGB. Runtime selects the sibling v2 explicitly.

Use case: precise-object-edit. Input image: edit target, an existing flat game wood diffuse texture. Change ONLY its colour palette and contrast while preserving the natural horizontal wood grain scale, seamless flat material framing and all subtle wood details. It currently looks too saturated orange in a warm-lit bakehouse. Make it pale desaturated honey-oak, warm biscuit and cream wood with restrained colour: target overall average base colour sRGB #d8bc92 (RGB216,188,146), similar in lightness across the full image. The wood must read as pale matte natural oak rather than orange varnish. Reduce orange saturation strongly; introduce more cream, beige and pale oatmeal into the fibres, with low contrast grain. Keep the entire image a flat uniformly lit diffuse texture, no lighting gradients, shadows, highlights, perspective, board outline, bevels, objects, flour, text or borders. This map will be multiplied by white and then lit with warm Three.js lights, so do not bake warmth or extra lighting into it. Square1024 texture, seamless tileable horizontal grain, opaque.

## Wood prompt

Use case: stylized-concept. Asset type: production game PBR base-color diffuse texture for a real 3D wooden pastry board in Lavender Bay cozy farming game. Generate exactly one square 1024x1024 image fully filled edge to edge by a continuous clean warm honey-maple wood surface, viewed perfectly flat perpendicular to the surface, no perspective. Attractive high quality handcrafted polished wood: long flowing horizontal fibers, very subtle wavy grain, faint tiny pores, a few naturally soft narrow growth lines, slightly varied honey and creamy amber tones. The overall average is warm pale golden honey #dfae70, comfortably light with restrained contrast. Warm handmade quality matching rounded matte Lavender Bay wood, rich and believable rather than procedural line noise. Fine detail should remain natural at a 6.5 by 4.2 world unit board. Not a rendered board object: ONLY its unlit diffuse material, all edges seamless tileable, horizontal grain continues across edges. Absolutely uniform neutral illumination: no highlights, light gradients, ambient occlusion, shadows, bevels, planks seams, edges, borders, knots with dark holes, chips, props, flour, stains, letters, text, watermark, frame, transparency.

## Linen prompt

Use case: stylized-concept. Asset type: production game PBR base-color diffuse texture for a real 3D lavender linen bakehouse tablecloth, Lavender Bay cozy farming game. Generate one square 1024x1024 seamless tileable image, perfectly straight perpendicular macro view, fully filled by fine woven washed linen. A beautiful soft muted lavender and warm cream woven gingham: gentle medium broad square checks woven into the cloth, subtly irregular natural warp/weft fibers and threads, tactile tiny slubs, understated artisan linen, a little variation so it is not a perfect computer grid. Dominant dusty soft lavender #baa4bc and ivory-lilac #d5c3cf, restrained contrast, warm matte cloth. The pattern must repeat seamlessly on both axes; evenly spaced matching check bands must meet at every image edge. The complete 1024 texture will repeat 3x3 on a tabletop, so keep the checks comfortably broad, e.g. four checks across. Texture is the material ONLY, no fabric border, folds, drape, shadows, directional light, highlights, ambient occlusion, perspective, table, props, fringe, embroidery, text, watermark or transparency. Uniform flat neutral illumination and exquisite natural textile detail.

## Dough prompt

Use case: stylized-concept. Asset type: production game PBR base-color diffuse texture for deforming raw wheat pastry dough in a real interactive 3D bakehouse, Lavender Bay cozy farming game. Exactly one square 1024x1024 image completely filled by a seamless tileable raw soft wheat dough surface, perfectly perpendicular close macro view. Pale warm creamy wheat ivory with overall average #f1dfb7, very low contrast, smooth kneaded dough with tiny irregular soft pinprick pores, faint gluten fiber variation, occasional dusting of tiny flour particles, minuscule restrained organic surface variation. Delicious soft supple matte dough, subtle real material detail, no enormous bubbles, cracks or overly grainy noise. Uniform very diffuse neutral illumination so shape and finger dents will come from the live 3D mesh and its own lights. This is ONLY a material texture, not a dough ball, not a scene, no depth or rendered silhouette. All edges seamlessly tileable, no vignettes or lighting gradients, no shadows, highlights, scoring cuts, baked crust, plate, board, hands, props, labels, text, watermark or transparency. A sophisticated low-contrast texture whose pores can also serve as a very gentle bump map.

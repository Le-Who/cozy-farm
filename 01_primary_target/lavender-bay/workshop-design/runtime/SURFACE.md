# Authored live dough surface

## Runtime API

`createWorkshopSurface()` from `game/src/workshop-surface.ts` returns shared `raw` and `cut` MeshStandardMaterial instances, `setBaked(amount)`, reusable `invalidateGraphics()`, and terminal idempotent `dispose()`.

Both materials have transparent=true, opacity=1, vertexColors=false and normal standard-material depth testing/writing. The caller owns mesh renderOrder and deformation. Replace the former whole-material colour interpolation with `surface.setBaked(amount)`; raw and cut share the same baked-progress uniform. A finite amount is clamped to0…1; nonfinite values reset to0. Calls after disposal do nothing.

The helper loads its three local textures through import.meta.env.BASE_URL. In a non-DOM verification environment it uses authored-colour placeholder textures and performs no load. Load failures retain the fallback surface. Every material, loaded texture, bump clone and fallback belongs to the helper and is disposed by it.

On context loss, `invalidateGraphics()` retires GPU allocations while retaining CPU images, material settings and the shared bake uniform. The scene retires the complete old renderer during loss and creates a fresh renderer on the same canvas after recovery. This clears old-generation disposal listeners and private VSM buffers. Terminal `dispose()` additionally prevents future loading/state updates. Production checks cover repeated native loss/restore, orientation during loss, closing while lost and reopening with no GL warnings.

## Material intent

Raw is pale ivory with generated fine gluten and flour detail. Fresh cuts use a separate dense moist fibrous interior with minute air pinpricks, not baked breadcrumb. The diffuse maps are calibrated by their measured mean colour into the master ivory palette under the warm bakehouse lights; local RGB texture variation remains. The outer map's low-contrast pores provide a separate non-colour bump texture, while the interior uses half the bump strength.

Baking uses the generated crust map with a localized transition that reaches sides and geometric ridges first. A restrained toast mask varies with actual interpolated geometry normals/curvature and local material variation; lighter flour islands remain visible. Cut interiors retain a pale dense crumb as the neighbouring outside surface becomes honey gold. Roughness varies modestly between moist dough, matte flour and crust. A small material-local emissive scatter floor prevents a hard cold/black underside without changing scene lighting or the unlit art background.

The standard normal fragment chunks are preserved. Geometry deformation and its updated normals remain authoritative; no displacement is added. Material roughness/bump supplies only the fine surface scale, while the runtime owner supplies real folds, wrinkles and braid geometry.

The material supports both the original scene lighting and the runtime owner's ACESFilmicToneMapping at exposure1. Final visual acceptance must use the assembled authored bakehouse rather than isolated neutral lighting.

## Assets and provenance

All runtime maps are1024 ×1024 lossless RGB WebP under `game/public/art/lavender/workshop-authored/`. Original1254 ×1254 PNGs are preserved alongside this document:

- `dough-raw-surface.webp`, source `dough-raw-surface-source.png`, generated `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-ddd81c50-d25e-4b46-ac4a-688e53b78c98.png`.
- `dough-cut-surface.webp`, source `dough-cut-surface-source.png`, generated `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-123f9eaf-5068-4ed5-b5d5-f313d99269d0.png`.
- `dough-baked-surface.webp`, source `dough-baked-surface-source.png`, generated `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-29e9f365-116a-4f35-9f15-9d6b00215b1b.png`.

Generated with built-in ImageGen, using approved sheets02 and03 as references. All sources were visually inspected. Asset processing only resized with Lanczos and encoded losslessly; colour calibration happens in the actual material shader. These opaque maps do not require alpha.

## Verification

- TypeScript: `./node_modules/.bin/tsc --noEmit` from `game/`, passed.
- Read-only Node API exercise instantiated the helper without DOM, compiled both onBeforeCompile hooks against THREE.ShaderLib.standard, checked transparent/opacity/vertexColors, shared baked uniform, finite clamps includingNaN, preservation of standard normal chunks, and double dispose of raw/cut. Passed.
- Assembled scene shader compilation and visual acceptance are coordinated with workshop_runtime/root; no additional browser was opened by this lane.

## Production lighting calibration

The first assembled material compiled cleanly but looked chalky under the original high ambient/overhead lighting. The scene owner changed illumination to hemi1.2, key at(-5,8,4), fill0.55 with ACES exposure1. Lower-light shots `output/playwright/workshop-art-sculpt-raw.png` and `workshop-art-sculpt-fold.png` revealed the real folded lip but still showed an overly matte surface.

The surface-only refinement uses raw roughness0.61 and cut0.68, with local flour adding up to0.23 roughness. Fine gluten variation rises from0.72 to0.88 and bump becomes0.014 raw /0.007 cut. Ivory targets are #ecdcc2 raw /#e9ddc8 cut; source bitmaps are unchanged. The emissive scatter floor was reduced from0.065 to0.042, preserving directional volume rather than brightening it away. A very small grain-masked dust contribution is restricted to actual geometric concavities, measured from position/normal derivatives. No geometry normals or light parameters are changed by the module.

The assembled follow-up `output/playwright/workshop-art-light-surface-fold.png` was inspected after this refinement. The fold shading and underside remain soft, but the large mostly planar upper surface still reads more as a flour-dusted sheet than the lifted moist gluten folds of02/03. Final art acceptance is intentionally left to the next assembled view with the dedicated sculpt geometry. No further bitmap darkening or emissive increase was used to disguise that geometry difference.

## Implicit-mesh surface refinement

The later implicit geometry maps UVs from XZ. On vertical walls and ridges that projection compresses the skin texture into almost one line; this was visible in `workshop-art-implicit-raw.png` and `workshop-art-implicit-fold.png` as blank grey sides against the warm authored room. Surface v3 samples skin and crust triplanarly from the current local position and geometric normal, so vertical portions retain fine gluten/flour detail without altering the rest UVs or sculpt geometry. The original normal chunk remains; a very small derivative bump supplements only the side projection.

Raw roughness is0.56, cut0.64; existing local matte flour strength stays0.23. Ivory bitmap and palette targets are unchanged. The material slightly warms only indirect diffuse on sides/creases to account for the nearby wooden board; it does not increase emissive, repaint the bitmap or change the global scene. Shared material/API and bake transition remain unchanged.

## Final assembled calibration

The final play-scale pass uses raw ivory #f7dda9 and cut ivory #eee0c7, raw roughness0.42 / cut0.61. Flour locally adds up to0.34 roughness; the lower clamp is0.34, so moist regions can catch the warm window light while flour stays matte. Triplanar skin sampling, finite bake progress and the restrained scatter floor remain. This is material-local calibration against the assembled room; source bitmap pixels and the room palette are unchanged.

The rolling-pin sprite keeps the authored luminance/silhouette stable while the surface pattern moves. Rotating its complete painted RGB also rotated its embedded shadow and made the cylinder look hollow. A luminance-preserving remap and the original parking orientation avoid this artefact.

## Raw texture prompt

Use case: stylized-concept. Asset type: premium seamless unlit diffuse material texture for the live deformable RAW dough in the approved Lavender Bay bakehouse. Reference1 is the accepted material/tool board; reference2 shows exact raw kneading and fresh-cut state. Generate only the raw material surface, NOT the scene or the dough ball. Square1024x1024, all pixels filled, perfectly perpendicular flat material capture, tileable all edges. The raw dough should be soft warm IVORY and PALE CREAM, subtle high quality moist wheat dough with extremely fine flowing gluten fibre texture, tiny pinprick pores, delicate uneven white flour dust. Averagecolour approximately sRGB#eee4d2 (238,228,210), very low contrast, almost neutral creamy pale wheat, not yellow, orange, golden or baked. Subtle fibrous structure and tiny flour islands should survive at game close-up without reading as sandy noise, swirls, big folds, bread crumb or giant bubbles. No large dough wrinkles or finger imprints: real mesh supplies these. Uniform neutral illumination, absolutely no directional light, highlights, shadows, depth silhouette or perspective. No objects, plate, board, hands, letters, border, watermark or transparency. A final-quality delicate PBR base colour texture for the exact master dough under warm window lighting.

## Cut texture prompt

Use case: stylized-concept. Asset type: seamless unlit diffuse texture for a newly CUT FACE of RAW unbaked dough, Lavender Bay bakehouse. Match the dense moist raw cut portions in reference1 and reference2. Square1024x1024, perfectly perpendicular flat material surface, tileable all edges. Dense soft supple PALE CREAM IVORY wheat interior with very fine stretched gluten fibres in short irregular directions, minute knife-smear ridges, occasional extremely tiny air pinpricks and subtle damp matte sheen represented only through low-contrast texture. Averagecolour aboutsRGB#e9dfcc (233,223,204), NO yellow-orange cast. Clearly fresh UNBAKED dough interior, not baked breadcrumb: no large pores, no sponge pattern, no large holes, no flaky crust, no toasted lines. Refined realistic-stylized material detail matching the approved painterly cozy game, extremely restrained fine fibres. Uniform neutral illumination, no baked lighting, shadows, directional reflections, perspective, silhouette, objects, scene, letters, labels or watermark. Opaque image filled edge to edge only by this flat material.

## Baked texture prompt

Use case: stylized-concept. Asset type: premium seamless unlit diffuse texture for honey-gold baked pastry crust in the approved Lavender Bay bakehouse. Match the finished bread surfaces in reference1 and lower-right reference2. Square1024x1024, perfectly perpendicular flat material, tileable all edges. Beautiful warm honey-gold crust with tiny irregular toasted copper ridges, delicately paler flour-dusted high points, fine crackled flaky grain and slight caramel colour variation. Mainhoneygoldcolour sRGB#dba15a, modest toasted accents around#b9773c and warm pale flour dust#f5e4c2. Rich delicious handmade crust detail with local contrast, NO black char, no heavy brown leathery bark, no giant cracks, no cuts/scores or big folds: live mesh supplies shape. No object silhouette or scene. Flat neutral diffuse illumination, no highlights, directional shadows or vignettes. No bread ball, loaf outline, board, hands, props, letters, border or watermark. Opaque seamless texture only.

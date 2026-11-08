# Authored bakehouse runtime artwork

Generated with built-in ImageGen from the approved [sheet02](../02-materials-and-tools.png) and [master01](../01-art-master.png). No runtime module, domain or main application code was changed.

## Accepted outputs

Public root: `game/public/art/lavender/workshop-authored/`.

- `bowl.webp` — empty decorated mixing bowl, 486 × 373.
- `bowl-foreground.webp` — front wall and near rim, same 486 × 373 registration.
- `spoon.webp` — complete separate wooden spoon, 438 × 378.
- `rolling-pin.webp` — full painted barrel and two handles, 509 × 310.
- `curved-knife.webp` — curved pastry blade and arch handle, 469 × 345.
- `scraper.webp` — full wide blade and wooden grip, 475 × 364.
- `hand-medallion.webp` — open-palm press tool medallion, 405 × 411.
- `bake-frame.webp` — blank honey-gold button skin, 816 × 385; text remains native DOM.
- `close-medallion.webp` — close X medallion, 502 × 513.
- `mitt.webp` — lavender quilted oven mitt, 591 × 675.
- `manifest.json` — dimensions, source rectangles, contact anchors and bowl geometry registration.

All outputs are lossless RGBA WebP and preserve the generated palette. Accepted originals and every packed PNG counterpart are saved here in `runtime/`. The props source is 1536 × 1024. The UI source is 2172 × 724; its actual objects occupy unequal column widths, so they were packed from their individually measured source rectangles rather than sliced blindly into equal cells.

## Sources

- `props-atlas-source.png` copied from `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-db8a8652-f2cd-4c26-8b7f-6aca5bf0bfc1.png`.
- `ui-atlas-source.png` copied from `C:/Users/user/.codex/generated_images/01a1b48e-583b-70d1-88aa-ac18b21ead0e/exec-8141f6a1-ecc3-4396-8493-474a0d2161f1.png`.

Both generations requested true transparent backgrounds. No chroma key, background removal, recolouring or artificial replacement silhouettes were used. Packing finds substantial-alpha bounds at alpha>=32, adds12px source padding, then crops accepted RGBA pixels unchanged. Very low-alpha generated edge noise inside those rectangles is retained.

## Manifest contract

`items` keys: `bowl`, `spoon`, `rollingPin`, `curvedKnife`, `scraper`, `handMedallion`, `bakeFrame`, `closeMedallion`, `mitt`.

Each item records `url`, `width`, `height`, `sourceAtlas`, `sourceRect:{x,y,w,h}`, `pivot:{x,y}` in normalized packed coordinates, `contact:{x,y}` in packed pixels and a normalized `baseline`. Contacts are explicit authoring anchors for the pose, not inferred physical simulation points. The UI assets use centre pivots. Bake frame additionally records a native-text `contentRect` clear of the floral bow.

Bowl adds `innerRimEllipse`, `mixSurfaceEllipse` and `foregroundUrl`. All ellipse coordinates are in the exact packed bowl pixels; rotation uses image coordinates with positive y downward.

## Bowl registration and foreground

The regular inner bowl rim was measured from the accepted source, excluding the asymmetric pouring lip. Source-pixel ellipse:

`cx=229.600235, cy=172.611141, rx=185.465610, ry=79.914958, rotation=-0.0125209135 rad`.

The near-edge samples were found from the lavender/cream colour boundary; upper inner-rim samples were read from the accepted artwork. A least-squares fit has approximately1.11px RMS implicit radial error. This is a measured fit to painted artwork, not an assertion that the pouring lip is perfectly elliptical. The overlay was visually inspected: `game/.playwright-cli/workshop-bowl-ellipse-fit.png`.

The packed bowl trim starts at source(18,70), so packed centre is `(211.600235,102.611141)`. The supplied inset mix ellipse moves5px down and reduces both radii by9px. Runtime can choose a lower fill level while keeping the same opening registration.

`bowl-foreground.webp` retains the original accepted pixels at and below the near-rim half of this measured ellipse. A4× supersampled mask follows that front boundary, then multiplies the existing generated alpha. It has the exact full bowl canvas size and pivot; no scaling or repositioning was applied. Draw order: base bowl, actual 3D mix surface and ingredients, then front wall/near rim with the same registration. The deterministic mask itself is `bowl-foreground-mask.png`.

A flat-colour proxy surface was composited solely for occlusion QA: `game/.playwright-cli/workshop-bowl-occlusion-preview.jpg`; it is not a runtime substitute for the real 3D mixture.

## Alpha QA

Each accepted original was composited over a saturated blue-green background and visually inspected, including gaps in the curved knife, spoon hanging hole and mitt hanging loop. Full source previews:

- `game/.playwright-cli/workshop-authored-props-alpha.jpg`
- `game/.playwright-cli/workshop-authored-ui-alpha.jpg`

The packed alpha report is [alpha-qa.json](alpha-qa.json). Every packed item's four corners have alpha0. All complete silhouettes, both pin handles, the open bowl interior and tool blade edges were inspected. No floor or external cast shadow is present. The internal porcelain reflections and metal shading are intentionally retained from the approved art direction.

## Rolling pin grounding refinement

The initial rolling-pin contact (104,288) was an approximate authoring anchor, not a measured edge. Alpha inspection at x=104 shows the substantial silhouette ends at y=275, so that anchor left a 13px gap. The manifest now uses primary contact (60,296) and its corresponding normalized pivot. This is the accepted left handle's actual lower alpha contour in the packed 509 × 310 image.

`supportContacts` describes the left handle (60,296; rx32,ry6), lower barrel centre (280,211; rx130,ry6,rotation -0.464rad), and right handle (449,101; rx25,ry5). The contact positions are measured from alpha>=100. The barrel tangent follows the real lower contour through (190,258), (280,211), and (370,165); its ellipse radii are authored shadow extents along that tangent. Atlas coordinates add the sourceRect origin (1016,103). All points and the pivot must be transformed through the same authored sprite placement and rotation.

## Full prop atlas prompt

Use case: stylized-concept. Asset type: production RGBA sprite atlas for interactive Three.js props in the Lavender Bay bakehouse.
Reference image 1 is the approved materials/tools artboard; reference image 2 is the exact approved bakery master. Recreate those exact authored silhouettes, cream ceramic glaze, lavender botanical painting, turned honey wood, subtle brushed satin steel, brass rivets, warm upper-left window light and gentle cool lavender fill. High-end detailed painterly cozy game art, crisp clean complete objects, no grey placeholder geometry.
STRICT ATLAS: exactly SIX separate complete isolated props in a 3 columns by 2 rows equal square-cell grid on a genuinely transparent canvas. Target1536x1024, each cell512x512. Reading order:
1 top-left: the EMPTY cream fluted mixing bowl with lavender rim, hand-painted lavender sprig, practical pouring lip at screen-right, fully visible glazed interior. Match the approved bowl design. View at the same three-quarter tabletop40-degree camera, interior rim a clear readable ellipse. NO spoon or ingredients inside. Bowl occupies about440x365px inside the cell with clean margin.
2 top-middle: the master's single separate wooden mixing spoon, complete oval concave spoon head, graceful long handle with hanging hole. A softly diagonal tabletop pose, full object visible, no bowl.
3 top-right: the complete approved honey-maple rolling pin with TWO turned rounded handles and correctly inset axle ends, lavender botanical painting on its barrel. Full object visible end-to-end, a gentle diagonal upward-right pose matching reference02. No cloth under it.
4 bottom-left: the master's curved crescent steel pastry knife, full satin metal blade, substantial arched honey-wood handle and two brass rivets. Exact finished silhouette, both blade and handle complete.
5 bottom-middle: the master's wide straight steel bench scraper, rounded lower blade corners, honey-wood grip across the full upper edge and two brass rivets. Complete object with restrained steel sheen.
6 bottom-right: a beautiful ROUND cream-and-honey-gold hand medallion for a native game tool button, front-facing circular cream inset surrounded by softly raised honey-gold rim, a single clear stylized warm terracotta palm/hand emblem in the centre, five fingers, refined tactile painted-game finish, no lettering.
Every item strictly within its own square cell with at least32px transparent margins; no objects touch another cell. Consistent object lighting and material tone. No labels or drawn grid.
TRUE TRANSPARENCY: alpha0 background and all gaps outside the objects, including between handles/knife blade if open. Do not draw ANY backdrop, cream paper, cloth, floor, cast shadow, ground shadow, pedestal, flour spills, decorations, loose flowers, leaves, or additional items. Shading within the objects is essential; external shadows are forbidden. No text, logos, watermark. No baked mockup or gameplay scene. Only six isolated complete RGBA props, each large enough to retain the approved artwork's craft at runtime.

## Full UI atlas prompt

Use case: stylized-concept. Asset type: production transparent game UI art atlas matching the Lavender Bay bakehouse master.
Use both references for exact warm cream, honey gold, lavender and crafted rounded painterly material quality.
Exactly THREE isolated UI assets in a strict 3 columns x1 row equal square-cell grid, target1536x512. Real transparent background, no external shadows, no floor, no paper, no labels.
Cell1: a beautiful wide horizontal BLANK honey-gold Bake-button FRAME, approximately440px wide and160px high, with softly rounded sculpted corners, double inset rim, warm biscuit/cream inner face with plenty of empty room for native DOM text. No wording, letters, icons or symbols inside. Match the master UI's craft; the whole button silhouette is visible.
Cell2: a round cream medallion with honey-gold raised double rim and a single warm burnt-honey X close symbol, clearly centred. Exactly one X icon, no other text. Complete circular silhouette, approx300pxdiameter.
Cell3: one charming complete quilted oven-mitt icon, muted lavender gingham with cream cuff/trim, small lavender botanical embroidery, full mitten and thumb visible, approx340pxtall. Cozy detailed painted fabric matching the approved baker's cloth, no hand or arm.
Each object centred in its own512squarecell, full silhouette and at least32px transparent margins. Lighting soft upper left, gently cool lavender fill, subtle internal shading and bevels only. Alpha0 everywhere outside the assets. No cast shadows or mockup backgrounds. Production-quality final raster artwork, no procedural/vector-looking primitive outlines.

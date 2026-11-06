#!/usr/bin/env python3
"""
Slice a 6x5 texture reference atlas into named tiles.
Usage:
  python slice_texture_atlas.py input.png output_dir

Notes:
- This script assumes a regular 6x5 visual grid.
- If the source atlas contains card borders/shadows, review outputs manually.
- Production tiles must not include board background, gutters, labels, or shadows.
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image

TILE_NAMES = [
    "01_grass_clean.png", "02_grass_flowers.png", "03_dirt_cliff.png", "04_dirt_path_clean.png", "05_dirt_path_stones.png", "06_stone_path.png",
    "07_dark_crop_soil.png", "08_furrowed_soil.png", "09_farmhouse_plaster.png", "10_warm_wood.png", "11_dark_wood.png", "12_purple_roof_tiles.png",
    "13_wooden_fence.png", "14_market_canopy_purple_white.png", "15_stone_bricks.png", "16_well_stone.png", "17_hay_straw.png", "18_water_surface.png",
    "19_hedge_leaves.png", "20_flower_patch.png", "21_carrot_crop_texture.png", "22_cabbage_crop_texture.png", "23_beetroot_crop_texture.png", "24_tomato_crop_texture.png",
    "25_pumpkin_crop_texture.png", "26_wheat_crop_texture.png", "27_leafy_greens_texture.png", "28_seedling_patch.png", "29_rocky_ground.png", "30_orchard_ground.png",
]

COLS = 6
ROWS = 5


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python slice_texture_atlas.py input.png output_dir", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGBA")
    w, h = img.size
    cell_w = w / COLS
    cell_h = h / ROWS

    manifest = []
    idx = 0
    for row in range(ROWS):
        for col in range(COLS):
            name = TILE_NAMES[idx]
            # Crop slightly inside each grid cell to avoid gutters/card background.
            left = round(col * cell_w + cell_w * 0.04)
            top = round(row * cell_h + cell_h * 0.04)
            right = round((col + 1) * cell_w - cell_w * 0.04)
            bottom = round((row + 1) * cell_h - cell_h * 0.04)
            tile = img.crop((left, top, right, bottom))
            # Normalize to square by center-cropping then resizing to 512.
            tw, th = tile.size
            side = min(tw, th)
            ox = (tw - side) // 2
            oy = (th - side) // 2
            tile = tile.crop((ox, oy, ox + side, oy + side)).resize((512, 512), Image.Resampling.LANCZOS)
            tile.save(out / name)
            manifest.append({
                "id": name.removesuffix(".png")[3:],
                "filename": name,
                "row": row,
                "col": col,
                "source": str(src),
                "requiresManualQA": True,
            })
            idx += 1

    import json
    (out / "texture_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(manifest)} tiles to {out}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

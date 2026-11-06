#!/usr/bin/env python3
"""
Slice transparent UI sheets by connected components.
Usage:
  python slice_ui_connected_components.py input.png output_dir

Production rule:
- Reject assets with baked-in text, numbers, key labels, or filled progress bars.
- Use this script only for blank sheets or for rough extraction before manual QA.
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image
from collections import deque

ALPHA_THRESHOLD = 12
MIN_AREA = 256
PADDING = 8


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python slice_ui_connected_components.py input.png output_dir", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGBA")
    w, h = img.size
    alpha = img.getchannel("A")
    visited = bytearray(w * h)

    def is_fg(x: int, y: int) -> bool:
        return alpha.getpixel((x, y)) > ALPHA_THRESHOLD

    components = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if visited[i] or not is_fg(x, y):
                visited[i] = 1
                continue
            q = deque([(x, y)])
            visited[i] = 1
            xs, ys = [], []
            while q:
                cx, cy = q.popleft()
                xs.append(cx); ys.append(cy)
                for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        ni = ny * w + nx
                        if not visited[ni] and is_fg(nx, ny):
                            visited[ni] = 1
                            q.append((nx, ny))
                        else:
                            visited[ni] = 1 if not is_fg(nx, ny) else visited[ni]
            if len(xs) >= MIN_AREA:
                x1, x2 = max(0, min(xs)-PADDING), min(w, max(xs)+PADDING+1)
                y1, y2 = max(0, min(ys)-PADDING), min(h, max(ys)+PADDING+1)
                components.append((x1, y1, x2, y2, len(xs)))

    # Sort top-to-bottom, left-to-right.
    components.sort(key=lambda b: (b[1], b[0]))
    manifest = []
    for idx, (x1, y1, x2, y2, area) in enumerate(components, start=1):
        crop = img.crop((x1, y1, x2, y2))
        name = f"ui_component_{idx:02d}.png"
        crop.save(out / name)
        manifest.append({"id": f"ui_component_{idx:02d}", "filename": name, "bbox": [x1, y1, x2, y2], "area": area, "manualQA": True})

    import json
    (out / "ui_component_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(manifest)} components to {out}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

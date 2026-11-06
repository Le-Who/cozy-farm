#!/usr/bin/env python3
"""
Generate a basic asset verification report for PNGs in a folder.
Usage:
  python verify_assets.py asset_dir report.md
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python verify_assets.py asset_dir report.md", file=sys.stderr)
        return 2
    root = Path(sys.argv[1])
    report = Path(sys.argv[2])
    lines = ["# Asset verification report", ""]
    for path in sorted(root.rglob("*.png")):
        try:
            img = Image.open(path)
            w, h = img.size
            has_alpha = img.mode in ("RGBA", "LA") or ("transparency" in img.info)
            lines.append(f"- `{path.relative_to(root)}` — {w}×{h}, mode={img.mode}, alpha={has_alpha}")
        except Exception as exc:
            lines.append(f"- `{path.relative_to(root)}` — ERROR: {exc}")
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {report}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

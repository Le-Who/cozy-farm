"""Rebuild lean runtime WebP derivatives from the committed art, never the masters.

Run from game/: python scripts/optimize-runtime-art.py --apply
Requires Pillow and NumPy. The pinned revision makes the operation reproducible;
original authoring images under 01_primary_target are never modified.
"""

import argparse
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tarfile

import numpy as np
from PIL import Image, ImageDraw

BASELINE = "2df0eec51cf842baf63293a6ab70e6560e8f0509"
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "game/public/art"
REPORT = ROOT / "08_docs/runtime-art-optimization.json"
PREVIEW = ROOT / "output/performance/art-comparison.png"
FOOD_UI = {"ui-tart", "ui-orchard-preserves", "ui-handmade-round", "ui-handmade-long", "ui-handmade-folded",
           "ui-honey-biscuits", "ui-honey-cake", "ui-honey-pear", "ui-wind-parfait", "ui-grilled-fish",
           "ui-farmhouse-bread", "ui-strawberry-tart", "ui-blueberry-tart", "ui-raspberry-tart"}
SMALL_PROPS = {"tea-cup", "tea-flowers", "tea-tart", "picnic-cup", "picnic-napkin"}
PNG_STEMS = {"fishing-underwater-v1", "fishing-kelp-v1", "fishing-perch-v1", "fishing-sea-bass-v1"}


def target_size(path, image):
    limit = max(image.size)
    # Food UI is also drawn in the physical assembly scene. Keep that resolution.
    if path.parent == ART / "lavender" and path.stem.startswith("ui-") and path.stem not in FOOD_UI:
        limit = 384
    if path.parent == ART / "icons" and path.stem != "egg":
        limit = 256
    # At desktop play scale these loose pieces occupy <350 CSS px. Containers,
    # masks, atlases, per-pixel cooking anchors and full-screen art keep dimensions.
    if path.parent == ART / "lavender/assembly/raster" and path.stem in SMALL_PROPS:
        limit = 768
    scale = min(1, limit / max(image.size))
    return tuple(max(1, round(side * scale)) for side in image.size)


def bounds(image, threshold=40):
    return image.getchannel("A").point(lambda a: 255 if a >= threshold else 0).getbbox()


def normalize(box, size):
    return [box[0] / size[0], box[1] / size[1], box[2] / size[0], box[3] / size[1]] if box else None


def psnr(a, b):
    # Compare visible RGB on both light and dark backdrops at actual play scale.
    values = []
    for color in ("#eee4d4", "#302b45"):
        def composite(image):
            bg = Image.new("RGBA", image.size, color)
            return np.asarray(Image.alpha_composite(bg, image).convert("RGB"), dtype=np.float32)
        mse = float(np.mean((composite(a) - composite(b)) ** 2))
        values.append(round(10 * np.log10(255 ** 2 / mse), 2) if mse else 99.0)
    return min(values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    rows, comparisons = [], []
    archive = tarfile.open(fileobj=BytesIO(subprocess.check_output(["git", "archive", BASELINE, "game/public/art"], cwd=ROOT)))
    for member in archive.getmembers():
        path = ROOT / member.name
        if not member.isfile() or not (path.suffix == ".webp" or path.stem in PNG_STEMS):
            continue
        # Registered patch/occlusion pairs must retain identical RGB at boundaries.
        if any(key in path.stem for key in ("occluder", "occlusion", "patch", "plate")):
            continue
        original = archive.extractfile(member).read()
        before = Image.open(BytesIO(original)).convert("RGBA")
        size = target_size(path, before)
        if len(original) < 50000 and size == before.size:
            continue
        # Do not add another lossy generation to already compressed derivatives.
        if path.suffix == ".webp" and b"VP8L" not in original[:128] and size == before.size:
            continue
        quality = 94 if "surface" in path.stem else 92
        display_limit = (600, 400)
        if path.parent == ART / "icons" or path.stem.startswith("ui-"):
            display_limit = (150, 150)
        elif path.parent == ART / "lavender/assembly/raster" and path.stem in SMALL_PROPS:
            display_limit = (350, 350)
        display = before.copy(); display.thumbnail(display_limit, Image.Resampling.LANCZOS)
        # Keep original resolution if uniform resizing loses visible fine detail.
        for candidate_size, candidate_quality in [(size, quality), (before.size, 96)]:
            resized = before.resize(candidate_size, Image.Resampling.LANCZOS) if candidate_size != before.size else before
            buffer = BytesIO()
            resized.save(buffer, "WEBP", quality=candidate_quality, method=4, exact=True, alpha_quality=100)
            encoded = buffer.getvalue()
            after = Image.open(BytesIO(encoded)).convert("RGBA")
            displayed_after = after.resize(display.size, Image.Resampling.LANCZOS)
            score = psnr(display, displayed_after)
            if score >= 37:
                size, quality = candidate_size, candidate_quality
                break
        else:
            raise RuntimeError(f"Visible RGB fidelity too low: {path} ({score} dB)")
        if len(encoded) >= len(original) * .90:
            continue
        alpha_exact = np.array_equal(np.asarray(resized.getchannel("A")), np.asarray(after.getchannel("A")))
        if not alpha_exact:
            raise RuntimeError(f"Alpha changed during encoding: {path}")
        old_box, new_box = normalize(bounds(before), before.size), normalize(bounds(after), after.size)
        drift = max(abs(a - b) for a, b in zip(old_box, new_box)) if old_box and new_box else 0
        if drift > .0025:
            raise RuntimeError(f"Visible bounds moved too far: {path} ({drift})")
        target = path.with_suffix(".webp")
        rows.append({"path": target.relative_to(ROOT / "game/public").as_posix(),
                     "sourcePath": path.relative_to(ROOT / "game/public").as_posix(),
                     "beforeBytes": len(original), "afterBytes": len(encoded),
                     "beforeSize": before.size, "afterSize": after.size,
                     "decodedRgbaBefore": before.width * before.height * 4,
                     "decodedRgbaAfter": after.width * after.height * 4,
                     "quality": quality, "alphaExactAfterResize": alpha_exact,
                     "normalizedAlphaBoundsMaxDrift": round(drift, 7),
                     "playScaleCompositePsnrDb": score})
        if path.name in {"home-plate.webp", "room.webp", "portrait.webp", "tea-cup.webp", "ui-bea.webp", "ui-tree-apple.webp", "dough-raw-surface.webp"}:
            comparisons.append((path.relative_to(ART).as_posix(), display, displayed_after))
        if args.apply:
            target.write_bytes(encoded)
            if target != path and path.exists():
                path.unlink()
        print(f"{path.relative_to(ART)}: {len(original)} -> {len(encoded)} bytes, {before.size} -> {size}", flush=True)

    report = {"baselineRevision": BASELINE, "encoder": "Pillow WebP quality 92 (surface maps 94, fine-detail fallback 96), method 4, exact alpha",
              "measurement": "Encoded file bytes and width*height*4 decoded RGBA estimate; not measured browser RAM or FPS. Sum includes assets that are not resident together.",
              "geometry": "Atlases, anchors, room dimensions and registered patch/occlusion RGB are retained. Five loose assembly props are uniformly downsampled; normalized alpha bounds drift is checked below 0.0025.",
              "changedFiles": len(rows), "beforeBytes": sum(r["beforeBytes"] for r in rows),
              "afterBytes": sum(r["afterBytes"] for r in rows),
              "decodedRgbaBefore": sum(r["decodedRgbaBefore"] for r in rows),
              "decodedRgbaAfter": sum(r["decodedRgbaAfter"] for r in rows), "files": rows}
    if args.apply:
        REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        # This manifest is descriptive metadata, not a source of interaction anchors.
        manifest_path = ART / "lavender/assembly/raster/manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for row in rows:
            if "/assembly/raster/" not in row["path"]:
                continue
            path = ROOT / "game/public" / row["path"]
            image = Image.open(path).convert("RGBA")
            entry = manifest[path.stem]
            entry["size"] = list(image.size)
            entry["bounds"] = list(image.getchannel("A").getbbox())
            alpha = np.asarray(image.getchannel("A"))
            entry["cornerAlpha"] = [int(alpha[y, x]) for x, y in [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]]
            entry["alphaZero"] = float(np.mean(alpha == 0))
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGB", (1240, 440 * len(comparisons)), "#eee4d4")
        draw = ImageDraw.Draw(canvas)
        for index, (name, before, after) in enumerate(comparisons):
            top = index * 440
            draw.text((10, top + 8), f"{name} | original (left) / runtime WebP (right)", fill="#302b45")
            canvas.paste(before, (10, top + 34), before)
            canvas.paste(after, (630, top + 34), after)
        canvas.save(PREVIEW)
    print(json.dumps({k: v for k, v in report.items() if k != "files"}, indent=2))


if __name__ == "__main__":
    main()

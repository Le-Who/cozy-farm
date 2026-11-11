"""Mechanical lossless crop/encoding of authored images; no generated painting.

Run from game/: python scripts/pack-village-home-art.py
The full source masters remain unchanged. Runtime patches share the original
plate's coordinate system and are never independently stretched.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = root / '01_primary_target/lavender-bay/village-home-progress'
target = root / 'game/public/art/lavender'
box = (995, 48, 1337, 358)
for name, filename in [('frame', '03-frame-source.png'), ('finishing', '04-finishing-source.png')]:
    image = Image.open(source / filename).convert('RGBA')
    # The second source omits one transparent pixel column at the far right.
    # Registration uses native coordinates, with no resize/stretch correction.
    assert image.height == 992 and image.width in (1585, 1586), image.size
    patch = image.crop(box)
    destination = target / f'village-home-{name}.webp'
    patch.save(destination, 'WEBP', lossless=True, exact=True, method=6)
    assert Image.open(destination).convert('RGBA').tobytes() == patch.tobytes()
    print(destination.name, patch.size, destination.stat().st_size)

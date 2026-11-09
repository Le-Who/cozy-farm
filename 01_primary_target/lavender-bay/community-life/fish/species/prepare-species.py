"""Pack built-in ImageGen pair sheets without repainting or changing their palette."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

source = Path(__file__).resolve().parent
root = source.parents[4]
destination = root / 'game/public/art/lavender/fish-cookery'
audit = {}
review = Image.new('RGBA', (755 * 2, 295 * 3), '#733d78')
for row, species in enumerate(('perch', 'moonfish', 'lanternfish')):
    image = Image.open(source / f'{species}-pair.png').convert('RGBA')
    rgba = np.array(image)
    # ImageGen's alpha is retained; imperceptible residue in transparent margins is removed.
    rgba[rgba[:, :, 3] <= 16] = 0
    image = Image.fromarray(rgba)
    occupied = (rgba[:, :, 3] > 64).sum(axis=1)
    low, high = image.height // 3, image.height * 2 // 3
    clear = [y for y in range(low, high) if occupied[y] == 0]
    separator = min(clear, key=lambda y: abs(y - image.height / 2))
    pieces = [image.crop((0, 0, image.width, separator)), image.crop((0, separator, image.width, image.height))]
    pieces = [piece.crop(piece.getchannel('A').getbbox()) for piece in pieces]
    max_width, max_height = max(p.width for p in pieces), max(p.height for p in pieces)
    scale = min(715 / max_width, 255 / max_height)
    cells = []
    for column, (state, piece) in enumerate(zip(('raw', 'grilled'), pieces)):
        resized = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.Resampling.LANCZOS)
        cell = Image.new('RGBA', (755, 295))
        cell.alpha_composite(resized, ((755 - resized.width) // 2, (295 - resized.height) // 2))
        cell.save(destination / f'{species}-{state}.webp', lossless=True, exact=True)
        cells.append(np.array(cell)[:, :, 3] > 128)
        alpha = np.array(cell)[:, :, 3]
        audit[f'{species}-{state}'] = {'width':755, 'height':295, 'alphaZero':round(float((alpha == 0).mean()),5), 'cornerAlpha':[int(alpha[y,x]) for y,x in ((0,0),(0,754),(294,0),(294,754))], 'visibleBounds':cell.getchannel('A').getbbox()}
        review.alpha_composite(cell, (column * 755, row * 295))
    audit[species + '-registration'] = {'silhouetteIoU':round(float((cells[0] & cells[1]).sum() / (cells[0] | cells[1]).sum()),5)}
(source / 'alpha-and-registration.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
review.save(root / 'output/playwright/fishery-species-contrast.png')
print(json.dumps(audit, indent=2))

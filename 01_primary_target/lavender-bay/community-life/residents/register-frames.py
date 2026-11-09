"""Mechanically register accepted transparent work poses; preserve their alpha."""
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / 'game/public/art/lavender/community'
OUT.mkdir(parents=True, exist_ok=True)

def register(source: Path):
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    # Measure the visible silhouette only; leave the antialiased alpha untouched.
    core = alpha.point(lambda a: 255 if a >= 100 else 0).getbbox()
    if not core:
        raise ValueError(f'Empty frame: {source}')
    x0, y0, x1, y1 = core
    scale = 228 / (y1 - y0)
    boots = alpha.crop((x0, y0 + int((y1-y0)*.88), x1, y1))
    boot_bounds = boots.point(lambda a: 255 if a >= 100 else 0).getbbox()
    foot_x = x0 + ((boot_bounds[0] + boot_bounds[2]) / 2 if boot_bounds else (x1-x0) / 2)
    # Crop with a narrow antialias margin, then rescale about the shared feet.
    left, top = max(0, x0-8), max(0, y0-8)
    cropped = image.crop((left, top, min(image.width, x1+8), min(image.height, y1+8)))
    resized = cropped.resize((round(cropped.width*scale), round(cropped.height*scale)), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (256,256))
    cell.alpha_composite(resized, (round(128-(foot_x-left)*scale), round(236-(y1-top)*scale)))
    return cell

report = {}
for resident in ('bea','finn'):
    original = Image.open(ROOT / f'game/public/art/lavender/village-{resident}.webp').convert('RGBA')
    idle = original.crop((0,0,256,256))
    social = original.crop((1280,0,1536,256))
    poses = [idle, register(HERE/f'{resident}-reach.png'), register(HERE/f'{resident}-release.png'), idle,
             register(HERE/f'{resident}-cloth.png' if resident == 'bea' else HERE/f'{resident}-lantern.png'), social]
    sheet = Image.new('RGBA',(768,512))
    for i, pose in enumerate(poses):
        sheet.alpha_composite(pose, ((i%3)*256,(i//3)*256))
    sheet.save(OUT/f'{resident}-work.webp',lossless=True)
    report[resident] = {'grid':[3,2], 'cell':[256,256], 'footBaseline':236,
                        'alphaOutside':[poses[i].getpixel((0,0))[3] for i in range(6)]}

props = Image.open(HERE/'props-source.png').convert('RGBA')
props.resize((1024,1024),Image.Resampling.LANCZOS).save(OUT/'props.webp',lossless=True)
report['props']={'grid':[2,2], 'cell':[512,512], 'baseline':.94,
                 'frames':['teaTray','picnicBasket','shoreLantern','memoryPitcher']}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))

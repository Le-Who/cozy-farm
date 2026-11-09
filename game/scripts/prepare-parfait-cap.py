"""Restore the full authored crest that crosses the honey props atlas row.

Keep the existing 512-square glass registration in the bottom 512 rows and add
128 transparent rows above it. The runtime's extended UVs sample that cap.
"""
from io import BytesIO
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root=Path(__file__).resolve().parents[2]
master=root/'01_primary_target/lavender-bay/culinary-cove-expansion/runtime-sources/honey-props.png'
target=root/'game/public/art/lavender/cookery/honey-parfait-full.webp'
source=Image.open(master).convert('RGBA')
alpha=source.getchannel('A')
mask=alpha.point(lambda a:255 if a>=32 else 0)
draw=ImageDraw.Draw(mask)
draw.rectangle((0,0,314,source.height-1),fill=0)
draw.rectangle((631,0,source.width-1,source.height-1),fill=0)
draw.rectangle((0,0,source.width-1,850),fill=0)
ImageDraw.floodfill(mask,(480,1080),128,border=0)
component=mask.point(lambda v:255 if v==128 else 0).filter(ImageFilter.MaxFilter(7))
source.putalpha(Image.fromarray(np.where(np.asarray(component)>0,np.asarray(alpha),0).astype('uint8')))
cell=(source.width/4,source.height*3/4,source.width/2,source.height)
cap=source.transform((512,640),Image.Transform.EXTENT,(cell[0],cell[1]-(cell[3]-cell[1])*.25,cell[2],cell[3]),Image.Resampling.BICUBIC)
original=Image.open(BytesIO(subprocess.check_output(['git','show','2df0eec:game/public/art/lavender/cookery/honey-parfait-full.webp'],cwd=root))).convert('RGBA')
registered=Image.new('RGBA',(512,640));registered.alpha_composite(original,(0,128))
# The old crop remains pixel-registered below a short, feathered join.
blend=Image.new('L',(512,640),255)
for y in range(128,141):ImageDraw.Draw(blend).line((0,y,511,y),fill=round((140-y)/12*255))
ImageDraw.Draw(blend).rectangle((0,141,511,639),fill=0)
result=Image.composite(cap,registered,blend)
result.save(target,'WEBP',quality=94,method=4,exact=True,alpha_quality=100)
decoded=Image.open(target).convert('RGBA')
assert decoded.size==(512,640)
assert np.array_equal(np.asarray(decoded.getchannel('A')),np.asarray(result.getchannel('A')))
assert not np.asarray(decoded.getchannel('A'))[0].any(),'complete crest needs transparent headroom'
manifest_path=target.parent/'manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['items']['honey-parfait-full'].update(width=512,height=640)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report_path=root/'08_docs/runtime-art-optimization.json'
if report_path.exists():
    report=json.loads(report_path.read_text(encoding='utf-8'))
    report['postOptimizationRepairs']=[{'path':'art/lavender/cookery/honey-parfait-full.webp','reason':'Restored complete authored crest from the original master, retaining the original lower glass registration','size':[512,640],'bytes':target.stat().st_size,'source':str(master.relative_to(root)).replace('\\','/')}]
    current=[p for p in (root/'game/public/art').rglob('*') if p.suffix in ('.webp','.png')]
    report['currentRasterBytes']=sum(p.stat().st_size for p in current)
    report['currentDecodedRgbaEstimate']=sum(Image.open(p).width*Image.open(p).height*4 for p in current)
    report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f'{target.name}: 512x640, {target.stat().st_size} bytes; full source cap restored, glass registration retained')

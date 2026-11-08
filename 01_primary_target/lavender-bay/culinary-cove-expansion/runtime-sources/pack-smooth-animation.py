from PIL import Image
from pathlib import Path
import json
root=next(parent for parent in Path(__file__).resolve().parents if (parent/'game').is_dir())
gen=root/'01_primary_target/lavender-bay/culinary-cove-expansion/runtime-sources'
items=[
('walk-left-smooth','exec-5c8adb78-c23c-4ec8-bbd9-8ae2cb35d349.png',8,192,160,126,144),
('walk-right-smooth','exec-43c3860a-d9ab-4ea4-bf1c-069460fc5d8d.png',8,192,160,126,144),
('walk-back-smooth','exec-65f75687-9141-4859-8e4c-0ea778844b0a.png',8,192,160,133,144),
('hen-walk-smooth','exec-18b89989-fab9-47a3-a5c1-19d89275bd6b.png',8,128,128,95,112),
('shore-crab-walk','exec-d683d5bf-02c3-4df5-b086-b1fa796dcf4a.png',4,128,128,66,118)]
metadata=[]
for name,filename,count,cw,ch,targetheight,baseline in items:
 im=Image.open(gen/f'{name}-raw.png').convert('RGBA')
 cells=[im.crop((round(i*im.width/count),0,round((i+1)*im.width/count),im.height)) for i in range(count)]
 boxes=[c.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for c in cells]
 scale=targetheight/max(b[3]-b[1] for b in boxes)
 out=Image.new('RGBA',(count*cw,ch))
 for i,(c,b) in enumerate(zip(cells,boxes)):
  cut=c.crop((max(0,b[0]-2),max(0,b[1]-2),min(c.width,b[2]+2),min(c.height,b[3]+2)))
  cut=cut.resize((round(cut.width*scale),round(cut.height*scale)),Image.Resampling.LANCZOS)
  out.alpha_composite(cut,(i*cw+cw//2-cut.width//2,baseline+1-cut.height))
 out.save(root/'game/public/art/lavender'/f'{name}.webp',lossless=True)
 bg=Image.new('RGBA',out.size,'#f5edda');bg.alpha_composite(out);bg.convert('RGB').save(root/'output/playwright'/f'{name}-cream.png')
 metadata.append(dict(name=name,frames=count,cell=[cw,ch],baseline=baseline,uniformScale=scale,sourceBoxes=boxes,packedBoxes=[out.crop((i*cw,0,(i+1)*cw,ch)).getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for i in range(count)]))
(root/'output/playwright/smooth-animation-asset-metadata.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata))

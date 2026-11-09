from PIL import Image
from pathlib import Path
import json,numpy as np
base=Path(r'E:/Projects/Cozy Farm/game/public/art/lavender/fish-cookery')
files=['fish-raw','fish-grilled','board','plate','salt','spatula','carrot-0','carrot-1','carrot-2','pan-front-wall']
manifest={'version':1,'generator':'built-in image_gen, transparent_background:true for all cutouts','reference':'01_primary_target/lavender-bay/community-life/fish/01-fish-kitchen-master.png','pan':{'url':'pan-front-wall.webp','source':'08-pan-front-wall.png','projection':'single camera-facing authored40degree static prop','cavityAnchor':[.418,.596],'depthWrite':False},'assets':{}}
for name in files:
 im=Image.open(base/(name+'.webp')).convert('RGBA');a=np.array(im.getchannel('A'));manifest['assets'][name]={'url':name+'.webp','width':im.width,'height':im.height,'alphaZero':round(float((a==0).mean()),5),'alphaSolid':round(float((a>240).mean()),5),'cornerAlpha':[int(a[y,x]) for y,x in [(0,0),(0,-1),(-1,0),(-1,-1)]]}
(base/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest['assets'],indent=2))

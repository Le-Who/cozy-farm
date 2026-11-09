from PIL import Image, ImageFilter
from collections import deque
from pathlib import Path
import numpy as np
base=Path(r'E:/Projects/Cozy Farm/game/public/art/lavender/fish-cookery')
for name in ['carrot-0','carrot-1','carrot-2']:
 p=Image.open(base/(name+'.webp')).convert('RGBA');a=np.array(p.getchannel('A'));solid=a>80;seen=np.zeros(solid.shape,bool);groups=[]
 for y,x in zip(*np.nonzero(solid)):
  if seen[y,x]:continue
  q=deque([(y,x)]);seen[y,x]=True;group=[]
  while q:
   cy,cx=q.popleft();group.append((cy,cx))
   for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
    ny,nx=cy+dy,cx+dx
    if 0<=ny<a.shape[0] and 0<=nx<a.shape[1] and solid[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((ny,nx))
  groups.append(group)
 largest=max(groups,key=len);mask=np.zeros(a.shape,dtype='uint8')
 for y,x in largest:mask[y,x]=255
 mask=np.array(Image.fromarray(mask).filter(ImageFilter.MaxFilter(5)))>0;a[~mask]=0;p.putalpha(Image.fromarray(a));p.save(base/(name+'.webp'),quality=95);print(name,[len(g) for g in groups if len(g)>5])

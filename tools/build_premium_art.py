"""Build decorative-only artworks from previously approved concept illustration.
Every crop avoids rendered headings, buttons, metrics or menus. Live UI remains DOM."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import math, random
src=Image.open('/mnt/data/a_colorful_high_quality_cartoon_3d_2.5d_illustra.png').convert('RGB')
base=Path(__file__).resolve().parents[1]/'public/art'
base.mkdir(exist_ok=True,parents=True)
# Real standalone scenic locations without any fake interface.
regions={'premium-island-math':(286,305,598,541),'premium-island-memory':(605,351,970,555),'premium-island-sentence':(1020,306,1306,555)}
for name,r in regions.items():
    crop=src.crop(r).resize((780,590), Image.Resampling.LANCZOS)
    # feather edges so art integrates with CSS-built floating island silhouettes
    mask=Image.new('L',crop.size,0);draw=ImageDraw.Draw(mask)
    draw.ellipse((25,12,755,590),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(31))
    crop.putalpha(mask)
    crop.save(base/(name+'.png'),optimize=True)
# Fox foreground scene crop (no pre-rendered labels).
fox=src.crop((0,287,307,611)).resize((510,540), Image.Resampling.LANCZOS)
mask=Image.new('L',fox.size,0); d=ImageDraw.Draw(mask)
poly=[(9,112),(33,66),(83,63),(114,12),(201,31),(267,3),(337,38),(384,101),(443,157),(492,240),(492,330),(448,418),(396,465),(333,503),(239,537),(142,533),(75,497),(30,435),(0,331)]
d.polygon(poly,fill=255); mask=mask.filter(ImageFilter.GaussianBlur(18));fox.putalpha(mask)
fox.save(base/'premium-fox.png',optimize=True)
# Sky + scenic cliffs and waterfalls: no embedded text or UI. Independent crops are feather-blended
# onto a high resolution atmospheric background. The center source band only contains landscape.
w,h=1920,1100
background=Image.new('RGB',(w,h)); px=background.load()
random.seed(8)
for y in range(h):
    t=y/h
    if t<.55:
        u=t/.55; a=(74,170,245);b=(166,230,255)
    else:
        u=(t-.55)/.45;a=(166,230,255);b=(18,147,211)
    row=tuple(int(a[i]*(1-u)+b[i]*u) for i in range(3))
    for x in range(w):
        v=7*math.sin(x/100+y/150)+5*math.sin(x/240-y/120)
        px[x,y]=tuple(max(0,min(255,int(k+v))) for k in row)
# Layer sky/castle scenic fragments x/y coordinates exclude title and UI.
def layer(rect,box,blur=58,opacity=235):
    global background
    im=src.crop(rect).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
    alpha=Image.new('L',im.size,0); pix=alpha.load();ow,oh=im.size
    for yy in range(oh):
        vy=min(1,yy/blur,(oh-1-yy)/blur)
        for xx in range(ow):
            vx=min(1,xx/blur,(ow-1-xx)/blur)
            pix[xx,yy]=round(opacity*max(0,min(vx,vy))**.75)
    background.paste(im,(box[0],box[1]),alpha)
# Top half remains clean blue sky for readable live headings and navigation.
# Rich landscape with three island scenes across water (no labels or fake buttons).
layer((506,345,1120,488),(275,320,1660,800),blur=170,opacity=195)
# small waterfall-rich fragments add depth to bottom corners
# Extra panels are deliberately excluded because they contain baked UI controls.
background=ImageEnhance.Color(background).enhance(1.15)
background.save(base/'premium-world-scene.webp',quality=87,method=6)
print('assets written',[(p.name,p.stat().st_size) for p in sorted(base.glob('premium*'))])

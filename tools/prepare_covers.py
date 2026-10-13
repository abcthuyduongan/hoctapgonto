from pathlib import Path
from PIL import Image,ImageOps,ImageEnhance
base=Path(__file__).resolve().parents[1]/'public'/'art'
# Crop only the illustration portion; no screenshot UI or pre-rendered controls.
for name,box in {
    'math':(0,38,480,260),
    'memory':(0,77,480,330),
    'sentence':(0,58,480,338),
}.items():
    im=Image.open(base/f'cover-{name}.webp').convert('RGB').crop(box)
    im=ImageOps.fit(im,(820,520),method=Image.Resampling.LANCZOS,centering=(.5,.40))
    im=ImageEnhance.Color(im).enhance(1.08)
    im.save(base/f'original-cover-{name}.webp',quality=92,method=6)
print('Created 3 standalone illustration crops for cards (no game buttons or fixed titles).')

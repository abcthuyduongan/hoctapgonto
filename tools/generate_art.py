"""Reproducible decorative game-stage art. No text or simulated UI controls.
All interactive elements are rendered in React over these image layers.
"""
from pathlib import Path
from random import Random
from math import sin
import cairosvg

DEST=Path(__file__).resolve().parents[1]/'public'/'art'
W,H=1600,900

def shape_circle(x,y,r,color,opacity=1):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" opacity="{opacity}"/>'
def ellipse(x,y,rx,ry,fill,opacity=1):
 return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" opacity="{opacity}"/>'
def cloud(x,y,s):
 return f'<g opacity=".86" filter="url(#cloudshadow)">{ellipse(x,y,140*s,37*s,"#ffffff",.87)}{ellipse(x-57*s,y-25*s,61*s,46*s,"#ffffff")}{ellipse(x+15*s,y-41*s,83*s,57*s,"#ffffff")}{ellipse(x+83*s,y-20*s,57*s,42*s,"#ffffff")}</g>'
def island(x,y,s,r):
 return f'''<g transform="translate({x} {y}) scale({s})" filter="url(#softshadow)">
 <path d="M-240 0 Q-180 -45 0 -50 Q160 -60 240 0 L190 52 85 80 8 240 -57 111 -168 57 Z" fill="url(#cliff)"/>
 <path d="M-166 40 Q-30 66 100 29 L7 202 -54 90 Z" fill="#57408c" opacity=".42"/>
 <path d="M-256 -8 Q-214 -63 -140 -65 L149 -70 Q228 -52 252 -6 Q226 36 140 40 L-166 43 Q-247 31 -256 -8Z" fill="url(#grass)"/>
 <path d="M-239 -17 Q-143 -58 8 -57 Q159 -54 233 -10" stroke="#b7ff92" stroke-width="11" fill="none" opacity=".85"/>
 <path d="M-95 60 L-26 141 M71 60 L8 176" stroke="#dcd3e1" stroke-opacity=".6" stroke-width="10"/>
 </g>'''
def tree(x,y,s=1,autumn=False):
 canopy=['#60d966','#3ebda6','#a6ef64'] if not autumn else ['#ffca52','#ff8b72','#ffed78']
 return f'''<g transform="translate({x} {y}) scale({s})">
 <path d="M-12 60 Q0 -30 -6 -88 L13 -91 Q4 -28 17 60" fill="#8c5b3d" stroke="#5b3a29" stroke-width="3"/>
 <path d="M-2 -16 L-51 -61 M2 -39 L52 -87" stroke="#805439" stroke-width="11"/>
 {ellipse(-32,-91,60,49,canopy[0])}{ellipse(34,-98,67,55,canopy[1])}{ellipse(0,-130,76,62,canopy[2])}
 {ellipse(-31,-129,23,17,'#f9ffd5',.21)}{ellipse(32,-117,16,10,'#d9ffbb',.23)}</g>'''
def flower(x,y,r,c):
 petals=''.join(ellipse(x+dx*r,y+dy*r,r*.54,r*.8,c,.95) for dx,dy in [(0,-1.2),(.96,-.2),(.65,1),(-.65,1),(-.96,-.2)])
 return petals+shape_circle(x,y,r*.53,'#ffdc54')
def star(x,y,r):
 return f'<path d="M{x} {y-r} Q{x+3} {y-3} {x+r} {y} Q{x+3} {y+3} {x} {y+r} Q{x-3} {y+3} {x-r} {y} Q{x-3} {y-3} {x} {y-r}" fill="#fff9b3" opacity=".84"/>'

def common_defs(theme):
 skies={'sky':('#64c7fc','#cffaff'),'math':('#50bdff','#d1f5ff'),'memory':('#133c64','#39768f'),'sentence':('#ffdca6','#ffeece')}
 top,bottom=skies[theme]
 return f'''<defs>
 <linearGradient id="sky" x2=".1" y2="1"><stop stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>
 <linearGradient id="cliff" x2=".5" y2="1"><stop stop-color="#c1afff"/><stop offset=".48" stop-color="#796bc7"/><stop offset="1" stop-color="#47396e"/></linearGradient>
 <linearGradient id="grass" x2=".3" y2="1"><stop stop-color="#b4fb89"/><stop offset=".35" stop-color="#64dba9"/><stop offset="1" stop-color="#249b9b"/></linearGradient>
 <linearGradient id="water" x2="0" y2="1"><stop stop-color="#b9faff"/><stop offset="1" stop-color="#2eafed"/></linearGradient>
 <linearGradient id="wood" x2="0" y2="1"><stop stop-color="#e4a469"/><stop offset="1" stop-color="#97573c"/></linearGradient>
 <radialGradient id="glow"><stop stop-color="#fff6b5" stop-opacity=".9"/><stop offset="1" stop-color="#fff8e8" stop-opacity="0"/></radialGradient>
 <filter id="softshadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="17" flood-color="#072956" flood-opacity=".26"/></filter>
 <filter id="cloudshadow" x="-20%" y="-30%" width="145%" height="160%"><feGaussianBlur stdDeviation="1.5"/></filter>
 <filter id="blur"><feGaussianBlur stdDeviation="10"/></filter></defs>'''

def create_world():
 r=Random(30); content=[f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',shape_circle(1350,110,290,'url(#glow)')]
 for x,y,s in [(120,172,.73),(1150,160,1.1),(710,118,.55),(1480,295,.48)]: content.append(cloud(x,y,s))
 # distant islands make the horizon feel deep without any embedded mock controls
 for x,y,s in [(210,405,.45),(890,310,.32),(1400,385,.6),(510,280,.25)]:
  content.extend([island(x,y,s,r),tree(x-32*s,y-60*s, s*.8)])
 for x,y,s in [(350,650,.95),(875,565,1.03),(1360,730,1.08)]:
  content.append(island(x,y,s,r))
  for px,py,ss in [(-150,-56,.78),(125,-62,.68),(10,-87,.92)]:content.append(tree(x+px*s,y+py*s,ss*s))
  for k in range(20):
   dx=r.uniform(-190,190)*s;dy=r.uniform(-26,32)*s; content.append(flower(x+dx,y+dy, r.uniform(2,6),r.choice(['#ffdb55','#ffc6e3','#fffcfd'])))
 for k in range(35):content.append(star(r.uniform(20,1580),r.uniform(20,700),r.uniform(3,9)))
 return content

def create_math():
 r=Random(4);c=[f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',shape_circle(1390,125,350,'url(#glow)')]
 for x,y,s in [(180,170,.7),(975,145,.88),(1450,270,.7)]:c.append(cloud(x,y,s))
 for x,y,s in [(230,340,.52),(1200,390,.7)]:c.append(island(x,y,s,r));c.append(tree(x,y-80*s,s*.9))
 c.append(f'<path d="M0 750 Q250 570 520 690 T1030 650 Q1320 530 1600 670 V900 H0Z" fill="#338eac" opacity=".2"/>')
 for x,y,s in [(220,780,.95),(1330,730,.96)]:c.append(island(x,y,s,r));c.append(tree(x-105*s,y-82*s,s*.97))
 for k in range(22):c.append(flower(r.randrange(40,1570),r.randrange(690,870),r.randrange(4,12),r.choice(['#fffbc4','#ffc6de','#ffce55'])))
 for k in range(24):c.append(star(r.randrange(20,1550),r.randrange(30,620),r.randrange(3,9)))
 return c

def create_memory():
 r=Random(17);c=[f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
 c.append(f'<path d="M0 670 Q270 560 430 660 Q830 400 1140 620 Q1440 550 1600 680 V900 H0Z" fill="#235d63"/>')
 c.append(f'<path d="M0 760 Q370 620 700 770 Q1000 630 1600 770 V900 H0Z" fill="#327968"/>')
 for x,y,s in [(30,610,1.8),(1550,590,2),(240,380,1.05),(1360,420,1.1),(800,290,.65)]:c.append(tree(x,y,s))
 # luminous mushrooms, fireflies and flora
 for x,y,s in [(130,780,1.1),(400,810,.6),(1370,790,.8),(1510,860,1.1)]:
  c.append(f'<g transform="translate({x} {y}) scale({s})"><path d="M-12 25 L-9 -33 Q0 -40 10 -33 L14 25Z" fill="#fff2c7"/><path d="M-76 -32 Q-48 -120 0 -112 Q51 -120 76 -32 Q0 4 -76 -32Z" fill="#ec5b8c"/><ellipse cx="0" cy="-30" rx="60" ry="9" fill="#ffe2b2" opacity=".5"/>{shape_circle(-28,-65,11,'#fff2cc')}{shape_circle(27,-81,13,'#fff2cc')}</g>')
 for k in range(75):
  x,y=r.randrange(10,1590),r.randrange(60,850);c.append(shape_circle(x,y,r.choice([2,3,5]),r.choice(['#e5ff8a','#6de8cf','#ffe0a8']),r.uniform(.3,.82)))
 return c

def create_sentence():
 r=Random(27);c=['<rect width="1600" height="900" fill="#fbe9c6"/>','<rect width="1600" height="650" fill="url(#sky)"/>']
 c.extend(['<path d="M0 130 Q300 45 670 110 T1600 100 L1600 220 Q1150 185 800 225 T0 240Z" fill="#ffd7a9" opacity=".62"/>','<path d="M0 660 H1600 V900 H0Z" fill="#b67c64"/>',
 '<path d="M0 697 H1600" stroke="#ffdda4" stroke-width="19"/>',
 '<rect x="100" y="145" width="400" height="370" rx="28" fill="#fff6e8" stroke="#d99e69" stroke-width="21"/>',
 '<rect x="135" y="181" width="330" height="298" rx="12" fill="#8ddce4"/>',
 '<path d="M130 381 Q210 260 295 351 Q365 250 473 364 V480 H130Z" fill="#6bd5ad"/>',
 '<path d="M290 175 V485 M140 322 H468" stroke="#e4a86c" stroke-width="18"/>',
 '<rect x="1180" y="170" width="270" height="430" rx="19" fill="#ad694f"/>',
 '<rect x="1210" y="214" width="210" height="355" rx="12" fill="#d8aa72"/>'])
 for y in [260,380,500]:
  c.append(f'<rect x="1204" y="{y}" width="222" height="14" fill="#8e4f42"/>')
  for k in range(5):
   x=1225+k*36;c.append(f'<rect x="{x}" y="{y-65-r.randrange(0,15)}" width="{r.randrange(22,35)}" height="{r.randrange(53,66)}" rx="3" fill="{r.choice(["#71c2b0","#d57a8d","#729dd0","#f0cd79"])}"/>')
 c.extend(['<rect x="180" y="770" width="1240" height="100" rx="18" fill="#844f44"/>','<rect x="145" y="729" width="1310" height="65" rx="25" fill="#e7a16b"/>','<path d="M1000 654 Q1120 540 1240 655" stroke="#fff7df" stroke-width="29" fill="none" opacity=".65"/>'])
 for x,y,s in [(85,710,.85),(1515,715,1.1)]:c.append(tree(x,y,s))
 for k in range(25):c.append(star(r.randrange(50,1550),r.randrange(50,670),r.randrange(2,6)))
 return c

def output(name,theme,layers):
 content=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{common_defs(theme)}'+''.join(layers)+'</svg>'
 svg=DEST/f'original-{name}.svg';svg.write_text(content,encoding='utf-8')
 png=DEST/f'original-{name}.png';cairosvg.svg2png(bytestring=content.encode(),write_to=str(png),output_width=W,output_height=H)
 from PIL import Image
 im=Image.open(png).convert('RGB');im.save(DEST/f'original-{name}.webp','WEBP',quality=89,method=6)
 png.unlink()

output('world','sky',create_world())
output('math','math',create_math())
output('memory','memory',create_memory())
output('sentence','sentence',create_sentence())
print('Generated 4 clean scenic artwork images, with reproducible SVG sources and no textual UI.')

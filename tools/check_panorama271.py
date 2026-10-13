from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import base64,json,re
root=Path(__file__).resolve().parents[1]
report=[]
css_names=['main.css','game-world.css','polish26.css','stability27.css','panorama271.css']
css='\n'.join((root/'preview'/x).read_text() for x in css_names)
def data_for(file):
    path=root/'public'/'art'/file
    return 'data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
for art in ['world','math','memory','sentence','mascot','cover-math','cover-memory','cover-sentence']:
    css=css.replace(f"/art/original-{art}.webp",data_for(f'original-{art}.webp'))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for name in ['math','memory','sentence']:
  html=(root/'preview'/f'panorama-{name}.html').read_text()
  for art in ['world','math','memory','sentence','mascot','cover-math','cover-memory','cover-sentence']:
   html=html.replace(f'art/original-{art}.webp',data_for(f'original-{art}.webp'))
  html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', '',html)
  html=html.replace('</head>', f'<style>{css}</style></head>')
  for w,h in [(1440,900),(1920,1080),(390,844),(320,700)]:
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   page.set_content(html,wait_until='load')
   res=page.evaluate("""() => { const modal = document.querySelector('.immersive-dialog'), stage = document.querySelector('.world-stage'); const b=modal.getBoundingClientRect(); const art=document.querySelector('.stage-backdrop'); return {modalWidth:Math.round(b.width),modalHeight:Math.round(b.height),viewportWidth:innerWidth,viewportHeight:innerHeight,documentOverflowX:document.documentElement.scrollWidth>innerWidth,stageBackground:getComputedStyle(art).backgroundImage.slice(0,60),stageScrollHeight:stage.scrollHeight,stageClientHeight:stage.clientHeight} }""")
   res.update(game=name,width=w,height=h)
   report.append(res)
   if (w,h) in [(1440,900),(390,844)]:
    out=root/'docs'/'panorama271';out.mkdir(exist_ok=True,parents=True)
    page.screenshot(path=str(out/f'{name}-{w}.png'))
   print(res)
   page.close()
 browser.close()
(root/'docs'/'panorama271'/'layout-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
assert all(row['modalWidth']==row['viewportWidth'] and row['modalHeight']==row['viewportHeight'] and not row['documentOverflowX'] for row in report)
print('layout verification passed',len(report),'cases')

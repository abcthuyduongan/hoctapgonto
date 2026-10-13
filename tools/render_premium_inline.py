from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,mimetypes
root=Path(__file__).resolve().parents[1]
html=(root/'preview/premium274.html').read_text()

# For restricted environments: assets embedded locally into an isolated about:blank document.
def data(path):
 p=root/path
 mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
 return f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
for path in ['premium-island-math.png','premium-island-memory.png','premium-island-sentence.png','premium-fox.png']:
 html=html.replace(f'../public/art/{path}',data('public/art/'+path))
# Preserve exact import order from React entry file.
styles=['main.css','game-world.css','polish26.css','stability27.css','panorama271.css','portal272.css']
for name in styles:
 css=(root/'src/styles'/name).read_text()
 for p in ['premium-world-scene.webp','original-world.webp']:
  css=css.replace(f"/art/{p}",data('public/art/'+p))
 html=html.replace(f'<link rel="stylesheet" href="../src/styles/{name}">',f'<style>\n{css}\n</style>')

out=root/'docs/visual274';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 for w,h in [(1440,900),(390,844),(320,700)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.set_content(html, wait_until='domcontentloaded', timeout=20000)
  page.evaluate('document.fonts.ready')
  page.screenshot(path=str(out/f'home-{w}.png'),full_page=(w<500),timeout=25000,animations='disabled')
  metrics=page.evaluate('''() => ({width: document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,hero: document.querySelector('.portal273-hero')?.getBoundingClientRect().height,buttons:[...document.querySelectorAll('.portal273-start')].map(x=>({top:Math.round(x.getBoundingClientRect().top),w:Math.round(x.getBoundingClientRect().width)}))})''')
  print(w,metrics,page.evaluate("() => ['.portal273-hero','.portal273-heading','.portal273-world-grid','.portal273-world','.portal273-mascot'].map(s => {const r = document.querySelector(s).getBoundingClientRect();return [s,Math.round(r.x),Math.round(r.width),Math.round(r.y),Math.round(r.height)]})"),flush=True)
  page.close()
 b.close()

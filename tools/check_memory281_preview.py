from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import re,base64
import json
root=Path(__file__).resolve().parents[1]
handler=partial(SimpleHTTPRequestHandler,directory=str(root/'preview'))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/memory281.html'
html=(root/'preview'/'memory281.html').read_text()
css_files=re.findall(r'<link rel="stylesheet" href="([^"]+)">',html)
for file in css_files:
 css=(root/'preview'/file).read_text()
 html=html.replace(f'<link rel="stylesheet" href="{file}">','<style>'+css+'</style>')
for img in (root/'preview'/'art').glob('*'):
 if img.suffix not in ('.webp','.svg'): continue
 data='data:image/'+('svg+xml' if img.suffix=='.svg' else 'webp')+';base64,'+base64.b64encode(img.read_bytes()).decode()
 html=html.replace('art/'+img.name,data)

results=[]
out=root/'docs'/'memory281';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h in [(1440,900),(390,844),(320,700)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load',timeout=20000)
  page.locator('.memory-card').first.wait_for(timeout=5000)
  image_ok=page.locator('.forest-mascot').evaluate('(el)=>el.complete && el.naturalWidth>0')
  card_before=page.locator('.memory-card').count()
  left_before=page.locator('.forest-board').bounding_box()
  page.screenshot(path=str(out/f'memory-{w}.png'),full_page=False)
  cards=page.locator('.memory-card')
  cards.nth(0).click();cards.nth(1).click();page.wait_for_timeout(780)
  # Wrong pair or correct pair - in both cases another usable card must be available.
  enabled=page.locator('.memory-card:not([disabled])').count()
  board_after=page.locator('.forest-board').bounding_box()
  horizontal=page.evaluate('document.documentElement.scrollWidth > window.innerWidth+2')
  layout_shift=abs(left_before['x']-board_after['x'])+abs(left_before['y']-board_after['y'])
  item={'viewport':w,'cards':card_before,'enabled_after_two':enabled,'mascot_loaded':image_ok,'horizontal_overflow':horizontal,'board_shift_px':round(layout_shift,2),'errors':errors}
  results.append(item)
  page.close()
 browser.close()
server.shutdown()
(out/'browser-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
print(json.dumps(results,indent=2,ensure_ascii=False))
assert all(x['cards']==12 and x['enabled_after_two']>=1 and x['mascot_loaded'] and not x['horizontal_overflow'] and x['board_shift_px']<1 and not x['errors'] for x in results)

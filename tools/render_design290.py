from pathlib import Path
from urllib.parse import quote
import base64,re,json
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1];preview=root/'preview'/'design290';shots=root/'docs'/'design290';shots.mkdir(parents=True,exist_ok=True)
html=(preview/'index.html').read_text()
cache={}
def asset_data(filename):
 if filename not in cache:
  blob=(preview/'art'/filename).read_bytes()
  media='image/webp' if filename.endswith('.webp') else ('image/png' if filename.endswith('.png') else 'image/svg+xml')
  cache[filename]=f'data:{media};base64,'+base64.b64encode(blob).decode()
 return cache[filename]
def resolve_css(css):
 return re.sub(r'''url\(['"]?/?art/([^'"\)]+)['"]?\)''',lambda m:'url("'+asset_data(m.group(1))+'")',css)
html=re.sub(r'<link rel="stylesheet" href="/([^"]+)">',lambda m:'<style>\n'+resolve_css((preview/m.group(1)).read_text())+'\n</style>',html)
html=re.sub(r'''src="/art/([^\"]+)"''',lambda m:'src="'+asset_data(m.group(1))+'"',html)
(root/'preview'/'BAO_AN_ALPHA290_OFFLINE.html').write_text(html,encoding='utf-8')
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,width,height in [('desktop',1440,900),('wide',1920,1080),('phone',390,844),('small',320,700),('tablet',768,1024)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.set_content(html,wait_until='load');page.add_style_tag(content='.preview-controls,.preview-utility{display:none!important}') ;page.wait_for_timeout(280)
  page.screenshot(path=str(shots/f'home-{name}.png'),full_page=name in ['phone','small','tablet'])
  results.append({'page':f'home-{name}','size':f'{width}x{height}','overflow':page.evaluate('document.documentElement.scrollWidth>window.innerWidth'),'visibleImagesOkay':page.locator('img').evaluate_all('(imgs)=>imgs.filter(i=>i.offsetWidth>0).every(i=>i.complete&&i.naturalWidth>0)')})
  if name in ['desktop','phone']:
   for scene in ['math','memory','sentence']:
    page.evaluate(f'show("{scene}")');page.wait_for_timeout(100)
    page.screenshot(path=str(shots/f'{scene}-{name}.png'))
    results.append({'page':f'{scene}-{name}','overflow':page.evaluate('document.documentElement.scrollWidth>window.innerWidth'),'visibleImagesOkay':page.locator('img').evaluate_all('(imgs)=>imgs.filter(i=>i.offsetWidth>0).every(i=>i.complete&&i.naturalWidth>0)')})
  page.close()
 browser.close()
(shots/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

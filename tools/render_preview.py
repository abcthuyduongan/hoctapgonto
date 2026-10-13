"""Render honest STATIC UI-preview screenshots in Chromium without navigating to local URLs.
The screenshots are not React runtime acceptance results.
"""
from pathlib import Path
import base64,re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
preview=root/'preview'
html=(preview/'index.html').read_text()
for f in ['main.css','game-world.css','polish26.css']:
 css=(preview/f).read_text()
 def asseturl(match):
  suffix=match.group(2)
  image=preview/suffix
  if image.exists():
   ext=image.suffix.lower()[1:]; kind={'webp':'image/webp','png':'image/png','svg':'image/svg+xml'}[ext]
   return "url('data:"+kind+";base64,"+base64.b64encode(image.read_bytes()).decode()+"')"
  return match.group(0)
 css=re.sub(r'url\((["\']?)(art/[^)"\']+)\1\)',asseturl,css)
 html=html.replace(f'<link rel="stylesheet" href="{f}">',f'<style>\n{css}\n</style>')
for path in (preview/'art').glob('*'):
 if path.suffix.lower() not in {'.webp','.png'}:continue
 data='data:image/'+path.suffix[1:]+';base64,'+base64.b64encode(path.read_bytes()).decode()
 html=html.replace(f'src="art/{path.name}"',f'src="{data}"')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1440,900),(390,844),(320,640)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce')
  page.set_content(html,wait_until='load',timeout=30000)
  for screen in ['home','math','memory','sentence','parent','studio']:
   page.locator(f'[data-view="{screen}"]').click()
   page.evaluate('window.scrollTo(0,0)')
   out=root/'docs'/f'preview-alpha26-{screen}-{width}.png'
   page.screenshot(path=str(out),full_page=(screen=='home'))
   scroll=page.evaluate('document.documentElement.scrollWidth')
   if scroll>width+2:
    offenders=page.evaluate('''() => [...document.querySelectorAll('*')].filter(el => {const r=el.getBoundingClientRect();return r.width && (r.right>innerWidth+2 || r.left<-2)}).slice(0,7).map(el=>({tag:el.tagName,cls:el.className,txt:el.textContent?.slice(0,30),right:Math.round(el.getBoundingClientRect().right)}))''')
    print(f'OVERFLOW {screen} at {width}px: {scroll}px',offenders)
  page.close()
  print('Rendered 6 static UI previews at',width,'px')
 browser.close()

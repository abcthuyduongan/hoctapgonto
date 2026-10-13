from playwright.sync_api import sync_playwright
from pathlib import Path
import base64, re, json
root=Path(__file__).resolve().parents[1]
src=(root/'preview/qa/stability27.html').read_text()
css='\n'.join((root/'src/styles'/n).read_text() for n in ('main.css','game-world.css','polish26.css','stability27.css'))
for name in ('math','memory','sentence','mascot'):
 file=(root/f'public/art/original-{name}.webp')
 uri='data:image/webp;base64,'+base64.b64encode(file.read_bytes()).decode()
 css=css.replace(f"/art/original-{name}.webp", uri)
 src=src.replace(f'../../public/art/original-{name}.webp',uri)
src=re.sub(r'<link rel="stylesheet"[^>]*>', '',src)
src=src.replace('</head>', '<style>'+css+'</style></head>')
out=root/'docs/ux27';out.mkdir(parents=True,exist_ok=True)
result={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1440,900),(390,844),(320,720)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.set_content(src,wait_until='load')
  page.screenshot(path=str(out/f'math-before-{width}.png'))
  old={k:page.locator(f'#math {k}').bounding_box() for k in ['.answer-grid','.stable-response-zone','.world-hud']}
  # Dispatch click rather than playwright auto-scroll: we are measuring layout, not scroll-to-focus.
  page.locator('#math .answer-option').first.dispatch_event('click')
  page.wait_for_timeout(220)
  new={k:page.locator(f'#math {k}').bounding_box() for k in old}
  print('MATH',width,{k:round(new[k]['y']-old[k]['y'],2) for k in old},'h',old['.stable-response-zone']['height'],new['.stable-response-zone']['height'])
  page.screenshot(path=str(out/f'math-after-{width}.png'))
  page.locator('#sentenceTab').dispatch_event('click')
  page.screenshot(path=str(out/f'sentence-before-{width}.png'))
  sb=page.locator('#sentence .sentence-result-reserve').bounding_box()
  cb=page.locator('#sentence .stable-sentence-actions').bounding_box()
  page.locator('#sentence .sentence-main-action').dispatch_event('click')
  page.wait_for_timeout(200)
  sa=page.locator('#sentence .sentence-result-reserve').bounding_box()
  ca=page.locator('#sentence .stable-sentence-actions').bounding_box()
  print('SENTENCE',width,'result delta',round(sa['y']-sb['y'],2),'controls',round(ca['y']-cb['y'],2),'heights',sb['height'],sa['height'])
  page.screenshot(path=str(out/f'sentence-after-{width}.png'))
  page.locator('#sentenceActions .sentence-main-action').dispatch_event('click')
  page.wait_for_timeout(360)
  page.screenshot(path=str(out/f'reward-{width}.png'))
  print('OVERFLOW', width,page.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
  result[width]={'math_positions':{k:round(new[k]['y']-old[k]['y'],2) for k in old},'math_slot_height_delta':new['.stable-response-zone']['height']-old['.stable-response-zone']['height'],'sentence_slot_y_delta':sa['y']-sb['y'],'sentence_control_y_delta':ca['y']-cb['y'],'sentence_slot_height_delta':sa['height']-sb['height'],'horizontal_overflow':page.evaluate('document.documentElement.scrollWidth > window.innerWidth')}
  page.close()
 browser.close()
(out/'browser-layout-results.json').write_text(json.dumps(result,indent=2))

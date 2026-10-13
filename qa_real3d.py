from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
html=(root/'preview/BAO_AN_3D_OFFLINE.html').read_text()
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(1920,1080),(1440,900),(1366,768),(1024,768),(768,900),(390,844),(320,700)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  err=[];page.on('pageerror',lambda e:err.append(str(e)))
  page.set_content(html,timeout=25000)
  page.wait_for_timeout(950)
  dim=page.evaluate('({sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight})')
  ready=page.evaluate('window.__sceneReady')
  btns=page.locator('.ba3d-play').count()
  screenshot=root/f'preview/real3d-{width}.png'
  page.screenshot(path=str(screenshot))
  assert ready is True,(width,'renderer not ready')
  assert btns==3, (width,btns)
  assert not err,err
  assert dim['sw']<=width and dim['sh']<=height,(width,dim)
  results.append({'viewport':f'{width}x{height}','rendered3d':ready,'controls':btns,'no_scroll':True,'errors':err})
  page.close()
 # Interaction test at desktop.
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.wait_for_timeout(650)
 assert page.evaluate('window.__sceneReady')
 # 3D focus via semantic control changes the model target.
 page.locator('[data-world="sentence-builder"]').click(); assert page.evaluate('world.focus')=='sentence-builder'
 # Math Quest to completion.
 page.locator('[data-play="math-quest"]').click()
 for i in range(8):
  idx=page.evaluate('content["math-quest"].questions[gs.index][2]')
  page.locator(f'[data-answer="{idx}"]').click();page.wait_for_timeout(960)
 assert page.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 assert page.evaluate('history.length')==1
 page.locator('#done').click(); assert page.locator('#playLayer').is_hidden()
 # Memory Match 6 pairs. Wrong two cards unlock; then solve all pairs.
 page.locator('[data-play="memory-match"]').click()
 ids=page.evaluate('gs.cards.map(c=>c.key)')
 first=0;wrong=next(i for i,k in enumerate(ids) if k!=ids[first]);
 page.locator('[data-card="0"]').click();page.locator(f'[data-card="{wrong}"]').click();page.wait_for_timeout(760)
 assert page.evaluate('gs.busy') is False,'memory game locked after two cards'
 pairs={}
 for i,k in enumerate(ids):pairs.setdefault(k,[]).append(i)
 for c in pairs.values():
  for i in c:page.locator(f'[data-card="{i}"]').click()
  page.wait_for_timeout(620)
 assert page.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 assert page.evaluate('history.length')==2
 page.locator('#done').click()
 # Sentence Builder to completion.
 page.locator('[data-play="sentence-builder"]').click()
 for item in range(5):
  expected=page.evaluate('content["sentence-builder"].sentences[gs.index].replace(/\\.$/,"").split(" ")')
  # Match each expected word against a yet-unselected original tile index.
  for word in expected:
   index=page.evaluate('([word])=>{const available=gs.words.filter(w=>w.text===word&&!gs.answer.some(a=>a.id===w.id));return available[0]?.id??-1}',[word])
   assert index>=0,(item,word)
   page.locator(f'[data-word="{index}"]').click()
  page.locator('#checkSentence').click();page.wait_for_timeout(830)
 assert page.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 assert page.evaluate('history.length')==3
 page.locator('#done').click()
 page.locator('#parentNav').click()
 assert 'Đã ghi 3 lượt chơi' in page.locator('#playContent').inner_text()
 assert not errors,errors
 results.append({'functional':'math8 + memory6 + sentence5 + parent dashboard','passed':True,'errors':errors})
 browser.close()
(root/'preview/QA_REAL3D_RESULTS.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
root=Path(__file__).parent
html=(root/'preview/BAO_AN_3D_OFFLINE.html').read_text()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h in [(1440,900),(390,844),(320,700)]:
  p=b.new_page(viewport={'width':w,'height':h})
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content(html,timeout=25000);p.wait_for_timeout(420)
  state=p.evaluate('({ready:window.__sceneReady, tri:window.__world.softwareData?.length/30, sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})')
  p.screenshot(path=str(root/f'preview/v32-{w}-final.png'),timeout=15000)
  assert state['ready'] is True and state['sw']<=w and state['sh']<=h and not errors,(w,state,errors)
  results.append({'viewport':f'{w}x{h}','state':state,'errors':errors})
  p.close()
 p=b.new_page(viewport={'width':1440,'height':900})
 p.set_content(html,timeout=25000);p.wait_for_timeout(320)
 p.locator('[data-play="memory-match"]').click()
 ids=p.evaluate('gs.cards.map(c=>c.key)');other=next(i for i,k in enumerate(ids) if k!=ids[0]);
 p.locator('[data-card="0"]').click();p.locator(f'[data-card="{other}"]').click();p.wait_for_timeout(750)
 assert p.evaluate('gs.busy') is False,'Two cards locked game'
 pairs={}
 for i,k in enumerate(ids):pairs.setdefault(k,[]).append(i)
 for c in pairs.values():
  for i in c:p.locator(f'[data-card="{i}"]').click()
  p.wait_for_timeout(600)
 assert p.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 p.locator('#done').click()
 p.locator('[data-play="math-quest"]').click()
 for i in range(8):
  ans=p.evaluate('content["math-quest"].questions[gs.index][2]')
  p.locator(f'[data-answer="{ans}"]').click();p.wait_for_timeout(950)
 assert p.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 p.locator('#done').click()
 p.locator('[data-play="sentence-builder"]').click()
 for i in range(5):
  words=p.evaluate('content["sentence-builder"].sentences[gs.index].replace(/\\.$/,"").split(" ")')
  # If the regexp above is escaped ambiguously, simpler fallback to Python stripped value.
  for word in words:
   idx=p.evaluate('(word)=>gs.words.find(x=>x.text===word&&!gs.answer.some(y=>y.id===x.id))?.id??-1',word)
   if idx<0:break
   p.locator(f'[data-word="{idx}"]').click()
  p.locator('#checkSentence').click();p.wait_for_timeout(790)
 assert p.get_by_text('Hoàn thành thử thách!',exact=True).is_visible()
 p.locator('#done').click();p.locator('#parentNav').click()
 assert 'Đã ghi' in p.locator('#playContent').inner_text()
 results.append({'functional':'Memory 6 pairs, Math 8 questions, Sentence 5 sentences, reporting','passed':True})
 b.close()
(root/'preview/QA_32.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

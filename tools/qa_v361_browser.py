#!/usr/bin/env python3
"""Web-app DOM and game flows on Chromium using set_content.
Opaque-origin sandbox blocks local file/HTTP navigation: this test DOES NOT
verify localStorage persistence on reload or real device GPU performance.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'docs/V36_qa';QA.mkdir(exist_ok=True,parents=True)
HTML=(ROOT/'BAO_AN_LEARNING_V3_6_PLAYABLE.html').read_text(encoding='utf-8')
results={'method':'Chromium set_content, sandboxed origin','sizes':[],'games':{},'console_errors':[],'persistence_reload':'NOT TESTED - navigation blocked','import_restore':'NOT TESTED - opaque-origin storage restricted','webgl_gpu':'NOT TESTED - software Canvas fallback'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1280,'height':820},accept_downloads=True)
 page=context.new_page();page.set_default_timeout(12000)
 page.on('pageerror',lambda e:results['console_errors'].append(str(e)))
 page.set_content(HTML,wait_until='domcontentloaded',timeout=20000)
 page.wait_for_function('window.__glbReady !== undefined',timeout=15000)
 results['renderer']=page.evaluate('window.__baoanDiagnostics()')
 print('Renderer:',results['renderer']['renderer'],flush=True)
 for width,height in [(1920,1080),(1440,900),(1024,768),(768,1024),(390,844),(320,568)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(75)
  rect=page.evaluate('''() => ({scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
    buttons:[...document.querySelectorAll('[data-play]')].map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}})})''')
  ok=rect['scrollWidth']<=width+1 and rect['scrollHeight']<=height+1 and all(v['visible'] for v in rect['buttons'])
  results['sizes'].append({'size':f'{width}x{height}','pass':ok,'metrics':rect})
  if width in [1440,390,320]:page.screenshot(path=str(QA/f'v361-{width}.png'),animations='disabled')
  print('Frame:',width,height,ok,flush=True)
 page.set_viewport_size({'width':1280,'height':820});page.wait_for_timeout(80)
 # Physical click on graphic setting and on a game verifies hit target in browser.
 print('before quality click',flush=True)
 page.evaluate("document.querySelector('#qualityToggle').click()");results['quality_toggle']=page.evaluate("window.__baoanDiagnostics().resolution==='sharp'")
 page.evaluate("document.querySelector('#qualityToggle').click()")
 print('before math',flush=True)
 page.evaluate("document.querySelector('[data-play=math-quest]').click()")
 results['game_dialog']=page.locator('#playLayer').is_visible()
 # Control clicks inside HTML are real and game processing uses documented feedback delay.
 for index in [1,1,1,1,2,2,2,2]:
  page.evaluate('i=>document.querySelector(`[data-answer="${i}"]`).click()',index)
  page.wait_for_timeout(925)
 results['games']['math']=page.locator('#done').count()==1
 page.evaluate("document.getElementById('done').click()")
 print('Math complete',results['games']['math'],flush=True)
 page.evaluate("document.querySelector('[data-play=memory-match]').click()")
 # Expose the key by reading actual shuffled deck in the test context.
 for key in range(6):
  page.evaluate('''k=>{const ids=gs.cards.map((c,i)=>c.key===k?i:-1).filter(i=>i>=0);ids.forEach(i=>document.querySelector(`[data-card="${i}"]`).click());}''',key)
  page.wait_for_timeout(550)
 results['games']['memory']=page.locator('#done').count()==1
 page.evaluate("document.getElementById('done').click()")
 print('Memory complete',results['games']['memory'],flush=True)
 page.evaluate("document.querySelector('[data-play=sentence-builder]').click()")
 for ix in range(5):
  page.evaluate('''()=>{const ids=gs.words.map(w=>w.id).sort((a,b)=>a-b);
    ids.forEach(i=>document.querySelector(`[data-word="${i}"]`).click());
    document.getElementById('checkSentence').click();}''')
  page.wait_for_timeout(820)
  print('Sentence',ix+1,flush=True)
 results['games']['sentence']=page.locator('#done').count()==1
 page.evaluate("document.getElementById('done').click()")
 results['in_page_history']=page.evaluate('history.map(h=>({game:h.game,score:h.score,total:h.total}))')
 results['stars']=page.locator('#totalStars').inner_text()
 results['games']['totals']=len(results['in_page_history'])==3 and results['stars']=='19 ngôi sao'
 page.evaluate("document.getElementById('parentNav').click()")
 with page.expect_download(timeout=10000) as dl:page.locator('#exportProgress').click()
 results['export_json']=dl.value.suggested_filename.endswith('.json')
 page.evaluate("document.getElementById('exitGame').click()")
 results['focus_restored']=page.locator('#parentNav').evaluate('e=>document.activeElement===e')
 results['no_js_errors']=not results['console_errors']
 context.close();browser.close()
(QA/'v361-browser-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print('QA SUMMARY:',json.dumps({k:v for k,v in results.items() if k!='sizes'},ensure_ascii=False,indent=2),flush=True)
assert all(x['pass'] for x in results['sizes']), 'Viewport clipping'
assert all(results['games'].values()),'A game completion failed'
assert results['quality_toggle'] and results['export_json'] and results['focus_restored'] and results['no_js_errors']

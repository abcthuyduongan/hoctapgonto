#!/usr/bin/env python3
"""Check actual standalone DOM interactions and local origin storage; no inferred GPU FPS."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from pathlib import Path
import json, socket
root=Path(__file__).resolve().parents[1]
qa=root/'docs/V362_qa';qa.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(root),**kw)
server=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/BAO_AN_LEARNING_V3_6_PLAYABLE.html'
results={'url':url,'cases':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  for w,h in [(1440,900),(390,844),(320,640)]:
   context=browser.new_context(viewport={'width':w,'height':h},accept_downloads=True)
   page=context.new_page();page.set_default_timeout(14000); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   case={'size':f'{w}x{h}','errors':errors}
   # set_content has an opaque origin in this sandbox; provide an in-memory localStorage
   # implementation solely to exercise import UI. This does NOT prove persistence after reload.
   page.evaluate('''()=>{window.__qaStore={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__qaStore[k]??null,setItem:(k,v)=>window.__qaStore[k]=String(v),removeItem:k=>delete window.__qaStore[k]}})}''')
   page.on('dialog',lambda dialog:dialog.accept())
   case['origin']='set_content (in-memory storage test double)'
   page.set_content((root/'BAO_AN_LEARNING_V3_6_PLAYABLE.html').read_text(),wait_until='load',timeout=30000)
   page.wait_for_timeout(850)
   case['page']=page.evaluate('''()=>({viewport:[innerWidth,innerHeight],width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,canvas:!!document.querySelector("#world"),renderer:window.__baoanDiagnostics?.().renderer||null})''')
   case['buttonWidths']=page.evaluate('''()=>[...document.querySelectorAll("[data-play]")].map(b=>({name:b.closest("article")?.querySelector("strong")?.textContent,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right,visible:b.getBoundingClientRect().right<=innerWidth}))''')
   if w==390:page.screenshot(path=str(qa/'mobile-390.png'),animations='disabled',timeout=14000)
   if w==1440:page.screenshot(path=str(qa/'desktop-1440.png'),animations='disabled',timeout=14000)
   if w==1440:
    payload=(qa/'content-sample-all-three.json').read_bytes()
    try:
     page.locator('#importContentFile').set_input_files(files={'name':'lesson.json','mimeType':'application/json','buffer':payload})
     page.wait_for_timeout(750)
     case['importOptions']=[page.locator('#pack0 option').count(),page.locator('#pack1 option').count(),page.locator('#pack2 option').count()]
     for i,game in enumerate(['math-quest','memory-match','sentence-builder']):
      page.locator('#pack'+str(i)).select_option(index=1)
      page.locator(f'[data-play="{game}"]').click();case[f'{game}_sampleQuestion']=page.locator('#playContent').inner_text()[:140]
      if game=='memory-match':
       page.locator('[data-card="0"]').click();page.locator('[data-card="1"]').click();page.wait_for_timeout(900)
       case['memory_unlocked']=page.locator('[data-card="2"]').is_enabled()
      elif game=='math-quest':
       page.locator('[data-answer="0"]').click();page.wait_for_timeout(1050)
       case['math_next_question']='Thử thách 2' in page.locator('#playContent').inner_text()
      else:
       page.locator('[data-word]').first.click()
       case['sentence_click']=page.locator('[data-remove]').count()==1
      page.locator('#exitGame').click()
     case['curriculum_saved_to_mock_storage']=page.evaluate("!!localStorage.getItem('baoan.offline.content1')")
     page.locator('#parentNav').click();case['historyAvailable']=page.locator('#exportProgress').count()==1
    except Exception as ex:case['flow_error']=str(ex)[:250]
   results['cases'].append(case);context.close()
  browser.close()
finally:server.shutdown()
(qa/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

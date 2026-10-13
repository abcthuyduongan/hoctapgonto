from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
html=(root/'BAO_AN_LEARNING_V3_6_PLAYABLE.html').read_text()
results={}
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1280,'height':820},accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  page.set_content(html,wait_until='load',timeout=30000)
  page.wait_for_timeout(700)
  # Math Quest: answer each question with correct option by reading static fixtures
  page.locator('[data-play="math-quest"]').click()
  for n,correct in enumerate([1,1,1,1,2,2,2,2]):
    page.locator(f'[data-answer="{correct}"]').click();page.wait_for_timeout(950)
  results['math_completion']=page.get_by_text('Hoàn thành thử thách!').count()==1
  page.locator('#done').click()
  # Memory pairs: inspect each pair values on the browser; deliberately click matching pair in test.
  page.locator('[data-play="memory-match"]').click()
  pairs=page.evaluate('window.gs ? [] : []') if False else None
  for key in range(6):
    ids=page.evaluate('(key)=>gs.cards.map((c,i)=>c.key===key?i:-1).filter(i=>i>=0)',key)
    page.locator(f'[data-card="{ids[0]}"]').click();page.locator(f'[data-card="{ids[1]}"]').click();page.wait_for_timeout(565)
  results['memory_completion']=page.get_by_text('Hoàn thành thử thách!').count()==1
  page.locator('#done').click()
  # Sentence Builder: choose in correct order by id
  page.locator('[data-play="sentence-builder"]').click()
  lengths=[7,7,7,4,5] # actual count will derive from DOM gs.words
  for n in range(5):
    ids=page.evaluate('gs.words.map(w=>w.id).sort((a,b)=>a-b)')
    for i in ids:page.locator(f'[data-word="{i}"]').click()
    page.locator('#checkSentence').click();page.wait_for_timeout(805)
  results['sentence_completion']=page.get_by_text('Hoàn thành thử thách!').count()==1
  page.locator('#done').click()
  results['in_memory_history']=page.evaluate('history.map(h=>({game:h.game,score:h.score,total:h.total}))')
  results['persisted_history']='Chưa kiểm chứng vì môi trường chặn điều hướng gốc URL'
  results['star_counter']=page.locator('#totalStars').inner_text()
  # Real download of exported report.
  page.locator('#parentNav').click()
  with page.expect_download(timeout=10000) as dl:
    page.locator('#exportProgress').click()
  results['export_name']=dl.value.suggested_filename
  page.locator('#exitGame').click()
  # Reopen same virtual origin and verify localStorage survives.
  results['after_reload']='Chưa kiểm chứng vì môi trường chặn điều hướng gốc URL'
  results['errors']=errors
  context.close();browser.close()
(root/'docs/V36_qa/flow.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(results[k] for k in ['math_completion','memory_completion','sentence_completion'])
assert len(results['in_memory_history'])==3
assert results['export_name'].endswith('.json')
assert not errors

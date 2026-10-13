from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time
root=Path(__file__).resolve().parents[1]
html_file=root/'BAO_AN_LEARNING_V3_6_PLAYABLE.html'
qa=root/'docs/V36_qa';qa.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'])
  for width,height in [(1440,900),(390,844)]:
    page=browser.new_page(viewport={'width':width,'height':height},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html_file.read_text(),wait_until='load',timeout=30000)
    page.wait_for_timeout(2400 if width==1440 else 700)
    shot=qa/('world-1440.png' if width==1440 else 'world-390.png')
    page.screenshot(path=str(shot),animations='disabled',timeout=30000)
    overflow=page.evaluate('({sx:document.documentElement.scrollWidth, sy:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight,ready:window.__sceneReady,glb:window.__glbReady})')
    results.append({'width':width,'main':overflow,'errors':errors})
    if width==1440:
      page.locator('[data-play="memory-match"]').click(timeout=12000)
      page.locator('[data-card="0"]').click();page.locator('[data-card="1"]').click()
      page.wait_for_timeout(760)
      enabled=page.locator('[data-card="2"]').is_enabled()
      results.append({'memory_two_cards_unlocked':enabled})
      # Exit/re-enter same game to catch stale callbacks
      page.locator('#exitGame').click();page.locator('[data-play="memory-match"]').click()
      page.locator('[data-card="0"]').click()
      results.append({'memory_reentry':page.locator('#playContent').is_visible()})
      page.locator('#exitGame').click()
      page.locator('[data-play="math-quest"]').click()
      page.locator('[data-answer="0"]').click()
      page.wait_for_timeout(1000)
      results.append({'math_next_question':page.get_by_text('Thử thách 2 / 8').count()>0})
      page.locator('#exitGame').click()
      page.locator('[data-play="sentence-builder"]').click()
      page.locator('[data-word]').first.click()
      results.append({'sentence_click':page.locator('[data-remove]').count()==1})
      page.locator('#exitGame').click()
      page.locator('#parentNav').click()
      results.append({'parent_visible':page.get_by_text('Kết quả học tập').count()>0,'export_button':page.locator('#exportProgress').count()==1})
      page.locator('#exitGame').click()
      page.locator('#motionToggle').click()
      results.append({'motion_reduced':page.locator('#motionToggle').get_attribute('aria-pressed')=='true'})
    page.close()
  browser.close()
(qa/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

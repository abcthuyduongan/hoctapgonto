"""Render CSS layout-only fixture through inline local resources (offline Chromium).
This is NOT a screenshot of the React runtime; see docs/QA_ALPHA280.md.
"""
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,re,json
root=Path(__file__).resolve().parent.parent
html=root/'preview/math280.html'
soup=BeautifulSoup(html.read_text(),'html.parser')
assetcache={}
def uri(path):
    path=path.resolve()
    if not path.is_file():return None
    if path not in assetcache:
        mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'}.get(path.suffix.lower(),'application/octet-stream')
        assetcache[path]=f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
    return assetcache[path]
for link in list(soup.find_all('link',rel='stylesheet')):
    path=(html.parent/link['href']).resolve()
    css=path.read_text()
    def replace(m):
        resource=m.group(2)
        file=(root/'public'/resource.lstrip('/')) if resource.startswith('/art/') else path.parent/resource
        embedded=uri(file)
        return f'url("{embedded}")' if embedded else 'none'
    css=re.sub(r'url\(\s*([\'\"]?)([^)\'\"]+)\1\s*\)',replace,css)
    style=soup.new_tag('style');style.string=css;link.replace_with(style)
for img in soup.find_all('img'):
    resource=uri((html.parent/img['src']).resolve())
    if resource:img['src']=resource
out=root/'docs/visual280';out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(1440,900),(390,844),(320,700)]:
        page=b.new_page(viewport={'width':width,'height':height},reduced_motion='no-preference')
        page.set_content(str(soup),wait_until='load')
        positions='''() => {const a=document.querySelector('.answer-grid').getBoundingClientRect();const q=document.querySelector('.quiz-question').getBoundingClientRect();return {answerY:a.y,questionY:q.y,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,mascotLoaded:document.querySelector('.guide-figure img')?.naturalWidth>0}}'''
        before=page.evaluate(positions)
        page.screenshot(path=str(out/f'math-waiting-{width}.png'),animations='disabled')
        page.evaluate("window.showMath280('success')")
        page.wait_for_timeout(120)
        after=page.evaluate(positions)
        page.screenshot(path=str(out/f'math-feedback-{width}.png'),animations='disabled')
        page.evaluate("window.showMath280('reward')")
        page.wait_for_timeout(70)
        page.screenshot(path=str(out/f'math-reward-{width}.png'),animations='disabled')
        results.append({'width':width,'height':height,'before':before,'after':after,'answerShift':round(after['answerY']-before['answerY'],2),'questionShift':round(after['questionY']-before['questionY'],2)})
        page.close()
    # reduced motion checks
    page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    page.set_content(str(soup),wait_until='load')
    page.evaluate("window.showMath280('success')")
    reduced=page.locator('.game-reaction').evaluate('e=>getComputedStyle(e).display')
    page.evaluate("document.documentElement.dataset.motion='off'")
    manual=page.locator('.game-reaction').evaluate('e=>getComputedStyle(e).display')
    results.append({'reducedMotionReactionDisplay':reduced,'motionOffReactionDisplay':manual})
    b.close()
(out/'layout-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
for row in results:print(row)

#!/usr/bin/env python3
"""Build single-file genuine WebGL/Canvas 3D playable release.
Includes the actual validated GLB model as a data URI, no external dependencies.
Requires installed tsc, not npm packages.
"""
from pathlib import Path
import base64, subprocess, tempfile, re, html
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    src=Path(temp)/'src'; (src/'assets').mkdir(parents=True)
    eng=(root/'src/world3d/engine.ts').read_text().replace("'./assets/glb.ts'","'./assets/glb.js'")
    (src/'engine.ts').write_text(eng)
    (src/'assets/glb.ts').write_text((root/'src/world3d/assets/glb.ts').read_text())
    subprocess.run(['tsc','--target','ES2022','--module','ESNext','--moduleResolution','node','--strict','--skipLibCheck','--outDir',str(Path(temp)/'js'),str(src/'engine.ts'),str(src/'assets/glb.ts')],check=True)
    compiled=(Path(temp)/'js/engine.js').read_text()
    imported=(Path(temp)/'js/assets/glb.js').read_text()
    compiled=re.sub(r'^import .*?;\s*$', '',compiled,flags=re.MULTILINE)
    compiled=re.sub(r'\bexport (function|class)\b',r'\1',compiled)
    imported=re.sub(r'\bexport (function|class)\b',r'\1',imported)
    core=imported+'\n'+compiled
    # Prevent shadowed declarations or broken module syntax on the delivered HTML.
    if re.search(r'^\s*(import|export)\s',core,re.MULTILINE):raise RuntimeError('Non-inline module statement left in bundle')

css=(root/'src/styles/real3d31.css').read_text()+'\n'+(root/'preview/interactive.css').read_text()
bg=base64.b64encode((root/'public/art/premium-world-scene.webp').read_bytes()).decode()
css=css.replace("url('/art/premium-world-scene.webp')",f"url('data:image/webp;base64,{bg}')")
# Roomy game overlay without jarring layout shifts, button target minimum 44px.
css+='''
.play-layer {overscroll-behavior:contain}
.play-contents {scrollbar-gutter:stable;outline:0;height:min(675px,calc(100dvh - 92px));min-height:0;flex:none;justify-content:center}
.play-contents:has(.history){justify-content:flex-start}
.ba3d-island-control:hover,.ba3d-island-control:focus-within,.ba3d-island-control.ba3d-selected{transform:none;filter:drop-shadow(0 12px 12px #07477d7a)}
.ba3d-island-control.ba3d-selected .ba3d-world-name{border-color:#ffe17e;box-shadow:0 6px 0 #8f5a16,0 0 22px #ffe8919a}
.play-memory{grid-auto-rows:minmax(72px,1fr)}
.play-question,.play-status,.play-notice{flex-shrink:0}
@media(max-width:700px){.play-contents{height:calc(100dvh - 72px);width:calc(100% - 16px);padding:12px;border-width:3px;border-radius:18px;box-shadow:0 6px 0 #a5743f,0 14px 25px #001d3860}}
@media(max-width:370px) and (max-height:720px){.play-contents{gap:8px;justify-content:flex-start}.play-question{min-height:75px}.play-answer{min-height:58px}.play-notice{min-height:49px;height:auto}.play-memory{grid-auto-rows:minmax(60px,1fr)}.play-tile{min-height:60px}}

.play-answer:focus-visible,.play-tile:focus-visible,.word-chip:focus-visible,.play-check:focus-visible,
.ba3d-play:focus-visible,#exitGame:focus-visible {outline:4px solid #ffdc4d;outline-offset:3px}
.play-tile {transition:background-color .16s ease,border-color .16s ease,transform .18s ease}
.play-tile.up {transform:translateY(-2px)}.play-tile.found {box-shadow:0 5px 0 #388a35,0 0 0 2px #d9ffc1}
.play-answer.good{animation:correctPulse .35s ease}
@keyframes correctPulse{50%{transform:scale(1.025)}}
@media(prefers-reduced-motion:reduce){.play-tile,.play-answer.good{animation:none;transition:none}}
html[data-motion='off'] .play-tile,html[data-motion='off'] .play-answer.good {animation:none;transition:none}
.ba3d-shortcuts #importContentButton{background:linear-gradient(180deg,#f6fffa,#bde8d8);color:#145c51;border:2px solid #6fb8a6;cursor:pointer;font-weight:900;border-radius:12px;padding:7px 9px;min-height:32px;white-space:nowrap}.ba3d-shortcuts #importContentButton:focus-visible{outline:3px solid #fff07e;outline-offset:2px}@media(max-width:700px){.ba3d-shortcuts{gap:4px!important}.ba3d-shortcuts #shortcutStars{display:none!important}.ba3d-shortcuts #importContentButton{font-size:10px;padding:4px 7px;min-height:30px}}.header-tools{display:flex;gap:8px;align-items:center}.header-tools button{min-height:42px;cursor:pointer;border:1px solid #9ce2ff;background:#1057a9;color:#fff;padding:8px 11px;border-radius:12px;font-weight:800}
.header-tools button[aria-pressed=true]{background:#fceaae;color:#15559a}
@media(max-width:700px){.site-header{height:112px;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:46px 46px;gap:5px;padding:6px 8px}.brand{grid-row:1;grid-column:1}.header-tools{grid-row:1;grid-column:2;position:static}.header-tools{gap:4px}.header-tools button{min-height:33px;font-size:10px;padding:5px 6px}.site-header .nav.active{grid-row:2;grid-column:1;min-height:40px}.site-header #parentNav{grid-row:2;grid-column:2;min-height:40px}.site-main{height:calc(100dvh - 112px)}.ba3d-hero-title h1{line-height:1.14;font-size:clamp(25px,6vw,33px);margin:6px 0 4px}}
'''
core_js=core
model64=base64.b64encode((root/'public/models/fox-guide-prototype.glb').read_bytes()).decode()
model64low=base64.b64encode((root/'public/models/fox-guide-mobile.glb').read_bytes()).decode()
# Stable single file, art model embedded to avoid fetch errors in file:// mode.
setup=f'''
const canvas=document.getElementById('world');let active=null;
const world=new LearningWorld3D(canvas,{{quality:innerWidth<700?'low':'full',onSelect:(id)=>{{
 active=id;document.querySelectorAll('.ba3d-island-control').forEach(e=>e.classList.toggle('ba3d-selected',e.classList.contains('ba3d-'+id)));
}},onReady:(ok)=>{{window.__sceneReady=ok;console.log('3D_READY',ok)}},reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}});
window.__world=world;
window.__baoanDiagnostics=()=>world.getDiagnostics();
const qualityButton=document.getElementById('qualityToggle');
let quality='balanced';try{{quality=localStorage.getItem('baoan.3d.renderQuality')==='sharp'?'sharp':'balanced';}}catch{{}}
function applyQuality(){{world.setRenderQuality(quality);qualityButton.setAttribute('aria-pressed',String(quality==='sharp'));qualityButton.textContent=quality==='sharp'?'◈ Sắc nét':'◈ Mượt';}}
qualityButton.onclick=()=>{{quality=quality==='sharp'?'balanced':'sharp';try{{localStorage.setItem('baoan.3d.renderQuality',quality)}}catch{{}}applyQuality();}};
applyQuality();
void world.loadGuideModel(world.isSoftwareRenderer?'data:model/gltf-binary;base64,{model64low}':'data:model/gltf-binary;base64,{model64}').then(ok=>{{window.__glbReady=ok;document.body.dataset.glbLoaded=ok?'yes':'fallback';}});
document.querySelectorAll('[data-world]').forEach(e=>e.addEventListener('click',()=>{{active=e.dataset.world;world.focusOn(active);document.querySelectorAll('.ba3d-island-control').forEach(a=>a.classList.toggle('ba3d-selected',a.classList.contains('ba3d-'+active)))}}));
const motionButton=document.getElementById('motionToggle');let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
motionButton.onclick=()=>{{motion=!motion;world.setMotion(motion);motionButton.setAttribute('aria-pressed',String(!motion));motionButton.textContent=motion?'✨ Hiệu ứng':'◻ Giảm chuyển động';document.documentElement.dataset.motion=motion?'on':'off';}};
document.addEventListener('visibilitychange',()=>world.setPaused(document.hidden||!document.getElementById('playLayer').hidden));
'''
# compile the currently maintained JS game file after race/UX fixes
logic=(root/'preview/offline_interactive.js').read_text()
nav="""<div class="header-tools"><button id="qualityToggle" type="button" aria-pressed="false" title="Đổi chất lượng dựng hình 3D">◈ Mượt</button><button id="motionToggle" type="button" aria-pressed="false">✨ Hiệu ứng</button></div>"""
head='''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d4d94"><title>Bảo An Learning — Thế giới game 3D V3.6.2</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#fff;overflow:hidden}.site-header{height:76px;background:linear-gradient(100deg,#082c68,#0758aa);display:flex;align-items:center;justify-content:space-between;padding:0 28px;gap:15px;border-bottom:2px solid #c5e6ff}.brand{font-weight:1000;font-size:24px;letter-spacing:-.03em;line-height:1}.brand small{display:block;font-size:11px;letter-spacing:.2em}.nav{font-size:14px;font-weight:900;padding:13px 20px;border:1px solid #9ad9ff77;border-radius:14px;background:#ffffff18;cursor:pointer;color:#fff}.nav.active{background:#ecf8ff;color:#1259a1}.site-main{height:calc(100dvh - 76px)}.ba3d-home{height:100%}
@media(max-width:700px){.site-header{height:108px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:45px 45px;gap:5px;padding:5px 10px}.brand{font-size:17px}.brand small{font-size:9px}.nav{grid-column:1/-1;text-align:center;padding:8px 3px;font-size:11px}.site-main{height:calc(100dvh - 108px)}}
'''+css+'''</style></head><body><header class="site-header"><div class="brand">⭐ BẢO AN<small>LEARNING · REAL 3D V3.6.2</small></div><button class="nav active">🏠 Thế giới game 3D</button><button class="nav" id="parentNav">📊 Góc phụ huynh</button>'''+nav+'''</header>
<main class="site-main"><div class="ba3d-home"><section class="ba3d-world" aria-label="Bảo An Learning 3D"><div class="ba3d-sky"></div><canvas id="world" class="ba3d-canvas" aria-label="Cảnh 3D với ba đảo nổi"></canvas><div class="ba3d-softlight"></div><div class="ba3d-greeter"><strong class="ba3d-hello">Chào nhà thám hiểm!</strong><span>Ba thế giới đang đợi con khám phá ✨</span></div><div class="ba3d-hero-title"><span class="ba3d-edition">✦ REAL 3D GAME WORLD · V3.6.2 ✦</span><h1>Khám phá <span>Thế giới học tập</span></h1><p>Học qua trò chơi · Khám phá tri thức · Lớn lên mỗi ngày</p></div><aside class="ba3d-achievement"><div class="ba3d-wood-head">⭐ Hành trình của con</div><div class="ba3d-progress-track"><div id="overallProgress" style="width:0%"></div></div><strong id="totalStars">0 ngôi sao</strong><small id="completedGames">0 lượt chơi hoàn thành</small></aside><div class="ba3d-anchors">
'''
parts=[]
for idx,(id,title,subtitle) in enumerate([('math-quest','Math Quest','Đảo Toán Học'),('memory-match','Memory Match','Khu Rừng Trí Nhớ'),('sentence-builder','Sentence Builder','Xưởng Ngôn Từ')]):
    parts.append(f'''<article class="ba3d-island-control ba3d-{id}"><button class="ba3d-world-name" data-world="{id}" type="button"><span class="ba3d-world-number">✦ 0{idx+1}</span><strong>{title}</strong><small>{subtitle}</small></button><label class="ba3d-sr-only" for="pack{idx}">Chọn học liệu</label><select id="pack{idx}"><option>{['Toán 3 · Phép tính vui','Tiếng Anh · Gia đình','Tiếng Anh · Ghép câu'][idx]}</option></select><button class="ba3d-play" data-play="{id}" type="button">Bắt đầu <span>▶</span></button></article>''')
tail='''</div><div class="ba3d-shortcuts"><button type="button" id="mini">🧩 Bảng cửu chương</button><button type="button" id="importContentButton" title="Nhập bộ học liệu JSON được biên soạn trong Creator Studio">📁 Nhập học liệu</button><input id="importContentFile" type="file" accept=".json,application/json" aria-label="Chọn tệp học liệu" hidden><span id="shortcutStars">⭐ 0 sao</span><span id="shortcutGames">🎮 0 lượt</span></div><p class="ba3d-footnote">Chạm vào đảo để chọn · Bắt đầu để chơi</p></section></div></main>
<div id="playLayer" class="play-layer" hidden role="dialog" aria-modal="true" aria-label="Không gian trò chơi"><div class="play-header"><h2 id="playTitle">Trò chơi</h2><button id="exitGame" type="button">← Thoát trò chơi</button></div><div id="playContent" class="play-contents"></div></div><script>
'''+core_js+'\n'+setup+'\n'+logic+'\n</script></body></html>'
out=root/'BAO_AN_LEARNING_V3_6_PLAYABLE.html'
out.write_text(head+''.join(parts)+tail,encoding='utf-8')
subprocess.run(['node','--check','--input-type=commonjs'],input=(core_js+'\n'+setup+'\n'+logic).encode(),check=True)
print('Created',out,'size',out.stat().st_size)

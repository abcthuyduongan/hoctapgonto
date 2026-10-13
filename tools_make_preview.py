from pathlib import Path
import base64
root=Path('/mnt/data/BAO_AN_LEARNING_V3_2_3D_POLISH')
css=(root/'src/styles/real3d31.css').read_text()+(root/'preview/interactive.css').read_text()
bg_scene=base64.b64encode((root/'public/art/premium-world-scene.webp').read_bytes()).decode('ascii')
css=css.replace("url('/art/premium-world-scene.webp')","url('data:image/webp;base64,"+bg_scene+"')")
js=(root/'preview/engine/engine.js').read_text().replace('export function project3D','function project3D').replace('export class LearningWorld3D','class LearningWorld3D')
head='''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bảo An Learning — Thế giới 3D thực V3.2</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#fff;overflow:hidden}.site-header{height:76px;background:linear-gradient(100deg,#082c68,#0758aa);display:flex;align-items:center;justify-content:space-between;padding:0 28px;gap:15px;border-bottom:2px solid #c5e6ff}.brand{font-weight:1000;font-size:24px;letter-spacing:-.03em;line-height:1}.brand small{display:block;font-size:11px;letter-spacing:.2em}.nav{font-size:14px;font-weight:900;padding:13px 20px;border:1px solid #9ad9ff77;border-radius:14px;background:#ffffff18}.nav.active{background:#ecf8ff;color:#1259a1}.site-main{height:calc(100dvh - 76px)}.ba3d-home{height:100%}
@media(max-width:700px){.site-header{height:108px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:45px 45px;gap:5px;padding:5px 10px}.brand{font-size:17px}.brand small{font-size:9px}.nav{grid-column:1/-1;text-align:center;padding:8px 3px;font-size:11px}.site-main{height:calc(100dvh - 108px)}}
'''+css+'''</style></head><body><header class="site-header"><div class="brand">⭐ BẢO AN<small>LEARNING · REAL 3D V3.2</small></div><div class="nav active">🏠 Thế giới game 3D</div><div class="nav" id="parentNav" role="button" tabindex="0">👨‍👩‍👧 Góc phụ huynh</div></header>
<main class="site-main"><div class="ba3d-home"><section class="ba3d-world" aria-label="Bảo An Learning 3D"><div class="ba3d-sky"></div><canvas id="world" class="ba3d-canvas" aria-label="Cảnh 3D thật"></canvas><div class="ba3d-softlight"></div><div class="ba3d-greeter"><strong class="ba3d-hello">Chào nhà thám hiểm!</strong><span>Ba thế giới đang đợi con khám phá ✨</span></div><div class="ba3d-hero-title"><span class="ba3d-edition">✦ REAL 3D GAME WORLD · V3.2 ✦</span><h1>Khám phá <span>Thế giới học tập</span></h1><p>Học qua trò chơi · Khám phá tri thức · Lớn lên mỗi ngày</p></div><aside class="ba3d-achievement"><div class="ba3d-wood-head">⭐ Hành trình của con</div><div class="ba3d-progress-track"><div style="width:33%"></div></div><strong>3 ngôi sao</strong><small>1 lượt chơi hoàn thành</small></aside><div class="ba3d-anchors">
'''
parts=[]
for idx,(id,title,subtitle) in enumerate([('math-quest','Math Quest','Đảo Toán Học'),('memory-match','Memory Match','Khu Rừng Trí Nhớ'),('sentence-builder','Sentence Builder','Xưởng Ngôn Từ')]):
  parts.append(f'''<article class="ba3d-island-control ba3d-{id}"><button class="ba3d-world-name" data-world="{id}"><span class="ba3d-world-number">✦ 0{idx+1}</span><strong>{title}</strong><small>{subtitle}</small></button><label class="ba3d-sr-only" for="pack{idx}">Chọn học liệu</label><select id="pack{idx}"><option>{['Toán 3 · Phép tính vui','Tiếng Anh · Gia đình','Tiếng Anh · Ghép câu'][idx]}</option></select><button class="ba3d-play" data-play="{id}">Bắt đầu <span>▶</span></button></article>''')
tail='''</div><div class="ba3d-shortcuts"><button type="button" id="mini">🧩 Bảng cửu chương</button><span>⭐ 3 sao đã nhận</span><span>🎮 1 lượt hoàn thành</span></div><p class="ba3d-footnote">Chạm vào đảo để xoay góc nhìn · Chọn bộ học liệu và bắt đầu chơi</p></section></div></main><div id="playLayer" class="play-layer" hidden><div class="play-header"><h2 id="playTitle">Trò chơi</h2><button id="exitGame">← Thoát trò chơi</button></div><div id="playContent" class="play-contents"></div></div><script>
'''+js+'''
const canvas=document.getElementById('world');let active=null;
const world=new LearningWorld3D(canvas,{onSelect:(id)=>{
 active=id;document.querySelectorAll('.ba3d-island-control').forEach(e=>e.classList.toggle('ba3d-selected',e.classList.contains('ba3d-'+id)));
},onReady:(ok)=>{window.__sceneReady=ok;console.log('3D_READY',ok)},reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
window.__world=world;
document.querySelectorAll('[data-world]').forEach(e=>e.addEventListener('click',()=>{active=e.dataset.world;world.focusOn(active);document.querySelectorAll('.ba3d-island-control').forEach(a=>a.classList.toggle('ba3d-selected',a.classList.contains('ba3d-'+active)))}));


</script><script>'''+(root/'preview/offline_interactive.js').read_text()+'''</script></body></html>'''
(root/'preview/BAO_AN_3D_OFFLINE.html').write_text(head+''.join(parts)+tail)
print('bytes', (root/'preview/BAO_AN_3D_OFFLINE.html').stat().st_size)

from pathlib import Path
from shutil import copy2
root=Path(__file__).resolve().parents[1]
preview=root/'preview'
art=preview/'art'
art.mkdir(exist_ok=True)
for name in ['premium-memory-cinematic.webp','premium-fox-optimized.webp','memory-card-back.svg']:
    copy2(root/'public'/'art'/name,art/name)
styles=['main.css','game-world.css','polish26.css','stability27.css','panorama271.css','portal272.css','world276.css','world277.css','premium280.css','memory281.css']
for name in styles:
    src=(root/'src'/'styles'/name).read_text(encoding='utf-8')
    src=src.replace("/art/","art/")
    (preview/name).write_text(src,encoding='utf-8')
links='\n'.join(f'<link rel="stylesheet" href="{name}">' for name in styles)
# Individual buttons, text and feedback are live elements in this preview.
html='''<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Memory Match — Alpha 2.8.1 QA</title>__LINKS__
<style>html,body{margin:0;height:100%;overflow:hidden}.game-dialog-head{height:68px}.qa-note{position:fixed;z-index:100;bottom:7px;right:7px;background:#052638e8;border:1px solid #8ad9d0;color:#fff;font:600 10px system-ui;padding:6px;border-radius:8px;max-width:150px;text-align:center}button{cursor:pointer}.qa-fail{color:#ffd0b2}.world-stage{min-height:0}</style></head>
<body><div class="overlay immersive-overlay"><div class="game-dialog adventure-dialog immersive-dialog"><div class="game-dialog-head"><div><div class="eyebrow">✦ GAME WORLD / MEMORY MATCH</div><h2>Tiếng Anh · Gia đình</h2></div><button class="button outline" type="button" id="restart">↻ Chơi lại</button></div>
<section class="play-panel memory-panel world-stage world-memory"><div class="stage-backdrop"></div><div class="stage-overlay"></div><div class="world-hud"><span class="hud-label">🌲 KHU RỪNG TRÍ NHỚ</span><span class="hud-score" id="score">⭐ 0/6 cặp</span></div>
<div class="memory-feedback-slot"><span class="memory-feedback-message" id="feedback">🌿 Quan sát, ghi nhớ và tìm hai thẻ cùng một cặp nhé!</span></div>
<div class="memory-adventure-layout"><aside class="forest-guide"><img class="forest-mascot" src="art/premium-fox-optimized.webp" alt="Bạn cáo đồng hành"><div class="forest-speech">Mỗi lần lật là thêm một cơ hội ghi nhớ! 🦉</div></aside><div class="forest-board"><div class="memory-topline"><span>✦ BẢNG THẺ THẦN KỲ</span><strong id="moves">0 lượt thử</strong></div><div class="memory-board-subline" id="subline">Lật hai thẻ để tìm cặp tương ứng</div><div class="memory-grid" id="cards" aria-label="Bảng thẻ ghi nhớ"></div></div></div>
<div class="world-stage-bottom"><span>🦋 Quan sát • ghi nhớ • khám phá</span><span>✦ Bảo An Game World</span></div></section></div></div>
<div class="qa-note">BẢN XEM TRƯỚC TƯƠNG TÁC<br>Không phải ứng dụng React và không ghi kết quả</div>
<script>
const pairs=[['mẹ','mother'],['bố','father'],['bà','grandmother'],['anh / em trai','brother'],['chị / em gái','sister'],['ông','grandfather']];
let deck=[],first=null,second=null,matches=new Set(),locked=false,moves=0,timeout=null;
const $=id=>document.getElementById(id);
function draw(){
 $('cards').innerHTML='';deck.forEach((c,i)=>{let open=i===first||i===second||matches.has(c.pair);let b=document.createElement('button');b.type='button';b.className='memory-card'+(open?' revealed':'')+(matches.has(c.pair)?' found':'');b.disabled=locked||matches.has(c.pair);b.setAttribute('aria-label',open?c.word:'Thẻ úp, chọn để lật');b.setAttribute('aria-pressed',String(open));b.innerHTML='<span class="memory-inner"><span class="memory-face memory-back" aria-hidden="true">✦</span><span class="memory-face memory-front"></span></span>';b.querySelector('.memory-front').textContent=c.word;b.addEventListener('click',()=>choose(i));$('cards').appendChild(b)});
 $('score').textContent=`⭐ ${matches.size}/${pairs.length} cặp`; $('moves').textContent=`${moves} lượt thử`;
}
function choose(i){if(locked||matches.has(deck[i].pair)||first===i)return;if(first===null){first=i;$('subline').textContent='Chọn thêm một thẻ để kiểm tra cặp nhé!';draw();return;}
 second=i;locked=true;moves++;draw();let correct=deck[first].pair===deck[second].pair;
 if(correct){matches.add(deck[first].pair);$('feedback').textContent='✨ Tuyệt lắm! Con đã ghép đúng một cặp thẻ!';$('subline').textContent='Ghép đúng! Tiếp tục tìm các cặp còn lại.';timeout=setTimeout(()=>{first=null;second=null;locked=false;draw();if(matches.size===pairs.length){$('feedback').textContent='🏆 Hoàn thành! Con tìm đúng tất cả các cặp.';}},380);}
 else{$('feedback').textContent='🌱 Chưa khớp rồi, mình thử lại nhé!';$('subline').textContent='Hai thẻ sẽ tự úp lại sau một lát.';timeout=setTimeout(()=>{first=null;second=null;locked=false;draw();$('subline').textContent='Chọn một cặp thẻ mới nhé!';},700);}
}
function reset(){if(timeout)clearTimeout(timeout);deck=pairs.flatMap((p,i)=>p.map(word=>({pair:i,word})));for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}first=null;second=null;matches=new Set();locked=false;moves=0;$('feedback').textContent='🌿 Quan sát, ghi nhớ và tìm hai thẻ cùng một cặp nhé!';$('subline').textContent='Lật hai thẻ để tìm cặp tương ứng';draw()}
$('restart').addEventListener('click',reset);reset();
</script></body></html>'''
(preview/'memory281.html').write_text(html.replace('__LINKS__',links),encoding='utf-8')
print('Created',preview/'memory281.html')

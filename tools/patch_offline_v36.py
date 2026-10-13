from pathlib import Path
p=Path(__file__).resolve().parents[1]/'preview/offline_interactive.js'
s=p.read_text()
s=s.replace("let history=(()=>{try{return JSON.parse(localStorage.getItem(savedKey)||'[]')}catch{return []}})();", "let history=(()=>{try{let h=JSON.parse(localStorage.getItem(savedKey)||'[]');return Array.isArray(h)?h.filter(v=>v&&typeof v.game==='string'&&Number.isFinite(v.score)&&Number.isFinite(v.total)):[]}catch{return []}})();")
s=s.replace('let gs=null,clock=0;', '''let gs=null,sessionSerial=0;
function updateProgress(){
 const count=history.length,stars=history.reduce((a,h)=>a+Number(h.score||0),0);
 const st=document.getElementById('totalStars'),co=document.getElementById('completedGames');
 if(st)st.textContent=stars+' ngôi sao';if(co)co.textContent=count+' lượt chơi hoàn thành';
 const pr=document.getElementById('overallProgress');if(pr)pr.style.width=Math.min(100,stars/30*100)+'%';
 const ss=document.getElementById('shortcutStars'),sg=document.getElementById('shortcutGames');
 if(ss)ss.textContent='⭐ '+stars+' sao';if(sg)sg.textContent='🎮 '+count+' lượt';
}
''')
s=s.replace("try{localStorage.setItem(savedKey,JSON.stringify(history))}catch{};", "try{localStorage.setItem(savedKey,JSON.stringify(history))}catch{};updateProgress();")
s=s.replace("function record(game,score,total){history.push({game,score,total,time:new Date().toISOString()});try{localStorage.setItem(savedKey,JSON.stringify(history))}catch{};}", "function record(game,score,total){history.push({game,score,total,time:new Date().toISOString()});try{localStorage.setItem(savedKey,JSON.stringify(history))}catch{}updateProgress();}")
s=s.replace("function openGame(id){gs={id,index:0", "function openGame(id){gs={id,serial:++sessionSerial,finished:false,index:0")
s=s.replace("for(let i=cards.length-1;i>0;i--){let j=(i*7+3)% (i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}", "for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}")
s=s.replace("if(!gs||gs.busy)return;gs.busy=true;let correct", "if(gs!==s||gs.busy)return;gs.busy=true;let correct")
s=s.replace("if(!gs||gs.id!=='math-quest')return;gs.index++;gs.busy=false;paintGame()", "if(gs!==s)return;s.index++;s.busy=false;paintGame()")
s=s.replace("if(!gs||gs.busy)return;let i=Number(b.dataset.card),card=gs.cards[i]", "if(gs!==s||gs.busy)return;let i=Number(b.dataset.card),card=s.cards[i]")
s=s.replace("if(!gs||gs.id!=='memory-match')return;", "if(gs!==s)return;")
s=s.replace("if(gs.busy)return;let word=gs.words.find", "if(gs!==s||s.busy)return;let word=s.words.find")
s=s.replace("if(gs.busy)return;gs.answer=", "if(gs!==s||s.busy)return;s.answer=")
s=s.replace("if(gs.busy)return;\n     let desired", "if(gs!==s||s.busy)return;\n     let desired")
s=s.replace("if(!gs||gs.id!=='sentence-builder')return;gs.index++;gs.words=[];gs.busy=false;paintGame()", "if(gs!==s)return;s.index++;s.words=[];s.busy=false;paintGame()")
s=s.replace("function finish(){if(!gs)return;const id=gs.id,total=", "function finish(){if(!gs||gs.finished)return;gs.finished=true;const id=gs.id,total=")
s=s.replace("document.getElementById('exitGame').addEventListener('click',closeGame);", "document.getElementById('exitGame').addEventListener('click',closeGame);\ndocument.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeGame()});")
s=s.replace("body.innerHTML=`<div class=\"play-complete\"><h2>📊 Kết quả học tập</h2><p>Đã ghi ${history.length} lượt chơi trên thiết bị.</p><div class=\"history\">${history.slice(-10).reverse().map(h=>`<div><strong>${content[h.game]?.name||h.game}</strong><span>${h.score}/${h.total} · ${new Date(h.time).toLocaleDateString('vi-VN')}</span></div>`).join('')||'<p>Chưa có kết quả nào.</p>'}</div></div>`;", """body.innerHTML=`<div class="play-complete"><h2>📊 Kết quả học tập</h2><p>Đã ghi ${history.length} lượt chơi trên thiết bị.</p><div class="history">${history.slice(-10).reverse().map(h=>`<div><strong>${content[h.game]?.name||h.game}</strong><span>${h.score}/${h.total} · ${new Date(h.time).toLocaleDateString('vi-VN')}</span></div>`).join('')||'<p>Chưa có kết quả nào.</p>'}</div><button class="play-check" id="exportProgress" type="button">⬇ Xuất sao lưu kết quả (JSON)</button></div>`;
 document.getElementById('exportProgress').onclick=()=>{const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),history},null,2)],{type:'application/json'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download='BaoAn_3D_KetQua.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};""")
s += '\nupdateProgress();\n'
p.write_text(s)
print('patch complete',len(s))

const content={
  'math-quest':{name:'Math Quest',questions:[
    ['12 + 8 = ?', ['18','20','22','24'],1,'12 cộng 8 bằng 20.'],
    ['24 - 6 = ?', ['16','18','20','22'],1,'24 trừ 6 bằng 18.'],
    ['7 × 3 = ?', ['18','21','24','27'],1,'7 nhân 3 bằng 21.'],
    ['36 : 4 = ?', ['8','9','7','6'],1,'36 chia đều thành 4 nhóm, mỗi nhóm 9.'],
    ['15 + 7 = ?', ['21','23','22','24'],2,'15 cộng 7 bằng 22.'],
    ['6 × 4 = ?', ['20','22','24','26'],2,'6 nhân 4 bằng 24.'],
    ['42 - 15 = ?', ['25','26','27','28'],2,'42 trừ 15 bằng 27.'],
    ['48 : 6 = ?', ['6','7','8','9'],2,'48 chia 6 bằng 8.']
  ]},
  'memory-match':{name:'Memory Match',pairs:[['mother','mẹ'],['father','bố'],['brother','anh / em trai'],['sister','chị / em gái'],['grandmother','bà'],['grandfather','ông']]},
  'sentence-builder':{name:'Sentence Builder',sentences:[
   'The cat is on the mat.','My mother is in the kitchen.','I have a new school bag.','She likes reading books.','We play football after school.'
  ]}
};
// Content imports are a separate namespace from results, preserving previous local progress.
const contentStorageKey='baoan.offline.content1';
const expectedKinds={'math-quest':'quiz','memory-match':'pairs','sentence-builder':'sentences'};
const htmlEscape=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isText=(s,min=1,max=500)=>typeof s==='string'&&s.trim().length>=min&&s.length<=max;
function checkPack(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||!isText(p.id,3,80)||!/^[-a-z0-9]+$/.test(p.id)||!Number.isInteger(p.version)||p.version<1||
   !isText(p.title,1,90)||!Number.isInteger(p.grade)||p.grade<1||p.grade>12||!['quiz','pairs','sentences'].includes(p.kind)||
   !['math','vietnamese','english','thinking'].includes(p.subject)||!Array.isArray(p.items)||p.items.length<2||p.items.length>30)return false;
 const ids=new Set(),faces=new Set(),prompts=new Set();
 for(const item of p.items){
  if(!item||typeof item!=='object'||!isText(item.id,1,80)||!isText(item.objectiveId,1,80)||ids.has(item.id))return false;
  ids.add(item.id);
  if(p.kind==='quiz'){
   if(item.kind!=='multiple-choice'||!isText(item.prompt,1,320)||!Array.isArray(item.options)||item.options.length!==4||!item.options.every(x=>isText(x,1,120))||!Number.isInteger(item.correctIndex)||item.correctIndex<0||item.correctIndex>3||!isText(item.explanation,1,500))return false;
   const normalized=item.options.map(x=>x.trim().toLocaleLowerCase('vi'));if(new Set(normalized).size!==4)return false;
   const prompt=item.prompt.trim().toLocaleLowerCase('vi');if(prompts.has(prompt))return false;prompts.add(prompt);
  }else if(p.kind==='pairs'){
   if(item.kind!=='pair'||!isText(item.left,1,120)||!isText(item.right,1,120))return false;
   for(const face of [item.left,item.right]){const key=face.trim().toLocaleLowerCase('vi');if(faces.has(key))return false;faces.add(key);}
  }else{
   if(item.kind!=='sentence'||!isText(item.prompt,1,320)||!isText(item.hint,1,160)||!Array.isArray(item.words)||item.words.length<3||item.words.length>15||!item.words.every(w=>isText(w,1,45)&&!/[\s]/.test(w)))return false;
   const prompt=item.words.join(' ').trim().toLocaleLowerCase('vi');if(prompts.has(prompt))return false;prompts.add(prompt);
  }
 }
 return true;
}
const packKey=p=>`${p.id}@${p.version}`;
let importedPacks=(()=>{try{const rows=JSON.parse(localStorage.getItem(contentStorageKey)||'[]');return Array.isArray(rows)?rows.slice(0,40).filter(checkPack):[]}catch{return []}})();
function contentFromPack(id,p){
 if(!p ||p.kind!==expectedKinds[id])return content[id];
 const name=content[id].name;
 if(id==='math-quest')return {name,packId:packKey(p),questions:p.items.map(q=>[q.prompt,q.options,q.correctIndex,q.explanation])};
 if(id==='memory-match')return {name,packId:packKey(p),pairs:p.items.map(pair=>[pair.left,pair.right])};
 return {name,packId:packKey(p),sentences:p.items.map(item=>item.words.join(' '))};
}
function refreshPackSelectors(){
 ['math-quest','memory-match','sentence-builder'].forEach((id,i)=>{
  const select=document.getElementById('pack'+i);if(!select)return;
  const prev=select.value;select.replaceChildren();
  const base=document.createElement('option');base.value='builtin';base.textContent=['Bài mẫu · Toán 3','Bài mẫu · Từ vựng','Bài mẫu · Ghép câu'][i];select.append(base);
  for(const p of importedPacks.filter(p=>p.kind===expectedKinds[id])){
   const option=document.createElement('option');option.value=packKey(p);option.textContent=p.title+' · Lớp '+p.grade+' (v'+p.version+')';select.append(option);
  }
  if([...select.options].some(o=>o.value===prev))select.value=prev;
 });
}
function getChosenPack(id){
 const index=['math-quest','memory-match','sentence-builder'].indexOf(id);
 const selected=document.getElementById('pack'+index)?.value;
 return importedPacks.find(p=>packKey(p)===selected&&p.kind===expectedKinds[id]);
}
async function importContentFile(file){
 if(!file||file.size>1048576)throw new Error('Tệp học liệu không hợp lệ hoặc lớn hơn 1 MB.');
 let data;try{data=JSON.parse(await file.text());}catch{throw new Error('Tệp JSON không đọc được.');}
 if(data?.schema!=='baoan-learning-content'||data?.formatVersion!==1||!Array.isArray(data.packs)||data.packs.length<1||data.packs.length>40||!data.packs.every(checkPack))throw new Error('Nội dung JSON sai định dạng hoặc không qua kiểm tra dữ liệu.');
 const keys=new Set(),fresh=[];
 for(const p of data.packs){const key=packKey(p);if(keys.has(key))throw new Error('Có bộ học liệu trùng mã trong tệp.');keys.add(key);
  if(!importedPacks.some(x=>packKey(x)===key))fresh.push(p);
 }
 if(importedPacks.length+fresh.length>40)throw new Error('Thư viện tối đa 40 bộ học liệu; cần chuyển sang React để lưu nhiều hơn.');
 if(fresh.length){
  const next=[...importedPacks,...fresh];
  // Atomic, if browser storage is unavailable we do not claim success or lose the previous list.
  try{localStorage.setItem(contentStorageKey,JSON.stringify(next));}catch{throw new Error('Không thể lưu nội dung trên thiết bị. Hãy kiểm tra bộ nhớ và quyền lưu trữ.');}
  importedPacks=next;refreshPackSelectors();
 }
 return {created:fresh.length,skipped:data.packs.length-fresh.length};
}
const importButton=document.getElementById('importContentButton'),importInput=document.getElementById('importContentFile');
importButton?.addEventListener('click',()=>importInput?.click());
importInput?.addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{const result=await importContentFile(file);alert(`Đã thêm ${result.created} bộ học liệu, bỏ qua ${result.skipped} phiên bản đã có. Chọn nội dung trong menu của từng game.`);}
 catch(error){alert('Không nhập được học liệu: '+(error instanceof Error?error.message:'Tệp lỗi'));}
});
refreshPackSelectors();
const modal=document.getElementById('playLayer'), body=document.getElementById('playContent'),title=document.getElementById('playTitle');
const savedKey='baoan.real3d.offline1';
const isValidRecord=(v)=>v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(content,v.game)&&Number.isInteger(v.score)&&Number.isInteger(v.total)&&v.total>0&&v.total<=100&&v.score>=0&&v.score<=v.total&&typeof v.time==='string'&&Number.isFinite(Date.parse(v.time));
let history=(()=>{try{let h=JSON.parse(localStorage.getItem(savedKey)||'[]');return Array.isArray(h)?h.slice(-10000).filter(isValidRecord):[]}catch{return []}})();
let gs=null,sessionSerial=0;
function updateProgress(){
 const count=history.length,stars=history.reduce((a,h)=>a+Number(h.score||0),0);
 const st=document.getElementById('totalStars'),co=document.getElementById('completedGames');
 if(st)st.textContent=stars+' ngôi sao';if(co)co.textContent=count+' lượt chơi hoàn thành';
 const pr=document.getElementById('overallProgress');if(pr)pr.style.width=Math.min(100,stars/30*100)+'%';
 const ss=document.getElementById('shortcutStars'),sg=document.getElementById('shortcutGames');
 if(ss)ss.textContent='⭐ '+stars+' sao';if(sg)sg.textContent='🎮 '+count+' lượt';
}

function record(game,score,total){history.push({game,score,total,time:new Date().toISOString()});let saved=true;try{localStorage.setItem(savedKey,JSON.stringify(history))}catch{saved=false};updateProgress();return saved;}
function openGame(id){if(!content[id]||!modal.hidden)return;const data=contentFromPack(id,getChosenPack(id));gs={id,data,serial:++sessionSerial,finished:false,index:0,score:0,busy:false,matches:new Set(),picked:[],cards:[],words:[],answer:[],wrong:0};body.dataset.session='';title.textContent=data.name+(data.packId?' · Bài đã nhập':'');
 revealDialog();modal.hidden=false;world.setPaused(true);document.body.classList.add('playing');
 if(id==='memory-match'){let cards=data.pairs.flatMap(([left,right],i)=>[{key:i,text:left},{key:i,text:right}]);
   for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
   gs.cards=cards;}
 paintGame();document.getElementById('exitGame').focus();}
function closeGame(){modal.hidden=true;gs=null;body.dataset.session='';world.setPaused(false);document.body.classList.remove('playing');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
function stamp(t){return `<div class="play-notice" role="status" id="playFeedback">${t}</div>`}
function headline(sub){return `<div class="play-status"><span>${sub}</span><span>⭐ ${gs.score} sao</span></div>`}
function paintGame(){if(!gs)return;const s=gs, d=s.data;
 if(s.id==='math-quest'){
   if(s.index>=d.questions.length){finish();return;}
   const q=d.questions[s.index];
   body.innerHTML=headline(`Thử thách ${s.index+1} / ${d.questions.length}`)+`<div class="play-question">${htmlEscape(q[0])}</div><div class="play-answers">${q[1].map((x,i)=>`<button data-answer="${i}" class="play-answer">${String.fromCharCode(65+i)} &nbsp; ${htmlEscape(x)}</button>`).join('')}</div>`+stamp('Chọn đáp án để vượt thử thách!');
   body.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{
     if(gs!==s||gs.busy)return;gs.busy=true;let correct=Number(b.dataset.answer)===q[2];
     if(correct)gs.score++;b.classList.add(correct?'good':'bad');
     body.querySelectorAll('[data-answer]').forEach(a=>a.disabled=true);
     document.getElementById('playFeedback').textContent=(correct?'✅ Chính xác! ':'💡 Chưa đúng. Mình xem cách giải rồi sang câu tiếp nhé! ')+q[3];
     window.setTimeout(()=>{if(gs!==s)return;s.index++;s.busy=false;paintGame()},900);
   }));
 } else if(s.id==='memory-match'){
   // Keep the card DOM mounted: rebuilding twelve buttons on every click
   // loses keyboard focus and causes visible frame/layout jitter on mobile.
   paintMemory(s,d);
 } else {
   if(s.index>=d.sentences.length){finish();return;}
   if(!s.words.length){let sentence=d.sentences[s.index].replace(/\.$/,'');s.words=sentence.split(' ').map((t,i)=>({id:i,text:t}));s.words.sort((a,b)=>((a.id*7+3)%11)-((b.id*7+3)%11));s.answer=[];}
   body.innerHTML=headline(`Câu ${s.index+1} / ${d.sentences.length}`)+`<div class="play-question play-sentence">${s.answer.length?s.answer.map(w=>`<button class="word-chip used" data-remove="${w.id}">${htmlEscape(w.text)}</button>`).join(''):'Chọn từ bên dưới để tạo câu đúng!'}</div><div class="play-wordbank">${s.words.filter(w=>!s.answer.some(a=>a.id===w.id)).map(w=>`<button class="word-chip" data-word="${w.id}">${htmlEscape(w.text)}</button>`).join('')}</div><button class="play-check" id="checkSentence" ${s.answer.length?'':'disabled'}>✓ Kiểm tra câu</button>`+stamp('Chạm vào từ để ghép câu.');
   body.querySelectorAll('[data-word]').forEach(b=>b.addEventListener('click',()=>{if(gs!==s||s.busy)return;let word=s.words.find(w=>w.id===Number(b.dataset.word));if(word)gs.answer.push(word);paintGame()}));
   body.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{if(gs!==s||s.busy)return;s.answer=gs.answer.filter(w=>w.id!==Number(b.dataset.remove));paintGame()}));
   document.getElementById('checkSentence').addEventListener('click',()=>{
     if(gs!==s||s.busy)return;
     let desired=d.sentences[gs.index].replace(/\.$/,'');let response=gs.answer.map(w=>w.text).join(' ');
     if(response===desired){gs.busy=true;gs.score++;document.getElementById('playFeedback').textContent='🌟 Chính xác! Một câu thật hay!';setTimeout(()=>{if(gs!==s)return;s.index++;s.words=[];s.busy=false;paintGame()},750)}
     else document.getElementById('playFeedback').textContent='Hãy xem lại thứ tự các từ, con nhé!';
   });
 }
}
function paintMemory(s,d){
 if(s.matches.size===d.pairs.length){finish();return;}
 const old=body.querySelector('.play-memory');
 if(!old||body.dataset.session!==String(s.serial)){
   body.dataset.session=String(s.serial);
   body.innerHTML=headline(`Đã ghép 0 / ${d.pairs.length} cặp`)+
     `<div class="play-memory">${s.cards.map((card,i)=>`<button type="button" class="play-tile" data-card="${i}" aria-label="Lật thẻ ${i+1}" aria-pressed="false">✦</button>`).join('')}</div>`+
     stamp('Lật hai thẻ để tìm một cặp nhé!');
   body.querySelectorAll('[data-card]').forEach(b=>b.addEventListener('click',()=>{
     if(gs!==s||s.busy)return;
     const i=Number(b.dataset.card),card=s.cards[i];
     if(s.picked.includes(i)||s.matches.has(card.key))return;
     s.picked.push(i);
     if(s.picked.length===2)s.busy=true;
     paintMemory(s,d);
     if(s.picked.length!==2)return;
     const [a,c]=s.picked,match=s.cards[a].key===s.cards[c].key;
     document.getElementById('playFeedback').textContent=match?'🎉 Ghép đúng! Giỏi lắm!':'Hai thẻ chưa khớp, con thử lại nhé.';
     setTimeout(()=>{
       if(gs!==s)return;
       if(match){s.matches.add(s.cards[a].key);s.score++;}
       s.picked=[];s.busy=false;paintMemory(s,d);
     },match?500:650);
   }));
 }
 const status=body.querySelector('.play-status');
 if(status){status.firstElementChild.textContent=`Đã ghép ${s.matches.size} / ${d.pairs.length} cặp`;status.lastElementChild.textContent=`⭐ ${s.score} sao`;}
 body.querySelectorAll('[data-card]').forEach((b,i)=>{
   const card=s.cards[i],matched=s.matches.has(card.key),visible=matched||s.picked.includes(i);
   b.textContent=visible?card.text:'✦';
   b.classList.toggle('up',visible);b.classList.toggle('found',matched);
   b.disabled=matched||s.busy;
   b.setAttribute('aria-label',visible?card.text:'Lật thẻ '+(i+1));
   b.setAttribute('aria-pressed',String(visible));
 });
 if(!s.busy){const feedback=document.getElementById('playFeedback');if(feedback)feedback.textContent=s.picked.length?'Chọn thêm một thẻ để ghép cặp nhé!':'Lật hai thẻ để tìm một cặp nhé!';}
}
function finish(){if(!gs||gs.finished)return;gs.finished=true;const id=gs.id,total=id==='memory-match'?gs.data.pairs.length:id==='math-quest'?gs.data.questions.length:gs.data.sentences.length;
 const score=gs.score,saved=record(id,score,total);body.innerHTML=`<div class="play-complete"><div class="play-medal">🏆</div><h2>Hoàn thành thử thách!</h2><p>Con đạt <strong>${score}/${total}</strong> điểm và đã khám phá thêm một vùng đất.</p>${saved?'':'<p role="alert" style="color:#9b2519">Bộ nhớ trình duyệt bị chặn. Kết quả chưa được lưu; hãy vào Góc phụ huynh để xuất JSON trước khi đóng trang.</p>'}<button class="play-check" id="done">Về thế giới học tập</button></div>`;document.getElementById('done').addEventListener('click',closeGame);
}
document.getElementById('exitGame').addEventListener('click',closeGame);
let returnFocus=null;
const revealDialog=()=>{returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;};
document.addEventListener('keydown',e=>{
 if(modal.hidden)return;
 if(e.key==='Escape'){e.preventDefault();closeGame();return;}
 if(e.key!=='Tab')return;
 const focusables=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]')).filter(el=>el.getClientRects().length);
 if(!focusables.length){e.preventDefault();return;}
 const first=focusables[0],last=focusables[focusables.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
document.querySelectorAll('[data-play]').forEach(e=>e.onclick=()=>{openGame(e.dataset.play);});
document.getElementById('mini').onclick=()=>{
  revealDialog();title.textContent='Bảng cửu chương';modal.hidden=false;world.setPaused(true);let num=3;
  body.innerHTML=`<div class="play-complete"><h2>🧩 Bảng nhân tương tác</h2><label for="mul">Chọn bảng nhân: </label><select id="mul">${Array.from({length:8},(_,i)=>`<option value="${i+2}" ${i+2===3?'selected':''}>Bảng ${i+2}</option>`).join('')}</select><div id="mulRows" class="table-rows"></div></div>`;
  const paint=()=>document.getElementById('mulRows').innerHTML=Array.from({length:10},(_,i)=>`<span>${Number(document.getElementById('mul').value)} × ${i+1} = <strong>${Number(document.getElementById('mul').value)*(i+1)}</strong></span>`).join('');
  document.getElementById('mul').onchange=paint;paint();
};
// Demo-only progress panel with genuine session records saved on the device.
document.getElementById('parentNav').onclick=()=>{revealDialog();modal.hidden=false;world.setPaused(true);title.textContent='Góc phụ huynh · Báo cáo thử nghiệm';
 body.innerHTML=`<div class="play-complete"><h2>📊 Kết quả học tập</h2><p>Đã ghi ${history.length} lượt chơi trên thiết bị.</p><div class="history">${history.slice(-10).reverse().map(h=>`<div><strong>${content[h.game]?.name||h.game}</strong><span>${h.score}/${h.total} · ${new Date(h.time).toLocaleDateString('vi-VN')}</span></div>`).join('')||'<p>Chưa có kết quả nào.</p>'}</div><button class="play-check" id="exportProgress" type="button">⬇ Xuất sao lưu kết quả (JSON)</button><button class="play-check" id="exportContent" type="button" ${importedPacks.length?'':'disabled'}>📚 Xuất ${importedPacks.length} bộ học liệu đã nhập (JSON)</button><label style="font-size:14px;font-weight:800;color:#355d7e">↥ Khôi phục bản sao lưu: <input id="importProgress" type="file" accept="application/json,.json" style="max-width:100%"></label><div id="restoreStatus" role="status" aria-live="polite"></div></div>`;
 document.getElementById('exportProgress').onclick=()=>{const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),history},null,2)],{type:'application/json'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download='BaoAn_3D_KetQua.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
 document.getElementById('exportContent').onclick=()=>{
   if(!importedPacks.length)return;
   const bundle={schema:'baoan-learning-content',formatVersion:1,exportedAt:new Date().toISOString(),packs:importedPacks};
   const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
   const link=document.createElement('a');const url=URL.createObjectURL(blob);
   link.href=url;link.download='BaoAn_HocLieu_DaNhap.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
 document.getElementById('importProgress').onchange=async e=>{const file=e.target.files?.[0],status=document.getElementById('restoreStatus');if(!file)return;
  if(file.size>2000000){status.textContent='Tệp vượt giới hạn 2 MB.';return;}
  try{const data=JSON.parse(await file.text());if(data.schema!==1||!Array.isArray(data.history)||data.history.length>10000||!data.history.every(isValidRecord))throw Error('Định dạng dữ liệu không hợp lệ');
   if(!confirm('Khôi phục sẽ THAY THẾ toàn bộ kết quả trên thiết bị này. Bạn có chắc chắn không?')){status.textContent='Đã hủy khôi phục.';return;}
   localStorage.setItem(savedKey,JSON.stringify(data.history));history=[...data.history];updateProgress();status.textContent='Đã khôi phục '+history.length+' lượt chơi. Vui lòng mở lại Góc phụ huynh để xem chi tiết.';
  }catch(err){status.textContent='Không thể khôi phục: '+(err instanceof Error?err.message:'Tệp bị lỗi');}
 };
};

updateProgress();

import { expect,type Page } from '@playwright/test';

// Legacy learning/contest regression uses explicit advanced navigation and the
// accessible DOM game controls. The default character entry is tested separately.
export const advancedLearningPath='/?advanced=1&view=learning&controls=1';
export const advancedContestPath='/?advanced=1&view=contest&controls=1';
export const advancedGamesPath='/?advanced=1&view=games&controls=1';

export async function rows(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('bao-an-learning-v3-alpha');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{return await new Promise<Record<string,any[]>>((resolve,reject)=>{const names=['sessions','events','sessionResults','lessonProgress','packs','profiles','curricula','reviews'];
    const tx=db.transaction(names,'readonly'),reads=Object.fromEntries(names.map(name=>[name,tx.objectStore(name).getAll()]));
    tx.oncomplete=()=>resolve(Object.fromEntries(names.map(name=>[name,reads[name].result])));tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
});}
export async function readCards(page:Page){
  await expect(page.getByRole('region',{name:/^Bài học /})).toBeVisible();
  const db=await rows(page),session=db.sessions.find(row=>row.status==='active'&&row.mode);
  if(session.mode!=='lesson-practice')return;
  const lesson=db.curricula.find(row=>row.curriculum.curriculumId===session.scope.curriculumId&&row.curriculum.revision===session.scope.curriculumRevision).curriculum.lessons.find((row:any)=>row.lessonId===session.scope.lessonId);
  for(const step of lesson.steps.slice(session.checkpoint.stepIndex)){
    await expect(page.getByRole('heading',{name:step.title,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Con đã đọc xong',exact:true}).click();
    await expect(page.getByRole('heading',{name:step.title,exact:true})).toHaveCount(0);
  }
}
export async function answer(page:Page,wrongFirst=false,wrongCount=wrongFirst?1:0,finalize=true){
  await readCards(page);
  const db=await rows(page),session=db.sessions.find(row=>row.status==='active'&&row.mode),guided=session.mode==='lesson-practice';
  const committed=db.events.filter(row=>row.sessionId===session.sessionId).sort((a,b)=>a.sequence-b.sequence);
  const latest=new Map(committed.map(row=>[JSON.stringify([row.itemRef.packId,row.itemRef.contentVersion,row.itemRef.itemId]),row]));
  const startIndex=session.checkpoint.itemOrder.findIndex((ref:any)=>{const last=latest.get(JSON.stringify([ref.packId,ref.contentVersion,ref.itemId]));return !last||guided&&!last.correct;});
  for(const [index,ref] of session.checkpoint.itemOrder.entries()){
    if(startIndex<0||index<startIndex)continue;
    const item=db.packs.find(row=>row.pack.id===ref.packId&&row.pack.version===ref.contentVersion).pack.items.find((row:any)=>row.id===ref.itemId);
    await expect(page.getByRole('heading',{name:item.prompt,exact:true})).toBeVisible();
    await page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth(index<wrongCount?(item.correctIndex+1)%4:item.correctIndex).click();
    await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();
    if(index<wrongCount&&guided){await expect(page.getByText('Mình cùng xem lại nhé.',{exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Thử lại câu này'}).click();await page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth(item.correctIndex).click();await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();}
    if(!guided){await expect(page.getByText('Đã lưu câu trả lời của con.',{exact:true})).toBeVisible();await expect(page.getByText(item.explanation,{exact:true})).toHaveCount(0);}
    await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:'Hoàn tất và lưu',exact:true})).toBeVisible();
  if(finalize){await page.getByRole('button',{name:'Hoàn tất và lưu',exact:true}).click();await expect(page.getByRole('region',{name:'Kết quả bài học'})).toBeVisible();}
}

import { expect,type Page } from '@playwright/test';
import { readCards,rows } from './self-study';
export async function answerRich(page:Page,wrongIndex=-1,finalize=true){
  await readCards(page);const state=await rows(page),session=state.sessions.find(row=>row.status==='active'&&row.mode),guided=session.mode==='lesson-practice';
  const committed=state.events.filter(row=>row.sessionId===session.sessionId).sort((a,b)=>a.sequence-b.sequence),latest=new Map(committed.map(row=>[JSON.stringify([row.itemRef.packId,row.itemRef.contentVersion,row.itemRef.itemId]),row]));
  for(const [index,ref] of session.checkpoint.itemOrder.entries()){
    const prior=latest.get(JSON.stringify([ref.packId,ref.contentVersion,ref.itemId]));if(prior&&(!guided||prior.correct))continue;
    const pack=state.packs.find(row=>row.pack.id===ref.packId&&row.pack.version===ref.contentVersion).pack,item=pack.items.find((row:any)=>row.id===ref.itemId);
    const question=page.getByRole('article',{name:'Câu hỏi đang làm'});await expect(question.getByText(`Câu ${index+1}/${session.checkpoint.itemOrder.length}`,{exact:true})).toBeVisible();
    if(item.audioId){const current=(await rows(page)).sessions.find(row=>row.sessionId===session.sessionId),played=current.checkpoint.mediaPlayback?.some((row:any)=>row.mediaId===item.audioId);
      if(!played){await question.getByRole('button',{name:'Nghe âm thanh',exact:true}).click();await expect(question.getByRole('status')).toContainText('Đã nghe clip này');}}
    if(item.options){await question.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth(index===wrongIndex?(item.correctIndex+1)%4:item.correctIndex).click();}
    else await question.getByRole('textbox').fill(index===wrongIndex?'sai đáp án':item.answer??item.acceptedAnswers[0]);
    await question.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();
    if(guided&&index===wrongIndex){await question.getByRole('button',{name:'Thử lại câu này'}).click();if(item.options)await question.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth(item.correctIndex).click();else await question.getByRole('textbox').fill(item.answer??item.acceptedAnswers[0]);await question.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();}
    if(!guided){await expect(question).toContainText('Đã lưu câu trả lời của con.');await expect(question.getByText(item.explanation,{exact:true})).toHaveCount(0);}
    await question.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  }
  if(finalize){await page.getByRole('button',{name:'Hoàn tất và lưu',exact:true}).click();await expect(page.getByRole('region',{name:'Kết quả bài học'})).toBeVisible();}
}

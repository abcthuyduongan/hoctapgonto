import {randomUUID} from 'node:crypto';

export async function seedRewardJourney(post,classId){
  const sets=['Toán','Tiếng Việt','Tiếng Anh'].map((subjectLabel,i)=>({subjectLabel,pack:{id:'reward-flow-'+i,version:1,title:'Bộ '+subjectLabel,grade:3,subject:'thinking',source:'local',publishedAt:'2026-11-07T00:00:00.000Z',kind:'quiz',items:[1,2].map(n=>({id:'reward-'+i+'-'+n,kind:'multiple-choice',objectiveId:'REWARD.FLOW',prompt:`${subjectLabel}: câu ${n}`,options:[`Đúng ${i}.${n}`,'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án của dữ liệu thử.'}))}}));
  await post('/weeks',{requestId:randomUUID(),classId,title:'Tuần đổi quà',sets});return sets;
}

export async function earnRewardJourney(post,sets){
  for(const {pack} of sets){
    const play=await post('/play/compact',{requestId:randomUUID(),moduleId:'math-quest',packId:pack.id,contentVersion:1});
    for(const source of pack.items){
      const open=await post(`/play/${play.session.sessionId}/question-open`,{itemId:source.id});
      await post(`/play/${play.session.sessionId}/attempt`,{attemptKey:source.id,itemId:source.id,presentationId:open.item.presentationId,response:{kind:'choice',choiceIndex:open.item.options.indexOf(source.options[0])},hintsUsed:0,elapsedMs:0});
    }
    await post(`/play/${play.session.sessionId}/complete-compact`,{});
  }
}

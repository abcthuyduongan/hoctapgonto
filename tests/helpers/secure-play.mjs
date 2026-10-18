import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {onlinePresentation} from '../../src/core/online-exercises.ts';
import {audioDurationMs} from '../../server/audio-duration.mjs';

// Authored fixture answers live outside HTTP responses. Negative API tests call
// request/denied directly and do not use this normal-play convenience adapter.
const sessions=new Map();
export function rememberPlay(play,source){sessions.set(play.session.sessionId,{view:onlinePresentation(play.session.moduleId,source),opened:new Set(),hinted:new Set()});return play;}
export function fixtureQuestion(play,item){const q=sessions.get(play.session.sessionId)?.view.items.find(row=>row.id===item.id);assert.ok(q,'Test must register its authored fixture source');return q;}
export async function registerStorePlay(client,play,store){const identity=(await client.request('/me')).data;const value=await store.play(identity.user,play.session.sessionId);rememberPlay(play,value.pack);}
export async function prepareSuccessfulAttempt(client,route,options){
 const id=/^\/play\/([^/]+)\/attempt$/.exec(route)?.[1],state=id?sessions.get(id):null,input=options?.body;
 if(!state||!input||!['quiz','learning'].includes(state.view.kind))return;
 const item=state.view.items.find(q=>q.id===input.itemId);if(!item)return;
 if(!state.opened.has(item.id)){
  if(['listening-choice','listening-gap'].includes(item.kind)){
   const url=client.origin+'/api/online/media/'+item.audioId+'?playId='+id+'&itemId='+item.id,request=new Request(url,{headers:{Cookie:client.cookie}});
   const response=client.api?await client.api(request):await fetch(request);assert.ok(response.ok,await response.clone().text());const bytes=Buffer.from(await response.arrayBuffer());await delay(await audioDurationMs(bytes,response.headers.get('content-type'))+10);
  }
  await client.ok('/play/'+id+'/question-open',{method:'POST',body:{itemId:item.id}});state.opened.add(item.id);
 }
 if(input.hintsUsed>0&&!state.hinted.has(item.id)){await client.ok('/play/'+id+'/question-hint',{method:'POST',body:{itemId:item.id}});state.hinted.add(item.id);}
}

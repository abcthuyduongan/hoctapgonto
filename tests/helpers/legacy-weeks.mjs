import {randomUUID,createHash} from 'node:crypto';
import {parseContentImport} from '../../src/core/content-io.ts';
const stable=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
/** Seed a pre-RC9 week for migration/regression fixtures. Never used by application code.
 * New publication and revisions must call the real store/API, which enforce RC9 rules. */
export function seedLegacyWeek(store,auth,input){
  if(store.pool)return seedPostgres(store,auth,input);
  const cls=store.class(auth,input.classId),weekId=randomUUID(),at=new Date().toISOString();
  store.tx(()=>{const position=store.db.prepare('SELECT coalesce(max(position),0)+1 AS n FROM weeks WHERE workspace_id=? AND class_id=?').get(auth.workspaceId,input.classId).n;
    store.db.prepare('INSERT INTO weeks VALUES(?,?,?,?,?,?,?,?)').run(weekId,auth.workspaceId,input.classId,input.title,position,input.requestId,digest(input),at);
    input.sets.forEach((set,index)=>{const existing=store.db.prepare('SELECT json FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId,set.pack.id,set.pack.version),pack=existing?JSON.parse(existing.json):normalize(set.pack,cls.grade);if(!existing){const {publishedAt,source,...content}=pack;store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run(auth.workspaceId,pack.id,pack.version,set.subjectLabel,JSON.stringify(pack),digest(content));}store.db.prepare('INSERT INTO week_sets VALUES(?,?,?,?,?)').run(auth.workspaceId,weekId,index+1,pack.id,pack.version);});store.audit(auth,'week.publish',weekId);
  });return store.weeks(auth,input.classId).find(week=>week.id===weekId);
}
function normalize(pack,grade){return parseContentImport(JSON.stringify({schema:'baoan-learning-content',formatVersion:pack.kind==='learning'?2:1,packs:[{...pack,grade,subject:'thinking'}]}))[0];}
async function seedPostgres(store,auth,input){const weekId=randomUUID(),at=new Date().toISOString();await store.mutate(auth,async client=>{const cls=await store.class(auth,input.classId,client),position=(await store.one('SELECT coalesce(max(position),0)+1 AS n FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2',[auth.workspaceId,input.classId],client)).n;
  await store.exec('INSERT INTO bao_an.weeks VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[weekId,auth.workspaceId,input.classId,input.title,position,input.requestId,digest(input),at],client);
  for(const[index,set]of input.sets.entries()){const existing=await store.one('SELECT json FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3',[auth.workspaceId,set.pack.id,set.pack.version],client),pack=existing?(typeof existing.json==='string'?JSON.parse(existing.json):existing.json):normalize(set.pack,cls.grade);if(!existing){const{publishedAt,source,...content}=pack;await store.exec('INSERT INTO bao_an.packs VALUES($1,$2,$3,$4,$5::jsonb,$6)',[auth.workspaceId,pack.id,pack.version,set.subjectLabel,JSON.stringify(pack),digest(content)],client);}await store.exec('INSERT INTO bao_an.week_sets VALUES($1,$2,$3,$4,$5)',[auth.workspaceId,weekId,index+1,pack.id,pack.version],client);}await store.audit(auth,'week.publish',weekId,client);
});return(await store.weeks(auth,input.classId)).find(week=>week.id===weekId);}

/** Test setup only: migrate an old API fixture before exercising its existing-week behavior. */
export async function seedLegacyApiWeek(store,identity,input){const auth=identity.user;if(!auth||auth.role!=='admin')throw Error('Legacy fixture requires admin identity');const prior=store.pool?await store.one('SELECT id FROM bao_an.weeks WHERE workspace_id=$1 AND request_id=$2',[auth.workspaceId,input.requestId]):store.db.prepare('SELECT id FROM weeks WHERE workspace_id=? AND request_id=?').get(auth.workspaceId,input.requestId);if(!prior&&!input.replaceWeekId)await seedLegacyWeek(store,auth,input);}

import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PostgresStore} from '../../server/postgres-store.mjs';

export const postgresMigration=await readFile(new URL('../../supabase/migrations/202610150001_online.sql',import.meta.url),'utf8');
export const authFor=user=>({id:user.id,workspaceId:user.workspace_id,username:user.username,role:user.role,...(user.student_id?{studentId:user.student_id}:{})});

/** PostgreSQL WASM has one backend: reserve it until COMMIT/ROLLBACK, like a pg Pool client. */
export function pglitePool(db){
  let tail=Promise.resolve();
  async function acquire(){const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;return release;}
  return{
    async query(sql,values=[]){const release=await acquire();try{return await db.query(sql,values);}finally{release();}},
    async connect(){const release=await acquire();let released=false;return{query:(sql,values=[])=>db.query(sql,values),release(){if(!released){released=true;release();}}};},
  };
}
export async function createPostgresFixture(t,{bootstrap=true}={}){
  const db=new PGlite();await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await db.exec(postgresMigration);
  const pool=pglitePool(db),store=await new PostgresStore({pool}).ready();
  t.after(async()=>{await store.close();await db.close();});
  if(!bootstrap)return{db,pool,store};
  const user=await store.createWorkspaceAdmin({name:'Đơn vị thử nghiệm',username:'manager',passwordHash:'salt:manager-hash'});
  return{db,pool,store,user,admin:authFor(user)};
}

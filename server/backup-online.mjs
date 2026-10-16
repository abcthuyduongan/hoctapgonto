import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const dataDir=resolve(process.env.BAO_AN_DATA_DIR||'.online'),folder=join(dataDir,'backups');
await mkdir(folder,{recursive:true});
const database=new DatabaseSync(join(dataDir,'bao-an.sqlite'),{readOnly:true});
try{const output=join(folder,`bao-an-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);await backup(database,output);console.log(`Đã sao lưu dữ liệu máy chủ: ${output}`);}finally{database.close();}

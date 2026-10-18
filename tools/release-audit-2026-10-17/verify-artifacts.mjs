import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync} from 'fflate';
const root=path.resolve('test-results/deep-release-audit');await mkdir(root,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const releaseRoot='releases/bao-an-learning-3.8.0-rc.9',manifest=JSON.parse(await readFile(releaseRoot+'/release.json','utf8'));
const mismatches=[];for(const item of manifest.files){const b=await readFile(path.join(releaseRoot,item.path));if(b.length!==item.bytes||hash(b)!==item.sha256)mismatches.push(item.path);}
const distRoot=path.join(root,'dist');
async function walk(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const differences=[];for(const p of await walk(distRoot)){
 const rel=path.relative(distRoot,p).split(path.sep).join('/'),expected=manifest.files.find(x=>x.path==='app/'+rel),b=await readFile(p);
 if(!expected)differences.push({path:rel,type:'extra-in-audit-build',bytes:b.length});else if(hash(b)!==expected.sha256)differences.push({path:rel,type:'different-from-immutable-rc9',bytes:b.length});
}
const zipPaths=['releases/bao-an-learning-3.8.0-rc.9.zip','releases/bao-an-learning-rc9-cap-nhat-github.zip','public/question-templates/bo-mau-day-du.zip'];
const archives=[];for(const p of zipPaths){const b=await readFile(p);archives.push({path:p,bytes:b.length,sha256:hash(b)});}
const source='C:/Users/abcth/Downloads/BAO_AN_LOP3_TUAN01_HOAN_CHINH_DE_UPLOAD/BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx';
const sourceBytes=await readFile(source),xlsx=unzipSync(sourceBytes),xmlHits=[];
for(const [name,b] of Object.entries(xlsx))if(/^xl\/worksheets\/.*\.xml$/.test(name)){const xml=Buffer.from(b).toString('utf8');const cell=/<(?:\w+:)?c\b[^>]*\br="F122"[^>]*>[\s\S]*?<\/(?:\w+:)?c>/.exec(xml)?.[0];if(cell)xmlHits.push({part:name,cell});}
const result={checkedAt:new Date().toISOString(),immutableRelease:{version:manifest.version,buildId:manifest.buildId,releaseReady:manifest.releaseReady,humanPilotStatus:manifest.humanPilotStatus,files:manifest.files.length,mismatches},auditBuildDifferences:differences,appJavaScriptMatchesRc9:!differences.some(x=>x.path.startsWith('assets/')&&x.path.endsWith('.js')),archives,originalExcel:{bytes:sourceBytes.length,sha256:hash(sourceBytes),xmlHits}};
await writeFile(path.join(root,'artifact-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(mismatches.length)process.exitCode=1;

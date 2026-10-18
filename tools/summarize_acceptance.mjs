import fs from 'node:fs/promises';
import path from 'node:path';
const reports=process.argv.slice(2),tests=new Map(),metrics=new Map();
if(!reports.length)throw new Error('Provide Playwright JSON reports in chronological order');
const allowed=new Set(['role-bundle-and-lite','optional-3d-resource-budget','thirty-games-resource-samples','real-file-import-timing']);
for(const reportPath of reports){
 const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
 function visit(suites){for(const suite of suites){for(const spec of suite.specs??[])for(const test of spec.tests??[]){
  const result=test.results.at(-1),key=[test.projectName,spec.file,spec.title].join('|');
  tests.set(key,{project:test.projectName,file:spec.file,title:spec.title,status:result?.status??'not-run',durationMs:result?.duration??0,report:path.basename(reportPath)});
  for(const attachment of result?.attachments??[])if(allowed.has(attachment.name)&&attachment.body){metrics.set([test.projectName,attachment.name].join('|'),{project:test.projectName,name:attachment.name,data:JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8'))});}
 }visit(suite.suites??[]);}}visit(report.suites);
}
const cases=[...tests.values()],summary={reports:reports.map(p=>path.basename(p)),total:cases.length,passed:cases.filter(t=>t.status==='passed').length,unresolved:cases.filter(t=>t.status!=='passed'),metrics:[...metrics.values()],tests:cases};
await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/rc12-acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({total:summary.total,passed:summary.passed,unresolved:summary.unresolved,metrics:summary.metrics.map(m=>({project:m.project,name:m.name}))},null,2));
if(summary.unresolved.length)process.exitCode=1;

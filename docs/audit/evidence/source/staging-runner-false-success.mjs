import fs from 'node:fs';
import {runStagingLoadTest} from '../../tools/staging_load_runner.mjs';
const calls=[];
globalThis.fetch=async(input,init)=>{
 const p=new URL(input).pathname,status=p.startsWith('/api/')?401:404;
 calls.push({path:p,status,method:init?.method});
 return new Response(JSON.stringify({error:'Audit fixture: always unauthorized or missing'}),{status,headers:{'Content-Type':'application/json'}});
};
const report=await runStagingLoadTest({origin:'https://audit-invalid-staging.example.test',concurrency:2,durationSeconds:0.35});
const evidence={kind:'Failure-injection reproduction, not performance measurement',allRequestsFailed:true,calls,runnerReport:report};
fs.mkdirSync('test-results/audit-2026-11-06',{recursive:true});
fs.writeFileSync('test-results/audit-2026-11-06/staging-runner-false-success.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({calls:calls.length,httpFailures:calls.length,totalOperations:report.totalOperations,totalErrors:report.totalErrors,errorRatePercent:report.errorRatePercent,reportedQuestionSamples:report.metrics.openQuestion.count}));

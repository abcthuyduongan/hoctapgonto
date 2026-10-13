// Zero-dependency JSX/TS parsing gate for the offline development environment.
import { createRequire } from 'node:module';
import { dirname, join as pathJoin } from 'node:path';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); }
catch { ts = require(pathJoin(dirname(dirname(process.execPath)),'lib','node_modules','typescript')); }
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
let problems=0;
function walk(dir){for(const d of readdirSync(dir,{withFileTypes:true})){
  const f=join(dir,d.name);if(d.isDirectory()) walk(f);
  else if(/\.tsx?$/.test(f)) {
    const source=readFileSync(f,'utf8');
    const file=ts.createSourceFile(f,source,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    for(const e of file.parseDiagnostics){problems++;console.error(`${f}: ${ts.flattenDiagnosticMessageText(e.messageText,' ')}`);}
  }
}}
walk('src');
if(problems) process.exit(1);
console.log('Syntax parsing: all src/*.ts and src/*.tsx files passed.');

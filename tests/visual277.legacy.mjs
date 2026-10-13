import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const read=(p)=>readFileSync(join(root,p),'utf8');
test('Alpha 2.7.7: new scenic art and independently feathered island assets are shipped',()=>{
 for(const f of ['premium-world-clarity.webp', ...['math','memory','sentence'].map(x=>`premium-island-${x}-soft.webp`),'premium-fox-optimized.webp']){
   const path=join(root,'public/art',f);
   assert.ok(existsSync(path),`${f} missing`);
   assert.ok(statSync(path).size>15000&&statSync(path).size<400000,`${f} too large or unexpectedly tiny`);
 }
});
test('Alpha 2.7.7: all three islands link to the same game SDK and preserve genuine buttons',()=>{
 const s=read('src/screens/StudentScreen.tsx');
 for(const x of ['math','memory','sentence'])assert.ok(s.includes(`premium-island-${x}-soft.webp`));
 assert.match(s,/GAME_REGISTRY\.map/);assert.match(s,/onPlay\(game\.id, chosen\)/);
 assert.match(s,/GameMascot/);
});
test('Alpha 2.7.7: CSS adds visually animated island art without reflow and has motion-off alternative',()=>{
 const css=read('src/styles/world277.css');const entry=read('src/main.tsx');
 assert.match(entry,/world277\.css/);
 for(const word of ['@keyframes world277-hover','translate3d','html[data-motion="off"]','prefers-reduced-motion','premium-world-clarity.webp'])assert.ok(css.includes(word),`missing ${word}`);
});
test('Alpha 2.7.7: game result feedback stays in fixed container',()=>{
 const m=read('src/games/MathQuest.tsx');const s=read('src/games/SentenceBuilder.tsx');
 assert.match(m,/stable-response-zone/);assert.match(s,/sentence-result-reserve/);
 assert.match(read('src/styles/world277.css'),/world277-correct/);
});

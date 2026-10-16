import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const source=(file)=>readFileSync(join(root,file),'utf8');
test('Game World CSS defines stable, shared design tokens',()=>{
 const css=source('src/styles/game-world.css');
 for(const token of ['--gw-navy','--gw-blue','--gw-cream','.world-hero','.world-card','.world-stage','prefers-reduced-motion'])
  assert.ok(css.includes(token),`Missing ${token}`);
});
test('Image assets are local, readable, and reasonably sized for a mobile app',()=>{
 for(const asset of ['original-world','original-cover-math','original-cover-memory','original-cover-sentence','original-math','original-memory','original-sentence','original-mascot']){
  const path=join(root,`public/art/${asset}.webp`);
  assert.ok(existsSync(path),`Missing ${asset}`);
  const size=statSync(path).size;
  assert.ok(size>1000&&size<450000,`${asset} size ${size}`);
 }
});
test('Each game module uses actual host callbacks, not static screenshot buttons',()=>{
 for(const module of ['MathQuest','MemoryMatch','SentenceBuilder']){
  const content=source(`src/games/${module}.tsx`);
  for(const key of ['onAttempt','onComplete','onExit','world-stage']) assert.ok(content.includes(key),`${module} missing ${key}`);
 }
});
test('Accessible mobile and drag interactions have primary alternatives',()=>{
 const sentence=source('src/games/SentenceBuilder.tsx');
 assert.ok(sentence.includes('onDragStart'));
 assert.ok(sentence.includes('onClick={()=>insertWord(i)}'));
 assert.ok(source('src/styles/game-world.css').includes('@media(max-width:760px)'));
});
test('Visual-only preview makes its nature and all six panes explicit',()=>{
 const html=source('preview/index.html');
 for(const name of ['pv-home','pv-math','pv-memory','pv-sentence','pv-parent','pv-studio'])assert.ok(html.includes(name));
 assert.ok(html.includes('CHƯA PHẢI BẢN GAME CHẠY THẬT'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const cwd=process.cwd();
const read=p=>readFileSync(join(cwd,p),'utf8');
test('Alpha 2.7.6: premium world stylesheet is loaded after previous styles',()=>{
 const src=read('src/main.tsx');
 assert.ok(src.lastIndexOf('styles/world276.css')>src.lastIndexOf('styles/portal272.css'));
 assert.match(read('src/styles/world276.css'),/\.portal273-world-grid/);
});
test('Alpha 2.7.6: cinematic art for world and three game worlds exists',()=>{
 for(const name of ['premium-world-cinematic','premium-math-cinematic','premium-memory-cinematic','premium-sentence-cinematic']) {
  const f=join(cwd,'public/art',`${name}.webp`);
  assert.ok(existsSync(f),`${name} missing`);
  assert.ok(statSync(f).size>70000,`${name} unexpectedly small`);
 }
});
test('Alpha 2.7.6: world art is separate from actual game controls',()=>{
 const home=read('src/screens/StudentScreen.tsx');
 assert.match(home,/GAME_REGISTRY\.map/);
 assert.match(home,/onClick=\{\(\) => chosen && void onPlay/);
 assert.match(home,/onChange=\{\(e\) => setSelected/);
 assert.match(home,/Chưa có học liệu phù hợp/);
});
test('Alpha 2.7.6: reduced motion and phone header layout are supplied',()=>{
 const css=read('src/styles/world276.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/\.top-navigation\{grid-column:1\/-1/);
});
test('Alpha 2.7.6: math and sentence progress do not claim a question complete before answering',()=>{
 assert.match(read('src/games/MathQuest.tsx'),/selected!==null\?1:0/);
 assert.match(read('src/games/SentenceBuilder.tsx'),/feedback==='correct'\?1:0/);
});
test('Alpha 2.7.6: HTML/CSS preview passed all five responsive overflow and asset checks',()=>{
 const rows=JSON.parse(read('docs/visual276/layout-results.json'));
 assert.equal(rows.length,5);
 for(const r of rows){
  assert.equal(r.loaded,true,`${r.viewport} images not loaded`);
  assert.ok(r.scrollWidth<=r.innerWidth+2,`${r.viewport} overflow`);
  assert.equal(r.positions.length,3,`${r.viewport} islands missing`);
  assert.ok(r.positions.every(p=>p[2]>180),`${r.viewport} collapsed island`);
  assert.deepEqual(r.errors,[],`${r.viewport} runtime errors`);
 }
});

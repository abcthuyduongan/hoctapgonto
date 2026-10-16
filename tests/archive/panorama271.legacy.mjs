import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const file=path=>readFileSync(path,'utf8');
test('Game host opens an immersive viewport rather than a small modal',()=>{
 const app=file('src/App.tsx'); const css=file('src/styles/panorama271.css');
 assert.match(app,/overlay immersive-overlay/);
 assert.match(app,/game-dialog adventure-dialog immersive-dialog/);
 assert.match(css,/width:100vw;max-width:none!important/);
 assert.match(css,/height:100dvh;min-height:0;max-height:100dvh!important/);
 assert.match(app,/document\.documentElement\.style\.scrollbarGutter = 'auto'/);
});
test('Panoramic stage preserves inner scrolling on short mobile screens',()=>{
 const css=file('src/styles/panorama271.css');
 assert.match(css,/overflow-x:hidden;overflow-y:auto/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.immersive-dialog \.world-stage/);
 assert.match(css,/\.immersive-dialog \.world-guide,.*\.immersive-dialog \.sentence-guide/s);
});
test('All 3 games use the panoramic view without changing SDK or storage',()=>{
 const app=file('src/App.tsx');
 assert.ok(app.includes('GAME_COMPONENTS[active.session.moduleId]'));
 for(const game of ['MathQuest','MemoryMatch','SentenceBuilder']) {
   const s=file(`src/games/${game}.tsx`);
   assert.ok(s.includes('onAttempt'));
   assert.ok(s.includes('onComplete'));
   assert.ok(s.includes('onExit'));
   assert.ok(s.includes('world-stage'));
 }
 assert.ok(file('src/games/MemoryMatch.tsx').includes('forest-mascot'));
});
test('Static panoramic previews are clearly marked as non-functional',()=>{
 for(const name of ['math','memory','sentence']){
   const p=`preview/panorama-${name}.html`;
   assert.ok(existsSync(p));
   const html=file(p);
   assert.ok(html.includes('Không phải game đang chạy'));
   assert.ok(html.includes('immersive-dialog'));
 }
});

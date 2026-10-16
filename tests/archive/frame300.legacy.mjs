import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const student=read('src/screens/StudentScreen.tsx');
const app=read('src/App.tsx');
const css=read('src/styles/unified-frame.css');
const main=read('src/main.tsx');

test('World Frame replaces scrolling home with a single scene',()=>{
  assert.match(student,/ba-world-home/);
  assert.match(student,/ba-scene/);
  assert.doesNotMatch(student,/id="portal273-journey"/);
  assert.match(app,/ba-frame-shell/);
  assert.match(css,/height:100dvh!important/);
  assert.match(css,/overflow:hidden!important/);
  assert.match(main,/styles\/unified-frame.css/);
});
test('Three real game selectors and start buttons remain interactive',()=>{
  assert.match(student,/GAME_REGISTRY\.map/);
  assert.match(student,/onPlay\(game\.id, chosen\)/);
  assert.match(student,/onChange=\{\(e\) => setSelected/);
  assert.match(student,/disabled=\{!chosen \|\| starting\}/);
});
test('Unified responsive game scene has dedicated tablet/phone rules',()=>{
  assert.match(css,/@media \(min-width:701px\) and \(max-width:1040px\)/);
  assert.match(css,/@media \(max-width:700px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/world-memory \.memory-front/);
});
test('Scene-free character is shipped and all games use shared mascot',()=>{
  assert.ok(existsSync(new URL('../public/art/fox-scene-free.webp',import.meta.url)));
  assert.match(read('src/games/GameMascot.tsx'),/fox-scene-free\.webp/);
  for(const n of ['MathQuest','MemoryMatch','SentenceBuilder']) assert.match(read('src/games/'+n+'.tsx'),/GameMascot/);
});

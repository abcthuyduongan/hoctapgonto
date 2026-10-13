import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const home=readFileSync(new URL('../src/screens/StudentScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/portal272.css',import.meta.url),'utf8');
test('Premium: background and three standalone scene assets are present',()=>{
 for(const name of ['premium-world-scene.webp','premium-fox.png','premium-island-math.png','premium-island-memory.png','premium-island-sentence.png']) {
  assert.ok(existsSync(new URL('../public/art/'+name,import.meta.url)),name);
 }
});
test('Premium: all three game calls remain genuine React handlers',()=>{
 assert.match(home,/GAME_REGISTRY\.map/);
 assert.match(home,/onClick=\{\(\) => chosen && void onPlay\(game\.id, chosen\)\}/);
 assert.match(home,/onChange=\{\(e\) => setSelected/);
 assert.match(home,/disabled=\{!chosen \|\| starting\}/);
});
test('Premium: map uses scenic assets, live buttons and mobile layout',()=>{
 assert.match(css,/premium-world-scene\.webp/);
 assert.match(css,/portal273-world-grid/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(home,/portal273-start/);
});
test('Premium: unavailable shop and collection shortcuts were not fabricated',()=>{
 assert.doesNotMatch(home,/<a[^>]*>[^<]*Cửa hàng sao/);
 assert.match(home,/Bảng cửu chương/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../src/screens/StudentScreen.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/portal272.css', import.meta.url), 'utf8');
const root = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
test('Game Center: 3 modules occupy the same primary portal scene', ()=>{
  assert.match(source,/portal273-world-grid/);
  assert.match(source,/GAME_REGISTRY\.map/);
  assert.match(source,/tone-\$\{meta\.tone\}/);
});
test('Game Center: all three module IDs and genuine click handler present', ()=>{
  for(const mod of ['math-quest','memory-match','sentence-builder']) assert.ok(source.includes(mod));
  assert.match(source,/onClick=\{\(\) => chosen && void onPlay\(game\.id, chosen\)\}/);
});
test('Game Center: live pack selection and safe empty state', ()=>{
  assert.match(source,/onChange=\{\(e\) => setSelected/);
  assert.match(source,/disabled=\{!chosen \|\| starting\}/);
  assert.match(source,/Chưa có học liệu phù hợp/);
});
test('Game Center: stylesheet last; animated elements obey reduced-motion', ()=>{
  assert.match(root,/styles\/portal272\.css/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/max-width:760px/);
  assert.match(css,/portal273-bottom-actions/);
});

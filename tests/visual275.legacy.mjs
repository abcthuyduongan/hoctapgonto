import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const read = (p) => readFileSync(join(root,p),'utf8');
test('Premium 2.7.5: all scenic art assets are shipped',()=>{
 for(const name of ['premium-world-vivid','premium-game-math','premium-game-memory','premium-game-sentence']){
  const path=join(root,'public/art',`${name}.webp`);
  assert.ok(existsSync(path),`${name} missing`);
  assert.ok(statSync(path).size>30000,`${name} unexpectedly tiny`);
 }
});
test('MathQuest, MemoryMatch and SentenceBuilder use resilient shared mascot',()=>{
 for(const name of ['MathQuest','MemoryMatch','SentenceBuilder']){
  const src=read(`src/games/${name}.tsx`);
  assert.match(src, /GameMascot/);
  assert.doesNotMatch(src,/original-mascot\.webp/);
 }
 const shared=read('src/games/GameMascot.tsx');
 assert.match(shared,/(?:premium-fox-optimized|fox-scene-free)\.webp/);
 assert.match(shared,/onError=\{\(\) => setFailed\(true\)\}/);
 assert.match(shared,/mascot-fallback/);
});
test('Home and game scene backgrounds use premium artwork, not original vector',()=>{
 const css=read('src/styles/portal272.css');
 assert.match(css,/premium-world-vivid\.webp/);
 for(const k of ['math','memory','sentence']) assert.ok(css.includes(`premium-game-${k}.webp`));
 assert.match(css,/prefers-reduced-motion/);
});

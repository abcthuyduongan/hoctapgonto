import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const read=p=>readFileSync(join(root,p),'utf8');
test('Every game illustration is UI-free and shipped locally',()=>{
  for(const name of ['world','math','memory','sentence']) {
    const art=`public/art/original-${name}.svg`;
    assert.ok(existsSync(join(root,art)),art);
    const svg=read(art);
    assert.ok(!/<text\b|<foreignObject\b|<image\b/i.test(svg),`${art} contains a potentially fake interface`);
    const raster=join(root,`public/art/original-${name}.webp`);
    assert.ok(existsSync(raster));
    assert.ok(statSync(raster).size < 450000,`${name} too large for typical mobile loading`);
  }
  for(const name of ['math','memory','sentence']) assert.ok(existsSync(join(root,`public/art/original-cover-${name}.webp`)));
});
test('All game-stage backgrounds and card covers reference clean art only',()=>{
  const css=read('src/styles/polish26.css');
  const home=read('src/screens/StudentScreen.tsx');
  for(const name of ['world','math','memory','sentence']) assert.ok(css.includes(`/art/original-${name}.webp`));
  for(const name of ['math','memory','sentence']) assert.ok(home.includes(`/art/original-cover-${name}.webp`) || home.includes(`/art/premium-island-${name}.png`) || home.includes(`/art/premium-island-${name}-soft.webp`));
  for(const name of ['scene-math.webp','scene-memory.webp','scene-sentence.webp','world-map.webp']) assert.ok(!css.includes(`/art/${name}`));
});
test('Audio is opt in, motion can be disabled, and accessibility fallback is provided',()=>{
  const app=read('src/App.tsx'); const aud=read('src/core/experience.ts'); const css=read('src/styles/polish26.css');
  assert.ok(app.includes("localStorage.getItem('ba.sound')==='on'"));
  assert.ok(app.includes('aria-pressed={soundOn}'));
  assert.ok(app.includes('aria-pressed={motionOn}'));
  assert.ok(aud.includes("dataset.sound !== 'on'"));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('data-motion="off"'));
});
test('Math Quest no longer downloads Phaser for purely decorative sky animation',()=>{
  const math=read('src/games/MathQuest.tsx'); const reg=read('src/core/registry.ts');
  assert.ok(!math.includes('PhaserSky'));
  assert.ok(!math.includes("import('phaser')"));
  assert.match(reg,/id:'math-quest'.*runtime:'react'/);
  assert.ok(math.includes('answerLock.current=true'));
});
test('All screens keep same runtime gameplay and authoring callbacks',()=>{
  for(const name of ['MathQuest','MemoryMatch','SentenceBuilder']){
    const s=read(`src/games/${name}.tsx`);
    for(const cb of ['onAttempt','onComplete','onExit'])assert.ok(s.includes(cb));
  }
  assert.ok(read('src/screens/CreatorScreen.tsx').includes('onPublish'));
  assert.ok(read('src/screens/ParentScreen.tsx').includes('calculateReport'));
});

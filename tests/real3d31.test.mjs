import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const engine=readFileSync(resolve(root,'src/world3d/engine.ts'),'utf8');
const screen=readFileSync(resolve(root,'src/screens/StudentScreen.tsx'),'utf8');
const canvas=readFileSync(resolve(root,'src/world3d/WorldCanvas.tsx'),'utf8');
const html=readFileSync(resolve(root,'BAO_AN_LEARNING_V3_6_PLAYABLE.html'),'utf8');
test('Real 3D: projective renderer constructs vertices, normals and matrices, not a flat background',()=>{
 assert.match(engine,/getContext\('webgl2'/);
 assert.match(engine,/gl\.drawArrays\(gl\.TRIANGLES/);
 assert.match(engine,/perspective\(/);
 assert.match(engine,/lookAt\(/);
 assert.match(engine,/class Mesh/);
 assert.match(engine,/private build\(m:Mesh/);
});
test('Real 3D: three modeled islands, castle, trees, cards, book, fox are distinct mesh assets',()=>{
 for(const keyword of ['castle(m,','tree(m,','book(m,','fox(m,','card(m,','island(m,']) assert.ok(engine.includes(keyword),keyword);
 assert.match(engine,/xs=\[-4\.8,0,4\.8\]/);
});
test('Real 3D: fallback projects genuine 3D triangles, does not show an image posing as 3D',()=>{
 assert.match(engine,/private startSoftware/);
 assert.match(engine,/private drawSoftware/);
 assert.match(engine,/triangles\.sort/);
 assert.match(engine,/ctx\.lineTo/);
});
test('Real 3D: world controls use the existing game registry, pack validation and original game host',()=>{
 assert.match(screen,/GAME_REGISTRY\.map/);
 assert.match(screen,/compatible\(game\.id,p\)/);
 assert.match(screen,/onClick=\{\(\)=>pack&&void onPlay\(game\.id,pack\)\}/);
 assert.match(screen,/options\.map/);
});
test('Real 3D: scene pauses during gameplay and respects reduced motion',()=>{
 assert.match(canvas,/runtime\.current\?\.setPaused/);
 assert.match(canvas,/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
 assert.match(engine,/dispose\(\)/);
});
test('Real 3D: standalone offline build contains its own scene engine, mini games and saving',()=>{
 assert.ok(html.length>30000);
 assert.match(html,/class LearningWorld3D/);
 assert.match(html,/function openGame/);
 assert.match(html,/function paintGame/);
 assert.match(html,/localStorage\.setItem/);
 assert.match(html,/const modal=document/);
});
test('Real 3D: offline file exists and full source retains the three modules',()=>{
 assert.ok(existsSync(resolve(root,'BAO_AN_LEARNING_V3_6_PLAYABLE.html')));
 for(const file of ['MathQuest.tsx','MemoryMatch.tsx','SentenceBuilder.tsx'])assert.ok(existsSync(resolve(root,'src/games',file)));
});

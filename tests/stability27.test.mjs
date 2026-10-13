import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = p=>readFileSync(p,'utf8');

test('Math answer feedback stays inside a permanently mounted reserved frame',()=>{
  const s=file('src/games/MathQuest.tsx');
  assert.match(s,/stable-response-zone/);
  assert.match(s,/stable-response-body/);
  assert.ok(!s.includes('completion-card trophy-reveal'));
  assert.ok(s.includes('status === \'done\' && <GameCompletion'));
});
test('Memory and Sentence keep the play scene mounted while reward appears',()=>{
  for (const fileName of ['MemoryMatch','SentenceBuilder']) {
    const s=file(`src/games/${fileName}.tsx`);
    assert.ok(s.includes('<GameCompletion'));
    assert.ok(!s.includes('completion-card trophy-reveal'));
  }
  assert.match(file('src/games/SentenceBuilder.tsx'),/sentence-result-reserve/);
  assert.match(file('src/games/MemoryMatch.tsx'),/memory-feedback-slot/);
});
test('Game stage is a stable internal scroller and the main page is locked',()=>{
  const css=file('src/styles/stability27.css');
  const app=file('src/App.tsx');
  assert.match(css,/scrollbar-gutter:stable/);
  assert.match(css,/overflow-anchor:none/);
  assert.match(css,/\.reward-curtain[\s\S]*?position:fixed/);
  assert.ok(app.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(app.includes('focus({preventScroll:true})'));
  assert.ok(app.includes('gameDialog.current?.focus'));
});
test('Answer recording no longer refetches all content packs on every click',()=>{
  const app=file('src/App.tsx');
  const body=app.split('async function recordAttempt(')[1]?.split('async function completeSession(')[0]??'';
  assert.match(body,/await storage\.addEvent\(event\)/);
  assert.ok(!body.includes('await refresh()'));
  assert.match(body,/setEvents\(prev =>/);
});
test('Panoramic CSS is loaded after the stable feedback CSS',()=>{
  const entry=file('src/main.tsx');
  assert.ok(entry.includes("import './styles/stability27.css';"));
  assert.ok(entry.indexOf("import './styles/stability27.css';") < entry.indexOf("import './styles/panorama271.css';"));
});

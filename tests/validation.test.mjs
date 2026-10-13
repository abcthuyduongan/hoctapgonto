import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack,compatible,packKey } from '../src/core/validation.ts';

const base = {id:'english3-demo',version:1,title:'Thẻ từ vựng',subject:'english',grade:3,kind:'pairs',source:'local',publishedAt:'2026-10-12T00:00:00Z',items:[
  {kind:'pair',id:'a',objectiveId:'ENG3.X',left:'one',right:'một'},
  {kind:'pair',id:'b',objectiveId:'ENG3.X',left:'two',right:'hai'}
]};
const copy = value => JSON.parse(JSON.stringify(value));

test('Bộ ghép cặp hợp lệ có thể dùng ở Memory Match',()=>{
  assert.deepEqual(validatePack(base),[]);
  assert.equal(compatible('memory-match',base),true);
  assert.equal(compatible('math-quest',base),false);
});
test('Phát hiện trùng nội dung kể cả khác khoảng trắng và chữ hoa',()=>{
  const pack=copy(base);pack.items[1].left=' ONE ';pack.items[1].right='MỘT';
  assert.ok(validatePack(pack).some(e=>e.includes('trùng')));
});
test('Không cho phép câu ghép cặp thiếu dữ liệu',()=>{
  const pack=copy(base);pack.items[1].right='  ';
  assert.ok(validatePack(pack).some(e=>e.includes('cần cả hai')));
});
test('Không cho phép trùng ID câu hỏi',()=>{
  const pack=copy(base);pack.items[1].id='a';
  assert.ok(validatePack(pack).some(e=>e.includes('mã câu hỏi')));
});
test('Phiên bản nội dung tham gia vào khóa bất biến',()=>{
  assert.equal(packKey(base),'english3-demo@1');
  assert.notEqual(packKey(base),packKey({...base,version:2}));
});
test('Kiểm tra câu trắc nghiệm đủ bốn phương án, đáp án, lời giải',()=>{
  const p={...copy(base),kind:'quiz',items:[
    {kind:'multiple-choice',id:'q1',objectiveId:'MATH3.A',prompt:'1 + 1?',options:['1','2','3','4'],correctIndex:1,explanation:'Bằng 2'},
    {kind:'multiple-choice',id:'q2',objectiveId:'MATH3.A',prompt:'2 + 2?',options:['2','3','4','5'],correctIndex:2,explanation:'Bằng 4'}
  ]};
  assert.deepEqual(validatePack(p),[]);
  p.items[1].correctIndex=9;
  assert.ok(validatePack(p).some(e=>e.includes('đáp án chính xác')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PACKS } from '../src/core/seed.ts';
import { validatePack, packKey } from '../src/core/validation.ts';

test('Tất cả học liệu mẫu vượt qua kiểm tra cấu trúc và trùng thẻ',()=>{
  for(const pack of BUILTIN_PACKS){
    assert.deepEqual(validatePack(pack),[],`Lỗi ở ${pack.id}`);
  }
});
test('Bộ học liệu mẫu có khóa phiên bản khác nhau',()=>{
  assert.equal(new Set(BUILTIN_PACKS.map(packKey)).size,BUILTIN_PACKS.length);
});
test('Cả ba môn học sử dụng cùng mẫu Memory Match',()=>{
  const types=new Set(BUILTIN_PACKS.filter(p=>p.kind==='pairs').map(p=>p.subject));
  assert.deepEqual([...types].sort(),['english','math','vietnamese']);
});

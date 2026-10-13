import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_PACKS} from '../src/core/seed.ts';
import {MAX_IMPORT_BYTES,parseContentImport,serializeContentExport} from '../src/core/content-io.ts';
const sample=BUILTIN_PACKS;
test('Xuất rồi nhập giữ đủ ba mẫu game và phiên bản học liệu',()=>{
 const text=serializeContentExport([sample[0],sample[1],sample.at(-1)],'2026-10-13T00:00:00.000Z');
 const restored=parseContentImport(text);
 assert.equal(restored.length,3);
 assert.deepEqual(restored.map(p=>p.kind),['quiz','pairs','sentences']);
 assert.deepEqual(restored.map(p=>p.items.length),[8,6,6]);
 assert.ok(restored.every(p=>p.source==='local'));
 assert.equal('events' in JSON.parse(text),false);
});
test('Không cho import sai schema và dữ liệu ngoài phạm vi',()=>{
 assert.throws(()=>parseContentImport('not json'),/JSON/);
 assert.throws(()=>parseContentImport(JSON.stringify({schema:'events',formatVersion:1,packs:[sample[0]]})),/định dạng/);
 assert.throws(()=>parseContentImport(' '.repeat(MAX_IMPORT_BYTES+1)),/1 MB/);
});
test('Không nhận dữ liệu có item thiếu, sai kiểu hoặc trùng ID/version',()=>{
 const pack=structuredClone(sample[0]);
 delete pack.items[0].explanation;
 const wrap=packs=>JSON.stringify({schema:'baoan-learning-content',formatVersion:1,packs});
 assert.throws(()=>parseContentImport(wrap([pack])),/thiếu dữ liệu/);
 assert.throws(()=>parseContentImport(wrap([sample[0],sample[0]])),/trùng mã/);
 const broken=structuredClone(sample[1]);broken.items[1].left=broken.items[0].left;
 assert.throws(()=>parseContentImport(wrap([broken])),/trùng/);
});
test('Phương án HTML trong bộ học liệu được giữ như văn bản, không thực thi',()=>{
 const pack=structuredClone(sample[0]);pack.items[0].prompt='<img src=x onerror=alert(1)> chọn đáp án';
 const result=parseContentImport(serializeContentExport([pack]));
 assert.equal(result[0].items[0].prompt,pack.items[0].prompt);
});

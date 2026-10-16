import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { parseDelimitedText, importRowsToQuestions, getExcelTemplate, parseXlsxBytes } from '../src/core/excel-import.ts';

test('Excel Import: parses CSV and TSV with quoted cells and commas', () => {
  const csv = `"Câu hỏi","Phương án A","Phương án B","Phương án C","Phương án D","Đáp án đúng","Giải thích"\n` +
    `"7 × 6 = ?","42","36","48","40","A","Bảng nhân 7"\n` +
    `"Số nào chia hết cho 2?","3","5","8","7","C","8 là số chẵn"`;

  const rows = parseDelimitedText(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], '7 × 6 = ?');
  assert.equal(rows[1][1], '42');

  const result = importRowsToQuestions(rows, 'quiz');
  assert.equal(result.count, 2);
  assert.equal(result.quizzes?.[0].prompt, '7 × 6 = ?');
  assert.equal(result.quizzes?.[0].correctIndex, 0); // A
  assert.equal(result.quizzes?.[1].correctIndex, 2); // C
});

test('Excel Import: parses Pairs for Memory Match & Word Connect', () => {
  const tsv = `Mặt trái\tMặt phải\n` +
    `Apple\tQuả táo\n` +
    `Book\tQuyển sách`;

  const rows = parseDelimitedText(tsv);
  assert.equal(rows.length, 3);
  const result = importRowsToQuestions(rows, 'pairs');
  assert.equal(result.count, 2);
  assert.equal(result.pairs?.[0].left, 'Apple');
  assert.equal(result.pairs?.[0].right, 'Quả táo');
});

test('Excel Import: parses Sentences for Sentence Builder & Sequence Trail', () => {
  const csv = `Yêu cầu,Câu mẫu,Gợi ý\n` +
    `Sắp xếp câu,My family is happy,Bắt đầu bằng My\n` +
    `Quy luật dãy số,2 4 6 8 10,Cộng thêm 2`;

  const rows = parseDelimitedText(csv);
  const result = importRowsToQuestions(rows, 'sentences');
  assert.equal(result.count, 2);
  assert.equal(result.sentences?.[0].answer, 'My family is happy');
  assert.equal(result.sentences?.[1].answer, '2 4 6 8 10');
});

test('Excel Import: generates templates with UTF-8 BOM for Excel compatibility', () => {
  for (const kind of ['quiz', 'pairs', 'sentences']) {
    const tpl = getExcelTemplate(kind);
    assert.ok(tpl.filename.endsWith('.csv'));
    assert.ok(tpl.content.startsWith('\uFEFF')); // UTF-8 BOM for Excel on Windows
  }
});

test('Excel Import: parses binary .xlsx files', async () => {
  const { zipSync } = await import('fflate');
  const { parseXlsxBytes } = await import('../src/core/excel-import.ts');

  const sstXml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Xin chào</t></si><si><t>Bảo An</t></si></sst>`;
  const sheetXml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>`;

  const zipBytes = zipSync({
    'xl/sharedStrings.xml': new TextEncoder().encode(sstXml),
    'xl/worksheets/sheet1.xml': new TextEncoder().encode(sheetXml)
  });

  const rows = parseXlsxBytes(zipBytes);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'Xin chào');
  assert.equal(rows[0][1], 'Bảo An');
});

test('Excel Import: missing, invalid and ambiguous answers are rejected with row errors', () => {
  const result = importRowsToQuestions([
    ['2+2', '3', '4', '5', '6', 'Z', '2+2=4'],
    ['3+3', '5', '6', '7', '8', '', '3+3=6'],
    ['4+4', '7', '8', '8', '9', '8', '4+4=8'],
    ['5+5', '9', '10', '', '', 'C', '5+5=10'],
    ['6+6', '11', '12', '13', '14', 'B', '6+6=12'],
  ], 'quiz');
  assert.equal(result.count, 1);
  assert.equal(result.quizzes[0].correctIndex, 1);
  assert.equal(result.warnings.length, 4);
  assert.match(result.warnings[0], /Dòng 1.*đáp án/i);
  assert.match(result.warnings[1], /Dòng 2.*đáp án/i);
});

test('Excel Import: letters, 1–4 and unique answer text resolve exactly', () => {
  const answers = ['a', 'B', 'c', 'D', '1', '2', '3', '4', 'blue'];
  const result = importRowsToQuestions(answers.map((answer, i) =>
    [`Question ${i}`, 'red', 'blue', 'green', 'white', answer, 'Explanation']), 'quiz');
  assert.equal(result.count, answers.length);
  assert.deepEqual(result.quizzes.map(q => q.correctIndex), [0, 1, 2, 3, 0, 1, 2, 3, 1]);
  assert.deepEqual(result.warnings, []);
});

const xlsx = (sheet, shared = '', extra = {}) => zipSync({
  'xl/worksheets/sheet1.xml': new TextEncoder().encode(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  ...(shared ? { 'xl/sharedStrings.xml': new TextEncoder().encode(shared) } : {}), ...extra,
});

test('XLSX: preserves literal entities, Unicode entities, rich text and empty cells', () => {
  const rows = parseXlsxBytes(xlsx(
    '<row r="1"><c r="A1"/><c r="B1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><r><t>Toán &#x33;</t></r><r><t> &amp; Văn</t></r></is></c></row>',
    '<sst><si><t>&amp;lt; &#x1F31F; &#259;</t></si></sst>',
  ));
  assert.deepEqual(rows, [['', '&lt; 🌟 ă', 'Toán 3 & Văn']]);
});

test('XLSX: refuses unsafe columns, rows, XML expansion, entry counts and input bytes', () => {
  assert.throws(() => parseXlsxBytes(xlsx('<row r="1"><c r="XFD1"><v>1</v></c></row>')), /cột/i);
  assert.throws(() => parseXlsxBytes(xlsx('<row r="1001"><c r="A1001"><v>1</v></c></row>')), /hàng/i);
  assert.throws(() => parseXlsxBytes(xlsx('<row><c r="A1" t="inlineStr"><is><t>' + 'a'.repeat(2 * 1024 * 1024) + '</t></is></c></row>')), /XML|giải nén/i);
  const entries = Object.fromEntries(Array.from({ length: 128 }, (_, i) => [`extra-${i}`, new Uint8Array(0)]));
  assert.throws(() => parseXlsxBytes(xlsx('', '', entries)), /entry|mục/i);
  assert.throws(() => parseXlsxBytes(new Uint8Array(1024 * 1024 + 1)), /1 MB/i);
});

test('XLSX: accepts bounded sparse rows and columns without losing values', () => {
  const rows = parseXlsxBytes(xlsx('<row r="1000"><c r="AF1000" t="inlineStr"><is><t>Cuối bảng</t></is></c></row>'));
  assert.equal(rows[0].length, 32);
  assert.equal(rows[0][31], 'Cuối bảng');
});

test('XLSX: counts all declared expansion, even entries that are not worksheets', () => {
  assert.throws(() => parseXlsxBytes(xlsx('', '', {'unrelated.bin': new Uint8Array(8 * 1024 * 1024)})), /giải nén 8 MB/i);
  assert.throws(() => parseXlsxBytes(xlsx('<row r="1"><c r="A1" t="inlineStr"><is><t>' + 'x'.repeat(4001) + '</t></is></c></row>')), /4000/);
});

test('XLSX: forged small ZIP sizes cannot hide oversized inflated XML', () => {
  const bytes = xlsx('<row r="1"><c r="A1" t="inlineStr"><is><t>' + 'x'.repeat(2 * 1024 * 1024) + '</t></is></c></row>');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Keep valid compressed data but lie about both local and central-directory output sizes.
  view.setUint32(22, 100, true);
  for (let offset = 0; offset <= bytes.length - 46; offset++) {
    if (view.getUint32(offset, true) === 0x02014b50) view.setUint32(offset + 24, 100, true);
  }
  assert.throws(() => parseXlsxBytes(bytes), /XML 2 MB|không khớp/);
});

test('XLSX: self-closing shared and inline text does not consume later text nodes', () => {
  assert.deepEqual(parseXlsxBytes(xlsx(
    '<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="inlineStr"><is><r><t/></r><r><t>Đúng</t></r></is></c></row>',
    '<sst><si/><si><t>Giữ đúng chuỗi</t></si></sst>',
  )), [['Giữ đúng chuỗi','Đúng']]);
});

test('Delimited import: caps input bytes, rows, columns and cell length and rejects broken quotes', () => {
  assert.throws(() => parseDelimitedText('x'.repeat(1024 * 1024 + 1)), /1 MB/);
  assert.throws(() => parseDelimitedText(Array.from({length:1001},()=> 'x').join('\n')), /1000 hàng/);
  assert.throws(() => parseDelimitedText(Array.from({length:33},()=> 'x').join('\t')), /32 cột/);
  assert.throws(() => parseDelimitedText('x'.repeat(4001)), /4000/);
  assert.throws(() => parseDelimitedText('"chưa đóng'), /ngoặc kép/);
  assert.equal(parseDelimitedText(Array.from({length:1000},()=> 'x').join('\n')).length, 1000);
});

test('Excel Import: rejected rows report line numbers with a header and insufficient explanation', () => {
  const result = importRowsToQuestions([
    ['Câu hỏi','A','B','C','D','Đáp án','Giải thích'],
    ['2+2', '3', '4', '5', '6', 'Z', '2+2=4'],
    ['3+3', '5', '6', '7', '8', 'B', ''],
  ], 'quiz');
  assert.equal(result.count, 0);
  assert.match(result.warnings[0], /Dòng 2/);
  assert.match(result.warnings[1], /Dòng 3.*lời giải/i);
});



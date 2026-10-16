import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const output=path.join(root,'public/question-templates');
const qa=path.join(root,'test-results/online-template-qa');
const python='C:/Users/abcth/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const source=await fs.readFile(path.join(root,'src/core/online-document-import.ts'),'utf8');
const headers=JSON.parse('['+source.match(/ONLINE_DOCUMENT_HEADERS=\[([^\]]+)\]/)[1].replaceAll("'",'"')+']');
const kinds=['quiz','pairs','sentences','numeric-answer','fill-blank','reading-choice','listening-choice','listening-gap'];
const explanations=[
  ['quiz','Trắc nghiệm','prompt, A, B, C, D, answer','Bốn phương án khác nhau. answer là A, B, C hoặc D.'],
  ['pairs','Ghép cặp','left, right','Mỗi cặp một hàng. Không lặp nội dung mặt thẻ trong cùng bộ.'],
  ['sentences','Sắp xếp','prompt và answer hoặc words','answer là câu đúng 3–15 từ. words tách thẻ bằng dấu |. Mỗi thẻ một từ.'],
  ['numeric-answer','Nhập số','prompt, answer','Số nguyên hoặc số thập phân. unit là đơn vị tùy chọn.'],
  ['fill-blank','Điền từ','prompt và acceptedAnswers hoặc answer','Các đáp án chấp nhận tách bằng dấu |. caseSensitive là true hoặc false.'],
  ['reading-choice','Đọc và chọn','passage, prompt, A, B, C, D, answer','Điền đoạn đọc và nguồn. passageTitle là tên đoạn đọc tùy chọn.'],
  ['listening-choice','Nghe và chọn','audioFile, audioTranscript, prompt, A, B, C, D, answer','Tải tệp âm thanh riêng và điền đúng tên tệp.'],
  ['listening-gap','Nghe và điền','audioFile, audioTranscript, prompt, acceptedAnswers','Các đáp án chấp nhận tách bằng dấu |.'],
];
await fs.mkdir(output,{recursive:true});await fs.mkdir(qa,{recursive:true});
const doc=spawnSync(python,[path.join(here,'create-docx.py'),path.join(output,'online-week.docx')],{encoding:'utf8'});
if(doc.status!==0)throw new Error(doc.stderr||doc.stdout);console.log(doc.stdout.trim());
const wb=Workbook.create();
const questions=wb.worksheets.add('Câu hỏi'),info=wb.worksheets.add('Thông tin bộ'),guide=wb.worksheets.add('Hướng dẫn');
for(const sheet of [questions,info,guide])sheet.showGridLines=false;
questions.getRange('A1:B1').values=[['baoan-online-week','1']];
questions.getRangeByIndexes(1,0,1,headers.length).values=[headers];
const blankRows=kinds.flatMap(kind=>[1,2].map(()=>headers.map(header=>header==='kind'?kind:'')));
questions.getRangeByIndexes(2,0,blankRows.length,headers.length).values=blankRows;
const body=questions.getRange('A1:AE18');body.format.font={name:'Arial',size:10,color:'#172033'};body.format.verticalAlignment='center';body.format.columnWidth=22;body.format.rowHeight=30;
questions.getRange('A2:AE2').format={fill:'#233C61',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:36,horizontalAlignment:'center',verticalAlignment:'center',wrapText:true};
questions.getRange('A1:B1').format.font={name:'Arial',size:10,italic:true,color:'#526579'};
questions.getRange('A3:AE18').format.fill='#FFF8E6';questions.getRange('B3:B18').format.fill='#EDF2F8';
for(const column of ['C','H','R','W','AA'])questions.getRange(`${column}1:${column}18`).format.columnWidth=42;
questions.getRange('W1:W18').format.columnWidth=60;
questions.freezePanes.freezeRows(2);questions.freezePanes.freezeColumns(2);questions.tabColor='#233C61';
questions.getRange('B3:B902').dataValidation={rule:{type:'list',values:kinds}};
questions.getRange('U3:U902').dataValidation={rule:{type:'list',values:['true','false']}};
info.getRange('A1:B3').values=[['schema','baoan-online-week'],['formatVersion','1'],['title','']];
info.getRange('A1:B3').format.font={name:'Arial',size:11,color:'#172033'};info.getRange('A1:A3').format.font.bold=true;info.getRange('A1:A3').format.columnWidth=22;info.getRange('B1:B3').format.columnWidth=66;info.getRange('A1:B3').format.rowHeight=32;info.getRange('B3').format.fill='#FFF0BA';
guide.getRange('A2').values=[['Mẫu học liệu tuần']];guide.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#000000'};
const guidance=[
  ['Cách dùng','Điền tên tuần ở Thông tin bộ, rồi soạn nội dung trong Câu hỏi. Giữ nguyên hai hàng đầu và tên các sheet.'],
  ['Bộ câu hỏi','Mỗi subjectLabel và kind cần 2–30 câu. Một tuần tối đa 30 bộ. Các dòng còn trống được bỏ qua.'],
  ['Môn và chủ đề','subjectLabel, topic, competition, level và week là tên do người soạn tự đặt. Không có danh mục môn bắt buộc.'],
  ['Tệp đa phương tiện','Tải ảnh PNG/JPEG/WebP và âm thanh MP3/WAV/OGG riêng trong ứng dụng trước khi nhập tài liệu. Điền đúng tên tệp.'],
  ['Mô tả tệp','Ảnh cần imageAlt. Âm thanh cần audioTranscript. Không nhúng ảnh hoặc âm thanh vào file mẫu.'],
  ['Nguồn nội dung','source và rights ghi nguồn cùng quyền sử dụng. Nội dung được nhập ở trạng thái bản nháp.'],
  ['Ô nhập','Nền vàng nhạt là ô người soạn điền. kind đã điền sẵn để gợi ý dạng câu, không phải câu hỏi mẫu.'],
  ['Công thức','Chỉ nhập giá trị văn bản hoặc số. Không nhập công thức Excel. Tệp tài liệu tối đa 1 MB.'],
];
const typeRows=explanations.map(([kind,label,fields,note])=>[`${label} (${kind})`,`${fields}. ${note}`]);
const fieldRows=[
  ['title','Tên bộ câu hỏi. Các hàng cùng môn và dạng cần cùng tên. Để trống thì lấy tên tuần.'],
  ['week','Tên tuần tùy chọn. Toàn tệp chỉ dùng một tên tuần.'],
  ['topic / competition / level','Nhãn chủ đề, cuộc thi và mức độ do người soạn tự đặt. Không xác nhận định dạng đề thi chính thức.'],
  ['itemId / objectiveId','Mã câu và mục tiêu tùy chọn. Bỏ trống để hệ thống tạo mã ổn định.'],
  ['hint / explanation','Gợi ý và lời giải tùy chọn. Nên điền để học sinh có phản hồi cụ thể.'],
  ['imageFile / imageAlt','Tên tệp ảnh đã tải lên và mô tả thay thế, có thể thêm vào mọi dạng câu.'],
  ['audioFile / audioTranscript','Tên tệp âm thanh đã tải lên và lời thoại. Bắt buộc với hai dạng nghe.'],
  ['source / rights','Nguồn nội dung và quyền sử dụng do người soạn chịu trách nhiệm cung cấp.'],
];
guide.getRange('A4:B4').values=[['Nội dung','Hướng dẫn điền']];guide.getRange('A5:B12').values=guidance;
guide.getRange('A14:B14').values=[['Dạng câu','Trường cần điền và quy tắc']];guide.getRange('A15:B22').values=typeRows;
guide.getRange('A24:B24').values=[['Trường bổ sung','Ý nghĩa']];guide.getRange('A25:B32').values=fieldRows;
guide.getRange('A4:B32').format.font={name:'Arial',size:10,color:'#172033'};guide.getRange('A4:A32').format.columnWidth=37;guide.getRange('B4:B32').format.columnWidth=108;
guide.getRange('A4:B32').format.wrapText=true;guide.getRange('A4:B32').format.verticalAlignment='center';guide.getRange('A4:B32').format.rowHeight=46;
for(const row of [4,14,24])guide.getRange(`A${row}:B${row}`).format={fill:'#233C61',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:28};
guide.tabColor='#7B8DA5';
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Câu hỏi!A1:H6',include:'values,formulas',tableMaxRows:6,tableMaxCols:8,maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:20},maxChars:1000})).ndjson);
for(const [name,sheetName,range] of [
  ['questions-a','Câu hỏi','A1:H10'],['questions-b','Câu hỏi','I1:P10'],['questions-c','Câu hỏi','Q1:W10'],['questions-d','Câu hỏi','X1:AE10'],
  ['metadata','Thông tin bộ','A1:B5'],['instructions-a','Hướng dẫn','A1:B22'],['instructions-b','Hướng dẫn','A24:B32'],
]){const preview=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(path.join(qa,`${name}.png`),new Uint8Array(await preview.arrayBuffer()));}
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(output,'online-week.xlsx'));
try{await fs.rename(path.join(output,'online-week.xlsx.inspect.ndjson'),path.join(qa,'workbook-inspection.ndjson'));}catch(error){if(error.code!=='ENOENT')throw error;}
console.log('Created online-week.docx and online-week.xlsx');
// All writes and renders have completed. End this CLI explicitly because the
// bundled Windows renderer otherwise leaves a failing native shutdown status.
process.exit(0);

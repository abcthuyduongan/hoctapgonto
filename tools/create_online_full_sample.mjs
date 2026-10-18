/** Build the downloadable example with the bundled spreadsheet runtime.
 * Run with the bundled Node executable. Artifacts are authored through
 * @oai/artifact-tool resolved from the dedicated authoring directory junction.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {ONLINE_DOCUMENT_HEADERS,parseOnlineDocument,inspectOnlineDocument,onlineDocumentGameChoices} from '../src/core/online-document-import.ts';
import {validatePack} from '../src/core/validation.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const authoring=path.join(root,'test-results','online-sample-authoring');
const packageDirectory=path.join(authoring,'bo-mau-day-du');
const outputDirectory=path.join(root,'public','question-templates');
const localRequire=createRequire(path.join(authoring,'artifact-loader.cjs'));
const {Workbook,SpreadsheetFile}=await import(pathToFileURL(localRequire.resolve('@oai/artifact-tool')).href);
await fs.mkdir(packageDirectory,{recursive:true});await fs.mkdir(outputDirectory,{recursive:true});

const common={source:'Bảo An Learning - nội dung mẫu tự biên soạn',rights:'Cho phép dùng và chỉnh sửa nội dung mẫu trong ứng dụng.'};
const transcriptChoice='This is my red bag. I have three books.';
const transcriptGap='My name is Anna. I am eight years old.';
const question=(kind,subjectLabel,title,itemId,fields)=>({...common,kind,subjectLabel,title,itemId,objectiveId:`SAMPLE.L3.${kind.toUpperCase()}`,...fields});
const questions=[
  question('quiz','Toán','Trắc nghiệm có hình','SAMPLE.L3.QUIZ.01',{prompt:'Hình màu đỏ trong ảnh có bao nhiêu cạnh?',A:'3',B:'4',C:'5',D:'6',answer:'B',explanation:'Hình vuông có bốn cạnh.',imageFile:'hinh-vuong.png',imageAlt:'Một hình vuông màu đỏ trên nền trắng.'}),
  question('quiz','Toán','Trắc nghiệm có hình','SAMPLE.L3.QUIZ.02',{prompt:'Có bao nhiêu hình tròn trong ảnh?',A:'1',B:'2',C:'3',D:'4',answer:'C',explanation:'Đếm lần lượt được ba hình tròn màu xanh.',imageFile:'ba-hinh-tron.png',imageAlt:'Ba hình tròn màu xanh xếp thành một hàng.',allowedGameIds:'memory-match|word-connect'}),
  question('pairs','Tiếng Việt','Từ ngữ và phẩm chất','SAMPLE.L3.PAIRS.01',{left:'đoàn kết',right:'chung sức'}),
  question('pairs','Tiếng Việt','Từ ngữ và phẩm chất','SAMPLE.L3.PAIRS.02',{left:'chăm chỉ',right:'siêng năng'}),
  question('sentences','Tiếng Việt','Sắp xếp câu','SAMPLE.L3.SENTENCE.01',{prompt:'Sắp xếp các từ thành câu kể.',words:'Em|chăm|sóc|cây|xanh.',hint:'Bắt đầu bằng từ Em.'}),
  question('sentences','Tiếng Việt','Sắp xếp câu','SAMPLE.L3.SENTENCE.02',{prompt:'Sắp xếp các từ thành câu nói về việc đọc sách.',words:'Chúng|em|cùng|đọc|sách.',hint:'Bắt đầu bằng từ Chúng.'}),
  question('numeric-answer','Toán','Nhập đáp án số','SAMPLE.L3.NUMBER.01',{prompt:'Tính 125 + 234.',answer:'359',hint:'Cộng các chữ số theo từng hàng.',explanation:'125 + 234 = 359.'}),
  question('numeric-answer','Toán','Nhập đáp án số','SAMPLE.L3.NUMBER.02',{prompt:'Tính 48 : 6.',answer:'8',hint:'Dùng bảng chia 6.',explanation:'Vì 6 × 8 = 48 nên 48 : 6 = 8.'}),
  question('fill-blank','Tiếng Việt','Điền chữ còn thiếu','SAMPLE.L3.FILL.01',{prompt:'Điền c hoặc k: ___ây tre.',acceptedAnswers:'c',caseSensitive:'false',hint:'Từ chỉ một loài cây quen thuộc.',explanation:'Viết cây tre với chữ c.'}),
  question('fill-blank','Tiếng Việt','Điền chữ còn thiếu','SAMPLE.L3.FILL.02',{prompt:'Điền c hoặc k: ___ể chuyện.',acceptedAnswers:'k',caseSensitive:'false',hint:'Tiếng đứng trước chuyện.',explanation:'Viết kể chuyện với chữ k.'}),
  ...[
    {id:'01',prompt:'Lan và bố trồng cây gì?',A:'Cây cam',B:'Cây xoài',C:'Cây bưởi',D:'Cây chuối',answer:'B',explanation:'Đoạn đọc cho biết Lan và bố trồng một cây xoài.'},
    {id:'02',prompt:'Sau khi đặt cây xuống đất, hai bố con làm gì?',A:'Đọc sách',B:'Chơi bóng',C:'Tưới nước',D:'Đi chợ',answer:'C',explanation:'Cuối đoạn đọc, hai bố con tưới nước cho cây.'},
  ].map(({id,...fields})=>question('reading-choice','Tiếng Việt','Đọc hiểu','SAMPLE.L3.READ.'+id,{...fields,passageTitle:'Cây xoài nhỏ',passage:'Sáng chủ nhật, Lan cùng bố trồng một cây xoài trong vườn. Lan xới đất, bố đặt cây, rồi hai bố con tưới nước.',hint:'Tìm chi tiết được nêu trong đoạn đọc.'})),
  question('listening-choice','Tiếng Anh','Nghe và chọn','SAMPLE.L3.LISTEN.01',{prompt:'What colour is the bag?',A:'Red',B:'Blue',C:'Green',D:'Yellow',answer:'A',hint:'Listen for the colour.',explanation:'The speaker says: This is my red bag.',audioFile:'nghe-chon.wav',audioTranscript:transcriptChoice}),
  question('listening-choice','Tiếng Anh','Nghe và chọn','SAMPLE.L3.LISTEN.02',{prompt:'How many books does the speaker have?',A:'One',B:'Two',C:'Three',D:'Four',answer:'C',hint:'Listen for the number of books.',explanation:'The speaker says: I have three books.',audioFile:'nghe-chon.wav',audioTranscript:transcriptChoice}),
  question('listening-gap','Tiếng Anh','Nghe và điền','SAMPLE.L3.GAP.01',{prompt:'My name is ___.',acceptedAnswers:'Anna',caseSensitive:'false',hint:'Listen for the name.',explanation:'The speaker says: My name is Anna.',audioFile:'nghe-dien.wav',audioTranscript:transcriptGap}),
  question('listening-gap','Tiếng Anh','Nghe và điền','SAMPLE.L3.GAP.02',{prompt:'I am ___ years old.',acceptedAnswers:'eight|8',caseSensitive:'false',hint:'Listen for the age.',explanation:'The speaker says: I am eight years old.',audioFile:'nghe-dien.wav',audioTranscript:transcriptGap}),
];

questions[1].allowedGameIds='math-quest';
questions.push(
  ...[
    ['03','Lan có 24 nhãn vở, cho bạn 7 nhãn. Lan còn bao nhiêu nhãn?',['17','18','31','16'],'A','24 − 7 = 17.'],
    ['04','Mỗi hộp có 6 bút. Ba hộp có bao nhiêu bút?',['9','12','18','24'],'C','6 × 3 = 18.'],
    ['05','Có 36 quả cam chia đều vào 4 rổ. Mỗi rổ có mấy quả?',['8','9','10','12'],'B','36 : 4 = 9.'],
    ['06','Bình mua 3 quyển vở giá 5 nghìn đồng mỗi quyển. Đưa 20 nghìn, Bình được trả mấy nghìn?',['3','4','5','15'],'C','Tiền vở: 3 × 5 = 15 nghìn. Tiền trả: 20 − 15 = 5 nghìn.'],
  ].map(([id,prompt,options,answer,explanation])=>question('quiz','Toán','Trắc nghiệm có hình','SAMPLE.L3.QUIZ.'+id,{prompt,A:options[0],B:options[1],C:options[2],D:options[3],answer,explanation,allowedGameIds:'math-quest'})),
  ...[
    ['03','Một đội có 18 bạn, chia thành 3 nhóm bằng nhau. Mỗi nhóm có bao nhiêu bạn?','6','18 : 3 = 6.'],
    ['04','Cửa hàng có 45 kg gạo, bán 18 kg rồi nhập thêm 9 kg. Hiện có bao nhiêu kg?','36','45 − 18 + 9 = 27 + 9 = 36.'],
    ['05','Có 4 túi, mỗi túi 8 viên bi. Cho đi 9 viên, còn bao nhiêu viên?','23','4 × 8 − 9 = 32 − 9 = 23.'],
    ['06','Một hình chữ nhật dài 8 cm, rộng 5 cm. Chu vi là bao nhiêu cm?','26','Chu vi: (8 + 5) × 2 = 26 cm.'],
  ].map(([id,prompt,answer,explanation])=>question('numeric-answer','Toán','Nhập đáp án số','SAMPLE.L3.NUMBER.'+id,{prompt,answer,explanation,hint:'Xác định từng phép tính cần làm rồi tính lần lượt.'})),
  question('pairs','Tiếng Việt','Từ ngữ và phẩm chất','SAMPLE.L3.PAIRS.03',{left:'Minh nhận lỗi và sửa việc mình làm sai.',right:'Dũng cảm, trung thực'}),
  question('pairs','Tiếng Việt','Từ ngữ và phẩm chất','SAMPLE.L3.PAIRS.04',{left:'Thấy bạn bị ngã, Lan dừng chơi, đỡ bạn dậy và đưa bạn đến cô giáo.',right:'Biết quan tâm và giúp đỡ'}),
  question('sentences','Tiếng Việt','Sắp xếp câu','SAMPLE.L3.SENTENCE.03',{prompt:'Sắp xếp để nêu đúng nguyên nhân rồi kết quả.',words:'Vì|trời|mưa|nên|chúng|em|mang|áo|mưa.',hint:'Dùng cặp từ Vì ... nên ...'}),
  question('sentences','Tiếng Việt','Sắp xếp câu','SAMPLE.L3.SENTENCE.04',{prompt:'Sắp xếp câu thể hiện sự đối lập.',words:'Tuy|nhà|xa|nhưng|Lan|vẫn|đến|lớp|đúng|giờ.',hint:'Dùng cặp từ Tuy ... nhưng ...'}),
  ...[
    ['01','Choose the word: There ___ three books on my desk.',['is','are','am','be'],'B','Three books là số nhiều, dùng are.'],
    ['02','Choose the word: My brother ___ a blue bag.',['have','are','has','am'],'C','My brother là ngôi thứ ba số ít, dùng has.'],
    ['03','Choose the answer: The cat is under the table. Where is the cat?',['On the table','In the bag','Under the table','By the door'],'C','Under the table nghĩa là ở dưới bàn.'],
    ['04','There are two red balls and three blue balls. How many balls are there?',['Two','Three','Four','Five'],'D','Two + three = five.'],
  ].map(([id,prompt,options,answer,explanation])=>question('quiz','Tiếng Anh','Chọn từ theo ngữ cảnh','SAMPLE.L3.ENQUIZ.'+id,{prompt,A:options[0],B:options[1],C:options[2],D:options[3],answer,explanation,allowedGameIds:'math-quest'})),
  ...[
    ['01','How old is Ben?',['Seven','Eight','Nine','Ten'],'B','Ben says he is eight years old.'],
    ['02','Which sentence compares the bag and the books correctly?',['Both are under the desk.','The bag is under the desk; the books are on it.','Both are blue.','The books are in the bag.'],'B','Combine the two details: the bag is under the desk; the books are on the desk.'],
    ['03','Ben puts the green book in his bag. How many books stay on the desk?',['One','Two','Three','Four'],'B','Three books are on the desk. Moving the one green book leaves the two blue books.'],
    ['04','Which sentence is true?',['Ben is nine.','The bag is blue.','All books are green.','The bag is below the books.'],'D','The books are on the desk, and the bag is under the desk.'],
  ].map(([id,prompt,options,answer,explanation])=>question('reading-choice','Tiếng Anh','Đọc hiểu tiếng Anh','SAMPLE.L3.ENREAD.'+id,{prompt,A:options[0],B:options[1],C:options[2],D:options[3],answer,explanation,passageTitle:'Ben and his school things',passage:'My name is Ben. I am eight years old. My red bag is under the desk. Two blue books and one green book are on the desk.',hint:'Đối chiếu các chi tiết về tuổi, màu, số lượng và vị trí trong đoạn đọc.'})),
);
const difficultyCounts=new Map();for(const row of questions){const index=difficultyCounts.get(row.subjectLabel)??0;row.difficulty=index<4?'easy':index<9?'medium':'hard';difficultyCounts.set(row.subjectLabel,index+1);}
if(questions.length!==36||[...difficultyCounts.values()].some(count=>count!==12))throw new Error('Sample must contain three subjects with twelve questions each.');

// Two original geometric illustrations. No external image assets are needed.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function png(width,height,colour){const rows=Buffer.alloc((width*3+1)*height,255);for(let y=0;y<height;y++){const offset=y*(width*3+1);rows[offset]=0;for(let x=0;x<width;x++){const c=colour(x,y);rows[offset+1+x*3]=c[0];rows[offset+2+x*3]=c[1];rows[offset+3+x*3]=c[2];}}
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
await fs.writeFile(path.join(packageDirectory,'hinh-vuong.png'),png(360,240,(x,y)=>x>=100&&x<260&&y>=40&&y<200?[220,48,60]:[255,255,255]));
await fs.writeFile(path.join(packageDirectory,'ba-hinh-tron.png'),png(360,240,(x,y)=>[65,180,295].some(cx=>(x-cx)**2+(y-120)**2<=44**2)?[32,100,208]:[255,255,255]));
execFileSync('pwsh.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools','create_online_sample_audio.ps1'),'-OutputDirectory',packageDirectory],{windowsHide:true,stdio:'pipe'});

const workbook=Workbook.create();
const info=workbook.worksheets.add('Thông tin bộ'),sheet=workbook.worksheets.add('Câu hỏi'),guide=workbook.worksheets.add('Hướng dẫn');
const infoRows=[['schema','baoan-online-week'],['formatVersion','1'],['title','Bộ mẫu đầy đủ lớp 3'],['grade','3'],['description','36 câu mẫu, 3 môn × 12 câu, đủ 8 dạng và độ khó 4/5/3 mỗi môn. Chọn tuần học trên giao diện khi nhập.']];
info.getRange('A1:B5').values=infoRows;
sheet.getRange('A1:B1').values=[['baoan-online-week','1']];
sheet.getRange('A2:AG2').values=[[...ONLINE_DOCUMENT_HEADERS]];
sheet.getRange('A3:AG38').values=questions.map(row=>ONLINE_DOCUMENT_HEADERS.map(key=>row[key]??''));
const instructions=[
  ['BỘ MẪU ĐẦY ĐỦ LỚP 3',''],
  ['1. Giải nén','Giải nén bo-mau-day-du.zip trước khi chọn tệp trong ứng dụng.'],
  ['2. Chọn tuần','Chọn lớp và tuần học trên giao diện. Không cần nhập tuần trong Excel.'],
  ['3. Chọn tệp cùng lúc','Chọn bo-mau-day-du.xlsx cùng 2 PNG và 2 WAV trong cùng một lần chọn.'],
  ['4. Kiểm tra','Bấm Kiểm tra & xem trước. Mẫu có 36 câu, chia thành 10 bộ.'],
  ['5. Giao bài','Xem nội dung, đáp án và tệp nghe/ảnh. Chỉ giao các câu đã đạt kiểm tra.'],
  ['Tên ảnh và âm thanh','Giữ nguyên tên tệp tại imageFile/audioFile. Không điền đường dẫn.'],
  ['Ô không dùng','Để trống ô không dùng. null/NULL được coi là thiếu dữ liệu: cột bắt buộc báo lỗi và loại câu; cột tùy chọn để trống. #NULL! và lỗi Excel luôn báo lỗi.'],
  ['Quy tắc đáp án','quiz: A/B/C/D; pairs: left/right; sentences: words ngăn bằng |.'],
  ['Quy tắc đáp án (tiếp)','numeric-answer: answer; fill-blank/listening-gap: acceptedAnswers ngăn bằng |.'],
  ['Ảnh và nghe','imageAlt mô tả đúng ảnh; audioTranscript chép đúng lời nghe.'],
  ['Ngữ liệu nghe 1',transcriptChoice],['Ngữ liệu nghe 2',transcriptGap],
  ['Nguồn và quyền',common.source+'. '+common.rights],
  ['Giới hạn trò từng câu','allowedGameIds để trống dùng mọi trò hỗ trợ; nhiều mã tách bằng |. Trắc nghiệm Toán chỉ dùng math-quest để giữ yêu cầu suy luận.'],
  ['Độ khó và giới hạn','difficulty: easy/medium/hard. Gợi ý 4 nền tảng, 5 vận dụng, 3 nâng cao/môn; giáo viên cần duyệt độ vừa sức. Tuần mới 3–4 môn, tối đa 12 câu/môn.'],
];
guide.getRange('A1:B16').values=instructions;
for(const current of [info,sheet,guide]){current.showGridLines=false;current.getUsedRange().format.font={name:'Arial',size:11,color:'#172033'};current.getUsedRange().format.verticalAlignment='center';}
info.getRange('A1:A5').format.font={name:'Arial',size:11,bold:true,color:'#22345A'};info.getRange('A1:A5').format.columnWidth=22;info.getRange('B1:B5').format.columnWidth=86;info.getRange('A1:B5').format.rowHeight=26;
sheet.freezePanes.freezeRows(2);sheet.freezePanes.freezeColumns(2);sheet.getRange('A1:AG38').format.columnWidth=20;sheet.getRange('A1:AG38').format.rowHeight=38;
sheet.getRange('A2:AG2').format={fill:'#243D68',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:28,verticalAlignment:'center',horizontalAlignment:'center'};
sheet.getRange('H3:H18').format.columnWidth=48;sheet.getRange('H3:H18').format.wrapText=true;
sheet.getRange('Q3:R18').format.columnWidth=45;sheet.getRange('Q3:R18').format.wrapText=true;sheet.getRange('W3:W18').format.columnWidth=70;sheet.getRange('W3:W18').format.wrapText=true;
sheet.getRange('AB3:AC18').format.columnWidth=56;sheet.getRange('AB3:AC18').format.wrapText=true;
sheet.getRange('Y3:Y18').format.columnWidth=52;sheet.getRange('AA3:AA18').format.columnWidth=58;sheet.getRange('AA3:AA18').format.wrapText=true;sheet.getRange('AD3:AE18').format.columnWidth=32;
sheet.getRange('AF1:AG38').format.columnWidth=54;sheet.getRange('AF1:AG38').format.wrapText=true;
sheet.getRange('AG1:AG38').format.columnWidth=20;sheet.getRange('AG3:AG38').dataValidation={rule:{type:'list',values:['easy','medium','hard']}};
for(let index=0;index<questions.length;index+=2)sheet.getRange(`A${index+3}:AF${index+4}`).format.fill=index%4===0?'#EEF3FA':'#FFFFFF';
guide.getRange('A1:B16').format.rowHeight=32;guide.getRange('A1:A16').format.columnWidth=28;guide.getRange('B1:B16').format.columnWidth=108;
guide.getRange('A1').format.font={name:'Arial',size:15,bold:true,color:'#243D68'};guide.getRange('A2:A16').format.font={name:'Arial',size:11,bold:true,color:'#22345A'};
guide.getRange('B1:B16').format.wrapText=true;guide.getRange('A10:B10').format.rowHeight=45;guide.getRange('A14:B14').format.rowHeight=45;guide.getRange('A15:B16').format.rowHeight=58;
workbook.recalculate();
const overview=await workbook.inspect({kind:'table',range:"'Câu hỏi'!A1:M6",include:'values,formulas',tableMaxRows:6,tableMaxCols:13,maxChars:2200});
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'sample formula error scan',maxChars:1000});
await fs.writeFile(path.join(authoring,'artifact-inspection.txt'),overview.ndjson+'\n'+errors.ndjson);
for(const [sheetName,range,filename] of [['Thông tin bộ','A1:B5','thong-tin.png'],['Câu hỏi','A1:M6','cau-hoi.png'],['Câu hỏi','AD1:AG6','gioi-han-tro.png'],['Hướng dẫn','A1:B16','huong-dan.png']]){const blob=await workbook.render({sheetName,range,scale:1.3,format:'png'});await fs.writeFile(path.join(authoring,filename),new Uint8Array(await blob.arrayBuffer()));}
const workbookName='bo-mau-day-du.xlsx';
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(packageDirectory,workbookName));
await fs.writeFile(path.join(packageDirectory,'HUONG_DAN.txt'),[
  'BỘ MẪU ĐẦY ĐỦ LỚP 3',
  'Gồm 36 câu (3 môn, mỗi môn 12 câu), 2 ảnh PNG và 2 âm thanh WAV có lời đọc tiếng Anh.',
  '',
  'CÁCH NHẬP',
  '1. Giải nén toàn bộ bo-mau-day-du.zip vào một thư mục.',
  '2. Trong quản trị, chọn lớp và tuần học bằng danh sách trên giao diện.',
  '3. Ở mục chọn tệp, chọn bo-mau-day-du.xlsx và cả 4 tệp ảnh/âm thanh cùng một lần (Ctrl để chọn nhiều tệp). Không chọn ZIP.',
  '4. Bấm Kiểm tra & xem trước. Đối chiếu 36 câu được chấp nhận, 10 bộ và 0 câu bị loại.',
  '5. Mở các câu có ảnh và nghe thử hai tệp âm thanh, xem đáp án, sau đó giao các câu đạt kiểm tra.',
  '',
  'KHI SOẠN CÂU MỚI',
  '- Giữ nguyên tên sheet, hàng schema và tên các cột trong Excel.',
  '- Chọn tuần trên giao diện; có thể để trống cột week trong tệp.',
  '- null/NULL nghĩa là thiếu dữ liệu. Cột bắt buộc sẽ báo rõ dòng/cột và không tải câu đó; cột tùy chọn được để trống. Lỗi Excel #NULL!, #VALUE!, #REF! luôn báo lỗi ô.',
  '- Tên imageFile/audioFile phải trùng tên tệp chọn kèm. Giữ mô tả ảnh và transcript đúng nội dung.',
  '- Mỗi môn và dạng cần 2–30 câu để tạo bộ chơi. Câu lỗi được chỉ rõ vị trí/lý do và không được giao lên trò chơi.',
  '- allowedGameIds là giới hạn trò cho từng câu. Để trống dùng mọi trò hỗ trợ; tách nhiều mã bằng |. Trắc nghiệm Toán dùng math-quest để giữ yêu cầu suy luận.',
  '- Các mã trò: math-quest, memory-match, sentence-builder, word-connect, sequence-trail. Không có trò chung thì sửa hoặc tách bộ trước khi giao; ứng dụng không tự bỏ câu.',
  '- Nội dung mẫu chỉ được nhập khi bạn tự chọn và xác nhận giao bài.',
  '',
  'LỜI NGHE',
  'nghe-chon.wav: '+transcriptChoice,
  'nghe-dien.wav: '+transcriptGap,
  '',common.source+'. '+common.rights,
].join('\r\n'),'utf8');

const names=[workbookName,'hinh-vuong.png','ba-hinh-tron.png','nghe-chon.wav','nghe-dien.wav','HUONG_DAN.txt'];
const buffers=Object.fromEntries(await Promise.all(names.map(async name=>[name,await fs.readFile(path.join(packageDirectory,name))])));
const catalog=names.filter(name=>/\.(png|wav)$/.test(name)).map((name,index)=>({id:`sample-media-${index+1}`,name,mime:name.endsWith('.png')?'image/png':'audio/wav',kind:name.endsWith('.png')?'image':'audio',size:buffers[name].length,sha256:createHash('sha256').update(buffers[name]).digest('hex')}));
const context={idPrefix:'sample-week',grade:3,title:'Tuần mẫu',sourceId:'sample-lop-3'};
const strict=await parseOnlineDocument(buffers[workbookName],workbookName,context,catalog),inspection=await inspectOnlineDocument(buffers[workbookName],workbookName,context,catalog,{weekTitle:'Tuần 01'});
if(strict.sets.length!==10||strict.sets.reduce((count,set)=>count+set.pack.items.length,0)!==36||inspection.issues.length||inspection.acceptedQuestions!==36)throw new Error('Mẫu phải có đúng 36 câu đạt kiểm tra, 10 bộ và không có câu lỗi.');
for(const {pack} of strict.sets){if(validatePack(pack).length||!onlineDocumentGameChoices(pack).length)throw new Error(`Bộ ${pack.title} không thể chơi.`);}
// ZIP packaging is not spreadsheet authoring; use the app's existing ZIP library.
const repoRequire=createRequire(path.join(root,'package.json'));
const {zipSync,unzipSync}=repoRequire('fflate');const archive=zipSync(buffers,{level:9});
const unpacked=unzipSync(archive);for(const name of names)if(!Buffer.from(unpacked[name]??[]).equals(buffers[name]))throw new Error('ZIP không giữ nguyên tệp '+name);
await fs.writeFile(path.join(outputDirectory,'bo-mau-day-du.zip'),archive);
await fs.copyFile(path.join(packageDirectory,workbookName),path.join(outputDirectory,workbookName));
const result={questions:inspection.totalQuestions,accepted:inspection.acceptedQuestions,excluded:inspection.issues.length,sets:strict.sets.length,files:names.map(name=>({name,bytes:buffers[name].length})),archiveBytes:archive.length,sha256:createHash('sha256').update(archive).digest('hex'),games:strict.sets.map(set=>({kind:set.pack.kind,title:set.pack.title,games:onlineDocumentGameChoices(set.pack).map(game=>game.id)}))};
await fs.writeFile(path.join(authoring,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

import {zipSync,strToU8} from 'fflate';
import type {ContentPack,LearningPack,QuestionMetadata} from './contracts.ts';
import {ONLINE_DOCUMENT_HEADERS} from './online-document-import.ts';

export type ExportHeader=typeof ONLINE_DOCUMENT_HEADERS[number];
export type ExportRow=Partial<Record<ExportHeader,string>>;
export type ExportMedia={id:string;name:string;kind:'image'|'audio';mime:string;size:number;sha256:string};
export type QuestionStat={students:number;firstTryCorrect:number;attempts:number;wrong:number;medianCorrectMs:number|null;tiers:[number,number,number,number];commonWrong:{answer:string;count:number}|null};
export type QuestionExport={exportedAt:string;week:{id:string;title:string;position:number;classId:string;className:string};sets:{subjectLabel:string;pack:ContentPack}[];media:ExportMedia[];classStudents:number;statsTruncated:boolean;stats:Record<string,Record<string,QuestionStat>>};

const letters='ABCD';
function metadataFields(metadata:QuestionMetadata|undefined,objectiveId:string):ExportRow{
  return{objectiveId,difficulty:metadata?.difficulty??'medium',...(metadata?.topicId?{topic:metadata.topicId}:{}),...(metadata?.formId?{competition:metadata.formId}:{}),
    ...(metadata?.level?{level:metadata.level}:{}),...(metadata?.allowedGameIds?.length?{allowedGameIds:metadata.allowedGameIds.join('|')}:{}),
    ...(metadata?.source?{source:metadata.source}:{}),...(metadata?.rights?{rights:metadata.rights}:{})};
}
/** One import row per question, in the same 33-column layout the importer reads. Re-importing it keeps every itemId. */
export function packExportRows(pack:ContentPack,{subjectLabel,weekTitle,mediaName}:{subjectLabel:string;weekTitle:string;mediaName:(id:string)=>string|undefined}):ExportRow[]{
  const fileOf=(id:string|undefined)=>{if(!id)return undefined;const name=mediaName(id);if(!name)throw new Error(`Không tìm thấy tên tệp của tư liệu ${id}.`);return name;};
  return pack.items.map(item=>{
    const row:ExportRow={subjectLabel,title:pack.title,week:weekTitle,itemId:item.id,...metadataFields(item.metadata,item.objectiveId)};
    const media=item.media;
    if(media?.imageId){row.imageFile=fileOf(media.imageId);if(media.imageAlt)row.imageAlt=media.imageAlt;}
    if(media?.audioId){row.audioFile=fileOf(media.audioId);if(media.audioTranscript)row.audioTranscript=media.audioTranscript;}
    const choice=(options:readonly string[],correctIndex:number)=>{options.forEach((option,index)=>{row[letters[index] as ExportHeader]=option;});row.answer=letters[correctIndex];};
    switch(item.kind){
      case 'compare':
        row.kind='compare';
        if(item.prompt)row.prompt=item.prompt;
        row.left=item.left;
        row.right=item.right;
        row.answer=item.operator;
        row.explanation=item.explanation;
        if(item.hint)row.hint=item.hint;
        break;
      case 'categorize':
        row.kind='categorize';
        row.prompt=item.prompt;
        row.passageTitle=item.categories.join('|');
        row.words=item.elements.map(e=>`${e.text}:${e.category}`).join('|');
        row.explanation=item.explanation;
        if(item.hint)row.hint=item.hint;
        break;
      case 'multiple-choice':row.kind='quiz';row.prompt=item.prompt;choice(item.options,item.correctIndex);row.explanation=item.explanation;break;
      case 'pair':row.kind='pairs';row.left=item.left;row.right=item.right;break;
      case 'sentence':row.kind='sentences';row.prompt=item.prompt;row.words=item.words.join('|');if(item.hint)row.hint=item.hint;break;
      case 'numeric-answer':row.kind='numeric-answer';row.prompt=item.prompt;row.answer=item.answer;if(item.unit)row.unit=item.unit;row.hint=item.hint;row.explanation=item.explanation;break;
      case 'fill-blank':case 'listening-gap':row.kind=item.kind;row.prompt=item.prompt;row.acceptedAnswers=item.acceptedAnswers.join('|');row.caseSensitive=item.caseSensitive?'true':'false';row.hint=item.hint;row.explanation=item.explanation;
        if(item.kind==='listening-gap')attachLearningAudio(row,pack as LearningPack,item.audioId,fileOf);break;
      case 'reading-choice':{row.kind='reading-choice';row.prompt=item.prompt;choice(item.options,item.correctIndex);row.hint=item.hint;row.explanation=item.explanation;
        const passage=(pack as LearningPack).passages.find(entry=>entry.passageId===item.passageId);if(!passage)throw new Error(`Thiếu đoạn đọc của câu ${item.id}.`);row.passage=passage.body;row.passageTitle=passage.title;break;}
      case 'listening-choice':row.kind='listening-choice';row.prompt=item.prompt;choice(item.options,item.correctIndex);row.hint=item.hint;row.explanation=item.explanation;attachLearningAudio(row,pack as LearningPack,item.audioId,fileOf);break;
    }
    return row;
  });
}
function attachLearningAudio(row:ExportRow,pack:LearningPack,audioId:string,fileOf:(id:string)=>string|undefined){
  row.audioFile=fileOf(audioId);const asset=pack.media.find(entry=>entry.mediaId===audioId);if(asset?.transcript)row.audioTranscript=asset.transcript;
}

const escapeXml=(value:string)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const column=(index:number)=>{let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
function worksheet(matrix:(string|number|null|undefined)[][],widths:number[]=[]):string{
  const cols=widths.length?`<cols>${widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join('')}</cols>`:'';
  const rows=matrix.map((row,r)=>`<row r="${r+1}">${row.map((cell,c)=>{if(cell===undefined||cell===null||cell==='')return '';const ref=`${column(c)}${r+1}`;
    return typeof cell==='number'?`<c r="${ref}"><v>${cell}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;}).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`;
}
/** A minimal, formula-free XLSX that the app's own importer and Excel both open. */
export function buildWorkbook(sheets:{name:string;rows:(string|number|null|undefined)[][];widths?:number[]}[]):Uint8Array{
  const files:Record<string,Uint8Array>={
    '[Content_Types].xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet,i)=>`<sheet name="${escapeXml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach((sheet,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(worksheet(sheet.rows,sheet.widths));});
  return zipSync(files,{level:6});
}

const percent=(part:number,whole:number)=>whole?Math.round(part*100/whole):null;
const kindLabel:Record<string,string>={quiz:'Trắc nghiệm',pairs:'Ghép cặp',sentences:'Sắp xếp câu','numeric-answer':'Nhập số','fill-blank':'Điền từ','reading-choice':'Đọc hiểu','listening-choice':'Nghe chọn','listening-gap':'Nghe điền'};
/** Workbook for one week: importable "Câu hỏi" sheet plus statistics for planning the next set. */
export function questionExportWorkbook(data:QuestionExport):{fileName:string;bytes:Uint8Array;questions:number}{
  const names=new Map(data.media.map(asset=>[asset.id,asset.name])),rows:ExportRow[]=[],statRows:(string|number|null)[][]=[];
  const statHeader=['subjectLabel','kind','itemId','prompt','answer','difficulty','topic','Học sinh đã làm','Đúng ngay lần đầu (%)','Tổng lượt trả lời','Lượt sai','Thời gian đúng trung vị (giây)','0 sao','1 sao','2 sao','3 sao','Đáp án sai hay gặp','Số lần chọn sai đó','Nhận xét'];
  for(const {subjectLabel,pack} of data.sets){
    const packRows=packExportRows(pack,{subjectLabel,weekTitle:data.week.title,mediaName:id=>names.get(id)});rows.push(...packRows);
    packRows.forEach(row=>{const stat=data.stats[pack.id]?.[row.itemId!];const first=stat?percent(stat.firstTryCorrect,stat.students):null;
      const answer=row.kind==='pairs'?`${row.left} ↔ ${row.right}`:row.kind==='sentences'?row.words?.replaceAll('|',' '):row.answer??row.acceptedAnswers;
      const note=!stat||!stat.students?'Chưa có học sinh làm':first!==null&&first>=90?'Dễ: có thể nâng độ khó':first!==null&&first<50?'Khó: nên ôn lại hoặc thêm gợi ý':'Vừa sức';
      statRows.push([subjectLabel,kindLabel[row.kind!]??row.kind??'',row.itemId??'',row.prompt??row.left??'',answer??'',row.difficulty??'',row.topic??'',stat?.students??0,first,stat?.attempts??0,stat?.wrong??0,stat?.medianCorrectMs!=null?Math.round(stat.medianCorrectMs/100)/10:null,...(stat?.tiers??[data.classStudents,0,0,0]),stat?.commonWrong?.answer??'',stat?.commonWrong?.count??null,note]);});
  }
  const topicStats=new Map<string,{subject:string;topic:string;questions:number;students:number;first:number;easy:number;medium:number;hard:number}>();
  data.sets.forEach(({subjectLabel,pack})=>pack.items.forEach(item=>{const topic=item.metadata?.topicId??'(chưa ghi chủ đề)',key=subjectLabel+'\u0000'+topic,entry=topicStats.get(key)??{subject:subjectLabel,topic,questions:0,students:0,first:0,easy:0,medium:0,hard:0};
    entry.questions++;entry[item.metadata?.difficulty??'medium']++;const stat=data.stats[pack.id]?.[item.id];if(stat){entry.students+=stat.students;entry.first+=stat.firstTryCorrect;}topicStats.set(key,entry);}));
  const suggestions=[...topicStats.values()].map(entry=>{const rate=percent(entry.first,entry.students);return[entry.subject,entry.topic,entry.questions,entry.easy,entry.medium,entry.hard,rate,rate===null?'Chưa có dữ liệu':rate<60?'Soạn thêm câu ôn, ưu tiên mức dễ và vừa':rate>=90?'Đã vững: tăng câu mức khó hoặc chuyển chủ đề mới':'Giữ nhịp, thêm 2–3 câu vận dụng'];});
  const guide=[['Tệp xuất từ Bảo An Learning'],[],['Nội dung','Cách dùng'],['Câu hỏi','Đúng 33 cột của mẫu nhập. Sửa trực tiếp rồi nhập lại; giữ nguyên itemId để học sinh không mất sao đã có. Muốn thêm câu mới thì thêm dòng và để trống itemId.'],['Thống kê','Mỗi câu một dòng: số học sinh đã làm, tỉ lệ đúng ngay lần đầu, đáp án sai hay gặp, phân bố sao trong lớp. Sheet này không được nhập.'],['Gợi ý bộ sau','Tổng hợp theo chủ đề để biết nên soạn thêm gì.'],['Hình và âm thanh','Cột imageFile/audioFile là tên tệp trong thư viện. Khi nhập sang máy khác, chọn kèm các tệp này (bản xuất ZIP đã có sẵn).'],[],['Lớp',data.week.className],['Tuần',data.week.title],['Thời điểm xuất',data.exportedAt],['Số học sinh trong lớp',String(data.classStudents)],...(data.statsTruncated?[['Lưu ý','Thống kê chỉ tính 50.000 lượt trả lời đầu tiên.']]:[])];
  const discoveryRows: (string | number | null | undefined)[][] = [
    [],
    ['subjectLabel', 'title', 'discoveryTitle', 'discoveryText', 'discoveryImageFile'],
    ...data.sets.map(s => [
      s.subjectLabel,
      s.pack.title,
      s.pack.discovery?.title ?? '',
      s.pack.discovery?.text ?? '',
      s.pack.discovery?.imageFile ?? (s.pack.discovery?.imageId ? (names.get(s.pack.discovery.imageId) ?? '') : ''),
    ]),
  ];
  const bytes=buildWorkbook([
    {name:'Thông tin bộ',rows:[['schema','baoan-online-week'],['formatVersion','1'],['title',data.week.title],...discoveryRows],widths:[18,30,30,48,24]},
    {name:'Câu hỏi',rows:[['baoan-online-week','1'],[...ONLINE_DOCUMENT_HEADERS],...rows.map(row=>ONLINE_DOCUMENT_HEADERS.map(key=>row[key]??''))],widths:ONLINE_DOCUMENT_HEADERS.map(key=>['prompt','explanation','passage'].includes(key)?48:['A','B','C','D','answer','unit','caseSensitive','difficulty'].includes(key)?12:20)},
    {name:'Thống kê',rows:[statHeader,...statRows],widths:[16,14,24,48,24,10,20,10,12,10,9,14,7,7,7,7,22,10,34]},
    {name:'Gợi ý bộ sau',rows:[['Môn','Chủ đề','Số câu','Dễ','Vừa','Khó','Đúng ngay lần đầu (%)','Gợi ý'],...suggestions],widths:[16,28,8,6,6,6,14,48]},
    {name:'Hướng dẫn',rows:guide,widths:[24,110]},
  ]);
  const safe=(value:string)=>value.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,' ').trim().slice(0,60)||'tuan';
  return{fileName:`${safe(data.week.className)} - ${safe(data.week.title)} - cau hoi va dap an.xlsx`,bytes,questions:rows.length};
}
export {zipSync};

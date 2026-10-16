import {Unzip,UnzipInflate,unzipSync} from 'fflate';
import type {ContentPack,LearningPack,QuestionMedia,QuestionMetadata,RichLearningItem} from './contracts.ts';
import type {LearningMedia} from './learning-contracts.ts';
import type {OnlineMediaAsset} from './online-contracts.ts';
import type {OnlineWeek,OnlineWeekContext} from './online-content.ts';
import {parseOnlineQuestions} from './online-content.ts';
import {parseQuestionWorkbookBytes} from './excel-import.ts';
import {normalizedNumber,normalizedWord} from './rich-content.ts';
import {validatePack} from './validation.ts';
import {onlinePresentation} from './online-exercises.ts';
import {GAME_REGISTRY} from './registry.ts';
import {onlineGeneratedItemId,onlineGeneratedPackId,onlineIdentityHash,onlineSourceCode} from './online-import-identity.ts';
export {onlineDocumentSourceId} from './online-import-identity.ts';

export const ONLINE_DOCUMENT_KINDS=['quiz','pairs','sentences','numeric-answer','fill-blank','reading-choice','listening-choice','listening-gap'] as const;
export type OnlineDocumentKind=typeof ONLINE_DOCUMENT_KINDS[number];
export const ONLINE_DOCUMENT_HEADERS=['subjectLabel','kind','title','topic','week','competition','level','prompt','A','B','C','D','answer','left','right','words','hint','explanation','unit','acceptedAnswers','caseSensitive','passageTitle','passage','imageFile','imageAlt','audioFile','audioTranscript','source','rights','itemId','objectiveId'] as const;
type Fields=Partial<Record<typeof ONLINE_DOCUMENT_HEADERS[number],string>>;
type SourceLocation={row?:number;table?:number};
const sourceLocations=new WeakMap<Fields,SourceLocation>();
function atSource<T>(row:Fields,action:()=>T):T {try{return action();}catch(error){const location=sourceLocations.get(row),message=error instanceof Error?error.message:String(error);
  if(message.startsWith('Excel, sheet')||message.startsWith('Word, bảng'))throw error;
  throw new Error(`${location?.table?`Word, bảng ${location.table}`:`Excel, sheet Câu hỏi, dòng ${location?.row??'?'}`}: ${message}`);
}}
const UNDATED='1970-01-01T00:00:00.000Z';
const DEFAULT_SOURCE='Nội dung do người soạn cung cấp';
const DEFAULT_RIGHTS='Người soạn chịu trách nhiệm';
const nativeKinds=new Set(['quiz','pairs','sentences']);
function fail(message:string):never {throw new Error(message);}
function required(value:string|undefined,field:string,max=320):string {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(`${field}: cần nội dung không trống, tối đa ${max} ký tự.`);
  return value.trim();
}
function split(value:string|undefined,field:string):string[] {
  return required(value,field,1600).split('|').map(part=>required(part,field,120));
}
function rowMetadata(row:Fields):QuestionMetadata {
  return {knowledgeId:required(row.objectiveId??'CUSTOM.QUESTION','objectiveId',120),difficulty:'medium',contentRole:'unassigned',
    source:required(row.source??DEFAULT_SOURCE,'source',1000),rights:required(row.rights??DEFAULT_RIGHTS,'rights',1000),reviewStatus:'draft',
    ...(row.topic?{topicId:required(row.topic,'topic',120)}:{}),...(row.competition?{formId:required(row.competition,'competition',120)}:{}),
    ...(row.level?{level:required(row.level,'level',120)}:{})};
}
function sourceRows(matrix:string[][],rowNumbers:number[]):Fields[] {
  if(matrix.length<2||matrix[0][0]!=='baoan-online-week'||matrix[0][1]!=='1')fail('Excel, sheet Câu hỏi, dòng 1, trường schema/formatVersion: thiếu mã mẫu baoan-online-week phiên bản 1.');
  const headers=matrix[1];
  if(!headers.length||headers.some(header=>!ONLINE_DOCUMENT_HEADERS.includes(header as typeof ONLINE_DOCUMENT_HEADERS[number]))||new Set(headers).size!==headers.length)fail('Excel, sheet Câu hỏi, dòng 2: Tiêu đề cột bị trùng hoặc không thuộc mẫu.');
  if(!['subjectLabel','kind'].every(header=>headers.includes(header)))fail('Excel, sheet Câu hỏi, dòng 2: cần cột subjectLabel và kind.');
  return matrix.slice(2).map((cells,index)=>{
    const number=rowNumbers[index+2]??index+3;
    if(cells.length>headers.length&&cells.slice(headers.length).some(Boolean))fail(`Excel, sheet Câu hỏi, dòng ${number}: có ô nằm ngoài mẫu.`);
    const row:Fields={};headers.forEach((header,i)=>{if(cells[i]?.trim())row[header as keyof Fields]=cells[i].trim();});sourceLocations.set(row,{row:number});return row;
  });
}
function decodeXml(value:string):string {
  return value.replace(/&([^;]+);/g,(_entity,code:string)=>{
    const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(code in named)return named[code];
    if(!/^#(?:x[0-9a-f]+|\d+)$/i.test(code))fail('DOCX có thực thể XML không hợp lệ.');
    const point=code[1]?.toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
    if(!point||point>0x10ffff||point>=0xd800&&point<=0xdfff)fail('DOCX có Unicode không hợp lệ.');return String.fromCodePoint(point);
  });
}
function assertXmlTree(xml:string):void {
  const stack:string[]=[];let end=0;
  const tags=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w.:-]*(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  for(const match of xml.matchAll(tags)){
    if(xml.slice(end,match.index).includes('<'))fail('XML Word có thẻ không hợp lệ.');end=match.index+match[0].length;
    const tag=match[0];if(tag.startsWith('<?')||tag.startsWith('<!--'))continue;
    const name=/^<\/?([\w.:-]+)/.exec(tag)![1];
    if(tag.startsWith('</')){if(stack.pop()!==name)fail('XML Word có thẻ đóng không khớp.');}
    else if(!tag.endsWith('/>')){stack.push(name);if(stack.length>128)fail('XML Word lồng quá nhiều cấp.');}
  }
  if(stack.length||xml.slice(end).includes('<'))fail('XML Word chưa đầy đủ.');
}
/** Inflate only the document XML, checking both ZIP declarations and actual output. */
function wordXml(bytes:Uint8Array):string {
  const entries=new Map<string,number>();let declared=0;
  try{unzipSync(bytes,{filter:file=>{
    if(entries.has(file.name)||entries.size>=128)fail('DOCX có mục ZIP trùng hoặc quá nhiều mục.');entries.set(file.name,file.originalSize);declared+=file.originalSize;
    if(!Number.isSafeInteger(file.originalSize)||file.originalSize<0||declared>8*1024*1024)fail('DOCX vượt giới hạn giải nén 8 MB.');
    if(file.name.endsWith('vbaProject.bin')||file.name.startsWith('word/embeddings/'))fail('DOCX có nội dung nhúng không được hỗ trợ.');
    return false;
  }});}catch(error){throw new Error(error instanceof Error?error.message:'Tệp DOCX không hợp lệ.');}
  const expected=entries.get('word/document.xml');if(expected===undefined||expected>2*1024*1024)fail('DOCX thiếu nội dung hoặc XML vượt 2 MB.');
  let result:string|undefined;let actual=0;const chunks:Uint8Array[]=[];const seen=new Set<string>();
  const unzip=new Unzip(file=>{
    if(!entries.has(file.name)||seen.has(file.name))fail('Danh sách ZIP của DOCX không khớp.');seen.add(file.name);
    if(file.name!=='word/document.xml')return;
    file.ondata=(error,chunk,final)=>{
      if(error)throw error;actual+=chunk.length;if(actual>2*1024*1024||actual>expected)fail('DOCX vượt giới hạn XML.');chunks.push(chunk);
      if(final){if(actual!==expected)fail('Kích thước DOCX không khớp.');const output=new Uint8Array(actual);let offset=0;for(const part of chunks){output.set(part,offset);offset+=part.length;}
        result=new TextDecoder('utf-8',{fatal:true}).decode(output);}
    };file.start();
  });unzip.register(UnzipInflate);
  for(let offset=0;offset<bytes.length;offset+=1024)unzip.push(bytes.subarray(offset,offset+1024),offset+1024>=bytes.length);
  if(result===undefined||seen.size!==entries.size)fail('DOCX chưa đầy đủ.');
  if(/<!DOCTYPE|<!ENTITY/i.test(result)||/<(?:\w+:)?(?:altChunk|object|instrText)\b/i.test(result))fail('DOCX có trường động hoặc XML không được hỗ trợ.');
  if(/<(?:\w+:)?(?:drawing|pict)\b/.test(result))fail('Hãy tải ảnh và âm thanh bằng mục Tệp đa phương tiện và điền tên tệp vào bảng, thay vì nhúng vào Word.');
  assertXmlTree(result);
  return result.replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1');
}
function wordRows(bytes:Uint8Array):{rows:Fields[];title?:string} {
  const xml=wordXml(bytes);if(!/<document\b/.test(xml)||!/<\/document>/.test(xml))fail('Nội dung DOCX không hợp lệ.');
  const tables=[...xml.matchAll(/<tbl\b[^>]*>(.*?)<\/tbl>/gs)];
  if(tables.length>932)fail('DOCX có quá nhiều bảng.');
  if(tables.some(table=>/<tbl\b/.test(table[1]))||tables.length!==[...xml.matchAll(/<tbl(?:\s|>)/g)].length)fail('Không hỗ trợ bảng Word lồng nhau.');
  const rows:Fields[]=[];let marker=false;let title:string|undefined;
  const plain=(body:string)=>[...body.matchAll(/<p\b[^>]*>(.*?)<\/p>/gs)].map(paragraph=>[...paragraph[1].matchAll(/<t\b[^>]*>(.*?)<\/t>|<br\b[^>]*\/>/gs)].map(match=>match[1]===undefined?'\n':decodeXml(match[1])).join('')).join('\n').trim();
  for(const [tableIndex,table] of tables.entries()){
    const cells=[...table[1].matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)].map(row=>[...row[1].matchAll(/<tc\b[^>]*>(.*?)<\/tc>/gs)].map(cell=>plain(cell[1])));
    if(cells[0]?.[0]==='schema'&&cells[0]?.[1]==='baoan-online-week'){
      if(marker)fail('Word có nhiều bảng thông tin tuần.');
      if(cells.find(row=>row[0]==='formatVersion')?.[1]!=='1')fail('Mẫu Word cần formatVersion 1.');marker=true;title=cells.find(row=>row[0]==='title')?.[1];continue;
    }
    if(cells[0]?.[0]!=='field'||cells[0]?.[1]!=='value'){
      if(cells.some(row=>['kind','subjectLabel','prompt','left','acceptedAnswers'].includes(row[0])))fail(`Word, bảng ${tableIndex+1}: tiêu đề bảng câu hỏi phải là field và value; không bỏ qua bảng đã điền.`);
      continue;
    }
    const row:Fields={},names=new Set<string>();sourceLocations.set(row,{table:tableIndex+1});
    for(const cellsRow of cells.slice(1)){
      const [name,value]=cellsRow;atSource(row,()=>{if(cellsRow.length!==2||!ONLINE_DOCUMENT_HEADERS.includes(name as typeof ONLINE_DOCUMENT_HEADERS[number])||names.has(name))fail(`Trường ${name??'?'} không hợp lệ hoặc trùng tên.`);
      names.add(name);if(value)row[name as keyof Fields]=required(value,name,name==='passage'||name==='audioTranscript'?8000:4000);});
    }rows.push(row);
  }
  if(!marker)fail('Word thiếu bảng schema baoan-online-week phiên bản 1.');
  return {rows,title};
}
function findAsset(name:string,catalog:OnlineMediaAsset[],assetKind:'image'|'audio'):OnlineMediaAsset {
  if(!name||/[\\/]/.test(name))fail('Tên tệp đa phương tiện chỉ gồm tên tệp đã tải lên.');
  const matches=catalog.filter(asset=>asset.name.normalize('NFC')===name.normalize('NFC')&&asset.kind===assetKind);
  if(matches.length!==1)fail(`Tệp ${name}: cần tải lên đúng một tệp ${assetKind==='image'?'hình ảnh':'âm thanh'} có tên này.`);
  const asset=matches[0];if(!/^[a-zA-Z0-9._-]{1,120}$/.test(asset.id)||!/^[a-f0-9]{64}$/.test(asset.sha256))fail(`Tệp ${name}: catalog không hợp lệ.`);
  if(assetKind==='image'&&!['image/png','image/jpeg','image/webp'].includes(asset.mime))fail('Hình ảnh chỉ nhận PNG, JPEG hoặc WebP.');return asset;
}
function attachments(row:Fields,catalog:OnlineMediaAsset[]):{question?:QuestionMedia;audio?:LearningMedia} {
  let image:OnlineMediaAsset|undefined,audio:OnlineMediaAsset|undefined;
  if(row.imageFile)image=findAsset(row.imageFile,catalog,'image');else if(row.imageAlt)fail('imageAlt có mô tả nhưng thiếu imageFile.');
  if(row.audioFile)audio=findAsset(row.audioFile,catalog,'audio');else if(row.audioTranscript)fail('audioTranscript có nội dung nhưng thiếu audioFile.');
  if(!image&&!audio)return {};
  const transcript=audio?required(row.audioTranscript,'audioTranscript',8000):undefined;
  const question:QuestionMedia={...(image?{imageId:image.id,imageAlt:required(row.imageAlt,'imageAlt',500)}:{}),...(audio?{audioId:audio.id,audioTranscript:transcript}:{})};
  if(!audio)return {question};
  const extension=audio.mime==='audio/mpeg'?'mp3':['audio/wav','audio/x-wav','audio/wave'].includes(audio.mime)?'wav':audio.mime==='audio/ogg'?'ogg':fail('Âm thanh chỉ nhận MP3, WAV hoặc OGG.');
  return {question,audio:{mediaId:audio.id,kind:'audio',url:`/audio/${audio.id}.${extension}`,sha256:audio.sha256,transcript,
    source:row.source??DEFAULT_SOURCE,rights:row.rights??DEFAULT_RIGHTS,approvedAt:UNDATED}};
}
function choice(row:Fields):{options:[string,string,string,string];correctIndex:0|1|2|3} {
  const options=['A','B','C','D'].map(key=>required(row[key as keyof Fields],key,120)) as [string,string,string,string];
  if(new Set(options.map(option=>normalizedWord(option,false))).size!==4)fail('Các trường A, B, C, D phải chứa bốn phương án khác nhau.');
  const answer=required(row.answer,'answer',1).toUpperCase();if(!/^[A-D]$/.test(answer))fail('answer phải là A, B, C hoặc D.');return {options,correctIndex:(answer.charCodeAt(0)-65) as 0|1|2|3};
}
function groupPack(rows:Fields[],packKind:OnlineDocumentKind,id:string,version:number,title:string,grade:number,catalog:OnlineMediaAsset[]):ContentPack {
  if(rows.length<2||rows.length>30)fail(`${rows[0].subjectLabel}: mỗi môn và dạng câu cần 2–30 câu hỏi.`);
  const shared=['subjectLabel','kind','title','topic','week','competition','level','imageFile','imageAlt','audioFile','audioTranscript','source','rights','itemId','objectiveId'];
  const specifics=packKind==='pairs'?['left','right']:packKind==='sentences'?['prompt','words','answer']
    :packKind==='numeric-answer'?['prompt','answer','unit']:['fill-blank','listening-gap'].includes(packKind)?['prompt','answer','acceptedAnswers','caseSensitive']
    :['prompt','A','B','C','D','answer',...(packKind==='reading-choice'?['passage','passageTitle']:[])];
  const feedback=packKind==='pairs'?[]:packKind==='quiz'?['explanation']:packKind==='sentences'?['hint']:['hint','explanation'];
  for(const row of rows)atSource(row,()=>{const wrong=Object.keys(row).find(key=>![...shared,...specifics,...feedback].includes(key));if(wrong)fail(`${packKind}: trường ${wrong} không thuộc dạng câu này.`);
    if(row.itemId&&!/^[a-zA-Z0-9._:-]{1,80}$/.test(row.itemId))fail('itemId: mã câu cần 1–80 chữ, số, dấu chấm, gạch, gạch dưới hoặc dấu hai chấm.');
    if(packKind==='sentences'){const words=row.words?split(row.words,'words'):required(row.answer,'answer',689).split(/\s+/);
      if(words.length<3||words.length>15||words.some(word=>word.length>45||/\s/.test(word)))fail('Trường words/answer cần 3–15 từ, mỗi từ tối đa 45 ký tự và không chứa khoảng trắng.');}
    if(packKind==='sentences'&&row.words&&row.answer&&JSON.stringify(split(row.words,'words'))!==JSON.stringify(row.answer.trim().split(/\s+/)))fail('words và answer có thứ tự mâu thuẫn.');
    if(['fill-blank','listening-gap'].includes(packKind)&&row.acceptedAnswers&&row.answer&&JSON.stringify(split(row.acceptedAnswers,'acceptedAnswers'))!==JSON.stringify(split(row.answer,'answer')))fail('acceptedAnswers và answer mâu thuẫn.');
  });
  const extras=rows.map(row=>atSource(row,()=>attachments(row,catalog)));
  if(nativeKinds.has(packKind)){
    const nativeRows=rows.map(row=>atSource(row,()=>({...(row.itemId?{id:row.itemId}:{}),objectiveId:row.objectiveId??'CUSTOM.QUESTION',metadata:rowMetadata(row),
      ...(packKind==='quiz'?{prompt:required(row.prompt,'prompt'),...choice(row),explanation:required(row.explanation??`Đáp án: ${row.answer}`,'explanation',500)}
        :packKind==='pairs'?{left:required(row.left,'left',120),right:required(row.right,'right',120)}:{prompt:required(row.prompt,'prompt'),...(row.words?{words:split(row.words,'words')}:{answer:required(row.answer,'answer',689)}),...(row.hint?{hint:required(row.hint,'hint',160)}:{})}),
      })));
    let pack:ContentPack;try{pack=parseOnlineQuestions(JSON.stringify({kind:packKind,items:nativeRows}),'question.json',{id,version,title,grade});}
    catch(error){const number=Number(/(?:Câu|Cặp|Mục) (\d+)/i.exec(error instanceof Error?error.message:'')?.[1]??1);return atSource(rows[number-1]??rows[0],()=>{throw error;});}
    pack.items.forEach((item,index)=>{if(extras[index].question)item.media=extras[index].question;if(!rows[index].itemId)item.id=onlineGeneratedItemId(item);});const errors=validatePack(pack);if(errors.length)return atSource(rows[0],()=>fail(errors[0]));return pack;
  }
  const media:LearningMedia[]=[],passages:LearningPack['passages']=[];
  const items:RichLearningItem[]=rows.map((row,index)=>atSource(row,()=>{
    const attachment=extras[index];if(attachment.audio){const existing=media.find(asset=>asset.mediaId===attachment.audio!.mediaId);
      if(existing&&JSON.stringify(existing)!==JSON.stringify(attachment.audio))fail(`Âm thanh ${row.audioFile}: transcript hoặc nguồn không nhất quán.`);
      if(!existing)media.push(attachment.audio);}
    const base={id:row.itemId??'',objectiveId:row.objectiveId??'CUSTOM.QUESTION',metadata:rowMetadata(row),
      prompt:required(row.prompt,'prompt'),hint:required(row.hint??'Đọc kỹ yêu cầu và nhập đáp án do người soạn chỉ định.','hint',500),
      explanation:required(row.explanation??'Đối chiếu với đáp án do người soạn cung cấp.','explanation',500),...(attachment.question?{media:attachment.question}:{})};
    if(packKind==='numeric-answer'){
      const answer=required(row.answer,'answer',40);if(normalizedNumber(answer)===undefined)fail('answer phải là số nguyên hoặc số thập phân.');
      return {...base,kind:'numeric-answer',answer,...(row.unit?{unit:required(row.unit,'unit',40)}:{})};
    }
    if(packKind==='fill-blank'||packKind==='listening-gap'){
      const acceptedAnswers=split(row.acceptedAnswers??row.answer,'acceptedAnswers');
      if(row.caseSensitive!==undefined&&!['true','false'].includes(row.caseSensitive))fail('caseSensitive chỉ nhận true hoặc false.');
      const fields={...base,acceptedAnswers,caseSensitive:row.caseSensitive==='true'};
      return packKind==='fill-blank'?{...fields,kind:'fill-blank'}:{...fields,kind:'listening-gap',audioId:required(attachment.audio?.mediaId,'audioFile',120)};
    }
    const fields={...base,...choice(row)};
    if(packKind==='listening-choice')return {...fields,kind:'listening-choice',audioId:required(attachment.audio?.mediaId,'audioFile',120)};
    const body=required(row.passage,'passage',8000),passageId=`passage-${onlineIdentityHash(body).slice(0,32)}`;
    const passage={passageId,title:required(row.passageTitle??'Đoạn đọc do người soạn cung cấp','passageTitle',160),body,
      source:row.source??DEFAULT_SOURCE,rights:row.rights??DEFAULT_RIGHTS,approvedAt:UNDATED};
    const existing=passages.find(entry=>entry.passageId===passageId);if(existing&&JSON.stringify(existing)!==JSON.stringify(passage))fail('Cùng đoạn đọc có tiêu đề hoặc nguồn không nhất quán.');
    if(!existing)passages.push(passage);return {...fields,kind:'reading-choice',passageId};
  }));
  items.forEach(item=>{if(!item.id)item.id=onlineGeneratedItemId(item);});
  const pack:LearningPack={id,version,title,grade,subject:'thinking',source:'local',publishedAt:UNDATED,kind:'learning',contentFormatVersion:2,items,passages,media};
  const errors=validatePack(pack);if(errors.length){const number=Number(/(?:Câu|Mục) (\d+)/i.exec(errors[0])?.[1]??1);return atSource(rows[number-1]??rows[0],()=>fail(errors[0]));}return pack;
}

export function onlineDocumentGameChoices(pack:ContentPack) {
  if(validatePack(pack).length)return [];
  return GAME_REGISTRY.filter(game=>{const presentation=onlinePresentation(game.id,pack);return presentation&&validatePack(presentation).length===0;}).map(({id,label})=>({id,label}));
}

/** Only text tables and supplied media catalog references are interpreted. */
export async function parseOnlineDocument(bytes:Uint8Array,fileName:string,context:OnlineWeekContext,media:OnlineMediaAsset[]):Promise<OnlineWeek> {
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<22||bytes.byteLength>1024*1024)fail('Word hoặc Excel cần dung lượng dưới 1 MB; tải ảnh và âm thanh riêng.');
  if(!Array.isArray(media)||media.length>300||media.some(asset=>!asset||typeof asset.name!=='string'||typeof asset.id!=='string'||typeof asset.sha256!=='string'||typeof asset.mime!=='string'||!['image','audio'].includes(asset.kind)))fail('Catalog đa phương tiện không hợp lệ.');
  const extension=fileName.toLowerCase().split('.').pop();let rows:Fields[];let sourceTitle:string|undefined;
  if(extension==='xlsx'){
    const workbook=parseQuestionWorkbookBytes(bytes);rows=sourceRows(workbook.sheets['Câu hỏi'],workbook.rowNumbers['Câu hỏi']);
    const info=workbook.sheets['Thông tin bộ'];if(info[0]?.[0]!=='schema'||info[0]?.[1]!=='baoan-online-week'||info.find(row=>row[0]==='formatVersion')?.[1]!=='1')fail('Thông tin bộ thiếu schema hoặc phiên bản mẫu.');
    sourceTitle=info.find(row=>row[0]==='title')?.[1];
  }else if(extension==='docx'){const parsed=wordRows(bytes);rows=parsed.rows;sourceTitle=parsed.title;}else fail('Chỉ nhận mẫu Word .docx hoặc Excel .xlsx.');
  if(!/^[a-z0-9-]{3,77}$/.test(context.idPrefix)||!Number.isInteger(context.grade)||context.grade<1||context.grade>12)fail('Thông tin lớp hoặc mã tuần không hợp lệ.');
  const filled=rows.filter(row=>Object.keys(row).some(key=>!['kind','title','subjectLabel','week','topic','competition','level','source','rights'].includes(key)));
  if(!filled.length)fail('Mẫu chưa có câu hỏi. Điền nội dung và đáp án, tối thiểu 2 câu cho mỗi môn và dạng câu.');
  const weeks=new Set(filled.map(row=>row.week).filter(Boolean));if(weeks.size>1)fail('Một tệp chỉ chứa một tuần.');
  const title=required([...weeks][0]??(sourceTitle||context.title),'Tên tuần',90);
  const sourceCode=onlineSourceCode(title,context.sourceId),version=context.version??1;
  if(!Number.isSafeInteger(version)||version<1)fail('version: phiên bản phải là số nguyên dương.');
  const groups=new Map<string,{label:string;kind:OnlineDocumentKind;title:string;rows:Fields[]}>();
  for(const row of filled)atSource(row,()=>{
    const label=required(row.subjectLabel??context.subjectLabel,'subjectLabel',120);
    if(!ONLINE_DOCUMENT_KINDS.includes(row.kind as OnlineDocumentKind))fail('kind: chọn một trong 8 dạng được liệt kê trong mẫu.');
    const packKind=row.kind as OnlineDocumentKind,key=JSON.stringify([label,packKind]),packTitle=required(row.title??title,'title',90);
    let group=groups.get(key);if(!group){group={label,kind:packKind,title:packTitle,rows:[]};groups.set(key,group);}else if(group.title!==packTitle)fail('Các câu cùng môn và dạng cần cùng title.');
    group.rows.push(row);
  });
  if(groups.size>30)fail('Mỗi tuần tối đa 30 bộ môn và dạng câu.');
  return {title,sets:[...groups.values()].map(group=>({subjectLabel:group.label,pack:groupPack(group.rows,group.kind,
    context.packIds?.[JSON.stringify([group.label,group.kind])]??onlineGeneratedPackId(sourceCode,group.label,group.kind),version,group.title,context.grade,media)}))};
}

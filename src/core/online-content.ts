import type { ContentPack, ModuleId, PairItem, QuizItem, QuestionMetadata, QuestionTemplateInfo, SentenceItem } from './contracts.ts';
import { CONTENT_FORMAT_VERSION, CONTENT_SCHEMA, MAX_IMPORT_BYTES } from './content-io.ts';
import { gamePresentation } from './game-presentation.ts';
import { GAME_REGISTRY } from './registry.ts';
import { validatePack } from './validation.ts';
import {onlineGeneratedItemId} from './online-import-identity.ts';

export type OnlineQuestionKind = 'quiz' | 'pairs' | 'sentences';
export type OnlineQuestionContext = {id:string;version:number;title:string;grade:number};
export type OnlineWeekContext = {idPrefix:string;grade:number;title:string;subjectLabel?:string;sourceId?:string;version?:number;packIds?:Record<string,string>};
export type OnlineWeek = {title:string;sets:{subjectLabel:string;pack:ContentPack}[]};
type Row = Record<string, unknown>;
// The generic interchange format has no publication timestamp. Epoch means undated,
// and keeps this parser deterministic; publishing can assign a real timestamp later.
const UNDATED = '1970-01-01T00:00:00.000Z';
const record = (value:unknown):value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const normalize = (value:string) => value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
const own = (value:Row,key:string) => Object.prototype.hasOwnProperty.call(value,key);
function fail(message:string):never {throw new Error(message);}
function object(value:unknown,where:string):Row {return record(value)?value:fail(`${where}: cần một đối tượng.`);}
function keys(value:Row,allowed:string[],where:string) {
  const unknown=Object.keys(value).find(key=>!allowed.includes(key));
  if(unknown)fail(`${where}: trường không được hỗ trợ “${unknown}”.`);
}
function text(value:unknown,where:string,max:number):string {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(`${where}: cần văn bản không trống, tối đa ${max} ký tự.`);
  return value.trim();
}
function optional(value:Row,key:string,max:number,fallback:string):string {return own(value,key)?text(value[key],key,max):fallback;}
function integer(value:unknown,where:string,min:number,max:number):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)fail(`${where}: cần số nguyên từ ${min} đến ${max}.`);
  return value;
}
function kind(value:unknown):OnlineQuestionKind {
  if(value==='quiz'||value==='multiple-choice')return 'quiz';
  if(value==='pairs'||value==='pair')return 'pairs';
  if(value==='sentences'||value==='sentence'||value==='order')return 'sentences';
  return fail('Loại câu hỏi chưa được hỗ trợ. Chọn quiz, pairs hoặc sentences.');
}
function checked(pack:ContentPack):ContentPack {
  const errors=validatePack(pack);
  if(errors.length)fail(errors[0]);
  return pack;
}
function metadata(value:unknown):QuestionMetadata {
  const info=object(value,'metadata');
  keys(info,['knowledgeId','difficulty','contentRole','source','rights','reviewStatus','formId','topicId','level'],'metadata');
  const result={knowledgeId:text(info.knowledgeId,'knowledgeId',120),difficulty:text(info.difficulty,'difficulty',10),
    contentRole:text(info.contentRole,'contentRole',20),source:text(info.source,'source',1000),rights:text(info.rights,'rights',1000),
    reviewStatus:text(info.reviewStatus,'reviewStatus',10),...(own(info,'formId')?{formId:text(info.formId,'formId',120)}:{}),
    ...(own(info,'topicId')?{topicId:text(info.topicId,'topicId',120)}:{}),...(own(info,'level')?{level:text(info.level,'level',120)}:{})};
  if(!['easy','medium','hard'].includes(result.difficulty)||!['unassigned','practice','assessment','review'].includes(result.contentRole)||!['draft','reviewed'].includes(result.reviewStatus))fail('metadata: giá trị không hợp lệ.');
  return result as QuestionMetadata;
}
function templateInfo(value:unknown):QuestionTemplateInfo {
  const info=object(value,'templateInfo');keys(info,['schema','templateVersion','contentFormatVersion','topicId','source','rights','reviewStatus'],'templateInfo');
  if(info.schema!=='baoan-question-template'||info.templateVersion!==1||info.contentFormatVersion!==2||!['draft','reviewed'].includes(info.reviewStatus as string))fail('templateInfo: phiên bản hoặc trạng thái không hợp lệ.');
  return {schema:'baoan-question-template',templateVersion:1,contentFormatVersion:2,topicId:text(info.topicId,'topicId',120),
    source:text(info.source,'source',1000),rights:text(info.rights,'rights',1000),reviewStatus:info.reviewStatus as 'draft'|'reviewed'};
}
function stringArray(value:unknown,where:string,min:number,max:number,characters:number):string[] {
  if(!Array.isArray(value)||value.length<min||value.length>max)fail(`${where}: cần từ ${min} đến ${max} phần tử.`);
  return value.map((entry,index)=>text(entry,`${where} ${index+1}`,characters));
}
function item(value:unknown,packKind:OnlineQuestionKind,index:number):QuizItem|PairItem|SentenceItem {
  const row=object(value,`Mục ${index+1}`),baseFields=['id','itemId','objectiveId','kind','metadata'];
  if(own(row,'kind')&&kind(row.kind)!==packKind)fail(`Mục ${index+1}: tệp chứa nhiều loại câu hỏi.`);
  if(own(row,'id')&&own(row,'itemId')&&row.id!==row.itemId)fail(`Mục ${index+1}: hai mã câu hỏi khác nhau.`);
  const idValue=own(row,'id')?row.id:row.itemId;
  const base={id:idValue===undefined?'':text(idValue,'id',80),objectiveId:optional(row,'objectiveId',120,'CUSTOM.QUESTION'),
    ...(own(row,'metadata')?{metadata:metadata(row.metadata)}:{})};
  let result:QuizItem|PairItem|SentenceItem;
  if(packKind==='quiz') {
    keys(row,[...baseFields,'prompt','options','A','B','C','D','optionA','optionB','optionC','optionD','correctIndex','answer','explanation'],'Câu trắc nghiệm');
    const fromColumns=['A','B','C','D'].map(letter=>{
      if(own(row,letter)&&own(row,`option${letter}`)&&row[letter]!==row[`option${letter}`])fail(`Phương án ${letter}: dữ liệu mâu thuẫn.`);
      return own(row,letter)?row[letter]:row[`option${letter}`];
    });
    const hasColumns=fromColumns.some(value=>value!==undefined);
    const options=stringArray(own(row,'options')?row.options:fromColumns,'options',4,4,120) as QuizItem['options'];
    if(own(row,'options')&&hasColumns&&fromColumns.some((value,i)=>typeof value!=='string'||value.trim()!==options[i]))fail('Hai bộ phương án không khớp.');
    if(new Set(options.map(normalize)).size!==4)fail('Các phương án trả lời phải khác nhau.');
    const byIndex=own(row,'correctIndex')?integer(row.correctIndex,'correctIndex',0,3):undefined;
    let byLetter:number|undefined;
    if(own(row,'answer')) {const answer=text(row.answer,'answer',1).toUpperCase();if(!/^[A-D]$/.test(answer))fail('answer: đáp án trắc nghiệm phải là A, B, C hoặc D.');byLetter=answer.charCodeAt(0)-65;}
    if(byIndex===undefined&&byLetter===undefined)fail('Thiếu đáp án đúng: cần correctIndex (0–3) hoặc answer (A–D).');
    if(byIndex!==undefined&&byLetter!==undefined&&byIndex!==byLetter)fail('correctIndex và answer mâu thuẫn.');
    const correctIndex=(byIndex??byLetter) as QuizItem['correctIndex'];
    result={...base,kind:'multiple-choice',prompt:text(row.prompt,'prompt',320),options,correctIndex,
      explanation:optional(row,'explanation',500,`Đáp án: ${options[correctIndex]}`)};
  } else if(packKind==='pairs') {
    keys(row,[...baseFields,'left','right','question','answer'],'Cặp câu hỏi');
    if(own(row,'left')&&own(row,'question')&&row.left!==row.question||own(row,'right')&&own(row,'answer')&&row.right!==row.answer)fail('Cặp câu hỏi có hai đáp án hoặc yêu cầu mâu thuẫn.');
    result={...base,kind:'pair',left:text(own(row,'left')?row.left:row.question,'left/question',120),right:text(own(row,'right')?row.right:row.answer,'right/answer',120)};
  } else {
    keys(row,[...baseFields,'prompt','words','correctOrder','answer','hint'],'Câu sắp xếp');
    const arrays=['words','correctOrder'].filter(key=>own(row,key)).map(key=>stringArray(row[key],key,3,15,45));
    const answer=own(row,'answer')?text(row.answer,'answer',689).split(/\s+/):undefined;
    const words=arrays[0]??answer;
    if(!words)fail('Thiếu thứ tự đúng: cần words, correctOrder hoặc answer.');
    if([...arrays.slice(1),...(answer?[answer]:[])].some(value=>JSON.stringify(value)!==JSON.stringify(words)))fail('Các thứ tự đáp án không khớp.');
    if(words.length<3||words.length>15||words.some(word=>word.length>45||/\s/.test(word)))fail('Câu sắp xếp cần 3–15 từ, mỗi từ tối đa 45 ký tự và không chứa khoảng trắng.');
    result={...base,kind:'sentence',prompt:text(row.prompt,'prompt',320),words,hint:optional(row,'hint',160,'Sắp xếp các thẻ theo đúng thứ tự đáp án.')};
  }
  if(!result.id)result.id=onlineGeneratedItemId(result);
  return result;
}
function makePack(value:unknown,context:OnlineQuestionContext):ContentPack {
  const source=object(value,'Bộ câu hỏi');keys(source,['kind','items'],'Bộ câu hỏi');
  const packKind=kind(source.kind);
  if(!Array.isArray(source.items)||source.items.length<2||source.items.length>30)fail('Mỗi bộ cần từ 2–30 câu hỏi; không tự chia hoặc cắt bớt tệp.');
  const base={id:text(context.id,'id',80),version:integer(context.version,'version',1,Number.MAX_SAFE_INTEGER),title:text(context.title,'title',90),
    grade:integer(context.grade,'grade',1,12),subject:'thinking' as const,source:'local' as const,publishedAt:UNDATED};
  const items=source.items.map((entry,index)=>item(entry,packKind,index));
  return checked({...base,kind:packKind,items} as ContentPack);
}
function envelope(value:Row):ContentPack {
  keys(value,['schema','formatVersion','exportedAt','packs'],'Tệp học liệu');
  if(value.schema!==CONTENT_SCHEMA||![1,CONTENT_FORMAT_VERSION].includes(value.formatVersion as number))fail('Phiên bản tệp học liệu chưa được hỗ trợ.');
  if(own(value,'exportedAt'))text(value.exportedAt,'exportedAt',80);
  if(!Array.isArray(value.packs)||value.packs.length!==1)fail('Mỗi lần nhập chỉ nhận một bộ; dùng định dạng tuần để nhận nhiều bộ.');
  const source=object(value.packs[0],'Bộ học liệu');
  keys(source,['id','version','title','subject','grade','source','publishedAt','templateInfo','kind','items'],'Bộ học liệu');
  const packKind=kind(source.kind);
  if(!['math','vietnamese','english','thinking'].includes(source.subject as string)||!['local','builtin'].includes(source.source as string))fail('Thông tin tương thích của bộ học liệu không hợp lệ.');
  if(!Array.isArray(source.items))fail('Bộ học liệu thiếu items.');
  for(const [index,value] of source.items.entries()) {
    const row=object(value,`Mục ${index+1}`),specific=packKind==='quiz'?['prompt','options','correctIndex','explanation']
      :packKind==='pairs'?['left','right']:['prompt','words','hint'];
    keys(row,['id','objectiveId','kind','metadata',...specific],`Mục ${index+1}`);
    if(row.kind!==(packKind==='quiz'?'multiple-choice':packKind==='pairs'?'pair':'sentence')
      ||['id','objectiveId',...specific].some(key=>!own(row,key)))fail(`Mục ${index+1}: thiếu trường học liệu bắt buộc.`);
  }
  const pack=makePack({kind:packKind,items:source.items},{id:text(source.id,'id',80),version:integer(source.version,'version',1,Number.MAX_SAFE_INTEGER),
    title:text(source.title,'title',90),grade:integer(source.grade,'grade',1,12)});
  const publishedAt=text(source.publishedAt,'publishedAt',80);
  if(!Number.isFinite(Date.parse(publishedAt)))fail('publishedAt không hợp lệ.');
  if(own(source,'templateInfo'))templateInfo(source.templateInfo);
  // Keep every validated source field verbatim, including source item identifiers.
  // The only source field changed on import is its local ownership marker.
  return checked({...pack,...source,source:'local'} as ContentPack);
}
function rawInput(input:string,fileName:string):{raw:string;extension:string} {
  if(typeof input!=='string'||typeof fileName!=='string')fail('Dữ liệu tệp không hợp lệ.');
  if(new TextEncoder().encode(input).byteLength>MAX_IMPORT_BYTES)fail('Tệp vượt quá giới hạn 1 MB.');
  const extension=fileName.toLowerCase().split('.').pop()??'';
  if(!['json','csv','tsv'].includes(extension))fail('Chỉ nhận tệp JSON, CSV hoặc TSV.');
  const raw=input.replace(/^\uFEFF/,'');if(!raw.trim())fail('Tệp câu hỏi đang trống.');
  return {raw,extension};
}
function json(raw:string):Row {
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{fail('Tệp JSON không đọc được.');}
  // JSON.parse silently keeps the last duplicate key. Reject that ambiguity,
  // including escaped spellings of answer/id keys, before interpreting the data.
  let position=0;
  const spaces=()=>{while(/\s/.test(raw[position]??'')&&position<raw.length)position++;};
  const quoted=()=>{const start=position++;while(position<raw.length){if(raw[position]==='\\'){position+=2;continue;}if(raw[position++]==='"')break;}return JSON.parse(raw.slice(start,position)) as string;};
  const visit=(depth:number):void=>{
    if(depth>40)fail('JSON lồng quá nhiều cấp.');spaces();const character=raw[position];
    if(character==='"'){quoted();return;}
    if(character==='{') {
      position++;spaces();const names=new Set<string>();if(raw[position]==='}'){position++;return;}
      while(position<raw.length){spaces();const name=quoted();if(names.has(name))fail(`JSON có trường trùng “${name}”.`);names.add(name);
        spaces();position++;visit(depth+1);spaces();if(raw[position++]==='}')return;}
    } else if(character==='[') {
      position++;spaces();if(raw[position]===']'){position++;return;}
      while(position<raw.length){visit(depth+1);spaces();if(raw[position++]===']')return;}
    } else {while(position<raw.length&&!/[\s,}\]]/.test(raw[position]))position++;}
  };
  visit(0);return object(parsed,'Tệp JSON');
}

/** Strict CSV quoting: a quote can only open at the beginning of a cell. */
function csvRows(raw:string,extension:string):string[][] {
  const first=raw.split(/\r?\n/,1)[0],delimiter=extension==='tsv'?'\t':first.includes('\t')?'\t':first.includes(';')&&!first.includes(',')?';':',';
  const rows:string[][]=[];let row:string[]=[],cell='',state:'start'|'plain'|'quoted'|'closed'='start';
  const pushCell=()=>{if(cell.length>4000)fail('Mỗi ô tối đa 4000 ký tự.');row.push(cell);if(row.length>32)fail('Tệp có quá 32 cột.');cell='';state='start';};
  const pushRow=()=>{if(row.some(value=>value.trim()))rows.push(row);if(rows.length>901)fail('Tệp có quá 900 câu hỏi.');row=[];};
  for(let i=0;i<raw.length;i++) {
    const character=raw[i];
    if(state==='quoted') {if(character==='"'){if(raw[i+1]==='"'){cell+='"';i++;}else state='closed';}else cell+=character;continue;}
    if(character===delimiter){pushCell();continue;}
    if(character==='\r'||character==='\n'){if(character==='\r'&&raw[i+1]==='\n')i++;pushCell();pushRow();continue;}
    if(character==='"'){if(state!=='start')fail('CSV có dấu ngoặc kép sai vị trí.');state='quoted';continue;}
    if(state==='closed'){if(!/\s/.test(character))fail('CSV có ký tự thừa sau dấu ngoặc kép.');continue;}
    cell+=character;state='plain';
  }
  if(state==='quoted')fail('CSV có ô chưa đóng dấu ngoặc kép.');
  if(cell||row.length||state==='closed'){pushCell();pushRow();}
  return rows;
}
const columns:Record<string,string>={kind:'kind',type:'kind',id:'id',itemid:'id',objectiveid:'objectiveId',prompt:'prompt',options:'options',
  a:'A',b:'B',c:'C',d:'D',optiona:'A',optionb:'B',optionc:'C',optiond:'D',correctindex:'correctIndex',answer:'answer',explanation:'explanation',
  left:'left',right:'right',question:'question',words:'words',correctorder:'correctOrder',hint:'hint',subject:'subjectLabel',subjectlabel:'subjectLabel'};
function table(raw:string,extension:string):{kind:OnlineQuestionKind;subjectLabel?:string;row:Row}[] {
  const rows=csvRows(raw,extension);if(rows.length<2)fail('Tệp cần hàng tiêu đề và ít nhất 2 câu hỏi.');
  const headers=rows[0].map(header=>columns[header.trim().toLowerCase()]);
  if(headers.some(header=>!header)||new Set(headers).size!==headers.length)fail('CSV có cột không được hỗ trợ hoặc tiêu đề cột trùng nhau.');
  return rows.slice(1).map((cells,index)=>{
    if(cells.length!==headers.length)fail(`Hàng ${index+2}: số ô không khớp hàng tiêu đề.`);
    const row:Row={};cells.forEach((cell,i)=>{if(cell.trim())row[headers[i]]=cell.trim();});
    let label:string|undefined;
    if(own(row,'subjectLabel')){label=text(row.subjectLabel,'subjectLabel',120);delete row.subjectLabel;}
    for(const key of ['options','words','correctOrder'])if(own(row,key)){try{row[key]=JSON.parse(row[key] as string);}catch{fail(`Hàng ${index+2}: ${key} cần mảng JSON.`);}}
    if(own(row,'correctIndex')){if(!/^[0-3]$/.test(row.correctIndex as string))fail(`Hàng ${index+2}: correctIndex phải từ 0–3.`);row.correctIndex=Number(row.correctIndex);}
    const inferred=own(row,'options')||['A','B','C','D'].some(key=>own(row,key))||own(row,'correctIndex')?'quiz'
      :['left','right','question'].some(key=>own(row,key))?'pairs':'sentences';
    return {kind:own(row,'kind')?kind(row.kind):inferred,subjectLabel:label,row};
  });
}

/** Data-only import boundary. Subject and curriculum are never inferred from text. */
export function parseOnlineQuestions(input:string,fileName:string,context:OnlineQuestionContext):ContentPack {
  const {raw,extension}=rawInput(input,fileName);
  if(extension==='json'){const source=json(raw);return own(source,'schema')?envelope(source):makePack(source,context);}
  const rows=table(raw,extension),kinds=new Set(rows.map(entry=>entry.kind)),labels=new Set(rows.map(entry=>entry.subjectLabel??''));
  if(kinds.size!==1||labels.size!==1)fail('Tệp chứa nhiều bộ hoặc loại câu hỏi; hãy nhập bằng chức năng bộ tuần.');
  return makePack({kind:rows[0].kind,items:rows.map(entry=>entry.row)},context);
}

/** Only games whose concrete presentation passes the engine validator are offered. */
export function onlineGameChoices(pack:ContentPack):{id:ModuleId;label:string}[] {
  if(validatePack(pack).length)return [];
  return GAME_REGISTRY.filter(game=>{const presented=gamePresentation(game.id,pack);return presented&&validatePack(presented).length===0;})
    .map(({id,label})=>({id,label}));
}

/** Empty CSV headers only: the author supplies every question and answer. */
export function onlineQuestionTemplate(packKind:OnlineQuestionKind):string {
  const selected=kind(packKind);
  return '\uFEFF'+(selected==='quiz'?'prompt,A,B,C,D,answer':selected==='pairs'?'left,right':'prompt,answer')+'\r\n';
}

export function parseOnlineWeek(input:string,fileName:string,context:OnlineWeekContext):OnlineWeek {
  const {raw,extension}=rawInput(input,fileName),title=text(context.title,'title',90),prefix=text(context.idPrefix,'idPrefix',77);
  if(!/^[a-z0-9-]{3,77}$/.test(prefix))fail('idPrefix chỉ được dùng chữ thường, số và dấu gạch nối.');
  integer(context.grade,'grade',1,12);
  const fallback=context.subjectLabel===undefined?'Nội dung tự biên soạn':text(context.subjectLabel,'subjectLabel',120);
  if(extension==='json') {
    const source=json(raw);
    if(source.schema==='baoan-online-week') {
      keys(source,['schema','formatVersion','title','sets'],'Bộ tuần');if(source.formatVersion!==1)fail('Bộ tuần chỉ hỗ trợ formatVersion 1.');
      const weekTitle=text(source.title,'title',90);
      if(!Array.isArray(source.sets)||source.sets.length<1||source.sets.length>30)fail('Mỗi tuần cần từ 1–30 bộ câu hỏi.');
      return {title:weekTitle,sets:source.sets.map((value,index)=>{
        const set=object(value,`Bộ ${index+1}`);keys(set,['title','subjectLabel','kind','items'],`Bộ ${index+1}`);
        return {subjectLabel:text(set.subjectLabel,'subjectLabel',120),pack:makePack({kind:set.kind,items:set.items},{id:`${prefix}-${index+1}`,version:1,
          title:text(set.title,'title',90),grade:context.grade})};
      })};
    }
    return {title,sets:[{subjectLabel:fallback,pack:parseOnlineQuestions(input,fileName,{id:`${prefix}-1`,version:1,title,grade:context.grade})}]};
  }
  const groups=new Map<string,{subjectLabel:string;kind:OnlineQuestionKind;items:Row[]}>();
  for(const entry of table(raw,extension)) {
    const subjectLabel=entry.subjectLabel??fallback,key=JSON.stringify([subjectLabel,entry.kind]);
    let group=groups.get(key);if(!group){group={subjectLabel,kind:entry.kind,items:[]};groups.set(key,group);}
    group.items.push(entry.row);
  }
  if(groups.size>30)fail('Mỗi tuần tối đa 30 bộ câu hỏi.');
  return {title,sets:[...groups.values()].map((group,index)=>({subjectLabel:group.subjectLabel,
    pack:makePack({kind:group.kind,items:group.items},{id:`${prefix}-${index+1}`,version:1,title,grade:context.grade})}))};
}

/** A blank schema, with no example curriculum or generated questions. */
export function onlineWeekTemplate():string {
  return JSON.stringify({schema:'baoan-online-week',formatVersion:1,title:'',sets:[{title:'',subjectLabel:'',kind:'quiz',items:[]}]},null,2)+'\n';
}

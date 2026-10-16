/**
 * Bảo An Learning - Tiện ích nạp câu hỏi từ Excel (XLSX, CSV, TSV và Clipboard)
 * Cho phép giáo viên và phụ huynh soạn sẵn câu hỏi trong Microsoft Excel hoặc Google Sheets
 * rồi nhập hàng loạt vào Xưởng học liệu mà không cần gõ từng dòng.
 */
import { Unzip, UnzipInflate, unzipSync } from 'fflate';

export const EXCEL_IMPORT_LIMITS = {
  fileBytes: 1024 * 1024, expandedBytes: 8 * 1024 * 1024, xmlBytes: 2 * 1024 * 1024,
  entries: 128, rows: 1000, columns: 32, cellCharacters: 4000,
} as const;

export type Kind = 'quiz' | 'pairs' | 'sentences';

export interface ImportedQuizRow {
  key: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface ImportedPairRow {
  key: string;
  left: string;
  right: string;
}

export interface ImportedSentenceRow {
  key: string;
  prompt: string;
  answer: string;
  hint: string;
}

export interface ImportResult {
  kind: Kind;
  count: number;
  quizzes?: ImportedQuizRow[];
  pairs?: ImportedPairRow[];
  sentences?: ImportedSentenceRow[];
  warnings: string[];
}

/** Tách chuỗi văn bản CSV/TSV thành các hàng và cột (hỗ trợ ngoặc kép, tab, dấu phẩy, chấm phẩy) */
export function parseDelimitedTextWithRows(text: string): {rows:string[][];rowNumbers:number[]} {
  if (new TextEncoder().encode(text).byteLength > EXCEL_IMPORT_LIMITS.fileBytes) throw new Error('Tệp vượt quá giới hạn 1 MB.');
  // Loại bỏ BOM nếu có
  const cleanText = text.replace(/^\uFEFF/, '');
  if (!cleanText.trim()) return {rows:[],rowNumbers:[]};

  // Xác định dấu phân cách ưu tiên: tab (\t) nếu có nhiều tab, ngược lại dùng dấu phẩy hoặc chấm phẩy
  const firstLine = cleanText.split(/\r?\n/)[0] ?? '';
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }

  const rows: string[][] = [];
  const rowNumbers:number[]=[];let physicalLine=1;let rowStart=1;
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  const pushCell = () => {
    if (currentCell.length > EXCEL_IMPORT_LIMITS.cellCharacters) throw new Error('Mỗi ô tối đa 4000 ký tự.');
    currentRow.push(currentCell.trim());
    if (currentRow.length > EXCEL_IMPORT_LIMITS.columns) throw new Error('Bảng tính vượt giới hạn 32 cột.');
    currentCell = '';
  };
  const pushRow = () => {
    if (currentRow.some(cell => cell.length > 0)){rows.push(currentRow);rowNumbers.push(rowStart);}
    if (rows.length > EXCEL_IMPORT_LIMITS.rows) throw new Error('Bảng tính vượt giới hạn 1000 hàng.');
    currentRow = [];
  };

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Bỏ qua ký tự thoát
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      pushCell();
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      pushCell();pushRow();physicalLine++;rowStart=physicalLine;
    } else {
      currentCell += char;
      if(char==='\n'||(char==='\r'&&nextChar!=='\n'))physicalLine++;
    }
  }

  if (inQuotes) throw new Error('Ô có dấu ngoặc kép chưa được đóng.');
  if (currentCell.length > 0 || currentRow.length > 0) {pushCell();pushRow();}

  return {rows,rowNumbers};
}

export function parseDelimitedText(text:string):string[][]{return parseDelimitedTextWithRows(text).rows;}

/** Chuyển mã cột Excel kiểu A, B, ..., Z, AA thành chỉ số 0-indexed */
function colLettersToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** Check ZIP metadata before inflation; measure streamed output as well so forged sizes cannot bypass limits. */
function readWorkbookXml(bytes: Uint8Array): Map<string,string> {
  if (bytes.byteLength > EXCEL_IMPORT_LIMITS.fileBytes) throw new Error('Tệp vượt quá giới hạn 1 MB.');
  if (bytes.byteLength < 22) throw new Error('Tệp XLSX không phải ZIP hợp lệ.');
  const entries = new Map<string, number>();
  let declaredBytes = 0;
  unzipSync(bytes, {filter: file => {
    if (entries.has(file.name)) throw new Error('Tệp XLSX có mục ZIP trùng tên.');
    entries.set(file.name, file.originalSize);
    if (entries.size > EXCEL_IMPORT_LIMITS.entries) throw new Error('Tệp XLSX vượt giới hạn 128 mục ZIP.');
    declaredBytes += file.originalSize;
    if (!Number.isSafeInteger(file.originalSize) || file.originalSize < 0 || declaredBytes > EXCEL_IMPORT_LIMITS.expandedBytes) {
      throw new Error('Tệp XLSX vượt giới hạn giải nén 8 MB.');
    }
    if (file.name.endsWith('.xml') && file.originalSize > EXCEL_IMPORT_LIMITS.xmlBytes) throw new Error('XML trong XLSX vượt giới hạn 2 MB.');
    return false;
  }});
  const needed = new Set([...entries.keys()].filter(name=>name==='xl/workbook.xml'||name==='xl/_rels/workbook.xml.rels'||name==='xl/sharedStrings.xml'||/^xl\/worksheets\/[a-zA-Z0-9._-]+\.xml$/.test(name)));
  if (![...needed].some(name=>name.startsWith('xl/worksheets/'))) throw new Error('Tệp XLSX không có trang câu hỏi.');
  const decoded = new Map<string,string>();
  const seen = new Set<string>();
  let expandedBytes = 0;
  const unzip = new Unzip(file => {
    if (!entries.has(file.name) || seen.has(file.name)) throw new Error('Danh sách mục ZIP không khớp hoặc trùng tên.');
    seen.add(file.name);
    if (seen.size > EXCEL_IMPORT_LIMITS.entries) throw new Error('Tệp XLSX vượt giới hạn 128 mục ZIP.');
    if (!needed.has(file.name)) return;
    const chunks: Uint8Array[] = [];
    let length = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      length += chunk.byteLength;expandedBytes += chunk.byteLength;
      if (length > EXCEL_IMPORT_LIMITS.xmlBytes || expandedBytes > EXCEL_IMPORT_LIMITS.expandedBytes) {
        throw new Error('Tệp XLSX vượt giới hạn XML 2 MB hoặc giải nén 8 MB.');
      }
      chunks.push(chunk);
      if (final) {
        if (length !== entries.get(file.name)) throw new Error('Kích thước giải nén XLSX không khớp.');
        const output = new Uint8Array(length);let offset = 0;
        for (const part of chunks) {output.set(part,offset);offset += part.byteLength;}
        const xml = new TextDecoder('utf-8',{fatal:true}).decode(output);
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML có khai báo thực thể không được hỗ trợ.');
        // OOXML producers may use x:sheet/x:row or default namespaces. Attributes such as r:id keep their prefix.
        decoded.set(file.name,xml.replace(/(<\/?)(?:[A-Za-z_][\w.-]*:)/g,'$1'));
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small compressed chunks bound a decompression burst before the ondata limit check.
  for (let offset=0;offset<bytes.length;offset+=1024) unzip.push(bytes.subarray(offset,offset+1024),offset+1024>=bytes.length);
  if (seen.size !== entries.size || [...needed].some(name=>!decoded.has(name))) throw new Error('Tệp XLSX thiếu hoặc có mục ZIP không khớp.');
  return decoded;
}

function decodeXml(text: string): string {
  const named: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_entity, code:string) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()];
    const value = code[1].toLowerCase()==='x' ? parseInt(code.slice(2),16) : parseInt(code.slice(1),10);
    if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) || value === 0) throw new Error('Thực thể Unicode XML không hợp lệ.');
    return String.fromCodePoint(value);
  });
}
function xmlTextRuns(xml:string):string {
  const text = [...xml.matchAll(/<t\b[^>]*?(?:\/>|>(.*?)<\/t>)/gs)].map(match=>decodeXml(match[1]??'')).join('');
  if (text.length > EXCEL_IMPORT_LIMITS.cellCharacters) throw new Error('Mỗi ô tối đa 4000 ký tự.');
  return text;
}
function attribute(attrs:string,name:string):string|undefined {
  return new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`,'s').exec(attrs)?.[2];
}

function sharedWorkbookStrings(xml:Map<string,string>):string[]{
  const sharedStrings = [...(xml.get('xl/sharedStrings.xml')??'').matchAll(/<si\b[^>]*?(?:\/>|>(.*?)<\/si>)/gs)].map(match=>xmlTextRuns(match[1]??''));
  if (sharedStrings.length > EXCEL_IMPORT_LIMITS.rows * EXCEL_IMPORT_LIMITS.columns) throw new Error('Bảng chuỗi XLSX vượt giới hạn.');
  return sharedStrings;
}
function parseWorksheetXml(sheet:string,sharedStrings:string[]):{rows:string[][];rowNumbers:number[]}{
  const rows:string[][]=[];
  const rowNumbers:number[]=[];const seenRows=new Set<number>();
  let rowCount=0;
  for (const row of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>(.*?)<\/row>)/gs)) {
    rowCount++;
    const rowAddress=Number(attribute(row[1],'r')??rowCount);
    if (rowCount>EXCEL_IMPORT_LIMITS.rows || !Number.isInteger(rowAddress) || rowAddress<1 || rowAddress>EXCEL_IMPORT_LIMITS.rows) throw new Error('Bảng tính vượt giới hạn 1000 hàng.');
    if(seenRows.has(rowAddress))throw new Error('Tệp XLSX có hàng trùng địa chỉ.');seenRows.add(rowAddress);
    const values = new Map<number,string>();let maxCol=-1;let cellCount=0;
    for (const cell of (row[2]??'').matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      cellCount++;
      const address=/^([A-Z]+)(\d+)$/.exec(attribute(cell[1],'r')??'');
      if (!address) throw new Error('Địa chỉ ô XLSX không hợp lệ.');
      const column=colLettersToIndex(address[1]);
      if (column>=EXCEL_IMPORT_LIMITS.columns || cellCount>EXCEL_IMPORT_LIMITS.columns) throw new Error('Bảng tính vượt giới hạn 32 cột.');
      if (Number(address[2])!==rowAddress) throw new Error('Địa chỉ ô không khớp hàng XLSX.');
      if (values.has(column)) throw new Error('Tệp XLSX có ô trùng địa chỉ.');
      const body=cell[2]??'';const type=attribute(cell[1],'t');
      if(/<f\b/.test(body))throw new Error(`Ô ${address[0]}: công thức Excel không được nhập; hãy dán giá trị.`);
      const value=/<v\b[^>]*>(.*?)<\/v>/s.exec(body)?.[1]??'';
      let text='';
      if (type==='s' && body) {
        const index=Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(index) || index>=sharedStrings.length) throw new Error('Ô XLSX tham chiếu chuỗi không tồn tại.');
        text=sharedStrings[index];
      } else text=type==='inlineStr' ? xmlTextRuns(body) : decodeXml(value);
      if (text.length>EXCEL_IMPORT_LIMITS.cellCharacters) throw new Error('Mỗi ô tối đa 4000 ký tự.');
      values.set(column,text.trim());maxCol=Math.max(maxCol,column);
    }
    const cells=Array.from({length:maxCol+1},(_,column)=>values.get(column)??'');
    if(cells.some(Boolean)){rows.push(cells);rowNumbers.push(rowAddress);}
  }
  return {rows,rowNumbers};
}

/** Legacy spreadsheets may omit workbook.xml; their first sheet remains readable. */
export function parseXlsxBytes(bytes: Uint8Array): string[][] {
  const xml=readWorkbookXml(bytes),shared=sharedWorkbookStrings(xml);
  const path=xml.has('xl/worksheets/sheet1.xml')?'xl/worksheets/sheet1.xml':[...xml.keys()].find(name=>name.startsWith('xl/worksheets/'))!;
  return parseWorksheetXml(xml.get(path)!,shared).rows;
}

export interface QuestionWorkbook {sheets:Record<string,string[][]>;rowNumbers:Record<string,number[]>}
/** New question templates resolve named sheets through workbook relationships, never by sheet number. */
export function parseQuestionWorkbookBytes(bytes:Uint8Array):QuestionWorkbook{
  const xml=readWorkbookXml(bytes),workbook=xml.get('xl/workbook.xml'),relationships=xml.get('xl/_rels/workbook.xml.rels');
  if(!workbook||!relationships)throw new Error('Mẫu XLSX thiếu workbook hoặc quan hệ các sheet.');
  const refs=new Map<string,string>();
  for(const match of relationships.matchAll(/<Relationship\b([^>]*?)(?:\/>|>.*?<\/Relationship>)/gs)){
    const id=attribute(match[1],'Id'),target=attribute(match[1],'Target'),mode=attribute(match[1],'TargetMode'),type=attribute(match[1],'Type');
    if(!id||!target||refs.has(id))throw new Error('Quan hệ XLSX thiếu hoặc trùng mã.');
    if(mode==='External'||!type?.endsWith('/worksheet'))continue;
    const path=target.startsWith('/xl/')?target.slice(1):`xl/${target}`;
    if(!/^xl\/worksheets\/[a-zA-Z0-9._-]+\.xml$/.test(path))throw new Error('Đường dẫn sheet XLSX không hợp lệ.');
    refs.set(id,path);
  }
  const sheets:Record<string,string[][]>=Object.create(null),rowNumbers:Record<string,number[]>=Object.create(null),shared=sharedWorkbookStrings(xml);
  for(const match of workbook.matchAll(/<sheet\b([^>]*?)(?:\/>|>.*?<\/sheet>)/gs)){
    const name=decodeXml(attribute(match[1],'name')??''),id=attribute(match[1],'r:id');
    if(!name||Object.hasOwn(sheets,name)||!id||!refs.has(id))throw new Error('Tên hoặc quan hệ sheet XLSX không hợp lệ.');
    const sheet=xml.get(refs.get(id)!);if(!sheet)throw new Error(`Không tìm thấy nội dung sheet “${name}”.`);
    const parsed=parseWorksheetXml(sheet,shared);sheets[name]=parsed.rows;rowNumbers[name]=parsed.rowNumbers;
  }
  for(const name of ['Thông tin bộ','Câu hỏi'])if(!Object.hasOwn(sheets,name))throw new Error(`Mẫu XLSX thiếu sheet “${name}”.`);
  return {sheets,rowNumbers};
}

/** Kiểm tra xem hàng đầu tiên có phải là hàng tiêu đề (header) không */
function isHeaderRow(row: string[], kind: Kind): boolean {
  if (!row.length) return false;
  const first = (row[0] ?? '').toLowerCase();
  const joined = row.join(' ').toLowerCase();

  if (first.includes('câu hỏi') || first.includes('prompt') || first.includes('đề bài') || first.includes('stt')) {
    return true;
  }
  if (kind === 'pairs' && (joined.includes('mặt trái') || joined.includes('từ vựng') || joined.includes('vế 1'))) {
    return true;
  }
  if (kind === 'sentences' && (joined.includes('câu mẫu') || joined.includes('yêu cầu') || joined.includes('dãy số'))) {
    return true;
  }
  if (kind === 'quiz' && (joined.includes('đáp án') || joined.includes('phương án') || joined.includes('giải thích'))) {
    return true;
  }
  return false;
}

/** Chuyển ma trận chuỗi thành các đối tượng câu hỏi theo từng loại trò chơi */
export function importRowsToQuestions(rows: string[][], kind: Kind): ImportResult {
  const warnings: string[] = [];
  if (!rows.length) {
    return { kind, count: 0, warnings: ['Tệp hoặc nội dung trống, không tìm thấy hàng dữ liệu nào.'] };
  }

  // Bỏ qua dòng tiêu đề nếu có
  let dataRows = rows;
  const firstDataLine = isHeaderRow(rows[0], kind) ? 2 : 1;
  if (isHeaderRow(rows[0], kind)) {
    dataRows = rows.slice(1);
  }

  if (kind === 'quiz') {
    const quizzes: ImportedQuizRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      if (!r || r.every(c => !c.trim())) continue;

      const prompt = (r[0] ?? '').trim();
      if (!prompt) {
        warnings.push(`Dòng ${i + firstDataLine}: Thiếu nội dung câu hỏi, đã bỏ qua.`);
        continue;
      }

      const optA = (r[1] ?? '').trim();
      const optB = (r[2] ?? '').trim();
      const optC = (r[3] ?? '').trim();
      const optD = (r[4] ?? '').trim();

      if (!optA || !optB || !optC || !optD) {
        warnings.push(`Dòng ${i + firstDataLine}: Cần đủ 4 phương án A–D không trống, đã bỏ qua.`);
        continue;
      }

      const options: [string, string, string, string] = [optA, optB, optC, optD];
      const normalize = (text:string) => text.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
      if (new Set(options.map(normalize)).size !== 4) {
        warnings.push(`Dòng ${i + firstDataLine}: Có phương án trùng, đáp án không duy nhất; đã bỏ qua.`);
        continue;
      }

      // Nhận diện đáp án đúng: A, B, C, D hoặc 1, 2, 3, 4 hoặc trùng với nội dung
      const ansRaw = (r[5] ?? '').trim();
      const answerCodes: Record<string,number> = {A:0,B:1,C:2,D:3,'1':0,'2':1,'3':2,'4':3};
      const index = answerCodes[ansRaw.toUpperCase()] ?? options.findIndex(opt=>normalize(opt)===normalize(ansRaw));
      if (!ansRaw || index < 0) {
        warnings.push(`Dòng ${i + firstDataLine}: Đáp án trống hoặc không khớp A–D, 1–4 hay nội dung phương án; đã bỏ qua.`);
        continue;
      }
      const correctIndex = index as 0 | 1 | 2 | 3;

      const explanation = (r[6] ?? '').trim();
      if (prompt.length>320 || options.some(option=>option.length>120) || !explanation || explanation.length>500) {
        warnings.push(`Dòng ${i + firstDataLine}: Đề/phương án quá dài hoặc lời giải thiếu/quá dài; đã bỏ qua.`);
        continue;
      }

      quizzes.push({
        key: crypto.randomUUID(),
        prompt,
        options,
        correctIndex,
        explanation
      });
    }

    return { kind: 'quiz', count: quizzes.length, quizzes, warnings };
  }

  if (kind === 'pairs') {
    const pairs: ImportedPairRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      if (!r || r.every(c => !c.trim())) continue;

      const left = (r[0] ?? '').trim();
      const right = (r[1] ?? '').trim();

      if (!left || !right) {
        warnings.push(`Dòng ${i + firstDataLine}: Cần có cả 2 mặt trái và phải, đã bỏ qua.`);
        continue;
      }

      pairs.push({
        key: crypto.randomUUID(),
        left,
        right
      });
    }

    return { kind: 'pairs', count: pairs.length, pairs, warnings };
  }

  // Kind === 'sentences' (ghép câu & bậc thang quy luật)
  const sentences: ImportedSentenceRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (!r || r.every(c => !c.trim())) continue;

    const prompt = (r[0] ?? '').trim();
    const answer = (r[1] ?? '').trim();
    const hint = (r[2] ?? '').trim();

    if (!prompt || !answer) {
      warnings.push(`Dòng ${i + firstDataLine}: Cần có yêu cầu và câu đáp án hoàn chỉnh, đã bỏ qua.`);
      continue;
    }

    sentences.push({
      key: crypto.randomUUID(),
      prompt,
      answer,
      hint
    });
  }

  return { kind: 'sentences', count: sentences.length, sentences, warnings };
}

/** Tạo nội dung tệp mẫu Excel (.csv có UTF-8 BOM) để phụ huynh / thầy cô mở trực tiếp bằng Excel */
export function getExcelTemplate(kind: Kind): { filename: string; content: string } {
  const bom = '\uFEFF';
  if (kind === 'quiz') {
    const content = bom +
      `"Câu hỏi","Phương án A","Phương án B","Phương án C","Phương án D","Đáp án đúng (A/B/C/D)","Giải thích ngắn"\n` +
      `"7 × 8 = ?","54","56","58","64","B","Bảng nhân 7: 7 × 8 = 56"\n` +
      `"Số nào là số chia hết cho 5?","12","24","35","41","C","Số có chữ số tận cùng là 0 hoặc 5"\n` +
      `"Hình vuông có mấy cạnh bằng nhau?","3","4","5","6","B","Hình vuông có 4 cạnh bằng nhau"`;
    return { filename: 'Mau_Cau_Hoi_Trac_Nghiem_Bao_An.csv', content };
  }

  if (kind === 'pairs') {
    const content = bom +
      `"Mặt trái (Từ vựng / Phép tính)","Mặt phải (Ý nghĩa / Kết quả)"\n` +
      `"Apple","Quả táo"\n` +
      `"School","Ngôi trường"\n` +
      `"Book","Quyển sách"\n` +
      `"Family","Gia đình"\n` +
      `"Teacher","Thầy cô giáo"`;
    return { filename: 'Mau_Ghep_Cap_Tu_Vung_Bao_An.csv', content };
  }

  // sentences
  const content = bom +
      `"Yêu cầu cho học sinh","Câu mẫu hoàn chỉnh (các từ cách nhau bởi dấu cách)","Gợi ý ngắn"\n` +
      `"Sắp xếp câu giới thiệu bản thân","My name is Nam .","Bắt đầu bằng My"\n` +
      `"Sắp xếp câu nói về thời tiết","It is sunny today .","Bắt đầu bằng It is"\n` +
      `"Dãy số tăng dần cách đều 5","5 10 15 20 25","Mỗi số cộng thêm 5 đơn vị"`;
  return { filename: 'Mau_Ghep_Cau_Quy_Luat_Bao_An.csv', content };
}

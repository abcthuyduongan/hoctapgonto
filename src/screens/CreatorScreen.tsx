import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { ContentPack, PairItem, PairsPack, QuizItem, QuizPack, SentenceItem, SentencePack, Subject } from '../core/contracts';
import { titleSubject } from '../core/utils';
import { validatePack } from '../core/validation';
import { MAX_IMPORT_BYTES, parseContentImport, serializeContentExport } from '../core/content-io';

interface Props {
  packs: ContentPack[];
  onPublish: (pack:ContentPack)=>Promise<void>;
  onImport: (packs:ContentPack[])=>Promise<number>;
}
const subjects:Subject[]=['math','vietnamese','english','thinking'];
type Kind = ContentPack['kind'];
type PairRow={key:string,left:string,right:string};
type SentenceRow={key:string,prompt:string,answer:string,hint:string};
type QuizRow={key:string,prompt:string,options:[string,string,string,string],correctIndex:0|1|2|3,explanation:string};
const newKey=()=>crypto.randomUUID();
const newPair=():PairRow=>({key:newKey(),left:'',right:''});
const newSentence=():SentenceRow=>({key:newKey(),prompt:'',answer:'',hint:''});
const newQuiz=():QuizRow=>({key:newKey(),prompt:'',options:['','','',''],correctIndex:0,explanation:''});
const newPackId=()=>`lesson-${crypto.randomUUID().slice(0,12)}`;
const modeLabel:Record<Kind,string>={quiz:'Math Quest · Trắc nghiệm',pairs:'Memory Match · Ghép cặp',sentences:'Sentence Builder · Ghép câu'};

export default function CreatorScreen({packs,onPublish,onImport}:Props) {
  const [kind,setKind]=useState<Kind>('pairs');
  const [title,setTitle]=useState('');
  const [subject,setSubject]=useState<Subject>('english');
  const [grade,setGrade]=useState(3);
  const [objective,setObjective]=useState('CUSTOM.PAIRS');
  const [pairs,setPairs]=useState<PairRow[]>(()=>[newPair(),newPair(),newPair()]);
  const [sentences,setSentences]=useState<SentenceRow[]>(()=>[newSentence(),newSentence()]);
  const [quizzes,setQuizzes]=useState<QuizRow[]>(()=>[newQuiz(),newQuiz()]);
  const [originId,setOriginId]=useState('');
  const [draftId,setDraftId]=useState(newPackId);
  const [selectedExport,setSelectedExport]=useState('');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [showErrors,setShowErrors]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const versions=(id:string)=>packs.filter(p=>p.id===id).map(p=>p.version);
  const base={id:originId||draftId,version:originId?Math.max(...versions(originId),0)+1:1,
    title,subject,grade,source:'local' as const,publishedAt:new Date().toISOString()};
  const pack:ContentPack=kind==='pairs' ? ({...base,kind:'pairs',items:pairs.map((r,i):PairItem=>({
    kind:'pair',id:`pair-${i+1}`,objectiveId:objective.trim(),left:r.left.trim(),right:r.right.trim()
  }))} satisfies PairsPack) :kind==='sentences' ? ({...base,kind:'sentences',items:sentences.map((r,i):SentenceItem=>({
    kind:'sentence',id:`sentence-${i+1}`,objectiveId:objective.trim(),prompt:r.prompt.trim(),
    words:r.answer.trim().split(/\s+/).filter(Boolean),hint:r.hint.trim()
  }))} satisfies SentencePack) : ({...base,kind:'quiz',items:quizzes.map((r,i):QuizItem=>({
    kind:'multiple-choice',id:`question-${i+1}`,objectiveId:objective.trim(),prompt:r.prompt.trim(),
    options:r.options.map(s=>s.trim()) as QuizItem['options'],correctIndex:r.correctIndex,explanation:r.explanation.trim()
  }))} satisfies QuizPack);
  const errors=validatePack(pack);

  function changeKind(mode:Kind) {
    setKind(mode);setOriginId('');setTitle('');setSubject(mode==='quiz'?'math':'english');
    setObjective(mode==='quiz'?'CUSTOM.QUIZ':mode==='pairs'?'CUSTOM.PAIRS':'CUSTOM.SENTENCES');
    setDraftId(newPackId());setShowErrors(false);setMessage('');
  }
  function fromPack(key:string) {
    setMessage('');setShowErrors(false);
    if (!key) {changeKind(kind);return;}
    const src=packs.find(p=>`${p.id}@${p.version}`===key);
    if (!src) return;
    setKind(src.kind);setOriginId(src.id);setTitle(src.title);setSubject(src.subject);setGrade(src.grade);
    setObjective(src.items[0]?.objectiveId??'CUSTOM.LEARNING');
    if (src.kind==='pairs') setPairs(src.items.map(p=>({key:newKey(),left:p.left,right:p.right})));
    if (src.kind==='sentences') setSentences(src.items.map(p=>({key:newKey(),prompt:p.prompt,answer:p.words.join(' '),hint:p.hint})));
    if (src.kind==='quiz') setQuizzes(src.items.map(q=>({key:newKey(),prompt:q.prompt,options:[...q.options] as QuizRow['options'],correctIndex:q.correctIndex,explanation:q.explanation})));
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setShowErrors(true);setMessage('');
    if (errors.length||saving) return;
    setSaving(true);
    try {await onPublish(pack);setMessage(`Đã xuất bản “${pack.title}” phiên bản ${pack.version}; dữ liệu và phiên bản trước được giữ nguyên.`);setOriginId(pack.id);}
    catch(e) {setMessage(e instanceof Error?`Không lưu được: ${e.message}`:'Không lưu được học liệu.');}
    finally {setSaving(false);}
  }
  async function importFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value='';
    if (!file || saving) return;
    if (file.size>MAX_IMPORT_BYTES) {setMessage('Tệp vượt 1 MB, không thể nhập.');return;}
    setSaving(true);setMessage('');
    try {
      const incoming=parseContentImport(await file.text());
      const created=await onImport(incoming);
      setMessage(`Đã nhập ${created} bộ mới; ${incoming.length-created} phiên bản trùng được giữ nguyên, không ghi đè. Chọn game để chơi thử nội dung vừa nhập.`);
    } catch(e) {setMessage(`Không nhập được: ${e instanceof Error?e.message:'Tệp không hợp lệ.'}`);}
    finally {setSaving(false);}
  }
  function exportSelected() {
    const chosen=packs.find(p=>`${p.id}@${p.version}`===selectedExport);
    if(!chosen){setMessage('Hãy chọn một bộ học liệu đã xuất bản.');return;}
    try {
      const blob=new Blob([serializeContentExport([chosen])],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
      a.download=`baoan-${chosen.id}-v${chosen.version}.json`;document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('Đã tạo tệp học liệu JSON. Tệp này không chứa lịch sử học sinh.');
    } catch(e){setMessage(e instanceof Error?e.message:'Không xuất được học liệu.');}
  }
  const updateQuiz=(key:string,update:Partial<QuizRow>)=>setQuizzes(prev=>prev.map(r=>r.key===key?{...r,...update}:r));

  return <div className="screen-space creator-workspace">
    <div className="heading-block"><div className="eyebrow">DÀNH CHO NGƯỜI BIÊN SOẠN</div><h1>Creator Studio <span className="studio-alpha">V3.6.2</span></h1>
      <p>Tạo nội dung cho cả ba trò chơi, xuất bản phiên bản mới và chia sẻ học liệu JSON an toàn. Mỗi game có thể dùng nhiều bộ nội dung.</p></div>
    <div className="studio-layout"><section className="panel studio-form">
      <div className="panel-top"><h2>Biên soạn học liệu</h2><span className="subtle-chip">Không ghi đè phiên bản cũ</span></div>
      <div className="notice subtle">Bản nội bộ một thiết bị, chưa có đăng nhập. Không nhập dữ liệu cá nhân của học sinh vào học liệu.</div>
      <div className="creator-kinds" aria-label="Chọn game để soạn nội dung">
        {(['quiz','pairs','sentences'] as Kind[]).map(mode=><button key={mode} type="button" aria-pressed={kind===mode}
          className={`button ${kind===mode?'primary':'outline'}`} onClick={()=>changeKind(mode)}>{modeLabel[mode]}</button>)}
      </div>
      <form onSubmit={e=>void submit(e)} noValidate>
        <label className="field-label" htmlFor="copy-from">Tạo phiên bản mới từ bộ hiện có (tùy chọn)</label>
        <select className="select" id="copy-from" key={kind} onChange={e=>fromPack(e.target.value)} defaultValue="">
          <option value="">+ Tạo mới hoàn toàn</option>
          {packs.filter(p=>p.kind===kind).map(p=><option key={`${p.id}@${p.version}`} value={`${p.id}@${p.version}`}>{p.title} (v{p.version})</option>)}
        </select>
        <div className="form-two"><div><label className="field-label" htmlFor="pack-title">Tên bộ học liệu</label><input className="input" id="pack-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={90} placeholder="Ví dụ: Toán 6 · Số nguyên tố"/></div>
          <div><label className="field-label" htmlFor="pack-subject">Môn học</label><select className="select" id="pack-subject" value={subject} onChange={e=>setSubject(e.target.value as Subject)}>{subjects.map(s=><option key={s} value={s}>{titleSubject(s)}</option>)}</select></div></div>
        <div className="form-two"><div><label className="field-label" htmlFor="pack-grade">Lớp</label><input className="input" id="pack-grade" type="number" min="1" max="12" value={grade} onChange={e=>setGrade(Number(e.target.value))}/></div>
          <div><label className="field-label" htmlFor="pack-objective">Mã mục tiêu kiến thức</label><input className="input" id="pack-objective" value={objective} onChange={e=>setObjective(e.target.value)} maxLength={80} placeholder="MATH6.PRIME"/></div></div>
        {kind==='quiz' ? <>
          <div className="pair-table-head"><h3>Câu hỏi trắc nghiệm Math Quest</h3><small>{quizzes.length}/30 câu</small></div>
          <p className="small-note">Mỗi câu gồm 4 phương án, đúng duy nhất 1 phương án và có giải thích. Kiểm tra tính chính xác trước khi giao học sinh.</p>
          <div className="sentence-editor-list">{quizzes.map((row,i)=><div className="sentence-editor quiz-editor" key={row.key}>
            <div className="sentence-editor-head"><strong>Câu {i+1}</strong><button type="button" className="icon-action" aria-label={`Xóa câu ${i+1}`} disabled={quizzes.length<=2} onClick={()=>setQuizzes(prev=>prev.filter(r=>r.key!==row.key))}>×</button></div>
            <label className="field-label">Nội dung câu hỏi <input className="input" maxLength={320} value={row.prompt} onChange={e=>updateQuiz(row.key,{prompt:e.target.value})} placeholder="Ví dụ: 7 × 6 = ?"/></label>
            <div className="quiz-options">{row.options.map((value,j)=><label className="field-label" key={j}>Phương án {String.fromCharCode(65+j)} <input className="input" maxLength={120} value={value} onChange={e=>updateQuiz(row.key,{options:row.options.map((o,k)=>k===j?e.target.value:o) as QuizRow['options']})} placeholder={`Đáp án ${String.fromCharCode(65+j)}`}/></label>)}</div>
            <label className="field-label">Đáp án đúng <select className="select" value={row.correctIndex} onChange={e=>updateQuiz(row.key,{correctIndex:Number(e.target.value) as QuizRow['correctIndex']})}>{[0,1,2,3].map(j=><option key={j} value={j}>{String.fromCharCode(65+j)} — {row.options[j]||'Chưa nhập'}</option>)}</select></label>
            <label className="field-label">Giải thích đáp án <input className="input" maxLength={500} value={row.explanation} onChange={e=>updateQuiz(row.key,{explanation:e.target.value})} placeholder="Cách giải ngắn gọn để học sinh hiểu"/></label>
          </div>)}</div>
          <button className="button outline" type="button" disabled={quizzes.length>=30} onClick={()=>setQuizzes(prev=>[...prev,newQuiz()])}>+ Thêm câu trắc nghiệm</button>
        </> : kind==='pairs' ? <>
          <div className="pair-table-head"><h3>Các cặp thẻ</h3><small>{pairs.length}/30 cặp</small></div>
          <div className="pair-list">{pairs.map((row,i)=><div className="pair-edit-row" key={row.key}>
            <span className="pair-number">{i+1}</span>
            <input className="input" aria-label={`Mặt trái cặp ${i+1}`} maxLength={120} placeholder="Mặt trái" value={row.left} onChange={e=>setPairs(prev=>prev.map(r=>r.key===row.key?{...r,left:e.target.value}:r))}/>
            <span className="pair-link">↔</span>
            <input className="input" aria-label={`Mặt phải cặp ${i+1}`} maxLength={120} placeholder="Mặt phải" value={row.right} onChange={e=>setPairs(prev=>prev.map(r=>r.key===row.key?{...r,right:e.target.value}:r))}/>
            <button className="icon-action" type="button" aria-label={`Xóa cặp ${i+1}`} disabled={pairs.length<=2} onClick={()=>setPairs(prev=>prev.filter(r=>r.key!==row.key))}>×</button>
          </div>)}</div>
          <button className="button outline" type="button" disabled={pairs.length>=30} onClick={()=>setPairs(prev=>[...prev,newPair()])}>+ Thêm cặp</button>
        </> : <>
          <div className="pair-table-head"><h3>Câu cần sắp xếp</h3><small>{sentences.length}/30 câu</small></div>
          <p className="small-note">Nhập câu mẫu với các từ cách nhau bằng dấu cách (3–15 từ). Game kiểm tra thứ tự từ theo đúng một đáp án mẫu.</p>
          <div className="sentence-editor-list">{sentences.map((row,i)=><div className="sentence-editor" key={row.key}>
            <div className="sentence-editor-head"><strong>Câu {i+1}</strong><button className="icon-action" type="button" disabled={sentences.length<=2} aria-label={`Xóa câu ${i+1}`} onClick={()=>setSentences(prev=>prev.filter(r=>r.key!==row.key))}>×</button></div>
            <label className="field-label">Yêu cầu cho học sinh <input className="input" maxLength={320} value={row.prompt} onChange={e=>setSentences(prev=>prev.map(r=>r.key===row.key?{...r,prompt:e.target.value}:r))} placeholder="Sắp xếp thành câu nói về ngôi nhà"/></label>
            <label className="field-label">Câu đáp án mẫu <input className="input" value={row.answer} onChange={e=>setSentences(prev=>prev.map(r=>r.key===row.key?{...r,answer:e.target.value}:r))} placeholder="My house is small."/></label>
            <label className="field-label">Gợi ý ngắn <input className="input" maxLength={160} value={row.hint} onChange={e=>setSentences(prev=>prev.map(r=>r.key===row.key?{...r,hint:e.target.value}:r))} placeholder="Bắt đầu bằng My house"/></label>
          </div>)}</div>
          <button className="button outline" type="button" disabled={sentences.length>=30} onClick={()=>setSentences(prev=>[...prev,newSentence()])}>+ Thêm câu</button>
        </>}
        {showErrors&&errors.length>0&&<div className="notice error" role="alert"><strong>Cần sửa trước khi xuất bản:</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
        {message&&<div className="notice" role="status">{message}</div>}
        <div className="form-submit"><div><strong>Phiên bản dự kiến: v{pack.version}</strong><small>Không ghi đè học liệu đã dùng trong lượt chơi</small></div>
          <button type="submit" className="button primary" disabled={saving}>{saving?'Đang lưu…':'Xuất bản học liệu ↗'}</button></div>
      </form>
      <section className="creator-transfer" aria-label="Nhập xuất học liệu"><h3>Trao đổi bộ học liệu JSON</h3>
        <p className="small-note">Chỉ nhập/xuất câu hỏi và đáp án. Không chuyển điểm số, hồ sơ trẻ hoặc kết quả giữa bản HTML ngoại tuyến và React.</p>
        <div className="creator-transfer-row"><select className="select" aria-label="Bộ học liệu cần tải về" value={selectedExport} onChange={e=>setSelectedExport(e.target.value)}><option value="">Chọn bộ đã xuất bản để tải về…</option>{packs.map(p=><option key={`${p.id}@${p.version}`} value={`${p.id}@${p.version}`}>{p.title} · v{p.version}</option>)}</select>
          <button className="button outline" type="button" disabled={!selectedExport||saving} onClick={exportSelected}>⬇ Tải JSON</button></div>
        <input ref={fileInput} type="file" accept=".json,application/json" onChange={e=>void importFile(e)} className="ba3d-sr-only" aria-label="Chọn tệp bộ học liệu JSON"/>
        <button className="button outline" type="button" disabled={saving} onClick={()=>fileInput.current?.click()}>⬆ Nhập học liệu JSON</button>
      </section>
    </section>
    <aside className="panel studio-guide"><div className="guide-orb">🧩</div><h2>Một thế giới,<br/>ba game học tập</h2><p>Tạo bộ học liệu độc lập với trò chơi, gắn với đúng môn và lớp rồi chọn trong Thế giới game để thử ngay.</p>
      <div className="guide-list"><div><span>01</span><p>Chọn Math, Memory hoặc Sentence</p></div><div><span>02</span><p>Nhập câu hỏi, đáp án và gợi ý</p></div><div><span>03</span><p>Kiểm tra lỗi và xuất bản</p></div><div><span>04</span><p>Chọn bộ nội dung trong game để chơi thử</p></div></div>
      <div className="subtle-callout">Gói học liệu được lưu cục bộ ở thiết bị. Nên xuất bản sao JSON định kỳ trước khi xóa dữ liệu trình duyệt.</div>
    </aside></div>
  </div>;
}

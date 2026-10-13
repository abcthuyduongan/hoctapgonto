from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(rel, f):
 p=root/rel; old=p.read_text(encoding='utf-8'); new=f(old); assert new!=old, rel; p.write_text(new,encoding='utf-8')

edit('src/screens/StudentScreen.tsx',lambda s:s.replace("art:'/art/cover-math.webp'","art:'/art/original-cover-math.webp'").replace("art:'/art/cover-memory.webp'","art:'/art/original-cover-memory.webp'").replace("art:'/art/cover-sentence.webp'","art:'/art/original-cover-sentence.webp'").replace('ALPHA 2.5','ALPHA 2.6').replace('BẢN ĐỒ THẾ GIỚI','THẾ GIỚI HỌC TẬP').replace('VÙNG ĐẤT {meta.index}','CHƯƠNG {meta.index}').replace('Vào chơi ngay','Khám phá ngay'))

edit('src/main.tsx',lambda s:s.replace("import './styles/game-world.css';", "import './styles/game-world.css';\nimport './styles/polish26.css';"))
edit('src/core/registry.ts',lambda s:s.replace("runtime:'phaser',contentKind:'quiz',version:'0.2.5'","runtime:'react',contentKind:'quiz',version:'0.2.6'").replace("version:'0.2.5'","version:'0.2.6'").replace("version:'0.1.5'","version:'0.2.6'"))

edit('src/games/MathQuest.tsx',lambda s:s.replace("import { useEffect, useState } from 'react';","import { useEffect, useRef, useState } from 'react';\nimport { playFeedbackTone } from '../core/experience';").replace("import PhaserSky from './PhaserSky';\n",'').replace("  const [started,setStarted]", "  const answerLock = useRef(false);\n  const [started,setStarted]").replace("if (busy || selected !== null || status === 'done') return;","if (answerLock.current || busy || selected !== null || status === 'done') return;\n    answerLock.current=true;\n    playFeedbackTone(choice===question.correctIndex ? 'success' : 'retry');").replace("    finally {setBusy(false);}","    finally {setBusy(false);answerLock.current=false;}",1).replace("{setIndex(v => v+1);setSelected(null);setHints(0);}","{setIndex(v => v+1);setSelected(null);setHints(0);}").replace('    <div className="sky-ambient"><PhaserSky/></div>','    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>').replace('Con giỏi lắm! Bình tĩnh chọn đáp án nhé. ✨','{selected===null ? "Con cứ suy nghĩ kỹ rồi chọn nhé! 🌟" : (selected===question.correctIndex ? "Cậu làm tốt lắm! 🎉" : "Sai cũng là một cách học nhé! 🌱")}').replace('className="challenge-card completion-card"','className="challenge-card completion-card trophy-reveal"').replace('  </section>;', '  </section>;'))

edit('src/games/MemoryMatch.tsx',lambda s:s.replace("import { shuffle } from '../core/utils';","import { shuffle } from '../core/utils';\nimport { playFeedbackTone } from '../core/experience';").replace("    const correct = previous.pairId === card.pairId && previous.side !== card.side;", "    const correct = previous.pairId === card.pairId && previous.side !== card.side;\n    playFeedbackTone(correct?'success':'retry');").replace('className="challenge-card completion-card"','className="challenge-card completion-card trophy-reveal"').replace('Hãy lật 2 thẻ và tìm cặp tương ứng nhé! 🦉','Mỗi lần lật là thêm một cơ hội ghi nhớ! 🦉').replace('    <div className="world-stage-bottom">','    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>\n    <div className="world-stage-bottom">'))

edit('src/games/SentenceBuilder.tsx',lambda s:s.replace("import { isCorrectSentence } from '../core/sdk';", "import { isCorrectSentence } from '../core/sdk';\nimport { playFeedbackTone } from '../core/experience';").replace("    const correct = isCorrectSentence(item.words,placed);", "    const correct = isCorrectSentence(item.words,placed);\n    playFeedbackTone(correct?'success':'retry');").replace('className="challenge-card completion-card"','className="challenge-card completion-card trophy-reveal"').replace('    <div className="world-stage-bottom">','    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>\n    <div className="world-stage-bottom">'))

edit('src/screens/ParentScreen.tsx',lambda s:s.replace('<div className="screen-space">','<div className="screen-space parent-workspace">').replace('DÀNH CHO PHỤ HUYNH','TRUNG TÂM ĐỒNG HÀNH').replace('Đồng hành cùng con','Mỗi bước tiến đều đáng ghi nhận').replace('Báo cáo trên thiết bị này, dựa trên những lượt thử đã lưu. Chưa có đồng bộ giữa thiết bị.','Thông tin rõ ràng để gia đình hiểu quá trình học tập, không chỉ nhìn vào điểm số. Dữ liệu chỉ có trên thiết bị này.').replace('<div className="stat-grid">','<div className="stat-grid parent-stats">').replace('Tiến độ theo kỹ năng','Kỹ năng đã luyện').replace('Lượt chơi gần đây','Nhật ký khám phá'))

edit('src/screens/CreatorScreen.tsx',lambda s:s.replace('className="screen-space"','className="screen-space creator-workspace"'))

# Restrained feedback sounds; disabled by default and controllable from host.
(root/'src/core/experience.ts').write_text('''/** Audio UX is strictly optional and is OFF by default for children. */
let context: AudioContext | null = null;
export function playFeedbackTone(result: 'success'|'retry') {
  if (typeof window === 'undefined' || document.documentElement.dataset.sound !== 'on') return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(result === 'success' ? 660 : 350, context.currentTime);
    if (result === 'success') oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + .14);
    volume.gain.setValueAtTime(.0001, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(.045, context.currentTime + .02);
    volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .20);
    oscillator.connect(volume);volume.connect(context.destination);
    oscillator.start();oscillator.stop(context.currentTime + .21);
  } catch { /* audio unsupported: keep learning interaction functional */ }
}
''',encoding='utf-8')

# App: sound/motion toggles are real settings, with touch-friendly controls.
def upgrade_app(s):
 s=s.replace("  const [page,setPage] = useState<Page>('student');","  const [page,setPage] = useState<Page>('student');\n  const [soundOn,setSoundOn] = useState(() => {try{return localStorage.getItem('ba.sound')==='on';}catch{return false;}});\n  const [motionOn,setMotionOn] = useState(() => {try{return localStorage.getItem('ba.motion')!=='off';}catch{return true;}});\n  useEffect(()=>{document.documentElement.dataset.sound=soundOn?'on':'off';document.documentElement.dataset.motion=motionOn?'on':'off';try{localStorage.setItem('ba.sound',soundOn?'on':'off');localStorage.setItem('ba.motion',motionOn?'on':'off');}catch{/* storage unavailable */}},[soundOn,motionOn]);")
 s=s.replace('<div className="header-status"><span className="local-dot"/> <span>Dữ liệu trên thiết bị</span></div>', '<div className="experience-controls" aria-label="Cài đặt trải nghiệm"><button type="button" className="control-pill" onClick={()=>setSoundOn(v=>!v)} aria-pressed={soundOn} title={soundOn?"Tắt âm thanh":"Bật âm thanh"}>{soundOn?"🔊":"🔇"}<span className="control-label">Âm thanh</span></button><button type="button" className="control-pill" onClick={()=>setMotionOn(v=>!v)} aria-pressed={motionOn} title={motionOn?"Giảm chuyển động":"Bật chuyển động"}>{motionOn?"✨":"◻"}<span className="control-label">Hiệu ứng</span></button></div>')
 s=s.replace('Alpha 2.5 • Thử nghiệm nội bộ', 'Alpha 2.6 • Thử nghiệm nội bộ')
 return s
edit('src/App.tsx',upgrade_app)

p=root/'package.json';s=p.read_text();s=s.replace('"bao-an-learning-v3-alpha25"','"bao-an-learning-v3-alpha26"').replace('"3.0.0-alpha.2.5"','"3.0.0-alpha.2.6"');p.write_text(s)
print('Upgraded 9 frontend modules and added optional audio UX.')

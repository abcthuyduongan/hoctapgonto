import type { LearningEvent, PlaySession } from '../core/contracts';
import { calculateReport } from '../core/reports';

export default function ParentScreen({events,sessions}:{events:LearningEvent[],sessions:PlaySession[]}) {
  const report = calculateReport(events,sessions);
  const recent = [...sessions].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,6);
  return <div className="screen-space parent-workspace">
    <div className="heading-block"><div className="eyebrow">TRUNG TÂM ĐỒNG HÀNH</div><h1>Mỗi bước tiến đều đáng ghi nhận</h1><p>Thông tin rõ ràng để gia đình hiểu quá trình học tập, không chỉ nhìn vào điểm số. Dữ liệu chỉ có trên thiết bị này.</p></div>
    <div className="stat-grid parent-stats">
      <article className="stat-card"><div className="stat-icon">🎯</div><span>Lượt trả lời / ghép cặp</span><strong>{report.attempts}</strong><small>Không tính thao tác lật thẻ đầu tiên</small></article>
      <article className="stat-card"><div className="stat-icon">✨</div><span>Tỷ lệ lượt đúng</span><strong>{report.accuracy}%</strong><small>{report.correct}/{report.attempts} lượt đúng</small></article>
      <article className="stat-card"><div className="stat-icon">🏁</div><span>Trò chơi hoàn thành</span><strong>{report.completed}</strong><small>Không tính phiên thoát giữa chừng</small></article>
    </div>
    <div className="dashboard-columns"><section className="panel"><div className="panel-top"><h2>Kỹ năng đã luyện</h2><span className="subtle-chip">Dữ liệu thực tế</span></div>
      {report.objectives.length===0?<div className="empty-state">Chưa có hoạt động nào. Hãy vào Góc học sinh và thử một trò chơi.</div>:
        report.objectives.map(o=><div className="skill-row" key={o.id}><div className="skill-top"><strong>{o.id}</strong><span>{o.correct}/{o.total} lượt đúng</span></div><div className="progress-track"><div style={{width:`${o.accuracy}%`}}/></div>{o.hints>0&&<small>Đã xem gợi ý {o.hints} lần</small>}</div>)}
      <p className="small-note">Tỷ lệ đúng thể hiện các lượt thử, không phải kết luận về mức độ thành thạo của trẻ.</p></section>
      <section className="panel"><div className="panel-top"><h2>Nhật ký khám phá</h2></div>
      {recent.length===0?<div className="empty-state">Các lượt chơi sẽ xuất hiện tại đây sau khi con bắt đầu.</div>:
        <div className="session-list">{recent.map(s=><div className="session-row" key={s.sessionId}><div className="session-bullet">{s.moduleId==='math-quest'?'✦':s.moduleId==='sentence-builder'?'✎':'◈'}</div><div><strong>{s.moduleId==='math-quest'?'Math Quest':s.moduleId==='sentence-builder'?'Sentence Builder':'Memory Match'}</strong><small>{new Date(s.startedAt).toLocaleString('vi-VN')}</small></div><span className={`status-tag ${s.status}`}>{s.status==='completed'?'Hoàn thành':s.status==='abandoned'?'Dở dang':'Đang chơi'}</span></div>)}</div>}
      </section></div>
    <div className="notice"><strong>🔒 Quyền riêng tư trong bản thử nghiệm:</strong> Đây là bản demo một thiết bị, chưa có xác thực phụ huynh, hồ sơ nhiều trẻ hoặc kiểm soát truy cập phía máy chủ. Không nhập thông tin cá nhân thật và không đưa bản này lên website công khai.</div>
  </div>;
}

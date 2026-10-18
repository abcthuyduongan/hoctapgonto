import {readFile,writeFile} from 'node:fs/promises';
const root='test-results/deep-release-audit',source=JSON.parse(await readFile(root+'/source-workbook.json','utf8'));
const records=[];
const gameEvidence=group=>{
 const n=Number(group.split('.')[0]);
 if([1,2,3,5,6].includes(n))return ['node-regression.log','browser-regression.log','adversarial-api.json'];
 if(n===4)return ['node-regression.log','original-import-chrome.json','original-import-msedge.json'];
 if(n===7)return ['node-regression.log','browser-regression.log','adversarial-api.json'];
 if(n===9||n===10)return ['browser-regression.log','original-browser-report.json','browser-lifecycle-recheck.json'];
 if(n===11||n===12)return ['node-regression.log','browser-regression.log'];
 if(n===14)return ['artifact-verification.json','public-site-check.json'];
 return [];
};
for(const sheet of source.filter(s=>['TEST_GAME','TEST_NEN_TANG'].includes(s.sheet))){
 for(const row of sheet.rows){
  const c=Object.fromEntries(row.cells.map(cell=>[cell.col,cell.value]));if(!/^[A-Z]+-\d+$/.test(c.A??''))continue;
  const game=sheet.sheet==='TEST_GAME',id=c.A,group=c.B,related=[];
  if(['GAME-011','GAME-024','GAME-061','GAME-124','GM-09'].includes(id))related.push('AUDIT-01');
  if(['GAME-050','GAME-061','GAME-062','GAME-072','GAME-150','DB-03','DB-07'].includes(id))related.push('AUDIT-02');
  if(['GAME-087','UI-01'].includes(id))related.push('AUDIT-03');
  let status='CHUA_NGHIEM_THU_DAY_DU';let note='Không tự suy ra PASS từ một ca tự động có tên gần giống; cần đối chiếu đủ bước và môi trường của dòng này.';
  const number=Number(id.split('-')[1]);
  if(game&&number>=79&&number<=86||['GAME-069','GAME-070','GAME-076','GAME-077','GAME-078','GAME-146','GAME-147','RL-01','RL-02','RL-03','RL-04'].includes(id)){
   status='CAN_CHOT_PHAM_VI_G0';note='Có yêu cầu rộng hơn phạm vi RC9; chưa được chủ sản phẩm chấp thuận loại khỏi lần phát hành, không tự đánh N/A.';
  }else if(game&&[10,13,15].includes(Number(group.split('.')[0]))||!game&&['CP','PF','ST','OP'].includes(id.split('-')[0])){
   status='THIEU_BANG_CHUNG_MOI_TRUONG_THAT';note='Các kiểm tra cục bộ chỉ chứng minh phần được chạy; chưa thay thế máy thật, tải cloud, soak hoặc vận hành.';
  }
  if(related.length){status='CO_PHAT_HIEN_LIEN_QUAN_CAN_TAI_KIEM';note='Ca kiểm toán bổ sung đã tái hiện lỗi liên quan; xem ID phát hiện, không coi toàn bộ các bước của ca trong workbook đã được chạy.';}
  records.push({sourceSheet:sheet.sheet,sourceRow:row.row,id,group,title:c[game?'D':'C'],method:c[game?'E':'D'],expected:c[game?'F':'E'],priority:c[game?'I':'H'],sourceStatus:c[game?'K':'J'],declaredScope:game?c.H:undefined,auditStatus:status,relatedFindings:related,localEvidence:game?gameEvidence(group):['node-regression.log','browser-regression.log'],note});
 }
}
const counts={};for(const r of records)counts[r.priority]=(counts[r.priority]??0)+1;
if(records.length!==280||counts.P0!==191||counts.P1!==89)throw new Error('Unexpected workbook case count');
await writeFile(root+'/requirements-crosswalk.json',JSON.stringify({createdAt:new Date().toISOString(),purpose:'Traceability and remaining acceptance work; not 280 executed tests',sourceWorkbook:'C:/Users/abcth/Downloads/Quy_hoach_Kiem_thu_GAME_HOC_TAP_ONLINE_2026.xlsx',cases:records.length,priorities:counts,records},null,2));
console.log(JSON.stringify({cases:records.length,priorities:counts,notFullyAccepted:records.length}));

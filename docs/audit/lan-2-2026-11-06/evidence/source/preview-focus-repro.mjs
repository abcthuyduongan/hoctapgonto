import {createOnlineServer} from '../../server/online-server.mjs';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const root='test-results/audit-lan-2-2026-11-06',password='Audit-preview-password-2026!',token='audit-preview-bootstrap';
const server=createOnlineServer({databasePath:':memory:',staticRoot:resolve('dist'),setupToken:token,secureCookies:false});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome'});
function workbook(rows){const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))],xml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;');const sheet=matrix=>'<worksheet><sheetData>'+matrix.map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,col)=>'<c r="'+String.fromCharCode(65+col)+(index+1)+'" t="inlineStr"><is><t>'+xml(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';return Buffer.from(zipSync({'xl/workbook.xml':strToU8('<workbook xmlns:r="urn:relationships"><sheets><sheet name="Thông tin bộ" r:id="info"/><sheet name="Câu hỏi" r:id="questions"/></sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="info" Type="urn:/worksheet" Target="worksheets/info.xml"/><Relationship Id="questions" Type="urn:/worksheet" Target="worksheets/questions.xml"/></Relationships>'),'xl/worksheets/info.xml':strToU8(sheet([['schema','baoan-online-week'],['formatVersion','1'],['title','Tuần audit']])),'xl/worksheets/questions.xml':strToU8(sheet([['baoan-online-week','1'],headers,...rows.map(row=>headers.map(header=>row[header]??''))]))}));}
try{
 const context=await browser.newContext(),page=await context.newPage();
 async function api(route,data,csrf=''){const r=await page.request.post(origin+'/api/online'+route,{headers:{Origin:origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
 const admin=await api('/setup',{token,name:'Audit preview',username:'audit.preview.admin',password});
 await api('/classes',{name:'Lớp audit',grade:3},admin.csrfToken);
 let reads=0;page.on('request',r=>{if(r.url().includes('/api/online/admin/summary'))reads++;});
 await page.goto(origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
 const rows=['Toán','Tiếng Việt','Tiếng Anh'].flatMap(subjectLabel=>[1,2].map(i=>({subjectLabel,kind:'quiz',prompt:subjectLabel+' '+i,A:'Đúng',B:'Sai B',C:'Sai C',D:'Sai D',answer:'A'})));
 await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles({name:'audit.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(rows)});
 await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toBeVisible();
 const before=await preview.innerText(),beforeReads=reads;
 await page.screenshot({path:root+'/preview-before-focus.png',fullPage:true});
 // Invoke the same focus event handler the user triggers when returning to the app.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect.poll(()=>reads).toBeGreaterThan(beforeReads);
 await expect(preview).toHaveCount(1);
 await page.screenshot({path:root+'/preview-after-focus.png',fullPage:true});
 const observation={kind:'Actual built app, SQLite in-memory fixture, synthetic window focus event invokes production focus handler',beforePreviewText:before,previewVisibleBefore:true,previewCountAfter:await preview.count(),adminSummaryReadsBefore:beforeReads,adminSummaryReadsAfter:reads,publishedWeeks:server.onlineStore.db.prepare('SELECT count(*) AS n FROM weeks').get().n,reproduced:await preview.count()===0};
 await writeFile(root+'/preview-focus-reproduction.json',JSON.stringify(observation,null,2));console.log(JSON.stringify(observation));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server.onlineClose();}

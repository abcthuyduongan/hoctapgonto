import {test,expect,type Page} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

function policyDocument(conflict=false){
  const cell=(value:string)=>`<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
  const table=(rows:string[][])=>'<w:tbl>'+rows.map(row=>'<w:tr>'+row.map(cell).join('')+'</w:tr>').join('')+'</w:tbl>';
  const questions=[1,2].map(index=>table([['field','value'],['subjectLabel','Môn có giới hạn'],['kind','quiz'],['prompt',`Câu hỏi ${index}?`],['A',`Đúng ${index}`],['B',`Sai B ${index}`],['C',`Sai C ${index}`],['D',`Sai D ${index}`],['answer','A'],...(index===2?[['allowedGameIds','memory-match|word-connect']]:conflict?[['allowedGameIds','math-quest']]:[])]));
  return Buffer.from(zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+table([['schema','baoan-online-week'],['formatVersion','1'],['title','Bộ thử giới hạn trò']])+questions.join('')+'</w:body></w:document>')}));
}

async function setup(page:Page,f:Awaited<ReturnType<typeof cloudBrowserFixture>>){
  const response=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Kiểm tra giới hạn trò',username:'compatibility.admin',password:f.password}});expect(response.ok()).toBe(true);const identity=await response.json();
  const classroom=await page.request.post(f.origin+'/api/online/classes',{headers:{Origin:f.origin,'X-CSRF-Token':identity.csrfToken},data:{name:'Lớp kiểm tra trò',grade:3}});expect(classroom.ok()).toBe(true);
  await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
}

test('preview explains question two limiting the source to two games and blocks publishing a conflicting group',async({page},testInfo)=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);
    const upload=async(conflict:boolean)=>{await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles({name:'game-policy.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:policyDocument(conflict)});await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();};
    await upload(false);
    const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true}),review=preview.locator('.online-question-review');await expect(review).toContainText('Trò chung cho toàn bộ 2 câu: Trí Nhớ, Nối Từ.');await expect(preview.locator('.online-review-item')).toHaveCount(2);
    const question=review.locator('.online-review-item').nth(1);await expect(question.locator('summary')).toContainText('Trò dùng được với câu này: Trí Nhớ, Nối Từ');await question.locator('summary').click();
    await expect(question.getByRole('region',{name:'Trò phù hợp với câu 2',exact:true})).toContainText('Đảo Câu Hỏi: Chưa dùng được');await expect(question).toContainText('Người soạn đã giới hạn câu này');
    await expect(preview.getByRole('button',{name:'Giao 2 câu hợp lệ cho lớp',exact:true})).toBeDisabled();
    for(const viewport of[{width:360,height:740},{width:1219,height:615}]){await page.setViewportSize(viewport);await question.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);await page.screenshot({path:testInfo.outputPath(`compatibility-${viewport.width}.png`)});}
    await upload(true);await expect(preview).toContainText('Có bộ chưa có trò chung cho tất cả câu');await expect(preview.getByRole('button',{name:'Giao 2 câu hợp lệ cho lớp',exact:true})).toBeDisabled();await expect(preview.locator('.online-review-item')).toHaveCount(2);
    const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.weeks).toHaveLength(0);expect(dashboard.stats.questions).toBe(0);
  }finally{await f.close();}
});

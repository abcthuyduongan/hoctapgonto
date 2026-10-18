import {test,expect} from '@playwright/test';
import {mkdir,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {cloudBrowserFixture} from '../../tests/helpers/cloud-browser-fixture.mjs';

test('actual Excel previews quickly and mobile import must fit without horizontal overflow',async({page},testInfo)=>{
  const f=await cloudBrowserFixture({staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??'test-results/deep-release-audit/dist')});
  try{
    const api=async(route:string,data:any,csrf='')=>{const r=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(r.ok(),await r.text()).toBe(true);return r.json();};
    const admin=await api('/setup',{token:f.token,name:'Original import audit',username:'original.admin',password:f.password});
    await api('/classes',{name:'Lớp kiểm tra file gốc',grade:3},admin.csrfToken);
    const directory='C:/Users/abcth/Downloads/BAO_AN_LOP3_TUAN01_HOAN_CHINH_DE_UPLOAD';
    const workbook=path.join(directory,'BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx');
    const audio=(await readdir(path.join(directory,'Tep_da_phuong_tien'))).filter(x=>x.endsWith('.wav')).map(x=>path.join(directory,'Tep_da_phuong_tien',x));
    expect(audio).toHaveLength(16);let audioBytes=0;for(const p of audio)audioBytes+=(await stat(p)).size;
    const requests:string[]=[],errors:string[]=[];page.on('request',r=>{if(r.url().includes('/api/online/'))requests.push(r.method()+' '+new URL(r.url()).pathname);});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(f.origin+'/');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles([workbook,...audio]);
    const started=Date.now();await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();
    const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toBeVisible({timeout:20000});const previewMs=Date.now()-started;
    const text=await preview.innerText(),issues=await page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true}).allTextContents();
    const publish=preview.getByRole('button',{name:/Giao .*câu hợp lệ cho lớp|Chọn cập nhật tuần đã giao/});
    const evidence={browser:testInfo.project.name,source:workbook,excelBytes:(await stat(workbook)).size,audioFiles:audio.length,audioBytes,previewMs,uploadedObjects:f.objects.size,batchPosts:requests.filter(x=>x==='POST /api/online/media/batch').length,dashboardFetches:requests.filter(x=>x==='GET /api/online/dashboard').length,acceptedRows:await preview.locator('.online-review-item').count(),previewText:text,issues,publishDisabled:await publish.isDisabled(),pageErrors:errors};
    expect(previewMs).toBeLessThan(20000);expect(errors).toEqual([]);expect(evidence.batchPosts).toBe(1);expect(evidence.dashboardFetches).toBe(0);expect(evidence.publishDisabled).toBe(true);
    await preview.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('original-preview-desktop.png')});
    const layouts=[];
    for(const width of [390,360,320]){
      await page.setViewportSize({width,height:844});
      const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));layouts.push(layout);
      // Keep table columns readable inside their own scroll area at narrow widths.
      expect(await preview.locator('.online-subject-summary table').evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(560);
      const summary=preview.getByRole('region',{name:'Bảng môn học và số sao, có thể cuộn ngang',exact:true});await summary.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>summary.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);await summary.evaluate(node=>{node.scrollLeft=0;});
      await preview.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath(`original-preview-mobile-${width}.png`)});
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport+1);
    }
    // A separate enlarged root-font check; this is not physical-device browser zoom.
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    const enlarged=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,rootFont:getComputedStyle(document.documentElement).fontSize,overflowNodes:[...document.querySelectorAll('*')].map(node=>({tag:node.tagName,className:node.className,rect:node.getBoundingClientRect(),text:node.textContent?.slice(0,80)})).filter(row=>row.rect.right>innerWidth+1&&row.rect.width>0).slice(0,35).map(row=>({...row,rect:{left:row.rect.left,right:row.rect.right,width:row.rect.width}}))}));
    const output=process.env.BAO_AN_AUDIT_OUTPUT_ROOT??'test-results/deep-release-audit';await mkdir(output,{recursive:true});
    await writeFile(path.join(output,`original-import-${testInfo.project.name}.json`),JSON.stringify({...evidence,layouts,enlarged},null,2));
    await testInfo.attach('original-import-evidence',{body:JSON.stringify({...evidence,layouts,enlarged},null,2),contentType:'application/json'});
    expect(enlarged.documentWidth).toBeLessThanOrEqual(enlarged.viewport+1);
  }finally{await f.close();}
});

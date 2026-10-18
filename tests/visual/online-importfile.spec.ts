import {test,expect} from '@playwright/test';
import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

test('the supplied Excel 140-question file and sixteen WAV files preview without publishing invalid rows',async({page},testInfo)=>{
 const directory=process.env.BAO_AN_REAL_IMPORT_DIR;test.skip(!directory,'Requires the author-supplied local file; no authored content is committed to tests.');
 const f=await cloudBrowserFixture();
 try{
  const setup=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Real-file import fixture',username:'realfile.admin',password:f.password}});expect(setup.ok()).toBe(true);const admin=await setup.json();
  const cls=await page.request.post(f.origin+'/api/online/classes',{headers:{Origin:f.origin,'X-CSRF-Token':admin.csrfToken},data:{name:'Lớp thử nhập',grade:3}});expect(cls.ok()).toBe(true);
  const files:string[]=[];async function walk(folder:string){for(const entry of await readdir(folder,{withFileTypes:true})){const target=path.join(folder,entry.name);if(entry.isDirectory())await walk(target);else if(/\.wav$/i.test(entry.name)||entry.name==='BAO_AN_LOP3_TUAN01_MOT_FILE_140_CAU.xlsx')files.push(target);}}await walk(directory!);expect(files.filter(file=>file.endsWith('.wav'))).toHaveLength(16);
  await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles(files);
  const batches:any[]=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/online/media/batch'&&r.method()==='POST')batches.push(r.postDataJSON());});
  const start=performance.now();await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toBeVisible({timeout:20000});const elapsed=performance.now()-start;
  await expect(preview).toContainText('139/140 câu hợp lệ');await expect(page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true})).toContainText('F122');await expect(preview.getByRole('button',{name:'Giao 139 câu hợp lệ cho lớp',exact:true})).toBeDisabled();
  expect(elapsed).toBeLessThan(20000);expect(batches.length).toBeLessThanOrEqual(1);expect(batches.flatMap(batch=>batch.files).length).toBeLessThanOrEqual(16);
  const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.weeks).toHaveLength(0);expect(dashboard.stats.questions).toBe(0);
  const sizes=await Promise.all(files.map(file=>stat(file)));await page.screenshot({path:testInfo.outputPath('real-excel-preview.png'),fullPage:true});await testInfo.attach('real-file-import-timing',{body:JSON.stringify({fileCount:files.length,selectedBytes:sizes.reduce((n,s)=>n+s.size,0),previewIncludingUploadMs:Math.round(elapsed),accepted:139,total:140,excelErrorCell:'F122',uploadBatches:batches.length,uploadedObjects:f.objects.size,published:0},null,2),contentType:'application/json'});
 }finally{await f.close();}
});

import {test,expect} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

test('oversized file selections are rejected before media reads or uploads and preserve earlier pending files',async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    const setup=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Import budget test',username:'budget.admin',password:f.password}});
    expect(setup.ok()).toBe(true);const identity=await setup.json();
    const classroom=await page.request.post(f.origin+'/api/online/classes',{headers:{Origin:f.origin,'X-CSRF-Token':identity.csrfToken},data:{name:'Lớp giới hạn tư liệu',grade:3}});expect(classroom.ok()).toBe(true);
    await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
    await page.evaluate(()=>{(window as any).__budgetReads=0;const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){(window as any).__budgetReads++;return original.call(this);};});
    const uploads:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/online/media'))uploads.push(request.url());});
    const input=page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true});
    const files=(count:number,prefix:string)=>Array.from({length:count},(_,index)=>({name:`${prefix}-${index}.png`,mimeType:'image/png',buffer:Buffer.from('metadata-only selection')}));
    await input.setInputFiles(files(101,'too-many'));await expect(page.getByRole('alert')).toContainText('tối đa 100 hình / âm thanh, tổng 32 MB');
    await expect(page.locator('.online-media-list')).toHaveCount(0);
    await input.setInputFiles(files(80,'pending'));await expect(page.locator('.online-media-list>li')).toHaveCount(80);
    await input.setInputFiles(files(21,'added'));await expect(page.getByRole('alert')).toContainText('các tệp đã chọn trước đó vẫn được giữ');
    await expect(page.locator('.online-media-list>li')).toHaveCount(80);await expect(page.locator('.online-media-list')).not.toContainText('added-');
    expect(await page.evaluate(()=>(window as any).__budgetReads)).toBe(0);expect(uploads).toEqual([]);expect(f.objects.size).toBe(0);
  }finally{await f.close();}
});

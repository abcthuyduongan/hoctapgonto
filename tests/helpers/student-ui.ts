import {expect,type Page} from '@playwright/test';
/** Exercise the default DOM hub; graphics are tested separately as an opt-in. */
export async function startAssignedGame(page:Page,world:string){
 const light=page.getByRole('button',{name:'Chế độ nhẹ',exact:true});if(await light.isVisible())await light.click();
 const labels:Record<string,string>={'Đảo Câu Hỏi':'Đảo Câu Hỏi','Khu Rừng Trí Nhớ':'Memory Match','Xưởng Ghép Câu':'Sentence Builder','Đảo Nối Từ':'Nối Từ Khám Phá','Bậc Thang Quy Luật':'Bậc Thang Quy Luật'};
 await page.getByRole('button',{name:`Chơi ${labels[world]??world} bằng bộ được giao`,exact:true}).click();
 await expect(page.locator('.immersive-dialog .play-panel')).toBeVisible();
 await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
}

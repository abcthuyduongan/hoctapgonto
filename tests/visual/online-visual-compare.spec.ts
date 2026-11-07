import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const VIEWPORTS = [
  { name: 'small-mobile', width: 320, height: 640 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.describe('A2 & B12 · Responsive screenshots and viewport reflow', () => {
  test('capture five viewports and verify keyboard entry at 640x480; native browser zoom requires a separate trial', async ({ page },testInfo) => {
    const f = await cloudBrowserFixture();
    const snapshotDir = join(process.cwd(), 'test-results', 'visual-snapshots',testInfo.project.name);
    await mkdir(snapshotDir, { recursive: true });

    async function api(route: string, data: unknown, csrf = '') {
      const r = await page.request.post(f.origin + '/api/online' + route, {
        headers: { Origin: f.origin, ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        data,
      });
      expect(r.ok(), await r.text()).toBe(true);
      return r.json();
    }

    try {
    // Setup class and student
    const admin = await api('/setup', {
      token: f.token,
      name: 'Trường Tiểu Học Visual',
      username: 'admin.visual',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Visual', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An Visual', username: 'student.visual', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Màn Đăng nhập (Login)
      await page.context().clearCookies();
      await page.goto(f.origin + '/?online=1');
      await expect(page.locator('form')).toBeVisible({ timeout: 15000 });
      await page.screenshot({
        path: join(snapshotDir, `01-login-${vp.name}-${vp.width}.png`),
        fullPage: true,
      });

      // 2. Màn Mẫu thành phần chung (?ui=1)
      await page.goto(f.origin + '/?ui=1');
      await expect(page.locator('h1')).toContainText('Hệ thống thành phần chung');
      await page.screenshot({
        path: join(snapshotDir, `02-ui-showcase-${vp.name}-${vp.width}.png`),
        fullPage: true,
      });

      // 3. Màn Học sinh (Student World)
      await page.context().clearCookies();
      await api('/login', { username: 'student.visual', password: f.password });
      await page.goto(f.origin + '/?online=1');
      await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
      if (vp.width === 320) {
        // Verify no horizontal overflow at 320px (NV02)
        const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        expect(hasHScroll).toBe(false);
      }
      await page.screenshot({
        path: join(snapshotDir, `03-student-world-${vp.name}-${vp.width}.png`),
        fullPage: true,
      });
    }

    // Reflow at half a desktop viewport is not a native browser zoom measurement.
    await page.setViewportSize({ width: 640, height: 480 });
    await page.goto(f.origin + '/?online=1');
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link',{name:'Bảo An Learning - Về trang chủ',exact:true})).toBeFocused();
    await page.screenshot({
      path: join(snapshotDir, `04-student-reflow-640x480.png`),
      fullPage: true,
    });

    console.log('Visual snapshots captured successfully across all viewports in test-results/visual-snapshots');
    } finally {await f.close();}
  });
});

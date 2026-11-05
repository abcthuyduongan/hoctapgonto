import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 10 Cổng C10: Kiểm Thử Truy Cập Dễ Dàng (A11y) & Quét Tự Động axe-core', async ({page}) => {
  const f = await cloudBrowserFixture();

  async function api(route: string, data: unknown, csrf = '') {
    const r = await page.request.post(f.origin + '/api/online' + route, {
      headers: {Origin: f.origin, ...(csrf ? {'X-CSRF-Token': csrf} : {})},
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  }

  try {
    // 1. Setup workspace & class
    const admin = await api('/setup', {
      token: f.token,
      name: 'Trường Tiểu Học A11y',
      username: 'admin.a11y',
      password: f.password,
    });
    const cls = await api('/classes', {name: 'Lớp 3A A11y', grade: 3}, admin.csrfToken);

    // 2. Create student
    const st = await api(
      '/students',
      {name: 'Bảo An A11y', username: 'student.a11y', password: f.password, classId: cls.id},
      admin.csrfToken
    );

    // 3. Log in student via API and navigate
    await page.context().clearCookies();
    await api('/login', {username: 'student.a11y', password: f.password});
    await page.goto(f.origin + '/?online=1&controls=1');

    // Wait for World Map to load
    await expect(page.locator('.online-student')).toBeVisible({timeout: 15000});

    // 4. Scan Screen 1: World Map with axe-core
    console.log('Scanning OnlineStudentWorld for A11y violations...');
    const mapScan = await new AxeBuilder({page})
      .disableRules(['color-contrast'])
      .analyze();

    const mapCritical = mapScan.violations.filter(v => ['critical', 'serious'].includes(v.impact));
    if (mapCritical.length > 0) {
      console.error('Axe critical violations on Map:', JSON.stringify(mapCritical, null, 2));
    }
    expect(mapCritical).toEqual([]);

    // 5. Test keyboard navigation: Focus Town button and press Enter
    const townBtn = page.getByRole('button', {name: /Thị trấn/i});
    await expect(townBtn).toBeVisible();
    await townBtn.focus();
    await page.keyboard.press('Enter');

    // 6. Scan Screen 2: Town Screen
    await expect(page.getByText('Thị trấn của con')).toBeVisible({timeout: 10000});
    console.log('Scanning TownScreen for A11y violations...');
    const townScan = await new AxeBuilder({page})
      .disableRules(['color-contrast'])
      .analyze();

    const townCritical = townScan.violations.filter(v => ['critical', 'serious'].includes(v.impact));
    if (townCritical.length > 0) {
      console.error('Axe critical violations on Town:', JSON.stringify(townCritical, null, 2));
    }
    expect(townCritical).toEqual([]);

    // 7. Test Zoom 200% Layout Integrity (640x480 viewport)
    await page.setViewportSize({width: 640, height: 480});
    await expect(page.getByText('Thị trấn của con')).toBeVisible();
    await expect(page.locator('.town-material-bar')).toBeVisible();

    // 8. Return to World Map
    await page.setViewportSize({width: 1440, height: 1000});
    const returnBtn = page.getByRole('button', {name: /Quay lại bản đồ/i});
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();
    await expect(page.locator('.online-header')).toBeVisible();

    // 9. Verify all images in main view have alt attributes
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.hasAttribute('alt') || img.getAttribute('alt') === null).length;
    });
    expect(imagesWithoutAlt).toBe(0);

    console.log('A11y Verification PASS: 0 critical/serious violations, keyboard focus, 200% zoom integrity, valid image alts.');
  } finally {
    await f.close();
  }
});

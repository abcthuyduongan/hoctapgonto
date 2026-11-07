import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 6 Cổng C6: Khu Phụ Huynh, Báo Cáo Tuần, Bảo Vệ PIN, Giới Hạn Giờ Học & Duyệt Đổi Quà', async ({ page }) => {
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));
  page.on('response', res => { if (res.url().includes('/api/online/')) console.log(`[API RESP] ${res.status()} ${res.url()}`); });
  const f = await cloudBrowserFixture();
  async function api(route: string, data: unknown, csrf = '') {
    if (route === '/weeks') {
      await seedLegacyApiWeek(f.store, await (await page.request.get(f.origin + '/api/online/me')).json(), data);
    }
    const r = await page.request.post(f.origin + '/api/online' + route, {
      headers: { Origin: f.origin, ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  }

  try {
    // 1. Setup workspace & class
    const admin = await api('/setup', {
      token: f.token,
      name: 'Trường Tiểu Học Bảo An',
      username: 'admin.tuan6',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A', grade: 3 }, admin.csrfToken);
    const studentRes = await api(
      '/students',
      { name: 'Bảo An', username: 'student.tuan6', password: f.password, classId: cls.id },
      admin.csrfToken
    );
    const student = studentRes.student;

    // Seed weekly learning packs
    await api('/weeks', {
      requestId: 't6-week-1',
      title: 'Tuần 1 Học Vui',
      classId: cls.id,
      sets: [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: 'pack-t6-math',
            version: 1,
            title: 'Phép nhân & Phép chia',
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: 'q-t6-1',
                objectiveId: 'MATH.1',
                kind: 'multiple-choice',
                prompt: '6 × 7 = ?',
                options: ['42', '40', '48', '36'],
                correctIndex: 0,
                explanation: '6 × 7 = 42',
              },
              {
                id: 'q-t6-2',
                objectiveId: 'MATH.1',
                kind: 'multiple-choice',
                prompt: '54 : 9 = ?',
                options: ['6', '7', '5', '8'],
                correctIndex: 0,
                explanation: '54 : 9 = 6',
              },
            ],
          },
        },
        {
          subjectLabel: 'Tiếng Việt',
          pack: {
            id: 'pack-t6-viet',
            version: 1,
            title: 'Từ ngữ chỉ tính chất',
            kind: 'quiz',
            subject: 'vietnamese',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: 'q-t6-v1',
                objectiveId: 'VIET.1',
                kind: 'multiple-choice',
                prompt: 'Từ nào chỉ vẻ đẹp của thiên nhiên?',
                options: ['Hùng vĩ', 'Chăm chỉ', 'Dũng cảm', 'Thật thà'],
                correctIndex: 0,
                explanation: 'Hùng vĩ chỉ cảnh đẹp thiên nhiên',
              },
              {
                id: 'q-t6-v2',
                objectiveId: 'VIET.1',
                kind: 'multiple-choice',
                prompt: 'Từ nào chỉ phẩm chất con người?',
                options: ['Chăm chỉ', 'Bao la', 'Xanh ngắt', 'Rộng lớn'],
                correctIndex: 0,
                explanation: 'Chăm chỉ là phẩm chất',
              },
            ],
          },
        },
      ],
    }, admin.csrfToken);

    // 2. Student login & views student world
    await page.context().clearCookies();
    await api('/login', { username: 'student.tuan6', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });

    // Verify "👨‍👩‍👧 Phụ huynh" button exists on student screen
    const parentBtn = page.locator('button.parent-portal-pill-btn');
    await expect(parentBtn).toBeVisible();

    // Click "👨‍👩‍👧 Phụ huynh" opens PIN dialog
    await parentBtn.click();
    const pinDialog = page.locator('.parent-pin-dialog');
    await expect(pinDialog).toBeVisible();
    await expect(pinDialog).toContainText('Thiết lập mã PIN phụ huynh');

    // Click numeric keypad digits to setup 6-digit PIN: 1, 2, 3, 4, 5, 6
    await pinDialog.locator('.parent-key-btn:has-text("1")').click();
    await pinDialog.locator('.parent-key-btn:has-text("2")').click();
    await pinDialog.locator('.parent-key-btn:has-text("3")').click();
    await pinDialog.locator('.parent-key-btn:has-text("4")').click();
    await pinDialog.locator('.parent-key-btn:has-text("5")').click();
    await pinDialog.locator('.parent-key-btn:has-text("6")').click();

    // Click "Tiếp tục"
    await pinDialog.locator('.parent-pin-submit').click();
    await expect(pinDialog).toContainText('Xác nhận lại mã PIN');

    // Enter confirmation PIN: 1, 2, 3, 4, 5, 6
    await pinDialog.locator('.parent-key-btn:has-text("1")').click();
    await pinDialog.locator('.parent-key-btn:has-text("2")').click();
    await pinDialog.locator('.parent-key-btn:has-text("3")').click();
    await pinDialog.locator('.parent-key-btn:has-text("4")').click();
    await pinDialog.locator('.parent-key-btn:has-text("5")').click();
    await pinDialog.locator('.parent-key-btn:has-text("6")').click();

    // Click "Xác nhận"
    await pinDialog.locator('.parent-pin-submit').click();

    // PIN is set and Parent Portal screen opens!
    const parentPortal = page.locator('.parent-portal-root');
    await expect(parentPortal).toBeVisible({ timeout: 10000 });
    await expect(parentPortal.locator('.parent-header h1')).toContainText('Khu Phụ Huynh Bảo An');

    // 3. Verify Weekly Report tab
    await expect(parentPortal.locator('.parent-report-view')).toBeVisible();
    await expect(parentPortal.locator('.report-cards-grid')).toBeVisible();
    await expect(parentPortal.locator('.stat-card-label:has-text("Phút học trong tuần")')).toBeVisible();
    await expect(parentPortal.locator('.stat-card-label:has-text("Đúng ngay lần đầu")')).toBeVisible();
    await expect(parentPortal.locator('.daily-bars-container')).toBeVisible();
    await expect(parentPortal.locator('button.parent-btn-print')).toBeVisible();

    // 4. Switch to Gift Approval tab
    await parentPortal.locator('button.parent-tab-btn:has-text("Duyệt đổi quà")').click();
    await expect(parentPortal.locator('h2:has-text("Duyệt đổi quà cho")')).toBeVisible();

    // 5. Switch to Settings tab
    await parentPortal.locator('button.parent-tab-btn:has-text("Giờ học & Mã PIN")').click();
    await expect(parentPortal.locator('h3:has-text("Giới hạn thời gian học mỗi ngày")')).toBeVisible();

    // Set daily limit to 45 minutes using preset button and save
    await parentPortal.locator('button.preset-btn:has-text("45 phút")').click();
    await parentPortal.locator('button:has-text("Lưu cài đặt thời gian")').click();
    await expect(parentPortal.locator('.online-success')).toContainText('Đã lưu cài đặt thời gian');

    // 6. Close Parent Portal to return to student world
    await parentPortal.locator('button.parent-btn-back').click();
    await expect(parentPortal).not.toBeVisible();
    await expect(page.locator('.online-student')).toBeVisible();

    // 7. Verify opening Parent Portal now asks for verification PIN
    await parentBtn.click();
    await expect(pinDialog).toBeVisible();
    await expect(pinDialog).toContainText('Khu vực dành cho Phụ huynh');

    // Enter wrong PIN: 999999
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-key-btn:has-text("9")').click();
    await pinDialog.locator('.parent-pin-submit').click();
    await expect(pinDialog.locator('.online-notice.online-error')).toContainText('Sai mã PIN');

    // Enter correct PIN: 123456
    // Click C to clear
    await pinDialog.locator('.parent-key-btn:has-text("C")').click();
    await pinDialog.locator('.parent-key-btn:has-text("1")').click();
    await pinDialog.locator('.parent-key-btn:has-text("2")').click();
    await pinDialog.locator('.parent-key-btn:has-text("3")').click();
    await pinDialog.locator('.parent-key-btn:has-text("4")').click();
    await pinDialog.locator('.parent-key-btn:has-text("5")').click();
    await pinDialog.locator('.parent-key-btn:has-text("6")').click();
    await pinDialog.locator('.parent-pin-submit').click();

    await expect(parentPortal).toBeVisible({ timeout: 10000 });
  } finally {
    await f.close();
  }
});

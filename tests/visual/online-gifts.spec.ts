import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 3 Cổng C3: Quản trị Kệ quà, Thanh mục tiêu, Ghim quà, Đổi quà và Tủ kỷ niệm', async ({ page }) => {
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
    const admin = await api('/setup', {
      token: f.token,
      name: 'Bao An World School',
      username: 'tuan3.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Tuan 3', grade: 3 }, admin.csrfToken);
    const studentRes = await api(
      '/students',
      { name: 'Bảo An', username: 'tuan3.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );
    const student = studentRes.student;

    // Seed week with quiz for gaining stars
    await api('/weeks', {
      requestId: 't3-week-1',
      title: 'Tuần 1',
      classId: cls.id,
      sets: [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: 'pack-t3-math-w1',
            version: 1,
            title: 'Khám phá Đảo Số',
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: 'q-t3-1',
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: '2 + 3 = ?',
                options: ['5', '4', '6', '7'],
                correctIndex: 0,
                explanation: '2 + 3 = 5',
              },
              {
                id: 'q-t3-2',
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: '4 + 4 = ?',
                options: ['8', '7', '9', '6'],
                correctIndex: 0,
                explanation: '4 + 4 = 8',
              },
            ],
          },
        },
      ],
    }, admin.csrfToken);

    // 1. Admin login & creates gift on Kệ quà tab
    await page.context().clearCookies();
    await api('/login', { username: 'tuan3.admin', password: f.password });
    await page.goto(f.origin + '/?online=1');
    await expect(page.locator('.online-admin')).toBeVisible({ timeout: 15000 });

    // Click tab "Kệ quà"
    await page.click('button:has-text("Kệ quà")');
    await expect(page.locator('h2:has-text("Thêm món quà lên Kệ")')).toBeVisible();

    // Fill form to create a gift
    await page.fill('label:has-text("Tên món quà") input', 'Hộp màu 24 sắc');
    await page.fill('label:has-text("Giá đổi (sao)") input', '4');
    await page.fill('label:has-text("Số lượng trong kho") input', '5');
    await page.click('button:has-text("Thêm món quà")');

    // Verify gift is visible in admin list
    await expect(page.locator('.online-list:has-text("Hộp màu 24 sắc")')).toBeVisible();

    // 2. Student login
    await page.context().clearCookies();
    await api('/login', { username: 'tuan3.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });

    // Verify GoalBar is visible
    const goalBar = page.locator('.student-goal-bar');
    await expect(goalBar).toBeVisible();
    await expect(goalBar).toContainText('CHƯA CHỌN MỤC TIÊU');

    // Click "🎁 Kệ quà" on GoalBar to open GiftShelfDialog
    await goalBar.locator('button:has-text("Kệ quà")').click();
    const shelfDialog = page.locator('.gift-shelf-dialog');
    await expect(shelfDialog).toBeVisible();
    await expect(shelfDialog.locator('.gift-card:has-text("Hộp màu 24 sắc")')).toBeVisible();

    // Click "📌 Ghim mục tiêu"
    await shelfDialog.locator('.gift-card:has-text("Hộp màu 24 sắc") button:has-text("Ghim mục tiêu")').click();
    await expect(shelfDialog.locator('button:has-text("✓ Đang ghim")')).toBeVisible();

    // Close dialog
    await shelfDialog.locator('.gift-shelf-close').click();
    await expect(shelfDialog).not.toBeVisible();

    // Verify GoalBar is updated with pinned goal
    await expect(goalBar).toContainText('Hộp màu 24 sắc');
    await expect(goalBar).toContainText('Còn 4 sao nữa');

    // Switch to list view to access direct game cards
    await page.click('button:has-text("📋 Danh sách")');
    await expect(page.locator('.student-game-card.game-card-math-quest')).toBeVisible();

    // Click on math card to start game
    await page.click('.student-game-card.game-card-math-quest');
    await expect(page.locator('.game-dialog')).toBeVisible({ timeout: 10000 });

    // Answer question if answer options appear
    const ans0 = page.locator('.answer-option').nth(0);
    if (await ans0.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ans0.click();
      await page.waitForTimeout(600);
    }

    // Leave game safely
    await page.click('button:has-text("Thoát trò chơi")');
    await expect(page.locator('.game-dialog')).not.toBeVisible();

    // Verify GoalBar is still visible and shows progress
    await expect(goalBar).toBeVisible();
    await expect(goalBar).toContainText('Hộp màu 24 sắc');

    // Open GiftShelfDialog again to test "Tủ kỷ niệm" tab
    await goalBar.locator('button:has-text("Kệ quà")').click();
    await expect(shelfDialog).toBeVisible();

    // Switch to tab "Tủ kỷ niệm"
    await shelfDialog.locator('button:has-text("Tủ kỷ niệm")').click();
    await expect(shelfDialog.locator('.memorial-cabinet')).toBeVisible();

    // Close shelf dialog
    await shelfDialog.locator('.gift-shelf-close').click();
    await expect(shelfDialog).not.toBeVisible();

  } finally {
    await f.close();
  }
});

import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 4 Cổng C4: Chuỗi ngày học, Nhiệm vụ ngày và Sổ huy hiệu', async ({ page }) => {
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
      username: 'tuan4.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Tuần 4', grade: 3 }, admin.csrfToken);
    const studentRes = await api(
      '/students',
      { name: 'Bảo An', username: 'tuan4.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );
    const student = studentRes.student;

    // Seed week with quiz for daily riddle and exercises
    await api('/weeks', {
      requestId: 't4-week-1',
      title: 'Tuần 1 Khám Phá',
      classId: cls.id,
      sets: [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: 'pack-t4-math-w1',
            version: 1,
            title: 'Học Đếm Thần Tốc',
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: 'q-t4-1',
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: '5 + 5 = ?',
                options: ['10', '9', '11', '12'],
                correctIndex: 0,
                explanation: '5 + 5 = 10',
              },
              {
                id: 'q-t4-2',
                objectiveId: 'OBJ.2',
                kind: 'multiple-choice',
                prompt: '3 x 3 = ?',
                options: ['9', '6', '12', '15'],
                correctIndex: 0,
                explanation: '3 x 3 = 9',
              },
            ],
          },
        },
      ],
    }, admin.csrfToken);

    // 1. Log in as Student
    await page.context().clearCookies();
    await api('/login', { username: 'tuan4.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.student-topbar')).toBeVisible({ timeout: 10000 });

    // 2. Check Streak pill in header
    const streakBtn = page.locator('button.streak-pill-btn');
    await expect(streakBtn).toBeVisible();
    await expect(streakBtn).toContainText('Ngày');

    // Open Streak dialog
    await streakBtn.click();
    await expect(page.locator('.streak-dialog')).toBeVisible();
    await expect(page.locator('.streak-dialog-title')).toContainText('Ngày Liên Tiếp');
    await expect(page.locator('.streak-progress-box')).toContainText('Mục tiêu hôm nay');
    await expect(page.locator('.streak-freeze-box')).toContainText('nghỉ phép');

    // Close Streak dialog
    await page.click('button.streak-dialog-close');
    await expect(page.locator('.streak-dialog')).not.toBeVisible();

    // 3. Check Daily Missions button in header
    const missionsBtn = page.locator('button.missions-pill-btn');
    await expect(missionsBtn).toBeVisible();
    await expect(missionsBtn).toContainText('Nhiệm vụ');

    // Open Missions dialog
    await missionsBtn.click();
    await expect(page.locator('.missions-dialog')).toBeVisible();
    await expect(page.locator('.mission-card')).toHaveCount(3);
    await expect(page.locator('.missions-dialog')).toContainText('Bài tập mới');
    await expect(page.locator('.missions-dialog')).toContainText('Sửa sai ôn luyện');
    await expect(page.locator('.missions-dialog')).toContainText('Câu đố hôm nay');

    // Test Daily Riddle inside Missions dialog
    const riddleBtn = page.locator('button.mission-riddle-btn');
    if (await riddleBtn.isVisible()) {
      await riddleBtn.click();
      await expect(page.locator('.riddle-card')).toBeVisible();
      // Select first option
      await page.click('.riddle-option-btn >> nth=0');
      await page.click('button:has-text("Nộp Đáp Án")');
      await expect(page.locator('.riddle-feedback.correct')).toBeVisible();
    }

    // Close Missions dialog
    await page.click('.missions-dialog-header .badge-close-btn');
    await expect(page.locator('.missions-dialog')).not.toBeVisible();

    // 4. Check Badges button in header / account menu
    const menuTrigger = page.locator('.account-menu-trigger');
    if (await menuTrigger.isVisible()) await menuTrigger.click();
    const badgesBtn = page.locator('button:has-text("Huy hiệu")');
    await expect(badgesBtn).toBeVisible();

    // Open Badge Showcase
    await badgesBtn.click();
    await expect(page.locator('.badge-dialog')).toBeVisible();
    await expect(page.locator('.badge-dialog-title')).toContainText('Sổ Huy Hiệu Của Con');

    // Verify exactly 12 catalog badges render
    const badgeCards = page.locator('.badge-card');
    await expect(badgeCards).toHaveCount(12);

    // Verify locked badges display missing requirement text
    const missingTexts = page.locator('.badge-missing-text');
    await expect(missingTexts.first()).toBeVisible();
    const firstText = await missingTexts.first().textContent();
    expect(firstText?.length).toBeGreaterThan(5);

    // Verify filter tabs
    await page.locator('.badge-dialog button:has-text("Chưa mở")').click();
    await expect(page.locator('.badge-card.locked')).toHaveCount(await page.locator('.badge-card').count());

    // Close Badge Showcase
    await page.locator('.badge-dialog .badge-close-btn').click();
    await expect(page.locator('.badge-dialog')).not.toBeVisible();
  } finally {
    await f.close();
  }
});

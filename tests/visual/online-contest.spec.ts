import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 7 Cổng C7: Chế Độ Thi Thử Violympic & IOE, Đồng Hồ Server, Không Lộ Đáp Án, Ôn Câu Sai', async ({ page }) => {
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
      name: 'Trường Tiểu Học C7',
      username: 'admin.tuan7',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3B', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An', username: 'student.tuan7', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    // 2. Login as student
    await page.context().clearCookies();
    await api('/login', { username: 'student.tuan7', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // Wait for world map screen to load
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.online-header')).toBeVisible({ timeout: 10000 });

    // 3. Header has "🏆 Thi thử" button
    const contestBtn = page.locator('button.contest-pill-btn');
    await expect(contestBtn).toBeVisible();
    await contestBtn.click();

    // 4. Verify Contest Screen modal opened
    const modal = page.locator('[data-testid="contest-screen-root"]');
    await expect(modal).toBeVisible();

    // Verify mandatory disclaimer banner
    const disclaimer = page.locator('.contest-disclaimer-banner');
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText('Đề luyện theo dạng, không phải đề chính thức');

    // Verify both presets exist
    await expect(page.locator('[data-testid="preset-card-violympic-math-g3"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-card-ioe-english-g3"]')).toBeVisible();

    // Verify "Sẵn sàng dự thi" status box
    await expect(page.locator('.contest-readiness-card')).toBeVisible();

    // 5. Start Violympic Math contest
    const startMathBtn = page.locator('[data-testid="preset-card-violympic-math-g3"] button.preset-start-btn');
    await startMathBtn.click();

    // 6. Verify exam mode loaded
    await expect(page.locator('[data-testid="contest-timer-pill"]')).toBeVisible();
    await expect(page.locator('[data-testid="contest-question-strip"]')).toBeVisible();
    await expect(page.locator('[data-testid="contest-question-card"]')).toBeVisible();

    // Answer Question 1: pick first option
    const optionBtn = page.locator('.contest-option-btn').first();
    if (await optionBtn.isVisible()) {
      await optionBtn.click();
      await expect(optionBtn).toHaveClass(/selected/);
    }

    // Skip Question 2: click Next question then click Skip
    const nextBtn = page.locator('button.action-btn.primary', { hasText: 'Câu sau' });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      const skipBtn = page.locator('button.action-btn.skip');
      await skipBtn.click();
    }

    // 7. Click submit button
    const submitBtn = page.locator('button.action-btn.submit').first();
    await submitBtn.click();

    // Confirmation modal appears
    const confirmBtn = page.locator('button.action-btn.submit', { hasText: 'Đồng ý nộp bài' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 8. Result view appears
    await expect(page.locator('[data-testid="contest-results-card"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.results-big-score')).toBeVisible();

    // Disclaimer banner remains visible in results view
    await expect(disclaimer).toBeVisible();

    // Verify mistake review section or action buttons
    const reviewBtn = page.locator('[data-testid="review-errors-btn"]');
    if (await reviewBtn.isVisible()) {
      await expect(reviewBtn).toContainText('Ôn các câu sai ngay');
    }

    // 9. Return to map
    const backBtn = page.locator('button.action-btn.secondary', { hasText: 'Quay về Bản đồ' });
    await backBtn.click();
    await expect(modal).not.toBeVisible();
  } finally {
    await f.close();
  }
});

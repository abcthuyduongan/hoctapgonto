import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 9 Cổng C9: Hàng Xóm Động Vật, Thăm Thị Trấn Bạn, Nút Cổ Vũ, và Bảng Tin Lớp', async ({ page }) => {
  const f = await cloudBrowserFixture();

  async function api(route: string, data: unknown, csrf = '') {
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
      name: 'Trường Tiểu Học Tuần 9',
      username: 'admin.tuan9',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Tuần 9', grade: 3 }, admin.csrfToken);

    // 2. Create 2 students in the same class
    const st1 = await api(
      '/students',
      { name: 'Bảo An', username: 'student1.tuan9', password: f.password, classId: cls.id },
      admin.csrfToken
    );
    const st2 = await api(
      '/students',
      { name: 'Minh Quân', username: 'student2.tuan9', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    // 3. Login as student 1 (Bảo An)
    await page.context().clearCookies();
    await api('/login', { username: 'student1.tuan9', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // Wait for world map screen to load
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });

    // 4. Open TownScreen
    const townBtn = page.getByRole('button', { name: /Thị trấn/i });
    await expect(townBtn).toBeVisible();
    await townBtn.click();

    // Verify TownScreen loaded
    await expect(page.locator('.town-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.town-grid-10')).toBeVisible();

    // 5. Test "🐾 Bạn nhỏ" (Animal Neighbors Modal)
    const animalBtn = page.getByRole('button', { name: /Bạn nhỏ/i });
    await expect(animalBtn).toBeVisible();
    await animalBtn.click();

    // Dialog appears
    await expect(page.getByText('Hàng Xóm Động Vật Của Con')).toBeVisible();
    // Close modal
    await page.getByRole('button', { name: 'Đóng lại' }).click();
    await expect(page.getByText('Hàng Xóm Động Vật Của Con')).not.toBeVisible();

    // 6. Test "📢 Bảng tin" (Class Bulletin Feed Dialog)
    const feedBtn = page.getByRole('button', { name: /Bảng tin/i });
    await expect(feedBtn).toBeVisible();
    await feedBtn.click();

    // Feed dialog appears
    await expect(page.getByText('Bảng Tin Lớp Học')).toBeVisible();
    // Close feed dialog
    await page.locator('.class-feed-modal .town-catalog-close').click();
    await expect(page.getByText('Bảng Tin Lớp Học')).not.toBeVisible();

    // 7. Test "👥 Thăm bạn" (Classmates Towns Modal & Visit)
    const classmatesBtn = page.getByRole('button', { name: /Thăm bạn/i });
    await expect(classmatesBtn).toBeVisible();
    await classmatesBtn.click();

    // Modal appears, listing classmate Minh Quân
    await expect(page.getByText('Thị Trấn Bạn Cùng Lớp')).toBeVisible();
    await expect(page.getByText('Minh Quân')).toBeVisible();

    // Click "Ghé thăm ➜" to visit Minh Quân's town
    const visitBtn = page.getByRole('button', { name: /Ghé thăm ➜/i });
    await expect(visitBtn).toBeVisible();
    await visitBtn.click();

    // Visit view appears
    await expect(page.locator('.town-title')).toContainText('Minh Quân');
    await expect(page.getByText('Chế độ chỉ xem')).toBeVisible();

    // 8. Test Cheer Button
    const cheerBtn = page.getByRole('button', { name: /Cổ vũ bạn ngay!/i }).first();
    await expect(cheerBtn).toBeVisible();
    await cheerBtn.click();

    // Button updates to "Đã cổ vũ hôm nay"
    await expect(page.getByText('Đã cổ vũ bạn hôm nay')).toBeVisible();

    // 9. Return to own town
    const returnBtn = page.getByRole('button', { name: /Về thị trấn của mình/i }).first();
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Back to own town
    await expect(page.getByText('Thị trấn của con')).toBeVisible();

    // 10. Close TownScreen back to world map
    await page.getByRole('button', { name: /Quay lại bản đồ/i }).click();
    await expect(page.locator('.student-topbar')).toBeVisible();
  } finally {
    await f.close();
  }
});

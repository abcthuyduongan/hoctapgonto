import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 8 Cổng C8: Thị Trấn Của Con, Lưới 10x10, Vật Liệu Theo Môn, An Toàn Ví Sao, 12 Công Trình', async ({ page }) => {
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));
  page.on('response', res => { if (res.url().includes('/api/online/')) console.log(`[API RESP] ${res.status()} ${res.url()}`); });

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
    // 1. Setup workspace, class & student
    const admin = await api('/setup', {
      token: f.token,
      name: 'Trường Tiểu Học C8',
      username: 'admin.tuan8',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3C', grade: 3 }, admin.csrfToken);
    const st = await api(
      '/students',
      { name: 'Bảo An', username: 'student.tuan8', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    // 2. Insert initial awards and materials into DB for student
    await f.store.exec(
      'INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [admin.user.workspaceId, st.student.id, 'm_wood_10', null, 'wood', 10, 'award', 'award_wood_10', new Date().toISOString()]
    );
    await f.store.exec(
      'INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [admin.user.workspaceId, st.student.id, 'm_stone_10', null, 'stone', 10, 'award', 'award_stone_10', new Date().toISOString()]
    );

    // 3. Login as student
    await page.context().clearCookies();
    await api('/login', { username: 'student.tuan8', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // Wait for world map screen to load
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.student-topbar')).toBeVisible({ timeout: 10000 });

    // 4. Header has "🏡 Thị trấn" button (unique role & accessible name)
    const townBtn = page.getByRole('button', { name: 'Mở thị trấn của con' });
    await expect(townBtn).toBeVisible();
    await townBtn.click();

    // 5. Verify Town Screen dialog opened with accessible role
    const townScreen = page.getByRole('dialog', { name: 'Thị trấn của con' });
    await expect(townScreen).toBeVisible();

    // Verify Star Protection Pill
    const starPill = page.locator('.town-star-pill');
    await expect(starPill).toBeVisible();
    await expect(starPill).toContainText('Ví sao');
    await expect(starPill).toContainText('An toàn 100%');

    // Verify Material Chips
    await expect(page.locator('.material-chip.stone')).toBeVisible();
    await expect(page.locator('.material-chip.wood')).toBeVisible();
    await expect(page.locator('.material-chip.fish')).toBeVisible();
    await expect(page.locator('.material-chip.component')).toBeVisible();

    // Verify 10x10 Grid
    const grid = page.locator('.town-grid-10');
    await expect(grid).toBeVisible();
    const cells = grid.locator('.grid-cell');
    await expect(cells).toHaveCount(100);

    // Verify Catalog with 12 buildings
    const catalogCards = page.locator('.building-card');
    await expect(catalogCards).toHaveCount(12);

    // 6. Select first building (Cottage) and place it on cell (2, 2)
    const cottageCard = catalogCards.first();
    await cottageCard.click();
    await expect(cottageCard).toHaveClass(/selected/);

    // Click cell (2, 2) -> index 2*10 + 2 = 22
    const targetCell = cells.nth(22);
    await targetCell.click();

    // Confirmation modal should appear
    const modal = page.locator('.placement-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Xác nhận xây dựng?');

    // Confirm placement
    const confirmBtn = page.locator('.modal-confirm-btn');
    await confirmBtn.click();

    // Building sprite should now be rendered inside the cell
    await expect(targetCell.locator('.building-sprite')).toBeVisible({ timeout: 5000 });

    // 7. Click recalculate button
    const syncBtn = page.getByRole('button', { name: '🔄 Đồng bộ' });
    await syncBtn.click();

    // 8. Close Town Screen and return to map
    const backBtn = page.locator('.town-back-btn');
    await backBtn.click();
    await expect(townScreen).not.toBeVisible();
    await expect(page.locator('.student-topbar')).toBeVisible();
  } finally {
    await f.close();
  }
});

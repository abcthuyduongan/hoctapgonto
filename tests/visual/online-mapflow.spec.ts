import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('UI01-UI04: student map flow renders world map, switches regions, views stage panel, and returns', async ({ page }) => {
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
      name: 'Map Flow School',
      username: 'mapflow.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Map', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An', username: 'mapflow.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    // Create 2 weeks with Math, Vietnamese, English, Computing
    const subjects = [
      { label: 'Toán học', id: 'm' },
      { label: 'Tiếng Việt', id: 'vn' },
      { label: 'Tiếng Anh', id: 'eng' },
      { label: 'Tin học', id: 'comp' },
    ];

    for (let w = 1; w <= 2; w++) {
      const sets = subjects.map((sub) => ({
        subjectLabel: sub.label,
        pack: {
          id: `pack-mapflow-${sub.id}-w${w}`,
          version: 1,
          title: `Bài tập ${sub.label} Tuần ${w}`,
          kind: 'quiz',
          subject: 'math',
          grade: 3,
          source: 'local',
          publishedAt: '2026-10-17T00:00:00Z',
          items: [
            {
              id: `q-mapflow-${sub.id}-${w}-1`,
              objectiveId: 'OBJ.1',
              kind: 'multiple-choice',
              prompt: `Đề bài ${sub.label} ${w}.1`,
              options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
              correctIndex: 0,
              explanation: 'Giải thích bí mật.',
            },
            {
              id: `q-mapflow-${sub.id}-${w}-2`,
              objectiveId: 'OBJ.1',
              kind: 'multiple-choice',
              prompt: `Đề bài ${sub.label} ${w}.2`,
              options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
              correctIndex: 0,
              explanation: 'Giải thích bí mật.',
            },
          ],
        },
      }));

      await api(
        '/weeks',
        { requestId: `mapflow-week-${w}`, classId: cls.id, title: `Tuần ${w}`, sets },
        admin.csrfToken
      );
    }

    // Login as student
    await page.context().clearCookies();
    await api('/login', { username: 'mapflow.child', password: f.password });

    // Navigate to student screen
    await page.goto(f.origin + '/?online=1&controls=1');

    // UI01: World Map is visible
    await expect(page.locator('.world-map-container')).toBeVisible();
    await expect(page.locator('.map-region-anchor')).toHaveCount(4);

    // UI02: Click Math region anchor
    await page.locator('.map-region-anchor.region-math').click();

    // Verify Region Map opens
    await expect(page.locator('.region-map-container')).toBeVisible();
    await expect(page.locator('.region-map-container h2')).toContainText('Toán học');

    // Verify stage nodes are present (Tuần 1 and Tuần 2)
    const stageNodes = page.locator('.map-stage-node');
    await expect(stageNodes).toHaveCount(2);

    // Select Tuần 1 node
    await stageNodes.first().click();

    // Verify MapWeekPanel opens
    await expect(page.locator('.map-week-panel')).toBeVisible();
    await expect(page.locator('.map-week-panel-header h3')).toContainText('Tuần 1');
    await expect(page.locator('.map-set-card')).toHaveCount(1);
    await expect(page.locator('.map-set-title')).toContainText('Bài tập Toán học Tuần 1');

    // Return to World Map
    await page.getByRole('button', { name: /bản đồ thế giới/i }).click();
    await expect(page.locator('.world-map-container')).toBeVisible();

    // UI03: Click "Tiếp tục chuyến đi" button
    const continueBtn = page.getByRole('button', { name: /Tiếp tục chuyến đi/ });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await expect(page.locator('.region-map-container')).toBeVisible();
      await expect(page.locator('.map-week-panel')).toBeVisible();
    }

    // Toggle to collapse map and back
    await page.getByRole('button', { name: /Thu gọn bản đồ|Danh sách/i }).click();
    await expect(page.locator('.world-map-container')).toHaveCount(0);
    await expect(page.locator('.region-map-container')).toHaveCount(0);

    await page.getByRole('button', { name: '🗺️ Bản đồ học tập' }).click();
    await expect(page.locator('.world-map-container, .region-map-container')).toBeVisible();
  } finally {
    await f.close();
  }
});

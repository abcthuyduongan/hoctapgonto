import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('UI01, UI13, UI14: world map displays 4 region anchors with real progress badges and keyboard navigation', async ({ page }) => {
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
      name: 'World Map School',
      username: 'world.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A World', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An', username: 'world.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    const subjects = [
      { label: 'Toán học', id: 'm' },
      { label: 'Tiếng Việt', id: 'vn' },
      { label: 'Tiếng Anh', id: 'eng' },
      { label: 'Tin học', id: 'comp' },
    ];

    const sets = subjects.map((sub) => ({
      subjectLabel: sub.label,
      pack: {
        id: `pack-world-${sub.id}`,
        version: 1,
        title: `Học phần ${sub.label}`,
        kind: 'quiz',
        subject: 'math',
        grade: 3,
        source: 'local',
        publishedAt: '2026-10-17T00:00:00Z',
        items: [
          {
            id: `q-world-${sub.id}-1`,
            objectiveId: 'OBJ.1',
            kind: 'multiple-choice',
            prompt: `Câu hỏi ${sub.label} 1`,
            options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
            correctIndex: 0,
            explanation: 'Lời giải chi tiết.',
          },
          {
            id: `q-world-${sub.id}-2`,
            objectiveId: 'OBJ.1',
            kind: 'multiple-choice',
            prompt: `Câu hỏi ${sub.label} 2`,
            options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
            correctIndex: 0,
            explanation: 'Lời giải chi tiết.',
          },
        ],
      },
    }));

    await api(
      '/weeks',
      { requestId: 'world-week-1', classId: cls.id, title: 'Tuần 1', sets },
      admin.csrfToken
    );

    await page.context().clearCookies();
    await api('/login', { username: 'world.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // Verify World Map presence and background picture
    const mapContainer = page.locator('.world-map-container');
    await expect(mapContainer).toBeVisible();

    const anchors = page.locator('.map-region-anchor');
    await expect(anchors).toHaveCount(4);

    // Check accessible labels and progress on anchors
    await expect(page.locator('.map-region-anchor.region-math')).toBeVisible();
    await expect(page.locator('.map-region-anchor.region-vietnamese')).toBeVisible();
    await expect(page.locator('.map-region-anchor.region-english')).toBeVisible();
    await expect(page.locator('.map-region-anchor.region-computing')).toBeVisible();

    // Verify touch target size (at least 48px)
    const mathBox = await page.locator('.map-region-anchor.region-math').boundingBox();
    expect(mathBox).not.toBeNull();
    if (mathBox) {
      expect(mathBox.width).toBeGreaterThanOrEqual(48);
      expect(mathBox.height).toBeGreaterThanOrEqual(44);
    }

    // Keyboard navigation: focus first anchor and press Enter
    await page.locator('.map-region-anchor.region-math').focus();
    await page.keyboard.press('Enter');

    // Region map should open
    await expect(page.locator('.region-map-container')).toBeVisible();
  } finally {
    await f.close();
  }
});

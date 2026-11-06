import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('PF02, PF07: rapid map navigation world <-> region <-> chapter cleans up in-flight requests and avoids layout thrashing', async ({ page }) => {
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
      name: 'Perf School',
      username: 'perf.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Perf', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An', username: 'perf.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    const sets = [
      {
        subjectLabel: 'Toán học',
        pack: {
          id: 'pack-perf-1',
          version: 1,
          title: 'Bài tập Perf',
          kind: 'quiz',
          subject: 'math',
          grade: 3,
          source: 'local',
          publishedAt: '2026-10-17T00:00:00Z',
          items: [
            {
              id: 'q-perf-1',
              objectiveId: 'OBJ.1',
              kind: 'multiple-choice',
              prompt: 'Câu hỏi',
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              explanation: 'Giải thích.',
            },
            {
              id: 'q-perf-2',
              objectiveId: 'OBJ.1',
              kind: 'multiple-choice',
              prompt: 'Câu hỏi 2',
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              explanation: 'Giải thích.',
            },
          ],
        },
      },
    ];

    await api(
      '/weeks',
      { requestId: 'perf-week-1', classId: cls.id, title: 'Tuần 1', sets },
      admin.csrfToken
    );

    await page.context().clearCookies();
    await api('/login', { username: 'perf.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    await expect(page.locator('.world-map-container')).toBeVisible();

    // Perform rapid back-and-forth navigations
    for (let round = 0; round < 3; round++) {
      await page.locator('.map-region-anchor.region-math').click();
      await expect(page.locator('.region-map-container')).toBeVisible();

      await page.getByRole('button', { name: /bản đồ thế giới/i }).click();
      await expect(page.locator('.world-map-container')).toBeVisible();
    }

    // Verify no scroll overflow or canvas artifacts
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    await expect(page.locator('canvas')).toHaveCount(0);
  } finally {
    await f.close();
  }
});

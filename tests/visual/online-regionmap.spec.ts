import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('UI04, UI05, UI06: region map renders 7-slot chapter layout, landmark stages, and chapter tabs', async ({ page }) => {
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
      name: 'Region Map School',
      username: 'region.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Region', grade: 3 }, admin.csrfToken);
    await api(
      '/students',
      { name: 'Bảo An', username: 'region.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    // Create 8 weeks to have 2 chapters (chapter 1 has 7 slots, chapter 2 has slot 1)
    for (let w = 1; w <= 8; w++) {
      const sets = [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: `pack-reg-m-w${w}`,
            version: 1,
            title: `Toán Tuần ${w}`,
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: `q-reg-${w}-1`,
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: `Câu ${w}.1`,
                options: ['A', 'B', 'C', 'D'],
                correctIndex: 0,
                explanation: 'Giải thích.',
              },
              {
                id: `q-reg-${w}-2`,
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: `Câu ${w}.2`,
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
        { requestId: `reg-week-${w}`, classId: cls.id, title: `Tuần ${w}`, sets },
        admin.csrfToken
      );
    }

    await page.context().clearCookies();
    await api('/login', { username: 'region.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // Click Math region
    await page.locator('.map-region-anchor.region-math').click();
    await expect(page.locator('.region-map-container')).toBeVisible();

    // Verify Chapter 1 has 7 stage nodes
    const stageNodes = page.locator('.map-stage-node');
    await expect(stageNodes).toHaveCount(7);

    // Verify Chapter navigation bar exists and has Chapter 1 and Chapter 2
    const chapterNav = page.locator('.chapter-nav-bar');
    await expect(chapterNav).toBeVisible();
    await expect(page.locator('.chapter-btn')).toHaveCount(2);

    // Switch to Chapter 2
    await page.getByRole('button', { name: 'Chương 2' }).click();
    await expect(page.locator('.map-stage-node')).toHaveCount(1);
    await expect(page.locator('.map-stage-node')).toContainText('Tuần 8');

    // Return to Chapter 1
    await page.getByRole('button', { name: 'Chương 1' }).click();
    await expect(page.locator('.map-stage-node')).toHaveCount(7);

    // Back to World Map
    await page.getByRole('button', { name: /bản đồ thế giới/i }).click();
    await expect(page.locator('.world-map-container')).toBeVisible();
  } finally {
    await f.close();
  }
});

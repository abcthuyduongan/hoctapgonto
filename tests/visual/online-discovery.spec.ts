import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';
import { test, expect } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';

test('Tuần 2 Cổng C2: Màn chơi tranh vùng, địa danh góc, chặng hoàn thành, sương mù khóa và thẻ khám phá', async ({ page }) => {
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
      username: 'tuan2.admin',
      password: f.password,
    });
    const cls = await api('/classes', { name: 'Lớp 3A Tuan 2', grade: 3 }, admin.csrfToken);
    const studentRes = await api(
      '/students',
      { name: 'Bảo An', username: 'tuan2.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );
    const student = studentRes.student;

    // Seed Week 1: Math with Discovery Card
    await api('/weeks', {
      requestId: 't2-week-1',
      title: 'Tuần 1',
      classId: cls.id,
      sets: [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: 'pack-t2-math-w1',
            version: 1,
            title: 'Làm quen Đảo Số',
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            discovery: {
              title: 'Khám phá Đảo Số Diệu Kỳ',
              text: 'Chào mừng con đến với Đảo Số! Nơi đây cất giữ những con số kỳ thú và quy luật toán học tuyệt vời.',
              imageFile: 'dao-so.png',
            },
            items: [
              {
                id: 'q-t2-1-1',
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: '1 + 1 = ?',
                options: ['2', '3', '4', '5'],
                correctIndex: 0,
                explanation: '1 cộng 1 bằng 2.',
              },
              {
                id: 'q-t2-1-2',
                objectiveId: 'OBJ.1',
                kind: 'multiple-choice',
                prompt: '2 × 3 = ?',
                options: ['6', '5', '7', '8'],
                correctIndex: 0,
                explanation: '2 nhân 3 bằng 6.',
              },
            ],
          },
        },
      ],
    }, admin.csrfToken);

    // Seed Week 2: Locked week
    await api('/weeks', {
      requestId: 't2-week-2',
      title: 'Tuần 2',
      classId: cls.id,
      sets: [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: 'pack-t2-math-w2',
            version: 1,
            title: 'Khu Vườn Phép Tính',
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-17T00:00:00Z',
            items: [
              {
                id: 'q-t2-2-1',
                objectiveId: 'OBJ.2',
                kind: 'multiple-choice',
                prompt: '5 + 5 = ?',
                options: ['10', '9', '11', '12'],
                correctIndex: 0,
                explanation: '5 cộng 5 bằng 10.',
              },
              {
                id: 'q-t2-2-2',
                objectiveId: 'OBJ.2',
                kind: 'multiple-choice',
                prompt: '3 × 4 = ?',
                options: ['12', '10', '14', '15'],
                correctIndex: 0,
                explanation: '3 nhân 4 bằng 12.',
              },
            ],
          },
        },
      ],
    }, admin.csrfToken);

    // Login as student
    await page.context().clearCookies();
    await api('/login', { username: 'tuan2.child', password: f.password });
    await page.goto(f.origin + '/?online=1&controls=1');

    // 1. World map shows regions and Sổ khám phá button (accessible name)
    await expect(page.locator('.world-map-container')).toBeVisible({ timeout: 15000 });
    const notebookBtn = page.getByRole('button', { name: 'Mở Sổ khám phá' });
    await expect(notebookBtn).toBeVisible();

    // 2. Click region Toán học to open Region Map
    await page.click('.map-region-anchor.region-math');
    await expect(page.locator('.region-map-container')).toBeVisible({ timeout: 10000 });

    // 3. Verify Sương mù & Khóa chặng (T2.4)
    // Week 2 is locked -> has .is-locked and .map-stage-fog with 🔒
    const lockedNode = page.locator('.map-stage-node.is-locked');
    await expect(lockedNode).toBeVisible();
    await expect(lockedNode.locator('.map-stage-fog .lock-symbol')).toHaveText('🔒');

    // Clicking locked stage displays toast notification "Hoàn thành tuần 1 để mở"
    await lockedNode.click();
    const lockedToast = page.locator('.map-locked-toast');
    await expect(lockedToast).toBeVisible();
    await expect(lockedToast).toContainText('Hoàn thành tuần 1 để mở');

    // 4. Click Week 1 node -> Trigger Thẻ khám phá (T2.3)
    const week1Node = page.locator('.map-stage-node.is-current');
    await expect(week1Node).toBeVisible();
    await week1Node.click();

    // DiscoveryCardDialog appears for unviewed discovery card
    const discoveryDialog = page.locator('.discovery-dialog');
    await expect(discoveryDialog).toBeVisible({ timeout: 5000 });
    await expect(discoveryDialog.locator('h2')).toHaveText('Khám phá Đảo Số Diệu Kỳ');
    await expect(discoveryDialog.locator('.discovery-text')).toContainText('Chào mừng con đến với Đảo Số!');
    await expect(discoveryDialog.locator('.discovery-speak-btn')).toBeVisible();

    // Dismiss discovery card
    await discoveryDialog.locator('.discovery-close-btn').click();
    await expect(discoveryDialog).not.toBeVisible();

    // Selecting week 1 node again does NOT show discovery card again (viewed once)
    await week1Node.click();
    await expect(page.locator('.discovery-dialog')).not.toBeVisible();

    // 5. Open "Sổ khám phá" -> shows the unlocked discovery card
    await notebookBtn.click();
    const notebookDialog = page.locator('.discovery-notebook-dialog');
    await expect(notebookDialog).toBeVisible();
    await expect(notebookDialog.locator('h2')).toContainText('Sổ Khám Phá Của Con');
    await expect(notebookDialog.locator('.discovery-thumb-card strong')).toHaveText('Khám phá Đảo Số Diệu Kỳ');
    await notebookDialog.locator('button:has-text("Đóng ✕")').click();
    await expect(notebookDialog).not.toBeVisible();

    // 6. Launch Game -> Màn chơi mang tranh vùng & địa danh ở góc (T2.1)
    // In MapWeekPanel, click play button
    const playBtn = page.locator('.map-play-btn').first();
    await expect(playBtn).toBeVisible();
    await playBtn.click();

    // Game dialog opens
    const gameDialog = page.locator('.game-dialog.adventure-dialog');
    await expect(gameDialog).toBeVisible({ timeout: 10000 });

    // Verify .game-region-backdrop is present
    const regionBackdrop = gameDialog.locator('.game-region-backdrop');
    await expect(regionBackdrop).toBeVisible();
    const bgStyle = await regionBackdrop.getAttribute('style');
    expect(bgStyle).toContain('/art/maps/map-math-wide.webp');

    // Verify stage corner landmark is present in dialog head
    const cornerLandmark = gameDialog.locator('.game-dialog-head .game-stage-corner-landmark');
    await expect(cornerLandmark).toBeVisible();
    const landmarkSrc = await cornerLandmark.getAttribute('src');
    expect(landmarkSrc).toContain('/art/landmarks/place-math-');

    // Contrast check on head text: text color rgb(32, 62, 80) on light parchment header has contrast > 10:1 (exceeds WCAG 4.5:1)
    const headTitle = gameDialog.locator('.game-dialog-head h2');
    await expect(headTitle).toBeVisible();
    const titleColor = await headTitle.evaluate((el) => window.getComputedStyle(el).color);
    expect(titleColor).toBe('rgb(32, 62, 80)');

    // Exit game
    await gameDialog.locator('button:has-text("Thoát trò chơi")').click();
    await expect(gameDialog).not.toBeVisible();

    // 7. Test Hoàn thành chặng & cờ vàng (T2.2)
    // Award 3 stars on both questions in pack-t2-math-w1 directly in database
    const awardJson = JSON.stringify({
      packId: 'pack-t2-math-w1',
      starTier: 3,
      questionLedger: {
        policyVersion: 2,
        packId: 'pack-t2-math-w1',
        legacyStars: 0,
        questionTiers: { 'q-t2-1-1': 3, 'q-t2-1-2': 3 },
        earnedStars: 6,
      },
    });
    await f.pool.query(
      `INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json)
       VALUES($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (workspace_id, student_id, pack_id) DO UPDATE SET tier = EXCLUDED.tier, json = EXCLUDED.json`,
      [admin.workspace.id, student.id, 'pack-t2-math-w1', 3, awardJson]
    );

    // Refresh student page
    await page.click('button:has-text("Làm mới tiến độ")');
    await page.waitForTimeout(1000);

    // Return to region map
    if (await page.locator('.map-region-anchor.region-math').isVisible()) {
      await page.click('.map-region-anchor.region-math');
    }

    // Stage 1 now has .is-stage-completed, .is-stage-gold-flag, and golden flag badge
    const completedNode = page.locator('.map-stage-node.is-stage-completed');
    await expect(completedNode).toBeVisible();
    await expect(completedNode).toHaveClass(/is-stage-gold-flag/);
    const goldBadge = completedNode.locator('.map-stage-gold-badge');
    await expect(goldBadge).toBeVisible();
    await expect(goldBadge).toHaveText('🚩');

    // Motion settings check: toggle "Hiệu ứng tắt"
    const motionToggle = page.locator('button:has-text("Hiệu ứng")');
    await motionToggle.click();
    const appShell = page.locator('.online-app');
    await expect(appShell).toHaveAttribute('data-motion', 'off');

  } finally {
    await f.close();
  }
});

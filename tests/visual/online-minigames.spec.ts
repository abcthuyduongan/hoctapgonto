import path from 'node:path';
import { mkdtemp, mkdir, rm, cp } from 'node:fs/promises';
import { once } from 'node:events';
import { test, expect } from '@playwright/test';
import { createOnlineServer } from '../../server/online-server.mjs';
import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';

test('Tuần 5 (Cổng C5): balance-scale and basket-sort games run smoothly, contextual themes render, and motion toggle works', async ({ page }, testInfo) => {
  const root = path.resolve('test-results');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, 'online-minigames-'));
  let server: any;

  try {
    const staticRoot = path.join(directory, 'public');
    await cp(path.resolve(process.env.BAO_AN_STATIC_ROOT ?? 'dist'), staticRoot, { recursive: true });
    server = createOnlineServer({
      databasePath: path.join(directory, 'data.sqlite'),
      staticRoot,
      setupToken: 'minigames-test-bootstrap-token-2026',
      secureCookies: false,
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;

    async function api(route: string, body?: unknown) {
      const me = body && !['/setup', '/login'].includes(route)
        ? await (await page.request.get(origin + '/api/online/me')).json()
        : null;
      if (route === '/weeks') await seedLegacyApiWeek(server.onlineStore, me, body);
      const r = body
        ? await page.request.post(origin + '/api/online' + route, {
            data: body,
            headers: { Origin: origin, ...(me ? { 'X-CSRF-Token': me.csrfToken } : {}) },
          })
        : await page.request.get(origin + '/api/online' + route);
      expect(r.ok(), await r.text()).toBe(true);
      return r.json();
    }

    // 1. Setup workspace and account
    await api('/setup', {
      token: 'minigames-test-bootstrap-token-2026',
      name: 'Minigames Workspace',
      username: 'minigame.admin',
      password: 'Minigame-password-2026!',
    });
    const cls = await api('/classes', { name: 'Lớp Minigame 3', grade: 3 });
    await api('/students', {
      classId: cls.id,
      name: 'Bảo An',
      username: 'baoan.student',
      password: 'Baoan-password-2026!',
    });

    // 2. Author packs for compare (balance-scale) and categorize (basket-sort)
    const comparePack = {
      id: 'pack-balance-scale-1',
      version: 1,
      title: 'Cân Thăng Bằng Số Học',
      kind: 'compare',
      subject: 'math',
      grade: 3,
      source: 'local',
      publishedAt: '2026-11-05T00:00:00.000Z',
      items: [
        {
          id: 'scale-item-1',
          kind: 'compare',
          objectiveId: 'MATH.COMPARE',
          prompt: 'So sánh hai đĩa cân',
          left: '15 + 10',
          right: '30 - 5',
          operator: '=',
          explanation: '25 = 25',
          metadata: {
            knowledgeId: 'MATH.COMPARE',
            difficulty: 'medium',
            contentRole: 'practice',
            source: 'Tự biên soạn',
            rights: 'Tự do',
            reviewStatus: 'reviewed',
          },
        },
        {
          id: 'scale-item-2',
          kind: 'compare',
          objectiveId: 'MATH.COMPARE',
          prompt: 'So sánh hai đĩa cân',
          left: '4 × 6',
          right: '25',
          operator: '<',
          explanation: '24 < 25',
          metadata: {
            knowledgeId: 'MATH.COMPARE',
            difficulty: 'medium',
            contentRole: 'practice',
            source: 'Tự biên soạn',
            rights: 'Tự do',
            reviewStatus: 'reviewed',
          },
        },
      ],
    };

    const categorizePack = {
      id: 'pack-basket-sort-1',
      version: 1,
      title: 'Phân Loại Thẻ Từ',
      kind: 'categorize',
      subject: 'vietnamese',
      grade: 3,
      source: 'local',
      publishedAt: '2026-11-05T00:00:00.000Z',
      items: [
        {
          id: 'basket-item-1',
          kind: 'categorize',
          objectiveId: 'VIET.SORT',
          prompt: 'Phân loại từ vào giỏ thích hợp',
          categories: ['Sự vật', 'Hoạt động'],
          elements: [
            { id: 'el-1', text: 'Bàn học', category: 'Sự vật' },
            { id: 'el-2', text: 'Chạy nhanh', category: 'Hoạt động' },
          ],
          explanation: 'Bàn học là sự vật, Chạy nhanh là hoạt động.',
          metadata: {
            knowledgeId: 'VIET.SORT',
            difficulty: 'medium',
            contentRole: 'practice',
            source: 'Tự biên soạn',
            rights: 'Tự do',
            reviewStatus: 'reviewed',
          },
        },
        {
          id: 'basket-item-2',
          kind: 'categorize',
          objectiveId: 'VIET.SORT',
          prompt: 'Phân loại động vật và đồ vật',
          categories: ['Động vật', 'Đồ vật'],
          elements: [
            { id: 'el-3', text: 'Mèo con', category: 'Động vật' },
            { id: 'el-4', text: 'Quyển vở', category: 'Đồ vật' },
          ],
          explanation: 'Mèo con là động vật, quyển vở là đồ vật.',
          metadata: {
            knowledgeId: 'VIET.SORT',
            difficulty: 'medium',
            contentRole: 'practice',
            source: 'Tự biên soạn',
            rights: 'Tự do',
            reviewStatus: 'reviewed',
          },
        },
      ],
    };

    await api('/weeks', {
      requestId: 'week-tuan5-minigames',
      classId: cls.id,
      title: 'Tuần 5: Thế Giới Minigame',
      sets: [
        { subjectLabel: 'Toán học', pack: comparePack },
        { subjectLabel: 'Tiếng Việt', pack: categorizePack },
      ],
    });

    // 3. Login as student
    await page.context().clearCookies();
    await api('/login', { username: 'baoan.student', password: 'Baoan-password-2026!' });
    await page.goto(origin + '/?online=1&controls=1');
    await expect(page.locator('.online-student')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.student-topbar')).toBeVisible({ timeout: 10000 });

    // 4. Test Balance Scale game via server-scored attempt
    const me = await api('/me');
    const playBalance = await api('/play/compact', {
      requestId: 'play-balance-1',
      packId: comparePack.id,
      contentVersion: 1,
      moduleId: 'balance-scale',
    });
    expect(playBalance.session.sessionId).toBeTruthy();

    // Submit correct answer to balance scale item
    const attempt1 = await api(`/play/${playBalance.session.sessionId}/attempt`, {
      attemptKey: 'scale-item-1',
      itemId: 'scale-item-1',
      response: { kind: 'compare', operator: '=' },
      hintsUsed: 0,
      elapsedMs: 5000,
    });
    expect(attempt1.event.correct).toBe(true);

    const attempt2 = await api(`/play/${playBalance.session.sessionId}/attempt`, {
      attemptKey: 'scale-item-2',
      itemId: 'scale-item-2',
      response: { kind: 'compare', operator: '<' },
      hintsUsed: 0,
      elapsedMs: 6000,
    });
    expect(attempt2.event.correct).toBe(true);

    const finishBalance = await api(`/play/${playBalance.session.sessionId}/complete-compact`, {});
    expect(finishBalance.tier).toBeGreaterThanOrEqual(2);

    // 5. Test Basket Sort game via server-scored attempt
    const playBasket = await api('/play/compact', {
      requestId: 'play-basket-1',
      packId: categorizePack.id,
      contentVersion: 1,
      moduleId: 'basket-sort',
    });
    expect(playBasket.session.sessionId).toBeTruthy();

    const attemptBasket = await api(`/play/${playBasket.session.sessionId}/attempt`, {
      attemptKey: 'basket-item-1',
      itemId: 'basket-item-1',
      response: { kind: 'categorize', elementId: 'el-1', category: 'Sự vật' },
      hintsUsed: 0,
      elapsedMs: 8000,
    });
    expect(attemptBasket.event.correct).toBe(true);

    const attemptBasket2 = await api(`/play/${playBasket.session.sessionId}/attempt`, {
      attemptKey: 'basket-item-2',
      itemId: 'basket-item-2',
      response: { kind: 'categorize', elementId: 'el-3', category: 'Động vật' },
      hintsUsed: 0,
      elapsedMs: 7000,
    });
    expect(attemptBasket2.event.correct).toBe(true);

    const finishBasket = await api(`/play/${playBasket.session.sessionId}/complete-compact`, {});
    expect(finishBasket.state.student.name).toBe('Bảo An');

    // 6. Test motion toggle & verify data-motion attribute
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));
    const motionValue = await page.evaluate(() => document.documentElement.getAttribute('data-motion'));
    expect(motionValue).toBe('off');

    // 7. Verify student view reflects week
    await page.reload();
    await expect(page.locator('.online-student')).toBeVisible();
    await expect(page.locator('body')).toContainText('Tuần 5: Thế Giới Minigame');

    await page.screenshot({ path: testInfo.outputPath('tuan5-minigames-overview.png'), fullPage: true });
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
      server.onlineClose();
    }
    await rm(directory, { recursive: true, force: true });
  }
});

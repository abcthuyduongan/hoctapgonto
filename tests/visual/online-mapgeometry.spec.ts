import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { cloudBrowserFixture } from '../helpers/cloud-browser-fixture.mjs';
import { seedLegacyApiWeek } from '../helpers/legacy-weeks.mjs';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function toBox(b: { x: number; y: number; width: number; height: number }): Box {
  return {
    ...b,
    left: b.x,
    right: b.x + b.width,
    top: b.y,
    bottom: b.y + b.height,
  };
}

function boxesOverlap(a: Box, b: Box): boolean {
  const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return overlapX > 0 && overlapY > 0;
}

const VIEWPORTS = [
  { width: 390, height: 844, name: 'phone-390' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1440, height: 900, name: 'desktop-1440' },
];

test.describe('online-mapgeometry: bounding boxes and anchor alignment without overlap', () => {
  let f: Awaited<ReturnType<typeof cloudBrowserFixture>>;
  const manifestPath = path.resolve('public/art/maps/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  test.beforeAll(async () => {
    f = await cloudBrowserFixture();

    const apiReq = await playwrightRequest.newContext({ baseURL: f.origin });

    async function api(route: string, data: unknown, csrf = '') {
      const response = await apiReq.post(route, {
        headers: {
          Origin: f.origin,
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        data,
      });
      if (!response.ok()) {
        throw new Error(`API ${route} failed: ${await response.text()}`);
      }
      return response.json();
    }

    const admin = await api('/api/online/setup', {
      token: f.token,
      name: 'Geometry School',
      username: 'geo.admin',
      password: f.password,
    });
    const cls = await api('/api/online/classes', { name: 'Lớp 3A Geometry', grade: 3 }, admin.csrfToken);
    await api(
      '/api/online/students',
      { name: 'Bảo An Geometry', username: 'geo.child', password: f.password, classId: cls.id },
      admin.csrfToken
    );

    const subjects = [
      { label: 'Toán học', id: 'm' },
      { label: 'Tiếng Việt', id: 'vn' },
      { label: 'Tiếng Anh', id: 'eng' },
      { label: 'Tin học', id: 'comp' },
    ];

    for (let w = 1; w <= 7; w++) {
      const sets = subjects.map((sub) => ({
        subjectLabel: sub.label,
        pack: {
          id: `pack-geo-${sub.id}-w${w}`,
          version: 1,
          title: `Bài ${sub.label} Tuần ${w}`,
          kind: 'quiz',
          subject: 'math',
          grade: 3,
          source: 'local',
          publishedAt: '2026-10-17T00:00:00Z',
          items: [1, 2].map((n) => ({
            id: `q-geo-${sub.id}-${w}-${n}`,
            objectiveId: 'OBJ.1',
            kind: 'multiple-choice',
            prompt: `Câu hỏi ${sub.label} ${w}.${n}`,
            options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
            correctIndex: 0,
            explanation: 'Lời giải.',
          })),
        },
      }));

      await seedLegacyApiWeek(
        f.store,
        admin,
        { requestId: `geo-week-${w}`, classId: cls.id, title: `Tuần ${w}`, sets }
      );
    }

    await apiReq.dispose();
  });

  test.afterAll(async () => {
    if (f) await f.close();
  });

  for (const vp of VIEWPORTS) {
    test(`world and region map geometry at ${vp.width}×${vp.height} (${vp.name})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Login
      await page.context().clearCookies();
      const loginRes = await page.request.post(f.origin + '/api/online/login', {
        headers: { Origin: f.origin },
        data: { username: 'geo.child', password: f.password },
      });
      expect(loginRes.ok(), await loginRes.text()).toBe(true);

      await page.goto(f.origin + '/?online=1&controls=1');

      // 1. World Map Verification
      const worldWrapper = page.locator('.world-map-container .map-view-wrapper');
      await expect(worldWrapper).toBeVisible();

      const worldBox = toBox((await worldWrapper.boundingBox())!);
      expect(worldBox.width).toBeGreaterThan(0);
      expect(worldBox.height).toBeGreaterThan(0);

      // Verify all 4 region anchors
      const regionAnchors = page.locator('.world-map-container .map-region-anchor');
      await expect(regionAnchors).toHaveCount(4);

      const anchorBoxes: Box[] = [];
      for (let i = 0; i < 4; i++) {
        const rawBox = await regionAnchors.nth(i).boundingBox();
        expect(rawBox).not.toBeNull();
        const box = toBox(rawBox!);
        anchorBoxes.push(box);

        console.log(`[DEBUG ${vp.name}] worldBox:`, worldBox, `anchor ${i}:`, box);

        // Within container bounds (with 2px tolerance for subpixel anti-aliasing)
        expect(box.left).toBeGreaterThanOrEqual(worldBox.left - 2);
        expect(box.top).toBeGreaterThanOrEqual(worldBox.top - 2);
        expect(box.right).toBeLessThanOrEqual(worldBox.right + 2);
        expect(box.bottom).toBeLessThanOrEqual(worldBox.bottom + 2);
      }

      // Check no two region anchors overlap
      for (let i = 0; i < anchorBoxes.length; i++) {
        for (let j = i + 1; j < anchorBoxes.length; j++) {
          const overlap = boxesOverlap(anchorBoxes[i], anchorBoxes[j]);
          expect(overlap).toBe(false);
        }
      }

      if (vp.width === 390) {
        await page.screenshot({
          path: testInfo.outputPath('student-world-390.png'),
          fullPage: false,
        });
      }

      // 2. Region Map Verification (Navigate to Math region)
      await page.locator('.map-region-anchor.region-math').click();
      const regionWrapper = page.locator('.region-map-container .map-view-wrapper');
      await expect(regionWrapper).toBeVisible();

      const regionBox = toBox((await regionWrapper.boundingBox())!);
      expect(regionBox.width).toBeGreaterThan(0);
      expect(regionBox.height).toBeGreaterThan(0);

      // Verify every slot in a fully assigned chapter.
      const stageNodes = page.locator('.region-map-container .map-stage-node');
      await expect(stageNodes).toHaveCount(7);

      const isTall = vp.width <= 768;
      const targetMapId = isTall ? 'map-math-tall' : 'map-math-wide';
      const mapAsset = manifest.assets.find((a: { id: string }) => a.id === targetMapId);
      expect(mapAsset).toBeDefined();
      const slotAnchors = mapAsset.slotAnchors;
      expect(slotAnchors).toBeDefined();

      const stageBoxes: Box[] = [];
      for (let slot = 1; slot <= 7; slot++) {
        const stageNode = stageNodes.nth(slot - 1);
        const rawBox = await stageNode.boundingBox();
        expect(rawBox).not.toBeNull();
        const box = toBox(rawBox!);
        stageBoxes.push(box);

        // Within region map container bounds
        expect(box.left).toBeGreaterThanOrEqual(regionBox.left - 2);
        expect(box.top).toBeGreaterThanOrEqual(regionBox.top - 2);
        expect(box.right).toBeLessThanOrEqual(regionBox.right + 2);
        expect(box.bottom).toBeLessThanOrEqual(regionBox.bottom + 2);

        // Stage center vs manifest anchor coordinates <= 3% of container width
        const actualCenterX = box.left + box.width / 2;
        const actualCenterY = box.top + box.height / 2;

        const expectedPercent = slotAnchors[String(slot)];
        const expectedCenterX = regionBox.left + (expectedPercent.x / 100) * regionBox.width;
        const expectedCenterY = regionBox.top + (expectedPercent.y / 100) * regionBox.height;

        const diffXPercent = (Math.abs(actualCenterX - expectedCenterX) / regionBox.width) * 100;
        const diffYPercent = (Math.abs(actualCenterY - expectedCenterY) / regionBox.height) * 100;

        expect(diffXPercent).toBeLessThanOrEqual(3.0);
        expect(diffYPercent).toBeLessThanOrEqual(3.0);
      }

      // Check no two stage nodes overlap
      for (let i = 0; i < stageBoxes.length; i++) {
        for (let j = i + 1; j < stageBoxes.length; j++) {
          const overlap = boxesOverlap(stageBoxes[i], stageBoxes[j]);
          if (overlap) {
            console.log(`[OVERLAP DETECTED] ${vp.name} stage ${i + 1} and ${j + 1}:`, stageBoxes[i], stageBoxes[j]);
          }
          expect(overlap).toBe(false);
        }
      }

      if (vp.width === 390) {
        await page.screenshot({
          path: testInfo.outputPath('student-region-390.png'),
          fullPage: false,
        });
      }
    });
  }
});

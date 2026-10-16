# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: backup-profile.spec.ts >> A live session in another tab blocks restoration even when preview was already prepared
- Location: tests\visual\backup-profile.spec.ts:237:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('.ba3d-math-quest .ba3d-play')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - link "Bảo An Learning, trang chủ" [ref=e6] [cursor=pointer]:
        - /url: "#home"
        - generic [ref=e7]: ✦
        - generic [ref=e9]:
          - strong [ref=e10]: BẢO AN
          - generic [ref=e11]:
            - text: LEARNING
            - generic [ref=e12]: V3.8
      - navigation "Không gian ứng dụng" [ref=e13]:
        - button "Thế giới game" [ref=e14] [cursor=pointer]:
          - generic [aria-hidden] [ref=e15]: 🏠
          - text: Thế giới game
        - button "Góc phụ huynh" [active] [ref=e16] [cursor=pointer]:
          - generic [aria-hidden] [ref=e17]: 📊
          - text: Góc phụ huynh
        - button "Xưởng học liệu" [ref=e18] [cursor=pointer]:
          - generic [aria-hidden] [ref=e19]: 📚
          - text: Xưởng học liệu
      - generic "Cài đặt trải nghiệm" [ref=e20]:
        - button "Đổi hồ sơ học sinh" [ref=e21] [cursor=pointer]:
          - generic [aria-hidden] [ref=e22]: 🦊
          - generic [ref=e23]: Bé Học Giỏi
        - button "🔇 Âm thanh" [ref=e24] [cursor=pointer]:
          - text: 🔇
          - generic [ref=e25]: Âm thanh
        - button "✨ Hiệu ứng" [pressed] [ref=e26] [cursor=pointer]:
          - text: ✨
          - generic [ref=e27]: Hiệu ứng
  - main [ref=e28]:
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e31]: 📊 GÓC PHỤ HUYNH · ĐỒNG HÀNH CÙNG CON
        - heading "Mỗi bước tiến đều đáng ghi nhận" [level=1] [ref=e32]
        - paragraph [ref=e33]: Thông tin rõ ràng để gia đình hiểu quá trình học tập trên cả 5 trò chơi, không chỉ nhìn vào điểm số. Toàn bộ dữ liệu được lưu trữ an toàn và riêng tư trên thiết bị này.
      - generic [ref=e34]:
        - article [ref=e35]:
          - generic [ref=e36]: 🎯
          - generic [ref=e37]: Lượt trả lời / ghép cặp
          - strong [ref=e38]: "0"
          - generic [ref=e39]: Không tính thao tác lật thẻ đầu tiên
        - article [ref=e40]:
          - generic [ref=e41]: ✨
          - generic [ref=e42]: Tỷ lệ lượt đúng
          - strong [ref=e43]: 0%
          - generic [ref=e44]: 0/0 lượt đúng
        - article [ref=e45]:
          - generic [ref=e46]: 🏁
          - generic [ref=e47]: Trò chơi hoàn thành
          - strong [ref=e48]: "0"
          - generic [ref=e49]: Không tính phiên thoát giữa chừng
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]:
            - heading "Kỹ năng đã luyện" [level=2] [ref=e53]
            - generic [ref=e54]: Dữ liệu thực tế
          - generic [ref=e55]: Chưa có hoạt động nào. Hãy vào Thế giới game và thử một trò chơi.
          - paragraph [ref=e56]: Tỷ lệ đúng thể hiện các lượt thử, không phải kết luận về mức độ thành thạo của trẻ.
        - generic [ref=e57]:
          - heading "Nhật ký khám phá" [level=2] [ref=e59]
          - generic [ref=e60]: Các lượt chơi sẽ xuất hiện tại đây sau khi con bắt đầu.
      - region "Sao lưu hồ sơ học tập" [ref=e61]:
        - generic [ref=e62]:
          - heading "Sao lưu hồ sơ học tập" [level=2] [ref=e63]
          - generic [ref=e64]: Lưu trên thiết bị
        - paragraph [ref=e65]: Tải một bản sao để giữ học liệu, phiên chơi và kết quả học. Tệp hồ sơ được lưu trên máy của bạn.
        - generic [ref=e66]:
          - button "Tải bản sao hồ sơ" [ref=e67] [cursor=pointer]
          - button "Chọn tệp để khôi phục" [ref=e68] [cursor=pointer]
          - button "Chọn tệp hồ sơ học tập" [ref=e69]
        - paragraph [ref=e70]: Khôi phục chỉ thêm hồ sơ chưa có. Bạn có thể tải bản sao hiện tại trước khi thêm. Học liệu và kết quả đang có được giữ nguyên.
        - status [ref=e71]
        - generic [ref=e72]:
          - heading "Xem trước hồ sơ" [level=3] [ref=e73]
          - paragraph [ref=e74]: Bản sao tạo lúc 17:05:00 12/10/2026.
          - table [ref=e75]:
            - caption [ref=e76]: Số bản ghi sẽ thêm và bản ghi đã có
            - rowgroup [ref=e77]:
              - row [ref=e78]:
                - columnheader "Nội dung" [ref=e79]
                - columnheader "Sẽ thêm" [ref=e80]
                - columnheader "Đã có" [ref=e81]
            - rowgroup [ref=e82]:
              - row [ref=e83]:
                - rowheader "Bộ học liệu" [ref=e84]
                - cell "1" [ref=e85]
                - cell "0" [ref=e86]
              - row [ref=e87]:
                - rowheader "Phiên chơi" [ref=e88]
                - cell "1" [ref=e89]
                - cell "0" [ref=e90]
              - row [ref=e91]:
                - rowheader "Lượt thử" [ref=e92]
                - cell "1" [ref=e93]
                - cell "0" [ref=e94]
          - generic [ref=e95]:
            - button "Thêm hồ sơ vào thiết bị" [ref=e96] [cursor=pointer]
            - button "Hủy xem trước" [ref=e97] [cursor=pointer]
      - generic [ref=e98]:
        - strong [ref=e99]: "🔒 Quyền riêng tư trong bản thử nghiệm:"
        - text: Đây là bản demo một thiết bị, chưa có xác thực phụ huynh, hồ sơ nhiều trẻ hoặc kiểm soát truy cập phía máy chủ. Không nhập thông tin cá nhân thật và không đưa bản này lên website công khai.
  - contentinfo [ref=e100]:
    - generic [ref=e101]:
      - strong [ref=e102]: ✦ Bảo An Learning V3.8
      - generic [ref=e103]: Học vui · Hiểu sâu · Tiến bộ mỗi ngày
    - generic [ref=e104]: V3.8 • Thế giới 5 đảo 3D · 100% Offline-First · Âm thanh sống động
```

# Test source

```ts
  142 |   const download = await downloadPromise;
  143 |   const filePath = await download.path(); expect(filePath).not.toBeNull();
  144 |   const json = await readFile(filePath!, 'utf8');
  145 |   const backup = JSON.parse(json) as LearningBackup;
  146 |   expect(backup).toMatchObject({ schema: 'baoan-learning-backup', formatVersion: 1 });
  147 |   expect(backup.packs).toEqual(expect.arrayContaining(BUILTIN_PACKS));
  148 |   expect(backup.sessions).toEqual(before.sessions); expect(backup.events).toEqual(before.events);
  149 |   const snapshotTransactions = await page.evaluate(() => (window as unknown as { __backupTransactions: { mode: string; stores: string[] }[] }).__backupTransactions);
  150 |   expect(snapshotTransactions.filter(tx => tx.mode === 'readonly' && tx.stores.length === 3)).toHaveLength(1);
  151 | 
  152 |   const freshContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  153 |   try {
  154 |     const freshPage = await freshContext.newPage();
  155 |     await parent(freshPage);
  156 |     expect((await stored(freshPage)).sessions).toHaveLength(0);
  157 |     await selectBackup(freshPage, backup);
  158 |     const previewRows = backupSection(freshPage).locator('tbody tr');
  159 |     expect(await previewRows.nth(0).locator('td').allTextContents()).toEqual(['0', '5']);
  160 |     expect(await previewRows.nth(1).locator('td').allTextContents()).toEqual(['3', '0']);
  161 |     expect(await previewRows.nth(2).locator('td').allTextContents()).toEqual(['20', '0']);
  162 |     await restoreButton(freshPage).click();
  163 |     await expect(backupSection(freshPage).getByRole('status')).toContainText('Đã khôi phục');
  164 |     const restored = await stored(freshPage);
  165 |     expect(restored.sessions).toEqual(before.sessions); expect(restored.events).toEqual(before.events);
  166 |     expect(restored.packs).toEqual(before.packs);
  167 |     expect(restored.version).toBe(1); expect(restored.stores).toEqual(['events', 'packs', 'sessions']);
  168 |     expect(calculateReport(restored.events, restored.sessions)).toEqual(expectedReport);
  169 |     expect(await freshPage.locator('.parent-stats').allTextContents()).toEqual(reportText);
  170 |     await selectBackup(freshPage, backup);
  171 |     await expect(restoreButton(freshPage)).toBeDisabled();
  172 |     await expect(backupSection(freshPage)).toContainText('Hồ sơ đã có đầy đủ trên thiết bị này.');
  173 |     expect(await previewRows.nth(0).locator('td').allTextContents()).toEqual(['0', '5']);
  174 |     expect(await previewRows.nth(1).locator('td').allTextContents()).toEqual(['0', '3']);
  175 |     expect(await previewRows.nth(2).locator('td').allTextContents()).toEqual(['0', '20']);
  176 |     expect(await stored(freshPage)).toEqual(restored);
  177 |     await freshPage.reload(); await freshPage.getByRole('button', { name: /Góc phụ huynh/ }).click();
  178 |     expect(await stored(freshPage)).toEqual(restored);
  179 |     await testInfo.attach('backup-round-trip', { body: JSON.stringify({ exportedRecords: { packs: backup.packs.length, sessions: backup.sessions.length, events: backup.events.length }, snapshotTransactions, report: expectedReport, restoredStores: restored.stores, restoredVersion: restored.version }, null, 2), contentType: 'application/json' });
  180 |   } finally { await freshContext.close(); }
  181 | });
  182 | 
  183 | test('An active backup is restored as abandoned at export time and repeated import remains idempotent', async ({ page }) => {
  184 |   await parent(page);
  185 |   const backup = fixture('qa-backup-active');
  186 |   backup.sessions[0].status = 'active'; delete backup.sessions[0].endedAt;
  187 |   await selectBackup(page, backup);
  188 |   await expect(backupSection(page)).toContainText(/1.*(?:dở dang|abandoned|đang chơi)/i);
  189 |   await restoreButton(page).click();
  190 |   await expect(backupSection(page).getByRole('status')).toContainText('Đã khôi phục');
  191 |   const saved = await stored(page);
  192 |   expect(saved.sessions[0]).toEqual({ ...backup.sessions[0], status: 'abandoned', endedAt: backup.exportedAt });
  193 |   expect(saved.events).toEqual(backup.events);
  194 |   await selectBackup(page, backup); await expect(restoreButton(page)).toBeDisabled();
  195 |   expect(await stored(page)).toEqual(saved);
  196 | });
  197 | 
  198 | for (const collection of ['packs', 'sessions', 'events'] as const) {
  199 |   test(`A conflicting ${collection} key is shown in preview and cannot overwrite the existing profile`, async ({ page }) => {
  200 |     await parent(page);
  201 |     const original = fixture(`qa-backup-${collection}-conflict`);
  202 |     await restoreThroughUI(page, original);
  203 |     const before = JSON.stringify(await stored(page));
  204 |     const candidate = structuredClone(original);
  205 |     let key: string;
  206 |     if (collection === 'packs') {
  207 |       candidate.packs[0].title = 'QA · Cùng khóa nhưng học liệu khác';
  208 |       key = `${candidate.packs[0].id}@${candidate.packs[0].version}`;
  209 |     } else if (collection === 'sessions') {
  210 |       candidate.sessions[0].endedAt = '2026-10-12T10:02:00.000Z';
  211 |       key = candidate.sessions[0].sessionId;
  212 |     } else {
  213 |       candidate.events[0].correct = false;
  214 |       key = candidate.events[0].eventId;
  215 |     }
  216 |     await selectBackup(page, candidate);
  217 |     await expect(backupSection(page).getByRole('alert')).toContainText(key);
  218 |     await expect(restoreButton(page)).toBeDisabled();
  219 |     expect(JSON.stringify(await stored(page))).toBe(before);
  220 |   });
  221 | }
  222 | 
  223 | test('A conflict introduced by another tab after preview rejects the entire restore without changing any stored bytes', async ({ page, context }) => {
  224 |   await parent(page);
  225 |   const candidate = fixture('qa-backup-race');
  226 |   await selectBackup(page, candidate); await expect(restoreButton(page)).toBeEnabled();
  227 |   const other = await context.newPage(); await other.goto('/');
  228 |   const changed = structuredClone(candidate); changed.events[0].correct = false;
  229 |   await writeFromOtherTab(other, changed);
  230 |   const before = await stored(page), bytes = JSON.stringify(before);
  231 |   await restoreButton(page).click();
  232 |   await expect(backupSection(page).getByRole('alert')).toContainText(/trùng khóa.*khác nội dung/);
  233 |   expect(JSON.stringify(await stored(page))).toBe(bytes);
  234 |   expect(calculateReport(before.events, before.sessions).correct).toBe(0);
  235 | });
  236 | 
  237 | test('A live session in another tab blocks restoration even when preview was already prepared', async ({ page, context }) => {
  238 |   await parent(page);
  239 |   const candidate = fixture('qa-backup-other-active');
  240 |   await selectBackup(page, candidate); await expect(restoreButton(page)).toBeEnabled();
  241 |   const other = await context.newPage(); await other.goto('/');
> 242 |   await other.locator('.ba3d-math-quest .ba3d-play').click();
      |                                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  243 |   await other.locator('.answer-option').first().click();
  244 |   await expect(other.locator('.result-next')).toBeVisible();
  245 |   const before = JSON.stringify(await stored(page));
  246 |   await restoreButton(page).click();
  247 |   await expect(backupSection(page).getByRole('alert')).toContainText(/phiên chơi đang hoạt động/);
  248 |   expect(JSON.stringify(await stored(page))).toBe(before);
  249 |   await other.getByRole('button', { name: /Thoát trò chơi/ }).click();
  250 | });
  251 | 
  252 | for (const failure of ['constraint', 'quota'] as const) {
  253 |   test(`A ${failure} failure after the first write aborts the real three-store transaction and preserves all counts and bytes`, async ({ page }, testInfo) => {
  254 |     await parent(page);
  255 |     const prior = fixture(`qa-backup-${failure}-prior`);
  256 |     await restoreThroughUI(page, prior);
  257 |     const incoming = fixture(`qa-backup-${failure}-incoming`);
  258 |     await selectBackup(page, incoming); await expect(restoreButton(page)).toBeEnabled();
  259 |     const before = await stored(page), bytes = JSON.stringify(before);
  260 |     await page.evaluate(({ failure, existing }) => {
  261 |       const native = IDBObjectStore.prototype.add;
  262 |       const probe = { writes: 0, firstSucceeded: false, aborted: false, observedStores: [] as string[] };
  263 |       IDBObjectStore.prototype.add = function (value, key) {
  264 |         if (this.transaction.mode !== 'readwrite') return native.call(this, value, key);
  265 |         probe.writes++;
  266 |         if (probe.writes === 1) {
  267 |           probe.observedStores = Array.from(this.transaction.objectStoreNames);
  268 |           this.transaction.addEventListener('abort', () => { probe.aborted = true; });
  269 |           const request = native.call(this, value, key);
  270 |           request.addEventListener('success', () => { probe.firstSucceeded = true; });
  271 |           return request;
  272 |         }
  273 |         if (probe.writes === 2) {
  274 |           IDBObjectStore.prototype.add = native;
  275 |           if (failure === 'quota') throw new DOMException('QA injected quota failure', 'QuotaExceededError');
  276 |           return native.call(this, existing);
  277 |         }
  278 |         return native.call(this, value, key);
  279 |       };
  280 |       (window as unknown as { __restoreRollback: typeof probe }).__restoreRollback = probe;
  281 |     }, { failure, existing: prior.sessions[0] });
  282 |     await restoreButton(page).click();
  283 |     await expect(backupSection(page).getByRole('alert')).toContainText(/(?:trùng khóa|không đủ dung lượng)/);
  284 |     const probe = await page.evaluate(() => (window as unknown as { __restoreRollback: { writes: number; firstSucceeded: boolean; aborted: boolean; observedStores: string[] } }).__restoreRollback);
  285 |     expect(probe.writes).toBe(2); expect(probe.aborted).toBe(true);
  286 |     if (failure === 'constraint') expect(probe.firstSucceeded).toBe(true);
  287 |     expect(probe.observedStores.sort()).toEqual(['events', 'packs', 'sessions']);
  288 |     const after = await stored(page);
  289 |     expect(JSON.stringify(after)).toBe(bytes);
  290 |     await testInfo.attach(`atomic-${failure}-rollback`, { body: JSON.stringify({ probe, beforeCounts: { packs: before.packs.length, sessions: before.sessions.length, events: before.events.length }, afterCounts: { packs: after.packs.length, sessions: after.sessions.length, events: after.events.length }, exactBytesUnchanged: JSON.stringify(after) === bytes }, null, 2), contentType: 'application/json' });
  291 |   });
  292 | }
  293 | 
  294 | test('Invalid schema and dangling history are rejected before any database write', async ({ page }) => {
  295 |   await parent(page);
  296 |   const before = JSON.stringify(await stored(page));
  297 |   for (const value of [{ schema: 'baoan-learning-content', formatVersion: 1, packs: [] }, { ...fixture('qa-backup-invalid'), sessions: [] }]) {
  298 |     await input(page).setInputFiles({ name: 'qa-invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  299 |     await expect(backupSection(page).getByRole('alert')).toBeVisible();
  300 |     await expect(restoreButton(page)).toHaveCount(0);
  301 |     expect(JSON.stringify(await stored(page))).toBe(before);
  302 |   }
  303 | });
  304 | 
  305 | test('Combining valid files cannot exceed the exportable profile limits', async ({ page }) => {
  306 |   await parent(page);
  307 |   const before = JSON.stringify(await stored(page));
  308 |   const backup = fixture('qa-backup-capacity');
  309 |   const first = backup.packs[0];
  310 |   backup.packs = Array.from({ length: 500 }, (_, index) => ({ ...first, id: index === 0 ? first.id : `qa-capacity-pack-${index}` }));
  311 |   await input(page).setInputFiles({ name: 'qa-profile-capacity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  312 |   await expect(backupSection(page).getByRole('alert')).toContainText(/vượt giới hạn 500/);
  313 |   await expect(restoreButton(page)).toHaveCount(0);
  314 |   expect(JSON.stringify(await stored(page))).toBe(before);
  315 | });
  316 | 
```
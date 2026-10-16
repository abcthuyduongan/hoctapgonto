# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: backup-profile.spec.ts >> A conflict introduced by another tab after preview rejects the entire restore without changing any stored bytes
- Location: tests\visual\backup-profile.spec.ts:223:1

# Error details

```
Error: page.evaluate: VersionError: The requested version (1) is less than the existing version (3).
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
  1   | import { readFile } from 'node:fs/promises';
  2   | import { expect, test, type Page } from '@playwright/test';
  3   | import type { LearningBackup } from '../../src/core/backup-io';
  4   | import type { ContentPack, LearningEvent, PairsPack, PlaySession, QuizPack, SentencePack } from '../../src/core/contracts';
  5   | import { calculateReport } from '../../src/core/reports';
  6   | import { BUILTIN_PACKS } from '../../src/core/seed';
  7   | 
  8   | type StoredProfile = {
  9   |   packs: { key: string; pack: ContentPack }[];
  10  |   sessions: PlaySession[];
  11  |   events: LearningEvent[];
  12  |   version: number;
  13  |   stores: string[];
  14  | };
  15  | const backupSection = (page: Page) => page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' });
  16  | const input = (page: Page) => page.getByLabel('Chọn tệp hồ sơ học tập');
  17  | const restoreButton = (page: Page) => page.getByRole('button', { name: 'Thêm hồ sơ vào thiết bị' });
  18  | 
  19  | /** Real IndexedDB reads; no production adapter is replaced and no profile is cleared. */
  20  | async function stored(page: Page): Promise<StoredProfile> {
  21  |   return page.evaluate(async () => {
  22  |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  23  |       const request = indexedDB.open('bao-an-learning-v3-alpha', 1);
  24  |       request.onsuccess = () => resolve(request.result);
  25  |       request.onerror = () => reject(request.error);
  26  |     });
  27  |     try {
  28  |       return await new Promise<StoredProfile>((resolve, reject) => {
  29  |         const tx = db.transaction(['packs', 'sessions', 'events'], 'readonly');
  30  |         const packs = tx.objectStore('packs').getAll();
  31  |         const sessions = tx.objectStore('sessions').getAll();
  32  |         const events = tx.objectStore('events').getAll();
  33  |         tx.oncomplete = () => resolve({ packs: packs.result, sessions: sessions.result, events: events.result, version: db.version, stores: [...db.objectStoreNames] });
  34  |         tx.onabort = () => reject(tx.error);
  35  |       });
  36  |     } finally { db.close(); }
  37  |   });
  38  | }
  39  | 
  40  | async function parent(page: Page): Promise<void> {
  41  |   await page.goto('/');
  42  |   await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  43  |   await expect(backupSection(page)).toBeVisible();
  44  | }
  45  | 
  46  | async function selectBackup(page: Page, backup: LearningBackup): Promise<void> {
  47  |   await input(page).setInputFiles({ name: 'qa-learning-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  48  |   await expect(page.getByRole('button', { name: 'Hủy xem trước' })).toBeVisible();
  49  | }
  50  | 
  51  | async function restoreThroughUI(page: Page, backup: LearningBackup): Promise<void> {
  52  |   await selectBackup(page, backup);
  53  |   await expect(restoreButton(page)).toBeEnabled();
  54  |   await restoreButton(page).click();
  55  |   await expect(backupSection(page).getByRole('status')).toContainText('Đã khôi phục');
  56  | }
  57  | 
  58  | function fixture(prefix: string): LearningBackup {
  59  |   const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  60  |   const pack: QuizPack = { ...structuredClone(original), id: `${prefix}-quiz`, title: 'QA · Sao lưu hai câu', source: 'local', items: original.items.slice(0, 2) };
  61  |   const session: PlaySession = {
  62  |     sessionId: `${prefix}-session`, packId: pack.id, contentVersion: 1, moduleId: 'math-quest', moduleVersion: '0.2.7',
  63  |     startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:01:00.000Z', status: 'completed',
  64  |   };
  65  |   const item = pack.items[0];
  66  |   const event: LearningEvent = {
  67  |     eventId: `${session.sessionId}:answer-1`, sessionId: session.sessionId, packId: pack.id, contentVersion: 1,
  68  |     moduleId: session.moduleId, moduleVersion: session.moduleVersion, itemId: item.id, objectiveId: item.objectiveId,
  69  |     correct: true, hintsUsed: 0, elapsedMs: 2500, occurredAt: '2026-10-12T10:00:30.000Z',
  70  |   };
  71  |   return { schema: 'baoan-learning-backup', formatVersion: 1, exportedAt: '2026-10-12T10:05:00.000Z', packs: [pack], sessions: [session], events: [event] };
  72  | }
  73  | 
  74  | async function writeFromOtherTab(page: Page, backup: LearningBackup): Promise<void> {
> 75  |   await page.evaluate(async profile => {
      |              ^ Error: page.evaluate: VersionError: The requested version (1) is less than the existing version (3).
  76  |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  77  |       const request = indexedDB.open('bao-an-learning-v3-alpha', 1);
  78  |       request.onsuccess = () => resolve(request.result);
  79  |       request.onerror = () => reject(request.error);
  80  |     });
  81  |     try {
  82  |       await new Promise<void>((resolve, reject) => {
  83  |         const tx = db.transaction(['packs', 'sessions', 'events'], 'readwrite');
  84  |         profile.packs.forEach(pack => tx.objectStore('packs').add({ key: `${pack.id}@${pack.version}`, pack }));
  85  |         profile.sessions.forEach(session => tx.objectStore('sessions').add(session));
  86  |         profile.events.forEach(event => tx.objectStore('events').add(event));
  87  |         tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  88  |       });
  89  |     } finally { db.close(); }
  90  |   }, backup);
  91  | }
  92  | 
  93  | async function completeThreeGames(page: Page): Promise<void> {
  94  |   await page.goto('/');
  95  |   const math = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  96  |   await page.locator('.ba3d-math-quest .ba3d-play').click();
  97  |   for (const item of math.items) {
  98  |     await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
  99  |     await page.locator('.answer-option').nth(item.correctIndex).click();
  100 |     await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
  101 |     await page.locator('.result-next').click();
  102 |   }
  103 |   await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  104 |   const memory = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
  105 |   await page.locator('.ba3d-memory-match .ba3d-play').click();
  106 |   for (const item of memory.items) {
  107 |     await page.locator('.memory-card').filter({ has: page.getByText(item.left, { exact: true }) }).click();
  108 |     await page.locator('.memory-card').filter({ has: page.getByText(item.right, { exact: true }) }).click();
  109 |   }
  110 |   await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  111 |   const sentences = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
  112 |   await page.locator('.ba3d-sentence-builder .ba3d-play').click();
  113 |   for (const item of sentences.items) {
  114 |     await expect(page.locator('.sentence-prompt')).toHaveText(item.prompt);
  115 |     for (const word of item.words) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).click();
  116 |     await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
  117 |     await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
  118 |     await page.locator('.sentence-main-action').click();
  119 |   }
  120 |   await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  121 | }
  122 | 
  123 | test('A downloaded three-game profile restores into a fresh QA context, preserves reports and ignores identical reimport', async ({ page, browser }, testInfo) => {
  124 |   test.setTimeout(120_000);
  125 |   await completeThreeGames(page);
  126 |   await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  127 |   const before = await stored(page);
  128 |   expect(before.sessions).toHaveLength(3); expect(before.events).toHaveLength(20);
  129 |   const expectedReport = calculateReport(before.events, before.sessions);
  130 |   const reportText = await page.locator('.parent-stats').allTextContents();
  131 |   await page.evaluate(() => {
  132 |     const entries: { mode: IDBTransactionMode; stores: string[] }[] = [];
  133 |     const native = IDBDatabase.prototype.transaction;
  134 |     IDBDatabase.prototype.transaction = function (storeNames, mode, options) {
  135 |       entries.push({ mode: mode ?? 'readonly', stores: typeof storeNames === 'string' ? [storeNames] : Array.from(storeNames) });
  136 |       return native.call(this, storeNames, mode, options);
  137 |     };
  138 |     (window as unknown as { __backupTransactions: typeof entries }).__backupTransactions = entries;
  139 |   });
  140 |   const downloadPromise = page.waitForEvent('download');
  141 |   await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
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
```
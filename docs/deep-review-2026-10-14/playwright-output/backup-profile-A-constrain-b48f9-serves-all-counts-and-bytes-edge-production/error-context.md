# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: backup-profile.spec.ts >> A constraint failure after the first write aborts the real three-store transaction and preserves all counts and bytes
- Location: tests\visual\backup-profile.spec.ts:253:3

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
        - button "Góc phụ huynh" [ref=e16] [cursor=pointer]:
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
          - strong [ref=e38]: "1"
          - generic [ref=e39]: Không tính thao tác lật thẻ đầu tiên
        - article [ref=e40]:
          - generic [ref=e41]: ✨
          - generic [ref=e42]: Tỷ lệ lượt đúng
          - strong [ref=e43]: 100%
          - generic [ref=e44]: 1/1 lượt đúng
        - article [ref=e45]:
          - generic [ref=e46]: 🏁
          - generic [ref=e47]: Trò chơi hoàn thành
          - strong [ref=e48]: "1"
          - generic [ref=e49]: Không tính phiên thoát giữa chừng
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]:
            - heading "Kỹ năng đã luyện" [level=2] [ref=e53]
            - generic [ref=e54]: Dữ liệu thực tế
          - generic [ref=e56]:
            - strong [ref=e57]: MATH3.NUMBER
            - generic [ref=e58]: 1/1 lượt đúng
          - paragraph [ref=e61]: Tỷ lệ đúng thể hiện các lượt thử, không phải kết luận về mức độ thành thạo của trẻ.
        - generic [ref=e62]:
          - heading "Nhật ký khám phá" [level=2] [ref=e64]
          - generic [ref=e66]:
            - generic [ref=e67]: ✦
            - generic [ref=e68]:
              - strong [ref=e69]: Math Quest
              - generic [ref=e70]: 17:00:00 12/10/2026
            - generic [ref=e71]: Hoàn thành
      - region "Sao lưu hồ sơ học tập" [ref=e72]:
        - generic [ref=e73]:
          - heading "Sao lưu hồ sơ học tập" [level=2] [ref=e74]
          - generic [ref=e75]: Lưu trên thiết bị
        - paragraph [ref=e76]: Tải một bản sao để giữ học liệu, phiên chơi và kết quả học. Tệp hồ sơ được lưu trên máy của bạn.
        - generic [ref=e77]:
          - button "Tải bản sao hồ sơ" [ref=e78] [cursor=pointer]
          - button "Chọn tệp để khôi phục" [ref=e79] [cursor=pointer]
          - button "Chọn tệp hồ sơ học tập" [ref=e80]
        - paragraph [ref=e81]: Khôi phục chỉ thêm hồ sơ chưa có. Bạn có thể tải bản sao hiện tại trước khi thêm. Học liệu và kết quả đang có được giữ nguyên.
        - status [ref=e82]
        - generic [ref=e83]:
          - heading "Xem trước hồ sơ" [level=3] [ref=e84]
          - paragraph [ref=e85]: Bản sao tạo lúc 17:05:00 12/10/2026.
          - table [ref=e86]:
            - caption [ref=e87]: Số bản ghi sẽ thêm và bản ghi đã có
            - rowgroup [ref=e88]:
              - row [ref=e89]:
                - columnheader "Nội dung" [ref=e90]
                - columnheader "Sẽ thêm" [ref=e91]
                - columnheader "Đã có" [ref=e92]
            - rowgroup [ref=e93]:
              - row [ref=e94]:
                - rowheader "Bộ học liệu" [ref=e95]
                - cell "1" [ref=e96]
                - cell "0" [ref=e97]
              - row [ref=e98]:
                - rowheader "Phiên chơi" [ref=e99]
                - cell "1" [ref=e100]
                - cell "0" [ref=e101]
              - row [ref=e102]:
                - rowheader "Lượt thử" [ref=e103]
                - cell "1" [ref=e104]
                - cell "0" [ref=e105]
          - generic [ref=e106]:
            - button "Thêm hồ sơ vào thiết bị" [ref=e107] [cursor=pointer]
            - button "Hủy xem trước" [ref=e108] [cursor=pointer]
      - generic [ref=e109]:
        - strong [ref=e110]: "🔒 Quyền riêng tư trong bản thử nghiệm:"
        - text: Đây là bản demo một thiết bị, chưa có xác thực phụ huynh, hồ sơ nhiều trẻ hoặc kiểm soát truy cập phía máy chủ. Không nhập thông tin cá nhân thật và không đưa bản này lên website công khai.
  - contentinfo [ref=e111]:
    - generic [ref=e112]:
      - strong [ref=e113]: ✦ Bảo An Learning V3.8
      - generic [ref=e114]: Học vui · Hiểu sâu · Tiến bộ mỗi ngày
    - generic [ref=e115]: V3.8 • Thế giới 5 đảo 3D · 100% Offline-First · Âm thanh sống động
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
> 21  |   return page.evaluate(async () => {
      |               ^ Error: page.evaluate: VersionError: The requested version (1) is less than the existing version (3).
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
  75  |   await page.evaluate(async profile => {
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
```
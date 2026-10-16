import { expect, test, type Page } from '@playwright/test';
import type { ContentPack, PairsPack, QuizPack, SentencePack } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';

test.use({ serviceWorkers: 'block' });

const quizHeader = ['Câu hỏi', 'Phương án A', 'Phương án B', 'Phương án C', 'Phương án D', 'Đáp án đúng', 'Giải thích'];
const quizRows = [
  ['11 + 12 = ?', '22', '23', '24', '25', 'B', '11 + 12 = 23.'],
  ['6 × 5 = ?', '25', '35', '30', '40', 'C', '6 × 5 = 30.'],
];
const csv = (rows: string[][]) => '\uFEFF' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
const tsv = (rows: string[][]) => rows.map(row => row.join('\t')).join('\n');
const creatorStatus = (page: Page) => page.locator('.creator-workspace').getByRole('status');
const importDialog = (page: Page) => page.getByRole('dialog', { name: 'Nhập câu hỏi từ Excel', exact: true });

async function storedPacks(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ key: string; pack: ContentPack }[]>((resolve, reject) => {
        const tx = db.transaction('packs', 'readonly'), request = tx.objectStore('packs').getAll();
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function creator(page: Page) {
  await page.goto('/?view=games&controls=1');
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
  await page.getByRole('button', { name: /Xưởng học liệu/ }).click();
  await expect(page.locator('.creator-workspace')).toBeVisible();
  await page.locator('details.creator-manual > summary').click();
}

async function chooseKind(page: Page, kind: ContentPack['kind']) {
  const label = kind === 'quiz' ? /Math Quest · Trắc nghiệm/ : kind === 'pairs' ? /Memory Match & Nối Từ/ : /Sentence Builder & Bậc Thang/;
  await page.locator('.creator-kinds').getByRole('button', { name: label }).click();
}

async function openImport(page: Page) {
  await page.getByRole('button', { name: /Nhập từ Excel \/ Bảng tính/ }).click();
  const dialog = importDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function importJson(page: Page, packs: ContentPack[]) {
  await page.getByLabel('Chọn tệp bộ học liệu JSON', { exact: true }).setInputFiles({
    name: 'ba06-content.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs })),
  });
  await expect(creatorStatus(page)).toContainText(`Đã nhập ${packs.length} bộ mới`);
}

async function draftRows(page: Page, kind: 'quiz' | 'pairs') {
  return page.locator(kind === 'quiz' ? '.quiz-editor' : '.pair-edit-row').evaluateAll(rows => rows.map(row =>
    [...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')].map(control => control.value)));
}

test('BA-06: CSV upload and pasted quiz rows publish the selected B/C answers to real IndexedDB', async ({ page }) => {
  await creator(page);
  for (const mode of ['file', 'paste'] as const) {
    await chooseKind(page, 'quiz');
    const dialog = await openImport(page);
    if (mode === 'file') {
      await dialog.getByLabel('Chọn tệp câu hỏi Excel', { exact: true }).setInputFiles({ name: 'ba06-answers.csv', mimeType: 'text/csv', buffer: Buffer.from(csv([quizHeader, ...quizRows])) });
    } else {
      await dialog.locator('#excel-paste-input').fill(tsv([quizHeader, ...quizRows]));
    }
    await expect(dialog.locator('.excel-preview-box')).toContainText('Đã nhận diện 2 câu hỏi hợp lệ');
    await expect(dialog.locator('.excel-preview-box li')).toHaveCount(0);
    await dialog.getByRole('button', { name: /Xác nhận nạp 2 câu/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.quiz-editor')).toHaveCount(2);
    await expect(page.locator('.quiz-editor').nth(0).locator('select.select')).toHaveValue('1');
    await expect(page.locator('.quiz-editor').nth(1).locator('select.select')).toHaveValue('2');
    const title = `BA06 · Nhập ${mode}`;
    await page.getByLabel('Tên bộ học liệu', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Xuất bản học liệu ↗', exact: true }).click();
    await expect(creatorStatus(page)).toContainText(`Đã xuất bản “${title}” phiên bản 1`);
    const saved = (await storedPacks(page)).find(record => record.pack.title === title)!.pack as QuizPack;
    expect(saved.kind).toBe('quiz');
    expect(saved.items.map(item => item.correctIndex)).toEqual([1, 2]);
    expect(saved.items.map(item => item.prompt)).toEqual(quizRows.map(row => row[0]));
    expect(saved.items.map(item => item.explanation)).toEqual(quizRows.map(row => row[6]));
    expect(new Set(saved.items.map(item => item.id)).size).toBe(2);
  }
  const saved = await storedPacks(page);
  expect(saved).toHaveLength(2);
  await page.reload();
  expect(await storedPacks(page)).toEqual(saved);
});

test('BA-06: missing and invalid answer codes stay out of the draft and mixed input reports its true count', async ({ page }) => {
  await creator(page);
  await chooseKind(page, 'quiz');
  await page.locator('#copy-from').selectOption('math3-adventure@1');
  const before = await draftRows(page, 'quiz');
  const saved = await storedPacks(page);
  const dialog = await openImport(page);
  const invalid = [
    ['2 + 2 = ?', '3', '4', '5', '6', 'Z', '2 + 2 = 4.'],
    ['3 + 3 = ?', '5', '6', '7', '8', '', '3 + 3 = 6.'],
  ];
  await dialog.locator('#excel-paste-input').fill(tsv([quizHeader, ...invalid]));
  await expect(dialog.locator('.excel-preview-box')).toContainText('Đã nhận diện 0 câu hỏi hợp lệ');
  await expect(dialog.locator('.excel-preview-box li')).toHaveCount(2);
  await expect(dialog.locator('.excel-preview-box li').nth(0)).toContainText('Dòng 2: Đáp án trống hoặc không khớp');
  await expect(dialog.locator('.excel-preview-box li').nth(1)).toContainText('Dòng 3: Đáp án trống hoặc không khớp');
  await expect(dialog.getByRole('button', { name: /Xác nhận nạp 0 câu/ })).toBeDisabled();
  expect(await draftRows(page, 'quiz')).toEqual(before);
  expect(await storedPacks(page)).toEqual(saved);
  await dialog.locator('#excel-paste-input').fill(tsv([quizHeader, quizRows[0], invalid[0]]));
  await expect(dialog.locator('.excel-preview-box')).toContainText('Đã nhận diện 1 câu hỏi hợp lệ');
  await expect(dialog.locator('.excel-preview-box li')).toHaveCount(1);
  await expect(dialog.locator('.excel-preview-box li')).toContainText('Dòng 3: Đáp án trống hoặc không khớp');
  await expect(dialog.getByRole('button', { name: /Xác nhận nạp 1 câu/ })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(await draftRows(page, 'quiz')).toEqual(before);
  expect(await storedPacks(page)).toEqual(saved);
});

test('BA-06: title-only copies retain item identity and per-item objectives for all three content kinds', async ({ page }) => {
  await creator(page);
  const quiz = BUILTIN_PACKS.find(pack => pack.id === 'math4-adventure') as QuizPack;
  const pairs = BUILTIN_PACKS.find(pack => pack.id === 'vietnamese3-vocab') as PairsPack;
  const sentences = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
  const fixtures: ContentPack[] = [
    { ...structuredClone(quiz), id: 'ba06-copy-quiz', title: 'BA06 · Quiz nguồn', source: 'local' },
    { ...structuredClone(pairs), id: 'ba06-copy-pairs', title: 'BA06 · Cặp nguồn', source: 'local', items: pairs.items.slice(0, 2).map((item, index) => ({ ...item, id: `ba06-pair-${index}`, objectiveId: `VI3.COPY.${index}` })) },
    { ...structuredClone(sentences), id: 'ba06-copy-sentences', title: 'BA06 · Câu nguồn', source: 'local', items: sentences.items.slice(0, 2).map((item, index) => ({ ...item, id: `ba06-sentence-${index}`, objectiveId: `ENG3.COPY.${index}` })) },
  ];
  await importJson(page, fixtures);
  const original = await storedPacks(page);
  for (const fixture of fixtures) {
    expect(new Set(fixture.items.map(item => item.objectiveId)).size).toBeGreaterThan(1);
    await chooseKind(page, fixture.kind);
    await page.locator('#copy-from').selectOption(`${fixture.id}@1`);
    await page.getByLabel('Tên bộ học liệu', { exact: true }).fill(`${fixture.title} bản mới`);
    await page.getByRole('button', { name: 'Xuất bản học liệu ↗', exact: true }).click();
    await expect(creatorStatus(page)).toContainText('phiên bản 2');
    const rows = await storedPacks(page);
    const previous = rows.find(record => record.key === `${fixture.id}@1`)!;
    const current = rows.find(record => record.key === `${fixture.id}@2`)!.pack;
    expect(previous).toEqual(original.find(record => record.key === previous.key));
    expect(current.items).toEqual(previous.pack.items);
    expect(current.title).toBe(`${fixture.title} bản mới`);
  }
  expect(await storedPacks(page)).toHaveLength(6);
});

test('BA-06: appending two rows to a 29-item draft rejects the whole import and keeps every original row', async ({ page }) => {
  await creator(page);
  const base = BUILTIN_PACKS.find(pack => pack.kind === 'pairs') as PairsPack;
  const pack: PairsPack = { ...base, id: 'ba06-capacity', title: 'BA06 · 29 cặp', source: 'local', items: Array.from({ length: 29 }, (_, index) => ({ kind: 'pair', id: `ba06-original-${index}`, objectiveId: `CUSTOM.CAPACITY.${index % 2}`, left: `Thẻ trái ${index + 1}`, right: `Ý nghĩa ${index + 1}` })) };
  await importJson(page, [pack]);
  await page.locator('#copy-from').selectOption(`${pack.id}@1`);
  await expect(page.locator('.pair-edit-row')).toHaveCount(29);
  const before = await draftRows(page, 'pairs');
  const saved = await storedPacks(page);
  const dialog = await openImport(page);
  await dialog.locator('#excel-paste-input').fill(tsv([['Mặt trái', 'Mặt phải'], ['Câu mới thứ nhất', 'Nghĩa mới thứ nhất'], ['Câu mới thứ hai', 'Nghĩa mới thứ hai']]));
  await expect(dialog.locator('.excel-preview-box')).toContainText('Đã nhận diện 2 câu hỏi hợp lệ');
  await dialog.getByLabel('Thêm tiếp vào danh sách hiện tại', { exact: true }).check();
  await dialog.getByRole('button', { name: /Xác nhận nạp 2 câu/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('Danh sách sẽ có 31 câu, vượt giới hạn 30. Chưa nhập câu nào');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.pair-edit-row')).toHaveCount(29);
  expect(await draftRows(page, 'pairs')).toEqual(before);
  expect(await storedPacks(page)).toEqual(saved);
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.getByRole('button', { name: 'Xuất bản học liệu ↗', exact: true }).click();
  await expect(creatorStatus(page)).toContainText('phiên bản 2');
  const after = await storedPacks(page);
  expect(after.find(record => record.key === `${pack.id}@1`)).toEqual(saved[0]);
  expect(after.find(record => record.key === `${pack.id}@2`)!.pack.items).toEqual(pack.items);
});

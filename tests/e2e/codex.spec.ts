import { expect, test, type Page } from '@playwright/test';

// สารานุกรม: หมวด/ลิงก์ตรง/ตัวดูโมเดล/ค้นหา/ตัวอย่างหาทาง/เปิดระหว่างเล่น

async function open(page: Page, path: string, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('demonSwarmSettings')) localStorage.setItem('demonSwarmSettings', JSON.stringify({ quality: 'low' }));
  });
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as { __DSTD__?: unknown }).__DSTD__);
}

/** จำนวนพิกเซลที่ไม่โปร่งใสใน canvas ของตัวดูโมเดล */
async function viewerPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.cx-viewer canvas');
    if (!c || !c.width) return 0;
    const t = document.createElement('canvas');
    t.width = 64;
    t.height = 64;
    const g = t.getContext('2d')!;
    g.drawImage(c, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
}

test('เปิดจากเมนู แล้วกดได้ทุกหมวด', async ({ page }) => {
  const errors: string[] = [];
  await open(page, '/?test=1&seed=42', errors);
  await page.click('#btnCodex');
  await expect(page.locator('#codexScreen')).toBeVisible();
  await expect(page).toHaveURL(/#codex$/);
  const cats = ['วิธีเล่น', 'การควบคุม', 'ป้อม', 'ศัตรู', 'เวฟ', 'ความยากและตัวคูณ', 'กลไกเกม', 'ธีมแมพ', 'ปรับเกม'];
  for (const c of cats) {
    await page.locator('.cx-nav-item', { hasText: c }).first().click();
    await expect(page.locator('.cx-page-head h2')).toContainText(c);
  }
  // Esc ย้อนกลับไปหน้าแรก แล้วปิด
  await page.keyboard.press('Escape');
  await expect(page.locator('.cx-hero')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#codexScreen')).toBeHidden();
  await expect(page.locator('#menuScreen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ลิงก์ตรงเปิดหน้าบอส + โมเดล 3D แสดงผลและลากหมุนได้', async ({ page }) => {
  const errors: string[] = [];
  await open(page, '/?test=1&seed=42#codex/enemies/boss', errors);
  await expect(page.locator('#codexScreen')).toBeVisible();
  await expect(page.locator('.cx-info h2')).toContainText('ราชาแมลง');
  await expect.poll(() => viewerPixels(page), { timeout: 20_000 }).toBeGreaterThan(400);
  // ปิดหมุนอัตโนมัติ/ท่าเคลื่อนไหว แล้วลาก → ภาพเปลี่ยน
  await page.getByRole('button', { name: /หมุนอัตโนมัติ/ }).click();
  await page.getByRole('button', { name: /ท่าเคลื่อนไหว/ }).click();
  await page.waitForTimeout(500);
  const before = await page.locator('.cx-viewer canvas').screenshot();
  const box = (await page.locator('.cx-viewer canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await page.locator('.cx-viewer canvas').screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  // ไปป้อมเลเซอร์ผ่านค้นหา
  await page.fill('#cxSearch', 'เลเซอร์');
  await expect(page.locator('.cx-result').first()).toBeVisible();
  await page.locator('.cx-result', { hasText: 'เลเซอร์' }).first().click();
  await expect(page).toHaveURL(/#codex\/towers\/laser$/);
  await expect(page.locator('.cx-info h2')).toContainText('เลเซอร์');
  expect(errors).toEqual([]);
});

test('ตัวอย่างหาทาง: วางกำแพงแล้วเส้นทางเปลี่ยน + เครื่องคำนวณ', async ({ page }) => {
  const errors: string[] = [];
  await open(page, '/?test=1&seed=42#codex/mechanics', errors);
  await page.getByRole('button', { name: /ล้างสนาม/ }).click();
  const status = page.locator('.cx-demo-status');
  await expect(status).toContainText('50 ก้าว');
  const box = (await page.locator('.cx-path-canvas').boundingBox())!;
  const cw = box.width / 50;
  // กำแพงแนวตั้งที่คอลัมน์ 10 ตั้งแต่แถว 0 ถึง 20 → ศัตรูต้องอ้อม
  await page.mouse.move(box.x + 10.5 * cw, box.y + 0.5 * cw);
  await page.mouse.down();
  await page.mouse.move(box.x + 10.5 * cw, box.y + 20.5 * cw, { steps: 25 });
  await page.mouse.up();
  await expect(status).not.toContainText('ศัตรูต้องเดิน 50 ก้าว');
  // เครื่องคำนวณ: บอส Wave 10 ยาก
  await page.locator('.cx-nav-item', { hasText: 'ความยากและตัวคูณ' }).click();
  await page.selectOption('#cxCalcEnemy', 'boss');
  await page.fill('#cxCalcWave', '10');
  await page.locator('input[name=cxCalcDiff][value=hard]').check();
  await expect(page.locator('#cxCalcOut .cx-stat b').first()).toHaveText((1100 * 4.8 * 1.4).toLocaleString('th-TH', { maximumFractionDigits: 0 }));
  expect(errors).toEqual([]);
});

test('เปิดระหว่างเล่น → เกมหยุด → ปิดแล้วเล่นต่อ', async ({ page }) => {
  const errors: string[] = [];
  await open(page, '/?test=1&seed=42', errors);
  await page.click('#btnStart');
  await expect(page.locator('#gameUI')).toBeVisible();
  const paused = () => page.evaluate(() => (window as unknown as { __DSTD__: { state(): { paused: boolean } } }).__DSTD__.state().paused);
  expect(await paused()).toBe(false);
  await page.click('#btnCodexGame');
  await expect(page.locator('#codexScreen')).toBeVisible();
  expect(await paused()).toBe(true);
  // Space ระหว่างเปิดสารานุกรมไม่ไปกดหยุด/เล่นเกม
  await page.keyboard.press('Space');
  expect(await paused()).toBe(true);
  await page.click('#cxClose');
  await expect(page.locator('#codexScreen')).toBeHidden();
  await expect(page.locator('#gameUI')).toBeVisible();
  expect(await paused()).toBe(false);
  expect(errors).toEqual([]);
});

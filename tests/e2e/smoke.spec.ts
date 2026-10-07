import { expect, test, type Page } from '@playwright/test';

// ทดสอบการเล่นจริงในเบราว์เซอร์ (WebGL แบบ software จึงตั้งคุณภาพต่ำเพื่อความเร็ว)

type Hook = {
  state(): { mode: string; gold: number | null; towers: { id: number; kind: string; c: number; r: number }[]; enemies: number; paused: boolean; speed: number; phase: string | null; wave: number | null; selTowerId: number };
  cellToScreen(c: number, r: number): { x: number; y: number };
  info(): { calls: number; geometries: number; textures: number };
  spawn(kind: string, n: number): void;
  setGold(n: number): void;
  place(kind: string, c: number, r: number): boolean;
  setQuality(q: string): void;
  advance(sec: number): void;
};

const hook = (page: Page) => page.evaluateHandle(() => (window as unknown as { __DSTD__: Hook }).__DSTD__);
async function state(page: Page) {
  return page.evaluate(() => (window as unknown as { __DSTD__: Hook }).__DSTD__.state());
}
async function screen(page: Page, c: number, r: number) {
  return page.evaluate(([c, r]) => (window as unknown as { __DSTD__: Hook }).__DSTD__.cellToScreen(c!, r!), [c, r]);
}

async function open(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('demonSwarmSettings')) localStorage.setItem('demonSwarmSettings', JSON.stringify({ quality: 'low' }));
  });
  await page.goto('/?test=1&seed=42');
  await page.waitForFunction(() => !!(window as unknown as { __DSTD__?: Hook }).__DSTD__);
}

test('เมนู → เล่นเกม: วาง/อัปเกรด/ขายป้อม, หยุด, เร่ง, เวฟ', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await expect(page.locator('#menuScreen')).toBeVisible();
  await page.click('#btnStart');
  await expect(page.locator('#gameUI')).toBeVisible();
  await page.waitForTimeout(1500); // รอกล้องเข้าที่

  // เลือกป้อมด้วยคีย์ลัด แล้วคลิกวาง
  await page.keyboard.press('Digit1');
  await expect(page.locator('#tb-stone')).toHaveClass(/sel/);
  const p = await screen(page, 10, 6);
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await state(page)).towers.length).toBe(1);
  expect((await state(page)).gold).toBe(250); // เงินเริ่ม 300 − หินขว้าง 50

  // วางในโซนห้าม → ไม่ได้ + มี toast
  const g = await screen(page, 0, 6);
  await page.mouse.click(g.x, g.y);
  await expect(page.locator('#toast')).toBeVisible();
  expect((await state(page)).towers.length).toBe(1);

  // ยกเลิกการเลือก แล้วคลิกป้อมเพื่อเลือก
  await page.keyboard.press('Escape');
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await state(page)).selTowerId).toBeGreaterThan(0);
  await expect(page.locator('#acts')).toBeVisible();

  // อัปเกรด → หอธนู
  await (await hook(page)).evaluate((h) => h.setGold(1000));
  await page.click('#btnUpg');
  await expect.poll(async () => (await state(page)).towers[0]?.kind).toBe('arrow');
  await expect(page.locator('#btnSell')).toContainText('75g');

  // หยุด/เล่นต่อ
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).paused).toBe(false);

  // ขาย
  await page.click('#btnSell');
  await expect.poll(async () => (await state(page)).towers.length).toBe(0);

  // เริ่มเวฟ + เร่ง x3 → ศัตรูเกิด
  await page.click('#btnSkip');
  await page.click('#btnSpd');
  await page.click('#btnSpd');
  expect((await state(page)).speed).toBe(3);
  await (await hook(page)).evaluate((h) => h.advance(4));
  await expect.poll(async () => (await state(page)).enemies).toBeGreaterThan(0);
  expect((await state(page)).phase).toBe('playing');

  // กลับเมนู
  await page.locator('#sidebar [data-action="quit"]').click();
  await expect(page.locator('#menuScreen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('หน้าสร้างแมพ: วาด → บันทึก → เห็นในรายการ → เล่น', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.click('#btnEditor');
  await expect(page.locator('#editorScreen')).toBeVisible();
  await page.waitForTimeout(1500);
  // ลากวาดน้ำแนวนอน
  await page.click('[data-tool="water"]');
  const a = await screen(page, 15, 8);
  const b = await screen(page, 22, 8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await page.mouse.up();
  await page.click('[data-tool="tree"]');
  const t = await screen(page, 30, 12);
  await page.mouse.click(t.x, t.y);

  // บันทึกโดยไม่ตั้งชื่อ → แจ้งเตือน
  await page.click('#edSaveBtn');
  await expect(page.locator('#toast')).toContainText('ใส่ชื่อแมพ');
  await page.fill('#edName', 'e2e');
  await page.click('#edSaveBtn');
  await expect(page.locator('#toast')).toContainText('บันทึกแมพ');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('demonSwarmMaps') ?? '[]'));
  expect(saved).toHaveLength(1);
  expect(saved[0].water.length).toBeGreaterThanOrEqual(6);
  expect(saved[0].obstacles.length).toBe(1);

  // กลับเมนู → แมพของฉัน → เล่น
  await page.locator('#edSidebar [data-action="quit"]').click();
  await page.click('[data-nav="mapsScreen"]');
  await expect(page.locator('.map-row')).toHaveCount(1);
  await expect(page.locator('.map-row .mname')).toContainText('e2e');
  await page.click('.map-row .map-mini:not(.del)');
  await expect(page.locator('#gameUI')).toBeVisible();
  expect((await state(page)).mode).toBe('game');
  expect(errors).toEqual([]);
});

test('ศัตรู 200 ตัว + ป้อม 150 ป้อม: draw call ไม่เกิน 150 ที่คุณภาพสูง', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.click('#btnStart');
  const h = await hook(page);
  await h.evaluate((x) => {
    x.setQuality('high');
    x.setGold(1e7);
    let n = 0;
    for (let c = 3; c < 48 && n < 150; c++) for (let r = 0; r < 28 && n < 150; r += 2) if (x.place(['stone', 'arrow', 'crossbow', 'cannon', 'machinegun', 'laser'][n % 6]!, c, r)) n++;
    for (const k of ['maggot', 'beetle', 'scarab', 'wasp', 'spider']) x.spawn(k, 40);
    x.advance(2);
  });
  await page.waitForTimeout(3000);
  const info = await h.evaluate((x) => x.info());
  expect(info.calls).toBeLessThanOrEqual(150);
  // สุ่มแมพใหม่ซ้ำๆ แล้ว geometry/texture ต้องไม่โตเรื่อยๆ
  await page.locator('#sidebar [data-action="quit"]').click();
  const before = await h.evaluate((x) => x.info());
  for (let i = 0; i < 5; i++) {
    await page.click('#btnStart');
    await page.waitForTimeout(400);
    await page.locator('#sidebar [data-action="quit"]').click();
    await page.waitForTimeout(400);
  }
  const after = await h.evaluate((x) => x.info());
  expect(after.geometries).toBeLessThanOrEqual(before.geometries + 5);
  expect(after.textures).toBeLessThanOrEqual(before.textures + 2);
  expect(errors).toEqual([]);
});

import { COLS, ROWS, SPAWN_GUARD, SPAWN_ROW, Cell } from '../config/constants';
import { THEMES, type ThemeId } from '../config/themes';
import { Grid } from './grid';
import type { Decor, MapData, Obstacle, Pond } from './map';
import { computeDist, spawnReachable } from './pathfinding';
import { cellsInPond, makePondShape } from './pond';
import { pick, type Rng } from './rng';

/** สร้างแมพสุ่ม: แอ่งน้ำใหญ่ + ต้นไม้/หิน + ของตกแต่ง (ไม่ปิดทางศัตรูเด็ดขาด) */
export function generateMap(theme: ThemeId, rng: Rng): MapData {
  const th = THEMES[theme];
  const grid = new Grid();
  const ponds: Pond[] = [];
  const obstacles: Obstacle[] = [];

  // 1) แอ่งน้ำใหญ่ (พื้นที่หลายช่อง ทรงธรรมชาติ ขนาดสุ่ม)
  const wantP = th.ponds[0] + Math.floor(rng() * (th.ponds[1] - th.ponds[0] + 1));
  let madeP = 0;
  let tP = 0;
  while (madeP < wantP && tP < 60) {
    tP++;
    const rx = 3.0 + rng() * 2.5; // รัศมีแนวนอน ~3-5.5 ช่อง
    const ry = 2.6 + rng() * 2.2; // รัศมีแนวตั้ง ~2.6-4.8 ช่อง
    const cx = Math.floor(SPAWN_GUARD + 4 + rng() * (COLS - SPAWN_GUARD - 9));
    const cy = Math.floor(3 + rng() * (ROWS - 6));
    const shape = { cx, cy, rx, ry, harm: makePondShape(rng) };
    const cells = cellsInPond(shape);
    if (cells.length < 4) continue;
    if (cells.some(([c, r]) => grid.get(c, r) !== Cell.Empty)) continue; // อย่าทับแอ่งอื่น
    cells.forEach(([c, r]) => grid.set(c, r, Cell.Obstacle));
    if (spawnReachable(computeDist(grid))) {
      // กอหญ้ารอบขอบแอ่ง (สุ่มตำแหน่งตอนสร้าง คงที่)
      const grass: Pond['grass'] = [];
      const ng = 6 + Math.floor(rng() * 6);
      for (let i = 0; i < ng; i++) grass.push({ ang: rng() * 6.283, s: 0.65 + rng() * 0.6 });
      ponds.push({ ...shape, grass });
      madeP++;
    } else cells.forEach(([c, r]) => grid.set(c, r, Cell.Empty)); // ปิดทาง → ยกเลิกทั้งแอ่ง
  }

  // 2) ต้นไม้/หิน (กีดขวางช่องเดียว เลี่ยงช่องน้ำ)
  const want = 10 + Math.floor(rng() * 10);
  let placed = 0;
  let tries = 0;
  while (placed < want && tries < 500) {
    tries++;
    const c = SPAWN_GUARD + 1 + Math.floor(rng() * (COLS - SPAWN_GUARD - 2));
    const r = Math.floor(rng() * ROWS);
    if (grid.get(c, r) !== Cell.Empty) continue;
    if (r === SPAWN_ROW && c <= SPAWN_GUARD + 2) continue;
    if (c >= COLS - 1) continue;
    grid.set(c, r, Cell.Obstacle);
    if (spawnReachable(computeDist(grid))) {
      obstacles.push({ c, r, type: pick(rng, th.obs), seed: rng() });
      placed++;
    } else grid.set(c, r, Cell.Empty);
  }

  // 3) ของตกแต่งพื้น (ไม่กีดขวาง) เก็บเป็นสัดส่วนของสนาม
  const decor: Decor[] = [];
  const dn = 45 + Math.floor(rng() * 35);
  for (let i = 0; i < dn; i++) {
    decor.push({ fx: rng(), fy: rng(), type: pick(rng, th.dec), s: 0.7 + rng() * 0.7, seed: rng() });
  }

  return { theme, grid, obstacles, decor, ponds };
}

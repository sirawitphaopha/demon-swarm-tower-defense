import { COLS, ROWS, SPAWN_GUARD, SPAWN_ROW } from '../config/constants';
import type { Harmonic, Pond } from './map';
import type { Rng } from './rng';

/** รูปทรงแอ่งน้ำ: ผสมคลื่นหลายความถี่ → ขอบเบี้ยวธรรมชาติ ไม่สมมาตร */
export function makePondShape(rng: Rng): Harmonic[] {
  const amps = [0, 0.16, 0.13, 0.09, 0.06, 0.04]; // amplitude ต่อ harmonic (k=1..5)
  const harm: Harmonic[] = [];
  for (let k = 1; k <= 5; k++) harm.push({ k, amp: amps[k]! * (0.55 + rng() * 0.95), phase: rng() * 6.283 });
  return harm;
}

/** รัศมีสัมพัทธ์ของแอ่งที่มุม ang (1 = รัศมีปกติ) */
export function pondRadius(p: Pick<Pond, 'harm'>, ang: number): number {
  let w = 1;
  for (const h of p.harm) w += h.amp * Math.sin(h.k * ang + h.phase);
  return Math.max(0.5, w);
}

/** ช่องที่อยู่ในขอบเขตแอ่งน้ำ (เว้นโซน spawn/ทางออก) */
export function cellsInPond(p: Pick<Pond, 'cx' | 'cy' | 'rx' | 'ry' | 'harm'>): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c < SPAWN_GUARD + 1 || c >= COLS - 1) continue; // เว้นข้าง spawn/ทางออก
      if (r === SPAWN_ROW && c <= SPAWN_GUARD + 2) continue; // เว้นทางออกหน้า spawn
      const dx = (c - p.cx) / p.rx;
      const dy = (r - p.cy) / p.ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= pondRadius(p, Math.atan2(dy, dx))) cells.push([c, r]);
    }
  return cells;
}

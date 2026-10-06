import { COLS, ROWS, SPAWN_ROW, Cell } from '../config/constants';
import type { Grid } from './grid';

/** ระยะ (จำนวนก้าว) จากแต่ละช่องถึงคอลัมน์ขวาสุด index = row*COLS+col, -1 = ไปไม่ถึง */
export type DistMap = Int16Array;

/** BFS flow-field จากขอบขวา (ทางออก) เดินผ่านได้เฉพาะช่องว่าง */
export function computeDist(grid: Grid): DistMap {
  const d = new Int16Array(COLS * ROWS).fill(-1);
  const q = new Int32Array(COLS * ROWS);
  let head = 0;
  let tail = 0;
  for (let r = 0; r < ROWS; r++) {
    const i = r * COLS + (COLS - 1);
    if (grid.cells[i] === Cell.Empty) {
      d[i] = 0;
      q[tail++] = i;
    }
  }
  while (head < tail) {
    const cur = q[head++]!;
    const c = cur % COLS;
    const r = (cur - c) / COLS;
    const nd = d[cur]! + 1;
    // ซ้าย ขวา บน ล่าง
    if (c > 0) visit(cur - 1);
    if (c < COLS - 1) visit(cur + 1);
    if (r > 0) visit(cur - COLS);
    if (r < ROWS - 1) visit(cur + COLS);
    function visit(n: number): void {
      if (grid.cells[n] !== Cell.Empty || d[n] !== -1) return;
      d[n] = nd;
      q[tail++] = n;
    }
  }
  return d;
}

export const distAt = (d: DistMap, c: number, r: number): number => d[r * COLS + c]!;

/** จุดเกิดศัตรูยังเดินไปถึงทางออกได้ */
export function spawnReachable(d: DistMap): boolean {
  return distAt(d, 0, SPAWN_ROW) !== -1;
}

export interface Step {
  dx: number;
  dy: number;
  /** เดินออกขอบขวา */
  exit: boolean;
}

// ลำดับทิศเหมือนเวอร์ชันเดิม: ขวา ล่าง บน ซ้าย (ใช้ตัดสินเมื่อระยะเท่ากัน)
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [0, -1],
  [-1, 0],
];

/** หาทิศไปช่องเพื่อนบ้านที่ใกล้ทางออกที่สุด */
export function nextStep(grid: Grid, d: DistMap, col: number, row: number): Step {
  let best: Step | null = null;
  let bd = Infinity;
  for (const [dx, dy] of DIRS) {
    const nc = col + dx;
    const nr = row + dy;
    if (nc >= COLS) return { dx: 1, dy: 0, exit: true };
    if (nr < 0 || nr >= ROWS || nc < 0) continue;
    if (grid.get(nc, nr) !== Cell.Empty) continue;
    const dd = distAt(d, nc, nr);
    if (dd < 0) continue;
    if (dd < bd) {
      bd = dd;
      best = { dx, dy, exit: false };
    }
  }
  // ไม่ควรเกิดขึ้น (ระบบกันปิดทาง) — ถ้าติดจริงให้เดินไปทางขวาเหมือนเวอร์ชันเดิม
  return best ?? { dx: 1, dy: 0, exit: false };
}

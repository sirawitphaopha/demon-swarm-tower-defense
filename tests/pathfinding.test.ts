import { describe, expect, it } from 'vitest';
import { Cell, COLS, ROWS, SPAWN_ROW } from '../src/config/constants';
import { Grid } from '../src/core/grid';
import { computeDist, distAt, nextStep, spawnReachable } from '../src/core/pathfinding';
import { wallWithGap, emptyMap } from './helpers';

describe('computeDist', () => {
  it('นับก้าวถึงคอลัมน์ขวาสุดบนสนามว่าง', () => {
    const d = computeDist(new Grid());
    expect(distAt(d, COLS - 1, 0)).toBe(0);
    expect(distAt(d, 0, SPAWN_ROW)).toBe(COLS - 1);
    expect(distAt(d, 10, 5)).toBe(COLS - 1 - 10);
  });

  it('ช่องที่ไม่ว่างเป็น -1 และเดินอ้อมกำแพง', () => {
    const m = emptyMap();
    wallWithGap(m, 20, 0);
    const d = computeDist(m.grid);
    expect(distAt(d, 20, 5)).toBe(-1);
    // จาก (19, SPAWN_ROW) ต้องขึ้นไปแถว 0 ผ่านช่องว่างแล้วลงกลับ
    expect(distAt(d, 19, SPAWN_ROW)).toBe(SPAWN_ROW + 1 + (COLS - 1 - 20));
  });

  it('ปิดทางทั้งหมด = จุดเกิดไปไม่ถึง', () => {
    const g = new Grid();
    for (let r = 0; r < ROWS; r++) g.set(25, r, Cell.Tower);
    expect(spawnReachable(computeDist(g))).toBe(false);
  });
});

describe('nextStep', () => {
  it('คอลัมน์ขวาสุดเดินออกทางขวา', () => {
    const g = new Grid();
    expect(nextStep(g, computeDist(g), COLS - 1, 3)).toEqual({ dx: 1, dy: 0, exit: true });
  });

  it('เลือกเพื่อนบ้านที่ระยะต่ำสุด ลำดับเท่ากันใช้ ขวา ล่าง บน ซ้าย', () => {
    const m = emptyMap();
    m.grid.set(11, 5, Cell.Obstacle); // บังทางขวา
    const d = computeDist(m.grid);
    // ล่างกับบนระยะเท่ากัน → เลือกล่างก่อน
    expect(nextStep(m.grid, d, 10, 5)).toEqual({ dx: 0, dy: 1, exit: false });
  });
});

import { describe, expect, it } from 'vitest';
import { Cell, COLS, ROWS, SPAWN_GUARD, SPAWN_ROW } from '../src/config/constants';
import { THORDER } from '../src/config/themes';
import { generateMap } from '../src/core/mapgen';
import { computeDist, spawnReachable } from '../src/core/pathfinding';
import { mulberry32 } from '../src/core/rng';

describe('generateMap', () => {
  it('seed เดิมได้แมพเดิม', () => {
    const a = generateMap('meadow', mulberry32(42));
    const b = generateMap('meadow', mulberry32(42));
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.decor).toEqual(b.decor);
  });

  it('ทุกธีมหลาย seed: ไม่ปิดทาง ไม่มีสิ่งกีดขวางในโซนห้าม', () => {
    for (const theme of THORDER) {
      for (let seed = 1; seed <= 40; seed++) {
        const m = generateMap(theme, mulberry32(seed));
        expect(spawnReachable(computeDist(m.grid))).toBe(true);
        expect(m.obstacles.length).toBeGreaterThanOrEqual(10);
        expect(m.obstacles.length).toBeLessThanOrEqual(19);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c <= SPAWN_GUARD; c++) expect(m.grid.get(c, r)).toBe(Cell.Empty);
          expect(m.grid.get(COLS - 1, r)).toBe(Cell.Empty);
        }
        for (let c = 0; c <= SPAWN_GUARD + 2; c++) expect(m.grid.get(c, SPAWN_ROW)).toBe(Cell.Empty);
        for (const o of m.obstacles) expect(m.grid.get(o.c, o.r)).toBe(Cell.Obstacle);
        expect(m.decor.length).toBeGreaterThanOrEqual(45);
      }
    }
  });
});

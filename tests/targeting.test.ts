import { describe, expect, it } from 'vitest';
import { Cell, COLS, SPAWN_ROW } from '../src/config/constants';
import { computeDist } from '../src/core/pathfinding';
import { pickTarget, remaining, FLY_EXIT_X } from '../src/core/targeting';
import { emptyMap, newGame } from './helpers';

describe('เป้า "หน้าสุด" ตามทางเดินจริง', () => {
  it('ในเขาวงกต ตัวที่ใกล้ทางออกกว่าอาจอยู่ซ้ายกว่า', () => {
    // กำแพงที่คอลัมน์ 20 เว้นช่องที่แถว 0 → ศัตรูที่ x=19 ต้องอ้อมไกล
    const m = emptyMap();
    for (let r = 1; r < 28; r++) m.grid.set(20, r, Cell.Obstacle);
    const g = newGame({ map: m });
    g.dist = computeDist(m.grid);
    const near = g.spawnEnemy('scarab');
    const far = g.spawnEnemy('scarab');
    // far: x=19.5 แถว 4 (ขวากว่า แต่ยังต้องขึ้นไปลอดช่องที่แถว 0)
    Object.assign(far, { col: 19, row: 4, x: 19.5, y: 4.5, tc: 19, tr: 3, tx: 19.5, ty: 3.5 });
    // near: อยู่แถว 0 คอลัมน์ 18 (กำลังจะลอดช่องว่าง)
    Object.assign(near, { col: 18, row: 0, x: 18.5, y: 0.5, tc: 19, tr: 0, tx: 19.5, ty: 0.5 });
    expect(remaining(near, g.dist)).toBeLessThan(remaining(far, g.dist));

    g.gold = 1000;
    const res = g.place('laser', 17, 2);
    if (!res.ok) throw new Error(res.reason);
    const tw = res.tower;
    tw.target = 'first';
    expect(pickTarget(tw, g.enemies, g.dist)).toBe(near);
    tw.target = 'last';
    expect(pickTarget(tw, g.enemies, g.dist)).toBe(far);
  });

  it('ศัตรูบินคิดระยะจากขอบขวา', () => {
    const g = newGame();
    const w = g.spawnEnemy('wasp');
    w.x = 10;
    expect(remaining(w, g.dist)).toBeCloseTo(FLY_EXIT_X - 10);
    // ศัตรูเดินดินที่ x เท่ากันบนทางตรงต้องได้ระยะใกล้เคียงกัน
    const b = g.spawnEnemy('beetle');
    Object.assign(b, { col: 9, x: 10, tc: 10, tx: 10.5 });
    expect(Math.abs(remaining(b, g.dist) - remaining(w, g.dist))).toBeLessThan(0.6);
    expect(COLS).toBe(50);
  });

  it('strong / weak เลือกตามเลือด', () => {
    const g = newGame();
    const a = g.spawnEnemy('beetle');
    const b = g.spawnEnemy('beetle');
    a.x = 5;
    b.x = 6;
    a.hp = 10;
    b.hp = 40;
    const res = g.place('arrow', 5, SPAWN_ROW - 1);
    if (!res.ok) throw new Error();
    res.tower.target = 'strong';
    expect(pickTarget(res.tower, g.enemies, g.dist)).toBe(b);
    res.tower.target = 'weak';
    expect(pickTarget(res.tower, g.enemies, g.dist)).toBe(a);
  });

  it('นอกระยะไม่เลือก', () => {
    const g = newGame();
    const e = g.spawnEnemy('beetle');
    e.x = 40;
    const res = g.place('stone', 5, SPAWN_ROW - 1);
    if (!res.ok) throw new Error();
    expect(pickTarget(res.tower, g.enemies, g.dist)).toBeNull();
  });
});

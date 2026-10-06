import { describe, expect, it } from 'vitest';
import { Cell, COLS, ROWS, SPAWN_GUARD, SPAWN_ROW } from '../src/config/constants';
import { THEMES } from '../src/config/themes';
import { mulberry32 } from '../src/core/rng';
import { EditorModel } from '../src/editor/EditorModel';

describe('EditorModel', () => {
  it('โซนห้ามวาด: 2 คอลัมน์แรก, คอลัมน์ทางออก, หน้าจุด IN', () => {
    expect(EditorModel.canPaint(0, 5)).toBe(false);
    expect(EditorModel.canPaint(SPAWN_GUARD - 1, 5)).toBe(false);
    expect(EditorModel.canPaint(SPAWN_GUARD, 5)).toBe(true);
    expect(EditorModel.canPaint(COLS - 1, 5)).toBe(false);
    expect(EditorModel.canPaint(SPAWN_GUARD + 2, SPAWN_ROW)).toBe(false);
    expect(EditorModel.canPaint(SPAWN_GUARD + 3, SPAWN_ROW)).toBe(true);
    expect(EditorModel.canPaint(10, ROWS)).toBe(false);
  });

  it('ต้นไม้ใช้ชนิดตามธีม หินเป็นหินเสมอ น้ำเป็นช่อง Water', () => {
    const m = new EditorModel('oasis');
    const rng = mulberry32(1);
    m.paint(10, 3, 'tree', rng);
    m.paint(11, 3, 'rock', rng);
    m.paint(12, 3, 'water', rng);
    expect(m.map.obstacles.map((o) => o.type)).toEqual([THEMES.oasis.obs[0], 'rock']);
    expect(m.map.grid.get(10, 3)).toBe(Cell.Obstacle);
    expect(m.map.grid.get(12, 3)).toBe(Cell.Water);
    // ช่องไม่ว่าง วาดทับไม่ได้
    expect(m.paint(12, 3, 'tree', rng)).toBeNull();
  });

  it('ของตกแต่งได้ช่องละชิ้น และยางลบล้างทุกอย่างในช่อง', () => {
    const m = new EditorModel('meadow');
    const rng = mulberry32(2);
    expect(m.paint(15, 8, 'flower', rng)).not.toBeNull();
    expect(m.paint(15, 8, 'grass', rng)).toBeNull();
    m.paint(15, 8, 'tree', rng);
    expect(m.map.decor).toHaveLength(1);
    const d = m.paint(15, 8, 'erase', rng);
    expect(d).toEqual({ water: false, props: true, decor: true });
    expect(m.map.decor).toHaveLength(0);
    expect(m.map.obstacles).toHaveLength(0);
    expect(m.map.grid.get(15, 8)).toBe(Cell.Empty);
    expect(m.paint(15, 8, 'erase', rng)).toBeNull();
  });

  it('เช็คทางเดินก่อนบันทึก', () => {
    const m = new EditorModel('meadow');
    const rng = mulberry32(3);
    expect(m.valid()).toBe(true);
    for (let r = 0; r < ROWS; r++) m.paint(25, r, 'water', rng);
    expect(m.valid()).toBe(false);
    m.paint(25, 0, 'erase', rng);
    expect(m.valid()).toBe(true);
    const saved = m.toSaved('ทดสอบ');
    expect(saved.name).toBe('ทดสอบ');
    expect(saved.water).toHaveLength(ROWS - 1);
  });
});

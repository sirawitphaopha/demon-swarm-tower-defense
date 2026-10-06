import { beforeEach, describe, expect, it } from 'vitest';
import { Cell } from '../src/config/constants';
import { loadCustom } from '../src/core/customMap';
import { computeDist, spawnReachable } from '../src/core/pathfinding';
import { BEST_KEY, loadBest, recordBest } from '../src/storage/best';
import { MAPS_KEY, deleteMap, loadMaps, sanitizeMap, upsertMap, type SavedMap } from '../src/storage/maps';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from '../src/storage/settings';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const g = globalThis as unknown as { localStorage: MemStorage };

/** แมพที่บันทึกจากเวอร์ชัน 2D (รูปแบบจริงจาก edSave เดิม) */
const MAP_FROM_2D: SavedMap = {
  name: 'ทุ่งของฉัน',
  theme: 'forest',
  obstacles: [
    { c: 10, r: 5, type: 'pine', seed: 0.31 },
    { c: 11, r: 5, type: 'rock', seed: 0.72 },
  ],
  water: [
    [20, 10],
    [21, 10],
    [20, 11],
  ],
  decor: [{ fx: 0.31, fy: 0.5, type: 'grass', s: 0.9, seed: 0.12 }],
} as SavedMap;

beforeEach(() => {
  g.localStorage = new MemStorage();
});

describe('แมพของฉัน', () => {
  it('โหลดแมพที่บันทึกจากเวอร์ชัน 2D ได้ และบันทึกกลับได้ key เดิม', () => {
    g.localStorage.setItem(MAPS_KEY, JSON.stringify([MAP_FROM_2D]));
    const maps = loadMaps();
    expect(maps).toHaveLength(1);
    expect(maps[0]).toEqual(MAP_FROM_2D);
    upsertMap(maps, maps[0]!);
    const raw = JSON.parse(g.localStorage.getItem(MAPS_KEY)!);
    expect(Object.keys(raw[0]).sort()).toEqual(Object.keys(MAP_FROM_2D).sort());
    // แปลงเป็นสนาม: น้ำ = ช่อง Water, ต้นไม้/หิน = Obstacle
    const m = loadCustom(maps[0]!);
    expect(m.grid.get(20, 10)).toBe(Cell.Water);
    expect(m.grid.get(10, 5)).toBe(Cell.Obstacle);
    expect(m.theme).toBe('forest');
    expect(spawnReachable(computeDist(m.grid))).toBe(true);
  });

  it('JSON เสีย = ลิสต์ว่าง, ข้อมูลเพี้ยนถูกกรองทิ้ง', () => {
    g.localStorage.setItem(MAPS_KEY, '{bad json');
    expect(loadMaps()).toEqual([]);
    const s = sanitizeMap({ name: 'x', theme: 'nope', obstacles: [{ c: 999, r: 0, type: 'tree' }, { c: 3, r: 3, type: 'ufo' }], water: [[1, 1], 'x'], decor: [{ fx: 'a' }] });
    expect(s).toEqual({ name: 'x', theme: 'meadow', obstacles: [], water: [[1, 1]], decor: [] });
    expect(sanitizeMap({ theme: 'meadow' })).toBeNull();
  });

  it('ชื่อซ้ำ = เขียนทับ, ลบได้', () => {
    let maps = upsertMap([], { ...MAP_FROM_2D, name: 'a' });
    maps = upsertMap(maps, { ...MAP_FROM_2D, name: 'b' });
    maps = upsertMap(maps, { ...MAP_FROM_2D, name: 'a', theme: 'oasis' });
    expect(maps.map((m) => [m.name, m.theme])).toEqual([
      ['a', 'oasis'],
      ['b', 'forest'],
    ]);
    maps = deleteMap(maps, 0);
    expect(loadMaps().map((m) => m.name)).toEqual(['b']);
  });
});

describe('สถิติสูงสุด', () => {
  it('แยกตามโหมด + ความยาก และไม่แตะ key เก่า', () => {
    g.localStorage.setItem('demonSwarmBest', JSON.stringify({ wave: 9, kills: 300 }));
    recordBest('normal', 'easy', 5, 100);
    recordBest('endless', 'easy', 20, 900);
    expect(loadBest('normal', 'easy')).toEqual({ wave: 5, kills: 100 });
    expect(loadBest('endless', 'easy')).toEqual({ wave: 20, kills: 900 });
    expect(loadBest('normal', 'hard')).toEqual({ wave: 0, kills: 0 });
    expect(JSON.parse(g.localStorage.getItem('demonSwarmBest')!)).toEqual({ wave: 9, kills: 300 });
    expect(Object.keys(JSON.parse(g.localStorage.getItem(BEST_KEY)!))).toEqual(['normal_easy', 'endless_easy']);
  });

  it('บันทึกเมื่อเวฟมากกว่า หรือเวฟเท่ากันแต่ฆ่ามากกว่า', () => {
    recordBest('normal', 'normal', 5, 100);
    expect(recordBest('normal', 'normal', 5, 90)).toEqual({ wave: 5, kills: 100 });
    expect(recordBest('normal', 'normal', 5, 120)).toEqual({ wave: 5, kills: 120 });
    expect(recordBest('normal', 'normal', 4, 999)).toEqual({ wave: 5, kills: 120 });
    expect(recordBest('normal', 'normal', 6, 1)).toEqual({ wave: 6, kills: 1 });
  });
});

describe('ตั้งค่า', () => {
  it('ค่าเริ่มต้น + บันทึก/โหลด + ค่าเพี้ยนกลับเป็นค่าเริ่มต้น', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, quality: 'low', theme: 'oasis', muted: true });
    expect(loadSettings()).toMatchObject({ quality: 'low', theme: 'oasis', muted: true });
    g.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ quality: 'ultra', theme: 7, mode: 'x' }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('ไม่มี localStorage ก็ไม่พัง', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = undefined;
    expect(loadMaps()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => recordBest('normal', 'normal', 1, 1)).not.toThrow();
  });
});

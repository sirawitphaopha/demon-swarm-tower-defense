import { COLS, ROWS } from '../config/constants';
import { DECOR_TYPES, OBSTACLE_TYPES, THEMES, type DecorType, type ObstacleType, type ThemeId } from '../config/themes';
import type { CustomMap } from '../core/customMap';
import { readJson, writeJson } from './store';

/** key เดียวกับเวอร์ชัน 2D → แมพที่ผู้เล่นบันทึกไว้แล้วใช้ต่อได้ทันที */
export const MAPS_KEY = 'demonSwarmMaps';

export type SavedMap = CustomMap & { name: string };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** ตรวจ/ทำความสะอาดข้อมูลแมพหนึ่งอัน (ข้อมูลเสียคืน null) */
export function sanitizeMap(raw: unknown): SavedMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.name !== 'string') return null;
  const theme: ThemeId = typeof m.theme === 'string' && m.theme in THEMES ? (m.theme as ThemeId) : 'meadow';
  const obstacles = (Array.isArray(m.obstacles) ? m.obstacles : [])
    .filter((o): o is { c: number; r: number; type: ObstacleType; seed: number } => {
      const x = o as Record<string, unknown>;
      return !!x && int(x.c) && int(x.r) && x.c >= 0 && x.c < COLS && x.r >= 0 && x.r < ROWS && OBSTACLE_TYPES.includes(x.type as ObstacleType);
    })
    .map((o) => ({ c: o.c, r: o.r, type: o.type, seed: num(o.seed) ? o.seed : 0.5 }));
  const water = (Array.isArray(m.water) ? m.water : [])
    .filter((w): w is [number, number] => Array.isArray(w) && int(w[0]) && int(w[1]) && w[0] >= 0 && w[0] < COLS && w[1] >= 0 && w[1] < ROWS)
    .map((w) => [w[0], w[1]] as [number, number]);
  const decor = (Array.isArray(m.decor) ? m.decor : [])
    .filter((d): d is { fx: number; fy: number; type: DecorType; s: number; seed: number } => {
      const x = d as Record<string, unknown>;
      return !!x && num(x.fx) && num(x.fy) && DECOR_TYPES.includes(x.type as DecorType);
    })
    .map((d) => ({ fx: d.fx, fy: d.fy, type: d.type, s: num(d.s) ? d.s : 1, seed: num(d.seed) ? d.seed : 0.5 }));
  return { name: m.name, theme, obstacles, water, decor };
}

export function loadMaps(): SavedMap[] {
  const raw = readJson<unknown>(MAPS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeMap).filter((m): m is SavedMap => m !== null);
}

export function saveMaps(maps: readonly SavedMap[]): void {
  writeJson(MAPS_KEY, maps);
}

/** บันทึกแมพ (ชื่อซ้ำ = เขียนทับ) คืนลิสต์ใหม่ */
export function upsertMap(maps: readonly SavedMap[], map: SavedMap): SavedMap[] {
  const out = maps.slice();
  const idx = out.findIndex((m) => m.name === map.name);
  if (idx >= 0) out[idx] = map;
  else out.push(map);
  saveMaps(out);
  return out;
}

export function deleteMap(maps: readonly SavedMap[], index: number): SavedMap[] {
  const out = maps.slice();
  out.splice(index, 1);
  saveMaps(out);
  return out;
}

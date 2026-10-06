import { Cell } from '../config/constants';
import { THEMES, type DecorType, type ObstacleType, type ThemeId } from '../config/themes';
import { Grid } from './grid';
import type { Decor, MapData, Obstacle } from './map';

/** แมพที่ผู้เล่นสร้างเอง — รูปแบบเดียวกับที่เวอร์ชัน 2D บันทึกไว้ใน localStorage */
export interface CustomMap {
  name?: string;
  theme: ThemeId;
  obstacles: { c: number; r: number; type: ObstacleType; seed: number }[];
  water: [number, number][];
  decor: { fx: number; fy: number; type: DecorType; s: number; seed: number }[];
}

/** แปลงแมพที่สร้างเองเป็นข้อมูลสนาม (น้ำ = ช่อง Water, ต้นไม้/หิน = Obstacle) */
export function loadCustom(m: CustomMap): MapData {
  const grid = new Grid();
  const obstacles: Obstacle[] = [];
  for (const o of m.obstacles) {
    if (!Grid.inBounds(o.c, o.r)) continue;
    grid.set(o.c, o.r, Cell.Obstacle);
    obstacles.push({ c: o.c, r: o.r, type: o.type, seed: o.seed });
  }
  for (const [c, r] of m.water) if (Grid.inBounds(c, r)) grid.set(c, r, Cell.Water);
  const decor: Decor[] = m.decor.map((d) => ({ fx: d.fx, fy: d.fy, type: d.type, s: d.s, seed: d.seed }));
  return { theme: THEMES[m.theme] ? m.theme : 'meadow', grid, obstacles, decor, ponds: [] };
}

/** แปลงข้อมูลสนามกลับเป็นแมพสำหรับบันทึก */
export function toCustom(name: string, map: MapData): CustomMap & { name: string } {
  return {
    name,
    theme: map.theme,
    obstacles: map.obstacles.map((o) => ({ c: o.c, r: o.r, type: o.type, seed: o.seed })),
    water: map.grid.waterCells(),
    decor: map.decor.map((d) => ({ fx: d.fx, fy: d.fy, type: d.type, s: d.s, seed: d.seed })),
  };
}

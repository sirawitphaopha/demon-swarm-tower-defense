import type { DecorType, ObstacleType, ThemeId } from '../config/themes';
import type { Grid } from './grid';

/** สิ่งกีดขวางช่องเดียว (ต้นไม้/หิน) */
export interface Obstacle {
  c: number;
  r: number;
  type: ObstacleType;
  /** ค่าสุ่มคงที่ ใช้กำหนดหน้าตา (ขนาด/การหมุน/เฉดสี) */
  seed: number;
}

/** ของตกแต่งพื้น ไม่กีดขวาง ตำแหน่งเก็บเป็นสัดส่วนของสนาม (0..1) */
export interface Decor {
  fx: number;
  fy: number;
  type: DecorType;
  s: number;
  seed: number;
}

export interface Harmonic {
  k: number;
  amp: number;
  phase: number;
}

/** แอ่งน้ำทรงธรรมชาติของแมพสุ่ม (กึ่งกลาง/รัศมี หน่วยช่อง) */
export interface Pond {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  harm: Harmonic[];
  /** กอหญ้าริมแอ่ง (มุม, ขนาด) */
  grass: { ang: number; s: number }[];
}

export interface MapData {
  theme: ThemeId;
  grid: Grid;
  obstacles: Obstacle[];
  decor: Decor[];
  ponds: Pond[];
}

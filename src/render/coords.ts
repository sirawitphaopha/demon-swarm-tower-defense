import { COLS, ROWS } from '../config/constants';

// พิกัดโลก 3D: 1 หน่วย = 1 ช่อง · x ของเกม → X, y ของเกม → Z · กึ่งกลางสนามอยู่ที่ (0,0,0)
export const HALF_W = COLS / 2;
export const HALF_H = ROWS / 2;

export const wx = (x: number): number => x - HALF_W;
export const wz = (y: number): number => y - HALF_H;
export const gx = (X: number): number => X + HALF_W;
export const gy = (Z: number): number => Z + HALF_H;

/** มุมหันในระนาบเกม (atan2(dy,dx)) → การหมุนรอบแกน Y ของ three.js (โมเดลหันหน้าไป +X) */
export const yawFromAngle = (a: number): number => -a;
